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

const isStorageAvailable = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export const StorageService = {
  saveStudySession(sessionData) {
    if (!isStorageAvailable()) return null;
    try {
      const history = this.getHistory();
      const newItem = {
        id: 'study_' + Date.now(),
        date: new Date().toISOString(),
        course: sessionData.course,
        subject: sessionData.subject,
        topic: sessionData.topic,
        question: sessionData.question || '',
        format: sessionData.format || 'text',
        summary: sessionData.summary || ''
      };

      history.unshift(newItem);
      if (history.length > 50) history.pop();

      localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
      this.incrementDailyGoal();
      return newItem;
    } catch (e) {
      console.warn('Erro ao salvar no LocalStorage:', e);
      return null;
    }
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
      console.warn('Erro ao sincronizar hist?rico remoto:', error);
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
          summary: 'Quiz conclu?do: ' + resultData.score + ' de ' + resultData.total + ' acertos'
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
    if (!isStorageAvailable()) return [];
    try {
      const raw = localStorage.getItem(KEYS.HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  clearHistory() {
    if (!isStorageAvailable()) return true;
    try {
      localStorage.removeItem(KEYS.HISTORY);
      return true;
    } catch (e) {
      return false;
    }
  },

  saveQuizResult(resultData) {
    if (!isStorageAvailable()) return null;
    try {
      const quizzes = this.getQuizzes();
      const newQuiz = {
        id: 'quiz_' + Date.now(),
        date: new Date().toISOString(),
        topic: resultData.topic,
        subject: resultData.subject,
        score: resultData.score,
        total: resultData.total,
        percentage: Math.round((resultData.score / resultData.total) * 100)
      };

      quizzes.unshift(newQuiz);
      if (quizzes.length > 50) quizzes.pop();

      localStorage.setItem(KEYS.QUIZZES, JSON.stringify(quizzes));
      return newQuiz;
    } catch (e) {
      console.warn('Erro ao salvar question?rio:', e);
      return null;
    }
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
    if (!isStorageAvailable()) return [];
    try {
      const raw = localStorage.getItem(KEYS.QUIZZES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  getGoals() {
    if (!isStorageAvailable()) return { dailyTarget: 3, completedToday: 0, lastDate: '', streak: 1 };
    try {
      const raw = localStorage.getItem(KEYS.GOALS);
      const today = new Date().toISOString().slice(0, 10);
      let goals = raw ? JSON.parse(raw) : { dailyTarget: 3, completedToday: 0, lastDate: today, streak: 1 };

      if (goals.lastDate !== today) {
        goals.completedToday = 0;
        goals.lastDate = today;
      }
      return goals;
    } catch (e) {
      return { dailyTarget: 3, completedToday: 0, lastDate: '', streak: 1 };
    }
  },

  incrementDailyGoal() {
    if (!isStorageAvailable()) return null;
    try {
      const goals = this.getGoals();
      goals.completedToday += 1;
      localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
      return goals;
    } catch (e) {
      return null;
    }
  },

  getAccount() {
    if (!isStorageAvailable()) return { isGuest: true, name: 'Estudante Visitante', email: '' };
    try {
      const raw = localStorage.getItem(KEYS.ACCOUNT);
      return raw ? JSON.parse(raw) : { isGuest: true, name: 'Estudante Visitante', email: '' };
    } catch (e) {
      return { isGuest: true, name: 'Estudante Visitante', email: '' };
    }
  },

  isAuthenticated() {
    const account = this.getAccount();
    const token = this.getSessionToken();
    return Boolean(token) && !account.isGuest;
  },

  saveAccount(userData) {
    if (!isStorageAvailable()) return null;
    try {
      localStorage.setItem(KEYS.ACCOUNT, JSON.stringify(userData));
      return userData;
    } catch (e) {
      return null;
    }
  },

  saveSessionToken(token) {
    if (!isStorageAvailable() || !token) return null;
    try {
      localStorage.setItem(KEYS.AUTH_TOKEN, token);
      return token;
    } catch (e) {
      return null;
    }
  },

  getSessionToken() {
    if (!isStorageAvailable()) return '';
    try {
      return localStorage.getItem(KEYS.AUTH_TOKEN) || '';
    } catch (e) {
      return '';
    }
  },

  clearSessionToken() {
    if (!isStorageAvailable()) return true;
    try {
      localStorage.removeItem(KEYS.AUTH_TOKEN);
      return true;
    } catch (e) {
      return false;
    }
  }
};
