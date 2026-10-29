// ==========================================================
// TUTOR IA - TESTES AUTOMATIZADOS (node:test, sem dependências)
// Execute com: npm test
// Cada teste sobe o servidor real em uma porta livre, com dados em uma pasta temporária.
// A IA é simulada por um servidor local (nenhuma chave real é usada).
// ==========================================================
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cleanups = [];
after(async () => {
  for (const fn of cleanups.reverse()) await fn().catch(() => {});
});

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-ia-test-'));
  cleanups.push(async () => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Sobe o servidor e devolve utilitários. */
async function startServer({ env = {}, dataDir = tempDir() } = {}) {
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      GEMINI_API_KEY: '',
      OPENAI_API_KEY: '',
      GEMINI_MODEL: '',
      OPENAI_MODEL: '',
      TUTOR_ENV_FILE: path.join(dataDir, 'nao-existe.env'),
      PORT: '0',
      HOST: '127.0.0.1',
      OPEN_BROWSER: 'false',
      DATA_DIR: dataDir,
      AUTH_RATE_LIMIT_MAX_REQUESTS: '1000',
      TUTOR_RATE_LIMIT_MAX_REQUESTS: '1000',
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  proc.stdout.on('data', chunk => { output += chunk; });
  proc.stderr.on('data', chunk => { output += chunk; });
  const exited = new Promise(resolve => proc.once('exit', (code, signal) => resolve({ code, signal })));

  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Servidor não iniciou:\n${output}`)), 8000);
    const check = () => {
      const match = output.match(/Endereço oficial do projeto: http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); return; }
      if (proc.exitCode !== null) { clearTimeout(timer); reject(new Error(`Servidor encerrou:\n${output}`)); return; }
      setTimeout(check, 25);
    };
    check();
  });

  const base = `http://127.0.0.1:${port}`;
  const server = {
    base,
    dataDir,
    exited,
    logs: () => output,
    async stop(signal = 'SIGTERM') {
      if (proc.exitCode === null) proc.kill(signal);
      return exited;
    },
    async json(method, url, body, headers = {}) {
      const response = await fetch(base + url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
      });
      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* resposta não JSON */ }
      return { status: response.status, headers: response.headers, data, text };
    }
  };
  cleanups.push(() => server.stop('SIGKILL'));
  return server;
}

/** Servidor que imita a API do Gemini. */
async function startMockGemini() {
  const state = { requests: [], mode: 'ok', delayMs: 0 };
  const explanation = {
    title: 'Resposta simulada', subtitle: 's', levelTag: 'Iniciante', summary: 'x',
    sections: [{ type: 'concept', title: '1', content: 'conteúdo simulado' }],
    followUpQuestions: [], audioScript: 'a', videoRecommendations: []
  };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      state.requests.push({ url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
      const reply = () => {
        if (state.mode === 'http404') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 404, message: 'models/modelo-inexistente is not found' } }));
          return;
        }
        if (state.mode === 'badjson') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'isto não é json' }] } }] }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(explanation) }] } }] }));
      };
      state.delayMs ? setTimeout(reply, state.delayMs) : reply();
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(async () => { server.closeAllConnections?.(); server.close(); });
  return { state, base: `http://127.0.0.1:${server.address().port}` };
}

const explainBody = { course: 'Matemática', subject: 'Álgebra', topic: 'Equações', question: 'Como resolvo?', format: 'text' };

// ----------------------------------------------------------------------------
describe('servidor básico', () => {
  test('status, headers de segurança, 404 de API e arquivos estáticos', async () => {
    const s = await startServer();
    const status = await s.json('GET', '/api/status');
    assert.equal(status.status, 200);
    assert.equal(status.data.status, 'online');
    assert.equal(status.data.hasApiKey, false);
    assert.equal(status.data.fallback, true);
    assert.equal(status.data.storage, 'json');
    assert.equal(status.data.app, 'tutor-ia', 'identificador usado para detectar instância duplicada');
    assert.equal(status.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(status.headers.get('x-frame-options'), 'DENY');
    assert.equal(status.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(status.headers.get('access-control-allow-origin'), null, 'CORS deve vir desativado por padrão');

    const missing = await s.json('GET', '/api/nao-existe');
    assert.equal(missing.status, 404);
    assert.ok(missing.data.error);

    const index = await fetch(s.base + '/');
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Tutor IA/);
    assert.equal(index.headers.get('cache-control'), 'no-cache');

    const sw = await fetch(s.base + '/sw.js');
    assert.equal(sw.status, 200);
    assert.equal(sw.headers.get('cache-control'), 'no-cache');

    const head = await fetch(s.base + '/', { method: 'HEAD' });
    assert.equal(head.status, 200);
    const post = await fetch(s.base + '/index.html', { method: 'POST' });
    assert.equal(post.status, 405);
  });

  test('URL malformada ou com tentativa de path traversal não derruba nem vaza arquivos', async () => {
    const s = await startServer();
    const raw = path => new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: new URL(s.base).port, path, method: 'GET' }, res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end();
    });

    assert.equal((await raw('/%E0%A4%A')).status, 400);
    assert.equal((await raw('/%00')).status, 400);
    for (const attack of ['/../server.js', '/%2e%2e/server.js', '/..%2fserver.js', '/css/../../server.js', '/../data/users.json']) {
      const result = await raw(attack);
      assert.ok(!result.body.includes('createStorage'), `vazou server.js em ${attack}`);
      assert.ok(!result.body.includes('passwordHash'), `vazou dados em ${attack}`);
    }
    // o servidor continua de pé depois dos ataques
    assert.equal((await s.json('GET', '/api/status')).status, 200);
  });

  test('limite de 100 KB, JSON inválido e corpo que não é objeto', async () => {
    const s = await startServer();
    const big = JSON.stringify({ course: 'a'.repeat(120 * 1024) });
    const tooLarge = await s.json('POST', '/api/tutor/explain', big);
    assert.equal(tooLarge.status, 413);

    // sem Content-Length (chunked) também precisa ser barrado
    const chunked = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: new URL(s.base).port, path: '/api/tutor/explain', method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, res => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.write('{"course":"');
      req.write('a'.repeat(120 * 1024));
      req.end('"}');
    });
    assert.equal(chunked, 413);

    assert.equal((await s.json('POST', '/api/auth/register', '{x')).status, 400);
    assert.equal((await s.json('POST', '/api/tutor/quiz', '[1,2]')).status, 400);
    assert.equal((await s.json('POST', '/api/tutor/quiz', 'null')).status, 400);
  });

  test('rotas do tutor usam o fallback local sem chave de IA e validam campos', async () => {
    const s = await startServer();
    const explain = await s.json('POST', '/api/tutor/explain', explainBody);
    assert.equal(explain.status, 200);
    assert.equal(explain.data.meta.isDemo, true);
    assert.ok(explain.data.tutorExplanation.sections.length > 0);

    const quiz = await s.json('POST', '/api/tutor/quiz', { course: 'Matemática', subject: 'Álgebra', topic: 'Equações' });
    assert.equal(quiz.status, 200);
    assert.equal(quiz.data.meta.isDemo, true);
    assert.ok(quiz.data.questions.length > 0);

    assert.equal((await s.json('POST', '/api/tutor/explain', { course: 'X' })).status, 400);
    assert.equal((await s.json('POST', '/api/tutor/explain', { course: {}, subject: 'a', topic: 'b' })).status, 400);
    const badFormat = await s.json('POST', '/api/tutor/explain', { ...explainBody, format: 'xyz' });
    assert.equal(badFormat.data.meta.format, 'text');
  });
});

// ----------------------------------------------------------------------------
describe('autenticação', () => {
  test('cadastro, login, /me, duplicado, validações e mensagens genéricas', async () => {
    const s = await startServer();
    const register = await s.json('POST', '/api/auth/register', { name: 'Ana', email: 'Ana@Exemplo.com', password: 'senha-forte-1' });
    assert.equal(register.status, 201);
    assert.equal(register.data.user.email, 'ana@exemplo.com');
    assert.ok(register.data.token);

    const me = await s.json('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${register.data.token}` });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.name, 'Ana');
    assert.equal((await s.json('GET', '/api/auth/me')).status, 401);
    assert.equal((await s.json('GET', '/api/auth/me', undefined, { Authorization: 'Bearer invalido' })).status, 401);

    assert.equal((await s.json('POST', '/api/auth/register', { name: 'Ana', email: 'ANA@exemplo.com', password: 'senha-forte-1' })).status, 409);
    assert.equal((await s.json('POST', '/api/auth/register', { name: 'B', email: 'sem-arroba', password: 'senha-forte-1' })).status, 400);
    assert.equal((await s.json('POST', '/api/auth/register', { name: 'B', email: 'b@c.de', password: '1234567' })).status, 400);

    const login = await s.json('POST', '/api/auth/login', { email: 'ana@exemplo.com', password: 'senha-forte-1' });
    assert.equal(login.status, 200);

    const wrongPassword = await s.json('POST', '/api/auth/login', { email: 'ana@exemplo.com', password: 'errada-123' });
    const unknownEmail = await s.json('POST', '/api/auth/login', { email: 'ninguem@exemplo.com', password: 'errada-123' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.data.error, unknownEmail.data.error, 'a mensagem não pode revelar se o e-mail existe');
  });

  test('senha em scrypt e token de sessão guardado apenas como hash', async () => {
    const s = await startServer();
    const register = await s.json('POST', '/api/auth/register', { name: 'Bia', email: 'bia@exemplo.com', password: 'senha-forte-2' });
    const users = JSON.parse(fs.readFileSync(path.join(s.dataDir, 'users.json'), 'utf8'));
    assert.match(users[0].passwordHash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    const authRaw = fs.readFileSync(path.join(s.dataDir, 'auth.json'), 'utf8');
    assert.ok(!authRaw.includes(register.data.token), 'o token não pode aparecer em texto puro no disco');
    const expectedHash = crypto.createHash('sha256').update(register.data.token).digest('hex');
    assert.ok(authRaw.includes(expectedHash));
  });

  test('migra usuário SHA-256 para scrypt no login e converte sessões antigas', async () => {
    const dataDir = tempDir();
    const legacyHash = crypto.createHash('sha256').update('senha-antiga-1').digest('hex');
    const legacyToken = 'a'.repeat(64);
    const future = new Date(Date.now() + 3600_000).toISOString();
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify([
      { id: 'user_legado', name: 'Legado', email: 'Legado@Exemplo.com', passwordHash: legacyHash, createdAt: '2026-01-01T00:00:00.000Z' }
    ]));
    fs.writeFileSync(path.join(dataDir, 'auth.json'), JSON.stringify([
      { token: legacyToken, userId: 'user_legado', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: future },
      { token: 'b'.repeat(64), userId: 'user_legado', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2020-01-01T00:00:00.000Z' }
    ]));

    const s = await startServer({ dataDir });
    // a sessão antiga continua válida e já não existe em texto puro
    const me = await s.json('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${legacyToken}` });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.id, 'user_legado');
    const authRaw = fs.readFileSync(path.join(dataDir, 'auth.json'), 'utf8');
    assert.ok(!authRaw.includes(legacyToken));
    assert.equal(JSON.parse(authRaw).length, 1, 'sessão expirada deve ser removida na inicialização');

    // senha errada não migra
    assert.equal((await s.json('POST', '/api/auth/login', { email: 'legado@exemplo.com', password: 'outra-senha-1' })).status, 401);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'))[0].passwordHash, legacyHash);

    // login correto migra o hash
    const login = await s.json('POST', '/api/auth/login', { email: 'LEGADO@exemplo.com', password: 'senha-antiga-1' });
    assert.equal(login.status, 200);
    const migrated = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'))[0].passwordHash;
    assert.ok(migrated.startsWith('scrypt$'));
    assert.notEqual(migrated, legacyHash);

    // e o mesmo usuário continua conseguindo logar depois da migração
    assert.equal((await s.json('POST', '/api/auth/login', { email: 'legado@exemplo.com', password: 'senha-antiga-1' })).status, 200);
  });

  test('usuários e sessões sobrevivem a reinício do servidor', async () => {
    const dataDir = tempDir();
    const first = await startServer({ dataDir });
    const register = await first.json('POST', '/api/auth/register', { name: 'Caio', email: 'caio@exemplo.com', password: 'senha-forte-3' });
    await first.stop();

    const second = await startServer({ dataDir });
    const me = await second.json('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${register.data.token}` });
    assert.equal(me.status, 200);
    assert.equal((await second.json('POST', '/api/auth/login', { email: 'caio@exemplo.com', password: 'senha-forte-3' })).status, 200);
  });

  test('cadastros simultâneos: e-mail repetido gera um único usuário e os arquivos não corrompem', async () => {
    const s = await startServer();
    const same = await Promise.all(Array.from({ length: 8 }, () =>
      s.json('POST', '/api/auth/register', { name: 'Dup', email: 'dup@exemplo.com', password: 'senha-forte-4' })));
    assert.equal(same.filter(r => r.status === 201).length, 1);
    assert.equal(same.filter(r => r.status === 409).length, 7);

    const many = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      s.json('POST', '/api/auth/register', { name: `U${i}`, email: `u${i}@exemplo.com`, password: 'senha-forte-5' })));
    assert.ok(many.every(r => r.status === 201));

    const users = JSON.parse(fs.readFileSync(path.join(s.dataDir, 'users.json'), 'utf8'));
    assert.equal(users.length, 13);
    assert.equal(new Set(users.map(u => u.id)).size, 13, 'ids precisam ser únicos');
    assert.equal(JSON.parse(fs.readFileSync(path.join(s.dataDir, 'auth.json'), 'utf8')).length, 13);
    assert.deepEqual(fs.readdirSync(s.dataDir).filter(f => f.endsWith('.tmp')), [], 'sem arquivos temporários sobrando');
  });

  test('arquivo de dados corrompido não derruba o servidor e gera cópia de segurança', async () => {
    const dataDir = tempDir();
    fs.writeFileSync(path.join(dataDir, 'users.json'), '{ isto nao e json');
    const s = await startServer({ dataDir });
    assert.equal((await s.json('GET', '/api/status')).status, 200);
    assert.match(s.logs(), /Arquivo de dados inválido \(users\.json\)/);
    assert.ok(fs.readdirSync(dataDir).some(f => f.startsWith('users.json.corrupt-')), 'deve guardar cópia do arquivo corrompido');
    assert.equal((await s.json('POST', '/api/auth/register', { name: 'D', email: 'd@exemplo.com', password: 'senha-forte-6' })).status, 201);
  });

  test('DATA_DIR inexistente é criado automaticamente', async () => {
    const dataDir = path.join(tempDir(), 'sub', 'pasta');
    const s = await startServer({ dataDir });
    assert.equal((await s.json('GET', '/api/status')).status, 200);
    assert.ok(fs.existsSync(path.join(dataDir, 'users.json')));
    assert.ok(fs.existsSync(path.join(dataDir, 'auth.json')));
  });
});

// ----------------------------------------------------------------------------
describe('rate limiting', () => {
  test('login/cadastro: 10 por janela e depois 429 com Retry-After', async () => {
    const s = await startServer({ env: { AUTH_RATE_LIMIT_MAX_REQUESTS: '10' } });
    const results = [];
    for (let i = 0; i < 11; i += 1) {
      results.push(await s.json('POST', '/api/auth/login', { email: 'x@exemplo.com', password: 'qualquer-123' }));
    }
    assert.deepEqual(results.slice(0, 10).map(r => r.status), Array(10).fill(401));
    assert.equal(results[10].status, 429);
    assert.ok(Number(results[10].headers.get('retry-after')) > 0);
    assert.ok(results[10].data.error);
    // cadastro compartilha o mesmo limite por IP
    assert.equal((await s.json('POST', '/api/auth/register', { name: 'a', email: 'a@b.cd', password: 'senha-forte-7' })).status, 429);
  });

  test('tutor: limite por usuário autenticado (usuários diferentes não se afetam)', async () => {
    const s = await startServer({ env: { TUTOR_RATE_LIMIT_MAX_REQUESTS: '3' } });
    const a = await s.json('POST', '/api/auth/register', { name: 'A', email: 'a@exemplo.com', password: 'senha-forte-8' });
    const b = await s.json('POST', '/api/auth/register', { name: 'B', email: 'b@exemplo.com', password: 'senha-forte-9' });
    const authA = { Authorization: `Bearer ${a.data.token}` };
    const authB = { Authorization: `Bearer ${b.data.token}` };
    for (let i = 0; i < 3; i += 1) assert.equal((await s.json('POST', '/api/tutor/explain', explainBody, authA)).status, 200);
    assert.equal((await s.json('POST', '/api/tutor/explain', explainBody, authA)).status, 429);
    assert.equal((await s.json('POST', '/api/tutor/explain', explainBody, authB)).status, 200);
  });

  test('TRUST_PROXY=true separa os usuários por X-Forwarded-For; sem ele, o cabeçalho é ignorado', async () => {
    const body = { email: 'x@exemplo.com', password: 'qualquer-123' };
    const proxied = await startServer({ env: { TRUST_PROXY: 'true', AUTH_RATE_LIMIT_MAX_REQUESTS: '2' } });
    for (let i = 0; i < 2; i += 1) assert.equal((await proxied.json('POST', '/api/auth/login', body, { 'X-Forwarded-For': '1.1.1.1' })).status, 401);
    assert.equal((await proxied.json('POST', '/api/auth/login', body, { 'X-Forwarded-For': '1.1.1.1' })).status, 429);
    assert.equal((await proxied.json('POST', '/api/auth/login', body, { 'X-Forwarded-For': '2.2.2.2' })).status, 401, 'outro cliente não pode ser bloqueado');

    const direct = await startServer({ env: { AUTH_RATE_LIMIT_MAX_REQUESTS: '2' } });
    for (let i = 0; i < 2; i += 1) await direct.json('POST', '/api/auth/login', body, { 'X-Forwarded-For': `9.9.9.${i}` });
    assert.equal((await direct.json('POST', '/api/auth/login', body, { 'X-Forwarded-For': '9.9.9.99' })).status, 429, 'cabeçalho forjado não pode burlar o limite sem proxy confiável');
  });

  test('TRUST_PROXY_HOPS=1 usa o IP que o proxy confiável acrescentou (cliente não consegue forjar)', async () => {
    const s = await startServer({ env: { TRUST_PROXY: 'true', TRUST_PROXY_HOPS: '1', AUTH_RATE_LIMIT_MAX_REQUESTS: '2' } });
    const body = { email: 'x@exemplo.com', password: 'qualquer-123' };
    await s.json('POST', '/api/auth/login', body, { 'X-Forwarded-For': '1.1.1.1, 203.0.113.7' });
    await s.json('POST', '/api/auth/login', body, { 'X-Forwarded-For': '2.2.2.2, 203.0.113.7' });
    assert.equal((await s.json('POST', '/api/auth/login', body, { 'X-Forwarded-For': '3.3.3.3, 203.0.113.7' })).status, 429);
  });
});

// ----------------------------------------------------------------------------
describe('integração com IA (Gemini simulado)', () => {
  test('usa modelo padrão atual, chave no cabeçalho, sem temperature, e reporta sucesso', async () => {
    const mock = await startMockGemini();
    const s = await startServer({ env: { GEMINI_API_KEY: 'chave-secreta-de-teste', GEMINI_API_BASE: mock.base } });

    const explain = await s.json('POST', '/api/tutor/explain', explainBody);
    assert.equal(explain.status, 200);
    assert.equal(explain.data.meta.isDemo, false);
    assert.equal(explain.data.meta.provider, 'Google Gemini');
    assert.equal(explain.data.meta.model, 'gemini-3.8-flash');
    assert.equal(explain.data.tutorExplanation.title, 'Resposta simulada');

    const request = mock.state.requests[0];
    assert.equal(request.url, '/v1beta/models/gemini-3.8-flash:generateContent');
    assert.equal(request.headers['x-goog-api-key'], 'chave-secreta-de-teste');
    assert.ok(!request.url.includes('chave-secreta-de-teste'), 'a chave não pode ir na URL');
    assert.equal(request.body.generationConfig.responseMimeType, 'application/json');
    assert.equal(request.body.generationConfig.temperature, undefined, 'temperature está descontinuado nos modelos 3.x');
    assert.match(request.body.contents[0].parts[0].text, /Matemática/);

    const status = await s.json('GET', '/api/status');
    assert.equal(status.data.hasApiKey, true);
    assert.equal(status.data.model, 'gemini-3.8-flash');
    assert.equal(status.data.fallback, false);
    assert.ok(!status.text.includes('chave-secreta-de-teste'), '/api/status nunca pode expor a chave');
    assert.match(s.logs(), /gemini-3\.8-flash/);
    assert.ok(!s.logs().includes('chave-secreta-de-teste'), 'a chave não pode aparecer nos logs');
  });

  test('GEMINI_MODEL troca o modelo sem mexer no código', async () => {
    const mock = await startMockGemini();
    const s = await startServer({ env: { GEMINI_API_KEY: 'k', GEMINI_API_BASE: mock.base, GEMINI_MODEL: 'gemini-3.6-flash' } });
    await s.json('POST', '/api/tutor/explain', explainBody);
    assert.equal(mock.state.requests[0].url, '/v1beta/models/gemini-3.6-flash:generateContent');
  });

  test('quiz via IA: resposta válida é repassada', async () => {
    const mock = await startMockGemini();
    const s = await startServer({ env: { GEMINI_API_KEY: 'k', GEMINI_API_BASE: mock.base } });
    // o simulado devolve o objeto de explicação (sem "questions"): deve cair no fallback e registrar o motivo
    const quiz = await s.json('POST', '/api/tutor/quiz', { course: 'a', subject: 'b', topic: 'c' });
    assert.equal(quiz.status, 200);
    assert.equal(quiz.data.meta.isDemo, true);
    assert.match(s.logs(), /formato inesperado/);
    assert.equal((await s.json('GET', '/api/status')).data.fallback, true);
  });

  test('HTTP 404 do provedor: fallback local e motivo visível no log e no /api/status', async () => {
    const mock = await startMockGemini();
    mock.state.mode = 'http404';
    const s = await startServer({ env: { GEMINI_API_KEY: 'chave-secreta-de-teste', GEMINI_API_BASE: mock.base } });
    const explain = await s.json('POST', '/api/tutor/explain', explainBody);
    assert.equal(explain.status, 200);
    assert.equal(explain.data.meta.isDemo, true);
    assert.ok(explain.data.tutorExplanation.sections.length > 0);
    assert.match(s.logs(), /HTTP 404/);
    assert.match(s.logs(), /not found/);
    assert.ok(!s.logs().includes('chave-secreta-de-teste'));
    const status = await s.json('GET', '/api/status');
    assert.equal(status.data.fallback, true);
    assert.equal(status.data.lastAiCall.ok, false);
    assert.equal(status.data.lastAiCall.error, 'HTTP 404');
  });

  test('resposta que não é JSON: fallback e log explicativo', async () => {
    const mock = await startMockGemini();
    mock.state.mode = 'badjson';
    const s = await startServer({ env: { GEMINI_API_KEY: 'k', GEMINI_API_BASE: mock.base } });
    const explain = await s.json('POST', '/api/tutor/explain', explainBody);
    assert.equal(explain.data.meta.isDemo, true);
    assert.match(s.logs(), /JSON válido/);
  });

  test('timeout configurável (AI_TIMEOUT_MS): fallback depois do tempo limite', async () => {
    const mock = await startMockGemini();
    mock.state.delayMs = 2000;
    const s = await startServer({ env: { GEMINI_API_KEY: 'k', GEMINI_API_BASE: mock.base, AI_TIMEOUT_MS: '300' } });
    const started = Date.now();
    const explain = await s.json('POST', '/api/tutor/explain', explainBody);
    assert.ok(Date.now() - started < 1500, 'não pode esperar a resposta lenta');
    assert.equal(explain.data.meta.isDemo, true);
    assert.match(s.logs(), /tempo limite/);
  });

  test('retry do provedor faz uma segunda tentativa antes do fallback', async () => {
    const mock = await startMockGemini();
    let requestCount = 0;
    const originalReply = mock.state;
    const server = http.createServer((req, res) => {
      requestCount += 1;
      if (requestCount === 1) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 503, message: 'temporarily unavailable' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        title: 'Ok', subtitle: 's', levelTag: 'Iniciante', summary: 'x',
        sections: [{ type: 'concept', title: '1', content: 'conteúdo simulado' }],
        followUpQuestions: [], audioScript: 'a', videoRecommendations: []
      }) }] } }] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    cleanups.push(async () => { server.closeAllConnections?.(); server.close(); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const s = await startServer({ env: { GEMINI_API_KEY: 'k', GEMINI_API_BASE: base, AI_RETRY_ATTEMPTS: '1' } });
    const explain = await s.json('POST', '/api/tutor/explain', explainBody);
    assert.equal(requestCount, 2, 'deve tentar novamente em falha transitória');
    assert.equal(explain.data.meta.isDemo, false);
    assert.equal(explain.data.tutorExplanation.title, 'Ok');
  });

  test('provedor indisponível (conexão recusada) cai no fallback sem derrubar o servidor', async () => {
    const s = await startServer({ env: { GEMINI_API_KEY: 'k', GEMINI_API_BASE: 'http://127.0.0.1:1' } });
    const explain = await s.json('POST', '/api/tutor/explain', explainBody);
    assert.equal(explain.status, 200);
    assert.equal(explain.data.meta.isDemo, true);
    assert.match(s.logs(), /falha de rede/);
  });

  test('campos muito longos são truncados antes de ir para a IA', async () => {
    const mock = await startMockGemini();
    const s = await startServer({ env: { GEMINI_API_KEY: 'k', GEMINI_API_BASE: mock.base } });
    await s.json('POST', '/api/tutor/explain', { ...explainBody, question: 'q'.repeat(5000), topic: 't'.repeat(900) });
    const prompt = mock.state.requests[0].body.contents[0].parts[0].text;
    assert.ok(!prompt.includes('q'.repeat(1001)));
    assert.ok(!prompt.includes('t'.repeat(201)));
  });
});

// ----------------------------------------------------------------------------
describe('ciclo de vida', () => {
  test('SIGTERM: termina a requisição em andamento, grava os dados e sai com código 0', {
    skip: process.platform === 'win32' ? 'sinais POSIX não são suportados no Windows' : false
  }, async () => {
    const mock = await startMockGemini();
    mock.state.delayMs = 1200;
    const s = await startServer({ env: { GEMINI_API_KEY: 'k', GEMINI_API_BASE: mock.base } });

    const inFlight = s.json('POST', '/api/tutor/explain', explainBody);
    await new Promise(resolve => setTimeout(resolve, 300));
    const started = Date.now();
    const exitPromise = s.stop('SIGTERM');

    const response = await inFlight;
    assert.equal(response.status, 200, 'a requisição em andamento deve ser concluída');
    assert.equal(response.data.meta.isDemo, false);

    const { code } = await exitPromise;
    assert.equal(code, 0);
    assert.ok(Date.now() - started < 10_000);
    assert.match(s.logs(), /SIGTERM recebido/);
    assert.match(s.logs(), /encerrado com segurança/);
  });

  test('SIGTERM sem requisições: encerra rápido', {
    skip: process.platform === 'win32' ? 'sinais POSIX não são suportados no Windows' : false
  }, async () => {
    const s = await startServer();
    const started = Date.now();
    const { code } = await s.stop('SIGTERM');
    assert.equal(code, 0);
    assert.ok(Date.now() - started < 3000);
  });

  test('o servidor registra provedor, modelo, storage e porta na inicialização (sem chave)', async () => {
    const mock = await startMockGemini();
    const s = await startServer({ env: { GEMINI_API_KEY: 'chave-secreta-de-teste', GEMINI_API_BASE: mock.base } });
    assert.match(s.logs(), /Google Gemini · modelo gemini-3\.8-flash/);
    assert.match(s.logs(), /Storage: json/);
    assert.match(s.logs(), /Porta: \d+/);
    assert.ok(!s.logs().includes('chave-secreta-de-teste'));
  });

  test('segunda instância na mesma porta reconhece a primeira (mesmo sem chave de IA) e sai sem abrir outra porta', async () => {
    const first = await startServer();
    const port = new URL(first.base).port;
    const second = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, TUTOR_ENV_FILE: path.join(first.dataDir, 'nao-existe.env'), PORT: port, HOST: '127.0.0.1', OPEN_BROWSER: 'false', DATA_DIR: tempDir() },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    second.stdout.on('data', c => { output += c; });
    second.stderr.on('data', c => { output += c; });
    const code = await new Promise(resolve => second.once('exit', resolve));
    assert.equal(code, 0);
    assert.match(output, /já está rodando na porta/);
    assert.doesNotMatch(output, /Tentando a porta/);
  });

  test('em nuvem (variável RENDER definida) TRUST_PROXY liga sozinho e o navegador não é aberto', async () => {
    const s = await startServer({ env: { RENDER: 'true', OPEN_BROWSER: '' } });
    assert.match(s.logs(), /Ambiente de nuvem detectado/);
    assert.match(s.logs(), /TRUST_PROXY: true/);
    assert.match(s.logs(), /DATA_DIR não definido|Storage: json/);
  });
});
