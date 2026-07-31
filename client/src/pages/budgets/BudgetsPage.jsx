import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBudgets, useDeleteBudget } from '../../hooks/useBudgets'
import { formatDate, formatCurrency } from '../../utils/formatters'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import AddBudgetForm from '../../components/forms/AddBudgetForm'

export default function BudgetsPage() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const { data: budgets, isLoading } = useBudgets()
  const deleteMutation = useDeleteBudget()

  const columns = [
    {
      key: 'name',
      label: 'Budget',
      render: (v, row) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{v}</p>
          <p className="text-xs text-gray-500">{row.property?.name || 'All properties'}</p>
        </div>
      ),
    },
    {
      key: 'periodStart',
      label: 'Period',
      render: (v, row) => <span className="text-sm text-gray-500">{formatDate(v)} – {formatDate(row.periodEnd)}</span>,
    },
    {
      key: 'lines',
      label: 'Planned Total',
      render: (lines, row) => (
        <span className="text-sm font-medium">
          {formatCurrency(lines.reduce((s, l) => s + (l.category === 'RENTAL_INCOME' ? 0 : Number(l.plannedAmount)), 0), row.currency)}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (id) => (
        <div className="flex gap-2 justify-end">
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(id) }} className="text-xs text-red-500 hover:underline">Delete</button>
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Budgets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan spending and revenue, then track actuals against it</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 btn-primary">
          <Plus className="h-4 w-4" /> New Budget
        </button>
      </div>

      <DataTable
        columns={columns}
        data={budgets || []}
        onRowClick={(row) => navigate(`/budgets/${row.id}`)}
        emptyMessage="No budgets yet"
      />

      {showAdd && (
        <Modal isOpen onClose={() => setShowAdd(false)} title="New Budget" size="lg">
          <AddBudgetForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync(deleteId)
            toast.success('Budget deleted')
          } catch {
            toast.error('Failed to delete budget')
          }
          setDeleteId(null)
        }}
        title="Delete Budget"
        message="Are you sure you want to delete this budget? This cannot be undone."
        confirmLabel="Delete"
        isDangerous
      />
    </div>
  )
}
