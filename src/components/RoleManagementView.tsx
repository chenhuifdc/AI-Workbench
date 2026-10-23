import React, { useState } from 'react';
import { 
  Users, Plus, Edit3, Trash2, Check, Sparkles, 
  Terminal, Sliders, BookOpen, ArrowRight, ShieldCheck,
  RotateCcw, Copy
} from 'lucide-react';
import { AIRole, DifyDataset } from '../types';
import { PromptLibraryModal } from './PromptLibraryModal';

interface RoleManagementViewProps {
  roles: AIRole[];
  onUpdateRoles: (roles: AIRole[]) => void;
  datasets: DifyDataset[];
  onSelectRoleForSidebar: (role: AIRole) => void;
}

export const RoleManagementView: React.FC<RoleManagementViewProps> = ({
  roles,
  onUpdateRoles,
  datasets,
  onSelectRoleForSidebar
}) => {
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // Edit form state
  const activeRole = roles.find(r => r.id === selectedRoleId) || roles[0];
  const [formName, setFormName] = useState(activeRole?.name || '');
  const [formTitle, setFormTitle] = useState(activeRole?.title || '');
  const [formAvatar, setFormAvatar] = useState(activeRole?.avatar || '👔');
  const [formCategory, setFormCategory] = useState(activeRole?.category || '业务专家');
  const [formPrompt, setFormPrompt] = useState(activeRole?.systemPrompt || '');
  const [formTemp, setFormTemp] = useState(activeRole?.temperature || 0.6);
  const [formDatasetIds, setFormDatasetIds] = useState<string[]>(activeRole?.knowledgeBaseIds || []);
  const [formModel, setFormModel] = useState<string>(activeRole?.preferredModel || 'deepseek-v4.1-flash');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSelectRole = (role: AIRole) => {
    setSelectedRoleId(role.id);
    setFormName(role.name);
    setFormTitle(role.title);
    setFormAvatar(role.avatar);
    setFormCategory(role.category);
    setFormPrompt(role.systemPrompt);
    setFormTemp(role.temperature);
    setFormDatasetIds(role.knowledgeBaseIds || []);
    setFormModel(role.preferredModel || 'deepseek-v4.1-flash');
    setIsEditing(false);
  };

  const handleSaveRole = () => {
    const prov = formModel.startsWith('gemini') ? 'gemini' 
               : formModel.startsWith('qwen') ? 'ollama' 
               : formModel.startsWith('gpt') || formModel.startsWith('o1') || formModel.startsWith('o3') ? 'openai' 
               : formModel.includes('/') ? 'openrouter' 
               : 'deepseek';

    const updatedRole: AIRole = {
      ...activeRole,
      name: formName.trim() || activeRole.name,
      title: formTitle.trim() || activeRole.title,
      avatar: formAvatar.trim() || activeRole.avatar,
      category: formCategory.trim() || activeRole.category,
      systemPrompt: formPrompt.trim(),
      temperature: formTemp,
      knowledgeBaseIds: formDatasetIds,
      preferredModel: formModel,
      preferredProvider: prov as any
    };

    const updated = roles.map(r => r.id === activeRole.id ? updatedRole : r);
    onUpdateRoles(updated);
    setIsEditing(false);
    showToast(`✅ 角色【${updatedRole.name}】自定义提示词与绑定模型【${formModel}】已保存！`);
  };

  const handleCreateNewRole = () => {
    const newRole: AIRole = {
      id: `role-custom-${Date.now()}`,
      code: `c${roles.length + 1}`,
      name: '新自定义专家',
      title: '专属业务助手',
      avatar: '✨',
      category: '自定义',
      description: '为特定业务流程定制的专属提示词角色。',
      systemPrompt: '你是一位专属业务助手。请针对用户的业务问题，结合关联知识库给出严谨、专业的结构化答复。',
      temperature: 0.6,
      knowledgeBaseIds: datasets.slice(0, 2).map(d => d.id),
      isCustom: true,
      welcomeMessage: '新自定义专家已上线，随时为您效劳！',
      samplePrompts: ['请帮我根据知识库梳理业务答复要点。']
    };

    onUpdateRoles([...roles, newRole]);
    handleSelectRole(newRole);
    setIsEditing(true);
    showToast('✨ 已创建新角色，请编辑其专属系统提示词！');
  };

  const handleDeleteRole = (id: string) => {
    if (roles.length <= 1) {
      showToast('至少保留一个角色');
      return;
    }
    const remaining = roles.filter(r => r.id !== id);
    onUpdateRoles(remaining);
    handleSelectRole(remaining[0]);
    showToast('已删除该角色');
  };

  return (
    <div className="p-6 space-y-6 text-slate-100 max-w-7xl mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl border border-amber-400 flex items-center gap-2 animate-in slide-in-from-top-4">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>自定义角色与系统提示词工作台</span>
              <span className="px-2 py-0.5 rounded text-xs bg-purple-950 text-purple-300 border border-purple-800/40 font-mono">
                {roles.length} 个角色预置
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              自由定制角色的 System Prompt、关联专属 Dify 向量库数据集，侧边栏随时一键切换
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
        <button
          onClick={() => setShowLibrary(true)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs flex items-center gap-1.5 transition border border-slate-700"
        >
          <BookOpen size={14} />
          <span>提示词库 (prompts.chat)</span>
        </button>
        <button
          onClick={handleCreateNewRole}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-purple-600/20"
        >
          <Plus size={14} />
          <span>创建新自定义角色</span>
        </button>
        </div>
        {showLibrary && (
          <PromptLibraryModal roles={roles} onUpdateRoles={onUpdateRoles} onClose={() => setShowLibrary(false)} />
        )}
      </div>

      {/* Two-Column Editor: Left (Roles List), Right (Prompt & Config Editor) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Roles Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-3 max-h-[680px] overflow-y-auto pr-1">
          {roles.map(r => {
            const isSelected = r.id === activeRole.id;
            return (
              <div
                key={r.id}
                onClick={() => handleSelectRole(r)}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition relative ${
                  isSelected
                    ? 'bg-purple-950/20 border-purple-500/60 shadow-md shadow-purple-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{r.avatar}</span>
                    <span className="font-bold text-sm text-slate-100">{r.name}</span>
                  </div>
                  <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-purple-300 border border-slate-800 font-mono">
                    {r.category}
                  </span>
                </div>

                {/* 仅在点击选中该角色后才展示其核心职能说明，提升角色列表整体整洁度 */}
                {isSelected && (
                  <div className="mt-2 mb-2 p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/50 text-[11px] text-purple-200 leading-relaxed animate-in fade-in">
                    <div className="font-semibold text-purple-400 mb-0.5 flex items-center gap-1.5">
                      <span>🎯 核心职能说明:</span>
                      <span className="text-amber-300 font-bold">【{r.title}】</span>
                    </div>
                    <div className="text-slate-300 line-clamp-2">
                      {r.description.split(/[。！？\n]/)[0]}。
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
                  <span>关联知识库: {r.knowledgeBaseIds?.length || 0} 个</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">Temp: {r.temperature}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRole(r.id);
                      }}
                      className="p-1 rounded hover:bg-rose-950/80 text-slate-500 hover:text-rose-400 transition"
                      title="删除此角色"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Full Custom Prompt Editor (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 rounded-xl bg-slate-950 border border-slate-800">
                  {formAvatar}
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>{formName}</span>
                    <span className="text-xs text-purple-400 font-normal">({formTitle})</span>
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteRole(activeRole.id)}
                  disabled={roles.length <= 1}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs transition border border-rose-800/40 flex items-center gap-1.5 disabled:opacity-40"
                  title="删除此角色"
                >
                  <Trash2 size={13} className="text-rose-400" />
                  <span>删除角色</span>
                </button>

                <button
                  onClick={() => onSelectRoleForSidebar(activeRole)}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
                >
                  <span>在侧边栏激活此角色</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* 角色核心职能说明 */}
            <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/50 text-xs flex items-start gap-2.5">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs font-bold shrink-0 font-mono">
                🎯 核心职能说明
              </span>
              <div className="leading-relaxed">
                <span className="font-semibold text-purple-300 mr-1.5">【{formTitle}】</span>
                <span className="text-slate-200">{(activeRole?.description || '').split(/[。！？\n]/)[0]}。</span>
              </div>
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">角色名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">角色头衔/职级</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">头像 Emoji</label>
                <input
                  type="text"
                  value={formAvatar}
                  onChange={(e) => setFormAvatar(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-purple-500 text-center"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">绑定专属大模型 (点击跟随)</label>
                <select
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                >
                  <option value="deepseek-v4.1-flash">DeepSeek V4.1 Flash (推荐)</option>
                  <option value="deepseek-v4-flash">DeepSeek V4 Flash (极速)</option>
                  <option value="deepseek-v4-flash-vision-exp">DeepSeek V4 Flash Vision (读图)</option>
                  <option value="deepseek-v4-pro">DeepSeek V4 Pro (深度长文)</option>
                  <option value="deepseek-reasoner">DeepSeek R1 (深度逻辑推演)</option>
                  <option value="deepseek-chat">DeepSeek V3 (旗舰商用)</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (云端)</option>
                  <option value="qwen2.5:7b">Qwen 2.5 7B (本地离线纯CPU)</option>
                  <option value="gpt-4o-mini">GPT-4o mini (兼容)</option>
                </select>
              </div>
            </div>

            {/* System Prompt Customization Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  <span>自定义系统提示词 (System Prompt · 角色人设与行为边界)</span>
                </label>
                <span className="font-mono text-slate-400 text-[11px]">
                  {formPrompt.length} 字符
                </span>
              </div>
              <textarea
                rows={9}
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
                placeholder="在此编写详细的角色系统提示词，包括专业背景、回答风格、格式规则、禁止事项等..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 leading-relaxed font-mono focus:outline-none focus:border-purple-500 shadow-inner"
              />
              <span className="text-[11px] text-slate-500 block">
                提示：此提示词将在发起每一轮对话时作为系统顶层规则生效，模型将严格遵循该人设与输出格式。
              </span>
            </div>

            {/* Linked Dify Datasets */}
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-200 block flex items-center gap-1.5">
                <BookOpen size={14} className="text-cyan-400" />
                <span>关联 Dify 知识库数据集 (自动启用秒级 RAG 向量检索)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {datasets.map(ds => {
                  const checked = formDatasetIds.includes(ds.id);
                  return (
                    <label
                      key={ds.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                        checked
                          ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            setFormDatasetIds(formDatasetIds.filter(id => id !== ds.id));
                          } else {
                            setFormDatasetIds([...formDatasetIds, ds.id]);
                          }
                        }}
                        className="accent-cyan-500 rounded"
                      />
                      <span className="text-lg">{ds.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate text-xs">{ds.name}</div>
                        <div className="text-[10px] text-slate-500">{ds.chunkCount} 个分段</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Sliders size={14} className="text-amber-400" />
                <span className="text-slate-300">模型发散度 / 创造力 (Temperature):</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={formTemp}
                  onChange={(e) => setFormTemp(Number(e.target.value))}
                  className="w-28 accent-amber-500 cursor-pointer h-1"
                />
                <span className="font-mono text-amber-400 font-bold">{formTemp}</span>
              </div>
              <span className="text-[11px] text-slate-500">
                {formTemp <= 0.4 ? '严谨精准 (合规/法务推荐)' : formTemp <= 0.7 ? '平衡实用 (投顾/问答推荐)' : '创意发散 (销冠/小说推荐)'}
              </span>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveRole}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-purple-600/20"
              >
                <Check size={14} />
                <span>保存此角色提示词与知识库配置</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
