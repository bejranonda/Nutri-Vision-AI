/**
 * Vitest global setup. Asserts Node has the Web Crypto API that our
 * edge-runtime modules assume (crypto.subtle, crypto.getRandomValues,
 * crypto.randomUUID). Node >= 19 ships these under globalThis.crypto;
 * the repo already requires Node >= 18, so this is effectively just a
 * fail-fast for anyone on an older runtime.
 */
if (typeof globalThis.crypto?.subtle?.importKey !== 'function') {
  throw new Error(
    'Web Crypto API not available. These tests require Node >= 19.',
  );
}
