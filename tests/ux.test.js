// Testes de aceite e unidade para F01, F02, F03, F04 e F06 (sem dependências externas).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeStreak, computeQuizStats, toLocalDateKey, StorageService } from '../public/js/services/storage.js';
import { formatRetryAfter } from '../public/js/services/tutor.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cleanups = [];
after(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-ia-ux-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function startServer({ env = {}, dataDir = tempDir() } = {}) {
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      TUTOR_ENV_FILE: path.join(dataDir, 'nao-existe.env'),
      PORT: '0',
      HOST: '127.0.0.1',
      OPEN_BROWSER: 'false',
      DATA_DIR: dataDir,
      STORAGE_DRIVER: 'json',
      AI_RETRY_ATTEMPTS: '1',
      AI_BACKOFF_MS: '10',
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const port = await new Promise((resolve, reject) => {
    let out = '';
    const onData = chunk => {
      out += chunk.toString();
      const match = out.match(/http:\/\/localhost:(\d+)/);
      if (match) resolve(Number(match[1]));
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.once('exit', code => reject(new Error(`Servidor encerrou (${code}):\n${out}`)));
  });

  const base = `http://127.0.0.1:${port}`;
  cleanups.push(async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill();
      await new Promise(resolve => proc.once('exit', resolve));
    }
  });

  return {
    base,
    async json(method, route, body, headers = {}) {
      const r = await fetch(`${base}${route}`, {
        method,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      return { status: r.status, headers: r.headers, data: await r.json().catch(() => null) };
    }
  };
}

function createMemoryLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key),
    _raw: store
  };
}

// ----------------------------------------------------------------------------
describe('F01 e F03: acesso livre de visitante, 429, suporte e páginas legais', () => {
  test('T01: visitante completa explicação e quiz sem autenticação e recebe limite/suporte em /api/status', async () => {
    const s = await startServer({ env: { SUPPORT_EMAIL: 'ajuda@escola.test', TUTOR_RATE_LIMIT_MAX_REQUESTS: '2' } });

    const status = await s.json('GET', '/api/status');
    assert.equal(status.status, 200);
    assert.equal(status.data.passwordRecovery, 'unavailable');
    assert.equal(status.data.supportEmail, 'ajuda@escola.test');
    assert.equal(status.data.tutorRateLimit.maxRequests, 2);

    const explain = await s.json('POST', '/api/tutor/explain', {
      course: 'Ensino Médio',
      subject: 'Biologia',
      topic: 'Fotossíntese',
      format: 'text'
    });
    assert.equal(explain.status, 200);
    assert.ok(explain.data.tutorExplanation?.sections?.length > 0);

    const quiz = await s.json('POST', '/api/tutor/quiz', {
      course: 'Ensino Médio',
      subject: 'Biologia',
      topic: 'Fotossíntese',
      useAi: false
    });
    assert.equal(quiz.status, 200);
    assert.ok(quiz.data.questions.length > 0);

    // 3ª chamada dentro da janela deve devolver 429 com Retry-After
    const limited = await s.json('POST', '/api/tutor/explain', {
      course: 'Ensino Médio',
      subject: 'Biologia',
      topic: 'Fotossíntese'
    });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  });

  test('F03: sem SUPPORT_EMAIL válido, /api/status retorna supportEmail null', async () => {
    const s = await startServer({ env: { SUPPORT_EMAIL: 'invalido' } });
    const status = await s.json('GET', '/api/status');
    assert.equal(status.status, 200);
    assert.equal(status.data.supportEmail, null);
  });

  test('F06: privacidade.html e termos.html são servidos com aviso de rascunho', async () => {
    const s = await startServer();
    for (const route of ['/privacidade.html', '/termos.html']) {
      const r = await fetch(`${s.base}${route}`);
      assert.equal(r.status, 200);
      const html = await r.text();
      assert.match(html, /Rascunho para revisão do responsável/i);
    }
  });

  test('F02 servidor: gerar quiz autenticado não infla quizzesAnswered antes de encerrar', async () => {
    const s = await startServer();
    const reg = await s.json('POST', '/api/auth/register', { name: 'Leo', email: 'leo@ex.com', password: 'senha-forte-1' });
    const token = reg.data.token;

    const quiz = await s.json('POST', '/api/tutor/quiz', {
      course: 'Física',
      subject: 'Mecânica',
      topic: 'Leis de Newton',
      useAi: false
    }, { Authorization: `Bearer ${token}` });
    assert.equal(quiz.status, 200);

    const progress = await s.json('GET', '/api/progress', undefined, { Authorization: `Bearer ${token}` });
    assert.equal(progress.status, 200);
    assert.equal(progress.data.progress.length, 0);
  });
});

// ----------------------------------------------------------------------------
describe('F02 / T04: indicadores honestos, datas locais, idempotência e falha de storage', () => {
  test('computeStreak retorna 0 sem atividade e conta dias locais consecutivos corretamente', () => {
    const ref = new Date(2026, 10, 10, 21, 30, 0); // 10/11/2026 local
    assert.equal(computeStreak([], ref), 0);

    // Somente hoje -> 1
    assert.equal(computeStreak(['2026-11-10'], ref), 1);

    // Hoje, ontem e anteontem -> 3
    assert.equal(computeStreak(['2026-11-08', '2026-11-09', '2026-11-10'], ref), 3);

    // Lacuna ontem (só anteontem e hoje) -> 1
    assert.equal(computeStreak(['2026-11-08', '2026-11-10'], ref), 1);

    // Nenhuma atividade hoje nem ontem (só 2 dias atrás) -> 0
    assert.equal(computeStreak(['2026-11-08'], ref), 0);

    // Atividade ontem (ainda não estudou hoje) -> 1
    assert.equal(computeStreak(['2026-11-09', '2026-11-08'], ref), 2);
  });

  test('computeQuizStats retorna "Sem dados" sem respostas válidas e calcula acertos ÷ respostas válidas', () => {
    assert.equal(computeQuizStats([]).accuracyLabel, 'Sem dados');
    assert.equal(computeQuizStats([{ score: 0, total: 0 }]).accuracyLabel, 'Sem dados');

    const stats = computeQuizStats([
      { score: 2, total: 3 },
      { score: 1, total: 3 }
    ]);
    assert.equal(stats.totalAnswers, 6);
    assert.equal(stats.totalCorrect, 3);
    assert.equal(stats.accuracyLabel, '50%');
  });

  test('StorageService: zero atividade com streak=1 legado retorna 0; idempotência evita contagem dupla', () => {
    const prevWindow = globalThis.window;
    const prevStorage = globalThis.localStorage;
    try {
      const todayKey = toLocalDateKey(new Date());
      globalThis.window = {};
      globalThis.localStorage = createMemoryLocalStorage({
        // Registro antigo com streak=1 mas sem nenhuma atividade real
        tutor_ia_goals: JSON.stringify({ dailyTarget: 3, completedToday: 0, lastDate: todayKey, streak: 1 })
      });

      const emptySnap = StorageService.readLocalProgressSnapshot();
      assert.equal(emptySnap.goals.streak, 0);
      assert.equal(emptySnap.history.length, 0);
      assert.equal(emptySnap.quizzes.length, 0);

      // Salva estudo com eventId repetido -> conta apenas 1 vez na meta diária e histórico
      const first = StorageService.saveStudySession({ eventId: 'ev_1', course: 'Médio', subject: 'Física', topic: 'Optica' });
      const dup = StorageService.saveStudySession({ eventId: 'ev_1', course: 'Médio', subject: 'Física', topic: 'Optica' });
      assert.ok(first && dup);
      assert.equal(StorageService.getHistory().length, 1);
      assert.equal(StorageService.getGoals().completedToday, 1);
      assert.equal(StorageService.getGoals().streak, 1);

      // Salva quiz com eventId repetido -> conta apenas 1 vez
      StorageService.saveQuizResult({ eventId: 'q_1', subject: 'Física', topic: 'Optica', score: 2, total: 3 });
      StorageService.saveQuizResult({ eventId: 'q_1', subject: 'Física', topic: 'Optica', score: 2, total: 3 });
      assert.equal(StorageService.getQuizzes().length, 1);
      assert.equal(StorageService.getGoals().completedToday, 2);
    } finally {
      globalThis.window = prevWindow;
      globalThis.localStorage = prevStorage;
    }
  });

  test('StorageService trata localStorage indisponível ou corrompido sem falso sucesso', () => {
    const prevWindow = globalThis.window;
    const prevStorage = globalThis.localStorage;
    try {
      globalThis.window = {};
      globalThis.localStorage = {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); },
        removeItem() { throw new Error('blocked'); }
      };
      assert.equal(StorageService.isAvailable(), false);
      assert.equal(StorageService.saveStudySession({ course: 'A', subject: 'B', topic: 'C' }), null);
      assert.equal(StorageService.saveQuizResult({ subject: 'B', topic: 'C', score: 1, total: 3 }), null);
      const snap = StorageService.readLocalProgressSnapshot();
      assert.equal(snap.storageAvailable, false);
      assert.ok(snap.readError);

      // JSON corrompido
      globalThis.localStorage = createMemoryLocalStorage({ tutor_ia_history: '{corrompido' });
      const badJsonSnap = StorageService.readLocalProgressSnapshot();
      assert.ok(badJsonSnap.readError);
      assert.equal(StorageService.saveStudySession({ course: 'A', subject: 'B', topic: 'C' }), null);
    } finally {
      globalThis.window = prevWindow;
      globalThis.localStorage = prevStorage;
    }
  });

  test('formatRetryAfter formata segundos e minutos de forma legível', () => {
    assert.equal(formatRetryAfter(12), '12 segundos');
    assert.equal(formatRetryAfter(120), '2 minutos');
  });
});

// ----------------------------------------------------------------------------
describe('T01, T05, F04 e F06: verificação estática da interface', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'style.css'), 'utf8');

  test('T01/F01: nenhum bloqueio de login ao pesquisar ou abrir Exercícios e sem promessa falsa de sync', () => {
    assert.doesNotMatch(appJs, /ensureAuthenticatedAccess/);
    assert.doesNotMatch(html, /Crie uma conta gratuita para pesquisar/i);
    assert.match(html, /guestRateNotice/);
    assert.match(html, /somente neste navegador/i);
  });

  test('T05/F04: todas as sugestões são <button type="button"> nativos com aria-pressed e foco visível no CSS', () => {
    assert.doesNotMatch(html, /<span[^>]*class="[^"]*quick-pill/);
    const pillButtons = [...html.matchAll(/<button\b([^>]*)class="[^"]*quick-pill[^"]*"([^>]*)>([\s\S]*?)<\/button>/g)];
    assert.equal(pillButtons.length, 27);
    for (const [, before, after, label] of pillButtons) {
      const attrs = `${before} ${after}`;
      assert.match(attrs, /type="button"/);
      assert.match(attrs, /aria-pressed="false"/);
      assert.doesNotMatch(label, /[\u{1F300}-\u{1FAFF}]/u, `pílula "${label}" não deve ter emoji decorativo no nome acessível`);
    }
    assert.match(css, /button:focus-visible/);
    assert.match(css, /\.format-card:has\(input:focus-visible\)/);
  });

  test('F06: sem referências a "Etapa 3", "Etapa 2" ou "Supabase" no frontend e com links legais no rodapé/Conta', () => {
    assert.doesNotMatch(html, /Etapa 2|Etapa 3|Supabase/i);
    assert.doesNotMatch(appJs, /Etapa 2|Etapa 3|Supabase/i);
    assert.match(html, /href="\/privacidade\.html"/);
    assert.match(html, /href="\/termos\.html"/);
    assert.match(html, /howCalculatedBox/);
  });

  test('F05 e simulado com IA: seletor de nível acessível e requestQuiz com IA habilitada por padrão', () => {
    const levelButtons = [...html.matchAll(/<button\b([^>]*)class="[^"]*level-pill[^"]*"([^>]*)>([\s\S]*?)<\/button>/g)];
    assert.equal(levelButtons.length, 3);
    for (const [, before, after] of levelButtons) {
      const attrs = `${before} ${after}`;
      assert.match(attrs, /type="button"/);
      assert.match(attrs, /aria-pressed="(true|false)"/);
    }
    const tutorJs = fs.readFileSync(path.join(ROOT, 'public', 'js', 'services', 'tutor.js'), 'utf8');
    assert.match(tutorJs, /useAi = true/);
    assert.match(appJs, /useAi:\s*true/);
  });

  test('Conta mobile: avatares e ícone de navegação não distorcem em flex containers estreitos', () => {
    for (const selector of ['\\.profile-avatar', '\\.header-account-avatar', '\\.account-avatar', '\\.nav-tab-btn svg']) {
      const rule = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
      assert.ok(rule, `regra CSS encontrada para ${selector}`);
      assert.match(rule[1], /flex-shrink:\s*0\s*;/, `${selector} deve impedir encolhimento horizontal`);
    }
    const profileAvatar = css.match(/\.profile-avatar\s*\{([^}]*)\}/);
    assert.match(profileAvatar[1], /aspect-ratio:\s*1\s*\/\s*1\s*;/);
    const profileInfo = css.match(/\.profile-info\s*\{([^}]*)\}/);
    assert.ok(profileInfo);
    assert.match(profileInfo[1], /min-width:\s*0\s*;/);
    assert.match(html, /id="guestAccountAvatar"[^>]*>\s*<svg\b/);
    assert.match(css, /#guestAccountAvatar\s+svg\s*\{[^}]*flex-shrink:\s*0\s*;/);
  });
});

// ----------------------------------------------------------------------------
describe('F05 e IA nos simulados: personalização por nível no backend e fallback', () => {
  test('POST /api/tutor/explain e /api/tutor/quiz aceitam level e fazem fallback seguro para valor inválido', async () => {
    const s = await startServer();

    const expInit = await s.json('POST', '/api/tutor/explain', {
      course: 'Ensino Médio',
      subject: 'Biologia',
      topic: 'Fotossíntese',
      level: 'iniciante'
    });
    assert.equal(expInit.status, 200);
    assert.equal(expInit.data.meta.level, 'iniciante');
    assert.match(expInit.data.tutorExplanation.levelTag, /Iniciante/);

    const expBad = await s.json('POST', '/api/tutor/explain', {
      course: 'Ensino Médio',
      subject: 'Biologia',
      topic: 'Fotossíntese',
      level: 'desconhecido'
    });
    assert.equal(expBad.status, 200);
    assert.equal(expBad.data.meta.level, 'intermediario');

    const quizRev = await s.json('POST', '/api/tutor/quiz', {
      course: 'Ensino Médio',
      subject: 'Biologia',
      topic: 'Fotossíntese',
      level: 'revisao'
    });
    assert.equal(quizRev.status, 200);
    assert.equal(quizRev.data.meta.level, 'revisao');
    assert.ok(quizRev.data.questions.length > 0);
  });

  test('com chave de IA simulada, /api/tutor/explain e /api/tutor/quiz usam o nível no prompt e geram quiz via IA por padrão', async () => {
    const http = await import('node:http');
    const capturedPrompts = [];
    const mockServer = http.createServer((req, res) => {
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : {};
        const fullText = body.contents?.[0]?.parts?.[0]?.text || '';
        capturedPrompts.push(fullText);

        const isQuiz = fullText.includes('examinador pedagógico');
        const payload = isQuiz
          ? {
              questions: [{
                id: 1,
                statement: 'Questão de revisão gerada pela IA?',
                options: [
                  { id: 'A', text: 'Correta', isCorrect: true, feedback: 'Ok' },
                  { id: 'B', text: 'Errada 1', isCorrect: false, feedback: 'Não' },
                  { id: 'C', text: 'Errada 2', isCorrect: false, feedback: 'Não' },
                  { id: 'D', text: 'Errada 3', isCorrect: false, feedback: 'Não' }
                ]
              }]
            }
          : {
              title: 'Explicação',
              subtitle: 'Sub',
              levelTag: 'Revisão',
              summary: 'Resumo',
              sections: [{ type: 'concept', title: 'Conceito', content: 'Texto' }],
              followUpQuestions: ['P1?'],
              audioScript: 'Audio',
              videoRecommendations: []
            };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }));
      });
    });
    await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
    cleanups.push(async () => { mockServer.closeAllConnections?.(); mockServer.close(); });
    const mockBase = `http://127.0.0.1:${mockServer.address().port}`;

    const s = await startServer({ env: { GEMINI_API_KEY: 'chave-teste', GEMINI_API_BASE: mockBase } });
    const exp = await s.json('POST', '/api/tutor/explain', {
      course: 'Engenharia',
      subject: 'Física',
      topic: 'Termodinâmica',
      level: 'revisao'
    });
    assert.equal(exp.status, 200);
    assert.equal(exp.data.meta.isDemo, false);
    assert.equal(exp.data.meta.level, 'revisao');

    const quiz = await s.json('POST', '/api/tutor/quiz', {
      course: 'Engenharia',
      subject: 'Física',
      topic: 'Termodinâmica',
      level: 'iniciante'
    });
    assert.equal(quiz.status, 200);
    assert.equal(quiz.data.meta.isDemo, false);
    assert.equal(quiz.data.meta.level, 'iniciante');
    assert.equal(quiz.data.questions[0].statement, 'Questão de revisão gerada pela IA?');

    assert.equal(capturedPrompts.length, 2);
    assert.match(capturedPrompts[0], /Revisão para prova/);
    assert.match(capturedPrompts[1], /Iniciante/);
  });
});
