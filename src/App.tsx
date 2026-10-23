import React, { useState, useEffect } from 'react';
import { 
  Layout, BookOpen, Users, Monitor, Settings,
  Sparkles, ChevronRight, ArrowLeft
} from 'lucide-react';
import { UniversalSidebar } from './components/UniversalSidebar';
import { DifyKnowledgeBaseView } from './components/DifyKnowledgeBaseView';
import { RoleManagementView } from './components/RoleManagementView';
import { LocalDeploymentPackView } from './components/LocalDeploymentPackView';
import { McpEditorView } from './components/McpEditorView';
import { SettingsModal } from './components/SettingsModal';
import { INITIAL_ROLES } from './data/roles';
import { INITIAL_DATASETS } from './data/difyDatasets';
import { AIRole, DifyDataset } from './types';

const ROLES_STORAGE_KEY = 'finai_roles_v1';
const CURRENT_ROLE_STORAGE_KEY = 'finai_current_role_id';
const DATASETS_STORAGE_KEY = 'finai_datasets_v1';
/** 设置导航记录：「设置 → 子功能 → 返回工作台」的停留位置持久保存，「清理本地缓存」不会清理该键 */
export const NAV_STATE_KEY = 'finai_nav_state_v1';
type AppTab = 'sidebar' | 'knowledge' | 'roles' | 'deploy' | 'mcp';
type SettingsSubMenu = 'modules' | 'social' | 'ollama';
interface NavState { activeTab: AppTab; settingsSubMenu: SettingsSubMenu; }

const readNavState = (): Partial<NavState> => {
  try {
    const raw = localStorage.getItem(NAV_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed as Partial<NavState> : {};
  } catch { return {}; }
};

const writeNavState = (state: NavState) => {
  try { localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state)); } catch {}
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const saved = readNavState().activeTab;
    return saved && ['sidebar', 'knowledge', 'roles', 'deploy', 'mcp'].includes(saved) ? saved : 'sidebar';
  });
  // 角色列表持久化到 localStorage：修改提示词后刷新 / 重启不再复原
  const [roles, setRoles] = useState<AIRole[]>(() => {
    try {
      const saved = localStorage.getItem(ROLES_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as AIRole[];
    } catch {}
    return INITIAL_ROLES;
  });
  // 只记当前角色 ID，角色内容始终从 roles 实时取，避免出现过期副本
  const [currentRoleId, setCurrentRoleId] = useState<string>(() => {
    try { return localStorage.getItem(CURRENT_ROLE_STORAGE_KEY) || ''; } catch { return ''; }
  });
  const currentRole: AIRole = roles.find(r => r.id === currentRoleId) || roles[0] || INITIAL_ROLES[0];
  const setCurrentRole = (role: AIRole) => setCurrentRoleId(role.id);

  useEffect(() => {
    try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles)); } catch {}
  }, [roles]);

  useEffect(() => {
    try { localStorage.setItem(CURRENT_ROLE_STORAGE_KEY, currentRole.id); } catch {}
  }, [currentRole.id]);
  // 知识库持久化：此前刷新即丢失上传/编辑内容
  const [datasets, setDatasets] = useState<DifyDataset[]>(() => {
    try {
      const saved = localStorage.getItem(DATASETS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as DifyDataset[];
    } catch {}
    return INITIAL_DATASETS;
  });
  useEffect(() => {
    try { localStorage.setItem(DATASETS_STORAGE_KEY, JSON.stringify(datasets)); } catch {}
  }, [datasets]);
  const [isDockedMode, setIsDockedMode] = useState(false);
  const [isRightSidebarAlwaysVisible, setIsRightSidebarAlwaysVisible] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // 设置弹窗内停留的子菜单（返回设置时回到上一次的页面）
  const [settingsSubMenu, setSettingsSubMenu] = useState<SettingsSubMenu>(() => {
    const saved = readNavState().settingsSubMenu;
    return saved && ['modules', 'social', 'ollama'].includes(saved) ? saved : 'modules';
  });

  // 导航记录实时落盘：返回工作台/重启后仍能回到上次停留的位置
  useEffect(() => {
    writeNavState({ activeTab, settingsSubMenu });
  }, [activeTab, settingsSubMenu]);

  // Engine status state
  const [engineStatus, setEngineStatus] = useState<any>({
    geminiConfigured: false,
    model: 'gemini-3.8-flash',
    mode: 'local_cpu_qwen_engine',
    message: '正在检测模型 API 配置...'
  });

  // Global Font Scale state (80% to 200%, default 100% with increased base 18px)
  const [fontScale, setFontScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('app_font_scale');
      return saved ? Number(saved) : 100;
    } catch {
      return 100;
    }
  });

  useEffect(() => {
    // Base font size increased by 1 font size (18px base instead of 16px)
    document.documentElement.style.fontSize = `${(fontScale / 100) * 18}px`;
    try {
      localStorage.setItem('app_font_scale', fontScale.toString());
    } catch {}
  }, [fontScale]);

  const handleIncreaseFont = () => setFontScale(prev => Math.min(prev + 10, 200));
  const handleDecreaseFont = () => setFontScale(prev => Math.max(prev - 10, 80));
  const handleResetFont = () => setFontScale(100);

  useEffect(() => {
    fetch('/api/engine/status')
      .then(res => res.json())
      .then(data => {
        setEngineStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleUpdateRole = (updatedRole: AIRole) => {
    setRoles(prev => prev.map(r => r.id === updatedRole.id ? updatedRole : r));
  };

  const handleSelectRoleForSidebar = (role: AIRole) => {
    setCurrentRole(role);
    setActiveTab('sidebar');
  };

  return (
    <div className="min-h-screen flex flex-col pt-[var(--app-header-h)] font-sans selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Top Application Header - 固定在顶部 */}
      <header id="app-global-header" className="h-[var(--app-header-h)] px-4 flex items-center justify-between shrink-0 fixed top-0 inset-x-0 z-[1000] backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/60 shadow-lg shadow-black/30">
        
        {/* Left Area: 两级返回导航（子页面 → 设置界面 → 工作台），顶栏全局置顶故在设置弹窗打开时依然可见 */}
        <div className="flex items-center gap-2 z-10 min-w-[100px]">
          {showSettingsModal ? (
            /* 第 1 层：设置界面 → 返回工作台 */
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowSettingsModal(false); setActiveTab('sidebar'); }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="关闭设置并回到工作台"
              >
                <ArrowLeft size={12} className="text-amber-400" />
                <span>返回工作台</span>
              </button>
              <span className="text-[11px] font-medium text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-mono hidden sm:inline-block">
                设置中心 · {settingsSubMenu === 'modules' ? '功能与显示设置' : settingsSubMenu === 'social' ? '社交应用接入' : 'Ollama 手机热点/本地'}
              </span>
            </div>
          ) : activeTab !== 'sidebar' ? (
            /* 第 2 层：设置子页面 → 返回上一页（设置界面） */
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="返回上一页：设置界面"
              >
                <ArrowLeft size={12} className="text-amber-400" />
                <span>返回设置</span>
              </button>
              <span className="text-[11px] font-medium text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-mono hidden sm:inline-block">
                {activeTab === 'knowledge' && '知识库混合检索'}
                {activeTab === 'roles' && '自定义角色与提示词'}
                {activeTab === 'deploy' && '本地部署包'}
                {activeTab === 'mcp' && 'MCP 协议与工具链编辑器'}
              </span>
            </div>
          ) : null}
        </div>

        {/* Center: 本地AI业务工作台 居中并增加2个字号，高级感图标，删除挂靠业务对话中枢 */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 pointer-events-auto select-none">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 p-[1px] shadow-sm shadow-amber-500/25 shrink-0">
            <div className="w-full h-full rounded-[7px] flex items-center justify-center bg-slate-950">
              <Sparkles size={16} className="text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            </div>
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
            本地AI业务工作台
          </h1>
        </div>

        {/* Right Action Controls: 设置按键 */}
        <div className="flex items-center gap-2 z-10 min-w-[100px] justify-end">
          {/* 设置按键: 包含知识库检索、角色配置、本地部署包、字号调节与社交应用接入 */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 font-medium transition flex items-center gap-1.5 text-xs cursor-pointer active:scale-95 shadow-sm"
            title="系统设置（知识库检索、角色配置、本地部署包、字号缩放、社交应用接入）"
          >
            <Settings size={13} className="text-amber-400" />
            <span>设置</span>
          </button>

          {/* Right Dock Switcher (when in knowledge, roles, or deploy view) */}
          {activeTab !== 'sidebar' && (
            <button
              onClick={() => setIsRightSidebarAlwaysVisible(!isRightSidebarAlwaysVisible)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border ${
                isRightSidebarAlwaysVisible
                  ? 'bg-slate-800 text-amber-300 border-amber-500/30'
                  : 'bg-amber-500 text-slate-950 border-amber-400'
              }`}
              title="切换右侧挂靠侧边栏显隐"
            >
              <Layout size={12} />
              <span className="hidden lg:inline">{isRightSidebarAlwaysVisible ? '收起侧边栏' : '常驻侧边栏'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Tab Area */}
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${
          activeTab !== 'sidebar' && isRightSidebarAlwaysVisible ? 'mr-0 lg:mr-[400px]' : ''
        }`}>
          {activeTab === 'sidebar' && (
            <div className={`mx-auto h-[calc(100vh-var(--app-header-h))] flex justify-center p-3 ${
              isDockedMode ? 'max-w-[440px]' : 'max-w-4xl'
            }`}>
              <UniversalSidebar
                currentRole={currentRole}
                roles={roles}
                onSelectRole={setCurrentRole}
                onUpdateRole={handleUpdateRole}
                datasets={datasets}
                onUpdateDatasets={setDatasets}
                onNavigateToKnowledge={() => setActiveTab('knowledge')}
                onNavigateToRoles={() => setActiveTab('roles')}
                isDockedMode={isDockedMode}
                onToggleDockMode={() => setIsDockedMode(!isDockedMode)}
                fontScale={fontScale}
                onIncreaseFont={handleIncreaseFont}
                onDecreaseFont={handleDecreaseFont}
                onResetFont={handleResetFont}
              />
            </div>
          )}

          {activeTab === 'knowledge' && (
            <DifyKnowledgeBaseView
              datasets={datasets}
              onUpdateDatasets={setDatasets}
              onSelectDatasetForSidebar={(dsId) => {
                const updated = {
                  ...currentRole,
                  knowledgeBaseIds: Array.from(new Set([...currentRole.knowledgeBaseIds, dsId]))
                };
                handleUpdateRole(updated);
                setActiveTab('sidebar');
              }}
            />
          )}

          {activeTab === 'roles' && (
            <RoleManagementView
              roles={roles}
              onUpdateRoles={setRoles}
              datasets={datasets}
              onSelectRoleForSidebar={handleSelectRoleForSidebar}
            />
          )}

          {activeTab === 'deploy' && (
            <LocalDeploymentPackView />
          )}

          {activeTab === 'mcp' && (
            <McpEditorView onBackToWorkbench={() => setShowSettingsModal(true)} />
          )}
        </main>

        {/* Right Docked Sidebar (Always available beside Knowledge Base or Roles views) */}
        {activeTab !== 'sidebar' && isRightSidebarAlwaysVisible && (
          <aside className="fixed top-[var(--app-header-h)] right-0 bottom-0 w-[400px] border-l border-slate-800 z-30 shadow-2xl hidden lg:flex flex-col bg-slate-950">
            <UniversalSidebar
              currentRole={currentRole}
              roles={roles}
              onSelectRole={setCurrentRole}
              onUpdateRole={handleUpdateRole}
              datasets={datasets}
              onUpdateDatasets={setDatasets}
              onNavigateToKnowledge={() => setActiveTab('knowledge')}
              onNavigateToRoles={() => setActiveTab('roles')}
              isDockedMode={true}
              onToggleDockMode={() => setActiveTab('sidebar')}
              fontScale={fontScale}
              onIncreaseFont={handleIncreaseFont}
              onDecreaseFont={handleDecreaseFont}
              onResetFont={handleResetFont}
            />
          </aside>
        )}
      </div>

      {/* Global Settings & Navigation Modal */}
      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          activeTab={activeTab}
          onNavigateTab={(tab) => setActiveTab(tab)}
          fontScale={fontScale}
          onIncreaseFont={handleIncreaseFont}
          onDecreaseFont={handleDecreaseFont}
          onResetFont={handleResetFont}
          onSetFontScale={(val) => setFontScale(val)}
          subMenu={settingsSubMenu}
          onSubMenuChange={setSettingsSubMenu}
          engineStatus={engineStatus}
        />
      )}
    </div>
  );
}
