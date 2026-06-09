/**
 * Extract the raw base64 data portion from a data URI string.
 * e.g., "data:image/jpeg;base64,/9j/4AAQ..." → "/9j/4AAQ..."
 */
export function extractBase64Data(dataUri: string): string {
    const parts = dataUri.split(',');
    return parts.length === 2 ? parts[1] : dataUri;
}

/**
 * Decode a base64 string into a Uint8Array.
 * Edge-safe: uses atob() + Uint8Array rather than Node.js Buffer.
 */
export function decodeBase64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
