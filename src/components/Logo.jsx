/**
 * zimFDMS wordmark — flag-inspired Z + clean type.
 */
export default function Logo({ size = 28, withText = true, mono = false }) {
  const r = size
  return (
    <div className="inline-flex items-center gap-2">
      <svg width={r} height={r} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="zg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={mono ? '#fff' : '#B7202E'}/>
            <stop offset="100%" stopColor={mono ? '#fff' : '#F4B400'}/>
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#zg)"/>
        <path d="M18 18 H46 V25 L26 39 H46 V46 H18 V39 L38 25 H18 Z"
              fill="white" />
      </svg>
      {withText && (
        <span className={`text-lg font-bold tracking-tight ${mono ? 'text-white' : 'text-zim-ink-900'}`}>
          zim<span className="text-zim-red-600">FDMS</span>
        </span>
      )}
    </div>
  )
}
