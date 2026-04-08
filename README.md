# ResearchOS — The Operating System for Every Research Lab

> From first idea to published paper — one intelligent platform for every researcher, every discipline, every lab.

## Quick Start

```bash
cd researchos
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Accounts (Password for all: `demo123`)

| Name | Email | Role | Focus Areas |
|------|-------|------|-------------|
| **Dr. Priya Sharma** | priya@iitd.ac.in | PI (Lab Head) | Deep Learning, Computer Vision, Medical Imaging |
| Arjun Mehta | arjun@iitd.ac.in | PhD Student | GANs, Image Synthesis, Diffusion Models |
| Sneha Iyer | sneha@iitd.ac.in | PhD Student | NLP, Multilingual Models, Low-Resource Languages |
| Rahul Verma | rahul@iitd.ac.in | PhD Student | Reinforcement Learning, Robotics, Sim2Real |
| Kavya Nair | kavya@iitd.ac.in | Masters | Graph Neural Networks, Drug Discovery |
| Vikram Singh | vikram@iitd.ac.in | Masters | Signal Processing, Edge AI |
| Ananya Gupta | ananya@iitd.ac.in | Undergrad | Web Development, ML Basics |
| Dr. Ravi Kumar | ravi@iitd.ac.in | Visiting Researcher | Federated Learning, Privacy |
| Meera Patel | meera@iitd.ac.in | PhD Student | 3D Vision, NeRF, Scene Understanding |
| Aditya Rao | aditya@iitd.ac.in | PhD Student | LLMs, Code Generation, Reasoning |

> **Tip**: On the login page, expand the "Demo Accounts" panel to one-click sign in as any user.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (dark theme, glassmorphism)
- **Auth**: JWT (jose) with HTTP-only cookies
- **Icons**: Lucide React
- **Charts**: Recharts
- **Date Utils**: date-fns

## Features

### Landing Page
- Hero section with animated stat cards
- Features showcase (8 core modules)
- 27+ integration badges (Slack, Notion, GitHub, W&B, Overleaf, arXiv, etc.)
- Pricing in INR (₹) — 5 tiers from Free to Enterprise
- Testimonials from mock research lab heads
- Responsive, production-ready design

### Authentication
- Login / Register with form validation
- JWT-based session management
- Demo credentials pre-filled
- Role-based access (PI, PhD, Masters, Undergrad, Visiting, Industry)

### Dashboard Overview
- Lab health score gauge
- Stats cards (projects, experiments, papers, citations)
- Active project cards with health scores
- Running experiments widget
- Upcoming deadlines
- AI weekly digest
- Recent activity feed

### Research Project Hub
- Project list with filtering (status), searching, and sorting
- Project detail pages with tabs: Overview, Milestones, Experiments, Ideas, Papers
- Milestone timeline with completion tracking
- Health score visualization
- New project creation modal
- Cross-project dependencies

### Idea Canvas
- Idea cards with hypothesis, motivation, method, risk assessment
- Voting system (upvote/downvote)
- Status filtering (Promising, Exploring, Validated, Parking Lot, Rejected)
- AI Idea Expander (mock): generates gaps, experiments, prior work
- Idea detail modal with comments and PI feedback
- Linked papers visualization

### Paper Library
- 15 real research papers with full metadata
- Status tracking: Unread → Skimmed → Read → Deeply Read → Replicated → Cited
- Annotations with category badges (Contribution, Method, Dataset, Limitation, etc.)
- Annotation feed from lab members
- Reading lists curated by project
- Search, filter, sort capabilities
- Paper detail modal with all metadata

### Experiment Tracker
- Experiment cards with full setup, parameters, hardware, dataset
- Status tracking with animated indicators (Running, Completed, Failed, Planned)
- Results display with metrics tables
- Experiment comparison view (side-by-side)
- Failure Wall — dedicated archive of failed experiments with reasons
- Reproducibility checklist
- "Push to Paper" mock action

### Paper Writing Workspace
- Active drafts from projects
- Structured editor with section navigation (Abstract → Conclusion)
- Live context panel (shows related ideas, experiments, papers per section)
- AI Reviewer Simulator with mock reviews
- Novelty Checker
- Rebuttal Assistant
- Contribution Tracker
- Overleaf sync mock

### Lab Chat
- Slack-like channel interface
- Per-project channels + general, reading-group, resources, random
- AI bot messages with weekly digests, GPU status, experiment summaries
- Emoji reactions
- Meeting mode overlay
- Message input with @mention support

### AI-Powered Search
- Semantic search across papers, experiments, ideas, projects
- AI summary panel for complex queries
- Highlighted keyword matching
- Suggested queries and recent searches
- Multi-category filtering

### Publications & Impact
- Publications table with status badges
- Stats: Total publications, citations, H-Index, acceptance rate
- Charts: Publications by year, citations over time, venue distribution
- Citation tracker feed
- Venue intelligence cards

### Integrations (27+ tools)
- **Connected**: Slack, Notion, GitHub, W&B, Google Scholar, arXiv, Google Calendar, Google Drive, Hugging Face, Semantic Scholar
- **Available**: Overleaf, Zotero, Mendeley, Paperpile, MLflow, Neptune, Comet ML, AWS, GCP, Azure, Microsoft Teams, Jira, Confluence, Trello, IEEE Xplore, PubMed, Google Docs, Dropbox, GitLab, Outlook
- Toggle connection state
- Category filtering

### Team Management
- Team member cards with Research DNA tags
- Role distribution chart
- Invite member modal
- Project assignment view

### Settings
- General, Notifications, Security, Billing, Lab Config tabs
- Notification toggles
- Billing with current plan (₹9,999/month) and usage stats
- API key management
- Lab configuration templates

### Smart Onboarding
- 5-step guided onboarding for new lab members
- Project-specific paper reading lists
- Experiment history walkthrough
- AI agent introduction
- Knowledge quiz with scoring

## Mock Data

The app includes comprehensive mock data simulating a real research lab:

- **Lab**: Visual Intelligence & Learning Lab (VILL), IIT Delhi
- **10 Team Members**: PI, 5 PhD students, 2 Masters, 1 Undergrad, 1 Visiting Researcher
- **8 Projects**: MedViT, LinguaBridge, RoboSim2Real, NeRF-Edit, FedMed, CodeReason, GNN-Drug, EdgeViT
- **15 Papers**: Real papers (ViT, Attention Is All You Need, U-Net, BERT, NeRF, etc.) with annotations
- **10 Experiments**: With full results, metrics, and failure reasons
- **6 Ideas**: With hypotheses, methods, votes, and comments
- **6 Publications**: Various statuses (published, under-review, rejected)
- **30 Integrations**: Across 11 categories
- **9 Chat Channels**: With 12 messages including AI bot digests
- **10 Activity Items**: Recent lab activity feed

## Pricing (INR)

| Tier | Price | Best For |
|------|-------|----------|
| Spark | Free | Solo researchers |
| Lab Starter | ₹2,499/mo | Small labs (2–8) |
| Research Lab Pro | ₹9,999/mo | Active labs (8–25) |
| Research Institute | ₹39,999/mo | Multi-lab departments |
| Enterprise | ₹1,49,999+/mo | Corporate R&D |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx              # Login
│   ├── register/page.tsx           # Register
│   ├── dashboard/
│   │   ├── layout.tsx              # Dashboard shell (sidebar + header)
│   │   ├── page.tsx                # Overview
│   │   ├── projects/page.tsx       # Projects list
│   │   ├── projects/[id]/page.tsx  # Project detail
│   │   ├── ideas/page.tsx          # Idea Canvas
│   │   ├── papers/page.tsx         # Paper Library
│   │   ├── experiments/page.tsx    # Experiment Tracker
│   │   ├── writing/page.tsx        # Writing Workspace
│   │   ├── chat/page.tsx           # Lab Chat
│   │   ├── search/page.tsx         # AI Search
│   │   ├── publications/page.tsx   # Publications
│   │   ├── integrations/page.tsx   # Integrations
│   │   ├── team/page.tsx           # Team
│   │   ├── settings/page.tsx       # Settings
│   │   └── onboarding/page.tsx     # Onboarding
│   └── api/auth/                   # Auth API routes
├── lib/
│   ├── mock-data.ts                # All mock data
│   ├── auth.ts                     # JWT auth utilities
│   └── utils.ts                    # Helpers
├── types/index.ts                  # TypeScript types
└── contexts/AuthContext.tsx         # Auth state management
```

## License

Proprietary — ResearchOS
