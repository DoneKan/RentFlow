import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, Home, FileText, CreditCard, Send, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTenant, useTerminateTenant } from '../../hooks/useTenants'
import { useInvoices, useSendReminder } from '../../hooks/useInvoices'
import { usePayments } from '../../hooks/usePayments'
import { formatCurrency, formatDate, getInitials } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import GenerateInvoiceForm from '../../components/forms/GenerateInvoiceForm'
import RecordPaymentForm from '../../components/forms/RecordPaymentForm'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const TABS = ['Overview', 'Invoices', 'Payments']

export default function TenantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [showInvoice, setShowInvoice] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showTerminate, setShowTerminate] = useState(false)

  const { data: tenant, isLoading } = useTenant(id)
  const terminate = useTerminateTenant()
  const sendReminder = useSendReminder()

  const { data: invoicesData, isLoading: invLoading } = useInvoices({ tenantId: id })
  const { data: paymentsData, isLoading: payLoading } = usePayments({ tenantId: id })

  const invoices = invoicesData?.invoices || []
  const payments = paymentsData?.payments || []

  if (isLoading) return <LoadingSpinner fullPage />
  if (!tenant) return <div className="text-center py-20 text-gray-500">Tenant not found</div>

  const tenancy = tenant.tenancy

  const handleTerminate = async () => {
    try {
      await terminate.mutateAsync(id)
      toast.success('Tenancy terminated')
      navigate('/tenants')
    } catch {
      toast.error('Failed to terminate tenancy')
    }
  }

  const invoiceCols = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(v) },
    { key: 'dueDate', label: 'Due Date', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (invId, row) => (
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${invId}`) }} className="text-xs text-brand hover:underline">View</button>
          {(row.status === 'SENT' || row.status === 'OVERDUE') && (
            <button
              onClick={async (e) => { e.stopPropagation(); await sendReminder.mutateAsync(invId); toast.success('Reminder sent!') }}
              className="text-xs text-orange-500 hover:underline"
            >
              Remind
            </button>
          )}
        </div>
      ),
    },
  ]

  const paymentCols = [
    { key: 'receiptNumber', label: 'Receipt #', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(v) },
    { key: 'method', label: 'Method', render: (v) => v?.replace(/_/g, ' ') },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'paidAt', label: 'Date', render: (v) => formatDate(v) },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/tenants')} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
        <StatusBadge status={tenancy?.status || 'ACTIVE'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Profile card */}
        <div className="card flex flex-col items-center text-center py-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white text-2xl font-bold mb-3">
            {getInitials(tenant.name)}
          </div>
          <h2 className="font-semibold text-gray-900 text-lg">{tenant.name}</h2>
          {tenant.email && (
            <a href={`mailto:${tenant.email}`} className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand">
              <Mail className="h-3.5 w-3.5" /> {tenant.email}
            </a>
          )}
          {tenant.phone && (
            <a href={`tel:${tenant.phone}`} className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand">
              <Phone className="h-3.5 w-3.5" /> {tenant.phone}
            </a>
          )}
        </div>

        {/* Tenancy info */}
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold text-gray-900 mb-4">Tenancy Details</h3>
          {tenancy ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Unit</p>
                <div className="flex items-center gap-1.5 mt-0.5 font-medium">
                  <Home className="h-3.5 w-3.5 text-gray-400" />
                  {tenancy.unit?.unitNumber} — {tenancy.property?.name}
                </div>
              </div>
              <div>
                <p className="text-gray-500">Rent Amount</p>
                <p className="font-semibold text-brand mt-0.5">{formatCurrency(tenancy.rentAmount)}</p>
              </div>
              <div>
                <p className="text-gray-500">Move-in Date</p>
                <p className="font-medium mt-0.5">{formatDate(tenancy.startDate)}</p>
              </div>
              <div>
                <p className="text-gray-500">Payment Period</p>
                <p className="font-medium mt-0.5">{tenancy.paymentPeriod}</p>
              </div>
              <div>
                <p className="text-gray-500">Deposit</p>
                <p className="font-medium mt-0.5">{formatCurrency(tenancy.depositAmount)}</p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <div className="mt-0.5"><StatusBadge status={tenancy.status} /></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No active tenancy</p>
          )}
        </div>

        {/* Actions */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 mb-2">Actions</h3>
          <button onClick={() => setShowInvoice(true)} className="btn-primary w-full flex items-center justify-center gap-2">
            <FileText className="h-4 w-4" /> Generate Invoice
          </button>
          <button onClick={() => setShowPayment(true)} className="btn-secondary w-full flex items-center justify-center gap-2">
            <CreditCard className="h-4 w-4" /> Record Payment
          </button>
          <button onClick={async () => {
            const overdue = invoices.find((i) => i.status === 'OVERDUE' || i.status === 'SENT')
            if (overdue) { await sendReminder.mutateAsync(overdue.id); toast.success('Reminder sent!') }
            else toast.error('No outstanding invoice to remind about')
          }} className="btn-secondary w-full flex items-center justify-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50">
            <Send className="h-4 w-4" /> Send Reminder
          </button>
          {tenancy?.status === 'ACTIVE' && (
            <button onClick={() => setShowTerminate(true)} className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-600 py-2">
              <Trash2 className="h-4 w-4" /> Terminate Tenancy
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="card">
          <p className="text-sm text-gray-500">{tenancy?.notes || 'No additional notes for this tenancy.'}</p>
        </div>
      )}
      {activeTab === 'Invoices' && (
        <DataTable columns={invoiceCols} data={invoices} loading={invLoading} emptyMessage="No invoices for this tenant" />
      )}
      {activeTab === 'Payments' && (
        <DataTable columns={paymentCols} data={payments} loading={payLoading} emptyMessage="No payments recorded" />
      )}

      <Modal isOpen={showInvoice} onClose={() => setShowInvoice(false)} title="Generate Invoice" size="lg">
        <GenerateInvoiceForm defaultTenantId={id} onClose={() => setShowInvoice(false)} />
      </Modal>
      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title="Record Payment" size="md">
        <RecordPaymentForm defaultTenantId={id} onClose={() => setShowPayment(false)} />
      </Modal>
      <ConfirmDialog
        isOpen={showTerminate}
        onClose={() => setShowTerminate(false)}
        onConfirm={handleTerminate}
        title="Terminate Tenancy"
        message={`Are you sure you want to terminate ${tenant.name}'s tenancy? This will mark the unit as vacant and cannot be undone.`}
        confirmLabel="Terminate"
        isDangerous
        isLoading={terminate.isPending}
      />
    </div>
  )
}
