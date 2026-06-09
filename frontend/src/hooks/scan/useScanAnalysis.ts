import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { logger } from '@/lib/logger';
import { addScanToHistory, createThumbnail, type ScanHistoryDish } from '@/lib/scan-history';
import { stitchImagesToCanvas } from '@/lib/image-stitcher';
import { useAuthStore } from '@/lib/auth-store';
import { type ScanMode, type AiMultiDishResponse, type AiMenuResponse, type AiDrinkSnackResponse, type AiDishAnalysis } from '@/lib/ai-prompt';

const EMPTY_NUTRITION = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/**
 * Summarize a meal-mode result for the history list.
 *
 * - `foodName` is a label; for multi-dish meals we show "First + N more" so
 *   users can tell their multi-photo scan apart from a single-dish scan.
 * - `nutrition` is summed across all dishes (total plate calories).
 * - `spikeReduction` is averaged (matches the `MealOverview` header).
 * - `dishes` carries the per-dish breakdown so future UI can drill in.
 */
function summarizeMealForHistory(dishes: AiDishAnalysis[]): {
    foodName: string;
    spikeReduction: number;
    nutrition: typeof EMPTY_NUTRITION;
    dishes: ScanHistoryDish[];
} {
    if (dishes.length === 0) {
        return { foodName: 'Meal', spikeReduction: 0, nutrition: EMPTY_NUTRITION, dishes: [] };
    }

    const nutrition = dishes.reduce(
        (acc, d) => ({
            calories: acc.calories + (d.nutritionSummary?.calories || 0),
            protein: acc.protein + (d.nutritionSummary?.protein || 0),
            carbs: acc.carbs + (d.nutritionSummary?.carbs || 0),
            fat: acc.fat + (d.nutritionSummary?.fat || 0),
            fiber: acc.fiber + (d.nutritionSummary?.fiber || 0),
        }),
        { ...EMPTY_NUTRITION }
    );

    const spikeReduction = Math.round(
        dishes.reduce((sum, d) => sum + (d.spikeReduction || 0), 0) / dishes.length
    );

    const first = dishes[0]?.name || 'Meal';
    const foodName = dishes.length > 1 ? `${first} + ${dishes.length - 1} more` : first;

    const slimDishes: ScanHistoryDish[] = dishes.map(d => ({
        name: d.name,
        spikeReduction: d.spikeReduction || 0,
        nutrition: {
            calories: d.nutritionSummary?.calories || 0,
            protein: d.nutritionSummary?.protein || 0,
            carbs: d.nutritionSummary?.carbs || 0,
            fat: d.nutritionSummary?.fat || 0,
            fiber: d.nutritionSummary?.fiber || 0,
        },
    }));

    return { foodName, spikeReduction, nutrition, dishes: slimDishes };
}

const LOADING_PHASES_SINGLE = [
    { key: 'compressing', emoji: '📦', duration: 2000 },
    { key: 'analyzing', emoji: '🤖', duration: 8000 },
    { key: 'processing', emoji: '✨', duration: 5000 },
] as const;

const LOADING_PHASES_MULTI = [
    { key: 'stitching', emoji: '🧩', duration: 1500 },
    { key: 'compressing', emoji: '📦', duration: 1500 },
    { key: 'analyzing', emoji: '🤖', duration: 8000 },
    { key: 'processing', emoji: '✨', duration: 5000 },
] as const;

interface UseScanAnalysisProps {
    locale: string;
    tier: string;
    isDebugMode: boolean;
    setDebugData: (data: Record<string, any> | null) => void;
}

export function useScanAnalysis({ locale, tier, isDebugMode, setDebugData }: UseScanAnalysisProps) {
    const t = useTranslations('scan');

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
    const [nonFoodReason, setNonFoodReason] = useState<string | null>(null);
    const [modelUsed, setModelUsed] = useState<string | null>(null);
    const [overallScore, setOverallScore] = useState<number>(0);

    const [mealResult, setMealResult] = useState<AiMultiDishResponse | null>(null);
    const [menuResult, setMenuResult] = useState<AiMenuResponse | null>(null);
    const [drinkResult, setDrinkResult] = useState<AiDrinkSnackResponse | null>(null);

    const hasResult = mealResult || menuResult || drinkResult || nonFoodReason;

    function resetAnalysis() {
        setMealResult(null);
        setMenuResult(null);
        setDrinkResult(null);
        setOverallScore(0);
        setAnalysisError(null);
        setErrorRequestId(null);
        setLoadingPhase(0);
        setModelUsed(null);
        setNonFoodReason(null);
        setDebugData(null);
    }

    async function analyze(uploadedImages: string[], scanMode: ScanMode) {
        if (uploadedImages.length === 0) return;

        const scanStartTime = Date.now();
        logger.scanStart({ photoCount: uploadedImages.length, locale, tier });
        logger.info(`📋 Scan mode: ${scanMode}`);

        const LOADING_PHASES = uploadedImages.length > 1 ? LOADING_PHASES_MULTI : LOADING_PHASES_SINGLE;

        setIsAnalyzing(true);
        resetAnalysis();

        // Phased loading indicator
        const phaseTimers: ReturnType<typeof setTimeout>[] = [];
        let cumulative = 0;
        LOADING_PHASES.forEach((phase, i) => {
            cumulative += phase.duration;
            phaseTimers.push(setTimeout(() => setLoadingPhase(i + 1), cumulative));
        });

        const timings: Record<string, number> = {};

        try {
            // Compress and Stitch images
            setLoadingPhase(0);
            const compressStartTime = Date.now();
            let finalImageBase64: string;
            
            if (uploadedImages.length === 1) {
                // Single photo already compressed during upload
                finalImageBase64 = uploadedImages[0];
            } else {
                try {
                    finalImageBase64 = await stitchImagesToCanvas(uploadedImages);
                } catch (stitchErr) {
                    logger.error('🧩 Canvas stitching failed', stitchErr);
                    setAnalysisError(t('multi_photo.stitch_error'));
                    setIsAnalyzing(false);
                    phaseTimers.forEach(timer => clearTimeout(timer));
                    return;
                }
            }
            
            timings.compressMs = Date.now() - compressStartTime;
            logger.info(`📦 COMPRESS/STITCH TIMING | ${timings.compressMs}ms`);
            setLoadingPhase(1);

            const body = JSON.stringify({
                imageBase64: finalImageBase64,
                locale,
                scanMode,
                photoCount: uploadedImages.length,
            });
            logger.scanApiCall({ payloadSize: body.length, locale });

            // Client-side timeout MUST exceed the server's worst-case
            // budget — otherwise the abort fires before the cascade
            // finishes and the user sees a misleading "analysis taking
            // too long" message even when the server succeeded.
            //
            // Server budget (see /api/analyze): Gemini cascade 25s +
            // CF safety-net 20s = up to 45s end-to-end. Single-photo
            // scans typically finish in 7–10s so a tight 30s client
            // timeout never fired in practice. Multi-photo collages
            // run 18–25s baseline (larger payload + longer AI parse),
            // and when Gemini falls through to CF the total regularly
            // exceeds 30s — exactly the user-reported failure mode.
            //
            // Scale 30s base + 12s per additional photo, cap at 60s.
            // Caps:
            //   1 photo  →  30s   (unchanged from previous behaviour)
            //   2 photos →  42s   (covers Gemini → CF fall-through)
            //   3 photos →  54s   (worst observed multi-photo end-to-end)
            //   4+       →  60s   (clamp; CF Pages wall-clock allows it)
            const API_TIMEOUT_MS = Math.min(
                60_000,
                30_000 + Math.max(0, uploadedImages.length - 1) * 12_000,
            );
            async function callAnalyzeApi(attempt: number): Promise<{ res: Response; responseText: string; durationMs: number }> {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
                try {
                    const start = Date.now();
                    const res = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body,
                        signal: controller.signal
                    });
                    const responseText = await res.text();
                    const durationMs = Date.now() - start;
                    return { res, responseText, durationMs };
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            let { res, responseText, durationMs: apiDurationMs } = await callAnalyzeApi(1);
            logger.scanApiResponse({ status: res.status, durationMs: apiDurationMs, responseSize: responseText.length, ok: res.ok });
            timings.apiCallMs = apiDurationMs;

            if (res.status === 503) {
                logger.scanRetry({ attempt: 2, reason: 'API returned 503', requestId: undefined });
                await new Promise(r => setTimeout(r, 1500));
                const retry = await callAnalyzeApi(2);
                res = retry.res;
                responseText = retry.responseText;
                apiDurationMs += retry.durationMs;
                timings.retryMs = retry.durationMs;
                logger.scanApiResponse({ status: res.status, durationMs: retry.durationMs, responseSize: responseText.length, ok: res.ok });
            }

            if (!res.ok && !responseText.trim().startsWith('{')) {
                throw new Error(`Server error (${res.status}): ${res.statusText || 'Bad Gateway'}`);
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseErr: any) {
                logger.scanError('parse', parseErr, { responseSize: responseText.length, responsePreview: responseText.substring(0, 200) });
                throw new Error(t('error_message'));
            }

            if (!res.ok) {
                const errMsg = data.message || data.error || `Server error (${res.status})`;
                logger.scanError('api_response', new Error(errMsg), { status: res.status, apiError: data.error, details: data.details, requestId: data.requestId, phase: data.phase });
                if (data.requestId) setErrorRequestId(data.requestId);
                
                if (isDebugMode && data.failedJson) {
                     setDebugData({
                         timings,
                         modelUsed: data.modelUsed || 'unknown',
                         requestId: data.requestId,
                         confidence: 0,
                         scanMode: scanMode,
                         overallScore: 0,
                         rawResult: null,
                         failedJson: data.failedJson
                     });
                }
                throw new Error(errMsg);
            }

            setLoadingPhase(2);
            setModelUsed(data.modelUsed || null);
            setOverallScore(data.overallScore || 0);

            const resultScanMode = data.scanMode || scanMode;
            const resultData = data.result;

            if (resultData && resultData.isFood === false) {
                setNonFoodReason(resultData.nonFoodReason || t('error_message'));
            } 
            else if (resultScanMode === 'meal') {
                setMealResult(resultData as AiMultiDishResponse);
            } else if (resultScanMode === 'menu') {
                setMenuResult(resultData as AiMenuResponse);
            } else if (resultScanMode === 'drink_snack') {
                setDrinkResult(resultData as AiDrinkSnackResponse);
            }

            timings.totalMs = Date.now() - scanStartTime;
            logger.scanSuccess({
                foodName: resultScanMode === 'meal' ? (data.result.dishes?.[0]?.name || 'Meal') : resultScanMode === 'menu' ? 'Menu Scan' : (data.result.itemName || 'Drink/Snack'),
                confidence: data.confidence || 0,
                overallScore: data.overallScore,
                durationMs: timings.totalMs
            });

            if (isDebugMode) {
                setDebugData({
                    timings,
                    modelUsed: data.modelUsed,
                    requestId: data.requestId,
                    confidence: data.confidence,
                    scanMode: resultScanMode,
                    overallScore: data.overallScore,
                    rawResult: data.result,
                    failedJson: null
                });
            }

            try {
                // For multi-photo scans use the stitched collage as the
                // thumbnail so the user can see all photos they uploaded.
                // For single-photo scans use the one photo directly — no
                // collage was created and finalImageBase64 just equals it.
                const thumbnailBase64 =
                    uploadedImages.length > 1 ? finalImageBase64 : (uploadedImages[0] || finalImageBase64);
                const thumbnail = thumbnailBase64 ? await createThumbnail(thumbnailBase64) : undefined;

                // Mode-specific summary. For meals we aggregate across all
                // dishes and carry the per-dish breakdown; for menu / drink
                // we use the single-item shape the schema already provides.
                let foodName: string;
                let spikeReduction: number;
                let nutrition = { ...EMPTY_NUTRITION };
                let dishes: ScanHistoryDish[] | undefined;

                if (resultScanMode === 'meal') {
                    const summary = summarizeMealForHistory(data.result.dishes || []);
                    foodName = summary.foodName;
                    spikeReduction = summary.spikeReduction;
                    nutrition = summary.nutrition;
                    dishes = summary.dishes;
                } else if (resultScanMode === 'menu') {
                    foodName = 'Menu Scan';
                    spikeReduction = 0;
                } else {
                    foodName = data.result.itemName || 'Drink/Snack';
                    spikeReduction = 0;
                    nutrition = data.result.nutritionSummary || { ...EMPTY_NUTRITION };
                }

                addScanToHistory({
                    foodName,
                    confidence: data.confidence || 0,
                    overallScore: data.overallScore,
                    spikeReduction,
                    modelUsed: data.modelUsed || 'unknown',
                    tip: resultScanMode === 'meal' ? data.result.overallTip : data.result.tip,
                    thumbnail,
                    nutrition,
                    dishes,
                    debug: isDebugMode ? { requestId: data.requestId, timings } : undefined,
                });
                logger.debug('📝 Scan saved to client history');
            } catch (historyErr) {
                logger.debug('Failed to save scan history', historyErr);
            }

            useAuthStore.getState().initAuth();
        } catch (err: any) {
            if (err.name === 'AbortError') {
                logger.scanError('complete', err, { locale, tier, totalDurationMs: Date.now() - scanStartTime, reason: 'timeout' });
                setAnalysisError(t('timeout_message'));
            } else {
                logger.scanError('complete', err, { locale, tier, totalDurationMs: Date.now() - scanStartTime });
                setAnalysisError(err.message || t('error_message'));
            }
        } finally {
            setIsAnalyzing(false);
            phaseTimers.forEach(timer => clearTimeout(timer));
        }
    }

    return {
        analyze,
        resetAnalysis,
        isAnalyzing,
        loadingPhase,
        analysisError,
        errorRequestId,
        nonFoodReason,
        modelUsed,
        overallScore,
        mealResult,
        menuResult,
        drinkResult,
        hasResult,
        setNonFoodReason // To clear it if needed
    };
}
