# Vinted Bot - Telegram Monitoring System

Bot de surveillance Vinted en temps reel avec integration Telegram.

## Fonctionnalites

- **Scan temps reel** : Polling agressif (<3s) pour detecter les nouveaux articles
- **Notifications Telegram** : Photo, prix, lien direct vers l'article
- **Mini App Telegram** : Interface complete pour gerer filtres, achats et analytics
- **Detection Pepites** : Articles dont le prix est significativement sous le marche
- **Tracking financier** : Suivi achats/reventes avec calcul de profit automatique

## Architecture

```
Backend (Fastify + TypeScript + grammy)
  ├── Scraper Vinted (undici + proxy rotation)
  ├── Bot Telegram (grammy)
  ├── API REST (Fastify)
  ├── Workers (scan, prix, nettoyage)
  └── Services (filtres, articles, achats, prix, notifications)

Frontend (React + TypeScript + Tailwind + Vite)
  └── Telegram Mini App

Infrastructure
  ├── PostgreSQL 16
  ├── Redis 7
  └── Nginx (reverse proxy)
```

## Prerequis

- Docker et Docker Compose
- Un bot Telegram (cree via @BotFather)
- Des proxies HTTP (optionnel mais recommande)

## Installation

### 1. Cloner et configurer

```bash
cp .env.example .env
```

Editer `.env` avec vos valeurs :
- `TELEGRAM_BOT_TOKEN` : Token du bot (obtenu via @BotFather)
- `TELEGRAM_GROUP_ID` : ID du groupe Telegram (avec topics actives)
- `WEBAPP_URL` : URL publique de la Mini App
- `PROXY_LIST` : Liste de proxies (comma-separated)

### 2. Lancer avec Docker Compose

```bash
docker-compose up -d
```

Cela demarre :
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend API (port 3000)
- Mini App (port 5173)
- Nginx (port 80)

### 3. Verifier

```bash
curl http://localhost/api/health
```

## Developpement

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend (Mini App)

```bash
cd webapp
npm install
npm run dev
```

## Structure du projet

```
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── src/
│   │   ├── index.ts          # Point d'entree
│   │   ├── config.ts         # Configuration
│   │   ├── bot/              # Bot Telegram (grammy)
│   │   ├── scraper/          # Client HTTP Vinted
│   │   ├── services/         # Logique metier
│   │   ├── api/              # Routes API REST
│   │   ├── db/               # PostgreSQL, Redis, migrations
│   │   ├── workers/          # Jobs background
│   │   └── types/            # Types TypeScript
│   └── Dockerfile
├── webapp/
│   ├── src/
│   │   ├── pages/            # 8 pages de la Mini App
│   │   ├── components/       # Composants reutilisables
│   │   ├── hooks/            # React hooks
│   │   ├── api/              # Client API
│   │   └── utils/            # Utilitaires
│   └── Dockerfile
└── nginx/
    └── default.conf
```

## Commandes Telegram

| Commande | Description |
|----------|-------------|
| `/start` | Menu principal + lien Mini App |
| `/filters` | Gerer les filtres |
| `/stats` | Statistiques |
| `/purchases` | Resume achats/reventes |
| `/settings` | Parametres |
| `/help` | Aide |

## Topics Telegram

Le bot utilise les Topics (Forum) du groupe :
- **General** : Commandes et menus
- **Feed** : Tous les articles detectes
- **Pepites** : Les bonnes affaires uniquement
