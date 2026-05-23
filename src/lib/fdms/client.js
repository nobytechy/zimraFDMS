/**
 * zimFDMS — high-level client used by the playground + merchant dashboard.
 *
 * Reads runtime settings (mode = demo|real, device ID, etc.) and routes to
 * either the in-browser mock backend OR the real ZIMRA Fiscal Device Gateway.
 *
 * In Phase 1, "real" mode is stubbed — the actual proxy will live in a Netlify
 * Function (added when Noby's ZIMRA device ID is available).
 */

import * as mock from './mockBackend.js'

export function createClient({ mode = 'demo', deviceID = 999, baseUrl, ...rest } = {}) {
  const isReal = mode === 'real' && baseUrl
  const proxy = (fn) => async (args) => {
    if (!isReal) return mock[fn]({ deviceID, ...args })
    // Real-mode path lives here when ZIMRA creds are wired:
    // return fetch(`${baseUrl}/${fn}`, { method: 'POST', body: JSON.stringify({ deviceID, ...args }) }).then(r => r.json())
    return { error: 'NOT_CONFIGURED', message: 'Real ZIMRA proxy not yet wired. Add your device ID and credentials in Admin → Settings.' }
  }
  return {
    mode,
    deviceID,
    verifyTaxpayerInformation: proxy('verifyTaxpayerInformation'),
    registerDevice:            proxy('registerDevice'),
    getConfig:                 proxy('getConfig'),
    getStatus:                 proxy('getStatus'),
    openDay:                   proxy('openDay'),
    submitReceipt:             proxy('submitReceipt'),
    closeDay:                  proxy('closeDay'),
    ping:                      proxy('ping'),
    // Helpers (mock-only — not part of the spec)
    _peekDevice: () => mock.getDeviceState(deviceID),
    _resetMock:  () => mock.resetMock(),
  }
}
