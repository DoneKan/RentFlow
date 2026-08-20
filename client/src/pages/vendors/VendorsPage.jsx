import { useState } from 'react'
import { Plus, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { useVendors, useVendorHistory, useUpdateVendor, useDeleteVendor } from '../../hooks/useVendors'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import AddVendorForm from '../../components/forms/AddVendorForm'

function VendorDetailModal({ vendor, onClose }) {
  const { user } = useAuth()
  const currency = user?.organization?.currency || 'UGX'
  const { data: history, isLoading } = useVendorHistory(vendor.id)
  const update = useUpdateVendor()

  const toggleActive = async () => {
    try {
      await update.mutateAsync({ id: vendor.id, data: { isActive: !vendor.isActive } })
      toast.success(vendor.isActive ? 'Vendor deactivated' : 'Vendor activated')
    } catch {
      toast.error('Failed to update vendor')
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={vendor.name} size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 space-y-1">
            {vendor.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {vendor.phone}</p>}
            {vendor.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {vendor.email}</p>}
          </div>
          <button onClick={toggleActive} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            {vendor.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
        {vendor.notes && <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{vendor.notes}</p>}

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Work Order History</h3>
          {isLoading ? (
            <LoadingSpinner />
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No work orders assigned yet</p>
          ) : (
            <div className="space-y-2">
              {history.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-500">{r.property?.name} · Unit {r.unit?.unitNumber} · Assigned {formatDate(r.assignedAt)}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <StatusBadge status={r.status} />
                    {r.cost != null && <span className="text-xs text-gray-500">{formatCurrency(r.cost, currency)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function VendorsPage() {
  const [filters, setFilters] = useState({ category: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const { data, isLoading } = useVendors(filters)
  const deleteMutation = useDeleteVendor()
  const vendors = data?.data || []

  const columns = [
    {
      key: 'name',
      label: 'Vendor',
      render: (v, row) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{v}</p>
          <p className="text-xs text-gray-500">{row.phone}</p>
        </div>
      ),
    },
    { key: 'category', label: 'Category', render: (v) => <span className="text-sm">{v.replace('_', ' ')}</span> },
    { key: 'email', label: 'Email', render: (v) => <span className="text-sm text-gray-500">{v || '—'}</span> },
    {
      key: '_count',
      label: 'Work Orders',
      render: (v) => <span className="text-sm">{v?.maintenanceRequests ?? 0}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (v) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${v ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {v ? 'Active' : 'Inactive'}
        </span>
      ),
    },
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
          <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage maintenance vendors and contractors</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 btn-primary">
          <Plus className="h-4 w-4" /> Add Vendor
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All Categories</option>
          {['PLUMBING', 'ELECTRICAL', 'CLEANING', 'PEST_CONTROL', 'CARPENTRY', 'PAINTING', 'GENERAL', 'OTHER'].map((c) => (
            <option key={c} value={c}>{c.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={vendors}
        onRowClick={(row) => setSelected(row)}
        emptyMessage="No vendors yet"
      />

      {showAdd && (
        <Modal isOpen onClose={() => setShowAdd(false)} title="Add Vendor">
          <AddVendorForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}

      {selected && <VendorDetailModal vendor={selected} onClose={() => setSelected(null)} />}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync(deleteId)
            toast.success('Vendor deleted')
          } catch {
            toast.error('Failed to delete vendor')
          }
          setDeleteId(null)
        }}
        title="Delete Vendor"
        message="Are you sure you want to delete this vendor? This cannot be undone."
        confirmLabel="Delete"
        isDangerous
      />
    </div>
  )
}
