import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useInvoices, useSendInvoice, useSendReminder, useCancelInvoice } from '../../hooks/useInvoices'
import { formatCurrency, formatDate } from '../../utils/formatters'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import GenerateInvoiceForm from '../../components/forms/GenerateInvoiceForm'
import EmptyState from '../../components/ui/EmptyState'

const STATUS_TABS = ['All', 'Draft', 'Sent', 'Paid', 'Overdue']

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [showGenerate, setShowGenerate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All')

  const statusParam = statusFilter === 'All' ? undefined : statusFilter.toUpperCase()
  const { data, isLoading } = useInvoices(statusParam ? { status: statusParam } : undefined)
  const sendInvoice = useSendInvoice()
  const sendReminder = useSendReminder()
  const cancelInvoice = useCancelInvoice()

  const invoices = data?.invoices || []

  const handleSend = async (id, e) => {
    e.stopPropagation()
    try { await sendInvoice.mutateAsync(id); toast.success('Invoice sent!') }
    catch { toast.error('Failed to send invoice') }
  }
  const handleRemind = async (id, e) => {
    e.stopPropagation()
    try { await sendReminder.mutateAsync(id); toast.success('Reminder sent!') }
    catch { toast.error('Failed to send reminder') }
  }
  const handleCancel = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Cancel this invoice?')) return
    try { await cancelInvoice.mutateAsync(id); toast.success('Invoice cancelled') }
    catch { toast.error('Failed to cancel') }
  }

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (v) => <span className="font-mono text-xs font-medium">{v}</span> },
    { key: 'tenant', label: 'Tenant', render: (t) => <span className="font-medium">{t?.name || '—'}</span> },
    { key: 'unit', label: 'Property / Unit', render: (u, row) => <span className="text-gray-600">{row.property?.name} · #{u?.unitNumber}</span> },
    { key: 'amount', label: 'Amount', render: (v) => <span className="font-semibold">{formatCurrency(v)}</span> },
    { key: 'dueDate', label: 'Due Date', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'id', label: 'Actions',
      render: (id, row) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'DRAFT' && <button onClick={(e) => handleSend(id, e)} className="text-xs text-brand hover:underline">Send</button>}
          {(row.status === 'SENT' || row.status === 'OVERDUE') && <button onClick={(e) => handleRemind(id, e)} className="text-xs text-orange-500 hover:underline">Remind</button>}
          {!['CANCELLED', 'PAID'].includes(row.status) && <button onClick={(e) => handleCancel(id, e)} className="text-xs text-red-400 hover:underline">Cancel</button>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
        actions={[
          <button key="gen" onClick={() => setShowGenerate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Generate Invoice
          </button>,
        ]}
      />
      <div className="flex gap-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button key={tab} onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${statusFilter === tab ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {tab}
          </button>
        ))}
      </div>
      {!isLoading && invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Generate your first invoice for a tenant." action={{ label: 'Generate Invoice', onClick: () => setShowGenerate(true) }} />
      ) : (
        <DataTable columns={columns} data={invoices} loading={isLoading} emptyMessage="No invoices found" onRowClick={(row) => navigate(`/invoices/${row.id}`)} />
      )}
      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Invoice" size="lg">
        <GenerateInvoiceForm onClose={() => setShowGenerate(false)} />
      </Modal>
    </div>
  )
}
