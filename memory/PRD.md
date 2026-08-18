# Angelucci's — Product Requirements

## Original problem statement
Full-stack website for Farmacia Angelucci (branded ANGELUCCI'S) — Italian restaurant + épicerie in Lausanne, Switzerland. Combines presentation (landing page), online takeaway/delivery ordering (restaurant menu + separate épicerie menu, épicerie orderable up to 2 weeks ahead), table reservation with auto-confirm + admin approval, and a hidden admin dashboard.

- Slogan: "la qualità a discapito della quantità"
- Colors: #7FA9A8 (sage/teal) + black
- Currency: CHF · VAT: 2.6% takeaway / 8.1% delivery
- Admin URL: `/Angel/dashboard`
- Owner: AngelCED26 · Staff: AnCED25
- Contact: Av. William-Fraisse 1, 1006 Lausanne · 079 706 39 66

## Stack
- Backend: FastAPI + MongoDB (motor async) + Resend (emails) + ReportLab (accounting PDF)
- Frontend: React + Tailwind + Shadcn UI + framer-motion + Cormorant Garamond / Manrope

## User Personas
- **Client site visitor** — browses landing, orders takeaway/delivery, books a table.
- **Owner** — full admin (orders, reservations, menu, hours, promos, marketing emails, accounting, settings).
- **Staff** — restricted admin (no marketing emails tab).

## Implemented (2026-02-XX — MVP)
- Landing page with hero, story, featured products, dual category (Restaurant/Épicerie), Google Maps, contact info
- Menu ordering flow (both menus) with mode picker (À emporter/Livraison + créneau ASAP or precise time; épicerie up to 14 days ahead), category sidebar, search, product modal with addon groups (radio/checkbox), qty selector, comment field, sticky cart, checkout modal (customer info, marketing opt-in, promo code, VAT-inclusive totals), order tracking page `/suivi/:id`
- Reservation page (Shadcn Calendar, 15-min time slots, honeypot anti-spam, rate-limit, 30-min lead time, auto-confirm), email confirmation
- Story page, Contact page with map
- Admin login (JWT, rate limit) → hidden `/Angel/dashboard` with tabs:
  - Orders (polling 8s, sound ping, filter by status, advance/delete, cliquable phone, highlighted créneau)
  - Reservations (confirm/cancel/done)
  - Menu (products CRUD + image upload, categories with reorder ↑↓, addon groups with options, CSV import, out-of-stock date with 1/2/3/7-day shortcuts)
  - Hours (3 schedules: restaurant / reservation / épicerie, per-day lunch+dinner, closed dates)
  - Promotions (percent/fixed/BOGO, min amount)
  - Marketing emails (owner only, export CSV, copy all)
  - Accounting (monthly PDF via ReportLab: CA brut/net, VAT breakdown, product qty ranking)
  - Settings (name, phone, email, address, VAT rates, toggles)
- Email templates via Resend (order confirmation, reservation confirmation to client, notification to restaurant) — RESEND_API_KEY empty by default (logs skipped)
- Pushover intentionally deferred (user request)

## Implemented (2026-02 — Temporary Vitrine Mode)
- Added `/app/frontend/src/config.js` with `TEMP_MODE` flag (currently `true`)
- When `TEMP_MODE=true`: only `/` (Landing) and `/Angel/*` (Admin) are accessible; all other paths redirect to `/` via App.js `<Navigate>`
- UI kept intact — Header nav, Footer nav+CTA, hero buttons "Commander" / "Réserver une table", category cards, etc. all look normal
- Clicking any link on the site silently redirects to the landing (no page ever loads besides landing + admin)
- Removed "· dal 1962" text from Landing hero
- Global contact email changed to `info@angeluccis.ch` (Footer fallback + backend seed default + updated existing DB settings doc)
- **Mobile responsive fix**: rewrote Landing hero (mobile shows centered logo → text → CTAs → image, no absolute-positioned overlap); scaled down all section paddings/typography for mobile; single-column stacked layouts; address+phone stacked
- To re-enable full site: flip `TEMP_MODE` to `false` in `/app/frontend/src/config.js`

## Implemented (2026-02 — SEO + favicon + test data + /reserver online)
- **Favicon** : logo Angelucci's utilisé comme favicon + apple-touch-icon (via URL customer-assets)
- **SEO complet** dans `/app/frontend/public/index.html` :
  - Title/description optimisés (« Restaurant italien & épicerie fine à Lausanne » + mots-clés géolocalisés)
  - Open Graph (og:type=restaurant.restaurant, og:image=logo, og:locale=fr_CH)
  - Twitter Card summary_large_image
  - Geo tags (geo.region=CH-VD, geo.position=46.5197;6.6323, geo.placename=Lausanne)
  - JSON-LD structured data : @Restaurant + @Store avec adresse Av. William-Fraisse 1, 1006 Lausanne, geo, telephone, hasMenu, servesCuisine, acceptsReservations
  - Canonical URL vers production
- **`/reserver` remis en ligne** (ajouté aux routes TEMP_MODE)
- **Test data seeded** (via /tmp/seed_test.py) :
  - Produit `CeTEST — Plat test` (Antipasti restaurant, CHF 12.50)
  - Produit `CeTEST — Produit test épicerie` (Fromages épicerie, CHF 8.90)
  - Commande `#CeTEST-0001` (restaurant, en attente de confirmation, CeTEST Test)
  - Réservation CeTEST Test (2026-07-20 à 19:30, 2 personnes, confirmed)
- Note : les changements sur `public/index.html` nécessitent un `supervisorctl restart frontend` pour être picked up par le dev server

## Implemented (2026-02 — Delivery removed + Cart/Checkout split + Admin actions)
- Delivery mode entirely removed — takeaway only; VAT always 2.6%
- `/commander` (restaurant) and `/epicerie` re-opened in TEMP_MODE
- **OrderModePicker refonte** : 10-min slots derived from schedule opening hours (lunch + dinner windows). ASAP button always on top. Today's slots visible below. "Programmer plus tard" reveals future days (1 day for restaurant, up to `epicerie_days_ahead` for épicerie — configurable in Admin › Paramètres, default 7). Mobile-first responsive (`w-[calc(100vw-2rem)]`, `max-h-[90vh]`).
- **ProductModal mobile fix** : compact image (h-40), reduced padding (p-5), sticky bottom action bar, no overflow
- **Cart page (`/panier`)** : validation-only, "Passer au paiement" navigates to `/checkout/:menuType`
- **Checkout page (`/checkout/:menuType`)** NEW : shows créneau card with "Changer l'heure" button (re-opens OrderModePicker), récap, customer form, "Confirmer la commande CHF X"
- **Sticky cart bar in Menu** simplified — "Voir le panier · CHF X" navigates to /panier (no more inline expand)
- **Admin Commandes** : "Avancer →" replaced by contextual "✓ Confirmer la commande" (new) / "Marquer prêt" (preparing) / "Terminer" (ready). Added "**Refuser**" button (sets status="rejected"). Added "**Repousser →**" link under créneau — opens RescheduleDialog with day+10min-slot picker. New "Refusée" filter and status.
- **Backend** : `PATCH /api/admin/orders/{id}/reschedule?pickup_time=...&pickup_time_label=...`. Added `rejected` to allowed status list. Added `epicerie_days_ahead` to settings (default 7).

## Implemented (2026-02 — Time-restricted categories + louder alarm + client tracking)
- **Category time restriction** (`Category.restricted_start_hour` + `restricted_end_hour`, both Optional[int] 0-23). Admin Menu > Catégories dialog: toggle "Restreindre les heures de commande" reveals 2 hour inputs. Backend `POST /api/orders` uses `ZoneInfo("Europe/Zurich")` to check current local hour; if any ordered product's category is inside the (potentially wrap-around midnight) window, returns 400 with clear FR message. Menu page shows per-category badge (`data-testid=cat-restrict-badge-{id}`) and disables product buttons during blocked window.
- **Alarm louder & every 10 s**: `usePing()` upgraded to square-wave 4-note @ 0.9 gain (was sine @ 0.25). `startAlarm()` interval 30 s → 10 s. Banner + ready-modal copy updated.
- **Client tracking page `/suivi/:id`**: polling 15 s → 8 s. Always-visible "Une question ? Appelez-nous" banner (`data-testid=contact-banner`). Urgent red pulsing callout (`data-testid=urgent-callout`) appears ONLY when `status=new` AND `created_at > 2 min` ago. New `rejected` status handled with dedicated red block.
- **Email tracking link**: order confirmation email now embeds a "SUIVRE MA COMMANDE →" CTA linking to `{PUBLIC_SITE_URL}/suivi/{id}`. `PUBLIC_SITE_URL` set to production host in `backend/.env`.

## Implemented (2026-02 — Landing cleanup + bulk category assignment)
- **Removed "Plats phares"** section from Landing page (`/app/frontend/src/pages/Landing.jsx`). Homepage now flows Hero → Story teaser → Categories dual (Ristorante/Épicerie) → Location → Contact.
- **Bulk category change** in Admin > Menu > Produits : new dropdown "Changer catégorie…" in the bulk actions bar (`data-testid="bulk-cat-select"` + `bulk-cat-apply`). Applies the target category to every selected product in one click.
- **Select-all-filtered** button (`data-testid="select-all-filtered"`) next to the search field. Selects (or deselects) every product currently visible after the menu-type + category + search filters. Enables "select all in a category" flow: pick a category in the filter → click "Sélectionner N" → change category / add tag / delete.

## Implemented (2026-02 — Safer deletes + full tag creation dialog)
- **Removed "Sélectionner N" quick-select-all button** from Admin > Menu > Produits (prevents the 2-click "select all → delete all" chain).
- **Delete confirmation modal** (`data-testid="confirm-delete-dialog"`) replaces browser `window.confirm` for both single-product delete (with product name shown) and bulk-delete-selected (with count). Cancel-safe by default, red "Oui, supprimer" CTA.
- **"Nouvelle étiquette" button** (`data-testid="new-tag-btn"`) added to Admin > Menu > Produits header (right of "Nouveau produit"). Opens a dedicated dialog with: tag name input, menu filter (Tous/Restaurant/Épicerie), product search, product multi-select list. "Créer & appliquer" in one action. Validated bout-en-bout: created "sans-gluten", applied to 2 products, chip appears in QuickTagPanel and OOS panel automatically.

- **Panel "Ajouter une étiquette rapide"** (`data-testid=quick-tag-panel`) placé à droite de "Rupture par étiquette" dans Admin > Menu > Produits. Affiche toutes les étiquettes existantes en chips cliquables (`+jambon (2)`). Un clic sur un chip = ajout instantané aux produits cochés. Un input avec bouton "Créer & appliquer" permet de créer une nouvelle étiquette (ex : "jambon") et de l'appliquer aux produits cochés en un seul geste. Validé bout-en-bout : création de "jambon", appliqué sur 2 produits, chip apparaît immédiatement dans les 2 panels.
- **SEO** : ajout de `/robots.txt` (Allow public routes, Disallow /Angel /panier /checkout /suivi), de `/sitemap.xml` (6 URLs prioritaires), et de `openingHoursSpecification` dans le JSON-LD Restaurant. Meta tags Open Graph, Twitter Card, JSON-LD Restaurant+Store, geo tags déjà en place dans `index.html`. Deux fichiers publics accessibles publiquement (`curl 200 OK`).
- **Guide de déploiement portable** : `/app/DEPLOYMENT.md` — inventaire complet des variables d'env, exemples `docker-compose.yml` + `Dockerfile` backend/frontend + `nginx.conf`, options mutualisé (Hostinger/OVH) vs VPS, migration MongoDB. Aucune modification de code nécessaire pour partir sur un autre hébergeur, tout passe par les env vars.
- **Bug résolu** : après commande, l'utilisateur était renvoyé vers `/commander` (ou `/epicerie`) au lieu de `/suivi/{id}`. Cause : dans `Checkout.jsx`, un `useEffect` de garde-fou détectait le panier vidé (`clearCart`) et redirigeait immédiatement vers le menu, écrasant `nav('/suivi/{id}', {replace:true})`. Ajout d'un flag `submitted` qui neutralise ce garde-fou pendant la soumission. Validé bout-en-bout via Playwright pour Restaurant (#A260815-3955) et Épicerie (order 3d8da4f9-...).
- **Continuous 5-min siren alarm** (Uber Eats-style): `usePing()` now emits an 8-tone 2-second high/low square-wave burst at gain=1.0. `startAlarm()` re-fires every 3 s for 5 min. Auto-resumes `AudioContext` if suspended (idle tab).
- **Reservation Pushover + admin alarm**: `POST /api/reservations` now sends a Pushover EMERGENCY (priority=2 retry=30 expire=360 sound=siren). New reservations get a `seen_by_admin=false` flag; admin Réservations tab shows red pulsing banner + siren until admin clicks `✓ Vue`, `Confirmer`, `Terminée` or `Annuler`. Backend endpoints: `PATCH /admin/reservations/{id}/seen` and `PATCH /admin/reservations/{id}/status` (both mark seen).
- **First-order/reservation alarm bug FIX**: replaced `lastIdsRef.current.size > 0` guard with `initializedRef` in both OrdersTab and ReservationsTab. Alarm now fires (a) on the very first new record after mount and (b) also if the initial load already has pending items.
- **Checkout auto-redirect** made robust: `nav('/suivi/{id}', {replace: true})` so the back button doesn't return to the checkout page.

## Backlog / Next
- P1: Stripe online payment (currently paiement sur place)
- P1: Real Resend API key hookup
- P2: Notify customer by email on reject/reschedule
- P2: Multi-language (IT/EN)
- P2: Receipt printer integration (waiting on user for printer specs)

## Implemented (2026-02 — Admin alarm + Pushover emergency + Wake Lock + mobile admin)
- **Backend Pushover EMERGENCY** on every new order (`POST /api/orders`): priority=2, retry=30, expire=360, sound=`siren` (loud) — retries every 30 s during 6 min until acknowledged in Pushover app.
- **Frontend continuous alarm loop** in Admin Orders tab (`/app/frontend/src/pages/Admin.jsx`): on new order detection, `ping.play()` fires immediately and then every 30 s during 6 min. Auto-stops when admin confirms/rejects all "new" orders OR after 6 min timeout. Visible pulsing alarm banner (`data-testid="alarm-banner"`) with a "🔕 Arrêter l'alarme" button (`data-testid="stop-alarm"`).
- **Ready modal on Admin landing** (`data-testid="ready-modal"`): asks admin to activate sound + Wake Lock (anti-veille) in a single click. Uses `navigator.wakeLock.request("screen")` to keep the screen on. Auto re-acquires wake lock on `visibilitychange`. Dismissable per session via `sessionStorage`.
- **Mobile-responsive Admin dashboard**: header collapses (icon-only sound button on mobile, username hidden), tabs scroll horizontally, orders grid switches to 1-col on mobile, section padding scales (`px-3 sm:px-6`).
- **Multi-select bulk actions** in Menu tab: checkboxes on each product row, bulk-tag-add (dropdown selector), bulk-delete confirmation.
