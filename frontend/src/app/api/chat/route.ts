/**
 * POST /api/chat — AI Coach Shinny.
 *
 * Pipeline (in order):
 *   1. Rate limit (per-IP, 20 / minute) — fails open via the lib helper.
 *   2. Zod-validate the body. Rejects malformed input at the boundary
 *      with a uniform 400 shape.
 *   3. Auth — require a logged-in user. Anonymous chat would be a
 *      naked LLM proxy with our quota and the abuse surface that
 *      implies.
 *   4. Tier gate — free tier gets `aiQuestionsPerDay` (3 today). The
 *      counter is the number of `chat_messages` rows authored by THIS
 *      user with role='user' since UTC midnight.
 *   5. Upstream chat completion via `chatComplete()` (Groq → Gemini →
 *      Cloudflare). Server-controlled system prompt; the client's
 *      history is appended.
 *   6. Persist BOTH turns (user message + assistant reply) to
 *      `chat_messages` so the next request's tier-counter and the
 *      eventual /admin/chats audit page see them.
 *   7. Reply with `{ reply, modelUsed, latencyMs, dailyRemaining }`.
 *
 * Always 200 on a successful upstream call — even if the persistence
 * write fails (logged but doesn't poison the user-visible reply).
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, sessions, chatMessages } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { getEnv } from '@/lib/cloudflare';
import { ChatRequest, zodFailure } from '@/lib/schemas';
import { rateLimit, tooManyResponse } from '@/lib/rate-limit';
import { chatComplete, type ChatTurn } from '@/lib/ai-providers';
import { buildChatSystemPrompt } from '@/lib/chat-prompts';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tier-config';
import { generateId } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Rate limit — same per-IP sliding window as the rest of the
  //    auth surface. Chat is interactive, so we allow more headroom
  //    than register/login (20/min vs 3/15min). The limiter never
  //    throws, so we don't need to wrap this in try/catch.
  const rl = await rateLimit(req, {
    routeLabel: 'chat',
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) return tooManyResponse(rl);

  try {
    // 2. Body validation
    const rawBody = await req.json().catch(() => null);
    const parsed = ChatRequest.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(zodFailure(parsed.error), { status: 400 });
    }
    const { message, history = [], locale = 'th' } = parsed.data;

    // 3. Auth — require a logged-in user with an unexpired session.
    //    Same lookup pattern as /api/auth/me + /api/promo/redeem.
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const env = await getEnv();
    const db = getDb(env);

    const activeSessions = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (activeSessions.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 },
      );
    }
    const userId = activeSessions[0].userId!;

    const userRows = await db
      .select({
        id: users.id,
        subscriptionTier: users.subscriptionTier,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const user = userRows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 4. Tier gate — `aiQuestionsPerDay`. We count user-role messages
    //    since UTC midnight. Premium/family is Infinity in tier-config,
    //    so this query short-circuits to "no cap".
    const tier = (user.subscriptionTier as SubscriptionTier) ?? 'free';
    const tierConfig = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const dailyLimit = tierConfig.aiQuestionsPerDay;

    let dailyRemaining: number | null = null;
    if (Number.isFinite(dailyLimit)) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const [countRow] = await db
        .select({ n: sql<number>`count(*)`.as('n') })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.userId, userId),
            eq(chatMessages.role, 'user'),
            gt(chatMessages.createdAt, startOfDay),
          ),
        );
      const usedToday = Number(countRow?.n ?? 0);
      dailyRemaining = Math.max(0, dailyLimit - usedToday);

      if (usedToday >= dailyLimit) {
        return NextResponse.json(
          {
            error: 'daily_limit_reached',
            limit: dailyLimit,
            tier,
          },
          { status: 429 },
        );
      }
    }

    // 5. Upstream completion — provider cascade (Groq → Gemini → CF).
    const systemPrompt = buildChatSystemPrompt(locale, tier);
    const messages: ChatTurn[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const result = await chatComplete(env, { messages });
    if (!result.ok) {
      logger.error('[chat] all providers failed', { error: result.error });
      return NextResponse.json(
        { error: 'AI providers unavailable, please try again later' },
        { status: 503 },
      );
    }

    // 6. Persist BOTH turns. Best-effort — the user already has their
    //    reply by this point, so a failed write must NOT poison the
    //    response.
    try {
      const now = new Date();
      await db.insert(chatMessages).values([
        {
          id: generateId(),
          userId,
          role: 'user',
          content: message,
          language: locale,
          createdAt: now,
        },
        {
          id: generateId(),
          userId,
          role: 'assistant',
          content: result.reply,
          language: locale,
          createdAt: new Date(now.getTime() + 1), // ensure stable ordering
        },
      ]);
    } catch (persistErr) {
      logger.warn('[chat] persistence failed (response still served)', {
        error: String((persistErr as any)?.message ?? persistErr),
      });
    }

    // 7. Respond
    return NextResponse.json({
      reply: result.reply,
      modelUsed: `${result.provider}/${result.modelUsed}`,
      latencyMs: result.latencyMs,
      // dailyRemaining is one less than what we computed above because
      // this turn just consumed one. Null = unlimited (premium/family).
      dailyRemaining: dailyRemaining !== null ? Math.max(0, dailyRemaining - 1) : null,
    });
  } catch (err) {
    logger.error('[chat] unhandled', { error: String((err as any)?.message ?? err) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
