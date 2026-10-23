import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Copy, Check, ShieldCheck, AlertTriangle, Sparkles, 
  Settings, ChevronRight, ChevronDown, Layers, Terminal, 
  RotateCcw, Sliders, Eye, EyeOff, Image, Video, Globe, 
  UserCheck, HelpCircle, FileText, Download, ExternalLink,
  Minimize2, Maximize2, ShieldAlert, Clock, Zap
} from 'lucide-react';
import { ALL_COMMANDS } from '../data/commands';
import { INITIAL_SEATS } from '../data/seats';
import { ChatMessage, ClientSeat, CommandItem } from '../types';
import { PosterModal } from './PosterModal';
import { FaceSwapModal } from './FaceSwapModal';
import { NETWORK_FAULT_REPORT, API_KEY_MISSING, MAX_RETRIES, REQUEST_TIMEOUT_MS } from '../utils/networkReport';

// 3 次重试 × 300 秒 + 退避(1+2+4 秒) 的总时限
const TOTAL_REQUEST_BUDGET_MS = (MAX_RETRIES + 1) * REQUEST_TIMEOUT_MS + 10000;


interface SidebarClientProps {
  currentSeat: ClientSeat;
  onSeatChange: (seat: ClientSeat) => void;
  onNavigateTab?: (tab: string) => void;
}

export const SidebarClient: React.FC<SidebarClientProps> = ({
  currentSeat,
  onSeatChange,
  onNavigateTab
}) => {
  // Sidebar presentation settings
  const [isDockedMode, setIsDockedMode] = useState(true);
  const [opacity, setOpacity] = useState(100);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [inputCommand, setInputCommand] = useState('we');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'local' | 'role' | 'media' | 'search'>('all');
  const [showCommandDrawer, setShowCommandDrawer] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal previews
  const [posterModalData, setPosterModalData] = useState<{ isOpen: boolean; command: string; prompt: string } | null>(null);
  const [faceSwapModalData, setFaceSwapModalData] = useState<{ isOpen: boolean; command: string; prompt: string } | null>(null);

  // Conversation history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      seatId: currentSeat.seatId,
      seatName: currentSeat.name,
      command: 'we',
      text: `【金融AI业务侧边栏已挂靠】\n您当前登录席位：【${currentSeat.seatId} - ${currentSeat.name} (${currentSeat.department})】\n当前中央服务器：32G纯CPU专用调度集群（无独显超低功耗部署）。\n\n💡 快速提示：\n- 输入 \`we\` 快速问答，结构化直接复制给客户；\n- 输入 \`ww\` 深度推演宏微观思维链逻辑；\n- 输入 \`rg\` / \`rf\` / \`rm\` 切换投顾、风控与销冠视角；\n- 输入 \`tu\` / \`cn\` 云端生成金融展业海报；\n- 欢迎直接点击下方快捷标签或输入需求！`,
      timestamp: '09:00:00',
      isRealAi: false,
      latencyMs: 120
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('✅ 已复制到剪贴板！微信/CRM中直接按 Ctrl+V 粘贴');
  };

  const handleAppendDisclaimer = (msgId: string) => {
    const disclaimer = '\n\n【合规免责声明】理财非存款，产品有风险，投资须谨慎。过往业绩不代表未来表现，本交流资料仅供参考，不作为任何投资承诺或法律要约。';
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: m.text + disclaimer } : m));
    showToast('🛡️ 已插入标准资管合规免责声明');
  };

  const handleAuditCompliance = (text: string) => {
    const banned = ['保本', '保息', '稳赚', '零风险', '100%收益', '包赚不赔', '绝对收益'];
    const hits = banned.filter(w => text.includes(w));
    if (hits.length > 0) {
      showToast(`⚠️ 合规告警：检测到敏感禁用词【${hits.join('、')}】，请务必修改后再发给客户！`);
    } else {
      showToast('🟢 合规初审通过：未检测到刚性兑付承诺等绝对化禁用词！');
    }
  };

  const handleSend = async (overridePrompt?: string, overrideCmd?: string) => {
    const promptToSend = overridePrompt !== undefined ? overridePrompt : inputText;
    const cmdToSend = (overrideCmd || inputCommand || 'we').toLowerCase().trim();

    if (!promptToSend.trim()) return;

    // Check media commands that trigger special visual modals
    if (['tu', 'p', 'tt', 'cn', 'ph', 'ss'].includes(cmdToSend)) {
      setPosterModalData({
        isOpen: true,
        command: cmdToSend,
        prompt: promptToSend
      });
    } else if (['tr', 'sp', 'spp', 'sc', 'scc'].includes(cmdToSend)) {
      setFaceSwapModalData({
        isOpen: true,
        command: cmdToSend,
        prompt: promptToSend
      });
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      seatId: currentSeat.seatId,
      seatName: currentSeat.name,
      command: cmdToSend,
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (overridePrompt === undefined) setInputText('');
    setIsLoading(true);

    // Call /api/chat with maximum 3 retries and 300 seconds timeout
    let chatSuccess = false;
    let finalData: any = null;
    let lastErrorMsg = NETWORK_FAULT_REPORT;

    // 服务端已实现 3 次指数退避重试（单次 300 秒）；前端仅发起一次请求并给出足够的总时限，避免重试叠加
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOTAL_REQUEST_BUDGET_MS);
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            command: cmdToSend,
            prompt: promptToSend,
            seat: currentSeat.seatId,
            seatName: currentSeat.name
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
    }

    if (chatSuccess && finalData) {
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'ai',
        seatId: currentSeat.seatId,
        seatName: currentSeat.name,
        command: cmdToSend,
        text: finalData.text,
        timestamp: new Date().toLocaleTimeString(),
        isRealAi: finalData.isRealAi,
        latencyMs: finalData.latencyMs
      };
      setMessages(prev => [...prev, aiMsg]);
    } else {
      const fallbackMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        seatId: currentSeat.seatId,
        seatName: currentSeat.name,
        command: cmdToSend,
        text: lastErrorMsg,
        timestamp: new Date().toLocaleTimeString(),
        isRealAi: false,
        latencyMs: 140
      };
      setMessages(prev => [...prev, fallbackMsg]);
    }
    setIsLoading(false);
  };

  // Quick preset templates
  const PRESET_QUICK_CARDS = [
    { title: '固收+回撤安抚', cmd: 'we', text: '客户询问固收+理财产品为什么最近有微调回撤，请用两句话安抚客户情绪并讲清底层安全垫。' },
    { title: '适当性合规拦截', cmd: 'rf', text: '客户风险测评为R2稳健型，但强烈要求购买R4激进股票量化私募，如何合规拒绝与疏导？' },
    { title: '销冠化解定存异议', cmd: 'rm', text: '客户说：“钱存银行定期4%很安全，为什么要买你们的公募基金？”请提供销冠高情商话术。' },
    { title: '家族信托财产隔离', cmd: 'rp', text: '企业家客户担心企业经营风险波及个人家庭资产，咨询家族信托的财产独立与破产隔离效力？' },
    { title: '资产配置思维链', cmd: 'ww', text: '客户准备投入1000万做家庭中长期资产配置，请展示思维链，推演哑铃型配置矩阵。' },
    { title: '展业海报生成', cmd: 'cn', text: '设计一张东方国潮风的中秋客户高端财富沙龙闭门邀约海报，金墨与山水意境。' },
  ];

  return (
    <div className={`relative transition-all duration-300 flex flex-col h-full bg-slate-950 ${
      isDockedMode ? 'max-w-[420px] w-full border-l border-slate-800 shadow-2xl ml-auto' : 'w-full'
    }`} style={{ opacity: opacity / 100 }}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="absolute top-16 left-4 right-4 z-50 bg-amber-500 text-slate-950 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xl border border-amber-400 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Client Header Bar (Windows Frameless Style) */}
      <div className="px-4 py-3 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20">
            <span className="font-bold text-slate-950 text-xs">融</span>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>金融AI业务侧边栏</span>
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-mono">
                v2.4 绿色免安装
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>内存仅占 30MB · 中央服务器已连通</span>
            </div>
          </div>
        </div>

        {/* Window Utility Controls */}
        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={() => setIsDockedMode(!isDockedMode)}
            title={isDockedMode ? '切换为大屏工作台模式' : '挂靠桌面右侧 (380px) 模式'}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-slate-200 transition"
          >
            {isDockedMode ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          
          <button
            onClick={() => setAlwaysOnTop(!alwaysOnTop)}
            title={alwaysOnTop ? '已开启始终置顶' : '置顶已关闭'}
            className={`p-1.5 rounded transition ${alwaysOnTop ? 'text-amber-400 bg-amber-500/10' : 'hover:bg-slate-800'}`}
          >
            <Layers size={13} />
          </button>

          <button
            onClick={() => setShowCommandDrawer(!showCommandDrawer)}
            title="全部命令词速查库"
            className="p-1.5 rounded hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <Terminal size={13} />
          </button>
        </div>
      </div>

      {/* Seat Picker & Fast Config Bar */}
      <div className="px-3.5 py-2 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-slate-400 text-[11px] shrink-0">当前席位:</span>
          <select
            value={currentSeat.seatId}
            onChange={(e) => {
              const found = INITIAL_SEATS.find(s => s.seatId === e.target.value);
              if (found) onSeatChange(found);
            }}
            className="bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded px-2 py-1 text-xs truncate focus:outline-none focus:border-amber-500/50"
          >
            {INITIAL_SEATS.map(seat => (
              <option key={seat.seatId} value={seat.seatId}>
                {seat.seatId} · {seat.name} ({seat.department})
              </option>
            ))}
          </select>
        </div>

        {/* Opacity slider toggle */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
          <Sliders size={12} className="text-slate-500" />
          <input
            type="range"
            min="65"
            max="100"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-14 accent-amber-500 cursor-pointer h-1"
            title={`窗口半透明度: ${opacity}%`}
          />
          <span className="font-mono text-[10px] w-6 text-right">{opacity}%</span>
        </div>
      </div>

      {/* Quick Command Trigger Chips */}
      <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800/80 overflow-x-auto no-scrollbar flex items-center gap-1.5 text-xs">
        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider shrink-0 mr-1">快捷:</span>
        {[
          { code: 'we', label: '极速问答', badge: 'CPU' },
          { code: 'ww', label: '思考精聊', badge: 'CoT' },
          { code: 'rg', label: '投顾专家', badge: '角色' },
          { code: 'rf', label: '合规风控', badge: '审查' },
          { code: 'rm', label: '理财销冠', badge: '话术' },
          { code: 'rt', label: '量化交易', badge: 'K线' },
          { code: 'usn', label: '英文同传', badge: '译' },
          { code: 'tu', label: '文生图', badge: '云端' },
          { code: 'net', label: '实时大盘', badge: '联网' }
        ].map(item => (
          <button
            key={item.code}
            onClick={() => setInputCommand(item.code)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition shrink-0 flex items-center gap-1 border ${
              inputCommand === item.code
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            <span className="font-mono font-bold text-amber-400">{item.code}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Slide-out Full Command Drawer */}
      {showCommandDrawer && (
        <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs animate-in slide-in-from-top duration-200">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Terminal size={14} className="text-amber-400" />
              <span>涵盖完整金融命令词库 (点击即填入)</span>
            </span>
            <button
              onClick={() => setShowCommandDrawer(false)}
              className="text-slate-400 hover:text-white"
            >
              收起
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {ALL_COMMANDS.map(c => (
              <button
                key={c.code}
                onClick={() => {
                  setInputCommand(c.code);
                  setShowCommandDrawer(false);
                }}
                className={`p-1.5 rounded text-left border transition text-[11px] ${
                  inputCommand === c.code
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-400">{c.code}</span>
                  <span className={`text-[9px] px-1 rounded ${c.isCloud ? 'bg-indigo-950 text-indigo-300' : 'bg-emerald-950 text-emerald-300'}`}>
                    {c.isCloud ? '云端' : 'CPU'}
                  </span>
                </div>
                <div className="text-[10px] truncate text-slate-400">{c.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Sender Meta Header */}
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500 font-mono">
              {msg.sender === 'user' ? (
                <>
                  <span>{msg.seatId} · {msg.seatName}</span>
                  <span className="px-1 rounded bg-slate-800 text-amber-300 font-bold uppercase">
                    [{msg.command}]
                  </span>
                  <span>{msg.timestamp}</span>
                </>
              ) : (
                <>
                  <span className="px-1 rounded bg-amber-500/20 text-amber-400 font-bold uppercase border border-amber-500/30">
                    OLLAMA·QWEN2.5:7B
                  </span>
                  {msg.latencyMs && <span>耗时 {msg.latencyMs}ms</span>}
                  <span>{msg.timestamp}</span>
                </>
              )}
            </div>

            {/* Message Bubble Content */}
            <div
              className={`max-w-[95%] rounded-xl p-3 leading-relaxed shadow-md border ${
                msg.sender === 'user'
                  ? 'bg-amber-500/10 border-amber-500/30 text-slate-100 rounded-tr-none'
                  : 'bg-slate-900 border-slate-800 text-slate-200 rounded-tl-none'
              }`}
            >
              <div className="font-sans text-xs leading-relaxed select-text">
                {(() => {
                  let cleaned = (msg.text || '')
                    .replace(/\*\*(.*?)\*\*/g, '$1')
                    .replace(/\*(.*?)\*/g, '$1')
                    .replace(/__(.*?)__/g, '$1')
                    .replace(/_(.*?)_/g, '$1')
                    .replace(/^#+\s*/gm, '')
                    .replace(/^[\*\-\+]\s+/gm, '')
                    .replace(/^\s*[-=_─]{3,}\s*$/gm, '')
                    .replace(/[┌┐└┘│─╔╗║╚╝═█▍▌■◆▶◀▲▼★☆]/g, '');

                  return cleaned.split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={idx} className="h-1.5" />;
                    return (
                      <div key={idx} className="whitespace-pre-wrap leading-relaxed py-0.5">
                        {line}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Special Action Buttons for AI responses: Only Keep Copy, Latency, and Token Consumption */}
              {msg.sender === 'ai' && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(msg.text)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center gap-1.5 transition text-xs font-medium border border-slate-700/60"
                      title="复制回复"
                    >
                      <Copy size={12} className="text-amber-400" />
                      <span>复制</span>
                    </button>

                    {/* If command was media related */}
                    {Boolean(msg.command && ['tu', 'p', 'tt', 'cn', 'ph', 'ss'].includes(msg.command)) && (
                      <button
                        onClick={() => setPosterModalData({ isOpen: true, command: msg.command || 'tu', prompt: msg.text })}
                        className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 flex items-center gap-1 border border-amber-500/40 text-[10px]"
                      >
                        <Image size={11} />
                        <span>查看海报</span>
                      </button>
                    )}

                    {Boolean(msg.command && ['tr', 'sp', 'spp', 'sc', 'scc'].includes(msg.command)) && (
                      <button
                        onClick={() => setFaceSwapModalData({ isOpen: true, command: msg.command || 'tr', prompt: msg.text })}
                        className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 flex items-center gap-1 border border-indigo-500/40 text-[10px]"
                      >
                        <UserCheck size={11} />
                        <span>换脸视频预览</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1" title="回复时长">
                      <Clock size={11} className="text-cyan-400" />
                      <span>回复时长: {msg.latencyMs ? `${(msg.latencyMs / 1000).toFixed(2)}s` : '0.82s'}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Token消耗">
                      <Zap size={11} className="text-amber-400" />
                      <span>Token消耗: {msg.tokensUsed || Math.max(40, Math.round((msg.text?.length || 0) * 1.35))}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <span>中央服务器 (纯CPU 8核) 正在执行推演与向量匹配...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Fast Template Chips */}
      <div className="px-3.5 py-1.5 bg-slate-900/40 border-t border-slate-800/60 overflow-x-auto no-scrollbar flex items-center gap-1.5">
        <span className="text-[10px] text-slate-500 shrink-0">模版:</span>
        {PRESET_QUICK_CARDS.map((card, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(card.text, card.cmd)}
            className="px-2 py-0.5 rounded text-[10px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0 border border-slate-700/60 transition"
          >
            {card.title}
          </button>
        ))}
      </div>

      {/* Input & Dispatch Control Section */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            {/* Command Trigger Dropdown Selector */}
            <div className="relative">
              <select
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                className="appearance-none bg-slate-950 text-amber-400 font-mono font-bold text-xs border border-amber-500/40 rounded-lg px-2.5 py-2 pr-6 focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
              >
                {ALL_COMMANDS.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-3 pointer-events-none text-amber-500/70" />
            </div>

            {/* Main Prompt Input Box */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`输入业务疑问，当前命令：${inputCommand} (${ALL_COMMANDS.find(c => c.code === inputCommand)?.name || ''})...`}
              className="flex-1 bg-slate-950 text-slate-100 text-xs border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/80 placeholder:text-slate-500 shadow-inner"
            />

            {/* Execute Button */}
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 transition shadow-lg shadow-amber-500/20 shrink-0"
            >
              <Send size={12} />
              <span>发送</span>
            </button>
          </div>

          {/* Bottom Help Tips */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
            <span className="truncate">
              当前模型：{ALL_COMMANDS.find(c => c.code === inputCommand)?.model || 'qwen2.5:7b'}
            </span>
            <span className="text-amber-500/80 font-mono shrink-0">
              {ALL_COMMANDS.find(c => c.code === inputCommand)?.cost || '0元'}
            </span>
          </div>
        </form>
      </div>

      {/* Poster Modal */}
      {posterModalData && (
        <PosterModal
          isOpen={posterModalData.isOpen}
          onClose={() => setPosterModalData(null)}
          command={posterModalData.command}
          prompt={posterModalData.prompt}
          advisorName={currentSeat.name}
        />
      )}

      {/* Face Swap / Video Modal */}
      {faceSwapModalData && (
        <FaceSwapModal
          isOpen={faceSwapModalData.isOpen}
          onClose={() => setFaceSwapModalData(null)}
          command={faceSwapModalData.command}
          prompt={faceSwapModalData.prompt}
          seatName={currentSeat.name}
        />
      )}
    </div>
  );
};
