/**
 * Throw-away PKI for the simulator: root CA, FDMS signing cert, TLS server cert,
 * and issuing device certificates from CSRs (spec 4.2 / 4.3, section 12).
 */
import { webcrypto, X509Certificate, randomBytes } from 'node:crypto'
import * as x509 from '@peculiar/x509'

x509.cryptoProvider.set(webcrypto)
const ALG = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }
const day = 86400e3

const pem = (label, der) =>
  `-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`
const serial = () => randomBytes(8).toString('hex').replace(/^([89a-f])/, '0$1')

async function exportKeyPem(key) { return pem('PRIVATE KEY', await webcrypto.subtle.exportKey('pkcs8', key)) }

export async function createPki() {
  const caKeys = await webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify'])
  const caCert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: serial(), name: 'C=ZW, O=Zimbabwe Revenue Authority, CN=ZIMRA Simulator Root CA',
    notBefore: new Date(Date.now() - day), notAfter: new Date(Date.now() + 3650 * day),
    signingAlgorithm: ALG, keys: caKeys,
    extensions: [
      new x509.BasicConstraintsExtension(true, undefined, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true),
      await x509.SubjectKeyIdentifierExtension.create(caKeys.publicKey),
    ],
  })

  async function issue({ subject, publicKey, usages, eku, days = 365, san }) {
    const exts = [
      new x509.BasicConstraintsExtension(false, undefined, true),
      new x509.KeyUsagesExtension(usages, true),
      new x509.ExtendedKeyUsageExtension(eku),
      await x509.AuthorityKeyIdentifierExtension.create(caCert, false),
      await x509.SubjectKeyIdentifierExtension.create(publicKey),
    ]
    if (san) exts.push(new x509.SubjectAlternativeNameExtension(san))
    return x509.X509CertificateGenerator.create({
      serialNumber: serial(), subject, issuer: caCert.subject,
      notBefore: new Date(Date.now() - 60e3), notAfter: new Date(Date.now() + days * day),
      signingKey: caKeys.privateKey, publicKey, signingAlgorithm: ALG, extensions: exts,
    })
  }

  // FDMS signing identity (counter-signs receipts and fiscal days)
  const fdmsKeys = await webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify'])
  const fdmsCert = await issue({
    subject: 'C=ZW, O=Zimbabwe Revenue Authority, CN=ZIMRA FDMS Signing',
    publicKey: fdmsKeys.publicKey, usages: x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.nonRepudiation, eku: [x509.ExtendedKeyUsage.emailProtection], days: 730,
  })

  // TLS server identity
  const tlsKeys = await webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify'])
  const tlsCert = await issue({
    subject: 'CN=localhost', publicKey: tlsKeys.publicKey,
    usages: x509.KeyUsageFlags.digitalSignature, eku: [x509.ExtendedKeyUsage.serverAuth], days: 365,
    san: [{ type: 'dns', value: 'localhost' }, { type: 'ip', value: '127.0.0.1' }],
  })

  return {
    caPem: caCert.toString('pem'),
    fdms: { certPem: fdmsCert.toString('pem'), keyPem: await exportKeyPem(fdmsKeys.privateKey) },
    tls: { certPem: tlsCert.toString('pem'), keyPem: await exportKeyPem(tlsKeys.privateKey) },

    /** Validate a CSR and issue a client-auth device certificate. Throws Error with .code on rejection. */
    async issueDeviceCert(csrPem, expectedCn, { days = 365 } = {}) {
      let csr
      try { csr = new x509.Pkcs10CertificateRequest(csrPem) } catch { throw Object.assign(new Error('unparseable CSR'), { code: 'DEV03' }) }
      if (!(await csr.verify())) throw Object.assign(new Error('CSR signature invalid'), { code: 'DEV03' })
      const cn = /CN=([^,]+)/.exec(csr.subject)?.[1]
      if (cn !== expectedCn) throw Object.assign(new Error(`CSR CN must be ${expectedCn}`), { code: 'DEV03' })
      // optional subject fields must match if present
      for (const [k, v] of [['C', 'ZW'], ['O', 'Zimbabwe Revenue Authority'], ['S', 'Zimbabwe'], ['ST', 'Zimbabwe']]) {
        const m = new RegExp(`(?:^|, ?)${k}=([^,]+)`).exec(csr.subject)
        if (m && m[1] !== v) throw Object.assign(new Error(`CSR ${k} must be ${v}`), { code: 'DEV03' })
      }
      const pk = await csr.publicKey.export()
      const alg = pk.algorithm
      const okAlg = (alg.name === 'ECDSA' && alg.namedCurve === 'P-256') || (alg.name === 'RSASSA-PKCS1-v1_5' && alg.modulusLength === 2048)
      if (!okAlg) throw Object.assign(new Error('Unsupported key type (need ECDSA P-256 or RSA 2048)'), { code: 'DEV03' })
      const cert = await issue({
        subject: `C=ZW, O=Zimbabwe Revenue Authority, CN=${cn}`, publicKey: csr.publicKey,
        usages: x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.nonRepudiation | x509.KeyUsageFlags.keyEncipherment,
        eku: [x509.ExtendedKeyUsage.clientAuth], days,
      })
      const certPem = cert.toString('pem')
      return { certPem, serial: new X509Certificate(certPem).serialNumber, validTill: cert.notAfter }
    },
  }
}
