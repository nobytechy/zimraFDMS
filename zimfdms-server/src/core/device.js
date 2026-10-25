/**
 * DeviceService — the "real bridge": one instance serves many merchants, each with
 * their OWN device (deviceID, activation key, certificate, private key, receipt chain).
 *
 * Flow:  connect → register → openDay → sell… → closeDay      (online)
 *                                      sell… → closeDay → files (offline mode)
 *
 * Guarantees:
 *  - every read-modify-write of a device chain happens inside store.lock(deviceID)
 *  - receipts are sent strictly in receiptGlobalNo order, never skipping (spec 9.13)
 *  - a receipt FDMS would colour Red is refused BEFORE sending (it would block closeDay)
 *  - network failure => receipt stays 'queued' and is flushed later; 4xx => 'rejected', queue halts
 *  - private key + activation key are sealed (AES-GCM) at rest and never returned
 */
import { FdmsClient, FdmsHttpError } from './client.js'
import { generateDeviceKeyAndCsr } from './csr.js'
import { seal, open } from './secrets.js'
import { buildReceipt, countersFromReceipts } from './receipt.js'
import { signReceipt, signFiscalDay, receiptServerSigString, fiscalDayServerSigString, verifyString } from './signing.js'
import { buildQr } from './qr.js'
import { validateReceipt } from './validate.js'
import { localIso, monotonicReceiptDate } from './util.js'
import crypto from 'node:crypto'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MAX_FILE = 2.5 * 1024 * 1024 // stay well under the 3 MB limit

export class BridgeError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details }
}

export class DeviceService {
  constructor({ store, modelName, modelVersion, masterKey, ca, signOpts, qrOpts, tz = 'Africa/Harare', rejectUnauthorized = true, now = () => new Date(), pollMs = 50, pollTries = 40 }) {
    Object.assign(this, { store, modelName, modelVersion, masterKey, ca, signOpts, qrOpts, tz, rejectUnauthorized, now, pollMs, pollTries })
  }

  _local() { return localIso(this.now(), this.tz) }

  _client(dev, { withCert = true } = {}) {
    return new FdmsClient({
      baseUrl: dev.baseUrl, deviceID: dev.deviceID, modelName: this.modelName, modelVersion: this.modelVersion, ca: this.ca, rejectUnauthorized: this.rejectUnauthorized,
      ...(withCert && dev.certPem ? { cert: dev.certPem, key: open(dev.privateKeySealed, this.masterKey) } : {}),
    })
  }

  async _load(deviceID) {
    const dev = await this.store.get(deviceID)
    if (!dev) throw new BridgeError('NOT_FOUND', `Device ${deviceID} is not connected`)
    return dev
  }

  /** Never hand secrets to callers / UI. */
  static publicView(dev) {
    const { activationKeySealed, privateKeySealed, ...rest } = dev
    return { ...rest, hasPrivateKey: Boolean(privateKeySealed) }
  }

  // ── 1. connect: verify the taxpayer BEFORE registering (spec 4.1) ───────
  async connect({ deviceID, serialNo, activationKey, baseUrl, env = 'test', merchantId }) {
    const probe = { deviceID, baseUrl }
    const taxpayer = await this._client(probe, { withCert: false }).verifyTaxpayerInformation({ activationKey, deviceSerialNo: serialNo })
    await this.store.lock(deviceID, async () => {
      // Ownership guard: a deviceID belongs to ONE merchant; a registered device is never overwritten.
      const existing = await this.store.get(deviceID)
      if (existing) {
        if (existing.merchantId !== merchantId) throw new BridgeError('DEVICE_OWNED', `Device ${deviceID} is already connected to another account`)
        if (existing.state === 'registered') throw new BridgeError('ALREADY_REGISTERED', `Device ${deviceID} is already registered`)
      }
      await this.store.put(deviceID, {
        deviceID, merchantId, env, baseUrl, serialNo, state: 'connected',
        activationKeySealed: seal(activationKey, this.masterKey),
        taxpayer, day: { status: 'FiscalDayClosed', no: 0, opened: null, openSent: true, fileSeq: 0, receipts: [] },
        lastGlobalNo: 0, lastDayNo: 0,
      })
    })
    return taxpayer // UI shows name/branch for the merchant to confirm
  }

  // ── 2. register: keygen + CSR + certificate (spec 4.2) ──────────────────
  async register(deviceID, { algorithm = 'ECDSA' } = {}) {
    return this.store.lock(deviceID, async () => {
      const dev = await this._load(deviceID)
      if (dev.state === 'registered') throw new BridgeError('ALREADY_REGISTERED', 'Device already registered')
      const { privateKeyPem, csrPem } = await generateDeviceKeyAndCsr({ deviceSerialNo: dev.serialNo, deviceID, algorithm })
      const res = await this._client(dev, { withCert: false }).registerDevice({
        activationKey: open(dev.activationKeySealed, this.masterKey), certificateRequest: csrPem,
      })
      dev.certPem = res.certificate
      dev.privateKeySealed = seal(privateKeyPem, this.masterKey)
      dev.state = 'registered'
      await this.store.put(deviceID, dev)
      await this._refreshConfigLocked(dev)
      return DeviceService.publicView(await this._load(deviceID))
    })
  }

  async _refreshConfigLocked(dev) {
    const c = this._client(dev)
    const cfg = await c.getConfig()
    dev.config = cfg
    dev.mode = cfg.deviceOperatingMode
    dev.certValidTill = cfg.certificateValidTill
    try { dev.fdmsCertChain = (await c.getServerCertificate()).certificate } catch { /* keep previous */ }
    await this.store.put(dev.deviceID, dev)
    return cfg
  }

  refreshConfig(deviceID) { return this.store.lock(deviceID, async () => this._refreshConfigLocked(await this._load(deviceID))) }

  // ── 3. certificate renewal (spec 4.3, 9.16) ─────────────────────────────
  async renewCertificateIfNeeded(deviceID, daysBefore = 30) {
    return this.store.lock(deviceID, async () => {
      const dev = await this._load(deviceID)
      const left = (Date.parse(dev.certValidTill) - this.now().getTime()) / 86400e3
      if (left > daysBefore) return { renewed: false, daysLeft: Math.floor(left) }
      const { privateKeyPem, csrPem } = await generateDeviceKeyAndCsr({ deviceSerialNo: dev.serialNo, deviceID })
      const res = await this._client(dev).issueCertificate({ certificateRequest: csrPem })
      dev.certPem = res.certificate
      dev.privateKeySealed = seal(privateKeyPem, this.masterKey)
      await this.store.put(deviceID, dev)
      await this._refreshConfigLocked(dev)
      return { renewed: true }
    })
  }

  // ── 4. open the fiscal day (spec 4.6, 9.1-9.2, 9.10) ────────────────────
  async openDay(deviceID) {
    return this.store.lock(deviceID, async () => {
      const dev = await this._load(deviceID)
      if (dev.day.status === 'FiscalDayOpened') throw new BridgeError('DAY_ALREADY_OPEN', `Fiscal day ${dev.day.no} is already open`)
      if (dev.day.receipts.some((r) => r.status !== 'accepted')) throw new BridgeError('UNSENT_RECEIPTS', 'Previous day still has unsent receipts')
      const c = this._client(dev)
      let online = true
      try { await this._refreshConfigLocked(dev) } catch (e) { if (!(e instanceof FdmsHttpError && e.retryable)) throw e; online = false }
      if (dev.mode !== 'Offline' && online) {
        const st = await c.getStatus()
        if (st.lastReceiptGlobalNo !== undefined) dev.lastGlobalNo = Math.max(dev.lastGlobalNo, st.lastReceiptGlobalNo)
        if (st.lastFiscalDayNo !== undefined) dev.lastDayNo = Math.max(dev.lastDayNo, st.lastFiscalDayNo)
        if (st.fiscalDayStatus !== 'FiscalDayClosed') throw new BridgeError('FDMS_DAY_NOT_CLOSED', `FDMS reports ${st.fiscalDayStatus}`)
      }
      const no = dev.lastDayNo + 1
      const opened = this._local()
      dev.day = { status: 'FiscalDayOpened', no, opened, openSent: false, fileSeq: 0, receipts: [], vatAtOpen: Boolean(dev.config?.vatNumber) }
      if (dev.mode !== 'Offline' && online) {
        try { await c.openDay({ fiscalDayOpened: opened, fiscalDayNo: no }); dev.day.openSent = true }
        catch (e) {
          if (e instanceof FdmsHttpError && e.retryable) { /* spec 4.6: may be sent later, but BEFORE receipts */ }
          else { dev.day = { status: 'FiscalDayClosed', no: dev.lastDayNo, opened: null, openSent: true, fileSeq: 0, receipts: [] }; await this.store.put(deviceID, dev); throw e }
        }
      } else if (dev.mode === 'Offline') dev.day.openSent = true // offline: day info travels in the file header
      dev.lastDayNo = no
      await this.store.put(deviceID, dev)
      return { fiscalDayNo: no, opened, sentToFdms: dev.day.openSent }
    })
  }

  // ── 5. sell (spec 4.7, 9, 13.2) ─────────────────────────────────────────
  /** @returns { receipt, qr, status } — status 'accepted' | 'queued' */
  async sell(deviceID, input) {
    const sold = await this.store.lock(deviceID, async () => {
      const dev = await this._load(deviceID)
      const day = dev.day
      if (day.status !== 'FiscalDayOpened') throw new BridgeError('DAY_NOT_OPEN', 'Open the fiscal day first')
      const nowLocal = this._local()
      const maxHrs = dev.config.taxPayerDayMaxHrs
      if (Date.parse(nowLocal + 'Z') > Date.parse(day.opened + 'Z') + maxHrs * 3600e3) throw new BridgeError('DAY_TOO_LONG', `Fiscal day exceeded ${maxHrs}h — close it first (spec 9.4)`)
      if (Boolean(dev.config.vatNumber) !== day.vatAtOpen) throw new BridgeError('VAT_STATUS_CHANGED', 'VAT status changed — close the day and reopen (spec 9.9)')

      const built = buildReceipt(input, dev.config)
      const prev = day.receipts.at(-1)?.receipt
      const receipt = {
        ...built,
        receiptCounter: (prev?.receiptCounter ?? 0) + 1,
        receiptGlobalNo: dev.lastGlobalNo + 1,
        receiptDate: monotonicReceiptDate(nowLocal, prev?.receiptDate, day.opened),
      }
      const privateKeyPem = open(dev.privateKeySealed, this.masterKey)
      receipt.receiptDeviceSignature = signReceipt(privateKeyPem, { deviceID, receipt, previousReceiptHash: prev?.receiptDeviceSignature.hash }, this.signOpts)

      // pre-flight: never send what FDMS would colour Red
      const publicKeyPem = new crypto.X509Certificate(dev.certPem).publicKey.export({ type: 'spki', format: 'pem' })
      const pre = validateReceipt(receipt, {
        deviceID, config: dev.config, prev, isFirstOfDay: receipt.receiptCounter === 1,
        fiscalDayOpened: day.opened, taxPayerDayMaxHrs: maxHrs, nowLocal, publicKeyPem, signOpts: this.signOpts,
        invoiceExists: (no) => day.receipts.some((r) => r.receipt.invoiceNo === no),
        findOriginal: input.findOriginal, // optional hook supplied by caller/DB for credit notes
      })
      const red = pre.errors.filter((e) => e.color === 'Red')
      if (red.length) throw new BridgeError('PREFLIGHT_FAILED', `Receipt would be rejected by FDMS: ${red.map((e) => e.code).join(', ')}`, red)

      const qr = buildQr({ qrUrl: dev.config.qrUrl, deviceID, receiptDate: receipt.receiptDate, receiptGlobalNo: receipt.receiptGlobalNo, signatureB64: receipt.receiptDeviceSignature.signature }, this.qrOpts)
      day.receipts.push({ receipt, status: 'queued', qr })
      dev.lastGlobalNo = receipt.receiptGlobalNo
      await this.store.put(deviceID, dev)
      return { receipt, qr, idx: day.receipts.length - 1 }
    })
    const flush = await this.flush(deviceID).catch((e) => ({ error: e }))
    const dev = await this._load(deviceID)
    const rec = dev.day.receipts[sold.idx]
    return { receipt: sold.receipt, qr: sold.qr, status: rec.status, receiptID: rec.receiptID, serverSigVerified: rec.serverSigVerified, flush }
  }

  // ── 6. flush the queue in order (spec 9.13-9.14) ────────────────────────
  async flush(deviceID) {
    return this.store.lock(deviceID, async () => {
      const dev = await this._load(deviceID)
      if (dev.mode === 'Offline') return { sent: 0, note: 'offline mode: receipts leave via files at day close' }
      const c = this._client(dev)
      let sent = 0
      try {
        if (!dev.day.openSent && dev.day.status === 'FiscalDayOpened') {
          await c.openDay({ fiscalDayOpened: dev.day.opened, fiscalDayNo: dev.day.no })
          dev.day.openSent = true
        }
        for (const rec of dev.day.receipts) {
          if (rec.status === 'accepted') continue
          if (rec.status === 'rejected') return { sent, halted: rec.errorCode }
          try {
            const r = await c.submitReceipt(rec.receipt)
            rec.status = 'accepted'; rec.receiptID = r.receiptID; rec.serverDate = r.serverDate; rec.serverSignature = r.receiptServerSignature
            rec.serverSigVerified = this._verifyServerSig(dev, rec)
            sent++
          } catch (e) {
            if (e instanceof FdmsHttpError && !e.retryable) { rec.status = 'rejected'; rec.errorCode = e.errorCode || String(e.status); await this.store.put(deviceID, dev); return { sent, halted: rec.errorCode } }
            throw e
          }
        }
      } catch (e) {
        if (e instanceof FdmsHttpError && e.retryable) { await this.store.put(deviceID, dev); return { sent, pending: true } }
        await this.store.put(deviceID, dev); throw e
      }
      await this.store.put(deviceID, dev)
      return { sent }
    })
  }

  /** Verify FDMS counter-signature with the FDMS cert from getServerCertificate (spec 13.2.2). */
  _verifyServerSig(dev, rec) {
    try {
      const cert = dev.fdmsCertChain?.[0]
      if (!cert) return null
      const text = receiptServerSigString({ receiptDeviceSignature: rec.receipt.receiptDeviceSignature, receiptID: rec.receiptID, serverDate: rec.serverDate })
      return verifyString(cert, text, rec.serverSignature.signature, this.signOpts)
    } catch { return false }
  }

  // ── 7. close the fiscal day (spec 4.11, 13.3) ───────────────────────────
  async closeDay(deviceID) {
    const pre = await this.store.lock(deviceID, async () => {
      const dev = await this._load(deviceID)
      if (dev.day.status !== 'FiscalDayOpened') throw new BridgeError('DAY_NOT_OPEN', 'No open fiscal day')
      return dev.mode
    })
    if (pre !== 'Offline') {
      const f = await this.flush(deviceID)
      const dev = await this._load(deviceID)
      if (dev.day.receipts.some((r) => r.status !== 'accepted')) throw new BridgeError('UNSENT_RECEIPTS', 'Cannot close: receipts not yet accepted by FDMS', f)
    }
    return this.store.lock(deviceID, async () => {
      const dev = await this._load(deviceID)
      const day = dev.day
      const counters = countersFromReceipts(day.receipts.map((r) => r.receipt))
      const receiptCounter = day.receipts.at(-1)?.receipt.receiptCounter ?? 0
      const sigArgs = { deviceID, fiscalDayNo: day.no, fiscalDayDate: day.opened.slice(0, 10), counters }
      const fiscalDayDeviceSignature = signFiscalDay(open(dev.privateKeySealed, this.masterKey), sigArgs, this.signOpts)
      const closedAt = this._local()
      const c = this._client(dev)

      if (dev.mode === 'Offline') {
        const files = this.buildOfflineFiles(dev, { counters, fiscalDayDeviceSignature, receiptCounter, closedAt })
        const ops = []
        for (const f of files) ops.push((await c.submitFile(f)).operationID)
        day.status = 'FiscalDayClosed'; day.closedAt = closedAt; dev.lastDayNo = day.no
        await this.store.put(deviceID, dev)
        return { mode: 'Offline', filesSubmitted: files.length, operationIDs: ops }
      }

      await c.closeDay({ fiscalDayNo: day.no, fiscalDayCounters: counters, fiscalDayDeviceSignature, receiptCounter })
      day.status = 'FiscalDayCloseInitiated'
      await this.store.put(deviceID, dev)
      for (let i = 0; i < this.pollTries; i++) {
        const st = await c.getStatus()
        if (st.fiscalDayStatus === 'FiscalDayClosed') {
          day.status = 'FiscalDayClosed'; day.closedAt = st.fiscalDayClosed; dev.lastDayNo = day.no
          day.serverSignature = st.fiscalDayServerSignature
          try {
            day.serverSigVerified = verifyString(dev.fdmsCertChain[0], fiscalDayServerSigString({
              ...sigArgs, fiscalDayUpdated: st.fiscalDayClosed, reconciliationMode: st.fiscalDayReconciliationMode === 'Manual' ? 'MANUAL' : 'AUTO', fiscalDayDeviceSignature,
            }), st.fiscalDayServerSignature.signature, this.signOpts)
          } catch { day.serverSigVerified = false }
          await this.store.put(deviceID, dev)
          return { mode: 'Online', status: 'FiscalDayClosed', fiscalDayNo: day.no, counters, serverSigVerified: day.serverSigVerified }
        }
        if (st.fiscalDayStatus === 'FiscalDayCloseFailed') {
          day.status = 'FiscalDayOpened'; day.closeError = st.fiscalDayClosingErrorCode
          await this.store.put(deviceID, dev)
          throw new BridgeError('CLOSE_FAILED', `FDMS rejected the day close: ${st.fiscalDayClosingErrorCode}`, st)
        }
        await sleep(this.pollMs)
      }
      throw new BridgeError('CLOSE_PENDING', 'FDMS is still processing the day report; poll again')
    })
  }

  // ── offline files (spec 4.9, 9.17-9.20) ─────────────────────────────────
  buildOfflineFiles(dev, { counters, fiscalDayDeviceSignature, receiptCounter, closedAt }) {
    const day = dev.day
    const header = (seq) => ({ deviceID: dev.deviceID, fiscalDayNo: day.no, fiscalDayOpened: day.opened, fileSequence: seq })
    const chunks = [[]]
    let size = 0
    for (const r of day.receipts) {
      const n = Buffer.byteLength(JSON.stringify(r.receipt))
      if (size + n > MAX_FILE && chunks.at(-1).length) { chunks.push([]); size = 0 }
      chunks.at(-1).push(r.receipt); size += n
    }
    const footer = { fiscalDayCounters: counters, fiscalDayDeviceSignature, receiptCounter, fiscalDayClosed: closedAt }
    const files = chunks.filter((c) => c.length || chunks.length === 1).map((receipts, i) => ({
      header: header(i + 1), ...(receipts.length ? { content: { receipts } } : {}),
    }))
    const footerBytes = Buffer.byteLength(JSON.stringify(footer))
    const last = files.at(-1)
    if (Buffer.byteLength(JSON.stringify(last)) + footerBytes <= MAX_FILE) last.footer = footer   // footer is never split
    else files.push({ header: header(files.length + 1), footer })
    return files
  }

  async fileStatus(deviceID, { operationID } = {}) {
    const dev = await this._load(deviceID)
    const from = new Date(this.now().getTime() - 30 * 86400e3).toISOString().slice(0, 10)
    const till = new Date(this.now().getTime() + 86400e3).toISOString().slice(0, 10)
    return this._client(dev).getFileStatus({ operationID, fileUploadedFrom: from, fileUploadedTill: till })
  }

  async view(deviceID) { return DeviceService.publicView(await this._load(deviceID)) }
}
