# Deployment Guide - Hetzner VPS (Ubuntu)

This guide covers deploying the CRM application to a Hetzner VPS running Ubuntu.

## Prerequisites

- Ubuntu 20.04 or 22.04 LTS server
- Root or sudo access
- Domain name pointed to your server (optional but recommended)
- At least 2GB RAM

## Step 1: Initial Server Setup

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Install Git
```bash
sudo apt install git -y
```

Log out and back in for Docker group changes to take effect.

## Step 2: Clone Repository

```bash
cd /opt
sudo git clone <your-repository-url> crm-app
sudo chown -R $USER:$USER crm-app
cd crm-app
```

## Step 3: Configure Environment

### Backend Configuration
```bash
cd backend
cp .env.example .env
nano .env
```

Update these critical settings:
```env
# Generate a secure secret key
SECRET_KEY=<run: openssl rand -hex 32>

# Update CORS for your domain
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Configure real SMTP (example with Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=true

# Change admin credentials
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=strong-initial-password
```

### Frontend Configuration
```bash
cd ../frontend
cp .env.example .env
nano .env
```

Update:
```env
VITE_API_URL=https://your-domain.com
```

## Step 4: Set Up Reverse Proxy (Nginx)

### Install Nginx
```bash
sudo apt install nginx -y
```

### Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/crm-app
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API docs
    location /docs {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /openapi.json {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/crm-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 5: Set Up SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts. Certbot will automatically configure SSL and set up auto-renewal.

## Step 6: Update Docker Compose for Production

Edit `docker-compose.yml`:
```bash
nano docker-compose.yml
```

Remove the MailHog service (or keep for testing) and update:
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: crm-backend
    ports:
      - "127.0.0.1:8000:8000"
    volumes:
      - ./backend:/app
      - backend-data:/app/data
    env_file:
      - ./backend/.env
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: crm-frontend
    ports:
      - "127.0.0.1:5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=https://your-domain.com
    depends_on:
      - backend
    restart: always

volumes:
  backend-data:
```

## Step 7: Start the Application

```bash
cd /opt/crm-app
docker compose up -d --build
```

Check logs:
```bash
docker compose logs -f
```

## Step 8: Set Up Automatic Backups

### Create Backup Script
```bash
sudo nano /opt/backup-crm.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/crm-backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /opt/crm-app/backend/data/crm.db $BACKUP_DIR/crm_$DATE.db

# Keep only last 30 days
find $BACKUP_DIR -name "crm_*.db" -mtime +30 -delete

echo "Backup completed: crm_$DATE.db"
```

Make executable:
```bash
sudo chmod +x /opt/backup-crm.sh
```

### Set Up Cron Job
```bash
sudo crontab -e
```

Add daily backup at 2 AM:
```
0 2 * * * /opt/backup-crm.sh >> /var/log/crm-backup.log 2>&1
```

## Step 9: Set Up Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 10: Configure System Service (Optional)

For automatic startup on reboot, enable Docker service:
```bash
sudo systemctl enable docker
```

## Monitoring and Maintenance

### View Logs
```bash
cd /opt/crm-app
docker compose logs -f backend  # Backend logs
docker compose logs -f frontend # Frontend logs
```

### Restart Services
```bash
docker compose restart
```

### Update Application
```bash
cd /opt/crm-app
git pull
docker compose up -d --build
```

### Check System Resources
```bash
docker stats
```

### Database Backup and Restore

Backup:
```bash
cp backend/data/crm.db backup/crm_$(date +%Y%m%d).db
```

Restore:
```bash
docker compose down
cp backup/crm_YYYYMMDD.db backend/data/crm.db
docker compose up -d
```

## Security Checklist

- [ ] Changed default admin password
- [ ] Generated secure SECRET_KEY
- [ ] Configured SSL/TLS
- [ ] Set up firewall (UFW)
- [ ] Regular backups configured
- [ ] Limited SSH access (key-based only recommended)
- [ ] Configured real SMTP (not MailHog)
- [ ] Updated CORS_ORIGINS to production domains
- [ ] Docker containers set to restart automatically
- [ ] Monitoring set up (optional: install monitoring tools)

## Troubleshooting

### Check if containers are running
```bash
docker ps
```

### Restart everything
```bash
cd /opt/crm-app
docker compose down
docker compose up -d --build
```

### Check Nginx status
```bash
sudo systemctl status nginx
```

### View Nginx error logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues
```bash
sudo certbot renew --dry-run
```

## Performance Optimization

### For Production Frontend Build

Update frontend Dockerfile:
```dockerfile
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Enable Nginx Gzip Compression
Edit `/etc/nginx/nginx.conf` and ensure gzip is enabled in the http block.

## Support

For issues or questions:
- Check application logs
- Review this guide
- Check the main README.md
- Verify all environment variables are set correctly
