'use client'

import { useState } from 'react'
import { GraduationCap, BookOpen, FlaskConical, Brain, CheckCircle2, ChevronRight, Sparkles, MessageSquare, Target, Zap } from 'lucide-react'
import { projects, papers, experiments, getUserById } from '@/lib/mock-data'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

const onboardingSteps = [
  { id: 1, title: 'Welcome to ResearchOS', description: 'Let\'s get you set up and productive in under 5 minutes.', icon: Sparkles },
  { id: 2, title: 'Explore Your Lab', description: 'See all active projects, papers, and experiments.', icon: Target },
  { id: 3, title: 'Read Key Papers', description: 'Your personalized reading list based on your project.', icon: BookOpen },
  { id: 4, title: 'Understand Experiments', description: 'Review past experiments and their outcomes.', icon: FlaskConical },
  { id: 5, title: 'Meet the AI Agent', description: 'Learn how to use the ResearchOS AI for your research.', icon: Brain },
]

const quizQuestions = [
  { question: 'What is the primary architecture used in the MedViT project?', options: ['CNN', 'Vision Transformer', 'RNN', 'GAN'], answer: 1 },
  { question: 'Which dataset is used for the main MedViT experiments?', options: ['ImageNet', 'COCO', 'CT-ORG', 'CIFAR-100'], answer: 2 },
  { question: 'What is the key challenge with token merging for medical segmentation?', options: ['Training speed', 'Loss of boundary details', 'Memory usage', 'Data augmentation'], answer: 1 },
  { question: 'What metric is used to evaluate segmentation performance?', options: ['Accuracy', 'F1 Score', 'Dice Score', 'BLEU Score'], answer: 2 },
]

export default function OnboardingPage() {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>(Array(quizQuestions.length).fill(null))
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [selectedProject, setSelectedProject] = useState('p1')

  const project = projects.find(p => p.id === selectedProject)
  const projectPapers = papers.filter(p => p.projectIds.includes(selectedProject)).slice(0, 5)
  const projectExperiments = experiments.filter(e => e.projectId === selectedProject).slice(0, 5)

  const quizScore = quizAnswers.reduce<number>((score, answer, i) => {
    return score + (answer === quizQuestions[i].answer ? 1 : 0)
  }, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-surface-100 flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-brand-400" />
          Smart Onboarding
        </h1>
        <p className="text-surface-400 mt-2">
          Welcome{user ? `, ${user.name}` : ''}! Get up to speed with your lab&apos;s research in minutes.
        </p>
      </div>

      {/* Project selector */}
      <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
        <label className="text-sm font-medium text-surface-300 block mb-2">Select your project</label>
        <select
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          className="input-field max-w-md"
        >
          {projects.filter(p => p.status !== 'archived').map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {/* Steps progress */}
      <div className="flex items-center gap-2">
        {onboardingSteps.map((step, i) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(i)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              i === currentStep
                ? 'bg-brand-600 text-white'
                : i < currentStep
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
            }`}
          >
            {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
            <span className="hidden md:inline">{step.title}</span>
            <span className="md:hidden">{step.id}</span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-6">
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <Sparkles className="w-16 h-16 text-brand-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-surface-100">Welcome to {project?.title}</h2>
              <p className="text-surface-400 mt-2 max-w-lg mx-auto">{project?.description}</p>
              <div className="flex items-center justify-center gap-4 mt-6">
                <span className="badge bg-brand-500/10 text-brand-400 border-brand-500/20">
                  {project?.domain.join(' · ')}
                </span>
                <span className="badge bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  Target: {project?.targetVenue}
                </span>
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-medium text-surface-300 mb-3">Team Members</h3>
                <div className="flex items-center justify-center gap-3">
                  {project?.teamMemberIds.map(id => {
                    const member = getUserById(id)
                    return member ? (
                      <div key={id} className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold text-white">
                          {member.avatar}
                        </div>
                        <span className="text-xs text-surface-400">{member.name.split(' ')[0]}</span>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-surface-100 flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-400" />
              Lab Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-800 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-brand-400">{projects.length}</div>
                <div className="text-sm text-surface-400">Active Projects</div>
              </div>
              <div className="bg-surface-800 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-emerald-400">{papers.length}</div>
                <div className="text-sm text-surface-400">Papers in Library</div>
              </div>
              <div className="bg-surface-800 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-400">{experiments.length}</div>
                <div className="text-sm text-surface-400">Experiments Logged</div>
              </div>
            </div>
            <div className="bg-surface-800/50 rounded-lg p-4">
              <h3 className="font-medium text-surface-200 mb-3">All Lab Projects</h3>
              <div className="space-y-2">
                {projects.map(p => (
                  <Link
                    key={p.id}
                    href={`/dashboard/projects/${p.id}`}
                    className="flex items-center justify-between p-3 bg-surface-900/80 rounded-lg hover:bg-surface-800 transition-colors"
                  >
                    <div>
                      <span className="text-surface-100 font-medium">{p.title}</span>
                      <span className={`ml-2 badge text-xs ${
                        p.status === 'active' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : p.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-surface-500/10 text-surface-400 border-surface-500/20'
                      }`}>{p.status}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-500" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-surface-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-400" />
              Must-Read Papers for {project?.title.split(':')[0]}
            </h2>
            <p className="text-surface-400">The AI has curated these essential papers based on the project&apos;s history and research direction.</p>
            <div className="space-y-3">
              {projectPapers.map((paper, i) => (
                <div key={paper.id} className="bg-surface-800/50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-medium text-surface-100">{paper.title}</h3>
                      <p className="text-sm text-surface-400 mt-1">{paper.authors.slice(0, 3).join(', ')} — {paper.venue}</p>
                      {paper.keyFindings.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-surface-300">Key findings:</span>
                          <ul className="list-disc list-inside text-xs text-surface-400 mt-1">
                            {paper.keyFindings.map((f, j) => <li key={j}>{f}</li>)}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`badge text-xs ${
                          paper.status === 'deeply-read' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-surface-500/10 text-surface-400 border-surface-500/20'
                        }`}>{paper.status}</span>
                        <span className="text-xs text-surface-500">{paper.citations.toLocaleString()} citations</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-surface-100 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-brand-400" />
              Experiment History for {project?.title.split(':')[0]}
            </h2>
            <p className="text-surface-400">Here&apos;s what the team has tried so far — including what didn&apos;t work.</p>
            <div className="space-y-4">
              {projectExperiments.map(exp => (
                <div key={exp.id} className={`bg-surface-800/50 rounded-lg p-4 border-l-4 ${
                  exp.status === 'completed' ? 'border-emerald-500' : exp.status === 'running' ? 'border-blue-500' : exp.status === 'failed' ? 'border-red-500' : 'border-surface-600'
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-surface-100">{exp.title}</h3>
                    <span className={`badge text-xs ${
                      exp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : exp.status === 'running' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : exp.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-surface-500/10 text-surface-400 border-surface-500/20'
                    }`}>{exp.status}</span>
                  </div>
                  <p className="text-sm text-surface-400 mt-2">{exp.setup.slice(0, 200)}...</p>
                  {exp.results && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(exp.results.metrics).slice(0, 4).map(([key, val]) => (
                        <div key={key} className="bg-surface-900 rounded px-2 py-1">
                          <div className="text-xs text-surface-500">{key}</div>
                          <div className="text-sm font-mono text-surface-200">{typeof val === 'number' && val < 1 ? val.toFixed(3) : val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {exp.results?.conclusion && (
                    <p className="text-sm text-surface-300 mt-2 italic">&ldquo;{exp.results.conclusion}&rdquo;</p>
                  )}
                  {exp.failureReason && (
                    <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                      <span className="text-xs text-red-400">Failure: {exp.failureReason}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-surface-100 flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-400" />
              Meet the ResearchOS AI Agent
            </h2>
            <p className="text-surface-400">The AI agent knows everything about your lab. Here are some things you can ask:</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { q: 'What is the status of every experiment on this project?', icon: FlaskConical },
                { q: 'Which papers discuss attention mechanisms?', icon: BookOpen },
                { q: 'What were the top failures we had?', icon: Target },
                { q: 'Summarize what happened this week', icon: MessageSquare },
              ].map(item => (
                <button
                  key={item.q}
                  className="flex items-start gap-3 p-4 bg-surface-800/50 rounded-lg text-left hover:bg-surface-800 transition-colors"
                >
                  <item.icon className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-surface-300">&ldquo;{item.q}&rdquo;</span>
                </button>
              ))}
            </div>

            {!quizStarted ? (
              <div className="bg-brand-600/10 border border-brand-600/20 rounded-xl p-6 text-center">
                <Zap className="w-10 h-10 text-brand-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-surface-100">Knowledge Quiz</h3>
                <p className="text-surface-400 text-sm mt-1">Test your understanding of the project before diving in.</p>
                <button onClick={() => setQuizStarted(true)} className="btn-primary mt-4">
                  Start Quiz
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-surface-100">Knowledge Quiz</h3>
                {quizQuestions.map((q, qi) => (
                  <div key={qi} className="bg-surface-800/50 rounded-lg p-4">
                    <p className="font-medium text-surface-200 mb-3">{qi + 1}. {q.question}</p>
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
                          className={`px-4 py-2 rounded-lg text-sm text-left transition-all ${
                            quizSubmitted
                              ? oi === q.answer
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : quizAnswers[qi] === oi
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-surface-800 text-surface-400 border border-surface-700'
                              : quizAnswers[qi] === oi
                              ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                              : 'bg-surface-800 text-surface-400 border border-surface-700 hover:bg-surface-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {!quizSubmitted ? (
                  <button
                    onClick={() => setQuizSubmitted(true)}
                    disabled={quizAnswers.some(a => a === null)}
                    className="btn-primary"
                  >
                    Submit Answers
                  </button>
                ) : (
                  <div className={`p-4 rounded-lg ${quizScore >= 3 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
                    <p className="font-bold text-surface-100">
                      Score: {quizScore}/{quizQuestions.length} {quizScore >= 3 ? '— Great job!' : '— Keep reading!'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="btn-secondary disabled:opacity-30"
        >
          Previous
        </button>
        {currentStep < onboardingSteps.length - 1 ? (
          <button onClick={() => setCurrentStep(currentStep + 1)} className="btn-primary flex items-center gap-2">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <Link href="/dashboard" className="btn-primary flex items-center gap-2">
            Go to Dashboard <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
