/**
 * The signed-in merchant's fiscal device (one device per merchant).
 * `device` is the lean server view: state, mode, taxpayer, config, current fiscal day summary.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { bridge } from '@/lib/fdms/bridge'

const Ctx = createContext(null)

export function DeviceProvider({ children }) {
  const { merchant } = useAuth()
  const [device, setDevice] = useState(null)       // full view of the active device
  const [listed, setListed] = useState(null)       // { deviceID, state } when connected but maybe not yet registered
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!merchant) { setDevice(null); setListed(null); setLoading(false); return null }
    try {
      setError(null)
      const list = await bridge.devices()
      const d = list.find((x) => x.state === 'registered') || list[0] || null
      setListed(d)
      if (d?.state === 'registered') {
        const v = await bridge.device(d.deviceID)
        setDevice(v)
        return v
      }
      setDevice(null)
      return null
    } catch (e) {
      setError(e)
      return null
    } finally { setLoading(false) }
  }, [merchant?.id])

  useEffect(() => { setLoading(true); reload() }, [reload])

  return <Ctx.Provider value={{ device, listed, loading, error, reload, setDevice }}>{children}</Ctx.Provider>
}

export function useDevice() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDevice must be inside <DeviceProvider>')
  return c
}
