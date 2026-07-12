import { Routes, Route, Navigate } from 'react-router-dom'

// Accounts (merchant signup/login/dashboard + super-admin) are gated OFF for
// the education-only launch: zimFDMS is a learn-FDMS + interactive sandbox +
// lead-gen site, so no real user data or admin surface is exposed publicly.
// Defaults to off (env var absent) — flip VITE_ACCOUNTS_ENABLED=true once the
// real ZIMRA engine + a hardened admin login are in place.
const ACCOUNTS_ENABLED = import.meta.env.VITE_ACCOUNTS_ENABLED === 'true'

import PublicLayout from '@/components/layout/PublicLayout'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AdminLayout from '@/components/layout/AdminLayout'
import { MerchantRoute, AdminRoute } from '@/components/ProtectedRoute'

import Home         from '@/pages/Home'
import HowItWorks   from '@/pages/HowItWorks'
import Sandbox      from '@/pages/Sandbox'
import Docs         from '@/pages/Docs'
import Pricing      from '@/pages/Pricing'
import Verify       from '@/pages/Verify'
import DemoDashboard from '@/pages/DemoDashboard'
import NotFound     from '@/pages/NotFound'

import Signup       from '@/pages/auth/Signup'
import Login        from '@/pages/auth/Login'

import Overview     from '@/pages/dashboard/Overview'
import Receipts     from '@/pages/dashboard/Receipts'
import FiscalDay    from '@/pages/dashboard/FiscalDay'
import ApiKeys      from '@/pages/dashboard/ApiKeys'
import Webhooks     from '@/pages/dashboard/Webhooks'
import Settings     from '@/pages/dashboard/Settings'

import AdminLogin    from '@/pages/admin/Login'
import AdminOverview from '@/pages/admin/Overview'
import AdminSettings from '@/pages/admin/Settings'
import AdminMerchants from '@/pages/admin/Merchants'

export default function App() {
  return (
    <Routes>
      {/* Public marketing + sandbox + verify */}
      <Route element={<PublicLayout />}>
        <Route index               element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/sandbox"     element={<Sandbox />} />
        <Route path="/docs"        element={<Docs />} />
        <Route path="/pricing"     element={<Pricing />} />
        <Route path="/verify"      element={<Verify />} />
        <Route path="/verify/:ref" element={<Verify />} />
      </Route>

      {/* Public demo dashboard — no auth, seeded data */}
      <Route path="/demo-dashboard" element={<DemoDashboard />} />

      {ACCOUNTS_ENABLED ? (
        <>
          {/* Auth */}
          <Route path="/signup" element={<Signup />} />
          <Route path="/login"  element={<Login />} />

          {/* Merchant dashboard */}
          <Route path="/dashboard" element={<MerchantRoute><DashboardLayout /></MerchantRoute>}>
            <Route index            element={<Overview />} />
            <Route path="receipts"  element={<Receipts />} />
            <Route path="fiscal-day" element={<FiscalDay />} />
            <Route path="api-keys"  element={<ApiKeys />} />
            <Route path="webhooks"  element={<Webhooks />} />
            <Route path="settings"  element={<Settings />} />
          </Route>

          {/* Super-admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index             element={<AdminOverview />} />
            <Route path="merchants"  element={<AdminMerchants />} />
            <Route path="settings"   element={<AdminSettings />} />
          </Route>
        </>
      ) : (
        <>
          {/* Accounts gated off for the education-only launch → send to home */}
          <Route path="/signup"    element={<Navigate to="/" replace />} />
          <Route path="/login"     element={<Navigate to="/" replace />} />
          <Route path="/dashboard/*" element={<Navigate to="/" replace />} />
          <Route path="/admin/*"   element={<Navigate to="/" replace />} />
        </>
      )}

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
