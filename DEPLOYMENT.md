# 🚀 Deployment Guide - NutriVision AI

This guide covers deploying NutriVision AI to production.

## Quick Deployment (Docker)

### Prerequisites
- VPS or cloud server (2GB+ RAM recommended)
- Docker and Docker Compose installed
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

### Steps

1. **Clone repository on server**
```bash
git clone https://github.com/yourusername/Nutri-Vision-AI.git
cd Nutri-Vision-AI
```

2. **Configure environment**
```bash
cp .env.example .env
nano .env
```

Update these critical values:
```env
APP_ENV=production
DEBUG=false
ALLOWED_ORIGINS=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Generate strong secrets
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)

# Add your Gemini API key
GEMINI_API_KEY=your_real_api_key_here

# Database (use strong password)
DB_PASSWORD=strong_random_password_here

# Disable test routes
ENABLE_TEST_ROUTES=false
```

3. **Run installation**
```bash
chmod +x scripts/install-all.sh
./scripts/install-all.sh
```

4. **Set up Nginx reverse proxy**
```nginx
# /etc/nginx/sites-available/nutrivision

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

5. **Enable site**
```bash
sudo ln -s /etc/nginx/sites-available/nutrivision /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

6. **Set up SSL with Let's Encrypt**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com
```

7. **Set up auto-renewal**
```bash
sudo certbot renew --dry-run
```

## Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: nutrivision
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: nutrivision
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - nutrivision-network

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - nutrivision-network

  backend:
    build: ./backend
    restart: always
    env_file: .env
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - db
      - redis
    networks:
      - nutrivision-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    build: ./frontend
    restart: always
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${BACKEND_URL}
    depends_on:
      - backend
    networks:
      - nutrivision-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  postgres_data:
  redis_data:

networks:
  nutrivision-network:
    driver: bridge
```

Start production:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Database Backups

### Automatic Backup Script

Create `scripts/backup-db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T db pg_dump -U nutrivision nutrivision | gzip > ${BACKUP_DIR}/backup_${DATE}.sql.gz

# Keep only last 7 days
find ${BACKUP_DIR} -name "backup_*.sql.gz" -mtime +7 -delete
```

Set up cron job:
```bash
chmod +x scripts/backup-db.sh
crontab -e
```

Add:
```
0 2 * * * /path/to/Nutri-Vision-AI/scripts/backup-db.sh
```

## Monitoring

### Basic Health Check
```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Check resource usage
docker stats
```

### Set up Uptime Monitoring
- Use UptimeRobot (free tier)
- Monitor: https://yourdomain.com
- Monitor: https://api.yourdomain.com/health

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Set DEBUG=false
- [ ] Configured proper ALLOWED_ORIGINS
- [ ] Set up SSL/HTTPS
- [ ] Configured firewall (UFW)
- [ ] Set up automatic security updates
- [ ] Regular database backups
- [ ] Monitoring and alerting configured
- [ ] GDPR compliance verified

## Firewall Setup (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

## Performance Optimization

### 1. Database Optimization
```sql
-- Create indexes
CREATE INDEX idx_scans_user_created ON food_scans(user_id, created_at DESC);
CREATE INDEX idx_recipes_published ON recipes(is_published, created_at DESC);
```

### 2. Redis Caching
Ensure Redis is configured for caching API responses:
```python
# Already implemented in backend
```

### 3. Frontend Optimization
```bash
# Build optimized production build
cd frontend
npm run build
```

## Scaling

### Horizontal Scaling
For high traffic, consider:
1. Multiple backend containers
2. Load balancer (Nginx or HAProxy)
3. Separate database server
4. CDN for static assets

### Database Scaling
- Read replicas for read-heavy operations
- Connection pooling (already implemented)
- Query optimization

## Troubleshooting

### Backend won't start
```bash
docker-compose logs backend
# Check if DB is ready
docker-compose exec db pg_isready
```

### Frontend build fails
```bash
docker-compose exec frontend npm install
docker-compose restart frontend
```

### Database connection issues
```bash
# Check if DB is running
docker-compose ps db
# Test connection
docker-compose exec backend python -c "from app.db.base import engine; print(engine.connect())"
```

## Support

For deployment issues:
- GitHub Issues: https://github.com/yourusername/Nutri-Vision-AI/issues
- Email: support@nutrivision.app

---

**Happy Deploying! 🚀**
