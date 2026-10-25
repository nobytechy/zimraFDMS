/**
 * Small shared helpers: local time formatting, decimal-safe money maths, enums.
 */

/** ZIMRA wants LOCAL time, no zone, `YYYY-MM-DDTHH:mm:ss` (spec 4.6, 13.2.1). */
export function localIso(date = new Date(), timeZone = 'Africa/Harare') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const g = (t) => parts.find((p) => p.type === t).value
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}`
}

/** Parse a zone-less local ISO string as if it were UTC (only for comparing two such strings). */
export const localMs = (iso) => Date.parse(iso + 'Z')

/** Add seconds to a zone-less local ISO string. */
export const addLocalSeconds = (iso, s) => new Date(localMs(iso) + s * 1000).toISOString().slice(0, 19)

/**
 * receiptDate has 1-second resolution but FDMS requires it to be STRICTLY greater than the
 * previous receipt's (RCPT030) and the day-open time (RCPT014). Two sales within one second
 * would otherwise collide, so bump forward by 1 s when needed.
 */
export function monotonicReceiptDate(nowLocal, ...floors) {
  let d = nowLocal
  for (const f of floors.filter(Boolean)) if (localMs(d) <= localMs(f)) d = addLocalSeconds(f, 1)
  return d
}

/** Round half away from zero to 2dp, tolerant of binary float noise. */
export function r2(x) {
  const n = Number(x)
  const s = n < 0 ? -1 : 1
  return s * Math.round(Math.abs(n) * 100 + 1e-7) / 100
}

/** Amount -> integer cents as a string ("-0" never produced). Spec 13.2.1 row 6. */
export function cents(x) {
  const n = Math.round(Math.abs(Number(x)) * 100 + 1e-7) * (Number(x) < 0 ? -1 : 1)
  return String(n === 0 ? 0 : n)
}

/** Tax percent for signatures: '' if absent, else 2dp ("15.00", "14.50", "0.00"). */
export function pctStr(p) {
  if (p === null || p === undefined || p === '') return ''
  const n = Number(p)
  return Number.isFinite(n) ? n.toFixed(2) : ''
}

export const pad = (n, len) => String(n).padStart(len, '0')

// Enum orders, from spec section 5.4
export const FiscalCounterType = ['SaleByTax', 'SaleTaxByTax', 'CreditNoteByTax', 'CreditNoteTaxByTax', 'DebitNoteByTax', 'DebitNoteTaxByTax', 'BalanceByMoneyType']
export const MoneyType = ['Cash', 'Card', 'MobileWallet', 'Coupon', 'Credit', 'BankTransfer', 'Other']
export const ReceiptType = ['FiscalInvoice', 'CreditNote', 'DebitNote']
export const FiscalDayStatus = ['FiscalDayClosed', 'FiscalDayOpened', 'FiscalDayCloseInitiated', 'FiscalDayCloseFailed']

/** Case-insensitive enum normaliser: 'cash' -> 'Cash'. Returns undefined if unknown. */
export function normEnum(list, v) {
  if (v === undefined || v === null) return undefined
  return list.find((e) => e.toLowerCase() === String(v).toLowerCase())
}

/** RFC 7807 ProblemDetails error carrying an FDMS errorCode. */
export class FdmsError extends Error {
  constructor(status, errorCode, title) {
    super(`${errorCode ? errorCode + ': ' : ''}${title || ''}`)
    this.status = status
    this.errorCode = errorCode
    this.title = title
  }
  toProblem() {
    return { type: `https://httpstatuses.io/${this.status}`, title: this.title || this.message, status: this.status, errorCode: this.errorCode }
  }
}
