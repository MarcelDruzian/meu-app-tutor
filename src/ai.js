// ==========================================================
// TUTOR IA - CLIENTE DE INTELIGÊNCIA ARTIFICIAL (Gemini / OpenAI)
// ----------------------------------------------------------
// - Modelos configuráveis por GEMINI_MODEL e OPENAI_MODEL (padrões abaixo).
// - Prioridade: Gemini se houver GEMINI_API_KEY; senão OpenAI.
// - Timeout em todas as chamadas (AI_TIMEOUT_MS).
// - Falhas são registradas com status HTTP e motivo (a chave nunca é impressa).
// - Quem chama decide o fallback; este módulo só informa se a última chamada falhou.
// ==========================================================

// Valores padrão em um único lugar, fáceis de alterar.
// Confirmados na documentação oficial do Gemini em 26/10/2026:
// "gemini-1.5-flash" foi desligado em 29/09/2025.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_ATTEMPTS = 1;

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function extractJson(rawText) {
  const text = String(rawText).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(text);
  } catch (firstError) {
    // Tenta isolar o objeto JSON caso o modelo tenha escrito texto ao redor.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw firstError;
  }
}

/** Erro com informações seguras para log/diagnóstico (sem a chave de API). */
class AiError extends Error {
  constructor(message, { status = null, code = 'error' } = {}) {
    super(message);
    this.name = 'AiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ fetchImpl?: typeof fetch, logger?: Pick<Console,'log'|'warn'> }} [deps]
 */
export function createAiClient(env = process.env, { fetchImpl = globalThis.fetch, logger = console } = {}) {
  const geminiKey = String(env.GEMINI_API_KEY || '').trim();
  const openaiKey = String(env.OPENAI_API_KEY || '').trim();
  const geminiModel = String(env.GEMINI_MODEL || '').trim() || DEFAULT_GEMINI_MODEL;
  const openaiModel = String(env.OPENAI_MODEL || '').trim() || DEFAULT_OPENAI_MODEL;
  const geminiBase = String(env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const openaiBase = String(env.OPENAI_API_BASE || 'https://api.openai.com').replace(/\/+$/, '');
  const timeoutMs = positiveInt(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const retryAttempts = positiveInt(env.AI_RETRY_ATTEMPTS, DEFAULT_RETRY_ATTEMPTS);

  const hasGemini = Boolean(geminiKey);
  const hasOpenAI = Boolean(openaiKey);
  const hasKey = hasGemini || hasOpenAI;
  const provider = hasGemini ? 'Google Gemini' : (hasOpenAI ? 'OpenAI' : 'Modo Demonstração');
  const model = hasGemini ? geminiModel : (hasOpenAI ? openaiModel : null);

  // Estado da última chamada (para /api/status).
  let lastCall = { attempted: false, ok: null, error: null, at: null };

  function sanitize(text) {
    let safe = String(text ?? '');
    for (const secret of [geminiKey, openaiKey]) {
      if (secret) safe = safe.split(secret).join('[chave-oculta]');
    }
    return safe.replace(/\s+/g, ' ').slice(0, 300);
  }

  async function request(url, options, label) {
    let response;
    try {
      response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new AiError(`${label}: tempo limite de ${Math.round(timeoutMs / 1000)}s excedido`, { code: 'timeout' });
      }
      throw new AiError(`${label}: falha de rede (${sanitize(error?.cause?.code || error?.message)})`, { code: 'network' });
    }

    if (!response.ok) {
      let reason = '';
      try {
        const body = await response.json();
        reason = body?.error?.message || body?.error || JSON.stringify(body);
      } catch {
        reason = response.statusText || '';
      }
      throw new AiError(`${label}: HTTP ${response.status} - ${sanitize(typeof reason === 'string' ? reason : JSON.stringify(reason))}`, {
        status: response.status,
        code: 'http'
      });
    }

    try {
      return await response.json();
    } catch {
      throw new AiError(`${label}: resposta não é JSON válido`, { status: response.status, code: 'invalid_json' });
    }
  }

  async function callGemini(systemInstruction, userPrompt) {
    // A chave vai no cabeçalho (e não na URL) para não vazar em logs e mensagens de erro.
    const url = `${geminiBase}/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nREQUISIÇÃO DO ALUNO:\n${userPrompt}` }]
        }
      ],
      // "temperature" foi descontinuada nos modelos Gemini 3.x (ignorada hoje, erro 400 no futuro).
      generationConfig: { responseMimeType: 'application/json' }
    };

    const data = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify(payload)
    }, `Gemini (${geminiModel})`);

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const rawText = parts.filter(part => typeof part?.text === 'string' && !part.thought).map(part => part.text).join('');
    if (!rawText.trim()) {
      const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'sem texto';
      throw new AiError(`Gemini (${geminiModel}): resposta vazia (${sanitize(reason)})`, { code: 'empty' });
    }
    return parseJsonOrThrow(rawText, `Gemini (${geminiModel})`);
  }

  async function callOpenAI(systemInstruction, userPrompt) {
    const data = await request(`${openaiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    }, `OpenAI (${openaiModel})`);

    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText || !String(rawText).trim()) {
      throw new AiError(`OpenAI (${openaiModel}): resposta vazia`, { code: 'empty' });
    }
    return parseJsonOrThrow(rawText, `OpenAI (${openaiModel})`);
  }

  function parseJsonOrThrow(rawText, label) {
    try {
      return extractJson(rawText);
    } catch {
      throw new AiError(`${label}: o modelo não devolveu um JSON válido`, { code: 'invalid_json' });
    }
  }

  function shouldRetry(error) {
    if (!error) return false;
    if (error.code === 'timeout' || error.code === 'network') return true;
    if (error.status === 408 || error.status === 429 || error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504) {
      return true;
    }
    return false;
  }

  return {
    hasGemini,
    hasOpenAI,
    hasKey,
    provider,
    model,
    timeoutMs,

    /**
     * Pede uma resposta JSON ao provedor ativo.
     * @returns {Promise<{ data: any, provider: string, model: string } | null>} null se não há chave.
     * @throws {AiError} em falhas (o erro já foi registrado no log).
     */
    async complete(systemInstruction, userPrompt) {
      if (!hasKey) return null;

      let lastError;
      for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
        try {
          const data = hasGemini
            ? await callGemini(systemInstruction, userPrompt)
            : await callOpenAI(systemInstruction, userPrompt);
          lastCall = { attempted: true, ok: true, error: null, at: new Date().toISOString() };
          return { data, provider, model };
        } catch (error) {
          lastError = error;
          const shouldRetryNow = shouldRetry(error) && attempt < retryAttempts;
          if (shouldRetryNow) {
            logger.warn(`⚠️  Falha transitória na IA (tentativa ${attempt + 1}/${retryAttempts + 1}): ${error.message}. Tentando novamente...`);
            continue;
          }

          lastCall = {
            attempted: true,
            ok: false,
            error: error.status ? `HTTP ${error.status}` : (error.code || 'error'),
            at: new Date().toISOString()
          };
          logger.warn(`⚠️  Falha na IA, usando fallback local → ${error.message}`);
          throw error;
        }
      }

      throw lastError;
    },

    /** Registra que a IA respondeu, mas com um JSON fora do formato esperado (conta como fallback). */
    noteInvalidResponse(reason) {
      lastCall = { attempted: true, ok: false, error: 'invalid_format', at: new Date().toISOString() };
      logger.warn(`⚠️  A IA respondeu com formato inesperado (${reason}); usando fallback local.`);
    },

    /** Resumo seguro para GET /api/status (nunca inclui a chave). */
    describe() {
      return {
        provider,
        model,
        hasApiKey: hasKey,
        // true quando não há chave (modo demonstração) ou quando a última chamada de IA falhou.
        fallback: !hasKey || lastCall.ok === false,
        lastAiCall: lastCall.attempted ? { ok: lastCall.ok, error: lastCall.error, at: lastCall.at } : null
      };
    }
  };
}
