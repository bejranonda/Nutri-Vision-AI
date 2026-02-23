'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Scan, MessageCircle, BookOpen, TrendingUp, Sparkles, HeartPulse, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const t = useTranslations('home');
  const nav = useTranslations('nav');

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-primary-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
      <div className="absolute top-1/4 -right-1/4 w-1/2 h-1/2 bg-secondary-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute -bottom-1/4 left-1/4 w-1/2 h-1/2 bg-accent-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '4s' }}></div>

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10 glass-panel rounded-b-3xl mb-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-6 transition-transform">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-secondary-600">NutriVision AI</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link href="/th/dashboard" className="text-gray-700 dark:text-gray-200 hover:text-primary-600 font-medium transition-colors">
              {nav('dashboard')}
            </Link>
            <Link href="/th/recipes" className="text-gray-700 dark:text-gray-200 hover:text-primary-600 font-medium transition-colors">
              {nav('recipes')}
            </Link>
            <Link
              href="/th/login"
              className="group relative px-6 py-2.5 font-semibold text-white rounded-xl overflow-hidden shadow-neon"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500"></span>
              <span className="absolute bottom-0 right-0 block w-64 h-64 mb-32 mr-4 transition duration-500 origin-bottom-left transform rotate-45 translate-x-24 bg-white opacity-10 group-hover:rotate-90 ease"></span>
              <span className="relative">เข้าสู่ระบบ</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-primary-600 font-medium mb-8 animate-bounce-light">
          <Sparkles className="w-4 h-4" />
          <span>คอนเซปต์ใหม่: อร่อย ตาม ลำดับ</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white mb-6 tracking-tight">
          {t('title')}
        </h1>
        <p className="text-2xl md:text-3xl text-primary-600 dark:text-primary-400 font-medium mb-6">
          {t('subtitle')}
        </p>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
          {t('description')}
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/th/register"
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-lg font-bold rounded-2xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(20,184,166,0.4)]"
          >
            {t('cta')} <ChevronRight className="w-5 h-5" />
          </Link>
          <Link
            href="/th/demo"
            className="flex items-center justify-center px-8 py-4 glass-panel text-primary-700 dark:text-primary-300 text-lg font-bold rounded-2xl hover:bg-white/90 transition-all border-2 border-primary-100"
          >
            ดูตัวอย่าง
          </Link>
        </div>
      </section>

      {/* Concept Section: อร่อย ตาม ลำดับ */}
      <section className="container mx-auto px-4 py-10 relative z-10">
        <div className="glass-panel rounded-3xl p-8 md:p-12 max-w-4xl mx-auto transform hover:-translate-y-2 transition-transform duration-300">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-500 mb-4">
              สูตรลับอายุยืน: กินอย่างไรให้ไม่แก่?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              นวัตกรรม AI ของเราไม่เพียงนับแคลอรี่ แต่ช่วยจัดลำดับการกิน <span className="font-bold text-primary-600">"ผัก ➔ โปรตีน ➔ แป้ง ➔ หวาน"</span> เพื่อลดน้ำตาลในเลือด
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <SequenceBadge color="bg-nutrition-veggie" step="1" title="ไฟเบอร์" desc="พรีไบโอติกส์" />
            <ChevronRight className="hidden md:block text-gray-400" />
            <SequenceBadge color="bg-nutrition-protein" step="2" title="โปรตีน/ไขมัน" desc="ชะลอการย่อย" />
            <ChevronRight className="hidden md:block text-gray-400" />
            <SequenceBadge color="bg-nutrition-carb" step="3" title="คาร์โบไฮเดรต" desc="ลดการพุ่งของน้ำตาล" />
            <ChevronRight className="hidden md:block text-gray-400" />
            <SequenceBadge color="bg-nutrition-sugar" step="4" title="ของหวาน" desc="ทานสุดท้าย" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Scan className="w-10 h-10 text-primary-500" />}
            title={t('features.scan.title')}
            description={t('features.scan.description')}
            colorClass="from-primary-50 to-white hover:border-primary-300"
          />
          <FeatureCard
            icon={<HeartPulse className="w-10 h-10 text-secondary-500" />}
            title={t('features.score.title')}
            description={t('features.score.description')}
            colorClass="from-secondary-50 to-white hover:border-secondary-300"
          />
          <FeatureCard
            icon={<MessageCircle className="w-10 h-10 text-accent-500" />}
            title={t('features.chat.title')}
            description={t('features.chat.description')}
            colorClass="from-accent-50 to-white hover:border-accent-300"
          />
          <FeatureCard
            icon={<BookOpen className="w-10 h-10 text-primary-600" />}
            title={t('features.recipes.title')}
            description={t('features.recipes.description')}
            colorClass="from-blue-50 to-white hover:border-blue-300"
          />
        </div>
      </section>
    </div>
  );
}

function SequenceBadge({ color, step, title, desc }: { color: string, step: string, title: string, desc: string }) {
  return (
    <div className="flex flex-col items-center p-4 glass-panel rounded-2xl w-full md:w-48 group">
      <div className={`w-12 h-12 ${color} text-white rounded-full flex items-center justify-center font-black text-xl mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
        {step}
      </div>
      <h4 className="font-bold text-gray-800 dark:text-white">{title}</h4>
      <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description, colorClass }: { icon: React.ReactNode; title: string; description: string; colorClass: string }) {
  return (
    <div className={`glass-panel p-8 rounded-3xl border-2 border-transparent transition-all duration-300 hover:-translate-y-2 hover:shadow-glass-hover bg-gradient-to-br ${colorClass} dark:from-slate-800 dark:to-slate-800`}>
      <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{description}</p>
    </div>
  );
}
