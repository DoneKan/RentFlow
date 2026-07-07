import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Building2, Users, TrendingUp, AlertCircle,
  Plus, UserPlus, CreditCard, Receipt, Send,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { getDashboard } from '../../services/report.service'
import { formatCurrency, formatDate, getPaymentMethodLabel } from '../../utils/formatters'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useSendReminder } from '../../hooks/useInvoices'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const CHART_COLORS = ['#1e3a5f', '#22c55e', '#f97316', '#ef4444', '#8b5cf6']

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const sendReminder = useSendReminder()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    select: (r) => r.data,
  })

  if (isLoading) return <LoadingSpinner fullPage />

  const stats = data?.stats || {}
  const recentPayments = data?.recentPayments || []
  const overdueInvoices = data?.overdueInvoices || []
  const revenueChart = data?.revenueChart || []
  const occupancyData = data?.occupancyData || []

  const quickActions = [
    { icon: Plus, label: 'Add Property', color: 'bg-brand', onClick: () => navigate('/properties') },
    { icon: UserPlus, label: 'Add Tenant', color: 'bg-green-500', onClick: () => navigate('/tenants') },
    { icon: CreditCard, label: 'Record Payment', color: 'bg-orange-500', onClick: () => navigate('/payments') },
    { icon: Receipt, label: 'Log Expense', color: 'bg-purple-500', onClick: () => navigate('/expenses') },
  ]

  const handleSendReminder = async (invoiceId) => {
    try {
      await sendReminder.mutateAsync(invoiceId)
      toast.success('Reminder sent!')
    } catch {
      toast.error('Failed to send reminder')
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        {user?.organization && (
          <div className="text-sm text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-1.5">
            {user.organization.name}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Properties"
          value={stats.totalProperties ?? 0}
          icon={Building2}
          colorClass="bg-brand"
          subtitle={`${stats.totalUnits ?? 0} total units`}
        />
        <StatCard
          title="Active Tenants"
          value={stats.activeTenants ?? 0}
          icon={Users}
          colorClass="bg-green-500"
          subtitle={`${stats.occupancyRate ?? 0}% occupancy`}
        />
        <StatCard
          title="Revenue This Month"
          value={formatCurrency(stats.monthlyRevenue ?? 0)}
          icon={TrendingUp}
          colorClass="bg-indigo-500"
          subtitle="Collected payments"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(stats.outstanding ?? 0)}
          icon={AlertCircle}
          colorClass="bg-orange-500"
          subtitle={`${stats.overdueCount ?? 0} overdue invoices`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Occupancy */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Occupancy Overview</h3>
          {occupancyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={occupancyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {occupancyData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              No occupancy data yet
            </div>
          )}
          <div className="mt-2 text-center">
            <span className="text-3xl font-bold text-brand">{stats.occupancyRate ?? 0}%</span>
            <p className="text-xs text-gray-500 mt-0.5">Overall occupancy rate</p>
          </div>
        </div>

        {/* Revenue vs Expenses */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue vs Expenses (6 months)</h3>
          {revenueChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              No revenue data yet
            </div>
          )}
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Payments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Payments</h3>
            <button onClick={() => navigate('/payments')} className="text-xs text-brand hover:underline">
              View all
            </button>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No payments recorded yet</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.tenant?.name}</p>
                    <p className="text-xs text-gray-500">{p.unit?.unitNumber} · {getPaymentMethodLabel(p.method)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-gray-400">{formatDate(p.paidAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Overdue Invoices</h3>
            <button onClick={() => navigate('/invoices?status=OVERDUE')} className="text-xs text-brand hover:underline">
              View all
            </button>
          </div>
          {overdueInvoices.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No overdue invoices 🎉</p>
          ) : (
            <div className="space-y-3">
              {overdueInvoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.tenant?.name}</p>
                    <p className="text-xs text-gray-500">
                      {inv.unit?.unitNumber} · <span className="text-red-500">{inv.daysOverdue}d overdue</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(inv.amount)}</p>
                    <button
                      onClick={() => handleSendReminder(inv.id)}
                      title="Send reminder"
                      className="rounded p-1 text-orange-500 hover:bg-orange-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(({ icon: Icon, label, color, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="card flex flex-col items-center gap-3 py-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
