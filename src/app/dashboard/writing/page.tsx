'use client'

import { useState, useMemo } from 'react'
import {
  PenTool,
  FileText,
  Users,
  Calendar,
  ChevronRight,
  X,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Quote,
  Code,
  AtSign,
  ArrowLeft,
  FlaskConical,
  BookOpen,
  Lightbulb,
  Sparkles,
  Shield,
  MessageSquareText,
  Trophy,
  Link2,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Star,
  BarChart3,
  ExternalLink,
} from 'lucide-react'
import {
  projects,
  experiments,
  papers,
  ideas,
  users,
  getUserById,
  getExperimentsByProject,
  getPapersByProject,
  getIdeasByProject,
} from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'

type SectionKey = 'abstract' | 'introduction' | 'related-work' | 'method' | 'experiments' | 'results' | 'discussion' | 'conclusion' | 'references'

interface DraftSection {
  key: SectionKey
  label: string
  wordCount: number
  complete: boolean
}

interface AIPopup {
  type: 'reviewer' | 'novelty' | 'rebuttal' | 'contribution' | null
}

const SECTIONS: DraftSection[] = [
  { key: 'abstract', label: 'Abstract', wordCount: 287, complete: true },
  { key: 'introduction', label: 'Introduction', wordCount: 1842, complete: true },
  { key: 'related-work', label: 'Related Work', wordCount: 2156, complete: true },
  { key: 'method', label: 'Method', wordCount: 3210, complete: true },
  { key: 'experiments', label: 'Experiments', wordCount: 1580, complete: false },
  { key: 'results', label: 'Results', wordCount: 890, complete: false },
  { key: 'discussion', label: 'Discussion', wordCount: 340, complete: false },
  { key: 'conclusion', label: 'Conclusion', wordCount: 0, complete: false },
  { key: 'references', label: 'References', wordCount: 0, complete: false },
]

const SECTION_CONTENT: Record<SectionKey, string> = {
  abstract: `We present MedViT, a Vision Transformer architecture specifically designed for multi-organ medical image segmentation with limited labeled data. Current approaches either rely on CNN-based architectures that lack global context or directly apply standard ViTs that are computationally expensive and ignore the fine-grained boundary information crucial for clinical applications.

MedViT introduces two key innovations: (1) an adaptive token merging mechanism that dynamically reduces computational cost by 42% while preserving boundary-critical tokens through an organ-aware auxiliary loss, and (2) a self-supervised pretraining strategy on unlabeled CT scans that learns anatomically meaningful representations.

Extensive experiments on CT-ORG (131 CT volumes, 6 organs) demonstrate that MedViT achieves a mean Dice score of 0.893 while reducing inference time by 33% compared to ViT-B/16. Notably, our adaptive merging scheme improves pancreas segmentation by 2.1% over fixed-threshold merging by preserving tokens near small organ boundaries. We further validate on BTCV and ACDC datasets, showing consistent improvements across diverse anatomical structures.`,

  introduction: `Medical image segmentation is a cornerstone task in clinical imaging pipelines, enabling quantitative analysis of organ morphology, surgical planning, and longitudinal disease monitoring. While deep learning has revolutionized this field, deploying segmentation models in clinical settings presents unique challenges: models must be accurate at fine-grained boundaries, efficient enough for real-time use, and trainable with limited labeled data — a persistent bottleneck in medical imaging due to the cost and expertise required for annotation.

Vision Transformers (ViTs) have emerged as powerful alternatives to convolutional neural networks for visual recognition tasks, demonstrating superior performance on large-scale benchmarks through their ability to capture long-range dependencies via self-attention. However, their direct application to medical image segmentation faces two critical limitations. First, the quadratic complexity of self-attention makes them prohibitively slow for the high-resolution images typical in clinical settings (512×512 or larger). Second, standard ViTs lack the inductive biases (locality, translation equivariance) that make CNNs effective for dense prediction tasks, particularly at organ boundaries where precise delineation is clinically important.

Recent works have attempted to address these limitations through hybrid architectures [Hatamizadeh et al., 2022], windowed attention [Cao et al., 2023], and token pruning strategies [Rao et al., 2021]. However, existing token reduction methods are designed for classification tasks and make globally uniform pruning decisions that can catastrophically degrade segmentation quality for small, variable organs like the pancreas.

In this paper, we propose MedViT, a Vision Transformer architecture that introduces adaptive token merging for medical image segmentation. Our key insight is that not all spatial regions require equal computational attention — large, homogeneous organ regions can be represented with fewer tokens, while boundary regions and small organs require full token resolution. We operationalize this through a learned per-layer merge threshold supervised by an organ-boundary-aware auxiliary loss.`,

  'related-work': `\\textbf{Vision Transformers for Medical Imaging.} Following the success of ViT [Dosovitskiy et al., 2021], several works have adapted transformers for medical image segmentation. TransUNet [Chen et al., 2021] combines CNN encoders with transformer layers, while Swin-UNet [Cao et al., 2023] applies shifted window attention to reduce complexity. UNETR [Hatamizadeh et al., 2022] uses a pure transformer encoder with CNN decoders. However, these methods do not address the fundamental efficiency bottleneck of self-attention on high-resolution medical images.

\\textbf{Token Reduction in Vision Transformers.} Token pruning and merging have been explored to improve ViT efficiency. DynamicViT [Rao et al., 2021] learns to prune uninformative tokens for classification. ToMe [Bolya et al., 2023] merges similar tokens using bipartite soft matching. EViT [Liang et al., 2022] reorganizes tokens by attentiveness. However, all existing methods target classification and make global pruning decisions that are unsuitable for dense prediction tasks where spatial completeness is essential.

\\textbf{Self-Supervised Learning for Medical Imaging.} Self-supervised pretraining has shown promise for overcoming labeled data scarcity in medical imaging. MAE [He et al., 2022] and its medical variants [Zhou et al., 2023] learn representations through masked image modeling. Contrastive methods like MoCo [Chen et al., 2020] have been adapted for 3D medical volumes. Our pretraining approach builds on MAE but incorporates anatomical priors through a novel organ-consistent masking strategy.`,

  method: `\\section{Method}

\\subsection{Overview}
MedViT consists of three main components: (1) a ViT-B/16 backbone with adaptive token merging modules inserted at configurable layers, (2) an organ-boundary-aware auxiliary loss that guides the merging decisions, and (3) a self-supervised pretraining stage using organ-consistent masked autoencoding on unlabeled CT scans.

\\subsection{Adaptive Token Merging}
Given an input image $x \\in \\mathbb{R}^{H \\times W \\times C}$, we first extract patch tokens $\\{t_i\\}_{i=1}^{N}$ where $N = HW/P^2$ and $P$ is the patch size. At each designated merging layer $l$, we compute a pairwise cosine similarity matrix $S^l \\in \\mathbb{R}^{N_l \\times N_l}$ between adjacent token pairs. Unlike ToMe which uses a fixed threshold, we learn a per-layer threshold $\\tau^l$ through a lightweight MLP:

$$\\tau^l = \\sigma(\\text{MLP}_l(\\bar{t}^l))$$

where $\\bar{t}^l$ is the mean token representation at layer $l$ and $\\sigma$ is the sigmoid function. Token pairs with similarity exceeding $\\tau^l$ are merged using a weighted average, where weights are proportional to the attention received from the [CLS] token.

\\subsection{Organ-Boundary-Aware Loss}
The key insight is that merging tokens near organ boundaries degrades segmentation quality. We define an auxiliary loss $\\mathcal{L}_{boundary}$ that penalizes merging decisions that eliminate tokens within a distance $d$ of ground-truth organ boundaries:

$$\\mathcal{L}_{boundary} = \\lambda \\sum_{l} \\sum_{(i,j) \\in M^l} \\mathbb{1}[\\min(d(i, B), d(j, B)) < d] \\cdot S^l_{ij}$$

where $M^l$ is the set of merged token pairs at layer $l$, $B$ is the set of boundary pixels, and $\\lambda$ is a weighting hyperparameter.

The total training objective combines segmentation loss, boundary-aware merging loss, and a token reduction regularizer:

$$\\mathcal{L} = \\mathcal{L}_{seg} + \\lambda_1 \\mathcal{L}_{boundary} + \\lambda_2 \\mathcal{L}_{reduction}$$`,

  experiments: `\\section{Experiments}

\\subsection{Datasets}
We evaluate MedViT on three medical image segmentation benchmarks:
\\begin{itemize}
    \\item \\textbf{CT-ORG} [Rister et al., 2020]: 131 CT volumes with annotations for 6 organs (liver, kidney, spleen, pancreas, gallbladder, stomach). We use the standard 80/20 train/test split.
    \\item \\textbf{BTCV} [Landman et al., 2015]: 30 abdominal CT scans with 13 organ annotations. We follow the standard protocol with 18 training and 12 testing volumes.
    \\item \\textbf{ACDC} [Bernard et al., 2018]: 100 cardiac MRI cine sequences with annotations for left ventricle, right ventricle, and myocardium.
\\end{itemize}

\\subsection{Implementation Details}
All experiments use ViT-B/16 as the backbone, pretrained on ImageNet-21k. We train with AdamW optimizer ($\\beta_1=0.9, \\beta_2=0.999$), cosine learning rate schedule with warmup, initial learning rate $10^{-4}$, batch size 8, and image size $512 \\times 512$. Token merging is applied at all 12 transformer layers. The boundary loss weight $\\lambda_1$ is set to 0.5 based on ablation studies (see Section 5.3).

Training is performed on 2× NVIDIA A100 80GB GPUs for 150 epochs (~18 hours).

\\subsection{Baselines}
We compare against: (1) ViT-B/16 without token merging, (2) ViT-B/16 with fixed-threshold merging (ToMe), (3) TransUNet, (4) Swin-UNet, (5) UNETR, and (6) nnU-Net (CNN baseline).

[TODO: Add comparison table with results from e1, e2, e6]
[TODO: Add ablation on boundary loss weight — need to run sweep experiments]`,

  results: `\\section{Results}

\\subsection{Main Results on CT-ORG}
Table 1 presents the main segmentation results on CT-ORG. MedViT achieves a mean Dice score of 0.893 while reducing inference time by 33\\% and achieving 42\\% token reduction compared to the vanilla ViT-B/16 baseline.

Key observations:
\\begin{itemize}
    \\item MedViT outperforms fixed-threshold merging (0.893 vs 0.883 mean Dice) while achieving comparable token reduction (42\\% vs 38.2\\%).
    \\item The improvement is most pronounced for small organs: pancreas Dice improves from 0.751 (fixed merging) to estimated ~0.79 (adaptive merging).
    \\item Inference time of ~156ms on A100 brings us closer to the clinical deployment target of <100ms.
\\end{itemize}

[TODO: Insert final results from e6 when training completes]
[TODO: Add per-organ Dice comparison table]
[TODO: BTCV and ACDC results pending]`,

  discussion: `\\section{Discussion}

Our results demonstrate that adaptive token merging offers a principled approach to balancing efficiency and accuracy in medical image segmentation. The organ-boundary-aware loss is the critical component — without it, aggressive merging catastrophically degrades performance on small organs like the pancreas.

[TODO: Expand discussion on limitations]
[TODO: Add failure case analysis]
[TODO: Compare with concurrent work on efficient medical ViTs]`,

  conclusion: `[TODO: Write conclusion after all experiments are complete]

Key contributions to summarize:
1. Adaptive token merging for dense prediction (segmentation)
2. Organ-boundary-aware auxiliary loss
3. Self-supervised pretraining with organ-consistent masking
4. SOTA efficiency-accuracy tradeoff on medical segmentation benchmarks`,

  references: `[TODO: Compile references from Zotero/paper library]

Key references to include:
- Dosovitskiy et al., 2021 (ViT)
- Ronneberger et al., 2015 (U-Net)
- Chen et al., 2021 (TransUNet)
- Bolya et al., 2023 (ToMe)
- Kirillov et al., 2023 (SAM)
- Hatamizadeh et al., 2022 (UNETR)`,
}

const AI_RESPONSES = {
  reviewer: {
    title: 'Simulated Peer Review',
    icon: Shield,
    content: [
      {
        label: 'Reviewer #1 (Strong Accept)',
        text: 'Well-written paper with a clear contribution. The adaptive token merging for dense prediction is novel. Minor: Table 2 needs confidence intervals.',
      },
      {
        label: 'Reviewer #2 (Weak Reject)',
        weaknesses: [
          'The paper lacks comparison with SAM-based approaches (Kirillov et al., 2023). Given SAM\'s strong zero-shot segmentation, the efficiency argument needs to be made relative to SAM with prompts.',
          'Ablation study on boundary loss weight is incomplete — only tested λ=0.5. Need a full sweep to justify this hyperparameter choice.',
          'The self-supervised pretraining contribution is underexplored. What is the marginal improvement from pretraining alone vs. adaptive merging alone?',
        ],
      },
      {
        label: 'Reviewer #3 (Borderline)',
        text: 'Solid experimental setup but limited to CT imaging. Would strengthen the paper to show generalization to other modalities (MRI, X-ray). The pancreas improvement is compelling but n=131 is relatively small.',
      },
    ],
  },
  novelty: {
    title: 'Novelty Analysis',
    icon: Sparkles,
    content: {
      overlapScore: 23,
      overlaps: [
        { paper: 'ToMe (Bolya et al., 2023)', overlap: 'Token merging mechanism based on cosine similarity', mitigation: 'Emphasize the adaptive threshold and boundary-aware loss — these are genuinely novel for dense prediction.' },
        { paper: 'DynamicViT (Rao et al., 2021)', overlap: 'Learned token reduction in ViTs', mitigation: 'Key difference: DynamicViT prunes (discards) tokens while we merge (preserve information). Critical distinction for segmentation.' },
      ],
      uniqueAspects: [
        'Organ-boundary-aware auxiliary loss for guiding merging decisions',
        'Adaptive per-layer thresholds (vs. fixed global thresholds)',
        'First application of token merging to dense medical prediction',
      ],
    },
  },
  rebuttal: {
    title: 'Rebuttal Assistant',
    icon: MessageSquareText,
    content: [
      {
        reviewer: 'Reviewer #2 — Concern about limited datasets',
        suggestion: 'Reference experiments e1 and e2 which cover CT-ORG (131 volumes). Additionally, mention that BTCV (30 volumes) and ACDC (100 MRI sequences) experiments are in progress (e6) and will be included in the camera-ready version. Emphasize that CT-ORG is the standard benchmark used by TransUNet, UNETR, and Swin-UNet for fair comparison.',
      },
      {
        reviewer: 'Reviewer #2 — Missing SAM comparison',
        suggestion: 'Acknowledge this as a valid point. Note that SAM requires per-instance prompts (point/box) while MedViT is fully automatic. A runtime comparison would actually favor MedViT for batch processing of clinical CT scans. Offer to add SAM-Med2D comparison in revision.',
      },
      {
        reviewer: 'Reviewer #3 — Small dataset concern',
        suggestion: 'Point out that n=131 is actually larger than BTCV (n=30) used by most competing methods. The CT-ORG dataset is specifically designed for multi-organ evaluation. Cross-validate with BTCV to address generalization.',
      },
    ],
  },
  contribution: {
    title: 'Contribution Tracker',
    icon: Trophy,
    content: [
      { claim: 'Adaptive token merging for dense prediction (segmentation)', status: 'backed', evidence: 'Experiments e1, e2, e6 show progressive improvement. e2 proves fixed thresholds are insufficient, motivating adaptive approach.', icon: '✅' },
      { claim: 'Organ-boundary-aware auxiliary loss', status: 'needs-work', evidence: 'e6 (in progress) shows promise with λ=0.5, but ablation on λ values is missing. Need to run boundary loss weight sweep.', icon: '⚠️' },
      { claim: 'Self-supervised pretraining with organ-consistent masking', status: 'not-validated', evidence: 'No dedicated experiment isolating the pretraining contribution. Need to run MedViT with and without pretraining to quantify.', icon: '❌' },
      { claim: 'SOTA efficiency-accuracy tradeoff', status: 'backed', evidence: 'e2 shows 33% inference reduction with competitive accuracy. e6 preliminary results show 42% token reduction with 0.893 mean Dice.', icon: '✅' },
    ],
  },
}

export default function WritingPage() {
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('abstract')
  const [aiPopup, setAiPopup] = useState<AIPopup>({ type: null })
  const [showOverleaf, setShowOverleaf] = useState(false)

  const activeDrafts = useMemo(() =>
    projects.filter(p => p.status === 'active' || p.status === 'under-review'),
    []
  )

  const selectedProject = projects.find(p => p.id === selectedDraft)
  const projectExperiments = selectedDraft ? getExperimentsByProject(selectedDraft) : []
  const projectPapers = selectedDraft ? getPapersByProject(selectedDraft) : []
  const projectIdeas = selectedDraft ? getIdeasByProject(selectedDraft) : []

  const totalWords = SECTIONS.reduce((sum, s) => sum + s.wordCount, 0)
  const completedSections = SECTIONS.filter(s => s.complete).length
  const progressPercent = Math.round((completedSections / SECTIONS.length) * 100)

  function getContextPanel(): { title: string; icon: typeof FlaskConical; items: { label: string; detail: string }[] } {
    switch (activeSection) {
      case 'introduction':
        return {
          title: 'Related Ideas & Highlights',
          icon: Lightbulb,
          items: projectIdeas.map(idea => ({
            label: idea.title,
            detail: idea.hypothesis.slice(0, 120) + '...',
          })),
        }
      case 'experiments':
      case 'results':
        return {
          title: 'Experiment Logs',
          icon: FlaskConical,
          items: projectExperiments.map(exp => ({
            label: `${exp.title} (${exp.status})`,
            detail: exp.results?.conclusion?.slice(0, 120) || exp.notes?.slice(0, 120) || 'No results yet',
          })),
        }
      case 'related-work':
        return {
          title: 'Papers in Library',
          icon: BookOpen,
          items: projectPapers.map(paper => ({
            label: paper.title.slice(0, 60) + (paper.title.length > 60 ? '...' : ''),
            detail: `${paper.venue} ${paper.year} — ${paper.citations.toLocaleString()} citations`,
          })),
        }
      default:
        return {
          title: 'Project Context',
          icon: BookOpen,
          items: [
            { label: selectedProject?.title || '', detail: selectedProject?.description?.slice(0, 120) || '' },
            ...projectPapers.slice(0, 3).map(p => ({ label: p.title.slice(0, 50) + '...', detail: `${p.venue} ${p.year}` })),
          ],
        }
    }
  }

  function getDraftStatus(project: typeof projects[0]): { label: string; color: string } {
    if (project.status === 'under-review') return { label: 'Submitted', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' }
    const milestones = project.milestones || []
    const draftMilestones = milestones.filter(m => m.title.toLowerCase().includes('draft') || m.title.toLowerCase().includes('paper'))
    const completedDrafts = draftMilestones.filter(m => m.completed).length
    if (completedDrafts >= 2) return { label: 'Draft v2', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    if (completedDrafts >= 1) return { label: 'Draft v1', color: 'bg-brand-500/10 text-brand-400 border-brand-500/20' }
    return { label: 'Early Draft', color: 'bg-surface-500/10 text-surface-400 border-surface-500/20' }
  }

  function getDraftProgress(project: typeof projects[0]): number {
    const milestones = project.milestones || []
    if (milestones.length === 0) return 0
    return Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100)
  }

  // Editor view
  if (selectedDraft && selectedProject) {
    const context = getContextPanel()
    const ContextIcon = context.icon

    return (
      <div className="mx-auto max-w-7xl">
        {/* Editor header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedDraft(null)}
              className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-surface-100">{selectedProject.title}</h1>
              <p className="text-xs text-surface-400">Target: {selectedProject.targetVenue}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500">{totalWords.toLocaleString()} words</span>
            <span className="text-xs text-surface-500">·</span>
            <span className="text-xs text-surface-500">{completedSections}/{SECTIONS.length} sections</span>
            <div className="ml-2 h-2 w-24 overflow-hidden rounded-full bg-surface-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-700/50 bg-surface-900/80 px-4 py-2">
          <div className="flex items-center gap-1">
            {[
              { icon: Bold, label: 'Bold' },
              { icon: Italic, label: 'Italic' },
              { icon: Heading1, label: 'H1' },
              { icon: Heading2, label: 'H2' },
              { icon: Quote, label: 'Quote' },
              { icon: Code, label: 'Code' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100"
                title={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
            <div className="mx-2 h-5 w-px bg-surface-700" />
            <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/10">
              <AtSign className="h-3.5 w-3.5" />
              @cite
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiPopup({ type: 'reviewer' })}
              className="btn-ghost flex items-center gap-1.5 text-xs"
            >
              <Shield className="h-3.5 w-3.5 text-yellow-400" />
              Reviewer Simulator
            </button>
            <button
              onClick={() => setAiPopup({ type: 'novelty' })}
              className="btn-ghost flex items-center gap-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              Novelty Checker
            </button>
            <button
              onClick={() => setAiPopup({ type: 'rebuttal' })}
              className="btn-ghost flex items-center gap-1.5 text-xs"
            >
              <MessageSquareText className="h-3.5 w-3.5 text-blue-400" />
              Rebuttal Assistant
            </button>
            <button
              onClick={() => setAiPopup({ type: 'contribution' })}
              className="btn-ghost flex items-center gap-1.5 text-xs"
            >
              <Trophy className="h-3.5 w-3.5 text-emerald-400" />
              Contribution Tracker
            </button>
            <div className="mx-1 h-5 w-px bg-surface-700" />
            <button
              onClick={() => setShowOverleaf(true)}
              className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-1.5 text-xs font-medium text-surface-200 hover:border-emerald-500/30 hover:text-emerald-300"
            >
              <Link2 className="h-3.5 w-3.5" />
              Overleaf Sync
            </button>
          </div>
        </div>

        {/* Three-panel editor */}
        <div className="grid grid-cols-[200px_1fr_280px] gap-4">
          {/* Left: Section nav */}
          <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-3">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-surface-500">Sections</p>
            <div className="space-y-0.5">
              {SECTIONS.map(section => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeSection === section.key
                      ? 'bg-brand-500/10 text-brand-400'
                      : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                  }`}
                >
                  {section.complete ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-surface-600" />
                  )}
                  <span className="flex-1 truncate">{section.label}</span>
                  {section.wordCount > 0 && (
                    <span className="text-[10px] text-surface-600">{section.wordCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Center: Editor */}
          <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-6">
            <h2 className="mb-4 text-lg font-semibold text-surface-100">
              {SECTIONS.find(s => s.key === activeSection)?.label}
            </h2>
            <textarea
              value={SECTION_CONTENT[activeSection]}
              onChange={() => {}}
              className="min-h-[500px] w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-surface-300 placeholder:text-surface-600 focus:outline-none"
              placeholder="Start writing..."
            />
            <div className="mt-4 flex items-center justify-between border-t border-surface-700/50 pt-3 text-xs text-surface-500">
              <span>
                {SECTIONS.find(s => s.key === activeSection)?.wordCount || 0} words
              </span>
              <span>
                Section {SECTIONS.findIndex(s => s.key === activeSection) + 1} of {SECTIONS.length}
              </span>
            </div>
          </div>

          {/* Right: Context panel */}
          <div className="rounded-xl border border-surface-700/50 bg-surface-900/80 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ContextIcon className="h-4 w-4 text-brand-400" />
              <p className="text-xs font-semibold text-surface-200">{context.title}</p>
            </div>
            <div className="space-y-2.5">
              {context.items.length === 0 ? (
                <p className="py-6 text-center text-xs text-surface-500">No context items for this section</p>
              ) : (
                context.items.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-surface-700/40 bg-surface-800/40 p-3 transition-colors hover:border-brand-500/20"
                  >
                    <p className="text-xs font-medium text-surface-200">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-surface-500">{item.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI Popup modals */}
        {aiPopup.type && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setAiPopup({ type: null })}
            />
            <div className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl">
              {/* Reviewer Simulator */}
              {aiPopup.type === 'reviewer' && (
                <>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-700 bg-surface-900/95 px-6 py-4 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-yellow-400" />
                      <h2 className="text-lg font-bold text-surface-100">{AI_RESPONSES.reviewer.title}</h2>
                    </div>
                    <button onClick={() => setAiPopup({ type: null })} className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-4 p-6">
                    {AI_RESPONSES.reviewer.content.map((review, i) => (
                      <div key={i} className="rounded-lg border border-surface-700/50 bg-surface-800/30 p-4">
                        <h3 className="mb-2 text-sm font-semibold text-surface-200">{review.label}</h3>
                        {review.text && (
                          <p className="text-sm leading-relaxed text-surface-400">{review.text}</p>
                        )}
                        {review.weaknesses && (
                          <div className="space-y-2">
                            {review.weaknesses.map((w, j) => (
                              <div key={j} className="flex gap-2 rounded-lg border border-red-500/15 bg-red-500/5 p-3">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                                <p className="text-sm text-red-200/80">
                                  <span className="font-semibold">Weakness {j + 1}:</span> {w}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <p className="text-center text-[11px] text-surface-600">
                      Simulated review based on paper content analysis. Not a substitute for actual peer review.
                    </p>
                  </div>
                </>
              )}

              {/* Novelty Checker */}
              {aiPopup.type === 'novelty' && (
                <>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-700 bg-surface-900/95 px-6 py-4 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-400" />
                      <h2 className="text-lg font-bold text-surface-100">{AI_RESPONSES.novelty.title}</h2>
                    </div>
                    <button onClick={() => setAiPopup({ type: null })} className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-5 p-6">
                    <div className="flex items-center gap-4 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-purple-400">{AI_RESPONSES.novelty.content.overlapScore}%</p>
                        <p className="text-[10px] uppercase tracking-wider text-purple-400/60">Overlap</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-surface-300">
                          Your method overlaps {AI_RESPONSES.novelty.content.overlapScore}% with existing work.
                          Consider emphasizing the <span className="font-semibold text-surface-100">adaptive threshold</span> and <span className="font-semibold text-surface-100">organ-boundary-aware loss</span> aspects.
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-surface-200">Overlapping Areas</h3>
                      {AI_RESPONSES.novelty.content.overlaps.map((o, i) => (
                        <div key={i} className="mb-2 rounded-lg border border-surface-700/50 bg-surface-800/30 p-3">
                          <p className="text-xs font-semibold text-surface-300">{o.paper}</p>
                          <p className="mt-1 text-xs text-red-300/80">Overlap: {o.overlap}</p>
                          <p className="mt-1 text-xs text-emerald-300/80">Mitigation: {o.mitigation}</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-surface-200">Unique Aspects</h3>
                      <div className="space-y-1.5">
                        {AI_RESPONSES.novelty.content.uniqueAspects.map((aspect, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-emerald-500/5 px-3 py-2">
                            <Star className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-sm text-emerald-200/80">{aspect}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Rebuttal Assistant */}
              {aiPopup.type === 'rebuttal' && (
                <>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-700 bg-surface-900/95 px-6 py-4 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-blue-400" />
                      <h2 className="text-lg font-bold text-surface-100">{AI_RESPONSES.rebuttal.title}</h2>
                    </div>
                    <button onClick={() => setAiPopup({ type: null })} className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-4 p-6">
                    {AI_RESPONSES.rebuttal.content.map((item, i) => (
                      <div key={i} className="rounded-lg border border-surface-700/50 bg-surface-800/30 p-4">
                        <h3 className="mb-2 text-sm font-semibold text-blue-300">{item.reviewer}</h3>
                        <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 p-3">
                          <p className="text-sm leading-relaxed text-surface-300">{item.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Contribution Tracker */}
              {aiPopup.type === 'contribution' && (
                <>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-700 bg-surface-900/95 px-6 py-4 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-emerald-400" />
                      <h2 className="text-lg font-bold text-surface-100">{AI_RESPONSES.contribution.title}</h2>
                    </div>
                    <button onClick={() => setAiPopup({ type: null })} className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-3 p-6">
                    {AI_RESPONSES.contribution.content.map((item, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-4 ${
                          item.status === 'backed'
                            ? 'border-emerald-500/20 bg-emerald-500/5'
                            : item.status === 'needs-work'
                            ? 'border-yellow-500/20 bg-yellow-500/5'
                            : 'border-red-500/20 bg-red-500/5'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-lg">{item.icon}</span>
                          <div>
                            <h3 className="text-sm font-semibold text-surface-200">{item.claim}</h3>
                            <p className="mt-1 text-xs leading-relaxed text-surface-400">{item.evidence}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Overleaf popup */}
        {showOverleaf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowOverleaf(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl border border-surface-700 bg-surface-900 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Link2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-100">Overleaf Sync</h3>
                  <p className="text-xs text-surface-400">Connected</p>
                </div>
                <button onClick={() => setShowOverleaf(false)} className="ml-auto rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-sm text-surface-200">
                  Connected to Overleaf project: <span className="font-semibold text-emerald-300">MedViT_CVPR2026</span>
                </p>
                <p className="mt-1 text-xs text-surface-400">Last synced: 2 hours ago</p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync Now
                  </button>
                  <button className="btn-ghost flex items-center gap-1.5 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Overleaf
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Main drafts view
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
            <PenTool className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-100">Paper Writing Workspace</h1>
            <p className="text-sm text-surface-400">Draft, review, and collaborate on research papers</p>
          </div>
        </div>
      </div>

      {/* Active Drafts */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-500">Active Drafts</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeDrafts.map(project => {
            const draftStatus = getDraftStatus(project)
            const progress = getDraftProgress(project)
            const team = project.teamMemberIds.slice(0, 4)
            const lastMilestone = [...project.milestones].reverse().find(m => m.completed)

            return (
              <button
                key={project.id}
                onClick={() => setSelectedDraft(project.id)}
                className="group bg-surface-900/80 border border-surface-700/50 rounded-xl p-5 card-hover text-left"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="font-bold text-surface-100 group-hover:text-brand-300 transition-colors">
                    {project.title}
                  </h3>
                  <ChevronRight className="h-4 w-4 shrink-0 text-surface-600 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400" />
                </div>

                <p className="mb-3 text-xs text-surface-400">
                  Target: <span className="font-medium text-surface-300">{project.targetVenue}</span>
                </p>

                <div className="mb-3 flex items-center gap-2">
                  <span className={`badge text-[11px] ${draftStatus.color}`}>{draftStatus.label}</span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-surface-500">
                    <span>Milestones</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-800">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Last edited */}
                {lastMilestone && (
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] text-surface-500">
                    <Calendar className="h-3 w-3" />
                    Last milestone: {formatDate(lastMilestone.date)}
                  </p>
                )}

                {/* Collaborators */}
                <div className="flex items-center gap-1">
                  {team.map((memberId, i) => {
                    const member = projects[0] ? (() => {
                      const u = users.find(u => u.id === memberId)
                      return u
                    })() : null
                    if (!member) return null
                    return (
                      <div
                        key={memberId}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-semibold text-brand-300 ring-2 ring-surface-900"
                        style={{ marginLeft: i > 0 ? '-4px' : '0' }}
                        title={member.name}
                      >
                        {member.avatar}
                      </div>
                    )
                  })}
                  {project.teamMemberIds.length > 4 && (
                    <span className="ml-1 text-[11px] text-surface-500">
                      +{project.teamMemberIds.length - 4}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick access: AI Features overview */}
      <div className="rounded-xl border border-surface-700/50 bg-surface-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-surface-500">AI Writing Tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Shield, color: 'text-yellow-400', bg: 'bg-yellow-500/10', title: 'Reviewer Simulator', desc: 'Get simulated peer reviews before submission' },
            { icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-500/10', title: 'Novelty Checker', desc: 'Check overlap with existing work' },
            { icon: MessageSquareText, color: 'text-blue-400', bg: 'bg-blue-500/10', title: 'Rebuttal Assistant', desc: 'Draft responses to reviewer concerns' },
            { icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: 'Contribution Tracker', desc: 'Track claims against evidence' },
          ].map(tool => (
            <div key={tool.title} className="rounded-lg border border-surface-700/40 bg-surface-800/30 p-4">
              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tool.bg}`}>
                <tool.icon className={`h-4 w-4 ${tool.color}`} />
              </div>
              <h3 className="text-sm font-semibold text-surface-200">{tool.title}</h3>
              <p className="mt-1 text-xs text-surface-500">{tool.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-surface-600">Select a draft above to access these tools in the editor</p>
      </div>
    </div>
  )
}
