import { useState } from 'react'
import { Home, Building2, TrendingUp, Wallet } from 'lucide-react'
import { useMyOwnerPortal, useOwnerPropertyStatement } from '../../hooks/useOwnerPortal'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

const TABS = ['Overview', 'Properties', 'Financials']

function OverviewTab({ portal }) {
  const currency = portal.properties[0]?.organization?.currency || 'USD'
  const s = portal.summary

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Properties</p>
          <p className="text-2xl font-bold text-gray-900">{s.totalProperties}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Occupancy</p>
          <p className="text-2xl font-bold text-gray-900">{s.occupancyRate}%</p>
          <p className="text-xs text-gray-400 mt-0.5">{s.occupiedUnits}/{s.totalUnits} units</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">This Month's Revenue</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(s.monthlyRevenue, currency)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Net Income</p>
          <p className={`text-2xl font-bold ${s.netIncome >= 0 ? 'text-brand' : 'text-red-600'}`}>
            {formatCurrency(s.netIncome, currency)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Recent Payments</h2>
        {portal.recentPayments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {portal.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{p.tenant?.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.invoice?.property?.name} · Unit #{p.invoice?.unit?.unitNumber} · {formatDate(p.paidAt)}
                  </p>
                </div>
                <p className="font-semibold text-green-600">{formatCurrency(p.amount, currency)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PropertiesTab({ portal, onSelectProperty }) {
  const currency = portal.properties[0]?.organization?.currency || 'USD'

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {portal.properties.map((p) => {
        const occupied = p.units.filter((u) => u.status === 'OCCUPIED').length
        return (
          <button
            key={p.id}
            onClick={() => onSelectProperty(p.id)}
            className="text-left bg-white rounded-xl border border-gray-100 p-5 hover:border-brand/40 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-brand/10 p-2.5 rounded-lg">
                <Building2 className="h-5 w-5 text-brand" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">{p.code} · {p.city}</p>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{p.units.length} units · {occupied} occupied</span>
              <span className="text-brand font-medium">View statement →</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function FinancialsTab({ propertyId, properties }) {
  const [selected, setSelected] = useState(propertyId || properties[0]?.id)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { data: statement, isLoading } = useOwnerPropertyStatement(selected, { month, year })
  const currency = properties[0]?.organization?.currency || 'USD'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={selected || ''}
          onChange={(e) => setSelected(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'long' })}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !statement ? (
        <EmptyState icon={Wallet} title="Select a property" description="Choose a property to view its statement" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-xl font-bold text-green-600">{formatCurrency(statement.summary.revenue, currency)}</p>
              <p className="text-xs text-gray-500 mt-1">Revenue</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-xl font-bold text-red-500">{formatCurrency(statement.summary.expenses, currency)}</p>
              <p className="text-xs text-gray-500 mt-1">Expenses</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-xl font-bold text-brand">{formatCurrency(statement.summary.netIncome, currency)}</p>
              <p className="text-xs text-gray-500 mt-1">Net Income</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Payments Received</h3>
            {statement.payments.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No payments this period</p>
            ) : (
              <div className="space-y-2">
                {statement.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm py-1.5">
                    <span className="text-gray-700">{p.tenant?.name} · Unit #{p.invoice?.unit?.unitNumber}</span>
                    <span className="font-medium">{formatCurrency(p.amount, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Expenses</h3>
            {statement.expenses.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No expenses this period</p>
            ) : (
              <div className="space-y-2">
                {statement.expenses.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm py-1.5">
                    <span className="text-gray-700">{e.description} <span className="text-xs text-gray-400">({e.category})</span></span>
                    <span className="font-medium">{formatCurrency(e.amount, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function OwnerPortalPage() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [selectedProperty, setSelectedProperty] = useState(null)
  const { data: portal, isLoading } = useMyOwnerPortal()

  if (isLoading) return <LoadingSpinner fullPage />
  if (!portal || portal.properties.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Home className="h-10 w-10 mx-auto mb-3 text-gray-300" />
        <p>No properties are assigned to your owner account yet. Contact your property manager.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
        <div className="bg-brand/10 p-3 rounded-xl">
          <TrendingUp className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Owner Portal</h1>
          <p className="text-sm text-gray-500">{portal.summary.totalProperties} propert{portal.summary.totalProperties === 1 ? 'y' : 'ies'} under management</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && <OverviewTab portal={portal} />}
      {activeTab === 'Properties' && (
        <PropertiesTab
          portal={portal}
          onSelectProperty={(id) => { setSelectedProperty(id); setActiveTab('Financials') }}
        />
      )}
      {activeTab === 'Financials' && (
        <FinancialsTab propertyId={selectedProperty} properties={portal.properties} />
      )}
    </div>
  )
}
