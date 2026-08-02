import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useCreateProspect } from '../../hooks/useProspects'
import { getProperties } from '../../services/property.service'

const SOURCES = ['WALK_IN', 'REFERRAL', 'PHONE', 'ONLINE', 'OTHER']

export default function AddProspectForm({ onClose }) {
  const create = useCreateProspect()
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: 'OTHER', propertyId: '', showingDate: '', notes: '' })

  const { data: properties } = useQuery({
    queryKey: ['properties', 'all'],
    queryFn: () => getProperties({ limit: 200 }),
    select: (r) => r.data || [],
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone) return toast.error('Name and phone are required')
    try {
      await create.mutateAsync({ ...form, propertyId: form.propertyId || undefined, showingDate: form.showingDate || undefined })
      toast.success('Prospect added')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add prospect')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Full name *</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="Jane Nakato" required />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" placeholder="+256 700 000 000" required />
        </div>
      </div>
      <div>
        <label className="label">Email</label>
        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" placeholder="jane@email.com" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Source</label>
          <select value={form.source} onChange={(e) => set('source', e.target.value)} className="input">
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Interested property</label>
          <select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} className="input">
            <option value="">Not specified</option>
            {(properties || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Showing date</label>
        <input type="date" value={form.showingDate} onChange={(e) => set('showingDate', e.target.value)} className="input" />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input h-20 resize-none" placeholder="What are they looking for?" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
          {create.isPending ? 'Adding…' : 'Add Prospect'}
        </button>
      </div>
    </form>
  )
}
