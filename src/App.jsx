import { Routes, Route } from 'react-router-dom'

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

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
