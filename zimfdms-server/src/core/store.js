/**
 * Storage contract for DeviceService + an in-memory implementation for tests/dev.
 *
 * A production implementation (Supabase/Postgres) must provide the SAME three methods:
 *   get(deviceID)            -> device record | undefined
 *   put(deviceID, record)    -> void            (record is plain JSON)
 *   lock(deviceID, fn)       -> Promise<T>      (exclusive per device across ALL server instances,
 *                                                e.g. pg_advisory_xact_lock(deviceID) or SELECT … FOR UPDATE)
 *
 * The lock is what makes receiptCounter / receiptGlobalNo / previous-hash race-free:
 * every read-modify-write of a device's chain happens inside lock().
 *
 * Record shape (one row per device + JSONB for the rest):
 *   { deviceID, merchantId, env:'test'|'live', baseUrl, serialNo, mode,
 *     activationKeySealed, privateKeySealed, certPem, certValidTill, fdmsCertChain[],
 *     config, state:'connected'|'registered',
 *     day: { status, no, opened, openSent, fileSeq, receipts:[ReceiptRecord] },
 *     lastGlobalNo, lastDayNo }
 *   ReceiptRecord: { receipt, status:'queued'|'accepted'|'rejected', receiptID?, serverDate?,
 *                    serverSignature?, serverSigVerified?, errorCode?, qr }
 */
export class MemoryStore {
  constructor() { this.rows = new Map(); this.tails = new Map() }
  async get(id) { const r = this.rows.get(id); return r ? structuredClone(r) : undefined }
  async put(id, rec) { this.rows.set(id, structuredClone(rec)) }
  async lock(id, fn) {
    const prev = this.tails.get(id) || Promise.resolve()
    let release
    const next = new Promise((r) => { release = r })
    this.tails.set(id, prev.then(() => next))
    await prev
    try { return await fn() } finally { release() }
  }
}
