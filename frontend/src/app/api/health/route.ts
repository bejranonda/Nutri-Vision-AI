import { NextResponse } from 'next/server';
import { getEnvSafe } from '@/lib/cloudflare';

/**
 * GET /api/health — Deployment verification endpoint
 * 
 * Checks availability of critical bindings (AI, DB, Google API key)
 * WITHOUT making any expensive API calls. Returns a structured status
 * object useful for monitoring, CI/CD health checks, and debugging
 * deploy issues.
 * 
 * Usage:
 *   curl https://your-domain.com/api/health
 *   curl https://your-domain.com/api/health?verbose=1  (includes env key list)
 */
export async function GET(req: Request) {
    const startTime = Date.now();
    const url = new URL(req.url);
    const verbose = url.searchParams.get('verbose') === '1';

    try {
        const env = await getEnvSafe();

        const hasAI = !!env?.AI;
        const hasDB = !!env?.DB;
        const hasGoogleKey = !!(env?.GOOGLE_AI_API_KEY || env?.GEMINI_API_KEY);
        const isCloudflareRuntime = env !== process.env;

        // DB connectivity check (lightweight — just tests the binding, no actual query)
        let dbStatus = 'unconfigured';
        if (hasDB) {
            try {
                // D1 binding exists; actual query would be needed for deeper check
                dbStatus = 'binding_ok';
            } catch {
                dbStatus = 'binding_error';
            }
        }

        const status = hasAI || hasGoogleKey ? 'healthy' : 'degraded';

        const response: Record<string, any> = {
            status,
            timestamp: new Date().toISOString(),
            latencyMs: Date.now() - startTime,
            services: {
                ai: {
                    cloudflare: hasAI ? 'available' : 'unavailable',
                    google: hasGoogleKey ? 'configured' : 'unconfigured',
                    canAnalyze: hasAI || hasGoogleKey,
                },
                database: dbStatus,
                runtime: isCloudflareRuntime ? 'cloudflare' : 'node',
            },
            version: process.env.npm_package_version || 'unknown',
        };

        // Verbose mode: include safe env keys for debugging deploy issues
        if (verbose) {
            const sensitivePatterns = ['TOKEN', 'SECRET', 'PASSWORD', 'KEY', 'CREDENTIAL', 'AUTH', 'APIKEY', 'API_KEY'];
            const safeKeys = Object.keys(env || {}).filter(k =>
                !sensitivePatterns.some(p => k.toUpperCase().includes(p))
            );
            response.debug = {
                envKeys: safeKeys,
                nodeVersion: process.version,
            };
        }

        return NextResponse.json(response, {
            status: status === 'healthy' ? 200 : 503,
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            latencyMs: Date.now() - startTime,
            error: error.message,
        }, { status: 500 });
    }
}
