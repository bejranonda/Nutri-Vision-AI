# 🍜 Shinny Guide (Nutri-Vision AI)

**อร่อย ตาม ลำดับ — Delicious in Order**

> Live Long to Eat Well · อยู่เพื่อกินบำนาญ

[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare_Pages-F38020?logo=cloudflare)](https://nutri-vision-ai.pages.dev)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org)

## What is Shinny Guide?

Shinny Guide is an AI-powered food sequencing app that helps you eat Thai food (and any cuisine) in the right order to reduce blood sugar spikes by up to **70%**. Based on real science — eat **Veggies → Protein → Carbs → Sweets**.

Meet **Shinny** (ชินนี่), your AI food coach who guides you through every meal!

## ✨ Key Features

| Feature | Free | Premium (฿199/mo) | Family (฿299/mo) |
|---------|------|--------------------|-------------------|
| Food Scanning | 10/month | ∞ | ∞ |
| Health Score | 3 dimensions | 8 dimensions | 8 dimensions |
| AI Coach Shinny | 3 Q/day | ∞ | ∞ |
| Custom AI Avatar | — | ✓ (Dynamic Postures) | ✓ |
| Thai Recipes | 100 | 1,000+ | 1,000+ |
| Meal Planning | — | ✓ | ✓ |
| Family Members | — | — | 5 |
| Data Export | — | ✓ | ✓ |

### 📱 App Pages
- **Home** — Landing page with concept explanation & features
- **Scan** — AI food analysis with eating sequence visualization & 8-dimension scoring
- **Demo** — Interactive walkthrough of food sequencing with blood sugar curves
- **Login** — Authentication with email, Google, LINE, and promo code redemption
- **Dashboard** — Member stats, streak tracking, daily challenges, gamification
- **Pricing** — Tier comparison with monthly/annual toggle and FAQ
- **Recipes** — Thai recipe collection with dietary filters

### 🎟️ Promotion Code System
Built-in codes for Shinny fanclub and launch promotions:
- `SHINNY2024` — 30 days Premium (Shinny Fanclub)
- `EATWELL` — 7-day Premium trial
- `LAUNCH50` — 50% off first month
- `FAMILY2024` — 14-day Family trial

## 🛠 Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **i18n**: next-intl (🇬🇧 EN, 🇹🇭 TH, 🇩🇪 DE, 🇩🇰 DA)
- **State**: Zustand with persist middleware
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Deploy**: Cloudflare Pages + Workers
- **AI**: Cloudflare Workers AI (food recognition)

## 🚀 Getting Started

```bash
cd frontend
npm install
npm run dev        # → http://localhost:3000
```

### Build for production
```bash
npm run build
npm run deploy     # → Cloudflare Pages
```

## 📁 Project Structure

```
frontend/src/
├── app/[locale]/       # Pages (home, scan, demo, login, dashboard, pricing, recipes)
├── lib/
│   ├── auth-store.ts   # Zustand auth state (login, register, promo codes)
│   ├── promo-codes.ts  # Promotion code system (TRIAL, DISCOUNT, FANCLUB, REFERRAL)
│   ├── tier-config.ts  # Feature gating (Free, Premium, Family)
│   └── logger.ts       # Client/Edge unified logger
├── db/schema.ts        # Drizzle ORM schema (users, promo_codes, sessions)
└── messages/           # i18n translations (en, th, de, da)
```

## 📊 Member System

### Authentication Flow
1. Register with email/password → free tier
2. Redeem promo code → upgrade to premium/trial
3. Edge-native security: Secure HttpOnly cookies powered by Next.js Edge APIs and Cloudflare D1.

### Subscription Tiers
- **Free**: Basic scanning (10/month), 3 health dimensions, 100 recipes
- **Premium** (฿199/mo): Unlimited scans, 8 dimensions, meal planning, data export
- **Family** (฿299/mo): All Premium + 5 family members, kids nutrition mode

## 📋 Business Development

### Revenue Streams
1. **B2C Subscriptions** — Freemium → Premium/Family
2. **B2B Corporate Wellness** — Enterprise packages for organizations
3. **Partnership Revenue** — Delivery integration, content licensing, affiliate programs
4. **Promotion System** — Fanclub codes (Shinny), launch codes, referral codes

### Year 1 Focus
- Build user base with freemium model
- Engage Shinny fanclub with exclusive promo codes
- Iterate on AI food scanning accuracy
- Scale with minimal operational staff

## 📜 License

MIT © Werapol Bejranonda
