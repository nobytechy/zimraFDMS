/**
 * Postgres implementation of the store contract (see store.js).
 *
 * `db` is anything with `.query(text, params) -> {rows}`: a `pg.Pool`, or PGlite in tests.
 * lock(): in-process mutex (always) + `pg_advisory_lock` held on a dedicated pooled connection when
 * the pool supports `.connect()` — so several server instances stay safe. Advisory locks are
 * session-scoped: use a DIRECT / SESSION-mode DATABASE_URL (port 5432), not a transaction pooler.
 */
const NS = 0x5a46 // 'ZF' namespace for two-int advisory locks

export class PgStore {
  constructor(db) { this.db = db; this.tails = new Map() }

  async get(id) {
    const d = (await this.db.query('select merchant_id, env, state, data from bridge_devices where device_id=$1', [id])).rows[0]
    if (!d) return undefined
    const day = (await this.db.query('select data from bridge_days where device_id=$1 order by day_no desc limit 1', [id])).rows[0]
    const rec = { ...d.data, deviceID: id, merchantId: d.merchant_id, env: d.env, state: d.state }
    const receipts = day
      ? (await this.db.query('select data from bridge_receipts where device_id=$1 and day_no=$2 order by receipt_counter', [id, day.data.no])).rows.map((r) => r.data)
      : []
    rec.day = { ...(day ? day.data : { status: 'FiscalDayClosed', no: 0, opened: null, openSent: true, fileSeq: 0 }), receipts }
    const snap = new Map(receipts.map((r) => [r.receipt.receiptGlobalNo, JSON.stringify(r)]))
    Object.defineProperty(rec, '__snap', { value: snap, enumerable: false })
    return rec
  }

  async put(id, rec) {
    const { deviceID, merchantId, env, state, day, ...rest } = rec
    await this.db.query(
      `insert into bridge_devices (device_id, merchant_id, env, state, data) values ($1,$2,$3,$4,$5)
       on conflict (device_id) do update set env=$3, state=$4, data=$5, updated_at=now()`,
      [id, merchantId, env, state, rest])
    if (!day || day.no === 0) return // pre-first-day placeholder is implicit
    const { receipts = [], ...dayData } = day
    await this.db.query(
      `insert into bridge_days (device_id, day_no, status, data) values ($1,$2,$3,$4)
       on conflict (device_id, day_no) do update set status=$3, data=$4, updated_at=now()`,
      [id, day.no, day.status, dayData])
    const snap = rec.__snap
    for (const r of receipts) {
      const rc = r.receipt, s = JSON.stringify(r)
      if (snap && snap.get(rc.receiptGlobalNo) === s) continue
      await this.db.query(
        `insert into bridge_receipts (device_id, receipt_global_no, day_no, receipt_counter, invoice_no, receipt_type, currency, total, receipt_date, status, error_code, data)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (device_id, receipt_global_no) do update set status=$10, error_code=$11, data=$12, updated_at=now()`,
        [id, rc.receiptGlobalNo, day.no, rc.receiptCounter, rc.invoiceNo, rc.receiptType, rc.receiptCurrency, rc.receiptTotal, rc.receiptDate, r.status, r.errorCode ?? null, r])
      snap?.set(rc.receiptGlobalNo, s)
    }
  }

  async lock(id, fn) {
    const prev = this.tails.get(id) || Promise.resolve()
    let release
    const next = new Promise((r) => { release = r })
    this.tails.set(id, prev.then(() => next))
    await prev
    let client
    try {
      if (typeof this.db.connect === 'function') {
        client = await this.db.connect()
        await client.query('select pg_advisory_lock($1,$2)', [NS, id])
      }
      return await fn()
    } finally {
      if (client) {
        try { await client.query('select pg_advisory_unlock($1,$2)', [NS, id]) } finally { client.release() }
      }
      release()
    }
  }

  // ── read helpers for the API (never return sealed secrets) ───────────────
  async devicesOf(merchantId) {
    return (await this.db.query('select device_id, env, state, data from bridge_devices where merchant_id=$1 order by device_id', [merchantId])).rows
  }
  async ownerOf(id) {
    return (await this.db.query('select merchant_id from bridge_devices where device_id=$1', [id])).rows[0]?.merchant_id
  }
  /** search: invoice substring; filters: status, type, from/to (local date 'YYYY-MM-DD'), dayNo; paging */
  async searchReceipts(id, { q, status, type, from, to, dayNo, limit = 50, offset = 0 } = {}) {
    const w = ['device_id=$1'], p = [id]
    const add = (sql, v) => { p.push(v); w.push(sql.replace('?', '$' + p.length)) }
    if (q) add('invoice_no ilike ?', `%${q}%`)
    if (status) add('status = ?', status)
    if (type) add('receipt_type = ?', type)
    if (from) add('receipt_date >= ?', from)
    if (to) add('receipt_date < ?', to + 'T99') // inclusive of the whole 'to' day
    if (dayNo) add('day_no = ?', dayNo)
    p.push(Math.min(Number(limit) || 50, 200), Number(offset) || 0)
    return (await this.db.query(
      `select invoice_no, receipt_global_no, day_no, receipt_type, currency, total, receipt_date, status, error_code, data
       from bridge_receipts where ${w.join(' and ')} order by receipt_global_no desc limit $${p.length - 1} offset $${p.length}`, p)).rows
  }
  async daysOf(id, limit = 60) {
    return (await this.db.query('select day_no, status, data from bridge_days where device_id=$1 order by day_no desc limit $2', [id, limit])).rows
  }
  async dayReceipts(id, dayNo) {
    return (await this.db.query('select data from bridge_receipts where device_id=$1 and day_no=$2 order by receipt_counter', [id, dayNo])).rows.map((r) => r.data)
  }
  async receiptByGlobalNo(id, no) {
    return (await this.db.query('select data from bridge_receipts where device_id=$1 and receipt_global_no=$2', [id, no])).rows[0]?.data
  }
  /** receipts + revenue per local calendar day, newest `days` days that have data */
  async seriesByDay(id, from) {
    return (await this.db.query(
      `select left(receipt_date,10) as day, count(*)::int as receipts, coalesce(sum(total),0)::float as revenue
       from bridge_receipts where device_id=$1 and left(receipt_date,10) >= $2 and status <> 'rejected'
       group by 1 order by 1`, [id, from])).rows
  }
}
