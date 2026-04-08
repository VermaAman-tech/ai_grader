'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  ArrowUpDown,
  Calendar,
  Target,
  Users as UsersIcon,
  X,
  Check,
  ChevronDown,
} from 'lucide-react'
import { projects, users, getUserById } from '@/lib/mock-data'
import { getStatusColor, getHealthColor, getInitials, cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types'

type SortKey = 'health' | 'deadline' | 'name'

const STATUS_TABS: { label: string; value: ProjectStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Ideation', value: 'ideation' },
  { label: 'Under Review', value: 'under-review' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

function getDaysLeft(deadline?: string): number | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function getHealthBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 60) return 'bg-yellow-400'
  if (score >= 40) return 'bg-orange-400'
  return 'bg-red-400'
}

export default function ProjectsPage() {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('health')
  const [showModal, setShowModal] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDomainInput, setNewDomainInput] = useState('')
  const [newDomains, setNewDomains] = useState<string[]>([])
  const [newVenue, setNewVenue] = useState('')
  const [newTeam, setNewTeam] = useState<string[]>([])
  const [newDeadline, setNewDeadline] = useState('')
  const [newStatus, setNewStatus] = useState<ProjectStatus>('ideation')

  const filtered = useMemo(() => {
    let list = [...projects]

    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status === statusFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => p.title.toLowerCase().includes(q))
    }

    list.sort((a, b) => {
      if (sortBy === 'health') return b.healthScore - a.healthScore
      if (sortBy === 'name') return a.title.localeCompare(b.title)
      if (sortBy === 'deadline') {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
        return da - db
      }
      return 0
    })

    return list
  }, [statusFilter, searchQuery, sortBy])

  function handleAddDomain(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && newDomainInput.trim()) {
      e.preventDefault()
      if (!newDomains.includes(newDomainInput.trim())) {
        setNewDomains([...newDomains, newDomainInput.trim()])
      }
      setNewDomainInput('')
    }
  }

  function handleCreate() {
    setShowModal(false)
    setNewTitle('')
    setNewDesc('')
    setNewDomains([])
    setNewDomainInput('')
    setNewVenue('')
    setNewTeam([])
    setNewDeadline('')
    setNewStatus('ideation')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-surface-100">Projects</h1>
          <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-sm font-medium text-brand-400">
            {projects.length}
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-10 pr-3 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-64"
            />
          </label>

          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="appearance-none rounded-lg border border-surface-700 bg-surface-900 py-2 pl-10 pr-8 text-sm text-surface-100 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="health">Health Score</option>
              <option value="deadline">Deadline</option>
              <option value="name">Name</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
          </div>
        </div>
      </div>

      {/* Project Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-12 text-center">
          <p className="text-surface-400">No projects match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filtered.map((project) => {
            const completedMilestones = project.milestones.filter((m) => m.completed).length
            const totalMilestones = project.milestones.length
            const daysLeft = getDaysLeft(project.deadline)
            const team = project.teamMemberIds.map((id) => getUserById(id)).filter(Boolean)

            return (
              <div
                key={project.id}
                className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 card-hover"
              >
                {/* Title & Status */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="text-lg font-semibold text-surface-100 hover:text-brand-400 transition-colors line-clamp-1"
                  >
                    {project.title}
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                      getStatusColor(project.status),
                    )}
                  >
                    {project.status.replace('-', ' ')}
                  </span>
                </div>

                {/* Description */}
                <p className="mb-4 text-sm leading-relaxed text-surface-400 line-clamp-2">
                  {project.description}
                </p>

                {/* Health Score */}
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-xs font-medium text-surface-500">Health</span>
                  <div className="flex-1 h-1.5 rounded-full bg-surface-800">
                    <div
                      className={cn('h-full rounded-full transition-all', getHealthBarColor(project.healthScore))}
                      style={{ width: `${project.healthScore}%` }}
                    />
                  </div>
                  <span className={cn('text-sm font-semibold', getHealthColor(project.healthScore))}>
                    {project.healthScore}
                  </span>
                </div>

                {/* Domain tags */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {project.domain.map((d) => (
                    <span
                      key={d}
                      className="rounded-full bg-surface-800 px-2 py-0.5 text-xs text-surface-300"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Target Venue */}
                {project.targetVenue && (
                  <div className="mb-3 flex items-center gap-2 text-sm text-surface-400">
                    <Target className="h-3.5 w-3.5 text-brand-400" />
                    <span>{project.targetVenue}</span>
                  </div>
                )}

                {/* Footer: Team, Deadline, Milestones */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-y-2 border-t border-surface-700/50 pt-4">
                  {/* Team Avatars */}
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {team.slice(0, 4).map((u) => (
                        <div
                          key={u!.id}
                          title={u!.name}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-900 bg-brand-500/20 text-[10px] font-semibold text-brand-300"
                        >
                          {getInitials(u!.name)}
                        </div>
                      ))}
                      {team.length > 4 && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-900 bg-surface-800 text-[10px] font-medium text-surface-400">
                          +{team.length - 4}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Deadline */}
                  {project.deadline && (
                    <div className="flex items-center gap-1.5 text-xs text-surface-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {daysLeft !== null && daysLeft > 0 ? (
                        <span>{daysLeft} days left</span>
                      ) : daysLeft !== null && daysLeft <= 0 ? (
                        <span className="text-red-400">Overdue</span>
                      ) : null}
                    </div>
                  )}

                  {/* Milestones */}
                  <div className="flex items-center gap-1.5 text-xs text-surface-400">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>
                      {completedMilestones}/{totalMilestones} completed
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-surface-700/50 bg-surface-900 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-100">New Project</h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-300">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Project title"
                  className="input-field"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-300">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description of the project..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              {/* Domain Tags */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-300">
                  Domain Tags
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {newDomains.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-400"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => setNewDomains(newDomains.filter((x) => x !== d))}
                        className="hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  onKeyDown={handleAddDomain}
                  placeholder="Type a domain and press Enter"
                  className="input-field"
                />
              </div>

              {/* Target Venue */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-300">Target Venue</label>
                <input
                  type="text"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  placeholder="e.g. CVPR 2026, NeurIPS 2025"
                  className="input-field"
                />
              </div>

              {/* Team Members */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-300">
                  <UsersIcon className="mr-1.5 inline h-4 w-4" />
                  Team Members
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-surface-700 bg-surface-900 p-3">
                  {users.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm text-surface-300 hover:bg-surface-800"
                    >
                      <input
                        type="checkbox"
                        checked={newTeam.includes(u.id)}
                        onChange={(e) =>
                          setNewTeam(
                            e.target.checked
                              ? [...newTeam, u.id]
                              : newTeam.filter((x) => x !== u.id),
                          )
                        }
                        className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500/30"
                      />
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-[9px] font-semibold text-brand-300">
                        {getInitials(u.name)}
                      </div>
                      <span className="truncate">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Deadline & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-300">Deadline</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-300">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ProjectStatus)}
                    className="input-field appearance-none"
                  >
                    <option value="ideation">Ideation</option>
                    <option value="active">Active</option>
                    <option value="under-review">Under Review</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-surface-700/50 pt-5">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleCreate} className="btn-primary inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
