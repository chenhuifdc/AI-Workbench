import React, { useState, useRef } from 'react';
import { 
  X, Upload, FileText, CheckCircle2, Sparkles, Tag, 
  Layers, HardDrive, Check, AlertCircle, FileCode, ArrowRight,
  ShieldCheck, HelpCircle, Eye
} from 'lucide-react';
import { DifyChunk, DifyDocument } from '../types';
import { autoExtractQADocument, ExtractedQAResult, KNOWLEDGE_CATEGORIES } from '../utils/documentExtractor';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string;
  datasetName: string;
  onUploadSuccess: (result: { document: DifyDocument; chunks: DifyChunk[] }) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  datasetId,
  datasetName,
  onUploadSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'extracted_qa' | 'raw_document'>('extracted_qa');
  const [fileName, setFileName] = useState<string>('财富管理部_客户异议应对指引v2.md');
  const [fileFormat, setFileFormat] = useState<'markdown' | 'txt' | 'docx' | 'pdf' | 'csv' | 'json'>('markdown');
  const [rawText, setRawText] = useState<string>(`# 财富管理部客户异议应对指引 (V2.0)

## 一、固收+理财产品净值短期波动应对口径
> 适用场景：客户因市场波动净值微降前来咨询或表示担忧时。

尊敬的客户，非常理解您的关注。近期的净值波动主要源于债券市场短期利率微调以及权益仓位估值变动，这是净值型产品的正常市场反映。从资产配置角度看，我们的“固收+”底层80%以上配置高等级央国企信用债与高流动性同业存单，提供稳健安全垫；仅有10%~15%适度参与红利低波与高股息蓝筹股票以增厚长线收益。历史回测显示，拉长6个月以上持有周期，正收益概率超96%。建议您保持耐心，避免在短期调整中错失后续收益反弹。

## 二、银行定期存款降息后的基金替代说服策略
【客户真实抗拒】：客户表示“钱存银行定期4%很安全，为什么要买你们的基金？”
【销冠标准应对话术】：
李姐，您特别有眼光，资产安全确实永远是第一位的！不过目前国有大行3年期定存利率已经普遍下调至1.5%左右，4%的定存已成历史。在真实通胀与货币购买力变化下，单一存款实际上很难抵御资产缩水。我们推荐的“稳健收益+”基金组合，并不是要您把钱都拿来冒险，而是把大部分资金放在类似定存安全度的固收底层，拿出一小部分参与优质蓝筹分红，既守护本金安全，又争取跑赢通胀。`);

  const [extractedResult, setExtractedResult] = useState<ExtractedQAResult | null>(() => {
    return autoExtractQADocument(
      `# 财富管理部客户异议应对指引 (V2.0)\n\n## 一、固收+理财产品净值短期波动应对口径\n尊敬的客户，非常理解您的关注。近期的净值波动主要源于债券市场短期利率微调以及权益仓位估值变动，这是净值型产品的正常市场反映。从资产配置角度看，我们的“固收+”底层80%以上配置高等级央国企信用债与高流动性同业存单，提供稳健安全垫；仅有10%~15%适度参与红利低波与高股息蓝筹股票以增厚长线收益。历史回测显示，拉长6个月以上持有周期，正收益概率超96%。建议您保持耐心，避免在短期调整中错失后续收益反弹。\n\n## 二、银行定期存款降息后的基金替代说服策略\n【客户真实抗拒】：客户表示“钱存银行定期4%很安全，为什么要买你们的基金？”\n【销冠标准应对话术】：\n李姐，您特别有眼光，资产安全确实永远是第一位的！不过目前国有大行3年期定存利率已经普遍下调至1.5%左右，4%的定存已成历史。在真实通胀与货币购买力变化下，单一存款实际上很难抵御资产缩水。我们推荐的“稳健收益+”基金组合，并不是要您把钱都拿来冒险，而是把大部分资金放在类似定存安全度的固收底层，拿出一小部分参与优质蓝筹分红，既守护本金安全，又争取跑赢通胀。`,
      '财富管理部_客户异议应对指引v2.md',
      'markdown',
      datasetId
    );
  });

  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleProcessText = (content: string, name: string, fmt: 'markdown' | 'txt' | 'docx' | 'pdf' | 'csv' | 'json') => {
    setRawText(content);
    setFileName(name);
    setFileFormat(fmt);
    const res = autoExtractQADocument(content, name, fmt, datasetId);
    setExtractedResult(res);
    showToast(`✅ 智能分析完成：成功解析出 ${res.chunks.length} 组标准 QA 问答对与分类标签！`);
  };

  const handleFileChange = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    let fmt: 'markdown' | 'txt' | 'docx' | 'pdf' | 'csv' | 'json' = 'txt';
    if (ext === 'md') fmt = 'markdown';
    else if (ext === 'docx' || ext === 'doc') fmt = 'docx';
    else if (ext === 'pdf') fmt = 'pdf';
    else if (ext === 'csv') fmt = 'csv';
    else if (ext === 'json') fmt = 'json';

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result || '');
      handleProcessText(content, file.name, fmt);
    };
    reader.readAsText(file);
  };

  // Preset sample document loaders
  const loadPreset = (type: 'markdown' | 'docx' | 'txt') => {
    if (type === 'markdown') {
      const sample = `# 财富管理部客户异议应对指引 (V2.0)\n\n## 一、固收+理财产品净值短期波动应对口径\n尊敬的客户，非常理解您的关注。近期的净值波动主要源于债券市场短期利率微调以及权益仓位估值变动，这是净值型产品的正常市场反映。从资产配置角度看，我们的“固收+”底层80%以上配置高等级央国企信用债与高流动性同业存单，提供稳健安全垫；仅有10%~15%适度参与红利低波与高股息蓝筹股票以增厚长线收益。历史回测显示，拉长6个月以上持有周期，正收益概率超96%。建议您保持耐心，避免在短期调整中错失后续收益反弹。\n\n## 二、银行定期存款降息后的基金替代说服策略\n【客户真实抗拒】：客户表示“钱存银行定期4%很安全，为什么要买你们的基金？”\n【销冠标准应对话术】：\n李姐，您特别有眼光，资产安全确实永远是第一位的！不过目前国有大行3年期定存利率已经普遍下调至1.5%左右，4%的定存已成历史。在真实通胀与货币购买力变化下，单一存款实际上很难抵御资产缩水。我们推荐的“稳健收益+”基金组合，并不是要您把钱都拿来冒险，而是把大部分资金放在类似定存安全度的固收底层，拿出一小部分参与优质蓝筹分红，既守护本金安全，又争取跑赢通胀。`;
      handleProcessText(sample, '财富管理部_客户异议应对指引v2.md', 'markdown');
    } else if (type === 'docx') {
      const sample = `【文档主题】：适当性合规管理制度及标准应答口径\n\n【问题一】：客户测评为R2稳健型，强烈要求认购R4高风险量化股票基金，如何合规拒绝与引导？\n【解答一】：张总，非常感谢您对量化策略收益弹性的关注。根据中国证监会及银保监会《证券期货投资者适当性管理办法》硬性规定，金融机构严禁向投资者销售高于其风险承受能力的金融产品。您的测评为R2稳健型，而该量化私募为R4高风险，存在回撤超过20%的可能。为切实保障您的资产安全，我们系统合规拦截该笔认购。若您经过审慎评估自身风险偏好确有变化，可重新进行合规问卷测评；同时，我也为您精选了匹配R2风险、包含量化中性对冲策略的低波动FOF方案，请允许我为您对比分析。\n\n【问题二】：资管新规刚性兑付禁用词汇红线与修正示范有哪些？\n【解答二】：根据《关于规范金融机构资产管理业务的指导意见》第十九条，金融机构严禁直接或间接向投资者承诺保本保收益。以下属于严重违规词汇红线：保本、保息、稳赚、零风险、100%收益、包赚不赔。修正示范：“本产品历史收益稳健”应修改为“本产品过往业绩仅供参考，不代表未来表现”；“零风险理财”应修改为“中低风险（R2）稳健型配置工具”。`;
      handleProcessText(sample, '适当性合规拦截与资管新规红线口径.docx', 'docx');
    } else {
      const sample = `【法商案例库】：家族信托财产独立与债务隔离实务指南\n\n问：企业家客户担心企业经营风险波及个人家庭资产，咨询家族信托能否防范债务破产清算？\n答：依据我国《信托法》第十五条与第十七条规定，信托财产具备独立的法律地位，不属于受托人的固有财产，也不属于委托人的清算财产。信托一经有效设立，信托财产即实现合法破产隔离，债权人无权直接查封执行（除非涉嫌恶意转移逃废债）。通过设立不可撤销家族信托，不仅能有效防范企业经营连带风险，还能预先设立子女定向分配、防挥霍机制及婚姻资产保护，实现真正的百年家业基业长青。\n\n问：委托人能否随时无条件把信托里面的钱取出来？过度权利保留有什么法律后果？\n答：在家族信托架构设计中，委托人可以保留一定程度的投资建议权或信托利益分配建议权，但切忌保留过度控制权。若委托人对信托财产享有绝对控制权（如随意变更受益人、随时无条件指令受托人撤回财产如同个人活期存款），在诉讼实务中极易被法院认定为“虚假信托”（Sham Trust），进而判定信托财产独立性被击穿，丧失债务隔离效力。必须在专业法务指导下合理设定保护人与监察人机制。`;
      handleProcessText(sample, '家族信托财产独立与债务隔离案例法商.txt', 'txt');
    }
  };

  const handleConfirmImport = () => {
    if (!extractedResult || extractedResult.chunks.length === 0) return;
    onUploadSuccess({
      document: extractedResult.document,
      chunks: extractedResult.chunks
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Toast */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-1.5 animate-in slide-in-from-top-4">
            <CheckCircle2 size={14} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Upload size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>文档智能导入 · 自动提取 QA 问答与标签</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  不破坏上传格式 · 检索字数严格≤500字
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                目标知识库：<span className="text-amber-400 font-semibold">{datasetName}</span> · 自动分类与关键词倒排加权提升召回准确度
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Upload Zone & Quick Sample Loaders */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
              }}
              accept=".md,.txt,.docx,.doc,.pdf,.csv,.json"
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
              <FileText size={16} className="text-cyan-400" />
              <span className="font-semibold">点击选择文件 或 拖拽文档到此处</span>
              <span className="text-slate-500 text-[11px]">
                (支持 Markdown / Word / TXT / PDF / CSV / JSON 原格式上传)
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Sparkles size={12} className="text-amber-400" />
              <span>快速载入测试业务文档：</span>
              <button
                onClick={() => loadPreset('markdown')}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800"
              >
                📄 客户异议应对指引.md
              </button>
              <button
                onClick={() => loadPreset('docx')}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800"
              >
                📄 适当性合规拦截口径.docx
              </button>
              <button
                onClick={() => loadPreset('txt')}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-800"
              >
                📄 家族信托债务隔离法商.txt
              </button>
            </div>

            <div className="text-slate-400 font-mono text-[10px] flex items-center gap-2">
              <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                当前文档: {fileName}
              </span>
              <span className="bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                格式: {fileFormat.toUpperCase()} (未删改)
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="px-6 pt-3 bg-slate-950 flex items-center justify-between border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('extracted_qa')}
              className={`px-3.5 py-2 font-bold rounded-t-lg transition flex items-center gap-1.5 border-t border-x ${
                activeTab === 'extracted_qa'
                  ? 'bg-slate-900 text-cyan-300 border-slate-700 shadow'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>智能 QA 拆解与标签索引视图</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                {extractedResult?.chunks.length || 0} 组 QA
              </span>
            </button>

            <button
              onClick={() => setActiveTab('raw_document')}
              className={`px-3.5 py-2 font-bold rounded-t-lg transition flex items-center gap-1.5 border-t border-x ${
                activeTab === 'raw_document'
                  ? 'bg-slate-900 text-cyan-300 border-slate-700 shadow'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <FileCode size={13} className="text-slate-400" />
              <span>原始文档预览 (保持原文档格式)</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                {rawText.length} 字符
              </span>
            </button>
          </div>

          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <ShieldCheck size={13} />
            <span>检索字数约束：严格限制在 500 字以内</span>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-4">
          {activeTab === 'extracted_qa' ? (
            <div className="space-y-4">
              {/* Extraction Summary Strip */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-slate-300">
                    <span className="text-slate-500">解析QA问答对：</span>
                    <span className="font-bold text-amber-400 font-mono">{extractedResult?.chunks.length || 0} 组</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <span className="text-slate-500">识别详细分类：</span>
                    <span className="font-bold text-cyan-400">{extractedResult?.summary.categoriesFound.join(', ') || '未分类'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <span className="text-slate-500">自动提取标签：</span>
                    <span className="font-bold text-purple-400 font-mono">{extractedResult?.summary.keywordsCount || 0} 个</span>
                  </div>
                </div>

                <div className="text-emerald-400 text-[11px] font-mono flex items-center gap-1">
                  <span>单条平均字数: {extractedResult?.summary.avgCharCount || 0} 字 (全部 ≤500字)</span>
                </div>
              </div>

              {/* Chunks Cards List */}
              <div className="space-y-3.5">
                {extractedResult?.chunks.map((chk, index) => (
                  <div
                    key={chk.id || index}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 text-xs space-y-2.5 hover:border-slate-700 transition"
                  >
                    {/* Top Row: QA Question & Category */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center text-[10px] border border-amber-500/20">
                          Q{index + 1}
                        </span>
                        <span className="font-bold text-slate-100 text-sm">
                          {chk.question || chk.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-950 text-cyan-300 border border-cyan-800">
                          🏷️ {chk.category}
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                          字数: {chk.charCount} / ≤500字
                        </span>
                      </div>
                    </div>

                    {/* Standard Answer Content */}
                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                        <span className="text-emerald-400">💡 标准解答话术与业务规范：</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed font-sans bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
                        {chk.answer || chk.content}
                      </p>
                    </div>

                    {/* Bottom: Keyword tags and source formatting */}
                    <div className="flex flex-wrap items-center justify-between pt-1 text-[11px] gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-500 text-[10px]">关键词标签:</span>
                        {chk.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="bg-slate-900 text-cyan-300 px-2 py-0.5 rounded text-[10px] border border-slate-800"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                        <span>原文档: {chk.sourceDoc}</span>
                        <span className="bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                          bge-small-zh 嵌入就绪
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Raw Document View: Preserves unaltered layout and formatting
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">📄 原文档存储状态：</span>
                  <span>100% 保持上传格式与排版未改动</span>
                </div>
                <div className="font-mono text-[11px]">
                  字符总数: {rawText.length} | 扩展名: .{fileFormat}
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 leading-relaxed max-h-[460px] overflow-y-auto whitespace-pre-wrap select-text">
                {rawText}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>问答对 + 详细分类 + 关键词标签联合索引已准备就绪</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              取消
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={!extractedResult || extractedResult.chunks.length === 0}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-600/20"
            >
              <HardDrive size={14} />
              <span>保存入库并建立本地向量索引 ({extractedResult?.chunks.length || 0} 条)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
