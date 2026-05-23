/**
 * zimFDMS — in-memory mock FDMS backend.
 *
 * Implements the v7.2 endpoints purely client-side so the playground works
 * without any ZIMRA credentials or network calls. State lives in localStorage
 * so users can refresh and keep their fiscal day.
 *
 * Endpoints stubbed:
 *   verifyTaxpayerInformation, registerDevice, issueCertificate,
 *   getConfig, getStatus, openDay, submitReceipt, closeDay, ping.
 */

const STORE_KEY = 'zimfdms.mock.v1'

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || empty() }
  catch { return empty() }
}
function save(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch {}
}
function empty() {
  return {
    devices: {},      // deviceID -> { taxpayer, deviceSerialNo, mode, fiscalDayStatus, fiscalDayNo, receipts: [], dayCounters: {} }
    nextOperationID: 1,
  }
}

function opId(state) {
  return `OP-${String(state.nextOperationID++).padStart(8, '0')}`
}

/** Create a fresh device record. Mirrors `verifyTaxpayerInformation` + `registerDevice`. */
function newDevice(deviceID, deviceSerialNo) {
  return {
    deviceID,
    deviceSerialNo,
    taxpayer: {
      taxPayerName: 'Demo Trader (Pvt) Ltd',
      taxPayerTIN: '1000000001',
      vatNumber: '200000001',
      deviceBranchName: 'Harare CBD Branch',
      deviceBranchAddress: { houseNo: '12', street: 'Speke Avenue', city: 'Harare', province: 'Harare' },
      deviceBranchContacts: { phoneNo: '+263242000000', email: 'demo@zimfdms.local' },
    },
    deviceOperatingMode: 'Online',
    taxPayerDayMaxHrs: 24,
    taxpayerDayEndNotificationHrs: 1,
    applicableTaxes: [
      { taxID: 1, taxName: 'Standard 15% VAT', taxPercent: 15, taxValidFrom: '2024-01-01' },
      { taxID: 2, taxName: 'Zero rated',       taxPercent: 0,  taxValidFrom: '2024-01-01' },
      { taxID: 3, taxName: 'Exempt',           taxValidFrom: '2024-01-01' },
    ],
    qrUrl: 'https://invoice-verification.zimra.co.zw',
    certificateValidTill: new Date(Date.now() + 365 * 86400000).toISOString(),
    fiscalDayStatus: 'FiscalDayClosed',
    fiscalDayNo: 0,
    receipts: [],
    dayCounters: {},
  }
}

// ─── Endpoints ────────────────────────────────────────────────────────────

export async function verifyTaxpayerInformation({ deviceID }) {
  const s = load()
  const dev = s.devices[deviceID] || newDevice(deviceID, `SN-${deviceID}`)
  return {
    operationID: opId(s),
    taxPayerName:        dev.taxpayer.taxPayerName,
    taxPayerTIN:         dev.taxpayer.taxPayerTIN,
    vatNumber:           dev.taxpayer.vatNumber,
    deviceBranchName:    dev.taxpayer.deviceBranchName,
    deviceBranchAddress: dev.taxpayer.deviceBranchAddress,
    deviceBranchContacts: dev.taxpayer.deviceBranchContacts,
  }
}

export async function registerDevice({ deviceID, deviceSerialNo, certificateRequest }) {
  const s = load()
  s.devices[deviceID] = s.devices[deviceID] || newDevice(deviceID, deviceSerialNo || `SN-${deviceID}`)
  // Return a placeholder certificate string. In the real flow ZIMRA returns
  // an X.509 PEM cert; for the mock we just acknowledge.
  const certificate = `-----BEGIN CERTIFICATE-----\nMOCK-DEVICE-CERT-${deviceID}-${Date.now()}\n-----END CERTIFICATE-----`
  const out = { operationID: opId(s), certificate }
  save(s)
  return out
}

export async function getConfig({ deviceID }) {
  const s = load()
  const dev = s.devices[deviceID] || newDevice(deviceID, `SN-${deviceID}`)
  s.devices[deviceID] = dev
  save(s)
  const operationID = opId(s)
  save(s)
  return {
    operationID,
    taxPayerName: dev.taxpayer.taxPayerName,
    taxPayerTIN: dev.taxpayer.taxPayerTIN,
    vatNumber: dev.taxpayer.vatNumber,
    deviceSerialNo: dev.deviceSerialNo,
    deviceBranchName: dev.taxpayer.deviceBranchName,
    deviceBranchAddress: dev.taxpayer.deviceBranchAddress,
    deviceBranchContacts: dev.taxpayer.deviceBranchContacts,
    deviceOperatingMode: dev.deviceOperatingMode,
    taxPayerDayMaxHrs: dev.taxPayerDayMaxHrs,
    taxpayerDayEndNotificationHrs: dev.taxpayerDayEndNotificationHrs,
    applicableTaxes: dev.applicableTaxes,
    certificateValidTill: dev.certificateValidTill,
    qrUrl: dev.qrUrl,
  }
}

export async function getStatus({ deviceID }) {
  const s = load()
  const dev = s.devices[deviceID] || newDevice(deviceID, `SN-${deviceID}`)
  s.devices[deviceID] = dev
  return {
    operationID: opId(s),
    fiscalDayStatus: dev.fiscalDayStatus,
    lastFiscalDayNo: dev.fiscalDayNo || undefined,
    lastReceiptGlobalNo: dev.receipts.length || undefined,
  }
}

export async function openDay({ deviceID, fiscalDayOpened, fiscalDayNo }) {
  const s = load()
  const dev = s.devices[deviceID] || newDevice(deviceID, `SN-${deviceID}`)
  if (dev.fiscalDayStatus !== 'FiscalDayClosed') {
    return { error: 'DEV02', message: `Cannot open day; current status is ${dev.fiscalDayStatus}` }
  }
  dev.fiscalDayStatus = 'FiscalDayOpened'
  dev.fiscalDayNo = fiscalDayNo || (dev.fiscalDayNo + 1)
  dev.fiscalDayOpened = fiscalDayOpened
  dev.receipts = []
  dev.dayCounters = {}
  s.devices[deviceID] = dev
  const out = { operationID: opId(s), fiscalDayNo: dev.fiscalDayNo }
  save(s)
  return out
}

export async function submitReceipt({ deviceID, receipt }) {
  const s = load()
  const dev = s.devices[deviceID]
  if (!dev) return { error: 'DEV01', message: 'Device not registered.' }
  if (dev.fiscalDayStatus !== 'FiscalDayOpened' && dev.fiscalDayStatus !== 'FiscalDayCloseFailed') {
    return { error: 'RCPT001', message: `Fiscal day is ${dev.fiscalDayStatus}; cannot submit receipt.` }
  }
  // Counter validation (spec RCPT011)
  const expectedCounter = (dev.receipts.length === 0) ? 1 : dev.receipts.at(-1).receiptCounter + 1
  if (receipt.receiptCounter !== expectedCounter) {
    return { error: 'RCPT011', message: `receiptCounter must be ${expectedCounter}` }
  }
  const stamped = {
    ...receipt,
    receiptID: 1_000_000 + dev.receipts.length + 1,
    submittedAt: new Date().toISOString(),
    receiptServerSignature: {
      hash: 'mock-fdms-hash-' + Math.random().toString(36).slice(2, 10),
      signature: 'mock-fdms-sig-' + Math.random().toString(36).slice(2, 14),
    },
  }
  dev.receipts.push(stamped)

  // Maintain per-tax-percent counters for Z report later
  for (const t of receipt.receiptTaxes || []) {
    const key = `${t.taxID}|${t.taxPercent ?? 'EX'}`
    dev.dayCounters[key] = dev.dayCounters[key] || { taxID: t.taxID, taxPercent: t.taxPercent, sales: 0, taxAmount: 0 }
    dev.dayCounters[key].sales += Number(t.salesAmountWithTax) || 0
    dev.dayCounters[key].taxAmount += Number(t.taxAmount) || 0
  }

  s.devices[deviceID] = dev
  const out = {
    operationID: opId(s),
    receiptID: stamped.receiptID,
    receiptServerSignature: stamped.receiptServerSignature,
  }
  save(s)
  return out
}

export async function closeDay({ deviceID, fiscalDayClosed }) {
  const s = load()
  const dev = s.devices[deviceID]
  if (!dev) return { error: 'DEV01', message: 'Device not registered.' }
  if (dev.fiscalDayStatus !== 'FiscalDayOpened' && dev.fiscalDayStatus !== 'FiscalDayCloseFailed') {
    return { error: 'DAY01', message: `Cannot close day from status ${dev.fiscalDayStatus}` }
  }
  dev.fiscalDayStatus = 'FiscalDayClosed'
  dev.fiscalDayClosed = fiscalDayClosed || new Date().toISOString()
  s.devices[deviceID] = dev
  const out = {
    operationID: opId(s),
    fiscalDayServerSignature: {
      hash: 'mock-zreport-hash-' + Math.random().toString(36).slice(2, 12),
      signature: 'mock-zreport-sig-' + Math.random().toString(36).slice(2, 14),
    },
  }
  save(s)
  return out
}

export async function ping({ deviceID }) {
  const s = load()
  return { operationID: opId(s), echo: deviceID, time: new Date().toISOString() }
}

// ─── Helpers for the dashboard to read mock state ─────────────────────────

export function getDeviceState(deviceID) {
  const s = load()
  return s.devices[deviceID] || null
}

export function resetMock() {
  save(empty())
}
