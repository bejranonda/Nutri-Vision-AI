import { NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
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
        const isCloudflareRuntime = env !== (process.env as unknown);

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

        // Surface the Cloudflare Pages deployment metadata that the
        // platform sets at build time. Bug-hunt May 2026: deployment
        // freshness was previously only verifiable by behavioural probes
        // (does `modelUsed` reflect the post-PR shape?). Surfacing the
        // commit SHA directly lets operators and CI verify "is the
        // current deploy the commit I think it is?" in one curl. Keys
        // come from CF Pages build env — see
        //   https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables
        const sha = (env as any)?.CF_PAGES_COMMIT_SHA || null;
        const branch = (env as any)?.CF_PAGES_BRANCH || null;
        const pagesUrl = (env as any)?.CF_PAGES_URL || null;

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
            // Deployment metadata. Fields are null in local dev (env
            // vars only set by Cloudflare Pages at build time); null
            // is the correct sentinel for "not running on Pages".
            deployment: {
                sha,
                shaShort: sha ? String(sha).slice(0, 7) : null,
                branch,
                pagesUrl,
            },
            // NEXT_PUBLIC_APP_VERSION is inlined from package.json at build
            // time (next.config.js); npm_package_version is only set when
            // running via npm scripts, which isn't the case in the
            // Cloudflare runtime — hence the previous "unknown".
            version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || 'unknown',
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

        return jsonResponse(response, {
            status: status === 'healthy' ? 200 : 503,
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error: any) {
        return jsonResponse({
            status: 'error',
            timestamp: new Date().toISOString(),
            latencyMs: Date.now() - startTime,
            error: error.message,
        }, { status: 500 });
    }
}
