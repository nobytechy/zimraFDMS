/**
 * Simulated FDMS business logic (spec 4, 5, 6, 8, 13). Transport-agnostic:
 * each public method takes the already-authenticated deviceID + params and
 * returns a response object, or throws FdmsError (-> RFC 7807 ProblemDetails).
 *
 * Behaviours that are SIMULATOR ASSUMPTIONS (spec silent) are tagged `ASSUMPTION`.
 */
import crypto from 'node:crypto'
import { FdmsError, localIso, pad, r2, normEnum, ReceiptType, localMs } from '../core/util.js'
import { signString, receiptServerSigString, fiscalDayServerSigString, fiscalDaySigString, verifyString, sha256b64, certThumbprint } from '../core/signing.js'
import { validateReceipt, worstColor } from '../core/validate.js'
import { countersFromReceipts } from '../core/receipt.js'
import { deviceCommonName } from '../core/csr.js'

const MAX_FILE_BYTES = 3 * 1024 * 1024
const opId = () => crypto.randomUUID()

export class FdmsSim {
  constructor({ pki, qrUrl = 'https://invoice.zimra.co.zw', signOpts, closeDelayMs = 0, now = () => new Date() }) {
    this.pki = pki
    this.qrUrl = qrUrl
    this.signOpts = signOpts
    this.closeDelayMs = closeDelayMs
    this.now = now
    this.devices = new Map()
    this.models = new Map([['ZimFDMS|1.0', { blacklisted: false }]])  // registered software models
    this.nextReceiptID = 48000
    this.byReceiptID = new Map()                                      // receiptID -> {deviceID, receipt}
    this.taxpayerActive = new Map()                                   // tin -> bool
  }

  // ── admin / test helpers ────────────────────────────────────────────────
  registerModel(name, version, blacklisted = false) { this.models.set(`${name}|${version}`, { blacklisted }) }

  addDevice({ deviceID, activationKey = 'ABCD1234', serialNo = `SN${pad(deviceID, 4)}`, vatNumber = '12341234', mode = 'Online',
    taxpayer = {}, taxes, maxHrs = 24 } = {}) {
    const dev = {
      deviceID, activationKey, serialNo, mode, active: true, maxHrs,
      taxpayer: { name: 'Demo Trader (Pvt) Ltd', tin: '1234567890', ...taxpayer },
      vatNumber,
      branch: { name: 'Harare CBD', address: { province: 'Harare', city: 'Harare', street: 'Speke Avenue', houseNo: '12' }, contacts: { email: 'branch@example.co.zw', phoneNo: '0242000000' } },
      taxes: taxes || [
        { taxID: 1, taxName: 'Exempt', taxValidFrom: '2020-01-01' },
        { taxID: 2, taxName: 'Zero rated 0%', taxPercent: 0, taxValidFrom: '2020-01-01' },
        { taxID: 3, taxName: 'Standard rated 15%', taxPercent: 15, taxValidFrom: '2020-01-01' },
      ],
      certs: new Map(),      // serial -> {pem, validTill, revoked}
      certPem: null, publicKeyPem: null,
      day: { status: 'FiscalDayClosed', no: 0, opened: null, closed: null, error: null, recon: null, counters: [], deviceSig: null, serverSig: null, receipts: [] },
      allReceipts: [],       // across days (for credit notes & invoice uniqueness)
      lastGlobalNo: undefined,
      files: [],
      fileSeq: new Map(),    // fiscalDayNo -> last processed sequence
    }
    this.devices.set(deviceID, dev)
    return dev
  }

  // ── common guards ───────────────────────────────────────────────────────
  _guard(deviceID, headers = {}, { needOnline = false, needOffline = false, publicEp = false } = {}) {
    const name = headers['devicemodelname'], ver = headers['devicemodelversionno']
    const model = this.models.get(`${name}|${ver}`)
    if (!name || !ver || !model) throw new FdmsError(422, 'DEV06', 'Device model and version is not registered in FDMS')
    if (model.blacklisted) throw new FdmsError(422, 'DEV04', 'Device model is blacklisted')
    const dev = this.devices.get(deviceID)
    if (!dev || !dev.active) throw new FdmsError(422, 'DEV01', 'Device not found or not active')
    if (this.taxpayerActive.get(dev.taxpayer.tin) === false) throw new FdmsError(422, 'DEV05', 'Taxpayer is not active')
    if (needOnline && dev.mode === 'Offline') throw new FdmsError(422, 'DEV01', 'Device operating mode is Offline')
    if (needOffline && dev.mode !== 'Offline') throw new FdmsError(422, 'FILE03', 'Device operating mode is not Offline')
    return dev
  }

  // ── 4.1 / 4.2 / 4.3 / 4.12 ──────────────────────────────────────────────
  verifyTaxpayerInformation(deviceID, { activationKey, deviceSerialNo }, headers) {
    const dev = this._guard(deviceID, headers, { publicEp: true })
    if (String(activationKey).toUpperCase() !== dev.activationKey.toUpperCase() || deviceSerialNo !== dev.serialNo)
      throw new FdmsError(422, 'DEV02', 'Activation key is incorrect')
    const out = { operationID: opId(), taxPayerName: dev.taxpayer.name, taxPayerTIN: dev.taxpayer.tin,
      deviceBranchName: dev.branch.name, deviceBranchAddress: dev.branch.address, deviceBranchContacts: dev.branch.contacts }
    if (dev.vatNumber) out.vatNumber = dev.vatNumber
    return out
  }

  async registerDevice(deviceID, { activationKey, certificateRequest }, headers) {
    const dev = this._guard(deviceID, headers, { publicEp: true })
    if (String(activationKey).toUpperCase() !== dev.activationKey.toUpperCase()) throw new FdmsError(422, 'DEV02', 'Activation key is incorrect')
    return this._issue(dev, certificateRequest)
  }

  async issueCertificate(deviceID, { certificateRequest }, headers) {
    const dev = this._guard(deviceID, headers)
    return this._issue(dev, certificateRequest)
  }

  async _issue(dev, csrPem) {
    try {
      const r = await this.pki.issueDeviceCert(csrPem, deviceCommonName(dev.serialNo, dev.deviceID))
      dev.certs.set(r.serial, { pem: r.certPem, validTill: r.validTill, revoked: false })
      dev.certPem = r.certPem
      dev.publicKeyPem = new crypto.X509Certificate(r.certPem).publicKey.export({ type: 'spki', format: 'pem' })
      return { operationID: opId(), certificate: r.certPem }
    } catch (e) {
      if (e.code === 'DEV03') throw new FdmsError(422, 'DEV03', `Certificate request is invalid: ${e.message}`)
      throw e
    }
  }

  getServerCertificate() {
    const x = new crypto.X509Certificate(this.pki.fdms.certPem)
    return { certificate: [this.pki.fdms.certPem, this.pki.caPem], certificateValidTill: new Date(x.validTo).toISOString() }
  }

  // ── 4.4 / 4.5 ───────────────────────────────────────────────────────────
  getConfig(deviceID, _p, headers) {
    const dev = this._guard(deviceID, headers)
    const cert = dev.certPem ? new crypto.X509Certificate(dev.certPem) : null
    const out = {
      operationID: opId(), taxPayerName: dev.taxpayer.name, taxPayerTIN: dev.taxpayer.tin, deviceSerialNo: dev.serialNo,
      deviceBranchName: dev.branch.name, deviceBranchAddress: dev.branch.address, deviceBranchContacts: dev.branch.contacts,
      deviceOperatingMode: dev.mode, taxPayerDayMaxHrs: dev.maxHrs, taxpayerDayEndNotificationHrs: 2,
      applicableTaxes: dev.taxes, certificateValidTill: cert ? new Date(cert.validTo).toISOString() : null, qrUrl: this.qrUrl,
    }
    if (dev.vatNumber) out.vatNumber = dev.vatNumber
    return out
  }

  getStatus(deviceID, _p, headers) {
    const dev = this._guard(deviceID, headers, { needOnline: true })
    const d = dev.day
    const out = { operationID: opId(), fiscalDayStatus: d.status }
    if (d.status === 'FiscalDayClosed' && d.no > 0) {
      out.fiscalDayReconciliationMode = d.recon
      out.fiscalDayServerSignature = d.serverSig
      out.fiscalDayClosed = d.closed
    }
    if (d.status === 'FiscalDayCloseFailed') out.fiscalDayClosingErrorCode = d.error
    if (d.status === 'FiscalDayClosed' && d.recon === 'Manual') { out.fiscalDayCounters = d.counters }
    if (dev.lastGlobalNo !== undefined) out.lastReceiptGlobalNo = dev.lastGlobalNo
    if (d.no > 0) out.lastFiscalDayNo = d.no
    return out
  }

  // ── 4.6 openDay ─────────────────────────────────────────────────────────
  openDay(deviceID, { fiscalDayOpened, fiscalDayNo }, headers) {
    const dev = this._guard(deviceID, headers, { needOnline: true })
    const d = dev.day
    if (d.status !== 'FiscalDayClosed') throw new FdmsError(422, 'FISC01', 'Open day is not allowed')
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(String(fiscalDayOpened))) throw new FdmsError(400, undefined, 'fiscalDayOpened must be local time YYYY-MM-DDTHH:mm:ss')
    const expected = d.no + 1
    if (fiscalDayNo !== undefined && fiscalDayNo !== expected) throw new FdmsError(422, 'FISC01', `fiscalDayNo must be ${expected}`)
    this._startDay(dev, fiscalDayNo ?? expected, fiscalDayOpened)
    return { operationID: opId(), fiscalDayNo: dev.day.no }
  }

  _startDay(dev, no, opened) {
    dev.day = { status: 'FiscalDayOpened', no, opened, closed: null, error: null, recon: null, counters: [], deviceSig: null, serverSig: null, receipts: [] }
  }

  // ── 4.7 submitReceipt ───────────────────────────────────────────────────
  submitReceipt(deviceID, { receipt }, headers) {
    const dev = this._guard(deviceID, headers, { needOnline: true })
    const d = dev.day
    if (d.status !== 'FiscalDayOpened' && d.status !== 'FiscalDayCloseFailed') throw new FdmsError(422, 'RCPT01', 'Fiscal day is closed or close initiated')
    this._structure(receipt)
    const rec = this._ingest(dev, receipt, true)
    return { operationID: opId(), receiptID: rec.receiptID, serverDate: rec.serverDate, receiptServerSignature: rec.serverSignature }
  }

  _structure(r) {
    const bad = (m) => { throw new FdmsError(422, 'RCPT02', `Submit receipt failed: ${m}`) }
    if (!r || typeof r !== 'object') bad('receipt missing')
    if (!normEnum(ReceiptType, r.receiptType)) bad('receiptType')
    if (typeof r.receiptCurrency !== 'string' || r.receiptCurrency.length !== 3) bad('receiptCurrency')
    for (const k of ['receiptCounter', 'receiptGlobalNo']) if (!Number.isInteger(r[k])) bad(k)
    if (typeof r.invoiceNo !== 'string' || !r.invoiceNo || r.invoiceNo.length > 50) bad('invoiceNo')
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(String(r.receiptDate))) bad('receiptDate')
    if (typeof r.receiptTotal !== 'number') bad('receiptTotal')
    for (const k of ['receiptLines', 'receiptTaxes', 'receiptPayments']) if (!Array.isArray(r[k])) bad(k)
    if (!r.receiptDeviceSignature?.hash || !r.receiptDeviceSignature?.signature) bad('receiptDeviceSignature')
    for (const l of r.receiptLines) {
      if (String(l.receiptLineName || '').length > 200 || !l.receiptLineName) bad('receiptLineName')
      if (!Number.isInteger(l.taxID)) bad('line taxID')
    }
  }

  /** Validate + store + counter-sign. Idempotent on (deviceID, globalNo, hash) — spec 4.7. */
  _ingest(dev, receipt, withServerSig) {
    const existing = dev.allReceipts.find((x) => x.receipt.receiptGlobalNo === receipt.receiptGlobalNo &&
      x.receipt.receiptDeviceSignature.hash === receipt.receiptDeviceSignature.hash && x.dayNo === dev.day.no)
    if (existing) return existing

    const rec = { receipt, dayNo: dev.day.no, receiptID: this.nextReceiptID++, serverDate: localIso(this.now()), color: null, errors: [] }
    dev.day.receipts.push(rec)
    dev.allReceipts.push(rec)
    this.byReceiptID.set(rec.receiptID, { deviceID: dev.deviceID, rec })
    dev.lastGlobalNo = Math.max(dev.lastGlobalNo ?? 0, receipt.receiptGlobalNo)
    if (withServerSig) {
      const sig = signString(this.pki.fdms.keyPem, receiptServerSigString({ receiptDeviceSignature: receipt.receiptDeviceSignature, receiptID: rec.receiptID, serverDate: rec.serverDate }), this.signOpts)
      rec.serverSignature = { ...sig, certificateThumbprint: certThumbprint(this.pki.fdms.certPem) }
    }
    this._validate(dev, rec)
    // a newly arrived receipt may complete the chain for a Grey successor (spec 8.2.1)
    for (const g of dev.day.receipts.filter((x) => x.color === 'Grey')) this._validate(dev, g)
    return rec
  }

  _validate(dev, rec) {
    const day = dev.day
    const r = rec.receipt
    const sameDay = day.receipts.filter((x) => x !== rec).map((x) => x.receipt)
    const prev = sameDay.find((x) => x.receiptCounter === r.receiptCounter - 1)
    const res = validateReceipt(r, {
      deviceID: dev.deviceID, config: { applicableTaxes: dev.taxes, vatNumber: dev.vatNumber },
      fiscalDayOpened: day.opened, taxPayerDayMaxHrs: dev.maxHrs, prev,
      isFirstOfDay: r.receiptCounter === 1,
      invoiceExists: (no) => dev.allReceipts.some((x) => x !== rec && x.receipt.invoiceNo === no),
      findOriginal: (c) => this._findOriginal(dev, c),
      nowLocal: localIso(this.now()), publicKeyPem: dev.publicKeyPem, signOpts: this.signOpts,
    })
    rec.errors = res.errors
    rec.color = worstColor(res.errors, res.grey)
  }

  _findOriginal(dev, c) {
    let hit
    if (c.receiptID) hit = this.byReceiptID.get(Number(c.receiptID))
    else hit = [...this.byReceiptID.values()].find((x) => x.deviceID === (c.deviceID ?? dev.deviceID) &&
      x.rec.receipt.receiptGlobalNo === c.receiptGlobalNo && x.rec.dayNo === c.fiscalDayNo)
    if (!hit) return null
    const o = hit.rec.receipt
    const priorNotes = [...this.byReceiptID.values()].map((x) => x.rec.receipt)
      .filter((n) => n.creditDebitNote && (n.creditDebitNote.receiptID === hit.rec.receiptID ||
        (n.creditDebitNote.receiptGlobalNo === o.receiptGlobalNo && n.creditDebitNote.fiscalDayNo === hit.rec.dayNo)))
    return { receipt: o, priorNotes }
  }

  // ── 4.11 closeDay ───────────────────────────────────────────────────────
  closeDay(deviceID, { fiscalDayNo, fiscalDayCounters, fiscalDayDeviceSignature, receiptCounter }, headers) {
    const dev = this._guard(deviceID, headers, { needOnline: true })
    const d = dev.day
    if (d.status === 'FiscalDayCloseInitiated') throw new FdmsError(422, 'FISC03', 'Close day is in progress')
    if (d.status === 'FiscalDayClosed') throw new FdmsError(422, 'FISC04', 'Fiscal day not opened')
    if (fiscalDayNo !== d.no) throw new FdmsError(422, 'FISC04', 'fiscalDayNo must match the opened day')
    // Grey / Red receipts block closing outright (spec 4.11). ASSUMPTION: errorCode names.
    if (d.receipts.some((x) => x.color === 'Grey')) throw new FdmsError(422, 'MissingReceipts', 'Closing day is not allowed: missing receipts (Grey)')
    if (d.receipts.some((x) => x.color === 'Red')) throw new FdmsError(422, 'ReceiptsWithValidationErrors', 'Closing day is not allowed: receipts with validation errors (Red)')
    d.status = 'FiscalDayCloseInitiated'
    const job = () => this._processClose(dev, { fiscalDayCounters, fiscalDayDeviceSignature, receiptCounter })
    this.closeDelayMs > 0 ? setTimeout(job, this.closeDelayMs) : setImmediate(job)
    return { operationID: opId() }
  }

  _processClose(dev, { fiscalDayCounters = [], fiscalDayDeviceSignature, receiptCounter }) {
    const d = dev.day
    const fail = (code) => { d.status = 'FiscalDayCloseFailed'; d.error = code }
    // 1. device signature over the day report
    const text = fiscalDaySigString({ deviceID: dev.deviceID, fiscalDayNo: d.no, fiscalDayDate: d.opened.slice(0, 10), counters: fiscalDayCounters })
    let ok = false
    try {
      ok = fiscalDayDeviceSignature?.hash === sha256b64(text) && verifyString(dev.publicKeyPem, text, fiscalDayDeviceSignature.signature, this.signOpts)
    } catch { ok = false }
    if (!ok) return fail('BadCertificateSignature')
    // 4. counters must match what FDMS computed from the receipts it holds
    const mine = countersFromReceipts(d.receipts.map((x) => x.receipt))
    const key = (c) => [c.fiscalCounterType, c.fiscalCounterCurrency, c.fiscalCounterTaxID ?? '', c.fiscalCounterMoneyType ?? ''].join('|')
    const a = new Map(mine.map((c) => [key(c), r2(c.fiscalCounterValue)]))
    const b = new Map(fiscalDayCounters.filter((c) => Number(c.fiscalCounterValue) !== 0).map((c) => [key(c), r2(c.fiscalCounterValue)]))
    const lastCounter = Math.max(0, ...d.receipts.map((x) => x.receipt.receiptCounter))
    const same = a.size === b.size && [...a].every(([k, v]) => b.get(k) === v)
    if (!same || receiptCounter !== lastCounter) return fail('CountersMismatch')

    d.status = 'FiscalDayClosed'
    d.closed = localIso(this.now())
    d.recon = 'Auto'
    d.counters = fiscalDayCounters
    d.deviceSig = fiscalDayDeviceSignature
    const sig = signString(this.pki.fdms.keyPem, fiscalDayServerSigString({
      deviceID: dev.deviceID, fiscalDayNo: d.no, fiscalDayDate: d.opened.slice(0, 10), fiscalDayUpdated: d.closed,
      reconciliationMode: 'AUTO', counters: fiscalDayCounters, fiscalDayDeviceSignature,
    }), this.signOpts)
    d.serverSig = { ...sig, certificateThumbprint: certThumbprint(this.pki.fdms.certPem) }
  }

  // ── 4.12 ping ───────────────────────────────────────────────────────────
  ping(deviceID, _p, headers) {
    this._guard(deviceID, headers)
    return { operationID: opId(), reportingFrequency: 5 }
  }

  // ── 4.9 / 4.10 offline files ────────────────────────────────────────────
  submitFile(deviceID, { file }, headers, ip = '127.0.0.1') {
    const dev = this._guard(deviceID, headers, { needOffline: true })
    if (typeof file !== 'string') throw new FdmsError(400, undefined, 'file missing')
    const bytes = Buffer.from(file, 'base64')
    if (bytes.length > MAX_FILE_BYTES) throw new FdmsError(422, 'FILE01', 'File is too big. Allowed file size: 3 MB')
    let obj
    try { obj = JSON.parse(bytes.toString('utf8')) } catch { throw new FdmsError(422, 'FILE02', 'File structure invalid') }
    const h = obj?.header
    if (!h || !Number.isInteger(h.deviceID) || !Number.isInteger(h.fiscalDayNo) || !h.fiscalDayOpened || !Number.isInteger(h.fileSequence))
      throw new FdmsError(422, 'FILE02', 'File header invalid')
    if (h.deviceID !== deviceID) throw new FdmsError(422, 'FILE05', 'Device id in input parameters and file header are different')
    if (h.fiscalDayNo <= dev.day.no && dev.day.status === 'FiscalDayClosed' && dev.day.no === h.fiscalDayNo)
      throw new FdmsError(422, 'FILE04', 'File sent for already closed day')
    const operationID = opId()
    const rec = { operationID, fileUploadDate: localIso(this.now()), deviceId: deviceID, fileName: `${deviceID}_${h.fiscalDayNo}_${h.fileSequence}.json`,
      fileProcessingStatus: 'FileProcessingInProgress', fiscalDayNo: h.fiscalDayNo, fiscalDayOpenedAt: h.fiscalDayOpened, fileSequence: h.fileSequence, ipAddress: ip, obj, errors: [] }
    dev.files.push(rec)
    setImmediate(() => this._processFiles(dev, h.fiscalDayNo))
    return { operationID }
  }

  /** Process queued files of one fiscal day strictly in sequence order (spec 9.20). */
  _processFiles(dev, dayNo) {
    const files = dev.files.filter((f) => f.fiscalDayNo === dayNo).sort((a, b) => a.fileSequence - b.fileSequence)
    for (const f of files) {
      if (f.fileProcessingStatus !== 'FileProcessingInProgress' && f.fileProcessingStatus !== 'WaitingForPreviousFile') continue
      const last = dev.fileSeq.get(dayNo) ?? 0
      if (f.fileSequence !== last + 1) { f.fileProcessingStatus = 'WaitingForPreviousFile'; break }
      this._processOneFile(dev, f)
      dev.fileSeq.set(dayNo, f.fileSequence)
    }
  }

  _processOneFile(dev, f) {
    const { header, content, footer } = f.obj
    const err = (code) => { if (!f.errors.includes(code)) f.errors.push(code) }
    if (!dev.day.no || dev.day.no !== header.fiscalDayNo || dev.day.status === 'FiscalDayClosed') {
      this._startDay(dev, header.fiscalDayNo, header.fiscalDayOpened)
    }
    const inOrder = Object.keys(f.obj)
    if (inOrder.indexOf('header') !== 0 || (inOrder.includes('content') && inOrder.includes('footer') && inOrder.indexOf('content') > inOrder.indexOf('footer')))
      err('IncorrectFileFormat')
    for (const r of content?.receipts || []) {
      try { this._structure(r); this._ingest(dev, r, false) } catch { err('IncorrectFileFormat') }
    }
    if (footer) {
      const d = dev.day
      if (d.receipts.some((x) => x.color === 'Grey')) err('MissingReceipts')
      else if (d.receipts.some((x) => x.color === 'Red')) err('ReceiptsWithValidationErrors')
      else {
        d.status = 'FiscalDayCloseInitiated'
        this._processClose(dev, { fiscalDayCounters: footer.fiscalDayCounters || [], fiscalDayDeviceSignature: footer.fiscalDayDeviceSignature, receiptCounter: footer.receiptCounter })
        if (d.status === 'FiscalDayCloseFailed') err(d.error)
        else d.closed = footer.fiscalDayClosed || d.closed
      }
    }
    f.fileProcessingDate = localIso(this.now())
    f.fileProcessingStatus = f.errors.length ? 'FileProcessingWithErrors' : 'FileProcessingIsSuccessful'
  }

  getFileStatus(deviceID, { operationID, fileUploadedFrom, fileUploadedTill }, headers) {
    const dev = this._guard(deviceID, headers, { needOffline: true })
    if (!fileUploadedFrom || !fileUploadedTill) throw new FdmsError(422, 'FILE02', 'fileUploadedFrom/Till are mandatory')
    if ((Date.parse(fileUploadedTill) - Date.parse(fileUploadedFrom)) / 86400e3 > 100) throw new FdmsError(422, 'FILE02', 'Interval must be no more than 100 days')
    const list = dev.files.filter((f) => !operationID || f.operationID === operationID)
      .map(({ obj, errors, ...f }) => ({ ...f, ...(errors.length ? { fileProcessingErrorCode: errors } : {}) }))
    return { operationID: opId(), fileStatus: list }
  }
}
