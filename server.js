import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';
import { generateSmartDemoExplanation, generateDemoQuiz } from './public/js/data/demoData.js';
import { createRateLimiter } from './src/rateLimit.js';
import { createStorage } from './src/storage/index.js';
import { createAiClient } from './src/ai.js';
import { buildExplainSystemPrompt, buildQuizSystemPrompt } from './src/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

// ========================================================
// LEITOR NATIVO DE VARIÁVEIS DE AMBIENTE (.env)
// Carrega automaticamente o arquivo .env sem precisar de npm install
// ========================================================
function loadLocalEnv() {
  // TUTOR_ENV_FILE permite apontar outro arquivo (usado pelos testes automatizados).
  const envPath = process.env.TUTOR_ENV_FILE || path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex !== -1) {
            const key = trimmed.slice(0, eqIndex).trim();
            const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log('📄 Arquivo .env carregado com sucesso!');
    } catch (err) {
      console.warn('⚠️  Aviso ao carregar .env:', err.message);
    }
  }
}

loadLocalEnv();

// ========================================================
// CONFIGURAÇÃO (lida depois do .env)
// ========================================================
// Plataformas de nuvem conhecidas definem estas variáveis automaticamente.
const IS_CLOUD = ['RENDER', 'RAILWAY_ENVIRONMENT', 'RAILWAY_PROJECT_ID', 'FLY_APP_NAME', 'K_SERVICE', 'DYNO', 'VERCEL']
  .some(name => Boolean(process.env[name]));

const parsedPort = process.env.PORT === undefined || process.env.PORT === '' ? 3000 : Number(process.env.PORT);
const PORT = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 3000;
const HOST = process.env.HOST || '0.0.0.0';

const OPEN_BROWSER = process.env.OPEN_BROWSER === 'true'
  || (
    process.env.OPEN_BROWSER !== 'false'
    && process.env.NODE_ENV !== 'production'
    && String(process.env.CI || '').toLowerCase() !== 'true'
    && !IS_CLOUD
  );

function getPositiveIntegerEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2147483647 ? parsed : fallback;
}

const MAX_REQUEST_BODY_BYTES = 100 * 1024;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const DUMMY_PASSWORD_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const scryptAsync = promisify(crypto.scrypt);

// Atrás de proxy (Render, Railway, Fly...) o IP real vem em X-Forwarded-For.
// Sem isso, todos os usuários pareceriam ter o mesmo IP e dividiriam o mesmo limite.
// Em nuvem o padrão é "true"; defina TRUST_PROXY=false para desativar.
const trustProxyEnv = String(process.env.TRUST_PROXY ?? '').trim().toLowerCase();
const TRUST_PROXY = trustProxyEnv ? trustProxyEnv === 'true' : IS_CLOUD;
// Modo mais seguro (opcional): quantos proxies confiáveis existem na frente do app.
// Com TRUST_PROXY_HOPS=1 usa-se o último IP do cabeçalho, que o cliente não consegue forjar.
const TRUST_PROXY_HOPS = getPositiveIntegerEnv('TRUST_PROXY_HOPS', 0);

// CORS desativado por padrão (o front é servido pelo mesmo servidor). Para liberar um
// site externo, defina CORS_ORIGIN=https://meu-site.com
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || '').trim();

const FIELD_LIMITS = { course: 200, subject: 200, topic: 200, question: 1000, explanationContext: 12000 };
const VALID_FORMATS = new Set(['text', 'video', 'audio']);

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=UTF-8',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=UTF-8'
};

// ========================================================
// SERVIÇOS: STORAGE (usuários/sessões) E IA
// ========================================================
const storage = await createStorage({ dataDir: process.env.DATA_DIR || path.join(__dirname, 'data') });
const ai = createAiClient(process.env);

const sessionCleanupTimer = setInterval(() => {
  storage.deleteExpiredSessions().catch(error => console.warn('⚠️  Falha ao limpar sessões expiradas:', error.message));
}, 60 * 60 * 1000);
sessionCleanupTimer.unref();

const authRateLimiter = createRateLimiter({
  limit: getPositiveIntegerEnv('AUTH_RATE_LIMIT_MAX_REQUESTS', 10),
  windowMs: getPositiveIntegerEnv('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000)
});
const tutorRateLimiter = createRateLimiter({
  limit: getPositiveIntegerEnv('TUTOR_RATE_LIMIT_MAX_REQUESTS', 30),
  windowMs: getPositiveIntegerEnv('TUTOR_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000)
});

// ========================================================
// SENHAS (scrypt) E SESSÕES
// ========================================================
async function hashPassword(value) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(String(value), salt, 64, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

async function verifyPassword(value, storedHash) {
  const hash = String(storedHash || '');

  if (!hash.startsWith('scrypt$')) {
    if (!/^[a-f\d]{64}$/i.test(hash)) {
      return { valid: false, needsUpgrade: false };
    }

    const expectedHash = Buffer.from(hash, 'hex');
    const actualHash = crypto.createHash('sha256').update(String(value)).digest();
    return {
      valid: crypto.timingSafeEqual(actualHash, expectedHash),
      needsUpgrade: true
    };
  }

  const [, nText, rText, pText, saltText, keyText, extra] = hash.split('$');
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  const salt = Buffer.from(saltText || '', 'base64');
  const expectedKey = Buffer.from(keyText || '', 'base64');
  const memoryRequired = 128 * N * r + 128 * r * p + 1024;

  if (
    extra !== undefined
    || !Number.isSafeInteger(N)
    || N < 2
    || (N & (N - 1)) !== 0
    || N > 262144
    || !Number.isSafeInteger(r)
    || r < 1
    || r > 32
    || !Number.isSafeInteger(p)
    || p < 1
    || p > 16
    || memoryRequired > 64 * 1024 * 1024
    || salt.length === 0
    || expectedKey.length !== 64
  ) {
    return { valid: false, needsUpgrade: false };
  }

  const actualKey = await scryptAsync(String(value), salt, expectedKey.length, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024
  });
  return {
    valid: crypto.timingSafeEqual(actualKey, expectedKey),
    needsUpgrade: false
  };
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, networkInterfaces] of Object.entries(interfaces)) {
    for (const networkInterface of networkInterfaces || []) {
      if (
        networkInterface.family === 'IPv4'
        && !networkInterface.internal
        && !networkInterface.address.startsWith('169.254.')
      ) {
        addresses.push({ name, address: networkInterface.address });
      }
    }
  }

  return addresses.sort((first, second) => {
    const getPriority = name => /wi-?fi|wlan|wireless/i.test(name) ? 0 : 1;
    return getPriority(first.name) - getPriority(second.name);
  });
}

function getMobileAccessAddresses() {
  const addresses = getLocalIpAddresses();
  const wifiAddresses = addresses.filter(({ name }) => /wi-?fi|wlan|wireless/i.test(name));
  return wifiAddresses.length > 0 ? wifiAddresses : addresses;
}

function isLoopbackHost(host) {
  return host === 'localhost' || host === '::1' || host.startsWith('127.');
}

function openBrowser(url) {
  let command;
  let args;
  let options = { detached: true, stdio: 'ignore' };

  if (process.platform === 'win32') {
    command = 'cmd.exe';
    args = ['/c', 'start', '""', url];
    options = { ...options, windowsVerbatimArguments: true };
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  const browserProcess = spawn(command, args, options);
  browserProcess.once('error', error => {
    console.warn(`⚠️ Não foi possível abrir o navegador automaticamente: ${error.message}`);
    console.warn(`➡️ Abra manualmente: ${url}`);
  });
  browserProcess.unref();
}

async function issueSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await storage.createSession({
    token,
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
  });
  return token;
}

async function getAuthenticatedUser(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;

  const session = await storage.findSession(token);
  if (!session) return null;
  return storage.findUserById(session.userId);
}

// ========================================================
// UTILITÁRIOS HTTP
// ========================================================
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, message, headers = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=UTF-8', ...headers });
  res.end(message);
}

function getClientIp(req) {
  let ip = '';

  if (TRUST_PROXY) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const entries = typeof forwardedFor === 'string'
      ? forwardedFor.split(',').map(item => item.trim()).filter(Boolean)
      : [];
    if (entries.length > 0) {
      ip = TRUST_PROXY_HOPS > 0
        ? entries[Math.max(0, entries.length - TRUST_PROXY_HOPS)]
        : entries[0];
    }
  }

  ip = ip || req.socket.remoteAddress || 'unknown';
  return ip.replace(/^::ffff:/i, '');
}

function enforceRateLimit(res, result) {
  if (result.allowed) {
    return false;
  }

  sendJson(
    res,
    429,
    { error: 'Muitas requisições. Tente novamente mais tarde.' },
    { 'Retry-After': String(result.retryAfterSeconds) }
  );
  return true;
}

function serveStaticFile(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Método não permitido: 405', { Allow: 'GET, HEAD, OPTIONS' });
  }

  const relativePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(PUBLIC_DIR, path.normalize(relativePath));

  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendText(res, 404, 'Arquivo não encontrado: 404');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(pathname)) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      } else {
        return sendText(res, 404, 'Arquivo não encontrado: 404');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        return sendText(res, 500, 'Erro interno ao ler arquivo: 500');
      }
      // "no-cache" = o navegador sempre revalida; assim cada novo deploy chega aos usuários.
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': 'no-cache'
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    });
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const tooLarge = () => {
      const error = new Error('O corpo da requisição excede 100 KB.');
      error.statusCode = 413;
      return error;
    };

    const declaredLength = Number(req.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      req.resume();
      reject(tooLarge());
      return;
    }

    const chunks = [];
    let bodyBytes = 0;
    let settled = false;
    req.on('data', chunk => {
      if (settled) return;
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_REQUEST_BODY_BYTES) {
        settled = true;
        reject(tooLarge());
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      const invalid = () => {
        const error = new Error('JSON inválido');
        error.statusCode = 400;
        return error;
      };
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const parsed = body ? JSON.parse(body) : {};
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(invalid());
          return;
        }
        resolve(parsed);
      } catch {
        reject(invalid());
      }
    });
    req.on('error', error => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

function sendRouteError(res, error, message) {
  if (error.statusCode === 413) {
    return sendJson(res, 413, { error: 'O corpo da requisição não pode ultrapassar 100 KB.' }, { Connection: 'close' });
  }
  if (error.statusCode === 400) {
    return sendJson(res, 400, { error: 'Requisição inválida: envie um objeto JSON válido.' });
  }
  // Detalhes técnicos ficam só no log do servidor; o cliente recebe uma mensagem genérica.
  console.error(`❌ ${message}:`, error);
  return sendJson(res, 500, { error: message });
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

// ========================================================
// GERADORES DIDÁTICOS DE CONTINGÊNCIA (USAM A BASE EDUCACIONAL COMPLETA)
// ========================================================
function getFallbackExplanation(course, subject, topic, question, format = 'text') {
  return generateSmartDemoExplanation(course, subject, topic, question, format);
}

function getFallbackQuiz(course, subject, topic, explanationContext = null) {
  return generateDemoQuiz(course, subject, topic, explanationContext);
}

// ========================================================
// ROTAS
// ========================================================
async function handleRequest(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (TRUST_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  }
  if (CORS_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // URLs malformadas (ex.: "/%E0%A4%A") não podem derrubar o servidor.
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return sendText(res, 400, 'Requisição inválida: 400');
  }
  if (pathname.includes('\0')) {
    return sendText(res, 400, 'Requisição inválida: 400');
  }

  if (req.method === 'POST' && (pathname === '/api/auth/login' || pathname === '/api/auth/register')) {
    if (enforceRateLimit(res, authRateLimiter.consume(`ip:${getClientIp(req)}`))) return;
  }

  if (req.method === 'POST' && (pathname === '/api/tutor/explain' || pathname === '/api/tutor/quiz')) {
    const user = await getAuthenticatedUser(req);
    const key = user ? `user:${user.id}` : `ip:${getClientIp(req)}`;
    if (enforceRateLimit(res, tutorRateLimiter.consume(key))) return;
  }

  // ROTA: STATUS DA API E MODELO (também serve como health check da plataforma)
  if (req.method === 'GET' && pathname === '/api/status') {
    const aiInfo = ai.describe();
    return sendJson(res, 200, {
      status: 'online',
      app: 'tutor-ia',
      stage: 'Etapa 2 — Inteligência Artificial Conectada',
      mode: ai.hasKey ? 'live_ai' : 'demo_mode',
      hasApiKey: ai.hasKey,
      provider: ai.provider,
      model: aiInfo.model,
      fallback: aiInfo.fallback,
      lastAiCall: aiInfo.lastAiCall,
      storage: storage.driver,
      message: ai.hasKey
        ? `Tutor IA operando com inteligência artificial ativa em tempo real (${ai.provider}).`
        : 'Modo Demonstração ativo: adicione sua GEMINI_API_KEY no arquivo .env para ativar respostas em tempo real.',
      version: '2.1.0'
    });
  }

  // ROTA: CADASTRO
  if (req.method === 'POST' && pathname === '/api/auth/register') {
    try {
      const payload = await readRequestBody(req);
      const { name = '', email = '', password = '' } = payload;

      if (
        typeof name !== 'string'
        || typeof email !== 'string'
        || typeof password !== 'string'
        || !name.trim()
        || !email.trim()
        || !password.trim()
      ) {
        return sendJson(res, 400, { error: 'Informe nome, e-mail e senha.' });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return sendJson(res, 400, { error: 'Informe um e-mail válido.' });
      }

      if ([...password].length < 8) {
        return sendJson(res, 400, { error: 'A senha deve ter pelo menos 8 caracteres.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (await storage.findUserByEmail(normalizedEmail)) {
        return sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' });
      }

      const newUser = {
        id: `user_${crypto.randomUUID()}`,
        name: name.trim().slice(0, 120),
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString()
      };

      try {
        await storage.createUser(newUser);
      } catch (error) {
        if (error.code === 'EMAIL_EXISTS') {
          return sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' });
        }
        throw error;
      }

      const token = await issueSession(newUser.id);

      return sendJson(res, 201, {
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email
        }
      });
    } catch (error) {
      return sendRouteError(res, error, 'Erro ao registrar usuário.');
    }
  }

  // ROTA: LOGIN
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const payload = await readRequestBody(req);
      const { email = '', password = '' } = payload;

      if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
        return sendJson(res, 400, { error: 'E-mail e senha são obrigatórios.' });
      }

      const user = await storage.findUserByEmail(email);

      // Mesmo quando o e-mail não existe, executa o scrypt para não revelar a existência da conta pelo tempo de resposta.
      const verification = user
        ? await verifyPassword(password, user.passwordHash)
        : await verifyPassword(password, DUMMY_PASSWORD_HASH);

      if (!user || !verification.valid) {
        return sendJson(res, 401, { error: 'E-mail ou senha inválidos.' });
      }

      // Migração transparente: senha antiga (SHA-256) é regravada como scrypt após login válido.
      if (verification.needsUpgrade) {
        await storage.updateUser(user.id, { passwordHash: await hashPassword(password) });
      }

      const token = await issueSession(user.id);

      return sendJson(res, 200, {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      return sendRouteError(res, error, 'Erro ao autenticar usuário.');
    }
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return sendJson(res, 401, { error: 'Sessão inválida ou expirada.' });
      }

      return sendJson(res, 200, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      return sendRouteError(res, error, 'Erro ao validar sessão.');
    }
  }

  // ROTA: EXPLICAR CONTEÚDO (POST /api/tutor/explain)
  if (req.method === 'POST' && pathname === '/api/tutor/explain') {
    try {
      const payload = await readRequestBody(req);
      const course = cleanText(payload.course, FIELD_LIMITS.course);
      const subject = cleanText(payload.subject, FIELD_LIMITS.subject);
      const topic = cleanText(payload.topic, FIELD_LIMITS.topic);
      const question = cleanText(payload.question, FIELD_LIMITS.question);
      const format = VALID_FORMATS.has(payload.format) ? payload.format : 'text';

      if (!course || !subject || !topic) {
        return sendJson(res, 400, {
          error: 'Campos obrigatórios ausentes. Por favor, forneça curso, disciplina e assunto.'
        });
      }

      // Tenta gerar via IA real se a chave estiver configurada
      if (ai.hasKey) {
        try {
          const systemPrompt = buildExplainSystemPrompt({ course, subject, topic, format });
          const userPrompt = `Curso: ${course}\nDisciplina: ${subject}\nAssunto: ${topic}\nDúvida do estudante: ${question || 'Explicação geral dos fundamentos'}\nFormato escolhido: ${format}`;

          console.log(`🤖 Chamando IA para: ${topic} (${subject})...`);
          const aiResult = await ai.complete(systemPrompt, userPrompt);

          if (aiResult && aiResult.data && aiResult.data.sections) {
            console.log(`✅ Resposta da IA gerada com sucesso via ${aiResult.provider} (${aiResult.model})!`);
            return sendJson(res, 200, {
              meta: {
                isDemo: false,
                provider: aiResult.provider,
                model: aiResult.model,
                notice: `Resposta gerada por Inteligência Artificial em tempo real (${aiResult.provider}).`,
                course,
                subject,
                topic,
                question,
                format,
                generatedAt: new Date().toISOString()
              },
              tutorExplanation: aiResult.data
            });
          }
          ai.noteInvalidResponse('JSON sem o campo "sections"');
        } catch {
          // O motivo já foi registrado no log por ai.complete(); segue para o fallback didático.
        }
      }

      // Fallback didático seguro caso não haja chave ou ocorra falha de rede
      const fallback = getFallbackExplanation(course, subject, topic, question, format);
      return sendJson(res, 200, {
        meta: {
          isDemo: true,
          notice: ai.hasKey
            ? 'Aviso: Houve uma instabilidade momentânea na conexão com a IA. Exibindo conteúdo didático estruturado de contingência.'
            : 'Modo Demonstração (Etapa 2): Configure sua chave GEMINI_API_KEY no arquivo .env para ativar a IA em tempo real.',
          course,
          subject,
          topic,
          question,
          format,
          generatedAt: new Date().toISOString()
        },
        tutorExplanation: fallback
      });
    } catch (err) {
      return sendRouteError(res, err, 'Erro ao processar solicitação');
    }
  }

  // ROTA: GERAR QUESTIONÁRIO COM IA (POST /api/tutor/quiz)
  if (req.method === 'POST' && pathname === '/api/tutor/quiz') {
    try {
      const payload = await readRequestBody(req);
      const course = cleanText(payload.course, FIELD_LIMITS.course) || 'Geral';
      const subject = cleanText(payload.subject, FIELD_LIMITS.subject) || 'Geral';
      const topic = cleanText(payload.topic, FIELD_LIMITS.topic) || 'Tópico de Estudo';
      const explanationContext = cleanText(payload.explanationContext, FIELD_LIMITS.explanationContext);

      if (ai.hasKey) {
        try {
          const systemPrompt = buildQuizSystemPrompt({ course, subject, topic });

          let userPrompt = `Gerar simulado de 3 questões sobre ${topic} (${subject}) para o curso de ${course}.`;
          if (explanationContext) {
            userPrompt += `\n\nTEXTO LIDO PELO ESTUDANTE NA TELA DE LEITURA:\n${explanationContext}\n\nIMPORTANTE: Crie as questões testando a compreensão do texto acima!`;
          }

          console.log(`📝 Gerando questionário contextualizado com IA para: ${topic}...`);
          const aiResult = await ai.complete(systemPrompt, userPrompt);

          if (aiResult && aiResult.data && Array.isArray(aiResult.data.questions) && aiResult.data.questions.length > 0) {
            console.log(`✅ Questionário gerado com IA via ${aiResult.provider} (${aiResult.model})!`);
            return sendJson(res, 200, {
              meta: {
                isDemo: false,
                provider: aiResult.provider,
                model: aiResult.model,
                topic,
                subject,
                course,
                totalQuestions: aiResult.data.questions.length
              },
              questions: aiResult.data.questions
            });
          }
          ai.noteInvalidResponse('JSON sem a lista "questions"');
        } catch {
          // O motivo já foi registrado no log por ai.complete(); segue para o fallback.
        }
      }

      // Fallback de questionário contextualizado
      const fallbackQuestions = getFallbackQuiz(course, subject, topic, explanationContext);
      return sendJson(res, 200, {
        meta: {
          isDemo: true,
          topic,
          subject,
          course,
          totalQuestions: fallbackQuestions.length
        },
        questions: fallbackQuestions
      });
    } catch (err) {
      return sendRouteError(res, err, 'Erro ao gerar questionário');
    }
  }

  // Rotas /api/ inexistentes devolvem JSON 404 (e não a página inicial).
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'Rota não encontrada.' });
  }

  serveStaticFile(req, res, pathname);
}

// ========================================================
// SERVIDOR PRINCIPAL
// ========================================================
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(error => {
    console.error('❌ Erro não tratado na requisição:', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Erro interno do servidor.' });
    } else {
      res.destroy();
    }
  });
});

// Proxies/balanceadores de nuvem costumam manter conexões ociosas por cerca de 60 s;
// o Node precisa mantê-las abertas por mais tempo para evitar erros 502 intermitentes.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

process.on('unhandledRejection', reason => {
  console.error('❌ Promise rejeitada sem tratamento:', reason);
});
process.on('uncaughtException', error => {
  console.error('❌ Exceção não capturada, encerrando:', error);
  process.exit(1);
});

let currentPort = PORT;
let portFallbackAttempts = 0;
const MAX_PORT_FALLBACK_ATTEMPTS = 10;

async function isTutorServerRunning(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return false;

    const status = await response.json();
    // "app" identifica o Tutor IA de forma estável; a mensagem só é usada por compatibilidade
    // (no modo demonstração ela não menciona o nome do app).
    return status.status === 'online'
      && (status.app === 'tutor-ia'
        || (typeof status.message === 'string' && status.message.includes('Tutor IA')));
  } catch {
    return false;
  }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && currentPort !== 0) {
    const occupiedPort = currentPort;
    isTutorServerRunning(occupiedPort).then(isRunning => {
      if (isRunning) {
        const localAddresses = getMobileAccessAddresses();
        console.log(`✅ O Tutor IA já está rodando na porta ${occupiedPort}. Nenhuma instância duplicada foi iniciada.`);
        console.log(`📍 Acesse no computador: http://localhost:${occupiedPort}`);
        if (isLoopbackHost(HOST)) {
          console.warn('⚠️ O servidor está vinculado somente ao computador; defina HOST=0.0.0.0 no .env para permitir acesso pelo celular.');
        } else {
          console.log('📱 No celular conectado à mesma rede Wi-Fi, use o endereço da interface Wi-Fi:');
          localAddresses
            .forEach(({ name, address }) => console.log(`   ${name}: http://${address}:${occupiedPort}`));
        }
        if (OPEN_BROWSER) {
          openBrowser(`http://localhost:${occupiedPort}`);
        }
        process.stdout.write('', () => process.exit(0));
        return;
      }

      if (portFallbackAttempts < MAX_PORT_FALLBACK_ATTEMPTS && currentPort < 65535) {
        currentPort += 1;
        portFallbackAttempts += 1;
        console.warn(`⚠️ A porta ${occupiedPort} está ocupada. Tentando a porta ${currentPort}...`);
        server.listen(currentPort, HOST);
        return;
      }

      console.error(`❌ Não foi possível iniciar: as portas a partir de ${PORT} estão ocupadas.`);
      console.error('➡️ Encerre o processo que ocupa a porta ou configure outra porta no arquivo .env.');
      process.exit(1);
    });
    return;
  }

  console.error('❌ Erro no servidor:', err);
  process.exit(1);
});

// ========================================================
// ENCERRAMENTO GRACIOSO (SIGTERM/SIGINT)
// Plataformas de nuvem enviam SIGTERM a cada novo deploy.
// ========================================================
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 ${signal} recebido: encerrando e aguardando requisições em andamento (até 10 s)...`);

  const forceTimer = setTimeout(() => {
    console.warn('⚠️  Tempo esgotado: forçando o encerramento.');
    server.closeAllConnections?.();
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  // Conexões keep-alive ociosas seriam esperadas indefinidamente; fecha-as aos poucos.
  const idleSweep = setInterval(() => server.closeIdleConnections?.(), 250);
  idleSweep.unref();

  server.close(async () => {
    clearInterval(idleSweep);
    try {
      await storage.close();
    } catch (error) {
      console.error('❌ Erro ao finalizar o armazenamento:', error.message);
    }
    clearTimeout(forceTimer);
    console.log('✅ Servidor encerrado com segurança.');
    process.exit(0);
  });
  server.closeIdleConnections?.();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => shutdown('SIGBREAK'));
}

server.listen(PORT, HOST, () => {
  const activePort = server.address()?.port || currentPort;
  const appUrl = `http://localhost:${activePort}`;
  const localAddresses = getMobileAccessAddresses();
  console.log('='.repeat(65));
  console.log('🎓 TUTOR IA — ASSISTENTE DE ESTUDOS COM INTELIGÊNCIA ARTIFICIAL');
  console.log('='.repeat(65));
  console.log(`✅ Servidor rodando com sucesso!`);
  console.log(`📍 Endereço oficial do projeto: ${appUrl}`);
  if (IS_CLOUD) {
    console.log('☁️  Ambiente de nuvem detectado: o endereço público é o da plataforma (HTTPS).');
  } else if (isLoopbackHost(HOST)) {
    console.warn('⚠️ O servidor está vinculado somente ao computador e não poderá ser acessado pelo celular.');
    console.warn('➡️ Altere HOST para 0.0.0.0 no arquivo .env e reinicie o servidor.');
  } else if (localAddresses.length > 0) {
    console.log('📱 No celular conectado à mesma rede Wi-Fi, use o endereço da interface Wi-Fi:');
    localAddresses.forEach(({ name, address }) => {
      console.log(`   ${name}: http://${address}:${activePort}`);
    });
  } else {
    console.log('⚠️ Nenhum endereço IPv4 de rede local foi encontrado.');
  }
  if (ai.hasKey) {
    console.log(`🤖 Inteligência Artificial: ATIVA (${ai.provider} · modelo ${ai.model} · timeout ${Math.round(ai.timeoutMs / 1000)}s)`);
  } else {
    console.log(`ℹ️  Inteligência Artificial: Modo Demonstração (Adicione sua chave no .env)`);
  }
  console.log(`💾 Storage: ${storage.driver}${storage.dataDir ? ` (${storage.dataDir})` : ''}`);
  console.log(`🔌 Porta: ${activePort} · TRUST_PROXY: ${TRUST_PROXY}${TRUST_PROXY && TRUST_PROXY_HOPS ? ` (hops=${TRUST_PROXY_HOPS})` : ''}`);
  if (IS_CLOUD && storage.driver === 'json' && !process.env.DATA_DIR) {
    console.warn('⚠️  DATA_DIR não definido: em disco efêmero, usuários e sessões serão perdidos a cada deploy. Aponte DATA_DIR para um volume persistente ou use um banco.');
  }
  console.log('='.repeat(65));
  if (!IS_CLOUD) {
    console.log('Dica: use o endereço da interface Wi-Fi e confirme que o Windows permite conexões de entrada para o Node.js.');
  }
  if (activePort !== PORT && !IS_CLOUD) {
    console.warn('⚠️ A porta alternativa pode exigir uma regra de entrada no Firewall do Windows.');
    console.warn('➡️ Em PowerShell como administrador, permita as portas do app apenas na rede local privada:');
    console.warn('   New-NetFirewallRule -DisplayName "Tutor IA (portas 3000-3010)" -Direction Inbound -Protocol TCP -LocalPort 3000-3010 -Action Allow -Profile Private -RemoteAddress LocalSubnet');
  }
  console.log('='.repeat(65));
  if (OPEN_BROWSER) {
    openBrowser(appUrl);
  }
});
