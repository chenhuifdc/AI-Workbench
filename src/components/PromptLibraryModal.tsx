import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Plus, Library } from 'lucide-react';
import { AIRole } from '../types';

interface LibPrompt { a: string; p: string; d: boolean; t: string; }

interface Props {
  roles: AIRole[];
  onUpdateRoles: (roles: AIRole[]) => void;
  onClose: () => void;
}

const PAGE = 40;

/** prompts.chat 提示词库（来源：github.com/chenhuifdc/prompts.chat，CC0 公共领域） */
export const PromptLibraryModal: React.FC<Props> = ({ roles, onUpdateRoles, onClose }) => {
  const [items, setItems] = useState<LibPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [onlyDev, setOnlyDev] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/prompts-chat.json')
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: LibPrompt[]) => setItems(d))
      .catch(e => setError(`提示词库加载失败：${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items.filter(i =>
      (!onlyDev || i.d) && (!k || i.a.toLowerCase().includes(k) || i.p.toLowerCase().includes(k)));
  }, [items, q, onlyDev]);

  useEffect(() => setLimit(PAGE), [q, onlyDev]);

  const existing = useMemo(() => new Set(roles.map(r => r.id)), [roles]);
  const idOf = (i: LibPrompt) => `role-pc-${i.a.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')}`;

  const addRole = (i: LibPrompt) => {
    const id = idOf(i);
    if (existing.has(id)) { setToast(`「${i.a}」已在角色列表中`); return; }
    const role: AIRole = {
      id,
      code: `pc${roles.length + 1}`,
      name: i.a,
      title: 'prompts.chat 提示词库',
      avatar: '📚',
      category: '提示词库',
      description: i.p.slice(0, 80) + (i.p.length > 80 ? '…' : ''),
      systemPrompt: i.p,
      temperature: 0.7,
      knowledgeBaseIds: [],
      isCustom: true,
      welcomeMessage: `已载入提示词库角色「${i.a}」，请开始提问。`,
      samplePrompts: [],
    };
    onUpdateRoles([...roles, role]);
    setToast(`✅ 已添加角色「${i.a}」`);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100 font-bold">
            <Library size={18} />
            <span>prompts.chat 提示词库</span>
            <span className="text-xs text-slate-400 font-normal">
              {loading ? '加载中…' : `共 ${items.length} 条，匹配 ${filtered.length} 条`}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-3 flex gap-3 items-center border-b border-slate-800">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="搜索角色名或提示词内容（英文关键词，如 translator）"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100"
            />
          </div>
          <label className="text-xs text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
            <input type="checkbox" checked={onlyDev} onChange={e => setOnlyDev(e.target.checked)} />
            仅开发者向
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {error && <div className="text-red-400 text-sm">{error}</div>}
          {filtered.slice(0, limit).map(i => (
            <div key={i.a + i.p.length} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="font-bold text-sm text-slate-100">{i.a}</div>
                <button
                  onClick={() => addRole(i)}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs flex items-center gap-1 shrink-0"
                >
                  <Plus size={12} />添加为角色
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 whitespace-pre-wrap">
                {i.p.length > 260 ? i.p.slice(0, 260) + '…' : i.p}
              </p>
            </div>
          ))}
          {!loading && filtered.length === 0 && !error && (
            <div className="text-center text-slate-500 text-sm py-10">没有匹配的提示词</div>
          )}
          {limit < filtered.length && (
            <button
              onClick={() => setLimit(l => l + PAGE)}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
            >
              加载更多（还剩 {filtered.length - limit} 条）
            </button>
          )}
        </div>
        {toast && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};
