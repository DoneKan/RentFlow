import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Receipt, Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import LogExpenseForm from '../../components/forms/LogExpenseForm'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuth } from '../../context/AuthContext'
import { getExpenses, deleteExpense } from '../../services/expense.service'
import { formatCurrency, formatDate } from '../../utils/formatters'

const CATEGORY_COLORS = {
  UTILITIES: 'bg-blue-100 text-blue-800',
  SECURITY: 'bg-orange-100 text-orange-800',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
  KCCA_TAX: 'bg-red-100 text-red-800',
  URA_TAX: 'bg-rose-100 text-rose-800',
  REPAIRS: 'bg-amber-100 text-amber-800',
  INSURANCE: 'bg-purple-100 text-purple-800',
  LAND_ACQUISITION: 'bg-emerald-100 text-emerald-800',
  CONSTRUCTION: 'bg-teal-100 text-teal-800',
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
  LAND_ACQUISITION: '🏗 Land / Acquisition',
  CONSTRUCTION: '🧱 Construction',
  OTHER: '📦 Other',
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const currency = user?.organization?.currency || 'UGX'
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  // limit is generous rather than paginated — every card and total on this
  // page (Total Expenses, per-category cards, the table) derives from this
  // one fetched array, so it has to actually hold every expense or all of
  // them silently under-count together, not just the visible list.
  const { data: expensesRes, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => getExpenses({ limit: 1000 }),
    select: (r) => r.data || [],
  })

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete expense'),
  })

  const expenses = expensesRes || []
  const filtered = categoryFilter === 'ALL' ? expenses : expenses.filter(e => e.category === categoryFilter)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  // Per-category totals computed from this same array — not a separate
  // /expenses/summary request — so they can never drift from Total
  // Expenses or from what's actually in the table below.
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {})

  const columns = [
    { key: 'date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'property', label: 'Property', render: (_, row) => row.property?.name || '—' },
    { key: 'unit', label: 'Unit', render: (_, row) => row.unit ? `Unit #${row.unit.unitNumber}` : <span className="text-gray-400">Whole property</span> },
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
      render: (v, row) => <span className="font-semibold text-red-600">{formatCurrency(v, row.currency || currency)}</span>,
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

  // One card per category in CATEGORY_LABELS — the same source the filter
  // tabs below are built from — so a new category never needs this list
  // updated separately (that drift is exactly how the old hardcoded
  // 5-category card list went stale).
  const summaryCards = [
    { title: 'Total Expenses', value: formatCurrency(totalExpenses, currency), color: 'bg-red-50 text-red-700' },
    ...Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
      title: label,
      value: formatCurrency(categoryTotals[key] || 0, currency),
      color: 'bg-gray-50 text-gray-700',
    })),
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

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditExpense(null) }}
        title={editExpense ? 'Edit Expense' : 'Log Expense'}
      >
        <LogExpenseForm
          onClose={() => { setShowForm(false); setEditExpense(null) }}
          expense={editExpense}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }}
        />
      </Modal>

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
