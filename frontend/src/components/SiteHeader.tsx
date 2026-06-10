'use client';

/**
 * SiteHeader — the persistent top-of-page nav bar.
 *
 * UX-audit Round 7 (subagent #5) caught that only the homepage shipped
 * a real header. Every other page (scan, login, pricing, demo,
 * recipes) degraded to a single "Back to home" link, dropping
 * navigation predictability entirely. This component fixes that —
 * one nav, every page, same items in the same order.
 *
 * Brand mark + 3 primary nav links + LanguageSwitcher + Login CTA on
 * desktop; brand mark + hamburger drawer on mobile. Mirrors the
 * design that lived inline in `/[locale]/page.tsx` so visually
 * nothing changes for the homepage; the OTHER pages gain consistency.
 *
 * Auth-aware: when a session exists, the right-hand "Login" button
 * swaps to "Dashboard" so the nav reflects state instead of always
 * inviting login. Reads from the same Zustand auth store the rest of
 * the app uses — initAuth() runs on mount so a stale state doesn't
 * flash the wrong button.
 *
 * NOT included intentionally:
 *   - Hamburger close-on-route-change: client-side navigation triggers
 *     a re-render but next/link doesn't unmount this component, so we
 *     close the drawer manually in each onClick handler.
 *   - Scroll-aware shadow / sticky behaviour: the homepage's existing
 *     header is not sticky; matching that for consistency. Add later
 *     if product wants a sticky variant.
 */
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Utensils, Menu, X } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useAuthStore } from '@/lib/auth-store';

interface SiteHeaderProps {
  locale: string;
}

export default function SiteHeader({ locale }: SiteHeaderProps) {
  const tBrand = useTranslations('brand');
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { isAuthenticated, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const closeMenu = () => setMobileMenuOpen(false);

  // Right-side CTA: Dashboard for logged-in users, Login for everyone
  // else. The label + href flip together so nav never lies about state.
  // `?mode=login` makes the auth page open on the Login tab — this CTA
  // is labelled "Log in", so landing on the register-default tab would
  // contradict the label (Round 13).
  const rightCtaHref = isAuthenticated ? `/${locale}/dashboard` : `/${locale}/login?mode=login`;
  const rightCtaLabel = isAuthenticated ? tNav('dashboard') : tAuth('login');

  return (
    <header className="container mx-auto px-4 py-4 md:py-6 relative z-50 backdrop-blur-md bg-white/70 rounded-b-3xl mb-8 shadow-glass">
      <nav className="flex items-center justify-between">
        {/* Brand mark */}
        <Link href={`/${locale}`} className="flex items-center space-x-3 group">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 rounded-2xl flex items-center justify-center shadow-brand transform group-hover:rotate-6 transition-transform">
            <Utensils className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <span className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500">
              {tBrand('name')}
            </span>
            <p className="text-xs text-brand-neutral/60 font-medium hidden sm:block">{tBrand('tagline')}</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center space-x-6">
          <Link href={`/${locale}/scan`} className="text-gray-700 hover:text-brand-primary-500 font-medium transition-colors">
            {tNav('scan')}
          </Link>
          <Link href={`/${locale}/recipes`} className="text-gray-700 hover:text-brand-primary-500 font-medium transition-colors">
            {tNav('recipes')}
          </Link>
          <Link href={`/${locale}/pricing`} className="text-gray-700 hover:text-brand-primary-500 font-medium transition-colors">
            {tNav('pricing')}
          </Link>
          <LanguageSwitcher currentLocale={locale} />
          <Link
            href={rightCtaHref}
            className="group relative px-6 py-2.5 font-semibold text-white rounded-xl overflow-hidden shadow-brand hover:shadow-brand-lg transition-shadow"
          >
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-brand-primary-400 via-brand-secondary-400 to-brand-accent-400"></span>
            <span className="relative">{rightCtaLabel}</span>
          </Link>
        </div>

        {/* Mobile cluster */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSwitcher currentLocale={locale} />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? tNav('close_menu') : tNav('open_menu')}
            aria-expanded={mobileMenuOpen}
            className="p-2 rounded-xl bg-white/80 border border-gray-200 shadow-sm"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-gray-200/50 flex flex-col gap-3 animate-slide-up">
          <Link href={`/${locale}/scan`} onClick={closeMenu} className="text-gray-700 hover:text-brand-primary-500 font-medium transition-colors py-2">
            {tNav('scan')}
          </Link>
          <Link href={`/${locale}/recipes`} onClick={closeMenu} className="text-gray-700 hover:text-brand-primary-500 font-medium transition-colors py-2">
            {tNav('recipes')}
          </Link>
          <Link href={`/${locale}/pricing`} onClick={closeMenu} className="text-gray-700 hover:text-brand-primary-500 font-medium transition-colors py-2">
            {tNav('pricing')}
          </Link>
          <Link
            href={rightCtaHref}
            onClick={closeMenu}
            className="text-center px-6 py-2.5 font-semibold text-white rounded-xl bg-gradient-to-r from-brand-primary-400 via-brand-secondary-400 to-brand-accent-400 shadow-brand"
          >
            {rightCtaLabel}
          </Link>
        </div>
      )}
    </header>
  );
}
