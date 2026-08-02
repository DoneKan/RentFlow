import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useInspections, useCreateInspection } from '../../hooks/useInspections'
import { getProperties } from '../../services/property.service'
import { formatDate } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const TYPES = ['MOVE_IN', 'MOVE_OUT', 'ROUTINE']

function ScheduleModal({ onClose }) {
  const create = useCreateInspection()
  const navigate = useNavigate()
  const [form, setForm] = useState({ propertyId: '', type: 'ROUTINE', scheduledDate: '' })

  const { data: properties } = useQuery({
    queryKey: ['properties', 'all'],
    queryFn: () => getProperties({ limit: 200 }),
    select: (r) => r.data || [],
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.propertyId) return toast.error('Please select a property')
    try {
      const res = await create.mutateAsync({ ...form, scheduledDate: form.scheduledDate || undefined })
      toast.success('Inspection scheduled')
      onClose()
      navigate(`/inspections/${res.data?.data?.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule inspection')
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Schedule Inspection">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Property *</label>
          <select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} className="input">
            <option value="">Select property…</option>
            {(properties || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input">
            {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Scheduled date</label>
          <input type="date" value={form.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} className="input" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
            {create.isPending ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function InspectionsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ status: '', type: '' })
  const [showSchedule, setShowSchedule] = useState(false)

  const { data, isLoading } = useInspections(filters)
  const inspections = data?.data || []

  const columns = [
    {
      key: 'property',
      label: 'Property',
      render: (p) => <span className="text-sm font-medium text-gray-900">{p?.name}</span>,
    },
    { key: 'type', label: 'Type', render: (v) => <span className="text-sm">{v.replace('_', ' ')}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'scheduledDate', label: 'Scheduled', render: (v) => <span className="text-sm text-gray-500">{v ? formatDate(v) : '—'}</span> },
    { key: '_count', label: 'Checklist Items', render: (v) => <span className="text-sm">{v?.items ?? 0}</span> },
  ]

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inspections</h1>
          <p className="text-sm text-gray-500 mt-0.5">Move-in, move-out, and routine property inspections</p>
        </div>
        <button onClick={() => setShowSchedule(true)} className="flex items-center gap-2 btn-primary">
          <Plus className="h-4 w-4" /> Schedule Inspection
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All Statuses</option>
          {['SCHEDULED', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={inspections}
        onRowClick={(row) => navigate(`/inspections/${row.id}`)}
        emptyMessage="No inspections scheduled yet"
      />

      {showSchedule && <ScheduleModal onClose={() => setShowSchedule(false)} />}
    </div>
  )
}
