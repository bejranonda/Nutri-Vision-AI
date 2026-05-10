import { NextRequest, NextResponse } from 'next/server';
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
            return NextResponse.json({ ...failure, requestId }, { status: 400 });
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
            return NextResponse.json({ error: 'Image data is required', requestId }, { status: 400 });
        }

        // ── Phase 2: Validate image format ────────────────────────
        currentPhase = 'VALIDATE_IMAGE';
        const imageValidation = validateImageBase64(imageBase64);
        if (!imageValidation.valid) {
            logger.scanApiStage('IMAGE_VALIDATION_FAILED', { requestId, error: imageValidation.error });
            return NextResponse.json(
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
                return NextResponse.json({
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

            // Decode base64 to byte array — Edge-safe using shared utility
            const base64Data = extractBase64Data(imageBase64);
            const bytes = decodeBase64ToBytes(base64Data);

            const aiPromise = env.AI.run(model, {
                prompt: localizedPrompt,
                image: [bytes]
            });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`AI inference timed out after ${timeoutMs/1000} seconds`)), timeoutMs)
            );
            
            logger.scanApiStage('AI_AWAITING_RESPONSE', { requestId, model, timeoutMs });
            const response = await Promise.race([aiPromise, timeoutPromise]) as any;
            
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
            // Vision-capable Google model. Earlier we used `gemma-3-27b-it`;
            // free-tier availability of Gemma multimodal turned out to be
            // inconsistent in production, and a CF-primary outage left the
            // route with no working vision fallback — surfacing as 503
            // "Food analysis is temporarily unavailable" even though the
            // user's Gemini key was set. Gemini 1.5 Flash:
            //   - Free tier 1500 req/day (more than CF Workers AI's 10k
            //     neuron budget converts to in scan calls).
            //   - Multimodal (text + image inline_data, same payload shape).
            //   - Same `gemini-1.5-flash-latest` model the chat endpoint
            //     uses; one source of truth for "what's our reliable free
            //     Gemini model".
            const model = 'gemini-1.5-flash-latest';
            const aiStartTime = Date.now();
            const localizedPrompt = buildLocalizedPrompt(locale, scanMode, photoCount);

            logger.scanApiStage('AI_GOOGLE_START', { requestId, model, locale });

            const base64Data = extractBase64Data(imageBase64);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Google API error: ${response.status} ${errorText}`);
                }

                const data = await response.json() as any;
                const rawResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
                
                logger.scanApiStage('AI_GOOGLE_COMPLETE', {
                    requestId,
                    durationMs: Date.now() - aiStartTime,
                    rawResponseLength: rawResponse.length
                });

                try {
                    const { parsed, error } = safeParseJson(rawResponse);
                    if (error) throw error;
                    return { parsedJson: parsed, rawResponse };
                } catch (parseErr: any) {
                    logger.error(`❌ AI PARSE FAIL [google] [${requestId}]`, {
                        error: parseErr.message,
                        rawPreview: rawResponse.substring(0, 500),
                        rawLength: rawResponse.length,
                        model,
                    });
                    return { error: parseErr, rawResponse };
                }
            } catch (err: any) {
                clearTimeout(timeoutId);
                throw err;
            }
        };

        let failedJsonText = '';

        try {
            const googleKey = env.GOOGLE_AI_API_KEY;
            let lastError: any = null;

            // Helper to run inference + validation with an optional correction prompt
            const runInferenceWithValidation = async (correctionPrompt?: string) => {
                let aiResult: any;
                let usedModel = '';
                
                // Attempt Cloudflare first, fallback to Google
                try {
                    if (!env.AI) throw new Error('AI_BINDING_MISSING');
                    aiResult = await attemptAiInference('@cf/meta/llama-3.2-11b-vision-instruct', 25000);
                    usedModel = 'cloudflare-llama-3.2-11b';
                } catch (cfErr: any) {
                    if (googleKey) {
                        logger.info(`🔄 SCAN FALLBACK [${requestId}] | Primary failed (${cfErr.message}), trying Google...`);
                        aiResult = await attemptGoogleInference(googleKey, 20000);
                        usedModel = 'google-gemini-1.5-flash';
                    } else {
                        throw cfErr;
                    }
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
                // Attempt 1
                const res = await runInferenceWithValidation();
                resultJson = res.data;
                modelUsed = res.model;
            } catch (err: any) {
                lastError = err;
                logger.warn(`⚠️ AI VALIDATION/PARSE FAILED (Attempt 1) [${requestId}] | Error: ${err.message}. Retrying with fallback provider...`);
                
                // Attempt 2: Prefer Google fallback on retry for provider diversity
                try {
                    let res2;
                    if (googleKey) {
                        // On retry, try Google directly for provider diversity
                        const aiResult = await attemptGoogleInference(googleKey, 25000);
                        if (aiResult.error) throw new Error(`JSON Parse Error: ${aiResult.error.message}`);
                        let validatedData;
                        if (scanMode === 'meal') validatedData = validateMultiDishResponse(aiResult.parsedJson);
                        else if (scanMode === 'menu') validatedData = validateMenuResponse(aiResult.parsedJson);
                        else validatedData = validateDrinkSnackResponse(aiResult.parsedJson);
                        res2 = { data: validatedData, model: 'google-gemini-1.5-flash' };
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

            if (aiError.message === 'AI_BINDING_MISSING') {
                return NextResponse.json({
                    error: 'AI not available',
                    message: 'Food analysis requires Cloudflare Workers AI. The AI binding is not configured.',
                    requestId
                }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
            }

            return NextResponse.json({
                error: 'AI analysis failed',
                message: 'Food analysis is temporarily unavailable. Our AI models are currently under high load. Please try again in a moment.',
                details: aiError.message,
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

        return NextResponse.json({
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
        return NextResponse.json(
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
