export type CommandCategory = 'local_cpu' | 'role_expert' | 'translation' | 'cloud_media' | 'cloud_search';

export interface CommandItem {
  code: string;
  name: string;
  category: CommandCategory;
  model: string;
  cost: string;
  latency: string;
  description: string;
  detailedHelp: string;
  examplePrompt: string;
  isCloud: boolean;
  isUncensored?: boolean;
}

export interface ClientSeat {
  id: number;
  seatId: string;
  name: string;
  department: string;
  status: 'active' | 'idle' | 'generating';
  currentCommand?: string;
  totalCalls: number;
  cpuLoadPercent: number;
  ip: string;
  lastActive: string;
}

export interface ServerHardwareState {
  cpuUsage: number;
  coreLoads: number[];
  ramTotalGb: number;
  ramUsedGb: number;
  ramBreakdown: {
    ollamaModel: number;
    chromaDb: number;
    apiGateway: number;
    osAndCache: number;
    free: number;
  };
  activeConcurrency: number;
  queueLength: number;
  bgeSearchLatencyMs: number;
  tokensPerSecond: number;
}

export interface AIRole {
  id: string;
  name: string;
  code?: string;
  title: string;
  avatar: string;
  category: string;
  systemPrompt: string;
  description: string;
  temperature: number;
  knowledgeBaseIds: string[]; // Linked Dify datasets
  isCustom: boolean;
  welcomeMessage?: string;
  samplePrompts: string[];
  preferredModel?: string;
  preferredProvider?: ModelProviderType;
}

export interface DifyDocument {
  id: string;
  name: string;
  format: 'markdown' | 'txt' | 'docx' | 'pdf' | 'csv' | 'json';
  rawContent: string;
  charCount: number;
  uploadedAt: string;
  category: string;
  extractedQACount: number;
}

export interface DifyChunk {
  id: string;
  datasetId: string;
  title: string;
  content: string;
  charCount: number;
  tokenCount: number;
  keywords: string[];
  similarity?: number;
  sourceDoc: string;
  updatedAt: string;
  // QA-Enhanced Fields for high accuracy retrieval & strict <=500 chars limit:
  category?: string; // 详细分类 (例如: 固定收益与理财、合规适当性、家族信托破产隔离等)
  question?: string; // 自动提取的QA用户提问场景
  answer?: string; // 自动提取的标准解答话术 (<=500字)
  originalDocFormat?: string; // 原文档格式 (不破坏上传格式，如 .md, .docx, .txt, .pdf, .csv)
  rawOriginalContent?: string; // 对应的原文档原文片段 (格式未作改变)
  pageNumber?: string; // 文档页码 (例如: "第3页", "P.12", "第1-2页")
  pointName?: string; // 具体引用的知识点名称 (例如: "固收+理财净值短期波动安抚口径")
}

export interface DifyDataset {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  docCount: number;
  chunkCount: number;
  totalChars: number;
  retrievalMode: 'hybrid' | 'vector' | 'keyword';
  topK: number;
  scoreThreshold: number;
  chunks: DifyChunk[];
  documents?: DifyDocument[];
  updatedAt: string;
}

export type ModelProviderType = 'gemini' | 'deepseek' | 'openrouter' | 'openai' | 'ollama' | 'auto';

export type ModelCapability = 'LLM' | 'CHAT' | 'VISION' | 'REASONING' | 'CODE' | 'OFFLINE' | 'FAST' | 'TOOLS';

export interface ModelInfo {
  id: string; // The exact model string passed to API, e.g. 'deepseek-v4.1-flash', 'deepseek-v4-flash'
  name: string; // Display title, e.g. 'DeepSeek V4.1 Flash'
  provider: ModelProviderType;
  contextLength: string; // e.g. '1000K', '128K', '2000K', '32K'
  capabilities: ModelCapability[];
  description?: string;
  isLatest?: boolean;
  isCustom?: boolean;
}

export interface ModelProviderConfig {
  provider: ModelProviderType;
  model: string;
  endpoint: string;
  temperature: number;
  maxTokens: number;
  enableRag: boolean;
}

export interface ApiProviderDetail {
  id: ModelProviderType;
  name: string;
  icon: string;
  envVar: string;
  defaultEndpoint: string;
  defaultModel: string;
  recommendedModels: string[];
  configured: boolean;
  description: string;
}

export interface ChatCitation {
  chunkId: string;
  datasetName: string;
  title: string;
  contentSnippet: string;
  similarity: number;
  index?: number; // 引用脚标序号，例如 1, 2, 3
  pointName?: string; // 具体引用的知识点名称
  sourceDoc?: string; // 引用源文档名称 (例如: 财富管理部_客户异议应对指引v2.pdf)
  pageNumber?: string; // 文档页码 (例如: 第3页, P.12)
  category?: string;
  question?: string;
  keywords?: string[];
  charCount?: number;
  originalDocFormat?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  roleId?: string;
  roleName?: string;
  roleAvatar?: string;
  seatId?: string;
  seatName?: string;
  command?: string;
  text: string;
  timestamp: string;
  isRealAi?: boolean;
  latencyMs?: number;
  tokensUsed?: number;
  citations?: ChatCitation[];
  complianceWarning?: boolean;
  mediaType?: 'text' | 'image' | 'video' | 'faceswap';
  mediaMeta?: any;
}

export interface KnowledgeItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  charCount: number;
  similarity?: number;
}

export interface TelegramConfig {
  apiId?: string;
  apiHash?: string;
  botToken: string;
  isEnabled: boolean;
  webhookUrl: string;
  allowedChatIds: string[];
  defaultRoleId: string;
  defaultModel: string;
  enableRag: boolean;
  autoReplyMode: boolean;
  replyFormat: 'Markdown' | 'HTML' | 'text';
  lastConnected?: string | null;
  botInfo?: {
    id: number;
    username: string;
    first_name: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
  } | null;
}

export interface SocialAccountItem {
  id: string;
  platform: 'wechat' | 'telegram' | 'whatsapp' | 'discord' | 'custom';
  accountName: string;
  accountIdentifier: string;
  boundRoleId: string;
  boundKnowledgeBaseId: string;
  autoReply: boolean;
  notes?: string;
}

export interface SocialPlatformConfig {
  apiKey: string;
  serviceBaseUrl: string;
  webhookSecret: string;
  callbackWebhookUrl: string;
  accounts: SocialAccountItem[];
  enableRagByDefault: boolean;
  strictRagLimit: boolean;
  corsOrigins: string[];
}

// ================= MCP (Model Context Protocol) 类型定义 =================
export type McpTransportType = 'stdio' | 'sse' | 'http';

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  transport: McpTransportType;
  // stdio 传输配置
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // sse / http 传输配置
  url?: string;
  headers?: Record<string, string>;
  // 运行状态与指标
  status: 'running' | 'idle' | 'error' | 'disabled';
  lastPingMs?: number;
  errorMessage?: string;
  toolsCount?: number;
  resourcesCount?: number;
  promptsCount?: number;
  autoApprove?: boolean;
}

export interface McpToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  serverId: string;
  serverName: string;
  parameters: McpToolParameter[];
  inputSchema?: Record<string, any>;
  exampleInput?: Record<string, any>;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: { name: string; description: string; required: boolean }[];
  serverId: string;
}

export interface McpConfigFile {
  mcpServers: Record<string, {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    transport?: string;
    url?: string;
    headers?: Record<string, string>;
    [key: string]: any;
  }>;
}

