'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Scan, MessageCircle, BookOpen, Sparkles, HeartPulse, ChevronRight, Utensils, Award, Flame, Languages } from 'lucide-react';

export default function HomePage() {
  const t = useTranslations('home');
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const tBrand = useTranslations('brand');
  const tMascot = useTranslations('mascot');
  const tGamify = useTranslations('gamification');
  const locale = useLocale();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-secondary-50">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-brand-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
      <div className="absolute top-1/4 -right-1/4 w-1/2 h-1/2 bg-brand-secondary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute -bottom-1/4 left-1/4 w-1/2 h-1/2 bg-brand-accent-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '4s' }}></div>

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10 backdrop-blur-md bg-white/70 rounded-b-3xl mb-8 shadow-glass">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-primary-400 to-brand-secondary-400 rounded-2xl flex items-center justify-center shadow-brand transform hover:rotate-6 transition-transform">
              <Utensils className="text-white w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-primary-500 to-brand-secondary-500">{tBrand('name')}</span>
              <p className="text-xs text-brand-neutral/60 font-medium">{tBrand('tagline')}</p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <Link href={`/${locale}/dashboard`} className="text-gray-700 hover:text-brand-primary-500 font-medium transition-colors">
              {tNav('dashboard')}
            </Link>
            <Link href={`/${locale}/recipes`} className="text-gray-700 hover:text-brand-primary-500 font-medium transition-colors">
              {tNav('recipes')}
            </Link>

            {/* Language Switcher */}
            <LanguageSwitcher currentLocale={locale} />

            <Link
              href={`/${locale}/login`}
              className="group relative px-6 py-2.5 font-semibold text-white rounded-xl overflow-hidden shadow-brand hover:shadow-brand-lg transition-shadow"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-brand-primary-400 via-brand-secondary-400 to-brand-accent-400"></span>
              <span className="absolute bottom-0 right-0 block w-64 h-64 mb-32 mr-4 transition duration-500 origin-bottom-left transform rotate-45 translate-x-24 bg-white opacity-10 group-hover:rotate-90 ease"></span>
              <span className="relative">{tAuth('login')}</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center relative z-10">
        {/* Mascot Greeting */}
        <div className="mb-8 animate-bounce-in">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-brand-primary-100 to-brand-secondary-100 text-brand-primary-600 font-medium shadow-glass">
            <span className="text-2xl">👩‍🏫</span>
            <span>{tMascot('greeting')}</span>
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
        </div>
      </section>
    </div>
  );
}

function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const locales = [
    { code: 'th', flag: '🇹🇭', name: 'ไทย' },
    { code: 'en', flag: '🇬🇧', name: 'EN' },
    { code: 'de', flag: '🇩🇪', name: 'DE' },
    { code: 'da', flag: '🇩🇰', name: 'DA' },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
      {locales.map((loc) => (
        <Link
          key={loc.code}
          href={`/${loc.code}`}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
            currentLocale === loc.code
              ? 'bg-white text-brand-primary-500 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {loc.flag}
        </Link>
      ))}
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
