import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function useScanDebug() {
    const searchParams = useSearchParams();
    const isDebugMode = searchParams.get('debug') === '1';
    
    const [debugData, setDebugData] = useState<Record<string, any> | null>(null);
    const [debugOpen, setDebugOpen] = useState(false);

    function toggleDebug() {
        setDebugOpen(prev => !prev);
    }

    return {
        isDebugMode,
        debugData,
        setDebugData,
        debugOpen,
        setDebugOpen,
        toggleDebug
    };
}
