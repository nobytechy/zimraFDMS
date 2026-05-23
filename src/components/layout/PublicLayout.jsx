import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, X, ArrowRight, LayoutDashboard, LogOut } from 'lucide-react'
import { useState } from 'react'
import Logo from '@/components/Logo'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/',            label: 'Home', end: true },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/sandbox',     label: 'Sandbox' },
  { to: '/verify',      label: 'Verify' },
  { to: '/docs',        label: 'Docs' },
  { to: '/pricing',     label: 'Pricing' },
]

export default function PublicLayout() {
  const { isAuthenticated, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  const handleSignOut = async () => { await signOut(); setOpen(false); nav('/') }

  return (
    <div className="min-h-screen bg-white text-zim-ink-900">
      {/* Top strip */}
      <div className="bg-zim-ink-900 text-zim-ink-50">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-1.5 text-[11px]">
          <span>🇿🇼 Built for Zimbabwean businesses — fiscalisation made simple.</span>
          <Link to="/sandbox" className="text-zim-gold-300 hover:text-zim-gold-200">Try the sandbox — no signup needed →</Link>
        </div>
      </div>

      {/* Main nav */}
      <header className="sticky top-0 z-40 border-b border-zim-ink-200 bg-white/95 backdrop-blur">
        <div className="container-page flex items-center justify-between py-3">
          <Link to="/"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-zim-red-50 text-zim-red-700' : 'text-zim-ink-600 hover:bg-zim-ink-50 hover:text-zim-ink-900',
                )}>{label}</NavLink>
            ))}
            {!isAuthenticated && (
              <>
                <Link to="/login" className="ml-2 btn-secondary">Sign in</Link>
                <Link to="/signup" className="btn-primary">Get started <ArrowRight size={14}/></Link>
              </>
            )}
            {isAuthenticated && (
              <>
                <NavLink to="/dashboard" className={({ isActive }) => cn(
                  'ml-2 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-zim-red-50 text-zim-red-700' : 'text-zim-ink-600 hover:bg-zim-ink-50 hover:text-zim-ink-900',
                )}><LayoutDashboard size={14}/> Dashboard</NavLink>
                <button onClick={handleSignOut} className="btn-secondary"><LogOut size={14}/> Sign out</button>
              </>
            )}
          </nav>
          <button onClick={() => setOpen((v) => !v)} className="md:hidden btn-ghost" aria-label="Menu">
            {open ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
        {open && (
          <div className="border-t border-zim-ink-200 md:hidden">
            <div className="container-page flex flex-col gap-1 py-3">
              {NAV.map(({ to, label, end }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn(
                    'rounded-md px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-zim-red-50 text-zim-red-700' : 'text-zim-ink-700 hover:bg-zim-ink-50',
                  )}>{label}</NavLink>
              ))}
              {!isAuthenticated && (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary mt-1">Sign in</Link>
                  <Link to="/signup" onClick={() => setOpen(false)} className="btn-primary">Get started</Link>
                </>
              )}
              {isAuthenticated && (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="btn-secondary mt-1">Dashboard</Link>
                  <button onClick={handleSignOut} className="btn-secondary">Sign out</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main><Outlet /></main>

      {/* Footer — deep gradient that blends seamlessly from the CTA strip above */}
      <footer className="relative isolate overflow-hidden text-zim-ink-100">
        {/* Layered gradient backdrop: dark slate → deep burgundy → slate */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-zim-ink-950 via-zim-red-950 to-zim-ink-900"/>
        {/* Soft brand halos for depth */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 top-1/4 size-[28rem] rounded-full bg-zim-red-700/25 blur-3xl"/>
          <div className="absolute -right-32 bottom-0 size-[28rem] rounded-full bg-zim-gold-600/15 blur-3xl"/>
        </div>
        {/* Subtle top hairline that hints the section break */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zim-red-400/40 to-transparent"/>

        <div className="container-page relative grid gap-10 py-16 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo mono />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zim-ink-300">
              ZIMRA fiscalisation as a bridge service — connect your POS, e-commerce store or invoicing app
              once and we handle everything ZIMRA demands. Built for Zimbabwean businesses.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-zim-ink-400">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 backdrop-blur">
                🇿🇼 Harare-built
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 backdrop-blur">
                ZIMRA v7.2 compliant
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 backdrop-blur">
                Sibling of ManishaPay
              </span>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zim-gold-300">Product</p>
            <ul className="space-y-2 text-sm text-zim-ink-300">
              <li><Link to="/how-it-works" className="hover:text-white">How it works</Link></li>
              <li><Link to="/sandbox" className="hover:text-white">Sandbox</Link></li>
              <li><Link to="/docs" className="hover:text-white">Docs</Link></li>
              <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zim-gold-300">Company</p>
            <ul className="space-y-2 text-sm text-zim-ink-300">
              <li><a href="https://nobie.netlify.app" target="_blank" rel="noopener noreferrer" className="hover:text-white">About Noby</a></li>
              <li><Link to="/admin/login" className="hover:text-white">Staff login</Link></li>
              <li><Link to="/signup" className="hover:text-white">Become a merchant</Link></li>
              <li><a href="mailto:nobytechy@gmail.com" className="hover:text-white">Get in touch</a></li>
            </ul>
          </div>
        </div>

        <div className="relative border-t border-white/10">
          <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-zim-ink-400">
            <span>© {new Date().getFullYear()} zimFDMS. All rights reserved.</span>
            <span className="flex items-center gap-2">
              Powered by{' '}
              <a href="https://nobie.netlify.app" target="_blank" rel="noopener noreferrer"
                 className="font-semibold text-zim-gold-300 hover:text-zim-gold-200 hover:underline">
                Noby
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
