import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { COUNTRIES } from '../../utils/constants'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    organizationType: 'INDIVIDUAL',
    registrationNumber: '',
    country: 'UG',
    currency: 'UGX',
    terms: false,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleCountryChange = (e) => {
    const country = COUNTRIES.find((c) => c.value === e.target.value)
    setForm((p) => ({ ...p, country: e.target.value, currency: country?.currency || 'UGX' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (!form.terms) {
      toast.error('Please accept the terms and conditions')
      return
    }
    setLoading(true)
    try {
      const { register } = await import('../../services/auth.service')
      const res = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        organizationName: form.organizationName,
        organizationType: form.organizationType,
        registrationNumber: form.registrationNumber || undefined,
        country: form.country,
        currency: form.currency,
      })
      const { token } = res.data
      localStorage.setItem('rentflow_token', token)
      await login(form.email, form.password)
      toast.success('Welcome to RentFlow!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between bg-brand px-10 py-10">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏠</span>
            <span className="text-2xl font-bold text-white">RentFlow</span>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white leading-snug">
            Start managing your properties professionally
          </h2>
          <p className="mt-3 text-white/60 text-sm">
            Join hundreds of landlords and property managers in Uganda who use RentFlow.
          </p>
          <div className="mt-6 space-y-4">
            {[
              { emoji: '📱', text: 'MTN & Airtel Mobile Money' },
              { emoji: '📄', text: 'Automated invoices & PDF receipts' },
              { emoji: '📊', text: 'Monthly financial reports' },
              { emoji: '💬', text: 'SMS & email notifications' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-xl">{f.emoji}</span>
                <span className="text-white/70 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-xs">Built for Uganda. Ready for East Africa.</p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center px-4 sm:px-8 py-10 bg-gray-50 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <span className="text-2xl">🏠</span>
            <span className="text-xl font-bold text-brand">RentFlow</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">Free forever for 1 property</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full name</label>
                <input name="name" value={form.name} onChange={handleChange} className="input" placeholder="John Ssemanda" required />
              </div>
              <div>
                <label className="label">Phone number</label>
                <input name="phone" value={form.phone} onChange={handleChange} className="input" placeholder="+256 700 000 000" />
              </div>
            </div>

            <div>
              <label className="label">Email address</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="input" placeholder="you@company.com" required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    className="input pr-9"
                    placeholder="Min. 8 characters"
                    required
                  />
                  <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} className="input" placeholder="Repeat password" required />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Organisation</p>
              <div>
                <label className="label">Organisation / Business name</label>
                <input name="organizationName" value={form.organizationName} onChange={handleChange} className="input" placeholder="Kampala Properties Ltd" required />
              </div>

              <div className="mt-3">
                <label className="label">Organisation type</label>
                <div className="flex gap-4 mt-1">
                  {['INDIVIDUAL', 'COMPANY'].map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="organizationType"
                        value={t}
                        checked={form.organizationType === t}
                        onChange={handleChange}
                        className="text-brand focus:ring-brand"
                      />
                      <span className="text-sm text-gray-700">{t === 'INDIVIDUAL' ? 'Individual' : 'Company'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.organizationType === 'COMPANY' && (
                <div className="mt-3">
                  <label className="label">Company registration number <span className="text-gray-400">(optional)</span></label>
                  <input name="registrationNumber" value={form.registrationNumber} onChange={handleChange} className="input" placeholder="80000000000456" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label">Country</label>
                  <select name="country" value={form.country} onChange={handleCountryChange} className="input">
                    {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Currency</label>
                  <input name="currency" value={form.currency} readOnly className="input bg-gray-50 text-gray-500" />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input id="terms" name="terms" type="checkbox" checked={form.terms} onChange={handleChange} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
              <label htmlFor="terms" className="text-sm text-gray-600 leading-snug select-none">
                I agree to the <button type="button" className="text-brand hover:underline">Terms of Service</button> and <button type="button" className="text-brand hover:underline">Privacy Policy</button>
              </label>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-center">
              {loading ? 'Creating account…' : 'Create free account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
