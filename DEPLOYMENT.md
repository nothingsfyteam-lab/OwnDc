# OwnDc Deployment Guide

This guide will walk you through deploying your OwnDc application to various platforms.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Deploy to Railway](#deploy-to-railway) (Recommended - Free)
4. [Deploy to Render](#deploy-to-render) (Free)
5. [Deploy to Heroku](#deploy-to-heroku)
6. [Deploy to VPS/Dedicated Server](#deploy-to-vps)
7. [Environment Variables](#environment-variables)
8. [Domain & SSL Setup](#domain--ssl-setup)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:
- Node.js 18+ installed locally
- Git installed
- A GitHub account
- A deployment platform account (Railway, Render, Heroku, or VPS)

---

## Local Development

### 1. Clone your repository (or create one)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/owndc.git
git push -u origin main
```

### 2. Install dependencies and test locally
```bash
npm install
npm start
```

Visit `http://localhost:3000` to verify everything works.

---

## Deploy to Railway (Recommended - Free)

Railway offers a generous free tier with automatic deploys from GitHub.

### Step 1: Prepare your project

Update `package.json` to include a start script:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

Create a `railway.json` file:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Step 2: Deploy

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your OwnDc repository
4. Railway will automatically detect Node.js and deploy
5. Click on your service → "Settings" → "Domains"
6. Your app will be available at `https://your-project.up.railway.app`

### Step 3: Add environment variables

In Railway dashboard:
1. Go to your project → service → "Variables"
2. Add:
   - `NODE_ENV=production`
   - `SESSION_SECRET=your-random-secret-key-here`
3. Redeploy if necessary

---

## Deploy to Render (Free)

Render offers a free tier that never sleeps.

### Step 1: Create render.yaml

Create a `render.yaml` file in your project root:
```yaml
services:
  - type: web
    name: owndc
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SESSION_SECRET
        generateValue: true
      - key: PORT
        value: 10000
```

### Step 2: Deploy

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will read `render.yaml` and deploy automatically
5. Your app will be at `https://owndc.onrender.com`

---

## Deploy to Heroku

### Step 1: Prepare your project

Create a `Procfile` (no extension):
```
web: npm start
```

Create `app.json`:
```json
{
  "name": "OwnDc",
  "description": "Discord-like Voice & Chat Platform",
  "repository": "https://github.com/YOUR_USERNAME/owndc",
  "logo": "",
  "keywords": ["node", "express", "socket.io", "chat"],
  "image": "heroku/nodejs",
  "env": {
    "SESSION_SECRET": {
      "description": "Secret key for session encryption",
      "generator": "secret"
    }
  }
}
```

### Step 2: Deploy via CLI

```bash
# Install Heroku CLI if not already installed
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-owndc-app

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set SESSION_SECRET=your-secret-key-here

# Deploy
git push heroku main

# Open in browser
heroku open
```

---

## Deploy to VPS/Dedicated Server

For maximum control, deploy to a VPS like DigitalOcean, Linode, or AWS EC2.

### Step 1: Set up the server

Connect to your VPS via SSH:
```bash
ssh root@your-server-ip
```

Update system and install Node.js:
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install Nginx
apt install nginx -y
```

### Step 2: Deploy your app

```bash
# Create app directory
mkdir -p /var/www/owndc
cd /var/www/owndc

# Clone your repository
git clone https://github.com/YOUR_USERNAME/owndc.git .

# Install dependencies
npm install --production

# Set environment variables
echo "NODE_ENV=production" > .env
echo "PORT=3000" >> .env
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env

# Start with PM2
pm2 start server.js --name owndc
pm2 startup
pm2 save
```

### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/owndc`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/owndc /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 4: Set up SSL (Let's Encrypt)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

---

## Environment Variables

Create a `.env` file (never commit this to git):

```env
# Server
NODE_ENV=production
PORT=3000

# Security
SESSION_SECRET=your-super-secret-random-string-here

# Database (if using external DB)
# DATABASE_URL=sqlite:./database.sqlite

# Optional: External services
# REDIS_URL=redis://localhost:6379
```

Add `.env` to `.gitignore`:
```
.env
.env.local
.env.*.local
```

---

## Domain & SSL Setup

### Option 1: Free subdomain (Railway/Render)
Both platforms provide free SSL-enabled subdomains automatically.

### Option 2: Custom domain

1. Buy a domain from Namecheap, GoDaddy, or Cloudflare
2. Add DNS records pointing to your server IP
3. Configure SSL with Let's Encrypt (see VPS section above)

### Option 3: Cloudflare (Free SSL + CDN)

1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Update nameservers at your domain registrar
4. Enable "Full (Strict)" SSL mode
5. Add A record pointing to your server IP

---

## Database Considerations

### SQLite (Current)
- ✅ Good for small-medium apps
- ✅ No setup required
- ⚠️ File-based - may have issues with multiple server instances

### PostgreSQL (Recommended for production)

Update `package.json`:
```json
"dependencies": {
  "pg": "^8.11.0",
  "sqlite3": "^5.1.7"
}
```

Update `db.js` to support both:
```javascript
const usePostgres = process.env.DATABASE_URL?.includes('postgresql');

if (usePostgres) {
  // Use pg for PostgreSQL
} else {
  // Use sqlite3 for SQLite
}
```

---

## Monitoring & Logging

### PM2 (for VPS)
```bash
# View logs
pm2 logs owndc

# Monitor
pm2 monit

# Restart
pm2 restart owndc
```

### Railway/Render
Logs are available in the dashboard under your service.

### Add logging to your app

Update `server.js`:
```javascript
const morgan = require('morgan');
app.use(morgan('combined'));
```

Install: `npm install morgan`

---

## Scaling

### Horizontal Scaling (Multiple instances)

1. Use Redis for session storage (required for Socket.IO)
2. Use PostgreSQL instead of SQLite
3. Deploy multiple instances behind a load balancer

### Vertical Scaling

Upgrade your server resources (RAM, CPU) on your hosting platform.

---

## Troubleshooting

### Port already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Socket.IO not connecting
- Ensure WebSocket support is enabled on your reverse proxy
- Check that `transports: ['websocket', 'polling']` is set in client

### Database locked (SQLite)
- Don't use SQLite for high-traffic production
- Switch to PostgreSQL

### CORS errors
Add to `server.js`:
```javascript
const cors = require('cors');
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
```

---

## Quick Deployment Checklist

- [ ] Change SESSION_SECRET to a random string
- [ ] Set NODE_ENV=production
- [ ] Add favicon
- [ ] Test all features locally
- [ ] Commit and push to GitHub
- [ ] Deploy to chosen platform
- [ ] Set environment variables
- [ ] Test deployed version
- [ ] Set up custom domain (optional)
- [ ] Enable SSL/HTTPS
- [ ] Set up monitoring

---

## Next Steps

1. **Backup Strategy**: Set up automated database backups
2. **CI/CD**: Use GitHub Actions for automated testing and deployment
3. **Monitoring**: Add error tracking with Sentry
4. **Analytics**: Add usage analytics
5. **Rate Limiting**: Protect against spam and abuse

---

## Support

If you encounter issues:
1. Check the logs on your deployment platform
2. Test locally with `NODE_ENV=production npm start`
3. Check environment variables are set correctly
4. Verify all dependencies are in `package.json`

Happy deploying! 🚀
