import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileSignature, Lock, Wifi, WifiOff, HelpCircle, BookOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import LifecycleCircle, { STAGES } from '@/components/LifecycleCircle'
import IntegrateCTA from '@/components/IntegrateCTA'
import Seo from '@/components/Seo'

// Plain-English glossary — the terms ZIMRA uses, defined for someone who has
// never touched fiscalisation. Sourced from the FDMS API v7.2 spec (§1.1).
const GLOSSARY = [
  ['Fiscalisation', 'Recording every sale electronically and sending it to ZIMRA — by law, for VAT-registered businesses in Zimbabwe.'],
  ['FDMS', 'Fiscalisation Data Management System — ZIMRA’s backend that receives, controls and monitors those sales and produces tax reports.'],
  ['Fiscal device', 'The hardware or software that records sales (issues fiscal invoices, debit & credit notes) and submits them to FDMS. zimFDMS is a software fiscal device.'],
  ['Device ID & Activation Key', 'Issued by ZIMRA when you register a device on their portal. You need both once, to link the device to FDMS.'],
  ['Fiscal day', 'A trading day on the device. You open it, submit receipts against it all day, then close it with a signed summary.'],
  ['Receipt', 'The umbrella term for a fiscal invoice, debit note or credit note.'],
  ['Device signature', 'A cryptographic signature the device adds to each receipt before sending it — proof it wasn’t tampered with.'],
  ['FDMS signature', 'ZIMRA’s own counter-signature, added after it accepts the receipt.'],
  ['QR code', 'Printed on every receipt. Anyone can scan it to verify the receipt is genuine on ZIMRA’s portal.'],
]

const STAGE_COPY = {
  register: {
    title: '1 · Register the device with ZIMRA',
    body: [
      'Before a fiscal device can issue receipts it must be known to ZIMRA. The taxpayer logs into the ZIMRA portal and adds the device — they receive a **device ID** and an **activation key**.',
      'The device then generates a **certificate signing request (CSR)** using ECDSA secp256r1 (recommended) or RSA 2048, and sends it to FDMS along with the activation key. ZIMRA returns an X.509 v3 certificate the device uses for all future communication.',
    ],
    snippet: `// Once-off — happens automatically when you connect zimFDMS
POST /v1/devices/register
{ "deviceId": 187, "activationKey": "ABCDEFGH" }
→  { "certificate": "-----BEGIN CERTIFICATE-----..." }`,
  },
  open: {
    title: '2 · Open the fiscal day',
    body: [
      'Sales can only be submitted while a fiscal day is **open**. The device sends `openDay` with the opening timestamp and a fiscal-day number (auto-assigned by FDMS if you don\'t set one).',
      'zimFDMS opens the day for you automatically on the first sale of each calendar day — no human intervention needed in normal operation.',
    ],
    snippet: `// You don't usually call this — zimFDMS auto-opens
POST /v1/fiscal-day/open
{ "fiscalDayOpened": "2026-05-20T08:00:00" }
→  { "fiscalDayNo": 142 }`,
  },
  submit: {
    title: '3 · Submit each receipt — signed',
    body: [
      'For every sale, a receipt is built (lines, taxes, payments, total), **hashed with SHA-256**, and **signed with the device\'s private key** per spec section 13. The signed receipt is sent to ZIMRA and ZIMRA counter-signs it to confirm receipt.',
      'The device-side signature becomes the QR code on the customer\'s printed receipt — anyone can scan it and verify the receipt is genuine on ZIMRA\'s portal.',
    ],
    snippet: `POST /v1/receipts
{
  "receiptType": "FiscalInvoice",
  "receiptCurrency": "USD",
  "lines": [{ "name": "Coke 500ml", "quantity": 2, "price": 1.20, "taxID": 1 }],
  "payments": [{ "type": "Cash", "amount": 2.76 }]
}
→  { "receiptId": 1000045, "qrUrl": "https://invoice-verification.zimra.co.zw/…" }`,
  },
  close: {
    title: '4 · Close the day',
    body: [
      'When the business stops trading for the day, the fiscal day is closed. The device sends `closeDay` with summary counters per tax rate, per receipt type and per payment method.',
      'FDMS validates the report against everything the device submitted during the day. If anything doesn\'t reconcile, the day enters `FiscalDayCloseFailed` and the device must correct + resubmit.',
    ],
    snippet: `POST /v1/fiscal-day/close
{ "fiscalDayClosed": "2026-05-20T22:30:00", "counters": [...] }
→  { "status": "FiscalDayClosed", "serverSignature": {...} }`,
  },
  zreport: {
    title: '5 · Z Report — the daily proof',
    body: [
      'Once a day closes successfully, FDMS returns a **Z report signature** — that\'s ZIMRA\'s cryptographic acknowledgement of the day\'s totals.',
      'zimFDMS renders the Z report in the standard ZIMRA layout: taxpayer block, daily totals by tax, document counts, payment breakdown. Print or download as PDF.',
    ],
    snippet: `GET /v1/fiscal-day/142/z-report
→  PDF + JSON with the full ZIMRA-signed daily summary`,
  },
}

export default function HowItWorks() {
  const [active, setActive] = useState('register')
  const copy = STAGE_COPY[active]
  return (
    <div className="bg-white">
      <Seo
        title="How FDMS actually works"
        description="Plain-English walkthrough of ZIMRA's Fiscal Device Management System — register device, open fiscal day, sign receipts, close day, generate Z reports. With diagrams + code snippets."
        path="/how-it-works"
      />
      {/* Hero */}
      <section className="hero-grad">
        <div className="container-page py-14 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">How FDMS actually works</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-zim-ink-900 md:text-5xl">
            Five stages, one bridge service.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-zim-ink-600">
            ZIMRA's Fiscal Device Management System defines a strict lifecycle every fiscal device must follow.
            zimFDMS implements all five stages so you only ever think about the third — submitting receipts.
          </p>
        </div>
      </section>

      {/* Plain-English primer — for people brand new to fiscalisation */}
      <section className="container-page py-12">
        <div className="rounded-2xl border border-zim-ink-200 bg-zim-ink-50 p-6 md:p-8">
          <div className="flex items-center gap-2 text-zim-red-700">
            <HelpCircle size={18} />
            <p className="text-xs font-semibold uppercase tracking-wider">Never done this before? Start here</p>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-zim-ink-900">Fiscalisation, in one paragraph</h2>
          <p className="mt-3 max-w-3xl text-zim-ink-700">
            In Zimbabwe, VAT-registered businesses must record <strong>every sale electronically</strong> and send it
            to ZIMRA in real time — that’s “fiscalisation”. Each sale becomes a <strong>fiscal receipt</strong> with a
            QR code the customer can scan to prove it’s genuine. To do it, a device registers with ZIMRA once, then
            each trading day it <strong>opens a fiscal day</strong>, <strong>signs &amp; submits every receipt</strong>,
            and <strong>closes the day</strong> with a signed summary. The catch: ZIMRA’s FDMS API is strict —
            certificates, exact signature maths, a day “state machine”. <strong>zimFDMS does all of that for you</strong>,
            so you only ever send a simple sale.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniFact k="Who needs it?" v="VAT-registered businesses trading in Zimbabwe." />
            <MiniFact k="Why?" v="It stops under-declaring sales and lets any customer verify a receipt." />
            <MiniFact k="What’s hard?" v="The FDMS API v7.2 — certs, signatures, fiscal-day rules. We handle it." />
          </div>
        </div>
      </section>

      {/* Lifecycle picker */}
      <section className="container-page py-12">
        <div className="grid items-start gap-10 lg:grid-cols-[480px_1fr]">
          <div className="flex justify-center">
            <LifecycleCircle active={active} onPick={setActive} />
          </div>
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-bold text-zim-ink-900">{copy.title}</h2>
                <div className="mt-3 space-y-3 text-zim-ink-700">
                  {copy.body.map((para, i) => (
                    <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                  ))}
                </div>
                <pre className="mt-5 overflow-x-auto rounded-xl bg-zim-ink-900 p-4 text-[12px] leading-relaxed text-zim-ink-50">
                  <code>{copy.snippet}</code>
                </pre>
                <div className="mt-4 flex flex-wrap gap-2">
                  {STAGES.map((s) => (
                    <button key={s.id} onClick={() => setActive(s.id)}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-medium border transition',
                        active === s.id ? 'bg-zim-red-600 text-white border-zim-red-600' : 'bg-white text-zim-ink-700 border-zim-ink-200 hover:border-zim-red-400',
                      ].join(' ')}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Online vs offline */}
      <section className="bg-zim-ink-50 py-14">
        <div className="container-page">
          <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Two communication modes</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-zim-ink-900">Online &amp; offline — both handled.</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-zim-ink-200 bg-white p-6">
              <div className="grid size-11 place-items-center rounded-xl bg-zim-red-50 text-zim-red-600"><Wifi size={20}/></div>
              <h3 className="mt-3 font-bold text-zim-ink-900">Online mode</h3>
              <p className="mt-1.5 text-sm text-zim-ink-600">Each sale submits to FDMS in real time. Device needs internet for the day-close call. zimFDMS retries on transient failures.</p>
            </div>
            <div className="rounded-2xl border border-zim-ink-200 bg-white p-6">
              <div className="grid size-11 place-items-center rounded-xl bg-zim-gold-100 text-zim-gold-700"><WifiOff size={20}/></div>
              <h3 className="mt-3 font-bold text-zim-ink-900">Offline mode</h3>
              <p className="mt-1.5 text-sm text-zim-ink-600">Receipts are saved on-device and submitted as a batch file when the network returns. zimFDMS handles the file format ZIMRA expects.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Signatures + QR detail */}
      <section className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="grid size-11 place-items-center rounded-xl bg-zim-red-50 text-zim-red-600"><FileSignature size={20}/></div>
            <h3 className="mt-3 text-2xl font-bold text-zim-ink-900">Signatures, explained</h3>
            <p className="mt-2 text-zim-ink-600">
              ZIMRA requires a specific concatenation of receipt fields (deviceID, type, currency, global number, date, total in cents, taxes block, previous-receipt-hash). That string is SHA-256 hashed and signed with the device's private key. We do this every time so you don't need to.
            </p>
            <Link to="/sandbox" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-zim-red-700">See it live <ArrowRight size={14}/></Link>
          </div>
          <div>
            <div className="grid size-11 place-items-center rounded-xl bg-zim-gold-100 text-zim-gold-700"><Lock size={20}/></div>
            <h3 className="mt-3 text-2xl font-bold text-zim-ink-900">QR codes that verify</h3>
            <p className="mt-2 text-zim-ink-600">
              The QR printed on every receipt encodes the device signature and a URL to ZIMRA's verification portal. Any customer can scan it and confirm the receipt is legitimate — protecting honest businesses and exposing fraud.
            </p>
          </div>
        </div>
      </section>

      {/* Glossary — every ZIMRA term, in plain English */}
      <section className="bg-zim-ink-50 py-14">
        <div className="container-page">
          <div className="flex items-center gap-2 text-zim-red-700">
            <BookOpen size={18} />
            <p className="text-xs font-semibold uppercase tracking-wider">The words ZIMRA uses</p>
          </div>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-zim-ink-900">Fiscalisation glossary</h2>
          <p className="mt-2 max-w-2xl text-zim-ink-600">Straight from the FDMS API v7.2 spec — decoded for humans.</p>
          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            {GLOSSARY.map(([term, def]) => (
              <div key={term} className="rounded-xl border border-zim-ink-200 bg-white p-5">
                <dt className="font-bold text-zim-ink-900">{term}</dt>
                <dd className="mt-1 text-sm text-zim-ink-600">{def}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-zim-ink-600">
            Want the developer view of these endpoints?{' '}
            <Link to="/docs" className="font-semibold text-zim-red-700 hover:text-zim-red-800">Read the API docs →</Link>
          </p>
        </div>
      </section>

      <IntegrateCTA />
    </div>
  )
}

function MiniFact({ k, v }) {
  return (
    <div className="rounded-xl border border-zim-ink-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zim-red-700">{k}</p>
      <p className="mt-1 text-sm text-zim-ink-700">{v}</p>
    </div>
  )
}
