/* Black Raven content API. Read-only public endpoints; authenticated editorial writes.
 * Cloudflare Access validates the editor's login; this Worker ALSO validates its signed JWT.
 * Missing Access/KV configuration always fails closed. Never place secrets in site assets. */
import { editorHtml } from './editor.js';

const KEY_PREFIX = 'br-content-v1:';
const MAX_ITEMS = 80;
const ALLOWED_COLLECTIONS = new Set(['events', 'posts']);
const LIMIT_BYTES = 90000;
const MAX_AGE = 120;
const encoder = new TextEncoder();
let keysCache = { until: 0, keys: [] };

function json(status, value, origin = '', extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
      ...extra
    }
  });
}
function origins(env) {
  return new Set(String(env.SITE_ORIGINS || 'https://blackraven.solutions,https://www.blackraven.solutions,https://dday2301.github.io')
    .split(',').map(x => x.trim()).filter(Boolean));
}
function validIso(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(date + 'T00:00:00.000Z');
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date;
}
function str(v, max = 250) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}
function httpsUrl(v) {
  const value = str(v, 1000);
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('https only');
    return url.href;
  } catch {
    throw Error('Povezava mora biti veljaven naslov https.');
  }
}
export function validateItem(type, item) {
  if (!ALLOWED_COLLECTIONS.has(type) || !item || typeof item !== 'object' || Array.isArray(item)) throw Error('Invalid entry');
  const id = str(item.id, 72);
  if (!/^[a-zA-Z0-9-]{8,72}$/.test(id)) throw Error('Neveljaven ID.');
  const status = item.status === 'published' ? 'published' : 'draft';
  const titleSl = str(item.titleSl, 130);
  if (!titleSl) throw Error('Slovenski naslov je obvezen.');
  const common = { id, status, titleSl, titleEn: str(item.titleEn, 130) };
  if (type === 'events') {
    const startDate = str(item.startDate, 10), endDate = str(item.endDate || startDate, 10);
    if (!validIso(startDate) || !validIso(endDate) || endDate < startDate) throw Error('Neveljavna datuma dogodka.');
    const sourceUrl = httpsUrl(item.sourceUrl);
    const registrationUrl = httpsUrl(item.registrationUrl);
    const confirmed = item.confirmed === true;
    if (status === 'published' && !sourceUrl && !confirmed) {
      throw Error('Za objavo dodaj vir ali potrdi termin z organizatorjem.');
    }
    return {
      ...common, startDate, endDate, location: str(item.location, 160),
      descriptionSl: str(item.descriptionSl, 1200), descriptionEn: str(item.descriptionEn, 1200),
      sourceUrl, registrationUrl, confirmed
    };
  }
  const publishedAt = str(item.publishedAt, 10);
  if (!validIso(publishedAt)) throw Error('Neveljaven datum članka.');
  const bodySl = str(item.bodySl, 12000);
  if (status === 'published' && bodySl.length < 100) throw Error('Članek je prekratek za objavo.');
  return {
    ...common, publishedAt,
    excerptSl: str(item.excerptSl, 400), excerptEn: str(item.excerptEn, 400),
    bodySl, bodyEn: str(item.bodyEn, 12000),
    coverUrl: httpsUrl(item.coverUrl), sourceUrl: httpsUrl(item.sourceUrl)
  };
}
function validateList(type, payload) {
  if (!payload || !Array.isArray(payload.items) || payload.items.length > MAX_ITEMS) throw Error('Največ 80 zapisov.');
  const items = payload.items.map(item => validateItem(type, item));
  if (new Set(items.map(x => x.id)).size !== items.length) throw Error('Podvojen ID.');
  if (encoder.encode(JSON.stringify(items)).length > LIMIT_BYTES) throw Error('Prevelika zbirka.');
  return items;
}
function parseBase64Url(raw) {
  const base = raw.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base + '='.repeat((4 - base.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function readJwt(jwt) {
  if (!jwt || typeof jwt !== 'string' || jwt.length > 8000) throw Error('Missing login');
  const parts = jwt.split('.');
  if (parts.length !== 3) throw Error('Malformed token');
  const header = JSON.parse(new TextDecoder().decode(parseBase64Url(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(parseBase64Url(parts[1])));
  if (header.alg !== 'RS256' || !header.kid) throw Error('Unsupported token');
  return { parts, header, payload };
}
export async function verifyAccess(jwt, env, fetchKeys = fetch) {
  const domain = String(env.ACCESS_TEAM_DOMAIN || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const audience = String(env.ACCESS_AUD || '');
  const emails = String(env.ACCESS_ALLOWED_EMAILS || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !audience || !emails.length) return false;
  try {
    const { parts, header, payload } = readJwt(jwt);
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== 'https://' + domain ||
        !Array.isArray(payload.aud) && typeof payload.aud !== 'string' ||
        !(Array.isArray(payload.aud) ? payload.aud : [payload.aud]).includes(audience) ||
        !Number.isFinite(payload.exp) || payload.exp <= now ||
        (payload.nbf && payload.nbf > now + 60) ||
        !emails.includes(String(payload.email || '').toLowerCase())) return false;
    if (keysCache.until < Date.now()) {
      const response = await fetchKeys('https://' + domain + '/cdn-cgi/access/certs', { redirect: 'error' });
      if (!response.ok) return false;
      const data = await response.json();
      if (!Array.isArray(data.keys)) return false;
      keysCache = { keys: data.keys, until: Date.now() + 10 * 60 * 1000 };
    }
    const jwk = keysCache.keys.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key,
      parseBase64Url(parts[2]), encoder.encode(parts[0] + '.' + parts[1]));
  } catch { return false; }
}
async function readList(env, type) {
  if (!env.CONTENT_KV) return { version: '', items: [] };
  const raw = await env.CONTENT_KV.get(KEY_PREFIX + type, 'json');
  if (!raw || !Array.isArray(raw.items)) return { version: '', items: [] };
  return { version: String(raw.version || ''), items: raw.items };
}
async function readBody(request) {
  if (!String(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw Error('JSON required');
  const body = await request.text();
  if (encoder.encode(body).length > LIMIT_BYTES + 5000) throw Error('Request too large');
  return JSON.parse(body);
}
function accessConfigured(env) {
  return Boolean(env.CONTENT_KV && env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN && env.ACCESS_ALLOWED_EMAILS);
}

export async function handleContent(request, env, url) {
  const path = url.pathname.replace(/\/$/, '') || '/';
  const isPublic = path === '/events' || path === '/posts';
  const isAdmin = path === '/admin' || path === '/admin/events' || path === '/admin/posts';
  if (!isPublic && !isAdmin) return null;
  const origin = request.headers.get('Origin') || '';
  if (isPublic) {
    if (request.method === 'OPTIONS') {
      if (!origins(env).has(origin)) return json(403, { error: 'Origin not allowed' });
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': origin, Vary: 'Origin',
        'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'
      } });
    }
    if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
    if (origin && !origins(env).has(origin)) return json(403, { error: 'Origin not allowed' });
    try {
      const type = path.slice(1);
      const data = await readList(env, type);
      const items = data.items.filter(item => item.status === 'published');
      items.sort((a,b) => String(a.startDate || a.publishedAt).localeCompare(String(b.startDate || b.publishedAt)));
      return json(200, { [type]: items, configured: Boolean(env.CONTENT_KV) }, origin);
    } catch { return json(503, { error: 'Content unavailable' }, origin); }
  }
  if (!accessConfigured(env)) return json(503, { error: 'Editor is not configured' });
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  if (!await verifyAccess(jwt, env)) return json(401, { error: 'Verified editor login required' });
  if (path === '/admin') {
    if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
    return new Response(editorHtml, { status: 200, headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'"
    }});
  }
  const type = path.slice('/admin/'.length);
  if (request.method === 'GET') {
    try { const data = await readList(env, type); return json(200, data); }
    catch { return json(503, { error: 'Content unavailable' }); }
  }
  if (request.method !== 'PUT') return json(405, { error: 'Method not allowed' });
  // Same-origin JSON + signed Cloudflare Access JWT: CSRF is not accepted.
  if (origin !== url.origin) return json(403, { error: 'Origin mismatch' });
  try {
    const data = await readBody(request);
    const items = validateList(type, data);
    const existing = await readList(env, type);
    if (String(data.version || '') !== existing.version) {
      return json(409, { error: 'Vsebina se je med urejanjem spremenila. Osveži stran.' });
    }
    const updated = { version: crypto.randomUUID(), items };
    await env.CONTENT_KV.put(KEY_PREFIX + type, JSON.stringify(updated));
    return json(200, { ok: true, version: updated.version, count: items.length });
  } catch (error) {
    if (error instanceof SyntaxError) return json(400, { error: 'Invalid JSON' });
    if (error instanceof TypeError) return json(400, { error: 'Invalid data' });
    return json(400, { error: String(error.message || 'Invalid entry').slice(0, 150) });
  }
}
