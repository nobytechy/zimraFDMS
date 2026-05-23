import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, Receipt, CalendarDays, Settings, Key, Webhook, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import Logo from '@/components/Logo'

const LINKS = [
  { to: '/dashboard',            label: 'Overview',    icon: LayoutDashboard, end: true },
  { to: '/dashboard/receipts',   label: 'Receipts',    icon: Receipt },
  { to: '/dashboard/fiscal-day', label: 'Fiscal day',  icon: CalendarDays },
  { to: '/dashboard/api-keys',   label: 'API keys',    icon: Key },
  { to: '/dashboard/webhooks',   label: 'Webhooks',    icon: Webhook },
  { to: '/dashboard/settings',   label: 'Settings',    icon: Settings },
]

export default function DashboardLayout() {
  const { merchant, signOut } = useAuth()
  const nav = useNavigate()
  const handleSignOut = async () => { await signOut(); nav('/login') }
  return (
    <div className="min-h-screen flex bg-zim-ink-50">
      <aside className="w-64 shrink-0 border-r border-zim-ink-200 bg-white hidden md:flex flex-col">
        <div className="p-5 border-b border-zim-ink-200">
          <Link to="/"><Logo /></Link>
          <p className="mt-2 text-[11px] uppercase tracking-wider text-zim-ink-500">Merchant Dashboard</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {LINKS.map(({ to, label, icon: I, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                isActive ? 'bg-zim-red-50 text-zim-red-700' : 'text-zim-ink-600 hover:bg-zim-ink-100 hover:text-zim-ink-900',
              )}><I size={16}/> {label}</NavLink>
          ))}
        </nav>
        <div className="border-t border-zim-ink-200 p-3 space-y-1">
          <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zim-ink-600 hover:bg-zim-ink-100">
            <ExternalLink size={16}/> View site
          </Link>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zim-ink-600 hover:bg-zim-ink-100">
            <LogOut size={16}/> Sign out
          </button>
          {merchant && (
            <div className="px-3 pt-3 text-xs text-zim-ink-500">
              Signed in as<br />
              <span className="font-semibold text-zim-ink-700">{merchant.full_name}</span><br />
              <span className="font-mono">{merchant.phone}</span>
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="md:hidden border-b border-zim-ink-200 bg-white px-4 py-3 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <button onClick={handleSignOut} className="btn-ghost"><LogOut size={16}/></button>
        </header>
        <div className="p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
