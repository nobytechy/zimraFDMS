import { Link } from 'react-router-dom'
import { Code2, BookOpen, Webhook, KeyRound, Terminal, ShieldCheck } from 'lucide-react'
import IntegrateCTA from '@/components/IntegrateCTA'

export default function Docs() {
  return (
    <div>
      <section className="hero-grad">
        <div className="container-page py-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Documentation</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zim-ink-900 md:text-4xl">zimFDMS API — quick reference</h1>
          <p className="mt-3 max-w-2xl text-zim-ink-600">
            One REST endpoint instead of nine. Authenticate with your merchant API key, send a receipt, get back a signed reply with a QR code URL.
          </p>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside>
            <nav className="sticky top-24 space-y-1 text-sm">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 rounded-md px-3 py-2 text-zim-ink-600 hover:bg-zim-ink-100 hover:text-zim-ink-900">
                  <s.icon size={14}/> {s.title}
                </a>
              ))}
            </nav>
          </aside>
          <article className="prose prose-slate max-w-none">
            <Section id="getting-started" title="Getting started">
              <ol>
                <li>The hosted API is in <strong>private preview</strong> — <a href="#integrate">get in touch</a> for early access and an API key.</li>
                <li>Use your key as a Bearer token on every request.</li>
                <li>Meanwhile, walk the whole lifecycle in the <Link to="/sandbox">interactive sandbox</Link> — no signup, no ZIMRA account needed.</li>
              </ol>
              <pre><code>{`curl https://api.zimfdms.co.zw/v1/ping \\
  -H 'Authorization: Bearer zfd_live_xxxxxxxxxxxxxxxx'`}</code></pre>
              <p className="rounded-lg border border-zim-gold-300 bg-zim-gold-50 px-4 py-3 text-sm text-zim-ink-700">
                <strong>Heads up —</strong> the hosted zimFDMS API is currently in <strong>private preview</strong>.
                Want early access, or fiscalisation built into your own system? <a href="#integrate">Get in touch</a> and
                we’ll set you up.
              </p>
            </Section>

            <Section id="zimra-api" title="The ZIMRA FDMS API v7.2 — how it really works">
              <p>
                Under the hood, ZIMRA’s <strong>Fiscal Device Gateway API (spec v7.2)</strong> is a set of REST/JSON
                endpoints every fiscal device must speak. It’s powerful but strict — zimFDMS exists so you never have
                to implement it yourself. Here’s the whole picture in plain English.
              </p>

              <h3>Before you can send a single receipt</h3>
              <ol>
                <li>The taxpayer registers (or updates) the device on the <strong>ZIMRA taxpayer portal</strong> and
                  receives a <strong>Device ID</strong> and an 8-character <strong>Activation Key</strong>.</li>
                <li>The device generates a <strong>certificate signing request (CSR)</strong> — ECDSA
                  <code> secp256r1</code> (NIST P-256, recommended) or RSA 2048. The certificate’s common name must be
                  <code> ZIMRA-&lt;serialNo&gt;-&lt;10-digit deviceId&gt;</code>.</li>
                <li>It calls <code>registerDevice</code> with that CSR + activation key and gets back an X.509
                  certificate — used to authenticate every call after this (mutual TLS).</li>
              </ol>

              <h3>Every request carries two headers</h3>
              <ul>
                <li><code>DeviceModelName</code> — the model name as registered with ZIMRA</li>
                <li><code>DeviceModelVersionNo</code> — the model version number</li>
              </ul>

              <h3>The endpoints (grouped)</h3>
              <p><strong>Registration &amp; configuration</strong></p>
              <ul>
                <li><code>verifyTaxpayerInformation</code> — confirm the taxpayer <em>before</em> registering (no cert needed)</li>
                <li><code>registerDevice</code> — submit the CSR, get the device certificate (once-off)</li>
                <li><code>issueCertificate</code> — renew the certificate before it expires</li>
                <li><code>getConfig</code> — pull device config: operating mode, applicable tax rates, max fiscal-day hours, the QR URL, certificate validity</li>
                <li><code>getStatus</code> — current device &amp; fiscal-day status</li>
              </ul>
              <p><strong>Trading — the daily cycle</strong></p>
              <ul>
                <li><code>openDay</code> — open a fiscal day (only when the previous one is <code>FiscalDayClosed</code>; the day number increments by one)</li>
                <li><code>submitReceipt</code> — submit each fiscal invoice / credit / debit note, <strong>device-signed</strong>; FDMS counter-signs and returns its own signature + QR data</li>
                <li><code>closeDay</code> — close the day with summary counters. Processing is asynchronous → <code>FiscalDayClosed</code> or <code>FiscalDayCloseFailed</code> (correct &amp; resubmit)</li>
              </ul>
              <p><strong>Offline mode &amp; utilities</strong></p>
              <ul>
                <li><code>submitFile</code> / <code>getFileStatus</code> — batch-upload receipts &amp; day reports as a file when the connection returns</li>
                <li><code>getServerCertificate</code>, <code>ping</code>, and the user-management endpoints</li>
              </ul>

              <h3>Two communication modes</h3>
              <ul>
                <li><strong>Online</strong> — each sale submits in real time; internet is required to close the day.</li>
                <li><strong>Offline</strong> — receipts are stored on-device and sent later via <code>submitFile</code>.</li>
              </ul>

              <h3>Two signatures you’ll hear about</h3>
              <ul>
                <li><strong>Device signature</strong> — the receipt fields concatenated in a fixed order, SHA-256 hashed and signed with the device’s private key <em>before</em> submission. This becomes the QR on the printed receipt.</li>
                <li><strong>FDMS signature</strong> — ZIMRA’s counter-signature after it accepts the receipt.</li>
              </ul>

              <p className="rounded-lg border border-zim-ink-200 bg-zim-ink-50 px-4 py-3 text-sm text-zim-ink-700">
                zimFDMS collapses <em>all</em> of the above — CSR &amp; certificate lifecycle, the fiscal-day state
                machine, the signature math, retries, offline files and QR generation — into the single{' '}
                <code>POST /v1/receipts</code> call above. Prefer the deep dive?{' '}
                <Link to="/how-it-works">See the interactive lifecycle →</Link>
              </p>
            </Section>

            <Section id="submit-receipt" title="POST /v1/receipts">
              <p>Submit a sale to ZIMRA. The endpoint accepts a flat JSON body — we calculate fiscal counters, sign the receipt, and return the FDMS-signed result with a QR URL.</p>
              <pre><code>{`POST https://api.zimfdms.co.zw/v1/receipts
Authorization: Bearer zfd_live_xxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "receiptType": "FiscalInvoice",
  "receiptCurrency": "USD",
  "invoiceNo": "INV-00134",
  "buyer": { "buyerRegisterName": "Tendai Moyo", "buyerTIN": "1234567890" },
  "lines": [
    { "name": "Coca-Cola 500ml", "quantity": 2, "price": 1.20, "taxID": 1 },
    { "name": "Beef pie",        "quantity": 1, "price": 2.50, "taxID": 1 }
  ],
  "payments": [{ "type": "Cash", "amount": 4.90 }]
}`}</code></pre>
              <p>Response:</p>
              <pre><code>{`{
  "receiptId": 1000045,
  "receiptGlobalNo": 134,
  "fdmsSignature": { "hash": "...", "signature": "..." },
  "qrUrl": "https://invoice-verification.zimra.co.zw/1042/20260520/0000000134/aBcD...",
  "fiscalDayNo": 142,
  "status": "accepted"
}`}</code></pre>
            </Section>

            <Section id="fiscal-day" title="Fiscal day endpoints">
              <p>zimFDMS opens and closes fiscal days automatically. You only need to call these if you want manual control.</p>
              <ul>
                <li><code>POST /v1/fiscal-day/open</code> — open the current day</li>
                <li><code>POST /v1/fiscal-day/close</code> — close + emit Z report</li>
                <li><code>GET  /v1/fiscal-day/current</code> — current day status + counters</li>
                <li><code>GET  /v1/fiscal-day/:id/z-report</code> — full Z report (JSON or PDF)</li>
              </ul>
            </Section>

            <Section id="webhooks" title="Webhooks">
              <p>Configure a webhook URL in <code>Dashboard → Webhooks</code>. We POST signed JSON to it on these events:</p>
              <ul>
                <li><code>receipt.submitted</code></li>
                <li><code>receipt.accepted</code></li>
                <li><code>receipt.failed</code></li>
                <li><code>fiscal_day.opened</code></li>
                <li><code>fiscal_day.closed</code></li>
              </ul>
              <p>Each delivery includes an <code>X-zimFDMS-Signature</code> header — HMAC-SHA256 of the body, signed with your webhook secret.</p>
            </Section>

            <Section id="sdks" title="SDKs">
              <ul>
                <li><strong>Node:</strong> <code>npm install zimfdms</code> (coming soon)</li>
                <li><strong>PHP:</strong> <code>composer require zimfdms/php</code> (coming soon)</li>
                <li><strong>WordPress / WooCommerce plugin</strong> — drop in, configure once, every order fiscalises (coming soon)</li>
              </ul>
            </Section>

            <Section id="errors" title="Errors">
              <p>Every error returns a JSON body shaped <code>{`{ code, message, details? }`}</code> with a matching HTTP status.</p>
              <table>
                <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td>DEV01</td><td>Device not active</td></tr>
                  <tr><td>RCPT011</td><td>receiptCounter out of order</td></tr>
                  <tr><td>RCPT012</td><td>receiptGlobalNo out of order</td></tr>
                  <tr><td>RCPT019</td><td>receiptTotal mismatch with lines</td></tr>
                  <tr><td>DAY01</td><td>Fiscal day in wrong status for this action</td></tr>
                </tbody>
              </table>
            </Section>
          </article>
        </div>
      </section>

      <IntegrateCTA
        id="integrate"
        eyebrow="Ready to integrate?"
        title="Skip the spec — let’s wire fiscalisation into your system"
        body="You’ve seen what ZIMRA’s FDMS API v7.2 demands. zimFDMS handles all of it for you. Want early API access, or the whole integration done for your POS, store or app? Get in touch with Noby."
      />
    </div>
  )
}

const SECTIONS = [
  { id: 'getting-started', title: 'Getting started',  icon: Terminal },
  { id: 'zimra-api',       title: 'ZIMRA API v7.2',    icon: ShieldCheck },
  { id: 'submit-receipt',  title: 'POST /v1/receipts', icon: Code2 },
  { id: 'fiscal-day',      title: 'Fiscal day',        icon: BookOpen },
  { id: 'webhooks',        title: 'Webhooks',          icon: Webhook },
  { id: 'sdks',            title: 'SDKs',              icon: KeyRound },
  { id: 'errors',          title: 'Errors',            icon: Code2 },
]

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 mt-8 first:mt-0">
      <h2 className="text-2xl font-bold tracking-tight text-zim-ink-900">{title}</h2>
      <div className="mt-3 text-zim-ink-700">{children}</div>
    </section>
  )
}
