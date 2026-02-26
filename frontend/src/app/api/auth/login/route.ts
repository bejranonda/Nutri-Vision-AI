import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/crypto';
import { createSession } from '@/lib/session';
import { eq } from 'drizzle-orm';


export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
        }

        const env = (req as any).context?.env || process.env;
        const db = getDb(env);

        const foundUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = foundUsers[0];

        if (!user || !(await verifyPassword(password, user.hashedPassword!))) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Create a new session and HTTP-Only cookie
        await createSession(env, user.id);

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                subscriptionTier: user.subscriptionTier,
                scansThisMonth: user.scansThisMonth,
                totalPoints: user.totalPoints,
                streakDays: user.streakDays
            },
            message: 'Logged in successfully'
        }, { status: 200 });

    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
