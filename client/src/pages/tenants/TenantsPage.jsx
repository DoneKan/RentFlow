import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { useTenants } from '../../hooks/useTenants'
import { formatCurrency, formatDate } from '../../utils/formatters'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import AddTenantForm from '../../components/forms/AddTenantForm'
import EmptyState from '../../components/ui/EmptyState'

export default function TenantsPage() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useTenants()
  const tenants = data?.tenants || []

  const filtered = tenants.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.phone?.toLowerCase().includes(q) ||
      t.unit?.unitNumber?.toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'name',
      label: 'Tenant',
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand text-xs font-semibold">
            {v?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{v}</p>
            <p className="text-xs text-gray-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone' },
    {
      key: 'unit',
      label: 'Unit',
      render: (u) => u ? <span className="font-medium">#{u.unitNumber}</span> : '—',
    },
    {
      key: 'property',
      label: 'Property',
      render: (p) => p?.name || '—',
    },
    {
      key: 'rentAmount',
      label: 'Rent (UGX)',
      render: (v) => formatCurrency(v),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'startDate',
      label: 'Move-in',
      render: (v) => formatDate(v),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Tenants"
        subtitle={`${tenants.length} tenant${tenants.length !== 1 ? 's' : ''}`}
        actions={[
          <button key="add" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Tenant
          </button>,
        ]}
      />

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
          placeholder="Search by name, email, phone, unit…"
        />
      </div>

      {!isLoading && filtered.length === 0 && !search ? (
        <EmptyState
          icon={Users}
          title="No tenants yet"
          description="Add your first tenant to start tracking rent and generating invoices."
          action={{ label: 'Add Tenant', onClick: () => setShowAdd(true) }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          emptyMessage="No tenants match your search"
          onRowClick={(row) => navigate(`/tenants/${row.userId || row.id}`)}
        />
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Tenant" size="lg">
        <AddTenantForm onClose={() => setShowAdd(false)} />
      </Modal>
    </div>
  )
}
