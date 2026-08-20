import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Download, TrendingUp, TrendingDown, AlertCircle, Receipt, DollarSign,
  Building2, LayoutGrid, Percent,
} from 'lucide-react'
import {
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  format,
} from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import DataTable from '../../components/ui/DataTable'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuth } from '../../context/AuthContext'
import { getFinancialOverview, getFinancialByProperty, exportReport, exportFullData } from '../../services/report.service'
import { formatCurrency } from '../../utils/formatters'

const PIE_COLORS = {
  UTILITIES: '#3b82f6',
  SECURITY: '#f97316',
  MAINTENANCE: '#eab308',
  KCCA_TAX: '#ef4444',
  URA_TAX: '#dc2626',
  REPAIRS: '#f59e0b',
  INSURANCE: '#8b5cf6',
  LAND_ACQUISITION: '#10b981',
  CONSTRUCTION: '#14b8a6',
  OTHER: '#6b7280',
}

const CATEGORY_LABELS = {
  UTILITIES: 'Utilities', SECURITY: 'Security', MAINTENANCE: 'Maintenance',
  KCCA_TAX: 'KCCA Tax', URA_TAX: 'URA Tax', REPAIRS: 'Repairs',
  INSURANCE: 'Insurance', LAND_ACQUISITION: 'Land / Acquisition',
  CONSTRUCTION: 'Construction', OTHER: 'Other',
}

const RANGE_PRESETS = [
  { key: 'this-month', label: 'This Month' },
  { key: 'all-years', label: 'All Years' },
  { key: 'this-quarter', label: 'This Quarter' },
  { key: 'this-year', label: 'This Year' },
]

// "All Years" has no real date bound — every report query here filters on
// a start/end window, so instead of threading a separate unbounded mode
// through each one, this just picks a window wide enough to be a no-op:
// before RentFlow could have any data, through far enough ahead to catch
// future-dated invoices/leases.
const ALL_YEARS_START = new Date(2000, 0, 1)
const ALL_YEARS_END = new Date(2100, 11, 31, 23, 59, 59, 999)

function resolvePreset(preset) {
  const now = new Date()
  switch (preset) {
    case 'all-years':
      return { start: ALL_YEARS_START, end: ALL_YEARS_END }
    case 'this-quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) }
    case 'this-year':
      return { start: startOfYear(now), end: endOfYear(now) }
    case 'this-month':
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) }
  }
}

export default function ReportsPage() {
  const { user } = useAuth()
  const currency = user?.organization?.currency || 'UGX'
  const [tab, setTab] = useState('overview')
  const [preset, setPreset] = useState('this-month')
  const [exporting, setExporting] = useState(false)
  const [exportingFull, setExportingFull] = useState(false)
  const [sortKey, setSortKey] = useState('revenue')
  const [sortDir, setSortDir] = useState('desc')

  const { start, end } = useMemo(() => resolvePreset(preset), [preset])
  const params = useMemo(
    () => ({ startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') }),
    [start, end]
  )
  const periodLabel = useMemo(() => {
    if (preset === 'all-years') return 'All Time'
    if (preset === 'this-year') return format(start, 'yyyy')
    if (preset === 'this-quarter') return `${format(start, 'MMM')} – ${format(end, 'MMM yyyy')}`
    return format(start, 'MMMM yyyy')
  }, [preset, start, end])

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['financial-overview', params.startDate, params.endDate],
    queryFn: () => getFinancialOverview(params),
    select: (r) => r.data,
    enabled: tab === 'overview',
    refetchOnMount: 'always',
  })

  const { data: byProperty, isLoading: byPropertyLoading } = useQuery({
    queryKey: ['financial-by-property', params.startDate, params.endDate],
    queryFn: () => getFinancialByProperty(params),
    select: (r) => r.data,
    enabled: tab === 'by-property',
    refetchOnMount: 'always',
  })

  // 7th grouped bar: straight sum of the 6 months already fetched above,
  // not a separate query.
  const trendWithTotal = useMemo(() => {
    const trend = overview?.trend || []
    if (trend.length === 0) return trend
    return [
      ...trend,
      {
        month: 'Total',
        revenue: trend.reduce((s, m) => s + (m.revenue || 0), 0),
        expenses: trend.reduce((s, m) => s + (m.expenses || 0), 0),
      },
    ]
  }, [overview])

  const pieData = (overview?.expenses?.byCategory || [])
    .filter((c) => c.amount > 0)
    .map((c) => ({ name: CATEGORY_LABELS[c.category] || c.category, value: c.amount, color: PIE_COLORS[c.category] || '#6b7280' }))

  const sortedProperties = useMemo(() => {
    const rows = byProperty?.properties || []
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return sorted
  }, [byProperty, sortKey, sortDir])

  const handleSortChange = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleExport = async (type) => {
    setExporting(true)
    try {
      const data = await exportReport({ ...params, type })
      const blob = new Blob([data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rentflow-${type}-${preset === 'all-years' ? 'all-years' : params.startDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleExportFullData = async () => {
    setExportingFull(true)
    try {
      const data = await exportFullData(params)
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rentflow-full-data-${preset === 'all-years' ? 'all-years' : params.startDate}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Full data exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExportingFull(false)
    }
  }

  const propertyColumns = [
    { key: 'propertyName', label: 'Property', sortable: true },
    {
      key: 'occupancyRate', label: 'Occupancy', sortable: true,
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full">
            <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${v}%` }} />
          </div>
          <span className="text-xs text-gray-500">{v}% ({row.occupiedUnits}/{row.totalUnits})</span>
        </div>
      ),
    },
    { key: 'invoicesRaised', label: 'Invoices', sortable: true },
    { key: 'revenue', label: 'Revenue', sortable: true, render: (v) => <span className="font-semibold text-green-700">{formatCurrency(v, currency)}</span> },
    { key: 'expenses', label: 'Expenses', sortable: true, render: (v) => <span className="font-medium text-red-600">{formatCurrency(v, currency)}</span> },
    { key: 'outstanding', label: 'Outstanding', sortable: true, render: (v) => <span className={v > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>{formatCurrency(v, currency)}</span> },
    { key: 'netIncome', label: 'Net Income', sortable: true, render: (v) => <span className={`font-semibold ${v >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(v, currency)}</span> },
    { key: 'margin', label: 'Margin', sortable: true, render: (v) => <span className="text-gray-600">{v}%</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle={`Financial performance — ${periodLabel}`}
        actions={[
          <button
            key="export"
            onClick={() => handleExport(tab === 'overview' ? 'overall' : 'by-property')}
            disabled={exporting}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>,
          <button
            key="export-full"
            onClick={handleExportFullData}
            disabled={exportingFull}
            title="Every underlying record for the selected period — tenants, payments, invoices, and expenses — as a spreadsheet with one tab per record type"
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {exportingFull ? 'Exporting…' : 'Export Full Data'}
          </button>,
        ]}
      />

      {/* Tabs + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'overview' ? 'bg-white shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Overall
          </button>
          <button
            onClick={() => setTab('by-property')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'by-property' ? 'bg-white shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 className="h-4 w-4" /> By Property
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                preset === p.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        overviewLoading ? <LoadingSpinner /> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Revenue Collected"
                value={formatCurrency(overview?.revenue?.total || 0, currency)}
                icon={TrendingUp}
                colorClass="bg-green-500"
                subtitle={`${overview?.revenue?.count || 0} payments`}
              />
              <StatCard
                title="Outstanding"
                value={formatCurrency(overview?.outstanding?.total || 0, currency)}
                icon={AlertCircle}
                colorClass="bg-orange-500"
                subtitle={`${overview?.outstanding?.count || 0} unpaid invoices`}
              />
              <StatCard
                title="Total Expenses"
                value={formatCurrency(overview?.expenses?.total || 0, currency)}
                icon={Receipt}
                colorClass="bg-red-500"
              />
              <StatCard
                title="Net Income"
                value={formatCurrency(overview?.netIncome || 0, currency)}
                icon={overview?.netIncome >= 0 ? DollarSign : TrendingDown}
                colorClass={overview?.netIncome >= 0 ? 'bg-brand' : 'bg-red-500'}
                subtitle={`${overview?.collectionRate ?? 0}% collection rate`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue vs Expenses (6 months)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={trendWithTotal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#1e3a5f" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Expenses by Category</h3>
                {pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">No expenses this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Collection Health</h3>
              </div>
              <p className="text-sm text-gray-500">
                Of {formatCurrency(overview?.invoiced?.total || 0, currency)} invoiced this period, {formatCurrency(overview?.revenue?.total || 0, currency)} has
                been collected ({overview?.collectionRate ?? 0}%), leaving {formatCurrency(overview?.outstanding?.total || 0, currency)} outstanding
                across {overview?.outstanding?.count || 0} invoice(s).
              </p>
            </div>
          </>
        )
      )}

      {tab === 'by-property' && (
        byPropertyLoading ? <LoadingSpinner /> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Properties" value={byProperty?.properties?.length || 0} icon={Building2} colorClass="bg-indigo-500" />
              <StatCard title="Total Revenue" value={formatCurrency(byProperty?.totals?.revenue || 0, currency)} icon={TrendingUp} colorClass="bg-green-500" />
              <StatCard title="Total Expenses" value={formatCurrency(byProperty?.totals?.expenses || 0, currency)} icon={Receipt} colorClass="bg-red-500" />
              <StatCard
                title="Net Income"
                value={formatCurrency(byProperty?.totals?.netIncome || 0, currency)}
                icon={DollarSign}
                colorClass="bg-brand"
                subtitle={`${byProperty?.totals?.margin ?? 0}% margin`}
              />
            </div>

            <DataTable
              columns={propertyColumns}
              data={sortedProperties}
              emptyMessage="No active properties in this period"
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={handleSortChange}
            />
          </>
        )
      )}
    </div>
  )
}
