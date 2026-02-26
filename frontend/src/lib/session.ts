import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from './crypto';

const SESSION_COOKIE_NAME = 'eatinorder_session';

export async function createSession(env: any, userId: string): Promise<string> {
    const db = getDb(env);

    // Gen session token
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

export async function clearSession(env: any) {
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
