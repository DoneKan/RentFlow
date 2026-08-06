import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { useCreateExpense, useUpdateExpense } from '../../hooks/useExpenses'
import { usePropertyUnits } from '../../hooks/useProperties'
import { getProperties } from '../../services/property.service'
import { EXPENSE_CATEGORIES } from '../../utils/constants'

export default function LogExpenseForm({ onClose, defaultPropertyId, expense, onSuccess }) {
  const isEditing = !!expense
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const saving = isEditing ? update.isPending : create.isPending
  const [form, setForm] = useState({
    propertyId: expense?.propertyId || defaultPropertyId || '',
    unitId: expense?.unitId || '',
    category: expense?.category || 'UTILITIES',
    amount: expense?.amount != null ? String(expense.amount) : '',
    description: expense?.description || '',
    vendor: expense?.vendor || '',
    date: expense?.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
  })
  const [file, setFile] = useState(null)

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const { data: propertiesData } = useQuery({
    queryKey: ['properties', 'all'],
    queryFn: () => getProperties({ limit: 200 }),
    select: (r) => r.data || [],
    staleTime: 0,
  })

  const { data: unitsData } = usePropertyUnits(form.propertyId)
  const units = unitsData || []

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.propertyId) { toast.error('Please select a property'); return }
    if (!form.amount) { toast.error('Amount is required'); return }

    let payload
    if (file) {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      fd.append('receipt', file)
      payload = fd
    } else {
      payload = { ...form, amount: parseFloat(form.amount) }
    }

    try {
      if (isEditing) {
        await update.mutateAsync({ id: expense.id, data: payload })
        toast.success('Expense updated!')
      } else {
        await create.mutateAsync(payload)
        toast.success('Expense logged!')
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'log'} expense`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Property *</label>
        <select
          value={form.propertyId}
          onChange={(e) => setForm((p) => ({ ...p, propertyId: e.target.value, unitId: '' }))}
          className="input"
          required
        >
          <option value="">Select property…</option>
          {(propertiesData || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Unit <span className="text-gray-400 text-xs">(optional)</span></label>
        <select
          value={form.unitId}
          onChange={(e) => set('unitId', e.target.value)}
          className="input"
          disabled={!form.propertyId}
        >
          <option value="">Whole property</option>
          {units.map((u) => <option key={u.id} value={u.id}>Unit #{u.unitNumber}</option>)}
        </select>
        <p className="mt-1 text-xs text-gray-400">Leave as "Whole property" for costs like land, taxes, or building-wide repairs. Pick a unit for costs specific to it, like painting one unit.</p>
      </div>

      <div>
        <label className="label">Category *</label>
        <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
          {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount *</label>
          <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input" placeholder="0" required />
        </div>
        <div>
          <label className="label">Date *</label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input" required />
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <input value={form.description} onChange={(e) => set('description', e.target.value)} className="input" placeholder="Brief description of expense" />
      </div>

      <div>
        <label className="label">Vendor / Supplier</label>
        <input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} className="input" placeholder="UMEME, City Water, etc." />
      </div>

      <div>
        <label className="label">Receipt / Invoice <span className="text-gray-400 text-xs">(optional)</span></label>
        <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 cursor-pointer hover:border-brand transition-colors">
          <Paperclip className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">{file ? file.name : 'Click to upload image or PDF'}</span>
          <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files[0])} />
        </label>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? (isEditing ? 'Updating…' : 'Logging…') : (isEditing ? 'Update Expense' : 'Log Expense')}
        </button>
      </div>
    </form>
  )
}
