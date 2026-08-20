import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCreateBudget } from '../../hooks/useBudgets'
import { getProperties } from '../../services/property.service'
import { useAuth } from '../../context/AuthContext'
import NumberInput from '../ui/NumberInput'

const CATEGORIES = ['RENTAL_INCOME', 'UTILITIES', 'SECURITY', 'MAINTENANCE', 'KCCA_TAX', 'URA_TAX', 'REPAIRS', 'INSURANCE', 'LAND_ACQUISITION', 'CONSTRUCTION', 'OTHER']

export default function AddBudgetForm({ onClose }) {
  const { user } = useAuth()
  const create = useCreateBudget()
  const [form, setForm] = useState({ propertyId: '', name: '', periodStart: '', periodEnd: '', currency: user?.organization?.currency || 'UGX' })
  const [lines, setLines] = useState([{ category: 'RENTAL_INCOME', plannedAmount: '', notes: '' }])

  const { data: properties } = useQuery({
    queryKey: ['properties', 'all'],
    queryFn: () => getProperties({ limit: 200 }),
    select: (r) => r.data || [],
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)))
  const addLine = () => setLines((ls) => [...ls, { category: 'OTHER', plannedAmount: '', notes: '' }])
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.periodStart || !form.periodEnd) return toast.error('Please fill in name and period')
    const validLines = lines.filter((l) => l.plannedAmount)
    if (validLines.length === 0) return toast.error('Add at least one budget line')
    try {
      await create.mutateAsync({
        ...form,
        propertyId: form.propertyId || undefined,
        lines: validLines.map((l) => ({ ...l, plannedAmount: parseFloat(l.plannedAmount) })),
      })
      toast.success('Budget created')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create budget')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Budget name *</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="e.g. Q1 2027 Operating Budget" required />
      </div>
      <div>
        <label className="label">Property</label>
        <select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} className="input">
          <option value="">All properties (org-wide)</option>
          {(properties || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Period start *</label>
          <input type="date" value={form.periodStart} onChange={(e) => set('periodStart', e.target.value)} className="input" required />
        </div>
        <div>
          <label className="label">Period end *</label>
          <input type="date" value={form.periodEnd} onChange={(e) => set('periodEnd', e.target.value)} className="input" required />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Budget lines</label>
          <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs text-brand hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add line
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-start">
              <select value={line.category} onChange={(e) => setLine(i, 'category', e.target.value)} className="input flex-1">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
              <NumberInput
                value={line.plannedAmount}
                onChange={(v) => setLine(i, 'plannedAmount', v)}
                className="input w-32"
                placeholder="Amount"
              />
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(i)} className="p-2 text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
          {create.isPending ? 'Creating…' : 'Create Budget'}
        </button>
      </div>
    </form>
  )
}
