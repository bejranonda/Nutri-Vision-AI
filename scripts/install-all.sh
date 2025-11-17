#!/bin/bash

# NutriVision AI - Complete Installation Script
# Installs and sets up the entire application

set -e  # Exit on error

echo "🥗 NutriVision AI - Installation Script"
echo "========================================"

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker found: $(docker --version)"
echo "✅ Docker Compose found: $(docker-compose --version)"

# Check for .env file
echo ""
echo "📝 Checking environment configuration..."

if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and add your API keys:"
    echo "   - GEMINI_API_KEY (get from https://makersuite.google.com/app/apikey)"
    echo "   - SECRET_KEY (generate with: openssl rand -hex 32)"
    echo "   - JWT_SECRET_KEY (generate with: openssl rand -hex 32)"
    echo ""
    read -p "Press Enter after you've configured .env file..."
else
    echo "✅ .env file found"
fi

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p backend/app/tests
echo "✅ Directories created"

# Build and start containers
echo ""
echo "🐳 Building Docker containers..."
docker-compose build

echo ""
echo "🚀 Starting services..."
docker-compose up -d

# Wait for database to be ready
echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo ""
echo "🗄️  Running database migrations..."
docker-compose exec -T backend alembic upgrade head

# Seed database with Thai food data
echo ""
echo "🌶️  Seeding Thai food data..."
docker-compose exec -T backend python app/db/seed_data.py

# Check services status
echo ""
echo "🔍 Checking services status..."
docker-compose ps

echo ""
echo "================================"
echo "✅ Installation complete!"
echo "================================"
echo ""
echo "🌐 Access the application:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo ""
echo "📚 Next steps:"
echo "   1. Visit http://localhost:3000"
echo "   2. Create an account"
echo "   3. Start scanning food!"
echo ""
echo "💡 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose down"
echo "   Restart services: docker-compose restart"
echo ""
echo "Happy nutrition tracking! 🥗"
