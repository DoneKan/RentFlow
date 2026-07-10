import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please enter your email and password')
      return
    }
    setLoading(true)
    try {
      const userData = await login(form.email, form.password)
      navigate(userData.role === 'TENANT' ? '/portal' : '/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand px-12 py-10">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏠</span>
            <span className="text-3xl font-bold text-white">RentFlow</span>
          </div>
          <p className="mt-2 text-white/60 text-sm">Property Management</p>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-tight">
            Manage your properties<br />the smart way
          </h2>
          <p className="mt-4 text-white/60 text-base max-w-sm">
            Automated invoicing, mobile money payments, expense tracking, and monthly reports — all in one place.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {[
              '✓  MTN & Airtel Mobile Money integration',
              '✓  Auto-generated invoices & receipts',
              '✓  KCCA & URA expense tracking',
              '✓  Monthly financial reports',
            ].map((f) => (
              <p key={f} className="text-white/70 text-sm">{f}</p>
            ))}
          </div>
        </div>
        <p className="text-white/40 text-xs">Built for Uganda. Ready for East Africa.</p>
      </div>

      {/* Right login form */}
      <div className="flex flex-1 items-center justify-center px-4 sm:px-8 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="text-3xl">🏠</span>
            <span className="text-2xl font-bold text-brand">RentFlow</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your RentFlow account</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  className="input pl-9"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Password</label>
                <button type="button" className="text-xs text-brand hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  className="input pl-9 pr-10"
                  placeholder="Your password"
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

            <div className="flex items-center gap-2">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                checked={form.remember}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 select-none">
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center text-center py-2.5"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand font-medium hover:underline">
              Create one free
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-gray-400">
            Demo: admin@rentflow.ug / Admin@1234
          </p>
        </div>
      </div>
    </div>
  )
}
