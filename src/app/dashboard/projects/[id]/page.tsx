'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  FlaskConical,
  Lightbulb,
  BookOpen,
  Activity,
  LayoutDashboard,
  Milestone as MilestoneIcon,
  Target,
  ThumbsUp,
  FileText,
  Quote,
  X,
  Check,
  Users as UsersIcon,
  TrendingUp,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { useDataStore } from '@/contexts/DataStore'
import { getUserById, users } from '@/lib/mock-data'
import {
  getStatusColor,
  getHealthColor,
  getInitials,
  cn,
  formatDate,
  formatRelativeTime,
} from '@/lib/utils'
import type { ProjectStatus, Experiment, Idea, Paper } from '@/types'

type Tab = 'overview' | 'milestones' | 'experiments' | 'ideas' | 'papers' | 'activity'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'milestones', label: 'Milestones', icon: MilestoneIcon },
  { key: 'experiments', label: 'Experiments', icon: FlaskConical },
  { key: 'ideas', label: 'Ideas', icon: Lightbulb },
  { key: 'papers', label: 'Papers', icon: BookOpen },
  { key: 'activity', label: 'Activity', icon: Activity },
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

const inputClass =
  'w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const { projects, experiments: allExperiments, ideas: allIdeas, papers: allPapers, updateProject, activities } = useDataStore()

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showEditModal, setShowEditModal] = useState(false)

  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formVenue, setFormVenue] = useState('')
  const [formDomainInput, setFormDomainInput] = useState('')
  const [formDomains, setFormDomains] = useState<string[]>([])
  const [formTeam, setFormTeam] = useState<string[]>([])
  const [formDeadline, setFormDeadline] = useState('')
  const [formStatus, setFormStatus] = useState<ProjectStatus>('active')

  const experiments = useMemo(
    () => allExperiments.filter((e) => e.projectId === projectId),
    [allExperiments, projectId],
  )
  const ideas = useMemo(
    () => allIdeas.filter((i) => i.projectId === projectId),
    [allIdeas, projectId],
  )
  const papers = useMemo(
    () => allPapers.filter((p) => p.projectIds.includes(projectId)),
    [allPapers, projectId],
  )
  const team = useMemo(
    () => (project ? project.teamMemberIds.map((id) => getUserById(id)).filter(Boolean) : []),
    [project],
  )
  const projectActivities = useMemo(
    () =>
      activities.filter(
        (a) =>
          a.target.toLowerCase().includes(project?.title.split(':')[0].toLowerCase() ?? '---') ||
          a.targetType === 'project',
      ).slice(0, 15),
    [activities, project],
  )

  function openEdit() {
    if (!project) return
    setFormTitle(project.title)
    setFormDesc(project.description)
    setFormDomains([...project.domain])
    setFormVenue(project.targetVenue)
    setFormTeam([...project.teamMemberIds])
    setFormDeadline(project.deadline ?? '')
    setFormStatus(project.status)
    setShowEditModal(true)
  }

  function handleSave() {
    if (!formTitle.trim() || !project) return
    updateProject(project.id, {
      title: formTitle.trim(),
      description: formDesc.trim(),
      domain: formDomains,
      targetVenue: formVenue.trim(),
      teamMemberIds: formTeam,
      deadline: formDeadline || undefined,
      status: formStatus,
    })
    setShowEditModal(false)
  }

  function handleAddDomain(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && formDomainInput.trim()) {
      e.preventDefault()
      if (!formDomains.includes(formDomainInput.trim())) {
        setFormDomains([...formDomains, formDomainInput.trim()])
      }
      setFormDomainInput('')
    }
  }

  function toggleMilestone(milestoneId: string) {
    if (!project) return
    const updated = project.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m,
    )
    updateProject(project.id, { milestones: updated })
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
          <Sparkles className="h-8 w-8 text-surface-400 dark:text-surface-500" />
        </div>
        <p className="text-lg font-medium text-surface-600 dark:text-surface-400">Project not found.</p>
        <p className="mt-1 text-sm text-surface-400 dark:text-surface-500">
          The project you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/dashboard/projects"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
      </div>
    )
  }

  const pi = getUserById(project.piId)
  const daysLeft = getDaysLeft(project.deadline)
  const completedMilestones = project.milestones.filter((m) => m.completed).length
  const totalMilestones = project.milestones.length
  const milestonePercent = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Header card */}
      <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-6 shadow-sm dark:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                {project.title}
              </h1>
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                  getStatusColor(project.status),
                )}
              >
                {project.status.replace('-', ' ')}
              </span>
            </div>
            {project.targetVenue && (
              <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 mb-3">
                <Target className="h-4 w-4 text-brand-500 dark:text-brand-400" />
                <span>{project.targetVenue}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-surface-500 dark:text-surface-400">
              {project.deadline && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Due {formatDate(project.deadline)}</span>
                </div>
              )}
              {daysLeft !== null && (
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    daysLeft > 30
                      ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : daysLeft > 0
                        ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                        : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
                  )}
                >
                  {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full border-[3px]',
                  project.healthScore >= 80
                    ? 'border-emerald-400'
                    : project.healthScore >= 60
                      ? 'border-yellow-400'
                      : project.healthScore >= 40
                        ? 'border-orange-400'
                        : 'border-red-400',
                )}
              >
                <span className={cn('text-lg font-bold', getHealthColor(project.healthScore))}>
                  {project.healthScore}
                </span>
              </div>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-surface-400 dark:text-surface-500">
                Health
              </span>
            </div>

            <button
              onClick={openEdit}
              className="rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:border-brand-500/30 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
            >
              <Edit3 className="mr-1.5 inline h-4 w-4" />
              Edit
            </button>
          </div>
        </div>

        {/* Milestone progress bar */}
        {totalMilestones > 0 && (
          <div className="mt-4 border-t border-surface-100 dark:border-surface-700/50 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
                Milestones: {completedMilestones}/{totalMilestones}
              </span>
              <span className="text-xs font-semibold text-surface-600 dark:text-surface-300">
                {milestonePercent}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-100 dark:bg-surface-800">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  getHealthBarColor(milestonePercent),
                )}
                style={{ width: `${milestonePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Team */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-surface-100 dark:border-surface-700/50 pt-4">
          <span className="text-xs font-medium uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Team
          </span>
          {team.map((u) => (
            <div key={u!.id} className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20 text-[10px] font-semibold text-brand-600 dark:text-brand-300">
                {getInitials(u!.name)}
              </div>
              <span className="text-sm text-surface-600 dark:text-surface-300">{u!.name}</span>
              {u!.id === project.piId && (
                <span className="rounded bg-amber-100 dark:bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  PI
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-surface-200 dark:border-surface-800 pb-px">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === key
                ? 'border-brand-500 dark:border-brand-400 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === 'experiments' && experiments.length > 0 && (
              <span className="rounded-full bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 text-[10px] font-medium text-surface-500 dark:text-surface-400">
                {experiments.length}
              </span>
            )}
            {key === 'ideas' && ideas.length > 0 && (
              <span className="rounded-full bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 text-[10px] font-medium text-surface-500 dark:text-surface-400">
                {ideas.length}
              </span>
            )}
            {key === 'papers' && papers.length > 0 && (
              <span className="rounded-full bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 text-[10px] font-medium text-surface-500 dark:text-surface-400">
                {papers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab
            description={project.description}
            domains={project.domain}
            daysLeft={daysLeft}
            deadline={project.deadline}
            createdAt={project.createdAt}
            piName={pi?.name}
            healthScore={project.healthScore}
            experimentCount={experiments.length}
            paperCount={papers.length}
            ideaCount={ideas.length}
            runningExperiments={experiments.filter((e) => e.status === 'running').length}
          />
        )}
        {activeTab === 'milestones' && (
          <MilestonesTab milestones={project.milestones} onToggle={toggleMilestone} />
        )}
        {activeTab === 'experiments' && <ExperimentsTab experiments={experiments} projectId={projectId} />}
        {activeTab === 'ideas' && <IdeasTab ideas={ideas} />}
        {activeTab === 'papers' && <PapersTab papers={papers} />}
        {activeTab === 'activity' && <ActivityTab activities={projectActivities} />}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                Edit Project
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                  Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                  Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className={cn(inputClass, 'resize-none')}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                  Domain Tags
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formDomains.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-100 dark:bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-400"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => setFormDomains(formDomains.filter((x) => x !== d))}
                        className="hover:text-red-500 dark:hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={formDomainInput}
                  onChange={(e) => setFormDomainInput(e.target.value)}
                  onKeyDown={handleAddDomain}
                  placeholder="Type a domain and press Enter"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                  Target Venue
                </label>
                <input
                  type="text"
                  value={formVenue}
                  onChange={(e) => setFormVenue(e.target.value)}
                  placeholder="e.g. CVPR 2026"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                  <UsersIcon className="mr-1.5 inline h-4 w-4" />
                  Team Members
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 p-3">
                  {users.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
                    >
                      <input
                        type="checkbox"
                        checked={formTeam.includes(u.id)}
                        onChange={(e) =>
                          setFormTeam(
                            e.target.checked
                              ? [...formTeam, u.id]
                              : formTeam.filter((x) => x !== u.id),
                          )
                        }
                        className="rounded border-surface-400 dark:border-surface-600 bg-white dark:bg-surface-800 text-brand-500 focus:ring-brand-500/30"
                      />
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20 text-[9px] font-semibold text-brand-600 dark:text-brand-300">
                        {getInitials(u.name)}
                      </div>
                      <span className="truncate">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ProjectStatus)}
                    className={cn(inputClass, 'appearance-none')}
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

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-surface-200 dark:border-surface-700/50 pt-5">
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                <Check className="h-4 w-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Overview Tab ─── */

function OverviewTab({
  description,
  domains,
  daysLeft,
  deadline,
  createdAt,
  piName,
  healthScore,
  experimentCount,
  paperCount,
  ideaCount,
  runningExperiments,
}: {
  description: string
  domains: string[]
  daysLeft: number | null
  deadline?: string
  createdAt: string
  piName?: string
  healthScore: number
  experimentCount: number
  paperCount: number
  ideaCount: number
  runningExperiments: number
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 shadow-sm dark:shadow-none">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Description
          </h3>
          <p className="text-sm leading-relaxed text-surface-600 dark:text-surface-300">
            {description}
          </p>
        </div>

        <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 shadow-sm dark:shadow-none">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Domain Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {domains.map((d) => (
              <span
                key={d}
                className="rounded-full bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 px-3 py-1 text-sm font-medium text-brand-600 dark:text-brand-400"
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Health', value: healthScore, color: getHealthColor(healthScore), icon: TrendingUp },
            { label: 'Experiments', value: experimentCount, color: 'text-blue-500 dark:text-blue-400', icon: FlaskConical },
            { label: 'Papers', value: paperCount, color: 'text-purple-500 dark:text-purple-400', icon: BookOpen },
            { label: 'Ideas', value: ideaCount, color: 'text-amber-500 dark:text-amber-400', icon: Lightbulb },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-4 shadow-sm dark:shadow-none text-center"
            >
              <stat.icon className={cn('h-5 w-5 mx-auto mb-2', stat.color)} />
              <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
              <div className="text-xs text-surface-400 dark:text-surface-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 shadow-sm dark:shadow-none space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Details
          </h3>
          {piName && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">PI</span>
              <span className="font-medium text-surface-700 dark:text-surface-200">{piName}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-surface-500 dark:text-surface-400">Created</span>
            <span className="font-medium text-surface-700 dark:text-surface-200">
              {formatDate(createdAt)}
            </span>
          </div>
          {deadline && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">Deadline</span>
              <span className="font-medium text-surface-700 dark:text-surface-200">
                {formatDate(deadline)}
              </span>
            </div>
          )}
          {daysLeft !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">Time Left</span>
              <span
                className={cn(
                  'font-medium',
                  daysLeft > 30
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : daysLeft > 0
                      ? 'text-yellow-500 dark:text-yellow-400'
                      : 'text-red-500 dark:text-red-400',
                )}
              >
                {daysLeft > 0 ? `${daysLeft} days` : 'Overdue'}
              </span>
            </div>
          )}
          {runningExperiments > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">Running</span>
              <span className="font-medium text-blue-500 dark:text-blue-400">
                {runningExperiments} experiment{runningExperiments > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 shadow-sm dark:shadow-none space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Health Breakdown
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2.5 rounded-full bg-surface-100 dark:bg-surface-800">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', getHealthBarColor(healthScore))}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
            <span className={cn('text-lg font-bold tabular-nums', getHealthColor(healthScore))}>
              {healthScore}
            </span>
          </div>
          <p className="text-xs text-surface-400 dark:text-surface-500">
            {healthScore >= 80
              ? 'Excellent progress — on track for submission.'
              : healthScore >= 60
                ? 'Good progress with some areas needing attention.'
                : healthScore >= 40
                  ? 'Behind schedule — consider reallocating resources.'
                  : 'Critical — requires immediate intervention.'}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Milestones Tab ─── */

function MilestonesTab({
  milestones,
  onToggle,
}: {
  milestones: { id: string; title: string; date: string; completed: boolean }[]
  onToggle: (id: string) => void
}) {
  const sorted = [...milestones].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 p-12 text-center shadow-sm dark:shadow-none">
        <MilestoneIcon className="mx-auto mb-3 h-8 w-8 text-surface-300 dark:text-surface-600" />
        <p className="text-surface-500 dark:text-surface-400">No milestones defined yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-6 shadow-sm dark:shadow-none">
      <div className="relative">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-surface-200 dark:bg-surface-700" />

        <div className="space-y-6">
          {sorted.map((m) => (
            <div key={m.id} className="relative flex gap-4 group">
              <button
                onClick={() => onToggle(m.id)}
                className="relative z-10 shrink-0 mt-0.5 transition-transform hover:scale-110"
                title={m.completed ? 'Mark as pending' : 'Mark as completed'}
              >
                {m.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
                ) : (
                  <Circle className="h-6 w-6 text-surface-300 dark:text-surface-600 group-hover:text-brand-400 transition-colors" />
                )}
              </button>

              <div className="flex-1 pb-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      'font-medium transition-colors',
                      m.completed
                        ? 'text-surface-700 dark:text-surface-200'
                        : 'text-surface-500 dark:text-surface-400',
                    )}
                  >
                    {m.title}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs font-medium',
                      m.completed
                        ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 text-surface-500 dark:text-surface-400',
                    )}
                  >
                    {m.completed ? 'Completed' : 'Pending'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-surface-400 dark:text-surface-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(m.date)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Experiments Tab ─── */

function ExperimentsTab({ experiments, projectId }: { experiments: Experiment[]; projectId: string }) {
  if (experiments.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 p-12 text-center shadow-sm dark:shadow-none">
        <FlaskConical className="mx-auto mb-3 h-8 w-8 text-surface-300 dark:text-surface-600" />
        <p className="text-surface-500 dark:text-surface-400">No experiments for this project yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {experiments.map((exp) => (
        <Link
          key={exp.id}
          href="/dashboard/experiments"
          className="block bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 shadow-sm dark:shadow-none transition-all hover:border-surface-300 dark:hover:border-surface-600/50 hover:shadow-md dark:hover:shadow-none group"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <h4 className="font-semibold text-surface-800 dark:text-surface-100 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
              {exp.title}
            </h4>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                  getStatusColor(exp.status),
                )}
              >
                {exp.status}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-surface-500 dark:text-surface-400">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Run: {formatDate(exp.runDate)}
            </div>
            {exp.runBy && (
              <div className="flex items-center gap-1.5">
                <span>By: {getUserById(exp.runBy)?.name ?? exp.runBy}</span>
              </div>
            )}
          </div>

          {exp.status === 'completed' && exp.results && (
            <div className="mt-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 p-3">
              <div className="flex flex-wrap gap-4">
                {Object.entries(exp.results.metrics)
                  .slice(0, 4)
                  .map(([key, val]) => (
                    <div key={key} className="text-center">
                      <p className="text-xs text-surface-400 dark:text-surface-500">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                        {typeof val === 'number' && val < 1 ? val.toFixed(3) : val}
                      </p>
                    </div>
                  ))}
              </div>
              {exp.results.conclusion && (
                <p className="mt-2 text-xs text-surface-500 dark:text-surface-400 italic line-clamp-2">
                  {exp.results.conclusion}
                </p>
              )}
            </div>
          )}

          {exp.status === 'running' && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Experiment is currently running
              </span>
            </div>
          )}
        </Link>
      ))}
    </div>
  )
}

/* ─── Ideas Tab ─── */

function IdeasTab({ ideas }: { ideas: Idea[] }) {
  if (ideas.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 p-12 text-center shadow-sm dark:shadow-none">
        <Lightbulb className="mx-auto mb-3 h-8 w-8 text-surface-300 dark:text-surface-600" />
        <p className="text-surface-500 dark:text-surface-400">No ideas for this project yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {ideas.map((idea) => (
        <div
          key={idea.id}
          className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 shadow-sm dark:shadow-none transition-all hover:border-surface-300 dark:hover:border-surface-600/50"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <h4 className="font-semibold text-surface-800 dark:text-surface-100">{idea.title}</h4>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                getStatusColor(idea.status),
              )}
            >
              {idea.status}
            </span>
          </div>

          <div className="flex items-center gap-4 mb-3 text-sm">
            <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>{idea.votes} votes</span>
            </div>
            <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400">
              <span>{idea.comments.length} comment{idea.comments.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="rounded-lg bg-surface-50 dark:bg-surface-800/50 p-3">
            <div className="flex items-start gap-2">
              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500 dark:text-brand-400" />
              <p className="text-sm text-surface-500 dark:text-surface-400 line-clamp-2">
                {idea.hypothesis}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="text-surface-400 dark:text-surface-500">
              Risk: <span className={cn('font-medium',
                idea.riskAssessment.toLowerCase().startsWith('high')
                  ? 'text-red-500 dark:text-red-400'
                  : idea.riskAssessment.toLowerCase().startsWith('low')
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : 'text-yellow-500 dark:text-yellow-400'
              )}>{idea.riskAssessment.split(' — ')[0]}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Papers Tab ─── */

function PapersTab({ papers }: { papers: Paper[] }) {
  if (papers.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 p-12 text-center shadow-sm dark:shadow-none">
        <BookOpen className="mx-auto mb-3 h-8 w-8 text-surface-300 dark:text-surface-600" />
        <p className="text-surface-500 dark:text-surface-400">No papers linked to this project yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {papers.map((paper) => (
        <div
          key={paper.id}
          className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 shadow-sm dark:shadow-none transition-all hover:border-surface-300 dark:hover:border-surface-600/50"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <h4 className="font-semibold text-surface-800 dark:text-surface-100">{paper.title}</h4>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                getStatusColor(paper.status),
              )}
            >
              {paper.status.replace('-', ' ')}
            </span>
          </div>

          <p className="mb-2 text-sm text-surface-500 dark:text-surface-400">
            {paper.authors.slice(0, 3).join(', ')}
            {paper.authors.length > 3 && ' et al.'}
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-surface-500 dark:text-surface-400">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {paper.venue} ({paper.year})
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-surface-600 dark:text-surface-300">
                {paper.citations.toLocaleString()}
              </span>
              <span>citations</span>
            </div>
          </div>

          {paper.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {paper.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5 text-[11px] text-surface-500 dark:text-surface-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Activity Tab ─── */

function ActivityTab({ activities }: { activities: { id: string; userId: string; action: string; target: string; targetType: string; timestamp: string }[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 p-12 text-center shadow-sm dark:shadow-none">
        <Activity className="mx-auto mb-3 h-8 w-8 text-surface-300 dark:text-surface-600" />
        <p className="text-surface-500 dark:text-surface-400">No recent activity for this project.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-6 shadow-sm dark:shadow-none">
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-surface-200 dark:bg-surface-700" />

        <div className="space-y-5">
          {activities.map((act) => {
            const actUser = getUserById(act.userId)
            return (
              <div key={act.id} className="relative flex gap-4">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20 text-[10px] font-semibold text-brand-600 dark:text-brand-300">
                  {actUser ? getInitials(actUser.name) : '??'}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm text-surface-600 dark:text-surface-300">
                    <span className="font-medium text-surface-800 dark:text-surface-100">
                      {actUser?.name ?? 'Unknown'}
                    </span>{' '}
                    {act.action}{' '}
                    <span className="font-medium text-surface-700 dark:text-surface-200">
                      {act.target}
                    </span>
                  </p>
                  <span className="text-xs text-surface-400 dark:text-surface-500">
                    {formatRelativeTime(act.timestamp)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
