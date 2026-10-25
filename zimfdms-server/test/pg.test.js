/** PgStore on real Postgres (PGlite) driven by the full DeviceService + simulator. */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { startSimulator } from '../src/sim/server.js'
import { DeviceService, BridgeError } from '../src/core/device.js'
import { PgStore } from '../src/core/pgstore.js'
import { newMasterKey } from '../src/core/secrets.js'

let S, db, store, svc
const M1 = '11111111-1111-1111-1111-111111111111', M2 = '22222222-2222-2222-2222-222222222222'
const item = (n, p) => ({ name: n, price: p, quantity: 1, taxID: 3, hsCode: '22030000' })
const sale = (no) => ({ invoiceNo: no, receiptCurrency: 'USD', lines: [item('Beer', 2)], payments: [{ moneyTypeCode: 'Cash' }] })

before(async () => {
  S = await startSimulator()
  S.sim.addDevice({ deviceID: 1042, activationKey: 'ABCD1234', serialNo: 'SN0001' })
  db = new PGlite()
  await db.exec(fs.readFileSync(new URL('../db/001_core.sql', import.meta.url), 'utf8'))
  store = new PgStore(db)
  svc = new DeviceService({ store, modelName: 'ZimFDMS', modelVersion: '1.0', masterKey: newMasterKey(), ca: S.caPem })
})
after(async () => { await S.close(); await db.close() })

test('full day on Postgres: connect, register, open, sell x3, close', async () => {
  await svc.connect({ deviceID: 1042, serialNo: 'SN0001', activationKey: 'ABCD1234', baseUrl: S.url, merchantId: M1 })
  await svc.register(1042)
  await svc.openDay(1042)
  for (const n of ['A1', 'A2', 'A3']) assert.equal((await svc.sell(1042, sale(n))).status, 'accepted')
  const rows = await store.searchReceipts(1042, {})
  assert.equal(rows.length, 3)
  assert.equal(rows[0].invoice_no, 'A3')
  assert.equal((await store.searchReceipts(1042, { q: 'a2' })).length, 1)
  assert.equal((await store.searchReceipts(1042, { status: 'queued' })).length, 0)
  const today = rows[0].receipt_date.slice(0, 10)
  assert.equal((await store.searchReceipts(1042, { from: today, to: today })).length, 3)
  assert.equal((await store.searchReceipts(1042, { from: '2000-01-01', to: '2000-01-02' })).length, 0)
  await svc.closeDay(1042)
  const v = await svc.view(1042)
  assert.equal(v.day.status, 'FiscalDayClosed')
  assert.equal((await store.daysOf(1042)).length, 1)
})

test('day 2 numbering continues and old receipts stay in the DB', async () => {
  await svc.openDay(1042)
  const r = await svc.sell(1042, sale('B1'))
  assert.equal(r.receipt.receiptCounter, 1)
  assert.equal(r.receipt.receiptGlobalNo, 4)
  assert.equal((await store.searchReceipts(1042, {})).length, 4)
  assert.equal((await store.searchReceipts(1042, { dayNo: 1 })).length, 3)
})

test('receipts are append-only and the signed body is immutable', async () => {
  await assert.rejects(db.query('delete from bridge_receipts'), /append-only/)
  await assert.rejects(db.query("update bridge_receipts set total = 99 where invoice_no='A1'"), /immutable/)
  await assert.rejects(db.query(`update bridge_receipts set data = jsonb_set(data,'{receipt,receiptTotal}','5') where invoice_no='A1'`), /immutable/)
})

test('duplicate invoice number is rejected by the database', async () => {
  await assert.rejects(svc.sell(1042, sale('B1')))
})

test('ownership guard: another merchant cannot take over a device; registered devices are not overwritten', async () => {
  await assert.rejects(svc.connect({ deviceID: 1042, serialNo: 'SN0001', activationKey: 'ABCD1234', baseUrl: S.url, merchantId: M2 }), (e) => e instanceof BridgeError && e.code === 'DEVICE_OWNED')
  await assert.rejects(svc.connect({ deviceID: 1042, serialNo: 'SN0001', activationKey: 'ABCD1234', baseUrl: S.url, merchantId: M1 }), (e) => e.code === 'ALREADY_REGISTERED')
})

test('concurrent sales on Postgres keep the chain intact', async () => {
  const res = await Promise.all(Array.from({ length: 8 }, (_, i) => svc.sell(1042, sale('C' + i))))
  assert.ok(res.every((r) => r.status === 'accepted'))
  const nos = (await store.searchReceipts(1042, { limit: 200 })).map((r) => r.receipt_global_no).sort((a, b) => a - b)
  assert.deepEqual(nos, Array.from({ length: nos.length }, (_, i) => i + 1))
})
