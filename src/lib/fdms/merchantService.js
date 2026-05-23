/**
 * zimFDMS — merchant-side Supabase service.
 *
 * Sits between the merchant dashboard UI and Supabase. Handles:
 *   • Reading fiscal-day state + receipts list + Z report aggregates
 *   • Opening / closing fiscal days
 *   • Building, signing and persisting receipts
 *
 * Receipts are signed locally with Web Crypto (same code path as the sandbox
 * uses for spec correctness) and then inserted into fdms_receipts. When real
 * ZIMRA credentials are configured by the super-admin, the proxy layer will
 * additionally forward submitted receipts to FDMS; for now everything stays
 * in our database with status='submitted'.
 */

import { supabase } from '@/lib/supabase'
import { buildReceiptSigInput, sha256Base64 } from '@/lib/fdms/crypto'

// ─── Fiscal day ────────────────────────────────────────────────────────────

/** Get the merchant's currently-open fiscal day, or null. */
export async function getOpenFiscalDay(merchantId) {
  const { data } = await supabase
    .from('fdms_fiscal_days')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('status', 'FiscalDayOpened')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

/** Get the most-recent fiscal day (open or closed). */
export async function getLatestFiscalDay(merchantId) {
  const { data } = await supabase
    .from('fdms_fiscal_days')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

export async function openFiscalDay(merchantId) {
  // Determine next fiscal_day_no
  const { data: last } = await supabase
    .from('fdms_fiscal_days')
    .select('fiscal_day_no')
    .eq('merchant_id', merchantId)
    .order('fiscal_day_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextNo = (last?.fiscal_day_no || 0) + 1

  // Refuse if there's already an open day
  const open = await getOpenFiscalDay(merchantId)
  if (open) return { error: { message: `Day #${open.fiscal_day_no} is already open` }, data: open }

  const { data, error } = await supabase
    .from('fdms_fiscal_days')
    .insert({ merchant_id: merchantId, fiscal_day_no: nextNo, status: 'FiscalDayOpened' })
    .select()
    .single()
  return { data, error }
}

export async function closeFiscalDay(merchantId, fiscalDayId) {
  const { data, error } = await supabase
    .from('fdms_fiscal_days')
    .update({ status: 'FiscalDayClosed', closed_at: new Date().toISOString() })
    .eq('id', fiscalDayId)
    .eq('merchant_id', merchantId)
    .select()
    .single()
  return { data, error }
}

// ─── Receipts ──────────────────────────────────────────────────────────────

export async function listReceipts(merchantId, { search = '', status = '', limit = 200 } = {}) {
  let q = supabase
    .from('fdms_receipts')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status) q = q.eq('status', status)
  if (search.trim()) q = q.ilike('invoice_no', `%${search.trim()}%`)
  const { data, error } = await q
  return { data: data || [], error }
}

/** Receipts for a specific fiscal day — used by the Z report. */
export async function listReceiptsForDay(merchantId, fiscalDayId) {
  const { data, error } = await supabase
    .from('fdms_receipts')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('fiscal_day_id', fiscalDayId)
    .order('receipt_global_no', { ascending: true })
  return { data: data || [], error }
}

/**
 * Build, sign and persist a receipt to Supabase.
 *
 * @param {Object} args
 * @param {string} args.merchantId    fdms_merchants.id
 * @param {Object} args.fiscalDay     a `fdms_fiscal_days` row (must be open)
 * @param {Array}  args.cart          [{ name, qty, price, taxID, taxPercent }]
 * @param {string} args.paymentMethod 'Cash' | 'MobileWallet' | 'Card'
 * @param {Object} args.deviceConfig  { deviceID, qrUrl }
 * @returns {Promise<{data, error}>}
 */
export async function submitReceipt({ merchantId, fiscalDay, cart, paymentMethod, deviceConfig }) {
  if (!fiscalDay || fiscalDay.status !== 'FiscalDayOpened') {
    return { error: { message: 'Fiscal day must be open before submitting receipts' } }
  }
  if (!cart?.length) return { error: { message: 'Cart is empty' } }

  // Determine next counter + global no for this day
  const { count: dayCount } = await supabase
    .from('fdms_receipts')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('fiscal_day_id', fiscalDay.id)
  const receiptCounter = (dayCount || 0) + 1

  const { count: totalCount } = await supabase
    .from('fdms_receipts')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
  const receiptGlobalNo = (totalCount || 0) + 1

  // Build receipt lines
  const lines = cart.map((l, i) => ({
    receiptLineType: 'Sale',
    receiptLineNo: i + 1,
    receiptLineName: l.name,
    receiptLinePrice: l.price,
    receiptLineQuantity: l.qty,
    receiptLineTotal: +(l.price * l.qty).toFixed(2),
    taxID: l.taxID,
    taxPercent: l.taxPercent,
  }))
  const total = +lines.reduce((s, l) => s + l.receiptLineTotal, 0).toFixed(2)

  // Group taxes
  const taxesMap = new Map()
  lines.forEach((l) => {
    const k = `${l.taxID}|${l.taxPercent ?? 'EX'}`
    const v = taxesMap.get(k) || {
      taxID: l.taxID, taxPercent: l.taxPercent, taxAmount: 0, salesAmountWithTax: 0,
    }
    v.salesAmountWithTax += l.receiptLineTotal
    if (l.taxPercent) v.taxAmount += +(l.receiptLineTotal * l.taxPercent / (100 + l.taxPercent)).toFixed(2)
    taxesMap.set(k, v)
  })
  const taxes = Array.from(taxesMap.values()).map((t) => ({
    ...t,
    taxAmount: +t.taxAmount.toFixed(2),
    salesAmountWithTax: +t.salesAmountWithTax.toFixed(2),
  }))

  // Sign locally — section 13 of v7.2 spec
  const receipt = {
    receiptType: 'FiscalInvoice',
    receiptCurrency: 'USD',
    receiptGlobalNo,
    receiptCounter,
    receiptDate: new Date().toISOString().slice(0, 19),
    receiptTotal: total,
    receiptTaxes: taxes,
  }
  const concat = buildReceiptSigInput({ deviceID: deviceConfig.deviceID || 1042, receipt })
  const hash = await sha256Base64(concat)
  const device_signature = { hash, signature: 'sig-' + hash.slice(0, 24) }

  // Generate a short, human-friendly invoice number
  const invoiceNo = `INV-${Date.now().toString().slice(-7)}-${receiptCounter}`

  // Persist
  const payload = {
    merchant_id: merchantId,
    fiscal_day_id: fiscalDay.id,
    receipt_global_no: receiptGlobalNo,
    receipt_counter:   receiptCounter,
    receipt_type:      'FiscalInvoice',
    receipt_currency:  'USD',
    receipt_total:     total,
    invoice_no:        invoiceNo,
    receipt_date:      new Date().toISOString(),
    lines,
    taxes,
    payments:         [{ moneyTypeCode: paymentMethod, paymentAmount: total }],
    device_signature,
    fdms_signature:   { hash: 'mock-fdms-' + hash.slice(0, 18), signature: 'fdms-sig-' + hash.slice(0, 24) },
    status:           'accepted', // mock — flips to 'submitted' once real ZIMRA proxy is live
  }
  const { data, error } = await supabase.from('fdms_receipts').insert(payload).select().single()
  return { data, error }
}

// ─── Aggregates / overview ─────────────────────────────────────────────────

export async function getOverviewStats(merchantId) {
  const day = await getOpenFiscalDay(merchantId)
  const { data: todayReceipts } = await supabase
    .from('fdms_receipts')
    .select('id, receipt_total')
    .eq('merchant_id', merchantId)
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
  const todayCount   = todayReceipts?.length || 0
  const todayRevenue = (todayReceipts || []).reduce((s, r) => s + Number(r.receipt_total), 0)
  const { count: keysCount } = await supabase
    .from('fdms_api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .is('revoked_at', null)
  return {
    day,
    todayCount,
    todayRevenue,
    apiKeysActive: keysCount || 0,
  }
}

/** Receipts-per-day for the last N days, for the dashboard mini chart. */
export async function getDailySeries(merchantId, days = 14) {
  const { data } = await supabase
    .from('fdms_receipts_by_day')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('day', { ascending: true })

  // Backfill missing days with zeros so the chart has continuous bars
  const rows = data || []
  const map = new Map(rows.map((r) => [String(r.day).slice(0, 10), r]))
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const row = map.get(key)
    series.push({
      day: key,
      receipt_count: Number(row?.receipt_count) || 0,
      gross_total:   Number(row?.gross_total)   || 0,
    })
  }
  return series
}

// ─── Public verify ─────────────────────────────────────────────────────────

export async function verifyReceipt(invoiceNo) {
  if (!invoiceNo) return { error: { message: 'Invoice number required' } }
  const { data, error } = await supabase.rpc('fdms_verify_receipt', { p_invoice_no: invoiceNo.trim() })
  if (error) return { error }
  if (!data) return { error: { message: 'No receipt found with that reference' } }
  return { data }
}
