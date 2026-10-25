# zimfdms-server

Server-side ZIMRA FDMS v7.2 core + a faithful local simulator. Node ≥ 20, one dependency (`@peculiar/x509`, for CSR/certs).

```
npm install
npm test        # 29 tests: spec vectors + full register→sell→close over real mTLS
npm run sim     # local FDMS on https://127.0.0.1:8443  (device 1042 · SN0001 · key ABCD1234)
```

## What's here
| Path | What |
|---|---|
| `src/core/signing.js` | §13 hashes/signatures (receipt, fiscal day, FDMS verification), ECDSA/RSA |
| `src/core/receipt.js` | Receipt builder (per-group tax, discounts, credit notes) + §6 counters |
| `src/core/validate.js` | RCPT010–048 with Grey/Yellow/Red; used as client pre-flight and by the simulator |
| `src/core/qr.js` | §11 QR (padded IDs, ddMMyyyy, MD5) |
| `src/core/csr.js` · `secrets.js` | Device key + CSR (`CN=ZIMRA-<serial>-<10-digit id>`); AES-GCM sealing of keys |
| `src/core/client.js` · `routes.js` | mTLS HTTP client; mandatory `DeviceModelName/VersionNo` headers; **all URL paths in routes.js** |
| `src/core/device.js` | **DeviceService** — connect → register → openDay → sell → closeDay, queue/flush, offline files, cert renewal |
| `src/core/store.js` | Store contract + in-memory impl. Implement the same 3 methods on Supabase (`db/schema_v2.sql`) |
| `src/sim/*` | Simulator: mTLS, state machine, validation colours, idempotency, offline file processing |

## Going live with a merchant's real credentials
1. `svc.connect({deviceID, serialNo, activationKey, baseUrl, env})` → show returned taxpayer for the merchant to confirm.
2. `svc.register(deviceID)` → key + CSR generated **on the server**, certificate stored, config loaded.
3. `openDay` → `sell` … → `closeDay`. Point `baseUrl` at `https://fdmsapitest.zimra.co.zw` first, `https://fdmsapi.zimra.co.zw` after.
4. Drop `ca` (the simulator CA) — real ZIMRA uses a public TLS cert.

## OPEN ITEMS — only the ZIMRA test environment can settle these (each is one option, not a rewrite)
1. **URL paths / HTTP verbs** — PDF doesn't give them. Edit `src/core/routes.js` from `swagger.json`.
2. **Hash separator** — spec §13.1 says none (default). Two printed examples only reproduce with `' '` (`signOpts.separator`). Symptom if wrong: every receipt Red `RCPT020`.
3. **ECDSA encoding** — raw r‖s (default) vs DER (`signOpts.ecdsaEncoding`). Same symptom.
4. **QR MD5 input** — signature bytes (default) vs their hex text (`qrOpts.md5Input`). Verify with receipt.zimra.org.
5. **Fiscal-day counter order** — spec text says currency-alphabetical; its printed example isn't. Implemented per text (`sortCounters`). Symptom: `BadCertificateSignature` on close.
6. Whether ZIMRA accepts our `DeviceModelName/Version` (must be registered with them).

## Not built yet
`getStockList`, users-management endpoints, Receipt48/InvoiceA4 and Z-report renderers (§10), credit-note original lookup against your DB (hook: `input.findOriginal`), Supabase store implementation, HTTP API / merchant UI wiring.
