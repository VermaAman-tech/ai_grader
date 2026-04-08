'use client'

import { useState, useMemo } from 'react'
import {
  Award,
  FileText,
  Quote,
  TrendingUp,
  BarChart3,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  Star,
  Calendar,
  Users,
  Filter,
} from 'lucide-react'
import { useDataStore } from '@/contexts/DataStore'
import { getUserById } from '@/lib/mock-data'
import { cn, formatDate, getStatusColor } from '@/lib/utils'

type SortKey = 'title' | 'venue' | 'status' | 'submittedDate' | 'citations' | 'impactFactor'
type SortDir = 'asc' | 'desc'

const pubStatusColors: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  'under-review': 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
}

const citationFeed = [
  {
    paper: 'EdgeViT',
    citedBy: 'Liu et al. "Efficient Token Routing for Mobile ViTs"',
    context: 'efficient inference on resource-constrained devices',
    venue: 'AAAI 2025',
    date: '2025-03-20',
  },
  {
    paper: 'EdgeViT',
    citedBy: 'Chen et al. "Hardware-Aware Neural Architecture Search"',
    context: 'dynamic token pruning strategies for edge deployment',
    venue: 'DAC 2025',
    date: '2025-03-15',
  },
  {
    paper: 'Attention-Driven Feature Aggregation',
    citedBy: 'Wang et al. "Real-Time Panoptic Segmentation"',
    context: 'feature aggregation in real-time segmentation pipelines',
    venue: 'CVPR 2025',
    date: '2025-03-10',
  },
  {
    paper: 'Self-Supervised Pretraining Survey',
    citedBy: 'Patel et al. "Foundation Models for Pathology"',
    context: 'survey of self-supervised methods for medical imaging',
    venue: 'Nature Medicine',
    date: '2025-03-05',
  },
]

const venueIntelligence = [
  { venue: 'CVPR', acceptanceRate: '25.3%', avgReviewTime: '3 months', tier: 'A*', papers: 2 },
  { venue: 'NeurIPS', acceptanceRate: '26.1%', avgReviewTime: '4 months', tier: 'A*', papers: 1 },
  { venue: 'ECCV', acceptanceRate: '28.0%', avgReviewTime: '3 months', tier: 'A*', papers: 1 },
  { venue: 'ACL', acceptanceRate: '23.5%', avgReviewTime: '3 months', tier: 'A*', papers: 1 },
  { venue: 'ICCV', acceptanceRate: '25.9%', avgReviewTime: '4 months', tier: 'A*', papers: 1 },
]

function computeHIndex(citations: number[]): number {
  const sorted = [...citations].sort((a, b) => b - a)
  let h = 0
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1
    else break
  }
  return h
}

export default function PublicationsPage() {
  const { publications } = useDataStore()
  const [sortKey, setSortKey] = useState<SortKey>('submittedDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const totalCitations = publications.reduce((s, p) => s + p.citations, 0)
  const publishedCount = publications.filter(p => p.status === 'published' || p.status === 'accepted').length
  const hIndex = computeHIndex(publications.map(p => p.citations))
  const avgImpactFactor = publications.length > 0
    ? (publications.reduce((s, p) => s + p.impactFactor, 0) / publications.length).toFixed(1)
    : '0'

  const filteredPubs = useMemo(() => {
    if (statusFilter === 'all') return publications
    return publications.filter(p => p.status === statusFilter)
  }, [publications, statusFilter])

  const sorted = useMemo(() => {
    return [...filteredPubs].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title': cmp = a.title.localeCompare(b.title); break
        case 'venue': cmp = a.venue.localeCompare(b.venue); break
        case 'status': cmp = a.status.localeCompare(b.status); break
        case 'submittedDate': cmp = new Date(a.submittedDate).getTime() - new Date(b.submittedDate).getTime(); break
        case 'citations': cmp = a.citations - b.citations; break
        case 'impactFactor': cmp = a.impactFactor - b.impactFactor; break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [filteredPubs, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />
    return sortDir === 'desc'
      ? <ChevronDown className="h-3 w-3 text-brand-500 dark:text-brand-400" />
      : <ChevronUp className="h-3 w-3 text-brand-500 dark:text-brand-400" />
  }

  const pubsByYear: Record<number, number> = {}
  publications.forEach(p => {
    const yr = new Date(p.submittedDate).getFullYear()
    pubsByYear[yr] = (pubsByYear[yr] || 0) + 1
  })
  const years = Object.keys(pubsByYear).sort()
  const maxPubYear = Math.max(...Object.values(pubsByYear), 1)

  const venueDistribution: Record<string, number> = {}
  publications.forEach(p => {
    const short = p.venue.split(' ')[0].replace(/[^a-zA-Z]/g, '')
    venueDistribution[short] = (venueDistribution[short] || 0) + 1
  })
  const venueColors = ['bg-brand-400', 'bg-emerald-400', 'bg-yellow-400', 'bg-cyan-400', 'bg-purple-400', 'bg-orange-400']
  const totalVenuePubs = Math.max(Object.values(venueDistribution).reduce((s, v) => s + v, 0), 1)

  const statusOptions = ['all', 'published', 'accepted', 'under-review', 'submitted', 'rejected']

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10">
          <Award className="h-5 w-5 text-brand-500 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Publications & Impact
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Track your lab&apos;s publication record and citation impact</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Publications', value: publications.length, icon: FileText, color: 'text-brand-500 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-400/10', trend: `${publishedCount} published` },
          { label: 'Total Citations', value: totalCitations, icon: Quote, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-400/10', trend: 'Across all papers' },
          { label: 'H-Index', value: hIndex, icon: TrendingUp, color: 'text-yellow-500 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-400/10', trend: 'Estimated from data' },
          { label: 'Avg Impact Factor', value: avgImpactFactor, icon: BarChart3, color: 'text-cyan-500 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-400/10', trend: 'Across venues' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-surface-200 bg-white p-5 dark:border-surface-700/50 dark:bg-surface-900/80">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-surface-400 dark:text-surface-400">
                  {stat.label}
                </span>
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', stat.bg)}>
                  <Icon className={cn('h-4 w-4', stat.color)} />
                </div>
              </div>
              <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{stat.value}</p>
              <p className="mt-1 text-[11px] text-surface-400 dark:text-surface-500">{stat.trend}</p>
            </div>
          )
        })}
      </div>

      {/* Publications Table */}
      <div className="overflow-hidden rounded-xl border border-surface-200 bg-white dark:border-surface-700/50 dark:bg-surface-900/80">
        <div className="flex items-center justify-between border-b border-surface-100 p-5 dark:border-surface-700/50">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">All Publications</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-surface-400" />
            <div className="flex gap-1">
              {statusOptions.map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                    statusFilter === status
                      ? 'bg-brand-500 text-white'
                      : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-300'
                  )}
                >
                  {status === 'all' ? 'All' : status.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-surface-500 dark:border-surface-700/50 dark:text-surface-400">
                {([
                  ['title', 'Title'],
                  ['venue', 'Venue'],
                  ['status', 'Status'],
                  ['submittedDate', 'Date'],
                  ['citations', 'Citations'],
                  ['impactFactor', 'IF'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="px-5 py-3 text-left font-medium">
                    <button
                      onClick={() => toggleSort(key)}
                      className="flex items-center gap-1 transition-colors hover:text-surface-700 dark:hover:text-surface-200"
                    >
                      {label}
                      <SortIcon col={key} />
                    </button>
                  </th>
                ))}
                <th className="px-5 py-3 text-left font-medium">Authors</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(pub => (
                <tr
                  key={pub.id}
                  onClick={() => setExpandedRow(expandedRow === pub.id ? null : pub.id)}
                  className={cn(
                    'cursor-pointer border-b transition-colors',
                    expandedRow === pub.id
                      ? 'border-brand-100 bg-brand-50/50 dark:border-brand-500/10 dark:bg-brand-500/5'
                      : 'border-surface-50 hover:bg-surface-50 dark:border-surface-800/50 dark:hover:bg-surface-800/30'
                  )}
                >
                  <td className="max-w-[300px] px-5 py-4">
                    <span className="font-medium text-surface-800 dark:text-surface-200 line-clamp-1">
                      {pub.title}
                    </span>
                    {expandedRow === pub.id && (
                      <div className="mt-2 flex gap-2">
                        <button className="flex items-center gap-1 rounded-md border border-surface-200 bg-white px-2 py-1 text-[11px] font-medium text-surface-500 hover:text-brand-600 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400 dark:hover:text-brand-400">
                          <ExternalLink className="h-3 w-3" />
                          View Details
                        </button>
                        <button className="flex items-center gap-1 rounded-md border border-surface-200 bg-white px-2 py-1 text-[11px] font-medium text-surface-500 hover:text-brand-600 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400 dark:hover:text-brand-400">
                          <BookOpen className="h-3 w-3" />
                          View Paper
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-surface-500 dark:text-surface-400">
                    {pub.venue}
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', pubStatusColors[pub.status] || getStatusColor(pub.status))}>
                      {pub.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-surface-500 dark:text-surface-400">
                    {formatDate(pub.submittedDate)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-semibold text-surface-800 dark:text-surface-200">
                      {pub.citations}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-surface-500 dark:text-surface-400">
                      {pub.impactFactor.toFixed(1)}
                    </span>
                  </td>
                  <td className="max-w-[200px] px-5 py-4 text-surface-500 dark:text-surface-400">
                    <span className="line-clamp-1">{pub.authors.join(', ')}</span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-surface-400 dark:text-surface-500">
                    No publications match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Publications by Year */}
        <div className="rounded-xl border border-surface-200 bg-white p-5 dark:border-surface-700/50 dark:bg-surface-900/80">
          <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Publications by Year</h3>
          <div className="space-y-3">
            {years.map(yr => (
              <div key={yr} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-xs text-surface-500 dark:text-surface-400">{yr}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                  <div
                    className="flex h-full items-center justify-end rounded-full bg-brand-500 pr-2 transition-all duration-500 dark:bg-brand-400"
                    style={{ width: `${(pubsByYear[Number(yr)] / maxPubYear) * 100}%`, minWidth: '2rem' }}
                  >
                    <span className="text-[10px] font-bold text-white">
                      {pubsByYear[Number(yr)]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Citations Over Time */}
        <div className="rounded-xl border border-surface-200 bg-white p-5 dark:border-surface-700/50 dark:bg-surface-900/80">
          <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Top Cited Papers</h3>
          <div className="space-y-3">
            {publications
              .filter(p => p.citations > 0)
              .sort((a, b) => b.citations - a.citations)
              .map(p => {
                const maxCit = Math.max(...publications.map(x => x.citations), 1)
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-xs text-surface-500 dark:text-surface-400" title={p.title}>
                      {p.title.split(':')[0].slice(0, 14)}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                      <div
                        className="flex h-full items-center justify-end rounded-full bg-emerald-500 pr-2 transition-all duration-500 dark:bg-emerald-400"
                        style={{ width: `${(p.citations / maxCit) * 100}%`, minWidth: '2rem' }}
                      >
                        <span className="text-[10px] font-bold text-white">
                          {p.citations}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Venue Distribution */}
        <div className="rounded-xl border border-surface-200 bg-white p-5 dark:border-surface-700/50 dark:bg-surface-900/80">
          <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Venue Distribution</h3>
          <div className="mb-4 flex h-6 overflow-hidden rounded-full">
            {Object.entries(venueDistribution).map(([venue, count], i) => (
              <div
                key={venue}
                className={cn(venueColors[i % venueColors.length], 'transition-all duration-500')}
                style={{ width: `${(count / totalVenuePubs) * 100}%` }}
                title={`${venue}: ${count}`}
              />
            ))}
          </div>
          <div className="space-y-2">
            {Object.entries(venueDistribution).map(([venue, count], i) => (
              <div key={venue} className="flex items-center gap-2 text-xs">
                <div className={cn('h-3 w-3 rounded-sm', venueColors[i % venueColors.length])} />
                <span className="flex-1 text-surface-500 dark:text-surface-400">{venue}</span>
                <span className="font-medium text-surface-700 dark:text-surface-300">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Citation Tracker + Venue Intelligence */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Citations */}
        <div className="rounded-xl border border-surface-200 bg-white p-5 dark:border-surface-700/50 dark:bg-surface-900/80">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-700 dark:text-surface-200">
            <Quote className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            Recent Citations
          </h3>
          <div className="space-y-3">
            {citationFeed.map((c, i) => (
              <div key={i} className="rounded-lg border border-surface-100 bg-surface-50 p-3 dark:border-surface-700/30 dark:bg-surface-800/50">
                <p className="text-xs leading-relaxed text-surface-600 dark:text-surface-300">
                  <strong className="text-surface-900 dark:text-surface-100">{c.paper}</strong> was cited by{' '}
                  <span className="text-brand-600 dark:text-brand-300">{c.citedBy}</span> in the context of{' '}
                  <span className="italic text-surface-500 dark:text-surface-400">{c.context}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-surface-400 dark:text-surface-500">{c.venue}</span>
                  <span className="text-[10px] text-surface-300 dark:text-surface-600">&middot;</span>
                  <span className="text-[10px] text-surface-400 dark:text-surface-500">{formatDate(c.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Venue Intelligence */}
        <div className="rounded-xl border border-surface-200 bg-white p-5 dark:border-surface-700/50 dark:bg-surface-900/80">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-700 dark:text-surface-200">
            <BarChart3 className="h-4 w-4 text-brand-500 dark:text-brand-400" />
            Venue Intelligence
          </h3>
          <div className="space-y-3">
            {venueIntelligence.map(v => (
              <div key={v.venue} className="flex items-center gap-4 rounded-lg border border-surface-100 bg-surface-50 p-3 dark:border-surface-700/30 dark:bg-surface-800/50">
                <div className="shrink-0">
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{v.venue}</p>
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-400/10 dark:text-brand-300">
                    Tier {v.tier}
                  </span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-surface-400 dark:text-surface-500">Accept Rate</p>
                    <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">{v.acceptanceRate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400 dark:text-surface-500">Review Time</p>
                    <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">{v.avgReviewTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400 dark:text-surface-500">Our Papers</p>
                    <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">{v.papers}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
