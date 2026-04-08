'use client'

import { useState } from 'react'
import {
  Settings,
  Bell,
  Shield,
  CreditCard,
  FlaskConical,
  Globe,
  Clock,
  Languages,
  Key,
  Monitor,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Download,
  Plus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const tabs = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'billing', label: 'Billing', icon: CreditCard },
  { key: 'lab-config', label: 'Lab Config', icon: FlaskConical },
] as const

type TabKey = (typeof tabs)[number]['key']

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        enabled ? 'bg-brand-500' : 'bg-surface-700'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

const invoices = [
  { id: 'INV-2025-04', date: 'Apr 1, 2025', amount: '₹9,999', status: 'Paid' },
  { id: 'INV-2025-03', date: 'Mar 1, 2025', amount: '₹9,999', status: 'Paid' },
  { id: 'INV-2025-02', date: 'Feb 1, 2025', amount: '₹9,999', status: 'Paid' },
  { id: 'INV-2025-01', date: 'Jan 1, 2025', amount: '₹9,999', status: 'Paid' },
]

const activeSessions = [
  { device: 'Chrome on Windows', location: 'New Delhi, India', lastActive: 'Now', current: true },
  { device: 'Firefox on Ubuntu', location: 'Mumbai, India', lastActive: '2 hours ago', current: false },
  { device: 'Safari on iPhone', location: 'New Delhi, India', lastActive: '1 day ago', current: false },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  const [labName, setLabName] = useState('Visual Intelligence & Learning Lab (VILL)')
  const [institution, setInstitution] = useState('IIT Delhi')
  const [description, setDescription] = useState('Advancing the frontiers of computer vision, NLP, and AI for science through fundamental research and high-impact publications.')
  const [piName] = useState('Dr. Priya Sharma')
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)')
  const [language, setLanguage] = useState('English')

  const [notifications, setNotifications] = useState({
    emailDigests: true,
    slackNotifications: true,
    deadlineAlerts: true,
    experimentCompletion: true,
    newPaperAdded: false,
    chatMentions: true,
    weeklySummary: true,
  })

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const [defaultTemplate, setDefaultTemplate] = useState('Standard Research Project')
  const [expLogTemplate, setExpLogTemplate] = useState('Detailed with Hyperparameters')
  const [reviewWorkflow, setReviewWorkflow] = useState('PI Approval Required')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Settings</h1>
          <p className="text-sm text-surface-400">
            Manage your lab configuration and preferences
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-900/80 border border-surface-700/50 rounded-xl p-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-brand-500 text-white'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-2">General Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Lab Name</label>
                <input
                  type="text"
                  value={labName}
                  onChange={e => setLabName(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Institution</label>
                <input
                  type="text"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Principal Investigator</label>
                <input
                  type="text"
                  value={piName}
                  readOnly
                  className="w-full bg-surface-800/50 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Timezone
                </label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors"
                >
                  <option>Asia/Kolkata (IST)</option>
                  <option>America/New_York (EST)</option>
                  <option>Europe/London (GMT)</option>
                  <option>Asia/Tokyo (JST)</option>
                  <option>America/Los_Angeles (PST)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5 flex items-center gap-1">
                  <Languages className="w-3 h-3" /> Language
                </label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors"
                >
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Tamil</option>
                  <option>Japanese</option>
                  <option>German</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-surface-700/50">
              <button className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-2">Notification Preferences</h2>

            <div className="space-y-4">
              {([
                { key: 'emailDigests' as const, label: 'Email Digests', desc: 'Receive daily email summaries of lab activity' },
                { key: 'slackNotifications' as const, label: 'Slack Notifications', desc: 'Mirror notifications to connected Slack workspace' },
                { key: 'deadlineAlerts' as const, label: 'Deadline Alerts', desc: 'Get notified 7, 3, and 1 day before deadlines' },
                { key: 'experimentCompletion' as const, label: 'Experiment Completion', desc: 'Alert when experiments finish running' },
                { key: 'newPaperAdded' as const, label: 'New Paper Added', desc: 'Notify when a team member adds a paper to the library' },
                { key: 'chatMentions' as const, label: 'Chat Mentions', desc: 'Get notified when someone @mentions you in chat' },
                { key: 'weeklySummary' as const, label: 'Weekly Summary', desc: 'Receive a comprehensive weekly lab report every Monday' },
              ]).map(item => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-3 px-4 bg-surface-800/50 border border-surface-700/30 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-200">{item.label}</p>
                    <p className="text-xs text-surface-500">{item.desc}</p>
                  </div>
                  <Toggle
                    enabled={notifications[item.key]}
                    onChange={v => setNotifications(prev => ({ ...prev, [item.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-2">Security Settings</h2>

            {/* Change Password */}
            <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg space-y-4">
              <h3 className="text-sm font-semibold text-surface-200">Change Password</h3>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Current password"
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 placeholder-surface-500 outline-none focus:border-brand-400/50 transition-colors"
                />
                <input
                  type="password"
                  placeholder="New password"
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 placeholder-surface-500 outline-none focus:border-brand-400/50 transition-colors"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 placeholder-surface-500 outline-none focus:border-brand-400/50 transition-colors"
                />
              </div>
              <button className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
                Update Password
              </button>
            </div>

            {/* Two-Factor Auth */}
            <div className="flex items-center justify-between p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-surface-700 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-surface-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-200">Two-Factor Authentication</p>
                  <p className="text-xs text-surface-500">
                    {twoFactorEnabled ? 'Enabled — your account has an extra layer of security' : 'Add an extra layer of security to your account'}
                  </p>
                </div>
              </div>
              <Toggle enabled={twoFactorEnabled} onChange={setTwoFactorEnabled} />
            </div>

            {/* Active Sessions */}
            <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Active Sessions
              </h3>
              {activeSessions.map((session, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-surface-700/30 last:border-0">
                  <div>
                    <p className="text-sm text-surface-300">
                      {session.device}
                      {session.current && (
                        <span className="ml-2 text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-surface-500">
                      {session.location} · {session.lastActive}
                    </p>
                  </div>
                  {!session.current && (
                    <button className="text-xs text-red-400 hover:text-red-300 transition-colors">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* API Keys */}
            <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
                  <Key className="w-4 h-4" /> API Keys
                </h3>
                <button className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  <Plus className="w-3 h-3" /> Generate New Key
                </button>
              </div>
              <div className="flex items-center gap-2 bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5">
                <code className="flex-1 text-xs text-surface-400 font-mono">
                  {showApiKey ? 'ros_sk_7f3a9b2c4e1d8f5g6h0j2k4m6n8p0q2r4s6t8' : '••••••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button className="text-surface-500 hover:text-surface-300 transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
                <button className="text-red-400 hover:text-red-300 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-2">Billing & Subscription</h2>

            {/* Current Plan */}
            <div className="bg-gradient-to-r from-brand-500/10 to-brand-400/5 border border-brand-500/20 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-brand-300 font-medium uppercase tracking-wider mb-1">Current Plan</p>
                  <h3 className="text-xl font-bold text-surface-100">Research Lab Pro</h3>
                  <p className="text-sm text-surface-400 mt-1">₹9,999/month · Billed monthly</p>
                </div>
                <button className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
                  Upgrade Plan
                </button>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'AI Queries', used: 342, total: 'Unlimited', pct: 34 },
                { label: 'Papers in Library', used: 15, total: 'Unlimited', pct: 15 },
                { label: 'Team Members', used: 10, total: 25, pct: 40 },
              ].map(stat => (
                <div key={stat.label} className="bg-surface-800/50 border border-surface-700/30 rounded-lg p-4">
                  <p className="text-xs text-surface-400 mb-1">{stat.label}</p>
                  <p className="text-lg font-bold text-surface-100">
                    {stat.used}
                    <span className="text-sm font-normal text-surface-500"> / {stat.total}</span>
                  </p>
                  <div className="mt-2 bg-surface-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-brand-400 rounded-full transition-all duration-500"
                      style={{ width: `${stat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Method */}
            <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg">
              <h3 className="text-sm font-semibold text-surface-200 mb-3">Payment Method</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-surface-700 border border-surface-600 rounded flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-surface-400" />
                  </div>
                  <div>
                    <p className="text-sm text-surface-200">•••• •••• •••• 4242</p>
                    <p className="text-xs text-surface-500">Expires 12/2027</p>
                  </div>
                </div>
                <button className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Update
                </button>
              </div>
            </div>

            {/* Invoice History */}
            <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg">
              <h3 className="text-sm font-semibold text-surface-200 mb-3">Invoice History</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-surface-500 text-xs border-b border-surface-700/30">
                    <th className="text-left font-medium py-2">Invoice</th>
                    <th className="text-left font-medium py-2">Date</th>
                    <th className="text-left font-medium py-2">Amount</th>
                    <th className="text-left font-medium py-2">Status</th>
                    <th className="text-right font-medium py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-surface-700/20 last:border-0">
                      <td className="py-2.5 text-surface-300 font-mono text-xs">{inv.id}</td>
                      <td className="py-2.5 text-surface-400">{inv.date}</td>
                      <td className="py-2.5 text-surface-200 font-medium">{inv.amount}</td>
                      <td className="py-2.5">
                        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button className="text-surface-500 hover:text-surface-300 transition-colors">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lab Config Tab */}
        {activeTab === 'lab-config' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-2">Lab Configuration</h2>

            <div className="space-y-4">
              <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg">
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Default Project Template
                </label>
                <select
                  value={defaultTemplate}
                  onChange={e => setDefaultTemplate(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors"
                >
                  <option>Standard Research Project</option>
                  <option>Industry Collaboration</option>
                  <option>Literature Survey</option>
                  <option>Replication Study</option>
                  <option>Hackathon / Short Project</option>
                </select>
                <p className="text-xs text-surface-500 mt-1.5">Template used when creating new projects</p>
              </div>

              <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg">
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Experiment Log Template
                </label>
                <select
                  value={expLogTemplate}
                  onChange={e => setExpLogTemplate(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors"
                >
                  <option>Detailed with Hyperparameters</option>
                  <option>Minimal (Results Only)</option>
                  <option>ML Experiment Card</option>
                  <option>Custom Template</option>
                </select>
                <p className="text-xs text-surface-500 mt-1.5">Default format for experiment logs</p>
              </div>

              <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg">
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Paper Review Workflow
                </label>
                <select
                  value={reviewWorkflow}
                  onChange={e => setReviewWorkflow(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-brand-400/50 transition-colors"
                >
                  <option>PI Approval Required</option>
                  <option>Peer Review (2 members)</option>
                  <option>No Approval Needed</option>
                  <option>Custom Workflow</option>
                </select>
                <p className="text-xs text-surface-500 mt-1.5">Workflow for paper submissions and internal reviews</p>
              </div>

              <div className="p-4 bg-surface-800/50 border border-surface-700/30 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-surface-200">Custom Fields</h3>
                  <button className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                    <Plus className="w-3 h-3" /> Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'GPU Hours Used', type: 'Number', scope: 'Experiment' },
                    { name: 'Collaboration Type', type: 'Dropdown', scope: 'Project' },
                    { name: 'Reproducibility Score', type: 'Number', scope: 'Paper' },
                  ].map(field => (
                    <div key={field.name} className="flex items-center justify-between py-2 border-b border-surface-700/20 last:border-0">
                      <div>
                        <p className="text-sm text-surface-300">{field.name}</p>
                        <p className="text-xs text-surface-500">{field.type} · Applied to {field.scope}</p>
                      </div>
                      <button className="text-xs text-red-400 hover:text-red-300 transition-colors">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-surface-700/50">
              <button className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
                Save Configuration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
