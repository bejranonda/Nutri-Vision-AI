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
  title: 'EatInOrder — Smart Food Sequencing for Better Health',
  description: 'AI-powered nutrition analysis with "อร่อย ตาม ลำดับ" (Delicious in Order) food sequencing. Reduce blood sugar spikes by 70% while enjoying the foods you love.',
  keywords: ['nutrition', 'food sequencing', 'blood sugar', 'glycemic index', 'Thai food', 'healthy eating', 'AI nutrition'],
  authors: [{ name: 'EatInOrder Team' }],
  openGraph: {
    title: 'EatInOrder — Smart Food Sequencing',
    description: 'Discover how eating in the right order can transform your health. Veggies → Protein → Carbs → Sweets',
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
