# GROUP B: UX/UI ROADMAP REPORTS
## NutriVision AI — UX/UI Strategy & Feature Prioritization

**Research Date:** November 19, 2025
**Strategic Planning Horizon:** 18-Month Roadmap
**Methodology:** RICE Scoring + MoSCoW + Kano Model + Impact-Effort Analysis

---

## TABLE OF CONTENTS

1. [UX/UI Strategic Direction](#uxui-strategic-direction)
2. [Website Roadmap & Information Architecture](#website-roadmap--information-architecture)
3. [App Navigation & User Flow Roadmap](#app-navigation--user-flow-roadmap)
4. [Feature Prioritization Matrix](#feature-prioritization-matrix)
5. [Design System Roadmap](#design-system-roadmap)
6. [Content Strategy & Sitemap](#content-strategy--sitemap)
7. [Phased Implementation Plan](#phased-implementation-plan)

---

## 1. UX/UI STRATEGIC DIRECTION

### 1.1 Vision Statement

**UX Vision:**
> "Create the most intuitive, culturally authentic, and behaviorally effective nutrition app for Thai users — where understanding your food is as easy as taking a photo, and making healthier choices feels rewarding, not restrictive."

**Design Principles:**

1. **🇹🇭 Thai-First, Not Thai-Translated**
   - Design for Thai mental models, not Western patterns translated
   - Use Thai cultural references, measurements, eating patterns
   - LINE integration feels native, not bolted-on

2. **⚡ Instant Value, Zero Friction**
   - First scan within 60 seconds of signup
   - One-tap camera access from anywhere
   - Progressive disclosure (show essentials, hide complexity)

3. **🎮 Engagement Through Delight**
   - Gamification feels rewarding, not manipulative
   - Microinteractions create emotional connection
   - Celebrate progress, learn from setbacks

4. **📚 Education Without Overwhelm**
   - Complex nutrition made simple through visuals
   - Actionable insights, not raw data dumps
   - "Why this matters" context for every metric

5. **🤝 Empathy Over Judgment**
   - Supportive tone, never preachy
   - Acknowledge difficulty of behavior change
   - Focus on progress, not perfection

6. **♿ Inclusive By Default**
   - WCAG 2.2 AA compliance minimum
   - Works for users across age, ability, device, connectivity
   - Thai language accessibility (screen readers, etc.)

---

### 1.2 UX Strategy: 3 Horizons Framework

**Horizon 1: Foundation (Months 1-6) — Launch & Validate**

**Goal:** Achieve product-market fit with core UX
**Success Metrics:**
- 10,000 MAU
- 25% Day 30 retention
- 4% free-to-paid conversion
- <40% onboarding drop-off
- 60%+ first scan completion

**Key UX Initiatives:**
- ✅ Fix critical onboarding UX (P0)
- ✅ Implement basic gamification (streaks + 5 badges)
- ✅ Add instant camera access (FAB)
- ✅ Conduct user testing (5+ Thai users)
- ✅ Launch LINE Official Account integration
- ✅ Optimize food scanning flow
- ✅ Add AI coach personality ("P'Nui")

---

**Horizon 2: Growth (Months 6-12) — Scale & Differentiate**

**Goal:** Scale to 100K MAU with high engagement
**Success Metrics:**
- 100,000 MAU
- 30% Day 30 retention
- 5% free-to-paid conversion
- Daily active use 40%+
- NPS 40+

**Key UX Initiatives:**
- ✅ Advanced gamification (challenges, leaderboards, social features)
- ✅ Enhanced recipe discovery (AI recommendations)
- ✅ Meal planning UX overhaul (drag-drop calendar)
- ✅ Community features (share meals, groups)
- ✅ Restaurant menu scanning
- ✅ Voice input for AI coach
- ✅ Design system documentation
- ✅ B2B admin dashboard (corporate wellness)

---

**Horizon 3: Innovation (Months 12-18) — Lead Market**

**Goal:** Become category-defining app before Apple Health+ launches
**Success Metrics:**
- 500,000 MAU
- 35% Day 30 retention
- Brand awareness: #1 Thai nutrition app
- Viral coefficient >1.2
- Featured in Thai app stores

**Key UX Initiatives:**
- ✅ Multimodal AI (voice + vision + text)
- ✅ AR nutrition overlay (experimental)
- ✅ CGM (continuous glucose monitor) integration
- ✅ Predictive analytics (AI meal suggestions based on patterns)
- ✅ Family dashboard (shared meal planning)
- ✅ Marketplace (order ingredients directly)
- ✅ Nutritionist consultation booking
- ✅ Smartwatch app (Apple Watch, Galaxy Watch)

---

### 1.3 Competitive UX Positioning Strategy

**Differentiation Framework:**

| Aspect | MyFitnessPal | Noom | HealthifyMe | Apple Health+* | **NutriVision** |
|--------|--------------|------|-------------|----------------|-----------------|
| **Thai Food UX** | ⭐ Generic | ⭐ Generic | ⭐⭐ Asian | ⭐⭐ Likely generic | ⭐⭐⭐⭐⭐ **Native** |
| **Onboarding** | ⭐⭐ Basic | ⭐⭐⭐⭐⭐ Best | ⭐⭐⭐ Good | ⭐⭐⭐⭐ Expected | ⭐⭐⭐⭐⭐ **Noom-inspired** |
| **Scan UX** | ❌ No AI | ❌ No AI | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Expected | ⭐⭐⭐⭐ **Instant access** |
| **Gamification** | ⭐⭐ Limited | ⭐⭐⭐ Good | ⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Expected | ⭐⭐⭐⭐⭐ **Full system** |
| **AI Coach** | ❌ No | ⭐⭐ Generic | ⭐⭐⭐⭐ "Ria" | ⭐⭐⭐⭐⭐ Expected | ⭐⭐⭐⭐⭐ **"P'Nui"** |
| **LINE Integration** | ❌ No | ❌ No | ❌ No | ❌ No | ✅ **Yes** |
| **Blood Sugar Focus** | ❌ No | ❌ No | ⭐⭐ Limited | ⭐⭐ Maybe | ⭐⭐⭐⭐⭐ **Core** |

*Apple Health+ launching iOS 19.4 (2026)

**UX Moat:** Even if Apple launches first in US, NutriVision's Thai cultural integration + blood sugar specialization create defensible UX advantage.

---

## 2. WEBSITE ROADMAP & INFORMATION ARCHITECTURE

### 2.1 Recommended Sitemap (Website Marketing + App PWA)

```
NutriVision.ai (Marketing Website + App Entry)
│
├── 🏠 HOME (Marketing Landing)
│   ├── Hero: Value prop + First scan CTA
│   ├── How it Works (3 steps)
│   ├── Features Overview
│   ├── Social Proof (testimonials, user count)
│   ├── Pricing Comparison
│   └── Download/Start CTA
│
├── ✨ FEATURES
│   ├── AI Food Recognition
│   ├── 8-Dimension Scoring (explained)
│   ├── Thai Recipe Database
│   ├── AI Nutrition Coach
│   ├── Meal Planning
│   └── Blood Sugar Management
│
├── 💰 PRICING
│   ├── Free vs Premium vs Family (comparison table)
│   ├── B2B Corporate Wellness
│   ├── FAQ
│   └── Start Free Trial CTA
│
├── 📚 BLOG / EDUCATION
│   ├── Thai Nutrition Articles
│   │   ├── Blood Sugar Management
│   │   ├── Eating Sequence Guide
│   │   ├── Thai Ingredient Spotlight
│   │   └── Healthy Thai Recipe Makeovers
│   ├── Success Stories
│   └── News & Updates
│
├── 🏢 FOR BUSINESS (B2B)
│   ├── Corporate Wellness Program
│   ├── ROI Calculator
│   ├── Case Studies
│   ├── Enterprise Features
│   └── Contact Sales
│
├── ℹ️ ABOUT
│   ├── Our Story
│   ├── Team
│   ├── Press Kit
│   ├── Careers
│   └── Contact Us
│
├── 🛡️ LEGAL / SUPPORT
│   ├── Privacy Policy (PDPA compliant)
│   ├── Terms of Service
│   ├── Help Center / FAQ
│   ├── Contact Support
│   └── Community Guidelines
│
└── 📱 APP (PWA)
    ├── 🏠 Dashboard (Hub)
    │   ├── Today's Summary
    │   ├── Streak Counter
    │   ├── Quick Actions
    │   ├── Personalized Nudges
    │   ├── Achievements Preview
    │   └── Recent Scans
    │
    ├── 📸 SCAN (Core Feature)
    │   ├── Camera Capture (instant access via FAB)
    │   ├── Upload Photo
    │   ├── Processing & Results
    │   │   ├── Overall Score
    │   │   ├── 8-Dimension Breakdown
    │   │   ├── Detailed Nutrition
    │   │   └── Healthier Alternatives
    │   ├── Edit/Correct
    │   ├── Add to Meal Log
    │   └── Scan History
    │
    ├── 🍽️ RECIPES
    │   ├── For You (personalized)
    │   ├── Browse All
    │   ├── Search & Filters
    │   ├── Categories
    │   │   ├── By Meal Type (breakfast, lunch, dinner, snacks)
    │   │   ├── By Dietary Need (vegetarian, low-carb, diabetic-friendly)
    │   │   ├── By Thai Region (Central, Northern, Northeastern, Southern)
    │   │   └── By Health Goal (weight loss, muscle gain, blood sugar)
    │   ├── Recipe Detail
    │   ├── Favorites
    │   └── Recent Views
    │
    ├── 💬 AI COACH ("P'Nui")
    │   ├── Chat Interface
    │   ├── Suggested Questions
    │   ├── Chat History
    │   ├── Saved Tips
    │   └── Voice Input (future)
    │
    ├── 📅 MEAL PLANNER
    │   ├── Today
    │   ├── This Week (calendar view)
    │   ├── Meal Templates
    │   ├── Shopping List
    │   └── Meal Prep Guide
    │
    ├── 📊 PROGRESS
    │   ├── Streaks & Achievements
    │   ├── Nutrition Trends
    │   ├── Weight Tracking (optional)
    │   ├── Goals & Milestones
    │   ├── Weekly Reports
    │   └── Insights & Recommendations
    │
    ├── 👥 COMMUNITY (future)
    │   ├── Feed
    │   ├── Challenges
    │   ├── Leaderboards
    │   ├── Groups
    │   └── Friends
    │
    ├── 👤 PROFILE
    │   ├── Personal Info
    │   ├── Health Goals
    │   ├── Dietary Preferences
    │   ├── Medical Conditions
    │   ├── Subscription & Billing
    │   ├── Usage Stats
    │   └── Referral Program
    │
    └── ⚙️ SETTINGS
        ├── Language (ไทย / English)
        ├── Notifications
        ├── Privacy & Data
        ├── Integrations (LINE, Apple Health, Google Fit)
        ├── Account Management
        ├── Help & Support
        └── About / Legal
```

---

### 2.2 Information Architecture Validation Plan

**Before Launch:**

1. **Card Sorting (Open)**
   - **Participants:** 15-20 Thai users (mix of demographics)
   - **Method:** OptimalSort or physical cards
   - **Goal:** Validate content categorization
   - **Questions:** How do users mentally group features/content?

2. **Tree Testing**
   - **Participants:** 10-15 Thai users (different from card sort)
   - **Tool:** Treejack or UserTesting
   - **Tasks:**
     - "Find where to scan your lunch"
     - "Find a low-carb Thai recipe"
     - "Find help for blood sugar management"
     - "Find your scan history"
     - "Find subscription pricing"
   - **Success Metric:** 70%+ find items on first attempt

3. **First-Click Testing**
   - **Participants:** 20+ Thai users
   - **Tool:** Maze or UsabilityHub
   - **Method:** Show mockups, ask "Where would you click to [task]?"
   - **Success Metric:** 80%+ click correct area

---

### 2.3 Navigation Structure (App)

**Primary Navigation: Bottom Tab Bar**

**Option A (Recommended): 5-Tab Layout**

```
┌─────────────────────────────────────────────┐
│  [🏠]   [🍽️]   [📸]   [💬]   [👤]         │
│  Home   Recipes  SCAN  Coach  Profile        │
└─────────────────────────────────────────────┘
```

**Rationale:**
- **Home:** Central dashboard (contextual)
- **Recipes:** High-value content discovery
- **Scan:** Core action (center position, larger)
- **Coach:** Differentiated AI feature
- **Profile:** Account, settings, progress

---

**Option B (Alternative): 4-Tab + FAB**

```
┌─────────────────────────────────────────────┐
│  [🏠]   [🍽️]       [💬]   [👤]             │
│  Home   Recipes      Coach  Profile          │
│                 [📸]                         │
│                 FAB                          │
└─────────────────────────────────────────────┘
```

**Rationale:**
- Persistent FAB for instant scanning (fastest access)
- 4 tabs = cleaner, less crowded
- Scan always accessible regardless of current screen

**Recommendation:** **Option B** — FAB provides fastest access to core feature, which is critical for habit formation.

---

**Secondary Navigation:**

**Top Bar (Context-Dependent):**
- **Home:** Streak indicator (left), Notifications (right)
- **Recipes:** Search icon (right), Filter icon (right)
- **Scan:** [None - fullscreen camera]
- **Coach:** [Chat context - message history]
- **Profile:** Settings gear (right)

**Swipe Gestures:**
- Swipe left on scan history → Delete
- Swipe left on recipe → Save/Unsave
- Pull down on dashboard → Refresh
- Swipe between tabs (optional, if native feel desired)

---

## 3. APP NAVIGATION & USER FLOW ROADMAP

### 3.1 Critical User Flows (Redesigned)

#### **FLOW 1: First-Time User Onboarding**

**Current Issues:**
- No aha moment within 60 seconds
- Optional steps skipped
- No social proof or expectation setting

**Redesigned Flow (Noom-Inspired):**

```
Step 1: Welcome Screen (5 seconds)
├── Hero image (Thai food + healthy person)
├── Headline: "รู้จักอาหารของคุณ ใน 3 วินาที" (Know your food in 3 seconds)
├── Subhead: "เข้าร่วมกับผู้ใช้ 10,000+ คนในประเทศไทย" (Join 10,000+ users in Thailand)
└── CTA: "เริ่มต้นฟรี" (Start Free)

↓

Step 2: Quick Survey (30 seconds)
├── "อยากบรรลุเป้าหมายอะไร?" (What's your goal?)
│   ⭕ ลดน้ำหนัก (Lose weight)
│   ⭕ เพิ่มกล้ามเนื้อ (Gain muscle)
│   ⭕ จัดการน้ำตาล (Manage blood sugar)
│   ⭕ กินสุขภาพดี (Eat healthier)
│
├── "มีอาหารโปรดไหม?" (Any dietary preferences?)
│   ☑️ มังสวิรัติ (Vegetarian)
│   ☑️ ฮาลาล (Halal)
│   ☑️ คาร์โบไฮเดรตต่ำ (Low-carb)
│
└── "สิ่งที่คุณกังวลเรื่องสุขภาพ?" (Health concerns?)
    ☑️ เบาหวาน / น้ำตาลในเลือด (Diabetes / Blood sugar)
    ☑️ น้ำหนักเกิน (Weight)
    ☑️ ไม่มี (None)

↓

Step 3: Social Proof (5 seconds)
├── User testimonial with photo:
│   "ลดน้ำตาลในเลือดลง 30% ภายใน 2 เดือน!" — นิด, กรุงเทพฯ
│   (Reduced blood sugar by 30% in 2 months!)
├── Trust indicators:
│   ✅ ใช้งานฟรี (Free to use)
│   ✅ ข้อมูลปลอดภัย (Secure data - PDPA compliant)
│   ✅ รองรับภาษาไทย (Thai language support)
└── CTA: "ต่อไป" (Continue)

↓

Step 4: Expectation Setting (10 seconds)
├── Headline: "แค่ 2 นาทีต่อวัน"
│   (Just 2 minutes per day)
├── Visual: Simple 3-step illustration
│   1. ถ่ายรูปอาหาร (Photo your food)
│   2. ดูคะแนนโภชนาการ (See nutrition score)
│   3. เรียนรู้และปรับปรุง (Learn and improve)
├── "เราจะช่วยคุณเข้าใจอาหารไทยดีขึ้นทุกวัน"
│   (We'll help you understand Thai food better every day)
└── CTA: "เริ่มเลย!" (Let's start!)

↓

Step 5: Quick Sign-Up (15 seconds)
├── "สร้างบัญชีฟรี" (Create free account)
├── Primary: ลงชื่อเข้าใช้ด้วย LINE (Sign in with LINE) [Recommended]
├── Secondary: Google, Facebook, Email
└── Privacy note: "เราจะไม่แชร์ข้อมูลของคุณ" (We won't share your data)

↓

Step 6: IMMEDIATE First Scan Tutorial (30 seconds)
├── Welcome message: "ยินดีต้อนรับคุณ [Name]! 🎉"
├── "ลองสแกนอาหารมื้อแรกกันเลย" (Let's scan your first meal)
├── Guided overlay:
│   ┌────────────────────┐
│   │  [Camera opens]    │
│   │  Tooltip: "จ่อที่   │
│   │  อาหารของคุณ"       │
│   │  (Point at food)   │
│   └────────────────────┘
├── Take photo (or skip with sample photo)
├── Processing animation: "กำลังวิเคราะห์ข้าวผัด..." (Analyzing fried rice...)
└── [Continue to Step 7]

↓

Step 7: Celebrate First Scan Success! (10 seconds)
├── Confetti animation 🎉
├── "เยี่ยมเลย! คุณได้วิเคราะห์อาหารมื้อแรกแล้ว"
│   (Awesome! You've analyzed your first meal)
├── Show results:
│   ┌────────────────────┐
│   │  ข้าวผัด           │
│   │  Overall: 65/100   │
│   │  🩸 Blood Sugar: 45│
│   │  🌾 Fiber: 30      │
│   │  💪 Protein: 70     │
│   └────────────────────┘
├── Quick tip: "เพิ่มผักและลดน้ำมัน จะสุขภาพดีขึ้น!"
│   (Add vegetables and reduce oil for better health!)
└── CTA: "ไปที่แดชบอร์ด" (Go to Dashboard)

↓

Step 8: Personalized Dashboard
├── Show customized dashboard based on survey
├── Highlight: "เป้าหมายของคุณ: ลดน้ำหนัก" (Your goal: Lose weight)
├── Suggested next actions:
│   ⭐ "สแกนอาหารมื้อต่อไป" (Scan next meal)
│   📚 "ดูสูตรอาหารเพื่อสุขภาพ" (Browse healthy recipes)
│   💬 "ถามโค้ช AI" (Ask AI coach)
└── Onboarding complete ✓

Total time: ~2 minutes
```

**Key Improvements:**
✅ Aha moment: First scan completed within 90 seconds
✅ Social proof: Testimonial during onboarding
✅ Expectation setting: "Just 2 minutes per day"
✅ Identity creation: "Your goal: [goal]"
✅ Immediate value demonstration
✅ Celebration (confetti, positive reinforcement)

---

#### **FLOW 2: Daily Scanning (Optimized)**

**Before:**
```
1. Navigate to "Scan" → 2. Camera permission → 3. Take photo → 4. Loading spinner → 5. Results
(4-5 clicks/taps, ~15 seconds)
```

**After:**
```
1. Tap FAB (from any screen) → 2. Instant camera → 3. Capture → 4. Engaging animation → 5. Progressive results
(1 click, ~8 seconds to first insight)
```

**Detailed Optimized Flow:**

```
Anywhere in App
├── User taps FAB (📸 floating action button)
│   └── Opens camera instantly (no navigation, no delay)
│
↓
Camera Screen (Fullscreen, Clean)
├── Quick tips overlay (first 3 uses):
│   "💡 Tips: Good lighting, neutral background"
│   [Don't show again checkbox]
├── Capture button (large, center bottom)
├── Gallery icon (upload from photos)
├── Flash toggle
└── Close button (top left)

↓ [User captures photo]

Processing Screen (Engaging)
├── Photo preview (small, top)
├── Animated scanning effect (moving lines across image)
├── Status messages (rotate every 1.5s):
│   "🔍 กำลังจดจำอาหาร..." (Recognizing food...)
│   "🧮 คำนวณโภชนาการ..." (Calculating nutrition...)
│   "📊 วิเคราะห์สุขภาพ..." (Analyzing health impact...)
├── Progress indicator: 25% → 50% → 75% → 100%
└── Processing time: 3-5 seconds (show progress, not indeterminate spinner)

↓

Results Screen (Progressive Disclosure)
├── 🎯 Overall Score (Large, Visual, Immediate)
│   ┌─────────────────────────────┐
│   │       ข้าวผัดกระเพราหมู      │
│   │     (Basil Fried Rice)      │
│   │                              │
│   │         ⭐ 65/100           │
│   │      [Color ring gauge]      │
│   │                              │
│   │   "Good choice! Could be     │
│   │    healthier with tweaks"    │
│   └─────────────────────────────┘
│
├── 📌 Top 3 Highlights (Glanceable)
│   ✅ High Protein (70/100)
│   ⚠️ Low Fiber (30/100)
│   ⚠️ Blood Sugar Impact: Moderate (45/100)
│
├── [Expand button: "ดูรายละเอียดทั้งหมด" (See full details)]
│
├── Confidence: "90% match" (transparency)
│
├── Quick Actions (3 buttons):
│   [✏️ แก้ไข / Edit] [✅ เพิ่มลงบันทึก / Add to log] [❓ ถามโค้ช / Ask coach]
│
└── Contextual Card: "💡 วิธีทำให้สุขภาพดีขึ้น" (How to make it healthier)
    - เพิ่มผักเยอะขึ้น (Add more vegetables)
    - ใช้น้ำมันน้อยลง (Use less oil)
    - เปลี่ยนเป็นข้าวกล้อง (Switch to brown rice)
    [ดูสูตรแบบสุขภาพดี (See healthy version)]

↓ [User taps "See full details"]

Detailed Breakdown (Expanded)
├── 8-Dimension Scores (Visual bars)
│   🩸 Blood Sugar Impact: 45/100 [Orange]
│   🌾 Gut Health: 30/100 [Red]
│   🔥 Inflammation: 60/100 [Yellow]
│   💎 Nutrient Density: 55/100 [Yellow]
│   🏭 Processing Level: 70/100 [Green]
│   💪 Protein Quality: 70/100 [Green]
│   🧪 Micronutrient Coverage: 40/100 [Orange]
│   ⭐ Overall Health: 65/100 [Yellow]
│
├── Nutrition Facts (Collapsible)
│   Calories: 520 kcal
│   Protein: 28g
│   Carbs: 65g
│   Fat: 18g
│   Fiber: 3g
│   [See full nutrition table]
│
├── Ingredients Detected
│   🍚 Rice (jasmine white rice)
│   🥩 Pork (minced)
│   🌶️ Chili peppers
│   🌿 Holy basil
│   🥚 Egg
│   🧄 Garlic
│   [Edit ingredients]
│
├── Health Insights (Personalized)
│   "⚠️ สำหรับเป้าหมายลดน้ำหนักของคุณ:"
│   (For your weight loss goal:)
│   - ถือว่าแคลอรี่ปานกลาง (Moderate calories)
│   - แนะนำเพิ่มผักเยอะๆ (Recommend adding more vegetables)
│   - พอดีสำหรับมื้อกลางวัน (Good for lunch portion)
│
└── Actions
    [แชร์ (Share)] [บันทึก (Save)] [ถามโค้ช (Ask AI)]
```

**Key Improvements:**
✅ 1-tap access (FAB vs. navigation)
✅ 3-5 second processing with engaging animation (not boring spinner)
✅ Progressive disclosure (overall → highlights → full details)
✅ Confidence score shown (90% match)
✅ Quick actions prominent
✅ Contextual "how to make healthier" tips
✅ Personalized to user goal
✅ Auto-logged with undo option

**Time savings:** 15 seconds → 8 seconds (47% faster)
**Engagement:** Animated, visual, rewarding (not cold/technical)

---

### 3.2 Navigation Optimization Roadmap

**Phase 1 (Month 1): Foundation**
- ✅ Implement bottom tab navigation (5 tabs)
- ✅ Add persistent FAB for scanning
- ✅ Create consistent top bar patterns
- ✅ Add swipe gestures (delete, save)
- ✅ Implement deep linking (share recipe, share scan)

**Phase 2 (Month 2-3): Polish**
- ✅ Add navigation animations (smooth transitions)
- ✅ Implement gesture navigation (swipe between tabs)
- ✅ Add breadcrumbs for deep navigation
- ✅ Create universal search (global search bar)
- ✅ Add quick actions (long-press context menus)

**Phase 3 (Month 4-6): Advanced**
- ✅ Voice navigation ("สแกนอาหาร" = open camera)
- ✅ Smart suggestions (AI-powered shortcuts)
- ✅ Adaptive navigation (changes based on usage patterns)
- ✅ Accessibility shortcuts (TalkBack, VoiceOver optimized)

---

## 4. FEATURE PRIORITIZATION MATRIX

### 4.1 RICE Scoring (Reach × Impact × Confidence / Effort)

**Formula:** `RICE Score = (Reach × Impact × Confidence) / Effort`

**Scoring Guide:**
- **Reach:** # of users affected per month (MAU projection)
- **Impact:** Scale of 0.25 (minimal) to 3 (massive)
- **Confidence:** % certainty (50% = 0.5, 100% = 1.0)
- **Effort:** Person-months required

---

**Top 20 Features (Ranked by RICE Score):**

| Rank | Feature | Reach | Impact | Confidence | Effort | **RICE Score** | Priority |
|------|---------|-------|--------|------------|--------|----------------|----------|
| 1 | **Onboarding UX overhaul** | 10,000 | 3.0 | 100% | 0.5 | **60,000** | P0 |
| 2 | **FAB instant camera access** | 8,000 | 2.5 | 100% | 0.25 | **80,000** | P0 |
| 3 | **Daily scan streaks** | 8,000 | 2.5 | 90% | 0.5 | **36,000** | P0 |
| 4 | **Achievement badges (5)** | 7,000 | 2.0 | 90% | 1.0 | **12,600** | P0 |
| 5 | **AI coach personality ("P'Nui")** | 6,000 | 2.0 | 80% | 1.5 | **6,400** | P1 |
| 6 | **LINE Official Account** | 10,000 | 1.5 | 80% | 2.0 | **6,000** | P0 |
| 7 | **Scan result progressive disclosure** | 8,000 | 1.5 | 90% | 0.5 | **21,600** | P0 |
| 8 | **Personalized recipe recommendations** | 5,000 | 2.0 | 70% | 2.0 | **3,500** | P1 |
| 9 | **Social proof in onboarding** | 10,000 | 1.0 | 100% | 0.25 | **40,000** | P0 |
| 10 | **Suggested AI coach questions** | 4,000 | 1.5 | 80% | 0.5 | **9,600** | P1 |
| 11 | **Meal planning drag-drop** | 3,000 | 2.0 | 70% | 3.0 | **1,400** | P2 |
| 12 | **Restaurant menu scanning** | 4,000 | 2.0 | 60% | 4.0 | **1,200** | P2 |
| 13 | **Community challenges** | 5,000 | 1.5 | 60% | 3.0 | **1,500** | P2 |
| 14 | **Voice input for AI coach** | 3,000 | 1.5 | 70% | 2.0 | **1,575** | P2 |
| 15 | **Family dashboard** | 2,000 | 2.5 | 80% | 4.0 | **1,000** | P2 |
| 16 | **B2B admin dashboard** | 500 | 3.0 | 90% | 5.0 | **270** | P2 |
| 17 | **Recipe creator (UGC)** | 4,000 | 1.0 | 50% | 6.0 | **333** | P3 |
| 18 | **CGM integration** | 1,000 | 3.0 | 50% | 8.0 | **188** | P3 |
| 19 | **AR nutrition overlay** | 2,000 | 1.0 | 30% | 10.0 | **60** | P3 |
| 20 | **Smartwatch app** | 3,000 | 1.5 | 60% | 6.0 | **450** | P3 |

---

### 4.2 MoSCoW Prioritization (Launch MVP)

**Must Have (Launch Blockers):**
- ✅ Redesigned onboarding flow
- ✅ FAB instant camera access
- ✅ Daily scan streaks
- ✅ 5 achievement badges minimum
- ✅ LINE Official Account integration
- ✅ Progressive disclosure in scan results
- ✅ Social proof in onboarding
- ✅ Basic user testing (5+ users)
- ✅ WCAG 2.1 AA P0 fixes (contrast, keyboard nav)

**Should Have (Post-Launch Month 1-3):**
- ✅ AI coach personality & suggested questions
- ✅ Personalized recipe recommendations
- ✅ Enhanced gamification (10+ badges, weekly challenges)
- ✅ Voice input for AI coach
- ✅ Design system documentation
- ✅ Full accessibility audit & fixes

**Could Have (Month 3-6):**
- ✅ Meal planning drag-drop calendar
- ✅ Restaurant menu scanning
- ✅ Community features (challenges, leaderboards)
- ✅ Family dashboard
- ✅ B2B admin dashboard

**Won't Have (Now) — Defer to Horizon 3:**
- ❌ Recipe creator (user-generated content)
- ❌ CGM integration
- ❌ AR nutrition overlay
- ❌ Smartwatch app
- ❌ Marketplace (order ingredients)

---

### 4.3 Kano Model Analysis

**Kano Categories:**

1. **Basic (Must-Be) — Expected by users, no delight if present, major dissatisfaction if absent**
   - Food scanning works accurately (90%+ recognition)
   - App loads fast (<3s)
   - Thai language support
   - Privacy/data security
   - Basic calorie/macro tracking

2. **Performance (Satisfiers) — Linear satisfaction: more = better**
   - Scan speed (faster = better)
   - Recipe database size (more = better)
   - Accuracy of nutrition calculations
   - Number of supported dietary filters
   - Personalization quality

3. **Excitement (Delighters) — Unexpected features that create wow moments**
   - Daily scan streaks 🔥 (powerful engagement)
   - Achievement badges 🏆 (gamification)
   - AI coach with personality ("P'Nui")
   - Instant FAB camera access
   - Confetti celebration on milestones
   - Blood sugar eating sequence education
   - Healthier recipe alternatives
   - LINE integration with Thai users

4. **Indifferent — Users don't care either way**
   - Dark mode (nice-to-have, not critical for nutrition app)
   - Multiple color themes
   - Animated avatars
   - Excessive customization options

5. **Reverse — Features that some users dislike**
   - Too many notifications
   - Forced social features (some users want privacy)
   - Overly complex gamification (can feel manipulative)
   - Intrusive ads (even in free tier)

**Strategic Implications:**
- **Nail basics first:** 90%+ Thai food recognition, fast performance, security
- **Invest in delighters:** Streaks, badges, AI personality = differentiation
- **Optimize satisfiers:** Continuously improve speed, database, personalization
- **Avoid reverse features:** Optional social, respectful notifications, no intrusive ads in free tier

---

## 5. DESIGN SYSTEM ROADMAP

### 5.1 Design System Foundation (Month 1-2)

**Component Library Priority:**

**Tier 1 (P0): Core Components**
- ✅ Buttons (primary, secondary, tertiary, icon, FAB)
- ✅ Forms (input, textarea, select, checkbox, radio, toggle)
- ✅ Cards (recipe, scan, achievement, insight)
- ✅ Navigation (bottom tabs, top bar, FAB)
- ✅ Typography scale (H1-H6, body, caption, labels)
- ✅ Color system (light mode tokens)
- ✅ Spacing scale (4px base, 8/12/16/24/32/48/64)
- ✅ Icons (custom Thai food icons + standard UI icons)

**Tier 2 (P1): Enhanced Components**
- ✅ Modals & dialogs
- ✅ Toasts & notifications
- ✅ Progress indicators (circular, linear, streaks)
- ✅ Charts (nutrition scores, trends)
- ✅ Badges & pills
- ✅ Avatars
- ✅ Tooltips & popovers
- ✅ Empty states
- ✅ Error states
- ✅ Skeleton screens (loading states)

**Tier 3 (P2): Advanced Components**
- ✅ Dark mode tokens
- ✅ Drag-and-drop components
- ✅ Calendar components
- ✅ Chat interface components
- ✅ Animation library (microinteractions)
- ✅ Illustration library

---

### 5.2 Design Tokens

**Color Palette (Light Mode):**

```css
/* Primary Colors */
--color-primary: #22C55E;        /* Fresh Green */
--color-primary-dark: #16A34A;
--color-primary-light: #86EFAC;

/* Secondary Colors */
--color-secondary: #F97316;      /* Warm Orange */
--color-secondary-dark: #EA580C;
--color-secondary-light: #FDBA74;

/* Accent Colors */
--color-accent: #3B82F6;         /* Deep Blue */
--color-accent-dark: #2563EB;
--color-accent-light: #93C5FD;

/* Semantic Colors */
--color-success: #10B981;        /* Green */
--color-warning: #F59E0B;        /* Amber */
--color-error: #EF4444;          /* Red */
--color-info: #3B82F6;           /* Blue */

/* Neutral Colors */
--color-gray-900: #111827;       /* Darkest text */
--color-gray-800: #1F2937;
--color-gray-700: #374151;
--color-gray-600: #4B5563;
--color-gray-500: #6B7280;       /* Body text */
--color-gray-400: #9CA3AF;
--color-gray-300: #D1D5DB;
--color-gray-200: #E5E7EB;
--color-gray-100: #F3F4F6;
--color-gray-50: #F9FAFB;        /* Backgrounds */

/* Thai Flag Integration */
--color-thai-red: #ED1C24;
--color-thai-white: #FFFFFF;
--color-thai-blue: #2D2A4A;
```

**Typography Scale:**

```css
/* Font Families */
--font-thai: 'Sarabun', 'Prompt', sans-serif;
--font-english: 'Inter', 'Roboto', sans-serif;
--font-mono: 'JetBrains Mono', monospace;

/* Font Sizes (Mobile First) */
--text-xs: 0.75rem;      /* 12px */
--text-sm: 0.875rem;     /* 14px */
--text-base: 1rem;       /* 16px */
--text-lg: 1.125rem;     /* 18px */
--text-xl: 1.25rem;      /* 20px */
--text-2xl: 1.5rem;      /* 24px */
--text-3xl: 1.875rem;    /* 30px */
--text-4xl: 2.25rem;     /* 36px */
--text-5xl: 3rem;        /* 48px */

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

**Spacing Scale:**

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

---

### 5.3 Figma Design System (Month 2-3)

**Structure:**

```
NutriVision Design System (Figma File)
├── 📄 Cover (overview, team, changelog)
├── 🎨 Foundation
│   ├── Colors (all tokens, usage examples)
│   ├── Typography (scale, pairings, examples)
│   ├── Spacing (scale, usage grid)
│   ├── Iconography (custom + system icons)
│   └── Illustrations (brand illustrations, empty states)
│
├── 🧩 Components
│   ├── Buttons (all variants, states)
│   ├── Forms (inputs, selects, validation states)
│   ├── Cards (recipe, scan, insight variants)
│   ├── Navigation (bottom tabs, top bar, FAB)
│   ├── Feedback (toasts, modals, alerts)
│   ├── Data Display (charts, progress, badges)
│   └── Complex (calendar, chat, meal planner)
│
├── 📐 Patterns
│   ├── Onboarding flows
│   ├── Scanning flows
│   ├── Recipe discovery
│   ├── AI coach chat
│   ├── Empty states
│   ├── Error states
│   └── Loading states
│
├── 📱 Templates
│   ├── Dashboard variations
│   ├── Recipe detail
│   ├── Scan results
│   ├── Profile/settings
│   └── Marketing pages
│
└── 📚 Documentation
    ├── Usage guidelines
    ├── Accessibility notes
    ├── Do's and don'ts
    └── Code snippets (for developers)
```

**Deliverables:**
- Figma component library (shared with team)
- Design tokens exported (Style Dictionary)
- Documentation site (Storybook or similar)
- Developer handoff specs (Zeplin or Figma inspect)

---

## 6. CONTENT STRATEGY & SITEMAP

### 6.1 Content Hierarchy (Website)

**Level 1: Marketing (Public)**
- Home
- Features
- Pricing
- Blog
- For Business
- About
- Contact

**Level 2: App (Authenticated)**
- Dashboard
- Scan
- Recipes
- AI Coach
- Meal Planner
- Progress
- Profile
- Settings

**Level 3: Deep Content**
- Recipe Detail
- Scan History Detail
- Chat Conversation
- Weekly Meal Plan
- Achievement Details
- Blog Article
- Help Article

---

### 6.2 Content Strategy by Section

**Marketing Website Content:**

**Homepage:**
- Hero: "รู้จักอาหารไทยของคุณใน 3 วินาที" (Know your Thai food in 3 seconds)
- How it works (3 steps): Scan → Analyze → Improve
- Features showcase (visual)
- Social proof: "10,000+ Thai users improving their health"
- Pricing preview
- CTA: "Start Free" / "เริ่มฟรี"

**Features Page:**
- AI Food Recognition (with demo video)
- 8-Dimension Scoring (interactive explainer)
- Thai Recipe Database (sample recipes)
- AI Coach (chat demo)
- Meal Planning (calendar visual)
- Blood Sugar Management (before/after)

**Pricing Page:**
- Free vs Premium vs Family (comparison table)
- FAQ accordion
- Trust indicators (PDPA, secure payment, cancel anytime)
- CTA: "Start Free Trial" / "ทดลองฟรี 7 วัน"

**Blog:**
- SEO-optimized Thai nutrition articles
- Categories: Blood Sugar, Weight Loss, Thai Recipes, Health Tips
- Author: Nutrition experts (credibility)
- Share buttons (LINE, Facebook, Twitter)

---

**App Content Strategy:**

**Dashboard:**
- Headline: "วันนี้คุณสแกนอาหารแล้วหรือยัง?" (Have you scanned your food today?)
- Streak indicator: "🔥 7 วันติดต่อกัน!" (7 day streak!)
- Today's summary: Visual progress rings
- Personalized nudge: Contextual based on time/behavior
- Quick actions: Scan, Browse recipes, Ask coach

**Scan Results:**
- Overall score: Large, visual, color-coded
- Top highlights: 3 most important insights
- Confidence indicator: "90% match"
- Quick actions: Edit, Add to log, Ask coach
- Healthier alternatives: "Try this instead..."

**Recipe Detail:**
- Beautiful hero image
- Cooking time, servings, difficulty
- 8-dimension scores (visual)
- Ingredients list (with shopping list button)
- Step-by-step instructions (numbered, with images)
- Nutrition facts (collapsible)
- User reviews/ratings (future)
- Similar recipes

**AI Coach Chat:**
- Welcome message: "สวัสดีค่ะ! ฉันชื่อพี่นุ้ย 😊" (Hi! I'm P'Nui)
- Suggested questions:
  - "Som tam มีผลต่อน้ำตาลอย่างไร?" (How does som tam affect blood sugar?)
  - "อาหารไหนดีสำหรับลดน้ำหนัก?" (What foods are good for weight loss?)
  - "ฉันควรกินอะไรเมื่อหิว?" (What should I eat when hungry?)
- Chat bubbles: User (right, blue), AI (left, gray)
- Quick reply buttons below AI messages
- Typing indicator: "พี่นุ้ยกำลังพิมพ์..." (P'Nui is typing...)

---

### 6.3 Microcopy Library

**Button Labels:**
- ❌ "Submit" → ✅ "วิเคราะห์อาหาร" (Analyze Food)
- ❌ "Save" → ✅ "บันทึก" (Save)
- ❌ "Cancel" → ✅ "ยกเลิก" (Cancel)
- ❌ "Delete" → ✅ "ลบ" (Delete)
- ❌ "Edit" → ✅ "แก้ไข" (Edit)

**Error Messages:**
- ❌ "Error 404" → ✅ "ไม่พบหน้านี้ ลองค้นหาสูตรอาหารอย่างอื่นไหม?" (Page not found. Try searching for something else?)
- ❌ "Invalid input" → ✅ "กรุณากรอกอีเมลให้ถูกต้อง" (Please enter a valid email)
- ❌ "Permission denied" → ✅ "เราต้องใช้กล้องเพื่อสแกนอาหาร เปิดในการตั้งค่าได้เลย" (We need camera access to scan food. Enable it in Settings?)

**Empty States:**
- ❌ "No data" → ✅ "ยังไม่มีการสแกน! กดปุ่มกล้องเพื่อวิเคราะห์มื้อแรก" (No scans yet! Tap the camera button to analyze your first meal)
- ❌ "No recipes" → ✅ "คุณยังไม่มีสูตรโปรด ลองดูสูตรไทย 1,000+ สูตรของเรา!" (Your favorites list is empty. Browse our 1,000+ Thai recipes!)

**Success Messages:**
- ✅ "บันทึกเรียบร้อย!" (Saved successfully!)
- ✅ "เพิ่มลงแผนอาหารแล้ว!" (Added to meal plan!)
- ✅ "แชร์ไปที่ LINE แล้ว!" (Shared to LINE!)

---

## 7. PHASED IMPLEMENTATION PLAN

### 7.1 Pre-Launch (Weeks 1-4)

**Week 1-2: Critical UX Fixes**
- [ ] Redesign onboarding flow (Noom-inspired)
- [ ] Add FAB instant camera access
- [ ] Implement daily scan streaks
- [ ] Create 5 achievement badges
- [ ] Add social proof to onboarding
- [ ] Implement progressive disclosure in scan results

**Week 3: User Testing**
- [ ] Recruit 5+ Thai users
- [ ] Conduct think-aloud usability tests
- [ ] Test 3 critical tasks: onboarding, scanning, recipe discovery
- [ ] Iterate based on feedback

**Week 4: Polish & Launch Prep**
- [ ] Fix P0 issues from user testing
- [ ] Accessibility audit (automated + manual)
- [ ] Performance optimization (Lighthouse score 90+)
- [ ] LINE Official Account setup
- [ ] Marketing website final polish

---

### 7.2 Launch Month (Month 1)

**Week 1: Soft Launch**
- [ ] Launch to 100 beta users (friends, family, testers)
- [ ] Monitor metrics: retention, completion rates, bugs
- [ ] Gather qualitative feedback
- [ ] Fix critical bugs

**Week 2-3: Public Launch**
- [ ] Launch marketing campaign (TikTok, Instagram, LINE)
- [ ] Press release (Thai tech blogs)
- [ ] Influencer partnerships (5-10 micro-influencers)
- [ ] Monitor: onboarding completion, first scan rate, retention

**Week 4: Iterate**
- [ ] Analyze first 1,000 users
- [ ] Fix onboarding drop-off points
- [ ] Optimize conversion funnel
- [ ] Enhance gamification based on engagement data

---

### 7.3 Growth Phase (Months 2-6)

**Month 2:**
- [ ] AI coach personality launch ("P'Nui")
- [ ] Enhanced gamification (10+ badges, weekly challenges)
- [ ] Personalized recipe recommendations
- [ ] Design system documentation complete
- [ ] Full accessibility audit & fixes

**Month 3-4:**
- [ ] Meal planning drag-drop calendar
- [ ] Voice input for AI coach
- [ ] Community challenges (beta)
- [ ] B2B pilot program (5 companies)

**Month 5-6:**
- [ ] Restaurant menu scanning
- [ ] Family dashboard
- [ ] Leaderboards (optional, privacy-respecting)
- [ ] Integration: Apple Health, Google Fit
- [ ] Analytics dashboard for users

---

### 7.4 Innovation Phase (Months 7-12)

**Month 7-9:**
- [ ] Multimodal AI (voice + vision)
- [ ] Predictive meal suggestions
- [ ] Marketplace integration (order ingredients)
- [ ] Nutritionist consultation booking

**Month 10-12:**
- [ ] CGM integration (continuous glucose monitor)
- [ ] AR nutrition overlay (experimental)
- [ ] Smartwatch app (Apple Watch)
- [ ] Recipe creator (user-generated content)

---

### 7.5 Regional Expansion (Months 13-18)

**Month 13-15: Malaysia & Singapore**
- [ ] Localize for Malay, English (Singapore)
- [ ] Add regional recipes (Malaysian, Singaporean)
- [ ] Payment integration (local methods)
- [ ] Regulatory compliance

**Month 16-18: Indonesia & Vietnam**
- [ ] Localize for Bahasa Indonesia, Vietnamese
- [ ] Cultural adaptation (dietary patterns, measurements)
- [ ] Local partnerships (food delivery, health providers)
- [ ] Scale infrastructure for 1M+ users

---

## CONCLUSION: UX/UI ROADMAP SUMMARY

### **Strategic Priorities:**

**Horizon 1 (Months 1-6): Foundation**
Focus: Launch with excellent core UX, achieve product-market fit
Key Deliverables: Optimized onboarding, gamification, instant scanning, LINE integration

**Horizon 2 (Months 6-12): Growth**
Focus: Scale to 100K MAU with high engagement
Key Deliverables: Advanced features (meal planning, community, B2B), design system, voice input

**Horizon 3 (Months 12-18): Innovation**
Focus: Category-defining features before Apple Health+ launches
Key Deliverables: Multimodal AI, CGM, AR, smartwatch app, regional expansion

### **Success Metrics by Horizon:**

| Metric | Horizon 1 | Horizon 2 | Horizon 3 |
|--------|-----------|-----------|-----------|
| MAU | 10K | 100K | 500K |
| Day 30 Retention | 25% | 30% | 35% |
| Free-to-Paid | 4% | 5% | 5.5% |
| NPS | 30+ | 40+ | 50+ |
| First Scan Completion | 60% | 70% | 75% |

### **Investment Required:**

**Design/UX Team:**
- Month 1-6: 2 UX designers + 1 UI designer
- Month 7-12: 3 UX designers + 2 UI designers + 1 UX researcher
- Month 13-18: 4 UX designers + 3 UI designers + 1 UX researcher + 1 content designer

**Estimated UX/UI Budget:**
- Horizon 1: THB 3M ($83K) — Critical fixes + launch
- Horizon 2: THB 6M ($167K) — Advanced features + scale
- Horizon 3: THB 9M ($250K) — Innovation + regional expansion

**Total 18-Month UX/UI Investment:** THB 18M ($500K)

---

**Next:** Group C — Position Analysis & UX Research Models

