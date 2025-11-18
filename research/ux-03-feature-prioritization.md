# Feature Analysis & Prioritization

**Last Updated:** November 18, 2025
**Purpose:** Feature prioritization using MoSCoW, RICE, and Kano Model frameworks

---

## Table of Contents

1. [Feature Inventory](#feature-inventory)
2. [MoSCoW Analysis](#moscow-analysis)
3. [RICE Scoring](#rice-scoring)
4. [Kano Model Classification](#kano-model-classification)
5. [Final Feature Roadmap](#final-feature-roadmap)
6. [MVP Scope Definition](#mvp-scope-definition)

---

## Feature Inventory

### All Potential Features (Comprehensive List)

#### Core Nutrition Tracking
1. AI camera food scanning (photo recognition)
2. Manual food entry with search database
3. Barcode scanner for packaged foods
4. Voice input for food logging
5. Portion size estimation (visual guides)
6. Meal time tagging (breakfast, lunch, dinner, snacks)
7. Favorite foods quick-add
8. Recent foods quick-add
9. Copy meals from previous days
10. Bulk food entry (multiple items at once)

#### Nutrition Analysis & Scoring
11. 8-dimension nutrition scoring system
12. Blood sugar impact score (glycemic load)
13. Gut health score (fiber, probiotics)
14. Inflammation score (omega ratios, antioxidants)
15. Nutrient density score (ANDI-based)
16. Processing level score (NOVA classification)
17. Protein quality score (amino acid profile)
18. Micronutrient coverage score (% RDI)
19. Overall health score (weighted average)
20. Macro tracking (protein, carbs, fat)
21. Calorie tracking
22. Micronutrient tracking (vitamins, minerals)
23. Hydration tracking (water intake)

#### Thai Food Specialization
24. Thai recipe database (1,000+ recipes)
25. Regional Thai food variations (Southern, Northern, Isaan)
26. Thai ingredient encyclopedia
27. Thai measurement conversions (tablespoon, cup, etc.)
28. Eating sequence education (vegetables → protein → carbs)
29. Thai traditional food wisdom integration
30. Street food nutrition database
31. Restaurant chain menu database (Thai brands)

#### AI & Personalization
32. AI nutrition coach chatbot (Thai language)
33. Personalized meal suggestions
34. Smart grocery shopping lists
35. Recipe recommendations based on goals
36. Predictive meal planning
37. Eating pattern analysis
38. Progress predictions (goal achievement timeline)
39. Anomaly detection (unusual eating patterns)
40. Personalized goal setting

#### Recipes & Meal Planning
41. Recipe search and filtering
42. Meal planning calendar
43. Weekly meal prep planner
44. Custom recipe creation
45. Recipe nutrition calculation
46. Recipe sharing with community
47. Save favorite recipes
48. Recipe collections/folders
49. Grocery list generation from recipes
50. Cooking instructions step-by-step
51. Recipe scaling (servings adjustment)

#### Progress Tracking & Visualization
52. Daily nutrition dashboard
53. Weekly/monthly trend charts
54. Weight tracking
55. Body measurements tracking
56. Progress photos
57. Goal progress visualization
58. Historical data analysis
59. Nutrition score trends
60. Export data (CSV, PDF reports)

#### Gamification & Motivation
61. Badges and achievements
62. Daily login streaks
63. Scanning streaks
64. Points/rewards system
65. Level progression system
66. Daily/weekly challenges
67. Milestone celebrations (animations)
68. Progress sharing on social media

#### Social & Community
69. Friend connections
70. Friend activity feed
71. Community leaderboards
72. Group challenges
73. Recipe sharing with friends
74. Meal sharing (social posts)
75. Direct messaging
76. Community forums
77. Success story showcase

#### Integrations
78. LINE Login
79. LINE sharing integration
80. Apple Health sync
81. Google Fit sync
82. Fitness tracker integration (Fitbit, Garmin)
83. Smart scale integration
84. Continuous glucose monitor (CGM) integration
85. Food delivery app integration (GrabFood, LINE MAN)
86. Restaurant discovery integration
87. Calendar integration (meal planning)

#### Accessibility & Convenience
88. Offline mode (saved content accessible)
89. Dark mode / light mode toggle
90. Voice navigation
91. Multi-language support (Thai, English)
92. Push notifications (reminders, streaks, achievements)
93. Widget (home screen quick scan)
94. Apple Watch app
95. Wear OS app
96. Text size customization
97. High contrast mode
98. Screen reader optimization

#### B2B / Enterprise
99. Corporate wellness dashboard (admin view)
100. Team challenges
101. Bulk user management
102. Employee health analytics
103. HRIS integration
104. Wellness program reporting
105. Custom branding (white-label)

#### Premium / Advanced
106. Nutritionist consultation booking
107. Personalized meal plans (created by nutritionists)
108. Video consultations
109. Lab result integration (blood tests)
110. Supplement recommendations
111. Advanced blood sugar tracking (CGM)
112. DNA-based nutrition recommendations (future)
113. Meal delivery service integration
114. Priority customer support

---

## MoSCoW Analysis

### Must Have (MVP - Phase 1)

**Core Value Proposition Features**

✅ **AI Camera Food Scanning** (#1)
- **Why**: Core differentiator, eliminates manual entry friction (67% pain point)
- **User Value**: 10/10
- **Technical Feasibility**: High (Google Gemini Vision API)
- **Cost**: Medium (API costs but manageable)

✅ **Thai Recipe Database** (#24)
- **Why**: Unique positioning, no competitor has this depth
- **User Value**: 9/10
- **Thai Market Fit**: Critical

✅ **8-Dimension Nutrition Scoring** (#11-19)
- **Why**: Proprietary system, simplifies complex nutrition
- **User Value**: 9/10
- **Competitive Advantage**: High

✅ **Blood Sugar Impact Score** (#12)
- **Why**: Addresses #1 Thai health concern (rice-heavy diet)
- **User Value**: 10/10 (for Thai market)
- **Differentiation**: High

✅ **AI Nutrition Coach Chatbot** (#32)
- **Why**: Personalized guidance, replaces expensive human coaching
- **User Value**: 8/10
- **Engagement**: High (retention driver)

✅ **Thai Language Support** (#91)
- **Why**: Mandatory for Thai market (66% prefer native language)
- **User Value**: 10/10 (Thai market)

✅ **Manual Food Entry Fallback** (#2)
- **Why**: AI won't be 100% accurate, users need backup
- **User Value**: 7/10
- **Completeness**: Required

✅ **Daily Nutrition Dashboard** (#52)
- **Why**: Users need to see their progress and scores
- **User Value**: 9/10
- **Engagement**: Daily touchpoint

✅ **LINE Login Integration** (#78)
- **Why**: 52M Thai users, reduces friction, builds trust
- **User Value**: 8/10 (Thai market)
- **Conversion**: Increases signup rate

✅ **PromptPay Payment** (#included in payments)
- **Why**: Most trusted payment method in Thailand
- **User Value**: 7/10
- **Conversion**: Reduces payment friction

✅ **Offline Mode (Basic)** (#88)
- **Why**: Unreliable networks in some areas, view saved content
- **User Value**: 6/10
- **PWA Requirement**: Expected feature

✅ **Portion Size Estimation** (#5)
- **Why**: Accuracy depends on correct portion sizes
- **User Value**: 7/10
- **UX**: Visual guides (small/medium/large)

---

### Should Have (Phase 1 or Early Phase 2)

🟡 **Recipe Search & Filtering** (#41)
- **Why**: Users need to find recipes easily
- **User Value**: 8/10
- **Engagement**: Increases recipe usage

🟡 **Meal Planning Calendar** (#42)
- **Why**: Users requested feature (survey finding)
- **User Value**: 7/10
- **Retention**: Encourages daily app usage

🟡 **Progress Tracking (Weight, Measurements)** (#54-55)
- **Why**: Users want to see outcomes
- **User Value**: 8/10
- **Motivation**: Proof of results

🟡 **Gamification (Badges, Streaks, Achievements)** (#61-67)
- **Why**: 50% higher retention with gamification
- **User Value**: 7/10 (varies by user)
- **Retention**: Critical for engagement

🟡 **Apple Health / Google Fit Integration** (#80-81)
- **Why**: 45% of users already use these platforms
- **User Value**: 6/10
- **Ecosystem**: Better user experience

🟡 **Dark Mode** (#89)
- **Why**: 2025 standard, user expectation
- **User Value**: 5/10 (preference-based)
- **Effort**: Low (CSS variables)

🟡 **Push Notifications (Reminders)** (#92)
- **Why**: Habit formation, bring users back
- **User Value**: 6/10
- **Retention**: Increases D7 retention

🟡 **Favorite Foods Quick-Add** (#7)
- **Why**: Reduces friction for repeat meals
- **User Value**: 7/10
- **Efficiency**: Saves time

🟡 **Barcode Scanner** (#3)
- **Why**: Common feature users expect
- **User Value**: 5/10 (less relevant for Thai fresh food)
- **Effort**: Medium

🟡 **Macro Tracking (Protein, Carbs, Fat)** (#20)
- **Why**: Fitness enthusiasts expect this
- **User Value**: 7/10 (segment-specific)
- **Completeness**: Standard feature

🟡 **Eating Sequence Education** (#28)
- **Why**: Unique Thai health education (70% blood sugar reduction)
- **User Value**: 8/10
- **Differentiation**: Medium-high

---

### Could Have (Phase 2)

🔵 **Voice Input for Food Logging** (#4)
- **Why**: Hands-free convenience
- **User Value**: 6/10
- **Effort**: Medium (speech recognition complexity)

🔵 **Custom Recipe Creation** (#44)
- **Why**: Users may want to add family recipes
- **User Value**: 6/10
- **Engagement**: Niche use case

🔵 **Social Features (Friends, Sharing, Leaderboards)** (#69-77)
- **Why**: Community increases retention
- **User Value**: 5/10 (privacy concerns for some)
- **Retention**: High for engaged users

🔵 **Meal Prep Planner** (#43)
- **Why**: Helps with weekly planning
- **User Value**: 6/10
- **Niche**: More advanced users

🔵 **Progress Photos** (#56)
- **Why**: Visual transformation tracking
- **User Value**: 7/10 (for weight loss segment)
- **Privacy**: May require careful UX

🔵 **Export Data (Reports)** (#59)
- **Why**: Share with doctors, personal records
- **User Value**: 5/10
- **GDPR**: Required for compliance

🔵 **Widget (Home Screen)** (#93)
- **Why**: Quick access to scan
- **User Value**: 5/10
- **Platform**: iOS/Android native only

🔵 **Hydration Tracking** (#23)
- **Why**: Complete wellness picture
- **User Value**: 5/10
- **Effort**: Low

🔵 **Restaurant Chain Menus** (#31)
- **Why**: Eating out is common
- **User Value**: 7/10
- **Data**: Requires partnerships

🔵 **Personalized Meal Suggestions** (#33)
- **Why**: Reduces decision fatigue
- **User Value**: 7/10
- **AI Complexity**: Medium

---

### Won't Have (Not in roadmap / Future)

❌ **DNA-Based Nutrition** (#112)
- **Why**: Too futuristic, unproven science
- **Phase**: Phase 4+ (2026+)

❌ **Video Consultations** (#108)
- **Why**: Requires licensed nutritionists, regulatory complexity
- **Phase**: Phase 3+ (partnership model)

❌ **Meal Delivery Integration** (#113)
- **Why**: Operational complexity
- **Phase**: Phase 3 (partnership opportunity)

❌ **White-Label / Custom Branding** (#105)
- **Why**: Enterprise feature, not MVP focus
- **Phase**: Phase 2 B2B

❌ **Smartwatch Apps** (#94-95)
- **Why**: Limited value vs. effort
- **Phase**: Phase 3+

❌ **Community Forums** (#76)
- **Why**: Moderation required, spam risk
- **Phase**: Phase 3+

❌ **Direct Messaging** (#75)
- **Why**: Privacy and moderation concerns
- **Phase**: Not planned

❌ **Supplement Recommendations** (#110)
- **Why**: Regulatory risk (medical advice)
- **Phase**: Not planned (avoid medical device classification)

---

## RICE Scoring

**Formula**: (Reach × Impact × Confidence) / Effort = RICE Score

**Scoring Scale**:
- **Reach**: Estimated number of users affected per quarter (0-10,000 scale)
- **Impact**: User value impact (3=Massive, 2=High, 1=Medium, 0.5=Low, 0.25=Minimal)
- **Confidence**: How confident are we in estimates (100%=1.0, 80%=0.8, 50%=0.5)
- **Effort**: Person-months required (1, 2, 4, 8, etc.)

### Top 20 Features by RICE Score

| Rank | Feature | Reach | Impact | Confidence | Effort | RICE Score |
|------|---------|-------|--------|------------|--------|------------|
| 1 | AI Camera Food Scanning | 10,000 | 3 | 0.8 | 4 | **6,000** |
| 2 | Thai Recipe Database (1K+) | 8,000 | 2 | 0.9 | 3 | **4,800** |
| 3 | 8-Dimension Scoring | 9,000 | 2 | 0.7 | 2 | **6,300** |
| 4 | Blood Sugar Impact Score | 8,000 | 3 | 0.8 | 1 | **19,200** |
| 5 | AI Nutrition Chatbot | 7,000 | 2 | 0.6 | 4 | **2,100** |
| 6 | LINE Login | 9,000 | 1 | 1.0 | 1 | **9,000** |
| 7 | Daily Dashboard | 10,000 | 2 | 0.9 | 2 | **9,000** |
| 8 | Manual Food Entry | 10,000 | 1 | 1.0 | 2 | **5,000** |
| 9 | Gamification (Badges/Streaks) | 6,000 | 2 | 0.7 | 2 | **4,200** |
| 10 | Thai Language Support | 10,000 | 2 | 1.0 | 1 | **20,000** |
| 11 | Meal Planning Calendar | 5,000 | 1 | 0.6 | 3 | **1,000** |
| 12 | Progress Tracking (Weight) | 7,000 | 1 | 0.8 | 1 | **5,600** |
| 13 | Push Notifications | 8,000 | 1 | 0.7 | 1 | **5,600** |
| 14 | Offline Mode | 6,000 | 1 | 0.8 | 2 | **2,400** |
| 15 | Recipe Search & Filter | 6,000 | 1 | 0.8 | 1 | **4,800** |
| 16 | Apple Health / Google Fit | 4,000 | 1 | 0.6 | 2 | **1,200** |
| 17 | Dark Mode | 5,000 | 0.5 | 0.9 | 0.5 | **4,500** |
| 18 | Barcode Scanner | 4,000 | 0.5 | 0.7 | 2 | **700** |
| 19 | Eating Sequence Education | 6,000 | 1 | 0.6 | 1 | **3,600** |
| 20 | Macro Tracking | 5,000 | 1 | 0.8 | 1 | **4,000** |

### RICE Insights

**Highest Impact Features:**
1. **Thai Language Support** (20,000) - Low effort, high reach, massive impact
2. **Blood Sugar Impact Score** (19,200) - Critical for Thai market
3. **Daily Dashboard** (9,000) - Essential for user engagement
4. **LINE Login** (9,000) - Reduces signup friction

**Quick Wins (High RICE, Low Effort):**
- Thai Language Support (1 month effort, 20K score)
- Dark Mode (0.5 month effort, 4.5K score)
- Push Notifications (1 month effort, 5.6K score)
- Progress Weight Tracking (1 month effort, 5.6K score)

**Strategic Bets (High Effort, High Impact):**
- AI Camera Scanning (4 months, 6K score) - Worth it!
- 8-Dimension Scoring (2 months, 6.3K score) - Core differentiator
- AI Chatbot (4 months, 2.1K score) - Lower priority than expected

---

## Kano Model Classification

### Kano Categories

**Basic Expectations** (Must-haves, users expect them)
- Manual food entry
- Food database search
- Nutrition information display
- Account creation and login
- Data security and privacy

**Performance Needs** (More is better, linear satisfaction)
- Food database size and accuracy
- AI scanning accuracy
- App loading speed
- Offline mode coverage
- Recipe quantity

**Delight Features** (Unexpected, create excitement)
- AI camera scanning (if executed well)
- 8-dimension scoring (unique)
- Thai eating sequence education
- Gamification and achievements
- AI chatbot personality

**Indifferent** (Users don't care much)
- Video consultations (nice but not needed)
- Direct messaging
- Community forums (privacy concerns)
- DNA-based recommendations (skepticism)

**Reverse** (Some users dislike)
- Too many social features (privacy)
- Excessive notifications (annoying)
- Complex gamification (overwhelming)
- Too much data (information overload)

### Kano Analysis for Thai Market

**Must-Haves (Dissatisfiers if missing)**:
- Thai language support
- Thai food coverage
- Data privacy (PDPA compliance)
- Fast app performance (<3s load)
- Simple, easy navigation

**Performance (Satisfiers)**:
- AI scanning accuracy (90%+ goal)
- Number of Thai recipes (1,000+ target)
- Blood sugar focus
- Dashboard clarity
- Price/value ratio

**Delighters (Excitement factors)**:
- AI recognizes Thai street food accurately
- Eating sequence education (70% blood sugar reduction)
- LINE integration (cultural fit)
- PromptPay payment (trust factor)
- Thai AI personality (warm, encouraging)

---

## Final Feature Roadmap

### MVP - Phase 1 (Months 0-6)

**Goal**: Launch with core value proposition, achieve product-market fit

**Features (Must-Haves)**:
1. ✅ AI Camera Food Scanning (Thai dishes, 90%+ accuracy)
2. ✅ Manual Food Entry (fallback)
3. ✅ Thai Recipe Database (1,000+ recipes)
4. ✅ 8-Dimension Nutrition Scoring (with blood sugar focus)
5. ✅ AI Nutrition Chatbot (Thai language)
6. ✅ Daily Nutrition Dashboard (scores, charts)
7. ✅ Thai Language Support (default)
8. ✅ LINE Login Integration
9. ✅ Freemium Model (with paywall)
10. ✅ Offline Mode (basic - saved recipes/scans)
11. ✅ Dark Mode
12. ✅ PromptPay Payment

**Also Include (Should-Haves)**:
- Badges and streaks (basic gamification)
- Weight tracking
- Push notifications (reminders)
- Favorite foods quick-add
- Portion size estimation (visual guides)

**Success Metrics**:
- 10K MAU
- 60%+ onboarding completion
- 25% D30 retention
- 4% free-to-paid conversion

---

### Phase 2: Growth (Months 6-18)

**Goal**: Scale features, increase engagement and retention

**New Features**:
1. Meal Planning Calendar
2. Recipe Search & Advanced Filters
3. Social Features (friend leaderboards, challenges)
4. Apple Health / Google Fit Integration
5. Barcode Scanner
6. Macro Tracking
7. Progress Photos
8. Custom Recipe Creation
9. Voice Input for Logging
10. Export Data (GDPR compliance)
11. Eating Sequence Education Module
12. Restaurant Chain Menus

**B2B Launch**:
- Corporate wellness dashboard
- Team challenges
- Admin reporting
- Bulk user management

**Success Metrics**:
- 100K MAU
- 30% D30 retention
- 5% free-to-paid conversion
- 10 corporate clients

---

### Phase 3: Platform (Months 18-36)

**Goal**: Full nutrition and wellness platform

**New Features**:
1. Nutritionist Consultation Marketplace
2. Personalized Meal Plans (AI-generated)
3. GrabFood / LINE MAN Integration
4. CGM Integration (continuous glucose monitoring)
5. Predictive Analytics & Insights
6. Widget (home screen)
7. Meal Prep Planner
8. Community Success Stories
9. Hydration Tracking
10. Regional Expansion (Malaysia, Singapore content)

**Success Metrics**:
- 500K MAU
- 15% D30 retention (lower due to scale, but engaged core)
- 6% free-to-paid conversion
- 50 corporate clients

---

### Phase 4: Innovation (Year 3+)

**Future Vision**:
- Smartwatch apps (Apple Watch, Wear OS)
- AR nutrition overlay (camera shows nutrition live)
- Voice-first interface
- DNA-based personalization
- Healthcare provider integrations
- International expansion

---

## MVP Scope Definition

### What's In MVP (Core Product)

#### 1. User Onboarding Flow
- Language selection (Thai/English)
- LINE Login OR email signup
- Basic profile (name, age, gender)
- Health goals selection (lose weight, muscle gain, wellness)
- Dietary preferences (vegetarian, allergies)
- Skip to app (don't force all data upfront)

#### 2. AI Camera Scanning
- Camera access
- Viewfinder with guide overlay
- Snap photo
- AI analysis (3-5 seconds)
- Results with confidence %
- Portion size selector (visual: small/medium/large)
- Edit food if incorrect
- Save to food log

#### 3. Thai Recipe Database
- 1,000+ Thai recipes
- Recipe cards with photos
- Full nutrition breakdown
- 8-dimension scores per recipe
- Cooking instructions
- Ingredient list
- Save to favorites

#### 4. 8-Dimension Nutrition Scoring
- Blood Sugar Impact (0-100)
- Gut Health (0-100)
- Inflammation (0-100)
- Nutrient Density (0-100)
- Processing Level (0-100)
- Protein Quality (0-100)
- Micronutrient Coverage (0-100)
- Overall Health Score (0-100)

Visual: Radar chart + individual score cards

#### 5. AI Nutrition Chatbot
- Chat interface (Thai language)
- Ask nutrition questions
- Get evidence-based answers
- Chat history saved
- Suggested questions for discovery

#### 6. Daily Dashboard
- Today's overall score (0-100, large)
- Macros pie chart (protein/carbs/fat)
- Blood sugar trend (line chart)
- Recent scans (3-5 items)
- Quick action buttons (Scan, Chat, Recipes)
- Streak counter (🔥 7 days)

#### 7. Freemium & Paywall
- Free: 3 scans per day, basic recipes, limited chat
- Premium: Unlimited scans, all recipes, unlimited chat, advanced analytics
- Pricing: THB 199/month or THB 1,699/year
- 7-day free trial
- PromptPay payment

#### 8. Basic Gamification
- Daily streak tracking
- Badges (first scan, 7-day streak, 30-day streak, 100 scans)
- Celebration animations on achievements

---

### What's NOT In MVP (Defer to Phase 2)

❌ Social features (friends, sharing, leaderboards)
❌ Meal planning calendar
❌ Custom recipe creation
❌ Voice input
❌ Barcode scanner (use manual entry instead)
❌ Progress photos
❌ Apple Health / Google Fit (not critical for MVP)
❌ Advanced gamification (levels, points, complex challenges)
❌ Export data
❌ Widget
❌ B2B features
❌ Nutritionist consultations
❌ Restaurant menu integration

---

## Conclusion

### Feature Prioritization Summary

**Framework Alignment**:
- **MoSCoW**: Must-haves define MVP scope
- **RICE**: Validates high-impact, efficient features
- **Kano**: Identifies delighters vs. basics

**Top 5 Features (by combined analysis)**:
1. **Thai Language Support** - Must-have, highest RICE, basic expectation
2. **Blood Sugar Impact Score** - Must-have, high RICE, delighter for Thai market
3. **AI Camera Scanning** - Must-have, high RICE, delighter if done well
4. **8-Dimension Scoring** - Must-have, high RICE, unique differentiator
5. **LINE Login** - Must-have, high RICE, cultural fit

**MVP Success Criteria**:
- Contains all Must-Haves
- Delivers unique value (Thai specialization, AI scanning, holistic scoring)
- Can be built in 6 months
- Achieves product-market fit (25% D30 retention, 4% conversion)

**Next Steps**:
1. Lock MVP feature list with stakeholders
2. Create user stories for each MVP feature
3. Estimate development effort and timeline
4. Begin design and prototyping
5. Prepare for Phase 2 based on user feedback

---

**Feature prioritization complete. Let's build the right product! 🚀**
