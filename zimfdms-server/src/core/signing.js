/**
 * Spec section 13 — receipt & fiscal-day hashes and signatures.
 * Server-side (node:crypto). Keys never leave the server.
 *
 * Two points the spec leaves open are exposed as OPTIONS so they can be
 * settled against the ZIMRA test environment without touching code:
 *   - `separator`  : string put between the concatenated fields and the
 *                    previous receipt hash. Spec 13.1 says none (''), but two of
 *                    the spec's printed examples only reproduce with ' '.
 *   - `ecdsaEncoding`: 'ieee-p1363' (raw r||s, 64 bytes) or 'der'. Spec is silent.
 */
import crypto from 'node:crypto'
import { cents, pctStr, FiscalCounterType } from './util.js'

export const DEFAULT_SIGN_OPTS = { separator: '', ecdsaEncoding: 'ieee-p1363' }

// ─── Receipt (13.2.1) ──────────────────────────────────────────────────────

/** receiptTaxes concatenation: taxCode || taxPercent || taxAmount || salesAmountWithTax, ordered by taxID then taxCode. */
export function concatReceiptTaxes(taxes = []) {
  return [...taxes]
    .sort((a, b) => (a.taxID - b.taxID) || String(a.taxCode || '').localeCompare(String(b.taxCode || '')))
    .map((t) => `${t.taxCode || ''}${pctStr(t.taxPercent)}${cents(t.taxAmount)}${cents(t.salesAmountWithTax)}`)
    .join('')
}

export function receiptSigString({ deviceID, receipt, previousReceiptHash }, opts = {}) {
  const { separator } = { ...DEFAULT_SIGN_OPTS, ...opts }
  const body = [
    String(deviceID),
    String(receipt.receiptType).toUpperCase(),
    String(receipt.receiptCurrency).toUpperCase(),
    String(receipt.receiptGlobalNo),
    String(receipt.receiptDate),
    cents(receipt.receiptTotal),
    concatReceiptTaxes(receipt.receiptTaxes),
  ].join('')
  return previousReceiptHash ? body + separator + previousReceiptHash : body
}

// ─── Fiscal day (13.3.1) ───────────────────────────────────────────────────

/**
 * Counter ordering per spec text: type asc, currency alpha asc, then taxID asc
 * (SaleByTax…) or money type asc (BalanceByMoneyType). NOTE: the spec's printed
 * example is not sorted by currency, so this is verified in tests rather than assumed.
 */
export function sortCounters(counters) {
  const typeIdx = (c) => FiscalCounterType.indexOf(c.fiscalCounterType)
  return [...counters].sort((a, b) =>
    (typeIdx(a) - typeIdx(b)) ||
    String(a.fiscalCounterCurrency).localeCompare(String(b.fiscalCounterCurrency)) ||
    ((a.fiscalCounterTaxID ?? 0) - (b.fiscalCounterTaxID ?? 0)) ||
    String(a.fiscalCounterMoneyType || '').localeCompare(String(b.fiscalCounterMoneyType || '')))
}

export function concatCounters(counters = []) {
  return sortCounters(counters.filter((c) => Number(c.fiscalCounterValue) !== 0))
    .map((c) => {
      const mid = c.fiscalCounterType === 'BalanceByMoneyType'
        ? String(c.fiscalCounterMoneyType || '').toUpperCase()
        : pctStr(c.fiscalCounterTaxPercent)
      return `${String(c.fiscalCounterType).toUpperCase()}${String(c.fiscalCounterCurrency).toUpperCase()}${mid}${cents(c.fiscalCounterValue)}`
    }).join('')
}

/** fiscalDayDate = YYYY-MM-DD of the day it was opened. */
export function fiscalDaySigString({ deviceID, fiscalDayNo, fiscalDayDate, counters }) {
  return `${deviceID}${fiscalDayNo}${fiscalDayDate}${concatCounters(counters)}`
}

// ─── Hash / sign / verify ──────────────────────────────────────────────────

export const sha256b64 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('base64')

function keyAlg(privateKeyPem) {
  const k = crypto.createPrivateKey(privateKeyPem)
  return { key: k, type: k.asymmetricKeyType }
}

/** Returns SignatureData { hash, signature } (both base64). */
export function signString(privateKeyPem, text, opts = {}) {
  const { ecdsaEncoding } = { ...DEFAULT_SIGN_OPTS, ...opts }
  const { key, type } = keyAlg(privateKeyPem)
  const hash = sha256b64(text)
  let sig
  if (type === 'ec') sig = crypto.sign('sha256', Buffer.from(text, 'utf8'), { key, dsaEncoding: ecdsaEncoding })
  else if (type === 'rsa') sig = crypto.sign('sha256', Buffer.from(text, 'utf8'), key)
  else throw new Error(`Unsupported key type ${type} (spec allows ECDSA P-256 or RSA 2048)`)
  return { hash, signature: sig.toString('base64') }
}

export function verifyString(publicKeyOrCertPem, text, signatureB64, opts = {}) {
  const { ecdsaEncoding } = { ...DEFAULT_SIGN_OPTS, ...opts }
  const pub = crypto.createPublicKey(publicKeyOrCertPem)
  const data = Buffer.from(text, 'utf8')
  const sig = Buffer.from(signatureB64, 'base64')
  if (pub.asymmetricKeyType === 'ec') return crypto.verify('sha256', data, { key: pub, dsaEncoding: ecdsaEncoding }, sig)
  return crypto.verify('sha256', data, pub, sig)
}

export function signReceipt(privateKeyPem, args, opts) {
  return signString(privateKeyPem, receiptSigString(args, opts), opts)
}

export function signFiscalDay(privateKeyPem, args, opts) {
  return signString(privateKeyPem, fiscalDaySigString(args), opts)
}

// ─── FDMS (server) signatures: 13.2.2 / 13.3.2 ─────────────────────────────

export const receiptServerSigString = ({ receiptDeviceSignature, receiptID, serverDate }) =>
  `${receiptDeviceSignature.signature}${receiptID}${serverDate}`

export const fiscalDayServerSigString = ({ deviceID, fiscalDayNo, fiscalDayDate, fiscalDayUpdated, reconciliationMode, counters, fiscalDayDeviceSignature }) =>
  `${deviceID}${fiscalDayNo}${fiscalDayDate}${fiscalDayUpdated}${String(reconciliationMode).toUpperCase()}${concatCounters(counters)}` +
  (String(reconciliationMode).toUpperCase() === 'MANUAL' ? '' : (fiscalDayDeviceSignature?.signature || ''))

/** SHA-1 thumbprint (hex) of a PEM certificate. Spec SignatureDataEx.certificateThumbprint. */
export function certThumbprint(certPem) {
  const x = new crypto.X509Certificate(certPem)
  return crypto.createHash('sha1').update(x.raw).digest('hex').toUpperCase()
}
