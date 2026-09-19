# Angelucci's — Backend Node.js (déploiement Infomaniak)

Migration du backend Python/FastAPI vers **Node.js/Express** — mêmes URLs, mêmes réponses JSON, aucune modification frontend requise.

## Stack

- Node.js 18+ (testé sur Node 20)
- Express 4 · MongoDB natif driver (pas Mongoose) · JWT + bcryptjs
- Resend (emails) · Payrexx (paiements) · Pushover (notifs) · PDFKit (compta) · Star CloudPRNT (imprimante)

## Structure

```
backend-node/
├── package.json      # dépendances + script "npm start"
├── server.js         # entrée principale, tous les endpoints /api/*
├── auth.js           # JWT + bcrypt + middleware requireAuth
├── printer.js        # Star Line Mode ESC/POS + file d'attente CloudPRNT
├── emails.js         # templates HTML Resend
├── payrexx.js        # gateway HMAC-SHA256
├── pdfGen.js         # PDF compta mensuel (PDFKit)
└── seed.js           # settings/schedules/categories par défaut
```

## Variables d'environnement

À définir dans le manager Infomaniak (Site Node.js → Environment Variables), **ou** via un fichier `.env` à la racine du dossier `backend-node/` :

```env
# --- Obligatoires ---
MONGO_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?retryWrites=true
DB_NAME=angeluccis_db
JWT_SECRET=change-me-in-production-super-secret
ADMIN_USERNAME=AngelCED26
ADMIN_PASSWORD=CE26$Lucc
STAFF_USERNAME=AnCED25
STAFF_PASSWORD=26$LuANG
CORS_ORIGINS=https://www.angeluccis.ch,https://angeluccis.ch

# --- Emails (Resend) — optionnel ---
RESEND_API_KEY=re_...
SENDER_EMAIL=Angelucci's <noreply@angeluccis.ch>
RESTAURANT_EMAIL=toni@angeluccis.com
RESTAURANT_NAME=Farmacia Angelucci
RESTAURANT_PHONE=079 706 39 66
RESTAURANT_ADDRESS=Av. William-Fraisse 1, 1006 Lausanne

# --- Payrexx (paiement en ligne) — optionnel ---
PAYREXX_INSTANCE=farmaciaangelucci
PAYREXX_API_SECRET=...

# --- Pushover (notifications tel) — optionnel ---
PUSHOVER_USER_KEY=...
PUSHOVER_API_TOKEN=...

# --- Optionnel ---
PUBLIC_SITE_URL=https://www.angeluccis.ch   # utilisé dans les emails et les redirects Payrexx
PORT=8001                                    # Infomaniak fournit process.env.PORT automatiquement, ce fallback ne sert qu'en dev local
```

## Lancement local

```bash
cd backend-node
npm install
npm start          # écoute sur PORT ou 8001 par défaut
```

## Déploiement Infomaniak

1. **MongoDB externe** — obligatoire car l'Hébergement Web mutualisé ne supporte pas MongoDB en local.
   - Le plus simple : **MongoDB Atlas gratuit** (cluster M0, 512 Mo — largement suffisant).
   - Créer un compte sur https://cloud.mongodb.com, créer un cluster gratuit, ajouter un utilisateur, whitelister `0.0.0.0/0` (accès public authentifié), copier l'URI `mongodb+srv://...`.

2. **Créer un Site Node.js chez Infomaniak** :
   - Manager Infomaniak → Hébergement 1 → Sites → Ajouter un site → **Type : Node.js**.
   - Version Node : **18 ou 20** (recommandé 20).
   - Racine du dossier : le contenu de `backend-node/`.
   - Fichier de démarrage : `server.js` (ou script `npm start`).
   - Port : Infomaniak fournit `process.env.PORT` automatiquement, le code l'utilise déjà.

3. **Uploader les fichiers** (FTP ou Git via l'espace Infomaniak) :
   - Tout le contenu de `/app/backend-node/` sauf `node_modules/`.
   - Après upload, exécuter `npm install` via SSH ou via l'interface Infomaniak.

4. **Configurer les variables d'environnement** dans le manager Infomaniak (Variables d'environnement du site Node.js) — copie/colle les valeurs de la section ci-dessus.

5. **Frontend** : dans `/app/frontend/.env` remplace `REACT_APP_BACKEND_URL` par l'URL du site Node.js Infomaniak (ex. `https://api.angeluccis.ch`). Puis `yarn build` et upload du dossier `build/` sur ton Hébergement Web comme site statique.

6. **Star mC-Print2 CloudPRNT** — mets à jour l'URL dans le portail cloud Star : `https://<ton-domaine-node>/api/cloudprnt/poll`.

## Notes techniques

- **Aucun changement de comportement** : mêmes routes, mêmes JSON, mêmes formats de tickets ESC/POS.
- **Base de données identique** : mêmes collections MongoDB (`settings`, `products`, `orders`, `reservations`, `categories`, `addon_groups`, `promo_codes`, `content_blocks`, `schedules`, `print_jobs`, `marketing_emails`, `login_attempts`, `uploads`).
- **Import direct** possible : dumpe ton MongoDB actuel avec `mongodump` et restaure-le sur Atlas avec `mongorestore`.
- **Images/uploads** : stockées en `Binary` dans la collection `uploads` (aucun disque local requis).
- **Pas d'externalisation** : aucun service tiers en plus des intégrations que tu utilises déjà.

## Endpoints exposés (60+)

Tous préfixés par `/api/`. Voir `server.js` pour la liste complète — auth, settings, content (CMS), theme, schedules, categories, addon-groups, products (CRUD + reorder + CSV import/export + upload), orders (+ Payrexx webhook + status + reprint), reservations, promos, marketing-emails, accounting/pdf, cloudprnt/poll (GET/POST/DELETE), admin/print-jobs.
