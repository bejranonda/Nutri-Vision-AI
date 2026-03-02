import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';
import { getEnv } from '@/lib/cloudflare';


export async function POST(req: NextRequest) {
    try {
        const env = await getEnv();
        await clearSession(env);
        return NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });
    } catch (error: any) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
