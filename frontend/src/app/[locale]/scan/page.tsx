'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Scan, Upload, Camera, Sparkles, Lock, ChevronRight, Star, Info, Cpu, Bug, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { FREE_SCORE_DIMENSIONS, ALL_SCORE_DIMENSIONS, TIER_LIMITS, canAddMorePhotos } from '@/lib/tier-config';
import { logger } from '@/lib/logger';
import { type ScanMode, type AiMultiDishResponse, type AiMenuResponse, type AiDrinkSnackResponse } from '@/lib/ai-prompt';
import { addScanToHistory, createThumbnail } from '@/lib/scan-history';
import { stitchImagesToCanvas } from '@/lib/image-stitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ScanModeSelector from '@/components/scan/ScanModeSelector';
import DishCard from '@/components/scan/DishCard';
import MealOverview from '@/components/scan/MealOverview';
import MenuResults from '@/components/scan/MenuResults';
import DrinkSnackResults from '@/components/scan/DrinkSnackResults';

/** Loading phase messages for the phased loading indicator */
const LOADING_PHASES = [
    { key: 'compressing', emoji: '📦', duration: 2000 },
    { key: 'analyzing', emoji: '🤖', duration: 8000 },
    { key: 'processing', emoji: '✨', duration: 5000 },
] as const;

export default function ScanPage() {
    const t = useTranslations('scan');
    const tCommon = useTranslations('common');
    const tMascot = useTranslations('mascot');
    const locale = useLocale();

    const { user, isAuthenticated } = useAuthStore();
    const tier = (isAuthenticated && user?.subscriptionTier) ? user.subscriptionTier : 'free';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Scan mode
    const [scanMode, setScanMode] = useState<ScanMode>('meal');

    // Core scan state
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [nonFoodReason, setNonFoodReason] = useState<string | null>(null);
    const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [modelUsed, setModelUsed] = useState<string | null>(null);

    // Mode-specific results
    const [mealResult, setMealResult] = useState<AiMultiDishResponse | null>(null);
    const [menuResult, setMenuResult] = useState<AiMenuResponse | null>(null);
    const [drinkResult, setDrinkResult] = useState<AiDrinkSnackResponse | null>(null);
    const [overallScore, setOverallScore] = useState<number>(0);

    // Debug mode — activated via ?debug=1 URL parameter
    const searchParams = useSearchParams();
    const isDebugMode = searchParams.get('debug') === '1';
    const [debugData, setDebugData] = useState<Record<string, any> | null>(null);
    const [debugOpen, setDebugOpen] = useState(false);

    const hasResult = mealResult || menuResult || drinkResult || nonFoodReason;

    useEffect(() => {
        logger.trackFeature('Scan Page', 'loading', { locale, tier, scanMode });
    }, [locale, tier, scanMode]);

    /** Compress and resize image before sending to AI */
    function compressImage(base64: string, maxSize = 1024, quality = 0.8): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (canvasErr) {
                    reject(canvasErr);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image for compression'));
            img.src = base64;
        });
    }

    /** Validate file before processing */
    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    const MIN_FILE_SIZE = 500;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp'];

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

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleImageUpload(file);
    }

    function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
    }

    function resetScan() {
        setUploadedImages([]);
        setMealResult(null);
        setMenuResult(null);
        setDrinkResult(null);
        setOverallScore(0);
        setIsAnalyzing(false);
        setErrorMessage(null);
        setErrorRequestId(null);
        setLoadingPhase(0);
        setModelUsed(null);
        setDebugData(null);
        setDebugOpen(false);
        setNonFoodReason(null);
    }

    const scansUsed = user?.scansThisMonth || 0;
    const activeTier = (tier as 'free' | 'premium' | 'family') || 'free';
    const scansLimit = TIER_LIMITS[activeTier].scansPerMonth;
    const canStillScan = activeTier === 'premium' || activeTier === 'family' || scansUsed < scansLimit;

    // Mode-specific upload hint
    const uploadHint = t(`scan_modes.${scanMode}.upload_hint`);

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
            {/* Background */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
            <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>

            {/* Header */}
            <div className="container mx-auto px-4 pt-6 pb-4 relative z-50">
                <div className="flex items-center justify-between">
                    <Link href={`/${locale}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl text-gray-600 hover:text-brand-primary-500 transition-colors border border-gray-200">
                        <ArrowLeft className="w-4 h-4" /> {tCommon('back_to_home')}
                    </Link>
                    <div className="flex items-center gap-3">
                        {isAuthenticated && (
                            <div className="text-sm text-gray-500">
                                {t('scans_remaining')}: <span className="font-bold text-brand-primary-500">{tier === 'premium' || tier === 'family' ? '∞' : (scansLimit - scansUsed)}</span>
                            </div>
                        )}
                        <LanguageSwitcher currentLocale={locale} />
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6 relative z-10 max-w-4xl">
                {/* Title */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 mb-2">
                        {t('title')}
                    </h1>
                    <p className="text-gray-500 flex items-center justify-center gap-3">
                        <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                        <span className="font-medium text-lg">{tMascot('scan_tip')}</span>
                    </p>
                </div>

                {/* Scan Mode Selector — show before upload area */}
                {uploadedImages.length === 0 && !isAnalyzing && !hasResult && (
                    <ScanModeSelector selectedMode={scanMode} onSelect={setScanMode} />
                )}

                {/* Upload area — show if not analyzing and no results */}
                {uploadedImages.length === 0 && !isAnalyzing && !hasResult && (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`backdrop-blur-md bg-white/80 rounded-3xl p-8 md:p-16 max-w-lg mx-auto shadow-glass text-center transition-all duration-300 ${dragOver ? 'ring-4 ring-brand-primary-400 scale-105 bg-brand-primary-50/60' : 'hover:-translate-y-2 hover:shadow-glass-hover'
                            } ${!canStillScan ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="hidden" />
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />

                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-brand-primary-100 to-brand-secondary-100 rounded-3xl flex items-center justify-center mb-6 cursor-pointer" onClick={() => canStillScan && fileInputRef.current?.click()}>
                            <Upload className="w-12 h-12 text-brand-primary-400" />
                        </div>
                        <p className="text-lg font-semibold text-gray-700 mb-2">{t('drag_drop')}</p>
                        <p className="text-gray-400 mb-2">{t('or_click')}</p>
                        {/* Mode-specific hint */}
                        <p className="text-sm text-brand-primary-500/70 font-medium mb-4">{uploadHint}</p>
                        <p className="text-xs text-gray-400">{t('supported_formats')}</p>

                        <div className="flex justify-center gap-3 mt-6">
                            <button
                                onClick={(e) => { e.stopPropagation(); canStillScan && cameraInputRef.current?.click(); }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-semibold rounded-xl shadow-brand transition-all hover:shadow-brand-lg"
                            >
                                <Camera className="w-4 h-4" /> {t('take_photo')}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); canStillScan && fileInputRef.current?.click(); }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                            >
                                <Upload className="w-4 h-4" /> {t('upload')}
                            </button>
                        </div>

                        {!canStillScan && (
                            <div className="mt-6 p-3 bg-brand-accent-100 rounded-xl text-sm text-brand-accent-700">
                                <Lock className="w-4 h-4 inline mr-1" />
                                {t('upgrade_hint')}
                            </div>
                        )}
                    </div>
                )}

                
                {/* Review Stage: Photos uploaded but not analyzed yet */}
                {uploadedImages.length > 0 && !isAnalyzing && !hasResult && !nonFoodReason && !errorMessage && (
                    <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 max-w-xl mx-auto shadow-glass animate-bounce-in border border-white/40">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">{uploadedImages.length} Photo{uploadedImages.length > 1 ? 's' : ''} Selected</h2>
                            <p className="text-sm text-gray-500">{uploadedImages.length}/{TIER_LIMITS[activeTier].maxPhotosPerScan}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                            {uploadedImages.map((img, idx) => (
                                <div key={idx} className="aspect-square rounded-2xl overflow-hidden shadow-md relative group">
                                    <img src={img} alt={`Upload ${idx+1}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                            {canAddMorePhotos(activeTier, uploadedImages.length) && (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square rounded-2xl border-2 border-dashed border-brand-primary-300 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-primary-50 transition-colors text-brand-primary-400"
                                >
                                    <Plus className="w-8 h-8 mb-2" />
                                    <span className="text-xs font-semibold">Add Photo</span>
                                </div>
                            )}
                        </div>

                        {!canAddMorePhotos(activeTier, uploadedImages.length) && (
                            <p className="text-sm text-brand-accent-600 mb-6 bg-brand-accent-50 py-2 rounded-xl text-center px-4">
                                You've reached the maximum of {TIER_LIMITS[activeTier].maxPhotosPerScan} photos per scan for your tier.
                            </p>
                        )}
                        
                        <div className="flex gap-4 max-w-md mx-auto">
                            <button onClick={() => setUploadedImages([])} className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                                Cancel
                            </button>
                            <button onClick={() => handleAnalyze()} className="flex-[2] px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 shadow-brand hover:shadow-brand-lg transition-all flex items-center justify-center gap-2">
                                <Sparkles className="w-5 h-5" /> Analyze Now
                            </button>
                        </div>
                    </div>
                )}

                {/* Analyzing state */}
                {isAnalyzing && (
                    <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 max-w-lg mx-auto shadow-glass text-center animate-bounce-in">
                        {uploadedImages.length > 0 && (
                            <div className="w-48 h-48 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg">
                                <img src={uploadedImages[0]} alt="Food" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="flex flex-col items-center justify-center gap-4 mb-4 mt-6">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg relative">
                                <img src="/images/shinny_avatar_analyzing.png" alt="Shinny Analyzing" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 border-4 border-brand-primary-400/30 border-t-brand-primary-400 rounded-full animate-spin"></div>
                            </div>
                            <span className="text-xl font-bold text-gray-700 bg-white/50 px-4 py-1 rounded-full">{t('shinny_analyzing')}</span>
                        </div>
                        <div className="space-y-2 mt-4">
                            {LOADING_PHASES.map((phase, i) => (
                                <div key={phase.key} className={`flex items-center justify-center gap-2 text-sm transition-all duration-500 ${loadingPhase >= i ? 'text-gray-700 opacity-100' : 'text-gray-300 opacity-50'}`}>
                                    <span>{phase.emoji}</span>
                                    <span className="font-medium">{t(`loading_phases.${phase.key}`)}</span>
                                    {loadingPhase === i && <span className="inline-block w-4 h-4 border-2 border-brand-primary-400 border-t-transparent rounded-full animate-spin"></span>}
                                    {loadingPhase > i && <span className="text-green-500">✓</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Graceful Non-Food Error State */}
                {nonFoodReason && !isAnalyzing && (
                    <div className="backdrop-blur-md bg-white/90 rounded-3xl p-8 max-w-lg mx-auto shadow-glass text-center animate-bounce-in">
                        {uploadedImages.length > 0 && (
                            <div className="w-48 h-48 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg opacity-80">
                                <img src={uploadedImages[0]} alt="Not Food" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="flex flex-col items-center gap-4 mb-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-brand-primary-200 shadow-lg">
                                <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-full h-full object-cover" />
                            </div>
                            <h3 className="text-xl font-bold text-brand-primary-700">{t('error_oops')}</h3>
                        </div>
                        <p className="text-gray-700 mb-6 text-lg">{nonFoodReason}</p>
                        <button onClick={resetScan} className="px-8 py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl hover:shadow-brand-lg transition-all">
                            <Scan className="w-5 h-5 inline mr-2" /> {t('try_again')}
                        </button>
                    </div>
                )}

                {/* API Error State */}
                {errorMessage && !isAnalyzing && !hasResult && !nonFoodReason && (
                    <div className="backdrop-blur-md bg-white/90 rounded-3xl p-8 max-w-lg mx-auto shadow-glass text-center animate-bounce-in">
                        {uploadedImages.length > 0 && (
                            <div className="w-48 h-48 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg opacity-60">
                                <img src={uploadedImages[0]} alt="Food" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="flex flex-col items-center gap-4 mb-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-orange-200 shadow-lg">
                                <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-full h-full object-cover" />
                            </div>
                            <h3 className="text-xl font-bold text-orange-700">{t('error_title')}</h3>
                        </div>
                        <p className="text-gray-600 mb-2">{t('error_message')}</p>
                        <p className="text-sm text-gray-400 mb-4">{errorMessage}</p>
                        {errorRequestId && (
                            <p className="text-xs text-gray-300 mb-4 font-mono">Request ID: {errorRequestId}</p>
                        )}
                        <button onClick={resetScan} className="px-8 py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl hover:shadow-brand-lg transition-all">
                            <Scan className="w-5 h-5 inline mr-2" /> {t('try_again')}
                        </button>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════
                    RESULTS — mode-specific rendering
                   ═══════════════════════════════════════════════════════ */}

                {/* MEAL RESULTS */}
                {mealResult && !isAnalyzing && (
                    <div className="space-y-6 animate-slide-up">
                        {/* Uploaded Image */}
                        {uploadedImages.length > 0 && (
                            <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                                        <img src={uploadedImages[0]} alt="Food" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center">
                                        {/* Low Confidence Warning */}
                                        {mealResult.confidence < 70 && (
                                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3 mb-3">
                                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-2 border-orange-200">
                                                    <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-orange-800">{t('low_confidence.title')}</h4>
                                                    <p className="text-xs text-orange-700">{t('low_confidence.message')}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-500 font-medium">{mealResult.dishCount} {mealResult.dishCount > 1 ? 'dishes detected' : 'dish detected'}</p>
                                                <p className={`text-3xl font-black ${overallScore >= 75 ? 'text-green-500' : overallScore >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                    {overallScore}<span className="text-sm text-gray-400 font-medium">/100</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Per-Dish Cards */}
                        {mealResult.dishes.length > 1 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 mb-3 px-1">{t('detected_items')}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {mealResult.dishes.map((dish, i) => (
                                        <DishCard key={i} dish={dish} index={i} totalDishes={mealResult.dishCount} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Single dish — inline details (backwards-compatible with old UI feel) */}
                        {mealResult.dishes.length === 1 && (
                            <DishCard dish={mealResult.dishes[0]} index={0} totalDishes={1} />
                        )}

                        {/* Meal Overview — cross-dish sequence + totals */}
                        <MealOverview data={mealResult} />

                        {/* Health Scores */}
                        {mealResult.dishes.length > 0 && (
                            <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-gray-800">{t('results')}</h2>
                                    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl ${
                                        overallScore >= 75 ? 'bg-green-50 border border-green-200' :
                                        overallScore >= 50 ? 'bg-yellow-50 border border-yellow-200' :
                                        'bg-red-50 border border-red-200'
                                    }`}>
                                        <div className={`text-3xl font-black ${
                                            overallScore >= 75 ? 'text-green-500' :
                                            overallScore >= 50 ? 'text-yellow-500' :
                                            'text-red-500'
                                        }`}>
                                            {overallScore}
                                            <span className="text-sm text-gray-400 font-medium">/100</span>
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium">{t('scores.overall')}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {ALL_SCORE_DIMENSIONS.filter(dim => dim !== 'overall').map((dim) => {
                                        const isLocked = !FREE_SCORE_DIMENSIONS.includes(dim) && tier === 'free';
                                        // Average score across all dishes
                                        const score = Math.round(
                                            mealResult.dishes.reduce((sum, d) => sum + (d.scores[dim as keyof typeof d.scores] || 0), 0) / mealResult.dishes.length
                                        );
                                        const scoreColor = score >= 75 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';
                                        const bgColor = score >= 75 ? 'bg-green-50' : score >= 50 ? 'bg-yellow-50' : 'bg-red-50';

                                        return (
                                            <div key={dim} className={`relative p-4 rounded-2xl ${bgColor} ${isLocked ? 'opacity-60' : ''} transition-all hover:-translate-y-1`}>
                                                {isLocked && (
                                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                                                        <Lock className="w-5 h-5 text-gray-400" />
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-500 font-medium mb-1">{t(`scores.${dim}`)}</p>
                                                <p className={`text-2xl font-black ${scoreColor}`}>
                                                    {isLocked ? '—' : score}
                                                    {!isLocked && <span className="text-sm text-gray-400">/100</span>}
                                                </p>
                                                {!isLocked && (
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                                        <div className={`h-1.5 rounded-full transition-all duration-700 ${score >= 75 ? 'bg-green-400' : score >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${score}%` }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {tier === 'free' && (
                                    <Link href={`/${locale}/pricing`} className="mt-4 flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50 rounded-xl text-brand-primary-600 font-semibold text-sm hover:shadow-brand transition-all">
                                        <Star className="w-4 h-4" />
                                        {t('upgrade_hint')}
                                        <ChevronRight className="w-4 h-4" />
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* MENU RESULTS */}
                {menuResult && !isAnalyzing && (
                    <div className="space-y-6 animate-slide-up">
                        {uploadedImages.length > 0 && (
                            <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                                        <img src={uploadedImages[0]} alt="Menu" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <p className="text-sm text-gray-500 font-medium">{t('menu_scan.scanned_label')}</p>
                                        <h2 className="text-2xl font-black text-gray-900">{menuResult.menuItems.length} {t('menu_scan.items_label')}</h2>
                                        {menuResult.confidence < 70 && (
                                            <p className="text-xs text-orange-600 mt-1">⚠️ {t('low_confidence.title')}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <MenuResults data={menuResult} />
                    </div>
                )}

                {/* DRINK & SNACK RESULTS */}
                {drinkResult && !isAnalyzing && (
                    <div className="space-y-6 animate-slide-up">
                        {uploadedImages.length > 0 && (
                            <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                                <div className="flex flex-col md:flex-row gap-6 items-center">
                                    <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                                        <img src={uploadedImages[0]} alt="Drink/Snack" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        {drinkResult.confidence < 70 && (
                                            <div className="p-2 bg-orange-50 rounded-lg mb-2">
                                                <p className="text-xs text-orange-600">⚠️ {t('low_confidence.title')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <DrinkSnackResults data={drinkResult} />
                    </div>
                )}

                {/* Scan again button — shown for all modes */}
                {hasResult && !isAnalyzing && (
                    <div className="text-center mt-8">
                        <div className="mb-4">
                            <img src="/images/shinny_avatar_celebrating.png" alt="Shinny Celebrating" className="w-16 h-16 mx-auto drop-shadow-md animate-bounce-light" />
                        </div>
                        <div className="flex items-center justify-center gap-3">
                            <button onClick={resetScan} className="px-8 py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl hover:shadow-brand-lg transition-all">
                                <Scan className="w-5 h-5 inline mr-2" /> {t('try_again')}
                            </button>
                        </div>
                        {modelUsed && (
                            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                                <Cpu className="w-3 h-3" />
                                <span>{t('analyzed_by')} {modelUsed === 'google-gemma-3-27b' ? 'Gemma 3 27B' : 'Llama 3.2 11B'}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Debug Panel */}
                {isDebugMode && debugData && (hasResult || errorMessage) && !isAnalyzing && (
                    <div className="mt-6 backdrop-blur-md bg-gray-900/95 rounded-3xl shadow-glass overflow-hidden text-left">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                             <button
                                onClick={() => setDebugOpen(!debugOpen)}
                                className="flex items-center justify-between flex-1 text-gray-300 hover:text-white transition-colors"
                            >
                                <span className="flex items-center gap-2 text-sm font-mono">
                                    <Bug className="w-4 h-4 text-yellow-400" />
                                    Debug Panel
                                    <span className="text-xs text-gray-500">(?debug=1)</span>
                                </span>
                                {debugOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {debugOpen && (
                                <button
                                    className="ml-4 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-mono rounded-md border border-gray-700 transition"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
                                        const btn = e.currentTarget;
                                        btn.innerText = 'Copied!';
                                        setTimeout(() => btn.innerText = 'Copy Data', 2000);
                                    }}
                                >
                                    Copy Data
                                </button>
                            )}
                        </div>
                        {debugOpen && (
                            <div className="px-5 pb-5 pt-3 space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                    {Object.entries(debugData.timings || {}).map(([key, val]) => (
                                        <div key={key} className="flex justify-between bg-gray-800 rounded-lg px-3 py-2">
                                            <span className="text-gray-400">{key}</span>
                                            <span className="text-green-400">{String(val)}ms</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 text-xs font-mono flex-wrap">
                                    <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">model: {debugData.modelUsed}</span>
                                    <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded">mode: {debugData.scanMode}</span>
                                    {debugData.requestId && <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded">reqId: {debugData.requestId}</span>}
                                    <span className="bg-amber-900/50 text-amber-300 px-2 py-1 rounded">conf: {debugData.confidence}%</span>
                                    <span className="bg-emerald-900/50 text-emerald-300 px-2 py-1 rounded">score: {debugData.overallScore}/100</span>
                                </div>
                                <details className="text-xs" open={!!debugData.failedJson}>
                                    <summary className={`cursor-pointer font-mono ${debugData.failedJson ? 'text-red-400 hover:text-red-300 font-bold' : 'text-gray-400 hover:text-gray-200'}`}>
                                        {debugData.failedJson ? 'Failed AI Response (JSON Parse/Validation Error)' : 'Raw AI Response JSON'}
                                    </summary>
                                    <pre className={`mt-2 rounded-xl p-3 overflow-x-auto max-h-80 overflow-y-auto font-mono text-[10px] leading-relaxed ${debugData.failedJson ? 'bg-red-950/50 text-red-200 border border-red-900/50' : 'bg-gray-800 text-gray-300'}`}>
                                        {debugData.failedJson ? debugData.failedJson : JSON.stringify(debugData.rawResult, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
