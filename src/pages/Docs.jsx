import { Link } from 'react-router-dom'
import { Code2, BookOpen, Webhook, KeyRound, Terminal } from 'lucide-react'

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
                <li><Link to="/signup">Create an account</Link> with your phone number.</li>
                <li>Go to <code>Dashboard → API keys</code> and create a new key.</li>
                <li>Use the key as a Bearer token on every request.</li>
              </ol>
              <pre><code>{`curl https://api.zimfdms.co.zw/v1/ping \\
  -H 'Authorization: Bearer zfd_live_xxxxxxxxxxxxxxxx'`}</code></pre>
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
    </div>
  )
}

const SECTIONS = [
  { id: 'getting-started', title: 'Getting started',  icon: Terminal },
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
