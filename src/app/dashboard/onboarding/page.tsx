'use client'

import { useState } from 'react'
import {
  GraduationCap,
  BookOpen,
  FlaskConical,
  Brain,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  User,
  Link2,
  Compass,
  HelpCircle,
  Zap,
  Github,
  BarChart2,
  FileText,
  Calendar,
  Cloud,
  Search,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const roles = [
  { id: 'pi', label: 'Principal Investigator', desc: 'Leading a lab or research group' },
  { id: 'phd', label: 'PhD Student', desc: 'Working toward doctoral research' },
  { id: 'masters', label: 'Masters Student', desc: 'Completing a master\'s thesis' },
  { id: 'undergrad', label: 'Undergraduate', desc: 'Exploring research for the first time' },
  { id: 'visiting', label: 'Visiting Researcher', desc: 'Collaborating with this lab' },
  { id: 'industry', label: 'Industry Researcher', desc: 'Applied R&D professional' },
]

const interests = [
  'Deep Learning', 'Computer Vision', 'NLP', 'Reinforcement Learning',
  'Graph Neural Networks', 'Generative Models', 'Robotics', 'Medical Imaging',
  'Federated Learning', 'LLMs', 'Drug Discovery', 'Edge AI',
  'Formal Verification', 'Multimodal Learning', '3D Vision', 'Optimization',
]

const tools = [
  { id: 'github', name: 'GitHub', desc: 'Code repositories & version control', icon: Github },
  { id: 'wandb', name: 'Weights & Biases', desc: 'Experiment tracking & visualization', icon: BarChart2 },
  { id: 'overleaf', name: 'Overleaf', desc: 'Collaborative LaTeX writing', icon: FileText },
  { id: 'gcal', name: 'Google Calendar', desc: 'Sync deadlines & milestones', icon: Calendar },
  { id: 'arxiv', name: 'arXiv', desc: 'Daily paper digests', icon: BookOpen },
  { id: 'gcloud', name: 'Cloud Compute', desc: 'Monitor GPU instances', icon: Cloud },
  { id: 'scholar', name: 'Google Scholar', desc: 'Citation tracking', icon: Search },
  { id: 'slack', name: 'Slack', desc: 'Team communication', icon: Link2 },
]

const tourFeatures = [
  { title: 'Projects Dashboard', desc: 'Track all your research projects, milestones, health scores, and team members in one place.', icon: Compass },
  { title: 'Paper Library', desc: 'Organize papers with reading status, annotations, and AI-generated summaries.', icon: BookOpen },
  { title: 'Experiment Tracker', desc: 'Log experiment configs, results, and conclusions. Compare runs side by side.', icon: FlaskConical },
  { title: 'Idea Canvas', desc: 'Capture hypotheses, vote on ideas, and track them from inception to validation.', icon: Brain },
  { title: 'AI Research Agent', desc: 'Ask questions about your lab\'s data — papers, experiments, deadlines, and more.', icon: Sparkles },
]

const quizQuestions = [
  {
    question: 'What is the gold standard for evaluating image segmentation models?',
    options: ['Accuracy', 'F1 Score', 'Dice Score', 'BLEU Score'],
    answer: 2,
  },
  {
    question: 'Which technique helps transfer robot policies from simulation to real world?',
    options: ['Transfer Learning', 'Domain Randomization', 'Data Augmentation', 'Batch Normalization'],
    answer: 1,
  },
  {
    question: 'What does "zero-shot transfer" mean in NLP?',
    options: [
      'Training with zero data',
      'Evaluating on a language not seen during training',
      'Using no pre-trained model',
      'Removing all biases',
    ],
    answer: 1,
  },
  {
    question: 'What is the primary benefit of federated learning?',
    options: [
      'Faster training',
      'Better accuracy',
      'Privacy preservation across institutions',
      'Smaller model size',
    ],
    answer: 2,
  },
  {
    question: 'Which metric is commonly used for pass/fail evaluation of code generation?',
    options: ['BLEU Score', 'pass@k', 'Perplexity', 'ROUGE'],
    answer: 1,
  },
]

const steps = [
  { id: 1, title: 'Welcome', icon: Sparkles },
  { id: 2, title: 'Profile', icon: User },
  { id: 3, title: 'Integrations', icon: Link2 },
  { id: 4, title: 'Lab Tour', icon: Compass },
  { id: 5, title: 'Quiz', icon: HelpCircle },
]

export default function OnboardingPage() {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)

  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [connectedTools, setConnectedTools] = useState<string[]>([])
  const [activeTourIdx, setActiveTourIdx] = useState(0)

  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>(
    Array(quizQuestions.length).fill(null),
  )
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  const quizScore = quizAnswers.reduce<number>(
    (score: number, answer, i) => score + (answer === quizQuestions[i].answer ? 1 : 0),
    0,
  )

  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100)

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    )
  }

  function toggleTool(toolId: string) {
    setConnectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-brand-500 dark:text-brand-400" />
          Smart Onboarding
        </h1>
        <p className="text-surface-500 dark:text-surface-400 mt-2">
          Welcome{user ? `, ${user.name}` : ''}! Let&apos;s get you set up in under 5 minutes.
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-surface-500 dark:text-surface-400">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{progressPercent}% complete</span>
        </div>
        <div className="h-2 rounded-full bg-surface-100 dark:bg-surface-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(i)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              i === currentStep
                ? 'bg-brand-500 text-white shadow-sm'
                : i < currentStep
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700',
            )}
          >
            {i < currentStep ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <step.icon className="w-4 h-4" />
            )}
            <span className="hidden md:inline">{step.title}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-6 shadow-sm dark:shadow-none min-h-[400px]">

        {/* Step 1: Welcome + Choose Role */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <Sparkles className="w-16 h-16 text-brand-500 dark:text-brand-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                Welcome to ResearchOS
              </h2>
              <p className="text-surface-500 dark:text-surface-400 mt-2 max-w-lg mx-auto">
                Your intelligent research management platform. Let&apos;s start by understanding your role.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-4 text-center">
                What best describes you?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-all',
                      selectedRole === role.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 ring-2 ring-brand-500/20'
                        : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-surface-300 dark:hover:border-surface-600',
                    )}
                  >
                    <div className={cn(
                      'text-sm font-semibold mb-1',
                      selectedRole === role.id
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-surface-800 dark:text-surface-200',
                    )}>
                      {role.label}
                    </div>
                    <div className="text-xs text-surface-500 dark:text-surface-400">
                      {role.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Profile — Research Interests */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <User className="w-12 h-12 text-brand-500 dark:text-brand-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                Set Up Your Profile
              </h2>
              <p className="text-surface-500 dark:text-surface-400 mt-1">
                Select your research interests so we can personalize your experience.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-surface-600 dark:text-surface-300 mb-3">
                Research Interests
                {selectedInterests.length > 0 && (
                  <span className="ml-2 text-xs text-brand-500 dark:text-brand-400">
                    ({selectedInterests.length} selected)
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                      selectedInterests.includes(interest)
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'
                        : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800',
                    )}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            {selectedInterests.length >= 3 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Great choices! We&apos;ll tailor paper recommendations and project suggestions for you.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Connect Your Tools */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <Link2 className="w-12 h-12 text-brand-500 dark:text-brand-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                Connect Your Tools
              </h2>
              <p className="text-surface-500 dark:text-surface-400 mt-1">
                Integrate with the tools you already use. You can always add more later.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tools.map((tool) => {
                const connected = connectedTools.includes(tool.id)
                return (
                  <button
                    key={tool.id}
                    onClick={() => toggleTool(tool.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-4 text-left transition-all',
                      connected
                        ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-surface-300 dark:hover:border-surface-600',
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      connected
                        ? 'bg-emerald-100 dark:bg-emerald-500/20'
                        : 'bg-surface-100 dark:bg-surface-700',
                    )}>
                      <tool.icon className={cn(
                        'h-5 w-5',
                        connected
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-surface-400 dark:text-surface-500',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'text-sm font-semibold',
                        connected
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-surface-800 dark:text-surface-200',
                      )}>
                        {tool.name}
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400 truncate">
                        {tool.desc}
                      </div>
                    </div>
                    {connected && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>

            {connectedTools.length > 0 && (
              <p className="text-center text-sm text-surface-400 dark:text-surface-500">
                {connectedTools.length} tool{connectedTools.length > 1 ? 's' : ''} connected
              </p>
            )}
          </div>
        )}

        {/* Step 4: Quick Lab Tour */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <Compass className="w-12 h-12 text-brand-500 dark:text-brand-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                Quick Lab Tour
              </h2>
              <p className="text-surface-500 dark:text-surface-400 mt-1">
                Here&apos;s a quick walkthrough of what ResearchOS can do for you.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Feature list */}
              <div className="lg:col-span-2 space-y-2">
                {tourFeatures.map((feature, i) => (
                  <button
                    key={feature.title}
                    onClick={() => setActiveTourIdx(i)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-all',
                      activeTourIdx === i
                        ? 'bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20'
                        : 'hover:bg-surface-50 dark:hover:bg-surface-800',
                    )}
                  >
                    <feature.icon className={cn(
                      'h-5 w-5 shrink-0',
                      activeTourIdx === i
                        ? 'text-brand-500 dark:text-brand-400'
                        : 'text-surface-400 dark:text-surface-500',
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      activeTourIdx === i
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-surface-600 dark:text-surface-300',
                    )}>
                      {feature.title}
                    </span>
                  </button>
                ))}
              </div>

              {/* Feature detail */}
              <div className="lg:col-span-3 flex items-center justify-center">
                <div className="rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 p-8 text-center w-full">
                  {(() => {
                    const feature = tourFeatures[activeTourIdx]
                    return (
                      <>
                        <feature.icon className="w-12 h-12 text-brand-500 dark:text-brand-400 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto">
                          {feature.desc}
                        </p>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Knowledge Quiz */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <HelpCircle className="w-12 h-12 text-brand-500 dark:text-brand-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                Knowledge Quiz
              </h2>
              <p className="text-surface-500 dark:text-surface-400 mt-1">
                Test your understanding of research methodology. No pressure!
              </p>
            </div>

            <div className="space-y-5">
              {quizQuestions.map((q, qi) => (
                <div
                  key={qi}
                  className="rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 p-4"
                >
                  <p className="font-medium text-surface-700 dark:text-surface-200 mb-3">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => {
                          if (!quizSubmitted) {
                            const newAnswers = [...quizAnswers]
                            newAnswers[qi] = oi
                            setQuizAnswers(newAnswers)
                          }
                        }}
                        className={cn(
                          'px-4 py-2.5 rounded-lg text-sm text-left transition-all border',
                          quizSubmitted
                            ? oi === q.answer
                              ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                              : quizAnswers[qi] === oi
                                ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/30'
                                : 'bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 border-surface-200 dark:border-surface-700'
                            : quizAnswers[qi] === oi
                              ? 'bg-brand-50 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-500/30'
                              : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700',
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {!quizSubmitted ? (
                <div className="flex justify-center">
                  <button
                    onClick={() => setQuizSubmitted(true)}
                    disabled={quizAnswers.some((a) => a === null)}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Zap className="h-4 w-4" />
                    Submit Answers
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    'rounded-xl p-5 text-center border',
                    quizScore >= 4
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                      : quizScore >= 3
                        ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20'
                        : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
                  )}
                >
                  <div className={cn(
                    'text-3xl font-bold mb-1',
                    quizScore >= 4
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : quizScore >= 3
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400',
                  )}>
                    {quizScore}/{quizQuestions.length}
                  </div>
                  <p className="font-semibold text-surface-800 dark:text-surface-100">
                    {quizScore >= 4
                      ? 'Excellent! You\'re research-ready.'
                      : quizScore >= 3
                        ? 'Good job! You\'re on the right track.'
                        : 'Keep learning! ResearchOS will help you grow.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        {currentStep < steps.length - 1 ? (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Go to Dashboard
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
