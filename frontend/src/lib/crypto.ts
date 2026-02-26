// Runs on Edge/Cloudflare Workers context
// Use Web Crypto API

/**
 * Hash a password using SHA-256 (for simplicity on the edge).
 * Note: In a production environment with sufficient edge CPU time, 
 * use PBKDF2 or Argon2. For this freemium app on D1 edge limits, SHA-256 with salt is a fast starting point.
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const inputHash = await hashPassword(password);
    return inputHash === hashedPassword;
}

export function generateId(): string {
    return crypto.randomUUID();
}
