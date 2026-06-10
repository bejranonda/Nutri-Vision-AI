/**
 * /admin layout — enforces admin auth for every page under /admin/*.
 *
 * The gate is in a server component (Next.js app-router: layouts are
 * server components by default), so non-admins never receive any admin
 * HTML — the redirect happens before any markup is emitted.
 *
 * This layout also adds a minimal sidebar-style nav and a "Danger zone"
 * visual treatment so admins can see at a glance they're outside the
 * normal consumer UI.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata = {
  // Explicitly mark admin pages as non-indexable. Belt-and-suspenders:
  // they redirect unauthenticated visitors anyway, but this ensures
  // search engines don't cache any fragment they might see.
  robots: { index: false, follow: false },
};

// Force dynamic rendering for all admin routes. Static-at-build-time
// would bake the wrong auth state into HTML, and admin data is never
// cacheable anyway.
export const dynamic = 'force-dynamic';

const NAV = [
  { href: '', label: 'Overview' },
  { href: '/users', label: 'Users' },
  { href: '/scans', label: 'Scans' },
  { href: '/promo', label: 'Promo codes' },
  { href: '/health', label: 'Health' },
];

export default async function AdminLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const admin = await requireAdmin(locale);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white border-b-4 border-rose-500">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/admin`} className="text-lg font-bold tracking-tight">
              Shinny · Admin
            </Link>
            <span className="text-xs uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-md font-semibold">
              Restricted
            </span>
          </div>
          <div className="text-sm text-slate-300 flex items-center gap-4">
            <span className="hidden md:inline">
              Signed in as <span className="font-medium text-white">{admin.email}</span>
            </span>
            <Link href={`/${locale}`} className="hover:text-white underline decoration-dotted">
              ← back to app
            </Link>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}/admin${item.href}`}
              className="px-3 py-1.5 text-sm font-medium rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
