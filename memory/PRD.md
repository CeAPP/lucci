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
- When `TEMP_MODE=true`: only `/` (Landing) and `/Angel/*` (Admin) are accessible; all other paths redirect to `/`
- Header: navigation hidden, replaced by "Bientôt disponible" badge (no mobile menu)
- Landing hero: "Commander" and "Réserver une table" buttons rendered as disabled visual pills
- Landing sections: "Voir toute la carte" link, "Lire la suite" (story), "Confirmation immédiate" and dual category cards (Ristorante/Épicerie) all rendered as non-clickable divs with "Bientôt disponible" label
- Footer: nav column removed, "Commander" CTA removed, replaced by "Commande en ligne — bientôt disponible" text
- Removed "· dal 1962" text from Landing hero
- Global contact email changed to `info@angeluccis.ch` (Footer fallback + backend seed default + updated existing DB settings doc)
- To re-enable full site: flip `TEMP_MODE` to `false` in `/app/frontend/src/config.js`

## Backlog / Next
- P1: Seed 5 real restaurant + 5 real épicerie products with `featured` flag for landing "Plats phares" (skipped for now — user to provide real names/prices)
- P1: Stripe online payment (currently paiement sur place)
- P1: Pushover push notifications (waiting on user)
- P1: Real Resend API key hookup
- P2: Delivery zone/fee configuration
- P2: Client account with order history
- P2: Multi-language (IT/EN)
