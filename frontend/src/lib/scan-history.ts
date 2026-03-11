/**
 * Client-side scan history — stores recent scans in localStorage
 * for quick reference, debugging, and offline review.
 * 
 * This works independently of auth — even anonymous users get history.
 * Useful for:
 *  - Users reviewing their recent meals without login
 *  - Developers debugging scan results across sessions
 *  - Comparing AI model outputs across different scans
 */

const STORAGE_KEY = 'shinny_scan_history';
const MAX_HISTORY = 10;

export interface ScanHistoryEntry {
    id: string;
    timestamp: string;
    foodName: string;
    confidence: number;
    overallScore: number;
    spikeReduction: number;
    modelUsed: string;
    tip?: string;
    /** Thumbnail — small base64 preview (resized to 100px) */
    thumbnail?: string;
    /** Nutrition summary */
    nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
    /** Debug info — only stored when ?debug=1 was active */
    debug?: {
        requestId?: string;
        timings?: Record<string, number>;
    };
}

/** Get all scan history entries, newest first */
export function getScanHistory(): ScanHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/** Add a new scan to history (auto-trims to MAX_HISTORY) */
export function addScanToHistory(entry: Omit<ScanHistoryEntry, 'id' | 'timestamp'>): void {
    if (typeof window === 'undefined') return;
    try {
        const history = getScanHistory();
        const newEntry: ScanHistoryEntry = {
            ...entry,
            id: Math.random().toString(36).substring(2, 10),
            timestamp: new Date().toISOString(),
        };
        history.unshift(newEntry);
        // Keep only the most recent entries
        const trimmed = history.slice(0, MAX_HISTORY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
        // localStorage full or unavailable — silently ignore
        console.warn('Failed to save scan history:', e);
    }
}

/** Clear all scan history */
export function clearScanHistory(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}

/**
 * Create a small thumbnail from a base64 image for history storage.
 * Resizes to 80x80 to keep localStorage usage minimal (~2-3KB per thumbnail).
 */
export function createThumbnail(base64: string, size = 80): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d')!;
                // Center-crop: fit the shorter dimension
                const scale = Math.max(size / img.width, size / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.5));
            } catch {
                resolve(''); // fallback: no thumbnail
            }
        };
        img.onerror = () => resolve('');
        img.src = base64;
    });
}
