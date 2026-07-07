import { useState } from 'react'
import { Eye, EyeOff, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { useMutation } from '@tanstack/react-query'
import PageHeader from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { updateMe, changePassword } from '../../services/auth.service'
import { getInitials } from '../../utils/formatters'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const profileMutation = useMutation({
    mutationFn: () => updateMe({ name, phone }),
    onSuccess: (res) => {
      updateUser(res.data)
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const passwordMutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update password'),
  })

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (newPassword.length < 8) return toast.error('New password must be at least 8 characters')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')
    passwordMutation.mutate()
  }

  const ROLE_LABELS = { ADMIN: 'Administrator', PROPERTY_MANAGER: 'Property Manager', LANDLORD: 'Landlord', TENANT: 'Tenant', SUPER_ADMIN: 'Super Admin' }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="My Profile" subtitle="Manage your personal information and security" />

      {/* Profile card */}
      <div className="card">
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold">
              {getInitials(user?.name)}
            </div>
            <button
              onClick={() => toast('Photo upload coming soon', { icon: '📷' })}
              className="absolute -bottom-1 -right-1 h-7 w-7 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50"
            >
              <Camera className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); profileMutation.mutate() }} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input value={user?.email} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">Contact support to change your email address</p>
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+256 700 000 000" />
          </div>
          <div>
            <label className="label">Organization</label>
            <input value={user?.organization?.name || '—'} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <button type="submit" disabled={profileMutation.isPending} className="btn-primary">
            {profileMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password card */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Change Password</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {[
            { label: 'Current Password', value: currentPassword, setValue: setCurrentPassword, show: showCurrent, toggleShow: () => setShowCurrent(v => !v) },
            { label: 'New Password', value: newPassword, setValue: setNewPassword, show: showNew, toggleShow: () => setShowNew(v => !v) },
            { label: 'Confirm New Password', value: confirmPassword, setValue: setConfirmPassword, show: showConfirm, toggleShow: () => setShowConfirm(v => !v) },
          ].map(({ label, value, setValue, show, toggleShow }) => (
            <div key={label}>
              <label className="label">{label}</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="input pr-10"
                  required
                />
                <button type="button" onClick={toggleShow} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          <button type="submit" disabled={passwordMutation.isPending} className="btn-primary">
            {passwordMutation.isPending ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
