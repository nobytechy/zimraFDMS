/**
 * Browser client for the zimFDMS bridge API (Netlify function at /api/fdms/*).
 * The browser never sees keys or signatures — it sends a sale and gets back the fiscalised result.
 * Every call carries the signed-in user's Supabase access token.
 */
import { supabase } from '@/lib/supabase'

const BASE = '/api/fdms'

export class BridgeApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details }
}

async function call(method, path, body) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new BridgeApiError(0, 'OFFLINE', 'No internet connection. Try again when you are online.')
  }
  let json
  try { json = await res.json() } catch { throw new BridgeApiError(res.status, 'BAD_RESPONSE', 'The server did not answer properly. Try again.') }
  if (!json.ok) throw new BridgeApiError(res.status, json.error?.code, json.error?.message || 'Something went wrong', json.error?.details)
  return json.data
}

const qs = (o) => {
  const p = new URLSearchParams()
  Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v) })
  const s = p.toString()
  return s ? '?' + s : ''
}

export const bridge = {
  devices:   ()                 => call('GET', '/devices'),
  connect:   (b)                => call('POST', '/devices/connect', b),
  register:  (id)               => call('POST', `/devices/${id}/register`),
  device:    (id)               => call('GET', `/devices/${id}`),
  refresh:   (id)               => call('POST', `/devices/${id}/refresh`),
  openDay:   (id)               => call('POST', `/devices/${id}/open-day`),
  closeDay:  (id)               => call('POST', `/devices/${id}/close-day`),
  flush:     (id)               => call('POST', `/devices/${id}/flush`),
  sell:      (id, sale)         => call('POST', `/devices/${id}/sell`, sale),
  receipts:  (id, filters)      => call('GET', `/devices/${id}/receipts${qs(filters)}`),
  receipt:   (id, globalNo)     => call('GET', `/devices/${id}/receipts/${globalNo}`),
  series:    (id, days = 14)    => call('GET', `/devices/${id}/series?days=${days}`),
  days:      (id)               => call('GET', `/devices/${id}/days`),
  day:       (id, no)           => call('GET', `/devices/${id}/days/${no}`),
}

/** Public receipt lookup (QR target) — no auth, goes straight to Supabase RPC. */
export async function verifyReceipt(invoiceNo) {
  if (!invoiceNo) return { error: { message: 'Invoice number required' } }
  const { data, error } = await supabase.rpc('fdms_verify_receipt', { p_invoice_no: invoiceNo.trim() })
  if (error) return { error }
  if (!data) return { error: { message: 'No receipt found with that reference' } }
  return { data }
}
