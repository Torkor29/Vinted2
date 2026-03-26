# ⚡ Vinted Sniper v2.0

Système de scraping et autobuy Vinted de niveau production. Anti-bot bypass, multi-pays, dashboard temps réel.

## Architecture

```
src/
├── index.js                   # Orchestrateur principal
├── config.js                  # Config (.env + config.json + validation)
│
├── cookie-factory/
│   ├── factory.js             # Création de sessions via Playwright
│   └── cli.js                 # Outil CLI pour tester les sessions
│
├── session-manager/
│   └── pool.js                # Pool multi-pays + rotation + health checks
│
├── scraper/
│   └── client.js              # Client HTTP got-scraping (TLS fingerprint)
│
├── query/
│   └── search.js              # Recherche, filtres, pagination, déduplication
│
├── autobuy/
│   └── buyer.js               # Autobuy par règles avec safety controls
│
├── monitoring/
│   └── monitor.js             # Suivi vendeurs, watchlist, alertes baisse prix
│
├── notifications/
│   └── notifier.js            # 7 canaux: Discord, Slack, Telegram, Email, SMS, Desktop, Webhook
│
├── proxy/
│   └── manager.js             # Pool de proxies avec rotation strategies
│
├── dashboard/
│   ├── server.js              # Express + Socket.IO
│   └── public/index.html      # Interface web temps réel
│
├── chrome-extension/          # Alternative: extension Chrome
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   └── popup.js
│
├── tests/
│   ├── api-tester.js          # Test complet des endpoints API
│   └── notification-tester.js # Test de tous les canaux de notification
│
└── utils/
    ├── logger.js              # Winston (console + fichier + rotation)
    ├── retry.js               # Retry + backoff + détection silencieuse
    └── exporter.js            # Export CSV/JSON + statistiques
```

## Quick Start

```bash
# 1. Installer
npm install
npx playwright install chromium

# 2. Configurer
cp .env.example .env
# Editer config.json avec tes recherches

# 3. Tester la session
npm run factory

# 4. Tester l'API
npm run test:api

# 5. Tester les notifications
npm run test:notifications

# 6. Lancer le sniper
npm start
```

## Commandes

```bash
npm start                      # Lancer le sniper complet + dashboard
npm run dev                    # Mode watch (auto-reload)
npm run dashboard              # Dashboard seul
npm run factory                # Créer une session manuellement
npm run factory -- fr --save   # Créer + sauvegarder
npm run test:api               # Tester tous les endpoints
npm run test:api -- de         # Tester pour l'Allemagne
npm run test:notifications     # Tester toutes les notifications
npm run test:session           # Test d'intégration rapide
npm run export                 # Voir les stats des exports
```

### CLI

```bash
# Recherche simple
node src/index.js -q "nike air max" --max-price 50

# Plusieurs recherches
node src/index.js -q "jordan 1" --max-price 80 -q "yeezy" --max-price 120

# Pays spécifique
node src/index.js --country de -q "adidas"
```

## 🔔 7 Canaux de Notification

| Canal | Config | Description |
|-------|--------|-------------|
| **Discord** | `notifications.discord.webhookUrl` | Embeds riches avec images, prix, vendeur |
| **Slack** | `notifications.slack.webhookUrl` | Blocks formatés avec liens |
| **Telegram** | `notifications.telegram.botToken` + `chatId` | Messages HTML + photos séparées |
| **Email** | `notifications.email.smtp.*` | Emails HTML avec tableau d'infos |
| **SMS** | `notifications.sms.*` (Twilio) | SMS courts avec lien |
| **Desktop** | `notifications.desktop.enabled` | Notification système native |
| **Webhook** | `notifications.webhook.url` | POST JSON brut (n'importe quelle URL) |

### Triggers configurables

```json
"triggers": {
  "newItem": true,           // Nouvel article trouvé
  "priceDrop": true,         // Baisse de prix détectée
  "sellerNewListing": true,  // Nouveau listing d'un vendeur suivi
  "autobuyExecuted": true,   // Achat automatique effectué
  "autobuyFailed": true,     // Achat échoué
  "sessionError": true,      // Erreur de session
  "dailySummary": true       // Résumé quotidien
}
```

## 🤖 Système Autobuy

### Comment ça marche

1. **Tu définis des règles** dans `config.json > autobuy.rules`
2. Chaque règle a des conditions (mots-clés, prix max, marque, taille, état, vendeur)
3. Quand un article matche UNE règle → le bot l'achète
4. **DRY RUN par défaut** : il log ce qu'il achèterait sans acheter

### Exemple de règle

```json
{
  "name": "Nike deals",
  "enabled": true,
  "keywords": ["nike", "air max"],
  "excludeKeywords": ["fake", "replica", "lot"],
  "maxPrice": 50,
  "minPrice": 5,
  "brands": ["Nike"],
  "sizes": ["42", "43"],
  "conditions": ["new_with_tags", "new_without_tags", "very_good"],
  "minSellerRating": 4.0,
  "minSellerReviews": 10,
  "maxItemAge": 300
}
```

### Modes d'achat

| Mode | Description |
|------|-------------|
| `instant` | Achat immédiat via l'API |
| `offer` | Fait une offre à X% en dessous du prix |

### Sécurités

- **Dry Run** : activé par défaut, log sans acheter
- **Limite journalière** : max achats/jour + max dépense/jour
- **Cooldown** : délai entre chaque achat
- **Blacklists** : vendeurs et articles exclus
- **Double vérification** : re-fetch l'article avant d'acheter
- **Prix minimum** : évite les articles suspicieusement pas chers
- **Âge max** : n'achète que les listings récents
- **Audit log** : toutes les actions sont loguées

### Activer l'autobuy

```json
{
  "autobuy": {
    "enabled": true,
    "dryRun": true,       // ← Commencer en dry run !
    "mode": "instant",
    "maxDailyPurchases": 5,
    "maxDailySpend": 200,
    "rules": [...]
  }
}
```

⚠️ **Le paiement doit être pré-configuré sur ton compte Vinted.** Le bot ne saisit jamais de données bancaires.

## 👁️ Monitoring

### Suivi de vendeurs

```json
"monitoring": {
  "sellers": [
    { "id": "123456", "name": "vendeur_nike", "country": "fr" }
  ]
}
```

→ Notifié à chaque nouveau listing du vendeur.

### Watchlist (alerte baisse prix)

```json
"monitoring": {
  "watchlist": [12345678, 87654321],
  "priceDropThresholdPercent": 10
}
```

→ Notifié quand un article baisse de 10%+.
→ Historique des prix disponible dans le dashboard.

## 🌐 Proxy

```json
"proxy": {
  "enabled": true,
  "strategy": "round-robin",
  "list": [
    "http://user:pass@proxy1.com:8080",
    "socks5://proxy2.com:1080"
  ],
  "stickyToSession": true
}
```

Stratégies : `round-robin`, `random`, `least-used`, `sticky`

**stickyToSession** : un proxy est lié à une session. Même IP + même TLS = pas de détection.

## 📊 Dashboard

Accessible sur `http://localhost:3000` après `npm start`.

- Feed temps réel des articles
- Gestion des recherches (ajout/suppression)
- Gestion des règles autobuy
- Suivi des vendeurs
- Watchlist
- Status des sessions (barre de progression)
- Status des proxies
- Log des notifications
- Stats autobuy

## 🛡️ Stratégie Anti-Bot

### Le problème
Vinted utilise Cloudflare + détection avancée. Les sessions sont liées au fingerprint TLS (JA3/JA4). Changer le fingerprint TLS avec les mêmes cookies = invalidation silencieuse (pas d'erreur, juste des réponses vides).

### La solution

**Playwright** crée de vraies sessions navigateur → cookies extraits → réutilisés avec **got-scraping** qui mime le TLS du navigateur → sessions rotées avant expiration.

Détection des échecs silencieux :
- Réponses vides consécutives → rotation immédiate
- Erreurs 403/429 → session marquée morte
- Health check toutes les 60s → remplacement automatique

### Extension Chrome (alternative)

Pour zéro risque de détection :
1. `chrome://extensions/` → Mode développeur
2. Charger `src/chrome-extension/`
3. Configurer dans le popup
4. Navigue sur Vinted normalement

| | Playwright | Extension Chrome |
|--|-----------|-----------------|
| TLS | Mimé (got-scraping) | Réel (natif) |
| Headless/serveur | ✅ | ❌ |
| Multi-sessions | ✅ Pool | ❌ Unique |
| Cloudflare | Résout le challenge | Jamais déclenché |
| Détection | Faible | Quasi nulle |
| Scalabilité | Bonne | Limitée |
