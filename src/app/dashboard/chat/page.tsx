'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Hash,
  Megaphone,
  BookOpen,
  Wrench,
  Coffee,
  Send,
  Paperclip,
  AtSign,
  MessageSquare,
  Video,
  X,
  FolderOpen,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useDataStore } from '@/contexts/DataStore'
import { users, getUserById } from '@/lib/mock-data'
import { formatRelativeTime, getInitials, cn } from '@/lib/utils'
import type { ChatChannel } from '@/types'

const channelIcons: Record<ChatChannel['type'], React.ElementType> = {
  announcement: Megaphone,
  project: Hash,
  'reading-group': BookOpen,
  resources: Wrench,
  random: Coffee,
}

const channelTypeLabels: Record<ChatChannel['type'], string> = {
  announcement: 'Announcement',
  project: 'Project',
  'reading-group': 'Reading Group',
  resources: 'Resources',
  random: 'Random',
}

const roleColors: Record<string, string> = {
  pi: 'bg-purple-500',
  phd: 'bg-blue-500',
  masters: 'bg-cyan-500',
  undergrad: 'bg-green-500',
  visiting: 'bg-yellow-500',
  industry: 'bg-orange-500',
}

function renderMessageText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-surface-900 dark:text-surface-100">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

const unreadCounts: Record<string, number> = {
  ch1: 2,
  ch2: 5,
  ch3: 1,
  ch5: 3,
  ch6: 1,
  ch7: 4,
}

export default function ChatPage() {
  const { user } = useAuth()
  const { channels, messages, addChannel, deleteChannel, addMessage } = useDataStore()

  const [activeChannel, setActiveChannel] = useState('ch1')
  const [messageInput, setMessageInput] = useState('')
  const [showMeeting, setShowMeeting] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null)

  const [newChName, setNewChName] = useState('')
  const [newChType, setNewChType] = useState<ChatChannel['type']>('project')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentChannel = channels.find(c => c.id === activeChannel)
  const channelMessages = useMemo(
    () => messages.filter(m => m.channelId === activeChannel),
    [messages, activeChannel],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [channelMessages.length])

  function handleSend() {
    if (!messageInput.trim()) return
    addMessage({
      channelId: activeChannel,
      userId: user?.id ?? 'u1',
      text: messageInput.trim(),
      timestamp: new Date().toISOString(),
      isBot: false,
      reactions: [],
    })
    setMessageInput('')
  }

  function handleCreateChannel() {
    if (!newChName.trim()) return
    const ch = addChannel({
      name: newChName.trim().toLowerCase().replace(/\s+/g, '-'),
      type: newChType,
      labId: 'lab1',
    })
    setNewChName('')
    setNewChType('project')
    setShowNewChannel(false)
    setActiveChannel(ch.id)
  }

  function handleDeleteChannel() {
    if (!deleteChannelId) return
    deleteChannel(deleteChannelId)
    if (activeChannel === deleteChannelId) {
      setActiveChannel(channels[0]?.id ?? '')
    }
    setDeleteChannelId(null)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-transparent shadow-sm dark:shadow-none">
      <div className="w-[260px] shrink-0 bg-surface-50 dark:bg-surface-950 border-r border-surface-200 dark:border-surface-700/50 flex flex-col">
        <div className="p-4 border-b border-surface-200 dark:border-surface-700/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-300 uppercase tracking-wider">
            Channels
          </h2>
          <button
            onClick={() => setShowNewChannel(true)}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
            title="New Channel"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {channels.map(channel => {
            const Icon = channelIcons[channel.type] || Hash
            const unread = unreadCounts[channel.id] || 0
            const isActive = channel.id === activeChannel

            return (
              <div
                key={channel.id}
                className={cn(
                  'group flex items-center',
                  isActive
                    ? 'bg-brand-100 dark:bg-brand-400/10 border-r-2 border-brand-500 dark:border-brand-400'
                    : '',
                )}
              >
                <button
                  onClick={() => setActiveChannel(channel.id)}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800/50 hover:text-surface-900 dark:hover:text-surface-200',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{channel.name}</span>
                  {unread > 0 && (
                    <span className="bg-brand-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                      {unread}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDeleteChannelId(channel.id)}
                  className="mr-2 rounded p-1 text-surface-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  title="Delete channel"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 px-6 flex items-center justify-between border-b border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900/80 shrink-0">
          <div className="flex items-center gap-2">
            {currentChannel && (
              <>
                {(() => {
                  const Icon = channelIcons[currentChannel.type] || Hash
                  return <Icon className="w-5 h-5 text-surface-400 dark:text-surface-400" />
                })()}
                <h1 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  {currentChannel.name}
                </h1>
              </>
            )}
            <span className="text-xs text-surface-400 dark:text-surface-500 ml-2">
              {users.length} members
            </span>
          </div>
          <button
            onClick={() => setShowMeeting(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Video className="w-4 h-4" />
            Start Meeting
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1 bg-surface-50/50 dark:bg-transparent">
          {channelMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-500">
              <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm">Be the first to post in #{currentChannel?.name}</p>
            </div>
          ) : (
            channelMessages.map(msg => {
              const sender = msg.isBot
                ? { name: 'ResearchOS AI', avatar: 'AI', role: 'bot' as const }
                : getUserById(msg.userId)

              if (!sender) return null

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'group flex gap-3 py-3 px-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800/30 transition-colors',
                    msg.isBot ? 'border-l-2 border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-400/5' : '',
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
                      msg.isBot
                        ? 'bg-brand-500'
                        : roleColors[sender.role] || 'bg-surface-500 dark:bg-surface-600',
                    )}
                  >
                    {msg.isBot ? 'AI' : getInitials(sender.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          'font-semibold text-sm',
                          msg.isBot ? 'text-brand-600 dark:text-brand-400' : 'text-surface-900 dark:text-surface-100',
                        )}
                      >
                        {sender.name}
                      </span>
                      {msg.isBot && (
                        <span className="text-[10px] bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded font-medium">
                          BOT
                        </span>
                      )}
                      <span className="text-xs text-surface-400 dark:text-surface-500">
                        {formatRelativeTime(msg.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-surface-600 dark:text-surface-300 mt-1 whitespace-pre-wrap leading-relaxed">
                      {renderMessageText(msg.text)}
                    </div>

                    {msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.reactions.map((reaction, i) => (
                          <button
                            key={i}
                            className="flex items-center gap-1 px-2 py-0.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700/50 rounded-full text-xs hover:border-brand-400/50 transition-colors"
                          >
                            <span>{reaction.emoji}</span>
                            <span className="text-surface-500 dark:text-surface-400">{reaction.userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.replyTo && (
                      <button className="flex items-center gap-1 mt-2 text-xs text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                        <MessageSquare className="w-3 h-3" />
                        View thread
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-6 pb-4 pt-2 shrink-0 bg-white dark:bg-transparent">
          <div className="flex items-center gap-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700/50 rounded-xl px-4 py-2 focus-within:border-brand-400/50 transition-colors">
            <button className="text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              placeholder={`Message #${currentChannel?.name || 'channel'}...`}
              className="flex-1 bg-transparent text-sm text-surface-900 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-500 outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <button className="text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 transition-colors">
              <AtSign className="w-5 h-5" />
            </button>
            <button
              onClick={handleSend}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                messageInput.trim()
                  ? 'bg-brand-500 text-white hover:bg-brand-600'
                  : 'bg-surface-200 dark:bg-surface-700 text-surface-400 dark:text-surface-500',
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showNewChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewChannel(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">New Channel</h2>
              <button
                onClick={() => setShowNewChannel(false)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Channel Name</label>
                <input
                  type="text"
                  value={newChName}
                  onChange={e => setNewChName(e.target.value)}
                  placeholder="e.g. new-experiment"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(channelTypeLabels) as ChatChannel['type'][]).map(type => {
                    const Icon = channelIcons[type] || Hash
                    return (
                      <button
                        key={type}
                        onClick={() => setNewChType(type)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                          newChType === type
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'
                            : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800',
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {channelTypeLabels[type]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowNewChannel(false)}
                className="rounded-lg border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteChannelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteChannelId(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-900 p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Delete Channel</h3>
                <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-surface-700 dark:text-surface-200">
                    #{channels.find(c => c.id === deleteChannelId)?.name}
                  </span>
                  ? All messages in this channel will be permanently removed.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteChannelId(null)}
                className="rounded-lg border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChannel}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showMeeting && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 flex items-center justify-center animate-fade-in">
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700/50 rounded-2xl w-[700px] max-w-[90vw] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                    Lab Meeting — #{currentChannel?.name}
                  </h2>
                  <p className="text-xs text-surface-400 dark:text-surface-500">
                    {users.length} members available
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMeeting(false)}
                className="text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {users.slice(0, 6).map(u => (
                <div
                  key={u.id}
                  className="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700/50 rounded-xl p-4 flex flex-col items-center gap-2"
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white',
                      roleColors[u.role],
                    )}
                  >
                    {getInitials(u.name)}
                  </div>
                  <span className="text-xs text-surface-700 dark:text-surface-300 truncate max-w-full">
                    {u.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Connected</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button className="px-6 py-2.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-200 rounded-xl text-sm font-medium transition-colors">
                Mute
              </button>
              <button className="px-6 py-2.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-200 rounded-xl text-sm font-medium transition-colors">
                Share Screen
              </button>
              <button
                onClick={() => setShowMeeting(false)}
                className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Leave Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
