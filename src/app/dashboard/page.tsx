'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import {
  BookOpen,
  Brain,
  FlaskConical,
  FolderKanban,
  Lightbulb,
  Plus,
  Quote,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useDataStore } from '@/contexts/DataStore'
import { getUserById } from '@/lib/mock-data'
import {
  cn,
  formatDate,
  formatRelativeTime,
  generateId,
  getHealthColor,
  getInitials,
  getStatusColor,
} from '@/lib/utils'
import type { Experiment, ProjectStatus } from '@/types'

function todayLocalIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatStatusLabel(status: string): string {
  return status
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function parseRunningProgress(exp: Experiment): { percent: number; label: string } | null {
  const m = exp.notes.match(/(?:at\s+)?epoch\s+(\d+)\s*\/\s*(\d+)/i)
  if (m) {
    const cur = Number(m[1])
    const total = Number(m[2])
    if (total > 0) {
      return {
        percent: Math.round((cur / total) * 100),
        label: `${cur} / ${total}`,
      }
    }
  }
  return null
}

function daysUntilDeadline(deadline: string): number {
  const end = new Date(deadline)
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - start.getTime()) / 86400000)
}

function healthBarBgClass(score: number): string {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 60) return 'bg-yellow-400'
  if (score >= 40) return 'bg-orange-400'
  return 'bg-red-400'
}

function HealthRing({ score }: { score: number }) {
  const radius = 52
  const stroke = 8
  const c = 2 * Math.PI * radius
  const pct = Math.min(100, Math.max(0, score))
  const offset = c - (pct / 100) * c

  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg
        className="h-full w-full -rotate-90 text-surface-200 dark:text-surface-800"
        viewBox="0 0 120 120"
        aria-hidden
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
        />
      </svg>
      <svg
        className={cn(
          'absolute inset-0 h-full w-full -rotate-90',
          getHealthColor(score),
        )}
        viewBox="0 0 120 120"
        aria-hidden
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
          stroke="currentColor"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-surface-900 dark:text-surface-100">{score}%</span>
        <span className="text-xs text-surface-500">Avg health</span>
      </div>
    </div>
  )
}

const cardClass =
  'bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 backdrop-blur-sm shadow-sm dark:shadow-none'

export default function DashboardOverviewPage() {
  const { user } = useAuth()
  const { projects, experiments, activities, addProject, addIdea } = useDataStore()

  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewIdea, setShowNewIdea] = useState(false)
  const [npTitle, setNpTitle] = useState('')
  const [npDesc, setNpDesc] = useState('')
  const [npStatus, setNpStatus] = useState<ProjectStatus>('ideation')
  const [niTitle, setNiTitle] = useState('')
  const [niHypothesis, setNiHypothesis] = useState('')

  const stats = useMemo(() => {
    const totalProjects = projects.length
    const runningExperiments = experiments.filter((e) => e.status === 'running').length
    const totalPapers = 15
    const totalCitations = 171
    const avgHealthScore = projects.length
      ? Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / projects.length)
      : 0
    return { totalProjects, runningExperiments, totalPapers, totalCitations, avgHealthScore }
  }, [projects, experiments])

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active'),
    [projects],
  )
  const recentActivities = useMemo(() => activities.slice(0, 10), [activities])
  const runningExps = useMemo(
    () => experiments.filter((e) => e.status === 'running'),
    [experiments],
  )
  const deadlineProjects = useMemo(() => {
    const withDeadline = projects.filter((p) => p.deadline)
    return [...withDeadline].sort((a, b) => {
      const da = daysUntilDeadline(a.deadline!)
      const db = daysUntilDeadline(b.deadline!)
      const aFuture = da >= 0
      const bFuture = db >= 0
      if (aFuture && bFuture) return da - db
      if (aFuture && !bFuture) return -1
      if (!aFuture && bFuture) return 1
      return db - da
    })
  }, [projects])

  const displayName = user?.name ?? 'Dr. Priya Sharma'

  function handleQuickProject() {
    if (!npTitle.trim()) return
    addProject({
      title: npTitle.trim(),
      description: npDesc.trim(),
      domain: [],
      targetVenue: '',
      piId: user?.id ?? 'u1',
      teamMemberIds: [user?.id ?? 'u1'],
      status: npStatus,
      healthScore: 50,
      createdAt: new Date().toISOString(),
      milestones: [],
      labId: 'lab1',
    })
    setNpTitle('')
    setNpDesc('')
    setNpStatus('ideation')
    setShowNewProject(false)
  }

  function handleQuickIdea() {
    if (!niTitle.trim()) return
    addIdea({
      title: niTitle.trim(),
      hypothesis: niHypothesis.trim(),
      motivation: '',
      priorArt: [],
      method: '',
      expectedContribution: '',
      riskAssessment: '',
      status: 'exploring',
      votes: 0,
      createdBy: user?.id ?? 'u1',
      projectId: projects[0]?.id ?? '',
      linkedPaperIds: [],
      comments: [],
      createdAt: new Date().toISOString(),
    })
    setNiTitle('')
    setNiHypothesis('')
    setShowNewIdea(false)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-50 md:text-3xl">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">{formatDate(todayLocalIso())}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewProject(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
          <button
            onClick={() => setShowNewIdea(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 shadow-sm transition-colors hover:bg-surface-50 dark:hover:bg-surface-700"
          >
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            New Idea
          </button>
        </div>
      </header>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Lab statistics"
      >
        {[
          { value: stats.totalProjects, label: 'Total Projects', icon: FolderKanban },
          { value: stats.runningExperiments, label: 'Active Experiments', icon: FlaskConical },
          { value: stats.totalPapers, label: 'Papers in Library', icon: BookOpen },
          { value: stats.totalCitations, label: 'Total Citations', icon: Quote },
        ].map((stat) => (
          <div key={stat.label} className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-bold text-surface-900 dark:text-surface-50">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{stat.label}</p>
              </div>
              <stat.icon className="h-8 w-8 shrink-0 text-brand-500 dark:text-brand-400" aria-hidden />
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section aria-labelledby="active-projects-heading">
            <h2
              id="active-projects-heading"
              className="mb-4 text-lg font-semibold text-surface-800 dark:text-surface-100"
            >
              Active Projects
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {activeProjects.map((project) => {
                const daysLeft = project.deadline
                  ? daysUntilDeadline(project.deadline)
                  : null
                return (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className={cn(
                      cardClass,
                      'block transition-colors hover:border-brand-500/30 hover:bg-surface-50 dark:hover:bg-surface-900',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 font-medium leading-snug text-surface-800 dark:text-surface-100">
                        {project.title}
                      </h3>
                      <span
                        className={cn(
                          'shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium',
                          getStatusColor(project.status),
                        )}
                      >
                        {formatStatusLabel(project.status)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-surface-500">
                        <span>Health</span>
                        <span className={getHealthColor(project.healthScore)}>
                          {project.healthScore}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            healthBarBgClass(project.healthScore),
                          )}
                          style={{ width: `${project.healthScore}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="flex -space-x-2">
                        {project.teamMemberIds.map((uid) => {
                          const member = getUserById(uid)
                          const label = member
                            ? getInitials(member.name)
                            : '?'
                          return (
                            <span
                              key={uid}
                              title={member?.name}
                              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white dark:border-surface-900 bg-brand-100 dark:bg-brand-500/20 text-xs font-semibold text-brand-600 dark:text-brand-300"
                            >
                              {label}
                            </span>
                          )
                        })}
                      </div>
                      <div className="min-w-0 flex-1 text-xs text-surface-500 dark:text-surface-400">
                        <p className="truncate">
                          <span className="text-surface-400 dark:text-surface-500">Venue </span>
                          {project.targetVenue}
                        </p>
                        {project.deadline && (
                          <p className="mt-0.5 text-surface-500">
                            {daysLeft !== null && daysLeft >= 0 && (
                              <>
                                Deadline in{' '}
                                <span className="font-medium text-surface-700 dark:text-surface-300">
                                  {daysLeft} day{daysLeft === 1 ? '' : 's'}
                                </span>
                              </>
                            )}
                            {daysLeft !== null && daysLeft < 0 && (
                              <span className="font-medium text-orange-500 dark:text-orange-400">
                                {Math.abs(daysLeft)} day
                                {Math.abs(daysLeft) === 1 ? '' : 's'} overdue
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <section
            className={cn(cardClass)}
            aria-labelledby="activity-heading"
          >
            <h2
              id="activity-heading"
              className="mb-4 text-lg font-semibold text-surface-800 dark:text-surface-100"
            >
              Recent Activity
            </h2>
            <ul className="space-y-4">
              {recentActivities.map((act) => {
                const actor = getUserById(act.userId)
                const name = actor?.name ?? 'Someone'
                const initials = actor
                  ? getInitials(actor.name)
                  : '?'
                return (
                  <li key={act.id} className="flex gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20 text-xs font-semibold text-brand-600 dark:text-brand-300"
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-surface-600 dark:text-surface-200">
                        <span className="font-medium text-surface-900 dark:text-surface-100">
                          {name}
                        </span>{' '}
                        {act.action}{' '}
                        <span className="text-surface-700 dark:text-surface-300">{act.target}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-surface-400 dark:text-surface-500">
                        {formatRelativeTime(act.timestamp)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section
            className={cn(cardClass, 'flex flex-col items-center py-6')}
            aria-labelledby="health-heading"
          >
            <h2
              id="health-heading"
              className="mb-2 w-full text-center text-sm font-semibold text-surface-500 dark:text-surface-300"
            >
              Lab Health Score
            </h2>
            <HealthRing score={stats.avgHealthScore} />
          </section>

          <section className={cardClass} aria-labelledby="running-heading">
            <h2
              id="running-heading"
              className="mb-3 text-sm font-semibold text-surface-500 dark:text-surface-300"
            >
              Running Experiments
            </h2>
            <ul className="space-y-4">
              {runningExps.map((exp) => {
                const proj = projects.find((p) => p.id === exp.projectId)
                const progress = parseRunningProgress(exp)
                return (
                  <li key={exp.id} className="border-b border-surface-100 dark:border-surface-800/80 pb-4 last:border-0 last:pb-0">
                    <p className="font-medium leading-snug text-surface-800 dark:text-surface-100">
                      {exp.title}
                    </p>
                    <p className="mt-1 text-xs text-surface-400 dark:text-surface-500">
                      {proj?.title ?? 'Unknown project'}
                    </p>
                    {progress ? (
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-xs text-surface-500">
                          <span>Progress</span>
                          <span>{progress.label}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                          <div
                            className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs italic text-surface-400 dark:text-surface-500">
                        In progress
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className={cardClass} aria-labelledby="deadlines-heading">
            <h2
              id="deadlines-heading"
              className="mb-3 text-sm font-semibold text-surface-500 dark:text-surface-300"
            >
              Upcoming Deadlines
            </h2>
            <ul className="space-y-3">
              {deadlineProjects.map((p) => {
                const days = daysUntilDeadline(p.deadline!)
                return (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-2 text-sm"
                  >
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className="line-clamp-2 min-w-0 flex-1 text-surface-700 dark:text-surface-200 transition-colors hover:text-brand-500 dark:hover:text-brand-400"
                    >
                      {p.title}
                    </Link>
                    <span
                      className={cn(
                        'shrink-0 text-xs font-medium',
                        days < 0
                          ? 'text-orange-500 dark:text-orange-400'
                          : days <= 30
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-surface-400',
                      )}
                    >
                      {days >= 0
                        ? `${days}d`
                        : `${Math.abs(days)}d over`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section
            className={cn(
              cardClass,
              'border-brand-200 dark:border-brand-400/20 bg-gradient-to-br from-brand-50 dark:from-surface-900/90 to-brand-100/50 dark:to-brand-950/20',
            )}
            aria-labelledby="digest-heading"
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-500 dark:text-brand-400" aria-hidden />
              <h2
                id="digest-heading"
                className="text-sm font-semibold text-brand-600 dark:text-brand-300"
              >
                AI Weekly Digest
              </h2>
            </div>
            <p className="mb-3 text-xs font-medium text-surface-600 dark:text-surface-300">
              Lab Weekly Digest — {formatDate(todayLocalIso())}
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-surface-600 dark:text-surface-300 marker:text-brand-500 dark:marker:text-brand-400">
              <li>{experiments.filter((e) => e.status === 'completed').length} experiments completed</li>
              <li>{runningExps.length} experiments currently running</li>
              <li>{activeProjects.length} active projects in progress</li>
              <li>Team size: {10} members across all projects</li>
              {deadlineProjects[0] && (
                <li>Next deadline: {deadlineProjects[0].title.split(':')[0]} in {Math.max(0, daysUntilDeadline(deadlineProjects[0].deadline!))} days</li>
              )}
            </ul>
          </section>
        </aside>
      </div>

      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewProject(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">Quick New Project</h2>
              <button
                onClick={() => setShowNewProject(false)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Title</label>
                <input
                  type="text"
                  value={npTitle}
                  onChange={(e) => setNpTitle(e.target.value)}
                  placeholder="Project title"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
                <textarea
                  value={npDesc}
                  onChange={(e) => setNpDesc(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Status</label>
                <select
                  value={npStatus}
                  onChange={(e) => setNpStatus(e.target.value as ProjectStatus)}
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 appearance-none"
                >
                  <option value="ideation">Ideation</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowNewProject(false)}
                className="rounded-lg border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickProject}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewIdea(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">Quick New Idea</h2>
              <button
                onClick={() => setShowNewIdea(false)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Title</label>
                <input
                  type="text"
                  value={niTitle}
                  onChange={(e) => setNiTitle(e.target.value)}
                  placeholder="Idea title"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Hypothesis</label>
                <textarea
                  value={niHypothesis}
                  onChange={(e) => setNiHypothesis(e.target.value)}
                  placeholder="What do you think will happen?"
                  rows={3}
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowNewIdea(false)}
                className="rounded-lg border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickIdea}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                <Lightbulb className="h-4 w-4" />
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
