'use client';

import React, { useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Scan, Sparkles, HeartPulse, ChevronRight, ChevronDown, Award, Flame, Utensils } from 'lucide-react';
import { logger } from '@/lib/logger';
import SiteHeader from '@/components/SiteHeader';

export default function HomePage() {
  const t = useTranslations('home');
  const tMascot = useTranslations('mascot');
  const tGamify = useTranslations('gamification');
  const locale = useLocale();

  useEffect(() => {
    logger.trackFeature('Landing Page', 'success', { locale });
  }, [locale]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
      <div className="absolute top-1/4 -right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute -bottom-1/4 left-1/4 w-1/2 h-1/2 bg-brand-accent-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '4s' }}></div>

      {/*
        Header extracted into <SiteHeader/> in iter 3 so every page
        gets the same nav. The inline JSX that used to live here
        moved verbatim into `src/components/SiteHeader.tsx`; this
        line keeps the homepage looking identical while sharing the
        component with /scan, /login, /pricing, /demo, /recipes.
      */}
      <SiteHeader locale={locale} />

      {/* Round-11 a11y: <main> landmark for screen readers — gives
          assistive tech a "skip to content" target after the nav. */}
      <main>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center relative z-10">
        {/* Mascot Greeting */}
        <div className="mb-8 animate-bounce-in">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-brand-primary-100 to-brand-secondary-100 text-brand-primary-600 font-medium shadow-glass">
            <img src="/images/shinny_avatar.png" alt="Shinny" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
            <span className="text-lg">{tMascot('greeting')}</span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-success/20 text-green-700 font-medium mb-6 animate-bounce-light">
          <Sparkles className="w-4 h-4" />
          <span>{t('concept_badge')}</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-gray-900 mb-4 tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500">{t('title')}</span>
        </h1>
        <p className="text-xl md:text-2xl text-brand-primary-500 font-semibold mb-4">
          {t('subtitle')}
        </p>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('description')}
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href={`/${locale}/scan`}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 text-white text-lg font-bold rounded-2xl hover:scale-105 transition-all shadow-brand-lg"
          >
            <Scan className="w-5 h-5" />
            {t('cta')} <ChevronRight className="w-5 h-5" />
          </Link>
          <Link
            href={`/${locale}/demo`}
            className="flex items-center justify-center px-8 py-4 backdrop-blur-sm bg-white/80 text-brand-primary-600 text-lg font-bold rounded-2xl hover:bg-white transition-all border-2 border-brand-primary-200"
          >
            {t('demo')}
          </Link>
        </div>
        {/*
          Fresh-user reassurance — addresses the "is this free? do I
          need to sign up?" question that the May 2026 UX-audit
          subagents flagged as the homepage's biggest unspoken
          objection. Sits right under the primary CTA so the answer
          arrives at the moment the user is deciding whether to click.
        */}
        <p className="mt-4 text-sm text-gray-600">
          {t('free_no_signup')}
        </p>
      </section>

      {/* Concept Section: อร่อย ตาม ลำดับ */}
      <section className="container mx-auto px-4 py-10 relative z-10">
        <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 md:p-12 max-w-5xl mx-auto shadow-glass transform hover:-translate-y-2 transition-transform duration-300">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500 mb-4">
              {t('concept.title')}
            </h2>
            <p className="text-gray-600 text-lg mb-2">
              {t('concept.description')}
            </p>
            <p className="text-xl font-bold text-brand-primary-500">
              {t('concept.sequence_short')}
            </p>
            <p className="text-sm text-brand-success font-semibold mt-2">
              📉 {t('concept.spike_reduction')}
            </p>
            {/*
              UX-audit iter 9: "Up to 70% spike reduction" used to
              float as a headline number with zero source. Honest fix:
              keep the punchy number (it's real — Shukla et al., 2015,
              Weill Cornell, T2D patients) but show the citation right
              under it so fresh readers know it's grounded, not just
              marketing copy. Asterisk + small gray footnote keeps the
              hero visual hierarchy intact.
            */}
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              {t('concept.spike_reduction_source')}
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <SequenceBadge
              emoji="🥦"
              color="bg-sequence-fiber"
              step="1"
              title={t('concept.steps.fiber')}
              desc={t('concept.steps.fiber_desc')}
            />
            <ChevronRight className="hidden md:block text-gray-300 w-6 h-6" />
            <SequenceBadge
              emoji="🍗"
              color="bg-sequence-protein"
              step="2"
              title={t('concept.steps.protein')}
              desc={t('concept.steps.protein_desc')}
            />
            <ChevronRight className="hidden md:block text-gray-300 w-6 h-6" />
            <SequenceBadge
              emoji="🍚"
              color="bg-sequence-carb"
              step="3"
              title={t('concept.steps.carb')}
              desc={t('concept.steps.carb_desc')}
            />
            <ChevronRight className="hidden md:block text-gray-300 w-6 h-6" />
            <SequenceBadge
              emoji="🍰"
              color="bg-sequence-sugar"
              step="4"
              title={t('concept.steps.sugar')}
              desc={t('concept.steps.sugar_desc')}
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Scan className="w-10 h-10 text-brand-primary-500" />}
            title={t('features.scan.title')}
            description={t('features.scan.description')}
            gradient="from-brand-primary-100 to-white"
          />
          <FeatureCard
            icon={<Utensils className="w-10 h-10 text-brand-secondary-500" />}
            title={t('features.sequence.title')}
            description={t('features.sequence.description')}
            gradient="from-brand-secondary-100 to-white"
          />
          <FeatureCard
            icon={<HeartPulse className="w-10 h-10 text-brand-accent-500" />}
            title={t('features.score.title')}
            description={t('features.score.description')}
            gradient="from-brand-accent-100 to-white"
          />
          <FeatureCard
            icon={<Award className="w-10 h-10 text-brand-warning" />}
            title={t('features.gamify.title')}
            description={t('features.gamify.description')}
            gradient="from-orange-100 to-white"
          />
        </div>
      </section>

      {/* Gamification Preview */}
      <section className="container mx-auto px-4 py-10 relative z-10">
        <div className="backdrop-blur-md bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50 rounded-3xl p-8 max-w-4xl mx-auto shadow-glass">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="text-center">
              <Flame className="w-12 h-12 text-orange-500 mx-auto mb-2 animate-pulse-soft" />
              <p className="text-2xl font-bold text-gray-800">7</p>
              <p className="text-sm text-gray-500">{tGamify('streak.days')}</p>
            </div>
            <div className="text-center">
              <Award className="w-12 h-12 text-brand-accent-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">1,250</p>
              <p className="text-sm text-gray-500">{tGamify('points')}</p>
            </div>
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-brand-secondary-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{tGamify('levels.practitioner')}</p>
              <p className="text-sm text-gray-500">{tGamify('level')}</p>
            </div>
          </div>
          {/* Honesty caption (Round 13): without it, anonymous visitors
              read these example numbers as real account stats. */}
          <p className="text-center text-xs text-gray-400 mt-4">{t('gamify_preview_note')}</p>
        </div>
      </section>

      </main>

      {/* Footer / Version Display */}
      <footer className="container mx-auto px-4 py-8 relative z-10 text-center border-t border-gray-200/50 mt-10">
        <div className="flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-gray-500 font-medium">© {new Date().getFullYear()} Shinny Guide. All rights reserved.</p>
          <span className="text-xs font-mono text-gray-500 bg-white/80 px-3 py-1 rounded-full border border-gray-200 shadow-sm hover:text-brand-primary-500 transition-colors cursor-default">
            Version {process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
      </footer>
    </div>
  );
}


function SequenceBadge({ emoji, color, step, title, desc }: { emoji: string; color: string; step: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center p-4 backdrop-blur-sm bg-white/60 rounded-2xl w-full md:w-44 group hover:bg-white transition-all">
      <div className="text-3xl mb-2">{emoji}</div>
      <div className={`w-8 h-8 ${color} text-white rounded-full flex items-center justify-center font-bold text-sm mb-2 shadow-sm group-hover:scale-110 transition-transform`}>
        {step}
      </div>
      <h4 className="font-bold text-gray-800 text-sm text-center">{title}</h4>
      <p className="text-xs text-gray-500 text-center mt-1">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description, gradient }: { icon: React.ReactNode; title: string; description: string; gradient: string }) {
  return (
    <div className={`backdrop-blur-sm bg-gradient-to-br ${gradient} p-6 rounded-3xl border border-white/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-glass-hover`}>
      <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
