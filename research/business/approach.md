# Nutri-Vision-AI: Our Approach

## 1. AI-Driven Visual Analysis (The "Vision" in Nutri-Vision)
Leveraging **Cloudflare Workers AI and Google AI**, our application doesn't just "count calories"; it **analyzes meal composition** with high reliability.
- **Dual-Provider Fallback (v2.1.8)**: Uses the massive Cloudflare Llama 3.2 11B Vision for accuracy, with an automatic fallback to Google's highly reliable Gemma 3 27B model for 99.9% uptime.
- **Ingredient Decomposition**: Identifies what's on the plate (e.g., hidden sugars, fiber, protein).
- **UPF Detection**: Flags ultra-processed ingredients that disrupt metabolism.
- **Dynamic Recommendations**: Provides a step-by-step eating sequence (🥦 ➔ 🍗 ➔ 🍚) based on the specific meal scanned.

## 2. Empathic Coaching with Shinny
Our AI Mascot, **Shinny**, is the "wise older sister" of the application.
- **Tone**: Friendly, supportive, and non-judgmental.
- **Empowerment**: She understands that "bubble tea is delicious!" and helps you drink it safely instead of shaming you.
- **Science-Backed Guidance**: Explains the "Why" (e.g., "Walk for 10 minutes to let your muscles eat the sugar").

## 3. Behavioral Science & Gamification
Long-term health change requires **consistent habits**.
- **Daily Streaks**: Encourages users to scan and sequence at least one meal a day.
- **Health Scores (8 Dimensions)**: Breaks down health into actionable metrics (Blood Sugar Impact, Satiety Index, Gut Health).
- **Community & Leaderboards**: Connects users with similar health goals and regional food backgrounds.

## 4. Tech Stack: Modern & Scalable
- **Frontend**: Next.js (TypeScript) optimized for the Edge.
- **Backend**: Serverless Cloudflare Workers for zero-latency globally.
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite) for high-performance edge storage.
- **AI**: Cloudflare Workers AI (Llama 3.2 11B) + Google AI (Gemma 3 27B).

## 5. Cultural Localization: Thai-Centric, Globally Applicable
While the concept of food sequencing is universal, the application starts with deep expertise in **Thai food culture**, accounting for hidden sugars in sauces, traditional fermentation (probiotics), and local eating habits.
