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
} from 'lucide-react'
import {
  getProjectById,
  getUserById,
  getExperimentsByProject,
  getIdeasByProject,
  getPapersByProject,
} from '@/lib/mock-data'
import { getStatusColor, getHealthColor, getInitials, cn, formatDate } from '@/lib/utils'

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

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const project = getProjectById(projectId)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const experiments = useMemo(() => getExperimentsByProject(projectId), [projectId])
  const ideas = useMemo(() => getIdeasByProject(projectId), [projectId])
  const papers = useMemo(() => getPapersByProject(projectId), [projectId])
  const team = useMemo(
    () => (project ? project.teamMemberIds.map((id) => getUserById(id)).filter(Boolean) : []),
    [project],
  )

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-surface-400">Project not found.</p>
        <Link href="/dashboard/projects" className="mt-4 text-sm text-brand-400 hover:underline">
          Back to Projects
        </Link>
      </div>
    )
  }

  const pi = getUserById(project.piId)
  const daysLeft = getDaysLeft(project.deadline)
  const completedMilestones = project.milestones.filter((m) => m.completed).length

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-brand-400 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-surface-100">{project.title}</h1>
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
              <div className="flex items-center gap-2 text-sm text-surface-400 mb-3">
                <Target className="h-4 w-4 text-brand-400" />
                <span>{project.targetVenue}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Health circle */}
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
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-surface-500">
                Health
              </span>
            </div>

            <button className="rounded-lg border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-surface-300 hover:border-brand-500/30 hover:text-brand-400 transition-colors">
              <Edit3 className="mr-1.5 inline h-4 w-4" />
              Edit
            </button>
          </div>
        </div>

        {/* Team */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-surface-700/50 pt-4">
          <span className="text-xs font-medium uppercase tracking-wider text-surface-500">Team</span>
          {team.map((u) => (
            <div key={u!.id} className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-semibold text-brand-300">
                {getInitials(u!.name)}
              </div>
              <span className="text-sm text-surface-300">{u!.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-surface-800 pb-px">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === key
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-surface-400 hover:text-surface-200',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
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
            experimentCount={experiments.length}
            paperCount={papers.length}
            ideaCount={ideas.length}
          />
        )}
        {activeTab === 'milestones' && <MilestonesTab milestones={project.milestones} />}
        {activeTab === 'experiments' && <ExperimentsTab experiments={experiments} />}
        {activeTab === 'ideas' && <IdeasTab ideas={ideas} />}
        {activeTab === 'papers' && <PapersTab papers={papers} />}
        {activeTab === 'activity' && <ActivityTab />}
      </div>
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
  experimentCount,
  paperCount,
  ideaCount,
}: {
  description: string
  domains: string[]
  daysLeft: number | null
  deadline?: string
  createdAt: string
  piName?: string
  experimentCount: number
  paperCount: number
  ideaCount: number
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
            Description
          </h3>
          <p className="text-sm leading-relaxed text-surface-300">{description}</p>
        </div>

        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
            Domain Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {domains.map((d) => (
              <span
                key={d}
                className="rounded-full bg-brand-500/10 border border-brand-500/20 px-3 py-1 text-sm font-medium text-brand-400"
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
            Cross-Project Dependencies
          </h3>
          <p className="text-sm text-surface-400">
            No shared datasets or methods detected with other projects.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Key Stats */}
        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-500">Details</h3>
          {piName && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">PI</span>
              <span className="font-medium text-surface-200">{piName}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-surface-400">Created</span>
            <span className="font-medium text-surface-200">{formatDate(createdAt)}</span>
          </div>
          {deadline && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Deadline</span>
              <span className="font-medium text-surface-200">{formatDate(deadline)}</span>
            </div>
          )}
          {daysLeft !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Time Left</span>
              <span
                className={cn(
                  'font-medium',
                  daysLeft > 30 ? 'text-emerald-400' : daysLeft > 0 ? 'text-yellow-400' : 'text-red-400',
                )}
              >
                {daysLeft > 0 ? `${daysLeft} days` : 'Overdue'}
              </span>
            </div>
          )}
        </div>

        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-500">Stats</h3>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-surface-400">
              <FlaskConical className="h-4 w-4" /> Experiments
            </span>
            <span className="font-semibold text-surface-200">{experimentCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-surface-400">
              <BookOpen className="h-4 w-4" /> Papers
            </span>
            <span className="font-semibold text-surface-200">{paperCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-surface-400">
              <Lightbulb className="h-4 w-4" /> Ideas
            </span>
            <span className="font-semibold text-surface-200">{ideaCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Milestones Tab ─── */

function MilestonesTab({ milestones }: { milestones: { id: string; title: string; date: string; completed: boolean }[] }) {
  const sorted = [...milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-6">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-surface-700" />

        <div className="space-y-6">
          {sorted.map((m, i) => (
            <div key={m.id} className="relative flex gap-4">
              {/* Dot */}
              <div className="relative z-10 shrink-0 mt-0.5">
                {m.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                ) : (
                  <Circle className="h-6 w-6 text-surface-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      'font-medium',
                      m.completed ? 'text-surface-200' : 'text-surface-400',
                    )}
                  >
                    {m.title}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs font-medium',
                      m.completed
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : 'border-surface-600 bg-surface-800 text-surface-400',
                    )}
                  >
                    {m.completed ? 'Completed' : 'Pending'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-surface-500">
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

function ExperimentsTab({ experiments }: { experiments: ReturnType<typeof getExperimentsByProject> }) {
  if (experiments.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-12 text-center">
        <FlaskConical className="mx-auto mb-3 h-8 w-8 text-surface-600" />
        <p className="text-surface-400">No experiments for this project yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {experiments.map((exp) => (
        <div
          key={exp.id}
          className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 card-hover"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <h4 className="font-semibold text-surface-100">{exp.title}</h4>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                getStatusColor(exp.status),
              )}
            >
              {exp.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-surface-400">
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
            <div className="mt-3 rounded-lg bg-surface-800/50 p-3">
              <div className="flex flex-wrap gap-3">
                {Object.entries(exp.results.metrics)
                  .slice(0, 4)
                  .map(([key, val]) => (
                    <div key={key} className="text-center">
                      <p className="text-xs text-surface-500">{key.replace(/_/g, ' ')}</p>
                      <p className="text-sm font-semibold text-brand-400">
                        {typeof val === 'number' && val < 1 ? val.toFixed(3) : val}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Ideas Tab ─── */

function IdeasTab({ ideas }: { ideas: ReturnType<typeof getIdeasByProject> }) {
  if (ideas.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-12 text-center">
        <Lightbulb className="mx-auto mb-3 h-8 w-8 text-surface-600" />
        <p className="text-surface-400">No ideas for this project yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {ideas.map((idea) => (
        <div
          key={idea.id}
          className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 card-hover"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <h4 className="font-semibold text-surface-100">{idea.title}</h4>
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
            <div className="flex items-center gap-1.5 text-surface-400">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>{idea.votes} votes</span>
            </div>
          </div>

          <div className="rounded-lg bg-surface-800/50 p-3">
            <div className="flex items-start gap-2">
              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
              <p className="text-sm text-surface-400 line-clamp-2">{idea.hypothesis}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Papers Tab ─── */

function PapersTab({ papers }: { papers: ReturnType<typeof getPapersByProject> }) {
  if (papers.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-12 text-center">
        <BookOpen className="mx-auto mb-3 h-8 w-8 text-surface-600" />
        <p className="text-surface-400">No papers linked to this project yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {papers.map((paper) => (
        <div
          key={paper.id}
          className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 card-hover"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <h4 className="font-semibold text-surface-100">{paper.title}</h4>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                getStatusColor(paper.status),
              )}
            >
              {paper.status.replace('-', ' ')}
            </span>
          </div>

          <p className="mb-2 text-sm text-surface-400">
            {paper.authors.slice(0, 3).join(', ')}
            {paper.authors.length > 3 && ' et al.'}
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-surface-400">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {paper.venue} ({paper.year})
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-surface-300">{paper.citations.toLocaleString()}</span>
              <span>citations</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Activity Tab ─── */

function ActivityTab() {
  return (
    <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-8 text-center">
      <Activity className="mx-auto mb-3 h-8 w-8 text-surface-600" />
      <p className="text-surface-400">Activity feed coming soon.</p>
      <p className="mt-1 text-xs text-surface-500">Track all project changes, commits, and updates here.</p>
    </div>
  )
}
