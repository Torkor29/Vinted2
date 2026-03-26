# ⚡ VINTED SNIPER v2.0 — Description Complète

## 📋 Résumé Exécutif

**Vinted Sniper** est un système de scraping, monitoring et achat automatique pour Vinted de niveau production. Il surveille en temps réel les nouvelles annonces correspondant à des filtres précis (marque, taille, prix, état, catégorie), détecte les bonnes affaires grâce à un scoring intelligent, et peut acheter automatiquement les articles qui matchent des règles prédéfinies.

**Proposition de valeur** : Un outil tout-en-un gratuit et open-source qui remplace des solutions payantes comme vTools (80€/mois) ou Telvin Bot, avec en plus un CRM vendeur intégré et une recherche par image — fonctionnalités qu'aucun concurrent ne propose.

---

## 🏗️ Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                    VINTED SNIPER v2.0                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Cookie   │→│ Session  │→│ Scraper  │→│ Search   │   │
│  │ Factory  │  │ Pool     │  │ Client   │  │ Engine   │   │
│  │(Playwright)│  │(rotation)│  │(got-scr) │  │(filters) │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       ↓              ↓              ↓              ↓        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ORCHESTRATEUR (index.js)                 │   │
│  │  Poll loop → Score → Match → Notify → Buy            │   │
│  └──────────────────────────────────────────────────────┘   │
│       ↓              ↓              ↓              ↓        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Deal     │  │ AutoBuy  │  │ Notifier │  │ Monitor  │   │
│  │ Scorer   │  │ (rules)  │  │ (7 chan) │  │ (watch)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       ↓              ↓              ↓              ↓        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Image    │  │ Arbitrage│  │ Telegram │  │ Dashboard│   │
│  │ Search   │  │ Detector │  │ Bot      │  │ Web UI   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Proxy    │  │ Exporter │  │ Chrome   │                  │
│  │ Manager  │  │ CSV/JSON │  │ Extension│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

**30+ fichiers source | ~12 000 lignes de code | Node.js ES Modules**

### Modules principaux

| Module | Fichier | Rôle |
|--------|---------|------|
| Cookie Factory | `src/cookie-factory/factory.js` | Crée des sessions Vinted via HTTP fetch ou Playwright. Extrait `access_token_web` + cookies |
| Session Pool | `src/session-manager/pool.js` | Gère 5 sessions par pays en rotation round-robin. Health checks automatiques |
| Scraper Client | `src/scraper/client.js` | Client HTTP via got-scraping (TLS fingerprint navigateur). Dual endpoint v2/web-core |
| Search Engine | `src/query/search.js` | Recherche API avec filtres, pagination, déduplication, post-filtrage local |
| Deal Scorer | `src/intelligence/deal-scorer.js` | Score 0-100 basé sur prix vs médiane marché, note vendeur, âge, état |
| Image Search | `src/intelligence/image-search.js` | Recherche par similarité visuelle (histogramme couleur ou API CLIP) |
| AutoBuyer | `src/autobuy/buyer.js` | Achat automatique par règles avec dry run, limites, cooldowns |
| Notifier | `src/notifications/notifier.js` | 7 canaux : Discord, Slack, Telegram, Email, SMS, Desktop, Webhook |
| Telegram Bot | `src/telegram/bot.js` | Bot complet avec 5 Forum Topics, menus interactifs, commandes |
| Dashboard | `src/dashboard/server.js` | Interface web temps réel (Express + Socket.IO) |
| Monitor | `src/monitoring/monitor.js` | Suivi vendeurs, watchlist, alertes baisse de prix |
| Arbitrage | `src/intelligence/arbitrage.js` | Détection d'opportunités d'arbitrage entre pays |
| Proxy Manager | `src/proxy/manager.js` | Pool de proxies avec 4 stratégies de rotation |
| Exporter | `src/utils/exporter.js` | Export CSV/JSON avec filtres |

---

## ✅ Fonctionnalités Implémentées

### 🔍 Scraping & Recherche

- **Création de sessions automatique** : simple HTTP GET sur la homepage Vinted → extraction du `access_token_web` (JWT, 2h de vie) + cookies. Fallback Playwright si Datadome bloque
- **Pool de 5 sessions par pays** en rotation round-robin. Chaque session supporte ~80 requêtes avant rotation
- **Bypass Datadome** : got-scraping mime le fingerprint TLS navigateur (JA3/JA4). Cookies de session compatibles
- **Multi-pays** : FR, DE, ES, IT, NL, BE, PT, PL, LT, CZ, AT, UK, US — chaque pays a son pool de sessions indépendant
- **Filtres avancés** : genre (Hommes/Femmes/Enfants), 50+ catégories avec sous-catégories, 1000+ marques, tailles, couleurs, état, prix min/max
- **Déduplication** : chaque article vu une seule fois (Map avec TTL 1h)
- **Post-filtrage local** : double vérification prix et marque côté client (l'API Vinted ignore parfois les filtres)
- **Dual endpoint** : `/api/v2/catalog/items` + fallback `/web/api/core/catalog/items` avec basculement automatique sur 403

### ⚡ Vitesse (Optimisé)

- **Polling toutes les 2 secondes** (configurable jusqu'à 1s)
- **5 requêtes parallèles** par cycle de poll
- **Tous pays + tous filtres en parallèle** (plus de traitement séquentiel)
- **Notifications fire-and-forget** : ne bloquent pas la boucle de poll
- **Autobuy prioritaire** : traité AVANT les notifications pour ne pas rater une affaire
- **Descriptions enrichies en arrière-plan** : ne ralentissent pas le flux principal
- **Délai estimé : ~3-5 secondes** entre publication et notification

### 💎 Intelligence & Deals

- **Deal scoring multi-facteurs** (0-100) : prix vs médiane du marché, note vendeur, âge de l'annonce, état de l'article
- **Score de confiance** (Faible/Moyen/Fort) basé sur le nombre de données pour la combinaison marque+taille
- **Historique des prix par marque+taille** pour des comparaisons précises
- **Labels automatiques** : PÉPITE (-60%+), Très bon prix (-40%), Bon prix (-20%), Prix correct, Au-dessus, Cher
- **Seuils configurables** en temps réel via API
- **Arbitrage multi-pays** : détection d'articles moins chers dans un pays vs un autre

### 📸 Recherche par Image (NOUVEAU)

- **Upload une photo de référence** → le bot compare visuellement chaque article scrapé
- **Mode gratuit (color-hash)** : histogramme de couleurs + variance de texture. 48 dimensions. Rapide et local
- **Mode précis (CLIP API)** : embeddings visuels via HuggingFace (gratuit 30k req/mois), Clarifai, ou serveur CLIP custom
- **Seuil de similarité configurable** (par défaut 70%)
- **Multi-références** : plusieurs photos de référence simultanées
- **Cache d'embeddings** : ne recalcule pas pour les images déjà vues
- **API dashboard** : `POST /api/image-search/reference` pour ajouter, `DELETE` pour retirer

### 🤖 Autobuy

- **Système par règles** : chaque règle définit keywords, marques, tailles, prix, état, vendeur
- **Dry Run par défaut** : log ce qui serait acheté sans acheter. Indispensable pour tester les règles
- **Deux modes** : achat instantané ou offre à X% en dessous
- **Limites de sécurité** : max achats/jour, max dépense/jour, cooldown entre achats
- **Blacklists** : vendeurs et articles exclus
- **Double vérification** : re-fetch de l'article juste avant l'achat pour confirmer disponibilité et prix
- **Prix minimum** : évite les articles suspicieusement bon marché
- **Âge maximum** : n'achète que les annonces fraîches (configurable en secondes)
- **Audit log complet** : chaque évaluation et achat est tracé

### 📡 Notifications (7 canaux)

| Canal | Format |
|-------|--------|
| Discord | Embeds riches avec image, prix, vendeur, badges |
| Slack | Blocks formatés avec liens |
| Telegram | Messages HTML + photos + boutons inline |
| Email (SMTP) | Email HTML avec tableau d'infos |
| SMS (Twilio) | Message court avec lien |
| Desktop | Notification système native (Windows/Mac) |
| Webhook | POST JSON brut vers n'importe quelle URL |

**7 triggers configurables** : nouvel article, baisse de prix, nouveau listing vendeur, achat réussi, achat échoué, erreur session, résumé quotidien

### 📱 Bot Telegram

- **5 Forum Topics** automatiquement créés dans un supergroup :
  - 📡 Feed — tous les nouveaux articles
  - 💎 Deals — articles avec score ≥ 70
  - 🤖 Autobuy — achats et dry runs
  - 📊 Stats — résumés périodiques
  - ⚠️ Alertes — erreurs et baisses de prix
- **Menu interactif** avec inline keyboards
- **7 commandes** : `/status`, `/start_bot`, `/stop_bot`, `/filters`, `/deals`, `/stats`, `/buy [id]`
- **Rate limiting** : queue avec 350ms entre les messages pour respecter les limites Telegram
- **Retry intelligent** : gestion des 429 avec `retry_after`

### 🖥️ Dashboard Web

- **Feed temps réel** via Socket.IO avec badges de deals
- **Search builder** : sélection genre → catégorie → marque → taille → couleur → état → prix
- **Bouton start/stop** du bot
- **Filtres actifs** affichés et supprimables depuis le feed
- **Sessions** : barres de progression avec compteur de requêtes
- **Autobuy** : configuration, connexion Vinted, historique
- **Export** CSV/JSON avec filtres

### 👁️ Monitoring

- **Suivi de vendeurs** : notification à chaque nouveau listing d'un vendeur surveillé
- **Watchlist** : suivi du prix d'articles spécifiques, alerte si baisse > seuil
- **Historique des prix** accessible via API

### 🔒 Sécurité & Fiabilité

- Rotation automatique des sessions mortes/épuisées
- Health checks toutes les 60 secondes
- Retry avec backoff exponentiel
- Détection d'échecs silencieux (réponses vides = session morte)
- Graceful shutdown (SIGINT/SIGTERM)
- Prévention des fuites mémoire (maps capées à 10k entrées)
- Protection XSS (safeUrl) dans le dashboard
- Validation des queries (bounds check)

### 🌐 Proxy Support

- 4 stratégies : round-robin, random, least-used, sticky
- Auto-remove des proxies qui échouent (après N failures)
- Sticky-to-session : même proxy = même TLS = pas de détection
- Support HTTP, HTTPS, SOCKS5
- Fichier ou liste dans config.json

---

## 🚀 Améliorations Prévues (ROADMAP)

### Phase 1 — Ultra-Vitesse 🏎️
*Objectif : passer de ~5s à <2s de délai*

- [ ] Polling à 1s avec 10+ sessions par pays
- [ ] Hébergement EU-West-1 (Irlande) — même datacenter qu'AWS Vinted
- [ ] WebSocket listener au lieu de polling HTTP (si endpoint Vinted détecté)
- [ ] Pre-warm des sessions (pool toujours plein, rotation anticipée)
- [ ] Edge caching des résultats pour déduplication instantanée

### Phase 2 — Recherche par Image Avancée 📸
*Objectif : trouver des articles visuellement identiques*

- [ ] Interface d'upload dans le dashboard (drag & drop)
- [ ] Upload via Telegram (envoie une photo → le bot crée un filtre visuel)
- [ ] Mode CLIP complet avec HuggingFace Inference API (gratuit)
- [ ] Combinaison filtres texte + image (ex: "Nike Air Max qui ressemble à CETTE photo")
- [ ] Alertes spécifiques pour les visual matches

### Phase 3 — CRM Vendeur Automatique 🏪
*Objectif : transformer le bot en outil de revente professionnel*

#### 3a. Auto-Relist (Republication automatique)
- [ ] Article acheté via autobuy → nouvelle annonce créée automatiquement
- [ ] Titre optimisé par IA (GPT) pour maximiser la visibilité
- [ ] Description générée (template + détails de l'original)
- [ ] Photos récupérées de l'annonce originale
- [ ] Prix de revente calculé (marge configurable : +20%, +30%, +50%)
- [ ] Catégorie, taille, marque, état reportés automatiquement

#### 3b. Gestion du Stock
- [ ] Dashboard des articles achetés avec statuts :
  - 📦 Acheté → 🚚 En transit → ✅ Reçu → 🏷️ En vente → 💰 Vendu
- [ ] Calcul automatique des marges (prix achat - frais - prix vente)
- [ ] Alertes quand un article stagne (pas vendu après X jours)
- [ ] Vue globale : stock total, valeur estimée, marge moyenne

#### 3c. Relances Automatiques
- [ ] Baisse de prix automatique si pas vendu après X jours (-5%, -10%)
- [ ] "Bump" automatique (republication avec date fraîche)
- [ ] Réponse automatique aux messages d'acheteurs intéressés
- [ ] Acceptation automatique d'offres si prix > seuil configurable
- [ ] Templates de messages personnalisables

#### 3d. Multi-Compte
- [ ] Gestion de plusieurs comptes Vinted simultanément
- [ ] Répartition des achats entre comptes (contourner les limites)
- [ ] Répartition des ventes entre comptes
- [ ] Dashboard unifié multi-comptes
- [ ] Rotation des comptes pour l'autobuy

### Phase 4 — Intelligence Artificielle 🧠
*Objectif : prédire et anticiper*

- [ ] **Prédiction de prix de revente** : modèle ML entraîné sur l'historique des ventes par marque/taille/état
- [ ] **Détection d'articles à fort potentiel** : scoring prédictif avant que le prix ne monte
- [ ] **Analyse de tendances** : quelles marques/catégories montent ou descendent
- [ ] **Scoring vendeur intelligent** : fiabilité basée sur historique, temps de réponse, taux d'annulation
- [ ] **Génération de descriptions optimisées** : GPT-4 pour maximiser les ventes
- [ ] **Détection de contrefaçons** : analyse visuelle pour repérer les faux

### Phase 5 — Scale & Monétisation 💰
*Objectif : transformer en produit*

- [ ] API publique REST pour intégrations tierces
- [ ] Plans d'abonnement (Free / Pro / Enterprise)
- [ ] White-label pour resellers professionnels
- [ ] Analytics avancées (ROI, tendances, revenus mensuels)
- [ ] App mobile (React Native)
- [ ] Marketplace de scripts/règles communautaires

---

## 📊 Métriques Clés

| Métrique | Valeur actuelle |
|----------|----------------|
| Délai détection | ~3-5 secondes |
| Sessions simultanées | 5 par pays |
| Pays supportés | 12 |
| Canaux de notification | 7 |
| Catégories | 50+ |
| Marques | 1000+ |
| Tailles | Tous systèmes |
| Requêtes parallèles | 5 par cycle |
| Mémoire utilisée | ~45-80 MB |
| Coût | 0€ (self-hosted) |

---

## 🛠️ Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js 20+ (ES Modules) |
| Sessions | Playwright (fallback) + got-scraping |
| HTTP Client | got-scraping (TLS fingerprint navigateur) |
| Dashboard | Express 4 + Socket.IO 4 |
| Logging | Winston (console + fichier + rotation) |
| Telegram | Bot API REST natif (zero dependency) |
| Email | Nodemailer |
| Desktop | node-notifier (SnoreToast / libnotify) |
| Hébergement | Render / VPS / Local |

---

## 🏆 Comparaison avec la concurrence

| Feature | Vinted Sniper (nous) | vTools (80€/mois) | Telvin Bot | VintedSeekers |
|---------|---------------------|-------------------|------------|---------------|
| Prix | **Gratuit** | 80€/mois | 15-50€/mois | 30€/mois |
| Vitesse | ~3-5s | <0.1s | ~0.75s | ~2.5s |
| Multi-pays | ✅ 12 pays | ✅ | ✅ | ✅ |
| Recherche image | ✅ | ❌ | ❌ | ❌ |
| CRM vendeur | ✅ (prévu) | ❌ | ❌ | ❌ |
| Telegram topics | ✅ 5 topics | ❌ | ❌ | ❌ |
| Deal scoring IA | ✅ | Basique | ❌ | ❌ |
| Autobuy | ✅ (rules) | ✅ (autocop) | ❌ | ✅ |
| Dashboard web | ✅ | ✅ | ❌ | ✅ |
| Open-source | ✅ | ❌ | ❌ | ❌ |
| Personnalisable | ✅ 100% | ❌ | ❌ | Limité |

**Notre avantage** : personnalisation totale, gratuit, recherche par image, CRM intégré, 7 canaux de notifs, et la vitesse peut être améliorée en ajoutant des sessions + un serveur en Irlande.

---

## 📞 Résumé

**Aujourd'hui** : Vinted Sniper scrape Vinted en temps réel, détecte les bonnes affaires avec un scoring intelligent, notifie sur 7 canaux dont Telegram avec 5 topics organisés, et peut acheter automatiquement via des règles personnalisables.

**Demain** : un CRM de revente complet qui achète, republie, gère le stock, relance les invendus, prédit les prix et génère des descriptions optimisées par IA — le tout gratuitement et en open-source.

---

*Document généré le 2026-03-26 | Vinted Sniper v2.0*
