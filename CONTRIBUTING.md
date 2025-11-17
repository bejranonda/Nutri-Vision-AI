# Contributing to NutriVision AI

Thank you for your interest in contributing to NutriVision AI! We welcome contributions from the community to help make nutrition analysis and healthy eating more accessible to everyone, especially the Thai community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences
- Accept responsibility for mistakes and learn from them

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Nutri-Vision-AI.git
   cd Nutri-Vision-AI
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/bejranonda/Nutri-Vision-AI.git
   ```

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm 9+
- Python 3.11+
- Git
- Google Gemini API key

### Installation

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys** to `.env`:
   ```env
   GEMINI_API_KEY=your_key_here
   SECRET_KEY=generate_with_openssl_rand_hex_32
   JWT_SECRET_KEY=another_secret_key
   ```

3. **Start the development environment**:
   ```bash
   docker-compose up
   ```

4. **In another terminal, run migrations**:
   ```bash
   docker-compose exec backend alembic upgrade head
   docker-compose exec backend python app/db/seed_data.py
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Running Without Docker

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

**Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

Include in your report:
- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment details (OS, browser, versions)

### Suggesting Enhancements

We welcome feature suggestions! Please:
- Use a clear, descriptive title
- Provide detailed explanation of the feature
- Explain why it would be useful
- Include mockups or examples if applicable

### Contributing Code

Areas where we especially welcome contributions:
- 🍜 **Thai Food Database**: Add more Thai recipes and ingredients
- 🌐 **Translations**: Improve Thai and English translations
- 🧪 **Testing**: Add unit and integration tests
- 📱 **UI/UX**: Improve mobile experience
- 🔬 **Nutrition Science**: Enhance scoring algorithms
- 📚 **Documentation**: Improve guides and API docs
- 🐛 **Bug Fixes**: Fix reported issues

## Code Style Guidelines

### Python (Backend)

- Follow **PEP 8** style guide
- Use **type hints** for function parameters and returns
- Maximum line length: **88 characters** (Black default)
- Use **docstrings** for all public functions and classes

Format code with:
```bash
cd backend
black .
isort .
flake8 .
mypy .
```

Example:
```python
from typing import List, Optional

def calculate_nutrition_score(
    nutrients: dict,
    user_goals: Optional[dict] = None
) -> float:
    """
    Calculate overall nutrition score based on 8 dimensions.

    Args:
        nutrients: Dictionary containing nutrient values
        user_goals: Optional user health goals for personalization

    Returns:
        Overall health score from 0-100
    """
    # Implementation here
    pass
```

### TypeScript/JavaScript (Frontend)

- Follow **ESLint** and **Prettier** configurations
- Use **TypeScript** for all new files
- Prefer **functional components** with hooks
- Use **meaningful variable names**

Format code with:
```bash
cd frontend
npm run lint -- --fix
```

Example:
```typescript
interface NutritionScore {
  bloodSugar: number;
  gutHealth: number;
  inflammation: number;
  nutrientDensity: number;
  processingLevel: number;
  proteinQuality: number;
  micronutrients: number;
  overall: number;
}

export function ScoreCard({ score }: { score: NutritionScore }) {
  return (
    <div className="score-card">
      {/* Component implementation */}
    </div>
  );
}
```

## Testing

### Backend Tests

```bash
cd backend
pytest
pytest --cov=app tests/  # With coverage
```

Write tests for:
- API endpoints
- Nutrition calculation logic
- Database operations
- Authentication flows

### Frontend Tests

```bash
cd frontend
npm test
npm run test:watch  # Watch mode
```

Write tests for:
- Components
- API integrations
- User interactions
- Utility functions

## Commit Guidelines

We follow **Conventional Commits** format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
feat(nutrition): add omega-3 to omega-6 ratio calculation

Implements the inflammation score component that calculates
the ratio of omega-3 to omega-6 fatty acids in foods.

Closes #123
```

```bash
fix(auth): prevent token refresh loop

Fixed infinite loop in token refresh logic that occurred
when the refresh token was expired.

Fixes #456
```

```bash
docs(readme): update installation instructions

Added Docker Compose instructions and clarified environment
variable setup process.
```

## Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make your changes** following the code style guidelines

3. **Write/update tests** for your changes

4. **Run tests and linting**:
   ```bash
   npm run lint
   npm run test
   ```

5. **Commit your changes** following commit guidelines

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** on GitHub with:
   - Clear title describing the change
   - Detailed description of what and why
   - Link to related issues (e.g., "Closes #123")
   - Screenshots for UI changes
   - Checklist of completed items

### PR Checklist

Before submitting, ensure:
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated and passing
- [ ] No new warnings
- [ ] Dependent changes merged and published

### Review Process

- Maintainers will review your PR within 3-5 business days
- Address any requested changes
- Once approved, a maintainer will merge your PR
- Your contribution will be included in the next release!

## Additional Resources

- [README.md](README.md) - Project overview
- [API Documentation](http://localhost:8000/docs) - Backend API reference
- [PROJECT_PLAN.md](PROJECT_PLAN.md) - Detailed project plan
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide

## Questions?

- Open a [Discussion](https://github.com/bejranonda/Nutri-Vision-AI/discussions)
- Create an [Issue](https://github.com/bejranonda/Nutri-Vision-AI/issues)
- Email: support@nutrivision.app
- Thai support: support.th@nutrivision.app

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to NutriVision AI!** 🙏

*"ร่วมมือกันสร้างสุขภาพที่ดีให้คนไทย" - Together building better health for Thai people*
