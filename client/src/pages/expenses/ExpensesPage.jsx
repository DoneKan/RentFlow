import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Receipt, Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LogExpenseForm from '../../components/forms/LogExpenseForm'
import StatusBadge from '../../components/ui/StatusBadge'
import { getExpenses, getExpenseSummary, deleteExpense } from '../../services/expense.service'
import { formatCurrency, formatDate } from '../../utils/formatters'

const CATEGORY_COLORS = {
  UTILITIES: 'bg-blue-100 text-blue-800',
  SECURITY: 'bg-orange-100 text-orange-800',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
  KCCA_TAX: 'bg-red-100 text-red-800',
  URA_TAX: 'bg-rose-100 text-rose-800',
  REPAIRS: 'bg-amber-100 text-amber-800',
  INSURANCE: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-gray-100 text-gray-800',
}

const CATEGORY_LABELS = {
  UTILITIES: '💡 Utilities',
  SECURITY: '🔒 Security',
  MAINTENANCE: '🔧 Maintenance',
  KCCA_TAX: '🏛 KCCA Tax',
  URA_TAX: '📋 URA Tax',
  REPAIRS: '🪛 Repairs',
  INSURANCE: '🛡 Insurance',
  OTHER: '📦 Other',
}

export default function ExpensesPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  const { data: expensesRes, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => getExpenses(),
    select: (r) => r.data || [],
  })

  const { data: summaryRes } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: () => getExpenseSummary(),
    select: (r) => r.data || {},
  })

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] })
      toast.success('Expense deleted')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete expense'),
  })

  const expenses = expensesRes || []
  const filtered = categoryFilter === 'ALL' ? expenses : expenses.filter(e => e.category === categoryFilter)
  const summary = summaryRes || {}
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const columns = [
    { key: 'date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'property', label: 'Property', render: (_, row) => row.property?.name || '—' },
    {
      key: 'category', label: 'Category',
      render: (v) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[v] || 'bg-gray-100 text-gray-800'}`}>
          {CATEGORY_LABELS[v] || v}
        </span>
      ),
    },
    { key: 'description', label: 'Description', render: (v) => <span className="text-sm text-gray-600 truncate max-w-xs block">{v || '—'}</span> },
    { key: 'vendor', label: 'Vendor', render: (v) => v || '—' },
    {
      key: 'amount', label: 'Amount',
      render: (v) => <span className="font-semibold text-red-600">{formatCurrency(v)}</span>,
    },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex gap-2">
          <button onClick={() => { setEditExpense(row); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-brand rounded">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteId(row.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const summaryCards = [
    { title: 'Total Expenses', value: formatCurrency(totalExpenses), color: 'bg-red-50 text-red-700' },
    { title: '💡 Utilities', value: formatCurrency(summary.UTILITIES || 0), color: 'bg-blue-50 text-blue-700' },
    { title: '🔒 Security', value: formatCurrency(summary.SECURITY || 0), color: 'bg-orange-50 text-orange-700' },
    { title: '🔧 Maintenance', value: formatCurrency(summary.MAINTENANCE || 0), color: 'bg-yellow-50 text-yellow-700' },
    { title: '🏛 KCCA Tax', value: formatCurrency(summary.KCCA_TAX || 0), color: 'bg-red-50 text-red-700' },
    { title: '📋 URA Tax', value: formatCurrency(summary.URA_TAX || 0), color: 'bg-rose-50 text-rose-700' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track property costs and tax obligations"
        actions={[
          <button key="add" onClick={() => { setEditExpense(null); setShowForm(true) }} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Log Expense
          </button>,
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((c) => (
          <div key={c.title} className={`rounded-xl p-4 ${c.color} bg-opacity-20 border border-current border-opacity-20`}>
            <p className="text-xs font-medium opacity-80">{c.title}</p>
            <p className="text-lg font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-2 mb-4">
          {['ALL', ...Object.keys(CATEGORY_LABELS)].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === cat ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          emptyMessage="No expenses logged yet"
          emptyIcon={Receipt}
        />
      </div>

      <LogExpenseForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditExpense(null) }}
        expense={editExpense}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['expenses'] })
          queryClient.invalidateQueries({ queryKey: ['expenses-summary'] })
          setShowForm(false)
          setEditExpense(null)
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record? This cannot be undone."
        confirmLabel="Delete"
        isDangerous
      />
    </div>
  )
}
