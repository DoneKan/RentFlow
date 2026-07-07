import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Send, X, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { useInvoice, useSendInvoice, useSendReminder, useCancelInvoice } from '../../hooks/useInvoices'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import RecordPaymentForm from '../../components/forms/RecordPaymentForm'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showPayment, setShowPayment] = useState(false)
  const { data: invoice, isLoading } = useInvoice(id)
  const sendInvoice = useSendInvoice()
  const sendReminder = useSendReminder()
  const cancelInvoice = useCancelInvoice()

  if (isLoading) return <LoadingSpinner fullPage />
  if (!invoice) return <div className="text-center py-20 text-gray-500">Invoice not found</div>

  const items = Array.isArray(invoice.items) ? invoice.items : []

  const handleSend = async () => {
    try { await sendInvoice.mutateAsync(id); toast.success('Invoice sent!') }
    catch { toast.error('Failed to send') }
  }
  const handleRemind = async () => {
    try { await sendReminder.mutateAsync(id); toast.success('Reminder sent!') }
    catch { toast.error('Failed to send reminder') }
  }
  const handleCancel = async () => {
    if (!window.confirm('Cancel this invoice?')) return
    try { await cancelInvoice.mutateAsync(id); toast.success('Cancelled'); navigate('/invoices') }
    catch { toast.error('Failed to cancel') }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/invoices')} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice document */}
        <div className="lg:col-span-2">
          <div className="card relative overflow-hidden">
            {invoice.status === 'PAID' && (
              <div className="absolute top-6 right-6 rotate-12 text-green-500 border-4 border-green-500 rounded px-3 py-1 text-3xl font-black opacity-20 select-none pointer-events-none">
                PAID
              </div>
            )}

            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🏠</span>
                  <span className="text-xl font-bold text-brand">RentFlow</span>
                </div>
                <p className="text-sm text-gray-500">Property Management</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Invoice</p>
                <p className="text-lg font-mono font-bold text-gray-900">{invoice.invoiceNumber}</p>
                <p className="text-xs text-gray-500 mt-1">Issued: {formatDate(invoice.createdAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Billed To</p>
                <p className="font-semibold text-gray-900">{invoice.tenant?.name}</p>
                <p className="text-sm text-gray-500">{invoice.tenant?.email}</p>
                <p className="text-sm text-gray-500">{invoice.tenant?.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Property / Unit</p>
                <p className="font-semibold text-gray-900">{invoice.property?.name}</p>
                <p className="text-sm text-gray-500">Unit #{invoice.unit?.unitNumber}</p>
                <p className="text-sm text-gray-500">{invoice.property?.address}</p>
              </div>
            </div>

            <table className="w-full mb-6">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2">Description</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase py-2">Amount (UGX)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 text-sm text-gray-700">{item.description}</td>
                    <td className="py-3 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="py-3 font-bold text-gray-900">Total</td>
                  <td className="py-3 font-bold text-right text-brand text-lg">{formatCurrency(invoice.amount)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded-xl p-4">
              <div>
                <p className="text-gray-500">Due Date</p>
                <p className="font-semibold text-gray-900">{formatDate(invoice.dueDate)}</p>
              </div>
              {invoice.latePenalty > 0 && (
                <div>
                  <p className="text-gray-500">Late Penalty</p>
                  <p className="font-semibold text-red-500">{formatCurrency(invoice.latePenalty)}</p>
                </div>
              )}
              {invoice.sentAt && (
                <div>
                  <p className="text-gray-500">Sent At</p>
                  <p className="font-medium">{formatDateTime(invoice.sentAt)}</p>
                </div>
              )}
              {invoice.paidAt && (
                <div>
                  <p className="text-gray-500">Paid At</p>
                  <p className="font-medium text-green-600">{formatDateTime(invoice.paidAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payments */}
          {invoice.payments?.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Payments</h3>
              <div className="space-y-2">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{p.receiptNumber}</p>
                      <p className="text-xs text-gray-500">{p.method?.replace(/_/g, ' ')} · {formatDate(p.paidAt)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                    <span className="font-semibold text-sm">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900">Actions</h3>
            {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
              <button onClick={() => setShowPayment(true)} className="btn-primary w-full flex items-center justify-center gap-2">
                <CreditCard className="h-4 w-4" /> Record Payment
              </button>
            )}
            {invoice.status === 'DRAFT' && (
              <button onClick={handleSend} disabled={sendInvoice.isPending} className="btn-secondary w-full flex items-center justify-center gap-2">
                <Send className="h-4 w-4" /> {sendInvoice.isPending ? 'Sending…' : 'Send Invoice'}
              </button>
            )}
            {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
              <button onClick={handleRemind} disabled={sendReminder.isPending} className="btn-secondary w-full flex items-center justify-center gap-2 text-orange-600 border-orange-200">
                <Send className="h-4 w-4" /> Send Reminder
              </button>
            )}
            {!['CANCELLED', 'PAID'].includes(invoice.status) && (
              <button onClick={handleCancel} className="w-full text-sm text-red-500 hover:text-red-600 py-2 flex items-center justify-center gap-1">
                <X className="h-4 w-4" /> Cancel Invoice
              </button>
            )}
          </div>

          <div className="card text-sm space-y-2">
            <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">{formatCurrency(invoice.amount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><StatusBadge status={invoice.status} /></div>
            <div className="flex justify-between"><span className="text-gray-500">Due</span><span>{formatDate(invoice.dueDate)}</span></div>
          </div>
        </div>
      </div>

      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title="Record Payment" size="md">
        <RecordPaymentForm defaultInvoiceId={id} defaultTenantId={invoice.tenantId} onClose={() => setShowPayment(false)} />
      </Modal>
    </div>
  )
}
