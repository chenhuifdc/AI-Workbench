import React, { useState } from 'react';
import { 
  Terminal, Search, Sparkles, Cpu, Cloud, Check, 
  ArrowRight, ShieldCheck, DollarSign, Clock, Layers,
  ExternalLink, Play
} from 'lucide-react';
import { ALL_COMMANDS } from '../data/commands';
import { CommandItem } from '../types';

interface CommandVocabularyManualProps {
  onSelectCommandForSidebar: (cmd: string, examplePrompt: string) => void;
}

export const CommandVocabularyManual: React.FC<CommandVocabularyManualProps> = ({
  onSelectCommandForSidebar
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredCommands = ALL_COMMANDS.filter(cmd => {
    if (categoryFilter !== 'all' && cmd.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        cmd.code.toLowerCase().includes(q) ||
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.model.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  return (
    <div className="p-6 space-y-6 text-slate-100 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Terminal size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>金融AI完整命令词库全景手册</span>
              <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                22+ 预设核心指令
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              包含本地纯CPU免审核大模型、角色专家矩阵、多国同传与云端高算力按量计费多媒体
            </p>
          </div>
        </div>

        {/* Architecture Reminder */}
        <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 max-w-md">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-0.5">
            <Cpu size={14} />
            <span>纯CPU (无独显) 与云端 API 严密分工逻辑</span>
          </div>
          <span className="text-slate-400 text-[11px] leading-relaxed">
            文本与向量检索在本地32G内存8核CPU运行 (0元极速响应)；生图与视频由云端API集群秒级处理，杜绝本地显存不足死机。
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'all', label: `全部命令 (${ALL_COMMANDS.length})` },
            { id: 'local_cpu', label: '本地极速与深度推演 (CPU)' },
            { id: 'role_expert', label: '全套角色专家库 (CPU)' },
            { id: 'translation', label: '多国金融翻译 (CPU)' },
            { id: 'cloud_media', label: '云端高算力多媒体 (API)' },
            { id: 'cloud_search', label: '实时大盘联网 (API)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                categoryFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索命令代码、模型或名称..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Commands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCommands.map((cmd) => (
          <div
            key={cmd.code}
            className={`bg-slate-900/80 border rounded-2xl p-4.5 space-y-3.5 transition group hover:shadow-xl ${
              cmd.isCloud
                ? 'border-indigo-900/50 hover:border-indigo-500/50'
                : 'border-slate-800 hover:border-amber-500/50'
            }`}
          >
            {/* Top Code Badge & Model */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCode(cmd.code)}
                  title="点击复制命令代码"
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono font-bold text-sm hover:bg-amber-500/30 transition flex items-center gap-1"
                >
                  <span>{cmd.code}</span>
                  {copiedCode === cmd.code && <Check size={12} className="text-emerald-400" />}
                </button>
                <span className="font-bold text-slate-100 text-sm">{cmd.name}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {cmd.isCloud ? (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/40 flex items-center gap-1">
                    <Cloud size={10} />
                    <span>云端API</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                    <Cpu size={10} />
                    <span>本地CPU</span>
                  </span>
                )}
                {cmd.isUncensored && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/40">
                    免审核
                  </span>
                )}
              </div>
            </div>

            {/* Description & Guide */}
            <div className="text-xs text-slate-300 leading-relaxed min-h-[38px]">
              {cmd.description}
            </div>

            {/* Metrics: Model, Cost, Latency */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">部署与模型:</span>
                <span className="text-slate-300 font-mono truncate max-w-[170px]">{cmd.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">单次成本:</span>
                <span className="font-mono font-bold text-amber-400">{cmd.cost}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">平均响应:</span>
                <span className="text-slate-300 font-mono">{cmd.latency}</span>
              </div>
            </div>

            {/* Sample prompt snippet */}
            <div className="text-[11px] bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 text-slate-400">
              <span className="text-slate-500 block text-[10px] mb-0.5">测试范例：</span>
              <p className="line-clamp-2 italic text-slate-300">“{cmd.examplePrompt}”</p>
            </div>

            {/* Bottom Actions */}
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">支持直接在侧边栏触发</span>
              <button
                onClick={() => onSelectCommandForSidebar(cmd.code, cmd.examplePrompt)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1 transition shadow-md shadow-amber-500/10"
              >
                <Play size={11} fill="currentColor" />
                <span>在侧边栏运行</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
