// ==========================================================
// TUTOR IA - CLIENTE DO SERVIÇO DO TUTOR (API & FALLBACK)
// ==========================================================

import { generateSmartDemoExplanation, generateDemoQuiz } from '../data/demoData.js';
import { StorageService } from './storage.js';

function getTutorRequestHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = StorageService.getSessionToken();
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  return headers;
}

export function formatRetryAfter(seconds) {
  const total = Math.max(1, Math.ceil(Number(seconds) || 60));
  if (total < 60) {
    return `${total} segundo${total === 1 ? '' : 's'}`;
  }
  const minutes = Math.ceil(total / 60);
  return `${minutes} minuto${minutes === 1 ? '' : 's'}`;
}

async function postTutorJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: getTutorRequestHeaders(),
    body: JSON.stringify(payload)
  });

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    const retryHeader = Number(response.headers.get('Retry-After'));
    const retryAfterSeconds = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : 60;
    const error = new Error(body.error || 'Limite de pesquisas atingido.');
    error.status = 429;
    error.retryAfterSeconds = retryAfterSeconds;
    throw error;
  }

  return response;
}

export const TutorService = {
  async getApiStatus() {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Backend offline ou inacessível no momento.');
    }
    return {
      status: 'offline',
      mode: 'demo_mode',
      hasApiKey: false,
      provider: 'Modo Local',
      tutorRateLimit: { maxRequests: 30, windowMinutes: 60 },
      passwordRecovery: 'unavailable',
      supportEmail: null
    };
  },

  async requestExplanation(params) {
    const { course, subject, topic, question, format, level = 'intermediario' } = params;

    try {
      const response = await postTutorJson('/api/tutor/explain', { course, subject, topic, question, format, level });

      if (response.ok) {
        const data = await response.json();
        return {
          isDemo: data.meta?.isDemo ?? true,
          meta: data.meta || {},
          explanation: data.tutorExplanation
        };
      }
    } catch (err) {
      if (err?.status === 429) throw err;
      console.warn('Backend indisponível ou aberto via arquivo local. Usando gerador didático integrado.', err);
    }

    const localExplanation = generateSmartDemoExplanation(course, subject, topic, question, format, level);
    return {
      isDemo: true,
      meta: {
        isDemo: true,
        level,
        notice: 'Modo offline/demonstração: exibindo conteúdo didático estruturado localmente.'
      },
      explanation: localExplanation
    };
  },

  async requestQuiz(params) {
    const { course, subject, topic, explanationContext = '', level = 'intermediario', useAi = true } = params;

    try {
      const response = await postTutorJson('/api/tutor/quiz', {
        course,
        subject,
        topic,
        explanationContext,
        level,
        useAi
      });

      if (response.ok) {
        const data = await response.json();
        return {
          isDemo: data.meta?.isDemo ?? true,
          meta: data.meta || {},
          questions: data.questions
        };
      }
    } catch (err) {
      if (err?.status === 429) throw err;
      console.warn('Backend indisponível. Usando gerador de simulado local.', err);
    }

    const localQuestions = generateDemoQuiz(course, subject, topic, explanationContext, level);
    return {
      isDemo: true,
      meta: { isDemo: true, level },
      questions: localQuestions
    };
  }
};
