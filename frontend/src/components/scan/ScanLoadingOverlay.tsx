import { useTranslations } from 'next-intl';

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

interface ScanLoadingOverlayProps {
    uploadedImages: string[];
    loadingPhase: number;
}

export default function ScanLoadingOverlay({ uploadedImages, loadingPhase }: ScanLoadingOverlayProps) {
    const t = useTranslations('scan');
    const phases = uploadedImages.length > 1 ? LOADING_PHASES_MULTI : LOADING_PHASES_SINGLE;

    return (
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
                {phases.map((phase, i) => (
                    <div key={phase.key} className={`flex items-center justify-center gap-2 text-sm transition-all duration-500 ${loadingPhase >= i ? 'text-gray-700 opacity-100' : 'text-gray-300 opacity-50'}`}>
                        <span>{phase.emoji}</span>
                        <span className="font-medium">{t(`loading_phases.${phase.key}`)}</span>
                        {loadingPhase === i && <span className="inline-block w-4 h-4 border-2 border-brand-primary-400 border-t-transparent rounded-full animate-spin"></span>}
                        {loadingPhase > i && <span className="text-green-500">✓</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
