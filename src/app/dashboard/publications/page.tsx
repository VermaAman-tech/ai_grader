'use client'

import { useState, useMemo } from 'react'
import {
  Award,
  FileText,
  Quote,
  TrendingUp,
  BarChart3,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { publications } from '@/lib/mock-data'
import { formatDate, getStatusColor } from '@/lib/utils'

type SortKey = 'title' | 'venue' | 'status' | 'submittedDate' | 'citations'
type SortDir = 'asc' | 'desc'

const pubStatusColors: Record<string, string> = {
  published: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  'under-review': 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  submitted: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  accepted: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border border-red-500/20',
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

export default function PublicationsPage() {
  const [sortKey, setSortKey] = useState<SortKey>('submittedDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const totalCitations = publications.reduce((s, p) => s + p.citations, 0)
  const publishedCount = publications.filter(p => p.status === 'published').length

  const sorted = useMemo(() => {
    return [...publications].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title': cmp = a.title.localeCompare(b.title); break
        case 'venue': cmp = a.venue.localeCompare(b.venue); break
        case 'status': cmp = a.status.localeCompare(b.status); break
        case 'submittedDate': cmp = new Date(a.submittedDate).getTime() - new Date(b.submittedDate).getTime(); break
        case 'citations': cmp = a.citations - b.citations; break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-brand-400" />
      : <ChevronUp className="w-3 h-3 text-brand-400" />
  }

  const pubsByYear: Record<number, number> = {}
  publications.forEach(p => {
    const yr = new Date(p.submittedDate).getFullYear()
    pubsByYear[yr] = (pubsByYear[yr] || 0) + 1
  })
  const years = Object.keys(pubsByYear).sort()
  const maxPubYear = Math.max(...Object.values(pubsByYear))

  const venueDistribution: Record<string, number> = {}
  publications.forEach(p => {
    const short = p.venue.split(' ')[0].replace(/[^a-zA-Z]/g, '')
    venueDistribution[short] = (venueDistribution[short] || 0) + 1
  })
  const venueColors = ['bg-brand-400', 'bg-emerald-400', 'bg-yellow-400', 'bg-cyan-400', 'bg-purple-400', 'bg-orange-400']
  const totalVenuePubs = Object.values(venueDistribution).reduce((s, v) => s + v, 0)

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center">
          <Award className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-100">
            Publications & Impact
          </h1>
          <p className="text-sm text-surface-400">Track your lab&apos;s publication record and citation impact</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Publications', value: publications.length, icon: FileText, color: 'text-brand-400 bg-brand-400/10' },
          { label: 'Total Citations', value: totalCitations, icon: Quote, color: 'text-emerald-400 bg-emerald-400/10' },
          { label: 'H-Index', value: 24, icon: TrendingUp, color: 'text-yellow-400 bg-yellow-400/10' },
          { label: 'Acceptance Rate', value: '72%', icon: BarChart3, color: 'text-cyan-400 bg-cyan-400/10' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-surface-400 font-medium uppercase tracking-wider">
                  {stat.label}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-surface-100">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Publications Table */}
      <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-surface-700/50">
          <h2 className="text-lg font-semibold text-surface-100">All Publications</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700/50 text-surface-400">
                {([
                  ['title', 'Title'],
                  ['venue', 'Venue'],
                  ['status', 'Status'],
                  ['submittedDate', 'Date'],
                  ['citations', 'Citations'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="text-left font-medium px-5 py-3">
                    <button
                      onClick={() => toggleSort(key)}
                      className="flex items-center gap-1 hover:text-surface-200 transition-colors"
                    >
                      {label}
                      <SortIcon col={key} />
                    </button>
                  </th>
                ))}
                <th className="text-left font-medium px-5 py-3">Authors</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(pub => (
                <tr
                  key={pub.id}
                  className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors"
                >
                  <td className="px-5 py-4 max-w-[300px]">
                    <span className="text-surface-200 font-medium line-clamp-1">
                      {pub.title}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-surface-400 whitespace-nowrap">
                    {pub.venue}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${pubStatusColors[pub.status] || getStatusColor(pub.status)}`}>
                      {pub.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-surface-400 whitespace-nowrap">
                    {formatDate(pub.submittedDate)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-surface-200 font-semibold">
                      {pub.citations}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-surface-400 max-w-[200px]">
                    <span className="line-clamp-1">{pub.authors.join(', ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Publications by Year */}
        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4">Publications by Year</h3>
          <div className="space-y-3">
            {years.map(yr => (
              <div key={yr} className="flex items-center gap-3">
                <span className="text-xs text-surface-400 w-10 shrink-0">{yr}</span>
                <div className="flex-1 bg-surface-800 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-brand-400 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
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
        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4">Citations Over Time</h3>
          <div className="space-y-3">
            {publications
              .filter(p => p.citations > 0)
              .sort((a, b) => b.citations - a.citations)
              .map(p => {
                const maxCit = Math.max(...publications.map(x => x.citations))
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-xs text-surface-400 w-24 shrink-0 truncate" title={p.title}>
                      {p.title.split(':')[0].slice(0, 14)}
                    </span>
                    <div className="flex-1 bg-surface-800 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
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
        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4">Venue Distribution</h3>
          <div className="flex h-6 rounded-full overflow-hidden mb-4">
            {Object.entries(venueDistribution).map(([venue, count], i) => (
              <div
                key={venue}
                className={`${venueColors[i % venueColors.length]} transition-all duration-500`}
                style={{ width: `${(count / totalVenuePubs) * 100}%` }}
                title={`${venue}: ${count}`}
              />
            ))}
          </div>
          <div className="space-y-2">
            {Object.entries(venueDistribution).map(([venue, count], i) => (
              <div key={venue} className="flex items-center gap-2 text-xs">
                <div className={`w-3 h-3 rounded-sm ${venueColors[i % venueColors.length]}`} />
                <span className="text-surface-400 flex-1">{venue}</span>
                <span className="text-surface-300 font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Citation Tracker + Venue Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Citations */}
        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <Quote className="w-4 h-4 text-emerald-400" />
            Recent Citations
          </h3>
          <div className="space-y-3">
            {citationFeed.map((c, i) => (
              <div key={i} className="bg-surface-800/50 border border-surface-700/30 rounded-lg p-3">
                <p className="text-xs text-surface-300 leading-relaxed">
                  <strong className="text-surface-100">{c.paper}</strong> was cited by{' '}
                  <span className="text-brand-300">{c.citedBy}</span> in the context of{' '}
                  <span className="italic text-surface-400">{c.context}</span>
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-surface-500">{c.venue}</span>
                  <span className="text-[10px] text-surface-600">•</span>
                  <span className="text-[10px] text-surface-500">{formatDate(c.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Venue Intelligence */}
        <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-400" />
            Venue Intelligence
          </h3>
          <div className="space-y-3">
            {venueIntelligence.map(v => (
              <div key={v.venue} className="bg-surface-800/50 border border-surface-700/30 rounded-lg p-3 flex items-center gap-4">
                <div className="shrink-0">
                  <p className="text-sm font-semibold text-surface-100">{v.venue}</p>
                  <span className="text-[10px] bg-brand-400/10 text-brand-300 px-1.5 py-0.5 rounded font-medium">
                    Tier {v.tier}
                  </span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-surface-500">Accept Rate</p>
                    <p className="text-sm font-semibold text-surface-200">{v.acceptanceRate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">Review Time</p>
                    <p className="text-sm font-semibold text-surface-200">{v.avgReviewTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">Our Papers</p>
                    <p className="text-sm font-semibold text-surface-200">{v.papers}</p>
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
