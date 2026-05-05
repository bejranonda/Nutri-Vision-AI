/**
 * Tests for lib/ai-providers.ts (the chat-completion fallback chain).
 *
 * What we cover:
 *   1. Provider selection: with various combinations of available
 *      env keys/bindings, the right provider is chosen first and the
 *      response shape is correct.
 *   2. Cascade behaviour: if the first provider throws, the next one
 *      in line is tried; if all fail, we get { ok: false }.
 *   3. The function NEVER throws, even when no provider is configured.
 *
 * We mock `fetch` for Groq + Gemini, and provide a stubbed `env.AI`
 * for the Cloudflare path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatComplete } from '@/lib/ai-providers';

const SAMPLE_MESSAGES = [
  { role: 'system' as const, content: 'You are a helper.' },
  { role: 'user' as const, content: 'Hello' },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Provider 1 — Groq
// ---------------------------------------------------------------------------
describe('chatComplete — Groq provider', () => {
  it('uses Groq when GROQ_API_KEY is present', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'hi from groq' } }] }),
          { status: 200 },
        ),
      );

    const env = { GROQ_API_KEY: 'sk-test' };
    const result = await chatComplete(env, { messages: SAMPLE_MESSAGES });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('groq');
      expect(result.reply).toBe('hi from groq');
      expect(result.modelUsed).toContain('llama-3.3-70b');
    }
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('forwards messages array verbatim to Groq', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
          { status: 200 },
        ),
      );

    await chatComplete({ GROQ_API_KEY: 'k' }, { messages: SAMPLE_MESSAGES });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.messages).toEqual(SAMPLE_MESSAGES);
  });
});

// ---------------------------------------------------------------------------
// Provider 2 — Gemini fallback
// ---------------------------------------------------------------------------
describe('chatComplete — Gemini fallback', () => {
  it('uses Gemini when only GOOGLE_AI_API_KEY is present', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'hi from gemini' }] } }],
        }),
        { status: 200 },
      ),
    );
    const env = { GOOGLE_AI_API_KEY: 'k' };
    const result = await chatComplete(env, { messages: SAMPLE_MESSAGES });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('google');
      expect(result.reply).toBe('hi from gemini');
    }
  });

  it('also accepts GEMINI_API_KEY (legacy env var)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
        { status: 200 },
      ),
    );
    const result = await chatComplete(
      { GEMINI_API_KEY: 'k' },
      { messages: SAMPLE_MESSAGES },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe('google');
  });

  it('translates system messages to Gemini systemInstruction', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'r' }] } }],
          }),
          { status: 200 },
        ),
      );

    await chatComplete({ GOOGLE_AI_API_KEY: 'k' }, { messages: SAMPLE_MESSAGES });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.systemInstruction).toBeDefined();
    expect(body.systemInstruction.parts[0].text).toBe('You are a helper.');
    // The user turn should remain in `contents`, not the system prompt.
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe('user');
  });

  it('falls through to Gemini when Groq fetch fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    // First call (Groq) errors
    fetchMock.mockResolvedValueOnce(
      new Response('upstream blew up', { status: 500 }),
    );
    // Second call (Gemini) succeeds
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'rescued by gemini' }] } }],
        }),
        { status: 200 },
      ),
    );

    const env = { GROQ_API_KEY: 'k1', GOOGLE_AI_API_KEY: 'k2' };
    const result = await chatComplete(env, { messages: SAMPLE_MESSAGES });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('google');
      expect(result.reply).toBe('rescued by gemini');
    }
  });
});

// ---------------------------------------------------------------------------
// Provider 3 — Cloudflare Workers AI safety net
// ---------------------------------------------------------------------------
describe('chatComplete — Cloudflare safety net', () => {
  it('uses CF Workers AI when no other provider key is present', async () => {
    const env = {
      AI: {
        run: vi.fn().mockResolvedValue({ response: 'cf reply' }),
      },
    };
    const result = await chatComplete(env, { messages: SAMPLE_MESSAGES });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('cloudflare');
      expect(result.reply).toBe('cf reply');
    }
    expect(env.AI.run).toHaveBeenCalled();
  });

  it('handles CF response shape variants ({result.response})', async () => {
    const env = {
      AI: {
        run: vi.fn().mockResolvedValue({ result: { response: 'nested' } }),
      },
    };
    const result = await chatComplete(env, { messages: SAMPLE_MESSAGES });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reply).toBe('nested');
  });
});

// ---------------------------------------------------------------------------
// Robustness contract — never throws
// ---------------------------------------------------------------------------
describe('chatComplete — robustness', () => {
  it('returns { ok: false } when no provider is configured', async () => {
    const result = await chatComplete({}, { messages: SAMPLE_MESSAGES });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('no_provider_available');
  });

  it('returns { ok: false } when ALL providers fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('boom', { status: 500 }),
    );
    const env = {
      GROQ_API_KEY: 'k',
      GOOGLE_AI_API_KEY: 'k',
      AI: {
        run: vi.fn().mockRejectedValue(new Error('binding-down')),
      },
    };
    const result = await chatComplete(env, { messages: SAMPLE_MESSAGES });
    expect(result.ok).toBe(false);
  });

  it('does not throw when env is undefined', async () => {
    // Pathological input — must not surface as an exception. Routes
    // call this BEFORE their try/catch in some paths.
    const result = await chatComplete(undefined as any, { messages: SAMPLE_MESSAGES });
    expect(result.ok).toBe(false);
  });
});
