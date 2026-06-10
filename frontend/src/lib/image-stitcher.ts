/**
 * Utility to combine multiple images into a single collage on an HTML5 Canvas.
 * This ensures the backend AI inference cost and latency remains low (1 image) 
 * while allowing users to scan multiple items in a single request.
 */
export async function stitchImagesToCanvas(base64Images: string[]): Promise<string> {
    // Filter out empty or invalid entries
    const validImages = base64Images.filter(s => s && s.length > 100);
    if (!validImages || validImages.length === 0) return '';
    if (validImages.length === 1) return validImages[0];

    const loadImg = (src: string): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn('Skipping broken image in collage');
                resolve(null); // Skip broken images instead of failing entire batch
            };
            img.src = src;
        });
    };

    const loadedResults = await Promise.all(validImages.map(loadImg));
    const images = loadedResults.filter((img): img is HTMLImageElement => img !== null);
    if (images.length === 0) throw new Error('No images could be loaded for stitching');
    if (images.length === 1) {
        // Return the SURVIVOR's source, not validImages[0] — if the first
        // image was the broken one, [0] would re-send exactly the data
        // that failed to load.
        const survivorIdx = loadedResults.findIndex((img) => img !== null);
        return validImages[survivorIdx];
    }
    
    // Determine grid columns and rows based on count (max 10)
    let cols = 1, rows = 1;
    const n = images.length;
    
    if (n === 2) { cols = 2; rows = 1; }
    else if (n <= 4) { cols = 2; rows = 2; }
    else if (n <= 6) { cols = 3; rows = 2; }
    else if (n <= 9) { cols = 3; rows = 3; }
    else { cols = 4; rows = 3; } // max 10-12

    // Dynamic target resolution per tile — scale down for low-memory devices
    const isLowMemory = typeof navigator !== 'undefined' && 
        'deviceMemory' in navigator && 
        (navigator as any).deviceMemory < 4;
    const TARGET_CELL_SIZE = isLowMemory ? Math.min(500, Math.floor(1600 / cols)) : 800;
    const PADDING = 20; // White border between photos

    const finalWidth = Math.floor((cols * TARGET_CELL_SIZE) + ((cols + 1) * PADDING));
    const finalHeight = Math.floor((rows * TARGET_CELL_SIZE) + ((rows + 1) * PADDING));

    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        throw new Error('Failed to get 2d context for image stitching');
    }

    // Background color (white borders)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, finalWidth, finalHeight);

    // Draw images with object-fit: cover logic
    images.forEach((img, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;

        const x = PADDING + Math.floor(col * (TARGET_CELL_SIZE + PADDING));
        const y = PADDING + Math.floor(row * (TARGET_CELL_SIZE + PADDING));

        // Object-fit cover math
        const imgRatio = img.width / img.height;
        const cellRatio = 1; // Square cells (800x800)
        
        let sWidth = img.width;
        let sHeight = img.height;
        let sx = 0;
        let sy = 0;

        if (imgRatio > cellRatio) {
            // Image is wider than cell
            sWidth = img.height * cellRatio;
            sx = (img.width - sWidth) / 2;
        } else {
            // Image is taller than cell
            sHeight = img.width / cellRatio;
            sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, TARGET_CELL_SIZE, TARGET_CELL_SIZE);
    });

    return canvas.toDataURL('image/jpeg', 0.85); // 85% quality is a sweet spot for AI and compression
}
