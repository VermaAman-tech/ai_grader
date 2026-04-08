import { User, Lab, Project, Paper, Idea, Experiment, ChatChannel, ChatMessage, Publication, Integration, ActivityItem, PricingTier } from '@/types'

export const users: User[] = [
  { id: 'u1', name: 'Dr. Priya Sharma', email: 'priya@iitd.ac.in', role: 'pi', avatar: 'PS', department: 'Computer Science', joinedAt: '2020-01-15', researchDNA: ['Deep Learning', 'Computer Vision', 'Medical Imaging', 'Transformers'], labId: 'lab1' },
  { id: 'u2', name: 'Arjun Mehta', email: 'arjun@iitd.ac.in', role: 'phd', avatar: 'AM', department: 'Computer Science', joinedAt: '2021-08-01', researchDNA: ['GANs', 'Image Synthesis', 'Diffusion Models'], labId: 'lab1' },
  { id: 'u3', name: 'Sneha Iyer', email: 'sneha@iitd.ac.in', role: 'phd', avatar: 'SI', department: 'Computer Science', joinedAt: '2022-01-10', researchDNA: ['NLP', 'Multilingual Models', 'Low-Resource Languages'], labId: 'lab1' },
  { id: 'u4', name: 'Rahul Verma', email: 'rahul@iitd.ac.in', role: 'phd', avatar: 'RV', department: 'Computer Science', joinedAt: '2022-07-01', researchDNA: ['Reinforcement Learning', 'Robotics', 'Sim2Real'], labId: 'lab1' },
  { id: 'u5', name: 'Kavya Nair', email: 'kavya@iitd.ac.in', role: 'masters', avatar: 'KN', department: 'Computer Science', joinedAt: '2023-08-01', researchDNA: ['Graph Neural Networks', 'Drug Discovery'], labId: 'lab1' },
  { id: 'u6', name: 'Vikram Singh', email: 'vikram@iitd.ac.in', role: 'masters', avatar: 'VS', department: 'Electrical Engineering', joinedAt: '2023-08-01', researchDNA: ['Signal Processing', 'Edge AI'], labId: 'lab1' },
  { id: 'u7', name: 'Ananya Gupta', email: 'ananya@iitd.ac.in', role: 'undergrad', avatar: 'AG', department: 'Computer Science', joinedAt: '2024-01-15', researchDNA: ['Web Development', 'ML Basics'], labId: 'lab1' },
  { id: 'u8', name: 'Dr. Ravi Kumar', email: 'ravi@iitd.ac.in', role: 'visiting', avatar: 'RK', department: 'AI Research', joinedAt: '2024-03-01', researchDNA: ['Federated Learning', 'Privacy'], labId: 'lab1' },
  { id: 'u9', name: 'Meera Patel', email: 'meera@iitd.ac.in', role: 'phd', avatar: 'MP', department: 'Computer Science', joinedAt: '2021-01-10', researchDNA: ['3D Vision', 'NeRF', 'Scene Understanding'], labId: 'lab1' },
  { id: 'u10', name: 'Aditya Rao', email: 'aditya@iitd.ac.in', role: 'phd', avatar: 'AR', department: 'Computer Science', joinedAt: '2023-01-15', researchDNA: ['LLMs', 'Code Generation', 'Reasoning'], labId: 'lab1' },
]

export const labs: Lab[] = [
  { id: 'lab1', name: 'Visual Intelligence & Learning Lab (VILL)', institution: 'IIT Delhi', piId: 'u1', memberIds: ['u1','u2','u3','u4','u5','u6','u7','u8','u9','u10'], createdAt: '2020-01-15' },
]

export const projects: Project[] = [
  {
    id: 'p1', title: 'MedViT: Vision Transformers for Medical Image Segmentation', description: 'Developing a novel Vision Transformer architecture specifically designed for multi-organ medical image segmentation with limited labeled data. Combines self-supervised pretraining on unlabeled CT scans with a novel attention mechanism for fine-grained boundary delineation.', domain: ['Medical Imaging', 'Computer Vision', 'Transformers'], targetVenue: 'CVPR 2026', piId: 'u1', teamMemberIds: ['u1', 'u2', 'u5'], status: 'active', healthScore: 87, createdAt: '2024-06-15', deadline: '2025-11-15',
    milestones: [
      { id: 'm1', title: 'Literature Review Complete', date: '2024-08-01', completed: true },
      { id: 'm2', title: 'Baseline Implementation', date: '2024-10-15', completed: true },
      { id: 'm3', title: 'Novel Architecture Design', date: '2025-01-30', completed: true },
      { id: 'm4', title: 'Ablation Studies', date: '2025-04-15', completed: false },
      { id: 'm5', title: 'Paper Draft v1', date: '2025-07-01', completed: false },
      { id: 'm6', title: 'Submission to CVPR', date: '2025-11-15', completed: false },
    ], labId: 'lab1',
  },
  {
    id: 'p2', title: 'LinguaBridge: Cross-Lingual Transfer for Indian Languages', description: 'Building a cross-lingual transfer learning framework specifically designed for low-resource Indian languages. Uses a novel adapter architecture with script-aware tokenization to achieve SOTA on multiple Indic NLP benchmarks.', domain: ['NLP', 'Multilingual', 'Low-Resource'], targetVenue: 'ACL 2026', piId: 'u1', teamMemberIds: ['u1', 'u3', 'u10'], status: 'active', healthScore: 72, createdAt: '2024-03-10', deadline: '2025-09-15',
    milestones: [
      { id: 'm7', title: 'Dataset Curation', date: '2024-06-01', completed: true },
      { id: 'm8', title: 'Tokenizer Training', date: '2024-09-15', completed: true },
      { id: 'm9', title: 'Adapter Architecture', date: '2025-01-15', completed: true },
      { id: 'm10', title: 'Benchmark Evaluation', date: '2025-05-01', completed: false },
      { id: 'm11', title: 'Paper Writing', date: '2025-07-15', completed: false },
    ], labId: 'lab1',
  },
  {
    id: 'p3', title: 'RoboSim2Real: Sim-to-Real Transfer for Manipulation', description: 'Developing domain randomization and adaptation techniques to transfer robotic manipulation policies trained in simulation to real-world robots. Focus on deformable object manipulation using a novel physics-informed RL approach.', domain: ['Robotics', 'Reinforcement Learning', 'Sim2Real'], targetVenue: 'ICRA 2026', piId: 'u1', teamMemberIds: ['u1', 'u4', 'u6'], status: 'active', healthScore: 65, createdAt: '2024-09-01', deadline: '2025-09-15',
    milestones: [
      { id: 'm12', title: 'Simulation Environment Setup', date: '2024-11-01', completed: true },
      { id: 'm13', title: 'Baseline RL Policy', date: '2025-02-01', completed: true },
      { id: 'm14', title: 'Domain Randomization Module', date: '2025-04-01', completed: false },
      { id: 'm15', title: 'Real Robot Experiments', date: '2025-06-15', completed: false },
    ], labId: 'lab1',
  },
  {
    id: 'p4', title: 'NeRF-Edit: Interactive Neural Radiance Field Editing', description: 'Enabling real-time editing of neural radiance fields with semantic understanding. Users can select, move, recolor, and deform objects in NeRF scenes through an intuitive interface powered by language-guided 3D understanding.', domain: ['3D Vision', 'NeRF', 'Neural Rendering'], targetVenue: 'NeurIPS 2025', piId: 'u1', teamMemberIds: ['u1', 'u9', 'u7'], status: 'under-review', healthScore: 92, createdAt: '2024-01-20', deadline: '2025-05-22',
    milestones: [
      { id: 'm16', title: 'NeRF Baseline', date: '2024-04-01', completed: true },
      { id: 'm17', title: 'Semantic Decomposition', date: '2024-07-15', completed: true },
      { id: 'm18', title: 'Editing Interface', date: '2024-10-01', completed: true },
      { id: 'm19', title: 'User Study', date: '2025-02-01', completed: true },
      { id: 'm20', title: 'Paper Submitted', date: '2025-05-22', completed: true },
    ], labId: 'lab1',
  },
  {
    id: 'p5', title: 'FedMed: Federated Learning for Hospital Networks', description: 'Privacy-preserving federated learning framework for training medical AI models across multiple hospitals without sharing patient data. Novel contribution-aware aggregation and differential privacy guarantees.', domain: ['Federated Learning', 'Privacy', 'Medical AI'], targetVenue: 'ICLR 2026', piId: 'u1', teamMemberIds: ['u1', 'u8', 'u5'], status: 'ideation', healthScore: 45, createdAt: '2025-02-01',
    milestones: [
      { id: 'm21', title: 'Problem Formulation', date: '2025-03-15', completed: true },
      { id: 'm22', title: 'Literature Survey', date: '2025-05-01', completed: false },
    ], labId: 'lab1',
  },
  {
    id: 'p6', title: 'CodeReason: LLM-Based Program Synthesis with Verification', description: 'Teaching LLMs to write verified code by combining code generation with formal verification feedback loops. A new benchmark for measuring functional correctness beyond simple test passing.', domain: ['LLMs', 'Code Generation', 'Formal Verification'], targetVenue: 'ICML 2026', piId: 'u1', teamMemberIds: ['u1', 'u10', 'u3'], status: 'active', healthScore: 78, createdAt: '2024-08-15', deadline: '2026-01-31',
    milestones: [
      { id: 'm23', title: 'Benchmark Design', date: '2024-11-01', completed: true },
      { id: 'm24', title: 'Baseline Evaluation', date: '2025-02-01', completed: true },
      { id: 'm25', title: 'Verification Loop Implementation', date: '2025-05-15', completed: false },
      { id: 'm26', title: 'Full Evaluation', date: '2025-09-01', completed: false },
    ], labId: 'lab1',
  },
  {
    id: 'p7', title: 'GNN-Drug: Graph Networks for Molecular Property Prediction', description: 'Applying novel graph neural network architectures with geometric priors for predicting molecular properties and drug-target interactions. Collaboration with chemistry department.', domain: ['GNN', 'Drug Discovery', 'Molecular AI'], targetVenue: 'Nature Machine Intelligence', piId: 'u1', teamMemberIds: ['u1', 'u5'], status: 'active', healthScore: 58, createdAt: '2024-11-01', deadline: '2025-12-31',
    milestones: [
      { id: 'm27', title: 'Dataset Collection', date: '2025-01-15', completed: true },
      { id: 'm28', title: 'GNN Architecture', date: '2025-04-01', completed: false },
    ], labId: 'lab1',
  },
  {
    id: 'p8', title: 'EdgeViT: Efficient Vision Transformers for Edge Devices', description: 'Designing a family of vision transformers that can run efficiently on edge devices (Raspberry Pi, Jetson Nano) while maintaining competitive accuracy. Novel token pruning and knowledge distillation approach.', domain: ['Edge AI', 'Model Compression', 'Vision'], targetVenue: 'ECCV 2024', piId: 'u1', teamMemberIds: ['u1', 'u6', 'u2'], status: 'published', healthScore: 100, createdAt: '2023-06-01',
    milestones: [
      { id: 'm29', title: 'Published at ECCV', date: '2024-10-01', completed: true },
    ], labId: 'lab1',
  },
]

export const papers: Paper[] = [
  { id: 'pp1', title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale', authors: ['Alexey Dosovitskiy', 'Lucas Beyer', 'Alexander Kolesnikov'], venue: 'ICLR 2021', year: 2021, abstract: 'While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited...', url: 'https://arxiv.org/abs/2010.11929', status: 'deeply-read', tags: ['vision-transformer', 'image-classification'], projectIds: ['p1', 'p8'], annotations: [{ id: 'a1', userId: 'u2', text: 'Key insight: patch embedding is sufficient, no need for conv stems', highlight: 'We split an image into fixed-size patches', category: 'contribution', createdAt: '2024-07-15' }], addedBy: 'u2', addedAt: '2024-06-20', citations: 28500, keyFindings: ['ViT achieves SOTA when pretrained on large datasets', 'Patch-based tokenization is effective'] },
  { id: 'pp2', title: 'Attention Is All You Need', authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'], venue: 'NeurIPS 2017', year: 2017, abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...', url: 'https://arxiv.org/abs/1706.03762', status: 'deeply-read', tags: ['transformer', 'attention', 'foundational'], projectIds: ['p1', 'p2', 'p6'], annotations: [{ id: 'a2', userId: 'u3', text: 'Multi-head attention allows the model to jointly attend to information from different representation subspaces', highlight: 'multi-head attention', category: 'method', createdAt: '2024-04-10' }], addedBy: 'u1', addedAt: '2024-01-05', citations: 95000, keyFindings: ['Self-attention can replace recurrence entirely', 'Multi-head attention is crucial'] },
  { id: 'pp3', title: 'U-Net: Convolutional Networks for Biomedical Image Segmentation', authors: ['Olaf Ronneberger', 'Philipp Fischer', 'Thomas Brox'], venue: 'MICCAI 2015', year: 2015, abstract: 'There is large consent that successful training of deep networks requires many thousands of annotated training samples...', url: 'https://arxiv.org/abs/1505.04597', status: 'deeply-read', tags: ['segmentation', 'medical-imaging', 'u-net'], projectIds: ['p1'], annotations: [{ id: 'a3', userId: 'u5', text: 'Skip connections from encoder to decoder preserve spatial information — critical for medical imaging', highlight: 'skip connections', category: 'method', createdAt: '2024-07-20' }], addedBy: 'u1', addedAt: '2024-06-25', citations: 52000, keyFindings: ['Skip connections are essential for precise segmentation', 'Works well with limited training data'] },
  { id: 'pp4', title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee'], venue: 'NAACL 2019', year: 2019, abstract: 'We introduce a new language representation model called BERT...', url: 'https://arxiv.org/abs/1810.04805', status: 'read', tags: ['nlp', 'pretraining', 'bert'], projectIds: ['p2'], annotations: [], addedBy: 'u3', addedAt: '2024-03-15', citations: 75000, keyFindings: ['Bidirectional pretraining captures richer representations', 'MLM objective is highly effective'] },
  { id: 'pp5', title: 'NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis', authors: ['Ben Mildenhall', 'Pratul P. Srinivasan', 'Matthew Tancik'], venue: 'ECCV 2020', year: 2020, abstract: 'We present a method that achieves state-of-the-art results for synthesizing novel views of complex scenes...', url: 'https://arxiv.org/abs/2003.08934', status: 'deeply-read', tags: ['nerf', '3d-vision', 'view-synthesis'], projectIds: ['p4'], annotations: [{ id: 'a4', userId: 'u9', text: 'Positional encoding is the key — without it, the MLP cannot represent high-frequency details', highlight: 'positional encoding', category: 'method', createdAt: '2024-02-15' }], addedBy: 'u9', addedAt: '2024-01-20', citations: 12000, keyFindings: ['Continuous volumetric representation enables novel view synthesis', 'Positional encoding captures high frequencies'] },
  { id: 'pp6', title: 'Denoising Diffusion Probabilistic Models', authors: ['Jonathan Ho', 'Ajay Jain', 'Pieter Abbeel'], venue: 'NeurIPS 2020', year: 2020, abstract: 'We present high quality image synthesis results using diffusion probabilistic models...', url: 'https://arxiv.org/abs/2006.11239', status: 'read', tags: ['diffusion', 'generative', 'image-synthesis'], projectIds: ['p4'], annotations: [], addedBy: 'u2', addedAt: '2024-05-10', citations: 15000, keyFindings: ['Diffusion models can achieve image quality comparable to GANs', 'Simple training objective works well'] },
  { id: 'pp7', title: 'Communication-Efficient Learning of Deep Networks from Decentralized Data', authors: ['H. Brendan McMahan', 'Eider Moore', 'Daniel Ramage'], venue: 'AISTATS 2017', year: 2017, abstract: 'Modern mobile devices have access to a wealth of data suitable for learning models...', url: 'https://arxiv.org/abs/1602.05629', status: 'read', tags: ['federated-learning', 'privacy', 'distributed'], projectIds: ['p5'], annotations: [{ id: 'a5', userId: 'u8', text: 'FedAvg is the baseline everyone compares against — but it struggles with non-IID data', highlight: 'FedAvg', category: 'limitation', createdAt: '2025-02-20' }], addedBy: 'u8', addedAt: '2025-02-10', citations: 8500, keyFindings: ['FedAvg can train with limited communication rounds', 'Non-IID data is the main challenge'] },
  { id: 'pp8', title: 'Proximal Policy Optimization Algorithms', authors: ['John Schulman', 'Filip Wolski', 'Prafulla Dhariwal'], venue: 'arXiv 2017', year: 2017, abstract: 'We propose a new family of policy gradient methods for reinforcement learning...', url: 'https://arxiv.org/abs/1707.06347', status: 'deeply-read', tags: ['reinforcement-learning', 'policy-gradient', 'ppo'], projectIds: ['p3'], annotations: [{ id: 'a6', userId: 'u4', text: 'Clipping is elegant but can cause plateau issues in complex environments', highlight: 'clipped surrogate objective', category: 'limitation', createdAt: '2024-10-05' }], addedBy: 'u4', addedAt: '2024-09-10', citations: 18000, keyFindings: ['PPO is simpler and more stable than TRPO', 'Clipping prevents too-large policy updates'] },
  { id: 'pp9', title: 'Graph Attention Networks', authors: ['Petar Veličković', 'Guillem Cucurull', 'Arantxa Casanova'], venue: 'ICLR 2018', year: 2018, abstract: 'We present graph attention networks (GATs), novel neural network architectures...', url: 'https://arxiv.org/abs/1710.10903', status: 'read', tags: ['gnn', 'attention', 'graph-learning'], projectIds: ['p7'], annotations: [], addedBy: 'u5', addedAt: '2024-11-20', citations: 12500, keyFindings: ['Attention over neighbors enables adaptive aggregation', 'Multi-head attention helps on graphs too'] },
  { id: 'pp10', title: 'IndicBERT: Pre-training for Indian Languages', authors: ['Simran Khanuja', 'Diksha Bansal', 'Sarvnaz Karimi'], venue: 'ACL 2021', year: 2021, abstract: 'We present IndicBERT, a multilingual ALBERT model pretrained on large-scale corpora...', url: 'https://arxiv.org/abs/2003.00108', status: 'deeply-read', tags: ['indic-nlp', 'multilingual', 'pretraining'], projectIds: ['p2'], annotations: [{ id: 'a7', userId: 'u3', text: 'Coverage of 12 Indic languages but tokenization quality varies significantly across scripts', highlight: 'tokenization', category: 'limitation', createdAt: '2024-04-20' }], addedBy: 'u3', addedAt: '2024-03-20', citations: 950, keyFindings: ['Multilingual pretraining helps low-resource Indic languages', 'Script-specific tokenization matters'] },
  { id: 'pp11', title: 'EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks', authors: ['Mingxing Tan', 'Quoc V. Le'], venue: 'ICML 2019', year: 2019, abstract: 'Convolutional Neural Networks are commonly developed at a fixed resource budget...', url: 'https://arxiv.org/abs/1905.11946', status: 'read', tags: ['efficiency', 'model-scaling', 'cnn'], projectIds: ['p8'], annotations: [], addedBy: 'u6', addedAt: '2023-08-15', citations: 20000, keyFindings: ['Compound scaling balances depth, width, and resolution', 'Much more efficient than manual scaling'] },
  { id: 'pp12', title: 'Evaluating Large Language Models Trained on Code', authors: ['Mark Chen', 'Jerry Tworek', 'Heewoo Jun'], venue: 'arXiv 2021', year: 2021, abstract: 'We introduce Codex, a GPT language model finetuned on publicly available code from GitHub...', url: 'https://arxiv.org/abs/2107.03374', status: 'deeply-read', tags: ['code-generation', 'llm', 'program-synthesis'], projectIds: ['p6'], annotations: [{ id: 'a8', userId: 'u10', text: 'pass@k metric is the right way to evaluate — single-sample accuracy is misleading', highlight: 'pass@k', category: 'method', createdAt: '2024-09-15' }], addedBy: 'u10', addedAt: '2024-09-01', citations: 5500, keyFindings: ['LLMs can generate functional code from docstrings', 'Repeated sampling improves correctness'] },
  { id: 'pp13', title: 'Segment Anything', authors: ['Alexander Kirillov', 'Eric Mintun', 'Nikhila Ravi'], venue: 'ICCV 2023', year: 2023, abstract: 'We introduce the Segment Anything (SA) project: a new task, model, and dataset for image segmentation...', url: 'https://arxiv.org/abs/2304.02643', status: 'read', tags: ['segmentation', 'foundation-model', 'vision'], projectIds: ['p1'], annotations: [], addedBy: 'u2', addedAt: '2024-08-01', citations: 8000, keyFindings: ['Promptable segmentation is a powerful paradigm', 'Large-scale data annotation via model-in-the-loop'] },
  { id: 'pp14', title: 'MolBERT: Molecular Representation Learning with Language Models', authors: ['Seyone Chithrananda', 'Gabriel Grand', 'Bharath Ramsundar'], venue: 'NeurIPS 2020 Workshop', year: 2020, abstract: 'We present MolBERT, a method for learning molecular representations using SMILES strings...', url: 'https://arxiv.org/abs/2011.13230', status: 'skimmed', tags: ['molecular-ai', 'drug-discovery', 'representation'], projectIds: ['p7'], annotations: [], addedBy: 'u5', addedAt: '2024-12-01', citations: 450, keyFindings: ['SMILES-based pretraining captures chemical structure', 'Useful for downstream property prediction'] },
  { id: 'pp15', title: 'Sim-to-Real: Learning Agile Locomotion For Quadruped Robots', authors: ['Jie Tan', 'Tingnan Zhang', 'Erwin Coumans'], venue: 'RSS 2018', year: 2018, abstract: 'Designing agile locomotion for quadruped robots often requires carefully designed controllers...', url: 'https://arxiv.org/abs/1804.10332', status: 'deeply-read', tags: ['sim2real', 'robotics', 'locomotion'], projectIds: ['p3'], annotations: [{ id: 'a9', userId: 'u4', text: 'Domain randomization of physical parameters is the key insight for sim2real transfer', highlight: 'domain randomization', category: 'method', createdAt: '2024-09-20' }], addedBy: 'u4', addedAt: '2024-09-15', citations: 1200, keyFindings: ['Domain randomization enables robust sim2real transfer', 'Motor model fidelity is crucial'] },
]

export const ideas: Idea[] = [
  { id: 'i1', title: 'Adaptive Token Merging for Medical ViTs', hypothesis: 'By dynamically merging similar patch tokens during inference, we can reduce computation by 40% while maintaining segmentation accuracy within 1% of the full model.', motivation: 'Medical image segmentation models need to be fast enough for real-time clinical use. Current ViTs are too slow for deployment on hospital hardware.', priorArt: ['pp1', 'pp11'], method: 'Train a lightweight token similarity predictor alongside the main ViT. During inference, merge tokens with similarity above a learned threshold at each layer.', expectedContribution: 'First adaptive token merging scheme designed for dense prediction tasks (segmentation), with clinical deployment constraints.', riskAssessment: 'Medium — merging might lose fine boundary details critical for medical segmentation.', status: 'promising', votes: 7, createdBy: 'u2', projectId: 'p1', linkedPaperIds: ['pp1', 'pp3', 'pp11', 'pp13'], comments: [{ id: 'c1', userId: 'u1', text: 'Strong idea. Make sure to compare against structured pruning baselines too.', createdAt: '2025-01-20' }, { id: 'c2', userId: 'u5', text: 'We could also try this on the GNN-Drug project for molecular graphs!', createdAt: '2025-01-22' }], createdAt: '2025-01-15' },
  { id: 'i2', title: 'Script-Aware Adapter Modules for Indic Languages', hypothesis: 'Language adapters that share parameters within the same script family (Devanagari, Dravidian, etc.) will outperform language-specific adapters for low-resource Indian languages.', motivation: 'Low-resource Indic languages have insufficient monolingual data for full fine-tuning. Script-family sharing can act as a strong inductive bias.', priorArt: ['pp4', 'pp10'], method: 'Design adapter modules with a shared script encoder and language-specific residual layers. Train hierarchically: script-family pretraining, then language-specific fine-tuning.', expectedContribution: 'Novel adapter architecture that leverages typological similarities between Indian languages. Potential 5-10% improvement on low-resource benchmarks.', riskAssessment: 'Low-Medium — the linguistic similarity hypothesis is well-supported, but implementation complexity is high.', status: 'validated', votes: 9, createdBy: 'u3', projectId: 'p2', linkedPaperIds: ['pp4', 'pp10'], comments: [{ id: 'c3', userId: 'u1', text: 'This is a clean, publishable idea. Let\'s prioritize this for ACL.', createdAt: '2024-12-05' }], createdAt: '2024-11-28' },
  { id: 'i3', title: 'Physics-Informed Reward Shaping for Deformable Object Manipulation', hypothesis: 'Adding physics-based reward terms (strain energy, contact forces) to the RL reward function will accelerate sim2real transfer for deformable objects by 3x compared to sparse task rewards.', motivation: 'Deformable objects (cloth, rope, dough) are notoriously hard for sim2real because the simulation gap is huge. Physics-informed rewards can guide learning toward physically plausible behaviors.', priorArt: ['pp8', 'pp15'], method: 'Augment PPO reward with differentiable physics terms computed from the FEM simulator. Use curriculum learning to gradually shift from physics rewards to task rewards.', expectedContribution: 'First physics-informed reward shaping framework for deformable manipulation, with real-robot validation.', riskAssessment: 'High — deformable object simulation is unstable, and the sim2real gap might be too large even with reward shaping.', status: 'exploring', votes: 5, createdBy: 'u4', projectId: 'p3', linkedPaperIds: ['pp8', 'pp15'], comments: [{ id: 'c4', userId: 'u6', text: 'I can help with the hardware setup for real robot experiments.', createdAt: '2025-01-10' }], createdAt: '2024-12-20' },
  { id: 'i4', title: 'Language-Guided NeRF Semantic Editing', hypothesis: 'CLIP-guided optimization can enable text-based editing of NeRF scenes (e.g., "make the chair red") without per-object 3D supervision.', motivation: 'Current NeRF editing requires manual 3D annotations or masks. Language guidance would make it accessible to non-expert users.', priorArt: ['pp5', 'pp6'], method: 'Decompose NeRF into semantic regions using CLIP features. Apply localized SDS-like optimization to edit specific regions based on text prompts while preserving the rest of the scene.', expectedContribution: 'First interactive, text-guided NeRF editing system with real-time preview.', riskAssessment: 'Medium — CLIP-guided optimization can be unstable and produce artifacts.', status: 'validated', votes: 11, createdBy: 'u9', projectId: 'p4', linkedPaperIds: ['pp5', 'pp6'], comments: [{ id: 'c5', userId: 'u1', text: 'This was the winning idea for our NeurIPS submission. Great work Meera!', createdAt: '2025-03-15' }], createdAt: '2024-03-10' },
  { id: 'i5', title: 'Contribution-Aware Federated Aggregation', hypothesis: 'Weighting client updates by their estimated contribution quality (measured via held-out validation on public data) will improve federated model performance by 8-12% on heterogeneous medical data.', motivation: 'Standard FedAvg treats all hospital updates equally, but hospitals have vastly different data quality and distribution.', priorArt: ['pp7'], method: 'Each round, estimate client contribution using Shapley values approximated on a small public validation set. Weight aggregation accordingly.', expectedContribution: 'Practical contribution-aware aggregation scheme that works with differential privacy constraints.', riskAssessment: 'Medium — Shapley value estimation is expensive; need efficient approximation.', status: 'exploring', votes: 4, createdBy: 'u8', projectId: 'p5', linkedPaperIds: ['pp7'], comments: [], createdAt: '2025-02-15' },
  { id: 'i6', title: 'Verification-Guided Code Generation with Counterexample Feedback', hypothesis: 'Feeding formal verification counterexamples back to the LLM as structured feedback will improve code correctness by 25% compared to test-only feedback.', motivation: 'Current code LLMs use test cases for feedback, but tests are incomplete. Formal verification can provide provably correct feedback about edge cases.', priorArt: ['pp12'], method: 'After LLM generates code, run bounded model checking. If a counterexample is found, format it as structured feedback and prompt the LLM to fix the code. Iterate up to k times.', expectedContribution: 'Novel verification-in-the-loop framework for code generation. New benchmark with formally specified problems.', riskAssessment: 'Medium — bounded model checking is slow and doesn\'t scale to all programs. Need to carefully scope the benchmark.', status: 'promising', votes: 6, createdBy: 'u10', projectId: 'p6', linkedPaperIds: ['pp12'], comments: [{ id: 'c6', userId: 'u3', text: 'Could we also use this for generating verified translations between languages?', createdAt: '2025-02-01' }], createdAt: '2025-01-05' },
]

export const experiments: Experiment[] = [
  { id: 'e1', title: 'MedViT Baseline: Standard ViT-B/16 on CT-ORG', hypothesisId: 'i1', projectId: 'p1', setup: 'ViT-B/16 pretrained on ImageNet-21k, fine-tuned on CT-ORG dataset (131 CT volumes). Standard data augmentation (random crop, flip, rotation). AdamW optimizer, cosine scheduler.', parameters: { 'learning_rate': '1e-4', 'batch_size': '8', 'epochs': '100', 'image_size': '512x512', 'patch_size': '16', 'gpu': 'A100-80GB' }, hardware: 'NVIDIA A100 80GB x 2', dataset: 'CT-ORG (131 CT volumes, 6 organs)', status: 'completed', results: { metrics: { 'dice_liver': 0.947, 'dice_kidney': 0.921, 'dice_spleen': 0.936, 'dice_pancreas': 0.782, 'dice_mean': 0.897, 'params_M': 86.6, 'inference_ms': 234 }, observations: 'Baseline ViT achieves competitive results but is slow at inference. Pancreas segmentation is significantly worse due to small organ size and high shape variability.', plots: [], conclusion: 'Baseline is strong for large organs but needs improvement for small, variable organs. Inference speed needs 3x improvement for clinical deployment.' }, runBy: 'u2', runDate: '2024-10-01', completedDate: '2024-10-15', notes: 'Need to investigate why pancreas is so much worse. Possibly need higher resolution patches for small organs.' },
  { id: 'e2', title: 'MedViT v2: Token Merging with Fixed Threshold', hypothesisId: 'i1', projectId: 'p1', setup: 'Same as e1 but with token merging applied at layers 4, 8, 12 with cosine similarity threshold 0.8. Merged tokens use weighted average of their features.', parameters: { 'learning_rate': '1e-4', 'batch_size': '8', 'epochs': '100', 'merge_threshold': '0.8', 'merge_layers': '4,8,12' }, hardware: 'NVIDIA A100 80GB x 2', dataset: 'CT-ORG (131 CT volumes, 6 organs)', status: 'completed', results: { metrics: { 'dice_liver': 0.941, 'dice_kidney': 0.912, 'dice_spleen': 0.928, 'dice_pancreas': 0.751, 'dice_mean': 0.883, 'params_M': 86.6, 'inference_ms': 156, 'token_reduction': 38.2 }, observations: 'Token merging reduces inference time by 33% but drops dice by 1.4%. Pancreas takes the biggest hit — small organ tokens get merged into background.', plots: [], conclusion: 'Fixed threshold merging is too aggressive for small organs. Need adaptive thresholds or organ-aware merging.' }, runBy: 'u2', runDate: '2024-11-01', completedDate: '2024-11-20', notes: 'This validates the concern about boundary details. Need adaptive approach.' },
  { id: 'e3', title: 'LinguaBridge: Script-Shared Adapter on Hindi-Marathi', hypothesisId: 'i2', projectId: 'p2', setup: 'mBERT base model with script-shared Devanagari adapter. Train on Hindi NER (50k examples) and evaluate zero-shot transfer to Marathi NER.', parameters: { 'base_model': 'mBERT', 'adapter_size': '256', 'learning_rate': '2e-5', 'train_lang': 'Hindi', 'eval_lang': 'Marathi', 'task': 'NER' }, hardware: 'NVIDIA V100 32GB x 1', dataset: 'Hindi NER (WikiANN), Marathi NER (WikiANN)', status: 'completed', results: { metrics: { 'hindi_f1': 0.891, 'marathi_zero_shot_f1': 0.823, 'marathi_few_shot_f1': 0.867, 'baseline_marathi_f1': 0.756 }, observations: 'Script-shared adapter significantly outperforms language-specific adapter for zero-shot transfer (+6.7% F1). Few-shot with 100 Marathi examples closes most of the gap.', plots: [], conclusion: 'Script-sharing hypothesis is validated for Devanagari family. Need to test on Dravidian scripts next.' }, runBy: 'u3', runDate: '2025-01-10', completedDate: '2025-02-05', notes: 'Very promising results! Script sharing is the key insight.' },
  { id: 'e4', title: 'RoboSim: PPO Baseline in IsaacGym', hypothesisId: 'i3', projectId: 'p3', setup: 'Standard PPO agent trained in IsaacGym for cloth folding task. Sparse reward: +1 for successful fold, 0 otherwise. 4096 parallel environments.', parameters: { 'algorithm': 'PPO', 'envs': '4096', 'timesteps': '50M', 'lr': '3e-4', 'clip_range': '0.2', 'reward': 'sparse' }, hardware: 'NVIDIA A100 80GB x 4', dataset: 'IsaacGym Cloth Folding Environment', status: 'completed', results: { metrics: { 'success_rate_sim': 0.42, 'success_rate_real': 0.08, 'training_hours': 18, 'sim2real_gap': 0.34 }, observations: 'PPO with sparse reward barely learns the task in sim and completely fails in real. The sim2real gap is enormous for deformable objects.', plots: [], conclusion: 'Sparse rewards are insufficient. Need dense, physics-informed rewards. This validates the need for our proposed approach.' }, runBy: 'u4', runDate: '2025-01-15', completedDate: '2025-02-10', notes: 'The 8% real success rate is basically random. Need to rethink the reward design completely.' },
  { id: 'e5', title: 'NeRF-Edit: CLIP-Guided Color Editing', hypothesisId: 'i4', projectId: 'p4', setup: 'InstantNGP NeRF trained on Garden scene. CLIP-guided optimization for color changes (e.g., "make flowers purple"). Localized via DINO feature similarity.', parameters: { 'nerf': 'InstantNGP', 'clip_model': 'ViT-B/32', 'optimization_steps': '500', 'learning_rate': '1e-3', 'scene': 'Garden' }, hardware: 'NVIDIA RTX 4090 x 1', dataset: 'Mip-NeRF 360 Garden Scene', status: 'completed', results: { metrics: { 'clip_similarity': 0.287, 'psnr_unchanged': 31.2, 'user_preference': 0.82, 'edit_time_seconds': 45 }, observations: 'Color edits work remarkably well. Spatial localization via DINO features is accurate. Minor color bleeding at object boundaries.', plots: [], conclusion: 'Color editing is solved. Geometric editing (shape changes) is the remaining challenge. Paper-ready results.' }, runBy: 'u9', runDate: '2024-12-01', completedDate: '2024-12-20', notes: 'This is one of our strongest results. Include in NeurIPS submission.' },
  { id: 'e6', title: 'MedViT v3: Adaptive Token Merging with Organ-Aware Loss', hypothesisId: 'i1', projectId: 'p1', setup: 'ViT-B/16 with learned per-layer merge thresholds and an auxiliary organ-boundary-aware loss that penalizes merging tokens near organ boundaries.', parameters: { 'learning_rate': '1e-4', 'batch_size': '8', 'epochs': '150', 'boundary_loss_weight': '0.5', 'merge_layers': 'all' }, hardware: 'NVIDIA A100 80GB x 2', dataset: 'CT-ORG (131 CT volumes, 6 organs)', status: 'running', runBy: 'u2', runDate: '2025-03-15', notes: 'Currently at epoch 87/150. Preliminary results look very promising — dice_mean is 0.893 with 42% token reduction.' },
  { id: 'e7', title: 'CodeReason: Baseline LLM Code Generation on VeriBench', hypothesisId: 'i6', projectId: 'p6', setup: 'Evaluate GPT-4, CodeLlama-34B, and DeepSeek-Coder on our VeriBench benchmark (200 formally specified problems). Measure pass@1 and pass@10 with test-only feedback.', parameters: { 'models': 'GPT-4, CodeLlama-34B, DeepSeek-Coder', 'benchmark': 'VeriBench-200', 'max_attempts': '10', 'feedback': 'test-only' }, hardware: 'API + NVIDIA A100 80GB x 2', dataset: 'VeriBench (200 problems)', status: 'completed', results: { metrics: { 'gpt4_pass1': 0.645, 'gpt4_pass10': 0.812, 'codellama_pass1': 0.423, 'codellama_pass10': 0.634, 'deepseek_pass1': 0.567, 'deepseek_pass10': 0.745 }, observations: 'Even GPT-4 only achieves 64.5% pass@1. Many failures are edge cases that tests miss but formal verification catches.', plots: [], conclusion: 'There is significant room for improvement with verification feedback. Proceeding with verification-in-the-loop experiments.' }, runBy: 'u10', runDate: '2025-02-01', completedDate: '2025-03-01', notes: 'VeriBench is a strong benchmark. 35% of GPT-4 failures are off-by-one or boundary condition errors.' },
  { id: 'e8', title: 'LinguaBridge: Dravidian Script Adapter (Tamil-Kannada)', hypothesisId: 'i2', projectId: 'p2', setup: 'Same adapter architecture as e3 but for Dravidian script family. Train on Tamil NER, evaluate zero-shot on Kannada.', parameters: { 'base_model': 'mBERT', 'adapter_size': '256', 'script_family': 'Dravidian', 'train_lang': 'Tamil', 'eval_lang': 'Kannada' }, hardware: 'NVIDIA V100 32GB x 1', dataset: 'Tamil NER, Kannada NER (WikiANN)', status: 'running', runBy: 'u3', runDate: '2025-03-20', notes: 'Training in progress. Epoch 15/30.' },
  { id: 'e9', title: 'GNN-Drug: GAT Baseline on ZINC Benchmark', hypothesisId: '', projectId: 'p7', setup: 'Standard Graph Attention Network (4 layers, 8 heads) on ZINC molecular property prediction benchmark.', parameters: { 'model': 'GAT', 'layers': '4', 'heads': '8', 'hidden_dim': '256', 'learning_rate': '1e-3' }, hardware: 'NVIDIA V100 32GB x 1', dataset: 'ZINC 250K', status: 'completed', results: { metrics: { 'mae': 0.384, 'r2': 0.912 }, observations: 'GAT baseline is decent but not SOTA. Need geometric priors.', plots: [], conclusion: 'Baseline established. Geometric-aware GNN should improve MAE significantly.' }, runBy: 'u5', runDate: '2025-02-15', completedDate: '2025-03-05', notes: 'Ready to build our proposed model on top of this baseline.' },
  { id: 'e10', title: 'EdgeViT: Token Pruning + Distillation on ImageNet', hypothesisId: '', projectId: 'p8', setup: 'ViT-Tiny with our proposed dynamic token pruning and knowledge distillation from ViT-Base teacher. Evaluated on ImageNet-1K and deployed on Jetson Nano.', parameters: { 'student': 'ViT-Tiny', 'teacher': 'ViT-Base', 'pruning_ratio': '0.5', 'distillation_temp': '4.0' }, hardware: 'NVIDIA A100 (training), Jetson Nano (deployment)', dataset: 'ImageNet-1K', status: 'completed', results: { metrics: { 'top1_accuracy': 0.782, 'top5_accuracy': 0.941, 'latency_jetson_ms': 28, 'model_size_mb': 12.3, 'flops_reduction': 0.62 }, observations: 'Achieves 78.2% top-1 with only 28ms latency on Jetson Nano. Published at ECCV 2024.', plots: [], conclusion: 'State-of-the-art efficiency-accuracy tradeoff for edge deployment. Published.' }, runBy: 'u6', runDate: '2024-03-01', completedDate: '2024-05-15', notes: 'Published at ECCV 2024! Our best paper yet for edge deployment.' },
]

export const channels: ChatChannel[] = [
  { id: 'ch1', name: 'general', type: 'announcement', labId: 'lab1' },
  { id: 'ch2', name: 'medvit', type: 'project', projectId: 'p1', labId: 'lab1' },
  { id: 'ch3', name: 'linguabridge', type: 'project', projectId: 'p2', labId: 'lab1' },
  { id: 'ch4', name: 'robosim2real', type: 'project', projectId: 'p3', labId: 'lab1' },
  { id: 'ch5', name: 'reading-group', type: 'reading-group', labId: 'lab1' },
  { id: 'ch6', name: 'gpu-resources', type: 'resources', labId: 'lab1' },
  { id: 'ch7', name: 'random', type: 'random', labId: 'lab1' },
  { id: 'ch8', name: 'nerf-edit', type: 'project', projectId: 'p4', labId: 'lab1' },
  { id: 'ch9', name: 'codereason', type: 'project', projectId: 'p6', labId: 'lab1' },
]

export const messages: ChatMessage[] = [
  { id: 'msg1', channelId: 'ch1', userId: 'u1', text: 'Great news everyone! Our NeRF-Edit paper has been submitted to NeurIPS. Fingers crossed! 🎉', timestamp: '2025-05-22T14:30:00Z', isBot: false, reactions: [{ emoji: '🎉', userIds: ['u2','u3','u4','u5','u9'] }, { emoji: '🔥', userIds: ['u7','u10'] }] },
  { id: 'msg2', channelId: 'ch1', userId: 'u1', text: 'Reminder: Lab meeting tomorrow at 3 PM. Arjun will present MedViT adaptive token merging results.', timestamp: '2025-04-01T09:00:00Z', isBot: false, reactions: [{ emoji: '👍', userIds: ['u2','u3'] }] },
  { id: 'msg3', channelId: 'ch2', userId: 'u2', text: 'The adaptive token merging experiment is at epoch 87/150. Preliminary dice_mean is 0.893 with 42% token reduction! This is looking really good.', timestamp: '2025-04-02T16:45:00Z', isBot: false, reactions: [{ emoji: '🚀', userIds: ['u1','u5'] }] },
  { id: 'msg4', channelId: 'ch2', userId: 'u1', text: 'Excellent! Make sure to log the per-organ breakdown too. The pancreas numbers will make or break the story.', timestamp: '2025-04-02T17:00:00Z', isBot: false, reactions: [] },
  { id: 'msg5', channelId: 'ch2', userId: 'bot', text: '📊 **Weekly MedViT Digest**\n\n• Experiment e6 (Adaptive Token Merging) is at epoch 87/150\n• Preliminary dice_mean: 0.893 (target: >0.890)\n• Token reduction: 42% (target: >40%)\n• CVPR deadline: 193 days away\n• **Open blocker**: Need to run ablation on boundary loss weight\n\n_Suggested next step: Run boundary loss weight sweep [0.1, 0.3, 0.5, 0.7, 1.0]_', timestamp: '2025-04-07T08:00:00Z', isBot: true, reactions: [{ emoji: '🤖', userIds: ['u2'] }] },
  { id: 'msg6', channelId: 'ch3', userId: 'u3', text: 'Dravidian adapter training is going well! Tamil→Kannada zero-shot is already at 0.79 F1 at epoch 15.', timestamp: '2025-04-01T11:30:00Z', isBot: false, reactions: [{ emoji: '🎯', userIds: ['u1','u10'] }] },
  { id: 'msg7', channelId: 'ch5', userId: 'u1', text: 'This week\'s paper: "Scaling Laws for Neural Language Models" by Kaplan et al. Everyone please read by Friday and add your annotations.', timestamp: '2025-03-31T09:00:00Z', isBot: false, reactions: [{ emoji: '📖', userIds: ['u3','u10','u2'] }] },
  { id: 'msg8', channelId: 'ch6', userId: 'u4', text: 'Heads up — I\'ll be using GPU nodes 3-4 for the next 48 hours for RoboSim training. Please use nodes 1-2.', timestamp: '2025-04-03T10:00:00Z', isBot: false, reactions: [{ emoji: '👍', userIds: ['u2','u6'] }] },
  { id: 'msg9', channelId: 'ch6', userId: 'bot', text: '🖥️ **GPU Status Update**\n\n| Node | GPU | User | Job | ETA |\n|------|-----|------|-----|-----|\n| Node 1 | A100 #1 | Arjun | MedViT e6 | ~18h |\n| Node 1 | A100 #2 | Free | — | — |\n| Node 2 | A100 #1 | Sneha | LinguaBridge e8 | ~6h |\n| Node 2 | A100 #2 | Free | — | — |\n| Node 3 | A100 #1-2 | Rahul | RoboSim | ~42h |\n| Node 4 | A100 #1-2 | Rahul | RoboSim | ~42h |', timestamp: '2025-04-03T10:05:00Z', isBot: true, reactions: [] },
  { id: 'msg10', channelId: 'ch7', userId: 'u7', text: 'Just found this amazing visualization library for attention maps — anyone used bertviz?', timestamp: '2025-04-02T15:00:00Z', isBot: false, reactions: [{ emoji: '👀', userIds: ['u3'] }] },
  { id: 'msg11', channelId: 'ch4', userId: 'u4', text: '@ResearchOS what experiments have we run for the cloth folding task so far?', timestamp: '2025-04-03T14:00:00Z', isBot: false, reactions: [] },
  { id: 'msg12', channelId: 'ch4', userId: 'bot', text: '🔍 Here\'s what I found for cloth folding experiments:\n\n**Experiment e4: PPO Baseline in IsaacGym** (Completed)\n- Success rate in sim: 42%\n- Success rate in real: 8% (essentially random)\n- Key finding: Sparse rewards are insufficient for deformable objects\n\n**No other cloth folding experiments logged yet.**\n\n💡 Based on Idea i3 (Physics-Informed Reward Shaping), the next planned experiment should use FEM-based dense rewards. Want me to create an experiment log template for that?', timestamp: '2025-04-03T14:01:00Z', isBot: true, reactions: [{ emoji: '🙏', userIds: ['u4'] }] },
]

export const publications: Publication[] = [
  { id: 'pub1', title: 'EdgeViT: Dynamic Token Pruning and Knowledge Distillation for Efficient Vision Transformers on Edge Devices', venue: 'ECCV 2024', status: 'published', submittedDate: '2024-03-15', authors: ['Dr. Priya Sharma', 'Vikram Singh', 'Arjun Mehta'], projectId: 'p8', citations: 47, impactFactor: 4.2 },
  { id: 'pub2', title: 'NeRF-Edit: Interactive Text-Guided Neural Radiance Field Editing with Semantic Decomposition', venue: 'NeurIPS 2025', status: 'under-review', submittedDate: '2025-05-22', authors: ['Meera Patel', 'Ananya Gupta', 'Dr. Priya Sharma'], projectId: 'p4', citations: 0, impactFactor: 5.8 },
  { id: 'pub3', title: 'Self-Supervised Pretraining for Medical Image Segmentation: A Survey', venue: 'Medical Image Analysis (Journal)', status: 'published', submittedDate: '2024-01-10', authors: ['Dr. Priya Sharma', 'Arjun Mehta'], projectId: 'p1', citations: 23, impactFactor: 10.9 },
  { id: 'pub4', title: 'Attention-Driven Feature Aggregation for Real-Time Semantic Segmentation', venue: 'ICCV 2023', status: 'published', submittedDate: '2023-03-20', authors: ['Dr. Priya Sharma', 'Arjun Mehta', 'Meera Patel'], projectId: 'p1', citations: 89, impactFactor: 4.6 },
  { id: 'pub5', title: 'Bridging the Devanagari Gap: Transfer Learning for Hindi-Marathi NER', venue: 'EMNLP 2024', status: 'published', submittedDate: '2024-06-15', authors: ['Sneha Iyer', 'Dr. Priya Sharma'], projectId: 'p2', citations: 12, impactFactor: 4.1 },
  { id: 'pub6', title: 'On the Limits of Sim-to-Real Transfer for Deformable Object Manipulation', venue: 'CoRL 2024', status: 'rejected', submittedDate: '2024-06-30', authors: ['Rahul Verma', 'Dr. Priya Sharma'], projectId: 'p3', citations: 0, impactFactor: 3.8 },
]

export const integrations: Integration[] = [
  { id: 'int1', name: 'Slack', category: 'Communication', description: 'Mirror lab channels and receive AI digests in Slack', icon: 'slack', connected: true },
  { id: 'int2', name: 'Notion', category: 'Productivity', description: 'Sync project pages and meeting notes with Notion workspace', icon: 'book-open', connected: true },
  { id: 'int3', name: 'GitHub', category: 'Code', description: 'Link repositories, track commits, and auto-log code changes', icon: 'github', connected: true },
  { id: 'int4', name: 'Weights & Biases', category: 'Experiment Tracking', description: 'Auto-import experiment metrics, charts, and run configs', icon: 'bar-chart-2', connected: true },
  { id: 'int5', name: 'Overleaf', category: 'Writing', description: 'Two-way sync with Overleaf LaTeX projects', icon: 'file-text', connected: false },
  { id: 'int6', name: 'Google Scholar', category: 'Paper Sources', description: 'Track citations and discover new relevant papers', icon: 'graduation-cap', connected: true },
  { id: 'int7', name: 'arXiv', category: 'Paper Sources', description: 'Auto-import papers from arXiv and get daily digests', icon: 'newspaper', connected: true },
  { id: 'int8', name: 'Zotero', category: 'Reference Managers', description: 'Sync your Zotero library with ResearchOS paper library', icon: 'library', connected: false },
  { id: 'int9', name: 'Google Calendar', category: 'Calendar', description: 'Sync deadlines, milestones, and meetings', icon: 'calendar', connected: true },
  { id: 'int10', name: 'Microsoft Teams', category: 'Communication', description: 'Mirror channels and notifications to Teams', icon: 'users', connected: false },
  { id: 'int11', name: 'Google Drive', category: 'Storage', description: 'Attach files from Google Drive to projects and experiments', icon: 'hard-drive', connected: true },
  { id: 'int12', name: 'Mendeley', category: 'Reference Managers', description: 'Import your Mendeley library and annotations', icon: 'bookmark', connected: false },
  { id: 'int13', name: 'MLflow', category: 'Experiment Tracking', description: 'Import experiment runs and model registry data', icon: 'activity', connected: false },
  { id: 'int14', name: 'Hugging Face', category: 'Code', description: 'Track models, datasets, and spaces from Hugging Face', icon: 'box', connected: true },
  { id: 'int15', name: 'AWS', category: 'Cloud Compute', description: 'Monitor EC2 instances and SageMaker training jobs', icon: 'cloud', connected: false },
  { id: 'int16', name: 'Semantic Scholar', category: 'Paper Sources', description: 'Enhanced paper metadata and citation graph data', icon: 'search', connected: true },
  { id: 'int17', name: 'Paperpile', category: 'Reference Managers', description: 'Sync Paperpile library and annotations', icon: 'layers', connected: false },
  { id: 'int18', name: 'Google Docs', category: 'Writing', description: 'Import and export draft sections to Google Docs', icon: 'file', connected: false },
  { id: 'int19', name: 'Dropbox', category: 'Storage', description: 'Attach and sync files from Dropbox', icon: 'inbox', connected: false },
  { id: 'int20', name: 'GitLab', category: 'Code', description: 'Link GitLab repositories and CI/CD pipelines', icon: 'git-branch', connected: false },
  { id: 'int21', name: 'Outlook Calendar', category: 'Calendar', description: 'Sync with Microsoft Outlook calendar', icon: 'calendar', connected: false },
  { id: 'int22', name: 'IEEE Xplore', category: 'Paper Sources', description: 'Search and import papers from IEEE Xplore', icon: 'database', connected: false },
  { id: 'int23', name: 'PubMed', category: 'Paper Sources', description: 'Search and import biomedical literature', icon: 'heart-pulse', connected: false },
  { id: 'int24', name: 'Neptune', category: 'Experiment Tracking', description: 'Import experiment tracking data from Neptune', icon: 'waves', connected: false },
  { id: 'int25', name: 'Comet ML', category: 'Experiment Tracking', description: 'Sync experiment data from Comet ML', icon: 'zap', connected: false },
  { id: 'int26', name: 'GCP', category: 'Cloud Compute', description: 'Monitor Vertex AI and Compute Engine instances', icon: 'cloud', connected: false },
  { id: 'int27', name: 'Azure', category: 'Cloud Compute', description: 'Track Azure ML and VM workloads', icon: 'cloud', connected: false },
  { id: 'int28', name: 'Jira', category: 'Productivity', description: 'Sync tasks and sprints with Jira projects', icon: 'check-square', connected: false },
  { id: 'int29', name: 'Confluence', category: 'Productivity', description: 'Sync lab wiki and documentation', icon: 'book', connected: false },
  { id: 'int30', name: 'Trello', category: 'Productivity', description: 'Mirror project boards and task cards', icon: 'layout', connected: false },
]

export const activities: ActivityItem[] = [
  { id: 'act1', userId: 'u2', action: 'started experiment', target: 'MedViT v3: Adaptive Token Merging with Organ-Aware Loss', targetType: 'experiment', timestamp: '2025-04-07T09:00:00Z' },
  { id: 'act2', userId: 'u3', action: 'updated results for', target: 'LinguaBridge: Dravidian Script Adapter', targetType: 'experiment', timestamp: '2025-04-06T16:30:00Z' },
  { id: 'act3', userId: 'u9', action: 'submitted paper', target: 'NeRF-Edit to NeurIPS 2025', targetType: 'publication', timestamp: '2025-04-05T23:59:00Z' },
  { id: 'act4', userId: 'u10', action: 'completed experiment', target: 'CodeReason: Baseline LLM Code Generation on VeriBench', targetType: 'experiment', timestamp: '2025-04-05T14:00:00Z' },
  { id: 'act5', userId: 'u5', action: 'added paper', target: 'MolBERT: Molecular Representation Learning', targetType: 'paper', timestamp: '2025-04-04T11:00:00Z' },
  { id: 'act6', userId: 'u4', action: 'created idea', target: 'Physics-Informed Reward Shaping for Deformable Object Manipulation', targetType: 'idea', timestamp: '2025-04-03T15:30:00Z' },
  { id: 'act7', userId: 'u1', action: 'reviewed idea', target: 'Adaptive Token Merging for Medical ViTs', targetType: 'idea', timestamp: '2025-04-02T10:00:00Z' },
  { id: 'act8', userId: 'u8', action: 'added paper', target: 'Communication-Efficient Learning of Deep Networks', targetType: 'paper', timestamp: '2025-04-01T09:30:00Z' },
  { id: 'act9', userId: 'u6', action: 'logged results for', target: 'EdgeViT: Token Pruning + Distillation', targetType: 'experiment', timestamp: '2025-03-30T17:00:00Z' },
  { id: 'act10', userId: 'u7', action: 'joined project', target: 'NeRF-Edit: Interactive Neural Radiance Field Editing', targetType: 'project', timestamp: '2025-03-28T10:00:00Z' },
]

export const pricingTiers: PricingTier[] = [
  {
    name: 'Spark',
    tagline: 'Solo researchers & students',
    price: 'Free',
    period: 'forever',
    features: ['1 user', 'Up to 3 active projects', '200 papers in library', '50 AI agent queries/month', 'Basic idea canvas', 'Community support'],
    cta: 'Get Started Free',
  },
  {
    name: 'Lab Starter',
    tagline: 'Small academic labs (2–8 members)',
    price: '₹2,499',
    priceAnnual: '₹1,999',
    period: '/month per lab',
    features: ['Up to 8 members', 'Unlimited projects', '2,000 papers in library', '500 AI agent queries/month', 'Full experiment tracker', '1 discipline module', 'Email support'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Research Lab Pro',
    tagline: 'Active university labs (8–25 members)',
    price: '₹9,999',
    priceAnnual: '₹7,999',
    period: '/month per lab',
    features: ['Up to 25 members', 'Unlimited everything', 'Unlimited AI queries', 'All discipline modules', 'Agentic LLM with actions', 'Full integrations (W&B, GitHub, Overleaf)', 'Lab Network access', 'Priority support + onboarding call'],
    highlight: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Research Institute',
    tagline: 'Multi-lab departments & national labs',
    price: '₹39,999',
    priceAnnual: '₹29,999',
    period: '/month per institute',
    features: ['Unlimited members', 'Multi-lab consortium', 'SSO + LDAP integration', 'On-premise deployment', 'Custom AI fine-tuning', 'Grant & milestone tracking', 'Dedicated CSM', 'SLA + uptime guarantees'],
    cta: 'Contact Sales',
  },
  {
    name: 'Enterprise',
    tagline: 'Corporate R&D & industry labs',
    price: '₹1,49,999+',
    period: '/month custom',
    features: ['White-label option', 'Air-gapped deployment', 'Custom LLM (no data leaves org)', 'IP protection + audit trails', 'Legal & compliance module', 'ERP/HRIS integration', 'Dedicated engineering support', 'Custom integrations'],
    cta: 'Talk to Sales',
  },
]

export function getUserById(id: string): User | undefined {
  return users.find(u => u.id === id)
}

export function getProjectById(id: string): Project | undefined {
  return projects.find(p => p.id === id)
}

export function getPaperById(id: string): Paper | undefined {
  return papers.find(p => p.id === id)
}

export function getExperimentsByProject(projectId: string): Experiment[] {
  return experiments.filter(e => e.projectId === projectId)
}

export function getIdeasByProject(projectId: string): Idea[] {
  return ideas.filter(i => i.projectId === projectId)
}

export function getPapersByProject(projectId: string): Paper[] {
  return papers.filter(p => p.projectIds.includes(projectId))
}

export function getMessagesByChannel(channelId: string): ChatMessage[] {
  return messages.filter(m => m.channelId === channelId)
}

export function getLabStats() {
  return {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'active').length,
    totalPapers: papers.length,
    totalExperiments: experiments.length,
    runningExperiments: experiments.filter(e => e.status === 'running').length,
    completedExperiments: experiments.filter(e => e.status === 'completed').length,
    totalIdeas: ideas.length,
    totalPublications: publications.length,
    publishedPapers: publications.filter(p => p.status === 'published').length,
    totalCitations: publications.reduce((sum, p) => sum + p.citations, 0),
    avgHealthScore: Math.round(projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length),
    teamSize: users.length,
  }
}
