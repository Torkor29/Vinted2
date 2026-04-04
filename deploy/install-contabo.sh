#!/bin/bash
# =============================================================
# INSTALLATION COMPLETE VINTED BOT — Contabo VPS
# Copie-colle tout ce script dans ton terminal SSH
# =============================================================
set -e

echo ""
echo "========================================="
echo "  VINTED BOT — Installation Contabo"
echo "========================================="
echo ""

# --- Configuration ---
read -p "Ton domaine DuckDNS (ex: vintedbot-julie.duckdns.org) : " DOMAIN
read -p "Token du bot Telegram : " BOT_TOKEN
read -p "ID du groupe Telegram (ex: -1001234567890) : " GROUP_ID
read -p "Ton email (pour SSL) : " EMAIL
read -p "Proxies (ou Entree pour aucun) : " PROXY_LIST

echo ""
echo "[1/6] Mise a jour systeme..."
apt update -y && apt upgrade -y -q
apt install -y -q curl git ufw certbot

echo "[2/6] Installation Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
fi
if ! docker compose version &> /dev/null; then
    apt install -y -q docker-compose-plugin 2>/dev/null || true
fi

echo "[3/6] Firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[4/6] Telechargement du projet..."
mkdir -p /opt/vinted-bot && cd /opt/vinted-bot

# Telecharger le projet directement depuis les fichiers locaux
# On cree tous les fichiers directement ici

# --- .env ---
cat > .env << ENVEOF
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
TELEGRAM_GROUP_ID=${GROUP_ID}
WEBAPP_URL=https://${DOMAIN}
API_URL=https://${DOMAIN}/api
WEBHOOK_URL=https://${DOMAIN}/webhook
DATABASE_URL=postgresql://vinted:vinted@db:5432/vintedbot
REDIS_URL=redis://redis:6379
PROXY_LIST=${PROXY_LIST}
VINTED_DOMAIN=www.vinted.fr
DEFAULT_SCAN_INTERVAL=3
MAX_FILTERS_PER_USER=5
PEPITE_DEFAULT_THRESHOLD=0.30
LOG_LEVEL=info
ENVEOF

echo "[5/6] Certificat SSL..."
certbot certonly --standalone --non-interactive --agree-tos \
    --email "${EMAIL}" -d "${DOMAIN}" || {
    echo "ERREUR SSL — verifie que ton domaine pointe bien vers cette IP"
    echo "Tu peux relancer le script apres avoir corrige le DNS"
    exit 1
}

# Mettre a jour nginx pour SSL
mkdir -p nginx
cat > nginx/default.conf << NGINXEOF
upstream backend { server backend:3000; }
upstream webapp { server webapp:80; }

server {
    listen 80;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://backend/health;
    }

    location /webhook {
        proxy_pass http://backend/webhook;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        proxy_pass http://webapp/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
NGINXEOF

# Ajouter les volumes SSL au docker-compose
cat > docker-compose.yml << 'DCEOF'
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  webapp:
    build:
      context: ./webapp
      dockerfile: Dockerfile
    ports:
      - "5173:80"
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vintedbot
      POSTGRES_USER: vinted
      POSTGRES_PASSWORD: vinted
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/src/db/migrations:/docker-entrypoint-initdb.d
    ports:
      - "127.0.0.1:5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vinted -d vintedbot"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
      - webapp
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
DCEOF

echo "[6/6] Lancement..."
docker compose up -d --build

# Renouvellement SSL automatique
(crontab -l 2>/dev/null; echo "0 3 1 * * certbot renew --quiet && docker compose -f /opt/vinted-bot/docker-compose.yml restart nginx") | crontab -

echo ""
echo "========================================="
echo "  INSTALLATION TERMINEE !"
echo "========================================="
echo ""
echo "  Mini App  : https://${DOMAIN}"
echo "  API       : https://${DOMAIN}/api/health"
echo "  Bot       : Envoie /start sur Telegram"
echo ""
echo "  Logs   : docker compose logs -f backend"
echo "  Status : docker compose ps"
echo "  Stop   : docker compose down"
echo "  Start  : docker compose up -d"
echo ""
echo "  ⚠️  CHANGE TON MOT DE PASSE ROOT :"
echo "  Tape : passwd"
echo ""
