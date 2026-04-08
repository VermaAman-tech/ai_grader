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
  ChevronDown,
  ChevronRight,
  GitCommit,
  Star,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { useDataStore } from '@/contexts/DataStore'
import { cn } from '@/lib/utils'

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

const categoryOrder = [
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

const mockGitHubRepos = [
  { name: 'medvit-segmentation', stars: 47, language: 'Python', lastCommit: '2 hours ago' },
  { name: 'linguabridge-adapters', stars: 23, language: 'Python', lastCommit: '1 day ago' },
  { name: 'nerf-edit-interactive', stars: 156, language: 'Python', lastCommit: '3 days ago' },
  { name: 'codereason-bench', stars: 12, language: 'TypeScript', lastCommit: '5 days ago' },
]

const mockGitHubCommits = [
  { sha: 'a3f7b2c', message: 'fix: boundary loss weight sweep for MedViT v3', author: 'Arjun Mehta', time: '2h ago' },
  { sha: 'e91d4f8', message: 'feat: add Dravidian script adapter module', author: 'Sneha Iyer', time: '1d ago' },
  { sha: 'c5b8a12', message: 'refactor: clean up CLIP-guided optimization loop', author: 'Meera Patel', time: '3d ago' },
]

const langColors: Record<string, string> = {
  Python: 'bg-blue-500',
  TypeScript: 'bg-blue-400',
  JavaScript: 'bg-yellow-400',
  Rust: 'bg-orange-500',
}

export default function IntegrationsPage() {
  const { integrations, toggleIntegration } = useDataStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [configureId, setConfigureId] = useState<string | null>(null)

  const connectedCount = integrations.filter(i => i.connected).length

  function toggleCategory(cat: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const grouped = useMemo(() => {
    const filtered = integrations.filter(i => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      )
    })

    const groups: Record<string, typeof filtered> = {}
    for (const cat of categoryOrder) {
      const items = filtered.filter(i => i.category === cat)
      if (items.length > 0) groups[cat] = items
    }
    return groups
  }, [integrations, searchQuery])

  const githubIntegration = integrations.find(i => i.name === 'GitHub')
  const isGitHubConnected = githubIntegration?.connected ?? false

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-xl flex items-center justify-center">
            <Plug className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Integrations</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              <span className="text-brand-600 dark:text-brand-400 font-semibold">{connectedCount}</span> of{' '}
              {integrations.length} connected
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700/50 rounded-xl px-4 py-2.5 max-w-md focus-within:border-brand-400/50 transition-colors shadow-sm dark:shadow-none">
        <Search className="w-4 h-4 text-surface-400 dark:text-surface-500 mr-2 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search integrations..."
          className="flex-1 bg-transparent text-sm text-surface-900 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-500 outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isGitHubConnected && (
        <section className="rounded-2xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 overflow-hidden shadow-sm dark:shadow-none">
          <div className="px-6 py-4 bg-gradient-to-r from-surface-50 dark:from-surface-800/50 to-transparent border-b border-surface-200 dark:border-surface-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-surface-900 dark:bg-white rounded-xl flex items-center justify-center">
                  <Github className="w-5 h-5 text-white dark:text-surface-900" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">GitHub</h2>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Connected &middot; VILL-Lab organization</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfigureId(githubIntegration?.id ?? null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configure
                </button>
                <button
                  onClick={() => githubIntegration && toggleIntegration(githubIntegration.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-surface-200 dark:divide-surface-700/50">
            <div className="p-6">
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">Connected Repositories</h3>
              <div className="space-y-2">
                {mockGitHubRepos.map(repo => (
                  <div
                    key={repo.name}
                    className="flex items-center justify-between rounded-lg border border-surface-100 dark:border-surface-700/50 bg-surface-50 dark:bg-surface-800/50 px-3 py-2.5 hover:border-surface-200 dark:hover:border-surface-600/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GitBranch className="w-4 h-4 shrink-0 text-surface-400 dark:text-surface-500" />
                      <span className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                        {repo.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-surface-400 dark:text-surface-500">
                      <span className="flex items-center gap-1">
                        <span className={cn('w-2.5 h-2.5 rounded-full', langColors[repo.language] || 'bg-surface-400')} />
                        {repo.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {repo.stars}
                      </span>
                      <span className="hidden sm:inline">{repo.lastCommit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">Recent Commits</h3>
              <div className="space-y-3">
                {mockGitHubCommits.map(commit => (
                  <div key={commit.sha} className="flex items-start gap-3">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
                      <GitCommit className="w-3.5 h-3.5 text-surface-500 dark:text-surface-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-surface-800 dark:text-surface-200 truncate">{commit.message}</p>
                      <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                        <span className="font-medium text-surface-600 dark:text-surface-400">{commit.author}</span>
                        {' '}&middot;{' '}
                        <code className="text-[10px] font-mono bg-surface-100 dark:bg-surface-800 px-1 py-0.5 rounded">{commit.sha}</code>
                        {' '}&middot; {commit.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-4 flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
                View all on GitHub
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => {
          const isCollapsed = collapsedCategories.has(category)
          const connectedInCat = items.filter(i => i.connected).length

          return (
            <section key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 mb-3 group"
              >
                <span className="text-surface-400 dark:text-surface-500 transition-transform duration-200">
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
                <h2 className="text-sm font-semibold text-surface-600 dark:text-surface-300 uppercase tracking-wider">
                  {category}
                </h2>
                <span className="text-xs text-surface-400 dark:text-surface-500">
                  {connectedInCat}/{items.length} connected
                </span>
                <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700/50 ml-2" />
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(integration => {
                    const Icon = iconMap[integration.icon] || Plug
                    const connected = integration.connected
                    const isGitHub = integration.name === 'GitHub'

                    if (isGitHub && connected) return null

                    return (
                      <div
                        key={integration.id}
                        className={cn(
                          'group/card rounded-xl border p-4 transition-all duration-200',
                          connected
                            ? 'bg-white dark:bg-surface-900/80 border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-none'
                            : 'bg-white dark:bg-surface-900/80 border-surface-200 dark:border-surface-700/50 hover:border-surface-300 dark:hover:border-surface-600/50 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none',
                        )}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                            connected
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                              : 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700/50 group-hover/card:border-brand-300 dark:group-hover/card:border-brand-400/30',
                          )}>
                            <Icon className={cn(
                              'w-5 h-5',
                              connected
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-surface-500 dark:text-surface-300',
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                              {integration.name}
                            </h3>
                            <span className="text-[10px] bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 px-2 py-0.5 rounded-full border border-surface-200 dark:border-surface-700/50">
                              {integration.category}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 mb-4 leading-relaxed">
                          {integration.description}
                        </p>

                        {connected ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Connected</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => toggleIntegration(integration.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-400/10 hover:bg-red-100 dark:hover:bg-red-400/20 rounded-lg transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Disconnect
                              </button>
                              <button
                                onClick={() => setConfigureId(integration.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
                              >
                                <Settings className="w-3 h-3" />
                                Configure
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleIntegration(integration.id)}
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
              )}
            </section>
          )
        })}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12">
          <Plug className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
          <p className="text-surface-500 dark:text-surface-400">No integrations match your search</p>
          <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">Try a different keyword</p>
        </div>
      )}

      {configureId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setConfigureId(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const integ = integrations.find(i => i.id === configureId)
                  const Icon = integ ? (iconMap[integ.icon] || Plug) : Plug
                  return (
                    <>
                      <div className="w-9 h-9 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4 text-surface-600 dark:text-surface-300" />
                      </div>
                      <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">
                        Configure {integ?.name}
                      </h2>
                    </>
                  )
                })()}
              </div>
              <button
                onClick={() => setConfigureId(null)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Sync Frequency</label>
                <select className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 appearance-none">
                  <option>Every 15 minutes</option>
                  <option>Every hour</option>
                  <option>Every 6 hours</option>
                  <option>Daily</option>
                  <option>Manual only</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Notifications</label>
                <div className="space-y-2">
                  {['New activity alerts', 'Daily digest summary', 'Error notifications'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-surface-400 dark:border-surface-600 bg-white dark:bg-surface-800 text-brand-500 focus:ring-brand-500/30"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">API Key</label>
                <input
                  type="password"
                  defaultValue="sk-xxxxxxxxxxxxxxxx"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-mono"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-surface-200 dark:border-surface-700/50 pt-5">
              <button
                onClick={() => setConfigureId(null)}
                className="rounded-lg border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfigureId(null)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                <Check className="h-4 w-4" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
