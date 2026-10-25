/**
 * Netlify Function v2 — the FDMS bridge API. Served at /api/fdms/* (see netlify.toml).
 *
 * Required env (Netlify → Site settings → Environment variables):
 *   DATABASE_URL        Postgres connection string — DIRECT or SESSION-mode (port 5432), not the transaction pooler
 *   FDMS_MASTER_KEY     32 bytes base64 (node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
 *   SUPABASE_URL, SUPABASE_ANON_KEY   (same values as the VITE_ ones)
 * Optional:
 *   FDMS_MODEL_NAME / FDMS_MODEL_VERSION   device model registered with ZIMRA (default ZimFDMS / 1.0)
 *   FDMS_TEST_URL (default https://fdmsapitest.zimra.co.zw)   FDMS_LIVE_URL (live is DISABLED until set)
 */
import pg from 'pg'
import { createApi, supabaseAuthenticator, ApiError } from '../../zimfdms-server/src/api/handler.js'
import { DeviceService } from '../../zimfdms-server/src/core/device.js'
import { PgStore } from '../../zimfdms-server/src/core/pgstore.js'

let api
function boot() {
  if (api) return api
  const need = ['DATABASE_URL', 'FDMS_MASTER_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']
  const missing = need.filter((k) => !process.env[k])
  if (missing.length) throw new ApiError(503, 'NOT_CONFIGURED', `Server is missing settings: ${missing.join(', ')}`)
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } })
  const store = new PgStore(pool)
  const service = new DeviceService({
    store, masterKey: process.env.FDMS_MASTER_KEY,
    modelName: process.env.FDMS_MODEL_NAME || 'ZimFDMS', modelVersion: process.env.FDMS_MODEL_VERSION || '1.0',
  })
  api = createApi({
    service, store,
    authenticate: supabaseAuthenticator({ supabaseUrl: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, db: pool }),
    baseUrlFor: (env) => (env === 'live' ? process.env.FDMS_LIVE_URL || null : process.env.FDMS_TEST_URL || 'https://fdmsapitest.zimra.co.zw'),
  })
  return api
}

export default async (request) => {
  try { return await boot()(request) } catch (e) {
    const status = e.status || 500
    return new Response(JSON.stringify({ ok: false, error: { code: e.code || 'INTERNAL', message: status === 503 ? e.message : 'Something went wrong' } }), { status, headers: { 'content-type': 'application/json' } })
  }
}

export const config = { path: '/api/fdms/*' }
