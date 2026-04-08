'use client'

import { useState, useMemo } from 'react'
import {
  Sparkles,
  LayoutGrid,
  List,
  Search,
  ThumbsUp,
  MessageSquare,
  BookOpen,
  LinkIcon,
  Plus,
  X,
  Brain,
  AlertTriangle,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { ideas, papers, users, projects, getUserById, getPaperById } from '@/lib/mock-data'
import { getStatusColor, getInitials, formatDate } from '@/lib/utils'
import type { Idea } from '@/types'

const FILTERS = ['All', 'Promising', 'Exploring', 'Validated', 'Parking Lot', 'Rejected'] as const
type FilterLabel = (typeof FILTERS)[number]

const filterToStatus: Record<FilterLabel, string | null> = {
  All: null,
  Promising: 'promising',
  Exploring: 'exploring',
  Validated: 'validated',
  'Parking Lot': 'parking-lot',
  Rejected: 'rejected',
}

function getRiskColor(risk: string) {
  const lower = risk.toLowerCase()
  if (lower.startsWith('high')) return 'text-red-400 bg-red-500/10 border-red-500/20'
  if (lower.startsWith('low')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
}

function getRiskLabel(risk: string) {
  const lower = risk.toLowerCase()
  if (lower.startsWith('high')) return 'High'
  if (lower.startsWith('low')) return 'Low'
  return 'Medium'
}

const AI_RESPONSES: Record<string, { gaps: string[]; experiments: string[]; priorWork: string[] }> = {}

function generateAIResponse(idea: Idea) {
  if (AI_RESPONSES[idea.id]) return AI_RESPONSES[idea.id]
  const response = {
    gaps: [
      `Limited work on applying ${idea.title.split(' ').slice(0, 3).join(' ').toLowerCase()} to multi-modal settings`,
      'No existing benchmarks specifically designed for this problem formulation',
      'Cross-domain generalization remains unexplored in this context',
    ],
    experiments: [
      'Ablation study removing each proposed component individually',
      `Comparative evaluation against top-3 baselines on ${idea.linkedPaperIds.length > 0 ? 'referenced benchmarks' : 'standard benchmarks'}`,
      'Scalability analysis across varying dataset sizes (1x, 5x, 10x)',
    ],
    priorWork: idea.linkedPaperIds.slice(0, 3).map(pid => {
      const p = getPaperById(pid)
      return p ? `${p.title} (${p.venue})` : 'Unknown paper'
    }),
  }
  AI_RESPONSES[idea.id] = response
  return response
}

export default function IdeasPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [activeFilter, setActiveFilter] = useState<FilterLabel>('All')
  const [search, setSearch] = useState('')
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [votes, setVotes] = useState<Record<string, number>>(() =>
    Object.fromEntries(ideas.map(i => [i.id, i.votes]))
  )
  const [expandedAI, setExpandedAI] = useState<Record<string, boolean>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    let result = [...ideas]
    const statusKey = filterToStatus[activeFilter]
    if (statusKey) result = result.filter(i => i.status === statusKey)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.hypothesis.toLowerCase().includes(q) ||
          i.motivation.toLowerCase().includes(q)
      )
    }
    return result
  }, [activeFilter, search])

  function handleVote(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setVotes(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }

  function handleAIExpand(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (expandedAI[id]) {
      setExpandedAI(prev => ({ ...prev, [id]: false }))
      return
    }
    setAiLoading(prev => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setAiLoading(prev => ({ ...prev, [id]: false }))
      setExpandedAI(prev => ({ ...prev, [id]: true }))
    }, 1200)
  }

  function getProjectTitle(projectId: string) {
    const p = projects.find(pr => pr.id === projectId)
    return p?.title ?? 'Unknown Project'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-surface-100">Idea Canvas</h1>
              <span className="rounded-full bg-surface-800 px-2.5 py-0.5 text-xs font-medium text-surface-300">
                {ideas.length}
              </span>
            </div>
          </div>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Idea
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === f
                  ? 'bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/30'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              placeholder="Search ideas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900/80 py-2 pl-10 pr-3 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-64"
            />
          </label>
          <div className="flex items-center rounded-lg border border-surface-700 bg-surface-900/80">
            <button
              onClick={() => setView('grid')}
              className={`rounded-l-lg p-2 transition-colors ${
                view === 'grid' ? 'bg-brand-500/10 text-brand-400' : 'text-surface-400 hover:text-surface-200'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded-r-lg p-2 transition-colors ${
                view === 'list' ? 'bg-brand-500/10 text-brand-400' : 'text-surface-400 hover:text-surface-200'
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ideas Grid / List */}
      <div
        className={
          view === 'grid'
            ? 'grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'
            : 'flex flex-col gap-4'
        }
      >
        {filtered.map(idea => {
          const creator = getUserById(idea.createdBy)
          const riskLabel = getRiskLabel(idea.riskAssessment)
          const riskColor = getRiskColor(idea.riskAssessment)
          const aiData = expandedAI[idea.id] ? generateAIResponse(idea) : null

          return (
            <div
              key={idea.id}
              className="cursor-pointer bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 card-hover"
              onClick={() => setSelectedIdea(idea)}
            >
              {/* Title + Status */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-base font-bold text-surface-100 leading-tight">{idea.title}</h3>
                <span className={`badge shrink-0 ${getStatusColor(idea.status)}`}>
                  {idea.status}
                </span>
              </div>

              {/* Hypothesis */}
              <p className="text-sm text-surface-300 line-clamp-3 mb-2">
                <span className="text-surface-500 font-medium">Hypothesis: </span>
                {idea.hypothesis}
              </p>

              {/* Motivation */}
              <p className="text-sm text-surface-400 line-clamp-2 mb-2">
                <span className="text-surface-500 font-medium">Motivation: </span>
                {idea.motivation}
              </p>

              {/* Method */}
              <p className="text-sm text-surface-400 line-clamp-2 mb-3">
                <span className="text-surface-500 font-medium">Method: </span>
                {idea.method}
              </p>

              {/* Risk */}
              <div className="mb-3">
                <span className={`badge text-xs ${riskColor}`}>
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {riskLabel} Risk
                </span>
              </div>

              {/* Metrics Row */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-surface-400 mb-3">
                <button
                  onClick={e => handleVote(idea.id, e)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-brand-500/10 hover:text-brand-400"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span className="font-medium">{votes[idea.id]}</span>
                </button>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {idea.linkedPaperIds.length} papers
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {idea.comments.length}
                </span>
              </div>

              {/* Creator + Project */}
              <div className="flex items-center justify-between gap-2 mb-3 text-xs">
                {creator && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-semibold text-brand-300">
                      {getInitials(creator.name)}
                    </div>
                    <span className="text-surface-300">{creator.name}</span>
                  </div>
                )}
                <span className="flex items-center gap-1 text-surface-500 truncate max-w-[50%]">
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{getProjectTitle(idea.projectId)}</span>
                </span>
              </div>

              {/* Expected Contribution */}
              <p className="text-xs text-surface-500 line-clamp-1 mb-3">
                <span className="font-medium">Contribution: </span>
                {idea.expectedContribution}
              </p>

              {/* AI Expand */}
              <button
                onClick={e => handleAIExpand(idea.id, e)}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  expandedAI[idea.id]
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                    : 'border-surface-700 bg-surface-800/50 text-surface-300 hover:border-purple-500/30 hover:bg-purple-500/5 hover:text-purple-400'
                }`}
              >
                {aiLoading[idea.id] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Brain className="h-3.5 w-3.5" />
                )}
                {aiLoading[idea.id] ? 'Analyzing...' : expandedAI[idea.id] ? 'Hide AI Insights' : 'AI Expand'}
              </button>

              {/* AI Response */}
              {aiData && (
                <div
                  className="mt-3 space-y-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs"
                  onClick={e => e.stopPropagation()}
                >
                  <div>
                    <p className="font-semibold text-purple-300 mb-1">Literature Gaps</p>
                    <ul className="space-y-1 text-surface-300">
                      {aiData.gaps.map((g, i) => (
                        <li key={i} className="flex gap-1.5">
                          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-purple-400" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-purple-300 mb-1">Suggested Experiments</p>
                    <ul className="space-y-1 text-surface-300">
                      {aiData.experiments.map((e, i) => (
                        <li key={i} className="flex gap-1.5">
                          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-purple-400" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {aiData.priorWork.length > 0 && (
                    <div>
                      <p className="font-semibold text-purple-300 mb-1">Similar Prior Work</p>
                      <ul className="space-y-1 text-surface-300">
                        {aiData.priorWork.map((w, i) => (
                          <li key={i} className="flex gap-1.5">
                            <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-purple-400" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-surface-500">
          <Sparkles className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-lg font-medium">No ideas match your filters</p>
          <p className="text-sm">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          votes={votes}
          onVote={handleVote}
          onClose={() => setSelectedIdea(null)}
          getProjectTitle={getProjectTitle}
        />
      )}
    </div>
  )
}

function IdeaDetailModal({
  idea,
  votes,
  onVote,
  onClose,
  getProjectTitle,
}: {
  idea: Idea
  votes: Record<string, number>
  onVote: (id: string, e?: React.MouseEvent) => void
  onClose: () => void
  getProjectTitle: (id: string) => string
}) {
  const creator = getUserById(idea.createdBy)
  const riskLabel = getRiskLabel(idea.riskAssessment)
  const riskColor = getRiskColor(idea.riskAssessment)
  const linkedPapers = idea.linkedPaperIds.map(getPaperById).filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-[5vh]">
      <div className="relative w-full max-w-3xl rounded-2xl border border-surface-700/50 bg-surface-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-surface-800 p-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`badge ${getStatusColor(idea.status)}`}>{idea.status}</span>
              <span className={`badge text-xs ${riskColor}`}>
                <AlertTriangle className="mr-1 h-3 w-3" />
                {riskLabel} Risk
              </span>
            </div>
            <h2 className="text-xl font-bold text-surface-100">{idea.title}</h2>
            {creator && (
              <div className="mt-2 flex items-center gap-2 text-sm text-surface-400">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-semibold text-brand-300">
                  {getInitials(creator.name)}
                </div>
                <span>{creator.name}</span>
                <span className="text-surface-600">·</span>
                <span>{formatDate(idea.createdAt)}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          <Section label="Hypothesis">
            <p className="text-sm text-surface-200 leading-relaxed">{idea.hypothesis}</p>
          </Section>

          <Section label="Motivation">
            <p className="text-sm text-surface-300 leading-relaxed">{idea.motivation}</p>
          </Section>

          <Section label="Prior Art">
            {linkedPapers.length > 0 ? (
              <ul className="space-y-1">
                {linkedPapers.map(p =>
                  p ? (
                    <li key={p.id} className="flex items-start gap-2 text-sm">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                      <span className="text-surface-300">
                        {p.title}{' '}
                        <span className="text-surface-500">({p.venue})</span>
                      </span>
                    </li>
                  ) : null
                )}
              </ul>
            ) : (
              <p className="text-sm text-surface-500 italic">No linked papers</p>
            )}
          </Section>

          <Section label="Method">
            <p className="text-sm text-surface-300 leading-relaxed">{idea.method}</p>
          </Section>

          <Section label="Expected Contribution">
            <p className="text-sm text-surface-300 leading-relaxed">{idea.expectedContribution}</p>
          </Section>

          <Section label="Risk Assessment">
            <p className="text-sm text-surface-300 leading-relaxed">{idea.riskAssessment}</p>
          </Section>

          <Section label="Project">
            <div className="flex items-center gap-2 text-sm text-brand-400">
              <LinkIcon className="h-4 w-4" />
              {getProjectTitle(idea.projectId)}
            </div>
          </Section>

          {/* Vote */}
          <div className="flex items-center gap-4 rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
            <button
              onClick={e => onVote(idea.id, e)}
              className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-400 transition-colors hover:bg-brand-500/20"
            >
              <ThumbsUp className="h-4 w-4" />
              Upvote ({votes[idea.id]})
            </button>
            <span className="text-sm text-surface-400">
              {idea.linkedPaperIds.length} linked papers · {idea.comments.length} comments
            </span>
          </div>

          {/* Comments */}
          <Section label={`Comments (${idea.comments.length})`}>
            {idea.comments.length > 0 ? (
              <div className="space-y-3">
                {idea.comments.map(c => {
                  const commentUser = getUserById(c.userId)
                  return (
                    <div key={c.id} className="flex gap-3 rounded-lg bg-surface-800/50 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-300">
                        {commentUser ? getInitials(commentUser.name) : '??'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-surface-200">
                            {commentUser?.name ?? 'Unknown'}
                          </span>
                          <span className="text-surface-500">{formatDate(c.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-surface-300">{c.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-surface-500 italic">No comments yet</p>
            )}
          </Section>

          {/* PI Feedback */}
          <Section label="PI Feedback">
            {idea.comments.filter(c => {
              const u = getUserById(c.userId)
              return u?.role === 'pi'
            }).length > 0 ? (
              <div className="space-y-3">
                {idea.comments
                  .filter(c => {
                    const u = getUserById(c.userId)
                    return u?.role === 'pi'
                  })
                  .map(c => {
                    const piUser = getUserById(c.userId)
                    return (
                      <div key={c.id} className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-semibold text-amber-300">
                          {piUser ? getInitials(piUser.name) : 'PI'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-amber-300">{piUser?.name}</span>
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                              PI
                            </span>
                            <span className="text-surface-500">{formatDate(c.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-sm text-surface-300">{c.text}</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <p className="text-sm text-surface-500 italic">No PI feedback yet</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-500">{label}</h4>
      {children}
    </div>
  )
}
