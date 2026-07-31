import { useState } from 'react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLeaseDocuments, useCreateLeaseDocument, useVoidLeaseDocument, openLeaseDocument } from '../../hooks/useLeaseDocuments'
import { useTenants } from '../../hooks/useTenants'
import { formatDate } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function GenerateModal({ onClose }) {
  const { data: tenantsData } = useTenants({ status: 'ACTIVE', limit: 100 })
  const create = useCreateLeaseDocument()
  const [tenancyId, setTenancyId] = useState('')
  const tenancies = tenantsData?.data || []

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!tenancyId) return toast.error('Please select a tenancy')
    try {
      await create.mutateAsync(tenancyId)
      toast.success('Lease document generated')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate lease document')
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Generate Lease Document">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Tenancy</label>
          <select value={tenancyId} onChange={(e) => setTenancyId(e.target.value)} className="input">
            <option value="">Select a tenant...</option>
            {tenancies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tenant?.name} — {t.property?.name} Unit {t.unit?.unitNumber}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500">
          This creates a new lease agreement for the tenant to review and sign from their portal.
        </p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
            {create.isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function LeaseDocumentsPage() {
  const [showGenerate, setShowGenerate] = useState(false)
  const [voidId, setVoidId] = useState(null)
  const { data: documents, isLoading } = useLeaseDocuments()
  const voidMutation = useVoidLeaseDocument()
  const docs = documents || []

  const columns = [
    {
      key: 'tenancy',
      label: 'Tenant',
      render: (t) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{t?.tenant?.name}</p>
          <p className="text-xs text-gray-500">{t?.property?.name} · Unit {t?.unit?.unitNumber}</p>
        </div>
      ),
    },
    { key: 'version', label: 'Version', render: (v) => <span className="text-sm">v{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'createdAt', label: 'Created', render: (v) => <span className="text-sm text-gray-500">{formatDate(v)}</span> },
    { key: 'signedAt', label: 'Signed', render: (v) => <span className="text-sm text-gray-500">{v ? formatDate(v) : '—'}</span> },
    {
      key: 'id',
      label: '',
      render: (id, row) => (
        <div className="flex gap-2 justify-end">
          <button onClick={(e) => { e.stopPropagation(); openLeaseDocument(id) }} className="text-xs text-brand hover:underline">
            View
          </button>
          {row.status !== 'DECLINED' && (
            <button onClick={(e) => { e.stopPropagation(); setVoidId(id) }} className="text-xs text-red-500 hover:underline">
              Void
            </button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lease Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and track signed lease agreements</p>
        </div>
        <button onClick={() => setShowGenerate(true)} className="flex items-center gap-2 btn-primary">
          <Plus className="h-4 w-4" /> Generate Lease
        </button>
      </div>

      <DataTable columns={columns} data={docs} emptyMessage="No lease documents yet" />

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} />}

      <ConfirmDialog
        isOpen={!!voidId}
        onClose={() => setVoidId(null)}
        onConfirm={async () => {
          try {
            await voidMutation.mutateAsync(voidId)
            toast.success('Lease document voided')
          } catch {
            toast.error('Failed to void document')
          }
          setVoidId(null)
        }}
        title="Void Lease Document"
        message="Are you sure you want to void this lease document? The tenant will no longer be able to sign it."
        confirmLabel="Void"
        isDangerous
      />
    </div>
  )
}
