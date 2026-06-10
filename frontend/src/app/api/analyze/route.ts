import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { getDb } from '@/db';
import { users, foodScans } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/crypto';
import { sessions } from '@/db/schema';
import { TIER_LIMITS, SubscriptionTier } from '@/lib/tier-config';
import { logger } from '@/lib/logger';
import { getEnvSafe } from '@/lib/cloudflare';
import { buildLocalizedPrompt, validateAiResponse, validateMultiDishResponse, validateMenuResponse, validateDrinkSnackResponse, type ScanMode } from '@/lib/ai-prompt';
import { extractBase64Data, decodeBase64ToBytes } from '@/lib/utils';
import { AnalyzeRequest, zodFailure } from '@/lib/schemas';
import { GEMINI_VISION_MODELS } from '@/lib/ai-providers';
import { rateLimit, tooManyResponse } from '@/lib/rate-limit';

/** Safely parse JSON from AI response — tries direct parse first, then regex extraction */
function safeParseJson(raw: string): { parsed?: any; error?: Error } {
    // 1. Try direct parse first (most reliable)
    try {
        return { parsed: JSON.parse(raw) };
    } catch { /* fall through to regex extraction */ }

    // 2. Try extracting JSON object from surrounding text/markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return { parsed: JSON.parse(jsonMatch[0]) };
        } catch (e: any) {
            return { error: new Error(`Regex-extracted JSON also invalid: ${e.message}`) };
        }
    }

    return { error: new Error('No JSON object found in AI response') };
}

/** Validate base64 image data format */
function validateImageBase64(imageBase64: string): { valid: boolean; error?: string; rawBytes?: number } {
    if (!imageBase64) {
        return { valid: false, error: 'no_image_data' };
    }
    if (!imageBase64.includes(',')) {
        return { valid: false, error: 'missing_data_uri_comma' };
    }
    const parts = imageBase64.split(',');
    if (parts.length !== 2) {
        return { valid: false, error: `unexpected_parts_count_${parts.length}` };
    }
    const header = parts[0];
    if (!header.startsWith('data:image')) {
        return { valid: false, error: `invalid_header: ${header.substring(0, 40)}` };
    }
    // Estimate raw byte size from base64 length
    const rawBytes = Math.floor((parts[1].length * 3) / 4);
    if (rawBytes < 100) {
        return { valid: false, error: `image_too_small_${rawBytes}bytes` };
    }
    if (rawBytes > 20_000_000) {
        return { valid: false, error: `image_too_large_${(rawBytes / 1_000_000).toFixed(1)}MB` };
    }
    return { valid: true, rawBytes };
}

export async function POST(req: NextRequest) {
    // Per-IP rate limit: 20 scans/min. This is the most expensive route
    // in the app (Workers AI + Gemini quota per call); without a cap one
    // IP can drain the day's free-tier AI budget. 20/min is far above any
    // organic usage — a real user takes >3s per scan just uploading —
    // while still throttling scripted abuse. Sits BEFORE the try/catch
    // like every other rateLimit call site (the helper never throws).
    const rl = await rateLimit(req, {
        routeLabel: 'analyze',
        limit: 20,
        windowMs: 60_000,
    });
    if (!rl.allowed) return tooManyResponse(rl);

    const requestId = logger.generateRequestId();
    const requestStartTime = Date.now();
    let currentPhase = 'INIT';

    try {
        // ── Phase 1: Parse request body ───────────────────────────
        currentPhase = 'PARSE_BODY';

        const rawBody = await req.json().catch(() => null);
        // Zod enforces: data-URI image, recognised locale/scanMode/photoCount
        // bounds, optional forceModel string. The route layer re-validates
        // the decoded image bytes below (size, base64 format); this is the
        // fast-fail before we do any expensive work.
        const parsed = AnalyzeRequest.safeParse(rawBody);
        if (!parsed.success) {
            const failure = zodFailure(parsed.error);
            logger.scanApiStage('BODY_PARSE_ERROR', { requestId, fields: Object.keys(failure.fields) });
            return jsonResponse({ ...failure, requestId }, { status: 400 });
        }
        const imageBase64 = parsed.data.imageBase64;
        const locale = parsed.data.locale ?? 'th';
        const forceModel = parsed.data.forceModel;
        const scanMode: ScanMode = parsed.data.scanMode ?? 'meal';
        // photoCount reflects how many separate photos the client stitched
        // into `imageBase64`. We pass this into the prompt so the model
        // knows the image is a collage and must report one dish per tile.
        const photoCount = parsed.data.photoCount ?? 1;

        const payloadSize = imageBase64 ? imageBase64.length : 0;
        logger.scanApiStage('REQUEST_RECEIVED', { requestId, locale, forceModel, scanMode, photoCount, payloadSizeKB: (payloadSize / 1024).toFixed(1), hasImage: !!imageBase64 });

        if (!imageBase64) {
            logger.scanApiStage('VALIDATION_FAILED', { requestId, reason: 'no_image' });
            return jsonResponse({ error: 'Image data is required', requestId }, { status: 400 });
        }

        // ── Phase 2: Validate image format ────────────────────────
        currentPhase = 'VALIDATE_IMAGE';
        const imageValidation = validateImageBase64(imageBase64);
        if (!imageValidation.valid) {
            logger.scanApiStage('IMAGE_VALIDATION_FAILED', { requestId, error: imageValidation.error });
            return jsonResponse(
                { error: 'Invalid image format', message: imageValidation.error, requestId },
                { status: 400 }
            );
        }
        logger.scanApiStage('IMAGE_VALIDATED', { requestId, rawBytesKB: ((imageValidation.rawBytes || 0) / 1024).toFixed(1) });

        // ── Phase 3: Environment bindings ─────────────────────────
        currentPhase = 'ENV_INIT';
        const env = await getEnvSafe();
        logger.scanEnvDiagnostic(requestId, env);

        // ── Phase 4: Session & Auth (FAULT-TOLERANT) ──────────────
        currentPhase = 'SESSION';
        let token: string | undefined;
        let db: any = null;
        let userId: string | null = null;
        let activeUser: any = null;

        try {
            token = await getSessionToken();
            logger.scanSessionEvent(requestId, 'TOKEN_RETRIEVED', { hasToken: !!token });
        } catch (sessionErr: any) {
            logger.scanSessionEvent(requestId, 'TOKEN_ERROR', {
                error: sessionErr.message,
                stack: sessionErr.stack?.substring(0, 300)
            });
            // Continue as anonymous — session errors must NOT crash scan
        }

        // ── Phase 5: Database init (FAULT-TOLERANT) ───────────────
        currentPhase = 'DB_INIT';
        try {
            db = getDb(env);
            logger.scanApiStage('DB_INIT_SUCCESS', { requestId });
        } catch (dbErr: any) {
            logger.scanApiStage('DB_INIT_ERROR', {
                requestId,
                error: dbErr.message,
                stack: dbErr.stack?.substring(0, 300)
            });
            // Continue without DB — anonymous scans should still work
        }

        // ── Phase 6: Auth & Rate Limiting (skip if no DB) ────────
        currentPhase = 'AUTH_CHECK';
        if (db && token) {
            try {
                const activeSessions = await db
                    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
                    .from(sessions)
                    .where(eq(sessions.token, token))
                    .limit(1);
                if (activeSessions.length > 0) {
                    userId = activeSessions[0].userId!;
                    // Explicit columns — scan auth must survive an
                    // unapplied additive migration (e.g. is_admin from
                    // migration 0002 not yet wrangler-applied).
                    const foundUsers = await db
                        .select({
                            id: users.id,
                            subscriptionTier: users.subscriptionTier,
                            scansThisMonth: users.scansThisMonth,
                        })
                        .from(users)
                        .where(eq(users.id, userId!))
                        .limit(1);
                    activeUser = foundUsers[0];
                }
                logger.scanSessionEvent(requestId, 'AUTH_RESOLVED', {
                    hasUser: !!activeUser,
                    userId: userId?.substring(0, 8),
                    tier: activeUser?.subscriptionTier
                });
            } catch (authErr: any) {
                logger.scanSessionEvent(requestId, 'AUTH_QUERY_ERROR', {
                    error: authErr.message,
                    stack: authErr.stack?.substring(0, 300)
                });
                // Continue as anonymous — auth query errors must NOT crash scan
            }
        } else {
            logger.scanApiStage('AUTH_SKIPPED', { requestId, reason: !db ? 'no_db' : 'no_token' });
        }

        if (activeUser) {
            // Rate Limit Check
            const tierStr = activeUser.subscriptionTier as SubscriptionTier;
            const tierConfig = TIER_LIMITS[tierStr] || TIER_LIMITS.free;

            if (tierConfig.scansPerMonth !== Infinity && activeUser.scansThisMonth >= tierConfig.scansPerMonth) {
                logger.scanApiStage('RATE_LIMITED', { requestId, tier: tierStr, used: activeUser.scansThisMonth, limit: tierConfig.scansPerMonth });
                return jsonResponse({
                    error: 'Scan limit reached',
                    message: 'You have exhausted your free scans for this month. Please upgrade to continue.',
                    requestId
                }, { status: 403 });
            }
        }

        // ── Phase 7: AI Inference ─────────────────────────────────
        currentPhase = 'AI_INFERENCE';
        let resultJson;
        let modelUsed = 'unknown';

        const attemptAiInference = async (model: string, timeoutMs: number) => {
            const localizedPrompt = buildLocalizedPrompt(locale, scanMode, photoCount);
            const aiStartTime = Date.now();

            logger.scanApiStage('AI_INFERENCE_START', {
                requestId,
                model,
                locale,
                promptLength: localizedPrompt.length
            });

            // Decode base64 to byte array — Edge-safe using shared utility.
            // CF Workers AI vision models (`@cf/meta/llama-3.2-*-vision-instruct`,
            // `@cf/llava-…`) expect `image: number[]` — an array of unsigned
            // byte values, NOT a wrapper around a Uint8Array.
            //
            // Earlier shapes (`image: bytes` with `bytes: Uint8Array`) appear
            // to deserialise on the runtime as a 1-element list whose only
            // entry is the typed array itself; the model then sees zero pixels
            // and hallucinates a text-only "Here is your image: ![image](url)"
            // response. Bug-hunt May 2026 surfaced this once PR #25 unblocked
            // the 5016 license error that had been masking it on every prior
            // scan.
            //
            // `Array.from(Uint8Array)` is the cleanest cross-runtime way to
            // get a plain `number[]` of byte values.
            const base64Data = extractBase64Data(imageBase64);
            const bytes = Array.from(decodeBase64ToBytes(base64Data));

            // Run the model. On the first 5016 (Llama Community License
            // not accepted on this Cloudflare account), auto-submit the
            // 'agree' prompt — Cloudflare's documented programmatic
            // acceptance path — and retry the actual inference once.
            // Without this, every scan slammed straight through to the
            // Gemini fallback (May 2026 bug-hunt: Request ID `sex01ab2`
            // surfaced the 5016 error via `primaryProviderError`).
            //   Error shape:
            //     "5016: Prior to using this model, you must submit the
            //      prompt 'agree'. By submitting 'agree', you hereby
            //      agree to the llama-3.2-11b-vision-instruct Community
            //      License …"
            // The acceptance is account-level and one-shot; subsequent
            // scans never re-trigger it.
            //
            // `max_tokens: 4096` is required, NOT optional. CF Workers
            // AI defaults to ~256 max_tokens for llama-3.2 vision, which
            // truncates the JSON output mid-array on any non-trivial
            // scan (multi-item detectedItems, Thai/multi-byte chars).
            // Bug-hunt May 2026 (Request IDs `02tf04hd`, `eh0dzg8k`):
            // when Gemini cascade timed out and CF served the result,
            // the JSON was structurally invalid because CF stopped
            // mid-stream. `safeParseJson` rescued the {…} block but
            // the contents were broken (unclosed arrays). Bumping to
            // 4096 matches what we already pass to Gemini.
            const runWithTimeout = (payload: any) =>
                Promise.race([
                    env.AI.run(model, payload),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`AI inference timed out after ${timeoutMs/1000} seconds`)), timeoutMs)
                    ),
                ]);

            logger.scanApiStage('AI_AWAITING_RESPONSE', { requestId, model, timeoutMs });
            let response: any;
            try {
                response = await runWithTimeout({ prompt: localizedPrompt, image: bytes, max_tokens: 4096 });
            } catch (firstErr: any) {
                const msg = String(firstErr?.message ?? firstErr);
                // Code-prefix `5016:` is the stable marker; the human
                // text after it can drift across Cloudflare AI versions.
                if (msg.startsWith('5016:') || msg.includes("submit the prompt 'agree'")) {
                    logger.scanApiStage('CF_LLAMA_LICENSE_ACCEPTING', { requestId, model });
                    // Cheap text-only acceptance call — no image, minimal
                    // prompt. Errors here are non-fatal; if acceptance
                    // itself fails we fall through to the original 5016
                    // throw and the Gemini cascade picks up.
                    try {
                        await env.AI.run(model, { prompt: 'agree' });
                        logger.scanApiStage('CF_LLAMA_LICENSE_ACCEPTED', { requestId, model });
                    } catch (acceptErr: any) {
                        logger.warn(`⚠️ CF_LLAMA_LICENSE_ACCEPT_FAILED [${requestId}]`, { error: String(acceptErr?.message ?? acceptErr) });
                        throw firstErr; // propagate original — cascade will handle
                    }
                    // Retry the real inference now that license is on file
                    response = await runWithTimeout({ prompt: localizedPrompt, image: bytes, max_tokens: 4096 });
                } else {
                    throw firstErr;
                }
            }

            const rawResponse = response?.response || '{}';
            logger.scanApiStage('AI_INFERENCE_COMPLETE', {
                requestId,
                model,
                durationMs: Date.now() - aiStartTime,
                rawResponseLength: rawResponse.length
            });

            try {
                const { parsed, error } = safeParseJson(rawResponse);
                if (error) throw error;
                return { parsedJson: parsed, rawResponse };
            } catch (parseErr: any) {
                logger.error(`❌ AI PARSE FAIL [cloudflare] [${requestId}]`, {
                    error: parseErr.message,
                    rawPreview: rawResponse.substring(0, 500),
                    rawLength: rawResponse.length,
                    model,
                });
                return { error: parseErr, rawResponse };
            }
        };

        const attemptGoogleInference = async (apiKey: string, timeoutMs: number) => {
            // Walks `GEMINI_VISION_MODELS` in order, returning the first
            // model that responds 200. Skips on the two known per-model
            // failure modes:
            //   - 404 → model retired / alias gone (May 2026 incident,
            //     `gemini-1.5-flash-latest` retired from v1beta)
            //   - 429 → quota exhausted on this project for this model
            //     (May 2026 incident, Request IDs `tqunrejp` / `fz64f4uh`:
            //     `limit: 0` on `gemini-2.0-flash` free tier while
            //     `gemini-2.5-flash` on the same key still had quota)
            // Any other status (5xx, malformed JSON, network) throws
            // immediately — no point trying the next model when it's an
            // upstream-wide problem.
            const localizedPrompt = buildLocalizedPrompt(locale, scanMode, photoCount);
            const base64Data = extractBase64Data(imageBase64);
            const payload = {
                contents: [{
                    parts: [
                        { text: localizedPrompt },
                        { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1, // Low temperature for consistent JSON
                    maxOutputTokens: 4096
                }
            };

            const skippedModels: { model: string; status: number }[] = [];
            // Per-model deadline so the cascade as a whole still fits
            // inside the caller's timeout budget. Round up so single-model
            // attempts don't get squeezed when there are few models.
            const perModelTimeoutMs = Math.max(
                Math.floor(timeoutMs / GEMINI_VISION_MODELS.length),
                8_000,
            );

            for (const model of GEMINI_VISION_MODELS) {
                const aiStartTime = Date.now();
                logger.scanApiStage('AI_GOOGLE_START', { requestId, model, locale });

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), perModelTimeoutMs);

                let response: Response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                } catch (err: any) {
                    clearTimeout(timeoutId);
                    // Network / abort error — surface immediately, retrying
                    // a sibling model won't help with connectivity issues.
                    throw err;
                }
                clearTimeout(timeoutId);

                if (response.status === 404 || response.status === 429) {
                    const errorText = await response.text().catch(() => '');
                    logger.warn(`⚠️ AI GOOGLE SKIP [${requestId}] | ${model} returned ${response.status}, trying next in cascade`, {
                        statusPreview: errorText.substring(0, 200),
                    });
                    skippedModels.push({ model, status: response.status });
                    continue;
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Google API error (${model}): ${response.status} ${errorText}`);
                }

                const data = await response.json() as any;
                const rawResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

                logger.scanApiStage('AI_GOOGLE_COMPLETE', {
                    requestId,
                    model,
                    durationMs: Date.now() - aiStartTime,
                    rawResponseLength: rawResponse.length,
                    skippedBeforeWin: skippedModels.length,
                });

                try {
                    const { parsed, error } = safeParseJson(rawResponse);
                    if (error) throw error;
                    return { parsedJson: parsed, rawResponse, model };
                } catch (parseErr: any) {
                    logger.error(`❌ AI PARSE FAIL [google] [${requestId}]`, {
                        error: parseErr.message,
                        rawPreview: rawResponse.substring(0, 500),
                        rawLength: rawResponse.length,
                        model,
                    });
                    return { error: parseErr, rawResponse, model };
                }
            }

            // Cascade exhausted — every model returned 404/429. Encode the
            // per-model status list so the outer catch's `details` field
            // tells operators which models had quota and which didn't.
            const summary = skippedModels.map((s) => `${s.model}=${s.status}`).join(', ');
            throw new Error(`Google API error: all ${GEMINI_VISION_MODELS.length} fallback models exhausted (${summary})`);
        };

        let failedJsonText = '';
        // Captured so the outer catch's 503 response surfaces the full
        // chain instead of just the LAST error:
        //   - primaryProviderError: the Gemini-cascade failure that
        //     kicked the request into the CF safety-net (was originally
        //     called "primary" when CF was primary; semantics shifted
        //     after PR #27 but the field name is preserved for clients
        //     that already parse it).
        //   - fallbackProviderError: the CF safety-net failure when CF
        //     ALSO fails (timeout, returned non-JSON, validation throws).
        //     Without this, an operator looking at a 503 only sees the
        //     auto-correction retry's error in `details` and can't tell
        //     which provider gave up first. Bug-hunt May 2026, Request
        //     ID `qh0f02ft` (drink_snack mode): both providers failed,
        //     diagnostic chain showed `primaryProviderError: 'The
        //     operation was aborted'` but `failedJson: (empty)` — no
        //     signal at all about what CF actually did.
        let primaryProviderError: string | null = null;
        let fallbackProviderError: string | null = null;

        try {
            const googleKey = env.GOOGLE_AI_API_KEY;
            let lastError: any = null;

            // Helper to run inference + validation with an optional correction prompt
            const runInferenceWithValidation = async () => {
                let aiResult: any;
                let usedModel = '';

                // CASCADE ORDER (May 2026, post-PR #26):
                //   1. Google Gemini cascade — primary
                //   2. Cloudflare Workers AI (Llama 3.2 11B vision) — fallback
                //
                // Originally CF was primary (free + fast). Bug-hunt May 2026
                // surfaced that CF returns hallucinated / inaccurate JSON
                // even with the image-format fix from PR #26 — calling
                // Shrimp Fried Rice "Pineapple" with 100% confidence, etc.
                // CF-primary turned the user-visible answer into "fast +
                // free + sometimes wrong"; reversing puts accuracy first
                // and keeps CF as the genuine safety net for the case
                // where the Gemini cascade is exhausted.
                //
                // Net Gemini-quota usage is roughly unchanged: CF's
                // unreliable JSON output meant most CF-primary requests
                // were already falling through to Gemini anyway.
                if (googleKey) {
                    try {
                        aiResult = await attemptGoogleInference(googleKey, 25000);
                        usedModel = `google-${aiResult.model}`;
                    } catch (gErr: any) {
                        primaryProviderError = gErr.message;
                        if (env.AI) {
                            logger.info(`🔄 SCAN FALLBACK [${requestId}] | Gemini cascade failed (${gErr.message?.substring(0, 120)}), trying Cloudflare Workers AI...`);
                            // Capture CF errors into `fallbackProviderError`
                            // before re-throwing so the outer 503 response
                            // surfaces both providers' failures, not just
                            // the auto-correction retry's last error.
                            try {
                                aiResult = await attemptAiInference('@cf/meta/llama-3.2-11b-vision-instruct', 20000);
                                usedModel = 'cloudflare-llama-3.2-11b';
                            } catch (cfErr: any) {
                                fallbackProviderError = cfErr.message;
                                throw cfErr;
                            }
                        } else {
                            throw gErr;
                        }
                    }
                } else if (env.AI) {
                    // No Google key configured at all — CF is the only choice.
                    logger.warn(`⚠️ SCAN [${requestId}] | No GOOGLE_AI_API_KEY; CF is the sole provider`);
                    aiResult = await attemptAiInference('@cf/meta/llama-3.2-11b-vision-instruct', 25000);
                    usedModel = 'cloudflare-llama-3.2-11b';
                } else {
                    throw new Error('AI_BINDING_MISSING');
                }

                if (aiResult.error) {
                    failedJsonText = aiResult.rawResponse;
                    throw new Error(`JSON Parse Error: ${aiResult.error.message}`);
                }

                // Validation
                let validatedData;
                try {
                    if (scanMode === 'meal') validatedData = validateMultiDishResponse(aiResult.parsedJson);
                    else if (scanMode === 'menu') validatedData = validateMenuResponse(aiResult.parsedJson);
                    else validatedData = validateDrinkSnackResponse(aiResult.parsedJson);
                    return { data: validatedData, model: usedModel };
                } catch (valErr: any) {
                    failedJsonText = aiResult.rawResponse;
                    throw new Error(`Validation Error: ${valErr.message}`);
                }
            };

            // AUTO-CORRECTION LOOP (Max 1 retry)
            try {
                // Attempt 1 — Gemini → CF
                const res = await runInferenceWithValidation();
                resultJson = res.data;
                modelUsed = res.model;
            } catch (err: any) {
                lastError = err;
                logger.warn(`⚠️ AI VALIDATION/PARSE FAILED (Attempt 1) [${requestId}] | Error: ${err.message}. Retrying with diverse provider...`);

                // Attempt 2: for provider diversity, prefer the OPPOSITE
                // path from what attempt 1 just exercised. If the primary
                // is Gemini and it (or its CF fallback) failed, jumping
                // straight to CF on attempt 2 gives a fresh inference
                // surface — same logic the previous CF-primary version
                // used, just mirrored.
                try {
                    let res2;
                    if (env.AI) {
                        // Force CF directly — Gemini just failed.
                        const aiResult = await attemptAiInference('@cf/meta/llama-3.2-11b-vision-instruct', 25000);
                        if (aiResult.error) throw new Error(`JSON Parse Error: ${aiResult.error.message}`);
                        let validatedData;
                        if (scanMode === 'meal') validatedData = validateMultiDishResponse(aiResult.parsedJson);
                        else if (scanMode === 'menu') validatedData = validateMenuResponse(aiResult.parsedJson);
                        else validatedData = validateDrinkSnackResponse(aiResult.parsedJson);
                        res2 = { data: validatedData, model: 'cloudflare-llama-3.2-11b' };
                    } else {
                        res2 = await runInferenceWithValidation();
                    }
                    resultJson = res2.data;
                    modelUsed = res2.model;
                    logger.info(`✅ AI AUTO-CORRECT SUCCESS [${requestId}] | Model: ${modelUsed}`);
                } catch (retryErr: any) {
                    logger.error(`❌ AI AUTO-CORRECT FAILED (Attempt 2) [${requestId}] | Error: ${retryErr.message}`);
                    throw retryErr;
                }
            }

            // We safely drop the manual `isFood` 422 rejections here because the `page.tsx` now handles
            // the `isFood === false` graceful error messages directly. We just pass `resultJson` directly to the client.

        } catch (aiError: any) {
            const aiDurationMs = Date.now() - requestStartTime;
            logger.scanApiStage('AI_FAILED_TOTAL', {
                requestId,
                error: aiError.message,
                durationMs: aiDurationMs
            });

            // Persist a metadata-only failure row so /admin/scans can
            // surface AI-pipeline regressions (KNOWN_ISSUES 0b). The
            // errorClass column existed since the schema's first cut but
            // nothing ever wrote it — failures were only visible in the
            // ephemeral CF log stream. Best-effort: a DB hiccup here must
            // never mask the real 503 the user is about to receive.
            try {
                if (db) {
                    const msg = String(aiError.message ?? '');
                    const errorClass =
                        msg === 'AI_BINDING_MISSING' ? 'binding_missing'
                        : /abort|timeout|timed out/i.test(msg) ? 'timeout'
                        : /json|parse/i.test(msg) ? 'parse_error'
                        : 'provider_error';
                    await db.insert(foodScans).values({
                        id: generateId(),
                        userId: activeUser?.id ?? null,
                        imageUrl: null,
                        detectedItems: [],
                        nutritionSummary: {},
                        scoreOverall: null,
                        modelUsed: null,
                        scanMode,
                        errorClass,
                        createdAt: new Date(),
                    });
                }
            } catch (persistErr: any) {
                logger.scanApiStage('FAILURE_ROW_PERSIST_ERROR', { requestId, error: persistErr.message });
            }

            if (aiError.message === 'AI_BINDING_MISSING') {
                return jsonResponse({
                    error: 'AI not available',
                    message: 'Food analysis requires Cloudflare Workers AI. The AI binding is not configured.',
                    requestId
                }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
            }

            return jsonResponse({
                error: 'AI analysis failed',
                message: 'Food analysis is temporarily unavailable. Our AI models are currently under high load. Please try again in a moment.',
                details: aiError.message,
                // Provider-specific diagnostic chain. Together with
                // `details` (the auto-correction retry's last error) this
                // gives operators the full "who failed and how" picture
                // on a single curl, no log access required.
                //   primaryProviderError:  Gemini cascade failure (or
                //                          null if Gemini wasn't tried)
                //   fallbackProviderError: CF safety-net failure (or
                //                          null if CF wasn't tried OR
                //                          CF succeeded but later
                //                          validation rejected its JSON
                //                          — that case shows up in
                //                          `failedJson` instead)
                primaryProviderError,
                fallbackProviderError,
                failedJson: failedJsonText, // Send broken JSON to client debug panel
                requestId,
                durationMs: aiDurationMs
            }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }

        // ── Phase 8: Calculate Overall Score ──────────────────────
        currentPhase = 'SCORING';
        let scoreOverall = 0;
        if (scanMode === 'meal') {
            // Average scores across all dishes
            const dishes = (resultJson as any).dishes || [];
            if (dishes.length > 0) {
                const avgScores = dishes.reduce((acc: any, d: any) => {
                    const s = d.scores;
                    return {
                        bloodSugar: acc.bloodSugar + s.bloodSugar,
                        gutHealth: acc.gutHealth + s.gutHealth,
                        inflammation: acc.inflammation + s.inflammation,
                        nutrientDensity: acc.nutrientDensity + s.nutrientDensity,
                        processing: acc.processing + s.processing,
                        proteinQuality: acc.proteinQuality + s.proteinQuality,
                        micronutrient: acc.micronutrient + s.micronutrient,
                    };
                }, { bloodSugar: 0, gutHealth: 0, inflammation: 0, nutrientDensity: 0, processing: 0, proteinQuality: 0, micronutrient: 0 });
                const n = dishes.length;
                scoreOverall = Math.round(
                    (avgScores.bloodSugar / n + avgScores.gutHealth / n + avgScores.inflammation / n + avgScores.nutrientDensity / n + avgScores.processing / n + avgScores.proteinQuality / n + avgScores.micronutrient / n) / 7
                );
            }
        } else if (scanMode === 'drink_snack') {
            const s = (resultJson as any).scores;
            scoreOverall = Math.round(
                (s.bloodSugar + s.gutHealth + s.inflammation + s.nutrientDensity + s.processing + s.proteinQuality + s.micronutrient) / 7
            );
        } else if (scanMode === 'menu') {
            // Average health scores of menu items
            const items = (resultJson as any).menuItems || [];
            if (items.length > 0) {
                scoreOverall = Math.round(items.reduce((sum: number, i: any) => sum + (i.healthScore || 0), 0) / items.length);
            }
        }

        // ── Phase 9: Database Updates (FAULT-TOLERANT) ────────────
        currentPhase = 'DB_WRITE';
        if (db && activeUser) {
            // Deduct scan
            try {
                await db.update(users)
                    .set({ scansThisMonth: activeUser.scansThisMonth + 1 })
                    .where(eq(users.id, activeUser.id));
                logger.scanApiStage('SCAN_COUNT_UPDATED', { requestId, userId: activeUser.id.substring(0, 8) });
            } catch (updateErr: any) {
                logger.scanApiStage('SCAN_COUNT_UPDATE_ERROR', { requestId, error: updateErr.message });
            }

            // Log scan to history
            try {
                // Extract scores based on scan mode
                const dbScores = scanMode === 'meal'
                    ? ((resultJson as any).dishes?.[0]?.scores || {})
                    : scanMode === 'drink_snack'
                    ? ((resultJson as any).scores || {})
                    : {}; // menu mode doesn't have per-item scores in same format
                await db.insert(foodScans).values({
                    id: generateId(),
                    userId: activeUser.id,
                    imageUrl: null, // Don't store base64 in DB, would need R2/S3
                    detectedItems: scanMode === 'meal'
                        ? ((resultJson as any).dishes?.[0]?.detectedItems || [])
                        : scanMode === 'drink_snack'
                        ? [(resultJson as any).itemName || 'Unknown']
                        : ((resultJson as any).menuItems?.map((i: any) => i.name) || []),
                    nutritionSummary: scanMode === 'meal'
                        ? ((resultJson as any).dishes?.[0]?.nutritionSummary || {})
                        : ((resultJson as any).nutritionSummary || {}),
                    scoreBloodSugar: dbScores.bloodSugar || 0,
                    scoreGutHealth: dbScores.gutHealth || 0,
                    scoreInflammation: dbScores.inflammation || 0,
                    scoreNutrientDensity: dbScores.nutrientDensity || 0,
                    scoreProcessing: dbScores.processing || 0,
                    scoreProteinQuality: dbScores.proteinQuality || 0,
                    scoreMicronutrient: dbScores.micronutrient || 0,
                    scoreOverall,
                    createdAt: new Date()
                });
                logger.scanApiStage('DB_INSERT_SUCCESS', { requestId, userId: activeUser.id.substring(0, 8) });
            } catch (dbError: any) {
                logger.scanApiStage('DB_INSERT_FAILED', { requestId, error: dbError.message });
            }
        } else {
            logger.scanApiStage('DB_WRITE_SKIPPED', { requestId, reason: !db ? 'no_db' : 'no_user' });
        }

        // ── Phase 10: Return successful response ──────────────────
        currentPhase = 'RESPONSE';
        const currentTier = activeUser?.subscriptionTier as SubscriptionTier || 'free';
        const totalDurationMs = Date.now() - requestStartTime;
        logger.scanApiStage('RESPONSE_SENT', {
            requestId,
            scanMode,
            confidence: (resultJson as any).confidence,
            overallScore: scoreOverall,
            modelUsed,
            totalDurationMs,
            tier: currentTier
        });

        return jsonResponse({
            result: resultJson,
            scanMode,
            overallScore: scoreOverall,
            confidence: (resultJson as any).confidence || 0,
            modelUsed,
            limitReached: activeUser ? (activeUser.scansThisMonth + 1) >= (TIER_LIMITS[currentTier]?.scansPerMonth || 10) : false,
            requestId
        }, { status: 200, headers: { 'Cache-Control': 'no-store' } });

    } catch (error: any) {
        const totalDurationMs = Date.now() - requestStartTime;
        logger.scanApiStage('UNHANDLED_ERROR', {
            requestId,
            phase: currentPhase,
            error: error.message,
            errorName: error.name,
            stack: error.stack?.substring(0, 1000),
            totalDurationMs
        });
        return jsonResponse(
            {
                error: 'Internal server error',
                message: `Unexpected error in phase: ${currentPhase}`,
                details: error.message,
                phase: currentPhase,
                requestId
            },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}
