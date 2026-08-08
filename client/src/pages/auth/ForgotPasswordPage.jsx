import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { forgotPassword } from '../../services/auth.service'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your email')
      return
    }
    setLoading(true)
    try {
      await forgotPassword(email)
      // Always show the same success state, whether or not the email is
      // registered — the API responds identically either way so this page
      // can't be used to check which emails exist.
      setSent(true)
    } catch {
      // Even on an unexpected error, don't reveal anything about the
      // email — just let them retry.
      setSent(true)
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
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
              <p className="mt-2 text-sm text-gray-500">
                If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It's valid for 1 hour.
              </p>
              <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-brand font-medium hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900">Forgot your password?</h1>
              <p className="mt-1 text-sm text-gray-500">Enter your email and we'll send you a link to reset it.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label className="label">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-9"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center text-center py-2.5">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-brand">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
