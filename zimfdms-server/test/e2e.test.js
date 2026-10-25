/**
 * End-to-end: DeviceService  ⇄  real HTTPS + mutual TLS  ⇄  FDMS simulator.
 * This is the exact code path a merchant with real credentials will use;
 * only baseUrl / CA / credentials differ.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import https from 'node:https'
import { startSimulator } from '../src/sim/server.js'
import { DeviceService, BridgeError } from '../src/core/device.js'
import { MemoryStore } from '../src/core/store.js'
import { FdmsClient, FdmsHttpError } from '../src/core/client.js'
import { newMasterKey, open } from '../src/core/secrets.js'
import { signReceipt, signFiscalDay } from '../src/core/signing.js'
import { buildReceipt } from '../src/core/receipt.js'
import { localIso } from '../src/core/util.js'

let S, svc, store
const masterKey = newMasterKey()
const HS = '22030000'
const item = (name, price, taxID = 3, quantity = 1) => ({ name, price, quantity, taxID, hsCode: taxID === 3 ? HS : '22030000' })
const mk = (extra = {}) => new DeviceService({ store, modelName: 'ZimFDMS', modelVersion: '1.0', masterKey, ca: S.caPem, ...extra })

before(async () => {
  S = await startSimulator()
  S.sim.addDevice({ deviceID: 1042, activationKey: 'ABCD1234', serialNo: 'SN0001' })
  S.sim.addDevice({ deviceID: 2001, activationKey: 'OFFL0001', serialNo: 'SN2001', mode: 'Offline' })
  S.sim.addDevice({ deviceID: 3001, activationKey: 'RAWX0001', serialNo: 'SN3001' })
  S.sim.addDevice({ deviceID: 4001, activationKey: 'NETW0001', serialNo: 'SN4001' })
  S.sim.addDevice({ deviceID: 5001, activationKey: 'CONC0001', serialNo: 'SN5001' })
  store = new MemoryStore()
  svc = mk()
})
after(async () => { await S.close() })

async function onboard(s, deviceID, serialNo, activationKey) {
  const tp = await s.connect({ deviceID, serialNo, activationKey, baseUrl: S.url, merchantId: `m${deviceID}` })
  await s.register(deviceID)
  return tp
}

test('connect shows the taxpayer; wrong activation key is rejected with DEV02', async () => {
  const tp = await onboard(svc, 1042, 'SN0001', 'abcd1234') // activation key is case-insensitive (spec 4.2)
  assert.equal(tp.taxPayerName, 'Demo Trader (Pvt) Ltd')
  await assert.rejects(svc.connect({ deviceID: 1042, serialNo: 'SN0001', activationKey: 'WRONG123', baseUrl: S.url }), (e) => e instanceof FdmsHttpError && e.errorCode === 'DEV02' && e.status === 422)
})

test('registration stores a sealed key, never exposes it, and loads config', async () => {
  const v = await svc.view(1042)
  assert.equal(v.state, 'registered')
  assert.equal(v.hasPrivateKey, true)
  assert.equal(JSON.stringify(v).includes('PRIVATE KEY'), false)
  assert.equal('privateKeySealed' in v, false)
  assert.equal('activationKeySealed' in v, false)
  const raw = await store.get(1042)
  assert.ok(!raw.privateKeySealed.includes('PRIVATE'))
  assert.match(open(raw.privateKeySealed, masterKey), /BEGIN PRIVATE KEY/)
  assert.equal(v.config.qrUrl, 'https://invoice.zimra.co.zw')
  assert.equal(v.config.applicableTaxes.length, 3)
})

test('unregistered software model is refused (DEV06) — headers are mandatory on every call', async () => {
  const bad = new DeviceService({ store: new MemoryStore(), modelName: 'Nope', modelVersion: '9', masterKey, ca: S.caPem })
  await assert.rejects(bad.connect({ deviceID: 1042, serialNo: 'SN0001', activationKey: 'ABCD1234', baseUrl: S.url }), (e) => e.errorCode === 'DEV06')
})

test('full online day: open → 4 sales (discount, exempt, multi-payment) → credit note → close', async () => {
  const day = await svc.openDay(1042)
  assert.equal(day.fiscalDayNo, 1); assert.equal(day.sentToFdms, true)
  await assert.rejects(svc.openDay(1042), (e) => e.code === 'DAY_ALREADY_OPEN')

  const a = await svc.sell(1042, { receiptCurrency: 'USD', invoiceNo: 'INV-1', lines: [item('Castle Lager 340ml', 2, 3, 3), { ...item('Promo', 1, 3), type: 'Discount' }] })
  assert.equal(a.status, 'accepted'); assert.equal(a.serverSigVerified, true)
  assert.equal(a.receipt.receiptCounter, 1); assert.equal(a.receipt.receiptGlobalNo, 1)
  assert.match(a.receipt.receiptDate, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/)
  assert.match(a.qr.url, /^https:\/\/invoice\.zimra\.co\.zw\/0000001042\d{8}0000000001[0-9A-F]{16}$/)

  const b = await svc.sell(1042, { receiptCurrency: 'USD', invoiceNo: 'INV-2', lines: [item('Bread', 1.5, 1)], payments: [{ moneyTypeCode: 'MobileWallet' }] })
  assert.equal(b.status, 'accepted')
  const c = await svc.sell(1042, { receiptCurrency: 'USD', invoiceNo: 'INV-3', lines: [item('Whisky', 20), item('Soda', 1, 2)], payments: [{ moneyTypeCode: 'Cash', amount: 10 }, { moneyTypeCode: 'Card', amount: 11 }],
    buyer: { buyerRegisterName: 'Acme Ltd', buyerTIN: '1234567890' } })
  assert.equal(c.status, 'accepted')
  // chain: each device signature includes the previous hash, so tampering any link is detectable
  assert.notEqual(a.receipt.receiptDeviceSignature.hash, b.receipt.receiptDeviceSignature.hash)

  const cn = await svc.sell(1042, { receiptType: 'CreditNote', receiptCurrency: 'USD', invoiceNo: 'CN-1', receiptNotes: 'Customer returned 1 bottle',
    creditDebitNote: { deviceID: 1042, receiptGlobalNo: 1, fiscalDayNo: 1 }, lines: [item('Castle Lager 340ml', 2)] })
  assert.equal(cn.status, 'accepted'); assert.equal(cn.receipt.receiptTotal, -2)
  const simDev = S.sim.devices.get(1042)
  assert.ok(simDev.day.receipts.every((r) => r.color === null), JSON.stringify(simDev.day.receipts.map((r) => r.errors)))

  const closed = await svc.closeDay(1042)
  assert.equal(closed.status, 'FiscalDayClosed'); assert.equal(closed.serverSigVerified, true)
  assert.equal(simDev.day.status, 'FiscalDayClosed')
  const types = closed.counters.map((x) => x.fiscalCounterType)
  for (const t of ['SaleByTax', 'SaleTaxByTax', 'CreditNoteByTax', 'CreditNoteTaxByTax', 'BalanceByMoneyType']) assert.ok(types.includes(t), t)
})

test('second day: day number +1, receiptGlobalNo CONTINUES, receiptCounter resets', async () => {
  const d = await svc.openDay(1042)
  assert.equal(d.fiscalDayNo, 2)
  const r = await svc.sell(1042, { receiptCurrency: 'USD', invoiceNo: 'INV-D2-1', lines: [item('Water', 1, 3)] })
  assert.equal(r.receipt.receiptCounter, 1); assert.equal(r.receipt.receiptGlobalNo, 5); assert.equal(r.status, 'accepted')
  assert.equal((await svc.closeDay(1042)).status, 'FiscalDayClosed')
})

test('pre-flight blocks receipts FDMS would colour Red (duplicate invoice number)', async () => {
  await svc.openDay(1042)
  await svc.sell(1042, { receiptCurrency: 'USD', invoiceNo: 'DUP-1', lines: [item('A', 1)] })
  await assert.rejects(svc.sell(1042, { receiptCurrency: 'USD', invoiceNo: 'DUP-1', lines: [item('B', 1)] }), (e) => e instanceof BridgeError && e.code === 'PREFLIGHT_FAILED' && /RCPT013/.test(e.message))
  await assert.rejects(svc.sell(1042, { receiptCurrency: 'XXX', invoiceNo: 'CUR-1', lines: [item('B', 1)] }), (e) => /RCPT010/.test(e.message))
  await svc.closeDay(1042)
})

test('mutual TLS: no certificate => 401; another device\'s certificate => 401', async () => {
  const raw = await store.get(1042)
  const noCert = new FdmsClient({ baseUrl: S.url, deviceID: 1042, modelName: 'ZimFDMS', modelVersion: '1.0', ca: S.caPem })
  await assert.rejects(noCert.getConfig(), (e) => e.status === 401)
  await onboard(svc, 3001, 'SN3001', 'RAWX0001')
  const other = await store.get(3001)
  const wrongDevice = new FdmsClient({ baseUrl: S.url, deviceID: 1042, modelName: 'ZimFDMS', modelVersion: '1.0', ca: S.caPem, cert: other.certPem, key: open(other.privateKeySealed, masterKey) })
  await assert.rejects(wrongDevice.getConfig(), (e) => e.status === 401)
  const ok = new FdmsClient({ baseUrl: S.url, deviceID: 1042, modelName: 'ZimFDMS', modelVersion: '1.0', ca: S.caPem, cert: raw.certPem, key: open(raw.privateKeySealed, masterKey) })
  assert.ok((await ok.getConfig()).qrUrl)
  assert.equal((await ok.ping()).reportingFrequency, 5)
})

test('HTTP semantics: 405 for wrong verb, 404 for unknown path, ProblemDetails body', async () => {
  const get = (method, path) => new Promise((resolve) => {
    https.request(S.url + path, { method, ca: S.caPem }, (res) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(c).toString() || '{}') })) }).end()
  })
  assert.equal((await get('POST', '/Device/v1/1042/GetConfig')).status, 405)
  assert.equal((await get('GET', '/nope')).status, 404)
  const r = await get('GET', '/Public/v1/GetServerCertificate')
  assert.equal(r.status, 200); assert.equal(r.body.certificate.length, 2)
})

test('server rejects tampered receipts: Red RCPT020 blocks closeDay until fixed; Grey (gap) blocks too', async () => {
  const dev = await onboard(svc, 3001 === 3001 ? 3001 : 0, 'SN3001', 'RAWX0001').catch(() => null) // already registered above → ignore
  void dev
  const raw = await store.get(3001)
  const key = open(raw.privateKeySealed, masterKey)
  const c = new FdmsClient({ baseUrl: S.url, deviceID: 3001, modelName: 'ZimFDMS', modelVersion: '1.0', ca: S.caPem, cert: raw.certPem, key })
  const cfg = await c.getConfig()
  const opened = localIso()
  await c.openDay({ fiscalDayOpened: opened, fiscalDayNo: 1 })
  const base = buildReceipt({ receiptType: 'FiscalInvoice', receiptCurrency: 'USD', invoiceNo: 'RAW-1', lines: [item('x', 10)] }, cfg)

  // Tamper after signing
  const r1 = { ...base, receiptCounter: 1, receiptGlobalNo: 1, receiptDate: localIso(new Date(Date.now() + 1000)) }
  r1.receiptDeviceSignature = signReceipt(key, { deviceID: 3001, receipt: r1 })
  r1.receiptTotal = 9 // tamper
  const resp = await c.submitReceipt(r1)               // FDMS accepts + signs, but marks it Red
  assert.ok(resp.receiptID)
  const rec = S.sim.devices.get(3001).day.receipts[0]
  assert.equal(rec.color, 'Red'); assert.ok(rec.errors.some((e) => e.code === 'RCPT020'))
  await assert.rejects(c.closeDay({ fiscalDayNo: 1, fiscalDayCounters: [], fiscalDayDeviceSignature: { hash: 'x', signature: 'y' }, receiptCounter: 1 }), (e) => e.errorCode === 'ReceiptsWithValidationErrors' && e.status === 422)

  // Idempotent resubmission returns the SAME receiptID (spec 4.7)
  const again = await c.submitReceipt(r1)
  assert.equal(again.receiptID, resp.receiptID); assert.notEqual(again.operationID, resp.operationID)

  // Grey: counter 3 arrives with no counter 2
  const r3 = { ...base, invoiceNo: 'RAW-3', receiptCounter: 3, receiptGlobalNo: 3, receiptDate: localIso(new Date(Date.now() + 3000)) }
  r3.receiptDeviceSignature = signReceipt(key, { deviceID: 3001, receipt: r3, previousReceiptHash: 'whatever' })
  await c.submitReceipt(r3)
  assert.equal(S.sim.devices.get(3001).day.receipts[1].color, 'Grey')
})

test('close with wrong counters => CountersMismatch, status CloseFailed, day can be resubmitted correctly', async () => {
  await onboard(svc, 4001, 'SN4001', 'NETW0001')
  await svc.openDay(4001)
  const r = await svc.sell(4001, { receiptCurrency: 'USD', invoiceNo: 'N-1', lines: [item('A', 5)] })
  assert.equal(r.status, 'accepted')
  const raw = await store.get(4001)
  const key = open(raw.privateKeySealed, masterKey)
  const c = new FdmsClient({ baseUrl: S.url, deviceID: 4001, modelName: 'ZimFDMS', modelVersion: '1.0', ca: S.caPem, cert: raw.certPem, key })
  const wrong = [{ fiscalCounterType: 'SaleByTax', fiscalCounterCurrency: 'USD', fiscalCounterTaxID: 3, fiscalCounterTaxPercent: 15, fiscalCounterValue: 999 }]
  const sigArgs = { deviceID: 4001, fiscalDayNo: 1, fiscalDayDate: raw.day.opened.slice(0, 10), counters: wrong }
  await c.closeDay({ fiscalDayNo: 1, fiscalDayCounters: wrong, fiscalDayDeviceSignature: signFiscalDay(key, sigArgs), receiptCounter: 1 })
  await new Promise((r) => setTimeout(r, 100))
  const st = await c.getStatus()
  assert.equal(st.fiscalDayStatus, 'FiscalDayCloseFailed'); assert.equal(st.fiscalDayClosingErrorCode, 'CountersMismatch')
  // device can still submit receipts in CloseFailed (spec 4.7) …
  const r2 = buildReceipt({ receiptType: 'FiscalInvoice', receiptCurrency: 'USD', invoiceNo: 'N-2', lines: [item('B', 1)] }, await c.getConfig())
  const full = { ...r2, receiptCounter: 2, receiptGlobalNo: 2, receiptDate: localIso(new Date(Date.now() + 2000)) }
  full.receiptDeviceSignature = signReceipt(key, { deviceID: 4001, receipt: full, previousReceiptHash: r.receipt.receiptDeviceSignature.hash })
  assert.ok((await c.submitReceipt(full)).receiptID)
  // … and the service's own (correct) close then succeeds.
  const dev = await store.get(4001)
  dev.day.receipts.push({ receipt: full, status: 'accepted', receiptID: 1 }); dev.lastGlobalNo = 2
  await store.put(4001, dev)
  assert.equal((await svc.closeDay(4001)).status, 'FiscalDayClosed')
})

test('network failure: receipt is queued (QR still printable), then flushed in order once FDMS is reachable', async () => {
  await svc.openDay(4001)
  const good = (await store.get(4001)).baseUrl
  const d = await store.get(4001); d.baseUrl = 'https://127.0.0.1:1'; await store.put(4001, d)
  const q1 = await svc.sell(4001, { receiptCurrency: 'USD', invoiceNo: 'Q-1', lines: [item('A', 1)] })
  const q2 = await svc.sell(4001, { receiptCurrency: 'USD', invoiceNo: 'Q-2', lines: [item('B', 1)] })
  assert.equal(q1.status, 'queued'); assert.equal(q2.status, 'queued')
  assert.ok(q1.qr.url && q2.qr.url, 'customer still gets a QR while offline')
  assert.equal(S.sim.devices.get(4001).day.receipts.length, 0, 'nothing reached FDMS')
  await assert.rejects(svc.closeDay(4001), (e) => e.code === 'UNSENT_RECEIPTS' || e instanceof FdmsHttpError)
  const d2 = await store.get(4001); d2.baseUrl = good; await store.put(4001, d2)
  const f = await svc.flush(4001)
  assert.equal(f.sent, 2)
  const sim = S.sim.devices.get(4001).day.receipts
  assert.deepEqual(sim.map((r) => r.receipt.receiptCounter), [1, 2]); assert.ok(sim.every((r) => r.color === null))
  assert.equal((await svc.closeDay(4001)).status, 'FiscalDayClosed')
})

test('concurrency: 12 simultaneous sales on one device get unique, gapless counters', async () => {
  await onboard(svc, 5001, 'SN5001', 'CONC0001')
  await svc.openDay(5001)
  const res = await Promise.all(Array.from({ length: 12 }, (_, i) => svc.sell(5001, { receiptCurrency: 'USD', invoiceNo: `P-${i}`, lines: [item(`i${i}`, 1 + i)] })))
  assert.ok(res.every((r) => r.status === 'accepted'))
  const counters = res.map((r) => r.receipt.receiptCounter).sort((a, b) => a - b)
  assert.deepEqual(counters, Array.from({ length: 12 }, (_, i) => i + 1))
  assert.ok(S.sim.devices.get(5001).day.receipts.every((r) => r.color === null))
  assert.equal((await svc.closeDay(5001)).status, 'FiscalDayClosed')
})

test('certificate renewal: new key+cert issued, old sealed key replaced, device keeps working', async () => {
  const before = (await store.get(5001)).certPem
  assert.equal((await svc.renewCertificateIfNeeded(5001, 10)).renewed, false)
  assert.equal((await svc.renewCertificateIfNeeded(5001, 4000)).renewed, true)
  const after = (await store.get(5001)).certPem
  assert.notEqual(before, after)
  await svc.openDay(5001)
  assert.equal((await svc.sell(5001, { receiptCurrency: 'USD', invoiceNo: 'R-1', lines: [item('A', 1)] })).status, 'accepted')
  await svc.closeDay(5001)
})

test('OFFLINE mode: online endpoints are refused (DEV01); receipts leave as files at day close and are processed in order', async () => {
  await onboard(svc, 2001, 'SN2001', 'OFFL0001')
  const raw = await store.get(2001)
  const c = new FdmsClient({ baseUrl: S.url, deviceID: 2001, modelName: 'ZimFDMS', modelVersion: '1.0', ca: S.caPem, cert: raw.certPem, key: open(raw.privateKeySealed, masterKey) })
  await assert.rejects(c.getStatus(), (e) => e.errorCode === 'DEV01')

  await svc.openDay(2001)
  const a = await svc.sell(2001, { receiptCurrency: 'USD', invoiceNo: 'O-1', lines: [item('A', 4)] })
  const b = await svc.sell(2001, { receiptCurrency: 'USD', invoiceNo: 'O-2', lines: [item('B', 6, 1)] })
  assert.equal(a.status, 'queued'); assert.equal(b.status, 'queued')
  assert.equal(S.sim.devices.get(2001).allReceipts.length, 0)
  const closed = await svc.closeDay(2001)
  assert.equal(closed.mode, 'Offline'); assert.ok(closed.filesSubmitted >= 1)
  await new Promise((r) => setTimeout(r, 100))
  const fs = await svc.fileStatus(2001)
  assert.ok(fs.fileStatus.every((f) => f.fileProcessingStatus === 'FileProcessingIsSuccessful'), JSON.stringify(fs))
  assert.equal(S.sim.devices.get(2001).day.status, 'FiscalDayClosed')
  assert.equal(S.sim.devices.get(2001).day.receipts.length, 2)
})

test('offline file builder: ≤3 MB per file, strictly ordered sequence, footer never split', () => {
  const dev = { deviceID: 1, day: { no: 7, opened: '2026-01-01T08:00:00', receipts: [] }, mode: 'Offline' }
  const fat = 'x'.repeat(2000)
  for (let i = 1; i <= 3000; i++) dev.day.receipts.push({ receipt: { receiptCounter: i, receiptGlobalNo: i, pad: fat } })
  const files = svc.buildOfflineFiles(dev, { counters: [], fiscalDayDeviceSignature: { hash: 'h', signature: 's' }, receiptCounter: 3000, closedAt: '2026-01-01T20:00:00' })
  assert.ok(files.length >= 3)
  files.forEach((f, i) => { assert.equal(f.header.fileSequence, i + 1); assert.ok(Buffer.byteLength(JSON.stringify(f)) < 3 * 1024 * 1024) })
  assert.equal(files.filter((f) => f.footer).length, 1)
  assert.ok(files.at(-1).footer)
  assert.equal(files.flatMap((f) => f.content?.receipts || []).length, 3000)
  assert.deepEqual(Object.keys(files[0]).slice(0, 2), ['header', 'content'])
})
