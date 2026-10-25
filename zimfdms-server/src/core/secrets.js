/**
 * Encrypt device private keys / activation keys at rest (AES-256-GCM).
 * Master key comes from env FDMS_MASTER_KEY (32 bytes, base64). In production
 * prefer a KMS / Supabase Vault; this keeps the interface (seal/open) stable.
 */
import crypto from 'node:crypto'

function masterKey(k = process.env.FDMS_MASTER_KEY) {
  if (!k) throw new Error('FDMS_MASTER_KEY is not set (32 random bytes, base64)')
  const buf = Buffer.from(k, 'base64')
  if (buf.length !== 32) throw new Error('FDMS_MASTER_KEY must decode to 32 bytes')
  return buf
}

export const newMasterKey = () => crypto.randomBytes(32).toString('base64')

/** -> "v1.<iv>.<tag>.<ciphertext>" (base64 parts) */
export function seal(plain, key) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', masterKey(key), iv)
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()])
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join('.')
}

export function open(sealed, key) {
  const [v, iv, tag, ct] = String(sealed).split('.')
  if (v !== 'v1') throw new Error('Unknown secret format')
  const d = crypto.createDecipheriv('aes-256-gcm', masterKey(key), Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8')
}
