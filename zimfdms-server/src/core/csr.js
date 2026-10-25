/**
 * Device key + CSR generation (spec 4.2, section 12).
 * CN must be  ZIMRA-<serialNo>-<10-digit zero-padded deviceID>.
 * ECDSA P-256 (recommended) or RSA 2048. The private key is returned to the
 * CALLER (server) to be encrypted at rest — it must never be sent to a browser.
 */
import { webcrypto } from 'node:crypto'
import * as x509 from '@peculiar/x509'
import { pad } from './util.js'

x509.cryptoProvider.set(webcrypto)

const pem = (label, der) =>
  `-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`

export const deviceCommonName = (deviceSerialNo, deviceID) => `ZIMRA-${deviceSerialNo}-${pad(deviceID, 10)}`

export async function generateDeviceKeyAndCsr({ deviceSerialNo, deviceID, algorithm = 'ECDSA' }) {
  const alg = algorithm === 'RSA'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', publicExponent: new Uint8Array([1, 0, 1]), modulusLength: 2048 }
    : { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }
  const keys = await webcrypto.subtle.generateKey(alg, true, ['sign', 'verify'])
  const csr = await x509.Pkcs10CertificateRequestGenerator.create({
    name: `CN=${deviceCommonName(deviceSerialNo, deviceID)}`,
    keys,
    signingAlgorithm: alg,
  })
  const pkcs8 = await webcrypto.subtle.exportKey('pkcs8', keys.privateKey)
  return { privateKeyPem: pem('PRIVATE KEY', pkcs8), csrPem: csr.toString('pem'), algorithm }
}
