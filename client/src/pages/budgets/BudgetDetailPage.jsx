import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useBudgetVariance } from '../../hooks/useBudgets'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function BudgetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useBudgetVariance(id)

  if (isLoading) return <LoadingSpinner fullPage />
  if (!data) return null

  const currency = data.budget.currency
  const chartData = data.lines.map((l) => ({
    category: l.category.replace('_', ' '),
    Planned: l.plannedAmount,
    Actual: l.actual,
  }))
  // Extra grouped bar: straight sum of the category bars already shown
  // above, not a separate query. (Not data.totals — that deliberately
  // excludes the Rental Income line, which this chart still plots as one
  // of its bars, so it wouldn't match what's actually on screen.)
  if (chartData.length > 0) {
    chartData.push({
      category: 'Total',
      Planned: chartData.reduce((s, r) => s + (r.Planned || 0), 0),
      Actual: chartData.reduce((s, r) => s + (r.Actual || 0), 0),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/budgets')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{data.budget.name}</h1>
          <p className="text-sm text-gray-500">{formatDate(data.budget.periodStart)} – {formatDate(data.budget.periodEnd)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Planned Income</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(data.totals.plannedIncome, currency)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Actual Income</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(data.totals.actualIncome, currency)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Planned Expenses</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(data.totals.plannedAmount, currency)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Actual Expenses</p>
          <p className="text-xl font-bold text-red-500">{formatCurrency(data.totals.actual, currency)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <p className="text-sm text-gray-500 mb-1">Net Income</p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-400">Planned</p>
            <p className={`text-lg font-bold ${data.totals.plannedNet >= 0 ? 'text-brand' : 'text-red-600'}`}>
              {formatCurrency(data.totals.plannedNet, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Actual</p>
            <p className={`text-lg font-bold ${data.totals.actualNet >= 0 ? 'text-brand' : 'text-red-600'}`}>
              {formatCurrency(data.totals.actualNet, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Planned vs Actual by Category</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v) => formatCurrency(v, currency)} />
            <Legend />
            <Bar dataKey="Planned" fill="#9ca3af" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Actual" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Category', 'Planned', 'Actual', 'Variance'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.lines.map((l) => (
              <tr key={l.category}>
                <td className="px-4 py-3 text-sm text-gray-700">{l.category.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-sm">{formatCurrency(l.plannedAmount, currency)}</td>
                <td className="px-4 py-3 text-sm">{formatCurrency(l.actual, currency)}</td>
                <td className={`px-4 py-3 text-sm font-medium ${l.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(l.variance, currency)} ({l.variancePercent}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
