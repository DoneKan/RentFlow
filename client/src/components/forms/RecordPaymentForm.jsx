import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useRecordPayment } from '../../hooks/usePayments'
import { getTenants } from '../../services/tenant.service'
import { getInvoices } from '../../services/invoice.service'
import { PAYMENT_METHODS } from '../../utils/constants'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function RecordPaymentForm({ onClose, defaultTenantId, defaultInvoiceId }) {
  const record = useRecordPayment()
  const [form, setForm] = useState({
    tenantId: defaultTenantId || '',
    invoiceId: defaultInvoiceId || '',
    amount: '',
    method: 'CASH',
    mobileNumber: '',
    transactionReference: '',
    notes: '',
    paidAt: new Date().toISOString().split('T')[0],
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants'],
    queryFn: getTenants,
    select: (r) => r.data?.data || [],
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices', { tenantId: form.tenantId, status: 'SENT,OVERDUE' }],
    queryFn: () => getInvoices({ tenantId: form.tenantId }),
    select: (r) => r.data?.data?.filter((i) => ['SENT', 'OVERDUE'].includes(i.status)) || [],
    enabled: !!form.tenantId,
  })

  const selectedInvoice = invoicesData?.find((i) => i.id === form.invoiceId)

  const handleTenantChange = (e) => {
    set('tenantId', e.target.value)
    set('invoiceId', '')
    set('amount', '')
  }

  const handleInvoiceChange = (e) => {
    const inv = invoicesData?.find((i) => i.id === e.target.value)
    set('invoiceId', e.target.value)
    if (inv) set('amount', inv.amount)
  }

  const isMobile = form.method === 'MTN_MOMO' || form.method === 'AIRTEL_MONEY'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.invoiceId) { toast.error('Please select an invoice'); return }
    if (!form.amount) { toast.error('Amount is required'); return }
    try {
      await record.mutateAsync({
        ...form,
        amount: parseFloat(form.amount),
        mobileNumber: isMobile ? form.mobileNumber : undefined,
      })
      toast.success('Payment recorded successfully!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Tenant *</label>
        <select value={form.tenantId} onChange={handleTenantChange} className="input" required>
          <option value="">Select tenant…</option>
          {(tenantsData || []).map((t) => (
            <option key={t.id} value={t.tenantId}>{t.tenant?.name} — {t.property?.name}</option>
          ))}
        </select>
      </div>

      {form.tenantId && (
        <div>
          <label className="label">Invoice *</label>
          {!invoicesData?.length ? (
            <p className="text-sm text-gray-400 py-1">No outstanding invoices for this tenant</p>
          ) : (
            <select value={form.invoiceId} onChange={handleInvoiceChange} className="input" required>
              <option value="">Select invoice…</option>
              {invoicesData.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {formatCurrency(inv.amount)} (due {formatDate(inv.dueDate)})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label className="label">Amount (UGX) *</label>
        <input
          type="number"
          value={form.amount}
          onChange={(e) => set('amount', e.target.value)}
          className="input"
          placeholder={selectedInvoice ? `Invoice: ${formatCurrency(selectedInvoice.amount)}` : '0'}
          required
        />
      </div>

      <div>
        <label className="label">Payment method *</label>
        <select value={form.method} onChange={(e) => set('method', e.target.value)} className="input">
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {isMobile && (
        <div>
          <label className="label">Mobile number *</label>
          <input
            value={form.mobileNumber}
            onChange={(e) => set('mobileNumber', e.target.value)}
            className="input"
            placeholder="0700000000"
            required
          />
        </div>
      )}

      <div>
        <label className="label">Transaction reference</label>
        <input value={form.transactionReference} onChange={(e) => set('transactionReference', e.target.value)} className="input" placeholder="e.g. MTN ref / bank slip number" />
      </div>

      <div>
        <label className="label">Payment date</label>
        <input type="date" value={form.paidAt} onChange={(e) => set('paidAt', e.target.value)} className="input" />
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input h-16 resize-none" placeholder="Any additional notes…" />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={record.isPending} className="btn-primary flex-1">
          {record.isPending ? 'Processing…' : 'Record Payment'}
        </button>
      </div>
    </form>
  )
}
