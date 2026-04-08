'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FolderKanban,
  Lightbulb,
  BookOpen,
  FlaskConical,
  PenTool,
  MessageSquare,
  Brain,
  Search,
  ArrowRight,
  Check,
  ChevronRight,
  Menu,
  X,
  Star,
  Upload,
  TestTube,
  FileText,
  Twitter,
  Linkedin,
  Github,
  Youtube,
} from 'lucide-react'
import { pricingTiers } from '@/lib/mock-data'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Integrations', href: '#integrations' },
]

const features = [
  {
    icon: FolderKanban,
    title: 'Research Project Hub',
    description: 'Kanban boards, milestones, and health scores for every project. Always know where things stand.',
  },
  {
    icon: Lightbulb,
    title: 'Idea Canvas',
    description: 'Capture hypotheses, link prior art, vote, and track ideas from spark to validated experiment.',
  },
  {
    icon: BookOpen,
    title: 'Paper Library',
    description: 'Annotate, tag, and deep-link papers to projects. Never lose a critical reference again.',
  },
  {
    icon: FlaskConical,
    title: 'Experiment Tracker',
    description: 'Log parameters, hardware, datasets, and results. Compare runs side-by-side with ease.',
  },
  {
    icon: PenTool,
    title: 'Paper Writing',
    description: 'Collaborative LaTeX editor with two-way Overleaf sync and AI-assisted drafting tools.',
  },
  {
    icon: MessageSquare,
    title: 'Lab Chat + AI',
    description: 'Project channels, reading groups, and an AI bot that actually knows your lab context.',
  },
  {
    icon: Brain,
    title: 'AI Research Agent',
    description: 'Ask questions about your papers, experiments, and ideas. Get citations, not hallucinations.',
  },
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Semantic search across papers, experiments, notes, and chat. Find anything in seconds.',
  },
]

const integrationNames = [
  'Slack', 'Notion', 'GitHub', 'W&B', 'Overleaf', 'arXiv', 'Zotero',
  'Google Scholar', 'Semantic Scholar', 'Google Calendar', 'Google Drive',
  'Hugging Face', 'MLflow', 'AWS', 'IEEE Xplore', 'PubMed', 'Jira',
  'Confluence', 'Trello', 'Microsoft Teams', 'Mendeley', 'Paperpile',
  'Google Docs', 'Dropbox', 'GitLab', 'Comet ML', 'Neptune',
]

const trustedBy = [
  'IIT Delhi', 'IISc Bangalore', 'Stanford', 'MIT', 'NUS', 'ETH Zurich', 'Oxford',
]

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload Papers',
    description: 'Import your library from Zotero, Mendeley, or arXiv. Our AI auto-tags, summarizes, and links every paper to your projects.',
  },
  {
    icon: TestTube,
    step: '02',
    title: 'Run Experiments',
    description: 'Track every parameter, dataset, and result. Compare runs, flag failures, and let the AI surface patterns you missed.',
  },
  {
    icon: FileText,
    step: '03',
    title: 'Publish Research',
    description: 'Write collaboratively with Overleaf sync, auto-generated related work sections, and one-click formatting for any venue.',
  },
]

const testimonials = [
  {
    quote: 'ResearchOS has saved me at least 10 hours a week. I no longer chase my students for updates — the dashboard tells me everything. It\'s like having a second brain for my entire lab.',
    name: 'Dr. Anand Krishnamurthy',
    role: 'PI, IIT Bombay',
    initials: 'AK',
  },
  {
    quote: 'The AI agent is unreal. It doesn\'t just search the internet — it knows our lab\'s context, our running experiments, even our failed ones. It\'s the research assistant I always wanted.',
    name: 'Dr. Sarah Chen',
    role: 'Associate Professor, Stanford',
    initials: 'SC',
  },
  {
    quote: 'The failure archive alone is worth the subscription. I almost repeated an experiment that my senior had tried two years ago — ResearchOS flagged it before I wasted a month of GPU time.',
    name: 'Rohit Menon',
    role: 'PhD Student, IISc',
    initials: 'RM',
  },
]

const addOns = [
  { name: 'Extra AI Queries', spark: '₹499 / 200 queries', starter: '₹999 / 1,000 queries', pro: 'Unlimited', institute: 'Unlimited', enterprise: 'Unlimited' },
  { name: 'Priority GPU Queue', spark: '—', starter: '₹1,499/mo', pro: '₹2,999/mo', institute: 'Included', enterprise: 'Included' },
  { name: 'Custom Domain', spark: '—', starter: '—', pro: '₹999/mo', institute: 'Included', enterprise: 'Included' },
  { name: 'Advanced Analytics', spark: '—', starter: '₹1,999/mo', pro: 'Included', institute: 'Included', enterprise: 'Included' },
]

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Integrations', href: '#integrations' },
    { label: 'Security', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
  ],
  Resources: [
    { label: 'Documentation', href: '#' },
    { label: 'API', href: '#' },
    { label: 'Status', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'SLA', href: '#' },
  ],
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [annualBilling, setAnnualBilling] = useState(true)

  return (
    <div className="min-h-screen bg-surface-950 text-surface-200 overflow-x-hidden">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-surface-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold gradient-text">ResearchOS</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-surface-400 hover:text-surface-100 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="btn-ghost text-sm">
                Login
              </Link>
              <Link href="/register" className="btn-primary text-sm flex items-center gap-1.5">
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <button
              className="md:hidden p-2 text-surface-400 hover:text-surface-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden glass border-t border-surface-700/50 px-4 pb-4 pt-2 space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block py-2 text-sm font-medium text-surface-400 hover:text-surface-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-surface-700/30">
              <Link href="/login" className="btn-ghost text-sm text-center">Login</Link>
              <Link href="/register" className="btn-primary text-sm text-center">Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[128px]" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                Now in Public Beta
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6">
                <span className="gradient-text">The Operating System</span>
                <br />
                <span className="text-surface-100">for Every</span>
                <br />
                <span className="gradient-text">Research Lab</span>
              </h1>

              <p className="text-lg md:text-xl text-surface-400 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                From first idea to published paper — one intelligent platform for
                every researcher, every discipline, every lab.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <Link href="/register" className="btn-primary text-base px-8 py-3.5 flex items-center gap-2 glow">
                  Start Free <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#" className="btn-secondary text-base px-8 py-3.5">
                  Book Demo
                </a>
              </div>
            </div>

            <div className="relative hidden lg:flex items-center justify-center">
              <div className="relative w-full max-w-md space-y-4">
                <div className="animate-float glass rounded-2xl p-5 glow" style={{ animationDelay: '0s' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">Active Projects</span>
                    <FolderKanban className="w-4 h-4 text-brand-400" />
                  </div>
                  <p className="text-3xl font-bold text-surface-100">8</p>
                  <p className="text-sm text-surface-400 mt-1">Active Projects</p>
                  <div className="mt-3 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="animate-float glass rounded-2xl p-5" style={{ animationDelay: '2s' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-surface-500 font-medium">Papers</span>
                    </div>
                    <p className="text-2xl font-bold text-surface-100">15</p>
                    <p className="text-xs text-emerald-400 mt-1">This Month</p>
                  </div>

                  <div className="animate-float glass rounded-2xl p-5" style={{ animationDelay: '4s' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-surface-500 font-medium">Lab Health</span>
                    </div>
                    <p className="text-2xl font-bold text-surface-100">87%</p>
                    <div className="mt-2 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" style={{ width: '87%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Trusted By ─── */}
      <section className="py-16 border-y border-surface-800/50">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-sm font-medium text-surface-500 uppercase tracking-widest mb-8">
            Trusted by research labs at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {trustedBy.map((name) => (
              <span
                key={name}
                className="text-lg md:text-xl font-semibold text-surface-500/80 hover:text-surface-300 transition-colors whitespace-nowrap"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 px-4 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Everything your lab needs,</span>
              <br />
              <span className="text-surface-100">in one place</span>
            </h2>
            <p className="text-surface-400 text-lg max-w-2xl mx-auto">
              Eight powerful modules designed by researchers, for researchers. No more duct-taping 12 different tools together.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group glass rounded-xl p-6 card-hover"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                  <f.icon className="w-5 h-5 text-brand-400" />
                </div>
                <h3 className="text-base font-semibold text-surface-100 mb-2">{f.title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Integrations ─── */}
      <section id="integrations" className="py-24 px-4 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Connects with everything</span>
              <br />
              <span className="text-surface-100">your lab uses</span>
            </h2>
            <p className="text-surface-400 text-lg max-w-2xl mx-auto">
              27+ integrations and growing. Plug ResearchOS into your existing workflow in minutes.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-4xl mx-auto">
            {integrationNames.map((name) => (
              <span
                key={name}
                className="px-4 py-2 rounded-full text-sm font-medium bg-surface-900/80 border border-surface-700/50 text-surface-300 hover:border-brand-500/40 hover:text-brand-300 transition-all cursor-default"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">How It Works</span>
            </h2>
            <p className="text-surface-400 text-lg">Three steps. Zero friction.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.step} className="relative text-center group">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px border-t border-dashed border-surface-700/60" />
                )}
                <div className="w-20 h-20 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-6 group-hover:bg-brand-500/20 transition-colors">
                  <s.icon className="w-8 h-8 text-brand-400" />
                </div>
                <span className="text-xs font-bold text-brand-500 uppercase tracking-widest">Step {s.step}</span>
                <h3 className="text-xl font-bold text-surface-100 mt-2 mb-3">{s.title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed max-w-xs mx-auto">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24 px-4 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Simple, transparent pricing</span>
            </h2>
            <p className="text-surface-400 text-lg max-w-2xl mx-auto">
              Start free, scale as your lab grows. No surprise bills.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm font-medium ${!annualBilling ? 'text-surface-100' : 'text-surface-500'}`}>Monthly</span>
            <button
              onClick={() => setAnnualBilling(!annualBilling)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annualBilling ? 'bg-brand-600' : 'bg-surface-700'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${annualBilling ? 'left-[26px]' : 'left-0.5'}`}
              />
            </button>
            <span className={`text-sm font-medium ${annualBilling ? 'text-surface-100' : 'text-surface-500'}`}>
              Annual <span className="text-brand-400 text-xs ml-1">Save 20%</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  tier.highlight
                    ? 'bg-surface-900/90 border-2 border-brand-500/60 glow-strong'
                    : 'glass'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-600 text-white text-xs font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-lg font-bold text-surface-100">{tier.name}</h3>
                  <p className="text-xs text-surface-500 mt-0.5">{tier.tagline}</p>
                </div>

                <div className="mb-5">
                  <span className="text-3xl font-extrabold text-surface-100">
                    {annualBilling && tier.priceAnnual ? tier.priceAnnual : tier.price}
                  </span>
                  <span className="text-sm text-surface-500 ml-1">{tier.period}</span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-surface-300">
                      <Check className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.cta.includes('Sales') ? '#' : '/register'}
                  className={`w-full text-center py-2.5 rounded-lg font-medium text-sm transition-all ${
                    tier.highlight
                      ? 'bg-brand-600 hover:bg-brand-500 text-white'
                      : 'bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Add-ons table */}
          <div className="mt-16 max-w-5xl mx-auto">
            <h3 className="text-xl font-bold text-surface-100 mb-6 text-center">Add-ons & Extras</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700/50">
                    <th className="text-left py-3 px-4 text-surface-400 font-medium">Add-on</th>
                    <th className="text-center py-3 px-2 text-surface-400 font-medium">Spark</th>
                    <th className="text-center py-3 px-2 text-surface-400 font-medium">Starter</th>
                    <th className="text-center py-3 px-2 text-surface-400 font-medium">Pro</th>
                    <th className="text-center py-3 px-2 text-surface-400 font-medium">Institute</th>
                    <th className="text-center py-3 px-2 text-surface-400 font-medium">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {addOns.map((addon) => (
                    <tr key={addon.name} className="border-b border-surface-800/50 hover:bg-surface-900/50">
                      <td className="py-3 px-4 text-surface-200 font-medium">{addon.name}</td>
                      <td className="py-3 px-2 text-center text-surface-400">{addon.spark}</td>
                      <td className="py-3 px-2 text-center text-surface-400">{addon.starter}</td>
                      <td className="py-3 px-2 text-center text-brand-300">{addon.pro}</td>
                      <td className="py-3 px-2 text-center text-surface-400">{addon.institute}</td>
                      <td className="py-3 px-2 text-center text-surface-400">{addon.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Loved by researchers</span>
            </h2>
            <p className="text-surface-400 text-lg">See what labs around the world are saying.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div key={t.name} className="glass rounded-2xl p-6 flex flex-col">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <blockquote className="text-sm text-surface-300 leading-relaxed flex-1 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3 pt-4 border-t border-surface-700/40">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-300">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-100">{t.name}</p>
                    <p className="text-xs text-surface-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass rounded-3xl p-10 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -left-20 w-60 h-60 bg-brand-500/10 rounded-full blur-[80px]" />
              <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]" />
            </div>

            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                <span className="gradient-text">Ready to supercharge</span>
                <br />
                <span className="text-surface-100">your research lab?</span>
              </h2>
              <p className="text-surface-400 mb-8 max-w-md mx-auto">
                Join hundreds of labs already using ResearchOS. Free forever for solo researchers.
              </p>

              <form
                onSubmit={(e) => e.preventDefault()}
                className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto"
              >
                <input
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field flex-1 w-full"
                />
                <button type="submit" className="btn-primary whitespace-nowrap flex items-center gap-2 px-6 py-2.5">
                  Start Free Trial <ChevronRight className="w-4 h-4" />
                </button>
              </form>
              <p className="text-xs text-surface-500 mt-4">No credit card required. 14-day free trial on all paid plans.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-surface-800/60 pt-16 pb-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="text-xl font-bold gradient-text">ResearchOS</Link>
              <p className="text-sm text-surface-500 mt-3 leading-relaxed">
                The Operating System for Every Research Lab.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <a href="#" className="text-surface-500 hover:text-surface-300 transition-colors"><Twitter className="w-4 h-4" /></a>
                <a href="#" className="text-surface-500 hover:text-surface-300 transition-colors"><Linkedin className="w-4 h-4" /></a>
                <a href="#" className="text-surface-500 hover:text-surface-300 transition-colors"><Github className="w-4 h-4" /></a>
                <a href="#" className="text-surface-500 hover:text-surface-300 transition-colors"><Youtube className="w-4 h-4" /></a>
              </div>
            </div>

            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-surface-100 mb-3">{category}</h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-surface-500 hover:text-surface-300 transition-colors">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-surface-800/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-surface-500">Made with ❤️ for researchers worldwide</p>
            <p className="text-xs text-surface-600">&copy; 2025 ResearchOS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
