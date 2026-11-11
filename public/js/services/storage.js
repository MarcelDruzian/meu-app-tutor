// ==========================================================
// TUTOR IA - GERENCIADOR DE ARMAZENAMENTO LOCAL (STORAGE)
// ==========================================================

const KEYS = {
  HISTORY: 'tutor_ia_history',
  QUIZZES: 'tutor_ia_quizzes',
  GOALS: 'tutor_ia_goals',
  ACCOUNT: 'tutor_ia_account',
  AUTH_TOKEN: 'tutor_ia_auth_token'
};

const DEFAULT_GUEST_ACCOUNT = { isGuest: true, name: 'Estudante Visitante', email: '' };
let lastStorageError = null;

function isStorageAvailable() {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    const probeKey = '__tutor_ia_probe__';
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    return true;
  } catch (e) {
    lastStorageError = e;
    return false;
  }
}

/**
 * Converte uma data para chave local YYYY-MM-DD (fuso do navegador).
 */
export function toLocalDateKey(input = new Date()) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftLocalDateKey(date, deltaDays) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate() + deltaDays);
  return toLocalDateKey(copy);
}

/**
 * Calcula dias consecutivos a partir das datas locais com atividade elegível.
 * Retorna 0 quando não há atividade ou quando a sequência foi quebrada.
 */
export function computeStreak(activityInputs = [], referenceDate = new Date()) {
  const dates = new Set();
  for (const item of activityInputs) {
    const raw = typeof item === 'string' ? item : (item?.date || item?.createdAt || item?.lastUpdated);
    const key = toLocalDateKey(raw);
    if (key) dates.add(key);
  }
  if (dates.size === 0) return 0;

  const todayKey = toLocalDateKey(referenceDate);
  const yesterdayKey = shiftLocalDateKey(referenceDate, -1);

  let offsetDays = null;
  if (dates.has(todayKey)) {
    offsetDays = 0;
  } else if (dates.has(yesterdayKey)) {
    offsetDays = -1;
  } else {
    return 0;
  }

  let streak = 0;
  while (dates.has(shiftLocalDateKey(referenceDate, offsetDays))) {
    streak += 1;
    offsetDays -= 1;
  }
  return streak;
}

/**
 * Calcula estatísticas de simulados sem inflar denominador.
 * Retorna "Sem dados" quando não houver respostas válidas.
 */
export function computeQuizStats(quizzes = []) {
  if (!Array.isArray(quizzes) || quizzes.length === 0) {
    return {
      totalQuizzes: 0,
      totalAnswers: 0,
      totalCorrect: 0,
      accuracyPct: null,
      accuracyLabel: 'Sem dados'
    };
  }

  let totalAnswers = 0;
  let totalCorrect = 0;

  for (const q of quizzes) {
    const total = Number(q?.total ?? q?.questionsAnswered ?? 0);
    const score = Number(q?.score ?? q?.correctAnswers ?? 0);
    if (Number.isFinite(total) && total > 0 && Number.isFinite(score) && score >= 0) {
      totalAnswers += total;
      totalCorrect += Math.min(total, score);
    }
  }

  if (totalAnswers <= 0) {
    return {
      totalQuizzes: quizzes.length,
      totalAnswers: 0,
      totalCorrect: 0,
      accuracyPct: null,
      accuracyLabel: 'Sem dados'
    };
  }

  const accuracyPct = Math.round((totalCorrect / totalAnswers) * 100);
  return {
    totalQuizzes: quizzes.length,
    totalAnswers,
    totalCorrect,
    accuracyPct,
    accuracyLabel: `${accuracyPct}%`
  };
}

function safeReadJson(key, fallback) {
  if (!isStorageAvailable()) {
    return { ok: false, value: fallback, error: 'Armazenamento local indisponível neste navegador.' };
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ok: true, value: fallback, error: null };
    const parsed = JSON.parse(raw);
    return { ok: true, value: parsed, error: null };
  } catch (e) {
    lastStorageError = e;
    return { ok: false, value: fallback, error: 'Não foi possível ler os dados salvos neste navegador.' };
  }
}

function safeWriteJson(key, value) {
  if (!isStorageAvailable()) {
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    lastStorageError = null;
    return true;
  } catch (e) {
    lastStorageError = e;
    console.warn('Erro ao salvar no LocalStorage:', e);
    return false;
  }
}

function buildNormalizedGoals(rawGoals, todayKey) {
  const base = rawGoals && typeof rawGoals === 'object' ? rawGoals : {};
  const dailyTarget = Number.isInteger(base.dailyTarget) && base.dailyTarget > 0 ? base.dailyTarget : 3;
  const lastDate = typeof base.lastDate === 'string' ? base.lastDate : todayKey;
  const completedToday = lastDate === todayKey && Number.isFinite(Number(base.completedToday)) && Number(base.completedToday) >= 0
    ? Number(base.completedToday)
    : 0;
  const countedEventIds = Array.isArray(base.countedEventIds)
    ? base.countedEventIds.filter(id => typeof id === 'string')
    : [];
  const activityDates = Array.isArray(base.activityDates)
    ? base.activityDates.filter(d => typeof d === 'string')
    : [];

  return {
    dailyTarget,
    completedToday,
    lastDate: todayKey,
    countedEventIds,
    activityDates,
    streak: 0
  };
}

export const StorageService = {
  isAvailable() {
    return isStorageAvailable();
  },

  getLastError() {
    return lastStorageError;
  },

  readLocalProgressSnapshot() {
    const historyRead = safeReadJson(KEYS.HISTORY, []);
    const quizzesRead = safeReadJson(KEYS.QUIZZES, []);
    const goalsRead = safeReadJson(KEYS.GOALS, null);

    const history = Array.isArray(historyRead.value) ? historyRead.value : [];
    const quizzes = Array.isArray(quizzesRead.value) ? quizzesRead.value : [];
    const todayKey = toLocalDateKey(new Date());
    const goals = buildNormalizedGoals(goalsRead.value, todayKey);

    const eligibleDates = [
      ...history.map(h => h?.date || h?.createdAt),
      ...quizzes.map(q => q?.date || q?.createdAt),
      ...goals.activityDates
    ].filter(Boolean);

    goals.streak = computeStreak(eligibleDates);

    return {
      storageAvailable: isStorageAvailable(),
      readError: (!historyRead.ok || !quizzesRead.ok || !goalsRead.ok)
        ? (historyRead.error || quizzesRead.error || goalsRead.error)
        : null,
      history,
      quizzes,
      goals
    };
  },

  saveStudySession(sessionData) {
    if (!isStorageAvailable()) return null;
    const historyRead = safeReadJson(KEYS.HISTORY, []);
    if (!historyRead.ok) return null;

    const history = Array.isArray(historyRead.value) ? historyRead.value : [];
    const eventId = sessionData.eventId || `study_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    // Idempotência: o mesmo evento concluído não é gravado nem contado duas vezes.
    if (history.some(item => item?.eventId && item.eventId === eventId)) {
      return history.find(item => item.eventId === eventId);
    }

    const nowIso = new Date().toISOString();
    const newItem = {
      id: eventId,
      eventId,
      date: nowIso,
      course: sessionData.course,
      subject: sessionData.subject,
      topic: sessionData.topic,
      question: sessionData.question || '',
      format: sessionData.format || 'text',
      level: sessionData.level || 'intermediario',
      summary: sessionData.summary || ''
    };

    const nextHistory = [newItem, ...history].slice(0, 50);
    if (!safeWriteJson(KEYS.HISTORY, nextHistory)) {
      return null;
    }

    this.recordGoalCompletion(eventId, nowIso);
    return newItem;
  },

  async saveStudySessionRemote(sessionData) {
    const token = this.getSessionToken();
    if (!token) return null;
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          type: 'explanation',
          course: sessionData.course,
          subject: sessionData.subject,
          topic: sessionData.topic,
          question: sessionData.question || '',
          summary: sessionData.summary || ''
        })
      });
      if (!response.ok) return null;
      const result = await response.json().catch(() => ({}));
      return result.history || null;
    } catch (error) {
      console.warn('Erro ao sincronizar histórico remoto:', error);
      return null;
    }
  },

  async saveQuizResultRemote(resultData) {
    const token = this.getSessionToken();
    if (!token) return null;
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          type: 'quiz',
          course: resultData.course,
          subject: resultData.subject,
          topic: resultData.topic,
          summary: `Simulado concluído: ${resultData.score} de ${resultData.total} acertos`
        })
      });
      if (!response.ok) return null;
      const result = await response.json().catch(() => ({}));
      return result.history || null;
    } catch (error) {
      console.warn('Erro ao sincronizar quiz remoto:', error);
      return null;
    }
  },

  getHistory() {
    const res = safeReadJson(KEYS.HISTORY, []);
    return Array.isArray(res.value) ? res.value : [];
  },

  clearHistory() {
    if (!isStorageAvailable()) return false;
    try {
      localStorage.removeItem(KEYS.HISTORY);
      localStorage.removeItem(KEYS.QUIZZES);
      localStorage.removeItem(KEYS.GOALS);
      lastStorageError = null;
      return true;
    } catch (e) {
      lastStorageError = e;
      return false;
    }
  },

  saveQuizResult(resultData) {
    if (!isStorageAvailable()) return null;
    const quizzesRead = safeReadJson(KEYS.QUIZZES, []);
    if (!quizzesRead.ok) return null;

    const quizzes = Array.isArray(quizzesRead.value) ? quizzesRead.value : [];
    const eventId = resultData.eventId || `quiz_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    if (quizzes.some(item => item?.eventId && item.eventId === eventId)) {
      return quizzes.find(item => item.eventId === eventId);
    }

    const total = Number(resultData.total || 0);
    const score = Number(resultData.score || 0);
    const nowIso = new Date().toISOString();
    const newQuiz = {
      id: eventId,
      eventId,
      date: nowIso,
      topic: resultData.topic,
      subject: resultData.subject,
      score,
      total,
      percentage: total > 0 ? Math.round((score / total) * 100) : 0
    };

    const nextQuizzes = [newQuiz, ...quizzes].slice(0, 50);
    if (!safeWriteJson(KEYS.QUIZZES, nextQuizzes)) {
      return null;
    }

    this.recordGoalCompletion(eventId, nowIso);
    return newQuiz;
  },

  async saveProgressRemote(progressData) {
    const token = this.getSessionToken();
    if (!token) return null;
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          course: progressData.course,
          subject: progressData.subject,
          topic: progressData.topic,
          explanationsSeen: Number(progressData.explanationsSeen || 0),
          quizzesAnswered: Number(progressData.quizzesAnswered || 0),
          questionsAnswered: Number(progressData.questionsAnswered || 0),
          correctAnswers: Number(progressData.correctAnswers || 0)
        })
      });
      if (!response.ok) return null;
      const result = await response.json().catch(() => ({}));
      return result.progress || null;
    } catch (error) {
      console.warn('Erro ao sincronizar progresso remoto:', error);
      return null;
    }
  },

  getQuizzes() {
    const res = safeReadJson(KEYS.QUIZZES, []);
    return Array.isArray(res.value) ? res.value : [];
  },

  getGoals() {
    return this.readLocalProgressSnapshot().goals;
  },

  /**
   * Registra conclusão de evento na meta diária de forma idempotente.
   */
  recordGoalCompletion(eventId, dateInput = new Date()) {
    if (!isStorageAvailable()) return null;
    const goalsRead = safeReadJson(KEYS.GOALS, null);
    if (!goalsRead.ok && goalsRead.value === null && lastStorageError) {
      // Se havia JSON corrompido, não inventa sucesso silencioso em cima de leitura quebrada
      return null;
    }

    const todayKey = toLocalDateKey(dateInput);
    const goals = buildNormalizedGoals(goalsRead.value, toLocalDateKey(new Date()));

    if (eventId && goals.countedEventIds.includes(eventId)) {
      return goals;
    }

    if (eventId) {
      goals.countedEventIds = [eventId, ...goals.countedEventIds].slice(0, 200);
    }
    if (todayKey && !goals.activityDates.includes(todayKey)) {
      goals.activityDates = [todayKey, ...goals.activityDates].slice(0, 120);
    }
    if (todayKey === toLocalDateKey(new Date())) {
      goals.completedToday += 1;
    }

    const snapshot = this.readLocalProgressSnapshot();
    const allDates = [
      ...snapshot.history.map(h => h?.date || h?.createdAt),
      ...snapshot.quizzes.map(q => q?.date || q?.createdAt),
      ...goals.activityDates
    ].filter(Boolean);
    goals.streak = computeStreak(allDates);

    if (!safeWriteJson(KEYS.GOALS, goals)) {
      return null;
    }
    return goals;
  },

  incrementDailyGoal(eventId) {
    return this.recordGoalCompletion(eventId || `goal_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`);
  },

  getAccount() {
    const res = safeReadJson(KEYS.ACCOUNT, DEFAULT_GUEST_ACCOUNT);
    return res.value && typeof res.value === 'object' ? res.value : { ...DEFAULT_GUEST_ACCOUNT };
  },

  isAuthenticated() {
    const account = this.getAccount();
    const token = this.getSessionToken();
    return Boolean(token) && !account.isGuest;
  },

  saveAccount(userData) {
    return safeWriteJson(KEYS.ACCOUNT, userData) ? userData : null;
  },

  saveSessionToken(token) {
    if (!isStorageAvailable() || !token) return null;
    try {
      localStorage.setItem(KEYS.AUTH_TOKEN, token);
      return token;
    } catch (e) {
      lastStorageError = e;
      return null;
    }
  },

  getSessionToken() {
    if (!isStorageAvailable()) return '';
    try {
      return localStorage.getItem(KEYS.AUTH_TOKEN) || '';
    } catch (e) {
      lastStorageError = e;
      return '';
    }
  },

  clearSessionToken() {
    if (!isStorageAvailable()) return false;
    try {
      localStorage.removeItem(KEYS.AUTH_TOKEN);
      return true;
    } catch (e) {
      lastStorageError = e;
      return false;
    }
  }
};
