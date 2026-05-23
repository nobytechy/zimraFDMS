/**
 * Slim "Works with" strip — shows the platforms zimFDMS integrates with.
 * Pure SVG/Unicode — no third-party logos to chase down.
 */
export default function TechMarquee() {
  const items = [
    'WooCommerce', 'Shopify', 'Magento', 'Laravel',
    'WordPress', 'Node.js', 'PHP', 'Python',
    'Square POS', 'Custom ERPs',
  ]
  return (
    <section className="border-y border-zim-ink-200 bg-white py-7">
      <div className="container-page">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-zim-ink-500">
          Works with everything your business already runs
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-zim-ink-500">
          {items.map((it) => (
            <span key={it} className="text-sm font-medium tracking-tight text-zim-ink-600/80 hover:text-zim-ink-900 transition">
              {it}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
