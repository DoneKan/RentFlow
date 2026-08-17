import { useState } from 'react'
import toast from 'react-hot-toast'
import { useUpdateTenant } from '../../hooks/useTenants'
import NumberInput from '../ui/NumberInput'

export default function EditTenantForm({ tenancy, onClose }) {
  const update = useUpdateTenant()
  const [form, setForm] = useState({
    name: tenancy.tenant?.name || '',
    phone: tenancy.tenant?.phone || '',
    rentAmount: tenancy.rentAmount || '',
    depositAmount: tenancy.depositAmount || '',
    endDate: tenancy.endDate ? tenancy.endDate.split('T')[0] : '',
    notes: tenancy.notes || '',
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) { toast.error('Name is required'); return }

    try {
      await update.mutateAsync({
        id: tenancy.id,
        data: {
          name: form.name,
          phone: form.phone,
          rentAmount: form.rentAmount ? parseFloat(form.rentAmount) : undefined,
          depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : undefined,
          endDate: form.endDate || null,
          notes: form.notes,
        },
      })
      toast.success('Tenant updated')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update tenant')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Full name *</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
      </div>
      <div>
        <label className="label">Phone</label>
        <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" placeholder="+256 700 000 000" />
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        Email is the tenant's login and can't be changed here — this only updates their name and contact details for this tenancy.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Rent amount</label>
          <NumberInput value={form.rentAmount} onChange={(v) => set('rentAmount', v)} />
        </div>
        <div>
          <label className="label">Deposit amount</label>
          <NumberInput value={form.depositAmount} onChange={(v) => set('depositAmount', v)} />
        </div>
      </div>
      <div>
        <label className="label">End date</label>
        <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className="input" />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input h-16 resize-none" />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={update.isPending} className="btn-primary flex-1">
          {update.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
