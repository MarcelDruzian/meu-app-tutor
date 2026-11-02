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
// Mantemos a escolha principal em Gemini 3.x, mas também inclui modelos mais recentes
// e estáveis para evitar que a app fique presa a um único nome de modelo.
// Evitamos expor modelos antigos como 1.5/2.0 como padrão em produção.
export const DEFAULT_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
export const DEFAULT_GEMINI_MODEL = DEFAULT_GEMINI_MODELS[0];
export const DEFAULT_OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'];
export const DEFAULT_OPENAI_MODEL = DEFAULT_OPENAI_MODELS[0];
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 1_000;

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
  const geminiBase = String(env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const openaiBase = String(env.OPENAI_API_BASE || 'https://api.openai.com').replace(/\/+$/, '');
  const timeoutMs = positiveInt(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const retryAttempts = positiveInt(env.AI_RETRY_ATTEMPTS, DEFAULT_RETRY_ATTEMPTS);
  const backoffMs = positiveInt(env.AI_BACKOFF_MS, DEFAULT_BACKOFF_MS);

  function normalizeModelCandidates(explicitValue, defaults) {
    const seen = new Set();
    const result = [];
    const sources = [explicitValue, ...defaults];
    for (const item of sources) {
      const value = String(item || '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      result.push(value);
    }
    return result.length ? result : defaults;
  }

  const geminiModels = normalizeModelCandidates(env.GEMINI_MODEL, DEFAULT_GEMINI_MODELS);
  const openaiModels = normalizeModelCandidates(env.OPENAI_MODEL, DEFAULT_OPENAI_MODELS);
  const hasGemini = Boolean(geminiKey);
  const hasOpenAI = Boolean(openaiKey);
  const hasKey = hasGemini || hasOpenAI;
  let provider = hasGemini ? 'Google Gemini' : (hasOpenAI ? 'OpenAI' : 'Modo Demonstração');
  let model = hasGemini ? geminiModels[0] : (hasOpenAI ? openaiModels[0] : null);
  const providerOrder = [];
  if (hasGemini) providerOrder.push({ id: 'gemini', label: 'Google Gemini', apiModels: geminiModels });
  if (hasOpenAI) providerOrder.push({ id: 'openai', label: 'OpenAI', apiModels: openaiModels });

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Estado da última chamada (para /api/status e diagnósticos externos).
  let lastCall = { attempted: false, ok: null, error: null, errorCode: null, reason: null, provider: null, model: null, at: null };

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

  async function callGemini(systemInstruction, userPrompt, currentModel) {
    // A chave vai no cabeçalho (e não na URL) para não vazar em logs e mensagens de erro.
    const url = `${geminiBase}/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nREQUISIÇÃO DO ALUNO:\n${userPrompt}` }]
        }
      ],
      generationConfig: { responseMimeType: 'application/json' }
    };

    const data = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify(payload)
    }, `Gemini (${currentModel})`);

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const rawText = parts.filter(part => typeof part?.text === 'string' && !part.thought).map(part => part.text).join('');
    if (!rawText.trim()) {
      const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'sem texto';
      throw new AiError(`Gemini (${currentModel}): resposta vazia (${sanitize(reason)})`, { code: 'empty' });
    }
    return parseJsonOrThrow(rawText, `Gemini (${currentModel})`);
  }

  async function callOpenAI(systemInstruction, userPrompt, currentModel) {
    const data = await request(`${openaiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: currentModel,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    }, `OpenAI (${currentModel})`);

    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText || !String(rawText).trim()) {
      throw new AiError(`OpenAI (${currentModel}): resposta vazia`, { code: 'empty' });
    }
    return parseJsonOrThrow(rawText, `OpenAI (${currentModel})`);
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
    if (error.code === 'timeout' || error.code === 'network') return false;
    if (error.status === 408 || error.status === 429 || error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504) {
      return true;
    }
    return false;
  }

  function classifyFailure(error, fallbackLabel = 'AI_REQUEST_FAILED') {
    if (!error) return fallbackLabel;
    if (error.code === 'invalid_json') return 'GEMINI_INVALID_RESPONSE';
    if (error.code === 'empty') return 'GEMINI_EMPTY_RESPONSE';
    if (error.code === 'timeout') return 'GEMINI_TIMEOUT';
    if (error.code === 'network') return 'GEMINI_NETWORK_ERROR';
    if (error.status === 400) return 'GEMINI_BAD_REQUEST';
    if (error.status === 401 || error.status === 403) return 'GEMINI_AUTH_ERROR';
    if (error.status === 404) return 'GEMINI_MODEL_NOT_FOUND';
    if (error.status === 429) return 'GEMINI_RATE_LIMIT';
    if (error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504) return 'GEMINI_PROVIDER_ERROR';
    return fallbackLabel;
  }

  return {
    hasGemini,
    hasOpenAI,
    hasKey,
    provider,
    model,
    timeoutMs,
    getHealthState() {
      if (!hasKey) return 'demo';
      if (!lastCall.attempted) return 'configured';
      return lastCall.ok === true ? 'healthy' : 'degraded';
    },

    /**
     * Pede uma resposta JSON ao provedor ativo.
     * @returns {Promise<{ data: any, provider: string, model: string } | null>} null se não há chave.
     * @throws {AiError} em falhas (o erro já foi registrado no log).
     */
    async complete(systemInstruction, userPrompt) {
      if (!hasKey) return null;

      let lastError = null;
      for (let providerIndex = 0; providerIndex < providerOrder.length; providerIndex += 1) {
        const activeProvider = providerOrder[providerIndex];

        for (let modelIndex = 0; modelIndex < activeProvider.apiModels.length; modelIndex += 1) {
          const activeModel = activeProvider.apiModels[modelIndex];

          for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
            try {
              const startedAt = Date.now();
              const data = activeProvider.id === 'gemini'
                ? await callGemini(systemInstruction, userPrompt, activeModel)
                : await callOpenAI(systemInstruction, userPrompt, activeModel);

              provider = activeProvider.label;
              model = activeModel;
              lastCall = {
                attempted: true,
                ok: true,
                error: null,
                errorCode: null,
                reason: 'SUCCESS',
                provider,
                model,
                at: new Date().toISOString(),
                latencyMs: Date.now() - startedAt
              };
              return { data, provider, model };
            } catch (error) {
              lastError = error;
              const failureReason = classifyFailure(error, 'AI_REQUEST_FAILED');
              const shouldAdvanceModel = error?.status === 400 || error?.status === 404 || error?.code === 'invalid_json' || error?.code === 'empty';
              const retryNow = shouldRetry(error) && attempt < retryAttempts;
              if (retryNow) {
                const waitMs = backoffMs * (attempt + 1);
                logger.warn(`⚠️  Falha transitória na IA em ${activeProvider.label} (${activeModel}) (${failureReason}) (tentativa ${attempt + 1}/${retryAttempts + 1}): ${error.message}. Tentando novamente em ${waitMs}ms...`);
                await sleep(waitMs);
                continue;
              }
              if (shouldAdvanceModel && modelIndex < activeProvider.apiModels.length - 1) {
                logger.warn(`⚠️  ${activeProvider.label} (${activeModel}) rejeitou a requisição (${failureReason}); tentando modelo alternativo...`);
                break;
              }
              break;
            }
          }

          if (modelIndex < activeProvider.apiModels.length - 1) {
            continue;
          }
        }

        if (providerIndex < providerOrder.length - 1) {
          logger.warn(`⚠️  ${activeProvider.label} indisponível; tentando provedor alternativo...`);
          continue;
        }

        const failureReason = classifyFailure(lastError, 'AI_REQUEST_FAILED');
        lastCall = {
          attempted: true,
          ok: false,
          error: lastError?.status ? `HTTP ${lastError.status}` : (lastError?.code || 'error'),
          errorCode: lastError?.status || lastError?.code || failureReason,
          reason: failureReason,
          provider: activeProvider.label,
          model: model || activeProvider.apiModels[activeProvider.apiModels.length - 1],
          at: new Date().toISOString()
        };
        logger.warn(`⚠️  Falha na IA, usando fallback local [${failureReason}] → ${lastError?.message || 'erro desconhecido'}`);
        throw lastError;
      }

      throw lastError;
    },

    /** Registra que a IA respondeu, mas com um JSON fora do formato esperado (conta como fallback). */
    noteInvalidResponse(reason) {
      lastCall = {
        attempted: true,
        ok: false,
        error: 'invalid_format',
        errorCode: 'GEMINI_INVALID_RESPONSE',
        reason: 'GEMINI_INVALID_RESPONSE',
        provider,
        model,
        at: new Date().toISOString()
      };
      logger.warn(`⚠️  A IA respondeu com formato inesperado (${reason}); usando fallback local.`);
    },

    /** Resumo seguro para GET /api/status (nunca inclui a chave). */
    describe() {
      const health = this.getHealthState();
      return {
        provider,
        model,
        hasApiKey: hasKey,
        // true quando não há chave (modo demonstração) ou quando a última chamada de IA falhou.
        fallback: !hasKey || lastCall.ok === false,
        health,
        status: health === 'healthy' ? 'online' : (health === 'configured' ? 'configured' : 'degraded'),
        validation: hasKey ? (lastCall.ok === true ? 'validated' : 'not_validated') : 'demo',
        lastAiCall: lastCall.attempted ? {
          ok: lastCall.ok,
          error: lastCall.error,
          errorCode: lastCall.errorCode,
          reason: lastCall.reason,
          provider: lastCall.provider,
          model: lastCall.model,
          at: lastCall.at
        } : null
      };
    }
  };
}
