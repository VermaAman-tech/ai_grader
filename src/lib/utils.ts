import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getHealthColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

export function getHealthBg(score: number): string {
  if (score >= 80) return 'bg-emerald-400/10 border-emerald-400/20'
  if (score >= 60) return 'bg-yellow-400/10 border-yellow-400/20'
  if (score >= 40) return 'bg-orange-400/10 border-orange-400/20'
  return 'bg-red-400/10 border-red-400/20'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'ideation': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'active': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'under-review': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'published': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'archived': 'bg-surface-500/10 text-surface-400 border-surface-500/20',
    'planned': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'running': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'failed': 'bg-red-500/10 text-red-400 border-red-500/20',
    'abandoned': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    'promising': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'parking-lot': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
    'exploring': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'validated': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'submitted': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'under-review-pub': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'accepted': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'rejected-pub': 'bg-red-500/10 text-red-400 border-red-500/20',
  }
  return colors[status] || 'bg-surface-500/10 text-surface-400 border-surface-500/20'
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}
