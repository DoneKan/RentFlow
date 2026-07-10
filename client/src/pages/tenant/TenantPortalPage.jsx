import { useState } from 'react'
import { Home, FileText, Wrench, CreditCard, Plus, Calendar, Shield, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useMyPortal, useMaintenance, useCreateMaintenance, useUpdateMaintenance } from '../../hooks/useMaintenance'
import { formatCurrency, formatDate } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const TABS = ['Overview', 'Statement', 'Maintenance']

const PRIORITY_COLORS = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

function NewRequestModal({ onClose }) {
  const create = useCreateMaintenance()
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.description) return toast.error('Please fill in all fields')
    try {
      await create.mutateAsync(form)
      toast.success('Maintenance request submitted')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request')
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="New Maintenance Request">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Issue Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            placeholder="e.g. Leaking kitchen faucet"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            placeholder="Describe the issue in detail..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
          >
            {create.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function OverviewTab({ portal }) {
  const unit = portal.unit
  const property = portal.property
  const org = property?.organization
  const currency = org?.currency || 'USD'

  const overdueCount = portal.invoices?.filter((i) => i.status === 'OVERDUE').length || 0
  const totalPaid = portal.invoices
    ?.filter((i) => i.status === 'PAID')
    .reduce((sum, i) => sum + parseFloat(i.amount), 0) || 0

  return (
    <div className="space-y-6">
      {overdueCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">
            You have {overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''}. Please settle to avoid late penalties.
          </p>
        </div>
      )}

      {/* Lease info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Lease Information</h2>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Property</p>
            <p className="font-medium">{property?.name}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Unit</p>
            <p className="font-medium">#{unit?.unitNumber} · {unit?.type}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Monthly Rent</p>
            <p className="font-semibold text-brand">{formatCurrency(portal.rentAmount, currency)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Security Deposit</p>
            <p className="font-medium">{formatCurrency(portal.depositAmount, currency)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Start Date</p>
            <p className="font-medium">{formatDate(portal.startDate)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">End Date</p>
            <p className="font-medium">{portal.endDate ? formatDate(portal.endDate) : 'Month-to-month'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Late Fee Policy</p>
            <p className="font-medium">5% after 5 days grace period</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Status</p>
            <StatusBadge status={portal.status} />
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Payment Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Bank Transfer</p>
            <p className="font-semibold text-gray-900">Stanbic Bank Uganda</p>
            <p className="text-gray-600 mt-1">A/C: 9030012345678</p>
            <p className="text-gray-600">A/C Name: {org?.name}</p>
            <p className="text-gray-600">Branch: Kampala Main</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Mobile Money</p>
            <p className="font-semibold text-gray-900">MTN MoMo</p>
            <p className="text-gray-600 mt-1">Merchant Code: 123456</p>
            <p className="text-gray-500 text-xs mt-2">Airtel Money: 0752-000-000</p>
          </div>
        </div>
        {org?.phone && (
          <p className="text-xs text-gray-400 mt-3">
            For payment queries contact: {org.phone} · {org.email}
          </p>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid, currency)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Paid (last 12 months)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {portal.invoices?.filter((i) => i.status === 'PAID').length || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Invoices Settled</p>
        </div>
      </div>
    </div>
  )
}

function StatementTab({ portal }) {
  const currency = portal.property?.organization?.currency || 'USD'
  const invoices = portal.invoices || []

  return (
    <div className="space-y-3">
      {invoices.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No invoices yet</p>
        </div>
      )}
      {invoices.map((inv) => {
        const paid = inv.payments?.reduce((s, p) => s + parseFloat(p.amount), 0) || 0
        return (
          <div key={inv.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900">{inv.invoiceNumber}</p>
              <p className="text-xs text-gray-500 mt-0.5">Due {formatDate(inv.dueDate)}</p>
              {inv.status === 'PAID' && (
                <p className="text-xs text-green-600 mt-0.5">Paid {formatDate(inv.paidAt)}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-sm">{formatCurrency(inv.amount, currency)}</p>
              <StatusBadge status={inv.status} className="mt-1" />
              {inv.status === 'PAID' && paid > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">Received: {formatCurrency(paid, currency)}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MaintenanceTab({ onNew }) {
  const { data, isLoading } = useMaintenance({})
  const update = useUpdateMaintenance()
  const requests = data?.data || []

  const handleCancel = async (id) => {
    try {
      await update.mutateAsync({ id, data: { status: 'CANCELLED' } })
      toast.success('Request cancelled')
    } catch {
      toast.error('Failed to cancel')
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" /> New Request
        </button>
      </div>

      {requests.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No maintenance requests</p>
        </div>
      )}

      {requests.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm text-gray-900">{r.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[r.priority]}`}>
                  {r.priority}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{r.description}</p>
              <p className="text-xs text-gray-400 mt-1.5">Submitted {formatDate(r.createdAt)}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={r.status} />
              {r.status === 'OPEN' && (
                <button
                  onClick={() => handleCancel(r.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TenantPortalPage() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [showNewRequest, setShowNewRequest] = useState(false)
  const { data: portal, isLoading } = useMyPortal()

  if (isLoading) return <LoadingSpinner fullPage />
  if (!portal) return (
    <div className="text-center py-20 text-gray-500">
      <Home className="h-10 w-10 mx-auto mb-3 text-gray-300" />
      <p>No active tenancy found. Contact your property manager.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
        <div className="bg-brand/10 p-3 rounded-xl">
          <Home className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{portal.property?.name}</h1>
          <p className="text-sm text-gray-500">
            Unit #{portal.unit?.unitNumber} · {portal.unit?.type} · {portal.property?.address}, {portal.property?.city}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && <OverviewTab portal={portal} />}
      {activeTab === 'Statement' && <StatementTab portal={portal} />}
      {activeTab === 'Maintenance' && (
        <MaintenanceTab onNew={() => setShowNewRequest(true)} />
      )}

      {showNewRequest && <NewRequestModal onClose={() => setShowNewRequest(false)} />}
    </div>
  )
}
