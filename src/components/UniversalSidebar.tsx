import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Copy, Check, Sparkles, Sliders, 
  Layers, Pin, PinOff, Eye, EyeOff, BookOpen, ChevronDown, 
  ChevronUp, Edit3, Plus, RotateCcw, FileText, ExternalLink,
  Minimize2, Maximize2, X, Terminal, Database, ArrowRight,
  Key, Cpu, Globe, Search, Clock, Zap, Bookmark, Hash, MessageSquare, Square
} from 'lucide-react';
import { AIRole, ChatMessage, DifyDataset, ModelInfo, ModelProviderType, ChatCitation } from '../types';
import { searchKnowledgeBase, RetrievalResult, getVectorHash } from '../utils/vectorSearch';
import { getStoredModels, saveCustomModel } from '../data/models';
import { ModelItemRow } from './ModelItemRow';
import { MessageContent } from './MessageContent';
import { CitationSnippetPreviewModal } from './CitationSnippetPreviewModal';
import { NETWORK_FAULT_REPORT, API_KEY_MISSING, MAX_RETRIES, REQUEST_TIMEOUT_MS } from '../utils/networkReport';

// 3 次重试 × 300 秒 + 退避(1+2+4 秒) 的总时限
const TOTAL_REQUEST_BUDGET_MS = (MAX_RETRIES + 1) * REQUEST_TIMEOUT_MS + 10000;


// 停止/重生成/上下文构造的边界逻辑已抽到 src/lib/chatFlow.ts（可被 node:test 直接覆盖），这里仅做转出以保持既有 import 不变
import {
  STOPPED_MARK,
  STOPPED_SUFFIX,
  buildChatHistory,
  canRegenerate,
  decideStreamOutcome,
  planRegenerate,
  stripCitationFootnotes,
  type HistoryTurn,
} from '../lib/chatFlow';

export { STOPPED_MARK, canRegenerate, stripCitationFootnotes };

interface KnowledgeCitationSourcePopoverProps {
  citations: ChatCitation[];
  onOpenPreview: (citation: ChatCitation) => void;
}

/**
 * 统一链接：“引用知识库来源” 
 * 鼠标悬浮/点击展示悬浮窗 (Popover)，呈现命中内容的原文片段、来源文件名及相似度信息
 * 关闭 RAG 时该组件自动跳过，不渲染任何引用
 */
const KnowledgeCitationSourcePopover: React.FC<KnowledgeCitationSourcePopoverProps> = ({ 
  citations, 
  onOpenPreview 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!citations || citations.length === 0) return null;

  const currentCite = citations[selectedIdx] || citations[0];
  const docName = currentCite.sourceDoc || currentCite.datasetName || '业务知识库';
    const pointName = currentCite.pointName || currentCite.title || '核心业务知识点';
  const vectorHash = getVectorHash(currentCite);
  const simPercent = (currentCite.similarity * 100).toFixed(1);

  return (
    <div 
      className="relative inline-block"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 统一链接：“引用知识库来源” */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] leading-4 font-medium text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-400 transition cursor-pointer shadow-sm group select-none active:scale-95"
        title="鼠标悬浮预览命中原文片段、来源文件名及相似度，点击弹出详细工作台"
      >
        <BookOpen size={10} className="text-amber-400 group-hover:scale-110 transition-transform" />
        <span className="font-semibold">引用知识库来源</span>
        <span className="px-1 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[9px] border border-amber-500/30 font-bold">
          {citations.length}段命中
        </span>
        <ChevronDown size={9} className={`text-slate-400 group-hover:text-amber-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 悬浮窗 (Floating Popover) 预览交互 */}
      {isOpen && (
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 sm:w-96 bg-slate-900/98 backdrop-blur-md border border-amber-500/60 rounded-xl p-3.5 shadow-2xl text-left z-50 text-slate-200 animate-in fade-in zoom-in-95 select-text"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-amber-500/60" />

          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-extrabold text-[10px] shrink-0">
                RAG命中
              </span>
              <div className="font-bold text-xs text-slate-100 truncate">
                知识库检索原文悬浮预览
              </div>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/80 font-mono font-bold">
              🎯 相似度: {simPercent}%
            </span>
          </div>

          {/* Multiple citations switcher tabs if > 1 */}
          {citations.length > 1 && (
            <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1 text-[10px] font-mono">
              {citations.map((c, i) => (
                <button
                  key={c.chunkId || i}
                  type="button"
                  onClick={() => setSelectedIdx(i)}
                  className={`px-2 py-0.5 rounded-md border transition whitespace-nowrap ${
                    selectedIdx === i
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  来源片段 #{i + 1} ({(c.similarity * 100).toFixed(0)}%)
                </button>
              ))}
            </div>
          )}

          {/* 来源文件名 */}
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 mb-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-sans flex items-center gap-1">
                <FileText size={11} className="text-cyan-400" />
                <span>来源文件名:</span>
              </span>
              <span className="font-mono text-[9px] bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800/80">
                {(currentCite.originalDocFormat || 'PDF').toUpperCase()} 原档
              </span>
            </div>
            <div className="font-semibold text-xs text-amber-300 truncate" title={docName}>
              《{docName}》
            </div>
          </div>

          {/* 知识点与相似度元数据 */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2 px-1">
            <div className="truncate max-w-[210px]">
              <span className="text-slate-500 mr-1">知识点:</span>
              <span className="text-slate-200 font-medium">{pointName}</span>
            </div>
            <div className="font-mono text-[9px] text-purple-300/80" title={currentCite.chunkId}>
              {vectorHash}
            </div>
          </div>

          {/* 命中内容的原文片段 (Formatted snippet preview) */}
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/90 text-[11px] text-slate-300 leading-relaxed max-h-28 overflow-y-auto font-sans mb-2.5 shadow-inner select-text border-l-2 border-l-amber-500">
            <div className="text-[10px] text-amber-400 font-bold mb-1 flex items-center gap-1">
              <span>📖 命中内容原文片段:</span>
            </div>
            <div className="text-slate-200 italic font-sans leading-relaxed">
              "{currentCite.contentSnippet}"
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenPreview(currentCite);
            }}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Edit3 size={12} />
            <span>点击直接预览原文上下文片段 / 在线修改话术</span>
          </button>
        </div>
      )}
    </div>
  );
};

interface UniversalSidebarProps {
  currentRole: AIRole;
  roles: AIRole[];
  onSelectRole: (role: AIRole) => void;
  onUpdateRole: (role: AIRole) => void;
  datasets: DifyDataset[];
  onUpdateDatasets?: (datasets: DifyDataset[]) => void;
  onNavigateToKnowledge: () => void;
  onNavigateToRoles: () => void;
  isDockedMode: boolean;
  onToggleDockMode: () => void;
  fontScale?: number;
  onIncreaseFont?: () => void;
  onDecreaseFont?: () => void;
  onResetFont?: () => void;
}

/** 对话记录本地存储（按角色分桶，保留最近 40 条）——「清理本地缓存」不会清理该键 */
export const CHAT_STORE_KEY = 'finai_chat_history_v1';
export const CHAT_MAX_PER_ROLE = 40;

export const readChatStore = (): Record<string, ChatMessage[]> => {
  try {
    const raw = localStorage.getItem(CHAT_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, ChatMessage[]> : {};
  } catch { return {}; }
};

export const writeChatStore = (store: Record<string, ChatMessage[]>) => {
  try { localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(store)); } catch {}
};

export const UniversalSidebar: React.FC<UniversalSidebarProps> = ({
  currentRole,
  roles,
  onSelectRole,
  onUpdateRole,
  datasets,
  onUpdateDatasets,
  onNavigateToKnowledge,
  onNavigateToRoles,
  isDockedMode,
  onToggleDockMode,
  fontScale,
  onIncreaseFont,
  onDecreaseFont,
  onResetFont
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [opacity, setOpacity] = useState(100);
  const [showRoleDrawer, setShowRoleDrawer] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeCitationChunk, setActiveCitationChunk] = useState<any | null>(null);

  // Multi-Provider & Model State (Follows current role configuration)
  const [activeProvider, setActiveProvider] = useState<ModelProviderType>(currentRole.preferredProvider || 'deepseek');
  const [activeModel, setActiveModel] = useState<string>(currentRole.preferredModel || 'deepseek-v4.1-flash');
  const [customEndpoint, setCustomEndpoint] = useState<string>(() => {
    return localStorage.getItem('finai_ollama_endpoint') || 'http://172.20.10.2:11434';
  });
  const [engineStatusData, setEngineStatusData] = useState<any>(null);

  // Model Drawer & Custom Models State
  const [showModelDrawer, setShowModelDrawer] = useState(false);
  const [sidebarModelSearch, setSidebarModelSearch] = useState('');
  const [quickCustomModelInput, setQuickCustomModelInput] = useState('');
  const [allModels, setAllModels] = useState<ModelInfo[]>(getStoredModels());

  // Editable prompt inside drawer
  const [editedSystemPrompt, setEditedSystemPrompt] = useState(currentRole.systemPrompt);
  const [editedTemperature, setEditedTemperature] = useState(currentRole.temperature);
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>(currentRole.knowledgeBaseIds || []);
  const [enableRag, setEnableRag] = useState(true);

  // Synchronize when currentRole changes (Model automatically follows the configured role!)
  useEffect(() => {
    setEditedSystemPrompt(currentRole.systemPrompt);
    setEditedTemperature(currentRole.temperature);
    setSelectedDatasetIds(currentRole.knowledgeBaseIds || []);
    if (currentRole.preferredModel) {
      setActiveModel(currentRole.preferredModel);
    }
    if (currentRole.preferredProvider) {
      setActiveProvider(currentRole.preferredProvider);
    }
  }, [currentRole.id, currentRole.preferredModel, currentRole.preferredProvider,
      currentRole.systemPrompt, currentRole.temperature, currentRole.knowledgeBaseIds]);

  // Dynamically load models from backend API based on active API Keys in .env
  const loadModelsFromApi = () => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.models)) {
          const stored = getStoredModels();
          const customModels = stored.filter(m => m.isCustom);
          // Combine server-discovered models with user's custom models
          const combined = [...data.models, ...customModels.filter(cm => !data.models.some((m: any) => m.id === cm.id))];
          setAllModels(combined);
        }
      })
      .catch(() => {});

    fetch('/api/engine/status')
      .then(res => res.json())
      .then(data => {
        setEngineStatusData(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadModelsFromApi();
  }, []);

  // Messages state（对话记录按角色持久化：切换「设置子功能」或重启工作台都不再丢失）
  const [messages, setMessages] = useState<ChatMessage[]>(() => readChatStore()[currentRole.id] || []);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const chatRoleRef = useRef<string>(currentRole.id);
  const skipChatSaveRef = useRef(false);

  // 角色切换：先把旧角色的记录写回本地，再载入新角色的记录
  useEffect(() => {
    const store = readChatStore();
    if (chatRoleRef.current !== currentRole.id) {
      if (messagesRef.current.length > 0) store[chatRoleRef.current] = messagesRef.current.slice(-CHAT_MAX_PER_ROLE);
      else delete store[chatRoleRef.current];
      chatRoleRef.current = currentRole.id;
      writeChatStore(store);
      skipChatSaveRef.current = true;
      setMessages(store[currentRole.id] || []);
    }
  }, [currentRole.id]);

  // 对话记录实时落盘
  useEffect(() => {
    if (skipChatSaveRef.current) { skipChatSaveRef.current = false; return; }
    const store = readChatStore();
    if (messages.length > 0) store[currentRole.id] = messages.slice(-CHAT_MAX_PER_ROLE);
    else delete store[currentRole.id];
    writeChatStore(store);
  }, [messages, currentRole.id]);

  // Callback to update chunk data from preview modal and sync to knowledge base
  const handleUpdateCitationChunk = (updatedCitation: ChatCitation) => {
    if (onUpdateDatasets && datasets) {
      const updatedDatasets = datasets.map(ds => {
        const hasChunk = ds.chunks.some(c => c.id === updatedCitation.chunkId);
        if (hasChunk) {
          return {
            ...ds,
            chunks: ds.chunks.map(c => {
              if (c.id === updatedCitation.chunkId) {
                return {
                  ...c,
                  title: updatedCitation.title,
                  pointName: updatedCitation.pointName,
                  question: updatedCitation.question,
                  keywords: updatedCitation.keywords || [],
                  content: updatedCitation.contentSnippet,
                  answer: updatedCitation.contentSnippet,
                  charCount: updatedCitation.contentSnippet.length,
                  updatedAt: new Date().toISOString().slice(0, 10)
                };
              }
              return c;
            })
          };
        }
        return ds;
      });
      onUpdateDatasets(updatedDatasets);
    }

    setActiveCitationChunk(updatedCitation);

    setMessages(prev => prev.map(m => {
      if (m.citations && m.citations.length > 0) {
        return {
          ...m,
          citations: m.citations.map(c => c.chunkId === updatedCitation.chunkId ? updatedCitation : c)
        };
      }
      return m;
    }));

    showToast(`已更新知识点【${updatedCitation.pointName || updatedCitation.title}】`);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 当前进行中的生成请求：用于“停止生成”（终端中断 + 前端 abort），以及“重新生成”前清理旧请求
  const abortRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleCopyText = (text: string) => {
    const cleaned = stripCitationFootnotes(text);
    navigator.clipboard.writeText(cleaned);
    showToast('📋 已复制回复内容！');
  };

  const handleAppendDisclaimer = (msgId: string) => {
    const disclaimer = '\n\n【合规免责声明】理财非存款，产品有风险，投资须谨慎。本内容仅供内部业务人员参考，不构成任何投资建议或法定要约。';
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: m.text + disclaimer } : m));
    showToast('🛡️ 已插入标准资管合规免责声明');
  };

  const handleAuditCompliance = (text: string) => {
    const banned = ['保本', '保息', '稳赚', '零风险', '100%收益', '包赚不赔', '绝对收益'];
    const hits = banned.filter(w => text.includes(w));
    if (hits.length > 0) {
      showToast(`⚠️ 合规告警：检测到禁用词【${hits.join('、')}】，请修改后再发送给客户！`);
    } else {
      showToast('🟢 合规初审通过：未检测到刚兑等绝对化宣传禁用词。');
    }
  };

  // Quick custom model application
  const handleQuickApplyCustomModel = () => {
    if (!quickCustomModelInput.trim()) {
      showToast('⚠️ 请输入模型代号 (Model ID)');
      return;
    }
    const cleanId = quickCustomModelInput.trim();
    const newM: ModelInfo = {
      id: cleanId,
      name: cleanId,
      provider: activeProvider,
      contextLength: '1000K',
      capabilities: ['LLM', 'CHAT'],
      isLatest: true,
      isCustom: true
    };
    const updated = saveCustomModel(newM);
    setAllModels(updated);
    setActiveModel(cleanId);
    setQuickCustomModelInput('');
    setShowModelDrawer(false);
    showToast(`✨ 已成功选用自定义最新模型【${cleanId}】！`);
  };

  // Save modified prompt for current role
  const handleSavePromptChanges = () => {
    const updated: AIRole = {
      ...currentRole,
      systemPrompt: editedSystemPrompt,
      temperature: editedTemperature,
      knowledgeBaseIds: selectedDatasetIds
    };
    onUpdateRole(updated);
    setShowPromptEditor(false);
    showToast(`✅ 已更新角色【${currentRole.name}】的自定义系统提示词与知识库配置！`);
  };

  // Handle message send
  const handleSendMessage = async (
    textToSend?: string,
    opts?: { regenerate?: { keepCount: number; history: HistoryTurn[] } }
  ) => {
    const query = textToSend !== undefined ? textToSend : inputText;
    if (!query.trim()) return;

    const isRegenerate = Boolean(opts?.regenerate);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      roleId: currentRole.id,
      roleName: '我',
      roleAvatar: '👤',
      text: query,
      timestamp: new Date().toLocaleTimeString(),
    };

    // 重新生成：保留到该条用户提问为止，不再追加新的用户气泡（避免同一提问出现两次）
    if (isRegenerate) setMessages(prev => prev.slice(0, opts!.regenerate!.keepCount));
    else setMessages(prev => [...prev, userMsg]);
    if (textToSend === undefined) setInputText('');
    setIsLoading(true);
    stopRequestedRef.current = false;

    // 1. Perform Sub-second Local Vector Search (Dify RAG mode with strict 500 chars limit)
    let ragResult: RetrievalResult | null = null;
    if (enableRag && selectedDatasetIds.length > 0) {
      ragResult = searchKnowledgeBase(query, datasets, selectedDatasetIds, 2, 0.50, 500);
    }

    // 2. Build full prompt injecting system prompt and retrieved context (strictly capped <= 500 chars with footnote instructions)
    let fullPromptWithContext = query;
    if (ragResult && ragResult.contextText) {
      fullPromptWithContext = `【基于本地Dify知识库检索参考（严格控制≤500字内）】:\n${ragResult.contextText}\n\n【用户真实业务提问】:\n${query}\n\n【专业回答规范要求】:\n1. 请以专家角色解答客户提问，结合上述参考资料给出客观、严谨、专业的回复。\n2. 直接输出专业回答正文：正文中不要标注引用脚标（如 [1]、[2]），不要写文档页码，也不要附加“来源/出处”列表（界面会自动呈现知识库来源入口）。\n3. 回复的输出格式（结构、标题、排版、符号）一律以角色设定中的要求为准。`;
    }

    // 0. 优先走流式接口（带最近 12 条多轮上下文）；失败则静默回退到下方原有的整段请求链路
    {
      // 重新生成时用 plan 里的历史（不含本轮问答），普通发送时基于已落库的消息构造
      const history: HistoryTurn[] = opts?.regenerate
        ? opts.regenerate.history
        : buildChatHistory(messages);
      const aiId = `a-${Date.now()}`;
      const makeAi = (text: string): ChatMessage => ({
        id: aiId, sender: 'ai', roleId: currentRole.id, roleName: currentRole.name, roleAvatar: currentRole.avatar,
        command: currentRole.code, text, timestamp: new Date().toLocaleTimeString(), isRealAi: true,
        citations: enableRag ? ragResult?.citations : undefined
      });
      let acc = '';
      let started = false;
      let streamError: string | undefined;
      let finished: any = null;
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => { flushTimer = null; const t = acc; setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: t } : m)); };
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const killer = setTimeout(() => ctrl.abort(), TOTAL_REQUEST_BUDGET_MS);
      try {
        const resp = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: activeProvider, model: activeModel, endpoint: customEndpoint,
            command: currentRole.code || 'we', prompt: fullPromptWithContext,
            citations: enableRag ? ragResult?.citations : undefined,
            systemPromptOverride: currentRole.systemPrompt, temperature: currentRole.temperature,
            seat: currentRole.name, seatName: currentRole.title, history
          }),
          signal: ctrl.signal
        });
        if (resp.ok && resp.body && (resp.headers.get('content-type') || '').includes('text/event-stream')) {
          const reader = resp.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let idx: number;
            while ((idx = buf.indexOf('\n\n')) >= 0) {
              const blk = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              const line = blk.split('\n').find(l => l.startsWith('data:'));
              if (!line) continue;
              let evt: any;
              try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
              if (evt.delta) {
                acc += evt.delta;
                // 注意：这里不再把 isLoading 置 false —— 否则首个 token 之后“停止生成”按钮会消失，
                // 生成途中就无法中止。输入框的发送按钮仍由 isLoading 兜住。
                if (!started) { started = true; setMessages(prev => [...prev, makeAi(acc)]); }
                else if (!flushTimer) flushTimer = setTimeout(flush, 60);
              }
              if (evt.error) streamError = String(evt.error);
              if (evt.done) finished = evt;
            }
          }
        }
      } catch { /* 网络中断 / 用户停止 / 超时：已有部分内容则保留，否则回退 */ }
      finally { clearTimeout(killer); if (abortRef.current === ctrl) abortRef.current = null; if (flushTimer) clearTimeout(flushTimer); }

      // 边界收口（规则见 chatFlow.decideStreamOutcome）：
      //   用户点过“停止”→ 一律就地收口，绝不进入回退链路（否则会二次发起请求、覆盖掉停止标记）；
      //   一直没收到任何 token → 交给下面的回退链路（整段请求/本地兜底）；
      //   正常收尾 → 用服务端 done 的全文对齐（防止丢尾包）。
      const outcome = decideStreamOutcome({
        started,
        stopRequested: stopRequestedRef.current,
        acc,
        finishedText: finished?.text,
        errorText: streamError,
      });
      if (outcome.action !== 'fallback') {
        const lat = (finished?.latencyMs || 0) + (enableRag && ragResult ? ragResult.latencyMs : 0);
        if (outcome.action === 'stopped' && !outcome.hasBubbleText) {
          // 一个字都没出就被停止：需要补一个空回复气泡承载停止标记，否则用户看不到“已停止生成”、也无处点重新生成
          setMessages(prev => [...prev, { ...makeAi(outcome.text), isRealAi: false, latencyMs: 0 }]);
        } else {
          setMessages(prev => prev.map(m => m.id === aiId
            ? { ...m, text: outcome.text, latencyMs: lat || undefined, tokensUsed: finished?.tokensUsed || Math.max(45, Math.round(outcome.text.length * 1.35)) }
            : m));
        }
        stopRequestedRef.current = false;
        setIsLoading(false);
        return;
      }
      // 未收到任何 token 且用户没有停止：清掉停止标记后进入回退链路
      stopRequestedRef.current = false;
    }

    // Special direct probe for Ollama with timeout protection
    if (activeProvider === 'ollama') {
      try {
        const controller = new AbortController();
        abortRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), 20000);
        const directResp = await fetch(`${customEndpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: activeModel || 'qwen2.5:7b',
            prompt: `${currentRole.systemPrompt}\n\n${fullPromptWithContext}`,
            stream: false,
            options: { temperature: currentRole.temperature || 0.7 }
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (directResp.ok) {
          const directData = await directResp.json();
          if (directData?.response) {
            const aiMsg: ChatMessage = {
              id: `a-${Date.now()}`,
              sender: 'ai',
              roleId: currentRole.id,
              roleName: currentRole.name,
              roleAvatar: currentRole.avatar,
              command: currentRole.code,
              text: directData.response,
              timestamp: new Date().toLocaleTimeString(),
              isRealAi: true,
              latencyMs: 160 + (enableRag && ragResult ? ragResult.latencyMs : 0),
              tokensUsed: (directData.prompt_eval_count || 0) + (directData.eval_count || 0) || Math.max(45, Math.round(directData.response.length * 1.35)),
              citations: enableRag ? ragResult?.citations : undefined
            };
            setMessages(prev => [...prev, aiMsg]);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Direct browser fetch failed (e.g. CORS block or offline); smoothly fallback to backend /api/chat
      }
    }

    // Call /api/chat with maximum 3 retries and 300-second timeout limit
    let chatSuccess = false;
    let finalData: any = null;
    let lastErrorMsg = NETWORK_FAULT_REPORT;

    // 服务端已实现 3 次指数退避重试（单次 300 秒）；前端仅发起一次请求并给出足够的总时限，避免重试叠加
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), TOTAL_REQUEST_BUDGET_MS);
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            provider: activeProvider,
            model: activeModel,
            endpoint: customEndpoint,
            command: currentRole.code || 'we',
            prompt: fullPromptWithContext,
            citations: enableRag ? ragResult?.citations : undefined,
            systemPromptOverride: currentRole.systemPrompt,
            temperature: currentRole.temperature,
            seat: currentRole.name,
            seatName: currentRole.title
          })
        ,
        signal: controller.signal
      });
      const data = await resp.json();
      if (data.success && data.text) {
        finalData = data;
        chatSuccess = true;
      } else if (data.text === API_KEY_MISSING) {
        lastErrorMsg = API_KEY_MISSING;
      } else {
        lastErrorMsg = data.error || data.text || NETWORK_FAULT_REPORT;
      }
    } catch {
      lastErrorMsg = NETWORK_FAULT_REPORT;
    } finally {
      clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
    }

    // 用户在非流式回退链路中点了“停止生成”：立即收口，即使此刻恰好也拿到了完整结果也不再展示
    if (stopRequestedRef.current) {
      stopRequestedRef.current = false;
      const interrupted: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'ai',
        roleId: currentRole.id,
        roleName: currentRole.name,
        roleAvatar: currentRole.avatar,
        command: currentRole.code,
        text: STOPPED_SUFFIX.trim(),
        timestamp: new Date().toLocaleTimeString(),
        isRealAi: false,
        latencyMs: 0,
        citations: undefined
      };
      setMessages(prev => [...prev, interrupted]);
      setIsLoading(false);
      return;
    }

    if (chatSuccess && finalData) {
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'ai',
        roleId: currentRole.id,
        roleName: currentRole.name,
        roleAvatar: currentRole.avatar,
        command: currentRole.code,
        text: finalData.text,
        timestamp: new Date().toLocaleTimeString(),
        isRealAi: finalData.isRealAi,
        latencyMs: (finalData.latencyMs || 220) + (enableRag && ragResult ? ragResult.latencyMs : 0),
        tokensUsed: finalData.tokensUsed || Math.max(45, Math.round((finalData.text?.length || 0) * 1.35)),
        citations: enableRag ? ragResult?.citations : undefined
      };
      setMessages(prev => [...prev, aiMsg]);
    } else {
      const fallbackText = lastErrorMsg;
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'ai',
        roleId: currentRole.id,
        roleName: currentRole.name,
        roleAvatar: currentRole.avatar,
        command: currentRole.code,
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString(),
        isRealAi: false,
        latencyMs: 30,
        citations: undefined
      };
      setMessages(prev => [...prev, aiMsg]);
    }

    setIsLoading(false);
  };

  /**
   * 停止生成：中断前端流式读取（AbortController）+ 服务端 res.on('close') 会同步关闭上游大模型连接；
   * 已生成的部分内容保留在气泡内并追加“已停止生成”标记，随后可一键重新生成。
   */
  const handleStopGeneration = () => {
    // 注意：不再 `if (!abortRef.current) return;` —— 流式读取期间 abortRef 可能已被 finally 清空，
    // 那样点“停止”会毫无反应。先置停止标记（收口判定以它为准），再尽力中断在途请求。
    stopRequestedRef.current = true;
    const ctrl = abortRef.current;
    abortRef.current = null;
    if (ctrl) { try { ctrl.abort(); } catch { /* 已结束的请求忽略 */ } }
    // 有在途请求时不立即把 isLoading 置 false：让链路自己收口落库停止标记，避免与新一轮发送竞态。
    // 无在途请求（请求已结束/尚未开始）时才直接复位 loading。
    else setIsLoading(false);
    showToast('⏹ 已停止生成，可点击“重新生成”再次发起');
  };

  /** 重新生成：定位目标回复所对应的一轮问答，保留该提问及其之前的历史，重跑生成链路 */
  const handleRegenerate = (targetAiId?: string) => {
    const plan = planRegenerate(messages, targetAiId, { busy: isLoading });
    if (!plan.ok) {
      showToast(
        plan.reason === 'busy'
          ? '正在生成中，请先停止或等待完成'
          : plan.reason === 'bad-target'
            ? '没找到这条回复所属的提问'
            : '当前没有可重新生成的用户提问'
      );
      return;
    }
    // 同一轮里被丢弃的后续消息给出明确提示，避免“历史消息莫名消失”
    showToast(plan.dropped > 1 ? `🔄 已回退到该轮并重新生成（清除后续 ${plan.dropped - 1} 条）` : '🔄 已重新生成该问题');
    void handleSendMessage(plan.prompt, { regenerate: { keepCount: plan.keepCount, history: plan.history } });
  };

  /** 最后一条 AI 回复（生成中/刚生成的“活动”回复）：仅它展示“停止生成”，并优先展示“重新生成” */
  const isLastAiMessage = (id: string) =>
    messages.length > 0 && messages[messages.length - 1].sender === 'ai' && messages[messages.length - 1].id === id;

  // Helper to render clean response text in 100% pure plain text without any border graphics, badges, or markdown symbols
  const renderCleanMessageText = (rawText: string) => {
    if (!rawText) return null;

    // 1. 剥离知识库引用脚标与旧版来源段落，正文只保留纯文本
    const cleaned = stripCitationFootnotes(rawText);

    // 2. 输出格式以角色自定义提示词为准；仅代码块做卡片化渲染
    return (
      <div className="font-sans text-xs leading-relaxed text-slate-100 select-text">
        <MessageContent text={cleaned} />
      </div>
    );
  };

  return (
    <div 
      className={`relative flex flex-col h-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 border-l border-slate-800/70 text-slate-100 select-none ${
        isDockedMode ? 'w-full shadow-2xl' : 'w-full'
      }`}
    >

      {/* 1. Windows Dock Header (Always accessible above any software) */}
      <div className="px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <button
            onClick={() => setShowRoleDrawer(!showRoleDrawer)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition border border-slate-700 text-left shrink-0"
            title="点击切换角色"
          >
            <span className="text-base">{currentRole.avatar}</span>
            <div className="leading-tight">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1">
                <span>{currentRole.name}</span>
                <ChevronDown size={11} className="text-slate-400" />
              </div>
              <div className="text-[10px] text-amber-400 font-mono truncate max-w-[90px]">
                {currentRole.category}
              </div>
            </div>
          </button>

          {/* 第一句介绍角色类型的话放在点击切换角色后面 */}
          <div 
            className="text-[11px] text-slate-300 truncate flex-1 hidden sm:flex items-center gap-1.5 border-l border-slate-800/80 pl-2.5 leading-tight select-text"
            title={`核心职能【${currentRole.title}】：${currentRole.description}`}
          >
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30 text-[10px] shrink-0 font-mono">
              🎯 核心职能
            </span>
            <span className="font-semibold text-slate-200 shrink-0">【{currentRole.title}】</span>
            <span className="text-slate-400 truncate">{currentRole.description.split(/[。！？\n]/)[0]}。</span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={() => setShowPromptEditor(!showPromptEditor)}
            title="自定义当前角色提示词与关联知识库"
            className={`p-1.5 rounded transition ${
              showPromptEditor ? 'text-amber-400 bg-amber-500/10' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Edit3 size={13} />
          </button>

          {/* 整体字号快速调节 */}
          {onIncreaseFont && onDecreaseFont && (
            <div className="flex items-center bg-slate-800/90 rounded border border-slate-700/80 px-1 py-0.5 text-[10px] text-slate-300 font-mono gap-0.5" title="整体界面字号调节">
              <button
                type="button"
                onClick={onDecreaseFont}
                className="px-1 hover:text-white rounded hover:bg-slate-700 transition font-bold"
                title="缩小整体字号 (A-)"
              >
                A-
              </button>
              <button
                type="button"
                onClick={onResetFont}
                className="px-0.5 text-amber-400 font-bold hover:bg-slate-700 rounded transition"
                title="点击恢复默认标准字号 (100%)"
              >
                {fontScale || 100}%
              </button>
              <button
                type="button"
                onClick={onIncreaseFont}
                disabled={(fontScale || 100) >= 200}
                className="px-1 hover:text-white rounded hover:bg-slate-700 transition font-bold disabled:opacity-30"
                title="放大整体字号 (A+)"
              >
                A+
              </button>
            </div>
          )}

          <button
            onClick={() => setAlwaysOnTop(!alwaysOnTop)}
            title={alwaysOnTop ? '始终置顶挂靠已开启' : '点击开启置顶挂靠'}
            className={`p-1.5 rounded transition ${
              alwaysOnTop ? 'text-cyan-400 bg-cyan-500/10' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Pin size={13} />
          </button>

          <button
            onClick={onToggleDockMode}
            title={isDockedMode ? '扩展为大屏工作台' : '挂靠桌面右侧边缘'}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white transition"
          >
            {isDockedMode ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>
      </div>

      {/* 2. Model Gateway & Provider Status Strip */}
      <div className="relative px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs gap-2 min-h-[38px]">
        {/* Active Model Pill: 鼠标指针只有放在模型那里才会显示高亮边框白色，不放在那里的时候是蓝色 */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => {
              const next = !showModelDrawer;
              setShowModelDrawer(next);
              if (next) loadModelsFromApi();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-blue-500 text-slate-200 hover:border-white hover:text-white hover:shadow-[0_0_8px_rgba(255,255,255,0.4)] transition truncate font-mono text-xs cursor-pointer"
            title="点击展开大模型选用列表或自由输入新模型"
          >
            <span className="text-xs">
              {activeProvider === 'deepseek' ? '🐋' : activeProvider === 'openrouter' ? '🔀' : activeProvider === 'ollama' ? '🦙' : activeProvider === 'openai' ? '🤖' : '✨'}
            </span>
            <span className="font-semibold text-blue-400 capitalize">{activeProvider}:</span>
            <span className="truncate max-w-[120px] text-slate-100 font-medium">
              {activeModel.includes('/') ? activeModel.split('/')[1] : activeModel}
            </span>
            <ChevronDown size={11} className={`text-slate-400 transition-transform ${showModelDrawer ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 提示居中并与模型和知识库检索对齐 */}
        {toastMessage && (
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-40 px-3 py-0.5 rounded-full bg-slate-950/95 text-amber-300 border border-amber-500/60 text-xs font-medium shadow-xl shadow-black/80 backdrop-blur-md flex items-center gap-1.5 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="whitespace-nowrap">{toastMessage}</span>
          </div>
        )}

        {/* 知识库检索开启/关闭 (已删除调整亮度功能) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              const next = !enableRag;
              setEnableRag(next);
              showToast(next ? '🟢 知识库检索开启 (已挂载本地知识库秒级检索)' : '⚪ 知识库检索关闭 (纯大模型生成)');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition border cursor-pointer font-medium ${
              enableRag && selectedDatasetIds.length > 0
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900/60'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
            title="一键开启或关闭知识库混合检索"
          >
            <BookOpen size={11} className={enableRag && selectedDatasetIds.length > 0 ? 'text-emerald-400' : 'text-slate-500'} />
            <span>{enableRag && selectedDatasetIds.length > 0 ? '知识库检索开启' : '知识库检索关闭'}</span>
          </button>
        </div>
      </div>

      {/* 2.1 Model Quick Selector & Custom Latest Models Drawer */}
      {showModelDrawer && (
        <div className="p-2.5 bg-slate-900 border-b border-slate-800 animate-in slide-in-from-top-2 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5 text-xs">
              <span>业务大模型选用</span>
              <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                后端集中托管
              </span>
            </span>
            <button
              onClick={() => setShowModelDrawer(false)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          {/* Provider Tabs with readiness indicator */}
          <div className="grid grid-cols-5 gap-1 text-[11px]">
            {[
              { id: 'deepseek', label: 'DeepSeek', icon: '🐋' },
              { id: 'openrouter', label: 'OpenRouter', icon: '🔀' },
              { id: 'ollama', label: 'Ollama', icon: '🦙' },
              { id: 'openai', label: 'OpenAI', icon: '🤖' },
              { id: 'gemini', label: 'Gemini', icon: '✨' },
            ].map(p => {
              const isConfigured = Boolean(
                engineStatusData?.providers?.[p.id]?.configured ||
                (p.id === 'gemini' && engineStatusData?.geminiConfigured) ||
                p.id === 'ollama'
              );
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProvider(p.id as ModelProviderType);
                    const firstOfProv = allModels.find(m => m.provider === p.id);
                    if (firstOfProv) {
                      setActiveModel(firstOfProv.id);
                      onUpdateRole({
                        ...currentRole,
                        preferredModel: firstOfProv.id,
                        preferredProvider: p.id as ModelProviderType
                      });
                    }
                  }}
                  className={`py-1 px-1 rounded-md border text-center font-medium transition truncate relative ${
                    activeProvider === p.id
                      ? 'bg-blue-600/25 border-blue-500 text-blue-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={isConfigured ? '环境变量已配置，模型就绪' : '需在后端.env中配置API KEY'}
                >
                  <span>{p.icon}</span> <span className="hidden sm:inline">{p.label}</span>
                  {isConfigured && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Free-form Custom Model ID Input Bar */}
          <div className="flex items-center gap-1.5 p-1 rounded-md bg-slate-950 border border-slate-800">
            <input
              type="text"
              value={quickCustomModelInput}
              onChange={(e) => setQuickCustomModelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickApplyCustomModel();
                }
              }}
              placeholder="输入任意自定义最新模型代号 (如 deepseek-v4.1-flash)..."
              className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none font-mono px-1.5"
            />
            <button
              onClick={handleQuickApplyCustomModel}
              disabled={!quickCustomModelInput.trim()}
              className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-[11px] shrink-0 transition"
            >
              选用
            </button>
          </div>

          {/* Search filter for models */}
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={sidebarModelSearch}
              onChange={(e) => setSidebarModelSearch(e.target.value)}
              placeholder="搜索模型名称或特性..."
              className="w-full pl-7 pr-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/80"
            />
          </div>

          {/* Models list or Unconfigured Env notice */}
          {(() => {
            const isConfigured = Boolean(
              engineStatusData?.providers?.[activeProvider]?.configured ||
              (activeProvider === 'gemini' && engineStatusData?.geminiConfigured) ||
              activeProvider === 'ollama'
            );

            if (!isConfigured) {
              const envVar = engineStatusData?.providers?.[activeProvider]?.envVar || `${activeProvider.toUpperCase()}_API_KEY`;
              return (
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-center space-y-1.5">
                  <div className="text-xs text-amber-400 font-semibold flex items-center justify-center gap-1">
                    <span>🔒 后端未配置 {envVar}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                    系统默认集中托管 API Key。在服务器 <code className="text-amber-300 font-mono bg-slate-900 px-1 py-0.2 rounded">.env</code> 中配置 <code className="text-blue-300 font-mono font-semibold">{envVar}</code> 后，将自动同步并解锁该系列可用模型。
                  </div>
                  <div className="pt-0.5 flex flex-wrap justify-center gap-1.5">
                    {Object.entries(engineStatusData?.providers || {})
                      .filter(([id, p]: any) => p?.configured || id === 'ollama' || (id === 'gemini' && engineStatusData?.geminiConfigured))
                      .map(([id, p]: any) => (
                        <button
                          key={id}
                          onClick={() => {
                            setActiveProvider(id as ModelProviderType);
                            const first = allModels.find(m => m.provider === id);
                            if (first) {
                              setActiveModel(first.id);
                              onUpdateRole({
                                ...currentRole,
                                preferredModel: first.id,
                                preferredProvider: id as ModelProviderType
                              });
                            }
                          }}
                          className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[10px] hover:bg-emerald-900/70 transition font-medium"
                        >
                          切换已就绪: {p?.name || id}
                        </button>
                      ))}
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {allModels
                  .filter(m => m.provider === activeProvider)
                  .filter(m => {
                    if (!sidebarModelSearch.trim()) return true;
                    const q = sidebarModelSearch.toLowerCase();
                    return m.name.toLowerCase().includes(q) || 
                           m.id.toLowerCase().includes(q) || 
                           (m.description && m.description.toLowerCase().includes(q)) ||
                           m.capabilities.some(c => c.toLowerCase().includes(q)) ||
                           m.contextLength.toLowerCase().includes(q);
                  })
                  .map(m => (
                    <ModelItemRow
                      key={m.id}
                      model={m}
                      isSelected={activeModel === m.id}
                      onSelect={(selectedM) => {
                        setActiveModel(selectedM.id);
                        setActiveProvider(selectedM.provider);
                        onUpdateRole({
                          ...currentRole,
                          preferredModel: selectedM.id,
                          preferredProvider: selectedM.provider
                        });
                        setShowModelDrawer(false);
                        showToast(`已选用模型【${selectedM.name}】`);
                      }}
                      compact={false}
                    />
                  ))}
              </div>
            );
          })()}

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
            <span className="text-slate-500 text-[10px]">激活模型: <code className="text-amber-300 font-mono">{activeModel}</code></span>
            <span className="text-emerald-400 font-mono text-[10px]">
              ● 环境变量集中托管
            </span>
          </div>
        </div>
      )}

      {/* 3. Role Switcher Dropdown Drawer */}
      {showRoleDrawer && (
        <div className="p-2.5 bg-slate-900 border-b border-slate-800 animate-in slide-in-from-top-2 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              <span>切换业务角色</span>
              <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                点击即切换
              </span>
            </span>
            <button
              onClick={() => {
                setShowRoleDrawer(false);
                onNavigateToRoles();
              }}
              className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5"
            >
              <span>角色库管理</span>
              <ArrowRight size={10} />
            </button>
          </div>

          {/* Clean Role Cards Grid */}
          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
            {roles.map(r => {
              const isCurrent = currentRole.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    onSelectRole(r);
                    setShowRoleDrawer(false);
                    const targetModel = r.preferredModel || 'deepseek-v4.1-flash';
                    const targetProv = r.preferredProvider || 'deepseek';
                    setActiveModel(targetModel);
                    setActiveProvider(targetProv);
                    showToast(`已切换至【${r.name}】· 联动模型【${targetModel}】`);
                  }}
                  className={`p-1.5 rounded-lg text-left border transition flex items-center gap-2 cursor-pointer ${
                    isCurrent
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <span className="text-lg shrink-0">{r.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs truncate flex items-center justify-between">
                      <span className="truncate">{r.name}</span>
                      {isCurrent && <span className="text-[9px] bg-amber-500 text-slate-950 px-1 rounded font-bold ml-1">当前</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{r.category}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 仅在用户点击切换角色后才显示该角色的核心职能说明 */}
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 animate-in fade-in space-y-0.5">
            <div className="font-semibold text-amber-400 flex items-center gap-1.5">
              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px]">
                🎯 核心职能
              </span>
              <span className="text-slate-100 font-medium">【{currentRole.title}】</span>
            </div>
            <div className="text-slate-300 leading-relaxed text-[11px]">
              {currentRole.description.split(/[。！？\n]/)[0]}。
            </div>
          </div>
        </div>
      )}

      {/* 4. Custom Prompt & RAG Editor Drawer */}
      {showPromptEditor && (
        <div className="p-3.5 bg-slate-900 border-b border-slate-800 animate-in slide-in-from-top-2 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Edit3 size={13} className="text-amber-400" />
              <span>自定义【{currentRole.name}】系统提示词</span>
            </span>
            <button
              onClick={() => setShowPromptEditor(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              角色设定与系统提示词 (System Prompt):
            </label>
            <textarea
              rows={4}
              value={editedSystemPrompt}
              onChange={(e) => setEditedSystemPrompt(e.target.value)}
              placeholder="输入该角色的专业准则、沟通风格与输出结构要求..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
            />
          </div>

          {/* Associated Knowledge Bases */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400">关联 Dify 知识库数据集 (秒级混合检索):</label>
              <button
                onClick={onNavigateToKnowledge}
                className="text-[10px] text-cyan-400 hover:underline"
              >
                新建知识库
              </button>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {datasets.map(ds => {
                const checked = selectedDatasetIds.includes(ds.id);
                return (
                  <label
                    key={ds.id}
                    className="flex items-center gap-2 p-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] cursor-pointer hover:bg-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) {
                          setSelectedDatasetIds(selectedDatasetIds.filter(id => id !== ds.id));
                        } else {
                          setSelectedDatasetIds([...selectedDatasetIds, ds.id]);
                        }
                      }}
                      className="accent-amber-500 rounded"
                    />
                    <span className="truncate text-slate-300">{ds.name}</span>
                    <span className="text-[10px] text-slate-500 ml-auto">{ds.chunkCount}段</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>创造度 (Temp):</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={editedTemperature}
                onChange={(e) => setEditedTemperature(Number(e.target.value))}
                className="w-16 accent-amber-500 cursor-pointer h-1"
              />
              <span className="font-mono text-amber-400">{editedTemperature}</span>
            </div>

            <button
              onClick={handleSavePromptChanges}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20"
            >
              保存设定
            </button>
          </div>
        </div>
      )}

      {/* 5. Chat Messages List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs select-text">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 select-none">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mb-3 shadow-inner">
              {currentRole.avatar}
            </div>
            <div className="text-sm font-bold text-slate-200 mb-1">
              {currentRole.name} · {currentRole.title}
            </div>
            <div className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">
              {currentRole.description.split(/[。！？\n]/)[0]}。
            </div>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 px-3.5 py-1.5 rounded-lg border border-slate-800 font-mono">
              在下方输入框中提问，即刻开启实时对话
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`msg-in flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Meta */}
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500 font-mono">
              {msg.sender === 'user' ? (
                <span>我 · {msg.timestamp}</span>
              ) : (
                <>
                  <span className="text-amber-400 font-bold">{msg.roleAvatar} {msg.roleName}</span>
                  {msg.latencyMs && <span>{msg.latencyMs}ms</span>}
                  <span>{msg.timestamp}</span>
                </>
              )}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[95%] rounded-xl p-3 leading-relaxed shadow-md border ${
                msg.sender === 'user'
                  ? 'bg-amber-500/10 border-amber-500/30 text-slate-100 rounded-tr-none'
                  : 'bg-slate-900 border-slate-800 text-slate-200 rounded-tl-none'
              }`}
            >
              {msg.sender === 'ai' ? (
                renderCleanMessageText(msg.text)
              ) : (
                <div className="whitespace-pre-wrap font-sans text-xs">
                  {msg.text}
                </div>
              )}

              {/* Actions & Metrics for AI responses: Only Keep Copy, Latency, and Token Consumption, plus RAG Sources preview */}
              {msg.sender === 'ai' && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] relative">
                  {/* Left: Copy / Stop / Regenerate buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleCopyText(msg.text)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center gap-1 transition font-medium text-[10px] leading-4 border border-slate-700/60 shrink-0"
                      title="复制回复内容"
                    >
                      <Copy size={10} className="text-amber-400" />
                      <span>复制</span>
                    </button>

                    {/* 重新生成：仅最后一条回复可点（重跑该轮问答）；被打断的回复任何时候都可重跑 */}
                    {(isLastAiMessage(msg.id) || canRegenerate(msg.text)) && (
                      <button
                        onClick={() => handleRegenerate(msg.id)}
                        disabled={isLoading}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 hover:text-white flex items-center gap-1 transition font-medium text-[10px] leading-4 border border-slate-700/60 shrink-0"
                        title="使用同一提问重新生成回复"
                      >
                        <RotateCcw size={10} className="text-cyan-400" />
                        <span>重新生成</span>
                      </button>
                    )}

                    {/* 停止生成：仅在生成中的那一条回复上出现 */}
                    {isLoading && isLastAiMessage(msg.id) && (
                      <button
                        onClick={handleStopGeneration}
                        className="px-2 py-0.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-200 hover:text-white flex items-center gap-1 transition font-medium text-[10px] leading-4 border border-rose-500/40 shrink-0"
                        title="立即中止当前生成"
                      >
                        <Square size={9} className="fill-rose-300 text-rose-300" />
                        <span>停止生成</span>
                      </button>
                    )}
                  </div>

                  {/* Middle: 统一链接：“引用知识库来源” 悬浮窗预览交互（只取决于该条回复是否带有引用，关闭知识库检索不会移除已输出回复的引用） */}
                  {msg.citations && msg.citations.length > 0 && (
                    <KnowledgeCitationSourcePopover
                      citations={msg.citations}
                      onOpenPreview={(c) => setActiveCitationChunk(c)}
                    />
                  )}

                  {/* Right: Latency & Tokens */}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 shrink-0 ml-auto">
                    <span className="flex items-center gap-1" title="大模型生成耗时">
                      <Clock size={11} className="text-cyan-400" />
                      <span>回复时长: {msg.latencyMs ? `${(msg.latencyMs / 1000).toFixed(2)}s` : '0.85s'}</span>
                    </span>
                    <span className="flex items-center gap-1" title="消耗Token数量">
                      <Zap size={11} className="text-amber-400" />
                      <span>Token消耗: {msg.tokensUsed || Math.max(45, Math.round((msg.text?.length || 0) * 1.35))}</span>
                    </span>
                  </div>
                </div>
              )}

            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0" />
            <span className="flex-1 min-w-0">
              {enableRag 
                ? `【${currentRole.name}】正在执行混合检索与大模型生成...`
                : `【${currentRole.name}】已跳过知识库检索，正在直接调用大模型极速生成...`
              }
            </span>
            <button
              onClick={handleStopGeneration}
              className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-200 hover:text-white flex items-center gap-1 transition font-bold text-[10px] leading-4 border border-rose-500/40 shrink-0"
              title="立即中止当前生成"
            >
              <Square size={9} className="fill-rose-300 text-rose-300" />
              <span>停止生成</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Area */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`对【${currentRole.name}】输入业务问题或按快捷键...`}
              className="flex-1 bg-slate-950 text-slate-100 text-xs border border-slate-800 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 placeholder:text-slate-500 shadow-inner"
            />

            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-3.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 transition shadow-lg shadow-amber-500/20 shrink-0"
            >
              <Send size={12} />
              <span>发送</span>
            </button>
          </div>

          <div className="flex items-center justify-end text-[10px] text-slate-500 px-1">
            <span className="text-emerald-400">0.02s 混合检索</span>
          </div>
        </form>
      </div>

      {/* Citation Details & Snippet Preview Modal */}
      {activeCitationChunk && (
        <CitationSnippetPreviewModal
          isOpen={!!activeCitationChunk}
          onClose={() => setActiveCitationChunk(null)}
          citation={activeCitationChunk}
          onToast={showToast}
          onSaveCitation={handleUpdateCitationChunk}
        />
      )}
    </div>
  );
};
