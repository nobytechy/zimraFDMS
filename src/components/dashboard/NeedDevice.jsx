import { Link } from 'react-router-dom'
import { PlugZap } from 'lucide-react'
import { useDevice } from '@/context/DeviceContext'

/** Wrap dashboard pages: shows the "Connect device" card until a device is registered. */
export default function NeedDevice({ children }) {
  const { device, loading, error, reload } = useDevice()
  if (loading) return <div className="text-zim-ink-500">Loading…</div>
  if (error) return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <p className="text-sm font-semibold text-zim-ink-900">{error.message}</p>
      <button onClick={reload} className="btn-primary mt-5">Try again</button>
    </div>
  )
  if (!device) return (
    <div className="card mx-auto mt-10 max-w-md p-10 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-zim-red-600 to-zim-red-800 text-white shadow-lg"><PlugZap size={28}/></div>
      <h2 className="mt-5 text-2xl font-bold text-zim-ink-900">Connect your device</h2>
      <p className="mt-2 text-sm text-zim-ink-600">Link your ZIMRA fiscal device to start fiscalising sales.</p>
      <Link to="/dashboard/connect" className="btn-primary mt-6 px-8 py-3 text-base">Connect</Link>
    </div>
  )
  return children
}
