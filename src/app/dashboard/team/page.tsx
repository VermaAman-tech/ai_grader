'use client'

import { useState, useMemo } from 'react'
import {
  Users, UserPlus, X, Mail, Building2, Calendar, Dna, FolderOpen, Check,
  Edit3, Trash2, Activity, BarChart3, Search, Shield,
} from 'lucide-react'
import { users as initialUsers, projects } from '@/lib/mock-data'
import { useDataStore } from '@/contexts/DataStore'
import { getInitials, formatDate } from '@/lib/utils'
import type { MemberRole, User } from '@/types'

const roleColors: Record<string, string> = {
  pi: 'bg-purple-500', phd: 'bg-blue-500', masters: 'bg-cyan-500',
  undergrad: 'bg-green-500', visiting: 'bg-yellow-500', industry: 'bg-orange-500',
}

const roleBadgeStyles: Record<string, string> = {
  pi: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  phd: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  masters: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  undergrad: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  visiting: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  industry: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
}

const roleLabels: Record<string, string> = {
  pi: 'PI', phd: 'PhD', masters: 'Masters', undergrad: 'Undergrad', visiting: 'Visiting', industry: 'Industry',
}

const allRoles: MemberRole[] = ['pi', 'phd', 'masters', 'undergrad', 'visiting', 'industry']

export default function TeamPage() {
  const { activities } = useDataStore()
  const [members, setMembers] = useState<User[]>(initialUsers)
  const [search, setSearch] = useState('')

  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('phd')
  const [inviteDept, setInviteDept] = useState('')

  const [editingMember, setEditingMember] = useState<User | null>(null)
  const [editRole, setEditRole] = useState<MemberRole>('phd')

  const [deletingMember, setDeletingMember] = useState<User | null>(null)

  function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return
    const newMember: User = {
      id: `u-${Date.now()}`, name: inviteName, email: inviteEmail, role: inviteRole,
      avatar: getInitials(inviteName), department: inviteDept || 'Unassigned',
      joinedAt: new Date().toISOString(), researchDNA: [], labId: 'lab1',
    }
    setMembers(prev => [...prev, newMember])
    setInviteName(''); setInviteEmail(''); setInviteRole('phd'); setInviteDept('')
    setShowInvite(false)
  }

  function handleEditRole() {
    if (!editingMember) return
    setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, role: editRole } : m))
    setEditingMember(null)
  }

  function handleRemove() {
    if (!deletingMember) return
    setMembers(prev => prev.filter(m => m.id !== deletingMember.id))
    setDeletingMember(null)
  }

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.department.toLowerCase().includes(q))
  }, [members, search])

  const roleCounts = allRoles.map(role => ({
    role, label: roleLabels[role], count: members.filter(u => u.role === role).length, color: roleColors[role],
  }))
  const maxRoleCount = Math.max(...roleCounts.map(r => r.count), 1)

  const activityPerMember = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of activities) counts[a.userId] = (counts[a.userId] ?? 0) + 1
    return counts
  }, [activities])

  function getUserProjects(userId: string) {
    return projects.filter(p => p.teamMemberIds.includes(userId))
  }

  const inputCls = 'w-full rounded-lg border border-surface-200 dark:border-surface-700/50 bg-surface-50 dark:bg-surface-800 px-3 py-2.5 text-sm text-surface-900 dark:text-surface-200 placeholder:text-surface-400 dark:placeholder:text-surface-500 outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 transition-colors'

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Team</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">{members.length} members in your lab</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
            <input type="text" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-56 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900/80 py-2 pl-9 pr-3 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/20" />
          </div>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
            <UserPlus className="w-4 h-4" /> Invite Member
          </button>
        </div>
      </div>

      {/* Role Distribution */}
      <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Role Distribution</h3>
        </div>
        <div className="space-y-2.5">
          {roleCounts.map(r => (
            <div key={r.role} className="flex items-center gap-3">
              <span className="text-xs text-surface-500 dark:text-surface-400 w-16 shrink-0">{r.label}</span>
              <div className="flex-1 bg-surface-100 dark:bg-surface-800 rounded-full h-7 overflow-hidden">
                <div className={`h-full ${r.color} rounded-full flex items-center justify-end pr-3 transition-all duration-500`}
                  style={{ width: `${Math.max((r.count / maxRoleCount) * 100, 15)}%` }}>
                  <span className="text-xs font-bold text-white">{r.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Per Member */}
      {Object.keys(activityPerMember).length > 0 && (
        <div className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Activity Per Member</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {members.slice(0, 10).map(m => {
              const count = activityPerMember[m.id] ?? 0
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-surface-50 dark:bg-surface-800/50 px-3 py-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${roleColors[m.role]}`}>
                    {getInitials(m.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-surface-800 dark:text-surface-200 truncate">{m.name.split(' ')[0]}</p>
                    <p className="text-[10px] text-surface-400 dark:text-surface-500">{count} actions</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMembers.map(member => {
          const memberProjects = getUserProjects(member.id)
          return (
            <div key={member.id}
              className="bg-white dark:bg-surface-900/80 border border-surface-200 dark:border-surface-700/50 rounded-xl p-5 hover:border-surface-300 dark:hover:border-surface-600/50 transition-all duration-200 group">
              {/* Actions */}
              <div className="flex justify-end gap-1 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingMember(member); setEditRole(member.role) }}
                  className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-brand-500 dark:hover:text-brand-400" title="Edit role">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeletingMember(member)}
                  className="p-1.5 rounded-lg text-surface-400 hover:bg-red-50 dark:hover:bg-surface-800 hover:text-red-500" title="Remove">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Avatar & Name */}
              <div className="flex flex-col items-center text-center mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white mb-3 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-surface-900 ring-surface-200 dark:ring-surface-700/50 group-hover:ring-brand-400/30 transition-all ${roleColors[member.role]}`}>
                  {getInitials(member.name)}
                </div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{member.name}</h3>
                <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mt-1.5 ${roleBadgeStyles[member.role]}`}>
                  {roleLabels[member.role]}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
                  <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
                  <Building2 className="w-3 h-3 shrink-0" /><span>{member.department}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
                  <Calendar className="w-3 h-3 shrink-0" /><span>Joined {formatDate(member.joinedAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
                  <Activity className="w-3 h-3 shrink-0" /><span>{activityPerMember[member.id] ?? 0} recent actions</span>
                </div>
              </div>

              {/* Research DNA */}
              {member.researchDNA.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Dna className="w-3 h-3 text-brand-400" />
                    <span className="text-[10px] font-semibold text-surface-400 dark:text-surface-400 uppercase tracking-wider">Research DNA</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {member.researchDNA.map(tag => (
                      <span key={tag} className="text-[10px] bg-brand-400/10 text-brand-600 dark:text-brand-300 px-2 py-0.5 rounded-full border border-brand-400/20">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {memberProjects.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <FolderOpen className="w-3 h-3 text-surface-400 dark:text-surface-500" />
                    <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Projects</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {memberProjects.map(p => (
                      <span key={p.id} className="text-[10px] bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 px-2 py-0.5 rounded-full border border-surface-200 dark:border-surface-700/50">
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

      {filteredMembers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-surface-400 dark:text-surface-500">
          <Users className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-lg font-medium">No members found</p>
          <p className="text-sm">Try adjusting your search</p>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700/50 rounded-2xl w-[480px] max-w-[90vw] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Invite New Member</h2>
              <button onClick={() => setShowInvite(false)} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Full Name *</label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="e.g. Dr. Ananya Gupta" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Email Address *</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="e.g. ananya@iitd.ac.in" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Role</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as MemberRole)} className={inputCls}>
                    {allRoles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">Department</label>
                  <input type="text" value={inviteDept} onChange={e => setInviteDept(e.target.value)} placeholder="e.g. Computer Science" className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setShowInvite(false)}
                className="flex-1 px-4 py-2.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 text-sm font-medium rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleInvite} disabled={!inviteName.trim() || !inviteEmail.trim()}
                className="flex-1 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40">
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700/50 rounded-2xl w-[420px] max-w-[90vw] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Edit Role</h2>
              <button onClick={() => setEditingMember(null)} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-3 mb-5 p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${roleColors[editingMember.role]}`}>
                {getInitials(editingMember.name)}
              </div>
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{editingMember.name}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">{editingMember.email}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                <Shield className="w-3 h-3 inline mr-1" />New Role
              </label>
              <select value={editRole} onChange={e => setEditRole(e.target.value as MemberRole)} className={inputCls}>
                {allRoles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setEditingMember(null)}
                className="flex-1 px-4 py-2.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 text-sm font-medium rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleEditRole}
                className="flex-1 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      {deletingMember && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700/50 rounded-2xl w-[420px] max-w-[90vw] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-surface-900 dark:text-surface-100">Remove Member</h3>
                <p className="text-sm text-surface-500 dark:text-surface-400">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-6 p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${roleColors[deletingMember.role]}`}>
                {getInitials(deletingMember.name)}
              </div>
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{deletingMember.name}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">{roleLabels[deletingMember.role]} · {deletingMember.department}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingMember(null)}
                className="flex-1 px-4 py-2.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 text-sm font-medium rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleRemove}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl transition-colors">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
