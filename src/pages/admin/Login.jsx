import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import Logo from '@/components/Logo'

export default function AdminLogin() {
  const { signInAdmin } = useAuth()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    if (pin.length < 4) { toast.error('Enter your PIN'); return }
    setBusy(true)
    const { error } = await signInAdmin(pin)
    setBusy(false)
    if (error) { toast.error('Wrong PIN'); return }
    nav('/admin')
  }

  return (
    <div className="min-h-screen grid place-items-center bg-zim-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center"><Logo mono /></div>
        <form onSubmit={onSubmit} className="rounded-2xl bg-white p-7 shadow-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-zim-ink-900">Super-admin</h1>
          <p className="mt-1 text-sm text-zim-ink-500">PIN-only access. For Noby.</p>
          <input
            autoFocus type="password" inputMode="numeric"
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="input mt-6 text-center text-2xl font-bold tracking-[0.4em]"
            placeholder="••••" maxLength={8}
          />
          <button type="submit" disabled={busy} className="btn-primary mt-5 w-full py-3 text-base">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
