import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useJournalEntries, useTrialBalance } from '../../hooks/useLedger'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const TABS = ['Journal Entries', 'Trial Balance']

function JournalEntriesTab() {
  const { user } = useAuth()
  const currency = user?.organization?.currency || 'UGX'
  const { data, isLoading } = useJournalEntries({ limit: 50 })
  const entries = data?.data || []

  if (isLoading) return <LoadingSpinner />
  if (entries.length === 0) return <p className="text-sm text-gray-400 text-center py-16">No journal entries yet. They post automatically when you record a payment or an expense.</p>

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-900">{entry.memo}</p>
            <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {entry.lines.map((line) => (
                <tr key={line.id} className="border-t border-gray-50">
                  <td className="py-1.5 text-gray-600">{line.account.code} — {line.account.name}</td>
                  <td className="py-1.5 text-right w-28">{Number(line.debit) > 0 ? formatCurrency(line.debit, currency) : ''}</td>
                  <td className="py-1.5 text-right w-28 text-gray-500">{Number(line.credit) > 0 ? formatCurrency(line.credit, currency) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function TrialBalanceTab() {
  const { user } = useAuth()
  const currency = user?.organization?.currency || 'UGX'
  const { data, isLoading } = useTrialBalance()

  if (isLoading) return <LoadingSpinner />
  if (!data || data.rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-16">No activity posted yet. The trial balance fills in as payments and expenses are recorded.</p>
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 ${data.isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        {data.isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {data.isBalanced ? 'Books are balanced — total debits equal total credits.' : 'Books are out of balance — this should not happen; check recent manual entries.'}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Account', 'Debit', 'Credit', 'Balance'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.rows.map((r) => (
              <tr key={r.account.id}>
                <td className="px-4 py-3 text-sm text-gray-700">{r.account.code} — {r.account.name}</td>
                <td className="px-4 py-3 text-sm">{formatCurrency(r.debit, currency)}</td>
                <td className="px-4 py-3 text-sm">{formatCurrency(r.credit, currency)}</td>
                <td className="px-4 py-3 text-sm font-medium">{formatCurrency(r.balance, currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(data.totals.debit, currency)}</td>
              <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(data.totals.credit, currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function GeneralLedgerPage() {
  const [activeTab, setActiveTab] = useState('Journal Entries')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">General Ledger</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cash-basis journal entries posted automatically from payments and expenses</p>
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

      {activeTab === 'Journal Entries' && <JournalEntriesTab />}
      {activeTab === 'Trial Balance' && <TrialBalanceTab />}
    </div>
  )
}
