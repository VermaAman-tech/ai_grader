'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const INSTITUTIONS = [
  'IIT Delhi',
  'IIT Bombay',
  'IISc Bangalore',
  'Other',
] as const

const ROLES = [
  { value: 'pi', label: 'PI' },
  { value: 'phd', label: 'PhD Student' },
  { value: 'masters', label: 'Masters' },
  { value: 'undergrad', label: 'Undergrad' },
] as const

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [labName, setLabName] = useState('')
  const [institution, setInstitution] = useState<(typeof INSTITUTIONS)[number]>('IIT Delhi')
  const [role, setRole] = useState<(typeof ROLES)[number]['value']>('phd')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      const ok = await register(fullName.trim(), email.trim(), password)
      if (ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Could not create account. This email may already be registered.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-950">
      <div
        className="pointer-events-none absolute -left-40 top-1/4 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl animate-float"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-[22rem] w-[22rem] rounded-full bg-brand-600/15 blur-3xl animate-float"
        style={{ animationDelay: '1.5s' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-1/4 top-12 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl animate-pulse-slow"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 py-10 sm:p-6">
        <div
          className="w-full max-w-lg animate-in rounded-2xl border border-surface-700/50 bg-surface-900/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10"
        >
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="gradient-text">ResearchOS</span>
            </h1>
            <p className="mt-2 text-sm text-surface-400">Create your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="register-name" className="mb-1.5 block text-sm font-medium text-surface-300">
                Full name
              </label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Priya Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="register-email" className="mb-1.5 block text-sm font-medium text-surface-300">
                Email
              </label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@institute.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
                disabled={submitting}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium text-surface-300">
                  Password
                </label>
                <input
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </div>
              <div>
                <label
                  htmlFor="register-confirm"
                  className="mb-1.5 block text-sm font-medium text-surface-300"
                >
                  Confirm password
                </label>
                <input
                  id="register-confirm"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-lab" className="mb-1.5 block text-sm font-medium text-surface-300">
                Lab name <span className="font-normal text-surface-500">(optional)</span>
              </label>
              <input
                id="register-lab"
                name="labName"
                type="text"
                placeholder="e.g. HCI Lab"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="input-field"
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="register-institution" className="mb-1.5 block text-sm font-medium text-surface-300">
                Institution
              </label>
              <select
                id="register-institution"
                name="institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value as (typeof INSTITUTIONS)[number])}
                className="input-field cursor-pointer appearance-none bg-surface-900"
                disabled={submitting}
              >
                {INSTITUTIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-surface-300">Role</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    disabled={submitting}
                    className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition-all sm:text-sm ${
                      role === r.value
                        ? 'border-brand-500 bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/40'
                        : 'border-surface-700 bg-surface-900/50 text-surface-400 hover:border-surface-600 hover:text-surface-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-2 w-full py-3 font-semibold"
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg
                    className="h-5 w-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating account…
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-surface-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-400 transition-colors hover:text-brand-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
