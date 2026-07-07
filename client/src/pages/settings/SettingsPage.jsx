import { useState } from 'react'
import { Building2, CreditCard, Bell, AlertTriangle, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

function Toggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-brand' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

const TABS = [
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
]

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: 'UGX 0',
    period: '/month',
    features: ['1 property', 'Basic rent tracking', 'Basic reminders', 'Up to 5 tenants'],
    badge: null,
  },
  {
    id: 'STANDARD',
    name: 'Standard',
    price: 'UGX 50,000',
    period: '/month',
    features: ['Up to 10 properties', 'Full features', 'Monthly reports', 'PDF receipts', 'Email & SMS reminders', 'Priority support'],
    badge: 'Popular',
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    price: 'UGX 150,000',
    period: '/month',
    features: ['Unlimited properties', 'Advanced analytics', 'Multi-manager access', 'API access', 'Custom branding', 'Priority support'],
    badge: null,
  },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('organization')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsReminders: true,
    rentReminderDays: 3,
    overdueNotices: true,
    paymentConfirmation: true,
    monthlyReports: true,
  })

  const currentPlan = user?.organization?.plan || 'FREE'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account and organization settings" />

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === id
                ? id === 'danger' ? 'border-red-500 text-red-600' : 'border-brand text-brand'
                : id === 'danger' ? 'border-transparent text-gray-500 hover:text-red-500' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'organization' && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Organization Details</h2>
          <p className="text-sm text-gray-500 mb-6">
            Organization settings are managed by your account administrator. Contact{' '}
            <a href="mailto:hello@rentflow.ug" className="text-brand hover:underline">hello@rentflow.ug</a>{' '}
            to update your organization details.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Organization Name', value: user?.organization?.name },
              { label: 'Type', value: user?.organization?.type },
              { label: 'Registration Number', value: user?.organization?.registrationNumber || '—' },
              { label: 'Email', value: user?.organization?.email || user?.email },
              { label: 'Phone', value: user?.organization?.phone || '—' },
              { label: 'Country', value: user?.organization?.country || 'UG' },
              { label: 'Currency', value: user?.organization?.currency || 'UGX' },
              { label: 'Plan', value: user?.organization?.plan || 'FREE' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => toast('Contact hello@rentflow.ug to update organization details.')} className="btn-secondary">
              Request Changes
            </button>
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Current Plan</h2>
                <p className="text-sm text-gray-500 mt-1">You are on the <span className="font-semibold text-brand">{currentPlan}</span> plan.</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${currentPlan === 'PREMIUM' ? 'bg-purple-100 text-purple-700' : currentPlan === 'STANDARD' ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-600'}`}>
                {currentPlan}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id
              return (
                <div key={plan.id} className={`card relative flex flex-col ${isCurrent ? 'ring-2 ring-brand' : ''}`}>
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs px-3 py-0.5 rounded-full font-semibold">
                      {plan.badge}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute top-3 right-3 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-1 mb-4">
                    <span className="text-2xl font-black text-brand">{plan.price}</span>
                    <span className="text-gray-500 text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => { if (!isCurrent) toast(`To ${plan.id === 'FREE' ? 'downgrade' : 'upgrade'} to ${plan.name}, contact hello@rentflow.ug`) }}
                    disabled={isCurrent}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${isCurrent ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-primary'}`}
                  >
                    {isCurrent ? 'Current Plan' : plan.id === 'FREE' ? 'Downgrade' : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Notification Preferences</h2>
          {[
            { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive all notifications via email' },
            { key: 'smsReminders', label: 'SMS Reminders', desc: 'Send rent reminders via SMS to tenants' },
            { key: 'overdueNotices', label: 'Overdue Demand Notices', desc: 'Auto-send demand notices for overdue invoices' },
            { key: 'paymentConfirmation', label: 'Payment Confirmation', desc: 'Send receipt to tenant on payment' },
            { key: 'monthlyReports', label: 'Monthly Reports', desc: 'Email monthly financial summary on the 1st of each month' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <Toggle enabled={notifications[key]} onChange={(val) => setNotifications((n) => ({ ...n, [key]: val }))} />
            </div>
          ))}
          <div className="flex items-center gap-4 py-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Rent Reminder — Days Before Due</p>
              <p className="text-xs text-gray-400">Send reminder this many days before rent is due</p>
            </div>
            <input
              type="number" min={1} max={14}
              value={notifications.rentReminderDays}
              onChange={(e) => setNotifications((n) => ({ ...n, rentReminderDays: parseInt(e.target.value) || 3 }))}
              className="input w-20 text-center"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => toast.success('Notification preferences saved')} className="btn-primary">
              Save Notification Settings
            </button>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="card border-2 border-red-200">
          <h2 className="text-base font-semibold text-red-600 mb-1">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-6">Actions here are irreversible. Proceed with caution.</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-gray-800">Export All Data</p>
                <p className="text-xs text-gray-500">Download all your properties, tenants, and financial data.</p>
              </div>
              <button onClick={() => toast('Data export requested. You will receive an email within 24 hours.')} className="btn-secondary text-sm whitespace-nowrap ml-4">
                Export Data
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-red-700">Delete Account</p>
                <p className="text-xs text-gray-500">Permanently delete your account and all associated data.</p>
              </div>
              <button onClick={() => setDeleteOpen(true)} className="btn-danger text-sm whitespace-nowrap ml-4">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); toast('Please contact support at hello@rentflow.ug to delete your account.') }}
        title="Delete Account"
        message="This action cannot be undone. All your properties, tenants, invoices, and data will be permanently deleted. Are you sure?"
        confirmLabel="Yes, Delete Account"
        isDangerous
      />
    </div>
  )
}
