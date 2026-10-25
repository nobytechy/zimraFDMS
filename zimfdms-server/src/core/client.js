/**
 * mTLS HTTP client for the Fiscal Device Gateway (spec 4, 7).
 *  - HTTPS only; client certificate for every endpoint except the public ones
 *  - mandatory DeviceModelName / DeviceModelVersionNo headers on EVERY request
 *  - 30 s timeout (spec 7.4)
 *  - errors surface as FdmsHttpError { status, errorCode, retryable }
 */
import https from 'node:https'
import { ROUTES } from './routes.js'

export class FdmsHttpError extends Error {
  constructor({ status, errorCode, title, retryable, cause }) {
    super(`${status || 'NETWORK'}${errorCode ? ' ' + errorCode : ''}: ${title || cause?.message || ''}`)
    this.status = status
    this.errorCode = errorCode
    this.title = title
    /** 500/502 and network faults: spec says "retry later". 4xx: fix the request. */
    this.retryable = retryable
    this.cause = cause
  }
}

export class FdmsClient {
  constructor({ baseUrl, deviceID, modelName, modelVersion, cert, key, ca, timeoutMs = 30000, rejectUnauthorized = true, agent }) {
    if (!/^https:/i.test(baseUrl)) throw new Error('FDMS baseUrl must be https')
    Object.assign(this, { baseUrl: baseUrl.replace(/\/+$/, ''), deviceID, modelName, modelVersion, timeoutMs })
    this.agent = agent || new https.Agent({ cert, key, ca, rejectUnauthorized, keepAlive: true })
  }

  /** Generic call. `params` = body (POST) or query (GET). */
  call(op, params = {}) {
    const route = ROUTES[op]
    if (!route) throw new Error(`Unknown operation ${op}`)
    const url = new URL(this.baseUrl + route.path(this.deviceID))
    let payload
    if (route.body) payload = JSON.stringify(params)
    else for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v))

    const headers = {
      DeviceModelName: this.modelName,
      DeviceModelVersionNo: this.modelVersion,
      Accept: 'application/json',
    }
    if (payload !== undefined) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload) }

    return new Promise((resolve, reject) => {
      const req = https.request(url, { method: route.method, headers, agent: this.agent, timeout: this.timeoutMs }, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let json
          try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json)
          reject(new FdmsHttpError({
            status: res.statusCode, errorCode: json.errorCode, title: json.title,
            retryable: res.statusCode >= 500,
          }))
        })
      })
      req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })))
      req.on('error', (e) => reject(new FdmsHttpError({ retryable: true, cause: e })))
      if (payload !== undefined) req.write(payload)
      req.end()
    })
  }

  // Spec method names -----------------------------------------------------
  verifyTaxpayerInformation({ activationKey, deviceSerialNo }) { return this.call('verifyTaxpayerInformation', { activationKey, deviceSerialNo }) }
  registerDevice({ activationKey, certificateRequest }) { return this.call('registerDevice', { activationKey, certificateRequest }) }
  getServerCertificate(thumbprint) { return this.call('getServerCertificate', { thumbprint }) }
  issueCertificate({ certificateRequest }) { return this.call('issueCertificate', { certificateRequest }) }
  getConfig() { return this.call('getConfig') }
  getStatus() { return this.call('getStatus') }
  openDay({ fiscalDayOpened, fiscalDayNo }) { return this.call('openDay', { fiscalDayOpened, fiscalDayNo }) }
  submitReceipt(receipt) { return this.call('submitReceipt', { receipt }) }
  closeDay(args) { return this.call('closeDay', args) }
  submitFile(fileObj) { return this.call('submitFile', { file: Buffer.from(JSON.stringify(fileObj)).toString('base64') }) }
  getFileStatus({ operationID, fileUploadedFrom, fileUploadedTill }) { return this.call('getFileStatus', { operationID, fileUploadedFrom, fileUploadedTill }) }
  ping() { return this.call('ping') }
}
