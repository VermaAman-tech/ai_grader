'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ChevronRight } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { email: 'priya@iitd.ac.in', name: 'Dr. Priya Sharma', role: 'PI (Lab Head)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { email: 'arjun@iitd.ac.in', name: 'Arjun Mehta', role: 'PhD Student', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { email: 'sneha@iitd.ac.in', name: 'Sneha Iyer', role: 'PhD Student', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { email: 'rahul@iitd.ac.in', name: 'Rahul Verma', role: 'PhD Student', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { email: 'kavya@iitd.ac.in', name: 'Kavya Nair', role: 'Masters', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { email: 'vikram@iitd.ac.in', name: 'Vikram Singh', role: 'Masters', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { email: 'ananya@iitd.ac.in', name: 'Ananya Gupta', role: 'Undergrad', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { email: 'ravi@iitd.ac.in', name: 'Dr. Ravi Kumar', role: 'Visiting Researcher', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { email: 'meera@iitd.ac.in', name: 'Meera Patel', role: 'PhD Student', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { email: 'aditya@iitd.ac.in', name: 'Aditya Rao', role: 'PhD Student', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
]

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const ok = await login(email.trim(), password)
      if (ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Invalid email or password. Try one of the demo accounts below.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function quickLogin(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('demo123')
    setError(null)
    setSubmitting(true)
    try {
      const ok = await login(demoEmail, 'demo123')
      if (ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Login failed. Please try again.')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-950">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl animate-float"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-600/15 blur-3xl animate-float"
        style={{ animationDelay: '2s' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl animate-pulse-slow"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg animate-in space-y-6">
          <div
            className="rounded-2xl border border-surface-700/50 bg-surface-900/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10"
          >
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="gradient-text">ResearchOS</span>
              </h1>
              <p className="mt-2 text-sm text-surface-400">
                Sign in to your research workspace
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-surface-300">
                  Email
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="priya@iitd.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-surface-300">
                  Password
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="demo123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  required
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 font-semibold"
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-surface-400">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-medium text-brand-400 transition-colors hover:text-brand-300">
                Register
              </Link>
            </p>
          </div>

          {/* Demo Accounts Panel */}
          <div className="rounded-2xl border border-surface-700/50 bg-surface-900/80 backdrop-blur-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAccounts(!showAccounts)}
              className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-surface-800/50"
            >
              <div>
                <p className="text-sm font-semibold text-surface-200">Demo Accounts</p>
                <p className="text-xs text-surface-500">Click any account to sign in instantly — password: demo123</p>
              </div>
              <ChevronRight className={`h-5 w-5 text-surface-400 transition-transform ${showAccounts ? 'rotate-90' : ''}`} />
            </button>

            {showAccounts && (
              <div className="border-t border-surface-800 px-4 py-3 space-y-1.5 max-h-[400px] overflow-y-auto">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => quickLogin(account.email)}
                    disabled={submitting}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-surface-800 disabled:opacity-50"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${account.color}`}>
                      {account.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-100">{account.name}</p>
                      <p className="truncate text-xs text-surface-500">{account.email}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${account.color}`}>
                      {account.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
