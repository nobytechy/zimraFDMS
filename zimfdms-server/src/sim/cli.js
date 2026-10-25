#!/usr/bin/env node
/** `npm run sim` — start a local FDMS simulator with one demo device and print connection details. */
import fs from 'node:fs'
import { startSimulator } from './server.js'

const port = Number(process.env.PORT || 8443)
const s = await startSimulator({ port })
s.sim.addDevice({ deviceID: 1042, activationKey: 'ABCD1234', serialNo: 'SN0001' })
fs.writeFileSync('sim-ca.pem', s.caPem)
console.log(`ZIMRA FDMS simulator  ${s.url}
  demo device : deviceID 1042 · serial SN0001 · activation key ABCD1234 (VAT payer)
  model       : ZimFDMS / 1.0
  CA written  : ./sim-ca.pem   (pass as FDMS_CA to trust the simulator)
Ctrl-C to stop.`)
