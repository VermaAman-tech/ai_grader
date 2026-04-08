'use client'

import { useState, useMemo } from 'react'
import {
  Sparkles,
  LayoutGrid,
  List,
  Search,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  BookOpen,
  LinkIcon,
  Plus,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  GitBranch,
  Send,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react'
import { useDataStore } from '@/contexts/DataStore'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatDate, formatRelativeTime, getInitials, getStatusColor } from '@/lib/utils'
import { getUserById, getPaperById } from '@/lib/mock-data'
import type { Idea, IdeaStatus, Project } from '@/types'

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────

const STATUSES: IdeaStatus[] = ['promising', 'exploring', 'validated', 'parking-lot', 'rejected']

const STATUS_LABEL: Record<IdeaStatus, string> = {
  promising: 'Promising',
  exploring: 'Exploring',
  validated: 'Validated',
  'parking-lot': 'Parking Lot',
  rejected: 'Rejected',
}

const NODE_COLORS: Record<IdeaStatus, string> = {
  promising: '#22c55e',
  exploring: '#3b82f6',
  validated: '#10b981',
  'parking-lot': '#eab308',
  rejected: '#ef4444',
}

const LANE_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#f97316', '#6366f1',
]

type ViewMode = 'graph' | 'grid' | 'list'

const INPUT_CLS =
  'w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900/80 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors'

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function riskLevel(r: string) {
  const l = r.toLowerCase()
  return l.startsWith('high') ? 'High' : l.startsWith('low') ? 'Low' : 'Medium'
}

function riskBadgeCls(r: string) {
  const l = r.toLowerCase()
  if (l.startsWith('high'))
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
  if (l.startsWith('low'))
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
  return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20'
}

// ────────────────────────────────────────────────────────
// Flow-graph layout engine
// ────────────────────────────────────────────────────────

interface GNode { id: string; x: number; y: number; idea: Idea; lane: number }
interface GEdge { from: GNode; to: GNode; kind: 'branch' | 'link' }

const LW = 200, RH = 100, MX = 60, MY = 50, NR = 16

function layoutGraph(ideas: Idea[]) {
  if (!ideas.length)
    return { nodes: [] as GNode[], edges: [] as GEdge[], w: 0, h: 0, lanes: new Map<string, number>() }

  const sorted = [...ideas].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  )

  const freq = new Map<string, number>()
  sorted.forEach(i => freq.set(i.projectId, (freq.get(i.projectId) || 0) + 1))
  const lanes = new Map<string, number>()
  Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([p], i) => lanes.set(p, i))

  const nodes: GNode[] = sorted.map((idea, i) => ({
    id: idea.id,
    x: MX + (lanes.get(idea.projectId) ?? 0) * LW,
    y: MY + i * RH,
    idea,
    lane: lanes.get(idea.projectId) ?? 0,
  }))

  const nmap = new Map(nodes.map(n => [n.id, n]))
  const edges: GEdge[] = []

  const byProj = new Map<string, GNode[]>()
  nodes.forEach(n => {
    const a = byProj.get(n.idea.projectId) || []
    a.push(n)
    byProj.set(n.idea.projectId, a)
  })
  byProj.forEach(group => {
    for (let i = 0; i < group.length - 1; i++)
      edges.push({ from: group[i], to: group[i + 1], kind: 'branch' })
  })

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[i].projectId === sorted[j].projectId) continue
      if (sorted[i].linkedPaperIds.some(p => sorted[j].linkedPaperIds.includes(p))) {
        const a = nmap.get(sorted[i].id)!
        const b = nmap.get(sorted[j].id)!
        edges.push({ from: a, to: b, kind: 'link' })
      }
    }
  }

  return {
    nodes,
    edges,
    w: Math.max(MX + (lanes.size - 1) * LW + 360, 600),
    h: Math.max(MY + (sorted.length - 1) * RH + 80, 300),
    lanes,
  }
}

// ────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────

export default function IdeasPage() {
  const {
    ideas, projects, addIdea, updateIdea, deleteIdea, voteIdea, addIdeaComment,
  } = useDataStore()
  const { user } = useAuth()

  const [view, setView] = useState<ViewMode>('graph')
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [creatorFilter, setCreatorFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Idea | null>(null)
  const [deleting, setDeleting] = useState<Idea | null>(null)
  const [zoom, setZoom] = useState(1)

  const filtered = useMemo(() => {
    let r = [...ideas]
    if (statusFilter !== 'all') r = r.filter(i => i.status === statusFilter)
    if (projectFilter !== 'all') r = r.filter(i => i.projectId === projectFilter)
    if (creatorFilter !== 'all') r = r.filter(i => i.createdBy === creatorFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.hypothesis.toLowerCase().includes(q) ||
          i.motivation.toLowerCase().includes(q),
      )
    }
    return r
  }, [ideas, statusFilter, projectFilter, creatorFilter, search])

  const graph = useMemo(() => layoutGraph(filtered), [filtered])

  const selectedIdea = useMemo(
    () => (selected ? ideas.find(i => i.id === selected) ?? null : null),
    [ideas, selected],
  )

  const creators = useMemo(() => {
    const s = new Set(ideas.map(i => i.createdBy))
    return Array.from(s).map(id => getUserById(id)).filter(Boolean)
  }, [ideas])

  function handleCreate(d: Partial<Idea>) {
    addIdea({
      title: d.title || '',
      hypothesis: d.hypothesis || '',
      motivation: d.motivation || '',
      method: d.method || '',
      expectedContribution: d.expectedContribution || '',
      riskAssessment: d.riskAssessment || '',
      status: d.status || 'exploring',
      votes: 0,
      createdBy: user?.id || 'u1',
      projectId: d.projectId || projects[0]?.id || '',
      linkedPaperIds: [],
      priorArt: [],
      comments: [],
      createdAt: new Date().toISOString(),
    })
    setFormOpen(false)
  }

  function handleUpdate(d: Partial<Idea>) {
    if (!editing) return
    updateIdea(editing.id, d)
    setEditing(null)
  }

  function handleDelete() {
    if (!deleting) return
    deleteIdea(deleting.id)
    if (selected === deleting.id) setSelected(null)
    setDeleting(null)
  }

  function projTitle(id: string) {
    return projects.find(p => p.id === id)?.title ?? 'Unknown'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/10">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
              Idea Canvas
            </h1>
            <span className="rounded-full bg-surface-100 dark:bg-surface-800 px-2.5 py-0.5 text-xs font-medium text-surface-600 dark:text-surface-300">
              {ideas.length}
            </span>
          </div>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> New Idea
        </button>
      </div>

      {/* Filters & controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', ...STATUSES] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === s
                  ? 'bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 ring-1 ring-brand-200 dark:ring-brand-500/30'
                  : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-700 dark:hover:text-surface-200',
              )}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className={INPUT_CLS + ' w-auto'}
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>

          <select
            value={creatorFilter}
            onChange={e => setCreatorFilter(e.target.value)}
            className={INPUT_CLS + ' w-auto'}
          >
            <option value="all">All Creators</option>
            {creators.map(u => u && (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
            <input
              type="text"
              placeholder="Search ideas…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={INPUT_CLS + ' pl-10 sm:w-52'}
            />
          </label>

          <div className="flex items-center rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900/80">
            {([['graph', GitBranch], ['grid', LayoutGrid], ['list', List]] as const).map(
              ([m, Icon]) => (
                <button
                  key={m}
                  onClick={() => setView(m as ViewMode)}
                  className={cn(
                    'p-2 transition-colors first:rounded-l-lg last:rounded-r-lg',
                    view === m
                      ? 'bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400'
                      : 'text-surface-400 hover:text-surface-700 dark:hover:text-surface-200',
                  )}
                  title={`${m} view`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : view === 'graph' ? (
        <FlowGraph
          graph={graph}
          selectedId={selected}
          zoom={zoom}
          setZoom={setZoom}
          onSelect={setSelected}
          projTitle={projTitle}
        />
      ) : (
        <div
          className={
            view === 'grid'
              ? 'grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'
              : 'flex flex-col gap-3'
          }
        >
          {filtered.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              compact={view === 'list'}
              onSelect={() => setSelected(idea.id)}
              onEdit={() => setEditing(idea)}
              onDelete={() => setDeleting(idea)}
              onVote={d => voteIdea(idea.id, d)}
              projTitle={projTitle}
            />
          ))}
        </div>
      )}

      {/* Overlays */}
      {selectedIdea && (
        <DetailPanel
          idea={selectedIdea}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(selectedIdea)}
          onDelete={() => setDeleting(selectedIdea)}
          onVote={d => voteIdea(selectedIdea.id, d)}
          onComment={text =>
            addIdeaComment(selectedIdea.id, {
              userId: user?.id || 'u1',
              text,
              createdAt: new Date().toISOString(),
            })
          }
          projTitle={projTitle}
        />
      )}
      {(formOpen || editing) && (
        <FormModal
          idea={editing}
          projects={projects}
          onSubmit={editing ? handleUpdate : handleCreate}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title={deleting.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Flow Graph
// ────────────────────────────────────────────────────────

function FlowGraph({
  graph,
  selectedId,
  zoom,
  setZoom,
  onSelect,
  projTitle,
}: {
  graph: ReturnType<typeof layoutGraph>
  selectedId: string | null
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  onSelect: (id: string) => void
  projTitle: (id: string) => string
}) {
  const { nodes, edges, w, h, lanes } = graph
  const laneList = Array.from(lanes.entries()).sort((a, b) => a[1] - b[1])

  return (
    <div className="relative rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900/50 overflow-hidden">
      {/* Zoom toolbar */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white/90 dark:bg-surface-800/90 backdrop-blur p-1 shadow-sm">
        <button
          onClick={() => setZoom(z => Math.min(2, z + 0.15))}
          className="rounded p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="min-w-[3rem] text-center text-xs font-medium text-surface-500 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
          className="rounded p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-surface-200 dark:bg-surface-700" />
        <button
          onClick={() => setZoom(1)}
          className="rounded p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Graph canvas */}
      <div className="overflow-auto" style={{ maxHeight: '62vh' }}>
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: w,
            height: h,
            minWidth: w,
            minHeight: h,
          }}
        >
          <svg
            width={w}
            height={h}
            className="text-surface-400 dark:text-surface-500"
          >
            <defs>
              <pattern
                id="dot-grid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="12" cy="12" r="0.8" fill="currentColor" opacity={0.3} />
              </pattern>
            </defs>
            <rect width={w} height={h} fill="url(#dot-grid)" />

            {/* Lane guide lines */}
            {laneList.map(([pid, idx]) => {
              const x = MX + idx * LW
              const color = LANE_PALETTE[idx % LANE_PALETTE.length]
              const label = projTitle(pid)
              return (
                <g key={pid}>
                  <line
                    x1={x} y1={MY - 10} x2={x} y2={h - 20}
                    stroke={color} strokeWidth={1.5} opacity={0.1}
                  />
                  <text
                    x={x} y={16} textAnchor="middle"
                    fontSize={10} fontWeight={700} fill={color} opacity={0.65}
                  >
                    {label.length > 24 ? label.slice(0, 24) + '…' : label}
                  </text>
                </g>
              )
            })}

            {/* Edges */}
            {edges.map((e, i) => {
              const { from, to, kind } = e
              const color =
                kind === 'branch'
                  ? LANE_PALETTE[from.lane % LANE_PALETTE.length]
                  : '#94a3b8'
              const my = (from.y + to.y) / 2
              const d =
                from.x === to.x
                  ? `M${from.x} ${from.y + NR} L${to.x} ${to.y - NR}`
                  : `M${from.x} ${from.y + NR} C${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y - NR}`
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={kind === 'branch' ? 2.5 : 1.5}
                  opacity={kind === 'branch' ? 0.35 : 0.2}
                  strokeDasharray={kind === 'link' ? '6 4' : undefined}
                />
              )
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const c = NODE_COLORS[n.idea.status] ?? '#6b7280'
              const sel = n.id === selectedId
              return (
                <g
                  key={n.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(n.id)}
                >
                  {sel && (
                    <circle
                      cx={n.x} cy={n.y} r={NR + 7}
                      fill={c} opacity={0.15}
                      className="animate-pulse"
                    />
                  )}
                  <circle
                    cx={n.x} cy={n.y} r={NR}
                    fill={c} opacity={0.15}
                    stroke={c} strokeWidth={sel ? 3 : 2}
                  />
                  <circle cx={n.x} cy={n.y} r={NR * 0.5} fill={c} />
                  <text
                    x={n.x + NR + 10} y={n.y - 5}
                    fontSize={12} fontWeight={600}
                    className="fill-surface-800 dark:fill-surface-200"
                  >
                    {n.idea.title.length > 36
                      ? n.idea.title.slice(0, 36) + '…'
                      : n.idea.title}
                  </text>
                  <text
                    x={n.x + NR + 10} y={n.y + 11}
                    fontSize={10}
                    className="fill-surface-500 dark:fill-surface-400"
                  >
                    {STATUS_LABEL[n.idea.status]} · ▲{n.idea.votes} ·{' '}
                    {n.idea.comments.length} comments
                  </text>
                  <title>{n.idea.title}</title>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* Legend bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-surface-100 dark:border-surface-800 px-4 py-2.5 text-xs">
        <span className="font-medium text-surface-400 dark:text-surface-500">
          Status:
        </span>
        {STATUSES.map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: NODE_COLORS[s] }}
            />
            <span className="text-surface-600 dark:text-surface-400">
              {STATUS_LABEL[s]}
            </span>
          </span>
        ))}
        <span className="text-surface-300 dark:text-surface-700">|</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-surface-400" />
          <span className="text-surface-600 dark:text-surface-400">Branch</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded border-t-2 border-dashed border-surface-400" />
          <span className="text-surface-600 dark:text-surface-400">
            Shared papers
          </span>
        </span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Idea Card (grid & list)
// ────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  compact,
  onSelect,
  onEdit,
  onDelete,
  onVote,
  projTitle,
}: {
  idea: Idea
  compact?: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onVote: (d: number) => void
  projTitle: (id: string) => string
}) {
  const creator = getUserById(idea.createdBy)

  if (compact) {
    return (
      <div
        onClick={onSelect}
        className="group flex cursor-pointer items-center gap-4 rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 px-5 py-3 transition-all hover:shadow-md hover:border-brand-300 dark:hover:border-brand-500/30"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: NODE_COLORS[idea.status] }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-surface-900 dark:text-surface-100">
              {idea.title}
            </h3>
            <span
              className={cn(
                'badge shrink-0 text-xs',
                getStatusColor(idea.status),
              )}
            >
              {STATUS_LABEL[idea.status]}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-surface-500 dark:text-surface-400">
            {idea.hypothesis}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-surface-500 dark:text-surface-400">
          <button
            onClick={e => { e.stopPropagation(); onVote(1) }}
            className="flex items-center gap-1 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {idea.votes}
          </button>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {idea.comments.length}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1 opacity-0 transition-all group-hover:opacity-100 hover:text-brand-600 dark:hover:text-brand-400"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onSelect}
      className="group cursor-pointer rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:hover:border-brand-500/30"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-bold leading-tight text-surface-900 dark:text-surface-100">
          {idea.title}
        </h3>
        <span className={cn('badge shrink-0 text-xs', getStatusColor(idea.status))}>
          {STATUS_LABEL[idea.status]}
        </span>
      </div>

      <p className="mb-2 line-clamp-2 text-sm text-surface-600 dark:text-surface-300">
        <span className="font-medium text-surface-400 dark:text-surface-500">
          Hypothesis:{' '}
        </span>
        {idea.hypothesis}
      </p>

      <p className="mb-3 line-clamp-2 text-sm text-surface-500 dark:text-surface-400">
        <span className="font-medium text-surface-400 dark:text-surface-500">
          Method:{' '}
        </span>
        {idea.method}
      </p>

      <p className="mb-3 line-clamp-1 text-xs text-surface-400 dark:text-surface-500">
        <span className="font-medium">Contribution: </span>
        {idea.expectedContribution}
      </p>

      <div className="mb-3">
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
            riskBadgeCls(idea.riskAssessment),
          )}
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          {riskLevel(idea.riskAssessment)} Risk
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-surface-500 dark:text-surface-400">
          <button
            onClick={e => { e.stopPropagation(); onVote(1) }}
            className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {idea.votes}
          </button>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {idea.linkedPaperIds.length}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {idea.comments.length}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="rounded-md p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-brand-600 dark:hover:bg-surface-800 dark:hover:text-brand-400"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="rounded-md p-1.5 text-surface-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-surface-100 pt-3 text-xs dark:border-surface-800">
        {creator && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              {getInitials(creator.name)}
            </div>
            <span className="text-surface-600 dark:text-surface-300">
              {creator.name}
            </span>
          </div>
        )}
        <span className="flex max-w-[50%] items-center gap-1 truncate text-surface-400 dark:text-surface-500">
          <LinkIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{projTitle(idea.projectId)}</span>
        </span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Detail Panel (modal overlay)
// ────────────────────────────────────────────────────────

function DetailPanel({
  idea,
  onClose,
  onEdit,
  onDelete,
  onVote,
  onComment,
  projTitle,
}: {
  idea: Idea
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onVote: (d: number) => void
  onComment: (text: string) => void
  projTitle: (id: string) => string
}) {
  const [cmt, setCmt] = useState('')
  const creator = getUserById(idea.createdBy)
  const linked = idea.linkedPaperIds.map(getPaperById).filter(Boolean)
  const piFeedback = idea.comments.filter(c => {
    const u = getUserById(c.userId)
    return u?.role === 'pi'
  })

  function submit() {
    if (!cmt.trim()) return
    onComment(cmt.trim())
    setCmt('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-[5vh] backdrop-blur-sm dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-surface-200 bg-white shadow-2xl dark:border-surface-700/50 dark:bg-surface-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-surface-100 p-6 dark:border-surface-800">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn('badge', getStatusColor(idea.status))}>
                {STATUS_LABEL[idea.status]}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                  riskBadgeCls(idea.riskAssessment),
                )}
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                {riskLevel(idea.riskAssessment)} Risk
              </span>
            </div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
              {idea.title}
            </h2>
            {creator && (
              <div className="mt-2 flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                  {getInitials(creator.name)}
                </div>
                <span>{creator.name}</span>
                <span className="text-surface-300 dark:text-surface-600">·</span>
                <span>{formatDate(idea.createdAt)}</span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-brand-600 dark:hover:bg-surface-800 dark:hover:text-brand-400"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] space-y-5 overflow-y-auto p-6">
          <Sect label="Hypothesis">
            <p className="text-sm leading-relaxed text-surface-700 dark:text-surface-200">
              {idea.hypothesis}
            </p>
          </Sect>
          <Sect label="Motivation">
            <p className="text-sm leading-relaxed text-surface-600 dark:text-surface-300">
              {idea.motivation}
            </p>
          </Sect>
          <Sect label="Method">
            <p className="text-sm leading-relaxed text-surface-600 dark:text-surface-300">
              {idea.method}
            </p>
          </Sect>
          <Sect label="Expected Contribution">
            <p className="text-sm leading-relaxed text-surface-600 dark:text-surface-300">
              {idea.expectedContribution}
            </p>
          </Sect>
          <Sect label="Risk Assessment">
            <p className="text-sm leading-relaxed text-surface-600 dark:text-surface-300">
              {idea.riskAssessment}
            </p>
          </Sect>

          <Sect label="Linked Papers">
            {linked.length > 0 ? (
              <ul className="space-y-1.5">
                {linked.map(
                  p =>
                    p && (
                      <li key={p.id} className="flex items-start gap-2 text-sm">
                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                        <span className="text-surface-600 dark:text-surface-300">
                          {p.title}{' '}
                          <span className="text-surface-400 dark:text-surface-500">
                            ({p.venue})
                          </span>
                        </span>
                      </li>
                    ),
                )}
              </ul>
            ) : (
              <p className="text-sm italic text-surface-400 dark:text-surface-500">
                No linked papers
              </p>
            )}
          </Sect>

          <Sect label="Project">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400">
              <LinkIcon className="h-4 w-4" />
              {projTitle(idea.projectId)}
            </span>
          </Sect>

          {/* Vote bar */}
          <div className="flex items-center gap-4 rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700/50 dark:bg-surface-800/50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onVote(1)}
                className="rounded-lg bg-brand-100 px-3 py-1.5 text-brand-700 transition-colors hover:bg-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
              >
                <ThumbsUp className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold tabular-nums text-surface-800 dark:text-surface-200">
                {idea.votes}
              </span>
              <button
                onClick={() => onVote(-1)}
                className="rounded-lg bg-surface-100 px-3 py-1.5 text-surface-500 transition-colors hover:bg-surface-200 dark:bg-surface-700/50 dark:text-surface-400 dark:hover:bg-surface-700"
              >
                <ThumbsDown className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm text-surface-400">
              {idea.linkedPaperIds.length} papers · {idea.comments.length}{' '}
              comments
            </span>
          </div>

          {/* PI Feedback */}
          {piFeedback.length > 0 && (
            <Sect label="PI Feedback">
              <div className="space-y-3">
                {piFeedback.map(c => {
                  const piUser = getUserById(c.userId)
                  return (
                    <div
                      key={c.id}
                      className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        {piUser ? getInitials(piUser.name) : 'PI'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-amber-700 dark:text-amber-300">
                            {piUser?.name}
                          </span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                            PI
                          </span>
                          <span className="text-surface-400 dark:text-surface-500">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
                          {c.text}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Sect>
          )}

          {/* Comments */}
          <Sect label={`Comments (${idea.comments.length})`}>
            {idea.comments.length > 0 && (
              <div className="mb-3 space-y-3">
                {idea.comments.map(c => {
                  const cu = getUserById(c.userId)
                  return (
                    <div
                      key={c.id}
                      className="flex gap-3 rounded-lg bg-surface-50 p-3 dark:bg-surface-800/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                        {cu ? getInitials(cu.name) : '??'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-surface-700 dark:text-surface-200">
                            {cu?.name ?? 'Unknown'}
                          </span>
                          <span className="text-surface-400 dark:text-surface-500">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
                          {c.text}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={cmt}
                onChange={e => setCmt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Add a comment…"
                className={INPUT_CLS + ' flex-1'}
              />
              <button
                onClick={submit}
                disabled={!cmt.trim()}
                className="rounded-lg bg-brand-600 px-3.5 py-2 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </Sect>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Form Modal (create / edit)
// ────────────────────────────────────────────────────────

function FormModal({
  idea,
  projects,
  onSubmit,
  onClose,
}: {
  idea: Idea | null
  projects: Project[]
  onSubmit: (d: Partial<Idea>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(idea?.title ?? '')
  const [hypothesis, setHypothesis] = useState(idea?.hypothesis ?? '')
  const [motivation, setMotivation] = useState(idea?.motivation ?? '')
  const [method, setMethod] = useState(idea?.method ?? '')
  const [contrib, setContrib] = useState(idea?.expectedContribution ?? '')
  const [risk, setRisk] = useState(idea?.riskAssessment ?? '')
  const [status, setStatus] = useState<IdeaStatus>(idea?.status ?? 'exploring')
  const [pid, setPid] = useState(idea?.projectId ?? projects[0]?.id ?? '')

  function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !hypothesis.trim()) return
    onSubmit({
      title,
      hypothesis,
      motivation,
      method,
      expectedContribution: contrib,
      riskAssessment: risk,
      status,
      projectId: pid,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-[5vh] backdrop-blur-sm dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-surface-200 bg-white shadow-2xl dark:border-surface-700/50 dark:bg-surface-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-100 p-6 dark:border-surface-800">
          <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">
            {idea ? 'Edit Idea' : 'New Idea'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handle}
          className="max-h-[70vh] space-y-4 overflow-y-auto p-6"
        >
          <Field label="Title" required>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="A concise descriptive title"
              className={INPUT_CLS}
              required
            />
          </Field>
          <Field label="Hypothesis" required>
            <textarea
              value={hypothesis}
              onChange={e => setHypothesis(e.target.value)}
              rows={2}
              placeholder="What do you predict?"
              className={INPUT_CLS + ' resize-none'}
              required
            />
          </Field>
          <Field label="Motivation">
            <textarea
              value={motivation}
              onChange={e => setMotivation(e.target.value)}
              rows={2}
              placeholder="Why is this important?"
              className={INPUT_CLS + ' resize-none'}
            />
          </Field>
          <Field label="Method">
            <textarea
              value={method}
              onChange={e => setMethod(e.target.value)}
              rows={2}
              placeholder="How will you test this?"
              className={INPUT_CLS + ' resize-none'}
            />
          </Field>
          <Field label="Expected Contribution">
            <textarea
              value={contrib}
              onChange={e => setContrib(e.target.value)}
              rows={2}
              placeholder="What will this add to the field?"
              className={INPUT_CLS + ' resize-none'}
            />
          </Field>
          <Field label="Risk Assessment">
            <textarea
              value={risk}
              onChange={e => setRisk(e.target.value)}
              rows={2}
              placeholder="Low / Medium / High — why?"
              className={INPUT_CLS + ' resize-none'}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select
                value={status}
                onChange={e => setStatus(e.target.value as IdeaStatus)}
                className={INPUT_CLS}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project">
              <select
                value={pid}
                onChange={e => setPid(e.target.value)}
                className={INPUT_CLS}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {idea ? 'Save Changes' : 'Create Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Confirm Delete
// ────────────────────────────────────────────────────────

function ConfirmDelete({
  title,
  onConfirm,
  onCancel,
}: {
  title: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm dark:bg-black/60"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-6 shadow-2xl dark:border-surface-700/50 dark:bg-surface-900"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">
          Delete Idea
        </h3>
        <p className="mt-2 text-sm text-surface-600 dark:text-surface-400">
          Are you sure you want to delete{' '}
          <strong className="text-surface-800 dark:text-surface-200">
            {title}
          </strong>
          ? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Small shared components
// ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-surface-400 dark:text-surface-500">
      <Sparkles className="mb-3 h-10 w-10 opacity-30" />
      <p className="text-lg font-medium">No ideas match your filters</p>
      <p className="text-sm">Try adjusting your search or filter criteria</p>
    </div>
  )
}

function Sect({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
        {label}
      </h4>
      {children}
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}
