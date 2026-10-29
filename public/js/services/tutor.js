// ==========================================================
// TUTOR IA - CLIENTE DO SERVIÇO DO TUTOR (API & FALLBACK)
// ==========================================================

import { generateSmartDemoExplanation, generateDemoQuiz } from '../data/demoData.js';
import { StorageService } from './storage.js';

function getTutorRequestHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = StorageService.getSessionToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export const TutorService = {
  // Consultar status da API e se a IA real está ativa
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
      provider: 'Modo Local'
    };
  },

  // Solicitar explicação didática ao tutor
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
      console.warn('Backend indisponível ou aberto via arquivo local. Usando gerador didático integrado.', networkErr);
    }

    // Fallback didático 100% autônomo e confiável para modo offline ou sem servidor
    const localExplanation = generateSmartDemoExplanation(course, subject, topic, question, format);
    return {
      isDemo: true,
      meta: {
        isDemo: true,
        notice: 'Modo Demonstração (Etapa 2): Exibindo conteúdo didático estruturado de contingência.'
      },
      explanation: localExplanation
    };
  },

  // Solicitar questionário/simulado interativo
  async requestQuiz(params) {
    const { course, subject, topic, explanationContext = '' } = params;

    try {
      const response = await fetch('/api/tutor/quiz', {
        method: 'POST',
        headers: getTutorRequestHeaders(),
        body: JSON.stringify({ course, subject, topic, explanationContext })
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
      console.warn('Backend indisponível. Usando gerador de simulado local.', networkErr);
    }

    // Fallback local contextualizado garantido
    const localQuestions = generateDemoQuiz(course, subject, topic, explanationContext);
    return {
      isDemo: true,
      meta: { isDemo: true },
      questions: localQuestions
    };
  }
};
