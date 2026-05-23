import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Plug, Receipt, Smartphone, Globe, Zap, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import LifecycleCircle from '@/components/LifecycleCircle'
import FiscalReceiptCard from '@/components/FiscalReceiptCard'
import FAQ from '@/components/FAQ'
import TechMarquee from '@/components/TechMarquee'
import PosPreview from '@/components/PosPreview'
import Seo from '@/components/Seo'

const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.9, 0.32, 1] } } }

export default function Home() {
  return (
    <div>
      <Seo
        title=""
        description="A bridge service that connects Zimbabwean POS systems, e-commerce stores and accounting apps to ZIMRA's Fiscal Device Management System. Handles signature math, certificates, fiscal days and Z reports. v7.2 compliant. Built by Noby Tebulo."
        path="/"
      />
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="hero-grad">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div>
            <span className="chip">
              <Sparkles size={12}/> ZIMRA v7.2 compliant · built for Zimbabwean businesses
            </span>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-zim-ink-900 md:text-6xl">
              ZIMRA fiscalisation,<br />
              <span className="bg-gradient-to-br from-zim-red-700 via-zim-red-600 to-zim-gold-600 bg-clip-text text-transparent">without the headache.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zim-ink-600 md:text-lg">
              zimFDMS bridges your POS, e-commerce store or accounting system to ZIMRA's
              Fiscal Device Management System. No certificate juggling, no signature math,
              no fiscal-day state machine to manage — one simple API and a clean dashboard.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary py-3 text-base">Get started — free <ArrowRight size={16}/></Link>
              <Link to="/sandbox" className="btn-secondary py-3 text-base">Try the sandbox</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zim-ink-500">
              <span>✓ No card required</span>
              <span>✓ Works without ZIMRA credentials in sandbox</span>
              <span>✓ WooCommerce plugin coming</span>
            </div>
          </div>

          {/* Right column — live receipt + small lifecycle preview */}
          <div className="relative">
            <div className="flex items-center justify-center">
              <FiscalReceiptCard />
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: 6 }}
              animate={{ opacity: 1, scale: 1, rotate: 4 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="absolute -left-4 bottom-0 hidden md:block"
            >
              <div className="rounded-xl border border-zim-ink-200 bg-white px-3 py-2 shadow-md">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">FDMS ACK</p>
                <p className="mt-0.5 font-mono text-[10px] text-zim-ink-500">receiptID: 1000045</p>
                <p className="font-mono text-[10px] text-zim-ink-500">142ms · accepted</p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
              animate={{ opacity: 1, scale: 1, rotate: -2 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="absolute -right-2 -top-2 hidden md:block"
            >
              <div className="rounded-xl border border-zim-ink-200 bg-white px-3 py-2 shadow-md">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-red-700">Day 142</p>
                <p className="mt-0.5 text-[10px] text-zim-ink-500">17 receipts so far</p>
                <p className="text-[10px] text-zim-ink-500">USD 218.40</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Tech marquee ─────────────────────────────────────────────── */}
      <TechMarquee />

      {/* ── Lifecycle visual ─────────────────────────────────────────── */}
      <section className="container-page py-20">
        <div className="grid items-center gap-12 md:grid-cols-[480px_1fr]">
          <div className="flex justify-center">
            <LifecycleCircle size={440} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">The 5-stage lifecycle</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-zim-ink-900 md:text-4xl">
              Five stages every fiscal device does. <span className="text-zim-red-700">We do four of them for you.</span>
            </h2>
            <p className="mt-4 max-w-xl text-zim-ink-600 leading-relaxed">
              ZIMRA's spec defines a strict lifecycle every device must follow. zimFDMS handles
              registration, day opening, signature math and Z reports automatically — you only
              ever think about stage 3: <strong>submitting receipts</strong>.
            </p>
            <Link to="/how-it-works" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zim-red-700 hover:text-zim-red-800">
              See the full walkthrough <ArrowRight size={14}/>
            </Link>
          </div>
        </div>
      </section>

      {/* ── POS preview ──────────────────────────────────────────────── */}
      <PosPreview />

      {/* ── Value props ──────────────────────────────────────────────── */}
      <section className="bg-zim-sand-50 py-20">
        <div className="container-page">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">What you get</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-zim-ink-900 md:text-4xl">
              Everything ZIMRA demands — handled for you.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {VALUE_PROPS.map((v, i) => (
              <motion.article
                key={v.title}
                initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={fadeUp}
                transition={{ delay: i * 0.04 }}
                className="card card-hover p-6"
              >
                <div className="grid size-11 place-items-center rounded-xl bg-zim-red-50 text-zim-red-700 ring-1 ring-zim-red-100">
                  <v.icon size={20}/>
                </div>
                <h3 className="mt-4 text-base font-bold text-zim-ink-900">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zim-ink-600">{v.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────────── */}
      <section className="container-page py-20">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Who it's for</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-zim-ink-900 md:text-4xl">
            Three doors into the same service.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <motion.div
              key={a.who}
              initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={fadeUp}
              transition={{ delay: i * 0.05 }}
              className="card card-hover relative overflow-hidden p-6"
            >
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-zim-red-50 opacity-60"/>
              <p className="relative text-xs font-semibold uppercase tracking-wider text-zim-gold-700">{a.who}</p>
              <h3 className="relative mt-2 text-lg font-bold text-zim-ink-900">{a.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-zim-ink-600">{a.body}</p>
              <Link to={a.link} className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-zim-red-700 hover:text-zim-red-800">
                {a.cta} <ArrowRight size={14}/>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <FAQ />

      {/* ── CTA strip ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-zim-red-800 via-zim-red-700 to-zim-red-600 py-16 text-white">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -left-8 top-1/2 size-96 -translate-y-1/2 rounded-full bg-zim-gold-500 blur-3xl"/>
          <div className="absolute -right-8 top-1/3 size-96 rounded-full bg-zim-red-400 blur-3xl"/>
        </div>
        <div className="container-page relative flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Ready to stop wrestling with FDMS?</h2>
          <p className="mt-3 max-w-xl text-zim-red-50/90">
            Sign up in 60 seconds with just your phone number. Test in sandbox forever — flip to live ZIMRA when you have your device.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="btn-gold py-3 text-base">Create my account <ArrowRight size={16}/></Link>
            <Link to="/sandbox" className="btn-secondary !border-white/30 !bg-white/10 !text-white hover:!bg-white/20 py-3 text-base">Open the sandbox</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

const VALUE_PROPS = [
  { icon: ShieldCheck, title: 'Signed receipts, zero crypto code', body: 'We do the SHA-256 + ECDSA / RSA signature math per ZIMRA v7.2 section 13. You send a sale, we return a signed receipt with a QR code.' },
  { icon: Receipt,    title: 'Fiscal day state machine',          body: 'Open day, submit receipts, close day, generate Z reports — the whole lifecycle managed automatically with retries on offline windows.' },
  { icon: Plug,       title: 'Drop-in for WooCommerce',           body: 'WordPress plugin installs in 5 minutes and starts fiscalising every order. No code changes to your existing store.' },
  { icon: Smartphone, title: 'Mobile-first dashboard',            body: "Open receipts, today's totals, payment-attention banner — all the operator UX a busy shop owner needs on their phone." },
  { icon: Globe,      title: 'Online or offline',                 body: 'Online mode for real-time submission. Offline mode for low-connectivity locations — receipts queue and submit when the link is back.' },
  { icon: Zap,        title: 'Free sandbox, paid on real volume', body: 'Build and demo with synthesised tax data and no ZIMRA account. Switch to real mode only when you have an active device ID.' },
]

const AUDIENCES = [
  {
    who: 'For business owners',
    title: 'I just need my POS to comply.',
    body: 'Connect your existing system once. We handle every receipt. Daily fiscal close runs on autopilot.',
    cta: 'See the dashboard',
    link: '/dashboard',
  },
  {
    who: 'For developers',
    title: 'I need a clean FDMS API.',
    body: 'One REST endpoint instead of nine. Node + PHP SDKs. Webhooks. Spec-correct signatures verified against ZIMRA test vectors.',
    cta: 'Read the docs',
    link: '/docs',
  },
  {
    who: 'For everyone',
    title: 'I just want to understand FDMS.',
    body: 'A 5-minute plain-English walkthrough with an interactive playground — no signup, no ZIMRA account.',
    cta: 'Open the sandbox',
    link: '/sandbox',
  },
]
