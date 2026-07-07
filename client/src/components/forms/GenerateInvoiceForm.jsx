import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { useCreateInvoice } from '../../hooks/useInvoices'
import { getTenants } from '../../services/tenant.service'
import { getTenant } from '../../services/tenant.service'
import { formatCurrency } from '../../utils/formatters'
import { addMonths, addDays, format } from 'date-fns'

export default function GenerateInvoiceForm({ onClose, defaultTenantId }) {
  const create = useCreateInvoice()
  const [tenantId, setTenantId] = useState(defaultTenantId || '')
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'))
  const [latePenalty, setLatePenalty] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants'],
    queryFn: getTenants,
    select: (r) => r.data?.tenants || [],
  })

  const { data: tenantData } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => getTenant(tenantId),
    select: (r) => r.data,
    enabled: !!tenantId,
  })

  useEffect(() => {
    if (tenantData?.tenancy?.unit) {
      const unit = tenantData.tenancy.unit
      const baseItems = [{ description: `Rent — ${unit.unitNumber} (${unit.type})`, amount: parseFloat(unit.rentAmount) }]
      if (unit.additionalCharges) {
        Object.entries(unit.additionalCharges).forEach(([k, v]) => {
          baseItems.push({ description: k, amount: parseFloat(v) })
        })
      }
      setItems(baseItems)
    }
  }, [tenantData])

  const updateItem = (i, field, value) => {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  const addItem = () => setItems((p) => [...p, { description: '', amount: 0 }])
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i))

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!tenantId) { toast.error('Please select a tenant'); return }
    if (items.length === 0) { toast.error('Add at least one invoice item'); return }
    try {
      await create.mutateAsync({
        tenantId,
        dueDate,
        latePenalty: latePenalty ? parseFloat(latePenalty) : 0,
        notes,
        items: items.map((i) => ({ ...i, amount: parseFloat(i.amount) || 0 })),
      })
      toast.success('Invoice generated!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invoice')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Tenant *</label>
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="input" required>
          <option value="">Select tenant…</option>
          {(tenantsData || []).map((t) => (
            <option key={t.id} value={t.userId || t.id}>{t.name || t.user?.name}</option>
          ))}
        </select>
      </div>

      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Invoice items</label>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-brand hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={item.description}
                  onChange={(e) => updateItem(i, 'description', e.target.value)}
                  className="input flex-1"
                  placeholder="Description"
                />
                <input
                  type="number"
                  value={item.amount}
                  onChange={(e) => updateItem(i, 'amount', e.target.value)}
                  className="input w-32"
                  placeholder="Amount"
                />
                <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-end">
            <span className="text-sm font-semibold text-gray-900">Total: {formatCurrency(total)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Due date *</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="label">Late penalty (UGX)</label>
          <input type="number" value={latePenalty} onChange={(e) => setLatePenalty(e.target.value)} className="input" placeholder="0" />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input h-14 resize-none" placeholder="Any notes to include on the invoice…" />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
          {create.isPending ? 'Generating…' : 'Generate Invoice'}
        </button>
      </div>
    </form>
  )
}
