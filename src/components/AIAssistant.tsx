'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, Trash2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chatWithLLM, getLLMConfig, saveLLMConfig, type LLMMessage, type LLMConfig } from '@/lib/llm'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_ACTIONS = [
  { label: 'Summarize a paper', prompt: 'Summarize the key contributions of the latest paper I added' },
  { label: 'Brainstorm ideas', prompt: 'Suggest 3 novel research directions for our current projects' },
  { label: 'Review my draft', prompt: 'Review the introduction section of my paper draft and provide feedback' },
  { label: 'Explain a concept', prompt: 'Explain self-attention mechanism in transformers simply' },
  { label: 'Plan experiment', prompt: 'Help me design an ablation study for my model' },
  { label: 'Write abstract', prompt: 'Help me write an abstract for a paper about our latest results' },
]

export default function AIAssistant({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hi! I\'m your ResearchOS AI Assistant. I can help you summarize papers, brainstorm ideas, review drafts, explain concepts, and more. How can I help with your research today?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({ provider: 'mock' })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLlmConfig(getLLMConfig())
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history: LLMMessage[] = messages
        .filter(m => m.id !== '0')
        .map(m => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: text.trim() })

      const response = await chatWithLLM(history)
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    setMessages([{
      id: '0',
      role: 'assistant',
      content: 'Chat cleared. How can I help with your research?',
      timestamp: new Date(),
    }])
  }

  const handleConfigSave = (config: LLMConfig) => {
    setLlmConfig(config)
    saveLLMConfig(config)
    setShowSettings(false)
  }

  if (!isOpen) return null

  return (
    <div className={cn(
      'fixed z-[60] flex flex-col rounded-2xl border shadow-2xl transition-all duration-300',
      'border-surface-700 dark:border-surface-700 bg-white dark:bg-surface-900',
      expanded
        ? 'inset-4 md:inset-8'
        : 'bottom-4 right-4 h-[600px] w-[420px] md:bottom-6 md:right-6',
    )}>
      <div className="flex items-center justify-between rounded-t-2xl border-b border-surface-200 dark:border-surface-700 bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Research Assistant</h3>
            <p className="text-xs text-white/70">
              {llmConfig.provider === 'mock' ? 'Demo Mode' : llmConfig.provider === 'openai' ? 'OpenAI' : 'Anthropic'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(!showSettings)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/20 hover:text-white" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
          <button onClick={clearChat} className="rounded-lg p-1.5 text-white/70 hover:bg-white/20 hover:text-white" title="Clear chat">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/20 hover:text-white" title={expanded ? 'Minimize' : 'Maximize'}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/20 hover:text-white" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-4">
          <h4 className="mb-3 text-sm font-medium text-surface-900 dark:text-surface-100">LLM Configuration</h4>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-surface-600 dark:text-surface-400">Provider</label>
              <select
                value={llmConfig.provider}
                onChange={e => setLlmConfig(prev => ({ ...prev, provider: e.target.value as LLMConfig['provider'] }))}
                className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100"
              >
                <option value="mock">Demo (No API Key)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            {llmConfig.provider !== 'mock' && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-surface-600 dark:text-surface-400">API Key</label>
                  <input
                    type="password"
                    value={llmConfig.apiKey || ''}
                    onChange={e => setLlmConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100"
                    placeholder={llmConfig.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-surface-600 dark:text-surface-400">Model</label>
                  <input
                    type="text"
                    value={llmConfig.model || ''}
                    onChange={e => setLlmConfig(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100"
                    placeholder={llmConfig.provider === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-20250514'}
                  />
                </div>
              </>
            )}
            <button
              onClick={() => handleConfigSave(llmConfig)}
              className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(msg => (
          <div key={msg.id} className={cn('mb-4 flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-md'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 rounded-bl-md border border-surface-200 dark:border-surface-700',
            )}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <p className={cn(
                'mt-1 text-[10px]',
                msg.role === 'user' ? 'text-white/50' : 'text-surface-400 dark:text-surface-500',
              )}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-surface-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && !loading && (
        <div className="border-t border-surface-200 dark:border-surface-700 px-4 py-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-medium text-surface-500">
            <Sparkles className="h-3 w-3" /> Quick actions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                className="rounded-full border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-1 text-xs text-surface-600 dark:text-surface-300 hover:border-brand-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-b-2xl border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your research..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 px-4 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
            style={{ maxHeight: '120px' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
