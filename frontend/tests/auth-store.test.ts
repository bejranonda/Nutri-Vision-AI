/**
 * Unit tests for the client auth store's session-probe lifecycle.
 *
 * These pin the `authChecked` contract that every auth-gated page now
 * depends on. The bug they guard against: pages redirected on the
 * initial `isAuthenticated === false` — the value BEFORE initAuth()
 * resolves — which bounced logged-in users away from /chat (and through
 * a spurious /login detour on /dashboard). The fix made guards wait for
 * `authChecked`. If `authChecked` ever stops flipping to true after a
 * probe, those guards silently break again, so we lock it here.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '@/lib/auth-store';

function resetStore() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    authChecked: false,
    isLoading: false,
    error: null,
  });
}

function mockMe(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })) as unknown as typeof fetch,
  );
}

describe('auth-store session-probe lifecycle', () => {
  beforeEach(() => resetStore());
  afterEach(() => vi.unstubAllGlobals());

  it('starts with authChecked=false (probe has not run yet)', () => {
    expect(useAuthStore.getState().authChecked).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('initAuth resolves authChecked=true + isAuthenticated=true for a logged-in user', async () => {
    mockMe(200, { authenticated: true, user: { id: 'u1', email: 'a@b.co' } });
    await useAuthStore.getState().initAuth();
    const s = useAuthStore.getState();
    expect(s.authChecked).toBe(true);
    expect(s.isAuthenticated).toBe(true);
    expect(s.user?.email).toBe('a@b.co');
  });

  it('initAuth resolves authChecked=true + isAuthenticated=false for an anonymous probe (200, user:null)', async () => {
    // The probe endpoint answers 200 { authenticated:false, user:null }
    // for anonymous visitors (not 401). authChecked must still flip true
    // so guards can act — otherwise an anon user spins forever.
    mockMe(200, { authenticated: false, user: null });
    await useAuthStore.getState().initAuth();
    const s = useAuthStore.getState();
    expect(s.authChecked).toBe(true);
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
  });

  it('initAuth still sets authChecked=true if the probe throws (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch);
    await useAuthStore.getState().initAuth();
    const s = useAuthStore.getState();
    expect(s.authChecked).toBe(true);
    expect(s.isAuthenticated).toBe(false);
  });

  it('initAuth treats a stray non-2xx as unauthenticated but resolved', async () => {
    mockMe(401, { error: 'Not authenticated' });
    await useAuthStore.getState().initAuth();
    const s = useAuthStore.getState();
    expect(s.authChecked).toBe(true);
    expect(s.isAuthenticated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Localized error codes (Round 13)
// ---------------------------------------------------------------------------
//
// Before this, the store exposed only the raw English server message
// (`error`), so a Thai user registering without a voucher saw
// "A voucher code is required to register during the pilot." verbatim.
// The store now derives a stable `errorCode` the UI maps to localized
// Shinny-voice strings; these tests pin the derivation rules.
import { deriveErrorCode } from '@/lib/auth-store';

describe('deriveErrorCode', () => {
  it('prefers the server-provided reason', () => {
    expect(deriveErrorCode(400, { reason: 'voucher_required' })).toBe('voucher_required');
    expect(deriveErrorCode(401, { reason: 'invalid_credentials' })).toBe('invalid_credentials');
  });

  it('falls back to status-class buckets when no reason is present', () => {
    expect(deriveErrorCode(401, {})).toBe('invalid_credentials');
    expect(deriveErrorCode(409, {})).toBe('email_in_use');
    expect(deriveErrorCode(429, {})).toBe('rate_limited');
    expect(deriveErrorCode(500, null)).toBe('server_error');
    expect(deriveErrorCode(503, undefined)).toBe('server_error');
    expect(deriveErrorCode(400, {})).toBe('request_failed');
  });

  it('ignores a non-string reason', () => {
    expect(deriveErrorCode(409, { reason: 42 } as any)).toBe('email_in_use');
  });
});

describe('auth-store errorCode lifecycle', () => {
  beforeEach(() => {
    resetStore();
    useAuthStore.setState({ errorCode: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('login failure (401 + reason) sets errorCode and error, returns false', async () => {
    mockMe(401, { error: 'Invalid email or password', reason: 'invalid_credentials' });
    const ok = await useAuthStore.getState().login('a@b.c', 'wrong');
    expect(ok).toBe(false);
    const s = useAuthStore.getState();
    expect(s.errorCode).toBe('invalid_credentials');
    expect(s.error).toBe('Invalid email or password');
    expect(s.isLoading).toBe(false);
  });

  it('register failure (400 voucher_required) propagates the reason', async () => {
    mockMe(400, { error: 'A voucher code is required to register during the pilot.', reason: 'voucher_required' });
    const ok = await useAuthStore.getState().register('N', 'a@b.c', 'secret123');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().errorCode).toBe('voucher_required');
  });

  it('a non-JSON error body still produces a usable errorCode (no SyntaxError surfaced)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    })) as unknown as typeof fetch);
    const ok = await useAuthStore.getState().login('a@b.c', 'pw');
    expect(ok).toBe(false);
    const s = useAuthStore.getState();
    expect(s.errorCode).toBe('server_error');
    expect(s.error).toBe('Login failed');
  });

  it('network rejection maps to errorCode network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch);
    const ok = await useAuthStore.getState().register('N', 'a@b.c', 'secret123');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().errorCode).toBe('network');
  });

  it('clearError clears both error and errorCode', () => {
    useAuthStore.setState({ error: 'x', errorCode: 'email_in_use' });
    useAuthStore.getState().clearError();
    const s = useAuthStore.getState();
    expect(s.error).toBeNull();
    expect(s.errorCode).toBeNull();
  });
});
