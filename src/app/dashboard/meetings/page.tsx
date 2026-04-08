'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Mic, MicOff, Upload, Play, Pause, Search, Plus, Filter, Calendar,
  Clock, Users, CheckCircle2, XCircle, ChevronRight, ChevronDown,
  Sparkles, ListTodo, ArrowLeft, Trash2, Edit3, Check, X,
  Video, BarChart3, Target, AlertTriangle, Loader2, Volume2,
} from 'lucide-react'
import { useDataStore } from '@/contexts/DataStore'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Meeting, MeetingStatus, TranscriptSegment, MeetingSummary,
  ActionItem, Task, TaskPriority, Project,
} from '@/types'
import { cn, formatDate, formatRelativeTime, getInitials, generateId } from '@/lib/utils'
import { users, getUserById } from '@/lib/mock-data'

/* ─── constants ─── */

const STATUS_STYLE: Record<MeetingStatus, string> = {
  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'in-progress': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  low: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20',
}

const cardClass =
  'bg-white/70 dark:bg-surface-900/70 border border-surface-200 dark:border-surface-700/50 rounded-xl backdrop-blur-md shadow-sm dark:shadow-none'

function fmtSeconds(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/* ─── simulated AI summary generator ─── */

function generateMockSummary(meeting: Meeting): MeetingSummary {
  return {
    overview: `Meeting "${meeting.title}" covered project status updates, upcoming milestones, and resource allocation. The team discussed current blockers and agreed on action items to maintain momentum.`,
    keyDecisions: [
      'Prioritize completing current experiment runs before starting new ones',
      'Schedule follow-up review in one week',
      'Reallocate resources to unblock critical path items',
    ],
    actionItems: meeting.attendeeIds.slice(0, 3).map((uid, i) => ({
      id: `ai-gen-${generateId()}`,
      title: [
        'Write experiment results summary',
        'Update project timeline with new milestones',
        'Prepare dataset for next evaluation round',
      ][i] || 'Follow up on discussion points',
      assigneeId: uid,
      dueDate: new Date(Date.now() + (7 + i * 3) * 86400000).toISOString().split('T')[0],
      priority: (['high', 'medium', 'low'] as TaskPriority[])[i] || 'medium',
      approved: false,
    })),
    nextSteps: [
      'Review experiment logs and document findings',
      'Schedule one-on-one check-ins with team leads',
      'Prepare slides for next lab-wide meeting',
    ],
    blockers: ['Waiting on compute resources for next training run'],
    progressUpdates: [
      'Core experiments progressing on schedule',
      'Literature review section drafted',
    ],
  }
}

/* ─── page ─── */

export default function MeetingsPage() {
  const { user } = useAuth()
  const {
    meetings, tasks, projects,
    addMeeting, updateMeeting, deleteMeeting,
    approveMeetingAction, pushMeetingTodos, addTask,
  } = useDataStore()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<MeetingStatus | 'all'>('all')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date')

  // recording sim
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const recInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  // AI gen
  const [generating, setGenerating] = useState(false)
  const [pushSuccess, setPushSuccess] = useState(false)

  // transcript search
  const [transcriptSearch, setTranscriptSearch] = useState('')

  // editing action item
  const [editingAction, setEditingAction] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<ActionItem>>({})
  const [showAddAction, setShowAddAction] = useState(false)

  const selectedMeeting = meetings.find(m => m.id === selectedId)

  /* ─── derived data ─── */

  const filteredMeetings = useMemo(() => {
    let list = [...meetings]
    if (filterStatus !== 'all') list = list.filter(m => m.status === filterStatus)
    if (filterProject !== 'all') list = list.filter(m => m.projectId === filterProject)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(m => m.title.toLowerCase().includes(q))
    }
    list.sort((a, b) =>
      sortBy === 'date'
        ? new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        : a.title.localeCompare(b.title),
    )
    return list
  }, [meetings, filterStatus, filterProject, searchQuery, sortBy])

  const stats = useMemo(() => {
    const totalActions = meetings.reduce(
      (n, m) => n + (m.summary?.actionItems.length ?? 0), 0,
    )
    const approvedActions = meetings.reduce(
      (n, m) => n + (m.summary?.actionItems.filter(a => a.approved).length ?? 0), 0,
    )
    const tasksFromMeetings = tasks.filter(t => t.meetingId).length
    return {
      total: meetings.length,
      totalActions,
      approvalRate: totalActions ? Math.round((approvedActions / totalActions) * 100) : 0,
      tasksGenerated: tasksFromMeetings,
    }
  }, [meetings, tasks])

  /* ─── recording simulation ─── */

  const startRecording = useCallback(() => {
    setIsRecording(true)
    setRecordingTime(0)
    recInterval.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
  }, [])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    if (recInterval.current) clearInterval(recInterval.current)
    recInterval.current = null
    if (selectedMeeting && selectedMeeting.status === 'scheduled') {
      updateMeeting(selectedMeeting.id, { status: 'in-progress' })
    }
  }, [selectedMeeting, updateMeeting])

  useEffect(() => () => { if (recInterval.current) clearInterval(recInterval.current) }, [])

  /* ─── generate summary ─── */

  const handleGenerate = useCallback(() => {
    if (!selectedMeeting) return
    setGenerating(true)
    setTimeout(() => {
      const summary = generateMockSummary(selectedMeeting)
      updateMeeting(selectedMeeting.id, { summary, status: 'completed' })
      setGenerating(false)
    }, 2400)
  }, [selectedMeeting, updateMeeting])

  /* ─── push todos ─── */

  const handlePush = useCallback(() => {
    if (!selectedMeeting) return
    pushMeetingTodos(selectedMeeting.id)
    setPushSuccess(true)
    setTimeout(() => setPushSuccess(false), 3000)
  }, [selectedMeeting, pushMeetingTodos])

  const approvedCount = selectedMeeting?.summary?.actionItems.filter(a => a.approved).length ?? 0

  /* ─── action item editing ─── */

  const startEditAction = (ai: ActionItem) => {
    setEditingAction(ai.id)
    setEditDraft({ title: ai.title, assigneeId: ai.assigneeId, dueDate: ai.dueDate, priority: ai.priority })
  }

  const saveEditAction = () => {
    if (!selectedMeeting?.summary || !editingAction) return
    const updated = selectedMeeting.summary.actionItems.map(ai =>
      ai.id === editingAction ? { ...ai, ...editDraft } : ai,
    )
    updateMeeting(selectedMeeting.id, {
      summary: { ...selectedMeeting.summary, actionItems: updated },
    })
    setEditingAction(null)
    setEditDraft({})
  }

  const addCustomAction = (title: string, assigneeId: string, priority: TaskPriority) => {
    if (!selectedMeeting?.summary) return
    const newItem: ActionItem = {
      id: `ai-custom-${generateId()}`,
      title,
      assigneeId,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      priority,
      approved: false,
    }
    updateMeeting(selectedMeeting.id, {
      summary: {
        ...selectedMeeting.summary,
        actionItems: [...selectedMeeting.summary.actionItems, newItem],
      },
    })
    setShowAddAction(false)
  }

  /* ─── project lookup helper ─── */
  const projName = (pid?: string) => projects.find(p => p.id === pid)?.title ?? 'Lab-wide'

  /* ═══════════════════════════════ RENDER ═══════════════════════════════ */

  if (!user) return null

  /* ─── Meeting Detail View ─── */
  if (selectedMeeting) {
    const mtg = selectedMeeting
    const hasTranscript = mtg.transcript && mtg.transcript.length > 0
    const hasSummary = !!mtg.summary

    const filteredTranscript = hasTranscript
      ? mtg.transcript!.filter(seg =>
          !transcriptSearch || seg.text.toLowerCase().includes(transcriptSearch.toLowerCase()),
        )
      : []

    return (
      <div className="space-y-6">
        {/* back + header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setSelectedId(null); setTranscriptSearch('') }}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 truncate">
              {mtg.title}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-surface-500">
              <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(mtg.scheduledAt)}</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {mtg.duration} min</span>
              <span className="flex items-center gap-1"><Users size={14} /> {mtg.attendeeIds.length} attendees</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', STATUS_STYLE[mtg.status])}>
                {mtg.status}
              </span>
            </div>
          </div>
          {!hasSummary && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? 'Processing...' : 'Generate Summary'}
            </button>
          )}
          <button
            onClick={() => { deleteMeeting(mtg.id); setSelectedId(null) }}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* attendees strip */}
        <div className={cn(cardClass, 'p-4 flex items-center gap-3 flex-wrap')}>
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Attendees</span>
          {mtg.attendeeIds.map(uid => {
            const u = getUserById(uid)
            return u ? (
              <div key={uid} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-800 text-sm">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-[10px] font-bold">
                  {getInitials(u.name)}
                </div>
                {u.name}
              </div>
            ) : null
          })}
        </div>

        {/* two-column: left = recording + transcript, right = summary + actions */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ─── LEFT COLUMN ─── */}
          <div className="space-y-6">
            {/* recording section */}
            <div className={cn(cardClass, 'p-6')}>
              <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4">Voice Recording</h2>
              <div className="flex flex-col items-center gap-4">
                {/* mic button with pulsing rings */}
                <div className="relative">
                  {isRecording && (
                    <>
                      <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
                      <span className="absolute -inset-3 rounded-full border border-red-400/40 animate-pulse" />
                      <span className="absolute -inset-6 rounded-full border border-red-400/20 animate-pulse [animation-delay:300ms]" />
                    </>
                  )}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={cn(
                      'relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300',
                      isRecording
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-500',
                    )}
                  >
                    {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                  </button>
                </div>
                {isRecording && (
                  <div className="text-2xl font-mono font-bold text-red-500 tabular-nums">
                    {fmtSeconds(recordingTime)}
                  </div>
                )}
                <p className="text-xs text-surface-400">
                  {isRecording ? 'Recording... click to stop' : 'Click to start recording'}
                </p>
                {!isRecording && (
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 text-sm hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                    <Upload size={14} /> Upload Recording
                  </button>
                )}
              </div>
            </div>

            {/* transcript */}
            <div className={cn(cardClass, 'p-6')}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">Transcript</h2>
                {hasTranscript && (
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      value={transcriptSearch}
                      onChange={e => setTranscriptSearch(e.target.value)}
                      placeholder="Search transcript..."
                      className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    />
                  </div>
                )}
              </div>
              {hasTranscript ? (
                <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {filteredTranscript.map(seg => {
                    const speaker = getUserById(seg.speakerId)
                    return (
                      <div key={seg.id} className="flex gap-3 group">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                          {speaker ? getInitials(speaker.name) : '??'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                              {speaker?.name ?? 'Unknown'}
                            </span>
                            <span className="text-[11px] text-surface-400 tabular-nums">
                              {fmtSeconds(seg.startTime)}
                            </span>
                          </div>
                          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed mt-0.5">
                            {seg.text}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {filteredTranscript.length === 0 && (
                    <p className="text-sm text-surface-400 text-center py-8">No matching segments</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-surface-400 text-center py-12">
                  No transcript available. Record or upload audio to generate one.
                </p>
              )}
            </div>
          </div>

          {/* ─── RIGHT COLUMN ─── */}
          <div className="space-y-6">
            {/* generating overlay */}
            {generating && (
              <div className={cn(cardClass, 'p-10 flex flex-col items-center gap-4')}>
                <div className="relative">
                  <Sparkles size={32} className="text-brand-500 animate-pulse" />
                  <span className="absolute -inset-4 rounded-full border-2 border-brand-400/30 animate-spin [animation-duration:3s]" />
                </div>
                <p className="text-sm font-medium text-surface-600 dark:text-surface-300">
                  AI is processing transcript...
                </p>
                <div className="w-48 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full animate-[progress_2.4s_ease-in-out]" />
                </div>
              </div>
            )}

            {hasSummary && !generating && (
              <>
                {/* overview */}
                <div className={cn(cardClass, 'p-6')}>
                  <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Sparkles size={14} className="text-brand-500" /> AI Summary
                  </h2>
                  <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
                    {mtg.summary!.overview}
                  </p>
                </div>

                {/* key decisions + progress + blockers */}
                <div className="grid grid-cols-1 gap-4">
                  {mtg.summary!.keyDecisions.length > 0 && (
                    <div className={cn(cardClass, 'p-5')}>
                      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Target size={13} className="text-emerald-500" /> Key Decisions
                      </h3>
                      <ul className="space-y-1.5">
                        {mtg.summary!.keyDecisions.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-surface-600 dark:text-surface-300">
                            <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mtg.summary!.progressUpdates.length > 0 && (
                    <div className={cn(cardClass, 'p-5')}>
                      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <BarChart3 size={13} className="text-blue-500" /> Progress Updates
                      </h3>
                      <ul className="space-y-1.5">
                        {mtg.summary!.progressUpdates.map((p, i) => (
                          <li key={i} className="text-sm text-surface-600 dark:text-surface-300 flex items-start gap-2">
                            <ChevronRight size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mtg.summary!.blockers.length > 0 && (
                    <div className={cn(cardClass, 'p-5 border-red-200/50 dark:border-red-500/20')}>
                      <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <AlertTriangle size={13} /> Blockers
                      </h3>
                      <ul className="space-y-1.5">
                        {mtg.summary!.blockers.map((b, i) => (
                          <li key={i} className="text-sm text-surface-600 dark:text-surface-300">{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* ─── ACTION ITEMS ─── */}
                <div className={cn(cardClass, 'p-6')}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                      <ListTodo size={14} className="text-brand-500" /> Action Items
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[11px]">
                        {mtg.summary!.actionItems.length}
                      </span>
                    </h2>
                    <button
                      onClick={() => setShowAddAction(true)}
                      className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-surface-300 dark:border-surface-600 hover:border-brand-400 hover:text-brand-500 transition-colors"
                    >
                      <Plus size={12} /> Add Custom
                    </button>
                  </div>

                  <div className="space-y-3">
                    {mtg.summary!.actionItems.map(ai => {
                      const assignee = getUserById(ai.assigneeId)
                      const isEditing = editingAction === ai.id

                      if (isEditing) {
                        return (
                          <div key={ai.id} className="p-4 rounded-lg border-2 border-brand-500/40 bg-brand-50/30 dark:bg-brand-500/5 space-y-3">
                            <input
                              value={editDraft.title ?? ''}
                              onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                            />
                            <div className="flex gap-2 flex-wrap">
                              <select
                                value={editDraft.assigneeId ?? ''}
                                onChange={e => setEditDraft(d => ({ ...d, assigneeId: e.target.value }))}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs focus:outline-none"
                              >
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                              <input
                                type="date"
                                value={editDraft.dueDate ?? ''}
                                onChange={e => setEditDraft(d => ({ ...d, dueDate: e.target.value }))}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs focus:outline-none"
                              />
                              <select
                                value={editDraft.priority ?? 'medium'}
                                onChange={e => setEditDraft(d => ({ ...d, priority: e.target.value as TaskPriority }))}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs focus:outline-none"
                              >
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingAction(null)} className="px-3 py-1 rounded-lg text-xs border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                                Cancel
                              </button>
                              <button onClick={saveEditAction} className="px-3 py-1 rounded-lg text-xs bg-brand-500 text-white hover:bg-brand-600 transition-colors">
                                Save
                              </button>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={ai.id}
                          className={cn(
                            'p-3.5 rounded-lg border transition-all duration-200',
                            ai.approved
                              ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
                              : 'bg-surface-50 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => approveMeetingAction(mtg.id, ai.id, !ai.approved)}
                              className={cn(
                                'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0',
                                ai.approved
                                  ? 'bg-emerald-500 border-emerald-500 text-white scale-100'
                                  : 'border-surface-300 dark:border-surface-600 hover:border-brand-400',
                              )}
                            >
                              {ai.approved && <Check size={12} strokeWidth={3} />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{ai.title}</p>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {assignee && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center text-[9px] font-bold">
                                      {getInitials(assignee.name)}
                                    </div>
                                    <span className="text-xs text-surface-500">{assignee.name}</span>
                                  </div>
                                )}
                                {ai.dueDate && (
                                  <span className="text-xs text-surface-400 flex items-center gap-1">
                                    <Calendar size={10} /> {formatDate(ai.dueDate)}
                                  </span>
                                )}
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium border', PRIORITY_STYLE[ai.priority])}>
                                  {ai.priority}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => startEditAction(ai)}
                              className="p-1.5 rounded-md text-surface-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* add custom action inline form */}
                  {showAddAction && <AddActionForm users={users} onAdd={addCustomAction} onCancel={() => setShowAddAction(false)} />}

                  {/* push button */}
                  {approvedCount > 0 && (
                    <button
                      onClick={handlePush}
                      className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 active:scale-[0.98]"
                    >
                      <CheckCircle2 size={16} />
                      Push {approvedCount} Approved Todo{approvedCount > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {/* next steps */}
                {mtg.summary!.nextSteps.length > 0 && (
                  <div className={cn(cardClass, 'p-5')}>
                    <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Sparkles size={13} className="text-purple-500" /> Next Steps
                    </h3>
                    <ul className="space-y-1.5">
                      {mtg.summary!.nextSteps.map((s, i) => (
                        <li key={i} className="text-sm text-surface-600 dark:text-surface-300 flex items-start gap-2">
                          <ChevronRight size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {!hasSummary && !generating && (
              <div className={cn(cardClass, 'p-12 flex flex-col items-center gap-3 text-center')}>
                <Sparkles size={36} className="text-surface-300 dark:text-surface-600" />
                <p className="text-sm font-medium text-surface-500">No summary yet</p>
                <p className="text-xs text-surface-400 max-w-xs">
                  Record or upload a meeting, then click &quot;Generate Summary&quot; to let AI extract decisions, action items, and next steps.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* push success toast */}
        {pushSuccess && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30 animate-[slideUp_0.3s_ease-out]">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">{approvedCount} task{approvedCount > 1 ? 's' : ''} created successfully!</span>
          </div>
        )}
      </div>
    )
  }

  /* ─── LIST VIEW ─── */

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Meetings</h1>
          <p className="text-sm text-surface-500 mt-1">Manage lab meetings, transcripts, and AI-extracted action items</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all shadow-md shadow-brand-500/20 active:scale-[0.97]"
        >
          <Plus size={16} /> New Meeting
        </button>
      </div>

      {/* stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Meetings', value: stats.total, icon: Video, color: 'text-blue-500' },
          { label: 'Action Items', value: stats.totalActions, icon: ListTodo, color: 'text-brand-500' },
          { label: 'Approval Rate', value: `${stats.approvalRate}%`, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Tasks Generated', value: stats.tasksGenerated, icon: Target, color: 'text-purple-500' },
        ].map(s => (
          <div key={s.label} className={cn(cardClass, 'p-4 flex items-center gap-3')}>
            <div className={cn('p-2.5 rounded-lg bg-surface-100 dark:bg-surface-800', s.color)}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-surface-900 dark:text-surface-50">{s.value}</p>
              <p className="text-xs text-surface-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className={cn(cardClass, 'p-3 flex items-center gap-3 flex-wrap')}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search meetings..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as MeetingStatus | 'all')}
          className="px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none"
        >
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'date' | 'title')}
          className="px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none"
        >
          <option value="date">Sort by Date</option>
          <option value="title">Sort by Title</option>
        </select>
      </div>

      {/* meeting cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredMeetings.map(mtg => (
          <button
            key={mtg.id}
            onClick={() => setSelectedId(mtg.id)}
            className={cn(
              cardClass,
              'p-5 text-left group hover:border-brand-400/50 dark:hover:border-brand-500/30 hover:shadow-md hover:shadow-brand-500/5 transition-all duration-200',
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider', STATUS_STYLE[mtg.status])}>
                {mtg.status}
              </span>
              <ChevronRight size={16} className="text-surface-300 group-hover:text-brand-500 transition-colors" />
            </div>
            <h3 className="font-semibold text-surface-800 dark:text-surface-100 line-clamp-2 mb-1.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {mtg.title}
            </h3>
            <p className="text-xs text-surface-500 mb-3">{projName(mtg.projectId)}</p>
            <div className="flex items-center gap-3 text-xs text-surface-400 mb-3">
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(mtg.scheduledAt)}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {mtg.duration}m</span>
            </div>
            {/* attendee avatars */}
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {mtg.attendeeIds.slice(0, 5).map(uid => {
                  const u = getUserById(uid)
                  return (
                    <div
                      key={uid}
                      title={u?.name}
                      className="w-7 h-7 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 border-2 border-white dark:border-surface-900 flex items-center justify-center text-[9px] font-bold"
                    >
                      {u ? getInitials(u.name) : '??'}
                    </div>
                  )
                })}
                {mtg.attendeeIds.length > 5 && (
                  <div className="w-7 h-7 rounded-full bg-surface-200 dark:bg-surface-700 border-2 border-white dark:border-surface-900 flex items-center justify-center text-[9px] font-medium text-surface-500">
                    +{mtg.attendeeIds.length - 5}
                  </div>
                )}
              </div>
              {mtg.summary && (
                <span className="ml-auto text-[10px] text-emerald-500 flex items-center gap-1 font-medium">
                  <Sparkles size={10} /> Summary
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {filteredMeetings.length === 0 && (
        <div className={cn(cardClass, 'p-16 flex flex-col items-center gap-3 text-center')}>
          <Video size={40} className="text-surface-300 dark:text-surface-600" />
          <p className="text-sm font-medium text-surface-500">No meetings found</p>
          <p className="text-xs text-surface-400">Try adjusting your filters or create a new meeting.</p>
        </div>
      )}

      {/* new meeting modal */}
      {showNewModal && (
        <NewMeetingModal
          projects={projects}
          user={user}
          onClose={() => setShowNewModal(false)}
          onCreate={(data, startNow) => {
            const mtg = addMeeting({
              ...data,
              status: startNow ? 'in-progress' : 'scheduled',
              createdBy: user.id,
              labId: user.labId,
            })
            setShowNewModal(false)
            if (startNow) setSelectedId(mtg.id)
          }}
        />
      )}
    </div>
  )
}

/* ═══════════════ New Meeting Modal ═══════════════ */

function NewMeetingModal({
  projects, user, onClose, onCreate,
}: {
  projects: Project[]
  user: { id: string; labId: string }
  onClose: () => void
  onCreate: (data: Omit<Meeting, 'id' | 'status' | 'createdBy' | 'labId'>, startNow: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [attendeeIds, setAttendeeIds] = useState<string[]>([user.id])

  const toggleAttendee = (uid: string) =>
    setAttendeeIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])

  const canSubmit = title.trim().length > 0

  const build = (): Omit<Meeting, 'id' | 'status' | 'createdBy' | 'labId'> => ({
    title: title.trim(),
    projectId: projectId || undefined,
    scheduledAt: dateTime ? new Date(dateTime).toISOString() : new Date().toISOString(),
    duration,
    attendeeIds,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-surface-200 dark:border-surface-700/50">
          <h2 className="text-lg font-bold text-surface-900 dark:text-surface-50">New Meeting</h2>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Weekly Lab Sync"
              className="w-full px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">Project (optional)</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none"
              >
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">Duration (min)</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                min={5}
                className="w-full px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Date &amp; Time</label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={e => setDateTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Attendees</label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 max-h-48 overflow-y-auto">
              {users.map(u => {
                const selected = attendeeIds.includes(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleAttendee(u.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all',
                      selected
                        ? 'bg-brand-500 text-white'
                        : 'bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:border-brand-400',
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                      selected ? 'bg-white/20' : 'bg-brand-500/15 text-brand-600 dark:text-brand-400',
                    )}>
                      {getInitials(u.name)}
                    </div>
                    {u.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-surface-200 dark:border-surface-700/50 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 text-sm hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => onCreate(build(), false)}
            className="px-4 py-2 rounded-lg border border-brand-500 text-brand-600 dark:text-brand-400 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors disabled:opacity-40"
          >
            Schedule
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => onCreate(build(), true)}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            Start Now
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ Add Action Form ═══════════════ */

function AddActionForm({
  users: allUsers,
  onAdd,
  onCancel,
}: {
  users: { id: string; name: string }[]
  onAdd: (title: string, assigneeId: string, priority: TaskPriority) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState(allUsers[0]?.id ?? '')
  const [priority, setPriority] = useState<TaskPriority>('medium')

  return (
    <div className="mt-3 p-4 rounded-lg border-2 border-dashed border-brand-400/40 bg-brand-50/20 dark:bg-brand-500/5 space-y-3">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Action item title..."
        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        autoFocus
      />
      <div className="flex gap-2 flex-wrap">
        <select
          value={assigneeId}
          onChange={e => setAssigneeId(e.target.value)}
          className="px-2 py-1 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs focus:outline-none"
        >
          {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as TaskPriority)}
          className="px-2 py-1 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs focus:outline-none"
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1 rounded-lg text-xs border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
          Cancel
        </button>
        <button
          disabled={!title.trim()}
          onClick={() => onAdd(title.trim(), assigneeId, priority)}
          className="px-3 py-1 rounded-lg text-xs bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}
