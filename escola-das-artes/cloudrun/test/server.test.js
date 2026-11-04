'use strict';
// Testes locais: simulam a API do Sheets e as chaves públicas do IAP.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');

const SERVER = path.join(__dirname, '..', 'server.js');
const SHEET_ID = 'TESTE_planilha_privada_0123456789abcdef';
const AUD = '/projects/123456789/locations/us-central1/services/escola-das-artes';
const ALLOWED = 'celsolauro@gmail.com';

const {privateKey, publicKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'P-256'});
const other = crypto.generateKeyPairSync('ec', {namedCurve: 'P-256'});
const jwk = {...publicKey.export({format: 'jwk'}), kid: 'k1', alg: 'ES256', use: 'sig'};

function jwt(claims, {key = privateKey, kid = 'k1'} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${enc({alg: 'ES256', kid, typ: 'JWT'})}.${enc({iss: 'https://cloud.google.com/iap', aud: AUD, email: ALLOWED, iat: now, exp: now + 600, ...claims})}`;
  const sig = crypto.sign('sha256', Buffer.from(body), {key, dsaEncoding: 'ieee-p1363'});
  return `${body}.${sig.toString('base64url')}`;
}

const sheetRows = [
  ['Escola das Artes 2027 — Professores'],
  ['Código', 'Professor', 'Eixo', 'Contrato', 'Horas contratadas', 'Horas executadas'],
  ['P01', 'Ana Exemplo', 'Música', 'C-01', 720, 446, 0.619, 'ALERTA 60%', 274, '2027-06', 0.1, 0.2, 0.35, 0.45, 0.55, 0.619, 'Acompanhar', '#5E2392'],
  ['P02', '<img src=x onerror=alert(1)>', 'Dança', 'C-02', 100, 120, 1.2, 'EXCEDIDO', -20, '2027-06', 20, 40, 60, 80, 100, 120, 'Regularizar', 'red;background:url(x)'],
  ['', 'Linha sem código', 'Teatro', 'C-03', 50, 1]
];

let sheetsRequests = [];
const mock = http.createServer((req, res) => {
  if (req.url === '/keys') { res.writeHead(200, {'Content-Type': 'application/json'}); return res.end(JSON.stringify({keys: [jwk]})); }
  sheetsRequests.push({url: req.url, auth: req.headers.authorization});
  if (req.headers.authorization !== 'Bearer token-de-teste') { res.writeHead(403); return res.end('{}'); }
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({range: 'Professores!A1:R501', majorDimension: 'ROWS', values: sheetRows}));
});

let child, base;
test.before(async () => {
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  const mockBase = `http://127.0.0.1:${mock.address().port}`;
  const port = 18080 + Math.floor(Math.random() * 1000);
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [SERVER], {
    env: {PATH: process.env.PATH, PORT: String(port), SHEET_ID, ALLOWED_EMAILS: ALLOWED, IAP_AUDIENCE: AUD,
      SHEETS_API_BASE: mockBase, IAP_KEYS_URL: `${mockBase}/keys`, TEST_ACCESS_TOKEN: 'token-de-teste'},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', d => { if (String(d).includes('ouvindo')) resolve(); });
    child.on('exit', code => reject(new Error(`servidor saiu com ${code}`)));
  });
});
test.after(() => { child?.kill(); mock.close(); });

const get = (p, token, opts = {}) => fetch(base + p, {...opts, headers: token ? {'x-goog-iap-jwt-assertion': token} : {}});

test('sem cabeçalho do IAP: 403 em todas as rotas', async () => {
  for (const p of ['/', '/app.js', '/api/professores', '/assets/logo-escola-das-artes.png']) {
    assert.equal((await get(p)).status, 403, p);
  }
});

test('JWT inválido, de outro e-mail, outra audiência, expirado ou assinado por outra chave: 403', async () => {
  const cases = {
    lixo: 'a.b.c',
    outroEmail: jwt({email: 'outra.pessoa@gmail.com'}),
    outraAud: jwt({aud: '/projects/1/locations/x/services/outro'}),
    expirado: jwt({exp: Math.floor(Date.now() / 1000) - 3600}),
    outroEmissor: jwt({iss: 'https://evil.example'}),
    outraChave: jwt({}, {key: other.privateKey}),
    kidDesconhecido: jwt({}, {kid: 'zzz'})
  };
  for (const [name, token] of Object.entries(cases)) {
    assert.equal((await get('/api/professores', token)).status, 403, name);
  }
});

test('usuário autorizado recebe a página com cabeçalhos de segurança e sem ID da planilha', async () => {
  const token = jwt({email: 'CelsoLauro@gmail.com'});
  const page = await get('/', token);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.doesNotMatch(page.headers.get('content-security-policy'), /unsafe-eval|script-src[^;]*unsafe-inline/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.match(page.headers.get('strict-transport-security'), /max-age=31536000/);
  assert.ok(page.headers.get('permissions-policy'));
  assert.ok(page.headers.get('referrer-policy'));
  assert.doesNotMatch(html, /<script>/, 'sem script inline');
  const js = await (await get('/app.js', token)).text();
  for (const body of [html, js]) {
    assert.doesNotMatch(body, /docs\.google\.com|gviz|1hO9u9bfNCcl4ukPH5GVXWQvwn2a0tZVxpEf2GR9ag6g|TESTE_planilha/);
  }
  assert.equal((await get('/assets/logo-escola-das-artes.png', token)).status, 200);
});

test('API lê a planilha pelo servidor e devolve só campos validados', async () => {
  sheetsRequests = [];
  const r = await get('/api/professores?refresh=1', jwt({}));
  assert.equal(r.status, 200);
  const {teachers} = await r.json();
  assert.equal(teachers.length, 2, 'ignora título, cabeçalho e linha sem código');
  assert.deepEqual(Object.keys(teachers[0]).sort(), ['action', 'axis', 'code', 'color', 'contract', 'contracted', 'executed', 'monthly', 'name']);
  assert.deepEqual(teachers[0].monthly, [10, 20, 35, 45, 55, 61.9]);
  assert.equal(teachers[0].color, '#5E2392');
  assert.equal(teachers[1].color, '#0057B8', 'cor fora da allowlist é trocada');
  assert.equal(teachers[1].name, '<img src=x onerror=alert(1)>', 'texto chega como dado; o frontend escapa');
  assert.equal(sheetsRequests.length, 1);
  assert.match(sheetsRequests[0].url, /\/v4\/spreadsheets\/TESTE_planilha_privada_0123456789abcdef\/values\/Professores!A1%3AR501\?valueRenderOption=UNFORMATTED_VALUE/);
  assert.equal(sheetsRequests[0].auth, 'Bearer token-de-teste');
});

test('rotas desconhecidas, travessia de caminho e métodos de escrita são recusados', async () => {
  const token = jwt({});
  assert.equal((await get('/../server.js', token)).status, 404);
  assert.equal((await get('/%2e%2e/server.js', token)).status, 404);
  assert.equal((await get('/package.json', token)).status, 404);
  assert.equal((await get('/api/professores', token, {method: 'POST'})).status, 405);
});

test('no Cloud Run é impossível desligar a verificação do IAP', () => {
  const r = spawnSync(process.execPath, [SERVER], {
    env: {PATH: process.env.PATH, K_SERVICE: 'escola-das-artes', IAP_CHECK: 'off', SHEET_ID, PORT: '0'},
    encoding: 'utf8', timeout: 5000
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /não pode ser desligada/);
});
