import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Get the Cloudflare environment bindings (AI, DB, KV, R2, etc.).
 *
 * This is the ONLY approved way to access Cloudflare bindings in API routes.
 * Never use `(req as any).context?.env` — it silently returns `undefined`.
 *
 * @returns The env object containing all configured bindings from wrangler.toml
 * @throws If getCloudflareContext() fails (should not happen in Cloudflare runtime)
 */
export async function getEnv(): Promise<any> {
    const { env } = await getCloudflareContext();
    return env;
}

/**
 * Get the Cloudflare environment bindings with a fallback to process.env.
 * Use this in routes where a missing binding should NOT crash the request
 * (e.g., the food scan route allows anonymous usage without DB).
 *
 * @returns The env object, or process.env as fallback
 */
export async function getEnvSafe(): Promise<any> {
    try {
        return await getEnv();
    } catch {
        return process.env;
    }
}
