import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, TrendingUp, AlertCircle, Receipt, DollarSign } from 'lucide-react'
import { format, subMonths, addMonths } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { getMonthlyReport, exportReport } from '../../services/report.service'
import { formatCurrency } from '../../utils/formatters'

const PIE_COLORS = {
  UTILITIES: '#3b82f6',
  SECURITY: '#f97316',
  MAINTENANCE: '#eab308',
  KCCA_TAX: '#ef4444',
  URA_TAX: '#dc2626',
  REPAIRS: '#f59e0b',
  INSURANCE: '#8b5cf6',
  OTHER: '#6b7280',
}

const CATEGORY_LABELS = {
  UTILITIES: 'Utilities', SECURITY: 'Security', MAINTENANCE: 'Maintenance',
  KCCA_TAX: 'KCCA Tax', URA_TAX: 'URA Tax', REPAIRS: 'Repairs',
  INSURANCE: 'Insurance', OTHER: 'Other',
}

export default function ReportsPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [exporting, setExporting] = useState(false)

  const month = currentDate.getMonth() + 1
  const year = currentDate.getFullYear()

  const { data: reportRes, isLoading } = useQuery({
    queryKey: ['monthly-report', month, year],
    queryFn: () => getMonthlyReport(month, year),
    select: (r) => r.data,
  })

  const report = reportRes || {}
  const summary = report.summary || {}
  const propertyBreakdown = report.propertyBreakdown || []
  const expenseByCategory = report.expenseByCategory || {}

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(currentDate, 5 - i)
    return { month: format(d, 'MMM'), revenue: 0, expenses: 0 }
  })

  const pieData = Object.entries(expenseByCategory)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: CATEGORY_LABELS[k] || k, value: Number(v), color: PIE_COLORS[k] || '#6b7280' }))

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await exportReport({ month, year })
      const blob = new Blob([data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rentflow-report-${year}-${String(month).padStart(2, '0')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Monthly financial overview"
        actions={[
          <button key="export" onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-2">
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>,
        ]}
      />

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <button onClick={() => setCurrentDate(d => subMonths(d, 1))} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-lg font-semibold w-40 text-center">{format(currentDate, 'MMMM yyyy')}</span>
        <button
          onClick={() => setCurrentDate(d => addMonths(d, 1))}
          disabled={currentDate >= new Date()}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Collected" value={formatCurrency(summary.totalCollected || 0)} icon={TrendingUp} color="green" />
            <StatCard title="Outstanding" value={formatCurrency(summary.totalOutstanding || 0)} icon={AlertCircle} color="orange" />
            <StatCard title="Total Expenses" value={formatCurrency(summary.totalExpenses || 0)} icon={Receipt} color="red" />
            <StatCard title="Net Income" value={formatCurrency(summary.netIncome || 0)} icon={DollarSign} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses chart */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue vs Expenses (6 months)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={last6Months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#1e3a5f" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Expense category pie */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Expenses by Category</h3>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">No expenses this month</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Per-property breakdown */}
          {propertyBreakdown.length > 0 && (
            <div className="card overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Per-Property Breakdown</h3>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Property', 'Units', 'Occupancy', 'Revenue', 'Invoices'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {propertyBreakdown.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium">{p.name}</td>
                      <td className="py-3 px-3 text-gray-600">{p.totalUnits}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                            <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${p.occupancyRate}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{p.occupancyRate}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-green-700">{formatCurrency(p.collected || 0)}</td>
                      <td className="py-3 px-3 text-gray-600">{p.invoicesRaised}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
