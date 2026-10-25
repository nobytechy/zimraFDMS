/**
 * Spec section 11 — receipt QR data.
 *   {qrUrl}/{deviceID:10}{receiptDate:ddMMyyyy}{receiptGlobalNo:10}{receiptQrData:16}
 *   receiptQrData = first 16 chars (UPPERCASE hex) of MD5 of receiptDeviceSignature.
 * Spec example: 0000000321 03042023 1112223331 4C8BE27663330417
 *
 * OPEN POINT: "MD5 hash from ReceiptDeviceSignature hexadecimal format value" can mean
 * MD5 over the raw signature bytes (default) or over the hex text of them. `md5Input`
 * switches between the two so it can be confirmed on the test environment.
 */
import crypto from 'node:crypto'
import { pad } from './util.js'

export function receiptQrData(signatureB64, { md5Input = 'bytes' } = {}) {
  const raw = Buffer.from(signatureB64, 'base64')
  const input = md5Input === 'hex' ? Buffer.from(raw.toString('hex'), 'utf8') : raw
  return crypto.createHash('md5').update(input).digest('hex').toUpperCase().slice(0, 16)
}

/** receiptDate is the zone-less local ISO string `YYYY-MM-DDTHH:mm:ss`. */
export function buildQr({ qrUrl, deviceID, receiptDate, receiptGlobalNo, signatureB64 }, opts) {
  const [y, m, d] = receiptDate.slice(0, 10).split('-')
  const qrData = receiptQrData(signatureB64, opts)
  const base = String(qrUrl).replace(/\/+$/, '')
  return {
    qrData,
    url: `${base}/${pad(deviceID, 10)}${d}${m}${y}${pad(receiptGlobalNo, 10)}${qrData}`,
    verificationCode: qrData.match(/.{4}/g).join('-'),
  }
}
