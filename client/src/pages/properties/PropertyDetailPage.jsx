import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Building2, MapPin, Pencil, Plus, UserPlus } from 'lucide-react'
import { useProperty, usePropertyUnits } from '../../hooks/useProperties'
import { formatCurrency } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import AddUnitForm from '../../components/forms/AddUnitForm'
import AddTenantForm from '../../components/forms/AddTenantForm'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { useExpenses } from '../../hooks/useExpenses'
import LogExpenseForm from '../../components/forms/LogExpenseForm'
import { formatDate } from '../../utils/formatters'

const TABS = ['Overview', 'Units', 'Expenses']

export default function PropertyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [showAddTenant, setShowAddTenant] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState(null)
  const [showAddExpense, setShowAddExpense] = useState(false)

  const { data: property, isLoading } = useProperty(id)
  const { data: unitsData, isLoading: unitsLoading } = usePropertyUnits(id)
  const { data: expensesData, isLoading: expensesLoading } = useExpenses({ propertyId: id })

  const units = unitsData?.units || []
  const expenses = expensesData?.expenses || []

  if (isLoading) return <LoadingSpinner fullPage />
  if (!property) return <div className="text-center py-20 text-gray-500">Property not found</div>

  const unitCols = [
    { key: 'unitNumber', label: 'Unit #', render: (v) => <span className="font-medium">#{v}</span> },
    { key: 'type', label: 'Type' },
    { key: 'rentAmount', label: 'Rent (UGX)', render: (v) => formatCurrency(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'tenancy',
      label: 'Tenant',
      render: (t) => t ? (
        <span className="text-sm text-gray-900">{t.tenant?.name}</span>
      ) : (
        <span className="text-xs text-gray-400">Vacant</span>
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (unitId, row) => (
        <div className="flex gap-2">
          {row.status === 'VACANT' ? (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedUnitId(unitId); setShowAddTenant(true) }}
              className="text-xs text-green-600 font-medium hover:underline flex items-center gap-1"
            >
              <UserPlus className="h-3.5 w-3.5" /> Assign Tenant
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/tenants/${row.tenancy?.tenantId}`) }}
              className="text-xs text-brand hover:underline"
            >
              View Tenant
            </button>
          )}
        </div>
      ),
    },
  ]

  const expenseCols = [
    { key: 'date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'category', label: 'Category', render: (v) => v.replace(/_/g, ' ') },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(v) },
    { key: 'vendor', label: 'Vendor' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate('/properties')} className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{property.code}</span>
            <StatusBadge status={property.isActive ? 'ACTIVE' : 'CANCELLED'} />
          </div>
          <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}, {property.city}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Property Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">Type</p><p className="font-medium mt-0.5">{property.type}</p></div>
                <div><p className="text-gray-500">Country</p><p className="font-medium mt-0.5">{property.country}</p></div>
                <div><p className="text-gray-500">District</p><p className="font-medium mt-0.5">{property.district || '—'}</p></div>
                <div><p className="text-gray-500">Manager</p><p className="font-medium mt-0.5">{property.manager?.name || '—'}</p></div>
              </div>
              {property.description && (
                <p className="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-3">{property.description}</p>
              )}
            </div>
            {property.amenities?.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a) => (
                    <span key={a} className="bg-brand/10 text-brand text-xs px-3 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {[
              { label: 'Total Units', value: units.length },
              { label: 'Occupied', value: units.filter((u) => u.status === 'OCCUPIED').length, color: 'text-green-600' },
              { label: 'Vacant', value: units.filter((u) => u.status === 'VACANT').length, color: 'text-orange-500' },
              { label: 'Monthly Revenue', value: formatCurrency(property.monthlyRevenue || 0), color: 'text-brand' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card py-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${color || 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Units' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowAddUnit(true)} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Unit
            </button>
          </div>
          <DataTable columns={unitCols} data={units} loading={unitsLoading} emptyMessage="No units added yet" />
        </div>
      )}

      {activeTab === 'Expenses' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowAddExpense(true)} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Log Expense
            </button>
          </div>
          <DataTable columns={expenseCols} data={expenses} loading={expensesLoading} emptyMessage="No expenses logged for this property" />
        </div>
      )}

      <Modal isOpen={showAddUnit} onClose={() => setShowAddUnit(false)} title="Add Unit" size="lg">
        <AddUnitForm propertyId={id} onClose={() => setShowAddUnit(false)} />
      </Modal>

      <Modal isOpen={showAddTenant} onClose={() => { setShowAddTenant(false); setSelectedUnitId(null) }} title="Assign Tenant" size="lg">
        <AddTenantForm defaultPropertyId={id} onClose={() => { setShowAddTenant(false); setSelectedUnitId(null) }} />
      </Modal>

      <Modal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} title="Log Expense" size="md">
        <LogExpenseForm defaultPropertyId={id} onClose={() => setShowAddExpense(false)} />
      </Modal>
    </div>
  )
}
