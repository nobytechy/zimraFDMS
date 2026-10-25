/**
 * HTTPS + mutual-TLS front for the FDMS simulator.
 *   - public endpoints: no client certificate
 *   - everything else: client cert must chain to the simulator CA, be unexpired,
 *     and its CN must equal ZIMRA-<serial>-<10-digit deviceID> for the deviceID in the URL
 *     (else 401, as spec 7.3)
 */
import https from 'node:https'
import { createPki } from './pki.js'
import { FdmsSim } from './fdms.js'
import { matchRoute } from '../core/routes.js'
import { FdmsError, pad } from '../core/util.js'

export async function startSimulator({ port = 0, host = '127.0.0.1', ...simOpts } = {}) {
  const pki = await createPki()
  const sim = new FdmsSim({ pki, ...simOpts })

  const server = https.createServer({
    key: pki.tls.keyPem, cert: pki.tls.certPem, ca: [pki.caPem],
    requestCert: true, rejectUnauthorized: false,           // we decide per-endpoint
  }, async (req, res) => {
    const send = (status, obj) => {
      const body = JSON.stringify(obj)
      res.writeHead(status, { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', 'Content-Length': Buffer.byteLength(body) })
      res.end(body)
    }
    const problem = (status, title, errorCode) => send(status, new FdmsError(status, errorCode, title).toProblem())
    try {
      const url = new URL(req.url, 'https://sim')
      const m = matchRoute(req.method, url.pathname)
      if (!m) {
        const other = ['GET', 'POST'].filter((x) => x !== req.method).some((x) => matchRoute(x, url.pathname))
        return problem(other ? 405 : 404, other ? 'Method not allowed' : 'Resource not found')
      }
      const { op, route, deviceID } = m

      if (!route.public) {
        const sock = req.socket
        const peer = sock.getPeerCertificate()
        const cn = peer?.subject?.CN
        const dev = sim.devices.get(deviceID)
        if (!sock.authorized || !cn) return problem(401, 'Authentication error')
        if (!dev || cn !== `ZIMRA-${dev.serialNo}-${pad(deviceID, 10)}`) return problem(401, 'Certificate was not issued to calling device')
        const norm = (s) => String(s).toUpperCase().replace(/^0+/, '')
        const rec = [...dev.certs.entries()].find(([s]) => norm(s) === norm(peer.serialNumber))?.[1]
        if (!rec || rec.revoked) return problem(401, 'Certificate revoked or unknown')
      }

      let params = {}
      if (route.body) {
        const chunks = []
        for await (const c of req) chunks.push(c)
        try { params = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {} } catch { return problem(400, 'Malformed JSON') }
      } else params = Object.fromEntries(url.searchParams)

      for (const k of ['fiscalDayNo', 'fileUploadedFrom', 'fileUploadedTill']) void k
      const out = op === 'getServerCertificate'
        ? sim.getServerCertificate()
        : await sim[op](deviceID, params, req.headers, req.socket.remoteAddress)
      send(200, out)
    } catch (e) {
      if (e instanceof FdmsError) return send(e.status, e.toProblem())
      console.error('[sim] unexpected', e)
      problem(500, 'Infrastructure error')
    }
  })

  await new Promise((r) => server.listen(port, host, r))
  const addr = server.address()
  return {
    url: `https://${host}:${addr.port}`, caPem: pki.caPem, sim, pki,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r) }),
  }
}
