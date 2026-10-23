import React, { useState, useEffect } from 'react';
import { 
  Send, Bot, Share2, Key, Globe, ShieldCheck, CheckCircle2, 
  AlertCircle, Copy, Check, RefreshCw, Terminal, Code2, 
  Layers, Users, Sparkles, Sliders, ExternalLink, MessageSquare, 
  ArrowRight, Radio, Server, Play, Eye, EyeOff, Plus, Trash2
} from 'lucide-react';
import { TelegramConfig, SocialPlatformConfig, SocialAccountItem, AIRole, DifyDataset } from '../types';

interface SocialAndTelegramStudioProps {
  roles: AIRole[];
  datasets: DifyDataset[];
  onNavigateToKnowledge: () => void;
  onNavigateToRoles: () => void;
}

export const SocialAndTelegramStudio: React.FC<SocialAndTelegramStudioProps> = ({
  roles,
  datasets,
  onNavigateToKnowledge,
  onNavigateToRoles
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'telegram' | 'social_platform' | 'quick_embed'>('telegram');

  // Telegram State
  const [tgConfig, setTgConfig] = useState<TelegramConfig>({
    botToken: '',
    isEnabled: true,
    webhookUrl: '',
    allowedChatIds: [],
    defaultRoleId: 'wealth-advisor',
    defaultModel: 'deepseek-v4.1-flash',
    enableRag: true,
    autoReplyMode: true,
    replyFormat: 'Markdown',
    lastConnected: null,
    botInfo: null
  });
  const [showTgToken, setShowTgToken] = useState(false);
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);
  const [testChatId, setTestChatId] = useState('');
  const [testPushText, setTestPushText] = useState('【本地AI业务工作台】Telegram API 通信验证成功，智能助理已就绪！');
  
  // Telegram Sandbox Simulation
  const [simTgMsg, setSimTgMsg] = useState('客户询问最近固收+理财收益波动较大，担心亏损怎么安抚？');
  const [simTgResult, setSimTgResult] = useState<any>(null);
  const [isSimulatingTg, setIsSimulatingTg] = useState(false);

  // Social Platform State
  const [socialConfig, setSocialConfig] = useState<SocialPlatformConfig>({
    apiKey: 'sk-social-ai-wb9981',
    serviceBaseUrl: window.location.origin || 'http://localhost:3000',
    webhookSecret: 'sec_social_msg_dispatch_key',
    callbackWebhookUrl: '',
    enableRagByDefault: true,
    strictRagLimit: true,
    accounts: [
      {
        id: 'acc-wx-01',
        platform: 'wechat',
        accountName: '企业微信-主客服专员',
        accountIdentifier: 'wxid_fin_support_01',
        boundRoleId: 'wealth-advisor',
        boundKnowledgeBaseId: 'all',
        autoReply: true,
        notes: '对客高净值理财咨询与净值安抚'
      },
      {
        id: 'acc-tg-01',
        platform: 'telegram',
        accountName: 'Telegram-海外业务咨询Bot',
        accountIdentifier: '@fin_global_advisor_bot',
        boundRoleId: 'investment-expert',
        boundKnowledgeBaseId: 'all',
        autoReply: true,
        notes: '全球大类资产配置与宏观策略'
      },
      {
        id: 'acc-wa-01',
        platform: 'whatsapp',
        accountName: 'WhatsApp-跨境财富业务',
        accountIdentifier: '+852 9876 5432',
        boundRoleId: 'compliance-expert',
        boundKnowledgeBaseId: 'all',
        autoReply: true,
        notes: '合规审查与境外资产配置'
      }
    ],
    corsOrigins: ['*']
  });
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // Social Sandbox Simulation
  const [selectedSocialAccount, setSelectedSocialAccount] = useState<string>('acc-wx-01');
  const [socialSandboxMsg, setSocialSandboxMsg] = useState('客户风险测评为稳健型R2，但强烈要求购买R4激进股票私募，如何合规拒绝？');
  const [socialSandboxResult, setSocialSandboxResult] = useState<any>(null);
  const [isTestingSocialSandbox, setIsTestingSocialSandbox] = useState(false);

  // Code snippet copy states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showToast('✅ 已复制到剪贴板！');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch configs on mount
  useEffect(() => {
    fetch('/api/telegram/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          setTgConfig(prev => ({
            ...prev,
            ...data.config,
            webhookUrl: data.config.webhookUrl || `${window.location.origin}/api/telegram/webhook`
          }));
        }
      })
      .catch(() => {});

    fetch('/api/social/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          setSocialConfig(prev => ({
            ...prev,
            ...data.config,
            serviceBaseUrl: window.location.origin || data.config.serviceBaseUrl
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Save Telegram Config
  const handleSaveTgConfig = async () => {
    setIsSavingTg(true);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tgConfig)
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Telegram 配置保存成功！');
      } else {
        showToast('❌ 保存失败: ' + (data.error || '未知错误'));
      }
    } catch (e: any) {
      showToast('❌ 保存请求异常: ' + e.message);
    } finally {
      setIsSavingTg(false);
    }
  };

  // Test Telegram Token
  const handleTestTgConnection = async () => {
    if (!tgConfig.botToken.trim()) {
      showToast('⚠️ 请先填写 Telegram Bot Token！');
      return;
    }
    setIsTestingTg(true);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: tgConfig.botToken })
      });
      const data = await res.json();
      if (data.success) {
        setTgConfig(prev => ({
          ...prev,
          botInfo: data.botInfo,
          lastConnected: data.connectedAt
        }));
        showToast(`✅ 连接成功！Bot: @${data.botInfo?.username}`);
      } else {
        showToast(`❌ 验证失败: ${data.error}`);
      }
    } catch (e: any) {
      showToast(`❌ 连接失败: ${e.message}`);
    } finally {
      setIsTestingTg(false);
    }
  };

  // Set Webhook
  const handleSetWebhook = async () => {
    if (!tgConfig.botToken.trim()) {
      showToast('⚠️ 请先填写 Telegram Bot Token！');
      return;
    }
    if (!tgConfig.webhookUrl.trim()) {
      showToast('⚠️ 请填写 Webhook 接收地址！');
      return;
    }
    setIsSettingWebhook(true);
    try {
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tgConfig.botToken,
          webhookUrl: tgConfig.webhookUrl
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Webhook 已成功绑定至 Telegram！');
      } else {
        showToast(`❌ 注册 Webhook 失败: ${data.error}`);
      }
    } catch (e: any) {
      showToast(`❌ 请求异常: ${e.message}`);
    } finally {
      setIsSettingWebhook(false);
    }
  };

  // Send Test Message
  const handleSendTestTgMsg = async () => {
    if (!testChatId.trim()) {
      showToast('⚠️ 请填写接收测试消息的 Telegram Chat ID！');
      return;
    }
    setIsSendingTestMsg(true);
    try {
      const res = await fetch('/api/telegram/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tgConfig.botToken,
          chatId: testChatId,
          text: testPushText
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ 测试消息已成功推送到 Telegram 目标对话！');
      } else {
        showToast(`❌ 发送失败: ${data.error}`);
      }
    } catch (e: any) {
      showToast(`❌ 发送异常: ${e.message}`);
    } finally {
      setIsSendingTestMsg(false);
    }
  };

  // Run Telegram Simulation
  const handleRunTgSim = async () => {
    if (!simTgMsg.trim()) return;
    setIsSimulatingTg(true);
    try {
      const res = await fetch('/api/telegram/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: simTgMsg,
          chatId: '1008688',
          username: 'tg_client_user'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSimTgResult(data);
      } else {
        showToast('❌ 模拟调用失败: ' + data.error);
      }
    } catch (e: any) {
      showToast('❌ 请求失败: ' + e.message);
    } finally {
      setIsSimulatingTg(false);
    }
  };

  // Save Social Config
  const handleSaveSocialConfig = async () => {
    setIsSavingSocial(true);
    try {
      const res = await fetch('/api/social/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(socialConfig)
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ 多社交平台配置已成功保存！');
      } else {
        showToast('❌ 保存失败: ' + (data.error || '未知错误'));
      }
    } catch (e: any) {
      showToast('❌ 保存请求异常: ' + e.message);
    } finally {
      setIsSavingSocial(false);
    }
  };

  // Test Social Sandbox
  const handleRunSocialSandbox = async () => {
    if (!socialSandboxMsg.trim()) return;
    setIsTestingSocialSandbox(true);
    try {
      const selectedAcc = socialConfig.accounts.find(a => a.id === selectedSocialAccount);
      const res = await fetch('/api/social/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${socialConfig.apiKey}`
        },
        body: JSON.stringify({
          platform: selectedAcc?.platform || 'wechat',
          accountId: selectedSocialAccount,
          userId: 'test_client_008',
          channelId: 'group_vip_service',
          message: socialSandboxMsg,
          enableRag: socialConfig.enableRagByDefault
        })
      });
      const data = await res.json();
      if (data.success) {
        setSocialSandboxResult(data);
      } else {
        showToast('❌ 接口调用失败: ' + (data.error || '未知错误'));
      }
    } catch (e: any) {
      showToast('❌ 请求异常: ' + e.message);
    } finally {
      setIsTestingSocialSandbox(false);
    }
  };

  // Add new social account item
  const handleAddSocialAccount = () => {
    const newAcc: SocialAccountItem = {
      id: `acc-${Date.now().toString().slice(-4)}`,
      platform: 'wechat',
      accountName: '新社交业务号',
      accountIdentifier: 'social_id_' + Math.floor(Math.random() * 1000),
      boundRoleId: roles[0]?.id || 'wealth-advisor',
      boundKnowledgeBaseId: 'all',
      autoReply: true,
      notes: '业务咨询客服'
    };
    setSocialConfig(prev => ({
      ...prev,
      accounts: [...prev.accounts, newAcc]
    }));
  };

  const handleDeleteSocialAccount = (id: string) => {
    setSocialConfig(prev => ({
      ...prev,
      accounts: prev.accounts.filter(a => a.id !== id)
    }));
  };

  const handleUpdateSocialAccount = (id: string, updates: Partial<SocialAccountItem>) => {
    setSocialConfig(prev => ({
      ...prev,
      accounts: prev.accounts.map(a => a.id === id ? { ...a, ...updates } : a)
    }));
  };

  // Node.js integration script for user's lightweight app
  const nodeIntegrationSnippet = `// ------------------------------------------------------------------
// 将本地AI业务工作台对接到您的轻量级多社交账号应用 (Node.js / Express 示例)
// ------------------------------------------------------------------
const axios = require('axios');

const AI_WORKBENCH_URL = '${window.location.origin || 'http://127.0.0.1:3000'}/api/social/chat';
const AI_API_KEY = '${socialConfig.apiKey}';

// 当您的社交平台收到客户消息时调用此函数获取业务回复
async function handleSocialMessage(platform, accountId, userId, message) {
  try {
    const response = await axios.post(AI_WORKBENCH_URL, {
      platform,      // 'wechat' | 'telegram' | 'whatsapp' | 'custom'
      accountId,     // 您的多账号标识 (如: 'acc-wx-01')
      userId,        // 客户唯一ID
      message,       // 客户发送的问题
      enableRag: true // 自动穿透本地知识库检索 (<=500字精准合规)
    }, {
      headers: {
        'Authorization': \`Bearer \${AI_API_KEY}\`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && response.data.success) {
      console.log('✅ AI回复生成成功，耗时:', response.data.metadata.latencyMs, 'ms');
      // 返回AI生成的回复及知识库引用
      return {
        reply: response.data.reply,
        citations: response.data.citations
      };
    }
  } catch (error) {
    console.error('❌ 调用AI工作台失败:', error.message);
    return null;
  }
}

module.exports = { handleSocialMessage };`;

  // Python integration script
  const pythonIntegrationSnippet = `# -*- coding: utf-8 -*-
# ------------------------------------------------------------------
# 将本地AI业务工作台对接到您的轻量级多社交账号应用 (Python 示例)
# ------------------------------------------------------------------
import requests

AI_WORKBENCH_URL = "${window.location.origin || 'http://127.0.0.1:3000'}/api/social/chat"
AI_API_KEY = "${socialConfig.apiKey}"

def query_ai_workbench(platform: str, account_id: str, user_id: str, message: str):
    """
    向本地AI业务工作台发送客户提问，返回专业话术及知识库引用依据
    """
    headers = {
        "Authorization": f"Bearer {AI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "platform": platform,      # wechat / telegram / whatsapp
        "accountId": account_id,    # 账号标识
        "userId": user_id,          # 客户标识
        "message": message,         # 咨询问题
        "enableRag": True           # 开启知识库检索
    }
    try:
        response = requests.post(AI_WORKBENCH_URL, json=payload, headers=headers, timeout=10)
        data = response.json()
        if data.get("success"):
            return {
                "reply": data.get("reply"),
                "citations": data.get("citations", []),
                "latency_ms": data.get("metadata", {}).get("latencyMs")
            }
    except Exception as e:
        print(f"调用AI工作台异常: {e}")
        return None`;

  // Embed iframe snippet
  const embedIframeSnippet = `<!-- 嵌入悬浮挂靠AI业务侧边栏到您的轻量级网页端多社交平台 -->
<div id="ai-workbench-dock" style="position: fixed; right: 0; top: 0; width: 380px; height: 100vh; z-index: 9999; box-shadow: -5px 0 25px rgba(0,0,0,0.5);">
  <iframe 
    src="${window.location.origin || 'http://localhost:3000'}/" 
    style="width: 100%; height: 100%; border: none;"
    allow="clipboard-write; clipboard-read"
  ></iframe>
</div>`;

  return (
    <div className="p-4 sm:p-6 space-y-6 text-slate-100 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl border border-amber-400 flex items-center gap-2 animate-in slide-in-from-top-4">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 backdrop-blur shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500/20 to-blue-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Share2 size={22} className="drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                Telegram 与多社交账号平台配置部署工作台
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">
                API 网关 & 轻量化集成
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
              <span>已原生打通 Telegram Bot API</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-medium">支持将本工作台配置部署到自建多社交账号轻量应用中</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-medium">知识库穿透与多角色调度</span>
            </p>
          </div>
        </div>

        {/* Sub tabs switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab('telegram')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'telegram'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send size={13} />
            <span>Telegram API 接口配置</span>
          </button>

          <button
            onClick={() => setActiveSubTab('social_platform')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'social_platform'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio size={13} />
            <span>多社交账号平台部署</span>
          </button>

          <button
            onClick={() => setActiveSubTab('quick_embed')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'quick_embed'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 size={13} />
            <span>集成代码与挂靠嵌入</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: Telegram Bot API 配置与测试
          ========================================================================= */}
      {activeSubTab === 'telegram' && (
        <div className="space-y-6">
          {/* Status & Overview Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Card */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex items-start justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">Telegram Bot 连通状态</span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${tgConfig.botInfo ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="text-sm font-bold text-slate-200">
                    {tgConfig.botInfo ? `在线 (@${tgConfig.botInfo.username})` : '待连接与验证'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {tgConfig.lastConnected ? `已验证: ${new Date(tgConfig.lastConnected).toLocaleTimeString()}` : '尚未进行 Token 连通性校验'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Send size={18} />
              </div>
            </div>

            {/* Auto Reply & RAG */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex items-start justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">知识库穿透与自动回复</span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tgConfig.autoReplyMode ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                    {tgConfig.autoReplyMode ? 'AI 自动接管开启' : '人工监控模式'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tgConfig.enableRag ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'}`}>
                    {tgConfig.enableRag ? '本地知识库检索开启' : '知识库关闭'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  严格约束召回 ≤500 字专业金融 QA 问答
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
            </div>

            {/* Webhook Status */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex items-start justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">Webhook 回调网关</span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-mono text-amber-300 truncate max-w-[200px]" title={tgConfig.webhookUrl}>
                    {tgConfig.webhookUrl ? '/api/telegram/webhook' : '未设置 URL'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  实时监听 Telegram 群聊与单聊消息推送
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Globe size={18} />
              </div>
            </div>
          </div>

          {/* Configuration Form Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-sky-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Telegram Bot API 基础参数配置</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestTgConnection}
                  disabled={isTestingTg}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-sky-600/20"
                >
                  <RefreshCw size={12} className={isTestingTg ? 'animate-spin' : ''} />
                  <span>{isTestingTg ? '验证中...' : '校验 Bot Token'}</span>
                </button>
                <button
                  onClick={handleSaveTgConfig}
                  disabled={isSavingTg}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-sm shadow-amber-500/20"
                >
                  <span>{isSavingTg ? '保存中...' : '保存配置'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bot Token */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Telegram Bot Token (从 @BotFather 获取)</span>
                  <button
                    onClick={() => setShowTgToken(!showTgToken)}
                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    {showTgToken ? <EyeOff size={11} /> : <Eye size={11} />}
                    <span>{showTgToken ? '隐藏' : '显示'}</span>
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showTgToken ? 'text' : 'password'}
                    value={tgConfig.botToken}
                    onChange={(e) => setTgConfig({ ...tgConfig, botToken: e.target.value })}
                    placeholder="例如: 7123456789:AAHk..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  支持从 @BotFather 创建并获取 Token，服务端已建立安全隔离防泄漏机制。
                </p>
              </div>

              {/* Webhook URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Webhook 接收服务地址 (需公网 HTTPS)</span>
                  <button
                    onClick={() => setTgConfig({ ...tgConfig, webhookUrl: `${window.location.origin}/api/telegram/webhook` })}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    填入当前服务域名
                  </button>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tgConfig.webhookUrl}
                    onChange={(e) => setTgConfig({ ...tgConfig, webhookUrl: e.target.value })}
                    placeholder="https://your-domain.com/api/telegram/webhook"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-sky-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSetWebhook}
                    disabled={isSettingWebhook}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-medium text-xs border border-sky-500/30 transition shrink-0 cursor-pointer"
                    title="向 Telegram 官方注册此 Webhook 地址"
                  >
                    {isSettingWebhook ? '注册中...' : '注册 Webhook'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Telegram 接收到用户咨询后将通过 POST 自动推送到此路由。
                </p>
              </div>

              {/* Role Binding */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>绑定 Telegram 智能业务角色</span>
                  <button onClick={onNavigateToRoles} className="text-[11px] text-purple-400 hover:underline">
                    管理自定义角色
                  </button>
                </label>
                <select
                  value={tgConfig.defaultRoleId}
                  onChange={(e) => setTgConfig({ ...tgConfig, defaultRoleId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-sky-500 focus:outline-none"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.avatar} {r.name} ({r.title})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  Telegram 用户的对话将严格采用该角色的人设、Prompt 及温度系数。
                </p>
              </div>

              {/* Model Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  绑定推理模型 (优先使用后端 .env 密钥)
                </label>
                <select
                  value={tgConfig.defaultModel}
                  onChange={(e) => setTgConfig({ ...tgConfig, defaultModel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-sky-500 focus:outline-none"
                >
                  <option value="deepseek-v4.1-flash">DeepSeek V4.1 Flash (推荐 · 超快推理)</option>
                  <option value="deepseek-chat">DeepSeek Chat (V3 官方模型)</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (多模态极速版)</option>
                  <option value="openai/gpt-4o-mini">OpenAI GPT-4o Mini</option>
                  <option value="local_cpu_qwen">本地离线 Qwen-14B CPU 引擎 (完全脱网)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  密钥托管在服务端 .env 中，无需在前端输入敏感 Key。
                </p>
              </div>
            </div>

            {/* Switches */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={tgConfig.autoReplyMode}
                  onChange={(e) => setTgConfig({ ...tgConfig, autoReplyMode: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-200">启用 AI 自动应答 (Auto-Reply)</div>
                  <div className="text-[10px] text-slate-500">收到 Telegram 消息后自动调用工作台大模型并回传</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={tgConfig.enableRag}
                  onChange={(e) => setTgConfig({ ...tgConfig, enableRag: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-200">本地知识库检索穿透 (Local RAG)</div>
                  <div className="text-[10px] text-slate-500">回答自动召回本地 QA 向量库（严格限制≤500字）</div>
                </div>
              </label>
            </div>
          </div>

          {/* Telegram Testing & Interactive Sandbox */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: Real Push Message Test */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-amber-400" />
                  <h3 className="font-semibold text-slate-200 text-xs">真实推送测试 (Send Message API)</h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">POST /sendMessage</span>
              </div>
              <p className="text-[11px] text-slate-400">
                向已对该 Bot 发送过 <code className="text-amber-300">/start</code> 的 Telegram 用户或群组推送测试消息。
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">目标 Telegram Chat ID / User ID</label>
                  <input
                    type="text"
                    value={testChatId}
                    onChange={(e) => setTestChatId(e.target.value)}
                    placeholder="例如: 123456789 或 -1001234567890 (群ID)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">测试消息内容</label>
                  <textarea
                    rows={2}
                    value={testPushText}
                    onChange={(e) => setTestPushText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>

                <button
                  onClick={handleSendTestTgMsg}
                  disabled={isSendingTestMsg || !tgConfig.botToken}
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <Send size={13} />
                  <span>{isSendingTestMsg ? '发送中...' : '向 Telegram 发送真实测试消息'}</span>
                </button>
              </div>
            </div>

            {/* Box 2: Telegram Message Simulator */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play size={16} className="text-sky-400" />
                  <h3 className="font-semibold text-slate-200 text-xs">Telegram 交互仿真沙盒 (Sandbox)</h3>
                </div>
                <span className="text-[10px] text-sky-400 font-mono">0.02s 知识库检索</span>
              </div>
              <p className="text-[11px] text-slate-400">
                模拟 Telegram 客户向 Bot 发送消息，测试本地工作台接收、检索知识库与生成专业回复全流程。
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">模拟客户发送的消息：</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={simTgMsg}
                      onChange={(e) => setSimTgMsg(e.target.value)}
                      placeholder="输入提问，如: 固收+理财波动、家族信托破产隔离..."
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-sky-500 focus:outline-none"
                    />
                    <button
                      onClick={handleRunTgSim}
                      disabled={isSimulatingTg}
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold text-xs transition disabled:opacity-40 shrink-0 cursor-pointer shadow-md shadow-sky-600/20"
                    >
                      {isSimulatingTg ? '运行中...' : '测试应答'}
                    </button>
                  </div>
                </div>

                {simTgResult && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-sky-500/30 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-sky-300">AI 生成的 Telegram 回复：</span>
                      <span className="text-slate-500 font-mono">{simTgResult.latencyMs} ms · {simTgResult.modelUsed}</span>
                    </div>
                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto font-sans p-2 rounded-lg bg-slate-900 border border-slate-800">
                      {simTgResult.reply}
                    </div>

                    {simTgResult.citations && simTgResult.citations.length > 0 && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <span className="text-[10px] text-cyan-400 font-semibold block mb-1">
                          📚 知识库召回依据 ({simTgResult.citations.length} 条，严格≤500字):
                        </span>
                        <div className="space-y-1">
                          {simTgResult.citations.map((c: any, i: number) => (
                            <div key={i} className="text-[11px] text-slate-300 bg-slate-900/60 p-1.5 rounded border border-slate-800 flex items-center justify-between">
                              <span className="truncate max-w-[280px]">[{c.index}] {c.pointName || c.title}</span>
                              <span className="text-[10px] text-slate-500 shrink-0">{c.sourceDoc} ({c.pageNumber || 'P.1'})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: 多社交账号平台配置与部署
          ========================================================================= */}
      {activeSubTab === 'social_platform' && (
        <div className="space-y-6">
          {/* Header Action Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <Radio size={16} className="text-emerald-400" />
                  <span>自建多社交账号平台轻量级应用 · 接入中枢</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  为您的多微信号、多TG号、多WhatsApp账号分配专属人设、Prompt 及知识库，支持跨账号统一分发与自动应答。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddSocialAccount}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} className="text-emerald-400" />
                  <span>添加社交账号</span>
                </button>
                <button
                  onClick={handleSaveSocialConfig}
                  disabled={isSavingSocial}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <span>{isSavingSocial ? '保存中...' : '保存多账号配置'}</span>
                </button>
              </div>
            </div>

            {/* Gateway Key Information */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">开放调度 API 地址</span>
                <div className="flex items-center justify-between font-mono text-emerald-400 font-semibold">
                  <span className="truncate">{socialConfig.serviceBaseUrl}/api/social/chat</span>
                  <button 
                    onClick={() => copyToClipboard(`${socialConfig.serviceBaseUrl}/api/social/chat`, 'api_url')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'api_url' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">专属 API Key (请求鉴权)</span>
                <div className="flex items-center justify-between font-mono text-amber-300 font-semibold">
                  <span className="truncate">{socialConfig.apiKey}</span>
                  <button 
                    onClick={() => copyToClipboard(socialConfig.apiKey, 'api_key')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'api_key' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">已托管社交账号数量</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 font-bold text-sm">{socialConfig.accounts.length} 个账号</span>
                  <span className="text-[10px] text-emerald-400 font-medium">支持无限扩展</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Accounts Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                <Users size={15} className="text-emerald-400" />
                <span>多社交账号与角色矩阵映射表</span>
              </h4>
              <span className="text-[11px] text-slate-400">不同账号可绑定不同专家角色与知识库</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 px-3">社交平台</th>
                    <th className="py-2.5 px-3">账号备注名称</th>
                    <th className="py-2.5 px-3">账号标识 (ID / 手机号)</th>
                    <th className="py-2.5 px-3">绑定业务角色</th>
                    <th className="py-2.5 px-3">自动应答</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {socialConfig.accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-850/50 transition">
                      {/* Platform */}
                      <td className="py-3 px-3">
                        <select
                          value={acc.platform}
                          onChange={(e) => handleUpdateSocialAccount(acc.id, { platform: e.target.value as any })}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none"
                        >
                          <option value="wechat">微信 / 企业微信</option>
                          <option value="telegram">Telegram</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="discord">Discord</option>
                          <option value="custom">自建平台 / 其他</option>
                        </select>
                      </td>

                      {/* Account Name */}
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={acc.accountName}
                          onChange={(e) => handleUpdateSocialAccount(acc.id, { accountName: e.target.value })}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none w-36"
                        />
                      </td>

                      {/* Identifier */}
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={acc.accountIdentifier}
                          onChange={(e) => handleUpdateSocialAccount(acc.id, { accountIdentifier: e.target.value })}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none w-36"
                        />
                      </td>

                      {/* Bound Role */}
                      <td className="py-3 px-3">
                        <select
                          value={acc.boundRoleId}
                          onChange={(e) => handleUpdateSocialAccount(acc.id, { boundRoleId: e.target.value })}
                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none w-40"
                        >
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.avatar} {r.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Auto reply */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleUpdateSocialAccount(acc.id, { autoReply: !acc.autoReply })}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                            acc.autoReply
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {acc.autoReply ? '自动回复开启' : '关闭'}
                        </button>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeleteSocialAccount(acc.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 transition"
                          title="删除该账号配置"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Social Sandbox Tester */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play size={16} className="text-emerald-400" />
                <h4 className="font-semibold text-slate-200 text-xs">多社交账号调度测试沙盒 (Live API Sandbox)</h4>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">POST /api/social/chat</span>
            </div>
            <p className="text-[11px] text-slate-400">
              在您的轻量级应用接入前，可在此即时模拟各个社交账号的客户提问，测试知识库自动穿透与业务回复质量。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">选择测试账号</label>
                <select
                  value={selectedSocialAccount}
                  onChange={(e) => setSelectedSocialAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                >
                  {socialConfig.accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.platform}] {a.accountName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] text-slate-400">模拟客户提问</label>
                <input
                  type="text"
                  value={socialSandboxMsg}
                  onChange={(e) => setSocialSandboxMsg(e.target.value)}
                  placeholder="输入测试问题..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <button
                  onClick={handleRunSocialSandbox}
                  disabled={isTestingSocialSandbox}
                  className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Send size={13} />
                  <span>{isTestingSocialSandbox ? '调用中...' : '模拟发起请求'}</span>
                </button>
              </div>
            </div>

            {socialSandboxResult && (
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex flex-wrap items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-300">返回状态: 200 OK</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300">账号: {socialSandboxResult.metadata?.accountName}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-cyan-300 font-mono">模型: {socialSandboxResult.metadata?.modelUsed}</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-semibold">
                    总耗时: {socialSandboxResult.metadata?.latencyMs} ms
                  </span>
                </div>

                <div className="text-xs text-slate-100 leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto font-sans p-3 rounded-lg bg-slate-900 border border-slate-800">
                  {socialSandboxResult.reply}
                </div>

                {socialSandboxResult.citations && socialSandboxResult.citations.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-cyan-400 font-semibold block mb-1">
                      📚 本地知识库引用根据 ({socialSandboxResult.citations.length} 处匹配):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {socialSandboxResult.citations.map((c: any, i: number) => (
                        <div key={i} className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <div className="font-semibold text-slate-200 truncate">[{c.index}] {c.pointName || c.title}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{c.sourceDoc} ({c.pageNumber || 'P.1'})</div>
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{c.contentSnippet}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: 一键集成代码与悬浮挂靠嵌入
          ========================================================================= */}
      {activeSubTab === 'quick_embed' && (
        <div className="space-y-6">
          {/* Overview Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Code2 size={16} className="text-amber-400" />
              <span>部署并接入到您的“轻量级多社交账号平台应用”</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              根据您的技术栈，选择最适合的方式将这套 AI 业务工作台对接到您的轻量级应用中。
              无论是前端挂靠侧边栏、Node.js 服务端中间件，还是 Python/cURL 脚本，均可直接复制使用。
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Option 1: Node.js Middleware */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Server size={14} className="text-emerald-400" />
                    <span className="font-semibold text-xs text-slate-200">方案 A: Node.js / Express 极简轻量集成</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(nodeIntegrationSnippet, 'node_code')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedKey === 'node_code' ? <Check size={12} /> : <Copy size={12} />}
                    <span>一键复制代码</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  直接将此函数复制到您的多社交平台后端服务中，收到微信/TG/WhatsApp客户提问时直接一行调用。
                </p>
                <pre className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
                  {nodeIntegrationSnippet}
                </pre>
              </div>
            </div>

            {/* Option 2: Python Adapter */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Code2 size={14} className="text-sky-400" />
                    <span className="font-semibold text-xs text-slate-200">方案 B: Python / FastAPI 极简适配器</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(pythonIntegrationSnippet, 'py_code')}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedKey === 'py_code' ? <Check size={12} /> : <Copy size={12} />}
                    <span>一键复制代码</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  适合 Python 编写的多社交账号管理机器人系统或客服调度中间件。
                </p>
                <pre className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
                  {pythonIntegrationSnippet}
                </pre>
              </div>
            </div>

            {/* Option 3: Frontend Floating Dock Iframe */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ExternalLink size={14} className="text-amber-400" />
                  <span className="font-semibold text-xs text-slate-200">方案 C: 前端悬浮侧边栏一键贴合挂靠 (UI 嵌入)</span>
                </div>
                <button
                  onClick={() => copyToClipboard(embedIframeSnippet, 'iframe_code')}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedKey === 'iframe_code' ? <Check size={12} /> : <Copy size={12} />}
                  <span>复制嵌入代码</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                若您的自建多社交账号平台是 Web 网页版（如 React/Vue/原生网页），只需在您的主界面引入以下代码，即可将本 AI 业务工作台作为专属悬浮侧边栏挂靠在右侧：
              </p>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
                {embedIframeSnippet}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
