# 🥗 NutriVision AI v0.1.0 - Initial Release

> **AI-powered nutrition analysis and recipe assistant specialized in Thai cuisine. Helping Thai people make informed food choices through evidence-based nutrition science.**

## 🌟 What's New in v0.1.0

This is our initial public release! NutriVision AI brings cutting-edge AI technology to Thai nutrition analysis, making healthy eating accessible and personalized for the Thai community.

### 🔍 Core Features

#### AI Food Recognition
- **Instant Ingredient Identification**: Snap a photo and instantly identify ingredients using Google Gemini Vision API
- **Thai Food Specialization**: Trained specifically on Thai cuisine and ingredients
- **Cultural Context**: Understands Thai cooking methods and traditional recipes

#### 8-Dimension Nutrition Scoring System
Our revolutionary scoring system provides comprehensive health analysis:
- **Blood Sugar Impact**: Crucial for Thai rice-heavy diet
- **Gut Health Score**: Microbiome-friendly food assessment
- **Inflammation Score**: Anti-inflammatory food properties
- **Nutrient Density**: Vitamin and mineral richness
- **Processing Level**: Whole food vs. processed food analysis
- **Protein Quality**: Complete protein and amino acid profiles
- **Micronutrient Coverage**: Essential vitamins and minerals
- **Overall Health Score**: Aggregate wellness rating

#### Thai Food Database
- **1000+ Thai Recipes**: Comprehensive recipe collection with nutrition data
- **Ingredient Database**: Common Thai ingredients with nutritional information
- **Cultural Context**: Traditional wisdom and health benefits
- **Thai Measurements**: Authentic Thai cooking measurements and conversions

#### AI Nutrition Coach
- **Bilingual Support**: Chat in Thai or English with our AI nutritionist
- **Evidence-Based Recommendations**: Scientifically backed nutrition advice
- **Personalized Guidance**: Tailored advice based on health goals
- **Cultural Sensitivity**: Understanding Thai dietary patterns and preferences

### 📱 Mobile-First Progressive Web App
- **Native App Experience**: Works seamlessly on mobile devices
- **Offline Mode**: Access saved recipes without internet
- **Quick Camera Access**: One-tap food photo capture
- **Responsive Design**: Optimized for all screen sizes

### 🏗️ Technical Architecture

#### Backend (Python/FastAPI)
- **Modern Async Framework**: FastAPI for high-performance APIs
- **Robust Database**: PostgreSQL with SQLAlchemy ORM
- **Intelligent Caching**: Redis for improved performance
- **AI Integration**: Google Gemini API for vision and language
- **Database Migrations**: Alembic for schema versioning

#### Frontend (TypeScript/Next.js)
- **Next.js 14**: Latest React framework with App Router
- **TypeScript Safety**: Full type coverage for reliability
- **Tailwind CSS**: Modern, utility-first styling
- **Internationalization**: Full Thai + English support
- **State Management**: TanStack Query + Zustand

#### Infrastructure & DevOps
- **Containerization**: Docker & Docker Compose for deployment
- **CI/CD Ready**: GitHub Actions workflow setup
- **Code Quality**: Comprehensive linting and testing
- **Documentation**: Extensive developer and user documentation

## 🚀 Installation

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and npm 9+
- Git
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Quick Setup with npm
```bash
npm install -g @nutrivision/nutrivision-ai@0.1.0
```

### Development Setup
```bash
git clone https://github.com/bejranonda/Nutri-Vision-AI.git
cd Nutri-Vision-AI
npm run install:all
npm run dev
```

### Docker Setup
```bash
git clone https://github.com/bejranonda/Nutri-Vision-AI.git
cd Nutri-Vision-AI
docker-compose up
```

## 🌍 Unique Thai Market Features

### Blood Sugar Management
- **Rice-Diet Optimization**: Specialized algorithms for Thai carbohydrate-heavy meals
- **Eating Sequence Education**: Vegetables → Protein → Fat → Carbs → Sweets (70% blood sugar reduction)
- **Glycemic Index Tracking**: Thai foods and their impact on blood sugar

### Cultural Integration
- **Thai Language AI**: Natural Thai conversation with nutrition AI
- **Local Payment Methods**: Ready for PromptPay, TrueMoney, Rabbit Line Pay integration
- **Line Login**: Integration with Thailand's most popular messaging app

## 📊 What's Included

- ✅ **Full Source Code**: Complete frontend and backend
- ✅ **Database Schema**: PostgreSQL with comprehensive nutrition data
- ✅ **AI Models**: Pre-configured Google Gemini integration
- ✅ **Docker Configuration**: Ready-to-deploy containers
- ✅ **Documentation**: Setup guides, API docs, and user manuals
- ✅ **Testing Suite**: Comprehensive test coverage
- ✅ **CI/CD Pipeline**: GitHub Actions workflows

## 🔧 System Requirements

### Minimum Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Python**: 3.9 or higher
- **PostgreSQL**: 13 or higher
- **Redis**: 6 or higher
- **Memory**: 4GB RAM
- **Storage**: 10GB available space

### Recommended Requirements
- **Memory**: 8GB RAM
- **Storage**: 20GB available space
- **CPU**: Multi-core processor for AI processing

## 🛡️ Security Features

- **Authentication**: Secure user registration and login
- **Data Encryption**: End-to-end encryption for sensitive data
- **GDPR Compliance**: Full privacy controls and data export
- **Rate Limiting**: Protection against API abuse
- **SQL Injection Prevention**: Parameterized queries throughout
- **XSS Protection**: Comprehensive input sanitization

## 📚 Documentation

- **[README.md](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/README.md)**: Complete setup and usage guide
- **[README-TH.md](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/README-TH.md)**: Thai language documentation
- **[API Documentation](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/README.md#api-documentation)**: Interactive OpenAPI/Swagger docs
- **[Project Plan](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/PROJECT_PLAN.md)**: Architecture and roadmap
- **[Deployment Guide](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/DEPLOYMENT.md)**: Production deployment instructions

## 🎯 Use Cases

### For Individuals
- **Daily Nutrition Tracking**: Monitor and improve eating habits
- **Meal Planning**: AI-powered meal suggestions based on goals
- **Food Education**: Learn about Thai food nutrition
- **Health Goals**: Weight management, blood sugar control, muscle gain

### For Healthcare Professionals
- **Patient Monitoring**: Track patient nutrition remotely
- **Educational Tool**: Teach patients about healthy eating
- **Cultural Competence**: Thai-specific nutrition guidance

### For Restaurants & Food Businesses
- **Menu Analysis**: Nutritional information for menu items
- **Health Marketing**: Promote healthy Thai dishes
- **Customer Engagement**: Interactive nutrition features

## 🔮 What's Next

Our roadmap includes exciting features:

### v0.2.0 (Planned)
- Restaurant menu scanning
- Barcode scanner integration
- Voice input support
- Enhanced meal comparison

### v0.3.0 (Planned)
- Fitness tracker integration
- AI meal planner
- Recipe creator assistant
- Smartwatch app

### v1.0.0 (Future)
- Marketplace for nutritionists
- AR food scanning
- Blood glucose integration
- DNA-based nutrition recommendations

## 🐛 Known Issues

This is an initial release with some limitations:
- Internet connection required for AI features
- Thai food recognition accuracy improves with more data
- Mobile PWA requires manual installation on some devices

## 🤝 Contributing

We welcome contributions! See our [Contributing Guidelines](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/CONTRIBUTING.md) for details.

### How to Help
- **Report Issues**: Found a bug? [Create an issue](https://github.com/bejranonda/Nutri-Vision-AI/issues)
- **Feature Requests**: Have an idea? [Suggest it here](https://github.com/bejranonda/Nutri-Vision-AI/issues)
- **Code Contributions**: See our [development setup](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/README.md#development)
- **Translation**: Help us improve Thai language support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini Team**: For providing powerful AI capabilities
- **Thai Nutrition Community**: For cultural insights and expertise
- **Open Source Contributors**: For the amazing tools and libraries
- **Beta Testers**: For valuable feedback and suggestions

## 📞 Support

- **Issues & Bug Reports**: [GitHub Issues](https://github.com/bejranonda/Nutri-Vision-AI/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/bejranonda/Nutri-Vision-AI/discussions)
- **Email**: support@nutrivision.app
- **Website**: https://nutrivision.app (coming soon)

---

**Made with ❤️ for the Thai community**

*"อัปเดตเพื่อสุขภาพที่ดีขึ้น" - Updates for better health*

## 🔗 Quick Links

- **Download**: `npm install @nutrivision/nutrivision-ai@0.1.0`
- **Documentation**: [README.md](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/README.md)
- **Issues**: [GitHub Issues](https://github.com/bejranonda/Nutri-Vision-AI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bejranonda/Nutri-Vision-AI/discussions)
- **License**: [MIT License](https://github.com/bejranonda/Nutri-Vision-AI/blob/main/LICENSE)

---

**Release Assets**
- Source code (ZIP)
- Source code (TAR.GZ)

🎉 **Thank you for being part of our initial release!** 🎉