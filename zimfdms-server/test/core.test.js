import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { receiptSigString, sha256b64, concatReceiptTaxes, concatCounters, signString, verifyString } from '../src/core/signing.js'
import { buildQr, receiptQrData } from '../src/core/qr.js'
import { buildReceipt, countersFromReceipts } from '../src/core/receipt.js'
import { validateReceipt } from '../src/core/validate.js'
import { seal, open, newMasterKey } from '../src/core/secrets.js'
import { cents, pctStr, localIso, r2 } from '../src/core/util.js'

const PREV = 'hNVJXP/ACOiE8McD3pKsDlqBXpuaUqQOfPnMyfZWI9k='

// ── Spec section 13.2.1 worked examples ──────────────────────────────────────
test('spec 13.2.1: tax concatenation strings match the spec "Result" lines exactly', () => {
  const ex1 = [
    { taxID: 1, taxCode: 'A', taxAmount: 0, salesAmountWithTax: 2500 },
    { taxID: 2, taxCode: 'B', taxPercent: 0, taxAmount: 0, salesAmountWithTax: 3500 },
    { taxID: 3, taxCode: 'C', taxPercent: 15, taxAmount: 150, salesAmountWithTax: 1150 },
    { taxID: 3, taxCode: 'D', taxPercent: 15, taxAmount: 300, salesAmountWithTax: 2300 },
  ]
  assert.equal(concatReceiptTaxes(ex1), 'A0250000B0.000350000C15.0015000115000D15.0030000230000')
  const ex2 = [
    { taxID: 1, taxAmount: 0, salesAmountWithTax: 7 },
    { taxID: 2, taxPercent: 0, taxAmount: 0, salesAmountWithTax: 10 },
    { taxID: 3, taxPercent: 14.5, taxAmount: 0.05, salesAmountWithTax: 0.35 },
  ]
  assert.equal(concatReceiptTaxes(ex2), '07000.000100014.50535')
  const credit2 = [
    { taxID: 1, taxAmount: 0, salesAmountWithTax: -7 },
    { taxID: 2, taxPercent: 0, taxAmount: 0, salesAmountWithTax: -10 },
    { taxID: 3, taxPercent: 14.5, taxAmount: -3, salesAmountWithTax: -23 },
  ]
  assert.equal(concatReceiptTaxes(credit2), '0-7000.000-100014.50-300-2300')
})

test('spec 13.2.1: CreditNote example 2 reproduces the spec hash end-to-end (no separator, per 13.1)', () => {
  const s = receiptSigString({
    deviceID: 322,
    receipt: { receiptType: 'CREDITNOTE', receiptCurrency: 'USD', receiptGlobalNo: 85, receiptDate: '2020-09-19T09:23:07', receiptTotal: -40.35,
      receiptTaxes: [{ taxID: 1, taxAmount: 0, salesAmountWithTax: -7 }, { taxID: 2, taxPercent: 0, taxAmount: 0, salesAmountWithTax: -10 }, { taxID: 3, taxPercent: 14.5, taxAmount: -3, salesAmountWithTax: -23 }] },
    previousReceiptHash: PREV,
  })
  assert.equal(s, '322CREDITNOTEUSD852020-09-19T09:23:07-40350-7000.000-100014.50-300-2300' + PREV)
  assert.equal(sha256b64(s), 'F9/QB0vhxQlEF2nk+oebwP8V+qBcNlOFvoTeE/1QxPc=')
})

test('spec 13.2.1: FiscalInvoice example 1 — string is identical; hash needs separator " " (spec inconsistency, see README)', () => {
  const receipt = { receiptType: 'FISCALINVOICE', receiptCurrency: 'ZWL', receiptGlobalNo: 432, receiptDate: '2019-09-19T15:43:12', receiptTotal: 9450,
    receiptTaxes: [
      { taxID: 1, taxCode: 'A', taxAmount: 0, salesAmountWithTax: 2500 }, { taxID: 2, taxCode: 'B', taxPercent: 0, taxAmount: 0, salesAmountWithTax: 3500 },
      { taxID: 3, taxCode: 'C', taxPercent: 15, taxAmount: 150, salesAmountWithTax: 1150 }, { taxID: 3, taxCode: 'D', taxPercent: 15, taxAmount: 300, salesAmountWithTax: 2300 }] }
  const body = '321FISCALINVOICEZWL4322019-09-19T15:43:12945000A0250000B0.000350000C15.0015000115000D15.0030000230000'
  assert.equal(receiptSigString({ deviceID: 321, receipt }), body)
  assert.equal(receiptSigString({ deviceID: 321, receipt, previousReceiptHash: PREV }), body + PREV)
  // The spec's printed hash only reproduces with a space — must be settled on the ZIMRA test environment:
  assert.equal(sha256b64(receiptSigString({ deviceID: 321, receipt, previousReceiptHash: PREV }, { separator: ' ' })), 'zDxEalWUpwX2BcsYxRUAEfY/13OaCrTwDt01So3a6uU=')
})

test('money & percent formatting', () => {
  assert.equal(cents(12.34), '1234'); assert.equal(cents(0.05), '5'); assert.equal(cents(40.35), '4035')
  assert.equal(cents(-40.35), '-4035'); assert.equal(cents(0), '0'); assert.equal(cents(-0.001), '0')
  assert.equal(pctStr(15), '15.00'); assert.equal(pctStr(14.5), '14.50'); assert.equal(pctStr(0), '0.00'); assert.equal(pctStr(undefined), '')
  assert.equal(r2(1.005), 1.01); assert.equal(r2(-1.005), -1.01)
})

test('dates are LOCAL (Harare, UTC+2), zone-less, no ms', () => {
  assert.equal(localIso(new Date('2026-10-25T15:16:47.123Z'), 'Africa/Harare'), '2026-10-25T17:16:47')
  assert.equal(localIso(new Date('2026-10-25T23:30:00Z'), 'Africa/Harare'), '2026-10-26T01:30:00')
})

// ── QR (section 11) ──────────────────────────────────────────────────────────
test('QR layout matches spec example 1 (everything except the MD5 part, which needs a real signature)', () => {
  const q = buildQr({ qrUrl: 'https://invoice.zimra.co.zw/', deviceID: 321, receiptDate: '2023-04-03T10:00:00', receiptGlobalNo: 1112223331, signatureB64: Buffer.from('x').toString('base64') })
  assert.ok(q.url.startsWith('https://invoice.zimra.co.zw/00000003210304202311122233 31'.replace(' ', '')))
  assert.match(q.url, /^https:\/\/invoice\.zimra\.co\.zw\/0000000321030420231112223331[0-9A-F]{16}$/)
  assert.match(q.verificationCode, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/)
  const q2 = buildQr({ qrUrl: 'https://invoice.zimra.co.zw', deviceID: 322, receiptDate: '2023-04-04T10:00:00', receiptGlobalNo: 1332, signatureB64: 'AAAA' })
  assert.match(q2.url, /^https:\/\/invoice\.zimra\.co\.zw\/0000000322040420230000001332[0-9A-F]{16}$/)
  assert.equal(receiptQrData('AAAA').length, 16)
  assert.notEqual(receiptQrData('AAAA'), receiptQrData('AAAA', { md5Input: 'hex' }))
})

// ── Receipt builder & tax maths ──────────────────────────────────────────────
const CFG = { vatNumber: '123', applicableTaxes: [{ taxID: 1, taxName: 'Exempt', taxValidFrom: '2020-01-01' }, { taxID: 2, taxPercent: 0, taxValidFrom: '2020-01-01' }, { taxID: 3, taxPercent: 15, taxValidFrom: '2020-01-01' }] }

test('tax is computed per tax GROUP (what RCPT026 checks), not per line', () => {
  // 10 lines of 0.35 inclusive @15%: per-line rounding gives 10*0.05 = 0.50; group gives 3.50*15/115 = 0.46
  const r = buildReceipt({ receiptType: 'FiscalInvoice', receiptCurrency: 'usd', invoiceNo: 'A1',
    lines: Array.from({ length: 10 }, (_, i) => ({ name: `i${i}`, quantity: 1, price: 0.35, taxID: 3, hsCode: '85456852' })) }, CFG)
  assert.equal(r.receiptTaxes.length, 1)
  assert.equal(r.receiptTaxes[0].taxAmount, 0.46)
  assert.equal(r.receiptTaxes[0].salesAmountWithTax, 3.5)
  assert.equal(r.receiptTotal, 3.5)
  assert.equal(r.receiptCurrency, 'USD')
})

test('discount lines, credit-note signs, exclusive tax and multi-payment', () => {
  const inv = buildReceipt({ receiptType: 'FiscalInvoice', receiptCurrency: 'USD', invoiceNo: 'A2',
    lines: [{ name: 'Beer', quantity: 3, price: 2, taxID: 3, hsCode: '22030000' }, { name: 'Discount', quantity: 1, price: 1, taxID: 3, type: 'Discount', hsCode: '22030000' }],
    payments: [{ moneyTypeCode: 'cash', amount: 2 }, { moneyTypeCode: 'MobileWallet', amount: 3 }] }, CFG)
  assert.equal(inv.receiptLines[1].receiptLinePrice, -1)
  assert.equal(inv.receiptTotal, 5)
  assert.deepEqual(inv.receiptPayments.map((p) => p.moneyTypeCode), ['Cash', 'MobileWallet'])
  const cn = buildReceipt({ receiptType: 'CreditNote', receiptCurrency: 'USD', invoiceNo: 'A3', receiptNotes: 'returned', creditDebitNote: { receiptID: 1 },
    lines: [{ name: 'Beer', quantity: 1, price: 2, taxID: 3, hsCode: '22030000' }] }, CFG)
  assert.equal(cn.receiptLines[0].receiptLinePrice, -2); assert.equal(cn.receiptTotal, -2); assert.equal(cn.receiptPayments[0].paymentAmount, -2)
  const ex = buildReceipt({ receiptType: 'FiscalInvoice', receiptCurrency: 'USD', invoiceNo: 'A4', receiptLinesTaxInclusive: false,
    lines: [{ name: 'Svc', quantity: 1, price: 100, taxID: 3, hsCode: '99999999' }] }, CFG)
  assert.equal(ex.receiptTaxes[0].taxAmount, 15); assert.equal(ex.receiptTaxes[0].salesAmountWithTax, 115); assert.equal(ex.receiptTotal, 115)
  assert.throws(() => buildReceipt({ receiptType: 'FiscalInvoice', receiptCurrency: 'USD', invoiceNo: 'x', lines: [{ name: 'a', quantity: 1, price: 1, taxID: 99 }] }, CFG), /unknown taxID/)
})

test('fiscal counters follow spec section 6 (credit notes negative, BalanceByMoneyType per payment)', () => {
  const inv = buildReceipt({ receiptType: 'FiscalInvoice', receiptCurrency: 'USD', invoiceNo: 'C1', lines: [{ name: 'a', quantity: 1, price: 115, taxID: 3, hsCode: '11111111' }], payments: [{ moneyTypeCode: 'Card' }] }, CFG)
  const cn = buildReceipt({ receiptType: 'CreditNote', receiptCurrency: 'USD', invoiceNo: 'C2', lines: [{ name: 'a', quantity: 1, price: 23, taxID: 3, hsCode: '11111111' }], payments: [{ moneyTypeCode: 'Card' }] }, CFG)
  const get = (arr, type) => arr.find((c) => c.fiscalCounterType === type)?.fiscalCounterValue
  const c = countersFromReceipts([inv, cn])
  assert.equal(get(c, 'SaleByTax'), 115); assert.equal(get(c, 'SaleTaxByTax'), 15)
  assert.equal(get(c, 'CreditNoteByTax'), -23); assert.equal(get(c, 'CreditNoteTaxByTax'), -3)
  assert.equal(get(c, 'BalanceByMoneyType'), 92)
  assert.ok(c.every((x) => x.fiscalCounterValue !== 0))
})

test('fiscal-day counter concat: only non-zero, uppercase, cents, exempt has empty percent', () => {
  const s = concatCounters([
    { fiscalCounterType: 'SaleByTax', fiscalCounterCurrency: 'ZWL', fiscalCounterTaxID: 1, fiscalCounterValue: 23000 },
    { fiscalCounterType: 'SaleByTax', fiscalCounterCurrency: 'ZWL', fiscalCounterTaxID: 2, fiscalCounterTaxPercent: 0, fiscalCounterValue: 12000 },
    { fiscalCounterType: 'SaleByTax', fiscalCounterCurrency: 'ZWL', fiscalCounterTaxID: 9, fiscalCounterTaxPercent: 5, fiscalCounterValue: 0 },
    { fiscalCounterType: 'BalanceByMoneyType', fiscalCounterCurrency: 'USD', fiscalCounterMoneyType: 'Cash', fiscalCounterValue: 37 },
  ])
  assert.equal(s, 'SALEBYTAXZWL2300000SALEBYTAXZWL0.001200000BALANCEBYMONEYTYPEUSDCASH3700')
})

// ── Validation rules ─────────────────────────────────────────────────────────
function ctxFor(over = {}) {
  return { deviceID: 1, config: CFG, fiscalDayOpened: '2026-10-25T08:00:00', taxPayerDayMaxHrs: 24, isFirstOfDay: true, nowLocal: '2026-10-25T10:00:00', ...over }
}
function signed(over = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const receipt = { ...buildReceipt({ receiptType: 'FiscalInvoice', receiptCurrency: 'USD', invoiceNo: 'V1', lines: [{ name: 'a', quantity: 2, price: 5, taxID: 3, hsCode: '12345678' }] }, CFG),
    receiptCounter: 1, receiptGlobalNo: 1, receiptDate: '2026-10-25T09:00:00', ...over }
  receipt.receiptDeviceSignature = signString(pem, receiptSigString({ deviceID: 1, receipt }))
  return { receipt, publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }), pem }
}

test('a correct receipt has no validation errors', () => {
  const { receipt, publicKeyPem } = signed()
  assert.deepEqual(validateReceipt(receipt, ctxFor({ publicKeyPem })).errors, [])
})

test('validation catches tampering and rule violations with the right codes/colours', () => {
  const { receipt, publicKeyPem } = signed()
  const bad = structuredClone(receipt); bad.receiptTotal = 11
  const codes = (r, c = {}) => validateReceipt(r, ctxFor({ publicKeyPem, ...c })).errors.map((e) => e.code)
  assert.ok(codes(bad).includes('RCPT020'), 'tampered total breaks signature')
  assert.ok(codes(bad).includes('RCPT019'))
  const tax = structuredClone(receipt); tax.receiptTaxes[0].taxAmount = 9
  assert.ok(codes(tax).includes('RCPT026'))
  const hs = structuredClone(receipt); delete hs.receiptLines[0].receiptLineHSCode
  assert.ok(codes(hs).includes('RCPT047'))
  assert.ok(codes(receipt, { fiscalDayOpened: '2026-10-25T09:30:00' }).includes('RCPT014'))
  assert.ok(codes(receipt, { invoiceExists: () => true }).includes('RCPT013'))
  assert.ok(codes(receipt, { nowLocal: '2026-10-25T08:30:00' }).includes('RCPT031'))
  const colors = validateReceipt(receipt, ctxFor({ publicKeyPem, fiscalDayOpened: '2026-10-25T09:30:00' })).errors
  assert.equal(colors.find((e) => e.code === 'RCPT014').color, 'Yellow')
  // not a VAT payer but uses 15% tax -> RCPT021
  assert.ok(codes(receipt, { config: { ...CFG, vatNumber: undefined } }).includes('RCPT021'))
  // missing predecessor -> Grey, not an error
  const g = validateReceipt({ ...receipt, receiptCounter: 3 }, ctxFor({ publicKeyPem, isFirstOfDay: false }))
  assert.equal(g.grey, true)
})

test('signatures verify in both ECDSA encodings; RSA works too', () => {
  for (const enc of ['ieee-p1363', 'der']) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const s = signString(privateKey.export({ type: 'pkcs8', format: 'pem' }), 'hello', { ecdsaEncoding: enc })
    assert.ok(verifyString(publicKey.export({ type: 'spki', format: 'pem' }), 'hello', s.signature, { ecdsaEncoding: enc }))
    assert.equal(Buffer.from(s.signature, 'base64').length === 64, enc === 'ieee-p1363')
  }
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const s = signString(rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }), 'hello')
  assert.ok(verifyString(rsa.publicKey.export({ type: 'spki', format: 'pem' }), 'hello', s.signature))
})

test('secrets: AES-GCM seal/open round-trips, tamper and wrong key are rejected', () => {
  const k = newMasterKey()
  const sealed = seal('-----BEGIN PRIVATE KEY-----abc', k)
  assert.equal(open(sealed, k), '-----BEGIN PRIVATE KEY-----abc')
  assert.ok(!sealed.includes('PRIVATE'))
  assert.throws(() => open(sealed, newMasterKey()))
  const parts = sealed.split('.'); parts[3] = Buffer.from('tampered').toString('base64')
  assert.throws(() => open(parts.join('.'), k))
})
