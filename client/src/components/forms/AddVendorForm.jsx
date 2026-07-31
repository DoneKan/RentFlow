import { useState } from 'react'
import toast from 'react-hot-toast'
import { useCreateVendor } from '../../hooks/useVendors'

const CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'CLEANING', 'PEST_CONTROL', 'CARPENTRY', 'PAINTING', 'GENERAL', 'OTHER']

export default function AddVendorForm({ onClose }) {
  const create = useCreateVendor()
  const [form, setForm] = useState({ name: '', category: 'GENERAL', phone: '', email: '', address: '', notes: '' })

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return toast.error('Vendor name is required')
    try {
      await create.mutateAsync(form)
      toast.success('Vendor added')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add vendor')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Vendor name *</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="e.g. Kampala Plumbing Services" required />
      </div>
      <div>
        <label className="label">Category</label>
        <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Phone</label>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" placeholder="0700 000 000" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" placeholder="vendor@example.com" />
        </div>
      </div>
      <div>
        <label className="label">Address</label>
        <input value={form.address} onChange={(e) => set('address', e.target.value)} className="input" placeholder="Location / area served" />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input h-20 resize-none" placeholder="Rates, reliability, specialties…" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
          {create.isPending ? 'Adding…' : 'Add Vendor'}
        </button>
      </div>
    </form>
  )
}
