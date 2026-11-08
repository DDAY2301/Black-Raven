import { connect } from "cloudflare:sockets";
import { validateEnquiry, formatEmailText } from "../../backend/lib.js";
import { composeMail, smtpTransaction } from "./smtp.js";

// No public-facing SMTP passwords, no intermediary form processor.
// SMTP credentials are Cloudflare Worker Secrets, not GitHub repo variables.
const RECIPIENT = "info@blackraven.solutions";
const SMTP_HOST = "smtpout.secureserver.net";
const SMTP_PORT = 465;
const DEFAULT_ORIGINS = "https://blackraven.solutions,https://www.blackraven.solutions,https://dday2301.github.io";
let cachedReady = { until: 0, value: false };
let pendingReady = null;

function origins(env) {
  return new Set(String(env.SITE_ORIGINS || DEFAULT_ORIGINS).split(",").map(s => s.trim()).filter(Boolean));
}
function config(env) {
  const username = String(env.SMTP_USER || "");
  const password = String(env.SMTP_PASS || "");
  if (username !== RECIPIENT || !password || password === "REPLACE_ON_SERVER_ONLY") return null;
  return { host: SMTP_HOST, port: SMTP_PORT, username, password };
}
function json(status, value, origin) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {})
    }
  });
}

function smtpFailureStage(error) {
  const message = String(error?.message || "");
  if (/SMTP unexpected response 53[045]/.test(message)) return "smtp_auth_rejected";
  if (/SMTP unexpected response/.test(message)) return "smtp_server_rejected";
  if (/SMTP timeout/.test(message)) return "smtp_timeout";
  return "smtp_socket_or_tls_failure";
}

async function ready(env) {
  const auth = config(env);
  if (!auth) {
    if (Date.now() >= cachedReady.until) {
      console.warn("blackraven-contact SMTP readiness", { result: "unavailable", stage: "runtime_credentials_missing" });
      cachedReady = { until: Date.now() + 60000, value: false };
    }
    return false;
  }
  if (Date.now() < cachedReady.until) return cachedReady.value;
  if (pendingReady) return pendingReady;
  pendingReady = smtpTransaction(connect, auth)
    .then(() => {
      cachedReady = { until: Date.now() + 60000, value: true };
      return true;
    })
    .catch((error) => {
      // Log only a fixed diagnostic category. NEVER log credentials, user data,
      // or raw server replies; this is visible only in Cloudflare Worker logs.
      console.warn("blackraven-contact SMTP readiness", {
        result: "unavailable",
        stage: smtpFailureStage(error)
      });
      cachedReady = { until: Date.now() + 15000, value: false };
      return false;
    })
    .finally(() => { pendingReady = null; });
  return pendingReady;
}

async function parseBody(request) {
  const header = Number(request.headers.get("content-length") || "0");
  if (header > 12000) throw Object.assign(new Error("Too large"), { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error("Missing body"), { status: 400 });
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12000) throw Object.assign(new Error("Too large"), { status: 413 });
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (_) {
    throw Object.assign(new Error("Malformed JSON"), { status: 400 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // The root route deliberately reports a minimal health status too.
    // This distinguishes a live Worker from a Cloudflare edge-level blank 404.
    if ((url.pathname === "/" || url.pathname === "/health") && request.method === "GET") {
      return json(200, { status: "up", service: "blackraven-contact" });
    }
    if (!["/contact", "/ready"].includes(url.pathname)) {
      return json(404, { error: "Not found" });
    }
    const origin = request.headers.get("Origin") || "";
    if (!origins(env).has(origin)) return json(403, { error: "Origin not allowed" });

    if (url.pathname === "/ready" && request.method === "GET") {
      const ok = await ready(env);
      return json(ok ? 200 : 503, { ready: ok }, origin);
    }
    if (url.pathname !== "/contact" || !["POST", "OPTIONS"].includes(request.method)) {
      return json(405, { error: "Method not allowed" }, origin);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "600",
          "Vary": "Origin"
        }
      });
    }

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return json(415, { error: "Use JSON" }, origin);
    }
    if (!config(env)) return json(503, { error: "SMTP not configured" }, origin);
    // Built-in per-location rate limits prevent routine flooding; Cloudflare WAF/Turnstile
    // is recommended before a larger public launch. Both bindings are mandatory.
    if (!env.CONTACT_PER_IP || !env.CONTACT_GLOBAL) return json(503, { error: "Rate limit unavailable" }, origin);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const [perIp, global] = await Promise.all([
      env.CONTACT_PER_IP.limit({ key: ip }),
      env.CONTACT_GLOBAL.limit({ key: "blackraven-contact" })
    ]);
    if (!perIp.success || !global.success) return json(429, { error: "Too many requests" }, origin);

    try {
      const data = validateEnquiry(await parseBody(request));
      if (data.error) return json(400, { error: data.error }, origin);
      // Intentionally accept honeypot submissions without sending.
      if (data.spam) return json(202, { accepted: true }, origin);

      if (!await ready(env)) return json(503, { error: "SMTP unavailable" }, origin);
      const mime = composeMail({
        from: RECIPIENT,
        to: RECIPIENT,
        replyTo: data.value.email,
        body: formatEmailText(data.value)
      });
      await smtpTransaction(connect, config(env), { to: RECIPIENT, mime });
      return json(202, { accepted: true }, origin);
    } catch (error) {
      if ([400, 413].includes(error.status)) return json(error.status, { error: "Invalid request" }, origin);
      // Never log passwords, message content, or personal details.
      console.error("Black Raven SMTP send failed");
      return json(502, { error: "Mail delivery service error" }, origin);
    }
  }
};
