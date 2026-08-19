import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { verifyInvitation, acceptInvitation } from '../../services/invitation.service'
import { useAuth } from '../../context/AuthContext'

const ROLE_LABELS = {
  ADMIN: 'Admin',
  PROPERTY_MANAGER: 'Property Manager',
  LANDLORD: 'Landlord',
  ACCOUNTANT: 'Accountant',
}

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [checking, setChecking] = useState(true)
  const [invite, setInvite] = useState(null)
  const [verifyError, setVerifyError] = useState('')

  const [form, setForm] = useState({ name: '', password: '', confirmPassword: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setVerifyError('This invite link is missing its token.')
      setChecking(false)
      return
    }
    verifyInvitation(token)
      .then((res) => setInvite(res.data))
      .catch((err) => setVerifyError(err.response?.data?.message || 'This invitation link is invalid or has expired.'))
      .finally(() => setChecking(false))
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Please enter your name')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await acceptInvitation({ token, name: form.name, password: form.password })
      localStorage.setItem('rentflow_token', res.data.token)
      await login(invite.email, form.password)
      toast.success(`Welcome to ${invite.organizationName}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="text-3xl">🏠</span>
          <span className="text-2xl font-bold text-brand">RentFlow</span>
        </div>

        <div className="card">
          {checking ? (
            <p className="text-sm text-gray-500 text-center py-8">Checking your invitation…</p>
          ) : verifyError ? (
            <>
              <h1 className="text-xl font-bold text-gray-900">Invitation not available</h1>
              <p className="mt-2 text-sm text-red-600">{verifyError}</p>
              <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-brand">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900">Join {invite.organizationName}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {invite.invitedByName} invited you to join as <span className="font-medium text-gray-700">{ROLE_LABELS[invite.role] || invite.role}</span>.
                Set your name and password to accept.
              </p>
              <p className="mt-2 text-xs text-gray-400">Signing up as {invite.email}</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label className="label">Your name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="input pl-9"
                      placeholder="Jane Nakato"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      className="input pl-9 pr-10"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      className="input pl-9"
                      placeholder="Repeat your password"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center text-center py-2.5">
                  {loading ? 'Joining…' : `Join ${invite.organizationName}`}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
