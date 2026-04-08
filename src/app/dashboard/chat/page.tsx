'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { channels, messages, users, getUserById, getMessagesByChannel } from '@/lib/mock-data'
import { formatRelativeTime, getInitials } from '@/lib/utils'
import type { ChatChannel } from '@/types'

const channelIcons: Record<ChatChannel['type'], React.ElementType> = {
  announcement: Megaphone,
  project: Hash,
  'reading-group': BookOpen,
  resources: Wrench,
  random: Coffee,
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
        <strong key={i} className="font-semibold text-surface-100">
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
  const [activeChannel, setActiveChannel] = useState('ch1')
  const [messageInput, setMessageInput] = useState('')
  const [showMeeting, setShowMeeting] = useState(false)

  const currentChannel = channels.find(c => c.id === activeChannel)
  const channelMessages = getMessagesByChannel(activeChannel)

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Channel Sidebar */}
      <div className="w-[250px] shrink-0 bg-surface-950 border-r border-surface-700/50 flex flex-col">
        <div className="p-4 border-b border-surface-700/50">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">
            Channels
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {channels.map(channel => {
            const Icon = channelIcons[channel.type] || Hash
            const unread = unreadCounts[channel.id] || 0
            const isActive = channel.id === activeChannel

            return (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel.id)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-400/10 text-brand-400 border-r-2 border-brand-400'
                    : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">{channel.name}</span>
                {unread > 0 && (
                  <span className="bg-brand-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-surface-700/50 bg-surface-900/80 shrink-0">
          <div className="flex items-center gap-2">
            {currentChannel && (
              <>
                {(() => {
                  const Icon = channelIcons[currentChannel.type] || Hash
                  return <Icon className="w-5 h-5 text-surface-400" />
                })()}
                <h1 className="text-lg font-semibold text-surface-100">
                  {currentChannel.name}
                </h1>
              </>
            )}
            <span className="text-xs text-surface-500 ml-2">
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {channelMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-surface-500">
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
                  className={`group flex gap-3 py-3 px-3 rounded-lg hover:bg-surface-800/30 transition-colors ${
                    msg.isBot ? 'border-l-2 border-brand-400 bg-brand-400/5' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                      msg.isBot
                        ? 'bg-brand-500'
                        : roleColors[sender.role] || 'bg-surface-600'
                    }`}
                  >
                    {msg.isBot ? 'AI' : getInitials(sender.name)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`font-semibold text-sm ${
                          msg.isBot ? 'text-brand-400' : 'text-surface-100'
                        }`}
                      >
                        {sender.name}
                      </span>
                      {msg.isBot && (
                        <span className="text-[10px] bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded font-medium">
                          BOT
                        </span>
                      )}
                      <span className="text-xs text-surface-500">
                        {formatRelativeTime(msg.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-surface-300 mt-1 whitespace-pre-wrap leading-relaxed">
                      {renderMessageText(msg.text)}
                    </div>

                    {/* Reactions */}
                    {msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.reactions.map((reaction, i) => (
                          <button
                            key={i}
                            className="flex items-center gap-1 px-2 py-0.5 bg-surface-800 border border-surface-700/50 rounded-full text-xs hover:border-brand-400/50 transition-colors"
                          >
                            <span>{reaction.emoji}</span>
                            <span className="text-surface-400">{reaction.userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reply thread indicator */}
                    {msg.replyTo && (
                      <button className="flex items-center gap-1 mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                        <MessageSquare className="w-3 h-3" />
                        View thread
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Message Input */}
        <div className="px-6 pb-4 pt-2 shrink-0">
          <div className="flex items-center gap-2 bg-surface-800 border border-surface-700/50 rounded-xl px-4 py-2 focus-within:border-brand-400/50 transition-colors">
            <button className="text-surface-500 hover:text-surface-300 transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              placeholder={`Message #${currentChannel?.name || 'channel'}...`}
              className="flex-1 bg-transparent text-sm text-surface-200 placeholder-surface-500 outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && messageInput.trim()) setMessageInput('')
              }}
            />
            <button className="text-surface-500 hover:text-surface-300 transition-colors">
              <AtSign className="w-5 h-5" />
            </button>
            <button
              onClick={() => messageInput.trim() && setMessageInput('')}
              className={`p-1.5 rounded-lg transition-colors ${
                messageInput.trim()
                  ? 'bg-brand-500 text-white hover:bg-brand-600'
                  : 'bg-surface-700 text-surface-500'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Meeting Mode Overlay */}
      {showMeeting && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center animate-fade-in">
          <div className="bg-surface-900 border border-surface-700/50 rounded-2xl w-[700px] max-w-[90vw] p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-surface-100">
                    Lab Meeting — #{currentChannel?.name}
                  </h2>
                  <p className="text-xs text-surface-500">
                    {users.length} members available
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMeeting(false)}
                className="text-surface-500 hover:text-surface-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {users.slice(0, 6).map(u => (
                <div
                  key={u.id}
                  className="bg-surface-800 border border-surface-700/50 rounded-xl p-4 flex flex-col items-center gap-2"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      roleColors[u.role]
                    }`}
                  >
                    {getInitials(u.name)}
                  </div>
                  <span className="text-xs text-surface-300 truncate max-w-full">
                    {u.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-400">Connected</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button className="px-6 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-xl text-sm font-medium transition-colors">
                Mute
              </button>
              <button className="px-6 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-xl text-sm font-medium transition-colors">
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
