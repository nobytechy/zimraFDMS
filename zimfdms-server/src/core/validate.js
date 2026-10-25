/**
 * Spec 4.7 + 8.2.1 — receipt validation rules RCPT010…RCPT048 with colour codes.
 * Used in two places:
 *   • the simulator (as the "FDMS") to colour received receipts
 *   • the device service as a PRE-FLIGHT check, so a receipt that FDMS would
 *     mark Red (and thereby block closeDay) is never sent.
 *
 * validateReceipt(...) returns { errors: [{code,color}], grey: boolean }.
 * grey = a rule needing the previous receipt could not be evaluated (gap in chain).
 */
import { r2, cents, localMs, pctStr } from './util.js'
import { receiptSigString, verifyString, sha256b64 } from './signing.js'

export const COLOR = {
  RCPT010: 'Red', RCPT011: 'Red', RCPT012: 'Red', RCPT013: 'Red', RCPT014: 'Yellow', RCPT015: 'Red',
  RCPT016: 'Red', RCPT017: 'Red', RCPT018: 'Red', RCPT019: 'Red', RCPT020: 'Red', RCPT021: 'Red',
  RCPT022: 'Red', RCPT023: 'Red', RCPT024: 'Red', RCPT025: 'Red', RCPT026: 'Red', RCPT027: 'Red',
  RCPT028: 'Red', RCPT029: 'Red', RCPT030: 'Red', RCPT031: 'Yellow', RCPT032: 'Red', RCPT033: 'Red',
  RCPT034: 'Red', RCPT035: 'Red', RCPT036: 'Red', RCPT037: 'Red', RCPT038: 'Red', RCPT039: 'Red',
  RCPT040: 'Red', RCPT041: 'Yellow', RCPT042: 'Red', RCPT043: 'Red', RCPT047: 'Red', RCPT048: 'Red',
}

const sum = (arr, f) => r2(arr.reduce((s, x) => s + Number(f(x) || 0), 0))
const eq = (a, b) => cents(a) === cents(b)

/**
 * @param {object} receipt   full receipt incl. receiptDeviceSignature
 * @param {object} ctx
 *   deviceID, config:{applicableTaxes,vatNumber}, currencies?, fiscalDayOpened, taxPayerDayMaxHrs,
 *   prev?: previous receipt in day (with receiptDeviceSignature), isFirstOfDay, invoiceExists(invoiceNo)->bool,
 *   findOriginal?(creditDebitNote)->{receipt, priorNotes[]}|null, nowLocal, allowedFutureSec?,
 *   publicKeyPem?, signOpts?
 */
export function validateReceipt(receipt, ctx) {
  const errs = new Set()
  let grey = false
  const add = (c) => errs.add(c)
  const cfg = ctx.config || {}
  const vatPayer = Boolean(cfg.vatNumber)
  const taxes = new Map((cfg.applicableTaxes || []).map((t) => [t.taxID, t]))
  const lines = receipt.receiptLines || []
  const type = receipt.receiptType
  const isCredit = type === 'CreditNote'

  // 010 currency
  const currencies = ctx.currencies || ['USD', 'ZWG', 'ZWL', 'ZAR', 'EUR', 'GBP', 'BWP']
  if (!currencies.includes(receipt.receiptCurrency)) add('RCPT010')

  // 011 / 012 / 030 — chain rules
  const prev = ctx.prev
  if (ctx.isFirstOfDay) {
    if (receipt.receiptCounter !== 1) add('RCPT011')
    // first receipt of day may restart global counter at 1 (spec 4.7)
  } else if (!prev) {
    grey = true
  } else {
    if (receipt.receiptCounter !== prev.receiptCounter + 1) add('RCPT011')
    if (receipt.receiptGlobalNo !== prev.receiptGlobalNo + 1) add('RCPT012')
    if (localMs(receipt.receiptDate) <= localMs(prev.receiptDate)) add('RCPT030')
  }

  // 013
  if (ctx.invoiceExists?.(receipt.invoiceNo)) add('RCPT013')

  // 014 / 031 / 041 dates
  if (ctx.fiscalDayOpened && localMs(receipt.receiptDate) <= localMs(ctx.fiscalDayOpened)) add('RCPT014')
  if (ctx.nowLocal && localMs(receipt.receiptDate) > localMs(ctx.nowLocal) + (ctx.allowedFutureSec ?? 120) * 1000) add('RCPT031')
  if (ctx.fiscalDayOpened && ctx.taxPayerDayMaxHrs &&
      localMs(receipt.receiptDate) > localMs(ctx.fiscalDayOpened) + ctx.taxPayerDayMaxHrs * 3600e3) add('RCPT041')

  // 015 / 029 / 034 credit-debit note data
  if (type !== 'FiscalInvoice') {
    const c = receipt.creditDebitNote
    if (!c || (!c.receiptID && !(c.deviceID && c.receiptGlobalNo && c.fiscalDayNo))) add('RCPT015')
    if (!receipt.receiptNotes) add('RCPT034')
  } else if (receipt.creditDebitNote) add('RCPT029')

  // 016-018
  if (!lines.length) add('RCPT016')
  if (!(receipt.receiptTaxes || []).length) add('RCPT017')
  if (!(receipt.receiptPayments || []).length) add('RCPT018')

  // lines: 022 / 023 / 024 / 047 / 048
  for (const l of lines) {
    const p = l.receiptLinePrice
    if (p !== undefined && p !== null) {
      const sale = l.receiptLineType === 'Sale'
      const ok = isCredit ? (sale ? p < 0 : p > 0) : (sale ? p > 0 : p < 0)
      if (!ok) add('RCPT022')
    }
    if (!(Number(l.receiptLineQuantity) > 0)) add('RCPT023')
    if (p !== undefined && p !== null && !eq(l.receiptLineTotal, Number(p) * Number(l.receiptLineQuantity))) add('RCPT024')
    const pct = l.taxPercent
    if (vatPayer) {
      if (!l.receiptLineHSCode) add('RCPT047')
      else {
        const len = String(l.receiptLineHSCode).length
        const ok = pct > 0 ? (len === 4 || len === 8) : len === 8
        if (!ok) add('RCPT048')
      }
    } else if (l.receiptLineHSCode && ![4, 8].includes(String(l.receiptLineHSCode).length)) add('RCPT048')
  }

  // taxes: 021 / 025 / 026 / 027
  const inclusive = receipt.receiptLinesTaxInclusive !== false
  const checkTax = (t) => {
    const cfgTax = taxes.get(t.taxID)
    if (!cfgTax) { add('RCPT025'); return }
    const same = (cfgTax.taxPercent ?? null) === (t.taxPercent ?? null)
    if (!same) add('RCPT025')
    const d = receipt.receiptDate.slice(0, 10)
    if (cfgTax.taxValidFrom && d < cfgTax.taxValidFrom.slice(0, 10)) add('RCPT025')
    if (cfgTax.taxValidTill && d > cfgTax.taxValidTill.slice(0, 10)) add('RCPT025')
    if (!vatPayer && (cfgTax.taxPercent ?? 0) > 0) add('RCPT021')
  }
  for (const t of receipt.receiptTaxes || []) checkTax(t)
  for (const l of lines) checkTax({ taxID: l.taxID, taxPercent: l.taxPercent })
  for (const t of receipt.receiptTaxes || []) {
    const group = lines.filter((l) => l.taxID === t.taxID && (l.taxCode || '') === (t.taxCode || '') && (l.taxPercent ?? null) === (t.taxPercent ?? null))
    const S = sum(group, (l) => l.receiptLineTotal)
    const p = t.taxPercent || 0
    const expTax = inclusive ? r2(S * p / (100 + p)) : r2(S * p / 100)
    const expSales = inclusive ? S : r2(S * (1 + p / 100))
    if (!eq(t.taxAmount, expTax)) add('RCPT026')
    if (!eq(t.salesAmountWithTax, expSales)) add('RCPT027')
  }

  // 028 payment sign, 019/037/038/039/040 totals
  for (const p of receipt.receiptPayments || []) {
    if (isCredit ? p.paymentAmount > 0 : p.paymentAmount < 0) add('RCPT028')
  }
  const lineSum = sum(lines, (l) => l.receiptLineTotal)
  const taxSum = sum(receipt.receiptTaxes || [], (t) => t.taxAmount)
  if (inclusive) { if (!eq(receipt.receiptTotal, lineSum)) add('RCPT019') }
  else if (!eq(receipt.receiptTotal, lineSum + taxSum)) add('RCPT037')
  if (!eq(receipt.receiptTotal, sum(receipt.receiptTaxes || [], (t) => t.salesAmountWithTax))) add('RCPT038')
  if (!eq(receipt.receiptTotal, sum(receipt.receiptPayments || [], (p) => p.paymentAmount))) add('RCPT039')
  if (isCredit ? receipt.receiptTotal > 0 : receipt.receiptTotal < 0) add('RCPT040')

  // 043 buyer
  const b = receipt.buyerData
  if (b && (!b.buyerRegisterName || !b.buyerTIN)) add('RCPT043')

  // 032 / 033 / 035 / 036 / 042 related receipt
  if (type !== 'FiscalInvoice' && receipt.creditDebitNote && ctx.findOriginal) {
    const found = ctx.findOriginal(receipt.creditDebitNote)
    if (!found) add('RCPT032')
    else {
      const o = found.receipt
      const months = (localMs(receipt.receiptDate) - localMs(o.receiptDate)) / (30.44 * 86400e3)
      if (months > 12) add('RCPT033')
      if (o.receiptCurrency !== receipt.receiptCurrency) add('RCPT042')
      const oTaxes = new Set((o.receiptTaxes || []).map((t) => `${t.taxID}|${pctStr(t.taxPercent)}`))
      if ((receipt.receiptTaxes || []).some((t) => !oTaxes.has(`${t.taxID}|${pctStr(t.taxPercent)}`))) add('RCPT036')
      if (isCredit) {
        const prior = (found.priorNotes || []).reduce((s, n) => s + Number(n.receiptTotal), 0) // credits negative, debits positive
        if (r2(o.receiptTotal + prior + receipt.receiptTotal) < 0) add('RCPT035')
      }
    }
  }

  // 020 device signature
  if (receipt.receiptDeviceSignature) {
    let sigOk = false
    if (ctx.publicKeyPem) {
      try {
        const text = receiptSigString({ deviceID: ctx.deviceID, receipt, previousReceiptHash: ctx.isFirstOfDay ? undefined : prev?.receiptDeviceSignature?.hash }, ctx.signOpts)
        sigOk = receipt.receiptDeviceSignature.hash === sha256b64(text) &&
          verifyString(ctx.publicKeyPem, text, receipt.receiptDeviceSignature.signature, ctx.signOpts)
      } catch { sigOk = false }
    } else sigOk = true // cannot verify without a key (client pre-flight signs it itself)
    if (!sigOk && !(grey && !ctx.isFirstOfDay && !prev)) add('RCPT020')
  } else add('RCPT020')

  const errors = [...errs].sort().map((code) => ({ code, color: COLOR[code] }))
  return { errors, grey }
}

export const worstColor = (errors, grey) =>
  errors.some((e) => e.color === 'Red') ? 'Red' : grey ? 'Grey' : errors.some((e) => e.color === 'Yellow') ? 'Yellow' : null
