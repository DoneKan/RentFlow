import { useState } from 'react'
import { Wrench, Plus, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useMaintenance, useUpdateMaintenance, useDeleteMaintenance } from '../../hooks/useMaintenance'
import { formatDate } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const PRIORITY_COLORS = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

function DetailModal({ request, onClose }) {
  const update = useUpdateMaintenance()
  const [status, setStatus] = useState(request.status)

  const handleStatusChange = async (newStatus) => {
    try {
      await update.mutateAsync({ id: request.id, data: { status: newStatus } })
      setStatus(newStatus)
      toast.success('Status updated')
    } catch {
      toast.error('Failed to update status')
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Maintenance Request" size="lg">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{request.title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {request.property?.name} · Unit {request.unit?.unitNumber}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PRIORITY_COLORS[request.priority]}`}>
            {request.priority}
          </span>
        </div>

        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{request.description}</p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-1">Tenant</p>
            <p className="font-medium">{request.tenant?.name}</p>
            <p className="text-gray-500">{request.tenant?.phone}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Submitted</p>
            <p className="font-medium">{formatDate(request.createdAt)}</p>
            {request.resolvedAt && (
              <p className="text-green-600 text-xs mt-0.5">Resolved {formatDate(request.resolvedAt)}</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={status === s || update.isPending}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                  status === s
                    ? 'bg-brand text-white border-brand'
                    : 'border-gray-200 text-gray-600 hover:border-brand hover:text-brand'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function MaintenancePage() {
  const [filters, setFilters] = useState({ status: '', priority: '' })
  const [selected, setSelected] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const { data, isLoading } = useMaintenance(filters)
  const deleteMutation = useDeleteMaintenance()

  const requests = data?.data || []

  const summaryStats = {
    open: requests.filter((r) => r.status === 'OPEN').length,
    inProgress: requests.filter((r) => r.status === 'IN_PROGRESS').length,
    resolved: requests.filter((r) => r.status === 'RESOLVED').length,
    urgent: requests.filter((r) => r.priority === 'URGENT').length,
  }

  const columns = [
    {
      key: 'title',
      label: 'Issue',
      render: (v, row) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{v}</p>
          <p className="text-xs text-gray-500">{row.property?.name} · Unit {row.unit?.unitNumber}</p>
        </div>
      ),
    },
    { key: 'tenant', label: 'Tenant', render: (t) => <span className="text-sm">{t?.name}</span> },
    {
      key: 'priority',
      label: 'Priority',
      render: (v) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[v]}`}>{v}</span>
      ),
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'createdAt', label: 'Submitted', render: (v) => <span className="text-sm text-gray-500">{formatDate(v)}</span> },
    {
      key: 'id',
      label: '',
      render: (id, row) => (
        <div className="flex gap-2 justify-end">
          <button onClick={(e) => { e.stopPropagation(); setSelected(row) }} className="text-xs text-brand hover:underline">
            View
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(id) }} className="text-xs text-red-500 hover:underline">
            Delete
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Maintenance Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage property maintenance issues</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open', value: summaryStats.open, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'In Progress', value: summaryStats.inProgress, icon: Wrench, color: 'text-yellow-500', bg: 'bg-yellow-50' },
          { label: 'Resolved', value: summaryStats.resolved, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Urgent', value: summaryStats.urgent, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`${bg} p-2.5 rounded-lg`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All Priorities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <DataTable
          columns={columns}
          data={requests}
          onRowClick={(row) => setSelected(row)}
          emptyMessage="No maintenance requests yet"
          emptyIcon={<Wrench className="h-8 w-8 text-gray-300" />}
        />
      </div>

      {selected && <DetailModal request={selected} onClose={() => setSelected(null)} />}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync(deleteId)
            toast.success('Request deleted')
          } catch {
            toast.error('Failed to delete')
          }
          setDeleteId(null)
        }}
        title="Delete Request"
        message="Are you sure you want to delete this maintenance request? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
