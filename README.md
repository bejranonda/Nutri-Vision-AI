# 🍽️ EatInOrder - Smart Food Sequencing for Better Health

[![Version](https://img.shields.io/badge/Version-1.0.0-orange)](https://github.com/bejranonda/Nutri-Vision-AI)
[![Languages](https://img.shields.io/badge/Languages-TH%20%7C%20EN%20%7C%20DE%20%7C%20DA-blue)](https://github.com/bejranonda/Nutri-Vision-AI)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Cloudflare%20Pages-purple)](https://pages.cloudflare.com/)

> **อร่อย ตาม ลำดับ** — Discover how eating in the right order can reduce blood sugar spikes by up to 70%

**Eat Smart, Live Long** — AI-powered food sequencing and nutrition analysis that helps you enjoy food while protecting your health.

**อ่านภาษาไทย:** [README-TH.md](README-TH.md)

---

## 🌟 Features

### 🎯 The "อร่อย ตาม ลำดับ" Concept
**EatInOrder** is built on the scientifically-proven concept that the **order in which you eat your food matters**:

```
🥦 Vegetables → 🍗 Protein → 🍚 Carbs → 🍰 Sweets
   (1st)          (2nd)        (3rd)      (4th)
```

Following this sequence can reduce blood sugar spikes by up to **70%**!

### Core Capabilities
- **🔍 AI Food Scanner**: Snap a photo and instantly identify ingredients with optimal eating sequence
- **🧪 Advanced Metabolic Analysis**: Detects **Ultra-Processed Foods (UPF)** and estimates **fructose** content (The Liver's Burden)
- **📊 8-Dimension Nutrition Scoring**: Comprehensive health analysis including:
  - 🩸 **Blood Sugar Impact**: Now with fructose penalties and fiber-to-carb ratio bonuses
  - 🏭 **Processing Level Score**: Heavy penalties for UPFs and industrial additives
  - 🧬 **Satiety Index**: Prediction of how long you'll stay full based on fiber + protein
- **👩‍🏫 Shinny Mascot**: Your friendly AI nutrition buddy who follows the **"Live Long to Eat Well"** philosophy
- **🚶‍♂️ Post-Meal "Glucose Walk"**: Proactive prompts for 10-15 min walks to flatten glucose spikes

- **🎮 Gamification**: Earn points, maintain streaks, and level up your eating habits:
  - Daily streaks with 🔥 fire effects
  - Achievement badges
  - Levels: Beginner → Learner → Practitioner → Master → Blood Sugar Ninja

- **🌐 Multi-Language**: Full support for Thai, English, German, and Danish with space-saving **Dropdown Language Switcher**.
- **📱 Responsive Design**: Fully mobile-optimized header with hamburger menu for smaller screens.
- **🚀 Seamless UX**: Interactive "Coming Soon" placeholder pages for all featured sections ensuring a high-quality user journey even for features currently in development.

---

## 📚 Documentation & Resources

For in-depth technical information and development guides, please refer to:

-   **[🧠 Knowledge Base](docs/KNOWLEDGE_BASE.md)**: Architectural decisions, domain logic, and technical foundations.
-   **[📜 Development Guideline](docs/GUIDELINE.md)**: Coding standards, logging practices, and developer workflow.
-   **[⚠️ Known Issues](docs/KNOWN_ISSUES.md)**: Current bugs, technical limitations, and ongoing investigations.
-   **[🛠️ Project Plan](PROJECT_PLAN.md)**: Detailed roadmap and feature milestones.

---

## 📊 Debugging & Logging

EatInOrder features a **Unified Logging System** across the entire stack to ensure high visibility and easy debugging.

### Monitoring Features
- **Frontend Tracking**: Monitors user engagement and feature status (Success/Failure/Loading).
- **Backend Middleware**: Automatically logs every request, response status code, and processing duration (`X-Process-Time`).
- **Service Diagnostics**: Granular logging for Gemini AI analysis and nutrition scoring logic.

### Real-time Logs on Cloudflare
1.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Navigate to **Workers & Pages** > **nutri-vision-ai**.
3.  Select your **Deployment** and click **Begin Log Streaming**.
4.  **Filter by:**
    - `[FEATURE]`: To track functional status of menus/functions.
    - `[ERROR]`: To identify system failures or crashes.
    - `X-Process-Time`: To identify performance bottlenecks.

---

## 🏗️ Architecture

### Tech Stack

**Frontend (TypeScript)**
- Next.js 14 with App Router
- Tailwind CSS with custom brand design system
- next-intl for i18n (Thai, English, German, Danish)
- Glassmorphism UI with playful animations

**Cloudflare Edge (Serverless)**
- Cloudflare Pages for deployment
- Cloudflare D1 for SQLite database
- Cloudflare Workers AI for nutrition analysis
- OpenNext adapter for edge compatibility

**Brand Design System**
- **Primary**: Coral Red (#FF6B6B) - Energy & Appetite
- **Secondary**: Teal (#4ECDC4) - Health & Freshness
- **Accent**: Warm Yellow (#FFE66D) - Joy & Optimism
- **Fonts**: Plus Jakarta Sans, Prompt (Thai), Inter

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Git
- Cloudflare Account (free tier works)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/bejranonda/Nutri-Vision-AI.git
cd Nutri-Vision-AI/frontend
```

2. **Set up environment variables**
```bash
cp .env.example .env.local
```
> **Security Note:** Fill in your API keys in `.env.local`. Never commit your actual `.env` files to Git.

3. **Install and Run**
```bash
npm install
npm run dev
```

4. **Access the application**
- Local: http://localhost:3000
- Select your language: 🇹🇭 ไทย | 🇬🇧 EN | 🇩🇪 DE | 🇩🇰 DA

### Deploy to Cloudflare Pages

```bash
cd frontend
# Build for production (uses OpenNext)
npm run pages:build

# Deploy with Wrangler
npm run deploy
```

---

## 📖 Usage

### For Users

#### Scan Food
1. Navigate to "สแกนอาหาร" (Scan Food)
2. Take a photo or upload an image
3. Get instant nutrition analysis with 8-dimension scores
4. View detailed ingredient breakdown

#### Ask AI Nutritionist
1. Go to "ปรึกษาผู้เชี่ยวชาญ" (Ask Expert)
2. Type your question in Thai or English
3. Get evidence-based answers
4. Chat history is saved

#### Browse Recipes
1. Visit "สูตรอาหาร" (Recipes)
2. Filter by dietary needs
3. View detailed nutrition scores
4. Save favorites

#### Track Progress
1. Access "แดชบอร์ด" (Dashboard)
2. View scan history
3. Track nutrition trends
4. Set health goals

### For Developers

#### Run Backend Only
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Run Frontend Only
```bash
cd frontend
npm install
npm run dev
```

#### Run Tests
```bash
# Frontend tests
cd frontend
npm test
```

---

## 🎯 Nutrition Scoring System

Our proprietary 8-dimension scoring system evaluates food across multiple health aspects:

### 1. Blood Sugar Impact (0-100)
- Calculates Glycemic Load
- Accounts for fiber content
- Critical for Thai high-carb diet
- **Higher score = Lower blood sugar spike**

### 2. Gut Health (0-100)
- Fiber content (soluble/insoluble)
- Prebiotic and probiotic presence
- Fermented foods bonus
- **Higher score = Better gut health**

### 3. Inflammation (0-100)
- Omega-3 to Omega-6 ratio
- Antioxidant ORAC values
- Anti-inflammatory ingredients
- **Higher score = Anti-inflammatory**

### 4. Nutrient Density (0-100)
- Nutrients per calorie (ANDI score)
- Protein and fiber density
- Vitamin/mineral richness
- **Higher score = More nutrients per calorie**

### 5. Processing Level (0-100)
- NOVA classification (1-4)
- Additive detection
- Whole food percentage
- **Higher score = Less processed**

### 6. Protein Quality (0-100)
- Complete amino acid profile
- Protein quantity
- Source quality (PDCAAS)
- **Higher score = Better protein**

### 7. Micronutrient Coverage (0-100)
- % RDI for 12 key vitamins/minerals
- Breadth of nutrient variety
- Bioavailability factors
- **Higher score = More complete nutrition**

### 8. Overall Health Score (0-100)
- Weighted average of all dimensions
- Personalized to user goals
- Thai dietary context adjustments
- **Higher score = Healthier overall**

---

## 🌐 API Documentation

### Authentication Endpoints
```http
POST /api/auth/register      # Register new user
POST /api/auth/login         # Login with email/password
GET  /api/auth/me            # Get current user
POST /api/auth/refresh       # Refresh access token
```

### Food Scanning Endpoints
```http
POST /api/scan/analyze       # Analyze food image
GET  /api/scan/history       # Get scan history
GET  /api/scan/{id}          # Get specific scan
```

### Recipe Endpoints
```http
GET  /api/recipes/           # List recipes with filters
GET  /api/recipes/{id}       # Get recipe details
GET  /api/recipes/featured   # Get featured recipes
POST /api/recipes/suggest    # Generate recipe suggestions
```

### Chat Endpoints
```http
POST /api/chat/ask           # Ask AI nutritionist
GET  /api/chat/history       # Get chat history
```

### User Profile Endpoints
```http
GET  /api/user/profile       # Get user profile
PUT  /api/user/profile       # Update profile
GET  /api/user/stats         # Get usage statistics
```

See full API documentation at: http://localhost:8000/docs

---

## 📊 Database Schema

```
users
├── id (PK)
├── email (unique)
├── hashed_password
├── subscription_tier (free/premium/family)
├── language (th/en)
├── health_info (age, weight, height, goals)
└── usage_tracking

food_scans
├── id (PK)
├── user_id (FK)
├── image_url
├── detected_items (JSON)
├── nutrition_summary (JSON)
└── 8 dimension scores

recipes
├── id (PK)
├── name_th, name_en
├── ingredients (JSON)
├── instructions_th, instructions_en
├── nutrition_per_serving
├── dietary_flags (vegetarian, halal, etc.)
└── 8 dimension scores

ingredients
├── id (PK)
├── name_th, name_en
├── category
├── nutrition_per_100g
├── glycemic_index
└── special_properties

chat_messages
├── id (PK)
├── user_id (FK)
├── role (user/assistant)
├── content
└── language

meal_plans
├── id (PK)
├── user_id (FK)
├── plan_date
├── breakfast, lunch, dinner (JSON)
└── daily_totals
```

---

## 🔒 Security Features

- ✅ No API keys in code (environment variables only)
- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ CORS protection
- ✅ Rate limiting on all endpoints
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection
- ✅ CSRF tokens
- ✅ GDPR compliant from day 1
  - Data export functionality
  - Right to be forgotten
  - Consent management
  - Data minimization

---

## 🌍 Internationalization

Full support for 4 languages:

| Language | Code | Default |
|----------|------|---------|
| 🇹🇭 Thai | `th` | ✅ Yes |
| 🇬🇧 English | `en` | |
| 🇩🇪 German | `de` | |
| 🇩🇰 Danish | `da` | |

> **Note:** We use high-quality SVG icons from `country-flag-icons` for reliable cross-platform rendering (especially on Windows).

```typescript
// Access translations
const t = useTranslations('namespace');

// Example usage
<h1>{t('title')}</h1>  // "EatInOrder" / "อร่อย ตาม ลำดับ"

// Language switch
<Link href="/th">🇹🇭 ไทย</Link>
<Link href="/en">🇬🇧 EN</Link>
<Link href="/de">🇩🇪 DE</Link>
<Link href="/da">🇩🇰 DA</Link>
```

Translation files:
- `frontend/src/messages/th.json`
- `frontend/src/messages/en.json`
- `frontend/src/messages/de.json`
- `frontend/src/messages/da.json`

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write tests
5. Commit with descriptive messages
6. Push to your fork
7. Open a Pull Request

### Code Style
- Python: PEP 8 (use `black` formatter)
- TypeScript: ESLint + Prettier
- Commits: Conventional Commits format

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 📞 Contact & Support

- **Live Demo**: https://eatinorder.bwerapol.workers.dev
- **Repository**: https://github.com/bejranonda/Nutri-Vision-AI
- **Issues**: https://github.com/bejranonda/Nutri-Vision-AI/issues
- **Discussions**: https://github.com/bejranonda/Nutri-Vision-AI/discussions

---

## 🙏 Acknowledgments

- **Shinny (ชินนี่)** - For the "อยู่เพื่อกินบำนาญ" (Live long to eat well) philosophy, YouTube series, and nutrition education content
- **Thalay Community** - For evidence-based nutrition research and articles
- **Cloudflare** - For providing an excellent free-tier edge platform
- **Thai Food Community** - For recipe contributions and cultural context

---

## 📈 Roadmap

### v1.0.0 (Current) ✅
- [x] Rebrand to EatInOrder ("อร่อย ตาม ลำดับ")
- [x] Food sequencing concept implementation
- [x] Shinny mascot
- [x] Gamification (streaks, points, achievements)
- [x] 4-language support (th, en, de, da)
- [x] Cloudflare Pages deployment
- [x] 8-dimension scoring system

### v1.1.0 (Next) 🚧
- [ ] Food scanner with AI analysis
- [ ] Sequence visualizer for meals
- [ ] User authentication
- [ ] Personal dashboard

### v1.2.0 (Planned) 📋
- [ ] Recipe database with Thai dishes
- [ ] GI database integration
- [ ] AI nutrition coach chat
- [ ] Meal planning

### v2.0.0 (Future) 🔮
- [ ] Restaurant menu scanning
- [ ] Barcode scanner
- [ ] Fitness tracker integration
- [ ] Smartwatch app
- [ ] AR food scanning

---

## ⭐ Star History

If you find this project helpful, please consider giving it a star!

[![Star History Chart](https://api.star-history.com/svg?repos=bejranonda/Nutri-Vision-AI&type=Date)](https://star-history.com/#bejranonda/Nutri-Vision-AI&Date)

---

**Made with ❤️ for food lovers everywhere**

**"อร่อย ตาม ลำดับ" — Delicious in Order**

*Eat smart, live long, and enjoy every bite!*
