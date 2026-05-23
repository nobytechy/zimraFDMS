import { useEffect, useState } from 'react'
import { Plus, Trash2, Copy, KeyRound, Loader2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export default function ApiKeys() {
  const { merchant } = useAuth()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState(null) // { key } shown once

  const load = async () => {
    if (!merchant) return
    setLoading(true)
    const { data } = await supabase
      .from('fdms_api_keys')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
    setKeys(data || [])
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [merchant?.id])

  if (!merchant) return null

  const generate = async (e) => {
    e?.preventDefault?.()
    if (!label.trim()) { toast.error('Give the key a label'); return }
    setCreating(true)
    // Generate a key client-side; store only a hash on the server (simple
    // SHA-256 here — bcrypt in a server function later).
    const rand = crypto.getRandomValues(new Uint8Array(24))
    const key  = 'zfd_live_' + Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('')
    const keyPrefix = key.slice(0, 12)
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
    const keyHash = Array.from(new Uint8Array(hashBuf), (b) => b.toString(16).padStart(2, '0')).join('')
    const { error } = await supabase.from('fdms_api_keys').insert({
      merchant_id: merchant.id,
      label: label.trim(),
      key_prefix: keyPrefix,
      key_hash: keyHash,
    })
    setCreating(false)
    if (error) { toast.error(error.message); return }
    setLabel('')
    setJustCreated({ key, label: label.trim() })
    load()
  }

  const revoke = async (id) => {
    if (!confirm('Revoke this key? Any integration using it will stop working immediately.')) return
    const { error } = await supabase.from('fdms_api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Key revoked')
    load()
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  return (
    <div>
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">API keys</h1>
        <p className="mt-1 text-sm text-zim-ink-500">Generate keys for your POS, e-commerce store or accounting system to call the zimFDMS API.</p>
      </header>

      {justCreated && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-zim-gold-300 bg-zim-gold-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-zim-gold-700" size={20}/>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zim-ink-900">Copy your key now — you won't see it again</p>
              <p className="mt-1 text-xs text-zim-ink-700">Label: {justCreated.label}. Once you close this banner the key is gone — only its hash is stored. If lost, generate a new key.</p>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-zim-gold-200">
                <code className="flex-1 break-all font-mono text-xs text-zim-ink-900">{justCreated.key}</code>
                <button onClick={() => copy(justCreated.key)} className="btn-secondary text-xs">
                  <Copy size={12}/> Copy
                </button>
              </div>
              <button onClick={() => setJustCreated(null)} className="mt-3 text-xs font-semibold text-zim-red-700 hover:text-zim-red-800">
                I've saved it
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <form onSubmit={generate} className="mt-6 card p-5">
        <p className="mb-3 text-sm font-semibold text-zim-ink-900">Create a new key</p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1 min-w-[240px]"
            placeholder="Key label (e.g. WooCommerce store, Backoffice POS)"
            value={label} onChange={(e) => setLabel(e.target.value)}
          />
          <button type="submit" disabled={creating || !label.trim()} className="btn-primary">
            {creating ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
            {creating ? 'Creating…' : 'Generate key'}
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zim-ink-200 bg-white">
        {loading ? (
          <div className="p-10 text-center text-sm text-zim-ink-500">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center">
            <KeyRound className="mx-auto text-zim-ink-300" size={36}/>
            <p className="mt-3 text-sm font-semibold text-zim-ink-700">No keys yet</p>
            <p className="mt-1 text-xs text-zim-ink-500">Generate your first key above to start integrating.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zim-ink-100">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zim-ink-900">{k.label}</p>
                  <p className="mt-0.5 font-mono text-xs text-zim-ink-500">{k.key_prefix}····················</p>
                  <p className="mt-0.5 text-[10.5px] text-zim-ink-400">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && <> · last used {new Date(k.last_used_at).toLocaleDateString()}</>}
                  </p>
                </div>
                {k.revoked_at ? (
                  <span className="rounded-full bg-zim-ink-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zim-ink-500">Revoked</span>
                ) : (
                  <button onClick={() => revoke(k.id)} className="btn-secondary text-xs"><Trash2 size={12}/> Revoke</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
