import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import type { CloudflareEnv } from '@/lib/cloudflare';

/**
 * Helper to get the Drizzle DB instance connected to Cloudflare D1.
 * 
 * Works in Next.js Server Actions and API Routes running on Cloudflare Pages/Workers.
 * Expects `env.DB` to be bound in wrangler.toml.
 * 
 * @param env The Cloudflare environment bindings object
 */
export function getDb(env: CloudflareEnv) {
    if (!env || !env.DB) {
        throw new Error('Database binding "DB" not found in environment. Check wrangler.toml and Cloudflare bindings.');
    }
    return drizzle(env.DB, { schema });
}
