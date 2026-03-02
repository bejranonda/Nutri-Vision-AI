import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users, foodScans } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/crypto';
import { sessions } from '@/db/schema';
import { TIER_LIMITS, SubscriptionTier } from '@/lib/tier-config';
import { logger } from '@/lib/logger';
import { getCloudflareContext } from '@opennextjs/cloudflare';


const AI_PROMPT = `You are a food identification and nutrition expert. Analyze this image carefully.

CRITICAL RULES:
1. FIRST identify what is actually in the image. Do NOT assume it is a prepared dish.
2. The image may contain: raw fruits, raw vegetables, whole ingredients, snacks, prepared meals, beverages, or non-food items.
3. Only list ingredients/items that are ACTUALLY VISIBLE in the image. Do NOT hallucinate items that are not there.
4. If the image shows a single raw fruit or vegetable, identify it as such (e.g., "Pineapple", "Banana", "Mango").
5. If the image shows MULTIPLE items, list ALL of them separately (e.g., "Pineapple" and "Artichokes").
6. If the image does NOT contain food, set isFood to false.
7. Estimate nutrition per typical serving size visible in the image.
8. Set confidence 0-100 based on how clearly you can identify the food. If uncertain, use a LOW confidence score.

Respond ONLY with a valid JSON object (no markdown, no explanation, no code fences) matching this schema:
{"isFood":true,"foodName":"Name of the dish or ingredient","foodCategory":"fruit|vegetable|prepared_dish|snack|beverage|dessert|other","detectedItems":["🍍 Item 1","🥕 Item 2"],"nutritionSummary":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0},"scores":{"bloodSugar":0,"gutHealth":0,"inflammation":0,"nutrientDensity":0,"processing":0,"proteinQuality":0,"micronutrient":0},"sequence":["1. Fiber/Veggies first","2. Protein/Fat","3. Carbs","4. Sweets"],"tip":"One short helpful tip.","confidence":0}`;

const LOCALE_INSTRUCTION: Record<string, string> = {
    th: '\n\nIMPORTANT: Respond with ALL text values (foodName, detectedItems, sequence, tip) in Thai language (ภาษาไทย). Use Thai food names when applicable.',
    en: '\n\nIMPORTANT: Respond with ALL text values in English.'
};

/** Validate and sanitize AI response — prevents frontend crashes from malformed model output */
function validateAiResponse(raw: any): any {
    const safeScores = {
        bloodSugar: Math.min(100, Math.max(0, Number(raw?.scores?.bloodSugar) || 50)),
        gutHealth: Math.min(100, Math.max(0, Number(raw?.scores?.gutHealth) || 50)),
        inflammation: Math.min(100, Math.max(0, Number(raw?.scores?.inflammation) || 50)),
        nutrientDensity: Math.min(100, Math.max(0, Number(raw?.scores?.nutrientDensity) || 50)),
        processing: Math.min(100, Math.max(0, Number(raw?.scores?.processing) || 50)),
        proteinQuality: Math.min(100, Math.max(0, Number(raw?.scores?.proteinQuality) || 50)),
        micronutrient: Math.min(100, Math.max(0, Number(raw?.scores?.micronutrient) || 50)),
    };

    return {
        isFood: raw?.isFood !== false,
        foodName: String(raw?.foodName || 'Unknown Food'),
        foodCategory: String(raw?.foodCategory || 'other'),
        detectedItems: Array.isArray(raw?.detectedItems) ? raw.detectedItems.map(String) : ['Unknown'],
        nutritionSummary: {
            calories: Number(raw?.nutritionSummary?.calories) || 0,
            protein: Number(raw?.nutritionSummary?.protein) || 0,
            carbs: Number(raw?.nutritionSummary?.carbs) || 0,
            fat: Number(raw?.nutritionSummary?.fat) || 0,
            fiber: Number(raw?.nutritionSummary?.fiber) || 0,
        },
        scores: safeScores,
        sequence: Array.isArray(raw?.sequence) ? raw.sequence.map(String) : ['1. Eat vegetables first', '2. Protein', '3. Carbs', '4. Sweets last'],
        tip: String(raw?.tip || ''),
        confidence: Math.min(100, Math.max(0, Number(raw?.confidence) || 0)),
    };
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
        let imageBase64: string;
        let locale: string;

        try {
            const body = await req.json();
            imageBase64 = body.imageBase64;
            locale = body.locale || 'th';
        } catch (parseErr: any) {
            logger.scanApiStage('BODY_PARSE_ERROR', { requestId, error: parseErr.message });
            return NextResponse.json(
                { error: 'Invalid request body', message: 'Could not parse request JSON', requestId },
                { status: 400 }
            );
        }

        const payloadSize = imageBase64 ? imageBase64.length : 0;
        logger.scanApiStage('REQUEST_RECEIVED', { requestId, locale, payloadSizeKB: (payloadSize / 1024).toFixed(1), hasImage: !!imageBase64 });

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
        let env: any;
        try {
            const cfContext = await getCloudflareContext();
            env = cfContext.env;
            logger.scanApiStage('CF_CONTEXT_OK', { requestId, hasEnv: !!env });
        } catch (cfErr: any) {
            logger.scanApiStage('CF_CONTEXT_FALLBACK', { requestId, error: cfErr.message });
            env = process.env;
        }
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
                const activeSessions = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
                if (activeSessions.length > 0) {
                    userId = activeSessions[0].userId!;
                    const foundUsers = await db.select().from(users).where(eq(users.id, userId!)).limit(1);
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

        try {
            logger.scanApiStage('AI_BINDING_CHECK', { requestId, hasAI: !!env.AI });

            if (env.AI) {
                // Use Llama 3.2 11B Vision — much stronger multimodal model
                const localizedPrompt = AI_PROMPT + (LOCALE_INSTRUCTION[locale] || LOCALE_INSTRUCTION.en);
                const aiStartTime = Date.now();

                logger.scanApiStage('AI_INFERENCE_START', { requestId, model: '@cf/meta/llama-3.2-11b-vision-instruct', locale });

                // Decode base64 to byte array for the AI model (edge-safe — no Buffer dependency)
                let imageBytes: number[];
                try {
                    const base64Data = imageBase64.split(',')[1];
                    // Use atob + Uint8Array instead of Buffer.from for edge runtime compatibility
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    imageBytes = Array.from(bytes);
                    logger.scanApiStage('IMAGE_DECODED', { requestId, byteCount: imageBytes.length });
                } catch (decodeErr: any) {
                    logger.scanApiStage('IMAGE_DECODE_ERROR', { requestId, error: decodeErr.message });
                    return NextResponse.json(
                        { error: 'Image decode failed', message: 'Could not decode the image data', requestId },
                        { status: 400 }
                    );
                }

                // AI inference with server-side timeout (25s) — prevents Worker execution limit hang
                const AI_SERVER_TIMEOUT_MS = 25_000;
                const aiPromise = env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
                    prompt: localizedPrompt,
                    image: [imageBytes]
                });
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('AI inference timed out after 25 seconds')), AI_SERVER_TIMEOUT_MS)
                );
                const response = await Promise.race([aiPromise, timeoutPromise]) as any;
                const aiDurationMs = Date.now() - aiStartTime;

                // Parse AI response into JSON
                const rawResponse = response?.response || '{}';
                logger.scanApiStage('AI_INFERENCE_COMPLETE', {
                    requestId,
                    durationMs: aiDurationMs,
                    rawResponseLength: rawResponse.length,
                    rawResponsePreview: rawResponse.substring(0, 500)
                });

                // Try to extract JSON from the response (AI sometimes wraps in markdown)
                let parsedJson;
                try {
                    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
                    parsedJson = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
                } catch (jsonErr: any) {
                    logger.scanApiStage('AI_JSON_PARSE_ERROR', {
                        requestId,
                        error: jsonErr.message,
                        rawResponse: rawResponse.substring(0, 500)
                    });
                    return NextResponse.json({
                        error: 'AI response parse failed',
                        message: 'The AI returned a response that could not be parsed as JSON. Please try again.',
                        details: rawResponse.substring(0, 200),
                        requestId
                    }, { status: 502 });
                }

                // Validate and sanitize — prevents frontend crashes from malformed AI output
                resultJson = validateAiResponse(parsedJson);
                logger.scanApiStage('AI_VALIDATED', {
                    requestId,
                    foodName: resultJson.foodName,
                    confidence: resultJson.confidence,
                    isFood: resultJson.isFood,
                    category: resultJson.foodCategory,
                    detectedItemCount: resultJson.detectedItems.length
                });

                // Validate: if AI says it's not food, return early
                if (resultJson.isFood === false) {
                    logger.scanApiStage('NOT_FOOD', { requestId, confidence: resultJson.confidence });
                    return NextResponse.json({
                        error: 'Not food',
                        message: 'The image does not appear to contain food. Please upload a photo of food.',
                        confidence: resultJson.confidence || 0,
                        requestId
                    }, { status: 422 });
                }
            } else {
                logger.scanApiStage('AI_BINDING_MISSING', { requestId, message: 'env.AI is not available — deploy to Cloudflare Workers to enable AI' });
                return NextResponse.json({
                    error: 'AI not available',
                    message: 'Food analysis requires Cloudflare Workers AI. The AI binding is not configured.',
                    requestId
                }, { status: 503 });
            }
        } catch (aiError: any) {
            logger.scanApiStage('AI_FAILED', {
                requestId,
                error: aiError.message,
                errorName: aiError.name,
                stack: aiError.stack?.substring(0, 500),
                durationMs: Date.now() - requestStartTime
            });

            // Return honest error instead of crashing
            return NextResponse.json({
                error: 'AI analysis failed',
                message: 'Food analysis is temporarily unavailable. Please try again later.',
                details: aiError.message,
                requestId
            }, { status: 503 });
        }

        // ── Phase 8: Calculate Overall Score ──────────────────────
        currentPhase = 'SCORING';
        const s = resultJson.scores;
        const scoreOverall = Math.round(
            (s.bloodSugar + s.gutHealth + s.inflammation + s.nutrientDensity + s.processing + s.proteinQuality + s.micronutrient) / 7
        );

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
                await db.insert(foodScans).values({
                    id: generateId(),
                    userId: activeUser.id,
                    imageUrl: null, // Don't store base64 in DB, would need R2/S3
                    detectedItems: resultJson.detectedItems,
                    nutritionSummary: resultJson.nutritionSummary,
                    scoreBloodSugar: s.bloodSugar,
                    scoreGutHealth: s.gutHealth,
                    scoreInflammation: s.inflammation,
                    scoreNutrientDensity: s.nutrientDensity,
                    scoreProcessing: s.processing,
                    scoreProteinQuality: s.proteinQuality,
                    scoreMicronutrient: s.micronutrient,
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
            foodName: resultJson.foodName,
            confidence: resultJson.confidence,
            overallScore: scoreOverall,
            totalDurationMs,
            tier: currentTier
        });

        return NextResponse.json({
            result: resultJson,
            overallScore: scoreOverall,
            confidence: resultJson.confidence || 0,
            limitReached: activeUser ? (activeUser.scansThisMonth + 1) >= (TIER_LIMITS[currentTier]?.scansPerMonth || 10) : false,
            requestId
        }, { status: 200 });

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
            { status: 500 }
        );
    }
}
