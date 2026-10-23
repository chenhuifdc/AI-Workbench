import { McpServerConfig, McpToolDefinition, McpResourceDefinition, McpPromptDefinition } from '../types';

export const INITIAL_MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'filesystem',
    name: '本地文件系统 (Filesystem)',
    description: '安全沙盒环境内的指定文件目录读写、遍历与元数据读取，用于本地文档与报表操作',
    enabled: true,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', './data/docs'],
    cwd: './',
    env: {
      ALLOW_WRITE: 'true',
      SANDBOX_ROOT: './data/docs'
    },
    status: 'running',
    lastPingMs: 12,
    toolsCount: 5,
    resourcesCount: 2,
    promptsCount: 1,
    autoApprove: true
  },
  {
    id: 'sqlite',
    name: 'SQLite 结构化数据库 (SQLite Engine)',
    description: '执行轻量化本地 SQLite 数据库事务读取、Schema 探查、数据分析与统计报表汇总',
    enabled: true,
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db-path', './data/financial_business.db'],
    cwd: './',
    env: {},
    status: 'running',
    lastPingMs: 8,
    toolsCount: 4,
    resourcesCount: 1,
    promptsCount: 2,
    autoApprove: true
  },
  {
    id: 'fetch',
    name: 'Web 网页抓取与解析 (Fetch & Markdown)',
    description: '抓取互联网公开 HTML 页面、自动剥离广告噪点并转化为 Markdown 清洁文本供模型推理',
    enabled: true,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    cwd: './',
    env: {
      USER_AGENT: 'Mozilla/5.0 (compatible; LocalAIWorkbench/3.8)'
    },
    status: 'idle',
    lastPingMs: 24,
    toolsCount: 2,
    resourcesCount: 0,
    promptsCount: 1,
    autoApprove: false
  },
  {
    id: 'brave-search',
    name: 'Brave 智能网络检索 (Brave Search)',
    description: '全球互联网实时搜索，针对宏观经济数据、最新产业财报与实时行情提供精准网页索引',
    enabled: false,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    cwd: './',
    env: {
      BRAVE_API_KEY: 'BSA_live_demo_token_key'
    },
    status: 'idle',
    lastPingMs: undefined,
    toolsCount: 2,
    resourcesCount: 0,
    promptsCount: 1,
    autoApprove: false
  },
  {
    id: 'github',
    name: 'GitHub 企业仓储协作 (GitHub MCP)',
    description: '代码仓搜索、文件历史版本检索、Pull Request 与 Issue 自动化生成与审查工具链',
    enabled: false,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    cwd: './',
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: ''
    },
    status: 'disabled',
    lastPingMs: undefined,
    toolsCount: 6,
    resourcesCount: 3,
    promptsCount: 2,
    autoApprove: false
  },
  {
    id: 'memory',
    name: 'Memory 知识图谱记忆库 (Memory Graph)',
    description: '基于实体-关系图谱的持久化认知记忆系统，用于跨多轮业务长对话的事实留存',
    enabled: true,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    cwd: './',
    env: {},
    status: 'running',
    lastPingMs: 14,
    toolsCount: 5,
    resourcesCount: 1,
    promptsCount: 0,
    autoApprove: true
  },
  {
    id: 'remote-sse-finance',
    name: '企业级风控网关 (Remote SSE Gateway)',
    description: '远程 HTTP/SSE 企业内网风控微服务，提供企业信用核身、反欺诈评分与合规核验',
    enabled: true,
    transport: 'sse',
    url: 'https://mcp-gateway.corp.local/sse/v1',
    headers: {
      Authorization: 'Bearer mcp-fin-token-prod-2026',
      'X-Tenant-ID': 'team-30-seat'
    },
    status: 'running',
    lastPingMs: 38,
    toolsCount: 3,
    resourcesCount: 2,
    promptsCount: 1,
    autoApprove: false
  }
];

export const INITIAL_MCP_TOOLS: McpToolDefinition[] = [
  // Filesystem Tools
  {
    name: 'read_file',
    description: '读取本地沙盒内的指定文件完整文本内容',
    serverId: 'filesystem',
    serverName: '本地文件系统 (Filesystem)',
    parameters: [
      { name: 'path', type: 'string', description: '文件相对路径，例如 docs/financial_report_q3.txt', required: true }
    ],
    exampleInput: { path: 'docs/financial_report_q3.txt' }
  },
  {
    name: 'write_file',
    description: '向指定路径写入或覆写文本文件',
    serverId: 'filesystem',
    serverName: '本地文件系统 (Filesystem)',
    parameters: [
      { name: 'path', type: 'string', description: '目标文件相对路径', required: true },
      { name: 'content', type: 'string', description: '待写入的字符串内容', required: true }
    ],
    exampleInput: { path: 'reports/summary.md', content: '# 业务分析报告摘要\n\n- 综合增长率: 18.4%' }
  },
  {
    name: 'list_directory',
    description: '列出目标文件夹下的所有文件及子文件夹清单与文件大小',
    serverId: 'filesystem',
    serverName: '本地文件系统 (Filesystem)',
    parameters: [
      { name: 'path', type: 'string', description: '目标目录路径，默认为根目录 .', required: false, default: '.' }
    ],
    exampleInput: { path: './data' }
  },
  {
    name: 'search_files',
    description: '在指定目录下递归匹配文件名关键字或正则表达式',
    serverId: 'filesystem',
    serverName: '本地文件系统 (Filesystem)',
    parameters: [
      { name: 'query', type: 'string', description: '搜索关键字或模式', required: true },
      { name: 'maxResults', type: 'number', description: '最大返回条数', required: false, default: 20 }
    ],
    exampleInput: { query: 'report', maxResults: 10 }
  },
  // SQLite Tools
  {
    name: 'read_query',
    description: '在 SQLite 数据库中执行只读 SQL SELECT 语句，返回结构化 JSON 记录集',
    serverId: 'sqlite',
    serverName: 'SQLite 结构化数据库 (SQLite Engine)',
    parameters: [
      { name: 'query', type: 'string', description: '标准 SQL 查询语句', required: true }
    ],
    exampleInput: { query: 'SELECT client_name, credit_score, balance_usd FROM client_ledger LIMIT 5;' }
  },
  {
    name: 'describe_table',
    description: '获取 SQLite 数据库指定数据表的字段结构定义、索引和外键关系',
    serverId: 'sqlite',
    serverName: 'SQLite 结构化数据库 (SQLite Engine)',
    parameters: [
      { name: 'tableName', type: 'string', description: '目标数据表名', required: true }
    ],
    exampleInput: { tableName: 'client_ledger' }
  },
  {
    name: 'list_tables',
    description: '列出 SQLite 数据库中当前存在的所有数据表名称',
    serverId: 'sqlite',
    serverName: 'SQLite 结构化数据库 (SQLite Engine)',
    parameters: [],
    exampleInput: {}
  },
  // Fetch Tools
  {
    name: 'fetch_url',
    description: '通过 HTTP GET 请求获取目标网页内容并自动转为 Clean Markdown',
    serverId: 'fetch',
    serverName: 'Web 网页抓取与解析 (Fetch & Markdown)',
    parameters: [
      { name: 'url', type: 'string', description: '合法的公网或内网 HTTP/HTTPS 链接', required: true },
      { name: 'rawHtml', type: 'boolean', description: '是否返回原始未过滤的 HTML', required: false, default: false }
    ],
    exampleInput: { url: 'https://news.ycombinator.com', rawHtml: false }
  },
  // Memory Graph Tools
  {
    name: 'create_entities',
    description: '在知识图谱中录入新的实体节点（名称、类别、属性说明）',
    serverId: 'memory',
    serverName: 'Memory 知识图谱记忆库 (Memory Graph)',
    parameters: [
      { name: 'entities', type: 'array', description: '实体列表 [{"name": "华夏基金", "entityType": "机构", "observations": ["A级合作方"]}]', required: true }
    ],
    exampleInput: {
      entities: [
        { name: '华泰联合证券', entityType: '券商机构', observations: ['持牌机构', '年交易量超千亿'] }
      ]
    }
  },
  {
    name: 'read_graph',
    description: '获取记忆库图谱中当前存储的所有实体、边与关联关系网络',
    serverId: 'memory',
    serverName: 'Memory 知识图谱记忆库 (Memory Graph)',
    parameters: [],
    exampleInput: {}
  },
  // Remote SSE Gateway Tools
  {
    name: 'query_credit_score',
    description: '向企业风控网关请求特定纳税人或机构的实时信用风控评分与反欺诈等级',
    serverId: 'remote-sse-finance',
    serverName: '企业级风控网关 (Remote SSE Gateway)',
    parameters: [
      { name: 'entityCode', type: 'string', description: '企业统一社会信用代码或个人标识', required: true },
      { name: 'modelTier', type: 'string', description: '风控模型等级 (standard / enhanced)', required: false, default: 'standard' }
    ],
    exampleInput: { entityCode: '91110000100005234X', modelTier: 'enhanced' }
  },
  {
    name: 'get_realtime_ticker',
    description: '获取国内/国际金融市场指定标的（股票、债券、外汇）毫秒级实时买卖行情',
    serverId: 'remote-sse-finance',
    serverName: '企业级风控网关 (Remote SSE Gateway)',
    parameters: [
      { name: 'symbol', type: 'string', description: '标的代码，例如 600519.SH / USDCNY', required: true }
    ],
    exampleInput: { symbol: '600519.SH' }
  }
];

export const INITIAL_MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: 'file:///workspace/data/docs/fin_rules_v3.md',
    name: '业务风控与准入红线准则 (v3.8)',
    description: '内部核心审批规则说明书，只读只引',
    mimeType: 'text/markdown',
    serverId: 'filesystem'
  },
  {
    uri: 'sqlite:///data/financial_business.db/schema',
    name: 'SQLite 业务数据库元数据结构定义',
    description: '包含客户台账表、交易流水表与违约记录表定义',
    mimeType: 'application/sql',
    serverId: 'sqlite'
  },
  {
    uri: 'memory://graph/nodes/clients',
    name: '高净值客户长期关系图谱快照',
    description: '图谱知识节点集',
    mimeType: 'application/json',
    serverId: 'memory'
  }
];

export const INITIAL_MCP_PROMPTS: McpPromptDefinition[] = [
  {
    name: 'analyze_financial_statement',
    description: '引导模型系统化读取本地文件，按照企业三张报表进行资产负债与现金流纵深诊断',
    serverId: 'filesystem',
    arguments: [
      { name: 'reportPath', description: '财报文件路径', required: true },
      { name: 'focusArea', description: '重点关注领域 (流动性 / 偿债能力 / 盈利指标)', required: false }
    ]
  },
  {
    name: 'sql_data_drilldown',
    description: '将自然语言业务问题转化为合法 SQL 查询并在 SQLite 中安全测试执行',
    serverId: 'sqlite',
    arguments: [
      { name: 'question', description: '业务分析问题描述', required: true }
    ]
  }
];

// Presets for quick adding new servers
export const MCP_PRESET_TEMPLATES: Partial<McpServerConfig>[] = [
  {
    name: '本地文件系统 (Filesystem)',
    description: '基于 @modelcontextprotocol/server-filesystem，支持本地指定目录的安全文件访问与检索',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', './data'],
    env: { ALLOW_WRITE: 'true' },
    autoApprove: true
  },
  {
    name: 'SQLite 数据库连接器',
    description: '基于 mcp-server-sqlite，读取本地 SQLite 数据库表结构并执行 SQL 分析查询',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db-path', './data/local.db'],
    env: {},
    autoApprove: true
  },
  {
    name: 'Web 网页抓取服务 (Fetch)',
    description: '基于 @modelcontextprotocol/server-fetch，直接抓取 URL 网页并转为 Clean Markdown',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    env: {},
    autoApprove: false
  },
  {
    name: 'Brave 智能网络搜索',
    description: '基于 @modelcontextprotocol/server-brave-search，提供全球实时网页及新闻检索',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: 'YOUR_BRAVE_API_KEY' },
    autoApprove: false
  },
  {
    name: 'GitHub 代码仓协作中枢',
    description: '基于 @modelcontextprotocol/server-github，支持仓储检索、代码审查与提交管理',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_your_token_here' },
    autoApprove: false
  },
  {
    name: 'Memory 知识图谱记忆库',
    description: '基于 @modelcontextprotocol/server-memory，提供长对话实体与图谱记忆留存',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {},
    autoApprove: true
  },
  {
    name: '自定义 Python 脚本执行器',
    description: '调用本地 Python3 脚本环境，运行自定义机器学习算法或量化财务分析程序',
    transport: 'stdio',
    command: 'python3',
    args: ['scripts/mcp_worker.py'],
    env: { PYTHONUNBUFFERED: '1' },
    autoApprove: false
  },
  {
    name: '远程 SSE 流式服务端',
    description: '连接远程 HTTP/SSE MCP 服务器，用于微服务集群或企业内网服务对接',
    transport: 'sse',
    url: 'https://mcp.internal.company.com/sse',
    headers: { Authorization: 'Bearer your-secret-token' },
    autoApprove: false
  }
];
