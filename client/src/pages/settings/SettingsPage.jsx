import { useState } from 'react'
import { Building2, CreditCard, Bell, AlertTriangle, Check, TrendingUp, Users, Send, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import StatusBadge from '../../components/ui/StatusBadge'
import api from '../../services/api'
import { useTeam, useUpdateTeamMember } from '../../hooks/useTeam'
import { useInvitations, useCreateInvitation, useRevokeInvitation } from '../../hooks/useInvitations'
import { formatDate } from '../../utils/formatters'

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

const BASE_TABS = [
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
]

const TEAM_TAB = { id: 'team', label: 'Team', icon: Users }

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PROPERTY_MANAGER: 'Property Manager',
  LANDLORD: 'Landlord',
  ACCOUNTANT: 'Accountant',
}

const INVITABLE_ROLES = ['ADMIN', 'PROPERTY_MANAGER', 'LANDLORD', 'ACCOUNTANT']

const PLANS = [
  {
    id: 'FREE',
    name: 'Starter',
    price: 'Free',
    period: '',
    unitLimit: 5,
    features: ['1 property', 'Up to 5 units', 'Rent tracking & invoicing', 'Tenant portal', 'Basic reports'],
    badge: null,
    color: 'gray',
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    price: '$20',
    period: '/month',
    unitLimit: 30,
    features: ['Up to 10 properties', 'Up to 30 units', 'Full invoicing & payments', 'Maintenance requests', 'Monthly reports & CSV export', 'Email reminders'],
    badge: 'Popular',
    color: 'brand',
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: '$49',
    period: '/month',
    unitLimit: 100,
    features: ['Up to 50 properties', 'Up to 100 units', 'All Growth features', 'Advanced analytics', 'Multi-manager access', 'PDF receipts', 'Priority support'],
    badge: null,
    color: 'purple',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: '$109',
    period: '/month',
    unitLimit: Infinity,
    features: ['Unlimited properties', 'Unlimited units', 'All Business features', 'Custom branding', 'Dedicated account manager', 'SLA guarantee', 'API access'],
    badge: null,
    color: 'indigo',
  },
]

function UsageBar({ label, used, limit }) {
  const pct = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-medium">{used} / {limit === Infinity ? '∞' : limit}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: limit === Infinity ? '10%' : `${pct}%` }} />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const isAdminTier = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const TABS = isAdminTier ? [...BASE_TABS.slice(0, 1), TEAM_TAB, ...BASE_TABS.slice(1)] : BASE_TABS
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

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('PROPERTY_MANAGER')
  const [revokeTarget, setRevokeTarget] = useState(null)

  const { data: subData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/reports/subscription'),
    select: (r) => r.data?.data,
    enabled: activeTab === 'subscription',
    refetchOnMount: 'always',
  })

  const { data: team, isLoading: teamLoading } = useTeam()
  const { data: invitations, isLoading: invitationsLoading } = useInvitations()
  const createInvitation = useCreateInvitation()
  const revokeInvitation = useRevokeInvitation()
  const updateTeamMember = useUpdateTeamMember()

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) { toast.error('Enter an email address'); return }
    try {
      await createInvitation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole })
      toast.success(`Invitation sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invitation')
    }
  }

  const handleRevoke = async () => {
    try {
      await revokeInvitation.mutateAsync(revokeTarget.id)
      toast.success('Invitation revoked')
    } catch {
      toast.error('Failed to revoke invitation')
    }
    setRevokeTarget(null)
  }

  const handleRoleChange = async (member, role) => {
    try {
      await updateTeamMember.mutateAsync({ id: member.id, data: { role } })
      toast.success(`${member.name}'s role updated`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role')
    }
  }

  const handleToggleActive = async (member) => {
    try {
      await updateTeamMember.mutateAsync({ id: member.id, data: { isActive: !member.isActive } })
      toast.success(member.isActive ? `${member.name} deactivated` : `${member.name} reactivated`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update member')
    }
  }

  const currentPlanId = subData?.plan || user?.organization?.plan || 'FREE'
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) || PLANS[0]

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
              { label: 'Currency', value: user?.organization?.currency || 'USD' },
              { label: 'Plan', value: currentPlan.name },
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
          {/* Current usage */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Current Plan</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  You are on the <span className="font-semibold text-brand">{currentPlan.name}</span> plan.
                  {subData?.planExpiresAt && (
                    <span className="ml-1 text-gray-400">Renews {new Date(subData.planExpiresAt).toLocaleDateString('en-UG')}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand" />
                <span className="text-2xl font-black text-brand">{currentPlan.price}</span>
                <span className="text-gray-400 text-sm">/mo</span>
              </div>
            </div>
            {subData?.usage && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <UsageBar label="Units" used={subData.usage.units} limit={subData.usage.unitLimit} />
                <UsageBar label="Properties" used={subData.usage.properties} limit={subData.usage.propertyLimit} />
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Active Tenancies</span>
                    <span className="font-medium">{subData.usage.activeTenancies}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full" />
                </div>
              </div>
            )}
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = currentPlanId === plan.id || (currentPlanId === 'STARTER' && plan.id === 'FREE')
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
                  <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-1 mb-3">
                    <span className="text-xl font-black text-brand">{plan.price}</span>
                    <span className="text-gray-500 text-xs">{plan.period}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    {plan.unitLimit === Infinity ? 'Unlimited units' : `Up to ${plan.unitLimit} units`}
                  </p>
                  <ul className="space-y-1.5 flex-1 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => { if (!isCurrent) toast(`To upgrade to ${plan.name}, contact hello@rentflow.ug or call +256 700 000 000`) }}
                    disabled={isCurrent}
                    className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${isCurrent ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-primary'}`}
                  >
                    {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              )
            })}
          </div>

          <p className="text-center text-xs text-gray-400">
            To upgrade or downgrade your plan, contact{' '}
            <a href="mailto:hello@rentflow.ug" className="text-brand hover:underline">hello@rentflow.ug</a>.
            {' '}Plans are billed monthly in USD.
          </p>
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

      {activeTab === 'team' && isAdminTier && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Invite a Team Member</h2>
            <p className="text-sm text-gray-500 mb-4">
              They'll get an email with a link to set their own password and join {user?.organization?.name}.
            </p>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="input flex-1"
                placeholder="colleague@email.com"
                required
              />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="input sm:w-52">
                {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button type="submit" disabled={createInvitation.isPending} className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap">
                <Send className="h-4 w-4" /> {createInvitation.isPending ? 'Sending…' : 'Send Invite'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Team Members</h2>
            {teamLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : !team?.length ? (
              <p className="text-sm text-gray-400">No team members yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {team.map((member) => (
                  <div key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {member.name}
                        {member.id === user?.id && <span className="ml-2 text-xs text-brand font-normal">(You)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{member.email}</p>
                    </div>
                    {member.role === 'SUPER_ADMIN' || member.id === user?.id ? (
                      <span className="text-xs font-medium text-gray-500 px-2.5 py-1.5">{ROLE_LABELS[member.role] || member.role}</span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value)}
                        className="input py-1.5 text-xs sm:w-44"
                      >
                        {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-center ${member.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {member.isActive ? 'Active' : 'Deactivated'}
                    </span>
                    {member.id === user?.id ? (
                      <span className="text-xs text-gray-300 w-20 text-right">—</span>
                    ) : (
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`text-xs font-medium hover:underline w-20 text-right ${member.isActive ? 'text-red-500' : 'text-green-600'}`}
                      >
                        {member.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Pending & Past Invitations</h2>
            {invitationsLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : !invitations?.length ? (
              <p className="text-sm text-gray-400">No invitations sent yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        {ROLE_LABELS[inv.role] || inv.role} · Invited by {inv.invitedBy?.name} · {formatDate(inv.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={inv.status} />
                    {inv.status === 'PENDING' && (
                      <button
                        onClick={() => setRevokeTarget(inv)}
                        className="text-xs text-red-500 hover:underline flex items-center gap-1 w-20 justify-end"
                      >
                        <Trash2 className="h-3 w-3" /> Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke Invitation"
        message={`Are you sure you want to revoke the invitation sent to ${revokeTarget?.email}? The link they were emailed will stop working.`}
        confirmLabel="Revoke"
        isDangerous
        isLoading={revokeInvitation.isPending}
      />

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
