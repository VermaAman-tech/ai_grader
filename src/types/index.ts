export type ProjectStatus = 'ideation' | 'active' | 'under-review' | 'published' | 'archived'
export type PaperStatus = 'unread' | 'skimmed' | 'read' | 'deeply-read' | 'replicated' | 'cited'
export type ExperimentStatus = 'planned' | 'running' | 'completed' | 'failed' | 'abandoned'
export type IdeaStatus = 'promising' | 'parking-lot' | 'rejected' | 'exploring' | 'validated'
export type MemberRole = 'pi' | 'phd' | 'masters' | 'undergrad' | 'visiting' | 'industry'
export type HighlightCategory = 'contribution' | 'method' | 'dataset' | 'limitation' | 'reproduced' | 'disputed' | 'inspirational'

export interface User {
  id: string
  name: string
  email: string
  role: MemberRole
  avatar: string
  department: string
  joinedAt: string
  researchDNA: string[]
  labId: string
}

export interface Lab {
  id: string
  name: string
  institution: string
  piId: string
  memberIds: string[]
  createdAt: string
}

export interface Project {
  id: string
  title: string
  description: string
  domain: string[]
  targetVenue: string
  piId: string
  teamMemberIds: string[]
  status: ProjectStatus
  healthScore: number
  createdAt: string
  deadline?: string
  milestones: Milestone[]
  labId: string
}

export interface Milestone {
  id: string
  title: string
  date: string
  completed: boolean
}

export interface Paper {
  id: string
  title: string
  authors: string[]
  venue: string
  year: number
  abstract: string
  url: string
  status: PaperStatus
  tags: string[]
  projectIds: string[]
  annotations: Annotation[]
  addedBy: string
  addedAt: string
  citations: number
  keyFindings: string[]
}

export interface Annotation {
  id: string
  userId: string
  text: string
  highlight: string
  category: HighlightCategory
  createdAt: string
}

export interface Idea {
  id: string
  title: string
  hypothesis: string
  motivation: string
  priorArt: string[]
  method: string
  expectedContribution: string
  riskAssessment: string
  status: IdeaStatus
  votes: number
  createdBy: string
  projectId: string
  linkedPaperIds: string[]
  comments: IdeaComment[]
  createdAt: string
}

export interface IdeaComment {
  id: string
  userId: string
  text: string
  createdAt: string
}

export interface Experiment {
  id: string
  title: string
  hypothesisId: string
  projectId: string
  setup: string
  parameters: Record<string, string>
  hardware: string
  dataset: string
  status: ExperimentStatus
  results?: ExperimentResult
  failureReason?: string
  runBy: string
  runDate: string
  completedDate?: string
  notes: string
}

export interface ExperimentResult {
  metrics: Record<string, number>
  observations: string
  plots: string[]
  conclusion: string
}

export interface ChatChannel {
  id: string
  name: string
  type: 'project' | 'announcement' | 'reading-group' | 'random' | 'resources'
  projectId?: string
  labId: string
}

export interface ChatMessage {
  id: string
  channelId: string
  userId: string
  text: string
  timestamp: string
  isBot: boolean
  replyTo?: string
  reactions: { emoji: string; userIds: string[] }[]
}

export interface Publication {
  id: string
  title: string
  venue: string
  status: 'submitted' | 'under-review' | 'accepted' | 'published' | 'rejected'
  submittedDate: string
  authors: string[]
  projectId: string
  citations: number
  impactFactor: number
}

export interface Integration {
  id: string
  name: string
  category: string
  description: string
  icon: string
  connected: boolean
  configUrl?: string
}

export interface ActivityItem {
  id: string
  userId: string
  action: string
  target: string
  targetType: 'project' | 'paper' | 'experiment' | 'idea' | 'chat' | 'publication'
  timestamp: string
}

export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'blocked' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type MeetingStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled'

export interface Meeting {
  id: string
  title: string
  projectId?: string
  scheduledAt: string
  duration: number
  attendeeIds: string[]
  status: MeetingStatus
  transcript?: TranscriptSegment[]
  summary?: MeetingSummary
  recordingUrl?: string
  createdBy: string
  labId: string
}

export interface TranscriptSegment {
  id: string
  speakerId: string
  text: string
  startTime: number
  endTime: number
}

export interface MeetingSummary {
  overview: string
  keyDecisions: string[]
  actionItems: ActionItem[]
  nextSteps: string[]
  blockers: string[]
  progressUpdates: string[]
}

export interface ActionItem {
  id: string
  title: string
  assigneeId: string
  dueDate?: string
  priority: TaskPriority
  approved: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  assigneeId: string
  projectId?: string
  meetingId?: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  createdAt: string
  completedAt?: string
  tags: string[]
  labId: string
}

export type AIProvider = 'mock' | 'openai' | 'anthropic' | 'ollama' | 'groq' | 'together'

export interface AIProviderConfig {
  provider: AIProvider
  apiKey?: string
  model?: string
  baseUrl?: string
  label: string
}

export interface AIFeatureConfig {
  meetingSummary: AIProvider
  todoExtraction: AIProvider
  assistant: AIProvider
  paperReview: AIProvider
  ideaGeneration: AIProvider
  codeReview: AIProvider
}

export interface PricingTier {
  name: string
  tagline: string
  price: string
  priceAnnual?: string
  period: string
  features: string[]
  highlight?: boolean
  cta: string
}
