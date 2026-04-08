'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import type {
  Project, Paper, Idea, Experiment, ChatChannel, ChatMessage,
  Publication, Integration, ActivityItem, IdeaComment, Meeting, Task, TaskStatus, ActionItem
} from '@/types'
import {
  projects as initialProjects,
  papers as initialPapers,
  ideas as initialIdeas,
  experiments as initialExperiments,
  channels as initialChannels,
  messages as initialMessages,
  publications as initialPublications,
  integrations as initialIntegrations,
  activities as initialActivities,
  meetings as initialMeetings,
  tasks as initialTasks,
} from '@/lib/mock-data'
import { generateId } from '@/lib/utils'

interface DataStoreContextType {
  projects: Project[]
  papers: Paper[]
  ideas: Idea[]
  experiments: Experiment[]
  channels: ChatChannel[]
  messages: ChatMessage[]
  publications: Publication[]
  integrations: Integration[]
  activities: ActivityItem[]
  meetings: Meeting[]
  tasks: Task[]

  addProject: (p: Omit<Project, 'id'>) => Project
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void

  addPaper: (p: Omit<Paper, 'id'>) => Paper
  updatePaper: (id: string, updates: Partial<Paper>) => void
  deletePaper: (id: string) => void

  addIdea: (i: Omit<Idea, 'id'>) => Idea
  updateIdea: (id: string, updates: Partial<Idea>) => void
  deleteIdea: (id: string) => void
  voteIdea: (id: string, delta: number) => void
  addIdeaComment: (ideaId: string, comment: Omit<IdeaComment, 'id'>) => void

  addExperiment: (e: Omit<Experiment, 'id'>) => Experiment
  updateExperiment: (id: string, updates: Partial<Experiment>) => void
  deleteExperiment: (id: string) => void

  addChannel: (c: Omit<ChatChannel, 'id'>) => ChatChannel
  deleteChannel: (id: string) => void
  addMessage: (m: Omit<ChatMessage, 'id'>) => ChatMessage

  toggleIntegration: (id: string) => void
  addActivity: (a: Omit<ActivityItem, 'id'>) => void

  addMeeting: (m: Omit<Meeting, 'id'>) => Meeting
  updateMeeting: (id: string, updates: Partial<Meeting>) => void
  deleteMeeting: (id: string) => void
  approveMeetingAction: (meetingId: string, actionId: string, approved: boolean) => void
  pushMeetingTodos: (meetingId: string) => void

  addTask: (t: Omit<Task, 'id'>) => Task
  updateTask: (id: string, updates: Partial<Task>) => void
  updateTaskStatus: (id: string, status: TaskStatus) => void
  deleteTask: (id: string) => void
}

const DataStoreContext = createContext<DataStoreContextType>(null as unknown as DataStoreContextType)

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [papers, setPapers] = useState<Paper[]>(initialPapers)
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas)
  const [experiments, setExperiments] = useState<Experiment[]>(initialExperiments)
  const [channels, setChannels] = useState<ChatChannel[]>(initialChannels)
  const [msgs, setMsgs] = useState<ChatMessage[]>(initialMessages)
  const [publications, setPublications] = useState<Publication[]>(initialPublications)
  const [ints, setInts] = useState<Integration[]>(initialIntegrations)
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities)
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings)
  const [taskList, setTasks] = useState<Task[]>(initialTasks)

  const addActivity = useCallback((a: Omit<ActivityItem, 'id'>) => {
    setActivities(prev => [{ ...a, id: `act-${generateId()}` }, ...prev])
  }, [])

  const addProject = useCallback((p: Omit<Project, 'id'>) => {
    const proj = { ...p, id: `p-${generateId()}` } as Project
    setProjects(prev => [...prev, proj])
    return proj
  }, [])
  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }, [])
  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  const addPaper = useCallback((p: Omit<Paper, 'id'>) => {
    const paper = { ...p, id: `pp-${generateId()}` } as Paper
    setPapers(prev => [...prev, paper])
    return paper
  }, [])
  const updatePaper = useCallback((id: string, updates: Partial<Paper>) => {
    setPapers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }, [])
  const deletePaper = useCallback((id: string) => {
    setPapers(prev => prev.filter(p => p.id !== id))
  }, [])

  const addIdea = useCallback((i: Omit<Idea, 'id'>) => {
    const idea = { ...i, id: `i-${generateId()}` } as Idea
    setIdeas(prev => [...prev, idea])
    return idea
  }, [])
  const updateIdea = useCallback((id: string, updates: Partial<Idea>) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }, [])
  const deleteIdea = useCallback((id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id))
  }, [])
  const voteIdea = useCallback((id: string, delta: number) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, votes: Math.max(0, i.votes + delta) } : i))
  }, [])
  const addIdeaComment = useCallback((ideaId: string, comment: Omit<IdeaComment, 'id'>) => {
    setIdeas(prev => prev.map(i => i.id === ideaId ? {
      ...i, comments: [...i.comments, { ...comment, id: `c-${generateId()}` }]
    } : i))
  }, [])

  const addExperiment = useCallback((e: Omit<Experiment, 'id'>) => {
    const exp = { ...e, id: `e-${generateId()}` } as Experiment
    setExperiments(prev => [...prev, exp])
    return exp
  }, [])
  const updateExperiment = useCallback((id: string, updates: Partial<Experiment>) => {
    setExperiments(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }, [])
  const deleteExperiment = useCallback((id: string) => {
    setExperiments(prev => prev.filter(e => e.id !== id))
  }, [])

  const addChannel = useCallback((c: Omit<ChatChannel, 'id'>) => {
    const ch = { ...c, id: `ch-${generateId()}` } as ChatChannel
    setChannels(prev => [...prev, ch])
    return ch
  }, [])
  const deleteChannel = useCallback((id: string) => {
    setChannels(prev => prev.filter(c => c.id !== id))
  }, [])
  const addMessage = useCallback((m: Omit<ChatMessage, 'id'>) => {
    const msg = { ...m, id: `msg-${generateId()}` } as ChatMessage
    setMsgs(prev => [...prev, msg])
    return msg
  }, [])

  const toggleIntegration = useCallback((id: string) => {
    setInts(prev => prev.map(i => i.id === id ? { ...i, connected: !i.connected } : i))
  }, [])

  const addMeeting = useCallback((m: Omit<Meeting, 'id'>) => {
    const mtg = { ...m, id: `mtg-${generateId()}` } as Meeting
    setMeetings(prev => [...prev, mtg])
    return mtg
  }, [])
  const updateMeeting = useCallback((id: string, updates: Partial<Meeting>) => {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }, [])
  const deleteMeeting = useCallback((id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id))
  }, [])
  const approveMeetingAction = useCallback((meetingId: string, actionId: string, approved: boolean) => {
    setMeetings(prev => prev.map(m => {
      if (m.id !== meetingId || !m.summary) return m
      return {
        ...m,
        summary: {
          ...m.summary,
          actionItems: m.summary.actionItems.map(ai =>
            ai.id === actionId ? { ...ai, approved } : ai
          ),
        },
      }
    }))
  }, [])
  const pushMeetingTodos = useCallback((meetingId: string) => {
    setMeetings(prev => {
      const mtg = prev.find(m => m.id === meetingId)
      if (!mtg?.summary) return prev
      const approved = mtg.summary.actionItems.filter(ai => ai.approved)
      const newTasks: Task[] = approved.map(ai => ({
        id: `tsk-${generateId()}`,
        title: ai.title,
        description: `Auto-generated from meeting: ${mtg.title}`,
        assigneeId: ai.assigneeId,
        projectId: mtg.projectId,
        meetingId: mtg.id,
        status: 'pending' as const,
        priority: ai.priority,
        dueDate: ai.dueDate,
        createdAt: new Date().toISOString(),
        tags: ['meeting-todo'],
        labId: mtg.labId,
      }))
      setTasks(t => [...t, ...newTasks])
      return prev
    })
  }, [])

  const addTask = useCallback((t: Omit<Task, 'id'>) => {
    const task = { ...t, id: `tsk-${generateId()}` } as Task
    setTasks(prev => [...prev, task])
    return task
  }, [])
  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [])
  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? {
      ...t,
      status,
      completedAt: status === 'done' ? new Date().toISOString() : t.completedAt,
    } : t))
  }, [])
  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <DataStoreContext.Provider value={{
      projects, papers, ideas, experiments, channels, messages: msgs,
      publications, integrations: ints, activities, meetings, tasks: taskList,
      addProject, updateProject, deleteProject,
      addPaper, updatePaper, deletePaper,
      addIdea, updateIdea, deleteIdea, voteIdea, addIdeaComment,
      addExperiment, updateExperiment, deleteExperiment,
      addChannel, deleteChannel, addMessage,
      toggleIntegration, addActivity,
      addMeeting, updateMeeting, deleteMeeting, approveMeetingAction, pushMeetingTodos,
      addTask, updateTask, updateTaskStatus, deleteTask,
    }}>
      {children}
    </DataStoreContext.Provider>
  )
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext)
  if (!ctx) throw new Error('useDataStore must be used within DataStoreProvider')
  return ctx
}
