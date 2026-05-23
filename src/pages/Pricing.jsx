import { Link } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'

const TIERS = [
  {
    name: 'Sandbox',
    price: 'Free',
    sub: 'Forever. No card required.',
    features: [
      'Full v7.2 lifecycle in the browser',
      'In-memory mock FDMS',
      'No ZIMRA account needed',
      'Perfect for testing + recruiter demos',
    ],
    cta: 'Open the sandbox',
    ctaLink: '/sandbox',
    highlight: false,
  },
  {
    name: 'Starter',
    price: 'Free',
    sub: 'For pilot deployments.',
    features: [
      'Connect your live ZIMRA device',
      'Up to 200 fiscalised receipts / month',
      'WhatsApp + email support',
      'WordPress / WooCommerce plugin',
    ],
    cta: 'Create account',
    ctaLink: '/signup',
    highlight: true,
  },
  {
    name: 'Production',
    price: 'Contact',
    sub: 'Volume-priced. Talk to Noby.',
    features: [
      'Unlimited receipts',
      'Webhook delivery + retries',
      'Priority support (4-hour response)',
      'White-glove ZIMRA onboarding',
      'Custom integrations',
    ],
    cta: 'Get in touch',
    ctaLink: 'mailto:nobytechy@gmail.com?subject=zimFDMS%20Production%20enquiry',
    highlight: false,
  },
]

export default function Pricing() {
  return (
    <div>
      <section className="hero-grad">
        <div className="container-page py-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Pricing</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zim-ink-900">Start free. Scale when you're ready.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-zim-ink-600">
            zimFDMS is currently in early access. Sandbox and Starter tiers are <strong>free while we onboard the first cohort of merchants</strong> — pricing for higher volumes will be set with you, in line with what the bridge service genuinely saves your team.
          </p>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-5 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.name} className={[
              'rounded-2xl border bg-white p-7',
              t.highlight ? 'border-zim-red-500 ring-2 ring-zim-red-500/20 shadow-md' : 'border-zim-ink-200',
            ].join(' ')}>
              {t.highlight && <span className="inline-block rounded-full bg-zim-red-100 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zim-red-700">Recommended</span>}
              <h3 className="mt-3 text-xl font-bold text-zim-ink-900">{t.name}</h3>
              <p className="mt-2 text-3xl font-bold text-zim-ink-900">{t.price}</p>
              <p className="text-xs text-zim-ink-500">{t.sub}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 shrink-0 text-emerald-600" size={14}/> <span>{f}</span></li>
                ))}
              </ul>
              <a href={t.ctaLink} className={[
                'mt-6 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold',
                t.highlight ? 'bg-zim-red-600 text-white hover:bg-zim-red-700' : 'border border-zim-ink-200 bg-white text-zim-ink-700 hover:border-zim-red-500 hover:text-zim-red-700',
              ].join(' ')}>
                {t.cta} <ArrowRight size={14}/>
              </a>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-zim-ink-500">
          We don't lock you in. Cancel any time. All your receipt + fiscal day data is exportable as CSV / JSON / PDF Z reports.
        </p>
      </section>
    </div>
  )
}
