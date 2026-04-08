const MOCK_RESPONSES: Record<string, string[]> = {
  summarize: [
    'This paper presents a novel approach to {topic} by combining {method1} with {method2}. The key contribution is a {contribution} that achieves state-of-the-art results on {benchmark}. The authors demonstrate {improvement} improvement over previous baselines.',
    'The core insight of this work is that {insight}. The proposed method uses a {architecture} architecture trained on {dataset}. Results show significant improvements in {metric}, with potential applications in {application}.',
  ],
  ideate: [
    '**Research Direction: {title}**\n\nBuilding on the current work, consider exploring:\n\n1. **Cross-domain transfer**: Apply the {method} to {new_domain} where similar structural patterns exist\n2. **Efficiency optimization**: The current approach could benefit from {optimization} to reduce computational overhead by ~{percent}%\n3. **Hybrid approach**: Combining {method1} with {method2} could yield synergistic benefits\n\n*Risk: Medium* — Requires validation on {benchmark} datasets.',
    '**Novel Hypothesis**: What if we applied {technique} from {field1} to solve the {problem} in {field2}?\n\n**Motivation**: Both domains share the fundamental challenge of {challenge}. The structural similarity between {concept1} and {concept2} suggests transferability.\n\n**Expected outcome**: ~{percent}% improvement on {metric} with reduced need for {resource}.',
  ],
  review: [
    '**Reviewer Feedback (Simulated)**\n\n**Strengths:**\n- Clear problem formulation and motivation\n- Solid experimental methodology with appropriate baselines\n- Results are statistically significant\n\n**Weaknesses:**\n- Limited analysis of failure cases — what types of inputs cause degradation?\n- Missing comparison with {missing_baseline} which is the current SOTA\n- The ablation study could be more comprehensive\n\n**Questions:**\n1. How does the method scale with increasing {dimension}?\n2. What is the computational overhead compared to vanilla approaches?\n\n**Score: 6/10** (Borderline accept)',
  ],
  explain: [
    'Great question! Here\'s how this works:\n\n{concept} is a technique used in {field} to address {problem}. Think of it like {analogy}.\n\nThe key steps are:\n1. First, {step1}\n2. Then, {step2}\n3. Finally, {step3}\n\nThis matters because {importance}. In our lab\'s context, we use this in {project} for {use_case}.',
  ],
  general: [
    'Based on the lab\'s current research directions, I\'d suggest focusing on {suggestion}. This aligns well with the ongoing work on {project} and could create synergies with {related_project}.\n\nHere are some concrete next steps:\n1. {step1}\n2. {step2}\n3. {step3}\n\nWould you like me to elaborate on any of these?',
    'That\'s an interesting question. Looking at the recent literature and our lab\'s expertise, here\'s my analysis:\n\n**Current State**: {current_state}\n**Key Challenge**: {challenge}\n**Proposed Approach**: {approach}\n\nI can help draft a more detailed plan if you\'d like.',
  ],
}

function fillTemplate(template: string): string {
  const fills: Record<string, string[]> = {
    topic: ['medical image segmentation', 'cross-lingual transfer', 'neural radiance fields', 'graph neural networks', 'code generation'],
    method1: ['self-supervised learning', 'attention mechanisms', 'contrastive learning', 'knowledge distillation'],
    method2: ['domain adaptation', 'curriculum learning', 'meta-learning', 'adversarial training'],
    contribution: ['novel architecture', 'training framework', 'benchmark dataset', 'theoretical analysis'],
    benchmark: ['COCO', 'ImageNet', 'GLUE', 'SQuAD', 'ZINC', 'WikiANN'],
    improvement: ['15-20%', '8-12%', '3-5%', '25-30%'],
    insight: ['structural priors can dramatically improve sample efficiency', 'multi-scale features are essential for dense prediction', 'language-agnostic representations emerge naturally with scale'],
    architecture: ['transformer-based', 'graph neural', 'encoder-decoder', 'mixture-of-experts'],
    dataset: ['large-scale unlabeled data', 'curated multi-domain benchmarks', 'synthetic + real data'],
    metric: ['accuracy', 'F1 score', 'inference latency', 'parameter efficiency'],
    application: ['clinical diagnosis', 'low-resource NLP', 'robotic manipulation', 'drug discovery'],
    title: ['Adaptive Multi-Scale Attention', 'Cross-Modal Knowledge Transfer', 'Efficient Neural Architecture Search'],
    method: ['proposed technique', 'attention mechanism', 'transfer learning framework'],
    new_domain: ['satellite imagery', 'audio processing', 'molecular dynamics'],
    optimization: ['token pruning', 'mixed-precision training', 'sparse attention'],
    percent: ['30', '45', '20', '60'],
    technique: ['attention mechanisms', 'self-supervised pretraining', 'physics-informed losses'],
    field1: ['computer vision', 'NLP', 'reinforcement learning'],
    field2: ['drug discovery', 'materials science', 'climate modeling'],
    problem: ['data scarcity', 'distribution shift', 'computational cost'],
    challenge: ['learning from limited labeled data', 'generalizing across domains', 'scaling to real-world conditions'],
    concept1: ['image patches', 'molecular graphs', 'text tokens'],
    concept2: ['protein structures', 'sensor readings', 'code ASTs'],
    resource: ['labeled data', 'compute time', 'expert annotations'],
    missing_baseline: ['the concurrent work by Smith et al. 2025', 'a properly tuned transformer baseline'],
    dimension: ['input resolution', 'sequence length', 'vocabulary size', 'batch size'],
    concept: ['Self-attention', 'Batch normalization', 'Residual connections', 'Dropout'],
    field: ['deep learning', 'machine learning', 'computer vision'],
    analogy: ['a spotlight that focuses on the most relevant parts', 'a highway that lets gradients flow freely'],
    step1: ['compute pairwise similarities between elements', 'normalize the input features'],
    step2: ['apply the learned transformation', 'aggregate information from neighbors'],
    step3: ['produce the final output through a feedforward network', 'apply the residual connection'],
    importance: ['it enables training much deeper networks', 'it dramatically improves generalization'],
    project: ['MedViT', 'LinguaBridge', 'NeRF-Edit', 'CodeReason'],
    use_case: ['improving segmentation accuracy', 'cross-lingual transfer', 'scene editing'],
    suggestion: ['investigating the intersection of efficiency and accuracy', 'exploring multi-modal approaches'],
    related_project: ['the GNN-Drug project', 'the FedMed initiative', 'the EdgeViT work'],
    current_state: ['The field has seen rapid progress but key challenges remain', 'Recent work shows promising directions'],
    approach: ['A systematic study combining theoretical insights with empirical validation', 'An iterative approach with regular checkpoints'],
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const options = fills[key]
    if (!options) return key
    return options[Math.floor(Math.random() * options.length)]
  })
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMConfig {
  apiKey?: string
  model?: string
  provider?: 'openai' | 'anthropic' | 'mock'
}

function getConfig(): LLMConfig {
  if (typeof window === 'undefined') return { provider: 'mock' }
  const stored = localStorage.getItem('researchos-llm-config')
  if (stored) {
    try { return JSON.parse(stored) } catch { /* fall through */ }
  }
  return { provider: 'mock' }
}

export function saveLLMConfig(config: LLMConfig) {
  localStorage.setItem('researchos-llm-config', JSON.stringify(config))
}

export function getLLMConfig(): LLMConfig {
  return getConfig()
}

function classifyIntent(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('tldr')) return 'summarize'
  if (lower.includes('idea') || lower.includes('brainstorm') || lower.includes('suggest') || lower.includes('direction')) return 'ideate'
  if (lower.includes('review') || lower.includes('feedback') || lower.includes('critique') || lower.includes('weakness')) return 'review'
  if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does') || lower.includes('why')) return 'explain'
  return 'general'
}

async function callMockLLM(messages: LLMMessage[]): Promise<string> {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))
  const lastUser = messages.filter(m => m.role === 'user').pop()
  if (!lastUser) return 'How can I help with your research today?'
  const intent = classifyIntent(lastUser.content)
  const templates = MOCK_RESPONSES[intent] || MOCK_RESPONSES.general
  const template = templates[Math.floor(Math.random() * templates.length)]
  return fillTemplate(template)
}

async function callOpenAI(messages: LLMMessage[], config: LLMConfig): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'No response generated.'
}

async function callAnthropic(messages: LLMMessage[], config: LLMConfig): Promise<string> {
  const system = messages.find(m => m.role === 'system')?.content || ''
  const chatMessages = messages.filter(m => m.role !== 'system')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model || 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text || 'No response generated.'
}

const SYSTEM_PROMPT = `You are ResearchOS AI Assistant — an intelligent research companion for the Visual Intelligence & Learning Lab (VILL) at IIT Delhi. You help researchers with:

- Summarizing and analyzing papers
- Brainstorming research ideas and hypotheses
- Reviewing drafts and providing constructive feedback
- Explaining complex concepts
- Suggesting connections between projects
- Helping with experiment design and analysis
- Writing assistance (abstracts, introductions, related work)

Be concise, technically accurate, and helpful. Use markdown formatting. When discussing the lab's research, reference specific projects and people when relevant.`

export async function chatWithLLM(
  messages: LLMMessage[],
  configOverride?: LLMConfig
): Promise<string> {
  const config = configOverride || getConfig()
  const fullMessages: LLMMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ]

  try {
    switch (config.provider) {
      case 'openai':
        if (!config.apiKey) throw new Error('No API key')
        return await callOpenAI(fullMessages, config)
      case 'anthropic':
        if (!config.apiKey) throw new Error('No API key')
        return await callAnthropic(fullMessages, config)
      default:
        return await callMockLLM(fullMessages)
    }
  } catch {
    return await callMockLLM(fullMessages)
  }
}
