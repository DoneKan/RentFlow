import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useRecordPayment, useInitiateMTN, useInitiateAirtel } from '../../hooks/usePayments'
import { getTenants } from '../../services/tenant.service'
import { getInvoices } from '../../services/invoice.service'
import { PAYMENT_METHODS } from '../../utils/constants'
import { formatCurrency, formatDate } from '../../utils/formatters'
import NumberInput from '../ui/NumberInput'

export default function RecordPaymentForm({ onClose, defaultTenancyId, defaultInvoiceId }) {
  const record = useRecordPayment()
  const initiateMtn = useInitiateMTN()
  const initiateAirtel = useInitiateAirtel()
  const [form, setForm] = useState({
    tenancyId: defaultTenancyId || '',
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
    select: (r) => r.data || [],
  })

  const { data: invoicesData } = useQuery({
    // Scoped by tenancyId, not the tenant's login (tenantId) — a login can be
    // shared across multiple tenancies, and filtering by it would pull in
    // invoices belonging to a different tenancy on the same shared account.
    queryKey: ['invoices', { tenancyId: form.tenancyId, status: 'SENT,OVERDUE' }],
    queryFn: () => getInvoices({ tenancyId: form.tenancyId }),
    select: (r) => (r.data || []).filter((i) => ['SENT', 'OVERDUE'].includes(i.status)),
    enabled: !!form.tenancyId,
  })

  const selectedInvoice = invoicesData?.find((i) => i.id === form.invoiceId)

  const handleTenantChange = (e) => {
    set('tenancyId', e.target.value)
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
    if (isMobile && !form.mobileNumber) { toast.error('Mobile number is required'); return }

    try {
      if (form.method === 'MTN_MOMO') {
        const res = await initiateMtn.mutateAsync({ invoiceId: form.invoiceId, mobileNumber: form.mobileNumber })
        toast.success(res.message || 'MTN Mobile Money payment initiated — awaiting approval')
      } else if (form.method === 'AIRTEL_MONEY') {
        const res = await initiateAirtel.mutateAsync({ invoiceId: form.invoiceId, mobileNumber: form.mobileNumber })
        toast.success(res.message || 'Airtel Money payment initiated — awaiting approval')
      } else {
        await record.mutateAsync({
          invoiceId: form.invoiceId,
          amount: parseFloat(form.amount),
          method: form.method,
          notes: form.transactionReference ? `Ref: ${form.transactionReference}. ${form.notes}` : form.notes,
          paidAt: form.paidAt,
        })
        toast.success('Payment recorded successfully!')
      }
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment')
    }
  }

  const submitting = record.isPending || initiateMtn.isPending || initiateAirtel.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Tenant *</label>
        <select value={form.tenancyId} onChange={handleTenantChange} className="input" required>
          <option value="">Select tenant…</option>
          {(tenantsData || []).map((t) => (
            <option key={t.id} value={t.id}>{t.tenant?.name} — {t.property?.name} Unit {t.unit?.unitNumber}</option>
          ))}
        </select>
      </div>

      {form.tenancyId && (
        <div>
          <label className="label">Invoice *</label>
          {!invoicesData?.length ? (
            <p className="text-sm text-gray-400 py-1">No outstanding invoices for this tenant</p>
          ) : (
            <select value={form.invoiceId} onChange={handleInvoiceChange} className="input" required>
              <option value="">Select invoice…</option>
              {invoicesData.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {formatCurrency(inv.amount, inv.currency)} (due {formatDate(inv.dueDate)})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label className="label">Amount *</label>
        <NumberInput
          value={form.amount}
          onChange={(v) => set('amount', v)}
          placeholder={selectedInvoice ? `Invoice: ${formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}` : '0'}
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
        <button type="submit" disabled={submitting} className="btn-primary flex-1">
          {submitting ? 'Processing…' : isMobile ? 'Initiate Payment' : 'Record Payment'}
        </button>
      </div>
    </form>
  )
}
