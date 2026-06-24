import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Inter, Prompt, Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";
import type { Metadata } from 'next';
import { logger } from '@/lib/logger';

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["300", "400", "500", "600", "700"], variable: '--font-prompt' });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'Shinny Guide: AI Food Scanner & Sequencing App for Blood Sugar Management',
  description: 'AI food scanner that tells you what to eat first. Reduce blood sugar spikes by 70% with "อร่อย ตาม ลำดับ" food sequencing. Get 8-dimension health scoring and personalized meal plans.',
  keywords: [
    'ai-food-recognition',
    'blood-sugar',
    'calorie-tracker',
    'food-recognition',
    'food-sequencing',
    'health-app',
    'health-tracking',
    'meal-planning',
    'nutrition-analysis',
    'nutrition-scoring',
    'recipe-suggestion',
    'thai-cuisine'
  ],
  authors: [{ name: 'Shinny Guide Team' }],
  openGraph: {
    title: 'Shinny Guide: AI Food Scanner & Sequencing App',
    description: 'Snap a photo of your meal and let AI tell you the perfect eating sequence (Veggies → Protein → Carbs → Sweets) to reduce blood sugar spikes by up to 70%.',
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['th_TH', 'de_DE', 'da_DK'],
  },
};

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  // Server-side logging for Cloudflare Pages
  logger.info(`Rendering layout for locale: ${locale}`);

  return (
    <html lang={locale} className={`${inter.variable} ${prompt.variable} ${jakarta.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
