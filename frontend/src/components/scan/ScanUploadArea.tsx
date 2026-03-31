import React from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Camera, Sparkles, Lock, X } from 'lucide-react';
import { TIER_LIMITS, canAddMorePhotos } from '@/lib/tier-config';

interface ScanUploadAreaProps {
    scanMode: string;
    tier: string;
    canStillScan: boolean;
    dragOver: boolean;
    setDragOver: (val: boolean) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    cameraInputRef: React.RefObject<HTMLInputElement>;
    handleDrop: (e: React.DragEvent) => void;
    handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploadedImages: string[];
    onRemoveImage: (index: number) => void;
    onClearImages: () => void;
    onAnalyze: () => void;
}

export default function ScanUploadArea({
    scanMode,
    tier,
    canStillScan,
    dragOver,
    setDragOver,
    fileInputRef,
    cameraInputRef,
    handleDrop,
    handleFileInput,
    uploadedImages,
    onRemoveImage,
    onClearImages,
    onAnalyze
}: ScanUploadAreaProps) {
    const t = useTranslations('scan');
    const uploadHint = t(`scan_modes.${scanMode}.upload_hint`);
    const activeTier = (tier as 'free' | 'premium' | 'family') || 'free';

    if (uploadedImages.length > 0) {
        return (
            <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 max-w-xl mx-auto shadow-glass animate-bounce-in border border-white/40">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">{uploadedImages.length} {t('multi_photo.photos_selected', { count: uploadedImages.length })}</h2>
                    <p className="text-sm text-gray-500">{uploadedImages.length}/{TIER_LIMITS[activeTier].maxPhotosPerScan}</p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                    {uploadedImages.map((img, idx) => (
                        <div key={idx} className="aspect-square rounded-2xl overflow-hidden shadow-md relative group">
                            <img src={img} alt={`Upload ${idx+1}`} className="w-full h-full object-cover" />
                            <button
                                onClick={() => onRemoveImage(idx)}
                                className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                aria-label={t('multi_photo.remove_photo')}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                {canAddMorePhotos(activeTier, uploadedImages.length) ? (
                    <div className="flex flex-col items-center justify-center gap-3 mb-8 bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium">{t('multi_photo.add_another')} ({uploadedImages.length}/{TIER_LIMITS[activeTier].maxPhotosPerScan})</p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white text-sm font-semibold rounded-xl shadow-sm transition-all hover:shadow-md"
                            >
                                <Camera className="w-4 h-4" /> {t('take_photo')}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
                            >
                                <Upload className="w-4 h-4" /> {t('upload')}
                            </button>
                        </div>
                        {activeTier === 'free' && (
                            <p className="text-xs text-brand-primary-500 mt-2 font-medium">
                                <Lock className="w-3 h-3 inline mr-1" /> {t('multi_photo.upgrade_hint')}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-brand-accent-600 mb-8 bg-brand-accent-50 py-2 rounded-xl text-center px-4 font-medium">
                        {t('multi_photo.max_reached', { max: TIER_LIMITS[activeTier].maxPhotosPerScan })}
                    </p>
                )}
                
                <div className="flex gap-4 max-w-md mx-auto">
                    <button onClick={onClearImages} className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                        {t('multi_photo.cancel')}
                    </button>
                    <button onClick={onAnalyze} className="flex-[2] px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 shadow-brand hover:shadow-brand-lg transition-all flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5" /> {t('multi_photo.analyze_now')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`backdrop-blur-md bg-white/80 rounded-3xl p-8 md:p-16 max-w-lg mx-auto shadow-glass text-center transition-all duration-300 ${dragOver ? 'ring-4 ring-brand-primary-400 scale-105 bg-brand-primary-50/60' : 'hover:-translate-y-2 hover:shadow-glass-hover'} ${!canStillScan ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-brand-primary-100 to-brand-secondary-100 rounded-3xl flex items-center justify-center mb-6 cursor-pointer" onClick={() => canStillScan && fileInputRef.current?.click()}>
                <Upload className="w-12 h-12 text-brand-primary-400" />
            </div>
            <p className="text-lg font-semibold text-gray-700 mb-2">{t('drag_drop')}</p>
            <p className="text-gray-400 mb-2">{t('or_click')}</p>
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
    );
}
