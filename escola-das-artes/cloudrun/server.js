'use strict';
// Painel Escola das Artes 2027 — servidor para Cloud Run atrás do IAP.
// Sem dependências externas: somente a biblioteca padrão do Node.js.

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ON_CLOUD_RUN = Boolean(process.env.K_SERVICE);
const PORT = Number(process.env.PORT || 8080);
const SHEET_ID = (process.env.SHEET_ID || '').trim();
const SHEET_RANGE = process.env.SHEET_RANGE || 'Professores!A1:R501';
const ALLOWED_EMAILS = new Set(
  (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
);
const IAP_AUDIENCE = (process.env.IAP_AUDIENCE || '').trim();
const IAP_CHECK = (process.env.IAP_CHECK || 'on').toLowerCase();
const CACHE_TTL_MS = 20_000;
const MAX_ROWS = 500;
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

// Desvios de teste local só são aceitos fora do Cloud Run.
const SHEETS_API_BASE = ON_CLOUD_RUN ? 'https://sheets.googleapis.com' : (process.env.SHEETS_API_BASE || 'https://sheets.googleapis.com');
const IAP_KEYS_URL = ON_CLOUD_RUN ? 'https://www.gstatic.com/iap/verify/public_key-jwk' : (process.env.IAP_KEYS_URL || 'https://www.gstatic.com/iap/verify/public_key-jwk');

function fail(message) { console.error(`Configuração inválida: ${message}`); process.exit(1); }
if (!SHEET_ID || !/^[A-Za-z0-9_-]{20,100}$/.test(SHEET_ID)) fail('SHEET_ID ausente ou inválido');
if (IAP_CHECK !== 'on' && ON_CLOUD_RUN) fail('a verificação do IAP não pode ser desligada no Cloud Run');
if (IAP_CHECK === 'on' && (!IAP_AUDIENCE || ALLOWED_EMAILS.size === 0)) fail('IAP_AUDIENCE e ALLOWED_EMAILS são obrigatórios');

// ---------- Arquivos estáticos (lista fechada, sem leitura de caminhos arbitrários) ----------
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/assets/logo-escola-das-artes.png': ['assets/logo-escola-das-artes.png', 'image/png'],
  '/apple-touch-icon.png': ['assets/logo-escola-das-artes.png', 'image/png'],
  '/favicon.ico': ['assets/logo-escola-das-artes.png', 'image/png']
};
const STATIC_CACHE = new Map(
  Object.entries(STATIC_FILES).map(([route, [file, type]]) => [route, {type, body: fs.readFileSync(path.join(PUBLIC_DIR, file))}])
);

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self'",
    // 'unsafe-inline' em estilos é necessário porque o painel usa atributos style
    // calculados (largura/cor das barras). Scripts inline continuam proibidos.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow'
};

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, {...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-store', ...extra});
  res.end(body);
}
const sendJson = (res, status, obj) => send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj));

// ---------- Verificação do cabeçalho assinado do IAP (defesa em profundidade) ----------
let iapKeys = {fetchedAt: 0, keys: new Map()};
async function getIapKey(kid) {
  const fresh = Date.now() - iapKeys.fetchedAt < 3_600_000;
  if (!fresh || !iapKeys.keys.has(kid)) {
    const r = await fetch(IAP_KEYS_URL, {signal: AbortSignal.timeout(5000)});
    if (!r.ok) throw new Error(`chaves IAP indisponíveis (${r.status})`);
    const jwks = await r.json();
    const keys = new Map();
    for (const jwk of jwks.keys || []) {
      if (jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.kid) keys.set(jwk.kid, crypto.createPublicKey({key: jwk, format: 'jwk'}));
    }
    iapKeys = {fetchedAt: Date.now(), keys};
  }
  return iapKeys.keys.get(kid);
}

const b64urlJson = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

async function verifyIap(req) {
  if (IAP_CHECK !== 'on') return {email: 'teste-local'};
  const token = req.headers['x-goog-iap-jwt-assertion'];
  if (typeof token !== 'string' || token.length > 8192) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, claims;
  try { header = b64urlJson(parts[0]); claims = b64urlJson(parts[1]); } catch { return null; }
  if (header.alg !== 'ES256' || typeof header.kid !== 'string') return null;
  const key = await getIapKey(header.kid);
  if (!key) return null;
  const valid = crypto.verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), {key, dsaEncoding: 'ieee-p1363'}, Buffer.from(parts[2], 'base64url'));
  if (!valid) return null;
  const now = Math.floor(Date.now() / 1000);
  const skew = 60;
  if (claims.iss !== 'https://cloud.google.com/iap') return null;
  if (claims.aud !== IAP_AUDIENCE) return null;
  if (typeof claims.exp !== 'number' || claims.exp < now - skew) return null;
  if (typeof claims.iat !== 'number' || claims.iat > now + skew) return null;
  const email = String(claims.email || '').toLowerCase();
  if (!ALLOWED_EMAILS.has(email)) return null;
  return {email};
}

// ---------- Leitura privada da planilha ----------
let tokenCache = {token: '', expiresAt: 0};
async function getAccessToken() {
  if (!ON_CLOUD_RUN && process.env.TEST_ACCESS_TOKEN) return process.env.TEST_ACCESS_TOKEN;
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const url = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=' + encodeURIComponent(SHEETS_SCOPE);
  const r = await fetch(url, {headers: {'Metadata-Flavor': 'Google'}, signal: AbortSignal.timeout(5000)});
  if (!r.ok) throw new Error(`metadata server respondeu ${r.status}`);
  const data = await r.json();
  tokenCache = {token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 0) * 1000};
  return tokenCache.token;
}

function localeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const percent = raw.endsWith('%');
  const normalized = raw.replace(/%/g, '').replace(/\s/g, '').includes(',')
    ? raw.replace(/%/g, '').replace(/\./g, '').replace(',', '.')
    : raw.replace(/%/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? (percent ? number / 100 : number) : 0;
}
const safeColor = (value) => /^#(?:[0-9a-f]{3}){1,2}$/i.test(String(value ?? '').trim()) ? String(value).trim() : '#0057B8';
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const round1 = (n) => Math.round(n * 10) / 10;

function rowsToTeachers(rows) {
  // Ignora linhas de título/cabeçalho: um professor válido tem código (A) e horas contratadas (E) > 0.
  return rows.slice(0, MAX_ROWS + 5)
    .filter(row => Array.isArray(row) && text(row[0], 40) && localeNumber(row[4]) > 0)
    .slice(0, MAX_ROWS)
    .map(row => ({
      code: text(row[0], 40),
      name: text(row[1], 200),
      axis: text(row[2], 80),
      contract: text(row[3], 80),
      contracted: localeNumber(row[4]),
      executed: localeNumber(row[5]),
      monthly: Array.from({length: 6}, (_, i) => {
        const v = localeNumber(row[10 + i]);
        return round1(v <= 1 ? v * 100 : v);
      }),
      action: text(row[16], 500),
      color: safeColor(row[17])
    }));
}

let dataCache = {at: 0, payload: null};
let inflight = null;
async function loadTeachers(forceRefresh) {
  const age = Date.now() - dataCache.at;
  if (dataCache.payload && (age < (forceRefresh ? 5_000 : CACHE_TTL_MS))) return dataCache.payload;
  if (inflight) return inflight;
  inflight = (async () => {
    const token = await getAccessToken();
    const url = `${SHEETS_API_BASE}/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}/values/${encodeURIComponent(SHEET_RANGE)}?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`;
    const r = await fetch(url, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(10_000)});
    if (!r.ok) throw new Error(`Sheets API respondeu ${r.status}`);
    const data = await r.json();
    const teachers = rowsToTeachers(Array.isArray(data.values) ? data.values : []);
    if (!teachers.length) throw new Error('nenhum professor válido na planilha');
    dataCache = {at: Date.now(), payload: {teachers, updatedAt: new Date().toISOString()}};
    return dataCache.payload;
  })();
  try { return await inflight; } finally { inflight = null; }
}

// ---------- Roteamento ----------
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Método não permitido', {Allow: 'GET, HEAD'});
    const url = new URL(req.url, 'http://localhost');
    const user = await verifyIap(req);
    if (!user) return send(res, 403, 'text/plain; charset=utf-8', 'Acesso negado');

    if (url.pathname === '/api/professores') {
      try {
        return sendJson(res, 200, await loadTeachers(url.searchParams.has('refresh')));
      } catch (error) {
        console.error(JSON.stringify({severity: 'ERROR', message: 'falha ao ler planilha', error: String(error.message)}));
        return sendJson(res, 502, {error: 'Não foi possível ler a planilha'});
      }
    }
    const file = STATIC_CACHE.get(url.pathname);
    if (!file) return send(res, 404, 'text/plain; charset=utf-8', 'Não encontrado');
    return send(res, 200, file.type, req.method === 'HEAD' ? undefined : file.body);
  } catch (error) {
    console.error(JSON.stringify({severity: 'ERROR', message: 'erro interno', error: String(error.message)}));
    if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'Erro interno');
  }
});

server.listen(PORT, () => console.log(`Painel Escola das Artes ouvindo na porta ${PORT} (IAP ${IAP_CHECK}).`));
module.exports = {rowsToTeachers, localeNumber};
