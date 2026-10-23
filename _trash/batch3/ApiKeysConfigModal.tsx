import React, { useState } from 'react';
import { 
  X, Key, Check, Copy, ExternalLink, ShieldCheck, 
  Sparkles, Terminal, HardDrive, CheckCircle2, AlertCircle,
  HelpCircle, Sliders, ArrowRight, Search, Plus, Eye, Brain, Zap, Trash2,
  Wifi, RefreshCw, Smartphone, Laptop
} from 'lucide-react';
import { ModelInfo, ModelCapability, ModelProviderType } from '../types';
import { getStoredModels, saveCustomModel, removeCustomModel } from '../data/models';
import { ModelItemRow } from './ModelItemRow';

interface ApiKeysConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProvider: ModelProviderType;
  currentModel?: string;
  onSelectProvider: (provider: ModelProviderType, model?: string) => void;
  engineData: any;
}

export const ApiKeysConfigModal: React.FC<ApiKeysConfigModalProps> = ({
  isOpen,
  onClose,
  currentProvider,
  currentModel,
  onSelectProvider,
  engineData
}) => {
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [activeTab, setActiveTab] = useState<ModelProviderType>(currentProvider || 'deepseek');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }> >({});

  // Ollama Dedicated Hotspot & Local Configuration State
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(() => {
    return localStorage.getItem('finai_ollama_endpoint') || engineData?.ollamaEndpoint || 'http://172.20.10.2:11434';
  });
  const [ollamaDirectModels, setOllamaDirectModels] = useState<string[]>([]);
  const [isCheckingDirect, setIsCheckingDirect] = useState(false);
  const [directCheckResult, setDirectCheckResult] = useState<{
    checked: boolean;
    success: boolean;
    message: string;
    latencyMs?: number;
    corsIssue?: boolean;
  } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Model Management State
  const [modelsList, setModelsList] = useState<ModelInfo[]>(getStoredModels());
  const [modelSearch, setModelSearch] = useState('');
  const [showAddCustomModel, setShowAddCustomModel] = useState(false);

  // New Custom Model Form State
  const [customModelId, setCustomModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [customContext, setCustomContext] = useState('1000K');
  const [customCaps, setCustomCaps] = useState<ModelCapability[]>(['LLM', 'CHAT']);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveOllamaEndpoint = (targetEndpoint: string) => {
    let clean = targetEndpoint.trim().replace(/\/$/, '');
    if (clean.includes('0.0.0.0')) {
      clean = clean.replace('0.0.0.0', '172.20.10.2');
    }
    setOllamaEndpoint(clean);
    localStorage.setItem('finai_ollama_endpoint', clean);
    showToast(`✅ 已更新 Ollama 端点为: ${clean}`);
  };

  const handleCopyCommand = (cmdText: string, keyName: string) => {
    navigator.clipboard.writeText(cmdText);
    setCopiedCmd(keyName);
    showToast('📋 已复制启动命令到剪贴板！');
    setTimeout(() => setCopiedCmd(null), 3000);
  };

  // 浏览器前端直连本地 Ollama 探针
  const handleDirectProbeOllama = async () => {
    setIsCheckingDirect(true);
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch(`${ollamaEndpoint}/api/tags`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      if (resp.ok) {
        const data = await resp.json();
        const models: string[] = (data.models || []).map((m: any) => m.name);
        setOllamaDirectModels(models);
        setDirectCheckResult({
          checked: true,
          success: true,
          message: `直连握手成功 (${latencyMs}ms)！已发现 ${models.length} 个本地模型。`,
          latencyMs
        });
        showToast(`🎉 成功直连本地 Ollama (${ollamaEndpoint})，发现 ${models.length} 个模型！`);
      } else {
        setDirectCheckResult({
          checked: true,
          success: false,
          message: `本地服务返回 HTTP ${resp.status}`,
          latencyMs
        });
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isFailedFetch = err?.name === 'TypeError' || String(err?.message || '').includes('Failed to fetch');
      setDirectCheckResult({
        checked: true,
        success: false,
        message: isFailedFetch 
          ? `浏览器直连受限：Ollama 端口可能未开启跨域。请在本地终端配置 OLLAMA_ORIGINS="*" 启动。` 
          : `连接异常: ${err?.message}`,
        corsIssue: isFailedFetch,
        latencyMs
      });
      showToast(`⚠️ 浏览器直连未成功，请检查 OLLAMA_ORIGINS="*" 是否配置。`);
    } finally {
      setIsCheckingDirect(false);
    }
  };

  const handleTestConnection = async (providerId: string, modelName: string) => {
    setIsTesting(true);
    try {
      const epToUse = providerId === 'ollama' ? ollamaEndpoint : (engineData?.ollamaEndpoint || 'http://172.20.10.2:11434');
      const resp = await fetch('/api/provider/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          model: modelName,
          endpoint: epToUse
        })
      });
      const data = await resp.json();
      setTestResult(prev => ({
        ...prev,
        [providerId]: {
          success: data.success,
          message: data.message,
          latencyMs: data.latencyMs
        }
      }));
      if (data.success) {
        showToast(`✅ ${data.message}`);
      } else {
        showToast(`⚠️ ${data.message}`);
      }
    } catch (e: any) {
      setTestResult(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          message: `请求失败: ${e.message}`
        }
      }));
      showToast(`❌ 连通性测试失败: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCustomModel = () => {
    if (!customModelId.trim()) {
      showToast('⚠️ 请输入模型代号 (Model ID)');
      return;
    }
    const newM: ModelInfo = {
      id: customModelId.trim(),
      name: customModelName.trim() || customModelId.trim(),
      provider: activeTab,
      contextLength: customContext.trim() || '128K',
      capabilities: customCaps,
      isLatest: true,
      isCustom: true
    };
    const updated = saveCustomModel(newM);
    setModelsList(updated);
    onSelectProvider(activeTab, newM.id);
    setShowAddCustomModel(false);
    setCustomModelId('');
    setCustomModelName('');
    showToast(`✨ 成功添加并选用自定义最新模型【${newM.name}】！`);
  };

  const handleDeleteCustomModel = (id: string) => {
    const updated = removeCustomModel(id);
    setModelsList(updated);
    showToast('🗑️ 已删除该自定义模型');
  };

  const providersInfo = [
    {
      id: 'deepseek' as ModelProviderType,
      name: 'DeepSeek 官方 API',
      badge: '超高性价比 · R1推演',
      icon: '🐋',
      color: 'from-blue-600/20 to-blue-900/30 border-blue-500/40 text-blue-300',
      envVar: 'DEEPSEEK_API_KEY',
      endpoint: 'https://api.deepseek.com/chat/completions',
      defaultModel: 'deepseek-chat',
      recommendedModels: ['deepseek-chat (V3旗舰)', 'deepseek-reasoner (R1深度思考)'],
      configured: Boolean(engineData?.providers?.deepseek?.configured),
      description: '国产自研顶尖模型，金融逻辑、长文本阅读与数学逻辑极强，价格仅为同类模型的十分之一。',
      signupUrl: 'https://platform.deepseek.com/'
    },
    {
      id: 'openrouter' as ModelProviderType,
      name: 'OpenRouter 聚合网关',
      badge: '全网模型一键路由',
      icon: '🔀',
      color: 'from-purple-600/20 to-purple-900/30 border-purple-500/40 text-purple-300',
      envVar: 'OPENROUTER_API_KEY',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      defaultModel: 'deepseek/deepseek-r1',
      recommendedModels: ['deepseek/deepseek-r1', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
      configured: Boolean(engineData?.providers?.openrouter?.configured),
      description: '国际知名模型聚合平台，单个 API Key 即可调用包括 Claude 3.5、Llama 3.3、DeepSeek R1 在内的百余种顶级大模型。',
      signupUrl: 'https://openrouter.ai/'
    },
    {
      id: 'ollama' as ModelProviderType,
      name: 'Ollama 本地纯CPU实例',
      badge: '100%离线免费 · 零数据外流',
      icon: '🦙',
      color: 'from-emerald-600/20 to-emerald-900/30 border-emerald-500/40 text-emerald-300',
      envVar: 'OLLAMA_HOST',
      endpoint: ollamaEndpoint || 'http://172.20.10.2:11434',
      defaultModel: 'qwen2.5:7b',
      recommendedModels: ['qwen2.5:7b (推荐金融CPU跑)', 'deepseek-r1:7b / 8b', 'bge-small-zh-v1.5 (向量库)'],
      configured: true,
      description: '运行在您本地 32G 内存主机上的大模型，完全无需联网、无审查、无计费，金融机密数据绝不上传云端。',
      signupUrl: 'https://ollama.com/'
    },
    {
      id: 'openai' as ModelProviderType,
      name: 'OpenAI 官方 API',
      badge: '业界标准兼容接口',
      icon: '🤖',
      color: 'from-teal-600/20 to-teal-900/30 border-teal-500/40 text-teal-300',
      envVar: 'OPENAI_API_KEY',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4o-mini',
      recommendedModels: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
      configured: Boolean(engineData?.providers?.openai?.configured),
      description: '全球广泛使用的 OpenAI 官方 API 接口，全面兼容所有标准 OpenAI 格式生态与代理网关。',
      signupUrl: 'https://platform.openai.com/'
    },
    {
      id: 'gemini' as ModelProviderType,
      name: 'Google Gemini 官方 API',
      badge: '百万上下文 · 极速旗舰',
      icon: '🌐',
      color: 'from-amber-600/20 to-amber-900/30 border-amber-500/40 text-amber-300',
      envVar: 'GEMINI_API_KEY',
      endpoint: 'Google GenAI SDK (aistudio-build)',
      defaultModel: 'gemini-3.8-flash',
      recommendedModels: ['gemini-3.8-flash (默认极速推荐)', 'gemini-3.1-pro-preview'],
      configured: Boolean(engineData?.geminiConfigured),
      description: 'Google 官方前沿多模态大模型，具备极速响应与超长上下文理解能力，本平台原生支持。',
      signupUrl: 'https://aistudio.google.com/'
    }
  ];

  const FULL_ENV_TEMPLATE = `# ========================================================
# 本地与服务端多模型 API 配置文件 (.env)
# 复制此文件至本地侧边栏根目录即可激活任意接口
# ========================================================

# 1. DeepSeek 官方 API (高性价比推理)
# 获取地址: https://platform.deepseek.com/
DEEPSEEK_API_KEY="sk-your-deepseek-key-here"

# 2. OpenRouter 聚合网关 (一个Key调用Claude/DeepSeek/Llama)
# 获取地址: https://openrouter.ai/
OPENROUTER_API_KEY="sk-or-v1-your-openrouter-key-here"

# 3. 本地 Ollama 纯CPU运行地址 (100%离线完全免费)
# 下载安装: https://ollama.com
OLLAMA_HOST="http://127.0.0.1:11434"

# 4. OpenAI 官方 API
# 获取地址: https://platform.openai.com/
OPENAI_API_KEY="sk-your-openai-key-here"

# 5. Google Gemini 官方 API
# 获取地址: https://aistudio.google.com/
GEMINI_API_KEY="your-gemini-key-here"
`;

  const currentProviderDetail = providersInfo.find(p => p.id === activeTab) || providersInfo[0];

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(FULL_ENV_TEMPLATE);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>主流模型 API 接口配置与网关中枢</span>
                <span className="text-[11px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800/40 font-mono">
                  DeepSeek / OpenRouter / Ollama / OpenAI / Gemini
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                支持服务端安全代理与本地客户端双模驱动，密钥通过后端环境变量集中托管，彻底杜绝前端泄露
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="absolute top-16 left-6 right-6 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 border border-amber-400">
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage(null)} className="text-slate-950 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 bg-slate-950 flex-1">
          {/* Top Tabs for all 5 Providers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {providersInfo.map(prov => {
              const isActive = activeTab === prov.id;
              const isSelectedActive = currentProvider === prov.id;
              return (
                <button
                  key={prov.id}
                  onClick={() => setActiveTab(prov.id)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    isActive
                      ? 'bg-slate-900 border-amber-500 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">{prov.icon}</span>
                    <span className={`w-2 h-2 rounded-full ${prov.configured ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  </div>
                  <div className="font-bold text-xs text-slate-100 truncate">{prov.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{prov.envVar}</div>
                  {isSelectedActive && (
                    <span className="mt-1 text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 text-center">
                      工作台当前激活
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Provider Detail Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 rounded-xl bg-slate-950 border border-slate-800">
                  {currentProviderDetail.icon}
                </span>
                <div>
                  <div className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>{currentProviderDetail.name}</span>
                    <span className="text-xs text-slate-400 font-normal">({currentProviderDetail.badge})</span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                    <span>配置变量: <strong className="text-amber-300">{currentProviderDetail.envVar}</strong></span>
                    <span>•</span>
                    <span className={currentProviderDetail.configured ? 'text-emerald-400' : 'text-slate-500'}>
                      {currentProviderDetail.configured ? '● 服务端已检测就绪' : '○ 待在 .env 中设置'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Ping Test Button */}
                <button
                  onClick={() => handleTestConnection(currentProviderDetail.id, currentProviderDetail.defaultModel)}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition border border-cyan-800/40 disabled:opacity-50"
                  title="向服务端或模型接口发送微型心跳包测试连接与响应速度"
                >
                  {isTesting ? (
                    <span className="w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                  ) : (
                    <span>⚡</span>
                  )}
                  <span>{isTesting ? '检测中...' : '测试连通性'}</span>
                </button>

                <a
                  href={currentProviderDetail.signupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition border border-slate-700"
                >
                  <span>获取官方 Key</span>
                  <ExternalLink size={12} />
                </a>

                <button
                  onClick={() => {
                    onSelectProvider(currentProviderDetail.id, currentProviderDetail.defaultModel);
                    showToast(`✅ 已将【${currentProviderDetail.name}】设为侧边栏工作台的默认调用提供商！`);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    currentProvider === currentProviderDetail.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                  }`}
                >
                  <Check size={13} />
                  <span>{currentProvider === currentProviderDetail.id ? '当前正在使用' : '在工作台启用此接口'}</span>
                </button>
              </div>
            </div>

            {/* Test Result Display if any */}
            {testResult[currentProviderDetail.id] && (
              <div className={`p-3 rounded-xl text-xs border flex items-center justify-between ${
                testResult[currentProviderDetail.id].success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span>{testResult[currentProviderDetail.id].success ? '🟢' : '⚠️'}</span>
                  <span>{testResult[currentProviderDetail.id].message}</span>
                </div>
                {testResult[currentProviderDetail.id].latencyMs !== undefined && (
                  <span className="font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {testResult[currentProviderDetail.id].latencyMs}ms
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentProviderDetail.description}
            </p>

            {/* Config Specs: Dedicated Hotspot & LAN Studio for Ollama, Standard for others */}
            {currentProviderDetail.id === 'ollama' ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} className="text-emerald-400" />
                    <span className="font-bold text-xs text-slate-100">手机热点 / 本地局域网 Ollama 端点连接配置</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                      当前适配: 172.20.10.2:11434
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDirectProbeOllama}
                      disabled={isCheckingDirect}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                      title="直接从当前网页浏览器向本地 Ollama 发起极速直连握手（0延迟、零中间层）"
                    >
                      {isCheckingDirect ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Wifi size={12} />
                      )}
                      <span>{isCheckingDirect ? '探测中...' : '浏览器直连探测 (推荐)'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct probe feedback banner */}
                {directCheckResult && (
                  <div className={`p-2.5 rounded-lg text-xs border flex items-center justify-between ${
                    directCheckResult.success
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span>{directCheckResult.success ? '🟢' : '⚠️'}</span>
                      <span>{directCheckResult.message}</span>
                    </div>
                    {directCheckResult.latencyMs !== undefined && (
                      <span className="font-mono text-[10px] bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                        {directCheckResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}

                {/* Endpoint Edit & Preset Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Ollama 服务端点地址 (Endpoint URL):</span>
                    <span className="text-[10px] text-slate-500">已自动持久化存储</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ollamaEndpoint}
                      onChange={(e) => setOllamaEndpoint(e.target.value)}
                      placeholder="http://172.20.10.2:11434"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => handleSaveOllamaEndpoint(ollamaEndpoint)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition"
                    >
                      保存并应用
                    </button>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500">一键切换端点预设:</span>
                    <button
                      type="button"
                      onClick={() => handleSaveOllamaEndpoint('http://172.20.10.2:11434')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                        ollamaEndpoint === 'http://172.20.10.2:11434'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      📱 手机热点 (172.20.10.2:11434)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveOllamaEndpoint('http://127.0.0.1:11434')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                        ollamaEndpoint === 'http://127.0.0.1:11434'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      💻 本机环回 (127.0.0.1:11434)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveOllamaEndpoint('http://localhost:11434')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                        ollamaEndpoint === 'http://localhost:11434'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      🌐 localhost:11434
                    </button>
                  </div>
                </div>

                {/* Discovered Models from local Ollama */}
                {ollamaDirectModels.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <Sparkles size={11} />
                      <span>检测到您本地电脑已拉取的大模型 (点击即可选用):</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ollamaDirectModels.map(mName => (
                        <button
                          key={mName}
                          onClick={() => {
                            onSelectProvider('ollama', mName);
                            showToast(`✅ 已选用本地 Ollama 模型: ${mName}`);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-mono transition border flex items-center gap-1 ${
                            currentModel === mName
                              ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-emerald-500/50 hover:text-emerald-300'
                          }`}
                        >
                          <span>🦙</span>
                          <span>{mName}</span>
                          {currentModel === mName && <Check size={10} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hotspot & OLLAMA_HOST=0.0.0.0 Important Instructions Card */}
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-200 font-bold">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Terminal size={13} />
                      <span>手机热点 (172.20.10.2) + OLLAMA_HOST=0.0.0.0 启动指引</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      两步搞定，无需公网IP
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    您已将电脑环境变量 <code className="text-amber-300 font-mono">OLLAMA_HOST</code> 设为 <code className="text-amber-300 font-mono">0.0.0.0</code>，Ollama 已在监听包括热点 IP（<code className="text-emerald-300 font-mono">172.20.10.2</code>）在内的所有网卡接口。
                    <strong className="text-slate-200">【关键一步】</strong>请确保同时配置了跨域白名单 <code className="text-emerald-300 font-mono">OLLAMA_ORIGINS="*"</code>，否则浏览器将因安全策略拦截对本地端口的访问。
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                    {/* PowerShell */}
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 flex flex-col justify-between">
                      <span className="text-slate-400 block mb-1">Windows PowerShell 启动命令:</span>
                      <code className="text-cyan-300 break-all select-all block mb-2">
                        $env:OLLAMA_HOST="0.0.0.0:11434"; $env:OLLAMA_ORIGINS="*"; ollama serve
                      </code>
                      <button
                        onClick={() => handleCopyCommand('$env:OLLAMA_HOST="0.0.0.0:11434"; $env:OLLAMA_ORIGINS="*"; ollama serve', 'ps')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1 text-[10px] transition"
                      >
                        <Copy size={10} />
                        <span>{copiedCmd === 'ps' ? '已复制' : '复制命令'}</span>
                      </button>
                    </div>

                    {/* macOS / Linux */}
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 flex flex-col justify-between">
                      <span className="text-slate-400 block mb-1">macOS / Linux 启动命令:</span>
                      <code className="text-cyan-300 break-all select-all block mb-2">
                        OLLAMA_HOST="0.0.0.0:11434" OLLAMA_ORIGINS="*" ollama serve
                      </code>
                      <button
                        onClick={() => handleCopyCommand('OLLAMA_HOST="0.0.0.0:11434" OLLAMA_ORIGINS="*" ollama serve', 'mac')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1 text-[10px] transition"
                      >
                        <Copy size={10} />
                        <span>{copiedCmd === 'mac' ? '已复制' : '复制命令'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-500 block text-[11px]">API 请求端点 (Endpoint URL):</span>
                <code className="text-cyan-300 font-mono text-xs select-all block break-all">
                  {currentProviderDetail.endpoint}
                </code>
              </div>
            )}

            {/* Dynamic Model Selector & Custom Latest Models Section */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                    <span>自由选用最新模型代号 (支持自定义)</span>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.2 rounded border border-blue-500/20 font-mono">
                      含 LLM · CHAT · 1000K · VISION 功能标签
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    可自由选用最新版本（如 DeepSeek V4.1 Flash），或直接添加任意未收录的模型代号
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="搜索模型或标签..."
                      className="pl-7 pr-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 w-36 sm:w-44"
                    />
                  </div>

                  <button
                    onClick={() => setShowAddCustomModel(!showAddCustomModel)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Plus size={12} />
                    <span>{showAddCustomModel ? '收起添加' : '输入新模型'}</span>
                  </button>
                </div>
              </div>

              {/* Add Custom Model Drawer / Form */}
              {showAddCustomModel && (
                <div className="p-3.5 bg-slate-900/90 rounded-xl border border-amber-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles size={13} />
                      <span>添加并自定义最新大模型代号</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      支持任意第三方及最新发布的 Model ID
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        模型代号 (Model ID，传给API的字符):
                      </label>
                      <input
                        type="text"
                        value={customModelId}
                        onChange={(e) => setCustomModelId(e.target.value)}
                        placeholder="例如: deepseek-v4.1-flash"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        显示名称 (Display Name):
                      </label>
                      <input
                        type="text"
                        value={customModelName}
                        onChange={(e) => setCustomModelName(e.target.value)}
                        placeholder="例如: DeepSeek V4.1 Flash"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        上下文窗口长度 (Context):
                      </label>
                      <input
                        type="text"
                        value={customContext}
                        onChange={(e) => setCustomContext(e.target.value)}
                        placeholder="例如: 1000K, 128K, 2000K"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Capabilities Selector */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1.5">
                      勾选功能图标标签 (展示于模型后方):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['LLM', 'CHAT', 'VISION', 'REASONING', 'FAST', 'OFFLINE'] as ModelCapability[]).map((cap) => {
                        const checked = customCaps.includes(cap);
                        return (
                          <button
                            key={cap}
                            type="button"
                            onClick={() => {
                              if (checked) {
                                setCustomCaps(customCaps.filter(c => c !== cap));
                              } else {
                                setCustomCaps([...customCaps, cap]);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition flex items-center gap-1 ${
                              checked
                                ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {cap === 'VISION' && <Eye size={10} className="text-cyan-400" />}
                            {cap === 'REASONING' && <Brain size={10} className="text-purple-400" />}
                            {cap === 'FAST' && <Zap size={10} className="text-amber-400" />}
                            <span>{cap}</span>
                            {checked && <Check size={10} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowAddCustomModel(false)}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveCustomModel}
                      className="px-4 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20"
                    >
                      保存并选用此模型
                    </button>
                  </div>
                </div>
              )}

              {/* Model Items List with Badges */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {modelsList
                  .filter(m => m.provider === activeTab)
                  .filter(m => {
                    if (!modelSearch.trim()) return true;
                    const q = modelSearch.toLowerCase();
                    return m.name.toLowerCase().includes(q) || 
                           m.id.toLowerCase().includes(q) || 
                           m.capabilities.some(c => c.toLowerCase().includes(q)) ||
                           m.contextLength.toLowerCase().includes(q);
                  })
                  .map((m) => {
                    const isCurrent = (currentModel === m.id) && (currentProvider === activeTab);
                    return (
                      <ModelItemRow
                        key={m.id}
                        model={m}
                        isSelected={isCurrent}
                        onSelect={(selectedM) => {
                          onSelectProvider(activeTab, selectedM.id);
                          showToast(`🎯 已切换为【${currentProviderDetail.name}】的【${selectedM.name}】模型`);
                        }}
                        onDelete={handleDeleteCustomModel}
                      />
                    );
                  })}
              </div>
            </div>
          </div>

          {/* How to configure guidance */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            <span className="font-bold text-slate-200 block text-xs flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>关于 API KEY 安全规范与配置位置说明：</span>
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-300 leading-relaxed text-[11px]">
              <li>
                <strong>云端平台安全运行 (当前 AI Studio)：</strong>密钥由服务端通过环境变量托管。如需添加 DeepSeek、OpenRouter 或 OpenAI 密钥，请在 AI Studio 的 <strong>Settings &gt; Secrets</strong> 中添加对应的变量名（如 <code className="text-amber-300 font-mono">DEEPSEEK_API_KEY</code>），服务端即可动态识别并秒级调用！
              </li>
              <li>
                <strong>本地独立部署 (Windows / Mac 挂靠侧边栏)：</strong>在本地运行 <code>server.py</code> 或 Python 客户端时，在根目录下创建 <code className="text-amber-300 font-mono">.env</code> 文件填入密钥即可。
              </li>
              <li>
                <strong>纯离线 0 审查运行 (Ollama)：</strong>无需任何 API Key，只需在本地电脑终端执行 <code className="text-emerald-300 font-mono">ollama pull qwen2.5:7b</code>，选择“Ollama 本地纯CPU实例”即可免密离线运行。
              </li>
            </ul>
          </div>

          {/* Full .env Template Download / Copy Box */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-amber-400" />
                <span className="font-bold text-xs text-slate-200">一键生成 .env 完整多接口配置文件模板</span>
              </div>
              <button
                onClick={handleCopyEnv}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition"
              >
                {copiedEnv ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedEnv ? '已复制' : '复制 .env 文本'}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-950 text-xs font-mono text-slate-300 max-h-40 overflow-y-auto">
              <pre><code>{FULL_ENV_TEMPLATE}</code></pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-500/20"
          >
            完成并返回工作台
          </button>
        </div>
      </div>
    </div>
  );
};
