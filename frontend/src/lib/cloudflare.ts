import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Typed Cloudflare environment bindings.
 * Matches the bindings configured in wrangler.toml.
 */
export interface CloudflareEnv {
    /** Cloudflare Workers AI binding */
    AI: {
        run(model: string, input: Record<string, any>): Promise<any>;
    };
    /** Cloudflare D1 database binding */
    DB: any; // D1Database — Drizzle handles the detailed typing
    /** Google AI API key for fallback inference */
    GOOGLE_AI_API_KEY?: string;
    /** Alternative key name for Google AI */
    GEMINI_API_KEY?: string;
    /** Any additional environment variables */
    [key: string]: any;
}

/**
 * Get the Cloudflare environment bindings (AI, DB, KV, R2, etc.).
 *
 * This is the ONLY approved way to access Cloudflare bindings in API routes.
 * Never use `(req as any).context?.env` — it silently returns `undefined`.
 *
 * @returns The env object containing all configured bindings from wrangler.toml
 * @throws If getCloudflareContext() fails (should not happen in Cloudflare runtime)
 */
export async function getEnv(): Promise<CloudflareEnv> {
    const { env } = await getCloudflareContext();
    return env as CloudflareEnv;
}

/**
 * Get the Cloudflare environment bindings with a fallback to process.env.
 * Use this in routes where a missing binding should NOT crash the request
 * (e.g., the food scan route allows anonymous usage without DB).
 *
 * @returns The env object, or process.env as fallback
 */
export async function getEnvSafe(): Promise<CloudflareEnv> {
    try {
        return await getEnv();
    } catch {
        return process.env as unknown as CloudflareEnv;
    }
}
