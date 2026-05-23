/**
 * Auth + settings context.
 *
 *  - Merchants sign up with Full name, Phone (+263), Password.
 *    Supabase Auth requires a real public TLD — we synthesise
 *    `phone-{normalised}@zimfdms.app` (it's an addressable real TLD; we don't
 *    actually own the domain, but Supabase only validates the format, not
 *    the deliverability, and we never send mail to these addresses).
 *  - Super-admin is a separate auth surface, PIN-only, email = `admin@zimfdms.app`.
 *
 *  IMPORTANT — if you created an admin user earlier with `admin@zimfdms.local`,
 *  rename it in Supabase → Auth → Users to `admin@zimfdms.app`. The .local TLD
 *  is rejected by Supabase Auth's signup validator (RFC 6762 reserves .local
 *  for mDNS), even though it works for users created manually via dashboard.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { normalisePhone } from '@/lib/utils'

const AuthContext = createContext(null)

const phoneToEmail = (phone) => `phone-${normalisePhone(phone).replace('+', '')}@zimfdms.app`
const ADMIN_EMAIL = 'admin@zimfdms.app'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [merchant, setMerchant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  // Resolve merchant row whenever session changes.
  useEffect(() => {
    if (!session?.user) { setMerchant(null); return }
    supabase.from('fdms_merchants').select('*').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setMerchant(data || null))
  }, [session?.user?.id])

  // ─── Merchant flows ─────────────────────────────────────────────────────
  async function signUpMerchant({ fullName, phone, password }) {
    const email = phoneToEmail(phone)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }
    const userId = data.user?.id
    if (!userId) return { error: { message: 'No user id returned' } }
    const { error: rowErr } = await supabase.from('fdms_merchants').insert({
      user_id: userId,
      full_name: fullName,
      phone: normalisePhone(phone),
      phone_verified: false,
    })
    if (rowErr) return { error: rowErr }
    return { error: null }
  }

  async function signInMerchant({ phone, password }) {
    const email = phoneToEmail(phone)
    return supabase.auth.signInWithPassword({ email, password })
  }

  // ─── Admin flow (PIN-only) ─────────────────────────────────────────────
  async function signInAdmin(pin) {
    return supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: pin })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setMerchant(null)
  }

  const isAdmin = Boolean(session?.user?.email === ADMIN_EMAIL || merchant?.is_admin)

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      merchant,
      loading,
      isAuthenticated: Boolean(session),
      isAdmin,
      signUpMerchant,
      signInMerchant,
      signInAdmin,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>')
  return ctx
}

export { ADMIN_EMAIL }
