import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    // Restrict to the `tests/` tree so Vitest doesn't try to evaluate
    // Next.js server components, which require a more elaborate setup.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // The live edge runtime exposes crypto.subtle via globalThis.crypto; the
    // Node environment vitest uses has had it since 19 — exit early if not.
    setupFiles: ['./tests/setup.ts'],
  },
});
