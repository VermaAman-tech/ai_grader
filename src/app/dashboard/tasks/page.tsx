'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ListTodo, Plus, Search, X, Columns3, List, BarChart3, Calendar,
  ChevronDown, Check, Clock, AlertTriangle, Ban, Circle, Filter,
  User as UserIcon, FolderOpen, Tag, Video, Trash2, ArrowRight,
  CheckCircle2, AlertCircle, TrendingUp, Target, Users,
} from 'lucide-react'
import { useDataStore } from '@/contexts/DataStore'
import { useAuth } from '@/contexts/AuthContext'
import { users, getUserById } from '@/lib/mock-data'
import { cn, formatDate, formatRelativeTime, getInitials, generateId } from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority, Project } from '@/types'

type ViewMode = 'kanban' | 'list' | 'timeline'
type SortField = 'title' | 'priority' | 'dueDate' | 'status' | 'assignee'

const KANBAN_COLUMNS: { status: TaskStatus; label: string; gradient: string }[] = [
  { status: 'pending', label: 'Pending', gradient: 'from-slate-500/20 to-slate-600/10' },
  { status: 'in-progress', label: 'In Progress', gradient: 'from-blue-500/20 to-blue-600/10' },
  { status: 'done', label: 'Done', gradient: 'from-emerald-500/20 to-emerald-600/10' },
  { status: 'blocked', label: 'Blocked', gradient: 'from-red-500/20 to-red-600/10' },
]

const STATUS_META: Record<TaskStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  'pending': { label: 'Pending', icon: <Circle className="h-3.5 w-3.5" />, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  'in-progress': { label: 'In Progress', icon: <Clock className="h-3.5 w-3.5 animate-pulse" />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  'done': { label: 'Done', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  'blocked': { label: 'Blocked', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  'cancelled': { label: 'Cancelled', icon: <Ban className="h-3.5 w-3.5" />, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
}

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; dot: string; border: string }> = {
  critical: { label: 'Critical', color: 'text-red-500', dot: 'bg-red-500', border: 'border-l-red-500' },
  high: { label: 'High', color: 'text-orange-500', dot: 'bg-orange-500', border: 'border-l-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-500', dot: 'bg-yellow-500', border: 'border-l-yellow-500' },
  low: { label: 'Low', color: 'text-slate-400 dark:text-surface-400', dot: 'bg-slate-400 dark:bg-surface-400', border: 'border-l-slate-400 dark:border-l-surface-400' },
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function isOverdue(task: Task): boolean {
  if (task.status === 'done' || task.status === 'cancelled' || !task.dueDate) return false
  return new Date(task.dueDate) < new Date()
}

export default function TasksPage() {
  const { tasks, projects, meetings, addTask, updateTask, updateTaskStatus, deleteTask } = useDataStore()
  const { user } = useAuth()

  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterMeeting, setFilterMeeting] = useState<string>('all')
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('priority')
  const [sortAsc, setSortAsc] = useState(true)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>('pending')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Bulk selection (list view)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Create modal fields
  const [cTitle, setCTitle] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [cAssignee, setCAssignee] = useState('')
  const [cProject, setCProject] = useState('')
  const [cPriority, setCPriority] = useState<TaskPriority>('medium')
  const [cDueDate, setCDueDate] = useState('')
  const [cTags, setCTags] = useState('')

  // Mark-done animation
  const [justDone, setJustDone] = useState<Set<string>>(new Set())

  const filteredTasks = useMemo(() => {
    let result = [...tasks]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      )
    }
    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus)
    if (filterPriority !== 'all') result = result.filter(t => t.priority === filterPriority)
    if (filterAssignee !== 'all') result = result.filter(t => t.assigneeId === filterAssignee)
    if (filterProject !== 'all') result = result.filter(t => t.projectId === filterProject)
    if (filterMeeting !== 'all') result = result.filter(t => t.meetingId === filterMeeting)
    if (myTasksOnly && user) result = result.filter(t => t.assigneeId === user.id)
    if (overdueOnly) result = result.filter(isOverdue)

    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'title': cmp = a.title.localeCompare(b.title); break
        case 'priority': cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; break
        case 'status': cmp = a.status.localeCompare(b.status); break
        case 'dueDate': cmp = (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'); break
        case 'assignee': cmp = (getUserById(a.assigneeId)?.name ?? '').localeCompare(getUserById(b.assigneeId)?.name ?? ''); break
      }
      return sortAsc ? cmp : -cmp
    })
    return result
  }, [tasks, searchQuery, filterStatus, filterPriority, filterAssignee, filterProject, filterMeeting, myTasksOnly, overdueOnly, user, sortField, sortAsc])

  const stats = useMemo(() => {
    const total = tasks.length
    const pending = tasks.filter(t => t.status === 'pending').length
    const inProgress = tasks.filter(t => t.status === 'in-progress').length
    const done = tasks.filter(t => t.status === 'done').length
    const overdue = tasks.filter(isOverdue).length
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0
    const byPriority = {
      critical: tasks.filter(t => t.priority === 'critical').length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    }
    return { total, pending, inProgress, done, overdue, completionRate, byPriority }
  }, [tasks])

  const personStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    tasks.forEach(t => {
      const cur = map.get(t.assigneeId) ?? { total: 0, done: 0 }
      cur.total++
      if (t.status === 'done') cur.done++
      map.set(t.assigneeId, cur)
    })
    return map
  }, [tasks])

  const projectStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    tasks.forEach(t => {
      const pid = t.projectId ?? 'unassigned'
      const cur = map.get(pid) ?? { total: 0, done: 0 }
      cur.total++
      if (t.status === 'done') cur.done++
      map.set(pid, cur)
    })
    return map
  }, [tasks])

  const weeklyData = useMemo(() => {
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' })
      const count = tasks.filter(t => {
        if (!t.completedAt) return false
        const c = new Date(t.completedAt)
        return c.toDateString() === d.toDateString()
      }).length
      days.push({ label: dayStr, count })
    }
    return days
  }, [tasks])

  const maxWeekly = Math.max(...weeklyData.map(d => d.count), 1)

  function openCreateModal(defaultStatus: TaskStatus = 'pending') {
    setCreateDefaultStatus(defaultStatus)
    setCTitle('')
    setCDesc('')
    setCAssignee(user?.id ?? '')
    setCProject('')
    setCPriority('medium')
    setCDueDate('')
    setCTags('')
    setShowCreateModal(true)
  }

  function handleCreate() {
    if (!cTitle.trim()) return
    addTask({
      title: cTitle.trim(),
      description: cDesc.trim(),
      assigneeId: cAssignee || (user?.id ?? 'u1'),
      projectId: cProject || undefined,
      status: createDefaultStatus,
      priority: cPriority,
      dueDate: cDueDate || undefined,
      createdAt: new Date().toISOString(),
      tags: cTags.split(',').map(t => t.trim()).filter(Boolean),
      labId: user?.labId ?? 'lab1',
    })
    setShowCreateModal(false)
  }

  const handleMarkDone = useCallback((id: string) => {
    setJustDone(prev => new Set(prev).add(id))
    updateTaskStatus(id, 'done')
    setTimeout(() => setJustDone(prev => { const n = new Set(prev); n.delete(id); return n }), 800)
  }, [updateTaskStatus])

  function handleBulkAction(action: 'done' | 'delete' | TaskPriority) {
    selectedIds.forEach(id => {
      if (action === 'done') updateTaskStatus(id, 'done')
      else if (action === 'delete') deleteTask(id)
      else updateTask(id, { priority: action })
    })
    setSelectedIds(new Set())
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const getProject = (id?: string) => id ? projects.find(p => p.id === id) : undefined
  const getMeeting = (id?: string) => id ? meetings.find(m => m.id === id) : undefined

  const activeFilterCount = [
    filterStatus !== 'all', filterPriority !== 'all', filterAssignee !== 'all',
    filterProject !== 'all', filterMeeting !== 'all', myTasksOnly, overdueOnly,
  ].filter(Boolean).length

  // ── Stats Dashboard ──
  function renderStats() {
    const circumference = 2 * Math.PI * 28
    const offset = circumference - (stats.completionRate / 100) * circumference

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-4">
          <div className="text-xs text-gray-500 dark:text-surface-400 mb-1">Total</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-4">
          <div className="text-xs text-gray-500 dark:text-surface-400 mb-1">Pending</div>
          <div className="text-2xl font-bold text-slate-500">{stats.pending}</div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-4">
          <div className="text-xs text-gray-500 dark:text-surface-400 mb-1">In Progress</div>
          <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-4">
          <div className="text-xs text-gray-500 dark:text-surface-400 mb-1">Done</div>
          <div className="text-2xl font-bold text-emerald-500">{stats.done}</div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-4">
          <div className="text-xs text-gray-500 dark:text-surface-400 mb-1">Overdue</div>
          <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-4 flex items-center gap-3">
          <svg width="64" height="64" className="shrink-0 -rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5"
              className="text-gray-200 dark:text-surface-700" />
            <circle cx="32" cy="32" r="28" fill="none" strokeWidth="5"
              className="text-emerald-500 transition-all duration-700"
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <div>
            <div className="text-xs text-gray-500 dark:text-surface-400">Completion</div>
            <div className="text-xl font-bold text-emerald-500">{stats.completionRate}%</div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-4">
          <div className="text-xs text-gray-500 dark:text-surface-400 mb-2">By Priority</div>
          <div className="space-y-1">
            {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map(p => (
              <div key={p} className="flex items-center gap-1.5 text-xs">
                <span className={cn('w-2 h-2 rounded-full', PRIORITY_META[p].dot)} />
                <span className="text-gray-600 dark:text-surface-300 capitalize">{p}</span>
                <span className="ml-auto font-medium text-gray-900 dark:text-white">{stats.byPriority[p]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Task Card (Kanban) ──
  function renderTaskCard(task: Task) {
    const assignee = getUserById(task.assigneeId)
    const project = getProject(task.projectId)
    const meeting = getMeeting(task.meetingId)
    const overdue = isOverdue(task)
    const isMoving = movingTaskId === task.id
    const isDone = justDone.has(task.id)

    return (
      <div
        key={task.id}
        onClick={() => {
          if (movingTaskId) return
          setSelectedTask(task)
        }}
        className={cn(
          'group bg-white dark:bg-surface-800 rounded-lg border-l-[3px] border border-gray-200 dark:border-surface-700 p-3 cursor-pointer',
          'hover:shadow-md dark:hover:shadow-surface-900/50 transition-all duration-200',
          PRIORITY_META[task.priority].border,
          isMoving && 'ring-2 ring-blue-500 scale-[1.02]',
          isDone && 'animate-pulse bg-emerald-50 dark:bg-emerald-900/20',
          overdue && 'ring-1 ring-red-300 dark:ring-red-800',
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white leading-tight line-clamp-2">{task.title}</h4>
          <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1', PRIORITY_META[task.priority].dot)} title={task.priority} />
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          {project && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 truncate max-w-[120px]">
              {project.title.split(':')[0]}
            </span>
          )}
          {meeting && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-0.5">
              <Video className="h-2.5 w-2.5" /> {meeting.title.split(' ').slice(0, 2).join(' ')}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {assignee && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">{getInitials(assignee.name)}</span>
              </div>
            )}
            {task.dueDate && (
              <span className={cn('text-[10px]', overdue ? 'text-red-500 font-medium' : 'text-gray-400 dark:text-surface-500')}>
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>

          {movingTaskId === null && (
            <button
              onClick={e => { e.stopPropagation(); setMovingTaskId(task.id) }}
              className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-400 dark:text-surface-500 hover:text-blue-500 transition-opacity"
            >
              Move
            </button>
          )}
          {isDone && <Check className="h-4 w-4 text-emerald-500 animate-bounce" />}
        </div>
      </div>
    )
  }

  // ── Kanban View ──
  function renderKanban() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.status)
          const isTarget = movingTaskId !== null

          return (
            <div
              key={col.status}
              onClick={() => {
                if (movingTaskId) {
                  updateTaskStatus(movingTaskId, col.status)
                  setMovingTaskId(null)
                }
              }}
              className={cn(
                'flex flex-col rounded-xl border border-gray-200 dark:border-surface-700 bg-gray-50/50 dark:bg-surface-900/50 min-h-[300px]',
                isTarget && 'cursor-pointer ring-2 ring-blue-500/50 ring-dashed',
              )}
            >
              <div className={cn('px-4 py-3 rounded-t-xl bg-gradient-to-r', col.gradient)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-semibold', STATUS_META[col.status].color)}>{col.label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-surface-800/60 text-gray-600 dark:text-surface-300 font-medium">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); openCreateModal(col.status) }}
                    className="w-6 h-6 rounded-md bg-white/60 dark:bg-surface-800/60 flex items-center justify-center hover:bg-white dark:hover:bg-surface-700 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-gray-600 dark:text-surface-300" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[60vh]">
                {colTasks.length === 0 && (
                  <div className="text-center text-xs text-gray-400 dark:text-surface-500 py-8">
                    {isTarget ? 'Drop here' : 'No tasks'}
                  </div>
                )}
                {colTasks.map(renderTaskCard)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── List View ──
  function renderListView() {
    const allSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedIds.has(t.id))

    return (
      <div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">{selectedIds.size} selected</span>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => handleBulkAction('done')} className="text-xs px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">Mark Done</button>
              <select
                onChange={e => { if (e.target.value) handleBulkAction(e.target.value as TaskPriority) }}
                className="text-xs px-2 py-1 rounded bg-white dark:bg-surface-700 border border-gray-300 dark:border-surface-600 text-gray-700 dark:text-surface-200"
                defaultValue=""
              >
                <option value="" disabled>Priority…</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button onClick={() => handleBulkAction('delete')} className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-surface-700 text-xs text-gray-500 dark:text-surface-400">
                  <th className="p-3 w-8">
                    <input
                      type="checkbox" checked={allSelected}
                      onChange={() => {
                        if (allSelected) setSelectedIds(new Set())
                        else setSelectedIds(new Set(filteredTasks.map(t => t.id)))
                      }}
                      className="rounded border-gray-300 dark:border-surface-600"
                    />
                  </th>
                  <th className="p-3 text-left cursor-pointer hover:text-gray-700 dark:hover:text-surface-200 select-none" onClick={() => toggleSort('title')}>
                    Title {sortField === 'title' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-left cursor-pointer hover:text-gray-700 dark:hover:text-surface-200 select-none" onClick={() => toggleSort('assignee')}>
                    Assignee {sortField === 'assignee' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-left">Project</th>
                  <th className="p-3 text-left cursor-pointer hover:text-gray-700 dark:hover:text-surface-200 select-none" onClick={() => toggleSort('priority')}>
                    Priority {sortField === 'priority' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-left cursor-pointer hover:text-gray-700 dark:hover:text-surface-200 select-none" onClick={() => toggleSort('status')}>
                    Status {sortField === 'status' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-left cursor-pointer hover:text-gray-700 dark:hover:text-surface-200 select-none" onClick={() => toggleSort('dueDate')}>
                    Due {sortField === 'dueDate' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const assignee = getUserById(task.assigneeId)
                  const project = getProject(task.projectId)
                  const meeting = getMeeting(task.meetingId)
                  const overdue = isOverdue(task)

                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        'border-b border-gray-100 dark:border-surface-700/50 hover:bg-gray-50 dark:hover:bg-surface-700/30 transition-colors cursor-pointer',
                        justDone.has(task.id) && 'bg-emerald-50 dark:bg-emerald-900/20',
                      )}
                      onClick={() => setSelectedTask(task)}
                    >
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox" checked={selectedIds.has(task.id)}
                          onChange={() => {
                            const next = new Set(selectedIds)
                            next.has(task.id) ? next.delete(task.id) : next.add(task.id)
                            setSelectedIds(next)
                          }}
                          className="rounded border-gray-300 dark:border-surface-600"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_META[task.priority].dot)} />
                          <span className={cn('text-sm font-medium text-gray-900 dark:text-white', task.status === 'done' && 'line-through opacity-60')}>
                            {task.title}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {assignee && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                              <span className="text-[8px] font-bold text-white">{getInitials(assignee.name)}</span>
                            </div>
                            <span className="text-xs text-gray-600 dark:text-surface-300">{assignee.name.split(' ')[0]}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {project && (
                          <span className="text-xs text-gray-500 dark:text-surface-400 truncate max-w-[120px] block">
                            {project.title.split(':')[0]}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={cn('text-xs font-medium capitalize', PRIORITY_META[task.priority].color)}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <select
                          value={task.status}
                          onChange={e => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                          className={cn(
                            'text-xs px-2 py-1 rounded-md border font-medium bg-transparent cursor-pointer',
                            STATUS_META[task.status].bg, STATUS_META[task.status].color,
                          )}
                        >
                          {Object.entries(STATUS_META).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        {task.dueDate && (
                          <span className={cn('text-xs', overdue ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-surface-400')}>
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {meeting ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            {meeting.title.split(' ').slice(0, 2).join(' ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-surface-500">Manual</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-surface-500 text-sm">No tasks match your filters.</div>
          )}
        </div>
      </div>
    )
  }

  // ── Timeline / Progress View ──
  function renderTimeline() {
    const grouped = new Map<string, Task[]>()
    filteredTasks.forEach(t => {
      const key = t.projectId ?? 'unassigned'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(t)
    })

    return (
      <div className="space-y-6">
        {/* Per-project progress */}
        {Array.from(grouped.entries()).map(([pid, pTasks]) => {
          const project = getProject(pid)
          const done = pTasks.filter(t => t.status === 'done').length
          const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0

          return (
            <div key={pid} className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {project ? project.title.split(':')[0] : 'Unassigned'}
                  </h3>
                  <span className="text-xs text-gray-400 dark:text-surface-500">
                    {done}/{pTasks.length} done
                  </span>
                </div>
                <span className="text-sm font-bold text-emerald-500">{pct}%</span>
              </div>

              <div className="w-full h-2 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Horizontal timeline */}
              <div className="relative">
                <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200 dark:bg-surface-700" />
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {pTasks.map(task => {
                    const overdue = isOverdue(task)
                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="relative flex flex-col items-center min-w-[80px] group"
                      >
                        <div className={cn(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all',
                          task.status === 'done' ? 'bg-emerald-500 border-emerald-500' :
                          task.status === 'in-progress' ? 'bg-blue-500 border-blue-500' :
                          task.status === 'blocked' ? 'bg-red-500 border-red-500' :
                          'bg-white dark:bg-surface-800 border-gray-300 dark:border-surface-600',
                          overdue && task.status !== 'done' && 'ring-2 ring-red-300',
                        )}>
                          {task.status === 'done' && <Check className="h-3 w-3 text-white" />}
                          {task.status === 'in-progress' && <Clock className="h-3 w-3 text-white" />}
                          {task.status === 'blocked' && <AlertTriangle className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-[10px] text-gray-600 dark:text-surface-400 mt-1.5 text-center leading-tight line-clamp-2 group-hover:text-blue-500 transition-colors">
                          {task.title.length > 30 ? task.title.slice(0, 30) + '…' : task.title}
                        </span>
                        {task.dueDate && (
                          <span className={cn('text-[9px] mt-0.5', overdue ? 'text-red-500' : 'text-gray-400 dark:text-surface-500')}>
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}

        {/* Per-person stats */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" /> Team Workload
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from(personStats.entries()).map(([uid, s]) => {
              const u = getUserById(uid)
              if (!u) return null
              const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
              return (
                <div key={uid} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-700/30">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{getInitials(u.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{u.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-surface-400 whitespace-nowrap">
                        {s.done}/{s.total} ({pct}%)
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Weekly mini-chart */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> Weekly Productivity
          </h3>
          <div className="flex items-end gap-2 h-24">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-gray-900 dark:text-white">{d.count}</span>
                <div className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-300"
                  style={{ height: `${(d.count / maxWeekly) * 64}px`, minHeight: d.count > 0 ? '4px' : '1px' }} />
                <span className="text-[10px] text-gray-500 dark:text-surface-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Create Task Modal ──
  function renderCreateModal() {
    if (!showCreateModal) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
        <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-surface-800 rounded-2xl border border-gray-200 dark:border-surface-700 shadow-2xl w-full max-w-lg mx-4 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Task</h2>
            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-surface-200">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-surface-400 mb-1">Title *</label>
              <input value={cTitle} onChange={e => setCTitle(e.target.value)} placeholder="Task title…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-surface-600 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-surface-400 mb-1">Description</label>
              <textarea value={cDesc} onChange={e => setCDesc(e.target.value)} rows={3} placeholder="Details…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-surface-600 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-surface-400 mb-1">Assignee</label>
                <select value={cAssignee} onChange={e => setCAssignee(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-white outline-none">
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-surface-400 mb-1">Project</label>
                <select value={cProject} onChange={e => setCProject(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-white outline-none">
                  <option value="">None</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title.split(':')[0]}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-surface-400 mb-1">Priority</label>
                <select value={cPriority} onChange={e => setCPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-white outline-none">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-surface-400 mb-1">Due Date</label>
                <input type="date" value={cDueDate} onChange={e => setCDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-white outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-surface-400 mb-1">Tags (comma-separated)</label>
              <input value={cTags} onChange={e => setCTags(e.target.value)} placeholder="research, urgent, …"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-surface-600 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm rounded-lg text-gray-600 dark:text-surface-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!cTitle.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium">
              Create
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Task Detail Panel ──
  function renderDetailPanel() {
    if (!selectedTask) return null
    const task = tasks.find(t => t.id === selectedTask.id) ?? selectedTask
    const assignee = getUserById(task.assigneeId)
    const project = getProject(task.projectId)
    const meeting = getMeeting(task.meetingId)
    const overdue = isOverdue(task)

    const simulatedLog = [
      { action: 'Task created', time: task.createdAt, by: getUserById(task.assigneeId)?.name ?? 'Unknown' },
      ...(task.status !== 'pending' ? [{ action: `Status changed to ${task.status}`, time: task.completedAt ?? task.createdAt, by: 'System' }] : []),
      ...(task.completedAt ? [{ action: 'Task completed', time: task.completedAt, by: assignee?.name ?? 'Unknown' }] : []),
    ]

    return (
      <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedTask(null)}>
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        <div
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md bg-white dark:bg-surface-800 border-l border-gray-200 dark:border-surface-700 shadow-2xl h-full overflow-y-auto animate-in slide-in-from-right"
        >
          <div className="sticky top-0 z-10 bg-white dark:bg-surface-800 border-b border-gray-200 dark:border-surface-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-4">Task Detail</h2>
            <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-surface-200">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Title (editable) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-1">Title</label>
              <input
                value={task.title}
                onChange={e => updateTask(task.id, { title: e.target.value })}
                className="w-full text-base font-semibold text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-surface-600 focus:border-blue-500 outline-none pb-1 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-1">Description</label>
              <textarea
                value={task.description}
                onChange={e => updateTask(task.id, { description: e.target.value })}
                rows={3}
                className="w-full text-sm text-gray-700 dark:text-surface-300 bg-transparent border border-gray-200 dark:border-surface-700 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            {/* Status buttons */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-2">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(STATUS_META) as TaskStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      if (s === 'done' && task.status !== 'done') handleMarkDone(task.id)
                      else updateTaskStatus(task.id, s)
                    }}
                    className={cn(
                      'text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all',
                      task.status === s
                        ? cn(STATUS_META[s].bg, STATUS_META[s].color, 'ring-1 ring-current')
                        : 'border-gray-200 dark:border-surface-700 text-gray-500 dark:text-surface-400 hover:border-gray-400 dark:hover:border-surface-500',
                    )}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-2">Priority</label>
              <div className="flex gap-1.5">
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => updateTask(task.id, { priority: p })}
                    className={cn(
                      'text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all capitalize flex items-center gap-1',
                      task.priority === p
                        ? cn('border-current ring-1 ring-current', PRIORITY_META[p].color)
                        : 'border-gray-200 dark:border-surface-700 text-gray-500 dark:text-surface-400 hover:border-gray-400 dark:hover:border-surface-500',
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full', PRIORITY_META[p].dot)} />
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee & Project */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-1">Assignee</label>
                <select
                  value={task.assigneeId}
                  onChange={e => updateTask(task.id, { assigneeId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-700 text-gray-900 dark:text-white outline-none"
                >
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-1">Project</label>
                <select
                  value={task.projectId ?? ''}
                  onChange={e => updateTask(task.id, { projectId: e.target.value || undefined })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-700 text-gray-900 dark:text-white outline-none"
                >
                  <option value="">None</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title.split(':')[0]}</option>)}
                </select>
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-1">Due Date</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={task.dueDate?.split('T')[0] ?? ''}
                  onChange={e => updateTask(task.id, { dueDate: e.target.value || undefined })}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-700 text-gray-900 dark:text-white outline-none"
                />
                {overdue && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Overdue
                  </span>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-1">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-700 text-gray-600 dark:text-surface-300 border border-gray-200 dark:border-surface-600">
                    {tag}
                  </span>
                ))}
                {task.tags.length === 0 && <span className="text-xs text-gray-400 dark:text-surface-500">No tags</span>}
              </div>
            </div>

            {/* Meeting link */}
            {meeting && (
              <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Video className="h-4 w-4 text-purple-500" />
                  <span className="text-gray-700 dark:text-surface-300">From meeting:</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">{meeting.title}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-surface-400 mt-1">
                  {formatDate(meeting.scheduledAt)}
                </div>
              </div>
            )}

            {/* Activity log */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-surface-400 mb-2">Activity</label>
              <div className="space-y-2">
                {simulatedLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-surface-600 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-gray-700 dark:text-surface-300">{entry.action}</span>
                      <span className="text-gray-400 dark:text-surface-500 ml-1">by {entry.by}</span>
                      <div className="text-gray-400 dark:text-surface-500">{formatRelativeTime(entry.time)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete */}
            <div className="pt-4 border-t border-gray-200 dark:border-surface-700">
              {deleteConfirmId === task.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Delete this task?</span>
                  <button
                    onClick={() => { deleteTask(task.id); setSelectedTask(null); setDeleteConfirmId(null) }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Confirm
                  </button>
                  <button onClick={() => setDeleteConfirmId(null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-surface-600 text-gray-600 dark:text-surface-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirmId(task.id)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Task
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <ListTodo className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tasks & Progress</h1>
            <p className="text-xs text-gray-500 dark:text-surface-400">{stats.total} tasks · {stats.completionRate}% complete</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggles */}
          <div className="flex items-center bg-gray-100 dark:bg-surface-700 rounded-lg p-0.5">
            {([
              { mode: 'kanban' as ViewMode, icon: Columns3, label: 'Kanban' },
              { mode: 'list' as ViewMode, icon: List, label: 'List' },
              { mode: 'timeline' as ViewMode, icon: BarChart3, label: 'Progress' },
            ]).map(v => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all',
                  viewMode === v.mode
                    ? 'bg-white dark:bg-surface-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-surface-400 hover:text-gray-700 dark:hover:text-surface-200',
                )}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        </div>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-surface-500" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMyTasksOnly(!myTasksOnly); setOverdueOnly(false) }}
            className={cn(
              'text-xs px-3 py-2 rounded-lg border font-medium transition-all',
              myTasksOnly
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'border-gray-300 dark:border-surface-600 text-gray-600 dark:text-surface-400 hover:border-gray-400 dark:hover:border-surface-500',
            )}
          >
            My Tasks
          </button>
          <button
            onClick={() => { setOverdueOnly(!overdueOnly); setMyTasksOnly(false) }}
            className={cn(
              'text-xs px-3 py-2 rounded-lg border font-medium transition-all',
              overdueOnly
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                : 'border-gray-300 dark:border-surface-600 text-gray-600 dark:text-surface-400 hover:border-gray-400 dark:hover:border-surface-500',
            )}
          >
            Overdue
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-all',
              showFilters || activeFilterCount > 0
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                : 'border-gray-300 dark:border-surface-600 text-gray-600 dark:text-surface-400 hover:border-gray-400 dark:hover:border-surface-500',
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px]">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 dark:bg-surface-900/50 rounded-xl border border-gray-200 dark:border-surface-700">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TaskStatus | 'all')}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-surface-200 outline-none">
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_META) as TaskStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as TaskPriority | 'all')}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-surface-200 outline-none">
            <option value="all">All Priorities</option>
            {(Object.keys(PRIORITY_META) as TaskPriority[]).map(p => <option key={p} value={p} className="capitalize">{PRIORITY_META[p].label}</option>)}
          </select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-surface-200 outline-none">
            <option value="all">All Assignees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-surface-200 outline-none">
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title.split(':')[0]}</option>)}
          </select>
          <select value={filterMeeting} onChange={e => setFilterMeeting(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-surface-200 outline-none">
            <option value="all">All Sources</option>
            {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterAssignee('all'); setFilterProject('all'); setFilterMeeting('all') }}
              className="text-xs text-red-500 hover:text-red-600 font-medium"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Moving task indicator */}
      {movingTaskId && (
        <div className="mb-4 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-blue-500 animate-pulse" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Click a column to move <strong>{tasks.find(t => t.id === movingTaskId)?.title}</strong>
          </span>
          <button onClick={() => setMovingTaskId(null)} className="ml-auto text-xs text-blue-500 hover:text-blue-600">Cancel</button>
        </div>
      )}

      {/* View content */}
      {viewMode === 'kanban' && renderKanban()}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'timeline' && renderTimeline()}

      {/* Modals & Panels */}
      {renderCreateModal()}
      {renderDetailPanel()}
    </div>
  )
}
