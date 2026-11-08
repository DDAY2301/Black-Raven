// Direct, implicit-TLS SMTP transport for Cloudflare Workers TCP sockets.
// No third-party email delivery API. Do not log SMTP secrets or message content.
const utf8 = new TextEncoder();
const decode = new TextDecoder();

function base64(value) {
  const bytes = utf8.encode(value);
  let latin1 = "";
  for (let i = 0; i < bytes.length; i += 4096) {
    latin1 += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  return btoa(latin1);
}

export function composeMail({ from, to, replyTo, body }) {
  if (![from, to, replyTo].every((address) => typeof address === "string"
      && /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(address))) {
    throw new Error("Invalid SMTP address");
  }
  const encodedSubject = "=?UTF-8?B?" + base64("Novo povpraševanje - Black Raven Solutions") + "?=";
  const encodedBody = base64(body).replace(/.{1,76}/g, "$&\r\n").trim();
  const mime = [
    "From: Black Raven Website <" + from + ">",
    "To: <" + to + ">",
    "Reply-To: <" + replyTo + ">",
    "Subject: " + encodedSubject,
    "Date: " + new Date().toUTCString(),
    "Message-ID: <" + crypto.randomUUID() + "@blackraven.solutions>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "Auto-Submitted: auto-generated",
    "",
    encodedBody
  ].join("\r\n");
  // Body is base64, so no SMTP dot-stuffing is needed.
  return mime.replace(/\r?\n/g, "\r\n");
}

class Protocol {
  constructor(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.buffer = "";
  }
  async line() {
    while (true) {
      const pos = this.buffer.indexOf("\n");
      if (pos >= 0) {
        const line = this.buffer.slice(0, pos).replace(/\r$/, "");
        this.buffer = this.buffer.slice(pos + 1);
        return line;
      }
      const { value, done } = await this.reader.read();
      if (done) throw new Error("SMTP connection closed");
      this.buffer += decode.decode(value, { stream: true });
      if (this.buffer.length > 16000) throw new Error("SMTP response too long");
    }
  }
  async reply(allowed) {
    const lines = [];
    let code;
    for (let i = 0; i < 32; i++) {
      const line = await this.line();
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!match) throw new Error("Invalid SMTP response");
      if (code && match[1] !== code) throw new Error("Inconsistent SMTP response");
      code = match[1];
      lines.push(match[3]);
      if (match[2] === " ") break;
    }
    if (!allowed.includes(Number(code))) throw new Error("SMTP unexpected response " + code);
    return lines.join("\n");
  }
  async command(cmd, codes) {
    await this.writer.write(utf8.encode(cmd + "\r\n"));
    return this.reply(codes);
  }
  release() {
    try { this.reader.releaseLock(); } catch (_) {}
    try { this.writer.releaseLock(); } catch (_) {}
    try { this.socket.close(); } catch (_) {}
  }
}

async function authorize(protocol, config) {
  const capabilities = await protocol.command("EHLO blackraven.solutions", [250]);
  if (/\bAUTH\b[^\n]*\bPLAIN\b/i.test(capabilities)) {
    await protocol.command("AUTH PLAIN " + base64("\0" + config.username + "\0" + config.password), [235]);
  } else if (/\bAUTH\b[^\n]*\bLOGIN\b/i.test(capabilities)) {
    await protocol.command("AUTH LOGIN", [334]);
    await protocol.command(base64(config.username), [334]);
    await protocol.command(base64(config.password), [235]);
  } else {
    throw new Error("SMTP server does not advertise supported AUTH");
  }
}

export async function smtpTransaction(connectSocket, config, message = null) {
  const socket = connectSocket({ hostname: config.host, port: config.port }, { secureTransport: "on" });
  const protocol = new Protocol(socket);
  const timeout = new Promise((_, reject) => {
    const handle = setTimeout(() => reject(new Error("SMTP timeout")), 12000);
    // Timer cleanup is managed by caller on completion.
    protocol.cancelTimeout = () => clearTimeout(handle);
  });
  try {
    return await Promise.race([ (async () => {
      await socket.opened;
      await protocol.reply([220]);
      await authorize(protocol, config);
      if (message) {
        await protocol.command("MAIL FROM:<" + config.username + ">", [250]);
        await protocol.command("RCPT TO:<" + message.to + ">", [250, 251]);
        await protocol.command("DATA", [354]);
        await protocol.command(message.mime + "\r\n.", [250]);
      }
      // The message is accepted by SMTP at DATA 250, not necessarily delivered to the Inbox.
      return true;
    })(), timeout ]);
  } finally {
    protocol.cancelTimeout?.();
    protocol.release();
  }
}
