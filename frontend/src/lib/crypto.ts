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
 * Constant-time byte comparison — no early-out on the first mismatch,
 * so the total runtime does not depend on *where* two buffers differ.
 *
 * We can't use Node's `crypto.timingSafeEqual` because this module runs
 * on the Cloudflare Workers edge runtime, which exposes only the Web
 * Crypto API. The XOR-accumulator pattern below is the standard
 * workaround and produces truly constant-time behaviour for equal-length
 * inputs. Unequal lengths return false but still walk the longer array
 * so the timing doesn't leak the length boundary either.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    const len = Math.max(a.length, b.length);
    let diff = a.length ^ b.length; // non-zero if lengths differ
    for (let i = 0; i < len; i++) {
        // Reading past the end of the shorter buffer returns undefined;
        // coerce to 0 so we still do the full loop.
        diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    return diff === 0;
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
 *
 * Uses `constantTimeEqual` on the raw bytes (not hex strings) so the
 * comparison never short-circuits on the first differing byte — this
 * closes a timing side-channel that could let an attacker probe the
 * hash byte-by-byte.
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
        const expected = hexToBuf(parts[2]);
        const derivedBuf = await deriveKey(password, salt, iterations);
        return constantTimeEqual(new Uint8Array(derivedBuf), expected);
    }

    // Legacy SHA-256 fallback (plain hex string, no colons).
    // Kept for backward compatibility with any pre-PBKDF2 users — should
    // be retired after a migration window; see CHANGELOG.
    const enc = new TextEncoder();
    const legacyBuf = await crypto.subtle.digest('SHA-256', enc.encode(password));
    return constantTimeEqual(new Uint8Array(legacyBuf), hexToBuf(storedHash));
}

/**
 * Generate a cryptographically secure random UUID.
 */
export function generateId(): string {
    return crypto.randomUUID();
}
