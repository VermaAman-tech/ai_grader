'use client'

import { useState } from 'react'
import {
  Users,
  UserPlus,
  X,
  Mail,
  Building2,
  Calendar,
  Dna,
  FolderOpen,
  Check,
} from 'lucide-react'
import { users, projects } from '@/lib/mock-data'
import { getInitials, formatDate } from '@/lib/utils'
import type { MemberRole } from '@/types'

const roleColors: Record<string, string> = {
  pi: 'bg-purple-500',
  phd: 'bg-blue-500',
  masters: 'bg-cyan-500',
  undergrad: 'bg-green-500',
  visiting: 'bg-yellow-500',
  industry: 'bg-orange-500',
}

const roleBadgeStyles: Record<string, string> = {
  pi: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  phd: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  masters: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  undergrad: 'bg-green-500/10 text-green-400 border-green-500/20',
  visiting: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  industry: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const roleLabels: Record<string, string> = {
  pi: 'PI',
  phd: 'PhD',
  masters: 'Masters',
  undergrad: 'Undergrad',
  visiting: 'Visiting',
  industry: 'Industry',
}

const allRoles: MemberRole[] = ['pi', 'phd', 'masters', 'undergrad', 'visiting', 'industry']

export default function TeamPage() {
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('phd')
  const [inviteProjects, setInviteProjects] = useState<string[]>([])

  const roleCounts = allRoles.map(role => ({
    role,
    label: roleLabels[role],
    count: users.filter(u => u.role === role).length,
    color: roleColors[role],
  }))
  const maxRoleCount = Math.max(...roleCounts.map(r => r.count))

  function getUserProjects(userId: string) {
    return projects.filter(p => p.teamMemberIds.includes(userId))
  }

  function toggleInviteProject(projectId: string) {
    setInviteProjects(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-100">Team</h1>
            <p className="text-sm text-surface-400">
              {users.length} members in your lab
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Role Distribution */}
      <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-surface-200 mb-4">Role Distribution</h3>
        <div className="space-y-2.5">
          {roleCounts.map(r => (
            <div key={r.role} className="flex items-center gap-3">
              <span className="text-xs text-surface-400 w-16 shrink-0">{r.label}</span>
              <div className="flex-1 bg-surface-800 rounded-full h-7 overflow-hidden">
                <div
                  className={`h-full ${r.color} rounded-full flex items-center justify-end pr-3 transition-all duration-500`}
                  style={{ width: `${Math.max((r.count / maxRoleCount) * 100, 15)}%` }}
                >
                  <span className="text-xs font-bold text-white">{r.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {users.map(user => {
          const memberProjects = getUserProjects(user.id)

          return (
            <div
              key={user.id}
              className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 hover:border-surface-600/50 transition-all duration-200 group"
            >
              {/* Avatar & Name */}
              <div className="flex flex-col items-center text-center mb-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white mb-3 ring-2 ring-offset-2 ring-offset-surface-900 ring-surface-700/50 group-hover:ring-brand-400/30 transition-all ${
                    roleColors[user.role]
                  }`}
                >
                  {getInitials(user.name)}
                </div>
                <h3 className="text-sm font-semibold text-surface-100">{user.name}</h3>
                <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mt-1.5 ${roleBadgeStyles[user.role]}`}>
                  {roleLabels[user.role]}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-surface-400">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-400">
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span>{user.department}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-400">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>Joined {formatDate(user.joinedAt)}</span>
                </div>
              </div>

              {/* Research DNA */}
              <div className="mb-3">
                <div className="flex items-center gap-1 mb-1.5">
                  <Dna className="w-3 h-3 text-brand-400" />
                  <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                    Research DNA
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.researchDNA.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] bg-brand-400/10 text-brand-300 px-2 py-0.5 rounded-full border border-brand-400/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Projects */}
              {memberProjects.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <FolderOpen className="w-3 h-3 text-surface-500" />
                    <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                      Projects
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {memberProjects.map(p => (
                      <span
                        key={p.id}
                        className="text-[10px] bg-surface-800 text-surface-300 px-2 py-0.5 rounded-full border border-surface-700/50"
                      >
                        {p.title.split(':')[0].trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Invite Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center animate-fade-in">
          <div className="bg-surface-900 border border-surface-700/50 rounded-2xl w-[480px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-100">
                Invite New Member
              </h2>
              <button
                onClick={() => setShowInvite(false)}
                className="text-surface-500 hover:text-surface-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="e.g. Dr. Ananya Gupta"
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 placeholder-surface-500 outline-none focus:border-brand-400/50 transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="e.g. ananya@iitd.ac.in"
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 placeholder-surface-500 outline-none focus:border-brand-400/50 transition-colors"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as MemberRole)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors"
                >
                  {allRoles.map(r => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Projects */}
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Assign to Projects
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {projects.map(p => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-2 bg-surface-800 border border-surface-700/50 rounded-lg cursor-pointer hover:bg-surface-700/50 transition-colors"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          inviteProjects.includes(p.id)
                            ? 'bg-brand-500 border-brand-500'
                            : 'border-surface-600 bg-transparent'
                        }`}
                        onClick={() => toggleInviteProject(p.id)}
                      >
                        {inviteProjects.includes(p.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-xs text-surface-300">{p.title.split(':')[0].trim()}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowInvite(false)}
                className="flex-1 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowInvite(false)}
                className="flex-1 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
