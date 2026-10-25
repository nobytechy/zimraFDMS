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
                <li><Link to="/signup">Create an account</Link> and open <strong>Dashboard → Device</strong>.</li>
                <li>Enter your own ZIMRA device ID, serial number and activation key. We verify your business with ZIMRA, then register your device.</li>
                <li>Open a fiscal day and ring up sales. Not ready? Walk the lifecycle in the <Link to="/sandbox">interactive sandbox</Link> — no signup, no ZIMRA account needed.</li>
              </ol>
              <p className="rounded-lg border border-zim-gold-300 bg-zim-gold-50 px-4 py-3 text-sm text-zim-ink-700">
                <strong>Each business uses its own ZIMRA device.</strong> Your sales are signed with your device’s key, which is created and
                kept on our server — it never reaches the browser. Start on the <strong>Test</strong> ZIMRA system before going Live.
                Want fiscalisation built into your own system? <a href="#integrate">Get in touch</a>.
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
                <li><code>submitReceipt</code> — submit each fiscal invoice / credit / debit note, <strong>device-signed</strong>; FDMS counter-signs and returns its own signature; the device builds the receipt QR from its own signature</li>
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

            <Section id="submit-receipt" title="Submitting a sale">
              <p>The dashboard (and, soon, your own system) sends only the items and payment. The server numbers the receipt, signs it with your device key, sends it to ZIMRA and returns the result. If ZIMRA is unreachable the sale is saved and sent later, in order.</p>
              <pre><code>{`POST /api/fdms/devices/{deviceID}/sell
Authorization: Bearer <your session token>
Content-Type: application/json

{
  "invoiceNo": "INV-00134",
  "receiptCurrency": "USD",
  "lines": [
    { "name": "Coca-Cola 500ml", "quantity": 2, "price": 1.20, "taxID": 3 }
  ],
  "payments": [{ "moneyTypeCode": "Cash" }]
}`}</code></pre>
              <p>Response (shape):</p>
              <pre><code>{`{
  "ok": true,
  "data": {
    "status": "accepted",          // or "queued" when ZIMRA could not be reached
    "receiptID": 1000045,
    "receipt": { "receiptGlobalNo": 134, "receiptCounter": 3, "receiptTotal": 2.40, ... },
    "qr": { "url": "https://.../<deviceID><date><globalNo><code>", "verificationCode": "A1B2-C3D4-E5F6-7890" }
  }
}`}</code></pre>
              <p>Tax IDs come from your device configuration (<code>GET /api/fdms/devices/{'{deviceID}'}</code> → <code>config.applicableTaxes</code>).</p>
            </Section>

            <Section id="fiscal-day" title="Fiscal day endpoints">
              <ul>
                <li><code>POST /api/fdms/devices/{'{id}'}/open-day</code> — open the next fiscal day</li>
                <li><code>POST /api/fdms/devices/{'{id}'}/close-day</code> — close the day (all receipts must have reached ZIMRA first)</li>
                <li><code>GET  /api/fdms/devices/{'{id}'}/days/{'{no}'}</code> — a day with all its receipts</li>
                <li><code>GET  /api/fdms/devices/{'{id}'}/receipts?q=&amp;status=&amp;from=&amp;to=</code> — search receipts by invoice number, status, type and date range</li>
              </ul>
            </Section>

            

            <Section id="sdks" title="SDKs">
              <ul>
                <li><strong>Node:</strong> <code>npm install zimfdms</code> (coming soon)</li>
                <li><strong>PHP:</strong> <code>composer require zimfdms/php</code> (coming soon)</li>
                <li><strong>WordPress / WooCommerce plugin</strong> — drop in, configure once, every order fiscalises (coming soon)</li>
              </ul>
            </Section>

            <Section id="errors" title="Errors">
              <p>Our API answers <code>{`{ "ok": false, "error": { "code", "message" } }`}</code>. Errors from ZIMRA keep ZIMRA’s own code (for example <code>DEV01</code>–<code>DEV15</code>, <code>RCPT…</code>, <code>FISC…</code>, <code>FILE…</code> — see the ZIMRA spec for the full list).</p>
              <table>
                <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td>UNAUTHENTICATED</td><td>Sign in again</td></tr>
                  <tr><td>DEVICE_OWNED</td><td>That device is already connected to another account</td></tr>
                  <tr><td>DAY_NOT_OPEN</td><td>Open the fiscal day first</td></tr>
                  <tr><td>PREFLIGHT_FAILED</td><td>We stopped a receipt ZIMRA would reject; details say which rule</td></tr>
                  <tr><td>UNSENT_RECEIPTS</td><td>Some sales have not reached ZIMRA yet</td></tr>
                  <tr><td>FDMS_UNREACHABLE</td><td>ZIMRA could not be reached; sales are kept and sent later</td></tr>
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
