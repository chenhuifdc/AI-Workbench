import React, { useState, useEffect, useMemo } from 'react';
import { 
  Server, Terminal, Play, Plus, Trash2, CheckCircle2, 
  AlertCircle, RefreshCw, Copy, Download, Upload, 
  Sliders, FileCode, Wrench, Database, Globe, Search,
  Github, Brain, ArrowRight, Check, Eye, EyeOff,
  Zap, ExternalLink, HelpCircle, Layers, ShieldCheck,
  ChevronRight, Sparkles, Folder, Code2, Link2, BookOpen
} from 'lucide-react';
import { 
  McpServerConfig, McpToolDefinition, McpResourceDefinition, 
  McpPromptDefinition, McpTransportType, McpConfigFile 
} from '../types';
import { 
  INITIAL_MCP_SERVERS, INITIAL_MCP_TOOLS, 
  INITIAL_MCP_RESOURCES, INITIAL_MCP_PROMPTS, 
  MCP_PRESET_TEMPLATES 
} from '../data/defaultMcpServers';

interface McpEditorViewProps {
  onBackToWorkbench?: () => void;
  onApplyToRole?: (serverIds: string[]) => void;
}

export const McpEditorView: React.FC<McpEditorViewProps> = ({
  onBackToWorkbench
}) => {
  // Server state
  const [servers, setServers] = useState<McpServerConfig[]>(() => {
    try {
      const saved = localStorage.getItem('mcp_servers_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_MCP_SERVERS;
  });

  const [tools, setTools] = useState<McpToolDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('mcp_tools_list');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_MCP_TOOLS;
  });

  const [resources, setResources] = useState<McpResourceDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('mcp_resources_list');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_MCP_RESOURCES;
  });

  const [prompts, setPrompts] = useState<McpPromptDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('mcp_prompts_list');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_MCP_PROMPTS;
  });

  // Selected server
  const [selectedServerId, setSelectedServerId] = useState<string>(() => {
    return servers[0]?.id || 'filesystem';
  });

  // Current active sub-tab for selected server: 'form' | 'json' | 'tools' | 'resources'
  const [activeTab, setActiveTab] = useState<'form' | 'json' | 'tools' | 'resources'>('form');

  // Search filter for server list
  const [searchQuery, setSearchQuery] = useState('');

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Preset Modal state
  const [showPresetModal, setShowPresetModal] = useState(false);

  // Selected tool in Playground
  const [selectedToolName, setSelectedToolName] = useState<string>('');
  const [toolInputJson, setToolInputJson] = useState<string>('{}');
  const [toolExecutionResult, setToolExecutionResult] = useState<{
    status: 'idle' | 'running' | 'success' | 'error';
    latencyMs?: number;
    output?: any;
    error?: string;
  }>({ status: 'idle' });

  // JSON editor mode: 'single' (current server) or 'full' (all claude_desktop_config.json)
  const [jsonScope, setJsonScope] = useState<'single' | 'full'>('full');
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);

  // Ping testing state
  const [pingingServerId, setPingingServerId] = useState<string | null>(null);
  const [isPingingAll, setIsPingingAll] = useState(false);

  // Hide/show env secrets in form
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Selected Server object
  const selectedServer = useMemo(() => {
    return servers.find(s => s.id === selectedServerId) || servers[0];
  }, [servers, selectedServerId]);

  // Sync to localStorage
  const saveServersToStorage = (updated: McpServerConfig[]) => {
    setServers(updated);
    try {
      localStorage.setItem('mcp_servers_config', JSON.stringify(updated));
    } catch {}
  };

  // Generate full claude_desktop_config.json structure
  const generateFullConfig = (serverList: McpServerConfig[]): McpConfigFile => {
    const mcpServers: Record<string, any> = {};
    serverList.forEach(s => {
      if (s.transport === 'stdio') {
        mcpServers[s.id] = {
          command: s.command || 'npx',
          args: s.args || [],
          env: s.env || {}
        };
      } else {
        mcpServers[s.id] = {
          transport: 'sse',
          url: s.url || '',
          headers: s.headers || {}
        };
      }
    });
    return { mcpServers };
  };

  // Sync rawJsonText when switching server or jsonScope
  useEffect(() => {
    if (!selectedServer && servers.length > 0) {
      setSelectedServerId(servers[0].id);
    }

    if (jsonScope === 'full') {
      const fullConfig = generateFullConfig(servers);
      setRawJsonText(JSON.stringify(fullConfig, null, 2));
    } else if (selectedServer) {
      const singleConfig = selectedServer.transport === 'stdio' ? {
        command: selectedServer.command || 'npx',
        args: selectedServer.args || [],
        env: selectedServer.env || {}
      } : {
        transport: 'sse',
        url: selectedServer.url || '',
        headers: selectedServer.headers || {}
      };
      setRawJsonText(JSON.stringify(singleConfig, null, 2));
    }
    setJsonParseError(null);
  }, [selectedServerId, jsonScope, servers]);

  // Filtered servers
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return servers;
    const q = searchQuery.toLowerCase();
    return servers.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.id.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.command && s.command.toLowerCase().includes(q))
    );
  }, [servers, searchQuery]);

  // Tools belonging to the selected server
  const serverTools = useMemo(() => {
    if (!selectedServer) return [];
    return tools.filter(t => t.serverId === selectedServer.id);
  }, [tools, selectedServer]);

  // Resources belonging to the selected server
  const serverResources = useMemo(() => {
    if (!selectedServer) return [];
    return resources.filter(r => r.serverId === selectedServer.id);
  }, [resources, selectedServer]);

  // Prompts belonging to the selected server
  const serverPrompts = useMemo(() => {
    if (!selectedServer) return [];
    return prompts.filter(p => p.serverId === selectedServer.id);
  }, [prompts, selectedServer]);

  // Select first tool when opening tools tab or switching server
  useEffect(() => {
    if (serverTools.length > 0) {
      const current = serverTools.find(t => t.name === selectedToolName);
      if (!current) {
        setSelectedToolName(serverTools[0].name);
        setToolInputJson(JSON.stringify(serverTools[0].exampleInput || {}, null, 2));
      }
    } else {
      setSelectedToolName('');
      setToolInputJson('{}');
    }
    setToolExecutionResult({ status: 'idle' });
  }, [selectedServerId, serverTools]);

  // Handle server attribute updates
  const handleUpdateServer = (updates: Partial<McpServerConfig>) => {
    if (!selectedServer) return;
    const updated = servers.map(s => s.id === selectedServer.id ? { ...s, ...updates } : s);
    saveServersToStorage(updated);
  };

  // Toggle server enabled
  const handleToggleEnable = (serverId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated: McpServerConfig[] = servers.map(s => {
      if (s.id === serverId) {
        const nextEnabled = !s.enabled;
        const nextStatus: 'running' | 'idle' | 'error' | 'disabled' = nextEnabled 
          ? (s.status === 'disabled' ? 'running' : s.status) 
          : 'disabled';
        return {
          ...s,
          enabled: nextEnabled,
          status: nextStatus
        };
      }
      return s;
    });
    saveServersToStorage(updated);
    showToast(`已${updated.find(s => s.id === serverId)?.enabled ? '启用' : '禁用'}服务`);
  };

  // Delete server
  const handleDeleteServer = (serverId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (servers.length <= 1) {
      showToast('⚠️ 至少需要保留一个 MCP 服务配置');
      return;
    }
    const updated = servers.filter(s => s.id !== serverId);
    saveServersToStorage(updated);
    if (selectedServerId === serverId) {
      setSelectedServerId(updated[0].id);
    }
    showToast('已删除服务配置');
  };

  // Clone server
  const handleCloneServer = (server: McpServerConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = `${server.id}-copy-${Date.now().toString().slice(-4)}`;
    const cloned: McpServerConfig = {
      ...server,
      id: newId,
      name: `${server.name} (副本)`,
      status: 'idle'
    };
    const updated = [...servers, cloned];
    saveServersToStorage(updated);
    setSelectedServerId(newId);
    showToast(`已克隆服务：${cloned.name}`);
  };

  // Ping a single server
  const handlePingServer = async (server: McpServerConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPingingServerId(server.id);
    const startTime = Date.now();
    try {
      // Simulate live ping or send to backend
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 25) + 10));
      const latency = Math.max(8, Date.now() - startTime);
      const updated: McpServerConfig[] = servers.map(s => s.id === server.id ? {
        ...s,
        status: (s.enabled ? 'running' : 'disabled') as ('running' | 'disabled'),
        lastPingMs: latency,
        errorMessage: undefined
      } : s);
      saveServersToStorage(updated);
      showToast(`✅ ${server.name} 响应就绪 (${latency}ms)`);
    } catch {
      const updated: McpServerConfig[] = servers.map(s => s.id === server.id ? {
        ...s,
        status: 'error' as const,
        errorMessage: '连接超时'
      } : s);
      saveServersToStorage(updated);
      showToast(`❌ ${server.name} 连接失败`);
    } finally {
      setPingingServerId(null);
    }
  };

  // Ping all servers
  const handlePingAll = async () => {
    setIsPingingAll(true);
    let successCount = 0;
    const updated = [...servers];
    for (let i = 0; i < updated.length; i++) {
      const s = updated[i];
      if (s.enabled) {
        await new Promise(r => setTimeout(r, 40));
        s.lastPingMs = Math.floor(Math.random() * 20) + 8;
        s.status = 'running';
        successCount++;
      }
    }
    saveServersToStorage(updated);
    setIsPingingAll(false);
    showToast(`✅ 全局自检完成：${successCount} 个服务在线响应`);
  };

  // Create new server from preset
  const handleAddPreset = (preset: Partial<McpServerConfig>) => {
    const rawId = (preset.name || 'custom-server')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '') || 'server';
    const uniqueId = `${rawId}-${Date.now().toString().slice(-4)}`;
    
    const newServer: McpServerConfig = {
      id: uniqueId,
      name: preset.name || '新建 MCP 服务',
      description: preset.description || '自定义 Model Context Protocol 服务端',
      enabled: true,
      transport: (preset.transport as McpTransportType) || 'stdio',
      command: preset.command || 'npx',
      args: preset.args ? [...preset.args] : [],
      cwd: preset.cwd || './',
      env: preset.env ? { ...preset.env } : {},
      url: preset.url || '',
      headers: preset.headers ? { ...preset.headers } : {},
      status: 'idle',
      lastPingMs: 15,
      toolsCount: 2,
      resourcesCount: 0,
      promptsCount: 0,
      autoApprove: preset.autoApprove ?? false
    };

    const updated = [...servers, newServer];
    saveServersToStorage(updated);
    setSelectedServerId(newServer.id);
    setShowPresetModal(false);
    showToast(`已添加新服务：${newServer.name}`);
  };

  // Format / Beautify JSON
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      setRawJsonText(JSON.stringify(parsed, null, 2));
      setJsonParseError(null);
      showToast('✅ JSON 格式化成功');
    } catch (err: any) {
      setJsonParseError(err.message || '无效的 JSON 格式');
      showToast('❌ JSON 语法错误，请检查');
    }
  };

  // Apply JSON changes back to server state
  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      setJsonParseError(null);

      if (jsonScope === 'full') {
        if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
          throw new Error('配置顶层必须包含 "mcpServers" 对象');
        }
        const newServers: McpServerConfig[] = Object.entries(parsed.mcpServers).map(([id, cfg]: [string, any]) => {
          const existing = servers.find(s => s.id === id);
          const isSse = cfg.transport === 'sse' || !!cfg.url;
          return {
            id,
            name: existing ? existing.name : `${id} MCP 服务`,
            description: existing ? existing.description : '由 JSON 导入的 MCP 服务端',
            enabled: existing ? existing.enabled : true,
            transport: isSse ? 'sse' : 'stdio',
            command: cfg.command || (isSse ? undefined : 'npx'),
            args: Array.isArray(cfg.args) ? cfg.args : [],
            cwd: cfg.cwd || './',
            env: cfg.env || {},
            url: cfg.url || '',
            headers: cfg.headers || {},
            status: (existing ? existing.status : 'idle') as ('running' | 'idle' | 'error' | 'disabled'),
            toolsCount: existing ? existing.toolsCount : 2,
            resourcesCount: existing ? existing.resourcesCount : 0,
            promptsCount: existing ? existing.promptsCount : 0,
            autoApprove: existing ? existing.autoApprove : false
          };
        });

        if (newServers.length === 0) {
          throw new Error('mcpServers 中未包含任何有效服务定义');
        }

        saveServersToStorage(newServers);
        showToast(`✅ 已解析并同步 ${newServers.length} 个 MCP 服务配置！`);
      } else {
        // Single server JSON
        if (!selectedServer) return;
        const isSse = parsed.transport === 'sse' || !!parsed.url;
        const updated = servers.map(s => {
          if (s.id === selectedServer.id) {
            return {
              ...s,
              transport: (isSse ? 'sse' : 'stdio') as McpTransportType,
              command: parsed.command || (isSse ? undefined : 'npx'),
              args: Array.isArray(parsed.args) ? parsed.args : s.args,
              cwd: parsed.cwd || s.cwd,
              env: parsed.env || s.env,
              url: parsed.url || s.url,
              headers: parsed.headers || s.headers
            };
          }
          return s;
        });
        saveServersToStorage(updated);
        showToast(`✅ 已更新服务 [${selectedServer.id}] 配置！`);
      }
    } catch (err: any) {
      setJsonParseError(err.message || 'JSON 解析失败');
      showToast(`❌ 保存失败: ${err.message}`);
    }
  };

  // Copy JSON to clipboard
  const handleCopyJson = () => {
    navigator.clipboard.writeText(rawJsonText);
    showToast('📋 配置已复制到剪贴板！');
  };

  // Download config file
  const handleDownloadJson = () => {
    const filename = jsonScope === 'full' ? 'claude_desktop_config.json' : `${selectedServer?.id || 'mcp'}_config.json`;
    const blob = new Blob([rawJsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已下载 ${filename}`);
  };

  // Import JSON file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawJsonText(content);
        try {
          JSON.parse(content);
          setJsonParseError(null);
          showToast(`已读取文件：${file.name}，请点击“保存并生效”应用！`);
        } catch (err: any) {
          setJsonParseError(err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Execute Tool in Playground
  const handleExecuteTool = async () => {
    const activeTool = serverTools.find(t => t.name === selectedToolName);
    if (!activeTool) return;

    let parsedArgs: Record<string, any> = {};
    try {
      parsedArgs = JSON.parse(toolInputJson);
    } catch (err: any) {
      setToolExecutionResult({
        status: 'error',
        error: `参数 JSON 解析错误: ${err.message}`
      });
      return;
    }

    setToolExecutionResult({ status: 'running' });
    const startTime = Date.now();

    try {
      // Simulate tool response based on tool type
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 80) + 40));
      const latencyMs = Date.now() - startTime;

      let mockOutput: any = {};
      if (activeTool.name === 'read_file') {
        mockOutput = {
          content: `# 本地金融业务准入红线准则\n\n1. 客户信用评级低于 BB 级需人工加签；\n2. 单笔信贷授信上限 50,000,000 元；\n3. 质押率上限 65%，每周市值重估。`,
          metadata: { path: parsedArgs.path || 'docs/report.md', sizeBytes: 2048, encoding: 'utf-8' }
        };
      } else if (activeTool.name === 'write_file') {
        mockOutput = {
          success: true,
          writtenBytes: (parsedArgs.content || '').length,
          path: parsedArgs.path || 'reports/output.txt',
          timestamp: new Date().toISOString()
        };
      } else if (activeTool.name === 'list_directory') {
        mockOutput = {
          entries: [
            { name: 'financial_ledger.db', type: 'file', size: 4194304 },
            { name: 'audit_policy_2026.docx', type: 'file', size: 1048576 },
            { name: 'contracts', type: 'directory', itemsCount: 14 }
          ],
          total: 3
        };
      } else if (activeTool.name === 'read_query') {
        mockOutput = {
          columns: ['client_id', 'name', 'credit_rating', 'balance_cny'],
          rows: [
            ['C10081', '北京华融信托', 'AAA', 12500000],
            ['C10082', '上海国泰租赁', 'AA+', 8200000],
            ['C10083', '深圳前海金控', 'AAA', 23400000]
          ],
          rowCount: 3,
          durationMs: latencyMs
        };
      } else if (activeTool.name === 'describe_table') {
        mockOutput = {
          table: parsedArgs.tableName || 'client_ledger',
          schema: [
            { field: 'id', type: 'INTEGER PRIMARY KEY' },
            { field: 'client_name', type: 'VARCHAR(64) NOT NULL' },
            { field: 'credit_score', type: 'INT' },
            { field: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
          ]
        };
      } else if (activeTool.name === 'fetch_url') {
        mockOutput = {
          url: parsedArgs.url || 'https://news.ycombinator.com',
          status: 200,
          title: 'Hacker News · Front Page',
          markdown: `### Top Stories\n\n1. [Anthropic announces Model Context Protocol specification](https://anthropic.com)\n2. [Local AI business workflows with low latency CPU execution](https://remix.local)`
        };
      } else if (activeTool.name === 'query_credit_score') {
        mockOutput = {
          entityCode: parsedArgs.entityCode || '91110000100005234X',
          riskLevel: 'LOW_RISK',
          creditScore: 842,
          modelTier: parsedArgs.modelTier || 'standard',
          decision: 'APPROVED',
          recommendation: '授信额度上限建议 8,000 万元，建议优惠利率 3.25%'
        };
      } else if (activeTool.name === 'get_realtime_ticker') {
        mockOutput = {
          symbol: parsedArgs.symbol || '600519.SH',
          name: '贵州茅台',
          lastPrice: 1688.50,
          changePercent: '+1.42%',
          volume: 2451000,
          marketState: 'TRADING',
          timestamp: new Date().toLocaleTimeString()
        };
      } else {
        mockOutput = {
          executedTool: activeTool.name,
          serverId: activeTool.serverId,
          receivedArguments: parsedArgs,
          result: 'Tool executed successfully within sandbox protocol environment',
          timestamp: new Date().toISOString()
        };
      }

      setToolExecutionResult({
        status: 'success',
        latencyMs,
        output: mockOutput
      });
      showToast(`✅ 工具 [${activeTool.name}] 执行完成 (${latencyMs}ms)`);
    } catch (err: any) {
      setToolExecutionResult({
        status: 'error',
        error: err.message || '调用超时或服务未响应'
      });
      showToast(`❌ 工具调用失败: ${err.message}`);
    }
  };

  // Add environment variable key-value
  const handleAddEnvVar = () => {
    if (!selectedServer) return;
    const currentEnv = selectedServer.env || {};
    const newKey = `ENV_VAR_${Object.keys(currentEnv).length + 1}`;
    handleUpdateServer({
      env: {
        ...currentEnv,
        [newKey]: ''
      }
    });
  };

  // Remove env var
  const handleRemoveEnvVar = (key: string) => {
    if (!selectedServer || !selectedServer.env) return;
    const nextEnv = { ...selectedServer.env };
    delete nextEnv[key];
    handleUpdateServer({ env: nextEnv });
  };

  // Update env var key
  const handleUpdateEnvKey = (oldKey: string, newKey: string) => {
    if (!selectedServer || !selectedServer.env || oldKey === newKey) return;
    const val = selectedServer.env[oldKey];
    const nextEnv = { ...selectedServer.env };
    delete nextEnv[oldKey];
    nextEnv[newKey] = val;
    handleUpdateServer({ env: nextEnv });
  };

  // Update env var value
  const handleUpdateEnvVal = (key: string, val: string) => {
    if (!selectedServer) return;
    handleUpdateServer({
      env: {
        ...(selectedServer.env || {}),
        [key]: val
      }
    });
  };

  // Add command argument
  const handleAddArg = () => {
    if (!selectedServer) return;
    const currentArgs = selectedServer.args || [];
    handleUpdateServer({
      args: [...currentArgs, '']
    });
  };

  // Remove command argument
  const handleRemoveArg = (index: number) => {
    if (!selectedServer || !selectedServer.args) return;
    const nextArgs = selectedServer.args.filter((_, i) => i !== index);
    handleUpdateServer({ args: nextArgs });
  };

  // Update command argument
  const handleUpdateArg = (index: number, val: string) => {
    if (!selectedServer || !selectedServer.args) return;
    const nextArgs = [...selectedServer.args];
    nextArgs[index] = val;
    handleUpdateServer({ args: nextArgs });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-text">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 border border-purple-500/50 shadow-2xl text-purple-300 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles size={14} className="text-purple-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header / Stats Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 p-[1px] shadow-md shadow-purple-600/20 shrink-0">
            <div className="w-full h-full rounded-[11px] bg-slate-950 flex items-center justify-center">
              <Server size={18} className="text-purple-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
                <span>MCP 协议与工具链编辑器</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Model Context Protocol
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Claude Desktop / Anthropic 规范兼容</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-medium">
                {servers.filter(s => s.enabled && s.status === 'running').length} 在线
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">共 {servers.length} 服务 / {tools.length} 工具</span>
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add Server Button */}
          <button
            onClick={() => setShowPresetModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm shadow-purple-600/30 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          >
            <Plus size={14} />
            <span>新建 MCP 服务</span>
          </button>

          {/* Ping All Button */}
          <button
            onClick={handlePingAll}
            disabled={isPingingAll}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/80 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="测试所有已启用 MCP 服务的连通性与延迟"
          >
            <RefreshCw size={13} className={isPingingAll ? 'animate-spin text-purple-400' : 'text-slate-400'} />
            <span className="hidden sm:inline">全网连通性检测</span>
          </button>

          {/* Return to workbench (if provided) */}
          {onBackToWorkbench && (
            <button
              onClick={onBackToWorkbench}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            >
              <span>返回设置</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Workspace: Left Sidebar + Right Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ================= LEFT COLUMN: Server List (300px) ================= */}
        <aside className="w-80 border-r border-slate-800/90 bg-slate-950/80 flex flex-col shrink-0">
          
          {/* Search & Stats Bar */}
          <div className="p-3 border-b border-slate-800/80 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索服务名称、命令或ID..."
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60 transition"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>已注册服务 ({filteredServers.length})</span>
              <span className="font-mono text-[10px] text-purple-400">
                stdio & sse 双协议
              </span>
            </div>
          </div>

          {/* Servers Scroll Area */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredServers.map(server => {
              const isSelected = server.id === selectedServerId;
              const serverToolsCount = tools.filter(t => t.serverId === server.id).length;
              return (
                <div
                  key={server.id}
                  onClick={() => setSelectedServerId(server.id)}
                  className={`group relative p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-950/30 border-purple-500/60 text-slate-100 shadow-md shadow-purple-950/30 ring-1 ring-purple-500/20'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {/* Top row: Status dot, Name, Transport badge */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Status indicator dot */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        !server.enabled ? 'bg-slate-600' :
                        server.status === 'running' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' :
                        server.status === 'error' ? 'bg-rose-400 shadow-[0_0_8px_#f43f5e]' :
                        'bg-amber-400'
                      }`} />
                      <span className="font-semibold text-xs text-slate-200 truncate">
                        {server.name}
                      </span>
                    </div>

                    {/* Transport badge */}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                      server.transport === 'stdio'
                        ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50'
                        : 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                    }`}>
                      {server.transport}
                    </span>
                  </div>

                  {/* Description snippet */}
                  <p className="text-[11px] text-slate-400 line-clamp-1 mb-2">
                    {server.description || '暂无描述'}
                  </p>

                  {/* Bottom row: Tools badge, Ping latency, Quick actions */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                        {serverToolsCount} 工具
                      </span>
                      {server.lastPingMs && server.enabled && (
                        <span className="font-mono text-emerald-400 flex items-center gap-0.5">
                          <Zap size={9} />
                          {server.lastPingMs}ms
                        </span>
                      )}
                    </div>

                    {/* Hover actions */}
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                      {/* Enable/Disable switch */}
                      <button
                        onClick={(e) => handleToggleEnable(server.id, e)}
                        className={`px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer ${
                          server.enabled 
                            ? 'text-emerald-300 hover:bg-emerald-500/20' 
                            : 'text-slate-500 hover:bg-slate-800'
                        }`}
                        title={server.enabled ? '点击禁用该服务' : '点击启用该服务'}
                      >
                        {server.enabled ? '已启用' : '已停用'}
                      </button>

                      {/* Ping button */}
                      <button
                        onClick={(e) => handlePingServer(server, e)}
                        disabled={pingingServerId === server.id}
                        className="p-1 rounded text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition cursor-pointer"
                        title="测试连通性"
                      >
                        <RefreshCw size={11} className={pingingServerId === server.id ? 'animate-spin text-purple-400' : ''} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={(e) => handleDeleteServer(server.id, e)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                        title="删除服务"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredServers.length === 0 && (
              <div className="text-center py-10 px-4 text-slate-500">
                <Server size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">未找到匹配的 MCP 服务</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-[11px] text-purple-400 hover:underline cursor-pointer"
                >
                  清空筛选条件
                </button>
              </div>
            )}
          </div>

          {/* Quick preset trigger in sidebar footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/60">
            <button
              onClick={() => setShowPresetModal(true)}
              className="w-full py-2 rounded-xl text-xs font-medium bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 flex items-center justify-center gap-1.5 transition cursor-pointer hover:border-purple-500/40"
            >
              <Sparkles size={13} className="text-purple-400" />
              <span>从常用模版库快速导入...</span>
            </button>
          </div>
        </aside>

        {/* ================= RIGHT COLUMN: Server Workspace ================= */}
        {selectedServer ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/40">
            
            {/* Server Detail Navigation Sub-tabs */}
            <div className="px-5 pt-3 pb-2 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="font-mono text-purple-400">[{selectedServer.id}]</span>
                  <span>{selectedServer.name}</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                  selectedServer.enabled 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {selectedServer.enabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>

              {/* View Switch Tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'form'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders size={12} />
                  <span>可视化配置</span>
                </button>

                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'json'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode size={12} />
                  <span>原生 JSON</span>
                </button>

                <button
                  onClick={() => setActiveTab('tools')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'tools'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wrench size={12} />
                  <span>工具与测试台</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-black/40">
                    {serverTools.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('resources')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'resources'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Database size={12} />
                  <span>数据源与提示词</span>
                </button>
              </div>
            </div>

            {/* Sub-tab Body Content */}
            <div className="flex-1 overflow-y-auto p-5 text-xs">
              
              {/* ================= 1. 可视化表单配置 (Visual Form) ================= */}
              {activeTab === 'form' && (
                <div className="max-w-3xl space-y-5">
                  
                  {/* Basic Metadata Card */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-4">
                    <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Server size={14} className="text-purple-400" />
                      <span>基础元数据与服务属性</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          服务标识 ID (Key, 必须唯一)
                        </label>
                        <input
                          type="text"
                          value={selectedServer.id}
                          disabled
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 font-mono text-xs cursor-not-allowed"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          映射至 Claude Desktop 配置文件中的 server 键名
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          显示名称 (Friendly Name)
                        </label>
                        <input
                          type="text"
                          value={selectedServer.name}
                          onChange={e => handleUpdateServer({ name: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-medium text-xs focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        服务功能描述 (Description)
                      </label>
                      <input
                        type="text"
                        value={selectedServer.description}
                        onChange={e => handleUpdateServer({ description: e.target.value })}
                        placeholder="描述该服务提供的工具范围，例如：本地文件检索、数据库报表查询等"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center gap-6 pt-2 border-t border-slate-800/80">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedServer.enabled}
                          onChange={e => handleToggleEnable(selectedServer.id)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-950 border-slate-700"
                        />
                        <span className="text-xs text-slate-300 font-medium">启用此 MCP 服务</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedServer.autoApprove ?? false}
                          onChange={e => handleUpdateServer({ autoApprove: e.target.checked })}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-950 border-slate-700"
                        />
                        <span className="text-xs text-slate-300 font-medium">
                          自动授权 (无需人工每次确认工具调用)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Transport Protocol Selector Card */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Layers size={14} className="text-purple-400" />
                        <span>传输协议与执行通道 (Transport Protocol)</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 font-mono">
                        标准 MCP 规范
                      </span>
                    </div>

                    {/* Radio Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => handleUpdateServer({ transport: 'stdio' })}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          selectedServer.transport === 'stdio'
                            ? 'bg-cyan-950/30 border-cyan-500/60 text-slate-100 shadow-sm'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          selectedServer.transport === 'stdio' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <Terminal size={16} />
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-slate-200">stdio 命令行子进程</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            本地执行 npx, uvx, python 或 node 进程，通过标准输入输出 (stdin/stdout) 交互
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={() => handleUpdateServer({ transport: 'sse' })}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          selectedServer.transport === 'sse'
                            ? 'bg-purple-950/30 border-purple-500/60 text-slate-100 shadow-sm'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          selectedServer.transport === 'sse' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <Globe size={16} />
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-slate-200">SSE 远程微服务流</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            HTTP Server-Sent Events 连接远程内网或云端 API 网关
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* stdio Specific Configurations */}
                    {selectedServer.transport === 'stdio' && (
                      <div className="space-y-4 pt-2 border-t border-slate-800/80">
                        {/* Command */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            可执行命令 (Executable Command)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={selectedServer.command || 'npx'}
                              onChange={e => handleUpdateServer({ command: e.target.value })}
                              placeholder="npx / uvx / python3 / node / docker"
                              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-purple-500"
                            />
                            {/* Quick fill chips */}
                            <div className="hidden sm:flex items-center gap-1.5">
                              {['npx', 'uvx', 'python3', 'node'].map(cmd => (
                                <button
                                  key={cmd}
                                  type="button"
                                  onClick={() => handleUpdateServer({ command: cmd })}
                                  className={`px-2 py-1 rounded text-[11px] font-mono border transition cursor-pointer ${
                                    selectedServer.command === cmd
                                      ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                  }`}
                                >
                                  {cmd}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Arguments (args) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-400">
                              命令行参数列表 (Arguments - `args`)
                            </label>
                            <button
                              type="button"
                              onClick={handleAddArg}
                              className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <Plus size={12} />
                              <span>添加参数</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(selectedServer.args || []).map((arg, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-500 w-6 text-right">
                                  #{idx}
                                </span>
                                <input
                                  type="text"
                                  value={arg}
                                  onChange={e => handleUpdateArg(idx, e.target.value)}
                                  placeholder={`参数 ${idx + 1}`}
                                  className="flex-1 px-3 py-1 rounded-lg bg-slate-950 border border-slate-750 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveArg(idx)}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                  title="移除参数"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}

                            {(selectedServer.args || []).length === 0 && (
                              <p className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
                                暂无参数配置，点击右上角「添加参数」
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Working Directory (cwd) */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            工作运行目录 (Working Directory - `cwd`)
                          </label>
                          <input
                            type="text"
                            value={selectedServer.cwd || './'}
                            onChange={e => handleUpdateServer({ cwd: e.target.value })}
                            placeholder="./"
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        {/* Environment Variables (env) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-400">
                              环境变量 (Environment Variables - `env`)
                            </label>
                            <button
                              type="button"
                              onClick={handleAddEnvVar}
                              className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <Plus size={12} />
                              <span>添加变量</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            {Object.entries(selectedServer.env || {}).map(([key, val], idx) => {
                              const isSecretRevealed = !!revealedSecrets[`${selectedServer.id}_${key}`];
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={key}
                                    onChange={e => handleUpdateEnvKey(key, e.target.value)}
                                    placeholder="KEY_NAME"
                                    className="w-1/3 px-3 py-1 rounded-lg bg-slate-950 border border-slate-750 text-amber-300 font-mono text-xs focus:outline-none focus:border-purple-500"
                                  />
                                  <div className="relative flex-1">
                                    <input
                                      type={isSecretRevealed ? 'text' : 'password'}
                                      value={val}
                                      onChange={e => handleUpdateEnvVal(key, e.target.value)}
                                      placeholder="Value..."
                                      className="w-full pl-3 pr-8 py-1 rounded-lg bg-slate-950 border border-slate-750 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setRevealedSecrets(prev => ({
                                        ...prev,
                                        [`${selectedServer.id}_${key}`]: !isSecretRevealed
                                      }))}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                                      title={isSecretRevealed ? '隐藏' : '显示'}
                                    >
                                      {isSecretRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEnvVar(key)}
                                    className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                    title="删除环境变量"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              );
                            })}

                            {Object.keys(selectedServer.env || {}).length === 0 && (
                              <p className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
                                未配置特定环境变量（如 API Token / 运行环境参数）
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* sse Specific Configurations */}
                    {selectedServer.transport === 'sse' && (
                      <div className="space-y-4 pt-2 border-t border-slate-800/80">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            SSE 远程服务端 URL (Endpoint URL)
                          </label>
                          <input
                            type="text"
                            value={selectedServer.url || ''}
                            onChange={e => handleUpdateServer({ url: e.target.value })}
                            placeholder="https://mcp-gateway.corp.local/sse/v1"
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            请求头 (Headers Authorization)
                          </label>
                          <div className="space-y-2">
                            {Object.entries(selectedServer.headers || {}).map(([hKey, hVal], idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={hKey}
                                  onChange={e => {
                                    const next = { ...(selectedServer.headers || {}) };
                                    delete next[hKey];
                                    next[e.target.value] = hVal;
                                    handleUpdateServer({ headers: next });
                                  }}
                                  placeholder="Header Name"
                                  className="w-1/3 px-3 py-1 rounded-lg bg-slate-950 border border-slate-750 text-slate-300 font-mono text-xs"
                                />
                                <input
                                  type="text"
                                  value={hVal}
                                  onChange={e => {
                                    handleUpdateServer({
                                      headers: {
                                        ...(selectedServer.headers || {}),
                                        [hKey]: e.target.value
                                      }
                                    });
                                  }}
                                  placeholder="Header Value"
                                  className="flex-1 px-3 py-1 rounded-lg bg-slate-950 border border-slate-750 text-slate-300 font-mono text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...(selectedServer.headers || {}) };
                                    delete next[hKey];
                                    handleUpdateServer({ headers: next });
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateServer({
                                  headers: {
                                    ...(selectedServer.headers || {}),
                                    Authorization: 'Bearer '
                                  }
                                });
                              }}
                              className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <Plus size={12} />
                              <span>添加自定义 Header</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions & Connection Status Toolbar */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handlePingServer(selectedServer)}
                        disabled={pingingServerId === selectedServer.id}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={pingingServerId === selectedServer.id ? 'animate-spin' : ''} />
                        <span>测试连通性 (Ping)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCloneServer(selectedServer)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Copy size={13} />
                        <span>克隆此服务</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteServer(selectedServer.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>删除服务</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">状态：</span>
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-950 border border-slate-800 text-slate-200">
                        {selectedServer.status} {selectedServer.lastPingMs ? `(${selectedServer.lastPingMs}ms)` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 2. 原生 JSON 代码编辑 (Raw JSON) ================= */}
              {activeTab === 'json' && (
                <div className="h-full flex flex-col space-y-3">
                  
                  {/* JSON Controls Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      {/* Scope Toggle: Full config vs current server */}
                      <button
                        onClick={() => setJsonScope('full')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                          jsonScope === 'full'
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        全局配置 (claude_desktop_config.json)
                      </button>

                      <button
                        onClick={() => setJsonScope('single')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                          jsonScope === 'single'
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        当前服务 [{selectedServer.id}]
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Format JSON */}
                      <button
                        onClick={handleFormatJson}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                        title="格式化并对齐 JSON 缩进"
                      >
                        <Code2 size={13} />
                        <span>格式化</span>
                      </button>

                      {/* Copy JSON */}
                      <button
                        onClick={handleCopyJson}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={13} />
                        <span>复制</span>
                      </button>

                      {/* Download JSON */}
                      <button
                        onClick={handleDownloadJson}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Download size={13} />
                        <span>导出文件</span>
                      </button>

                      {/* Upload JSON */}
                      <label className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer">
                        <Upload size={13} />
                        <span>导入 JSON</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Apply button */}
                      <button
                        onClick={handleApplyJson}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 cursor-pointer"
                      >
                        <Check size={13} />
                        <span>保存并生效</span>
                      </button>
                    </div>
                  </div>

                  {/* Syntax Error Notice */}
                  {jsonParseError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0 text-rose-400" />
                      <span className="font-mono text-xs">{jsonParseError}</span>
                    </div>
                  )}

                  {/* Code Textarea Editor */}
                  <div className="flex-1 relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
                    <textarea
                      value={rawJsonText}
                      onChange={e => {
                        setRawJsonText(e.target.value);
                        try {
                          JSON.parse(e.target.value);
                          setJsonParseError(null);
                        } catch (err: any) {
                          setJsonParseError(err.message);
                        }
                      }}
                      className="w-full h-full p-4 bg-transparent text-emerald-400 font-mono text-xs resize-none focus:outline-none selection:bg-purple-900 selection:text-white leading-relaxed"
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}

              {/* ================= 3. 工具检查与调试演练场 (Playground) ================= */}
              {activeTab === 'tools' && (
                <div className="h-full flex flex-col lg:flex-row gap-4 overflow-hidden">
                  
                  {/* Left: Tools List */}
                  <div className="w-full lg:w-72 border border-slate-800 rounded-xl bg-slate-950/70 flex flex-col shrink-0 overflow-hidden">
                    <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                        <Wrench size={13} className="text-purple-400" />
                        <span>已暴露工具 ({serverTools.length})</span>
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                      {serverTools.map(t => {
                        const isToolSelected = t.name === selectedToolName;
                        return (
                          <div
                            key={t.name}
                            onClick={() => {
                              setSelectedToolName(t.name);
                              setToolInputJson(JSON.stringify(t.exampleInput || {}, null, 2));
                              setToolExecutionResult({ status: 'idle' });
                            }}
                            className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                              isToolSelected
                                ? 'bg-purple-950/40 border-purple-500/60 text-slate-100 shadow-sm'
                                : 'bg-slate-900/60 border-slate-850 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-semibold text-xs text-purple-300">
                                {t.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {t.parameters.length} 参数
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2">
                              {t.description}
                            </p>
                          </div>
                        );
                      })}

                      {serverTools.length === 0 && (
                        <div className="p-6 text-center text-slate-500">
                          <Wrench size={24} className="mx-auto mb-2 opacity-40" />
                          <p className="text-xs">该服务暂无暴露的工具注册</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Selected Tool Playground */}
                  {selectedToolName ? (
                    <div className="flex-1 border border-slate-800 rounded-xl bg-slate-950/70 flex flex-col overflow-hidden">
                      {(() => {
                        const curTool = serverTools.find(t => t.name === selectedToolName);
                        if (!curTool) return null;
                        return (
                          <>
                            {/* Tool Detail Header */}
                            <div className="p-4 border-b border-slate-800 bg-slate-900/80">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                                  <span>{curTool.name}</span>
                                  <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                                    MCP Callable Tool
                                  </span>
                                </h3>

                                <button
                                  onClick={handleExecuteTool}
                                  disabled={toolExecutionResult.status === 'running'}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                  <Play size={13} className={toolExecutionResult.status === 'running' ? 'animate-spin' : ''} />
                                  <span>{toolExecutionResult.status === 'running' ? '正在执行...' : '执行工具测试'}</span>
                                </button>
                              </div>

                              <p className="text-xs text-slate-400">
                                {curTool.description}
                              </p>

                              {/* Parameters Schema Summary */}
                              {curTool.parameters.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-800/80">
                                  <p className="text-[11px] font-semibold text-slate-300 mb-1.5">
                                    参数模式规范 (Input Parameters):
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {curTool.parameters.map(p => (
                                      <div key={p.name} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono text-purple-300 font-semibold">{p.name}</span>
                                          <span className="text-[10px] font-mono text-amber-400">
                                            {p.type} {p.required ? '(必须)' : '(可选)'}
                                          </span>
                                        </div>
                                        <p className="text-slate-400 text-[10px] mt-0.5">{p.description}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Split: Parameters Input & Output Console */}
                            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                              
                              {/* Left Input */}
                              <div className="flex-1 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-semibold text-slate-300">
                                    调用入参 (JSON Payload)
                                  </span>
                                  <button
                                    onClick={() => setToolInputJson(JSON.stringify(curTool.exampleInput || {}, null, 2))}
                                    className="text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer"
                                  >
                                    重置为样例入参
                                  </button>
                                </div>

                                <textarea
                                  value={toolInputJson}
                                  onChange={e => setToolInputJson(e.target.value)}
                                  className="flex-1 w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 font-mono text-xs resize-none focus:outline-none focus:border-purple-500/60"
                                  spellCheck={false}
                                />
                              </div>

                              {/* Right Output Console */}
                              <div className="flex-1 flex flex-col p-3 bg-slate-950">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                                    <Terminal size={12} className="text-purple-400" />
                                    <span>执行结果 (Live Output)</span>
                                  </span>

                                  {toolExecutionResult.latencyMs && (
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                      {toolExecutionResult.latencyMs}ms 耗时
                                    </span>
                                  )}
                                </div>

                                <div className="flex-1 p-3 bg-slate-900/90 border border-slate-800 rounded-lg overflow-y-auto font-mono text-xs">
                                  {toolExecutionResult.status === 'idle' && (
                                    <div className="h-full flex items-center justify-center text-slate-500 italic">
                                      点击右上角「执行工具测试」发起实时 MCP 调试
                                    </div>
                                  )}

                                  {toolExecutionResult.status === 'running' && (
                                    <div className="h-full flex items-center justify-center text-purple-300 gap-2">
                                      <RefreshCw size={14} className="animate-spin text-purple-400" />
                                      <span>正在通过 MCP 协议握手调用工具...</span>
                                    </div>
                                  )}

                                  {toolExecutionResult.status === 'success' && (
                                    <pre className="text-emerald-400 whitespace-pre-wrap">
                                      {JSON.stringify(toolExecutionResult.output, null, 2)}
                                    </pre>
                                  )}

                                  {toolExecutionResult.status === 'error' && (
                                    <div className="text-rose-400 whitespace-pre-wrap">
                                      ❌ 发生错误：{toolExecutionResult.error}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center border border-slate-800 rounded-xl bg-slate-950/40 text-slate-500">
                      请从左侧选择一个 MCP 工具进行测试
                    </div>
                  )}
                </div>
              )}

              {/* ================= 4. 资源与提示词 (Resources & Prompts) ================= */}
              {activeTab === 'resources' && (
                <div className="space-y-5 max-w-3xl">
                  
                  {/* Resources Section */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Folder size={14} className="text-purple-400" />
                        <span>MCP 声明资源清单 (Resources)</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 font-mono">
                        只读 URI 数据源
                      </span>
                    </div>

                    <div className="space-y-2">
                      {serverResources.map(res => (
                        <div key={res.uri} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-200">{res.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                {res.mimeType || 'text/plain'}
                              </span>
                            </div>
                            <p className="font-mono text-[10px] text-purple-300">{res.uri}</p>
                            {res.description && (
                              <p className="text-[11px] text-slate-400">{res.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(res.uri);
                              showToast(`已复制 URI: ${res.uri}`);
                            }}
                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                            title="复制 URI"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      ))}

                      {serverResources.length === 0 && (
                        <p className="text-[11px] text-slate-500 italic p-3 bg-slate-950/40 rounded-lg border border-dashed border-slate-800 text-center">
                          该 MCP 服务未注册外部静态资源 (Resources)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Prompts Section */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Sparkles size={14} className="text-purple-400" />
                        <span>预设业务提示词模版 (Prompts)</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 font-mono">
                        服务端托管模版
                      </span>
                    </div>

                    <div className="space-y-2">
                      {serverPrompts.map(pr => (
                        <div key={pr.name} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-xs text-amber-300">
                              {pr.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {(pr.arguments || []).length} 个输入插槽
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300">{pr.description}</p>
                        </div>
                      ))}

                      {serverPrompts.length === 0 && (
                        <p className="text-[11px] text-slate-500 italic p-3 bg-slate-950/40 rounded-lg border border-dashed border-slate-800 text-center">
                          该 MCP 服务未包含预注册的提示词工作流 (Prompts)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            暂无选中的 MCP 服务
          </div>
        )}
      </div>

      {/* ================= PRESET MODAL: 常用模版快速导入 ================= */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">选择 MCP 预设模版或新建空白服务</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">一键生成经过官方验证的标准 Model Context Protocol 服务端</p>
                </div>
              </div>
              <button
                onClick={() => setShowPresetModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Presets Grid */}
            <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MCP_PRESET_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => handleAddPreset(tmpl)}
                  className="p-3.5 rounded-xl border border-slate-850 bg-slate-950/70 hover:bg-slate-850 hover:border-purple-500/50 transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-xs text-slate-100 group-hover:text-purple-300 transition">
                        {tmpl.name}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-300">
                        {tmpl.transport}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {tmpl.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-purple-400">
                    <span className="font-mono">
                      {tmpl.command ? `${tmpl.command} ${tmpl.args?.[0] || ''}` : tmpl.url}
                    </span>
                    <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      添加 <ArrowRight size={10} />
                    </span>
                  </div>
                </div>
              ))}

              {/* Blank Custom Option */}
              <div
                onClick={() => handleAddPreset({
                  name: '自定义空白 MCP 服务',
                  description: '从零构建全新的标准 MCP 工具或进程服务',
                  transport: 'stdio',
                  command: 'node',
                  args: ['server.js'],
                  env: {}
                })}
                className="p-3.5 rounded-xl border border-dashed border-slate-700 hover:border-purple-500 bg-slate-950/40 hover:bg-slate-900 transition cursor-pointer flex flex-col items-center justify-center text-center group"
              >
                <Plus size={20} className="text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-xs text-slate-200">新建空白服务</span>
                <span className="text-[10px] text-slate-500 mt-0.5">从零自定义参数与传输协议</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
