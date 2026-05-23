import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function MerchantRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center text-zim-ink-500">Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: loc }} replace />
  return children
}

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center text-zim-ink-500">Loading…</div>
  if (!isAuthenticated || !isAdmin) return <Navigate to="/admin/login" state={{ from: loc }} replace />
  return children
}
