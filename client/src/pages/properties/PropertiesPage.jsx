import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, MapPin, Users, TrendingUp } from 'lucide-react'
import { useProperties } from '../../hooks/useProperties'
import { formatCurrency } from '../../utils/formatters'
import { PROPERTY_TYPES } from '../../utils/constants'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import AddPropertyForm from '../../components/forms/AddPropertyForm'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function PropertyCard({ property, onClick }) {
  const occupiedUnits = property._count?.units?.occupied || property.occupiedUnits || 0
  const totalUnits = property._count?.units || property.totalUnits || 0
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0

  return (
    <button
      onClick={onClick}
      className="card text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <Building2 className="h-5 w-5 text-brand" />
        </div>
        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {property.code}
        </span>
      </div>

      <h3 className="font-semibold text-gray-900 text-base">{property.name}</h3>
      <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{property.city}{property.district ? `, ${property.district}` : ''}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{totalUnits}</p>
          <p className="text-xs text-gray-400">Units</p>
        </div>
        <div className="text-center border-x border-gray-100">
          <p className="text-lg font-bold text-gray-900">{occupancyRate}%</p>
          <p className="text-xs text-gray-400">Occupied</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">{formatCurrency(property.monthlyRevenue || 0)}</p>
          <p className="text-xs text-gray-400">Revenue</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all"
          style={{ width: `${occupancyRate}%` }}
        />
      </div>

      {property.manager && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <Users className="h-3 w-3" />
          {property.manager.name}
        </div>
      )}
    </button>
  )
}

export default function PropertiesPage() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const { data, isLoading } = useProperties()
  const properties = data?.properties || []

  const filtered = properties.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'ALL' || p.type === typeFilter
    return matchSearch && matchType
  })

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={`${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}`}
        actions={[
          <button key="add" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Property
          </button>,
        ]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Search by name, city, code…"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input sm:w-44"
        >
          <option value="ALL">All types</option>
          {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Add your first property to start managing tenants, rent, and expenses."
          action={{ label: 'Add Property', onClick: () => setShowAdd(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <PropertyCard key={p.id} property={p} onClick={() => navigate(`/properties/${p.id}`)} />
          ))}
        </div>
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Property" size="lg">
        <AddPropertyForm onClose={() => setShowAdd(false)} />
      </Modal>
    </div>
  )
}
