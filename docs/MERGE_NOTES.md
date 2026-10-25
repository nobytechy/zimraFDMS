# Merge & test notes — FDMS bridge (`server-core`)

## What this branch adds
* `zimfdms-server/` — ZIMRA FDMS v7.2 core (signing, counters, QR, validation, mTLS client, device lifecycle), Postgres store, HTTP API, and a local FDMS **simulator**. `cd zimfdms-server && npm ci && npm test` → 41 tests.
* `netlify/functions/fdms.mjs` — serves the API at `/api/fdms/*`.
* `supabase/migrations/010_bridge.sql` — bridge tables (`bridge_*`, server-write-only), security fixes, new verify RPC.
* App: sign up / log in / dashboard are **always on** (no `VITE_ACCOUNTS_ENABLED` needed). New: Dashboard → **Device** (connect wizard), real fiscal day, sales, receipts search with date range.

## Steps to go live on a test site
1. Supabase SQL editor: run `supabase/install.sql` (if new), `009`, then **`010_bridge.sql`**.
2. Netlify env vars: see `.env.example` (server section). Generate `FDMS_MASTER_KEY` once and **back it up** — losing it makes stored device keys unreadable.
3. Create the admin user with a strong password (see README) — the old PIN `1975` must not be used anywhere.
4. Deploy. Sign up → Dashboard → Device → enter the merchant's own Device ID, serial, activation key, **Test** → confirm business → Open day → New sale.

## First run against ZIMRA's test system — items only ZIMRA can settle
Each is a one-line switch (`zimfdms-server/README.md`):
1. URL paths / HTTP verbs in `src/core/routes.js` (the PDF omits them; check Swagger).
2. Signature hash separator (`''` vs `' '`) — spec examples disagree.
3. ECDSA signature encoding (`ieee-p1363` vs `der`).
4. QR MD5 input (bytes vs hex text).
5. Fiscal-day counter ordering.
6. `FDMS_MODEL_NAME/VERSION` must be a model registered with ZIMRA, else DEV04–06.
7. Item HS code: the test sale uses placeholder `99001000`; real items need their own HS codes.

## Known gaps (not built)
* API keys / webhooks pages are still UI-only (no server behind them yet) — POS integration by API key is the next step.
* Credit notes need the "original receipt" lookup hook; the API does not expose credit notes from the UI yet.
* Offline-mode devices: file building/upload is implemented and simulator-tested, but there is no UI for it.
* Server auth uses Supabase JWT → merchant row; add rate limiting at Netlify/edge before going Live.
* Supabase transaction pooler (6543) breaks the per-device advisory lock — use port 5432.
