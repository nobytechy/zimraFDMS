/**
 * zimFDMS — section-13 signature math from the v7.2 spec.
 *
 * Pure browser-native crypto (SubtleCrypto). No npm dependencies.
 * Generates: receipt hash + receipt device signature + receipt QR data string.
 * Verifies against the spec's worked examples (see testVectors.js).
 */

const enc = new TextEncoder()
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))

/**
 * Format an amount in cents (no decimal separator) per spec section 13.2.1
 * row 6: "If receiptTotal is 12,34 USD, value 1234 must be used in signature."
 */
export function amountToCents(amount) {
  // Round to 2dp first so 12.345 doesn't become 1234.5.
  const cents = Math.round(Number(amount) * 100)
  return String(cents)
}

/**
 * Format a tax percent for signature use. Spec section 13.2.1 row 7:
 *   - if taxPercent missing → empty
 *   - if 0 → "0.00"
 *   - if 14.5 → "14.50"
 *   - if 15 → "15.00"
 */
export function taxPercentForSig(p) {
  if (p === null || p === undefined || p === '') return ''
  const n = Number(p)
  if (!isFinite(n)) return ''
  return n.toFixed(2)
}

/**
 * Concatenate receiptTaxes per spec section 13.2.1 row 7.
 * Each line: taxCode || taxPercent || taxAmount || salesAmountWithTax.
 * Order: by taxID ascending, then taxCode (empty before A).
 */
export function concatReceiptTaxes(taxes) {
  const sorted = [...(taxes || [])].sort((a, b) => {
    if (a.taxID !== b.taxID) return a.taxID - b.taxID
    return String(a.taxCode || '').localeCompare(String(b.taxCode || ''))
  })
  return sorted.map((t) => {
    return (t.taxCode || '')
         + taxPercentForSig(t.taxPercent)
         + amountToCents(t.taxAmount)
         + amountToCents(t.salesAmountWithTax)
  }).join('')
}

/**
 * Build the canonical concat string for the device-side receipt signature.
 * Spec section 13.2.1 — fields in order:
 *   1 deviceID
 *   2 receiptType (UPPER)
 *   3 receiptCurrency (UPPER)
 *   4 receiptGlobalNo
 *   5 receiptDate  ISO 8601 local YYYY-MM-DDTHH:mm:ss
 *   6 receiptTotal (in cents)
 *   7 receiptTaxes (concatenated)
 *   8 previousReceiptHash (optional — skipped for the first receipt of a day)
 */
export function buildReceiptSigInput({ deviceID, receipt, previousReceiptHash }) {
  const parts = [
    String(deviceID),
    String(receipt.receiptType).toUpperCase(),
    String(receipt.receiptCurrency).toUpperCase(),
    String(receipt.receiptGlobalNo),
    String(receipt.receiptDate),
    amountToCents(receipt.receiptTotal),
    concatReceiptTaxes(receipt.receiptTaxes),
  ]
  if (previousReceiptHash) parts.push(previousReceiptHash)
  return parts.join('')
}

/** SHA-256 → base64 of a UTF-8 string. */
export async function sha256Base64(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return b64(buf)
}

/**
 * Sign the hash with the device private key.
 *
 *  - ECDSA (secp256r1) → IEEE P1363 raw r||s output, base64.
 *  - RSA (2048)        → PKCS#1 v1.5 signature, base64.
 *
 * Spec mentions both as acceptable; ECC is recommended.
 *
 * @param {CryptoKey} privateKey  Imported via importPrivateKey().
 * @param {string} text           Canonical concat (NOT pre-hashed — Subtle does it).
 * @returns {Promise<{ hash: string, signature: string }>}
 */
export async function signReceipt(privateKey, text) {
  const hash = await sha256Base64(text)
  const algo = privateKey.algorithm
  let sigBuf
  if (algo.name === 'ECDSA') {
    sigBuf = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      enc.encode(text),
    )
  } else if (algo.name === 'RSASSA-PKCS1-v1_5') {
    sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, enc.encode(text))
  } else {
    throw new Error(`Unsupported private key algorithm: ${algo.name}`)
  }
  return { hash, signature: b64(sigBuf) }
}

/** Generate an ephemeral ECDSA secp256r1 keypair for sandbox / mock mode. */
export async function generateDevKeyPair() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  // Export public key in raw form for fingerprinting / display
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey)
  return {
    publicKey, privateKey,
    publicKeySpkiB64: b64(spki),
    privateKeyPkcs8B64: b64(pkcs8),
  }
}

/**
 * QR code data — spec section 11.
 * URL pattern: {qrUrl}/{deviceID}{receiptDate-yyyyMMdd}{receiptGlobalNo:zero-padded-10}
 * Then the device signature (base64, with URL-safe substitutions).
 * Receipt page renders this string into an actual QR via the `qrcode` lib.
 */
export function buildQrData({ qrUrl, deviceID, receipt, deviceSignatureB64 }) {
  const ymd = receipt.receiptDate.slice(0, 10).replace(/-/g, '')
  const globalPadded = String(receipt.receiptGlobalNo).padStart(10, '0')
  const sigShort = (deviceSignatureB64 || '').slice(0, 16)
  return `${qrUrl}/${deviceID}${ymd}${globalPadded}${sigShort}`
}
