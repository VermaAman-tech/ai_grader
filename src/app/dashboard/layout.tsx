'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Award,
  Bell,
  BookOpen,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PenTool,
  Plug,
  Search,
  Settings,
  Sun,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn, getInitials } from '@/lib/utils'
import type { MemberRole } from '@/types'
import AIAssistant from '@/components/AIAssistant'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  ideas: 'Ideas',
  papers: 'Papers',
  experiments: 'Experiments',
  writing: 'Writing',
  chat: 'Lab Chat',
  team: 'Team',
  search: 'Search',
  publications: 'Publications',
  integrations: 'Integrations',
  settings: 'Settings',
  onboarding: 'Onboarding',
}

function formatRole(role: MemberRole): string {
  const labels: Record<MemberRole, string> = {
    pi: 'Principal Investigator',
    phd: 'PhD Student',
    masters: 'Masters Student',
    undergrad: 'Undergraduate',
    visiting: 'Visiting Researcher',
    industry: 'Industry Partner',
  }
  return labels[role]
}

function isNavActive(pathname: string, href: string): boolean {
  const norm = pathname.replace(/\/$/, '') || '/'
  if (href === '/dashboard') return norm === '/dashboard'
  return norm === href || norm.startsWith(`${href}/`)
}

function buildBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ label: 'Dashboard', href: '/dashboard' }]
  const crumbs: { label: string; href: string }[] = []
  let acc = ''
  for (const seg of segments) {
    acc += `/${seg}`
    const label =
      SEGMENT_LABELS[seg] ??
      seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    crumbs.push({ label, href: acc })
  }
  return crumbs
}

type NavItem = { label: string; href: string; icon: LucideIcon }

const NAV_MAIN: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { label: 'Ideas', href: '/dashboard/ideas', icon: Lightbulb },
  { label: 'Papers', href: '/dashboard/papers', icon: BookOpen },
  { label: 'Experiments', href: '/dashboard/experiments', icon: FlaskConical },
  { label: 'Writing', href: '/dashboard/writing', icon: PenTool },
]

const NAV_COLLABORATE: NavItem[] = [
  { label: 'Lab Chat', href: '/dashboard/chat', icon: MessageSquare },
  { label: 'Team', href: '/dashboard/team', icon: Users },
]

const NAV_DISCOVER: NavItem[] = [
  { label: 'Search', href: '/dashboard/search', icon: Search },
  { label: 'Publications', href: '/dashboard/publications', icon: Award },
]

const NAV_SETTINGS: NavItem[] = [
  { label: 'Integrations', href: '/dashboard/integrations', icon: Plug },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  { label: 'Onboarding', href: '/dashboard/onboarding', icon: GraduationCap },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const headerMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleResize() {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleNavClick = useCallback(() => setMobileOpen(false), [])

  const handleLogout = useCallback(async () => {
    await logout()
    router.replace('/login')
    setHeaderMenuOpen(false)
  }, [logout, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 dark:bg-surface-950">
        <Loader2 className="h-10 w-10 animate-spin text-brand-400" aria-label="Loading" />
      </div>
    )
  }

  const breadcrumbs = buildBreadcrumbs(pathname)
  const initials = getInitials(user.name)

  const renderNavItems = (items: NavItem[]) =>
    items.map(({ label, href, icon: Icon }) => {
      const active = isNavActive(pathname, href)
      return (
        <Link
          key={href}
          href={href}
          onClick={handleNavClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            active
              ? 'bg-brand-500/10 text-brand-500 dark:text-brand-400'
              : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100',
            collapsed && 'md:justify-center md:px-2',
          )}
          title={collapsed ? label : undefined}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          <span className={cn('truncate transition-opacity duration-300', collapsed && 'md:hidden md:w-0 md:opacity-0')}>
            {label}
          </span>
        </Link>
      )
    })

  const sectionTitleClass = cn(
    'mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 transition-opacity duration-300',
    collapsed && 'md:hidden md:opacity-0',
  )

  return (
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-[width,transform] duration-300 ease-in-out md:relative md:z-0 md:translate-x-0',
          'border-surface-200 dark:border-surface-800 bg-white/95 dark:bg-surface-900/95 backdrop-blur',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? 'md:w-[72px]' : 'w-[260px]',
        )}
      >
        <div className={cn('flex shrink-0 items-center justify-between gap-2 border-b border-surface-200 dark:border-surface-800 p-4', collapsed && 'md:flex-col md:justify-start md:gap-3 md:px-2')}>
          <div className={cn('min-w-0 flex-1', collapsed && 'md:flex-none')}>
            <Link href="/dashboard" onClick={handleNavClick} className={cn('block', collapsed && 'md:flex md:justify-center')}>
              <span className={cn('bg-gradient-to-r from-brand-300 via-brand-400 to-brand-500 bg-clip-text text-xl font-bold tracking-tight text-transparent', collapsed && 'md:text-center md:text-lg')}>
                <span className={cn(collapsed && 'md:hidden')}>ResearchOS</span>
                <span className={cn('hidden', collapsed && 'md:inline')}>R</span>
              </span>
            </Link>
            <p className={cn('mt-1 line-clamp-2 text-xs leading-snug text-surface-400 dark:text-surface-500 transition-opacity duration-300', collapsed && 'md:hidden md:h-0 md:opacity-0')}>
              Visual Intelligence & Learning Lab
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden shrink-0 rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 md:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 md:hidden"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3">
          <p className={sectionTitleClass}>Main</p>
          <div className="mb-4 space-y-0.5">{renderNavItems(NAV_MAIN)}</div>
          <p className={sectionTitleClass}>Collaborate</p>
          <div className="mb-4 space-y-0.5">{renderNavItems(NAV_COLLABORATE)}</div>
          <p className={sectionTitleClass}>Discover</p>
          <div className="mb-4 space-y-0.5">{renderNavItems(NAV_DISCOVER)}</div>
          <p className={sectionTitleClass}>Settings</p>
          <div className="space-y-0.5">{renderNavItems(NAV_SETTINGS)}</div>
        </nav>

        <div className={cn('shrink-0 border-t border-surface-200 dark:border-surface-800 p-3', collapsed && 'md:px-2')}>
          <div className={cn('flex items-center gap-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 p-2', collapsed && 'md:flex-col md:gap-2')}>
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500/20 text-sm font-semibold text-brand-600 dark:text-brand-300">
              {initials}
            </div>
            <div className={cn('min-w-0 flex-1 transition-opacity duration-300', collapsed && 'md:hidden md:w-0 md:opacity-0')}>
              <p className="truncate text-sm font-medium text-surface-900 dark:text-surface-100">{user.name}</p>
              <p className="truncate text-xs text-surface-400 dark:text-surface-500">{formatRole(user.role)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className={cn('shrink-0 rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100', collapsed && 'md:mt-0')}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-surface-200 dark:border-surface-800 bg-white/80 dark:bg-surface-950/80 px-3 backdrop-blur md:gap-4 md:px-6">
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-1 items-center gap-1 text-sm text-surface-400 md:flex-initial md:max-w-[40%]"
          >
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                <span key={crumb.href} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <span className="text-surface-300 dark:text-surface-600">/</span>}
                  {isLast ? (
                    <span className="truncate font-medium text-surface-900 dark:text-surface-100">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="truncate transition-colors hover:text-brand-500 dark:hover:text-brand-400">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              )
            })}
          </nav>

          <div className="mx-auto flex min-w-0 max-w-xl flex-1 justify-center px-2">
            <label className="relative block w-full min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 dark:text-surface-500" aria-hidden />
              <input
                type="search"
                placeholder="Search papers, experiments, ideas..."
                className="w-full rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/80 py-2 pl-10 pr-3 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:border-brand-400/50 dark:focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-400/20 dark:focus:ring-brand-500/20"
                onFocus={() => router.push('/dashboard/search')}
              />
            </label>
          </div>

          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/80 px-3 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-200 transition-colors hover:border-brand-400/30 dark:hover:border-brand-500/30 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-brand-600 dark:hover:text-brand-300"
              aria-label="AI assistant"
            >
              <Bot className="h-4 w-4 text-brand-500 dark:text-brand-400" />
              <span className="hidden lg:inline">AI Assistant</span>
            </button>

            <div className="relative" ref={headerMenuRef}>
              <button
                type="button"
                onClick={() => setHeaderMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full p-0.5 ring-2 ring-transparent transition-all hover:ring-surface-300 dark:hover:ring-surface-700"
                aria-expanded={headerMenuOpen}
                aria-haspopup="menu"
                aria-label="User menu"
              >
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-500/20 text-xs font-semibold text-brand-600 dark:text-brand-300">
                  {initials}
                </span>
              </button>
              {headerMenuOpen && (
                <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 py-1 shadow-xl">
                  <div className="border-b border-surface-200 dark:border-surface-800 px-3 py-2">
                    <p className="truncate text-sm font-medium text-surface-900 dark:text-surface-100">{user.name}</p>
                    <p className="truncate text-xs text-surface-400 dark:text-surface-500">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard/settings"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100"
                    onClick={() => { setHeaderMenuOpen(false); handleNavClick() }}
                  >
                    <User className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-50 dark:bg-surface-950 p-6">{children}</main>
      </div>

      <AIAssistant isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  )
}
