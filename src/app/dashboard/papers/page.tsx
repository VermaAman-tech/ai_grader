'use client'

import { useState, useMemo } from 'react'
import {
  BookOpen,
  LayoutGrid,
  List,
  Search,
  TrendingUp,
  Plus,
  X,
  ExternalLink,
  ChevronDown,
  MessageSquare,
  Tag,
  FolderOpen,
  Eye,
  SortAsc,
  FileText,
  Users,
  Highlighter,
} from 'lucide-react'
import { papers, users, projects, getUserById } from '@/lib/mock-data'
import { getStatusColor, getInitials, formatDate, formatRelativeTime } from '@/lib/utils'
import type { Paper, PaperStatus, Annotation } from '@/types'

const PAPER_FILTERS = ['All', 'Unread', 'Skimmed', 'Read', 'Deeply Read', 'Replicated', 'Cited'] as const
type PaperFilter = (typeof PAPER_FILTERS)[number]

const filterToStatus: Record<PaperFilter, PaperStatus | null> = {
  All: null,
  Unread: 'unread',
  Skimmed: 'skimmed',
  Read: 'read',
  'Deeply Read': 'deeply-read',
  Replicated: 'replicated',
  Cited: 'cited',
}

const SORT_OPTIONS = ['Date Added', 'Citations', 'Title', 'Year'] as const
type SortOption = (typeof SORT_OPTIONS)[number]

function getPaperStatusColor(status: PaperStatus) {
  const map: Record<PaperStatus, string> = {
    unread: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    skimmed: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    read: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'deeply-read': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    replicated: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    cited: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return map[status] ?? 'bg-surface-500/10 text-surface-400 border-surface-500/20'
}

function getAnnotationCategoryColor(category: string) {
  const map: Record<string, string> = {
    contribution: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    method: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dataset: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    limitation: 'bg-red-500/10 text-red-400 border-red-500/20',
    reproduced: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    disputed: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    inspirational: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  }
  return map[category] ?? 'bg-surface-500/10 text-surface-400 border-surface-500/20'
}

const READING_LISTS = [
  {
    name: 'MedViT Reading List',
    paperIds: ['pp1', 'pp3', 'pp13', 'pp11'],
    color: 'border-blue-500/30 bg-blue-500/5',
  },
  {
    name: 'NLP Foundations',
    paperIds: ['pp2', 'pp4', 'pp10'],
    color: 'border-emerald-500/30 bg-emerald-500/5',
  },
  {
    name: 'Robotics Core Papers',
    paperIds: ['pp8', 'pp15'],
    color: 'border-orange-500/30 bg-orange-500/5',
  },
]

export default function PapersPage() {
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [activeFilter, setActiveFilter] = useState<PaperFilter>('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('Date Added')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [paperStatuses, setPaperStatuses] = useState<Record<string, PaperStatus>>(() =>
    Object.fromEntries(papers.map(p => [p.id, p.status]))
  )

  const allAnnotations = useMemo(() => {
    const annots: (Annotation & { paperId: string; paperTitle: string })[] = []
    for (const p of papers) {
      for (const a of p.annotations) {
        annots.push({ ...a, paperId: p.id, paperTitle: p.title })
      }
    }
    return annots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 86400000)
    const readThisMonth = papers.filter(
      p =>
        (p.status === 'read' || p.status === 'deeply-read') &&
        new Date(p.addedAt) > monthAgo
    ).length
    const annotationsThisWeek = allAnnotations.filter(a => new Date(a.createdAt) > weekAgo).length
    const readerCounts: Record<string, number> = {}
    for (const p of papers) {
      for (const a of p.annotations) {
        readerCounts[a.userId] = (readerCounts[a.userId] ?? 0) + 1
      }
    }
    const topReaderId = Object.entries(readerCounts).sort(([, a], [, b]) => b - a)[0]?.[0]
    const topReader = topReaderId ? getUserById(topReaderId) : null
    return {
      total: papers.length,
      readThisMonth,
      annotationsThisWeek,
      topReader: topReader?.name ?? 'N/A',
    }
  }, [allAnnotations])

  const filtered = useMemo(() => {
    let result = papers.map(p => ({ ...p, status: paperStatuses[p.id] ?? p.status }))
    const statusKey = filterToStatus[activeFilter]
    if (statusKey) result = result.filter(p => p.status === statusKey)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some(a => a.toLowerCase().includes(q)) ||
          p.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    switch (sortBy) {
      case 'Citations':
        result.sort((a, b) => b.citations - a.citations)
        break
      case 'Title':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'Year':
        result.sort((a, b) => b.year - a.year)
        break
      default:
        result.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    }
    return result
  }, [activeFilter, search, sortBy, paperStatuses])

  function changeStatus(paperId: string, newStatus: PaperStatus) {
    setPaperStatuses(prev => ({ ...prev, [paperId]: newStatus }))
  }

  function formatAuthors(authors: string[]) {
    if (authors.length <= 3) return authors.join(', ')
    return `${authors.slice(0, 3).join(', ')} et al.`
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Papers" value={stats.total} icon={<BookOpen className="h-4 w-4 text-brand-400" />} />
        <StatCard label="Read this month" value={stats.readThisMonth} icon={<Eye className="h-4 w-4 text-emerald-400" />} />
        <StatCard label="Annotations this week" value={stats.annotationsThisWeek} icon={<Highlighter className="h-4 w-4 text-yellow-400" />} />
        <StatCard label="Most active reader" value={stats.topReader} icon={<Users className="h-4 w-4 text-purple-400" />} />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
            <BookOpen className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-surface-100">Paper Library</h1>
              <span className="rounded-full bg-surface-800 px-2.5 py-0.5 text-xs font-medium text-surface-300">
                {papers.length}
              </span>
            </div>
          </div>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Paper
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 border-b border-surface-800 pb-px">
          {PAPER_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeFilter === f ? 'tab-active' : 'tab-inactive'
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
              placeholder="Search papers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900/80 py-2 pl-10 pr-3 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-64"
            />
          </label>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-900/80 px-3 py-2 text-sm text-surface-300 transition-colors hover:border-surface-600"
            >
              <SortAsc className="h-4 w-4" />
              {sortBy}
              <ChevronDown className="h-3 w-3" />
            </button>
            {sortMenuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-surface-700 bg-surface-900 py-1 shadow-xl">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => {
                      setSortBy(opt)
                      setSortMenuOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                      sortBy === opt ? 'bg-brand-500/10 text-brand-400' : 'text-surface-300 hover:bg-surface-800'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-surface-700 bg-surface-900/80">
            <button
              onClick={() => setView('list')}
              className={`rounded-l-lg p-2 transition-colors ${
                view === 'list' ? 'bg-brand-500/10 text-brand-400' : 'text-surface-400 hover:text-surface-200'
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`rounded-r-lg p-2 transition-colors ${
                view === 'grid' ? 'bg-brand-500/10 text-brand-400' : 'text-surface-400 hover:text-surface-200'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Papers List / Grid */}
        <div className="min-w-0 flex-1">
          {view === 'list' ? (
            <div className="space-y-2">
              {filtered.map(paper => {
                const addedByUser = getUserById(paper.addedBy)
                return (
                  <div
                    key={paper.id}
                    onClick={() => setSelectedPaper(paper)}
                    className="cursor-pointer rounded-xl border border-surface-700/50 bg-surface-900/80 p-4 transition-all hover:border-brand-500/30 hover:bg-surface-800/60"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <h3 className="text-sm font-bold text-surface-100 leading-snug">{paper.title}</h3>
                        <p className="text-xs text-surface-400">{formatAuthors(paper.authors)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-surface-800 px-2 py-0.5 text-xs font-medium text-surface-300">
                            {paper.venue}
                          </span>
                          <span className="rounded bg-surface-800 px-2 py-0.5 text-xs text-surface-400">
                            {paper.year}
                          </span>
                          <span className={`badge text-xs ${getPaperStatusColor(paper.status)}`}>
                            {paper.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {paper.tags.map(tag => (
                            <span
                              key={tag}
                              className="rounded-full bg-surface-800/80 px-2 py-0.5 text-[10px] font-medium text-surface-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-surface-400 lg:flex-col lg:items-end lg:gap-2">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {paper.citations.toLocaleString()}
                        </span>
                        {addedByUser && (
                          <span className="text-surface-500">by {addedByUser.name.split(' ')[0]}</span>
                        )}
                        <div className="flex gap-1.5">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedPaper(paper)
                            }}
                            className="rounded-md border border-surface-700 px-2 py-1 text-[10px] font-medium text-surface-400 transition-colors hover:border-brand-500/30 hover:text-brand-400"
                          >
                            Status
                          </button>
                          <button
                            onClick={e => e.stopPropagation()}
                            className="rounded-md border border-surface-700 px-2 py-1 text-[10px] font-medium text-surface-400 transition-colors hover:border-brand-500/30 hover:text-brand-400"
                          >
                            Link
                          </button>
                          <button
                            onClick={e => e.stopPropagation()}
                            className="rounded-md border border-surface-700 px-2 py-1 text-[10px] font-medium text-surface-400 transition-colors hover:border-brand-500/30 hover:text-brand-400"
                          >
                            Annotate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(paper => {
                const addedByUser = getUserById(paper.addedBy)
                return (
                  <div
                    key={paper.id}
                    onClick={() => setSelectedPaper(paper)}
                    className="cursor-pointer bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 card-hover"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`badge text-xs ${getPaperStatusColor(paper.status)}`}>
                        {paper.status}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-surface-400">
                        <TrendingUp className="h-3 w-3" />
                        {paper.citations.toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-surface-100 leading-snug line-clamp-2 mb-1.5">
                      {paper.title}
                    </h3>
                    <p className="text-xs text-surface-400 line-clamp-1 mb-2">{formatAuthors(paper.authors)}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="rounded bg-surface-800 px-2 py-0.5 text-xs text-surface-300">
                        {paper.venue}
                      </span>
                      <span className="text-xs text-surface-500">{paper.year}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {paper.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="rounded-full bg-surface-800/80 px-2 py-0.5 text-[10px] font-medium text-surface-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {addedByUser && (
                      <p className="text-[10px] text-surface-500">Added by {addedByUser.name}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-surface-500">
              <BookOpen className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-lg font-medium">No papers match your filters</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </div>
          )}

          {/* Reading Lists */}
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-bold text-surface-100">Reading Lists</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {READING_LISTS.map(list => (
                <div
                  key={list.name}
                  className={`rounded-xl border p-4 ${list.color}`}
                >
                  <h3 className="mb-3 text-sm font-semibold text-surface-200">{list.name}</h3>
                  <div className="space-y-2">
                    {list.paperIds.map(pid => {
                      const p = papers.find(pp => pp.id === pid)
                      if (!p) return null
                      return (
                        <div key={pid} className="flex items-start gap-2">
                          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-surface-400" />
                          <span className="text-xs text-surface-300 line-clamp-1">{p.title}</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-xs text-surface-500">{list.paperIds.length} papers</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Annotation Feed Sidebar */}
        <aside className="hidden w-72 shrink-0 xl:block">
          <div className="sticky top-20 rounded-xl border border-surface-700/50 bg-surface-900/80 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-200">
              <Highlighter className="h-4 w-4 text-yellow-400" />
              Annotation Feed
            </h3>
            <div className="space-y-3">
              {allAnnotations.slice(0, 8).map(a => {
                const annotUser = getUserById(a.userId)
                return (
                  <div key={a.id} className="border-b border-surface-800 pb-3 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-[8px] font-semibold text-brand-300">
                        {annotUser ? getInitials(annotUser.name) : '??'}
                      </div>
                      <span className="text-xs font-medium text-surface-300">
                        {annotUser?.name.split(' ')[0]}
                      </span>
                      <span className="text-[10px] text-surface-500">{formatRelativeTime(a.createdAt)}</span>
                    </div>
                    <p className="text-xs text-surface-400">
                      <span className="text-surface-500">highlighted: </span>
                      &lsquo;{a.highlight}&rsquo;
                      <span className="text-surface-500"> in </span>
                      <span className="text-brand-400">{a.paperTitle}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Paper Detail Modal */}
      {selectedPaper && (
        <PaperDetailModal
          paper={selectedPaper}
          paperStatuses={paperStatuses}
          onChangeStatus={changeStatus}
          onClose={() => setSelectedPaper(null)}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-700/50 bg-surface-900/80 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-800">{icon}</div>
      <div>
        <p className="text-lg font-bold text-surface-100">{value}</p>
        <p className="text-xs text-surface-500">{label}</p>
      </div>
    </div>
  )
}

const ALL_STATUSES: PaperStatus[] = ['unread', 'skimmed', 'read', 'deeply-read', 'replicated', 'cited']

function PaperDetailModal({
  paper,
  paperStatuses,
  onChangeStatus,
  onClose,
}: {
  paper: Paper
  paperStatuses: Record<string, PaperStatus>
  onChangeStatus: (id: string, s: PaperStatus) => void
  onClose: () => void
}) {
  const [statusOpen, setStatusOpen] = useState(false)
  const currentStatus = paperStatuses[paper.id] ?? paper.status
  const addedByUser = getUserById(paper.addedBy)
  const linkedProjects = projects.filter(p => paper.projectIds.includes(p.id))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-[5vh]">
      <div className="relative w-full max-w-3xl rounded-2xl border border-surface-700/50 bg-surface-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-surface-800 p-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`badge ${getPaperStatusColor(currentStatus)}`}>{currentStatus}</span>
              <span className="text-xs text-surface-500">{paper.venue} · {paper.year}</span>
            </div>
            <h2 className="text-xl font-bold text-surface-100 leading-tight">{paper.title}</h2>
            <p className="mt-2 text-sm text-surface-400">{paper.authors.join(', ')}</p>
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
          {/* Status Changer */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">Status</span>
            <div className="relative">
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className={`badge flex items-center gap-1.5 cursor-pointer ${getPaperStatusColor(currentStatus)}`}
              >
                {currentStatus}
                <ChevronDown className="h-3 w-3" />
              </button>
              {statusOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-surface-700 bg-surface-900 py-1 shadow-xl">
                  {ALL_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        onChangeStatus(paper.id, s)
                        setStatusOpen(false)
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                        currentStatus === s ? 'bg-brand-500/10 text-brand-400' : 'text-surface-300 hover:bg-surface-800'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1.5 text-xs text-brand-400 transition-colors hover:text-brand-300"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Paper
              </a>
            )}
          </div>

          <Section label="Abstract">
            <p className="text-sm text-surface-300 leading-relaxed">{paper.abstract}</p>
          </Section>

          {paper.keyFindings.length > 0 && (
            <Section label="Key Findings">
              <ul className="space-y-1.5">
                {paper.keyFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section label="Tags">
            <div className="flex flex-wrap gap-2">
              {paper.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-full bg-surface-800 px-2.5 py-1 text-xs font-medium text-surface-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Section>

          <Section label="Citations">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-surface-100">{paper.citations.toLocaleString()}</span>
              <span className="text-surface-500">citations</span>
            </div>
          </Section>

          {/* Annotations */}
          <Section label={`Annotations (${paper.annotations.length})`}>
            {paper.annotations.length > 0 ? (
              <div className="space-y-3">
                {paper.annotations.map(a => {
                  const annotUser = getUserById(a.userId)
                  return (
                    <div key={a.id} className="flex gap-3 rounded-lg bg-surface-800/50 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-300">
                        {annotUser ? getInitials(annotUser.name) : '??'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs mb-1">
                          <span className="font-medium text-surface-200">{annotUser?.name ?? 'Unknown'}</span>
                          <span className={`badge text-[10px] ${getAnnotationCategoryColor(a.category)}`}>
                            {a.category}
                          </span>
                          <span className="text-surface-500">{formatDate(a.createdAt)}</span>
                        </div>
                        {a.highlight && (
                          <p className="mb-1 rounded bg-yellow-500/5 px-2 py-1 text-xs italic text-yellow-300/80 border-l-2 border-yellow-500/30">
                            &ldquo;{a.highlight}&rdquo;
                          </p>
                        )}
                        <p className="text-sm text-surface-300">{a.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-surface-500 italic">No annotations yet</p>
            )}
          </Section>

          {/* Linked Projects */}
          {linkedProjects.length > 0 && (
            <Section label="Linked Projects">
              <div className="space-y-2">
                {linkedProjects.map(proj => (
                  <div key={proj.id} className="flex items-center gap-2 text-sm">
                    <FolderOpen className="h-4 w-4 text-brand-400" />
                    <span className="text-surface-300">{proj.title}</span>
                    <span className={`badge text-[10px] ${getStatusColor(proj.status)}`}>{proj.status}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {addedByUser && (
            <Section label="Added By">
              <div className="flex items-center gap-2 text-sm text-surface-300">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-semibold text-brand-300">
                  {getInitials(addedByUser.name)}
                </div>
                {addedByUser.name}
                <span className="text-surface-500">· {formatDate(paper.addedAt)}</span>
              </div>
            </Section>
          )}
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
