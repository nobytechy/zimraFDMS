/**
 * HTTP API for the bridge. Framework-free: (Request) -> Response (Web standard; works in
 * Netlify Functions v2, Cloudflare, Deno, Node 18+ with a tiny adapter).
 *
 *   createApi({ service, store, authenticate, baseUrlFor, prefix })
 *     authenticate(request) -> { merchantId }   (throws ApiError(401) otherwise)
 *
 * Every device route checks that the device belongs to the authenticated merchant. Secrets
 * (sealed keys, activation key) never leave the server; responses use DeviceService.publicView.
 */
import { BridgeError, DeviceService } from '../core/device.js'
import { FdmsHttpError } from '../core/client.js'
import { FdmsError } from '../core/util.js'

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details }
}

const BRIDGE_STATUS = {
  NOT_FOUND: 404, DEVICE_OWNED: 409, ALREADY_REGISTERED: 409, DAY_ALREADY_OPEN: 409, DAY_NOT_OPEN: 409,
  UNSENT_RECEIPTS: 409, DAY_TOO_LONG: 409, VAT_STATUS_CHANGED: 409, PREFLIGHT_FAILED: 422,
  CLOSE_FAILED: 502, CLOSE_PENDING: 202, FDMS_DAY_NOT_CLOSED: 409,
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

function mapError(e) {
  if (e instanceof ApiError) return json(e.status, { ok: false, error: { code: e.code, message: e.message, details: e.details } })
  if (e instanceof BridgeError) return json(BRIDGE_STATUS[e.code] || 400, { ok: false, error: { code: e.code, message: e.message, details: e.details } })
  if (e instanceof FdmsHttpError) {
    const status = e.status >= 500 || e.retryable ? 502 : 422
    return json(status, { ok: false, error: { code: e.errorCode || 'FDMS_ERROR', message: e.title || 'FDMS rejected the request', fdmsStatus: e.status } })
  }
  if (e instanceof FdmsError) return json(e.status, { ok: false, error: { code: e.errorCode, message: e.title } })
  if (e?.code === '23505') return json(409, { ok: false, error: { code: 'DUPLICATE', message: 'Duplicate invoice number or receipt' } })
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT'].includes(e?.code) || /fetch failed|timeout|socket hang up/i.test(e?.message || '')) {
    return json(502, { ok: false, error: { code: 'FDMS_UNREACHABLE', message: 'Could not reach ZIMRA FDMS. Try again shortly.' } })
  }
  console.error('[zimfdms] unexpected error', e)
  return json(500, { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong' } })
}

const int = (v, name) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'BAD_REQUEST', `${name} must be a positive whole number`)
  return n
}
const str = (v, name, max = 100) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new ApiError(400, 'BAD_REQUEST', `${name} is required`)
  return v.trim()
}

/** Lean, secret-free device summary for the browser. */
function deviceView(v) {
  const rs = v.day?.receipts || []
  return {
    deviceID: v.deviceID, env: v.env, state: v.state, mode: v.mode ?? null, serialNo: v.serialNo, taxpayer: v.taxpayer ?? null,
    certValidTill: v.certValidTill ?? null, lastGlobalNo: v.lastGlobalNo, lastDayNo: v.lastDayNo,
    config: v.config ? { qrUrl: v.config.qrUrl, taxPayerName: v.config.taxPayerName, vatNumber: v.config.vatNumber, taxPayerDayMaxHrs: v.config.taxPayerDayMaxHrs, applicableTaxes: v.config.applicableTaxes } : null,
    day: v.day ? { status: v.day.status, no: v.day.no, opened: v.day.opened, receipts: rs.length, queued: rs.filter((r) => r.status === 'queued').length, rejected: rs.filter((r) => r.status === 'rejected').length, total: Math.round(rs.reduce((t, r) => t + (r.receipt?.receiptTotal || 0), 0) * 100) / 100 } : null,
  }
}

function receiptRow(r) {
  const d = r.data || r
  return {
    invoiceNo: r.invoice_no, globalNo: r.receipt_global_no, dayNo: r.day_no, type: r.receipt_type, currency: r.currency,
    total: Number(r.total), date: r.receipt_date, status: r.status, errorCode: r.error_code ?? null,
    receiptID: d.receiptID ?? null, qrUrl: d.qr?.url ?? null, verificationCode: d.qr?.verificationCode ?? null,
  }
}

// whitelist what a browser may send as a sale; everything else (signatures, numbers, dates, hooks) is server-owned
function cleanSale(b) {
  if (!b || typeof b !== 'object') throw new ApiError(400, 'BAD_REQUEST', 'Body required')
  const { invoiceNo, receiptCurrency, receiptType, lines, payments, buyerData, receiptNotes, receiptLinesTaxInclusive, creditDebitNote, discount } = b
  if (!Array.isArray(lines) || !lines.length || lines.length > 500) throw new ApiError(400, 'BAD_REQUEST', 'Add at least one item')
  return { invoiceNo: str(String(invoiceNo ?? ''), 'invoiceNo', 50), receiptCurrency: str(receiptCurrency, 'receiptCurrency', 3), receiptType, lines, payments, buyerData, receiptNotes, receiptLinesTaxInclusive, creditDebitNote, discount }
}

export function createApi({ service, store, authenticate, baseUrlFor, prefix = '/api/fdms' }) {
  async function owned(merchantId, id) {
    const owner = await store.ownerOf(id)
    if (!owner || owner !== merchantId) throw new ApiError(404, 'NOT_FOUND', 'Device not found') // same answer for "not yours"
    return id
  }

  return async function handle(request) {
    try {
      const url = new URL(request.url)
      let path = url.pathname
      if (!path.startsWith(prefix)) throw new ApiError(404, 'NOT_FOUND', 'Not found')
      path = path.slice(prefix.length).replace(/\/+$/, '') || '/'
      const m = request.method
      const { merchantId } = await authenticate(request)
      if (!merchantId) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in first')
      const body = async () => { try { return await request.json() } catch { throw new ApiError(400, 'BAD_REQUEST', 'Invalid JSON') } }
      const ok = (data) => json(200, { ok: true, data })

      if (path === '/devices' && m === 'GET') {
        const rows = await store.devicesOf(merchantId)
        return ok(rows.map((r) => ({ deviceID: r.device_id, env: r.env, state: r.state, mode: r.data.mode ?? null, taxpayer: r.data.taxpayer ?? null })))
      }
      if (path === '/devices/connect' && m === 'POST') {
        const b = await body()
        const env = b.env === 'live' ? 'live' : 'test'
        const baseUrl = baseUrlFor(env)
        if (!baseUrl) throw new ApiError(400, 'ENV_UNAVAILABLE', `The ${env} environment is not enabled on this server`)
        const taxpayer = await service.connect({
          deviceID: int(b.deviceID, 'deviceID'), serialNo: str(b.serialNo, 'serialNo'), activationKey: str(b.activationKey, 'activationKey', 20),
          baseUrl, env, merchantId,
        })
        return ok({ taxpayer })
      }

      const mm = path.match(/^\/devices\/(\d+)(?:\/(.+))?$/)
      if (!mm) throw new ApiError(404, 'NOT_FOUND', 'Not found')
      const id = await owned(merchantId, Number(mm[1]))
      const sub = mm[2] || ''

      if (sub === '' && m === 'GET') return ok(deviceView(await service.view(id)))
      if (sub === 'register' && m === 'POST') return ok(deviceView(await service.register(id)))
      if (sub === 'refresh' && m === 'POST') { await service.refreshConfig(id); return ok(deviceView(await service.view(id))) }
      if (sub === 'renew' && m === 'POST') return ok(await service.renewCertificateIfNeeded(id))
      if (sub === 'open-day' && m === 'POST') { await service.openDay(id); return ok(deviceView(await service.view(id))) }
      if (sub === 'flush' && m === 'POST') return ok(await service.flush(id))
      if (sub === 'close-day' && m === 'POST') { const r = await service.closeDay(id); return ok({ result: r, device: deviceView(await service.view(id)) }) }
      if (sub === 'sell' && m === 'POST') {
        const r = await service.sell(id, cleanSale(await body()))
        return ok({ status: r.status, receiptID: r.receiptID ?? null, serverSigVerified: r.serverSigVerified ?? null, receipt: r.receipt, qr: r.qr })
      }
      if (sub === 'receipts' && m === 'GET') {
        const q = Object.fromEntries(url.searchParams)
        const rows = await store.searchReceipts(id, { q: q.q, status: q.status, type: q.type, from: q.from, to: q.to, dayNo: q.dayNo ? int(q.dayNo, 'dayNo') : undefined, limit: q.limit, offset: q.offset })
        return ok(rows.map(receiptRow))
      }
      const rm = sub.match(/^receipts\/(\d+)$/)
      if (rm && m === 'GET') {
        const r = await store.receiptByGlobalNo(id, Number(rm[1]))
        if (!r) throw new ApiError(404, 'NOT_FOUND', 'Receipt not found')
        return ok(r)
      }
      if (sub === 'series' && m === 'GET') {
        const days = Math.min(Number(url.searchParams.get('days')) || 14, 90)
        const from = new Date(Date.now() + 2 * 3600e3 - (days - 1) * 86400e3).toISOString().slice(0, 10) // Harare = UTC+2
        return ok(await store.seriesByDay(id, from))
      }
      if (sub === 'days' && m === 'GET') {
        const rows = await store.daysOf(id)
        return ok(rows.map((d) => ({ dayNo: d.day_no, status: d.status, opened: d.data.opened ?? null, closed: d.data.closedAt ?? null })))
      }
      const dm = sub.match(/^days\/(\d+)$/)
      if (dm && m === 'GET') {
        const days = await store.daysOf(id, 1000)
        const day = days.find((d) => d.day_no === Number(dm[1]))
        if (!day) throw new ApiError(404, 'NOT_FOUND', 'Day not found')
        return ok({ dayNo: day.day_no, status: day.status, ...day.data, receipts: await store.dayReceipts(id, day.day_no) })
      }
      throw new ApiError(404, 'NOT_FOUND', 'Not found')
    } catch (e) {
      return mapError(e)
    }
  }
}

/** Supabase auth: verify the browser's access token with Supabase, then find the merchant row. */
export function supabaseAuthenticator({ supabaseUrl, anonKey, db, fetchImpl = fetch }) {
  return async function authenticate(request) {
    const h = request.headers.get('authorization') || ''
    const token = h.startsWith('Bearer ') ? h.slice(7) : ''
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in first')
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: anonKey } })
    if (!res.ok) throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired — sign in again')
    const user = await res.json()
    const row = (await db.query('select id from fdms_merchants where user_id = $1 limit 1', [user.id])).rows[0]
    if (!row) throw new ApiError(403, 'NO_MERCHANT', 'No merchant account for this user')
    return { merchantId: row.id }
  }
}

export { DeviceService }
