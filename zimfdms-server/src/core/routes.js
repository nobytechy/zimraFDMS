/**
 * Endpoint map for the Fiscal Device Gateway API.
 *
 * !! UNVERIFIED !!  The v7.2 PDF documents operations, parameters and errors but NOT
 * URL paths or HTTP verbs (it says only "see Swagger" at
 * https://fdmsapitest.zimra.co.zw/swagger/index.html). The paths below follow the
 * layout ZIMRA's Swagger is commonly reported to use, but confirm every line against
 * swagger.json. This is the ONLY file that needs to change; client and simulator both read it.
 *
 * `public: true`  => no client certificate required (spec 7.3).
 * `body`          => request carries a JSON body; otherwise params go in the query string.
 */
export const ROUTES = {
  verifyTaxpayerInformation: { method: 'POST', path: (d) => `/Public/v1/${d}/VerifyTaxpayerInformation`, public: true, body: true },
  registerDevice:            { method: 'POST', path: (d) => `/Public/v1/${d}/RegisterDevice`,            public: true, body: true },
  getServerCertificate:      { method: 'GET',  path: () => `/Public/v1/GetServerCertificate`,            public: true, body: false },
  issueCertificate:          { method: 'POST', path: (d) => `/Device/v1/${d}/IssueCertificate`,          body: true },
  getConfig:                 { method: 'GET',  path: (d) => `/Device/v1/${d}/GetConfig`,                  body: false },
  getStatus:                 { method: 'GET',  path: (d) => `/Device/v1/${d}/GetStatus`,                  body: false },
  openDay:                   { method: 'POST', path: (d) => `/Device/v1/${d}/OpenDay`,                    body: true },
  submitReceipt:             { method: 'POST', path: (d) => `/Device/v1/${d}/SubmitReceipt`,              body: true },
  closeDay:                  { method: 'POST', path: (d) => `/Device/v1/${d}/CloseDay`,                   body: true },
  submitFile:                { method: 'POST', path: (d) => `/Device/v1/${d}/SubmitFile`,                 body: true },
  getFileStatus:             { method: 'GET',  path: (d) => `/Device/v1/${d}/GetFileStatus`,              body: false },
  ping:                      { method: 'POST', path: (d) => `/Device/v1/${d}/Ping`,                       body: true },
}

/** Reverse lookup for the simulator: (method, path) -> { op, deviceID } */
export function matchRoute(method, pathname) {
  for (const [op, r] of Object.entries(ROUTES)) {
    if (r.method !== method) continue
    if (op === 'getServerCertificate') { if (pathname.toLowerCase() === r.path().toLowerCase()) return { op, route: r } ; continue }
    const m = /^\/(Public|Device)\/v1\/(\d+)\/(\w+)$/i.exec(pathname)
    if (m && r.path(m[2]).toLowerCase() === pathname.toLowerCase()) return { op, route: r, deviceID: Number(m[2]) }
  }
  return null
}
