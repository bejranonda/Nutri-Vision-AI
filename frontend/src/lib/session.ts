import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { sessions } from '@/db/schema';
import { eq, lt, and } from 'drizzle-orm';
import { generateId } from './crypto';
import type { CloudflareEnv } from './cloudflare';

const SESSION_COOKIE_NAME = 'shinnyguide_session';

export async function createSession(env: CloudflareEnv, userId: string): Promise<string> {
    const db = getDb(env);

    // Gen session token (2x UUID = 72 chars of cryptographic entropy)
    const token = generateId() + generateId();

    // Expire in 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Insert into DB
    await db.insert(sessions).values({
        id: generateId(),
        userId,
        token,
        expiresAt,
        createdAt: new Date()
    });

    // Lazy cleanup: remove expired sessions for this user (limit impact)
    try {
        await db.delete(sessions).where(
            and(
                eq(sessions.userId, userId),
                lt(sessions.expiresAt, new Date())
            )
        );
    } catch {
        // Non-critical — don't fail login if cleanup fails
    }

    // Set HTTP-only cookie
    cookies().set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/'
    });

    return token;
}

export async function getSessionToken(): Promise<string | undefined> {
    const cookieStore = cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function clearSession(env: CloudflareEnv) {
    const token = await getSessionToken();
    if (token) {
        try {
            const db = getDb(env);
            await db.delete(sessions).where(eq(sessions.token, token));
        } catch (e) {
            console.error('Failed to clear session DB record', e);
        }
    }

    cookies().delete(SESSION_COOKIE_NAME);
}
