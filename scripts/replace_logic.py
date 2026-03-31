import sys
import os

FILE_PATH = "frontend/src/app/[locale]/scan/page.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Replace Imports
import_old = """import { FREE_SCORE_DIMENSIONS, ALL_SCORE_DIMENSIONS, TIER_LIMITS } from '@/lib/tier-config';
import { logger } from '@/lib/logger';
import { type ScanMode, type AiMultiDishResponse, type AiMenuResponse, type AiDrinkSnackResponse } from '@/lib/ai-prompt';
import { addScanToHistory, createThumbnail } from '@/lib/scan-history';
import LanguageSwitcher from '@/components/LanguageSwitcher';"""

import_new = """import { FREE_SCORE_DIMENSIONS, ALL_SCORE_DIMENSIONS, TIER_LIMITS, canAddMorePhotos } from '@/lib/tier-config';
import { logger } from '@/lib/logger';
import { type ScanMode, type AiMultiDishResponse, type AiMenuResponse, type AiDrinkSnackResponse } from '@/lib/ai-prompt';
import { addScanToHistory, createThumbnail } from '@/lib/scan-history';
import { stitchImagesToCanvas } from '@/lib/image-stitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';"""
content = content.replace(import_old, import_new)

# Replace State
state_old = """    // Core scan state
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);"""

state_new = """    // Core scan state
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);"""
content = content.replace(state_old, state_new)

# Replace handleImageUpload logic up to handleDrop
logic_old = """
    async function handleImageUpload(file: File) {
        if (!file.type.startsWith('image/')) {
            logger.warn('🚫 SCAN REJECTED | Not an image file', { type: file.type, name: file.name });
            setErrorMessage(t('error_message'));
            return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            logger.warn('🚫 SCAN REJECTED | Unsupported image type', { type: file.type });
            setErrorMessage(`Unsupported image format: ${file.type}`);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            logger.warn('🚫 SCAN REJECTED | File too large', { sizeMB: (file.size / 1024 / 1024).toFixed(1) });
            setErrorMessage(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 15MB.`);
            return;
        }
        if (file.size < MIN_FILE_SIZE) {
            logger.warn('🚫 SCAN REJECTED | File too small', { size: file.size });
            setErrorMessage(t('error_message'));
            return;
        }

        const scanStartTime = Date.now();
        logger.scanStart({ fileSize: file.size, fileType: file.type, locale, tier });
        logger.info(`📋 Scan mode: ${scanMode}`);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const rawBase64 = e.target?.result as string;
            setUploadedImage(rawBase64);
            setIsAnalyzing(true);
            setMealResult(null);
            setMenuResult(null);
            setDrinkResult(null);
            setOverallScore(0);
            setErrorMessage(null);
            setErrorRequestId(null);
            setLoadingPhase(0);
            setModelUsed(null);
            setDebugData(null);
            setDebugOpen(false);
            setNonFoodReason(null);

            // Phased loading indicator
            const phaseTimers: ReturnType<typeof setTimeout>[] = [];
            let cumulative = 0;
            LOADING_PHASES.forEach((phase, i) => {
                cumulative += phase.duration;
                phaseTimers.push(setTimeout(() => setLoadingPhase(i + 1), cumulative));
            });

            const timings: Record<string, number> = {};

            try {
                // Compress image
                setLoadingPhase(0);
                const compressStartTime = Date.now();
                const compressedBase64 = await compressImage(rawBase64);
                timings.compressMs = Date.now() - compressStartTime;
                logger.scanCompressed({ originalSize: rawBase64.length, compressedSize: compressedBase64.length });
                logger.info(`📦 COMPRESS TIMING | ${timings.compressMs}ms | ${(rawBase64.length / 1024).toFixed(0)}KB → ${(compressedBase64.length / 1024).toFixed(0)}KB`);
                setLoadingPhase(1);

                const body = JSON.stringify({ imageBase64: compressedBase64, locale, scanMode });
                logger.scanApiCall({ payloadSize: body.length, locale });

                // API call with timeout
                const API_TIMEOUT_MS = 30_000;
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

                // First attempt
                let { res, responseText, durationMs: apiDurationMs } = await callAnalyzeApi(1);
                logger.scanApiResponse({ status: res.status, durationMs: apiDurationMs, responseSize: responseText.length, ok: res.ok });
                timings.apiCallMs = apiDurationMs;

                // Retry on 503
                if (res.status === 503) {
                    logger.scanRetry({ attempt: 2, reason: 'API returned 503', requestId: undefined });
                    const retry = await callAnalyzeApi(2);
                    res = retry.res;
                    responseText = retry.responseText;
                    apiDurationMs += retry.durationMs;
                    timings.retryMs = retry.durationMs;
                    logger.scanApiResponse({ status: res.status, durationMs: retry.durationMs, responseSize: responseText.length, ok: res.ok });
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

                // Route results to mode-specific state
                const resultScanMode = data.scanMode || scanMode;
                const resultData = data.result;

                // 1. Check if AI explicitly rejected it as "not food"
                if (resultData && resultData.isFood === false) {
                    setNonFoodReason(resultData.nonFoodReason || t('error_message'));
                } 
                // 2. Otherwise route to the correct UI component
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

                // Debug panel data
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

                // Save to client-side history
                try {
                    const thumbnail = rawBase64 ? await createThumbnail(rawBase64) : undefined;
                    addScanToHistory({
                        foodName: resultScanMode === 'meal' ? (data.result.dishes?.[0]?.name || 'Meal')
                            : resultScanMode === 'menu' ? 'Menu Scan'
                            : (data.result.itemName || 'Drink/Snack'),
                        confidence: data.confidence || 0,
                        overallScore: data.overallScore,
                        spikeReduction: resultScanMode === 'meal' ? (data.result.dishes?.[0]?.spikeReduction || 0) : 0,
                        modelUsed: data.modelUsed || 'unknown',
                        tip: resultScanMode === 'meal' ? data.result.overallTip : data.result.tip,
                        thumbnail,
                        nutrition: resultScanMode === 'meal'
                            ? (data.result.dishes?.[0]?.nutritionSummary || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
                            : (data.result.nutritionSummary || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }),
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
                    setErrorMessage(t('timeout_message'));
                } else {
                    logger.scanError('complete', err, { locale, tier, totalDurationMs: Date.now() - scanStartTime });
                    setErrorMessage(err.message || t('error_message'));
                }
            } finally {
                setIsAnalyzing(false);
                phaseTimers.forEach(t => clearTimeout(t));
            }
        };
        reader.readAsDataURL(file);
    }

    function handleDrop(e: React.DragEvent) {"""

logic_new = """
    async function handleImageUpload(file: File) {
        if (!file.type.startsWith('image/')) {
            logger.warn('🚫 SCAN REJECTED | Not an image file', { type: file.type, name: file.name });
            setErrorMessage(t('error_message'));
            return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            logger.warn('🚫 SCAN REJECTED | Unsupported image type', { type: file.type });
            setErrorMessage(`Unsupported image format: ${file.type}`);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            logger.warn('🚫 SCAN REJECTED | File too large', { sizeMB: (file.size / 1024 / 1024).toFixed(1) });
            setErrorMessage(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 15MB.`);
            return;
        }
        if (file.size < MIN_FILE_SIZE) {
            logger.warn('🚫 SCAN REJECTED | File too small', { size: file.size });
            setErrorMessage(t('error_message'));
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const rawBase64 = e.target?.result as string;
            
            if (hasResult || nonFoodReason) {
                setMealResult(null);
                setMenuResult(null);
                setDrinkResult(null);
                setOverallScore(0);
                setNonFoodReason(null);
                setUploadedImages([rawBase64]);
            } else {
                setUploadedImages(prev => [...prev, rawBase64]);
            }
            
            setErrorMessage(null);
            setErrorRequestId(null);
            setLoadingPhase(0);
            setModelUsed(null);
            setDebugData(null);
            setDebugOpen(false);
        };
        reader.readAsDataURL(file);
    }

    async function handleAnalyze() {
        if (uploadedImages.length === 0) return;

        const scanStartTime = Date.now();
        logger.scanStart({ photoCount: uploadedImages.length, locale, tier });
        logger.info(`📋 Scan mode: ${scanMode}`);

        setIsAnalyzing(true);
        setMealResult(null);
        setMenuResult(null);
        setDrinkResult(null);
        setOverallScore(0);
        setErrorMessage(null);
        setErrorRequestId(null);
        setLoadingPhase(0);
        setModelUsed(null);
        setDebugData(null);
        setDebugOpen(false);
        setNonFoodReason(null);

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
                finalImageBase64 = await compressImage(uploadedImages[0]);
            } else {
                finalImageBase64 = await stitchImagesToCanvas(uploadedImages);
            }
            
            timings.compressMs = Date.now() - compressStartTime;
            logger.info(`📦 COMPRESS/STITCH TIMING | ${timings.compressMs}ms`);
            setLoadingPhase(1);

            const body = JSON.stringify({ imageBase64: finalImageBase64, locale, scanMode });
            logger.scanApiCall({ payloadSize: body.length, locale });

            // API call with timeout
            const API_TIMEOUT_MS = 30_000;
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

            // First attempt
            let { res, responseText, durationMs: apiDurationMs } = await callAnalyzeApi(1);
            logger.scanApiResponse({ status: res.status, durationMs: apiDurationMs, responseSize: responseText.length, ok: res.ok });
            timings.apiCallMs = apiDurationMs;

            // Retry on 503
            if (res.status === 503) {
                logger.scanRetry({ attempt: 2, reason: 'API returned 503', requestId: undefined });
                const retry = await callAnalyzeApi(2);
                res = retry.res;
                responseText = retry.responseText;
                apiDurationMs += retry.durationMs;
                timings.retryMs = retry.durationMs;
                logger.scanApiResponse({ status: res.status, durationMs: retry.durationMs, responseSize: responseText.length, ok: res.ok });
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

            // Route results to mode-specific state
            const resultScanMode = data.scanMode || scanMode;
            const resultData = data.result;

            // 1. Check if AI explicitly rejected it as "not food"
            if (resultData && resultData.isFood === false) {
                setNonFoodReason(resultData.nonFoodReason || t('error_message'));
            } 
            // 2. Otherwise route to the correct UI component
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

            // Debug panel data
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

            // Save to client-side history
            try {
                let thumbnailBase64 = finalImageBase64;
                if (uploadedImages.length > 0) {
                     thumbnailBase64 = uploadedImages[0];
                }
                const thumbnail = thumbnailBase64 ? await createThumbnail(thumbnailBase64) : undefined;
                addScanToHistory({
                    foodName: resultScanMode === 'meal' ? (data.result.dishes?.[0]?.name || 'Meal')
                        : resultScanMode === 'menu' ? 'Menu Scan'
                        : (data.result.itemName || 'Drink/Snack'),
                    confidence: data.confidence || 0,
                    overallScore: data.overallScore,
                    spikeReduction: resultScanMode === 'meal' ? (data.result.dishes?.[0]?.spikeReduction || 0) : 0,
                    modelUsed: data.modelUsed || 'unknown',
                    tip: resultScanMode === 'meal' ? data.result.overallTip : data.result.tip,
                    thumbnail,
                    nutrition: resultScanMode === 'meal'
                        ? (data.result.dishes?.[0]?.nutritionSummary || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
                        : (data.result.nutritionSummary || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }),
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
                setErrorMessage(t('timeout_message'));
            } else {
                logger.scanError('complete', err, { locale, tier, totalDurationMs: Date.now() - scanStartTime });
                setErrorMessage(err.message || t('error_message'));
            }
        } finally {
            setIsAnalyzing(false);
            phaseTimers.forEach(t => clearTimeout(t));
        }
    }

    function handleDrop(e: React.DragEvent) {"""

# If it exists, replace
if logic_old in content:
    content = content.replace(logic_old, logic_new)
    print("Logic successfully replaced.")
else:
    print("Logic chunk not found, check string boundaries.")

# reset scan logic
reset_old = """    function resetScan() {
        setUploadedImage(null);"""

reset_new = """    function resetScan() {
        setUploadedImages([]);"""
content = content.replace(reset_old, reset_new)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)
