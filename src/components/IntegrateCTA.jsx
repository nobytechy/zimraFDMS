import { Mail, Phone, MessageCircle, ArrowRight } from 'lucide-react'

/**
 * "Want this integrated?" call-to-action band.
 *
 * zimFDMS teaches ZIMRA fiscalisation for free; this is the bridge to a paid
 * engagement — anyone who wants fiscalisation built into their POS / store /
 * app can reach Noby directly. Reused on How-It-Works, Docs and Home.
 */
export default function IntegrateCTA({
  id,
  eyebrow = 'Need a hand?',
  title = 'Want ZIMRA fiscalisation built into your system?',
  body = 'zimFDMS is built and maintained by Noby Tebulo. Whether you just want to understand the FDMS API v7.2, or you want it fully integrated into your POS, e-commerce store or accounting app — get in touch and let’s talk.',
} = {}) {
  return (
    <section id={id} className="relative isolate scroll-mt-24 overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-zim-ink-950 via-zim-red-950 to-zim-ink-900" />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-0 size-[26rem] rounded-full bg-zim-red-700/25 blur-3xl" />
        <div className="absolute -right-32 bottom-0 size-[26rem] rounded-full bg-zim-gold-600/15 blur-3xl" />
      </div>

      <div className="container-page py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-zim-gold-300">{eyebrow}</p>
        <h2 className="mx-auto mt-2 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-zim-ink-300">{body}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://wa.me/263774603865?text=Hi%20Noby%2C%20I%27d%20like%20help%20integrating%20ZIMRA%20fiscalisation%20(zimFDMS)."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-zim-gold-400 px-6 py-3 text-sm font-semibold text-zim-ink-950 transition hover:bg-zim-gold-300"
          >
            <MessageCircle size={16} /> Chat on WhatsApp <ArrowRight size={15} />
          </a>
          <a
            href="mailto:nobytechy@gmail.com?subject=ZIMRA%20fiscalisation%20integration%20(zimFDMS)"
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            <Mail size={16} /> Email Noby
          </a>
          <a
            href="tel:+263774603865"
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            <Phone size={16} /> +263 77 460 3865
          </a>
        </div>
      </div>
    </section>
  )
}
