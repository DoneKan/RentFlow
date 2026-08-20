import { useState } from 'react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useProspects, useUpdateProspectStage, useUpdateProspectScreening, useConvertProspect, useDeleteProspect,
} from '../../hooks/useProspects'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import AddProspectForm from '../../components/forms/AddProspectForm'
import AddTenantForm from '../../components/forms/AddTenantForm'

const STAGES = ['NEW', 'CONTACTED', 'SHOWING_SCHEDULED', 'SCREENING', 'APPROVED', 'REJECTED', 'CONVERTED', 'LOST']
const NEXT_STAGE = {
  NEW: 'CONTACTED',
  CONTACTED: 'SHOWING_SCHEDULED',
  SHOWING_SCHEDULED: 'SCREENING',
}

function ScreeningForm({ prospect }) {
  const update = useUpdateProspectScreening()
  const [form, setForm] = useState({
    idNumber: prospect.idNumber || '',
    employerName: prospect.employerName || '',
    monthlyIncome: prospect.monthlyIncome || '',
    previousLandlordName: prospect.previousLandlordName || '',
    previousLandlordPhone: prospect.previousLandlordPhone || '',
    screeningNotes: prospect.screeningNotes || '',
  })
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const save = async (screeningStatus) => {
    try {
      await update.mutateAsync({
        id: prospect.id,
        data: { ...form, monthlyIncome: form.monthlyIncome ? parseFloat(form.monthlyIncome) : undefined, screeningStatus },
      })
      toast.success(screeningStatus ? `Screening ${screeningStatus.toLowerCase()}` : 'Screening details saved')
    } catch {
      toast.error('Failed to save screening details')
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tenant Screening</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">ID Number</label>
          <input value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Employer</label>
          <input value={form.employerName} onChange={(e) => set('employerName', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Monthly income</label>
          <input type="number" value={form.monthlyIncome} onChange={(e) => set('monthlyIncome', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Previous landlord</label>
          <input value={form.previousLandlordName} onChange={(e) => set('previousLandlordName', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Previous landlord phone</label>
        <input value={form.previousLandlordPhone} onChange={(e) => set('previousLandlordPhone', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Screening notes</label>
        <textarea value={form.screeningNotes} onChange={(e) => set('screeningNotes', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => save(undefined)} disabled={update.isPending} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
          Save Details
        </button>
        <button onClick={() => save('APPROVED')} disabled={update.isPending} className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700">
          Approve
        </button>
        <button onClick={() => save('REJECTED')} disabled={update.isPending} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">
          Reject
        </button>
      </div>
    </div>
  )
}

function ProspectDetailModal({ prospect, onClose }) {
  const updateStage = useUpdateProspectStage()
  const convert = useConvertProspect()
  const [showConvert, setShowConvert] = useState(false)

  const advance = async () => {
    const next = NEXT_STAGE[prospect.stage]
    if (!next) return
    try {
      await updateStage.mutateAsync({ id: prospect.id, stage: next })
      toast.success(`Moved to ${next.replace('_', ' ')}`)
    } catch {
      toast.error('Failed to update stage')
    }
  }

  const handleConverted = async (tenancy) => {
    try {
      await convert.mutateAsync({ id: prospect.id, tenancyId: tenancy.id })
      toast.success('Prospect converted to tenancy')
      onClose()
    } catch {
      toast.error('Tenancy created, but failed to update prospect record')
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={prospect.name} size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 space-y-0.5">
            <p>{prospect.phone}{prospect.email ? ` · ${prospect.email}` : ''}</p>
            <p className="text-xs text-gray-400">
              {prospect.property?.name || 'No property specified'}
              {prospect.showingDate ? ` · Showing ${formatDate(prospect.showingDate)}` : ''}
            </p>
          </div>
          <StatusBadge status={prospect.stage} />
        </div>

        {prospect.notes && <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{prospect.notes}</p>}

        {NEXT_STAGE[prospect.stage] && (
          <button onClick={advance} disabled={updateStage.isPending} className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand/90">
            Move to {NEXT_STAGE[prospect.stage].replace('_', ' ')} →
          </button>
        )}

        {['SCREENING', 'APPROVED', 'REJECTED'].includes(prospect.stage) && <ScreeningForm prospect={prospect} />}

        {prospect.screeningStatus === 'APPROVED' && prospect.stage !== 'CONVERTED' && (
          <div className="border-t border-gray-100 pt-4">
            <button onClick={() => setShowConvert(true)} className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700">
              Convert to Tenancy →
            </button>
          </div>
        )}

        {prospect.stage === 'CONVERTED' && (
          <p className="text-xs text-green-600 border-t border-gray-100 pt-4">This prospect has been converted to an active tenancy.</p>
        )}
      </div>

      {showConvert && (
        <Modal isOpen onClose={() => setShowConvert(false)} title={`Convert ${prospect.name} to Tenant`} size="xl">
          <AddTenantForm
            onClose={() => setShowConvert(false)}
            defaultPropertyId={prospect.propertyId}
            defaultName={prospect.name}
            defaultEmail={prospect.email}
            defaultPhone={prospect.phone}
            onSuccess={handleConverted}
          />
        </Modal>
      )}
    </Modal>
  )
}

export default function ProspectsPage() {
  const { user } = useAuth()
  const currency = user?.organization?.currency || 'UGX'
  const [filters, setFilters] = useState({ stage: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const { data, isLoading } = useProspects(filters)
  const deleteMutation = useDeleteProspect()
  const prospects = data?.data || []

  const columns = [
    {
      key: 'name',
      label: 'Prospect',
      render: (v, row) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{v}</p>
          <p className="text-xs text-gray-500">{row.phone}</p>
        </div>
      ),
    },
    { key: 'property', label: 'Property', render: (p) => <span className="text-sm">{p?.name || '—'}</span> },
    { key: 'stage', label: 'Stage', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'monthlyIncome',
      label: 'Income',
      render: (v) => <span className="text-sm">{v ? formatCurrency(v, currency) : '—'}</span>,
    },
    { key: 'createdAt', label: 'Added', render: (v) => <span className="text-sm text-gray-500">{formatDate(v)}</span> },
    {
      key: 'id',
      label: '',
      render: (id, row) => (
        <div className="flex gap-2 justify-end">
          <button onClick={(e) => { e.stopPropagation(); setSelected(row) }} className="text-xs text-brand hover:underline">View</button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(id) }} className="text-xs text-red-500 hover:underline">Delete</button>
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Prospects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track leads from first contact through screening to move-in</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 btn-primary">
          <Plus className="h-4 w-4" /> Add Prospect
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filters.stage}
          onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={prospects}
        onRowClick={(row) => setSelected(row)}
        emptyMessage="No prospects yet"
      />

      {showAdd && (
        <Modal isOpen onClose={() => setShowAdd(false)} title="Add Prospect">
          <AddProspectForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}

      {selected && <ProspectDetailModal prospect={selected} onClose={() => setSelected(null)} />}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync(deleteId)
            toast.success('Prospect removed')
          } catch {
            toast.error('Failed to remove prospect')
          }
          setDeleteId(null)
        }}
        title="Remove Prospect"
        message="Are you sure you want to remove this prospect record? This cannot be undone."
        confirmLabel="Remove"
        isDangerous
      />
    </div>
  )
}
