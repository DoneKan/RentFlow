import { useState } from 'react'
import { Landmark, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAccounts, useCreateAccount, useSeedDefaultAccounts } from '../../hooks/useAccounts'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
const TYPE_COLORS = {
  ASSET: 'bg-blue-50 text-blue-700',
  LIABILITY: 'bg-orange-50 text-orange-700',
  EQUITY: 'bg-purple-50 text-purple-700',
  INCOME: 'bg-green-50 text-green-700',
  EXPENSE: 'bg-red-50 text-red-700',
}

function AddAccountForm({ onClose }) {
  const create = useCreateAccount()
  const [form, setForm] = useState({ code: '', name: '', type: 'EXPENSE' })
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.code || !form.name) return toast.error('Code and name are required')
    try {
      await create.mutateAsync({ ...form, code: form.code.toUpperCase().replace(/\s+/g, '_') })
      toast.success('Account added')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add account')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Account code *</label>
        <input value={form.code} onChange={(e) => set('code', e.target.value)} className="input" placeholder="e.g. OWNER_DRAWS" required />
      </div>
      <div>
        <label className="label">Account name *</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="e.g. Owner Draws" required />
      </div>
      <div>
        <label className="label">Type</label>
        <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input">
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
          {create.isPending ? 'Adding…' : 'Add Account'}
        </button>
      </div>
    </form>
  )
}

export default function ChartOfAccountsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const { data: accounts, isLoading } = useAccounts()
  const seedDefaults = useSeedDefaultAccounts()

  const handleSeed = async () => {
    try {
      await seedDefaults.mutateAsync()
      toast.success('Default chart of accounts created')
    } catch {
      toast.error('Failed to seed default accounts')
    }
  }

  const columns = [
    { key: 'code', label: 'Code', render: (v) => <span className="text-sm font-mono">{v}</span> },
    { key: 'name', label: 'Name', render: (v) => <span className="text-sm font-medium text-gray-900">{v}</span> },
    { key: 'type', label: 'Type', render: (v) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[v]}`}>{v}</span> },
    {
      key: 'isActive',
      label: 'Status',
      render: (v) => <span className={`text-xs ${v ? 'text-green-600' : 'text-gray-400'}`}>{v ? 'Active' : 'Inactive'}</span>,
    },
  ]

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">The accounts your rent, mobile money, and expenses post against</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeed} disabled={seedDefaults.isPending} className="flex items-center gap-2 btn-secondary">
            <Sparkles className="h-4 w-4" /> Use Defaults
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 btn-primary">
            <Plus className="h-4 w-4" /> Add Account
          </button>
        </div>
      </div>

      {(!accounts || accounts.length === 0) ? (
        <EmptyState
          icon={Landmark}
          title="No chart of accounts yet"
          description="Set up a default chart of accounts (Cash, Mobile Money, Rental Income, and one account per expense category) to start tracking a general ledger."
          action={{ label: 'Create Default Accounts', onClick: handleSeed }}
        />
      ) : (
        <DataTable columns={columns} data={accounts} emptyMessage="No accounts yet" />
      )}

      {showAdd && (
        <Modal isOpen onClose={() => setShowAdd(false)} title="Add Account">
          <AddAccountForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}
    </div>
  )
}
