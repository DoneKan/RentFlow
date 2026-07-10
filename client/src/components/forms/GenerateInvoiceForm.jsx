import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { useCreateInvoice } from '../../hooks/useInvoices'
import { getTenants, getTenant } from '../../services/tenant.service'
import { formatCurrency } from '../../utils/formatters'
import { addDays, format } from 'date-fns'

export default function GenerateInvoiceForm({ onClose, defaultTenantId }) {
  const create = useCreateInvoice()
  // tenancyId is the selected tenancy ID (what the API expects)
  const [tenancyId, setTenancyId] = useState('')
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'))
  const [latePenalty, setLatePenalty] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])

  // Tenant list returns tenancies
  const { data: tenancies } = useQuery({
    queryKey: ['tenants'],
    queryFn: getTenants,
    select: (r) => r.data?.data || [],
  })

  // If defaultTenantId is a USER ID, find the matching tenancy
  useEffect(() => {
    if (defaultTenantId && tenancies?.length) {
      const match = tenancies.find((t) => t.tenantId === defaultTenantId || t.id === defaultTenantId)
      if (match) setTenancyId(match.id)
    }
  }, [defaultTenantId, tenancies])

  // Fetch tenancy detail to auto-build items
  const { data: tenancyData } = useQuery({
    queryKey: ['tenant', tenancyId],
    queryFn: () => getTenant(tenancyId),
    select: (r) => r.data,
    enabled: !!tenancyId,
  })

  useEffect(() => {
    if (tenancyData?.unit) {
      const unit = tenancyData.unit
      const charges = typeof unit.additionalCharges === 'string'
        ? JSON.parse(unit.additionalCharges || '{}')
        : (unit.additionalCharges || {})
      const baseItems = [
        { description: `Rent — ${unit.unitNumber} (${unit.type})`, amount: parseFloat(unit.rentAmount) },
      ]
      Object.entries(charges).forEach(([k, v]) => {
        if (v) baseItems.push({ description: k.charAt(0).toUpperCase() + k.slice(1), amount: parseFloat(v) })
      })
      setItems(baseItems)
    }
  }, [tenancyData])

  const updateItem = (i, field, value) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const addItem = () => setItems((p) => [...p, { description: '', amount: 0 }])
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i))

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!tenancyId) { toast.error('Please select a tenant'); return }
    if (items.length === 0) { toast.error('Add at least one invoice item'); return }
    try {
      await create.mutateAsync({
        tenancyId,
        dueDate,
        latePenalty: latePenalty ? parseFloat(latePenalty) : 0,
        customItems: items.map((i) => ({ ...i, amount: parseFloat(i.amount) || 0 })),
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
        <select value={tenancyId} onChange={(e) => setTenancyId(e.target.value)} className="input" required>
          <option value="">Select tenant…</option>
          {(tenancies || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.tenant?.name} — {t.property?.name} Unit {t.unit?.unitNumber}
            </option>
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

      {tenancyId && items.length === 0 && (
        <div className="text-center py-3">
          <button type="button" onClick={addItem} className="text-sm text-brand hover:underline">
            + Add invoice item manually
          </button>
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
