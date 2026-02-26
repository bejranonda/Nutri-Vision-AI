/**
 * crypto.ts — Edge-compatible password hashing using PBKDF2 (Web Crypto API).
 *
 * PBKDF2 is intentionally slow, making brute-force attacks computationally
 * expensive — unlike plain SHA-256 which is fast to iterate.
 *
 * Format stored in DB:  `<iterations>:<salt_hex>:<hash_hex>`
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32; // 256-bit output

function bufToHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBuf(hex: string): Uint8Array {
    const pairs = hex.match(/.{1,2}/g) || [];
    return new Uint8Array(pairs.map((byte) => parseInt(byte, 16)));
}

/**
 * Derive a PBKDF2 key from a password + salt.
 */
async function deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number
): Promise<ArrayBuffer> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    return crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
        keyMaterial,
        HASH_BYTES * 8
    );
}

/**
 * Hash a password with a random salt using PBKDF2.
 * Returns a string in the format `iterations:salt_hex:hash_hex`.
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const hashBuf = await deriveKey(password, salt, PBKDF2_ITERATIONS);
    return `${PBKDF2_ITERATIONS}:${bufToHex(salt.buffer as ArrayBuffer)}:${bufToHex(hashBuf)}`;
}

/**
 * Verify a password against a stored hash string.
 * Supports both new PBKDF2 format and legacy SHA-256 hex strings.
 */
export async function verifyPassword(
    password: string,
    storedHash: string
): Promise<boolean> {
    const parts = storedHash.split(':');

    if (parts.length === 3) {
        // New PBKDF2 format: iterations:salt:hash
        const iterations = parseInt(parts[0], 10);
        const salt = hexToBuf(parts[1]);
        const expectedHash = parts[2];
        const derivedBuf = await deriveKey(password, salt, iterations);
        return bufToHex(derivedBuf) === expectedHash;
    }

    // Legacy SHA-256 fallback (plain hex string, no colons)
    const enc = new TextEncoder();
    const legacyBuf = await crypto.subtle.digest('SHA-256', enc.encode(password));
    return bufToHex(legacyBuf) === storedHash;
}

/**
 * Generate a cryptographically secure random UUID.
 */
export function generateId(): string {
    return crypto.randomUUID();
}
