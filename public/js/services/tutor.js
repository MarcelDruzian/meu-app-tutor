// ==========================================================
// TUTOR IA - CLIENTE DO SERVI?O DO TUTOR (API & FALLBACK)
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

export const TutorService = {
  async getApiStatus() {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Backend offline ou inacess?vel no momento.');
    }
    return {
      status: 'offline',
      mode: 'demo_mode',
      hasApiKey: false,
      provider: 'Modo Local'
    };
  },

  async requestExplanation(params) {
    const { course, subject, topic, question, format } = params;

    try {
      const response = await fetch('/api/tutor/explain', {
        method: 'POST',
        headers: getTutorRequestHeaders(),
        body: JSON.stringify({ course, subject, topic, question, format })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          isDemo: data.meta?.isDemo ?? true,
          meta: data.meta || {},
          explanation: data.tutorExplanation
        };
      }
    } catch (networkErr) {
      console.warn('Backend indispon?vel ou aberto via arquivo local. Usando gerador did?tico integrado.', networkErr);
    }

    const localExplanation = generateSmartDemoExplanation(course, subject, topic, question, format);
    return {
      isDemo: true,
      meta: {
        isDemo: true,
        notice: 'Modo Demonstra??o (Etapa 2): Exibindo conte?do did?tico estruturado de conting?ncia.'
      },
      explanation: localExplanation
    };
  },

  async requestQuiz(params) {
    const { course, subject, topic, explanationContext = '' } = params;

    try {
      const response = await fetch('/api/tutor/quiz', {
        method: 'POST',
        headers: getTutorRequestHeaders(),
        body: JSON.stringify({
          course,
          subject,
          topic,
          explanationContext,
          useAi: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          isDemo: data.meta?.isDemo ?? true,
          meta: data.meta || {},
          questions: data.questions
        };
      }
    } catch (networkErr) {
      console.warn('Backend indispon?vel. Usando gerador de simulado local.', networkErr);
    }

    const localQuestions = generateDemoQuiz(course, subject, topic, explanationContext);
    return {
      isDemo: true,
      meta: { isDemo: true },
      questions: localQuestions
    };
  }
};
