import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'

import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
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
import VendorsPage from './pages/vendors/VendorsPage'
import LeaseDocumentsPage from './pages/leases/LeaseDocumentsPage'
import ProspectsPage from './pages/prospects/ProspectsPage'
import InspectionsPage from './pages/inspections/InspectionsPage'
import InspectionDetailPage from './pages/inspections/InspectionDetailPage'
import BudgetsPage from './pages/budgets/BudgetsPage'
import BudgetDetailPage from './pages/budgets/BudgetDetailPage'
import ChartOfAccountsPage from './pages/accounting/ChartOfAccountsPage'
import GeneralLedgerPage from './pages/accounting/GeneralLedgerPage'
import TenantPortalPage from './pages/tenant/TenantPortalPage'
import OwnerPortalPage from './pages/owner/OwnerPortalPage'
import NotFoundPage from './pages/NotFoundPage'

function RootRedirect() {
  const { user } = useAuth()
  if (user?.role === 'TENANT') return <Navigate to="/portal" replace />
  if (user?.role === 'OWNER') return <Navigate to="/owner-portal" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RootRedirect />} />

          {/* Tenant-only portal */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute allowedRoles={['TENANT']}>
                <TenantPortalPage />
              </ProtectedRoute>
            }
          />

          {/* Owner-only portal */}
          <Route
            path="/owner-portal"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <OwnerPortalPage />
              </ProtectedRoute>
            }
          />

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
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/leases" element={<LeaseDocumentsPage />} />
          <Route path="/prospects" element={<ProspectsPage />} />
          <Route path="/inspections" element={<InspectionsPage />} />
          <Route path="/inspections/:id" element={<InspectionDetailPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/budgets/:id" element={<BudgetDetailPage />} />
          <Route path="/accounting/chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="/accounting/ledger" element={<GeneralLedgerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}
