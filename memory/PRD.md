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

## Backlog / Next
- P1: Seed 5 real restaurant + 5 real épicerie products with `featured` flag for landing "Plats phares" (skipped for now — user to provide real names/prices)
- P1: Stripe online payment (currently paiement sur place)
- P1: Pushover push notifications (waiting on user)
- P1: Real Resend API key hookup
- P2: Notify customer by email on reject/reschedule
- P2: Multi-language (IT/EN)
