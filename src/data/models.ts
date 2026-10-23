import { ModelInfo, ModelProviderType } from '../types';

export const INITIAL_MODELS: ModelInfo[] = [
  // --- 1. DeepSeek 最新系列 (包含截图中的 DeepSeek V4.1 Flash 等) ---
  {
    id: 'deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    provider: 'deepseek',
    contextLength: '1000K',
    capabilities: ['LLM', 'CHAT', 'VISION'],
    description: '最新第4代极速多模态旗舰，100万超长上下文，支持图文深度理解与金融速读。',
    isLatest: true
  },
  {
    id: 'deepseek-v4-flash',
    name: 'deepseek-v4-flash',
    provider: 'deepseek',
    contextLength: '1000K',
    capabilities: ['LLM', 'CHAT'],
    description: '全新V4轻量极速文本模型，毫秒级响应，适合高并发金融业务咨询。',
    isLatest: true
  },
  {
    id: 'deepseek-v4-flash-vision-exp',
    name: 'deepseek-v4-flash-vision-exp',
    provider: 'deepseek',
    contextLength: '1000K',
    capabilities: ['LLM', 'CHAT', 'VISION'],
    description: '实验级视觉长上下文模型，支持K线走势图、财务报表截图秒级辨识提取。',
    isLatest: true
  },
  {
    id: 'deepseek-v4-pro',
    name: 'deepseek-v4-pro',
    provider: 'deepseek',
    contextLength: '1000K',
    capabilities: ['LLM', 'CHAT'],
    description: '全新V4专业级逻辑推演模型，长链思考与复杂资产架构设计首选。',
    isLatest: true
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (深度思考推演)',
    provider: 'deepseek',
    contextLength: '128K',
    capabilities: ['LLM', 'CHAT', 'REASONING'],
    description: '开源推理巅峰，完整展现思维链条（CoT），精准攻坚金融数理与复杂对赌协议分析。',
    isLatest: true
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (旗舰商用)',
    provider: 'deepseek',
    contextLength: '128K',
    capabilities: ['LLM', 'CHAT', 'CODE'],
    description: '综合性能媲美顶级闭源模型，超高性价比，日常对话与问答主力。'
  },

  // --- 2. OpenRouter 聚合网关最新系列 ---
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1 (OpenRouter通道)',
    provider: 'openrouter',
    contextLength: '128K',
    capabilities: ['LLM', 'CHAT', 'REASONING'],
    description: '全球高可用节点路由的 DeepSeek R1 深度思考推理模型。',
    isLatest: true
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet (混合思考)',
    provider: 'openrouter',
    contextLength: '200K',
    capabilities: ['LLM', 'CHAT', 'VISION', 'REASONING'],
    description: '支持自适应思考时长与高阶视觉读图，编程与金融文本理解顶尖。',
    isLatest: true
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    contextLength: '200K',
    capabilities: ['LLM', 'CHAT', 'VISION', 'CODE'],
    description: '业界标杆长文本与代码分析模型，金融法律文书撰写极具说服力。'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'openrouter',
    contextLength: '128K',
    capabilities: ['LLM', 'CHAT', 'CODE'],
    description: '开源大模型旗舰，国际化多语言与宏观研报能力极为均衡。'
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B Instruct',
    provider: 'openrouter',
    contextLength: '128K',
    capabilities: ['LLM', 'CHAT', 'CODE'],
    description: '通义千问72B参数旗舰模型，中文金融场景语境极佳。'
  },

  // --- 3. Ollama 本地离线纯CPU/GPU系列 ---
  {
    id: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B (本地CPU首选)',
    provider: 'ollama',
    contextLength: '32K',
    capabilities: ['LLM', 'CHAT', 'OFFLINE'],
    description: '内存仅占4.7G，8核CPU无独显流畅运行，100%离线免费零审核。',
    isLatest: true
  },
  {
    id: 'deepseek-r1:7b',
    name: 'DeepSeek R1 7B (本地蒸馏推理)',
    provider: 'ollama',
    contextLength: '64K',
    capabilities: ['LLM', 'CHAT', 'REASONING', 'OFFLINE'],
    description: '本地单机运行的 R1 逻辑推理模型，纯CPU也能输出思维过程。',
    isLatest: true
  },
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek R1 8B (Llama内核)',
    provider: 'ollama',
    contextLength: '64K',
    capabilities: ['LLM', 'CHAT', 'REASONING', 'OFFLINE'],
    description: '基于 Llama 3 蒸馏的纯离线推理模型，英文与逻辑极强。'
  },
  {
    id: 'hermes3:8b',
    name: 'Hermes 3 8B (去审查无限制)',
    provider: 'ollama',
    contextLength: '32K',
    capabilities: ['LLM', 'CHAT', 'OFFLINE'],
    description: '完全移除道德说教与答复拒止，适合极限商业敏感或无限制场景。'
  },

  // --- 4. OpenAI 官方 API 系列 ---
  {
    id: 'gpt-4o',
    name: 'GPT-4o (全能多模态旗舰)',
    provider: 'openai',
    contextLength: '128K',
    capabilities: ['LLM', 'CHAT', 'VISION', 'TOOLS'],
    description: '全球广泛使用的旗舰大模型，支持精准图表阅读与高级函数调用。'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini (超高性价比)',
    provider: 'openai',
    contextLength: '128K',
    capabilities: ['LLM', 'CHAT', 'VISION', 'FAST'],
    description: '轻量快速且价格低廉，日常客户对话及快速翻译极佳。'
  },
  {
    id: 'o3-mini',
    name: 'o3-mini (全新顶尖推理)',
    provider: 'openai',
    contextLength: '200K',
    capabilities: ['LLM', 'CHAT', 'REASONING', 'CODE'],
    description: '针对 STEM、数学和复杂金融数理的高性价比推理模型。',
    isLatest: true
  },
  {
    id: 'o1-mini',
    name: 'o1-mini (深度推演模型)',
    provider: 'openai',
    contextLength: '128K',
    capabilities: ['LLM', 'CHAT', 'REASONING'],
    description: '专注深度推理与逻辑验证，输出前会执行内部自我批判检验。'
  },

  // --- 5. Google Gemini 官方 API 系列 ---
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (默认百万上下文)',
    provider: 'gemini',
    contextLength: '1000K',
    capabilities: ['LLM', 'CHAT', 'VISION', 'TOOLS', 'FAST'],
    description: '本平台原生深度集成的旗舰极速多模态模型，秒级响应，100万长上下文。',
    isLatest: true
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (深度思考多模态)',
    provider: 'gemini',
    contextLength: '2000K',
    capabilities: ['LLM', 'CHAT', 'VISION', 'REASONING'],
    description: '支持复杂逻辑推理与超长上下文，可深度分析长篇财务报表与业务合同。'
  }
];

const LOCAL_STORAGE_KEY = 'finai_custom_models_v1';

export function getStoredModels(): ModelInfo[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return INITIAL_MODELS;
    const parsed: ModelInfo[] = JSON.parse(raw);
    // Combine built-in models with user-defined ones without duplicates
    const customOnly = parsed.filter(p => !INITIAL_MODELS.some(im => im.id === p.id));
    return [...INITIAL_MODELS, ...customOnly];
  } catch {
    return INITIAL_MODELS;
  }
}

export function saveCustomModel(model: ModelInfo): ModelInfo[] {
  const current = getStoredModels();
  const existsIndex = current.findIndex(m => m.id === model.id && m.provider === model.provider);
  let updated: ModelInfo[];
  if (existsIndex >= 0) {
    updated = current.map((m, idx) => idx === existsIndex ? { ...model, isCustom: true } : m);
  } else {
    updated = [{ ...model, isCustom: true }, ...current];
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated.filter(m => m.isCustom)));
  } catch {}
  return updated;
}

export function removeCustomModel(modelId: string): ModelInfo[] {
  const current = getStoredModels();
  const updated = current.filter(m => !(m.isCustom && m.id === modelId));
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated.filter(m => m.isCustom)));
  } catch {}
  return updated;
}
