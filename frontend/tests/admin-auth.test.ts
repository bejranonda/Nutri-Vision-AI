/**
 * Unit tests for lib/admin-auth.ts.
 *
 * We can't spin up Cloudflare D1 or Next.js server context in Vitest,
 * so the strategy here is to test the helper's BEHAVIOUR via mocking
 * its DB/session dependencies. The production safety of requireAdmin
 * comes from three facts we verify:
 *
 *   1. No session token → null (never throws).
 *   2. Expired session → null (the gt(expiresAt, now) guard).
 *   3. Valid session but user.isAdmin === false → null + a WARN log
 *      entry tagged [ADMIN_GATE].
 *   4. Valid session + user.isAdmin === true → returns a typed AdminUser.
 *
 * Mocking Next.js server imports in ESM requires hoist-safe vi.mock()
 * calls. The mocks live at the top of the file.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// -- Hoisted mocks. vi.mock() factories run before top-level `const`,
// -- so the shared mock fns must live inside vi.hoisted() to be
// -- available when the mock factory is evaluated.
const {
  mockGetSessionToken,
  mockGetEnvSafe,
  mockGetDb,
  mockLogger,
} = vi.hoisted(() => ({
  mockGetSessionToken: vi.fn(),
  mockGetEnvSafe: vi.fn(),
  mockGetDb: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({
  getSessionToken: () => mockGetSessionToken(),
}));
vi.mock('@/lib/cloudflare', () => ({
  getEnvSafe: () => mockGetEnvSafe(),
}));
vi.mock('@/db', () => ({
  getDb: () => mockGetDb(),
}));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

// Import AFTER mocks are registered.
import { getCurrentAdminUser, requireAdmin, requireAdminApi } from '@/lib/admin-auth';

// Helper to build a fluent-chain mock that answers .select().from().where().limit()
// with a given row set. The real Drizzle query builder returns a Promise.
function mkDb(sessionRows: any[], userRows: any[]) {
  let callNo = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            // Two consecutive .select chains are made: session lookup, then user lookup.
            callNo += 1;
            return callNo === 1 ? Promise.resolve(sessionRows) : Promise.resolve(userRows);
          },
        }),
      }),
    }),
  };
}

beforeEach(() => {
  mockGetSessionToken.mockReset();
  mockGetEnvSafe.mockReset();
  mockGetDb.mockReset();
  mockLogger.info.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.error.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getCurrentAdminUser
// ---------------------------------------------------------------------------
describe('getCurrentAdminUser', () => {
  it('returns null when no session cookie is present', async () => {
    mockGetSessionToken.mockResolvedValue(undefined);
    expect(await getCurrentAdminUser()).toBeNull();
  });

  it('returns null when env lookup throws', async () => {
    mockGetSessionToken.mockResolvedValue('abc');
    mockGetEnvSafe.mockRejectedValue(new Error('no binding'));
    expect(await getCurrentAdminUser()).toBeNull();
  });

  it('returns null for expired / invalid session (no matching row)', async () => {
    mockGetSessionToken.mockResolvedValue('abc');
    mockGetEnvSafe.mockResolvedValue({});
    mockGetDb.mockReturnValue(mkDb([], []));
    expect(await getCurrentAdminUser()).toBeNull();
  });

  it('returns null and logs WARN when user exists but is not admin', async () => {
    mockGetSessionToken.mockResolvedValue('abc');
    mockGetEnvSafe.mockResolvedValue({});
    mockGetDb.mockReturnValue(
      mkDb(
        [{ userId: 'u1' }],
        [{ id: 'u1', email: 'a@b.co', displayName: 'A', subscriptionTier: 'free', isAdmin: false }],
      ),
    );
    const result = await getCurrentAdminUser();
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[ADMIN_GATE] Non-admin attempted admin access',
      expect.objectContaining({ email: 'a@b.co' }),
    );
  });

  it('returns a typed AdminUser when user.isAdmin === true', async () => {
    mockGetSessionToken.mockResolvedValue('abc');
    mockGetEnvSafe.mockResolvedValue({});
    mockGetDb.mockReturnValue(
      mkDb(
        [{ userId: 'u1' }],
        [
          {
            id: 'u1',
            email: 'admin@x.co',
            displayName: 'Admin',
            subscriptionTier: 'family',
            isAdmin: true,
          },
        ],
      ),
    );
    const result = await getCurrentAdminUser();
    expect(result).toEqual({
      id: 'u1',
      email: 'admin@x.co',
      displayName: 'Admin',
      subscriptionTier: 'family',
      isAdmin: true,
    });
    // WARN is ONLY emitted for non-admin misses; admin success must not warn.
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireAdmin (page gate)
// ---------------------------------------------------------------------------
describe('requireAdmin', () => {
  it('redirects to /login when user is not admin', async () => {
    mockGetSessionToken.mockResolvedValue(undefined);
    // redirect() throws in our mock so we can assert the URL.
    await expect(requireAdmin('th')).rejects.toThrow('REDIRECT:/th/login');
  });

  it('returns the admin user when authorised', async () => {
    mockGetSessionToken.mockResolvedValue('abc');
    mockGetEnvSafe.mockResolvedValue({});
    mockGetDb.mockReturnValue(
      mkDb(
        [{ userId: 'u1' }],
        [{ id: 'u1', email: 'a@x', displayName: null, subscriptionTier: null, isAdmin: true }],
      ),
    );
    const admin = await requireAdmin('en');
    expect(admin.isAdmin).toBe(true);
    expect(admin.email).toBe('a@x');
  });
});

// ---------------------------------------------------------------------------
// requireAdminApi (API gate — returns union, never throws)
// ---------------------------------------------------------------------------
describe('requireAdminApi', () => {
  it('returns { response } with 401 when not admin', async () => {
    mockGetSessionToken.mockResolvedValue(undefined);
    const gate = await requireAdminApi();
    expect('response' in gate).toBe(true);
    if ('response' in gate) {
      expect(gate.response.status).toBe(401);
    }
  });

  it('returns { user } when authorised', async () => {
    mockGetSessionToken.mockResolvedValue('abc');
    mockGetEnvSafe.mockResolvedValue({});
    mockGetDb.mockReturnValue(
      mkDb(
        [{ userId: 'u1' }],
        [{ id: 'u1', email: 'admin@x', displayName: 'A', subscriptionTier: 'family', isAdmin: true }],
      ),
    );
    const gate = await requireAdminApi();
    expect('user' in gate).toBe(true);
    if ('user' in gate) {
      expect(gate.user.email).toBe('admin@x');
    }
  });
});
