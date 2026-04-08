'use client'

import { useState, useMemo } from 'react'
import {
  Plug,
  Search,
  Check,
  Settings,
  X,
  MessageSquare,
  Github,
  BookOpen,
  BarChart2,
  FileText,
  GraduationCap,
  Newspaper,
  Library,
  Calendar,
  Users,
  HardDrive,
  Bookmark,
  Activity,
  Box,
  Cloud,
  Layers,
  File,
  Inbox,
  GitBranch,
  Database,
  HeartPulse,
  Waves,
  Zap,
  CheckSquare,
  Book,
  Layout,
  type LucideIcon,
} from 'lucide-react'
import { integrations } from '@/lib/mock-data'

const iconMap: Record<string, LucideIcon> = {
  'slack': MessageSquare,
  'book-open': BookOpen,
  'github': Github,
  'bar-chart-2': BarChart2,
  'file-text': FileText,
  'graduation-cap': GraduationCap,
  'newspaper': Newspaper,
  'library': Library,
  'calendar': Calendar,
  'users': Users,
  'hard-drive': HardDrive,
  'bookmark': Bookmark,
  'activity': Activity,
  'box': Box,
  'cloud': Cloud,
  'search': Search,
  'layers': Layers,
  'file': File,
  'inbox': Inbox,
  'git-branch': GitBranch,
  'database': Database,
  'heart-pulse': HeartPulse,
  'waves': Waves,
  'zap': Zap,
  'check-square': CheckSquare,
  'book': Book,
  'layout': Layout,
}

const categories = [
  'All',
  'Communication',
  'Code',
  'Experiment Tracking',
  'Paper Sources',
  'Reference Managers',
  'Writing',
  'Storage',
  'Calendar',
  'Cloud Compute',
  'Productivity',
]

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [connectionState, setConnectionState] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {}
    integrations.forEach(i => { state[i.id] = i.connected })
    return state
  })

  const connectedCount = Object.values(connectionState).filter(Boolean).length

  const filtered = useMemo(() => {
    return integrations.filter(i => {
      const matchesSearch =
        !searchQuery.trim() ||
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        activeCategory === 'All' || i.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [searchQuery, activeCategory])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center">
            <Plug className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-100">Integrations</h1>
            <p className="text-sm text-surface-400">
              <span className="text-brand-400 font-semibold">{connectedCount}</span> of{' '}
              {integrations.length} integrations connected
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center bg-surface-800 border border-surface-700/50 rounded-xl px-4 py-2.5 max-w-md focus-within:border-brand-400/50 transition-colors">
        <Search className="w-4 h-4 text-surface-500 mr-2 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search integrations..."
          className="flex-1 bg-transparent text-sm text-surface-200 placeholder-surface-500 outline-none"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-brand-500 text-white'
                : 'bg-surface-800 text-surface-400 border border-surface-700/50 hover:bg-surface-700 hover:text-surface-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(integration => {
          const Icon = iconMap[integration.icon] || Plug
          const connected = connectionState[integration.id]

          return (
            <div
              key={integration.id}
              className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-4 hover:border-surface-600/50 transition-all duration-200 group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-surface-800 border border-surface-700/50 rounded-xl flex items-center justify-center shrink-0 group-hover:border-brand-400/30 transition-colors">
                  <Icon className="w-5 h-5 text-surface-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-surface-100">
                    {integration.name}
                  </h3>
                  <span className="text-[10px] bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full border border-surface-700/50">
                    {integration.category}
                  </span>
                </div>
              </div>
              <p className="text-xs text-surface-400 line-clamp-2 mb-4 leading-relaxed">
                {integration.description}
              </p>

              {connected ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-xs text-emerald-400 font-medium">Connected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setConnectionState(s => ({ ...s, [integration.id]: false }))}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Disconnect
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1 text-xs text-surface-400 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">
                      <Settings className="w-3 h-3" />
                      Settings
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConnectionState(s => ({ ...s, [integration.id]: true }))}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Connect
                </button>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Plug className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400">No integrations match your search</p>
          <p className="text-surface-500 text-sm mt-1">Try a different keyword or category</p>
        </div>
      )}
    </div>
  )
}
