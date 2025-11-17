'use client';

import {useTranslations} from 'next-intl';
import Link from 'next/link';
import { Scan, MessageCircle, BookOpen, TrendingUp } from 'lucide-react';

export default function HomePage() {
  const t = useTranslations('home');
  const nav = useTranslations('nav');

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            <span className="text-2xl font-bold text-primary-700">NutriVision AI</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link href="/th/dashboard" className="text-gray-700 hover:text-primary-600">
              {nav('dashboard')}
            </Link>
            <Link href="/th/recipes" className="text-gray-700 hover:text-primary-600">
              {nav('recipes')}
            </Link>
            <Link
              href="/th/login"
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          {t('title')}
        </h1>
        <p className="text-xl md:text-2xl text-primary-600 mb-4">
          {t('subtitle')}
        </p>
        <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
          {t('description')}
        </p>

        <div className="flex justify-center gap-4">
          <Link
            href="/th/register"
            className="px-8 py-4 bg-primary-500 text-white text-lg rounded-lg hover:bg-primary-600 transition shadow-lg"
          >
            {t('cta')}
          </Link>
          <Link
            href="/th/demo"
            className="px-8 py-4 bg-white text-primary-600 text-lg rounded-lg border-2 border-primary-500 hover:bg-primary-50 transition"
          >
            ดูตัวอย่าง
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Scan className="w-12 h-12 text-primary-500" />}
            title={t('features.scan.title')}
            description={t('features.scan.description')}
          />
          <FeatureCard
            icon={<TrendingUp className="w-12 h-12 text-secondary-500" />}
            title={t('features.score.title')}
            description={t('features.score.description')}
          />
          <FeatureCard
            icon={<MessageCircle className="w-12 h-12 text-accent-500" />}
            title={t('features.chat.title')}
            description={t('features.chat.description')}
          />
          <FeatureCard
            icon={<BookOpen className="w-12 h-12 text-primary-600" />}
            title={t('features.recipes.title')}
            description={t('features.recipes.description')}
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">ใช้งานง่าย 3 ขั้นตอน</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number={1}
              title="ถ่ายรูปอาหาร"
              description="ใช้กล้อนถ่ายรูปอาหารหรืออัปโหลดจากแกลเลอรี่"
            />
            <StepCard
              number={2}
              title="AI วิเคราะห์"
              description="ระบบ AI จะวิเคราะห์และคำนวณคะแนนโภชนาการทันที"
            />
            <StepCard
              number={3}
              title="รับคำแนะนำ"
              description="ดูผลลัพธ์และรับคำแนะนำเฉพาะบุคคล"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary-500 to-secondary-500 py-20 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">พร้อมเริ่มต้นดูแลสุขภาพแล้วหรือยัง?</h2>
          <p className="text-xl mb-8 opacity-90">
            เริ่มต้นฟรี ไม่ต้องใช้บัตรเครดิต
          </p>
          <Link
            href="/th/register"
            className="inline-block px-10 py-4 bg-white text-primary-600 text-lg font-semibold rounded-lg hover:bg-gray-100 transition shadow-lg"
          >
            สมัครฟรีวันนี้
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">NutriVision AI</h3>
              <p className="text-gray-400">ผู้ช่วยโภชนาการอัจฉริยะสำหรับคนไทย</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">เมนู</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/th/about">เกี่ยวกับเรา</Link></li>
                <li><Link href="/th/features">ฟีเจอร์</Link></li>
                <li><Link href="/th/pricing">ราคา</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">ช่วยเหลือ</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/th/faq">คำถามที่พบบ่อย</Link></li>
                <li><Link href="/th/contact">ติดต่อเรา</Link></li>
                <li><Link href="/th/support">ช่วยเหลือ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">ติดตาม</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Facebook</li>
                <li>Instagram</li>
                <li>Line</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2024 NutriVision AI. สงวนลิขสิทธิ์.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-primary-500 text-white text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
