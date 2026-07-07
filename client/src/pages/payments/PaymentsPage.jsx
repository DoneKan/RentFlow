import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, CreditCard, Smartphone, Banknote, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import RecordPaymentForm from '../../components/forms/RecordPaymentForm'
import { getPayments, downloadReceipt } from '../../services/payment.service'
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '../../utils/formatters'

const METHOD_ICONS = {
  MTN_MOMO: <Smartphone className="h-4 w-4 text-yellow-500" />,
  AIRTEL_MONEY: <Smartphone className="h-4 w-4 text-red-500" />,
  BANK_TRANSFER: <Banknote className="h-4 w-4 text-blue-500" />,
  CASH: <Wallet className="h-4 w-4 text-green-500" />,
}

export default function PaymentsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [downloading, setDownloading] = useState(null)

  const { data: paymentsRes, isLoading } = useQuery({
    queryKey: ['payments', methodFilter],
    queryFn: () => getPayments(methodFilter !== 'ALL' ? { method: methodFilter } : {}),
    select: (r) => r.data || [],
  })

  const payments = paymentsRes || []
  const completed = payments.filter((p) => p.status === 'COMPLETED')
  const totalCollected = completed.reduce((s, p) => s + Number(p.amount), 0)
  const mtnTotal = completed.filter((p) => p.method === 'MTN_MOMO').reduce((s, p) => s + Number(p.amount), 0)
  const pending = payments.filter((p) => p.status === 'PENDING').length

  const handleDownload = async (id, receiptNumber) => {
    setDownloading(id)
    try {
      const blob = await downloadReceipt(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${receiptNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download receipt')
    } finally {
      setDownloading(null)
    }
  }

  const columns = [
    { key: 'receiptNumber', label: 'Receipt #', render: (v) => <span className="font-mono text-sm font-medium">{v}</span> },
    { key: 'tenant', label: 'Tenant', render: (_, row) => row.tenant?.name || '—' },
    {
      key: 'property', label: 'Property / Unit',
      render: (_, row) => (
        <div className="text-sm">
          <p className="font-medium">{row.invoice?.property?.name || '—'}</p>
          <p className="text-gray-400">Unit {row.invoice?.unit?.unitNumber || '—'}</p>
        </div>
      ),
    },
    {
      key: 'amount', label: 'Amount',
      render: (v) => <span className="font-bold text-gray-900">{formatCurrency(v)}</span>,
    },
    {
      key: 'method', label: 'Method',
      render: (v) => (
        <div className="flex items-center gap-1.5">
          {METHOD_ICONS[v]}
          <span className="text-sm">{getPaymentMethodLabel(v)}</span>
        </div>
      ),
    },
    { key: 'paidAt', label: 'Date', render: (v) => formatDateTime(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <button
          onClick={() => handleDownload(row.id, row.receiptNumber)}
          disabled={downloading === row.id || row.status !== 'COMPLETED'}
          className="flex items-center gap-1.5 text-sm text-brand hover:underline disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          {downloading === row.id ? 'Downloading…' : 'Receipt'}
        </button>
      ),
    },
  ]

  const methods = ['ALL', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'CASH']
  const methodLabels = { ALL: 'All Methods', MTN_MOMO: 'MTN MoMo', AIRTEL_MONEY: 'Airtel Money', BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash' }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Payment history and receipts"
        actions={[
          <button key="add" onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Payment
          </button>,
        ]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Collected" value={formatCurrency(totalCollected)} icon={CreditCard} />
        <StatCard title="MTN MoMo" value={formatCurrency(mtnTotal)} icon={Smartphone} color="yellow" />
        <StatCard title="Transactions" value={completed.length} icon={Banknote} color="green" />
        <StatCard title="Pending" value={pending} icon={Wallet} color="orange" />
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-2 mb-4">
          {methods.map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                methodFilter === m ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {methodLabels[m]}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={payments}
          loading={isLoading}
          emptyMessage="No payments recorded yet"
          emptyIcon={CreditCard}
        />
      </div>

      <RecordPaymentForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['payments'] })
          queryClient.invalidateQueries({ queryKey: ['invoices'] })
          setShowForm(false)
        }}
      />
    </div>
  )
}
