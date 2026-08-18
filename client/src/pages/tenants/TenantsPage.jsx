import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Users } from 'lucide-react'
import { useTenants } from '../../hooks/useTenants'
import { getProperties } from '../../services/property.service'
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
  const [propertyId, setPropertyId] = useState('')

  const { data: propertiesList } = useQuery({
    queryKey: ['properties', 'all'],
    queryFn: () => getProperties({ limit: 200 }),
    select: (r) => r.data || [],
  })

  const { data, isLoading } = useTenants(propertyId ? { propertyId } : undefined)
  const tenants = data || []

  const filtered = tenants.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.tenant?.name?.toLowerCase().includes(q) ||
      t.tenant?.email?.toLowerCase().includes(q) ||
      t.tenant?.phone?.toLowerCase().includes(q) ||
      t.unit?.unitNumber?.toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'tenant',
      label: 'Tenant',
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand text-xs font-semibold">
            {v?.name?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{v?.name}</p>
            <p className="text-xs text-gray-400">{v?.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (_, row) => row.tenant?.phone || '—' },
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
      label: 'Rent',
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

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Search by name, email, phone, unit…"
          />
        </div>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="input sm:w-56"
        >
          <option value="">All Properties</option>
          {(propertiesList || []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {!isLoading && filtered.length === 0 && !search && !propertyId ? (
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
          emptyMessage="No tenants match these filters"
          onRowClick={(row) => navigate(`/tenants/${row.id}`)}
        />
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Tenant" size="lg">
        <AddTenantForm onClose={() => setShowAdd(false)} />
      </Modal>
    </div>
  )
}
