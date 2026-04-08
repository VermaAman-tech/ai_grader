'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Brain,
  Search,
  FileText,
  FlaskConical,
  Lightbulb,
  FolderOpen,
  MessageSquare,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  X,
  Tag,
  Calendar,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { useDataStore } from '@/contexts/DataStore'
import { getUserById } from '@/lib/mock-data'
import { cn, formatDate } from '@/lib/utils'

const searchModes = [
  { key: 'all', label: 'All', icon: Search },
  { key: 'papers', label: 'Papers', icon: FileText },
  { key: 'experiments', label: 'Experiments', icon: FlaskConical },
  { key: 'ideas', label: 'Ideas', icon: Lightbulb },
  { key: 'projects', label: 'Projects', icon: FolderOpen },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
] as const

type SearchMode = (typeof searchModes)[number]['key']

const suggestedQueries = [
  'What experiments used transformer architectures?',
  'Papers about federated learning in medical imaging',
  'Which project has the best health score?',
  'Show all failed experiments and their reasons',
  'Ideas with high novelty potential',
  'Active projects approaching deadlines',
]

interface SearchResult {
  type: 'paper' | 'experiment' | 'idea' | 'project'
  id: string
  title: string
  excerpt: string
  source: string
  date: string
  tags?: string[]
  status?: string
}

function getResultIcon(type: string) {
  switch (type) {
    case 'paper': return FileText
    case 'experiment': return FlaskConical
    case 'idea': return Lightbulb
    case 'project': return FolderOpen
    default: return Search
  }
}

const typeColors: Record<string, { text: string; bg: string; border: string }> = {
  paper: {
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-400/10',
    border: 'border-blue-200 dark:border-blue-500/20',
  },
  experiment: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-400/10',
    border: 'border-emerald-200 dark:border-emerald-500/20',
  },
  idea: {
    text: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-400/10',
    border: 'border-yellow-200 dark:border-yellow-500/20',
  },
  project: {
    text: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-400/10',
    border: 'border-purple-200 dark:border-purple-500/20',
  },
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  let result = text
  for (const term of terms) {
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    result = result.replace(regex, '|||$1|||')
  }
  const parts = result.split('|||')
  return (
    <>
      {parts.map((part, i) =>
        terms.some(t => part.toLowerCase() === t) ? (
          <mark key={i} className="rounded px-0.5 bg-brand-100 text-brand-700 dark:bg-brand-400/30 dark:text-brand-200">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export default function SearchPage() {
  const { papers, experiments, ideas, projects } = useDataStore()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('all')
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'token merging ablation results',
    'NeRF editing benchmarks',
    'sim2real cloth folding',
    'BERT multilingual adapters',
  ])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)

  const executeSearch = useCallback((term: string) => {
    setQuery(term)
    if (term.trim() && !recentSearches.includes(term.trim())) {
      setRecentSearches(prev => [term.trim(), ...prev.slice(0, 7)])
    }
  }, [recentSearches])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []

    const matched: SearchResult[] = []

    if (mode === 'all' || mode === 'papers') {
      papers.forEach(p => {
        if (
          p.title.toLowerCase().includes(q) ||
          p.abstract.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q)) ||
          p.authors.some(a => a.toLowerCase().includes(q))
        ) {
          matched.push({
            type: 'paper',
            id: p.id,
            title: p.title,
            excerpt: p.abstract.slice(0, 180) + '...',
            source: p.venue,
            date: String(p.year),
            tags: p.tags.slice(0, 3),
            status: p.status,
          })
        }
      })
    }

    if (mode === 'all' || mode === 'experiments') {
      experiments.forEach(e => {
        const proj = projects.find(p => p.id === e.projectId)
        if (
          e.title.toLowerCase().includes(q) ||
          e.setup.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q) ||
          e.dataset.toLowerCase().includes(q)
        ) {
          matched.push({
            type: 'experiment',
            id: e.id,
            title: e.title,
            excerpt: e.setup.slice(0, 180) + '...',
            source: proj?.title || 'Unknown Project',
            date: e.runDate,
            status: e.status,
          })
        }
      })
    }

    if (mode === 'all' || mode === 'ideas') {
      ideas.forEach(i => {
        if (
          i.title.toLowerCase().includes(q) ||
          i.hypothesis.toLowerCase().includes(q) ||
          i.method.toLowerCase().includes(q) ||
          i.motivation.toLowerCase().includes(q)
        ) {
          const proj = projects.find(p => p.id === i.projectId)
          matched.push({
            type: 'idea',
            id: i.id,
            title: i.title,
            excerpt: i.hypothesis.slice(0, 180) + '...',
            source: proj?.title || 'Unknown Project',
            date: i.createdAt,
            status: i.status,
          })
        }
      })
    }

    if (mode === 'all' || mode === 'projects') {
      projects.forEach(p => {
        if (
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.domain.some(d => d.toLowerCase().includes(q)) ||
          p.targetVenue.toLowerCase().includes(q)
        ) {
          matched.push({
            type: 'project',
            id: p.id,
            title: p.title,
            excerpt: p.description.slice(0, 180) + '...',
            source: p.targetVenue,
            date: p.createdAt,
            tags: p.domain.slice(0, 3),
            status: p.status,
          })
        }
      })
    }

    return matched
  }, [query, mode, papers, experiments, ideas, projects])

  const isSemanticQuery =
    query.trim().length > 20 ||
    query.includes('?') ||
    query.toLowerCase().startsWith('what') ||
    query.toLowerCase().startsWith('which') ||
    query.toLowerCase().startsWith('show') ||
    query.toLowerCase().startsWith('how')

  const resultTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { paper: 0, experiment: 0, idea: 0, project: 0 }
    results.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1 })
    return counts
  }, [results])

  const clearRecent = useCallback((term: string) => {
    setRecentSearches(prev => prev.filter(s => s !== term))
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      {/* Search Header */}
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10">
            <Brain className="h-6 w-6 text-brand-500 dark:text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
            AI-Powered Search
          </h1>
        </div>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Search across papers, experiments, ideas, and conversations using natural language
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center rounded-2xl border border-surface-200 bg-white px-5 py-4 shadow-sm transition-colors focus-within:border-brand-400 focus-within:shadow-md focus-within:shadow-brand-500/5 dark:border-surface-700/50 dark:bg-surface-800 dark:shadow-lg dark:shadow-black/20 dark:focus-within:border-brand-400/50">
          <Brain className="mr-3 h-5 w-5 shrink-0 text-brand-500 dark:text-brand-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && query.trim()) {
                executeSearch(query)
              }
            }}
            placeholder="Ask anything about your lab's research..."
            className="flex-1 bg-transparent text-base text-surface-900 outline-none placeholder:text-surface-400 dark:text-surface-100 dark:placeholder:text-surface-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="mr-3 text-sm text-surface-400 transition-colors hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => executeSearch(query)}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="mx-auto flex w-fit items-center gap-1 rounded-xl border border-surface-200 bg-surface-50 p-1 dark:border-surface-700/50 dark:bg-surface-900/80">
        {searchModes.map(m => {
          const Icon = m.icon
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                mode === m.key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-surface-500 hover:bg-white hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Results / Default State */}
      {query.trim() ? (
        <div className="space-y-4">
          {/* AI Summary */}
          {isSemanticQuery && results.length > 0 && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-400/20 dark:bg-brand-400/5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-500/20">
                  <Sparkles className="h-4 w-4 text-brand-500 dark:text-brand-400" />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
                    AI Summary
                  </h3>
                  <p className="text-sm leading-relaxed text-surface-600 dark:text-surface-300">
                    Based on your lab&apos;s data, I found{' '}
                    <strong className="text-surface-900 dark:text-surface-100">{results.length} relevant results</strong>{' '}
                    matching your query. The most relevant items span across{' '}
                    {Array.from(new Set(results.map(r => r.type))).length} categories
                    including{' '}
                    {Array.from(new Set(results.map(r => r.type))).join(', ')}.
                    {results[0] && (
                      <>
                        {' '}The top match is{' '}
                        <strong className="text-surface-900 dark:text-surface-100">&quot;{results[0].title}&quot;</strong>{' '}
                        from {results[0].source}.
                      </>
                    )}
                  </p>
                  {/* Type breakdown */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(resultTypeCounts)
                      .filter(([, count]) => count > 0)
                      .map(([type, count]) => {
                        const colors = typeColors[type]
                        return (
                          <span
                            key={type}
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                              colors.text, colors.bg, colors.border
                            )}
                          >
                            {count} {type}{count !== 1 ? 's' : ''}
                          </span>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Result Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500 dark:text-surface-500">
              {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
              {mode !== 'all' && ` in ${mode}`}
            </p>
            <div className="flex items-center gap-1 text-xs text-surface-400">
              <Filter className="h-3 w-3" />
              <span>Filtered by: {mode === 'all' ? 'All categories' : mode}</span>
            </div>
          </div>

          {/* Result Cards */}
          {results.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="mx-auto mb-3 h-12 w-12 text-surface-300 dark:text-surface-600" />
              <p className="text-surface-600 dark:text-surface-400">No results found for &quot;{query}&quot;</p>
              <p className="mt-1 text-sm text-surface-400 dark:text-surface-500">Try different keywords or search modes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(result => {
                const Icon = getResultIcon(result.type)
                const colors = typeColors[result.type]

                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => setSelectedResult(selectedResult?.id === result.id ? null : result)}
                    className={cn(
                      'group w-full cursor-pointer rounded-xl border p-4 text-left transition-all',
                      selectedResult?.id === result.id
                        ? 'border-brand-300 bg-brand-50 shadow-sm dark:border-brand-500/30 dark:bg-brand-500/5'
                        : 'border-surface-200 bg-white hover:border-surface-300 hover:shadow-sm dark:border-surface-700/50 dark:bg-surface-900/80 dark:hover:border-surface-600/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', colors.bg)}>
                        <Icon className={cn('h-4 w-4', colors.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', colors.text, colors.bg, colors.border)}>
                            {result.type}
                          </span>
                          {result.status && (
                            <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-medium text-surface-500 dark:bg-surface-800 dark:text-surface-400">
                              {result.status}
                            </span>
                          )}
                          <span className="text-xs text-surface-400 dark:text-surface-500">
                            {result.source}
                          </span>
                          <span className="text-xs text-surface-300 dark:text-surface-600">&middot;</span>
                          <span className="flex items-center gap-1 text-xs text-surface-400 dark:text-surface-500">
                            <Calendar className="h-3 w-3" />
                            {result.date}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-surface-900 transition-colors group-hover:text-brand-600 dark:text-surface-100 dark:group-hover:text-brand-400">
                          {highlightMatch(result.title, query)}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-surface-500 dark:text-surface-400">
                          {highlightMatch(result.excerpt, query)}
                        </p>
                        {result.tags && result.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {result.tags.map((tag, i) => (
                              <span key={i} className="flex items-center gap-1 rounded-md bg-surface-100 px-1.5 py-0.5 text-[10px] text-surface-500 dark:bg-surface-800 dark:text-surface-400">
                                <Tag className="h-2.5 w-2.5" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Expanded detail panel */}
                        {selectedResult?.id === result.id && (
                          <div className="mt-3 rounded-lg border border-brand-100 bg-white p-3 dark:border-brand-500/10 dark:bg-surface-800/50">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-surface-600 dark:text-surface-300">Quick Actions</p>
                              <ChevronRight className="h-3 w-3 text-surface-400" />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button className="flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1 text-[11px] font-medium text-surface-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-400">
                                <ExternalLink className="h-3 w-3" />
                                Open Details
                              </button>
                              <button className="flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1 text-[11px] font-medium text-surface-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-400">
                                <FileText className="h-3 w-3" />
                                Add to Paper
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-surface-300 transition-colors group-hover:text-brand-500 dark:text-surface-600 dark:group-hover:text-brand-400" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Recent Searches */}
          <div className="rounded-xl border border-surface-200 bg-white p-5 dark:border-surface-700/50 dark:bg-surface-900/80">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-surface-400" />
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                Recent Searches
              </h3>
            </div>
            <div className="space-y-1">
              {recentSearches.length === 0 ? (
                <p className="py-4 text-center text-xs text-surface-400 dark:text-surface-500">No recent searches</p>
              ) : (
                recentSearches.map((s, i) => (
                  <div key={i} className="group flex items-center gap-1">
                    <button
                      onClick={() => executeSearch(s)}
                      className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-surface-500 transition-colors hover:bg-surface-50 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span className="truncate">{s}</span>
                    </button>
                    <button
                      onClick={() => clearRecent(s)}
                      className="rounded-md p-1 text-surface-300 opacity-0 transition-all hover:bg-surface-100 hover:text-surface-500 group-hover:opacity-100 dark:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Suggested Queries */}
          <div className="rounded-xl border border-surface-200 bg-white p-5 dark:border-surface-700/50 dark:bg-surface-900/80">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-500 dark:text-brand-400" />
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                Suggested Queries
              </h3>
            </div>
            <div className="space-y-1">
              {suggestedQueries.map((s, i) => (
                <button
                  key={i}
                  onClick={() => executeSearch(s)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-surface-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-surface-400 dark:hover:bg-brand-400/5 dark:hover:text-brand-300"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-400 opacity-50" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-surface-200 bg-white p-5 md:col-span-2 dark:border-surface-700/50 dark:bg-surface-900/80">
            <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Searchable Data</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Papers', count: papers.length, icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-400/10' },
                { label: 'Experiments', count: experiments.length, icon: FlaskConical, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-400/10' },
                { label: 'Ideas', count: ideas.length, icon: Lightbulb, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-400/10' },
                { label: 'Projects', count: projects.length, icon: FolderOpen, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-400/10' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg border border-surface-100 bg-surface-50 p-3 dark:border-surface-700/40 dark:bg-surface-800/40">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', item.bg)}>
                      <Icon className={cn('h-4 w-4', item.color)} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-surface-900 dark:text-surface-100">{item.count}</p>
                      <p className="text-[11px] text-surface-400 dark:text-surface-500">{item.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
