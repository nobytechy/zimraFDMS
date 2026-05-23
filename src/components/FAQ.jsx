import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'What exactly is ZIMRA FDMS?',
    a: 'Fiscalisation Data Management System. It\'s ZIMRA\'s backend that fiscal devices (POS systems, ERPs, invoicing apps) submit every sale to. Every receipt printed in Zimbabwe by a registered taxpayer is supposed to be signed by the fiscal device and counter-signed by ZIMRA — that\'s how FDMS detects under-declaration in real time.',
  },
  {
    q: 'Do I have to register with ZIMRA before using zimFDMS?',
    a: 'Only for production. You can build and test entirely in our sandbox without any ZIMRA account — a mock FDMS runs in your browser following the v7.2 spec. When you\'re ready to go live, you get a device ID and activation key from the ZIMRA registration portal and paste them into Settings.',
  },
  {
    q: 'How is this different from doing it myself?',
    a: 'You skip ~6 weeks of spec reading, signature math, certificate management, fiscal-day state machine and Z-report generation. The ZIMRA spec is 77 pages of dense PKI and validation rules — zimFDMS implements all of it once so every merchant doesn\'t reinvent the wheel.',
  },
  {
    q: 'Does my WooCommerce / Shopify / WordPress store work?',
    a: 'WooCommerce plugin is shipping next. For other platforms, integrate via the REST API: one POST per sale to /v1/receipts and you\'re fiscalised. Node and PHP SDKs make it a 5-line integration.',
  },
  {
    q: 'What happens when the internet drops mid-day?',
    a: 'zimFDMS uses ZIMRA\'s offline mode. Receipts queue locally; when connectivity returns they\'re submitted as a batch file per the spec. Your customers get a real receipt either way — fiscalisation happens in the background.',
  },
  {
    q: 'Is my data exportable?',
    a: 'Yes — all receipts, fiscal days and Z reports are exportable as CSV, JSON or PDF. We don\'t lock you in. The whole point of fiscalisation is that ZIMRA already has your data; you should too.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <section className="border-y border-zim-ink-200 bg-zim-sand-50 py-16">
      <div className="container-page">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Frequently asked</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-zim-ink-900 md:text-4xl">
            The questions everyone asks first.
          </h2>
        </div>
        <div className="mx-auto max-w-3xl divide-y divide-zim-ink-200 rounded-2xl border border-zim-ink-200 bg-white">
          {FAQS.map((f, i) => {
            const isOpen = open === i
            return (
              <div key={f.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-zim-sand-50"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-zim-ink-900 md:text-base">{f.q}</span>
                  <ChevronDown size={18} className={`shrink-0 text-zim-ink-400 transition ${isOpen ? 'rotate-180' : ''}`}/>
                </button>
                {isOpen && (
                  <div className="border-t border-zim-ink-100 bg-zim-sand-50/40 px-5 py-4 text-sm leading-relaxed text-zim-ink-700">
                    {f.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
