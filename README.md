# zimFDMS

**ZIMRA fiscalisation, without the headache.**

`zimFDMS` is a bridge service that connects Zimbabwean POS systems, e-commerce
stores and accounting apps to ZIMRA's Fiscal Device Management System (FDMS).
You send a sale, we handle the signature math, certificate management, fiscal
day state machine, retries and QR-coded ticketing — fully compliant with the
**ZIMRA Fiscal Device Gateway API v7.2** spec.

> Sibling to [ManishaPay](https://pay.aizim.co.zw) (PayNow payments).
> Both solve a single problem: making ZIMRA-mandated infrastructure
> trivial to integrate for Zimbabwean businesses.

---

## Three surfaces

| Audience | Where they go | What they get |
| --- | --- | --- |
| **Business owners** | `/signup` → `/dashboard` | Connect their ZIMRA device once, then their POS auto-fiscalises every sale. WordPress plugin for WooCommerce stores coming. |
| **Developers** | `/docs` + npm / Composer packages | One REST endpoint replaces nine ZIMRA endpoints. Webhooks. Sandbox keys. |
| **Curious anyone** | `/sandbox` + `/how-it-works` | Interactive in-browser FDMS lifecycle, plain-English explainer, no signup. |

---

## Stack

- **React 19** + **Vite** + **Tailwind v4** + **Framer Motion**
- **Supabase** for auth (phone+password), data and RLS-scoped tenancy
- **Browser-native Web Crypto** for the spec-section-13 signature math
- **In-browser mock FDMS** in `src/lib/fdms/mockBackend.js` for sandbox mode
- **Netlify** for hosting

No server / Netlify Functions in this phase — the mock FDMS lives in the
browser. When ZIMRA credentials are provided, a thin Netlify Function will
proxy real calls (planned, not in this build).

---

## Local development

```bash
cp .env.example .env.local      # paste Supabase URL + anon key
npm install
npm run dev                     # http://localhost:5180
```

### Supabase setup

1. Run `supabase/install.sql` in the Supabase SQL Editor. Idempotent.
2. Create the admin auth user manually:
   - **Auth → Users → Add user**
   - email: `admin@zimfdms.local`
   - password: `1975` (PIN — change later from the admin UI)
   - auto-confirm: yes
3. Link the auth user to a merchant row marked admin (SQL inside `install.sql`).

### Routes overview

```
Public (PublicLayout)
  /                landing
  /how-it-works    plain-English FDMS explainer
  /sandbox         interactive in-browser lifecycle (no signup)
  /docs            API + SDK docs
  /pricing         tiers

Auth (no layout)
  /signup          phone + password merchant signup
  /login           merchant sign-in

Merchant (MerchantRoute + DashboardLayout)
  /dashboard               overview
  /dashboard/receipts      list
  /dashboard/fiscal-day    current state + Z reports
  /dashboard/api-keys      manage keys
  /dashboard/webhooks      delivery URLs
  /dashboard/settings      business details

Super-admin (AdminRoute + AdminLayout)
  /admin/login             PIN-only
  /admin                   platform overview
  /admin/merchants         all merchants
  /admin/settings          paste ZIMRA device credentials here
```

---

## What's done

- [x] Project scaffold (Vite, Tailwind v4 with ZIMRA-inspired palette)
- [x] Supabase schema (`fdms_*` tables, RLS, admin helper)
- [x] FDMS SDK module (`src/lib/fdms/*`) — spec-correct signature math + in-browser mock
- [x] Spec test vectors from page 73 (`src/lib/fdms/testVectors.js`)
- [x] Public landing + How It Works + Sandbox + Docs + Pricing pages
- [x] Merchant auth flow (phone + password) + dashboard skeleton
- [x] Super-admin PIN login + platform settings page

## What's coming

- [ ] Real ZIMRA proxy via Netlify Function
- [ ] npm package (`zimfdms`) and PHP Composer package
- [ ] WordPress / WooCommerce plugin
- [ ] Webhook delivery + retries
- [ ] SMS verification on signup (via Twilio or ZW SMS gateway)

---

## License

Proprietary. © Noby Tebulo — [nobie.netlify.app](https://nobie.netlify.app)
