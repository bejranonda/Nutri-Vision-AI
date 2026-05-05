/**
 * Multi-provider chat completion helper.
 *
 * Used by `/api/chat` (the AI-coach endpoint) to talk to a cascading
 * fallback chain of free-tier text providers:
 *
 *   1. Groq (`llama-3.3-70b-versatile`)
 *      - Free tier ~30 req/min, sub-300 ms p50 latency.
 *      - Activated when `env.GROQ_API_KEY` is present.
 *      - Best UX (large model + fast).
 *
 *   2. Google AI (`gemini-1.5-flash-latest`)
 *      - Free tier 1500 req/day, ~1 s latency.
 *      - Activated when `env.GOOGLE_AI_API_KEY` (or `GEMINI_API_KEY`)
 *        is present.
 *      - Already integrated for vision; we reuse the same key for chat.
 *
 *   3. Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)
 *      - Same free tier neuron budget the scan flow uses.
 *      - Activated when no other provider key is present, or both
 *        upstream calls fail.
 *
 * Why this order
 * - Groq is the chat-quality leader on a free tier; we'd rather pay
 *   nothing per request and get a 70B-class model than send chat to a
 *   smaller CF model.
 * - Gemini Flash has a generous free quota and a separate failure
 *   surface, so it's a great Plan B.
 * - CF Workers AI is the safety net we already pay for via the scan
 *   path — guarantees the endpoint never returns "no provider available"
 *   to a user.
 *
 * The function NEVER throws — uncaught provider errors are logged and
 * surface as a normalised `{ error }` return so route handlers can
 * choose their own user-facing 5xx response.
 */
import { logger } from '@/lib/logger';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompleteOptions {
  /** Conversation so far. The system prompt should be turn[0]. */
  messages: ChatTurn[];
  /** Hard cap on output tokens. Defaults to 800. */
  maxTokens?: number;
  /** Sampling temperature. Defaults to 0.6 for friendly chat. */
  temperature?: number;
  /** Per-provider request deadline. Defaults to 20 s. */
  timeoutMs?: number;
}

export interface ChatCompleteSuccess {
  ok: true;
  reply: string;
  /** Which provider answered. Useful for telemetry + cost analysis. */
  provider: 'groq' | 'google' | 'cloudflare';
  modelUsed: string;
  latencyMs: number;
}

export interface ChatCompleteFailure {
  ok: false;
  /** Compact diagnostic — never surfaced to the end user verbatim. */
  error: string;
}

export type ChatCompleteResult = ChatCompleteSuccess | ChatCompleteFailure;

/**
 * Run the chat-completion fallback chain. The returned object has an
 * `ok` discriminator so callers can branch cleanly.
 */
export async function chatComplete(
  env: any,
  opts: ChatCompleteOptions,
): Promise<ChatCompleteResult> {
  const {
    messages,
    maxTokens = 800,
    temperature = 0.6,
    timeoutMs = 20_000,
  } = opts;

  // Provider 1 — Groq
  if (env?.GROQ_API_KEY) {
    const t0 = Date.now();
    try {
      const reply = await callGroq(env.GROQ_API_KEY, messages, {
        maxTokens,
        temperature,
        timeoutMs,
      });
      return {
        ok: true,
        reply,
        provider: 'groq',
        modelUsed: 'llama-3.3-70b-versatile',
        latencyMs: Date.now() - t0,
      };
    } catch (err: any) {
      logger.warn('[chat] Groq fallback', { error: String(err?.message ?? err) });
      // fall through
    }
  }

  // Provider 2 — Google Gemini Flash
  const googleKey = env?.GOOGLE_AI_API_KEY ?? env?.GEMINI_API_KEY;
  if (googleKey) {
    const t0 = Date.now();
    try {
      const reply = await callGemini(googleKey, messages, {
        maxTokens,
        temperature,
        timeoutMs,
      });
      return {
        ok: true,
        reply,
        provider: 'google',
        modelUsed: 'gemini-1.5-flash-latest',
        latencyMs: Date.now() - t0,
      };
    } catch (err: any) {
      logger.warn('[chat] Gemini fallback', { error: String(err?.message ?? err) });
      // fall through
    }
  }

  // Provider 3 — Cloudflare Workers AI safety net
  if (env?.AI?.run) {
    const t0 = Date.now();
    try {
      const reply = await callCloudflare(env.AI, messages, {
        maxTokens,
        temperature,
        timeoutMs,
      });
      return {
        ok: true,
        reply,
        provider: 'cloudflare',
        modelUsed: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        latencyMs: Date.now() - t0,
      };
    } catch (err: any) {
      logger.warn('[chat] CF Workers AI failed', { error: String(err?.message ?? err) });
    }
  }

  return { ok: false, error: 'no_provider_available' };
}

// ---------------------------------------------------------------------------
// Provider implementations — each takes the SAME (key, messages, opts) shape
// so the cascade above stays trivially readable. Any per-provider
// peculiarity (e.g. Gemini's role mapping) is contained here.
// ---------------------------------------------------------------------------

interface ProviderOpts {
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function callGroq(
  apiKey: string,
  messages: ChatTurn[],
  opts: ProviderOpts,
): Promise<string> {
  // Groq exposes an OpenAI-compatible `/v1/chat/completions`.
  const res = await withTimeout(
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
      }),
    }),
    opts.timeoutMs,
    'groq',
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`groq ${res.status}: ${body.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || reply.length === 0) {
    throw new Error('groq returned empty content');
  }
  return reply;
}

async function callGemini(
  apiKey: string,
  messages: ChatTurn[],
  opts: ProviderOpts,
): Promise<string> {
  // Gemini's REST shape is different from OpenAI's: it expects a
  // `contents` array with `parts`, NOT a `messages` array, and it
  // doesn't have a "system" role — system instructions go via the
  // separate `systemInstruction` field. We translate here.
  const systemMsg = messages.find((m) => m.role === 'system');
  const turns = messages.filter((m) => m.role !== 'system');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  const payload: any = {
    contents: turns.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens,
    },
  };
  if (systemMsg) {
    payload.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    opts.timeoutMs,
    'gemini',
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== 'string' || reply.length === 0) {
    throw new Error('gemini returned empty content');
  }
  return reply;
}

async function callCloudflare(
  ai: any,
  messages: ChatTurn[],
  opts: ProviderOpts,
): Promise<string> {
  // CF Workers AI's chat models accept the OpenAI-style messages array
  // directly — no translation needed. Different models live behind
  // different bindings; we use the 70B fast variant.
  const aiPromise = ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
  });
  const data: any = await withTimeout(aiPromise, opts.timeoutMs, 'cloudflare');
  // CF returns either { response: '...' } or { result: { response: '...' } }
  // depending on the model — accept both.
  const reply: string =
    data?.response ?? data?.result?.response ?? data?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || reply.length === 0) {
    throw new Error('cloudflare returned empty content');
  }
  return reply;
}
