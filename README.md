# 🥗 NutriVision AI - Smart Recipe Assistant for Modern Nutrition

[![npm version](https://img.shields.io/npm/v/@nutrivision/nutrivision-ai.svg)](https://www.npmjs.com/package/@nutrivision/nutrivision-ai)
[![Thai Language](https://img.shields.io/badge/Language-Thai%20%7C%20English-green)](https://github.com/bejranonda/Nutri-Vision-AI)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-success)](https://github.com/bejranonda/Nutri-Vision-AI)

> AI-powered nutrition analysis and recipe assistant specialized in Thai cuisine. Helping Thai people make informed food choices through evidence-based nutrition science.

**อ่านภาษาไทย:** [README-TH.md](README-TH.md)

---

## 🌟 Features

### Core Capabilities
- **🔍 AI Food Recognition**: Snap a photo and instantly identify ingredients using Google Gemini Vision API
- **📊 8-Dimension Nutrition Scoring**: Comprehensive health analysis including:
  - Blood Sugar Impact (crucial for Thai diet)
  - Gut Health Score
  - Inflammation Score
  - Nutrient Density
  - Processing Level
  - Protein Quality
  - Micronutrient Coverage
  - Overall Health Score

- **🍜 Thai Food Specialization**:
  - 1000+ Thai recipes with nutrition data
  - Common Thai ingredients database
  - Cultural context and traditional wisdom
  - Thai measurement conversions

- **💬 AI Nutrition Coach**:
  - Chat with AI nutritionist in Thai or English
  - Evidence-based recommendations
  - Personalized advice based on your goals

- **📱 Mobile-First PWA**:
  - Works like a native app
  - Offline mode for saved recipes
  - Quick camera access

### Unique Thai Market Features
- **Blood Sugar Management**: Specialized for Thai rice-heavy diet
- **Eating Sequence Education**: Vegetables → Protein → Fat → Carbs → Sweets (70% blood sugar reduction)
- **Thai Payment Integration**: PromptPay, TrueMoney, Rabbit Line Pay
- **Line Login**: Popular Thai messaging app integration
- **Thai Language AI**: Natural Thai conversation with nutrition AI

---

- **🌐 Multi-Language Support**: Full support for Thai, English, German, and Danish via `next-intl`
- **☁️ Cloudflare Edge Deployment**: Optimized for Cloudflare Workers (via OpenNext), D1, and Workers AI
- **⚡ SEO & Performance**: Optimized font loading, metadata management, and edge-side rendering for a professional global experience.

---

## 🏗️ Architecture

### Tech Stack

**Serverless Backend (TypeScript)**
- Next.js Edge APIs - High-performance serverless functions
- Cloudflare D1 - Primary SQLite-based edge database
- Cloudflare Workers AI - Llama 3 & and other models for chat and analysis
- Drizzle ORM - Type-safe database management

**Frontend (TypeScript)**
- Next.js 14 - React framework with App Router
- Tailwind CSS - Utility-first styling with Glassmorphism
- next-intl - Internationalization (Thai, English, German, Danish)
- TanStack Query - Server state management
- Zustand - Client state management
- Recharts - Data visualization

**Infrastructure**
- Cloudflare Workers - Frontend & API hosting (via OpenNext)
- Wrangler - CLI for Cloudflare services
- GitHub Actions - CI/CD

---

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and npm 9+
- Git
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

#### Option 1: Clone from GitHub (Recommended for Development)

1. **Clone the repository**
```bash
git clone https://github.com/bejranonda/Nutri-Vision-AI.git
cd Nutri-Vision-AI
```

#### Option 2: Install via npm (For Quick Setup)

```bash
npx degit bejranonda/Nutri-Vision-AI my-nutrivision-app
cd my-nutrivision-app
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here  # Generate with: openssl rand -hex 32
JWT_SECRET_KEY=your_jwt_secret_here
```

3. **Start the application**
```bash
docker-compose up -d
```

4. **Initialize database**
```bash
# Run migrations
docker-compose exec backend alembic upgrade head

# Seed Thai food data
docker-compose exec backend python app/db/seed_data.py
```

5. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

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
# Backend tests
docker-compose exec backend pytest

# Frontend tests
docker-compose exec frontend npm test
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

Supports Thai (default) and English:

```typescript
// Access translations
const t = useTranslations('namespace');

// Thai
<h1>{t('title')}</h1>  // "NutriVision AI"

// Language switch
<Link href="/en/dashboard">English</Link>
<Link href="/th/dashboard">ไทย</Link>
```

Translation files:
- `frontend/src/messages/th.json`
- `frontend/src/messages/en.json`

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

- **Website**: https://nutrivision.app
- **Email**: support@nutrivision.app
- **Issues**: https://github.com/bejranonda/Nutri-Vision-AI/issues
- **Discussions**: https://github.com/bejranonda/Nutri-Vision-AI/discussions
- **npm Package**: https://www.npmjs.com/package/@nutrivision/nutrivision-ai

### Thai Support
- **Line Official**: @nutrivisionai
- **Facebook**: facebook.com/nutrivisionai
- **Email (Thai)**: support.th@nutrivision.app

---

## 🙏 Acknowledgments

- **Thalay Community** - For nutrition education insights and content inspiration
- **Google Gemini** - For powerful AI capabilities
- **Thai Food Community** - For recipe contributions and cultural context
- **Early Beta Testers** - For valuable feedback

---

## 📈 Roadmap

### Phase 1 (Current) ✅
- [x] Core food scanning
- [x] 8-dimension scoring
- [x] Thai/English support
- [x] Basic recipe database
- [x] AI chat

### Phase 2 (Q2 2024) 🚧
- [ ] Restaurant menu scanning
- [ ] Barcode scanner
- [ ] Fitness tracker integration
- [ ] Voice input
- [ ] Meal comparison

### Phase 3 (Q3 2024) 📋
- [ ] AI meal coach
- [ ] Recipe creator
- [ ] Marketplace
- [ ] Nutritionist consultation
- [ ] Corporate wellness

### Phase 4 (Q4 2024) 🔮
- [ ] Smartwatch app
- [ ] AR food scanning
- [ ] Blood glucose integration
- [ ] DNA-based nutrition
- [ ] International expansion

---

## ⭐ Star History

If you find this project helpful, please consider giving it a star!

[![Star History Chart](https://api.star-history.com/svg?repos=bejranonda/Nutri-Vision-AI&type=Date)](https://star-history.com/#bejranonda/Nutri-Vision-AI&Date)

---

**Made with ❤️ for the Thai community**

*"อยู่ได้นานพร้อมกับกินอาหารอร่อย" - Live long while eating well*
