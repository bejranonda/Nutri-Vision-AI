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
