import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Inter, Sarabun } from "next/font/google";
import "../globals.css";
import type { Metadata } from 'next';

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["300", "400", "500", "600", "700"], variable: '--font-sarabun' });

export const metadata: Metadata = {
  title: 'NutriVision AI — Smart Nutrition Assistant',
  description: 'AI-powered nutrition analysis and recipe assistant. Analyze food photos, get 8-dimension health scores, and discover the "อร่อย ตาม ลำดับ" eating sequence for better health.',
};

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${sarabun.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
