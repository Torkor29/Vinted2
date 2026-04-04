#!/bin/bash
# =============================================================
# SCRIPT DE DEPLOIEMENT AUTOMATIQUE — VPS Hetzner / OVH / Contabo
# =============================================================
# Usage :
#   1. Connecte-toi en SSH a ton VPS : ssh root@TON_IP
#   2. Copie-colle ce script entier
#   3. C'est tout.
# =============================================================

set -e

echo "========================================="
echo "  VINTED BOT — Installation automatique"
echo "========================================="

# --- 1. Mise a jour systeme ---
echo "[1/7] Mise a jour du systeme..."
apt update -y && apt upgrade -y
apt install -y curl git ufw

# --- 2. Installer Docker ---
echo "[2/7] Installation de Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Installer Docker Compose plugin
if ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
fi

echo "Docker $(docker --version)"
echo "Docker Compose $(docker compose version)"

# --- 3. Firewall ---
echo "[3/7] Configuration du firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

# --- 4. Creer le dossier projet ---
echo "[4/7] Preparation du projet..."
mkdir -p /opt/vinted-bot
cd /opt/vinted-bot

# --- 5. Demander la configuration ---
echo ""
echo "========================================="
echo "  CONFIGURATION"
echo "========================================="
echo ""

read -p "Token du bot Telegram : " BOT_TOKEN
read -p "ID du groupe Telegram (ex: -1001234567890) : " GROUP_ID
read -p "Ton nom de domaine (ex: bot.monsite.com) : " DOMAIN
read -p "Ton email (pour le certificat SSL) : " EMAIL
read -p "Liste de proxies (ou appuie Entree pour aucun) : " PROXY_LIST

# --- 6. Creer le .env ---
echo "[5/7] Creation de la configuration..."
cat > .env << ENVEOF
# Telegram
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
TELEGRAM_GROUP_ID=${GROUP_ID}

# URLs
WEBAPP_URL=https://${DOMAIN}
API_URL=https://${DOMAIN}/api
WEBHOOK_URL=https://${DOMAIN}/webhook

# Database
DATABASE_URL=postgresql://vinted:vinted@db:5432/vintedbot

# Redis
REDIS_URL=redis://redis:6379

# Proxies
PROXY_LIST=${PROXY_LIST}

# Vinted
VINTED_DOMAIN=www.vinted.fr

# Scan
DEFAULT_SCAN_INTERVAL=3
MAX_FILTERS_PER_USER=5
PEPITE_DEFAULT_THRESHOLD=0.30

# Logging
LOG_LEVEL=info
ENVEOF

echo "Fichier .env cree."

# --- 7. Cloner le projet (ou copier les fichiers) ---
echo "[6/7] Si tu as un repo Git, clone-le maintenant."
echo "Sinon, copie tes fichiers dans /opt/vinted-bot/"
echo ""
echo "Exemple avec git :"
echo "  git clone https://github.com/ton-user/vinted-bot.git ."
echo ""
read -p "Appuie sur Entree quand les fichiers sont en place..." _

# --- 8. SSL avec Certbot ---
echo "[7/7] Configuration SSL..."
apt install -y certbot

# Arreter nginx s'il tourne pour liberer le port 80
docker compose down 2>/dev/null || true

certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    -d "${DOMAIN}"

# Mettre a jour nginx.conf pour SSL
mkdir -p nginx
cat > nginx/default.conf << 'NGINXEOF'
upstream backend {
    server backend:3000;
}

upstream webapp {
    server webapp:80;
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 10M;

    # API
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://backend/health;
    }

    # Telegram webhook
    location /webhook {
        proxy_pass http://backend/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Mini App
    location / {
        proxy_pass http://webapp/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINXEOF

# Remplacer le placeholder par le vrai domaine
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx/default.conf

# Monter les certificats dans docker-compose
# On ajoute le volume SSL au service nginx
if ! grep -q "certbot" docker-compose.yml; then
    sed -i '/\.\/nginx\/default\.conf/a\      - /etc/letsencrypt:/etc/letsencrypt:ro' docker-compose.yml
fi

# --- 9. Lancer ! ---
echo ""
echo "========================================="
echo "  LANCEMENT"
echo "========================================="
echo ""

docker compose up -d --build

echo ""
echo "========================================="
echo "  C'EST PRET !"
echo "========================================="
echo ""
echo "  Mini App  : https://${DOMAIN}"
echo "  API       : https://${DOMAIN}/api/health"
echo "  Bot       : Envoie /start a ton bot sur Telegram"
echo ""
echo "  Commandes utiles :"
echo "    docker compose logs -f backend    # Voir les logs"
echo "    docker compose restart backend    # Redemarrer le backend"
echo "    docker compose down               # Tout arreter"
echo "    docker compose up -d              # Tout relancer"
echo ""
echo "  Renouvellement SSL automatique :"
echo "    Ajoute ce cron : 0 3 1 * * certbot renew --quiet"
echo ""
