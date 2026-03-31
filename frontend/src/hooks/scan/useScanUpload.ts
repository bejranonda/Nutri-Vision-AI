import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TIER_LIMITS } from '@/lib/tier-config';
import { logger } from '@/lib/logger';

export function useScanUpload({ tier, onReset }: { tier: string, onReset: () => void }) {
    const t = useTranslations('scan');
    
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const activeTier = (tier as 'free' | 'premium' | 'family') || 'free';
    const limitParams = TIER_LIMITS[activeTier];

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

    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    const MIN_FILE_SIZE = 500;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp'];

    async function processMultipleFiles(files: File[], requiresReset: boolean) {
        if (files.length === 0) return;

        let currentCount = uploadedImages.length;
        if (requiresReset) {
            onReset();
            currentCount = 0;
            setUploadedImages([]);
            setUploadError(null);
        }

        const maxPhotos = limitParams.maxPhotosPerScan;
        const availableSlots = maxPhotos - currentCount;
        
        if (availableSlots <= 0) return;

        let invalidCount = 0;
        let lastErrorMsg = '';
        const validFiles = files.filter(file => {
            if (!file.type.startsWith('image/')) {
                lastErrorMsg = t('error_message');
                invalidCount++; return false;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                lastErrorMsg = `Unsupported format: ${file.type}`;
                invalidCount++; return false;
            }
            if (file.size > MAX_FILE_SIZE) {
                lastErrorMsg = `File too large (${(file.size/1024/1024).toFixed(1)}MB)`;
                invalidCount++; return false;
            }
            if (file.size < MIN_FILE_SIZE) {
                lastErrorMsg = t('error_message');
                invalidCount++; return false;
            }
            return true;
        }).slice(0, availableSlots);

        if (invalidCount > 0) {
            setUploadError(files.length === 1 ? lastErrorMsg : `Skipped ${invalidCount} unsupported/oversized file(s).`);
            if (validFiles.length === 0) return;
        }

        // Process sequentially
        for (const file of validFiles) {
            try {
                await new Promise(r => setTimeout(r, 15)); // Yield to paint

                const rawBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                
                let compressed: string;
                try {
                    compressed = await compressImage(rawBase64, 1200, 0.85);
                } catch {
                    compressed = rawBase64; 
                }
                
                setUploadedImages(current => {
                    if (current.length >= maxPhotos) return current;
                    return [...current, compressed];
                });
            } catch (err) {
                logger.error('Error processing valid file', err);
            }
        }
    }

    function removeImage(index: number) {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
    }

    function clearImages() {
        setUploadedImages([]);
        setUploadError(null);
    }

    return {
        uploadedImages,
        dragOver,
        setDragOver,
        uploadError,
        setUploadError,
        processMultipleFiles,
        removeImage,
        clearImages
    };
}
