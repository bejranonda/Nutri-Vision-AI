import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Helper to get the Drizzle DB instance connected to Cloudflare D1.
 * 
 * Works in Next.js Server Actions and API Routes running on Cloudflare Pages/Workers.
 * Expects `env.DB` to be bound in wrangler.toml.
 * 
 * @param env The environment variables object from the Cloudflare request context
 */
export function getDb(env: any) {
    if (!env || !env.DB) {
        throw new Error('Database binding "DB" not found in environment. Check wrangler.toml and Cloudflare bindings.');
    }
    return drizzle(env.DB, { schema });
}
