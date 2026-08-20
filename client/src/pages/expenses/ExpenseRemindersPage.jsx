import { useState } from 'react'
import { Plus, Trash2, Pencil, BellRing } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import LandlordExpenseReminderForm from '../../components/forms/LandlordExpenseReminderForm'
import { useLandlordExpenseReminders, useDeleteLandlordExpenseReminder } from '../../hooks/useLandlordExpenseReminders'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { RECURRENCE_TYPES } from '../../utils/constants'

const RECURRENCE_LABELS = Object.fromEntries(RECURRENCE_TYPES.map((t) => [t.value, t.label]))

export default function ExpenseRemindersPage() {
  const { user } = useAuth()
  const currency = user?.organization?.currency || 'UGX'
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const { data, isLoading } = useLandlordExpenseReminders()
  const deleteReminder = useDeleteLandlordExpenseReminder()

  const reminders = data || []

  const handleDelete = async () => {
    try {
      await deleteReminder.mutateAsync(toDelete.id)
      toast.success('Reminder deleted')
    } catch {
      toast.error('Failed to delete reminder')
    }
    setToDelete(null)
  }

  const columns = [
    { key: 'name', label: 'Name', render: (v, row) => (
      <div>
        <p className="font-medium text-gray-900">{v}</p>
        {row.description && <p className="text-xs text-gray-400 line-clamp-1">{row.description}</p>}
      </div>
    ) },
    { key: 'property', label: 'Property', render: (p) => p?.name || <span className="text-gray-400">Whole business</span> },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(v, currency) },
    { key: 'recurrenceType', label: 'Recurrence', render: (v, row) => v === 'CUSTOM' ? `Every ${row.customIntervalDays} days` : RECURRENCE_LABELS[v] || v },
    { key: 'nextDueDate', label: 'Next Due', render: (v) => formatDate(v) },
    { key: 'remindDaysBefore', label: 'Reminds', render: (v) => `${v} day${v === 1 ? '' : 's'} before` },
    { key: 'isActive', label: 'Status', render: (v) => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {v ? 'Active' : 'Paused'}
      </span>
    ) },
    {
      key: 'id',
      label: 'Actions',
      render: (id, row) => (
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); setEditing(row); setShowForm(true) }} className="text-xs text-brand hover:underline flex items-center gap-1">
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); setToDelete(row) }} className="text-xs text-red-500 hover:underline flex items-center gap-1">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Expense Reminders"
        subtitle="Your own recurring costs — taxes, fees, wages — separate from tenant invoicing"
        actions={[
          <button key="add" onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Reminder
          </button>,
        ]}
      />

      {!isLoading && reminders.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No expense reminders yet"
          description="Set up known recurring costs you're personally responsible for — annual URA rental tax, local council fees, monthly security wages — and get reminded here before each one is due."
          action={{ label: 'Add Reminder', onClick: () => { setEditing(null); setShowForm(true) } }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={reminders}
          loading={isLoading}
          emptyMessage="No reminders match"
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? 'Edit Reminder' : 'Add Expense Reminder'}
        size="md"
      >
        <LandlordExpenseReminderForm reminder={editing} onClose={() => { setShowForm(false); setEditing(null) }} />
      </Modal>

      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Reminder"
        message={`Are you sure you want to delete "${toDelete?.name}"? This only removes the reminder schedule — it has no effect on any expense record already logged.`}
        confirmLabel="Delete"
        isDangerous
        isLoading={deleteReminder.isPending}
      />
    </div>
  )
}
