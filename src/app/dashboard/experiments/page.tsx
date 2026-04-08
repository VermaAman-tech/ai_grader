'use client'

import { useState, useMemo } from 'react'
import {
  FlaskConical,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Skull,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
  ArrowRight,
  Copy,
  FileText,
  RefreshCw,
  AlertTriangle,
  Activity,
  Cpu,
  Database,
  User as UserIcon,
  Calendar,
  StickyNote,
  Beaker,
  GitCompare,
  Check,
  Eye,
  Layers,
} from 'lucide-react'
import {
  experiments as importedExperiments,
  projects,
  users,
  getUserById,
  getProjectById,
} from '@/lib/mock-data'
import { getStatusColor, getInitials, formatDate } from '@/lib/utils'
import type { Experiment, ExperimentStatus } from '@/types'

const extraExperiments: Experiment[] = [
  {
    id: 'e11',
    title: 'MedViT v1.5: Pure CNN Encoder with ViT Decoder',
    hypothesisId: 'i1',
    projectId: 'p1',
    setup: 'Hybrid architecture with ResNet-50 encoder and ViT decoder. Attempted to get the best of both worlds — CNN spatial inductive biases with ViT global attention.',
    parameters: { encoder: 'ResNet-50', decoder: 'ViT-Small', learning_rate: '5e-4', batch_size: '16', epochs: '80' },
    hardware: 'NVIDIA V100 32GB x 2',
    dataset: 'CT-ORG (131 CT volumes, 6 organs)',
    status: 'failed',
    failureReason: 'Training diverged at epoch 34 due to gradient explosion in the encoder-decoder bridge. The feature dimension mismatch between CNN (2048-d) and ViT (384-d) caused unstable projections. Attempted gradient clipping and layer norm but loss became NaN repeatedly.',
    runBy: 'u2',
    runDate: '2024-09-10',
    completedDate: '2024-09-18',
    notes: 'The naive bridging approach doesn\'t work. Need a more careful feature alignment strategy — possibly progressive dimension reduction with residual connections.',
  },
  {
    id: 'e12',
    title: 'RoboSim: Domain Randomization with 200 Envs',
    hypothesisId: 'i3',
    projectId: 'p3',
    setup: 'PPO with visual domain randomization (textures, lighting, camera angle) in IsaacGym. Reduced from 4096 to 200 parallel environments due to GPU memory.',
    parameters: { algorithm: 'PPO', envs: '200', randomization: 'visual', timesteps: '20M', lr: '3e-4' },
    hardware: 'NVIDIA V100 32GB x 1',
    dataset: 'IsaacGym Cloth Folding Environment',
    status: 'failed',
    failureReason: 'Out of GPU memory at 200 environments with visual domain randomization. The randomized texture rendering consumed 28GB VRAM leaving insufficient memory for the policy network. Needed A100 80GB but cluster was fully booked.',
    runBy: 'u4',
    runDate: '2025-01-05',
    completedDate: '2025-01-06',
    notes: 'Need to wait for A100 availability or implement memory-efficient rendering pipeline.',
  },
  {
    id: 'e13',
    title: 'FedMed: Vanilla FedAvg on MNIST Medical',
    hypothesisId: 'i5',
    projectId: 'p5',
    setup: 'Baseline FedAvg across 5 simulated hospitals with non-IID splits of MedMNIST.',
    parameters: { algorithm: 'FedAvg', clients: '5', rounds: '100', local_epochs: '5', lr: '0.01' },
    hardware: 'NVIDIA V100 32GB x 1',
    dataset: 'MedMNIST (PathMNIST)',
    status: 'planned',
    runBy: 'u8',
    runDate: '2025-05-01',
    notes: 'Waiting for data use agreement from partner hospitals. Expected to start in May.',
  },
  {
    id: 'e14',
    title: 'LinguaBridge: Zero-Resource Sinhala Transfer',
    hypothesisId: 'i2',
    projectId: 'p2',
    setup: 'Attempted cross-script transfer from Hindi (Devanagari) to Sinhala using transliteration-based alignment. No Sinhala training data available.',
    parameters: { base_model: 'mBERT', source_lang: 'Hindi', target_lang: 'Sinhala', method: 'transliteration', task: 'NER' },
    hardware: 'NVIDIA V100 32GB x 1',
    dataset: 'Hindi NER (WikiANN), Sinhala test set (manual, 500 sentences)',
    status: 'abandoned',
    failureReason: 'Sinhala script is fundamentally different from Devanagari despite both being Brahmic. Transliteration-based alignment destroyed morphological information. F1 was only 0.31 — worse than a dictionary baseline (0.38). The script-sharing hypothesis does not extend across distant script families.',
    runBy: 'u3',
    runDate: '2025-02-10',
    completedDate: '2025-02-20',
    notes: 'Important negative result. Script sharing only works within the same script family, not across distant Brahmic scripts. Should document this in the paper as a limitation.',
  },
]

const allExperiments: Experiment[] = [...importedExperiments, ...extraExperiments]

type FilterTab = 'all' | ExperimentStatus
type GroupBy = 'none' | 'project' | 'status'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
  { key: 'planned', label: 'Planned' },
  { key: 'abandoned', label: 'Abandoned' },
]

function getStatusIcon(status: ExperimentStatus) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5" />
    case 'failed':
      return <XCircle className="h-3.5 w-3.5" />
    case 'planned':
      return <Clock className="h-3.5 w-3.5" />
    case 'abandoned':
      return <AlertTriangle className="h-3.5 w-3.5" />
  }
}

export default function ExperimentsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())
  const [showComparison, setShowComparison] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  const stats = useMemo(() => ({
    running: allExperiments.filter(e => e.status === 'running').length,
    completed: allExperiments.filter(e => e.status === 'completed').length,
    failed: allExperiments.filter(e => e.status === 'failed' || e.status === 'abandoned').length,
    total: allExperiments.length,
  }), [])

  const filtered = useMemo(() => {
    let result = allExperiments
    if (activeTab !== 'all') result = result.filter(e => e.status === activeTab)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.dataset.toLowerCase().includes(q) ||
        e.hardware.toLowerCase().includes(q) ||
        getProjectById(e.projectId)?.title.toLowerCase().includes(q)
      )
    }
    return result
  }, [activeTab, searchQuery])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': filtered }
    const groups: Record<string, Experiment[]> = {}
    for (const exp of filtered) {
      let key: string
      if (groupBy === 'project') {
        key = getProjectById(exp.projectId)?.title || 'Unknown Project'
      } else {
        key = exp.status.charAt(0).toUpperCase() + exp.status.slice(1)
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(exp)
    }
    return groups
  }, [filtered, groupBy])

  const failedExperiments = allExperiments.filter(e => e.status === 'failed' || e.status === 'abandoned')
  const comparedExperiments = allExperiments.filter(e => selectedForCompare.has(e.id))

  function toggleCompare(id: string) {
    setSelectedForCompare(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function allMetricKeys(exps: Experiment[]): string[] {
    const keys = new Set<string>()
    exps.forEach(e => {
      if (e.results?.metrics) Object.keys(e.results.metrics).forEach(k => keys.add(k))
    })
    return Array.from(keys).sort()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
            <FlaskConical className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-surface-100">Experiment Tracker</h1>
              <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-400">
                {allExperiments.length}
              </span>
            </div>
            <p className="text-sm text-surface-400">Track, compare, and learn from every experiment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCompareMode(!compareMode)
              if (compareMode) {
                setSelectedForCompare(new Set())
                setShowComparison(false)
              }
            }}
            className={`btn-secondary flex items-center gap-2 text-sm ${compareMode ? 'border-brand-500/50 text-brand-400' : ''}`}
          >
            <GitCompare className="h-4 w-4" />
            {compareMode ? 'Exit Compare' : 'Compare Experiments'}
          </button>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />
            New Experiment
          </button>
        </div>
      </div>

      {/* Compare bar */}
      {compareMode && selectedForCompare.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 px-4 py-3">
          <GitCompare className="h-4 w-4 text-brand-400" />
          <span className="text-sm text-surface-200">
            {selectedForCompare.size} experiment{selectedForCompare.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {comparedExperiments.map(e => (
              <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-300">
                {e.title.slice(0, 30)}...
                <button onClick={() => toggleCompare(e.id)} className="hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <button
            disabled={selectedForCompare.size < 2}
            onClick={() => setShowComparison(true)}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Compare ({selectedForCompare.size})
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-surface-400">Running</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-400">{stats.running}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-surface-400">Completed</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{stats.completed}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-surface-400">Failed</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-400">{stats.failed}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Beaker className="h-3.5 w-3.5 text-surface-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-surface-400">Total</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-surface-100">{stats.total}</p>
        </div>
      </div>

      {/* Filter tabs + Search + Group by */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTER_TABS.map(tab => {
            const count = tab.key === 'all'
              ? allExperiments.length
              : allExperiments.filter(e => e.status === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-brand-500/10 text-brand-400'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === tab.key ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-800 text-surface-500'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              placeholder="Search experiments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-56 rounded-lg border border-surface-700 bg-surface-900/80 py-1.5 pl-9 pr-3 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-900/80 px-2 py-1.5 text-sm">
            <Layers className="h-3.5 w-3.5 text-surface-400" />
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as GroupBy)}
              className="bg-transparent text-sm text-surface-200 focus:outline-none"
            >
              <option value="none" className="bg-surface-900">No Grouping</option>
              <option value="project" className="bg-surface-900">Group by Project</option>
              <option value="status" className="bg-surface-900">Group by Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Experiment Cards */}
      {Object.entries(grouped).map(([group, exps]) => (
        <div key={group}>
          {group && (
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-surface-200">{group}</h2>
              <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] text-surface-400">{exps.length}</span>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {exps.map(exp => {
              const project = getProjectById(exp.projectId)
              const runner = getUserById(exp.runBy)
              const paramEntries = Object.entries(exp.parameters).slice(0, 4)
              return (
                <div
                  key={exp.id}
                  className="group relative bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 card-hover"
                >
                  {/* Compare checkbox */}
                  {compareMode && (
                    <button
                      onClick={() => toggleCompare(exp.id)}
                      className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                        selectedForCompare.has(exp.id)
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-surface-600 hover:border-brand-400'
                      }`}
                    >
                      {selectedForCompare.has(exp.id) && <Check className="h-3 w-3" />}
                    </button>
                  )}

                  {/* Title & Project */}
                  <div className="mb-3">
                    <h3 className="font-bold text-surface-100 pr-8">{exp.title}</h3>
                    {project && (
                      <button
                        onClick={() => {}}
                        className="mt-0.5 text-xs text-brand-400 hover:text-brand-300 hover:underline"
                      >
                        {project.title}
                      </button>
                    )}
                  </div>

                  {/* Status badge + Date */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`badge gap-1 ${getStatusColor(exp.status)}`}>
                      {getStatusIcon(exp.status)}
                      {exp.status}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-surface-500">
                      <Calendar className="h-3 w-3" />
                      {formatDate(exp.runDate)}
                    </span>
                  </div>

                  {/* Runner + Hardware + Dataset */}
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-surface-400">
                    {runner && (
                      <span className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-semibold text-brand-300">
                          {getInitials(runner.name)}
                        </span>
                        {runner.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      {exp.hardware.length > 30 ? exp.hardware.slice(0, 30) + '...' : exp.hardware}
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {exp.dataset.length > 30 ? exp.dataset.slice(0, 30) + '...' : exp.dataset}
                    </span>
                  </div>

                  {/* Completed with results */}
                  {exp.status === 'completed' && exp.results && (
                    <div className="mb-3">
                      <div className="rounded-lg border border-surface-700/50 bg-surface-800/50 p-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-surface-500">Key Metrics</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {Object.entries(exp.results.metrics).slice(0, 6).map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="text-surface-400">{key}</span>
                              <span className="font-mono font-semibold text-surface-200">
                                {typeof val === 'number' ? (val < 1 && val > 0 ? val.toFixed(3) : val.toLocaleString()) : val}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {exp.results.conclusion && (
                        <p className="mt-2 line-clamp-2 text-xs text-surface-400">
                          {exp.results.conclusion}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Failed — failure reason */}
                  {(exp.status === 'failed' || exp.status === 'abandoned') && exp.failureReason && (
                    <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <div className="flex items-start gap-2">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                        <p className="line-clamp-3 text-xs text-red-300/90">{exp.failureReason}</p>
                      </div>
                    </div>
                  )}

                  {/* Running — in progress */}
                  {exp.status === 'running' && (
                    <div className="mb-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-xs text-blue-300">In progress</span>
                      </div>
                      {exp.notes && (
                        <p className="mt-1 text-xs text-blue-300/70">{exp.notes}</p>
                      )}
                    </div>
                  )}

                  {/* Parameters pills */}
                  {paramEntries.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {paramEntries.map(([k, v]) => (
                        <span key={k} className="inline-flex rounded-full bg-surface-800 px-2 py-0.5 text-[11px] text-surface-300">
                          <span className="font-medium text-surface-400">{k}:</span>
                          <span className="ml-1">{v.length > 15 ? v.slice(0, 15) + '…' : v}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {exp.notes && exp.status !== 'running' && (
                    <p className="line-clamp-1 text-xs text-surface-500">
                      <StickyNote className="mr-1 inline h-3 w-3" />
                      {exp.notes}
                    </p>
                  )}

                  {/* View detail */}
                  <button
                    onClick={() => setSelectedExperiment(exp)}
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Details
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
          {exps.length === 0 && (
            <div className="rounded-xl border border-surface-800 bg-surface-900/50 px-6 py-12 text-center">
              <FlaskConical className="mx-auto h-8 w-8 text-surface-600" />
              <p className="mt-2 text-sm text-surface-400">No experiments match your filters</p>
            </div>
          )}
        </div>
      ))}

      {/* Failure Wall */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
            <Skull className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-surface-100">
              Failure Archive — <span className="text-red-400/80">Learn from what didn&apos;t work</span>
            </h2>
            <p className="text-xs text-surface-500">Failed and abandoned experiments are not defeats — they&apos;re data points</p>
          </div>
        </div>

        {failedExperiments.length === 0 ? (
          <div className="rounded-xl border border-surface-800 bg-surface-900/50 px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/40" />
            <p className="mt-2 text-sm text-surface-400">No failed experiments yet. Keep pushing boundaries!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {failedExperiments.map(exp => {
              const project = getProjectById(exp.projectId)
              const runner = getUserById(exp.runBy)
              return (
                <div
                  key={exp.id}
                  className="rounded-xl border border-red-500/15 bg-gradient-to-r from-red-500/5 via-surface-900/80 to-orange-500/5 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`badge gap-1 ${getStatusColor(exp.status)}`}>
                          {getStatusIcon(exp.status)}
                          {exp.status}
                        </span>
                        <h3 className="font-semibold text-surface-100">{exp.title}</h3>
                      </div>
                      {project && (
                        <p className="mt-0.5 text-xs text-surface-500">{project.title}</p>
                      )}

                      {exp.failureReason && (
                        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-950/30 p-3">
                          <p className="text-sm leading-relaxed text-red-200/80">{exp.failureReason}</p>
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-4 text-xs text-surface-500">
                        {runner && <span>Run by {runner.name}</span>}
                        <span>{formatDate(exp.runDate)}</span>
                        <span>{exp.hardware}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Experiment Detail Modal */}
      {selectedExperiment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedExperiment(null)}
          />
          <div className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-700 bg-surface-900/95 px-6 py-4 backdrop-blur">
              <div>
                <h2 className="text-lg font-bold text-surface-100">{selectedExperiment.title}</h2>
                <p className="text-xs text-surface-400">
                  {getProjectById(selectedExperiment.projectId)?.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedExperiment(null)}
                className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Status + Meta */}
              <div className="flex flex-wrap items-center gap-3">
                <span className={`badge gap-1.5 ${getStatusColor(selectedExperiment.status)}`}>
                  {getStatusIcon(selectedExperiment.status)}
                  {selectedExperiment.status}
                </span>
                <span className="text-xs text-surface-500">
                  Run: {formatDate(selectedExperiment.runDate)}
                  {selectedExperiment.completedDate && ` → ${formatDate(selectedExperiment.completedDate)}`}
                </span>
                {getUserById(selectedExperiment.runBy) && (
                  <span className="flex items-center gap-1.5 text-xs text-surface-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-semibold text-brand-300">
                      {getInitials(getUserById(selectedExperiment.runBy)!.name)}
                    </span>
                    {getUserById(selectedExperiment.runBy)!.name}
                  </span>
                )}
              </div>

              {/* Setup */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-surface-200">Setup Description</h3>
                <p className="text-sm leading-relaxed text-surface-400">{selectedExperiment.setup}</p>
              </div>

              {/* Parameters table */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-surface-200">Parameters</h3>
                <div className="rounded-lg border border-surface-700/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700/50 bg-surface-800/50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-surface-400">Parameter</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-surface-400">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedExperiment.parameters).map(([k, v], i) => (
                        <tr key={k} className={i % 2 === 0 ? 'bg-surface-800/20' : ''}>
                          <td className="px-4 py-2 font-mono text-xs text-surface-300">{k}</td>
                          <td className="px-4 py-2 font-mono text-xs text-surface-200">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Hardware & Dataset */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-surface-700/50 bg-surface-800/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-surface-400">
                    <Cpu className="h-3.5 w-3.5" /> Hardware
                  </div>
                  <p className="mt-1 text-sm text-surface-200">{selectedExperiment.hardware}</p>
                </div>
                <div className="rounded-lg border border-surface-700/50 bg-surface-800/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-surface-400">
                    <Database className="h-3.5 w-3.5" /> Dataset
                  </div>
                  <p className="mt-1 text-sm text-surface-200">{selectedExperiment.dataset}</p>
                </div>
              </div>

              {/* Results table */}
              {selectedExperiment.results && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-surface-200">Results</h3>
                  <div className="rounded-lg border border-surface-700/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-700/50 bg-surface-800/50">
                          <th className="px-4 py-2 text-left text-xs font-medium text-surface-400">Metric</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-surface-400">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedExperiment.results.metrics).map(([k, v], i) => (
                          <tr key={k} className={i % 2 === 0 ? 'bg-surface-800/20' : ''}>
                            <td className="px-4 py-2 font-mono text-xs text-surface-300">{k}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-surface-100">
                              {typeof v === 'number' ? (v < 1 && v > 0 ? v.toFixed(4) : v.toLocaleString()) : v}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedExperiment.results.observations && (
                    <div className="mt-3">
                      <h4 className="mb-1 text-xs font-semibold text-surface-300">Observations</h4>
                      <p className="text-sm leading-relaxed text-surface-400">{selectedExperiment.results.observations}</p>
                    </div>
                  )}
                  {selectedExperiment.results.conclusion && (
                    <div className="mt-3">
                      <h4 className="mb-1 text-xs font-semibold text-surface-300">Conclusion</h4>
                      <p className="text-sm leading-relaxed text-surface-400">{selectedExperiment.results.conclusion}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Failure reason */}
              {selectedExperiment.failureReason && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-300">
                    <XCircle className="h-4 w-4" /> Failure Reason
                  </h3>
                  <p className="text-sm leading-relaxed text-red-200/80">{selectedExperiment.failureReason}</p>
                </div>
              )}

              {/* Notes */}
              {selectedExperiment.notes && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-surface-200">Notes</h3>
                  <p className="text-sm leading-relaxed text-surface-400">{selectedExperiment.notes}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 border-t border-surface-700/50 pt-4">
                <button className="btn-primary flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  Push to Paper
                </button>
                <button
                  onClick={() => {
                    alert(
                      'Reproducibility Checklist:\n\n' +
                      '✅ Random seed: Check parameters table\n' +
                      '✅ Hardware: ' + selectedExperiment.hardware + '\n' +
                      '✅ Dataset: ' + selectedExperiment.dataset + '\n' +
                      '⬜ Python environment: requirements.txt needed\n' +
                      '⬜ CUDA version: Not logged\n' +
                      '⬜ Data preprocessing: Check setup description\n' +
                      '⬜ Training duration: Check notes'
                    )
                  }}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reproduce
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `Experiment: ${selectedExperiment.title}\nParams: ${JSON.stringify(selectedExperiment.parameters, null, 2)}`
                    )
                  }}
                  className="btn-ghost flex items-center gap-2 text-sm"
                >
                  <Copy className="h-4 w-4" />
                  Copy Config
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showComparison && comparedExperiments.length >= 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowComparison(false)}
          />
          <div className="relative max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-700 bg-surface-900/95 px-6 py-4 backdrop-blur">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-brand-400" />
                <h2 className="text-lg font-bold text-surface-100">Experiment Comparison</h2>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-400">
                  {comparedExperiments.length} experiments
                </span>
              </div>
              <button
                onClick={() => setShowComparison(false)}
                className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto p-6">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-surface-700/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-surface-400">Property</th>
                    {comparedExperiments.map(e => (
                      <th key={e.id} className="px-4 py-3 text-left text-xs font-semibold text-surface-200">
                        {e.title.length > 40 ? e.title.slice(0, 40) + '...' : e.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-surface-800/50">
                    <td className="px-4 py-2 text-xs font-medium text-surface-400">Status</td>
                    {comparedExperiments.map(e => (
                      <td key={e.id} className="px-4 py-2">
                        <span className={`badge gap-1 text-[11px] ${getStatusColor(e.status)}`}>
                          {getStatusIcon(e.status)} {e.status}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-800/50">
                    <td className="px-4 py-2 text-xs font-medium text-surface-400">Hardware</td>
                    {comparedExperiments.map(e => (
                      <td key={e.id} className="px-4 py-2 text-xs text-surface-300">{e.hardware}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-800/50">
                    <td className="px-4 py-2 text-xs font-medium text-surface-400">Dataset</td>
                    {comparedExperiments.map(e => (
                      <td key={e.id} className="px-4 py-2 text-xs text-surface-300">{e.dataset}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-surface-800/50 bg-surface-800/20">
                    <td className="px-4 py-2 text-xs font-semibold text-brand-400" colSpan={comparedExperiments.length + 1}>
                      Metrics
                    </td>
                  </tr>
                  {allMetricKeys(comparedExperiments).map(metric => (
                    <tr key={metric} className="border-b border-surface-800/50">
                      <td className="px-4 py-2 font-mono text-xs text-surface-400">{metric}</td>
                      {comparedExperiments.map(e => {
                        const val = e.results?.metrics[metric]
                        const allVals = comparedExperiments
                          .map(ex => ex.results?.metrics[metric])
                          .filter((v): v is number => v !== undefined)
                        const best = allVals.length > 0 ? Math.max(...allVals) : null
                        const isBest = val !== undefined && val === best && allVals.length > 1
                        return (
                          <td key={e.id} className={`px-4 py-2 font-mono text-xs ${isBest ? 'font-bold text-emerald-400' : 'text-surface-300'}`}>
                            {val !== undefined
                              ? (val < 1 && val > 0 ? val.toFixed(4) : val.toLocaleString())
                              : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="border-b border-surface-800/50 bg-surface-800/20">
                    <td className="px-4 py-2 text-xs font-semibold text-brand-400" colSpan={comparedExperiments.length + 1}>
                      Conclusions
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-xs font-medium text-surface-400">Conclusion</td>
                    {comparedExperiments.map(e => (
                      <td key={e.id} className="px-4 py-2 text-xs text-surface-400">
                        {e.results?.conclusion || e.failureReason || '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
