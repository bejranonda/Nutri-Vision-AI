import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users, foodScans } from '@/db/schema';
import { getSessionToken } from '@/lib/session';
import { eq, and, gt } from 'drizzle-orm';
import { generateId } from '@/lib/crypto';
import { sessions } from '@/db/schema';
import { TIER_LIMITS, SubscriptionTier } from '@/lib/tier-config';
import { logger } from '@/lib/logger';


const AI_PROMPT = `You are a food identification and nutrition expert. Analyze this image carefully.

CRITICAL RULES:
1. FIRST identify what is actually in the image. Do NOT assume it is a prepared dish.
2. The image may contain: raw fruits, raw vegetables, whole ingredients, snacks, prepared meals, beverages, or non-food items.
3. Only list ingredients/items that are ACTUALLY VISIBLE in the image. Do NOT hallucinate items that are not there.
4. If the image shows a single raw fruit or vegetable, identify it as such (e.g., "Pineapple", "Banana", "Mango").
5. If the image does NOT contain food, set isFood to false.
6. Estimate nutrition per typical serving size visible in the image.

Respond ONLY with a valid JSON object (no markdown, no explanation) matching this schema:
{"isFood":true,"foodName":"Name of the dish or ingredient","foodCategory":"fruit|vegetable|prepared_dish|snack|beverage|dessert|other","detectedItems":["🍍 Item 1","🥕 Item 2"],"nutritionSummary":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0},"scores":{"bloodSugar":0,"gutHealth":0,"inflammation":0,"nutrientDensity":0,"processing":0,"proteinQuality":0,"micronutrient":0},"sequence":["1. Fiber/Veggies first","2. Protein/Fat","3. Carbs","4. Sweets"],"tip":"One short helpful tip.","confidence":0}

Set confidence 0-100 based on how clearly you can identify the food. If uncertain, use a LOW confidence score.`;

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

export async function POST(req: NextRequest) {
    const requestStartTime = Date.now();
    try {
        const { imageBase64, locale = 'th' } = await req.json();
        const payloadSize = imageBase64 ? imageBase64.length : 0;
        logger.scanApiStage('REQUEST_RECEIVED', { locale, payloadSizeKB: (payloadSize / 1024).toFixed(1), hasImage: !!imageBase64 });

        if (!imageBase64) {
            logger.scanApiStage('VALIDATION_FAILED', { reason: 'no_image' });
            return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
        }

        const token = await getSessionToken();
        const env = (req as any).context?.env || process.env;
        const db = getDb(env);

        let userId: string | null = null;
        let activeUser: any = null;

        // 1. Auth & Rate Limiting Verification
        if (token) {
            const activeSessions = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
            if (activeSessions.length > 0) {
                userId = activeSessions[0].userId!;
                const foundUsers = await db.select().from(users).where(eq(users.id, userId)).limit(1);
                activeUser = foundUsers[0];
            }
        }
        logger.scanApiStage('AUTH_CHECK', { hasToken: !!token, hasUser: !!activeUser, userId: userId?.substring(0, 8), tier: activeUser?.subscriptionTier });

        if (activeUser) {
            // Rate Limit Check
            const tierStr = activeUser.subscriptionTier as SubscriptionTier;
            const tierConfig = TIER_LIMITS[tierStr] || TIER_LIMITS.free;

            if (tierConfig.scansPerMonth !== Infinity && activeUser.scansThisMonth >= tierConfig.scansPerMonth) {
                logger.scanApiStage('RATE_LIMITED', { tier: tierStr, used: activeUser.scansThisMonth, limit: tierConfig.scansPerMonth });
                return NextResponse.json({
                    error: 'Scan limit reached',
                    message: 'You have exhausted your free scans for this month. Please upgrade to continue.'
                }, { status: 403 });
            }
        }

        // 2. AI Inference
        let resultJson;

        try {
            logger.scanApiStage('AI_BINDING_CHECK', { hasAI: !!env.AI, envKeys: Object.keys(env).filter(k => !k.includes('TOKEN') && !k.includes('SECRET')).join(',') });

            if (env.AI) {
                // Use Llama 3.2 11B Vision — much stronger multimodal model than LLaVA 1.5 7B
                const localizedPrompt = AI_PROMPT + (LOCALE_INSTRUCTION[locale] || LOCALE_INSTRUCTION.en);
                const aiStartTime = Date.now();

                logger.scanApiStage('AI_INFERENCE_START', { model: '@cf/meta/llama-3.2-11b-vision-instruct', locale });
                const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
                    prompt: localizedPrompt,
                    image: [Array.from(Buffer.from(imageBase64.split(',')[1], 'base64'))]
                });
                const aiDurationMs = Date.now() - aiStartTime;

                // Parse AI response into JSON
                const rawResponse = response?.response || '{}';
                logger.scanApiStage('AI_INFERENCE_COMPLETE', { durationMs: aiDurationMs, rawResponseLength: rawResponse.length, rawResponsePreview: rawResponse.substring(0, 300) });

                const jsonMatch = rawResponse.match(/\{[\s\S]*\}/); // Extract JSON block if AI adds text
                resultJson = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);

                // Validate and sanitize — prevents frontend crashes from malformed AI output
                resultJson = validateAiResponse(resultJson);
                logger.scanApiStage('AI_VALIDATED', { foodName: resultJson.foodName, confidence: resultJson.confidence, isFood: resultJson.isFood, category: resultJson.foodCategory });

                // Validate: if AI says it's not food, return early
                if (resultJson.isFood === false) {
                    logger.scanApiStage('NOT_FOOD', { confidence: resultJson.confidence });
                    return NextResponse.json({
                        error: 'Not food',
                        message: 'The image does not appear to contain food. Please upload a photo of food.',
                        confidence: resultJson.confidence || 0
                    }, { status: 422 });
                }
            } else {
                logger.scanApiStage('AI_BINDING_MISSING', { message: 'env.AI is not available — deploy to Cloudflare Workers to enable AI' });
                throw new Error("AI Binding not available. Deploy to Cloudflare Workers to enable AI analysis.");
            }
        } catch (aiError: any) {
            logger.scanApiStage('AI_FAILED', { error: aiError.message, stack: aiError.stack?.substring(0, 500), durationMs: Date.now() - requestStartTime });

            // Return honest error instead of fake mock data
            return NextResponse.json({
                error: 'AI analysis failed',
                message: 'Food analysis is temporarily unavailable. This feature requires Cloudflare Workers AI. Please try again later.',
                details: aiError.message
            }, { status: 503 });
        }

        // Calculate Overall Score (Average of all 7)
        const s = resultJson.scores;
        const scoreOverall = Math.round(
            (s.bloodSugar + s.gutHealth + s.inflammation + s.nutrientDensity + s.processing + s.proteinQuality + s.micronutrient) / 7
        );

        // 3. Database Updates
        if (activeUser) {
            // Deduct scan
            await db.update(users)
                .set({ scansThisMonth: activeUser.scansThisMonth + 1 })
                .where(eq(users.id, activeUser.id));

            // Log scan
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
                logger.scanApiStage('DB_INSERT_SUCCESS', { userId: activeUser.id.substring(0, 8) });
            } catch (dbError: any) {
                logger.scanApiStage('DB_INSERT_FAILED', { error: dbError.message, userId: activeUser.id.substring(0, 8) });
            }
        }

        const currentTier = activeUser?.subscriptionTier as SubscriptionTier || 'free';
        const totalDurationMs = Date.now() - requestStartTime;
        logger.scanApiStage('RESPONSE_SENT', {
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
            limitReached: activeUser ? (activeUser.scansThisMonth + 1) >= (TIER_LIMITS[currentTier]?.scansPerMonth || 10) : false
        }, { status: 200 });

    } catch (error: any) {
        const totalDurationMs = Date.now() - requestStartTime;
        logger.scanApiStage('UNHANDLED_ERROR', { error: error.message, stack: error.stack?.substring(0, 500), totalDurationMs });
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

