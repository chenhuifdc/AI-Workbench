import React, { useState } from 'react';
import {
  Trash2, ShieldCheck, AlertTriangle, Database, RefreshCw,
  CheckCircle2, X, HardDrive
} from 'lucide-react';

/**
 * 本地缓存清理卡片
 * - 清理：大模型列表缓存、MCP 配置与缓存、社交应用接入配置、Ollama 地址、字体缩放等本地缓存
 * - 保留：AI 业务工作台的对话记录、设置导航记录（设置 → 子功能 → 返回工作台 的停留记录）、角色与提示词自定义
 */

/** 必须保留的本地键 */
export const PRESERVED_KEYS = [
  'finai_chat_history_v1',   // 对话记录
  'finai_nav_state_v1',      // 设置导航记录
  'finai_roles_v1',          // 角色与提示词自定义
  'finai_current_role_id',   // 当前角色
];
const PRESERVED_PREFIXES = ['finai_chat_history_v1'];

const KEY_LABELS: Record<string, string> = {
  app_font_scale: '界面字体缩放',
  finai_ollama_endpoint: 'Ollama 本地服务地址',
  finai_custom_models_v1: '大模型列表缓存',
  mcp_servers_config: 'MCP 服务器配置',
  mcp_tools_list: 'MCP 工具缓存',
  mcp_resources_list: 'MCP 资源缓存',
  mcp_prompts_list: 'MCP 提示词缓存',
  tg_api_id: 'Telegram API ID',
  tg_api_hash: 'Telegram API Hash',
  tg_bot_token: 'Telegram Bot Token',
  tg_conn_status: 'Telegram 连接状态',
};

export const isPreservedKey = (key: string): boolean =>
  PRESERVED_KEYS.includes(key) || PRESERVED_PREFIXES.some(p => key.startsWith(p));

const listCacheKeys = (): string[] => {
  try { return Object.keys(localStorage).filter(k => !isPreservedKey(k)); } catch { return []; }
};

const labelOf = (key: string): string => KEY_LABELS[key] || '其它本地缓存';

const sizeOf = (keys: string[]): number => {
  let total = 0;
  for (const k of keys) {
    try { total += (localStorage.getItem(k) || '').length; } catch {}
  }
  return total;
};

const fmtSize = (n: number): string => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

interface LocalCacheCleanupCardProps {
  onToast?: (msg: string) => void;
}

export const LocalCacheCleanupCard: React.FC<LocalCacheCleanupCardProps> = ({ onToast }) => {
  const [confirming, setConfirming] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [clearedInfo, setClearedInfo] = useState<string | null>(null);

  const cacheKeys = listCacheKeys();
  const cacheSize = sizeOf(cacheKeys);
  const grouped = cacheKeys.reduce<Record<string, number>>((acc, k) => {
    const label = labelOf(k);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const handleClean = () => {
    setCleaning(true);
    let removed = 0;
    let freed = 0;
    for (const k of listCacheKeys()) {
      try {
        freed += (localStorage.getItem(k) || '').length;
        localStorage.removeItem(k);
        removed++;
      } catch {}
    }
    const msg = `已清理 ${removed} 项本地缓存（约 ${fmtSize(freed)}）：对话记录、设置导航记录与角色自定义均已保留`;
    setClearedInfo(msg);
    setConfirming(false);
    onToast?.(`🧹 ${msg}`);
    // 重新加载以让所有模块以干净状态初始化（对话记录与导航记录会从本地恢复）
    setTimeout(() => {
      setCleaning(false);
      try { window.location.reload(); } catch {}
    }, 1400);
  };

  return (
    <div className="col-span-1 md:col-span-2 rounded-2xl border border-rose-500/30 bg-rose-950/15 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0">
            <HardDrive size={18} />
          </div>
          <div>
            <h4 className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
              <span>清理本地缓存</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                localStorage
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              清理大模型列表、MCP、社交接入与界面缩放等本地缓存；<span className="text-emerald-300">对话记录与设置导航记录不会被清理</span>。
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] text-slate-500 font-mono">可清理占用</div>
          <div className="font-mono font-bold text-rose-300 text-xs">
            {cacheKeys.length} 项 · {fmtSize(cacheSize)}
          </div>
        </div>
      </div>

      {/* 缓存明细 */}
      {cacheKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(grouped).map(([label, count]) => (
            <span
              key={label}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-950/70 text-slate-300 border-slate-800"
            >
              {label} × {count}
            </span>
          ))}
        </div>
      )}

      {clearedInfo && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-[11px] text-emerald-300">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
          <span>{clearedInfo}</span>
        </div>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => { setConfirming(true); setClearedInfo(null); }}
          disabled={cacheKeys.length === 0 || cleaning}
          className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-rose-500/20 cursor-pointer"
        >
          <Trash2 size={13} />
          <span>{cacheKeys.length === 0 ? '暂无可清理缓存' : '清理本地缓存'}</span>
        </button>
      ) : (
        <div className="space-y-2.5 p-3 rounded-xl bg-slate-950/80 border border-rose-500/40">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
            <AlertTriangle size={13} />
            <span>确认清理以下本地缓存？（不可撤销）</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/60">
              <div className="flex items-center gap-1.5 text-rose-300 font-semibold mb-1">
                <Trash2 size={11} />
                <span>将清理（{cacheKeys.length} 项）</span>
              </div>
              <ul className="space-y-0.5 text-slate-300 font-mono">
                {Object.keys(grouped).map(label => (
                  <li key={label}>· {label}</li>
                ))}
              </ul>
            </div>

            <div className="p-2 rounded-lg bg-emerald-950/25 border border-emerald-900/60">
              <div className="flex items-center gap-1.5 text-emerald-300 font-semibold mb-1">
                <ShieldCheck size={11} />
                <span>将保留</span>
              </div>
              <ul className="space-y-0.5 text-slate-300 font-mono">
                <li>· AI 业务工作台对话记录</li>
                <li>· 设置导航记录（设置/子功能停留位置）</li>
                <li>· 角色与系统提示词自定义</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClean}
              disabled={cleaning}
              className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
            >
              {cleaning ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
              <span>{cleaning ? '正在清理并刷新…' : '确认清理'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={cleaning}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
            >
              <X size={12} />
              <span>取消</span>
            </button>
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 ml-auto">
              <Database size={10} />
              键值存储
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
