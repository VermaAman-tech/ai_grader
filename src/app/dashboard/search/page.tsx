'use client'

import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import { papers, experiments, ideas, projects, getUserById } from '@/lib/mock-data'

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
]

const recentSearches = [
  'token merging ablation results',
  'NeRF editing benchmarks',
  'sim2real cloth folding',
  'BERT multilingual adapters',
]

interface SearchResult {
  type: 'paper' | 'experiment' | 'idea' | 'project'
  id: string
  title: string
  excerpt: string
  source: string
  date: string
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

const typeColors: Record<string, string> = {
  paper: 'text-blue-400 bg-blue-400/10',
  experiment: 'text-emerald-400 bg-emerald-400/10',
  idea: 'text-yellow-400 bg-yellow-400/10',
  project: 'text-purple-400 bg-purple-400/10',
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
          <mark key={i} className="bg-brand-400/30 text-brand-200 rounded px-0.5">
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
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('all')

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []

    const matched: SearchResult[] = []

    if (mode === 'all' || mode === 'papers') {
      papers.forEach(p => {
        if (
          p.title.toLowerCase().includes(q) ||
          p.abstract.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q))
        ) {
          matched.push({
            type: 'paper',
            id: p.id,
            title: p.title,
            excerpt: p.abstract.slice(0, 160) + '...',
            source: p.venue,
            date: String(p.year),
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
          e.notes.toLowerCase().includes(q)
        ) {
          matched.push({
            type: 'experiment',
            id: e.id,
            title: e.title,
            excerpt: e.setup.slice(0, 160) + '...',
            source: proj?.title || 'Unknown Project',
            date: e.runDate,
          })
        }
      })
    }

    if (mode === 'all' || mode === 'ideas') {
      ideas.forEach(i => {
        if (
          i.title.toLowerCase().includes(q) ||
          i.hypothesis.toLowerCase().includes(q) ||
          i.method.toLowerCase().includes(q)
        ) {
          const proj = projects.find(p => p.id === i.projectId)
          matched.push({
            type: 'idea',
            id: i.id,
            title: i.title,
            excerpt: i.hypothesis.slice(0, 160) + '...',
            source: proj?.title || 'Unknown Project',
            date: i.createdAt,
          })
        }
      })
    }

    if (mode === 'all' || mode === 'projects') {
      projects.forEach(p => {
        if (
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.domain.some(d => d.toLowerCase().includes(q))
        ) {
          matched.push({
            type: 'project',
            id: p.id,
            title: p.title,
            excerpt: p.description.slice(0, 160) + '...',
            source: p.targetVenue,
            date: p.createdAt,
          })
        }
      })
    }

    return matched
  }, [query, mode])

  const isSemanticQuery =
    query.trim().length > 20 ||
    query.includes('?') ||
    query.toLowerCase().startsWith('what') ||
    query.toLowerCase().startsWith('which') ||
    query.toLowerCase().startsWith('show') ||
    query.toLowerCase().startsWith('how')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Search Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-surface-100">
            AI-Powered Search
          </h1>
        </div>
        <p className="text-surface-400 text-sm">
          Search across papers, experiments, ideas, and conversations using natural language
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center bg-surface-800 border border-surface-700/50 rounded-2xl px-5 py-4 focus-within:border-brand-400/50 transition-colors shadow-lg shadow-black/20">
          <Brain className="w-5 h-5 text-brand-400 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask anything about your lab's research..."
            className="flex-1 bg-transparent text-surface-100 placeholder-surface-500 text-base outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-surface-500 hover:text-surface-300 text-sm mr-3 transition-colors"
            >
              Clear
            </button>
          )}
          <button className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-1 bg-surface-900/80 border border-surface-700/50 rounded-xl p-1 w-fit mx-auto">
        {searchModes.map(m => {
          const Icon = m.icon
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m.key
                  ? 'bg-brand-500 text-white'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
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
            <div className="bg-brand-400/5 border border-brand-400/20 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-brand-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-brand-300 mb-1">
                    AI Summary
                  </h3>
                  <p className="text-sm text-surface-300 leading-relaxed">
                    Based on your lab&apos;s data, I found{' '}
                    <strong className="text-surface-100">{results.length} relevant results</strong>{' '}
                    matching your query. The most relevant items span across{' '}
                    {Array.from(new Set(results.map(r => r.type))).length} categories
                    including{' '}
                    {Array.from(new Set(results.map(r => r.type))).join(', ')}.
                    {results[0] && (
                      <>
                        {' '}The top match is{' '}
                        <strong className="text-surface-100">&quot;{results[0].title}&quot;</strong>{' '}
                        from {results[0].source}.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Result Count */}
          <p className="text-sm text-surface-500">
            {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
            {mode !== 'all' && ` in ${mode}`}
          </p>

          {/* Result Cards */}
          {results.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400">No results found for &quot;{query}&quot;</p>
              <p className="text-surface-500 text-sm mt-1">Try different keywords or search modes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(result => {
                const Icon = getResultIcon(result.type)
                const colors = typeColors[result.type]

                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-4 hover:border-surface-600/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors}`}>
                            {result.type}
                          </span>
                          <span className="text-xs text-surface-500">
                            {result.source}
                          </span>
                          <span className="text-xs text-surface-600">•</span>
                          <span className="text-xs text-surface-500">
                            {result.date}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-surface-100 group-hover:text-brand-400 transition-colors">
                          {highlightMatch(result.title, query)}
                        </h3>
                        <p className="text-xs text-surface-400 mt-1 line-clamp-2 leading-relaxed">
                          {highlightMatch(result.excerpt, query)}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-surface-600 group-hover:text-brand-400 transition-colors shrink-0 mt-1" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Searches */}
          <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-surface-400" />
              <h3 className="text-sm font-semibold text-surface-200">
                Recent Searches
              </h3>
            </div>
            <div className="space-y-2">
              {recentSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(s)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Suggested Queries */}
          <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-surface-200">
                Suggested Queries
              </h3>
            </div>
            <div className="space-y-2">
              {suggestedQueries.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(s)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-400 hover:bg-brand-400/5 hover:text-brand-300 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-brand-400 opacity-50" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
