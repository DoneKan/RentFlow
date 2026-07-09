import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'

import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import PropertiesPage from './pages/properties/PropertiesPage'
import PropertyDetailPage from './pages/properties/PropertyDetailPage'
import TenantsPage from './pages/tenants/TenantsPage'
import TenantDetailPage from './pages/tenants/TenantDetailPage'
import InvoicesPage from './pages/invoices/InvoicesPage'
import InvoiceDetailPage from './pages/invoices/InvoiceDetailPage'
import PaymentsPage from './pages/payments/PaymentsPage'
import ExpensesPage from './pages/expenses/ExpensesPage'
import ReportsPage from './pages/reports/ReportsPage'
import SettingsPage from './pages/settings/SettingsPage'
import ProfilePage from './pages/settings/ProfilePage'
import MaintenancePage from './pages/maintenance/MaintenancePage'
import TenantPortalPage from './pages/tenant/TenantPortalPage'
import NotFoundPage from './pages/NotFoundPage'

function RootRedirect() {
  const { user } = useAuth()
  if (user?.role === 'TENANT') return <Navigate to="/portal" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RootRedirect />} />

          {/* Tenant-only portal */}
          <Route path="/portal" element={<TenantPortalPage />} />

          {/* Manager / Admin routes */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
          <Route path="/tenants" element={<TenantsPage />} />
          <Route path="/tenants/:id" element={<TenantDetailPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}
