/**
 * Self-hosted contact API. This runs on a Node server, NOT on GitHub Pages.
 * Only a private SMTP login sends an email to the fixed business mailbox.
 * Terminate HTTPS at a reverse proxy; never put SMTP credentials into HTML/JS.
 */
import http from 'node:http';
import nodemailer from 'nodemailer';
import { validateEnquiry, formatEmailText, allowedOrigins } from './lib.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAILBOX = 'info@blackraven.solutions';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtpout.secureserver.net';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const ORIGINS = allowedOrigins(process.env.SITE_ORIGINS);
const configured = Boolean(SMTP_USER && SMTP_PASS && ORIGINS.size && Number.isInteger(SMTP_PORT));
const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000
});

const ipCounters = new Map();
const globalCounters = [];
function withinRateLimit(ip) {
  const now = Date.now();
  const recent = (ipCounters.get(ip) || []).filter(t => t > now - 600000);
  while (globalCounters.length && globalCounters[0] <= now - 60000) globalCounters.shift();
  if (recent.length >= 5 || globalCounters.length >= 25) return false;
  recent.push(now);
  ipCounters.set(ip, recent);
  globalCounters.push(now);
  if (ipCounters.size > 2000) {
    for (const [key, value] of ipCounters) {
      if (!value.some(t => t > now - 600000)) ipCounters.delete(key);
    }
  }
  return true;
}

function respond(res, status, data, origin) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {})
  });
  res.end(JSON.stringify(data));
}

async function jsonBody(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16000) {
      const error = new Error('Request too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) {
    const error = new Error('Malformed JSON');
    error.status = 400;
    throw error;
  }
}

http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    return respond(res, 200, { status: 'up' });
  }
  if (req.url !== '/contact' || !['POST', 'OPTIONS'].includes(req.method)) {
    return respond(res, 404, { error: 'Not found' });
  }
  const origin = req.headers.origin || '';
  if (!ORIGINS.has(origin)) return respond(res, 403, { error: 'Origin not allowed' });

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin'
    });
    return res.end();
  }
  if (!configured) return respond(res, 503, { error: 'Mail service unavailable' }, origin);
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    return respond(res, 415, { error: 'Use JSON' }, origin);
  }
  // A real reverse proxy should enforce IP throttling and bot protection too.
  // Do not trust client-supplied X-Forwarded-For on an untrusted network.
  if (!withinRateLimit(req.socket.remoteAddress || 'unknown')) {
    return respond(res, 429, { error: 'Too many requests' }, origin);
  }

  try {
    const payload = validateEnquiry(await jsonBody(req));
    if (payload.error) return respond(res, 400, { error: payload.error }, origin);
    if (payload.spam) return respond(res, 202, { accepted: true }, origin);

    const info = await transport.sendMail({
      from: { name: 'Black Raven spletna stran', address: SMTP_USER },
      to: MAILBOX,
      replyTo: { name: payload.value.name, address: payload.value.email },
      subject: 'Novo povpraševanje - Black Raven Solutions',
      text: formatEmailText(payload.value),
      disableFileAccess: true,
      disableUrlAccess: true
    });
    const accepted = (info.accepted || []).some(addr => addr.toLowerCase() === MAILBOX);
    if (!accepted) return respond(res, 502, { error: 'SMTP recipient rejected' }, origin);
    // SMTP acceptance does not prove delivery to the recipient inbox.
    return respond(res, 202, { accepted: true }, origin);
  } catch (error) {
    if (error.status === 400 || error.status === 413) return respond(res, error.status, { error: error.message }, origin);
    console.error('Contact SMTP failure:', error.code || 'unexpected');
    return respond(res, 502, { error: 'Mail service failed' }, origin);
  }
}).listen(PORT, HOST, () => {
  console.log('Black Raven contact API listening on ' + HOST + ':' + PORT +
    (configured ? '' : ' (disabled: configure SMTP and SITE_ORIGINS)'));
});
