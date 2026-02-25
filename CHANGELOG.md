# Changelog

All notable changes to the NutriVision AI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-17

### Added

#### Core Features
- 🔍 **AI Food Recognition**: Image analysis using Google Gemini Vision API
- 📊 **8-Dimension Nutrition Scoring System**:
  - Blood Sugar Impact scoring
  - Gut Health scoring
  - Inflammation scoring
  - Nutrient Density scoring
  - Processing Level scoring
  - Protein Quality scoring
  - Micronutrient Coverage scoring
  - Overall Health Score calculation
- 🍜 **Thai Food Specialization**:
  - 1000+ Thai recipes database
  - Thai ingredients database
  - Thai measurement conversions
  - Cultural context integration
- 💬 **AI Nutrition Coach**: Interactive chat with AI nutritionist
- 📱 **Mobile-First PWA**: Progressive Web App with offline capabilities
- 🌐 **Bilingual Support**: Full Thai and English internationalization
- 👤 **User Authentication**: Email/password registration and login
- 📈 **User Dashboard**: Personal nutrition tracking and history
- 🔒 **GDPR Compliance**: Data export, right to be forgotten, consent management

#### Technical Infrastructure
- **Backend**: FastAPI with async support
- **Frontend**: Next.js 14 with App Router and React 18
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Caching**: Redis for sessions and caching
- **AI Integration**: Google Gemini API for vision and chat
- **Containerization**: Docker and Docker Compose setup
- **Database Migrations**: Alembic for schema versioning
- **Testing**: Pytest for backend, Jest for frontend
- **Code Quality**: Black, Flake8, MyPy, ESLint, Prettier

#### Documentation
- Comprehensive README with setup instructions
- API documentation with OpenAPI/Swagger
- Project plan and architecture documentation
- Deployment guide
- Environment configuration examples
- Thai language documentation (README-TH.md)

#### Security
- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- Rate limiting on all endpoints
- SQL injection prevention with parameterized queries
- XSS protection
- CSRF tokens
- Environment-based secrets management

#### Developer Experience
- Docker Compose for local development
- Hot reload for both frontend and backend
- Database seeding scripts
- Comprehensive npm scripts for common tasks
- TypeScript support with strict type checking
- Python type hints throughout backend

### Changed
- N/A (Initial release)

### Deprecated
- N/A (Initial release)

### Removed
- N/A (Initial release)

### Fixed
- N/A (Initial release)

### Security
- Implemented comprehensive security measures (see Security section above)

---

## [0.2.2] - 2026-02-23

### Fixed
- 🚀 **Cloudflare Deployment**: Resolved OpenNext compatibility issues by updating `compatibility_date` to `2024-09-23`.
- ☁️ **Cloudflare D1 Setup**: Successfully initialized D1 database `nutri-vision-d1` and mapped its ID in `wrangler.toml`.
- ⚙️ **Deployment Script**: Fixed Powershell execution issues for deployment scripts.

---

## [0.2.1] - 2026-02-23
- 🛠️ **i18n Refinements**: Replaced hardcoded Thai strings in the UI with dynamic translation keys.
- 🔗 **Locale Routing**: Fixed hardcoded locale paths in navigation links to use current user locale.
- 🚀 **SEO & Performance**: 
  - Added SEO metadata to the main layout.
  - Optimized font loading for `Inter` and `Sarabun` (Thai).
  - Added `antialiased` class for smoother text rendering.
  - Added missing `drizzle-orm` dependency for edge database schema.

---

## [0.2.0] - 2026-02-23

### Added
- 🌍 **Internationalization (i18n)**: Added Danish (`da`) and German (`de`) language support via `next-intl`.
- 🎨 **UI/UX Revolution**: 
  - Dynamic Glassmorphism aesthetic.
  - "อร่อย ตาม ลำดับ" (Delicious in Order) active sequencing guide component.
  - New modern typography (`Inter`, `Outfit`) integrated alongside `Sarabun`.

### Changed
- ☁️ **Infrastructure Paradigm Shift**: Migrated from Dockerized FastAPI & PostgreSQL to a fully serverless Cloudflare architecture.
  - Replaced PostgreSQL with **Cloudflare D1** (SQLite) using Drizzle ORM.
  - Switched Next.js builds to Edge Worker compatibility via **OpenNext** (`@opennextjs/cloudflare`).
  - Shifted AI services to use the Cloudflare Workers AI token.

### Removed
- Removed Docker/docker-compose requirements and FastAPI backend codebase dependencies.

---

## [Unreleased]

### Added
- 👩‍🏫 **Shinny Mascot Integration**: Rebranded "Nong Oishii" to **Shinny**, aligning the AI coach with the "Live long to eat well" (อยู่เพื่อกินบำนาญ) philosophy.
- 📂 **Business Strategy Research**: Added comprehensive business documentation under `research/business/` covering concept, approach, and monetization strategies.
- 🌍 **Internationalization Updates**: Updated mascot name and persona across all supported languages (TH, EN, DE, DA).
- 🎨 **Visual Identity**: Replaced chef mascot emoji with teacher/expert emoji to better reflect Shinny's role as a nutrition guru.

### Planned Features
- Restaurant menu scanning
- Barcode scanner integration
- Fitness tracker integration
- Voice input support
- Meal comparison feature
- AI meal coach
- Recipe creator
- Marketplace for nutritionists
- Smartwatch app
- AR food scanning
- Blood glucose integration
- DNA-based nutrition recommendations

---

## Release Notes Format

### Types of Changes
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements

### Version Numbering
We use Semantic Versioning (SemVer):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards compatible manner
- **PATCH** version for backwards compatible bug fixes

Example: `1.2.3`
- `1` = Major version
- `2` = Minor version
- `3` = Patch version

---

## How to Update This Changelog

When making changes:

1. Add your changes under the `[Unreleased]` section
2. Use the appropriate category (Added, Changed, Fixed, etc.)
3. Write clear, user-focused descriptions
4. Include issue/PR numbers when applicable
5. When releasing, move `[Unreleased]` items to a new version section

Example entry:
```markdown
### Added
- feat(nutrition): Add omega-3 to omega-6 ratio calculation (#123)
  - Implements inflammation score component
  - Supports both marine and plant-based sources
```

---

## Links

- [Project Repository](https://github.com/bejranonda/Nutri-Vision-AI)
- [Issue Tracker](https://github.com/bejranonda/Nutri-Vision-AI/issues)
- [Contributing Guidelines](CONTRIBUTING.md)
- [License](LICENSE)

---

**Made with ❤️ for the Thai community**

*"อัปเดตเพื่อสุขภาพที่ดีขึ้น" - Updates for better health*
