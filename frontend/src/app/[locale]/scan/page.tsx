'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Scan, Upload, Camera, Sparkles, Lock, ChevronRight, Star, Info, Cpu, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { FREE_SCORE_DIMENSIONS, ALL_SCORE_DIMENSIONS, TIER_LIMITS } from '@/lib/tier-config';
import { logger } from '@/lib/logger';
import { type AiSequenceStep } from '@/lib/ai-prompt';
import LanguageSwitcher from '@/components/LanguageSwitcher';

/** Structured type for food analysis results (mock or API). */
export interface SequenceStep {
    step: number;
    emoji: string;
    items: string;
    category: 'fiber' | 'protein' | 'carb' | 'sugar';
}

export interface AnalysisResult {
    name: string;
    items: string[];
    nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber?: number };
    scores: Record<string, number>;
    sequence: SequenceStep[];
    spikeReduction: number;
    tip?: string;
    confidence?: number;
}

// ... mock data omitted for brevity, but make sure the types matches ...
const MOCK_ANALYSES: AnalysisResult[] = [
    {
        name: 'pad_thai',
        items: ['🍜 Rice Noodles', '🥚 Egg', '🥜 Peanuts', '🌱 Bean Sprouts', '🍤 Shrimp', '🧄 Garlic'],
        nutrition: { calories: 380, protein: 18, carbs: 52, fat: 12, fiber: 3 },
        scores: { blood_sugar: 45, gut_health: 62, inflammation: 55, nutrient_density: 68, processing: 72, protein_quality: 75, micronutrient: 58, overall: 61 },
        sequence: [
            { step: 1, emoji: '🌱', items: 'Bean Sprouts, Chives', category: 'fiber' },
            { step: 2, emoji: '🍤', items: 'Shrimp, Egg, Peanuts', category: 'protein' },
            { step: 3, emoji: '🍜', items: 'Rice Noodles', category: 'carb' },
            { step: 4, emoji: '🍬', items: 'Tamarind Sauce (sweet)', category: 'sugar' },
        ],
        spikeReduction: 65,
        confidence: 95
    },
    {
        name: 'som_tam',
        items: ['🥕 Green Papaya', '🍅 Tomatoes', '🥜 Peanuts', '🦐 Dried Shrimp', '🌶️ Chili', '🍋 Lime'],
        nutrition: { calories: 180, protein: 8, carbs: 22, fat: 6, fiber: 8 },
        scores: { blood_sugar: 82, gut_health: 88, inflammation: 78, nutrient_density: 85, processing: 92, protein_quality: 55, micronutrient: 80, overall: 82 },
        sequence: [
            { step: 1, emoji: '🥕', items: 'Green Papaya, Tomatoes', category: 'fiber' },
            { step: 2, emoji: '🦐', items: 'Dried Shrimp, Peanuts', category: 'protein' },
            { step: 3, emoji: '🍚', items: 'Sticky Rice (if served)', category: 'carb' },
            { step: 4, emoji: '🍬', items: 'Palm Sugar (in dressing)', category: 'sugar' },
        ],
        spikeReduction: 72,
        confidence: 92
    },
    {
        name: 'green_curry',
        items: ['🍗 Chicken', '🥦 Thai Eggplant', '🌿 Thai Basil', '🥥 Coconut Milk', '🌶️ Green Curry Paste', '🍚 Rice'],
        nutrition: { calories: 520, protein: 28, carbs: 45, fat: 24, fiber: 5 },
        scores: { blood_sugar: 52, gut_health: 70, inflammation: 65, nutrient_density: 72, processing: 68, protein_quality: 82, micronutrient: 68, overall: 68 },
        sequence: [
            { step: 1, emoji: '🥦', items: 'Thai Eggplant, Basil', category: 'fiber' },
            { step: 2, emoji: '🍗', items: 'Chicken, Coconut Milk', category: 'protein' },
            { step: 3, emoji: '🍚', items: 'Jasmine Rice', category: 'carb' },
            { step: 4, emoji: '🍬', items: 'Palm Sugar (in curry)', category: 'sugar' },
        ],
        spikeReduction: 58,
        confidence: 88
    },
];

const CATEGORY_COLORS: Record<string, string> = {
    fiber: 'bg-sequence-fiber',
    protein: 'bg-sequence-protein',
    carb: 'bg-sequence-carb',
    sugar: 'bg-sequence-sugar',
};

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

    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [modelUsed, setModelUsed] = useState<string | null>(null);

    // Debug mode — activated via ?debug=1 URL parameter
    const searchParams = useSearchParams();
    const isDebugMode = searchParams.get('debug') === '1';
    const [debugData, setDebugData] = useState<Record<string, any> | null>(null);
    const [debugOpen, setDebugOpen] = useState(false);

    useEffect(() => {
        logger.trackFeature('Scan Page', 'loading', { locale, tier });
    }, [locale, tier]);

    /** Compress and resize image before sending to AI — prevents 10MB+ iPhone photos from timing out the Worker */
    function compressImage(base64: string, maxSize = 1024, quality = 0.8): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    // Scale down proportionally if larger than maxSize
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
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
    const MIN_FILE_SIZE = 500; // 500 bytes — anything smaller is likely corrupt
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp'];

    async function handleImageUpload(file: File) {
        // Early validation — fail fast before compression
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
            logger.warn('🚫 SCAN REJECTED | File too small (likely corrupt)', { size: file.size });
            setErrorMessage(t('error_message'));
            return;
        }

        const scanStartTime = Date.now();
        logger.scanStart({ fileSize: file.size, fileType: file.type, locale, tier });

        const reader = new FileReader();
        reader.onload = async (e) => {
            const rawBase64 = e.target?.result as string;
            setUploadedImage(rawBase64);
            setIsAnalyzing(true);
            setAnalysis(null);
            setErrorMessage(null);
            setErrorRequestId(null);
            setLoadingPhase(0);
            setModelUsed(null);
            setDebugData(null);
            setDebugOpen(false);

            // Phased loading indicator — cycle through phases while waiting
            const phaseTimers: ReturnType<typeof setTimeout>[] = [];
            let cumulative = 0;
            LOADING_PHASES.forEach((phase, i) => {
                cumulative += phase.duration;
                phaseTimers.push(setTimeout(() => setLoadingPhase(i + 1), cumulative));
            });

            // Collect timing data for debug panel
            const timings: Record<string, number> = {};

            try {
                // Compress before sending — reduces 10MB+ photos to ~100-200KB
                setLoadingPhase(0);
                const compressStartTime = Date.now();
                const compressedBase64 = await compressImage(rawBase64);
                timings.compressMs = Date.now() - compressStartTime;
                logger.scanCompressed({ originalSize: rawBase64.length, compressedSize: compressedBase64.length });
                logger.info(`📦 COMPRESS TIMING | ${timings.compressMs}ms | ${(rawBase64.length / 1024).toFixed(0)}KB → ${(compressedBase64.length / 1024).toFixed(0)}KB`);
                setLoadingPhase(1);

                const body = JSON.stringify({ imageBase64: compressedBase64, locale });
                logger.scanApiCall({ payloadSize: body.length, locale });

                // Helper: single API call with 30s timeout
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

                // Single retry on 503 (transient AI failure)
                if (res.status === 503) {
                    logger.scanRetry({ attempt: 2, reason: 'API returned 503 (transient AI failure)', requestId: undefined });
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
                    throw new Error(errMsg);
                }

                setLoadingPhase(2);

                // Map the standardized API format to the UI format
                const result: AnalysisResult = {
                    name: data.result.foodName || 'scanned_food',
                    items: data.result.detectedItems,
                    nutrition: {
                        calories: data.result.nutritionSummary.calories,
                        protein: data.result.nutritionSummary.protein,
                        carbs: data.result.nutritionSummary.carbs,
                        fat: data.result.nutritionSummary.fat,
                        fiber: data.result.nutritionSummary.fiber || 0
                    },
                    scores: {
                        blood_sugar: data.result.scores.bloodSugar,
                        gut_health: data.result.scores.gutHealth,
                        inflammation: data.result.scores.inflammation,
                        nutrient_density: data.result.scores.nutrientDensity,
                        processing: data.result.scores.processing,
                        protein_quality: data.result.scores.proteinQuality,
                        micronutrient: data.result.scores.micronutrient,
                        overall: data.overallScore
                    },
                    // Use structured sequence from AI — supports both new object format and legacy strings
                    sequence: Array.isArray(data.result.sequence)
                        ? data.result.sequence.map((s: AiSequenceStep) => ({
                            step: s.step,
                            emoji: s.emoji || '💡',
                            items: s.items,
                            category: s.category || 'fiber',
                        }))
                        : [],
                    spikeReduction: data.spikeReduction || data.result.spikeReduction || 60,
                    tip: data.result.tip,
                    confidence: data.confidence || 0
                };

                setModelUsed(data.modelUsed || null);

                setAnalysis(result);
                timings.totalMs = Date.now() - scanStartTime;
                logger.scanSuccess({
                    foodName: result.name,
                    confidence: result.confidence || 0,
                    overallScore: data.overallScore,
                    durationMs: timings.totalMs
                });

                // Populate debug panel data (only stored when ?debug=1)
                if (isDebugMode) {
                    setDebugData({
                        timings,
                        modelUsed: data.modelUsed,
                        requestId: data.requestId,
                        confidence: data.confidence,
                        spikeReduction: data.spikeReduction,
                        rawResult: data.result,
                        overallScore: data.overallScore,
                    });
                }

                // Sync store
                useAuthStore.getState().initAuth();
            } catch (err: any) {
                // Detect timeout vs other errors
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
        setUploadedImage(null);
        setAnalysis(null);
        setIsAnalyzing(false);
        setErrorMessage(null);
        setErrorRequestId(null);
        setLoadingPhase(0);
        setModelUsed(null);
        setDebugData(null);
        setDebugOpen(false);
    }

    const scansUsed = user?.scansThisMonth || 0;
    const activeTier = (tier as 'free' | 'premium' | 'family') || 'free';
    const scansLimit = TIER_LIMITS[activeTier].scansPerMonth;
    const canStillScan = activeTier === 'premium' || activeTier === 'family' || scansUsed < scansLimit;

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
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 mb-2">
                        {t('title')}
                    </h1>
                    <p className="text-gray-500 flex items-center justify-center gap-3">
                        <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                        <span className="font-medium text-lg">{tMascot('scan_tip')}</span>
                    </p>
                </div>

                {/* Upload area - show if not analyzing and no results */}
                {!uploadedImage && !isAnalyzing && !analysis && (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`backdrop-blur-md bg-white/80 rounded-3xl p-8 md:p-16 max-w-lg mx-auto shadow-glass text-center transition-all duration-300 ${dragOver ? 'ring-4 ring-brand-primary-400 scale-105 bg-brand-primary-50/60' : 'hover:-translate-y-2 hover:shadow-glass-hover'
                            } ${!canStillScan ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {/* Camera input — opens device camera on mobile */}
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="hidden" />
                        {/* File picker — opens gallery/file browser */}
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />

                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-brand-primary-100 to-brand-secondary-100 rounded-3xl flex items-center justify-center mb-6 cursor-pointer" onClick={() => canStillScan && fileInputRef.current?.click()}>
                            <Upload className="w-12 h-12 text-brand-primary-400" />
                        </div>
                        <p className="text-lg font-semibold text-gray-700 mb-2">{t('drag_drop')}</p>
                        <p className="text-gray-400 mb-4">{t('or_click')}</p>
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

                {/* Analyzing state — with phased progress indicator */}
                {isAnalyzing && (
                    <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 max-w-lg mx-auto shadow-glass text-center animate-bounce-in">
                        {uploadedImage && (
                            <div className="w-48 h-48 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg">
                                <img src={uploadedImage} alt="Food" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="flex flex-col items-center justify-center gap-4 mb-4 mt-6">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg relative">
                                <img src="/images/shinny_avatar_analyzing.png" alt="Shinny Analyzing" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 border-4 border-brand-primary-400/30 border-t-brand-primary-400 rounded-full animate-spin"></div>
                            </div>
                            <span className="text-xl font-bold text-gray-700 bg-white/50 px-4 py-1 rounded-full">{t('shinny_analyzing')}</span>
                        </div>
                        {/* Phased loading indicator */}
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

                {/* Error State */}
                {errorMessage && !isAnalyzing && !analysis && (
                    <div className="backdrop-blur-md bg-white/90 rounded-3xl p-8 max-w-lg mx-auto shadow-glass text-center animate-bounce-in">
                        {uploadedImage && (
                            <div className="w-48 h-48 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg opacity-60">
                                <img src={uploadedImage} alt="Food" className="w-full h-full object-cover" />
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

                {/* Analysis Results */}
                {analysis && !isAnalyzing && (
                    <div className="space-y-6 animate-slide-up">
                        {/* Food Image + Detected Items */}
                        <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass relative overflow-hidden">
                            {/* Low Confidence Warning */}
                            {analysis.confidence !== undefined && analysis.confidence < 70 && (
                                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-4 animate-slide-up">
                                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-orange-200">
                                        <img src="/images/shinny_avatar_explaining.png" alt="Shinny Warning" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h3 className="text-orange-800 font-bold mb-1">
                                            {t('low_confidence.title')}
                                        </h3>
                                        <p className="text-orange-700 text-sm">
                                            {t('low_confidence.message')}
                                        </p>
                                        <p className="text-orange-600/70 text-xs mt-2 font-mono">
                                            Confidence Score: {analysis.confidence}%
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-6">
                                {uploadedImage && (
                                    <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                                        <img src={uploadedImage} alt="Food" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    {analysis.name && analysis.name !== 'scanned_food' && (
                                        <h2 className="text-2xl font-black text-gray-900 mb-1">{analysis.name}</h2>
                                    )}
                                    <h3 className="text-lg font-bold text-gray-600 mb-3">{t('detected_items')}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.items.map((item: string, i: number) => (
                                            <span key={i} className="px-3 py-1.5 bg-brand-primary-50 text-brand-primary-700 rounded-full text-sm font-medium">
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                    {/* Nutrition summary — responsive grid */}
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                                        {(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const).map((key) => {
                                            const nutritionKey = key.replace('_g', '') as keyof typeof analysis.nutrition;
                                            return (
                                                <div key={key} className="text-center p-2 bg-gray-50 rounded-xl">
                                                    <p className="text-xs text-gray-500">{t(key)}</p>
                                                    <p className="text-lg font-bold text-gray-800">
                                                        {analysis.nutrition[nutritionKey]}
                                                        {key !== 'calories' && <span className="text-xs text-gray-400">g</span>}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Eating Sequence */}
                        <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                            <h2 className="text-xl font-bold text-gray-800 mb-1">{t('sequence.title')}</h2>
                            <p className="text-sm text-gray-500 mb-4">{t('sequence.subtitle')}</p>
                            <div className="flex flex-col md:flex-row items-stretch gap-3">
                                {analysis.sequence.map((step: any, i: number) => (
                                    <div key={i} className="flex-1 flex items-center gap-3 p-4 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 group hover:shadow-glass transition-all">
                                        <div className={`w-10 h-10 ${CATEGORY_COLORS[step.category]} text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-110 transition-transform`}>
                                            {step.step}
                                        </div>
                                        <div>
                                            <p className="text-2xl">{step.emoji}</p>
                                            <p className="text-xs text-gray-600 font-medium">{step.items}</p>
                                        </div>
                                        {i < analysis.sequence.length - 1 && (
                                            <ChevronRight className="hidden md:block w-4 h-4 text-gray-300 ml-auto" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 p-3 bg-green-50 rounded-xl flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-green-500" />
                                <span className="text-green-700 font-semibold text-sm">
                                    {t('sequence.spike_reduction')}: <span className="text-lg">{analysis.spikeReduction}%</span>
                                </span>
                            </div>
                        </div>

                        {/* Shinny's Tip — display the AI-generated tip */}
                        {analysis.tip && (
                            <div className="backdrop-blur-md bg-gradient-to-br from-brand-primary-50/90 to-brand-secondary-50/90 rounded-3xl p-5 shadow-glass">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-md">
                                        <img src="/images/shinny_avatar_explaining.png" alt="Shinny Tip" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-brand-primary-700 mb-1 flex items-center gap-1">
                                            <Info className="w-3.5 h-3.5" /> {t('shinny_tip_title')}
                                        </h3>
                                        <p className="text-gray-700 text-sm leading-relaxed">{analysis.tip}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Health Scores with prominent overall score badge */}
                        <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                            {/* Overall Score Badge */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-800">{t('results')}</h2>
                                <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl ${
                                    (analysis.scores.overall || 0) >= 75 ? 'bg-green-50 border border-green-200' :
                                    (analysis.scores.overall || 0) >= 50 ? 'bg-yellow-50 border border-yellow-200' :
                                    'bg-red-50 border border-red-200'
                                }`}>
                                    <div className={`text-3xl font-black ${
                                        (analysis.scores.overall || 0) >= 75 ? 'text-green-500' :
                                        (analysis.scores.overall || 0) >= 50 ? 'text-yellow-500' :
                                        'text-red-500'
                                    }`}>
                                        {analysis.scores.overall || 0}
                                        <span className="text-sm text-gray-400 font-medium">/100</span>
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium">{t('scores.overall')}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {ALL_SCORE_DIMENSIONS.filter(dim => dim !== 'overall').map((dim) => {
                                    const isLocked = !FREE_SCORE_DIMENSIONS.includes(dim) && tier === 'free';
                                    const score = analysis.scores[dim as keyof typeof analysis.scores];
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
                                            {/* Mini progress bar */}
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

                        {/* Scan again button + model badge */}
                        <div className="text-center">
                            <div className="mb-4">
                                <img src="/images/shinny_avatar_celebrating.png" alt="Shinny Celebrating" className="w-16 h-16 mx-auto drop-shadow-md animate-bounce-light" />
                            </div>
                            <button onClick={resetScan} className="px-8 py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl hover:shadow-brand-lg transition-all">
                                <Scan className="w-5 h-5 inline mr-2" /> {t('try_again')}
                            </button>
                            {modelUsed && (
                                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                                    <Cpu className="w-3 h-3" />
                                    <span>{t('analyzed_by')} {modelUsed === 'google-gemma-3-27b' ? 'Gemma 3 27B' : 'Llama 3.2 11B'}</span>
                                </div>
                            )}
                        </div>

                        {/* Debug Panel — only visible with ?debug=1 URL param */}
                        {isDebugMode && debugData && (
                            <div className="backdrop-blur-md bg-gray-900/95 rounded-3xl shadow-glass overflow-hidden">
                                <button
                                    onClick={() => setDebugOpen(!debugOpen)}
                                    className="w-full flex items-center justify-between px-5 py-3 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span className="flex items-center gap-2 text-sm font-mono">
                                        <Bug className="w-4 h-4 text-yellow-400" />
                                        Debug Panel
                                        <span className="text-xs text-gray-500">(?debug=1)</span>
                                    </span>
                                    {debugOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                {debugOpen && (
                                    <div className="px-5 pb-5 space-y-3">
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
                                            <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded">reqId: {debugData.requestId}</span>
                                            <span className="bg-amber-900/50 text-amber-300 px-2 py-1 rounded">conf: {debugData.confidence}%</span>
                                            <span className="bg-emerald-900/50 text-emerald-300 px-2 py-1 rounded">spike: {debugData.spikeReduction}%</span>
                                        </div>
                                        <details className="text-xs">
                                            <summary className="text-gray-400 cursor-pointer hover:text-gray-200 font-mono">Raw AI Response JSON</summary>
                                            <pre className="mt-2 bg-gray-800 rounded-xl p-3 text-gray-300 overflow-x-auto max-h-80 overflow-y-auto font-mono text-[10px] leading-relaxed">
                                                {JSON.stringify(debugData.rawResult, null, 2)}
                                            </pre>
                                        </details>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
