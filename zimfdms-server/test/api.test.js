/** API handler on top of PgStore + simulator, with a fake authenticator (two merchants). */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { startSimulator } from '../src/sim/server.js'
import { DeviceService } from '../src/core/device.js'
import { PgStore } from '../src/core/pgstore.js'
import { newMasterKey } from '../src/core/secrets.js'
import { createApi, ApiError, supabaseAuthenticator } from '../src/api/handler.js'

let S, db, api
const M1 = '11111111-1111-1111-1111-111111111111', M2 = '22222222-2222-2222-2222-222222222222'
const authenticate = async (req) => {
  const t = req.headers.get('authorization')
  if (t === 'Bearer m1') return { merchantId: M1 }
  if (t === 'Bearer m2') return { merchantId: M2 }
  throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in first')
}
const call = async (who, method, path, body) => {
  const res = await api(new Request('http://x/api/fdms' + path, { method, headers: { authorization: who ? 'Bearer ' + who : '', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }))
  return { status: res.status, ...(await res.json()) }
}
const sale = (no) => ({ invoiceNo: no, receiptCurrency: 'USD', lines: [{ name: 'Beer', price: 2, quantity: 1, taxID: 3, hsCode: '22030000' }], payments: [{ moneyTypeCode: 'Cash' }] })

before(async () => {
  S = await startSimulator()
  S.sim.addDevice({ deviceID: 1042, activationKey: 'ABCD1234', serialNo: 'SN0001' })
  db = new PGlite()
  await db.exec(fs.readFileSync(new URL('../db/001_core.sql', import.meta.url), 'utf8'))
  const store = new PgStore(db)
  const service = new DeviceService({ store, modelName: 'ZimFDMS', modelVersion: '1.0', masterKey: newMasterKey(), ca: S.caPem })
  api = createApi({ service, store, authenticate, baseUrlFor: (env) => (env === 'test' ? S.url : null) })
})
after(async () => { await S.close(); await db.close() })

test('requires sign-in', async () => {
  const r = await call(null, 'GET', '/devices')
  assert.equal(r.status, 401)
})

test('wizard flow: connect -> confirm taxpayer -> register -> open -> sell -> close', async () => {
  const c = await call('m1', 'POST', '/devices/connect', { deviceID: 1042, serialNo: 'SN0001', activationKey: 'ABCD1234', env: 'test' })
  assert.equal(c.status, 200); assert.equal(c.data.taxpayer.taxPayerName, 'Demo Trader (Pvt) Ltd')
  const r = await call('m1', 'POST', '/devices/1042/register')
  assert.equal(r.status, 200); assert.equal(r.data.state, 'registered')
  assert.equal(JSON.stringify(r).includes('PRIVATE'), false)
  assert.equal(JSON.stringify(r).includes('Sealed'), false)
  assert.equal((await call('m1', 'POST', '/devices/1042/open-day')).data.day.status, 'FiscalDayOpened')
  const s1 = await call('m1', 'POST', '/devices/1042/sell', sale('INV-1'))
  assert.equal(s1.status, 200); assert.equal(s1.data.status, 'accepted'); assert.match(s1.data.qr.url, /^https:\/\/invoice\.zimra\.co\.zw\//)
  await call('m1', 'POST', '/devices/1042/sell', sale('INV-2'))
  const list = await call('m1', 'GET', '/devices/1042/receipts?q=inv-2')
  assert.equal(list.data.length, 1); assert.equal(list.data[0].status, 'accepted'); assert.ok(list.data[0].verificationCode)
  const one = await call('m1', 'GET', '/devices/1042/receipts/1')
  assert.equal(one.data.receipt.invoiceNo, 'INV-1')
  const cl = await call('m1', 'POST', '/devices/1042/close-day')
  assert.equal(cl.status, 200); assert.equal(cl.data.device.day.status, 'FiscalDayClosed')
  const ser = await call('m1', 'GET', '/devices/1042/series?days=7')
  assert.equal(ser.data.at(-1).receipts, 2)
  const days = await call('m1', 'GET', '/devices/1042/days')
  assert.equal(days.data.length, 1)
  const day = await call('m1', 'GET', '/devices/1042/days/1')
  assert.equal(day.data.receipts.length, 2)
})

test("another merchant can't see, use, or take over the device", async () => {
  assert.equal((await call('m2', 'GET', '/devices/1042')).status, 404)
  assert.equal((await call('m2', 'POST', '/devices/1042/sell', sale('X'))).status, 404)
  assert.equal((await call('m2', 'GET', '/devices/1042/receipts')).status, 404)
  assert.equal((await call('m2', 'GET', '/devices')).data.length, 0)
  const t = await call('m2', 'POST', '/devices/connect', { deviceID: 1042, serialNo: 'SN0001', activationKey: 'ABCD1234' })
  assert.equal(t.status, 409); assert.equal(t.error.code, 'DEVICE_OWNED')
})

test('clean errors: bad input, closed day, wrong activation key, live disabled', async () => {
  assert.equal((await call('m1', 'POST', '/devices/1042/sell', { invoiceNo: 'Z' })).status, 400)
  const closed = await call('m1', 'POST', '/devices/1042/sell', sale('LATE'))
  assert.equal(closed.status, 409); assert.equal(closed.error.code, 'DAY_NOT_OPEN')
  const bad = await call('m2', 'POST', '/devices/connect', { deviceID: 1042, serialNo: 'SN0001', activationKey: 'WRONG123' })
  assert.ok([409, 422].includes(bad.status))
  assert.equal((await call('m2', 'POST', '/devices/connect', { deviceID: 9, serialNo: 'a', activationKey: 'b', env: 'live' })).error.code, 'ENV_UNAVAILABLE')
})

test('browser cannot inject server-owned fields', async () => {
  await call('m1', 'POST', '/devices/1042/open-day')
  const r = await call('m1', 'POST', '/devices/1042/sell', { ...sale('INJ-1'), receiptGlobalNo: 999, receiptDate: '2001-01-01T00:00:00', receiptDeviceSignature: { x: 1 } })
  assert.equal(r.status, 200)
  assert.notEqual(r.data.receipt.receiptGlobalNo, 999)
  assert.notEqual(r.data.receipt.receiptDate, '2001-01-01T00:00:00')
})

test('supabase authenticator: valid token -> merchant, bad token -> 401', async () => {
  await db.query("create table fdms_merchants (id uuid primary key, user_id uuid)")
  await db.query("insert into fdms_merchants values ($1, $2)", [M1, '33333333-3333-3333-3333-333333333333'])
  const f = async (url, o) => o.headers.authorization === 'Bearer good' ? new Response(JSON.stringify({ id: '33333333-3333-3333-3333-333333333333' })) : new Response('{}', { status: 401 })
  const a = supabaseAuthenticator({ supabaseUrl: 'https://s', anonKey: 'k', db, fetchImpl: f })
  assert.equal((await a(new Request('http://x', { headers: { authorization: 'Bearer good' } }))).merchantId, M1)
  await assert.rejects(a(new Request('http://x', { headers: { authorization: 'Bearer bad' } })), (e) => e.status === 401)
})
