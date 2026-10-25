/**
 * Builds spec-correct receipts from simple input, and maintains fiscal counters (spec section 6).
 *
 * Key difference from the old zimFDMS code: tax is computed ONCE PER TAX GROUP
 * (sum of line totals, then rounded), not per line — which is what RCPT026/027 check.
 */
import { r2, normEnum, ReceiptType, MoneyType } from './util.js'

const taxKey = (t) => `${t.taxID}|${t.taxCode || ''}|${t.taxPercent ?? 'EX'}`

/**
 * @param {object} input
 *   receiptType, receiptCurrency, invoiceNo, receiptLinesTaxInclusive (default true),
 *   lines: [{ name, quantity, price, taxID, type?: 'Sale'|'Discount', hsCode?, taxCode? }]  (price = positive magnitude)
 *   payments?: [{ moneyTypeCode, amount? }]   (amount = positive magnitude; omit for single payment of the total)
 *   buyer?, receiptNotes?, creditDebitNote?, receiptPrintForm?, username?, userNameSurname?
 * @param {object} config  getConfig result: { applicableTaxes: [{taxID,taxPercent?}] }
 * @returns receipt WITHOUT receiptCounter / receiptGlobalNo / receiptDate / receiptDeviceSignature
 */
export function buildReceipt(input, config) {
  const receiptType = normEnum(ReceiptType, input.receiptType || 'FiscalInvoice')
  if (!receiptType) throw new Error(`Unknown receiptType ${input.receiptType}`)
  const inclusive = input.receiptLinesTaxInclusive !== false
  const noteSign = receiptType === 'CreditNote' ? -1 : 1
  const taxById = new Map((config.applicableTaxes || []).map((t) => [t.taxID, t]))

  const lines = (input.lines || []).map((l, i) => {
    const type = l.type === 'Discount' ? 'Discount' : 'Sale'
    const tax = taxById.get(l.taxID)
    if (!tax) throw new Error(`Line ${i + 1}: unknown taxID ${l.taxID}`)
    const sign = (type === 'Sale' ? 1 : -1) * noteSign
    const price = r2(sign * Math.abs(Number(l.price)))
    const quantity = Number(l.quantity)
    const line = {
      receiptLineType: type,
      receiptLineNo: i + 1,
      receiptLineName: String(l.name),
      receiptLinePrice: price,
      receiptLineQuantity: quantity,
      receiptLineTotal: r2(price * quantity),
      taxID: tax.taxID,
    }
    if (l.hsCode) line.receiptLineHSCode = String(l.hsCode)
    const code = l.taxCode ?? tax.taxCode
    if (code) line.taxCode = code
    if (tax.taxPercent !== undefined && tax.taxPercent !== null) line.taxPercent = Number(tax.taxPercent)
    return line
  })

  // Group by tax
  const groups = new Map()
  for (const l of lines) {
    const k = taxKey(l)
    const g = groups.get(k) || { taxCode: l.taxCode, taxPercent: l.taxPercent, taxID: l.taxID, sum: 0 }
    g.sum = r2(g.sum + l.receiptLineTotal)
    groups.set(k, g)
  }
  const receiptTaxes = [...groups.values()].map((g) => {
    const p = g.taxPercent
    let taxAmount = 0
    let sales = g.sum
    if (p) {
      if (inclusive) taxAmount = r2(g.sum * p / (100 + p))
      else { taxAmount = r2(g.sum * p / 100); sales = r2(g.sum + taxAmount) }
    }
    const t = { taxID: g.taxID, taxAmount, salesAmountWithTax: sales }
    if (g.taxCode) t.taxCode = g.taxCode
    if (p !== undefined) t.taxPercent = p
    return t
  })
  const receiptTotal = r2(receiptTaxes.reduce((s, t) => s + t.salesAmountWithTax, 0))

  const payIn = input.payments?.length ? input.payments : [{ moneyTypeCode: 'Cash' }]
  const receiptPayments = payIn.map((p, i) => {
    const mt = normEnum(MoneyType, p.moneyTypeCode)
    if (!mt) throw new Error(`Unknown moneyTypeCode ${p.moneyTypeCode}`)
    const amt = p.amount === undefined ? (payIn.length === 1 ? Math.abs(receiptTotal) : NaN) : Math.abs(Number(p.amount))
    if (!Number.isFinite(amt)) throw new Error(`Payment ${i + 1}: amount required when several payments are used`)
    return { moneyTypeCode: mt, paymentAmount: r2(amt * (receiptType === 'CreditNote' ? -1 : 1)) }
  })

  const receipt = {
    receiptType,
    receiptCurrency: String(input.receiptCurrency).toUpperCase(),
    invoiceNo: String(input.invoiceNo),
    receiptLinesTaxInclusive: inclusive,
    receiptLines: lines,
    receiptTaxes,
    receiptPayments,
    receiptTotal,
    receiptPrintForm: input.receiptPrintForm || 'Receipt48',
  }
  if (input.buyer) receipt.buyerData = input.buyer
  if (input.receiptNotes) receipt.receiptNotes = input.receiptNotes
  if (input.creditDebitNote) receipt.creditDebitNote = input.creditDebitNote
  if (input.username) receipt.username = input.username
  if (input.userNameSurname) receipt.userNameSurname = input.userNameSurname
  return receipt
}

// ─── Fiscal counters (section 6) ───────────────────────────────────────────

const BY_TYPE = {
  FiscalInvoice: ['SaleByTax', 'SaleTaxByTax'],
  CreditNote: ['CreditNoteByTax', 'CreditNoteTaxByTax'],
  DebitNote: ['DebitNoteByTax', 'DebitNoteTaxByTax'],
}

/** Pure: returns a NEW counters Map after applying `receipt`. Map key -> FiscalDayCounter. */
export function applyReceiptToCounters(counters, receipt) {
  const out = new Map(counters)
  const bump = (key, base, value) => {
    const cur = out.get(key) || { ...base, fiscalCounterValue: 0 }
    out.set(key, { ...cur, fiscalCounterValue: r2(cur.fiscalCounterValue + value) })
  }
  const [saleType, taxType] = BY_TYPE[receipt.receiptType]
  const cur = receipt.receiptCurrency
  for (const t of receipt.receiptTaxes) {
    const base = { fiscalCounterCurrency: cur, fiscalCounterTaxID: t.taxID }
    if (t.taxPercent !== undefined) base.fiscalCounterTaxPercent = t.taxPercent
    bump(`${saleType}|${cur}|${t.taxID}|${t.taxPercent ?? ''}`, { fiscalCounterType: saleType, ...base }, t.salesAmountWithTax)
    bump(`${taxType}|${cur}|${t.taxID}|${t.taxPercent ?? ''}`, { fiscalCounterType: taxType, ...base }, t.taxAmount)
  }
  for (const p of receipt.receiptPayments) {
    bump(`BalanceByMoneyType|${cur}|${p.moneyTypeCode}`,
      { fiscalCounterType: 'BalanceByMoneyType', fiscalCounterCurrency: cur, fiscalCounterMoneyType: p.moneyTypeCode },
      p.paymentAmount)
  }
  return out
}

/** Non-zero counters only (spec: zero counters must not be submitted). */
export const countersToArray = (m) => [...m.values()].filter((c) => c.fiscalCounterValue !== 0)

export function countersFromReceipts(receipts) {
  let m = new Map()
  for (const r of receipts) m = applyReceiptToCounters(m, r)
  return countersToArray(m)
}
