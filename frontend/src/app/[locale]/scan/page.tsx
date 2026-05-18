'use client';

import { useRef, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Scan, Cpu } from 'lucide-react';

import { useAuthStore } from '@/lib/auth-store';
import { TIER_LIMITS } from '@/lib/tier-config';
import { logger } from '@/lib/logger';
import { type ScanMode } from '@/lib/ai-prompt';

// Components
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ScanModeSelector from '@/components/scan/ScanModeSelector';
import DishCard from '@/components/scan/DishCard';
import MealOverview from '@/components/scan/MealOverview';
import MenuResults from '@/components/scan/MenuResults';
import DrinkSnackResults from '@/components/scan/DrinkSnackResults';
import ScanUploadArea from '@/components/scan/ScanUploadArea';
import ScanLoadingOverlay from '@/components/scan/ScanLoadingOverlay';
import ScanDebugPanel from '@/components/scan/ScanDebugPanel';
import ScanResultChat from '@/components/scan/ScanResultChat';

// Hooks
import { useScanUpload } from '@/hooks/scan/useScanUpload';
import { useScanAnalysis } from '@/hooks/scan/useScanAnalysis';
import { useScanDebug } from '@/hooks/scan/useScanDebug';

/**
 * Map a `modelUsed` identifier from `/api/analyze` to a short, human-
 * readable label for the "Analyzed by" footer. Identifiers can be:
 *   - `cloudflare-llama-3.2-11b` (primary)
 *   - `google-gemini-2.5-flash`, `google-gemini-2.0-flash`, … (fallback
 *     cascade — see `GEMINI_VISION_MODELS` in `lib/ai-providers.ts`).
 *
 * Fallback to "Llama 3.2 11B" preserves prior behaviour when the
 * identifier doesn't match a known prefix (e.g. the CF primary, or a
 * future renamed id we haven't updated this map for yet).
 */
function modelDisplayName(modelUsed: string): string {
    if (modelUsed.startsWith('google-gemini-')) {
        const id = modelUsed.slice('google-gemini-'.length); // e.g. "2.5-flash"
        return `Gemini ${id.replace(/-/g, ' ').replace(/\bflash\b/i, 'Flash').replace(/\blite\b/i, 'Lite')}`;
    }
    return 'Llama 3.2 11B';
}

export default function ScanPage() {
    const t = useTranslations('scan');
    const tCommon = useTranslations('common');
    const tMascot = useTranslations('mascot');
    const locale = useLocale();

    const { user, isAuthenticated } = useAuthStore();
    const tier = (isAuthenticated && user?.subscriptionTier) ? user.subscriptionTier : 'free';
    const activeTier = (tier as 'free' | 'premium' | 'family') || 'free';
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [scanMode, setScanMode] = useState<ScanMode>('meal');

    // Debug Hook
    const debug = useScanDebug();

    // Analysis Hook
    const analysis = useScanAnalysis({
        locale,
        tier,
        isDebugMode: debug.isDebugMode,
        setDebugData: debug.setDebugData
    });

    // Upload Hook
    const upload = useScanUpload({
        tier,
        onReset: analysis.resetAnalysis
    });

    const scansUsed = user?.scansThisMonth || 0;
    const scansLimit = TIER_LIMITS[activeTier].scansPerMonth;
    const canStillScan = activeTier === 'premium' || activeTier === 'family' || scansUsed < scansLimit;

    useEffect(() => {
        logger.trackFeature('Scan Page', 'loading', { locale, tier, scanMode });
    }, [locale, tier, scanMode]);

    // Handlers
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        upload.setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        upload.processMultipleFiles(files, !!analysis.hasResult || !!analysis.nonFoodReason || !!upload.uploadError);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            upload.processMultipleFiles(files, !!analysis.hasResult || !!analysis.nonFoodReason || !!upload.uploadError);
        }
        if (e.target) e.target.value = '';
    };

    const handleAnalyzeTrigger = () => {
        analysis.analyze(upload.uploadedImages, scanMode);
    };

    const resetScan = () => {
        upload.clearImages();
        analysis.resetAnalysis();
    };

    const isUploading = upload.uploadedImages.length > 0 && !analysis.isAnalyzing && !analysis.hasResult && !analysis.nonFoodReason && !upload.uploadError && !analysis.analysisError;
    const isReadyForUpload = upload.uploadedImages.length === 0 && !analysis.isAnalyzing && !analysis.hasResult && !analysis.nonFoodReason;

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
            {/* Background elements */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
            <div className="absolute -bottom-1/4 right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>

            <div className="container mx-auto px-4 pt-6 pb-4 relative z-50">
                <div className="flex items-center justify-between">
                    <Link href={`/${locale}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl text-gray-600 hover:text-brand-primary-500 transition-colors border border-gray-200">
                        <ArrowLeft className="w-4 h-4" /> {tCommon('back_to_home')}
                    </Link>
                    <div className="flex items-center gap-3">
                        {isAuthenticated && (
                            <div className="text-sm text-gray-500">
                                {t('scans_remaining')}: <span className="font-bold text-brand-primary-500">{activeTier === 'premium' || activeTier === 'family' ? '∞' : (scansLimit - scansUsed)}</span>
                            </div>
                        )}
                        <LanguageSwitcher currentLocale={locale} />
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6 relative z-10 max-w-4xl">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="hidden" />
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" />

                <div className="text-center mb-6">
                    <h1 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 mb-2">
                        {t('title')}
                    </h1>
                    <p className="text-gray-500 flex items-center justify-center gap-3">
                        <img src="/images/shinny_avatar_explaining.png" alt="Shinny" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                        <span className="font-medium text-lg">{tMascot('scan_tip')}</span>
                    </p>
                </div>

                {isReadyForUpload && (
                    <>
                        <ScanModeSelector selectedMode={scanMode} onSelect={setScanMode} />
                        <ScanUploadArea 
                            scanMode={scanMode}
                            tier={tier}
                            canStillScan={canStillScan}
                            dragOver={upload.dragOver}
                            setDragOver={upload.setDragOver}
                            fileInputRef={fileInputRef}
                            cameraInputRef={cameraInputRef}
                            handleDrop={handleDrop}
                            handleFileInput={handleFileInput}
                            uploadedImages={upload.uploadedImages}
                            onRemoveImage={upload.removeImage}
                            onClearImages={upload.clearImages}
                            onAnalyze={handleAnalyzeTrigger}
                        />
                    </>
                )}

                {isUploading && (
                    <ScanUploadArea 
                        scanMode={scanMode}
                        tier={tier}
                        canStillScan={canStillScan}
                        dragOver={upload.dragOver}
                        setDragOver={upload.setDragOver}
                        fileInputRef={fileInputRef}
                        cameraInputRef={cameraInputRef}
                        handleDrop={handleDrop}
                        handleFileInput={handleFileInput}
                        uploadedImages={upload.uploadedImages}
                        onRemoveImage={upload.removeImage}
                        onClearImages={upload.clearImages}
                        onAnalyze={handleAnalyzeTrigger}
                    />
                )}

                {analysis.isAnalyzing && (
                    <ScanLoadingOverlay 
                        uploadedImages={upload.uploadedImages} 
                        loadingPhase={analysis.loadingPhase} 
                    />
                )}

                {(upload.uploadError || analysis.analysisError) && !analysis.isAnalyzing && (
                    <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 max-w-lg mx-auto shadow-glass text-center animate-bounce-in border-2 border-red-100">
                        <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <img src="/images/shinny_avatar_confused.png" alt="Error" className="w-16 h-16 object-cover rounded-full" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{t('error_title')}</h3>
                        <p className="text-red-500 mb-6 font-medium">{upload.uploadError || analysis.analysisError}</p>
                        
                        {analysis.errorRequestId && (
                            <p className="text-xs text-gray-400 mb-6 font-mono bg-gray-50 inline-block px-3 py-1 rounded-md">
                                Request ID: {analysis.errorRequestId}
                            </p>
                        )}
                        
                        <button onClick={resetScan} className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors">
                            {t('try_again')}
                        </button>
                    </div>
                )}

                {analysis.nonFoodReason && !analysis.isAnalyzing && (
                    <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 max-w-lg mx-auto shadow-glass text-center animate-bounce-in border-2 border-orange-100">
                        <div className="w-48 h-48 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg">
                            <img src={upload.uploadedImages[0]} alt="Not food" className="w-full h-full object-cover filter grayscale opacity-80" />
                        </div>
                        <div className="w-20 h-20 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-4 -mt-16 relative z-10 border-4 border-white shadow-sm">
                            <img src="/images/shinny_avatar_confused.png" alt="Not Food" className="w-16 h-16 object-cover rounded-full" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">{t('not_food_title')}</h3>
                        <p className="text-orange-600 mb-6 font-medium text-lg leading-relaxed bg-orange-50/50 p-4 rounded-xl">
                            &ldquo;{analysis.nonFoodReason}&rdquo;
                        </p>
                        <button onClick={resetScan} className="px-8 py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl shadow-brand hover:shadow-brand-lg transition-all">
                            {t('try_again')}
                        </button>
                    </div>
                )}

                <div className="lg:flex lg:gap-8 lg:items-start max-w-6xl mx-auto">
                    {/* MEAL RESULTS */}
                    {analysis.mealResult && !analysis.isAnalyzing && (
                        <>
                            <div className="lg:sticky lg:top-8 w-full lg:w-1/3 space-y-4 mb-8 lg:mb-0 z-10 animate-slide-up">
                                {upload.uploadedImages.length > 0 && (
                                    <div className="relative backdrop-blur-md bg-white/90 rounded-3xl p-2 shadow-glass overflow-hidden border border-white/40">
                                        {upload.uploadedImages.length === 1 ? (
                                            <img src={upload.uploadedImages[0]} alt="Scan" className="w-full aspect-video md:aspect-square object-cover rounded-2xl shadow-inner" />
                                        ) : (
                                            // Multi-photo scan: show every uploaded photo in a
                                            // 2-column grid so the user sees what was analyzed,
                                            // not just photo #1.
                                            <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden shadow-inner">
                                                {upload.uploadedImages.map((src, i) => (
                                                    <img
                                                        key={i}
                                                        src={src}
                                                        alt={`Scan photo ${i + 1}`}
                                                        className="w-full aspect-square object-cover rounded-lg"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {analysis.overallScore > 0 && (
                                            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl px-3 py-2 shadow-lg flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('score_label')}</span>
                                                <span className={`text-2xl font-black ${(analysis.overallScore ?? 0) >= 80 ? 'text-green-500' : (analysis.overallScore ?? 0) >= 50 ? 'text-brand-secondary-500' : 'text-orange-500'}`}>
                                                    {analysis.overallScore}
                                                </span>
                                            </div>
                                        )}
                                        {analysis.mealResult.confidence < 70 && (
                                            <div className="mt-2 text-center text-xs text-orange-600 font-medium bg-orange-50 py-1.5 rounded-xl">
                                                ⚠️ {t('low_confidence.title')}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="hidden lg:block">
                                    <div className="backdrop-blur-md bg-white/90 p-6 rounded-3xl shadow-glass border border-white/40text-center">
                                        <img src="/images/shinny_avatar_celebrating.png" alt="Shinny" className="w-20 h-20 mx-auto drop-shadow-md pb-4" />
                                        <button onClick={resetScan} className="w-full py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl shadow-brand hover:shadow-brand-lg transition-all">
                                            <Scan className="w-5 h-5 inline mr-2" /> {t('try_again')}
                                        </button>
                                        {analysis.modelUsed && (
                                            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-brand-primary-300">
                                                <Cpu className="w-3 h-3" />
                                                <span>{t('analyzed_by')} {modelDisplayName(analysis.modelUsed)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="w-full lg:w-2/3 space-y-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                                <MealOverview data={analysis.mealResult} />
                                {analysis.mealResult.dishes && analysis.mealResult.dishes.length > 0 && (
                                    <>
                                        <h3 className="text-xl font-bold text-gray-800 ml-2 mb-4 mt-8">{t('dishes_found')}</h3>
                                        <div className="space-y-6">
                                            {analysis.mealResult.dishes.map((dish, i) => {
                                                // Link each dish back to its source photo. Prefer
                                                // the model-supplied `sourcePhotoIndex`; fall back
                                                // to the dish's array index (the prompt enforces
                                                // reading order so they usually agree). Only show
                                                // the thumbnail for multi-photo scans — a single
                                                // photo is already displayed on the left.
                                                const photoIdx = dish.sourcePhotoIndex ?? i;
                                                const photo =
                                                    upload.uploadedImages.length > 1 &&
                                                    photoIdx >= 0 &&
                                                    photoIdx < upload.uploadedImages.length
                                                        ? upload.uploadedImages[photoIdx]
                                                        : undefined;
                                                return (
                                                    <DishCard
                                                        key={i}
                                                        dish={dish}
                                                        index={i}
                                                        totalDishes={analysis.mealResult!.dishes.length}
                                                        photo={photo}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {/* MENU RESULTS */}
                    {analysis.menuResult && !analysis.isAnalyzing && (
                        <div className="space-y-6 animate-slide-up w-full">
                            {upload.uploadedImages.length > 0 && (
                                <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                                            <img src={upload.uploadedImages[0]} alt="Menu" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 flex flex-col justify-center">
                                            <p className="text-sm text-gray-500 font-medium">{t('menu_scan.scanned_label')}</p>
                                            <h2 className="text-2xl font-black text-gray-900">{analysis.menuResult.menuItems.length} {t('menu_scan.items_label')}</h2>
                                            {analysis.menuResult.confidence < 70 && (
                                                <p className="text-xs text-orange-600 mt-1">⚠️ {t('low_confidence.title')}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <MenuResults data={analysis.menuResult} />
                        </div>
                    )}

                    {/* DRINK & SNACK RESULTS */}
                    {analysis.drinkResult && !analysis.isAnalyzing && (
                        <div className="space-y-6 animate-slide-up w-full">
                            {upload.uploadedImages.length > 0 && (
                                <div className="backdrop-blur-md bg-white/90 rounded-3xl p-6 shadow-glass">
                                    <div className="flex flex-col md:flex-row gap-6 items-center">
                                        <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                                            <img src={upload.uploadedImages[0]} alt="Drink/Snack" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1">
                                            {analysis.drinkResult.confidence < 70 && (
                                                <div className="p-2 bg-orange-50 rounded-lg mb-2">
                                                    <p className="text-xs text-orange-600">⚠️ {t('low_confidence.title')}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <DrinkSnackResults data={analysis.drinkResult} />
                        </div>
                    )}
                </div>

                {/* Inline AI Coach Shinny chat — appears once a real
                    result is shown so the user can ask follow-up
                    questions ("can I eat the rice first?", "swap the
                    soda for what?") without leaving the page. Suppressed
                    on the "not food" branch — there is no meal to
                    discuss. */}
                {analysis.hasResult && !analysis.isAnalyzing && !analysis.nonFoodReason && (
                    <ScanResultChat
                        scanMode={scanMode}
                        mealData={analysis.mealResult}
                        menuData={analysis.menuResult}
                        drinkData={analysis.drinkResult}
                        locale={locale}
                        isAuthenticated={isAuthenticated}
                    />
                )}

                {/* Mobile scan again button */}
                {analysis.hasResult && !analysis.isAnalyzing && (
                    <div className="lg:hidden text-center mt-8 pb-8">
                        <div className="mb-4">
                            <img src="/images/shinny_avatar_celebrating.png" alt="Shinny Celebrating" className="w-16 h-16 mx-auto drop-shadow-md animate-bounce-light" />
                        </div>
                        <div className="flex items-center justify-center gap-3">
                            <button onClick={resetScan} className="px-8 py-3 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white font-bold rounded-xl shadow-brand hover:shadow-brand-lg transition-all">
                                <Scan className="w-5 h-5 inline mr-2" /> {t('try_again')}
                            </button>
                        </div>
                        {analysis.modelUsed && (
                            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                                <Cpu className="w-3 h-3" />
                                <span>{t('analyzed_by')} {modelDisplayName(analysis.modelUsed)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Debug Panel */}
                {debug.isDebugMode && debug.debugData && (analysis.hasResult || upload.uploadError || analysis.analysisError) && !analysis.isAnalyzing && (
                    <ScanDebugPanel 
                        debugData={debug.debugData}
                        debugOpen={debug.debugOpen}
                        onToggleDebug={debug.toggleDebug}
                    />
                )}
            </div>
        </div>
    );
}
