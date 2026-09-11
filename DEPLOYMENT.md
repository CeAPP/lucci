# Angelucci's — Guide de déploiement portable

Ce projet peut être déployé chez n'importe quel hébergeur (Hostinger, OVH, Infomaniak, VPS, DigitalOcean, Railway, Fly.io, Render, etc.) sans modifier le code, uniquement via des variables d'environnement.

## Architecture

```
┌────────────────┐   HTTPS   ┌────────────────┐   TCP   ┌────────────────┐
│   Frontend     │  ────▶   │   Backend      │  ────▶  │   MongoDB      │
│   React (nginx)│           │   FastAPI      │          │   (n'importe   │
│   Build statique│           │   Uvicorn      │          │    quel Mongo) │
└────────────────┘           └────────────────┘          └────────────────┘
```

- **Frontend** : Build React statique (HTML/JS/CSS) servi par n'importe quel serveur web (nginx, Caddy, Apache, Netlify, Vercel…)
- **Backend** : FastAPI Python — un seul processus Uvicorn sur le port 8001 (configurable)
- **Base de données** : MongoDB (Atlas gratuit ou instance auto-hébergée)

## Variables d'environnement à définir

### Backend (`backend/.env`)

| Variable                | Obligatoire | Exemple                                        | Description                              |
|-------------------------|-------------|------------------------------------------------|------------------------------------------|
| `MONGO_URL`             | ✅           | `mongodb://user:pass@host:27017`               | URL de connexion MongoDB                 |
| `DB_NAME`               | ✅           | `angelucci_prod`                               | Nom de la base                           |
| `JWT_SECRET`            | ✅           | Chaîne aléatoire 64 char                       | Secret pour signer les tokens admin      |
| `ADMIN_USERNAME`        | ✅           | `owner`                                        | Login admin par défaut                   |
| `ADMIN_PASSWORD`        | ✅           | Mot de passe fort                              | Mdp admin par défaut                     |
| `STAFF_USERNAME`        | 🟠           | `staff`                                        | Login staff secondaire                   |
| `STAFF_PASSWORD`        | 🟠           | Mot de passe fort                              | Mdp staff secondaire                     |
| `RESTAURANT_PHONE`      | 🟠           | `+41 79 706 39 66`                             | Téléphone affiché dans emails + site     |
| `RESTAURANT_NAME`       | 🟠           | `Farmacia Angelucci`                           | Nom affiché dans emails                  |
| `RESTAURANT_ADDRESS`    | 🟠           | `Av. William-Fraisse 1, Lausanne`              | Adresse dans les emails                  |
| `RESTAURANT_EMAIL`      | 🟠           | `toni@angeluccis.com`                          | Reçoit les notifs "nouvelle commande"    |
| `PUBLIC_SITE_URL`       | 🟠           | `https://mon-domaine.ch`                       | URL utilisée dans les liens de suivi     |
| `RESEND_API_KEY`        | 🟠           | `re_j577…`                                     | Clé Resend pour envoyer les emails       |
| `SENDER_EMAIL`          | 🟠           | `Angelucci's <noreply@ton-domaine.ch>`         | Expéditeur des emails (nécessite un domaine vérifié sur resend.com/domains) |
| `PUSHOVER_USER_KEY`     | 🟠           | Clé user Pushover                              | Notifications push admin                 |
| `PUSHOVER_API_TOKEN`    | 🟠           | Token application Pushover                     | Notifications push admin                 |
| `PAYREXX_INSTANCE`      | 🟠           | `farmaciaangelucci`                            | Nom d'instance Payrexx (paiement)        |
| `PAYREXX_API_SECRET`    | 🟠           | `8XVC…`                                        | API Secret Payrexx (paiement)            |
| `EMERGENT_LLM_KEY`      | ⬜           | `sk-emergent-…`                                | (non utilisé actuellement)               |
| `CORS_ORIGINS`          | ⬜           | `*` ou `https://mon-domaine.ch`                | CORS (`*` par défaut, à restreindre en prod) |

### Frontend (`frontend/.env`)

| Variable                    | Obligatoire | Exemple                        | Description                        |
|-----------------------------|-------------|--------------------------------|------------------------------------|
| `REACT_APP_BACKEND_URL`     | ✅           | `https://api.mon-domaine.ch`   | URL publique du backend            |

## Déploiement le plus simple : Docker Compose

Crée un fichier `docker-compose.yml` à la racine du projet :

```yaml
version: "3.9"
services:
  mongo:
    image: mongo:7
    restart: always
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: change-me
    # Ne pas exposer publiquement — accessible uniquement via le réseau interne
    expose:
      - "27017"

  backend:
    build: ./backend
    restart: always
    depends_on: [mongo]
    environment:
      MONGO_URL: "mongodb://admin:change-me@mongo:27017"
      DB_NAME: angelucci_prod
      JWT_SECRET: "REMPLACE-MOI-64-CARACTERES-ALEATOIRES"
      ADMIN_USERNAME: AngelCED26
      ADMIN_PASSWORD: "MotDePasseFort"
      RESTAURANT_PHONE: "+41 79 706 39 66"
      PUBLIC_SITE_URL: "https://mon-domaine.ch"
    expose:
      - "8001"

  frontend:
    build:
      context: ./frontend
      args:
        REACT_APP_BACKEND_URL: "https://mon-domaine.ch"
    restart: always
    ports:
      - "80:80"
      - "443:443"
    # Le nginx interne s'occupe du reverse-proxy /api → backend:8001

volumes:
  mongo_data:
```

Il te faut aussi :

**`backend/Dockerfile`**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

**`frontend/Dockerfile`**
```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# Runtime stage — nginx qui sert le build + reverse-proxy /api
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`frontend/nginx.conf`**
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Proxy toutes les requêtes /api/* vers le backend
    location /api/ {
        proxy_pass http://backend:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA : toute route inconnue retourne index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Puis :
```bash
docker-compose up -d --build
```

Ton site est en ligne sur le port 80 de la machine. Ajoute Caddy ou Traefik devant pour HTTPS automatique (Let's Encrypt).

## Déploiement sur hébergeur mutualisé (Hostinger, OVH…)

La plupart des hébergeurs mutualisés ne supportent pas Python + MongoDB. Options :

### Option A — Split hosting (recommandé)
- **Frontend** sur ton hébergeur mutualisé : lance `yarn build` puis upload le dossier `frontend/build/` dans `public_html/`. Le `.htaccess` suivant est nécessaire pour le routing SPA :

  ```apache
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
  ```

- **Backend + MongoDB** sur un VPS (5 €/mois chez Hetzner, DigitalOcean) OU sur un service serverless (Railway.app, Fly.io, Render.com) OU sur MongoDB Atlas (gratuit) + Railway (5 $/mois).
- Renseigne `REACT_APP_BACKEND_URL` avec l'URL publique du backend AVANT de builder le frontend.

### Option B — VPS complet
Loue un VPS (Hetzner CX11, ~3.30 €/mois) et déploie avec `docker-compose up -d`. Utilise **Caddy** en frontal pour HTTPS auto :

```
mon-domaine.ch {
    reverse_proxy frontend:80
}
```

## Migration des données depuis Emergent

Pour exporter les données MongoDB actuelles :
```bash
mongodump --uri="$MONGO_URL_ACTUEL" --db=$DB_NAME_ACTUEL --archive=angelucci.dump
```

Pour les restaurer chez toi :
```bash
mongorestore --uri="$MONGO_URL_NOUVEAU" --archive=angelucci.dump --nsFrom="ancien.*" --nsTo="nouveau.*"
```

## Aucun changement de code nécessaire

Toutes les URLs, credentials, et intégrations (Pushover, Resend, Payrexx, MongoDB) passent uniquement par les variables d'environnement.
Le seul fichier qui contient l'URL publique en dur est `frontend/public/index.html` (canonical, OG tags, JSON-LD, sitemap) — **remplace** simplement `pizzeria-app-26.emergent.host` par ton domaine partout dans ce fichier + dans `robots.txt` et `sitemap.xml`.

Recherche/remplace global :
```bash
sed -i 's|pizzeria-app-26.emergent.host|mon-domaine.ch|g' \
    frontend/public/index.html \
    frontend/public/robots.txt \
    frontend/public/sitemap.xml
```

C'est tout — le code React et Python n'a besoin d'aucune modification.

## Check-list avant mise en ligne

- [ ] `JWT_SECRET` unique et aléatoire (64 caractères)
- [ ] `ADMIN_PASSWORD` fort
- [ ] `PUBLIC_SITE_URL` pointe vers le vrai domaine
- [ ] `CORS_ORIGINS` restreint au domaine (pas `*`)
- [ ] MongoDB accessible uniquement par le backend (pas d'exposition publique)
- [ ] HTTPS activé (Caddy, Let's Encrypt, Cloudflare…)
- [ ] `RESEND_API_KEY` renseigné + domaine vérifié sur `resend.com/domains`
- [ ] `SENDER_EMAIL` utilise une adresse `@` de ce domaine vérifié
- [ ] `PUSHOVER_*` renseignés pour les notifications urgentes
- [ ] `PAYREXX_*` renseignés + au moins un PSP (Twint/CB) activé sur le compte Payrexx
- [ ] Webhook Payrexx configuré dans le back-office Payrexx : `{PUBLIC_SITE_URL}/api/webhooks/payrexx`
- [ ] Site testé : commande restaurant + épicerie + réservation + paiement en ligne + réception email
