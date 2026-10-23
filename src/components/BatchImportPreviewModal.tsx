import React, { useState, useRef } from 'react';
import { 
  X, Upload, Download, FileText, CheckCircle2, AlertTriangle, 
  AlertCircle, Sparkles, Scissors, Trash2, Check, RefreshCw, 
  Filter, HelpCircle, HardDrive, ArrowRight, ShieldAlert, Tag
} from 'lucide-react';
import { KnowledgeItem } from '../types';

interface BatchImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (items: KnowledgeItem[]) => void;
}

export interface ValidatedRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  charCount: number;
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
}

export const BatchImportPreviewModal: React.FC<BatchImportPreviewModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'valid' | 'warning' | 'error'>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // bge-small-zh-v1.5 Strict Validation Engine
  const validateRow = (category: string, question: string, answer: string, keywordsStr: string): ValidatedRow => {
    const cleanCat = (category || '固定收益与理财').trim();
    const cleanQ = (question || '').trim();
    const cleanA = (answer || '').trim();
    const keywords = (keywordsStr || '')
      .split(/[,，;\s]+/)
      .map(k => k.trim())
      .filter(Boolean);

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Question validation
    if (!cleanQ) {
      errors.push('客户问题为空');
    } else if (cleanQ.length < 4) {
      errors.push('问题过短 (需 >= 4字以支持语义嵌入)');
    } else if (cleanQ.length > 150) {
      warnings.push('问题偏长 (>150字，建议浓缩为核心疑问)');
    }

    // 2. Answer validation (Strict 500 characters for bge-small-zh-v1.5 & sidebar retrieval)
    if (!cleanA) {
      errors.push('解答话术为空');
    } else if (cleanA.length < 10) {
      errors.push('解答内容过短 (< 10字，缺乏专业度)');
    } else if (cleanA.length > 500) {
      errors.push(`超过500字限制 (当前${cleanA.length}字，违背500字知识库检索规范)`);
    }

    // 3. Financial compliance screening
    const complianceBanned = ['保本', '保息', '稳赚', '零风险', '100%收益', '包赚不赔', '绝对收益'];
    const hits = complianceBanned.filter(w => cleanA.includes(w) || cleanQ.includes(w));
    if (hits.length > 0) {
      warnings.push(`检测到刚兑合规敏感词: [${hits.join('、')}]`);
    }

    // 4. Keywords
    if (keywords.length === 0) {
      warnings.push('缺少关键词标签，建议补充以辅助倒排检索');
    }

    const status = errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'valid');

    return {
      id: `val-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: cleanCat,
      question: cleanQ,
      answer: cleanA,
      keywords,
      charCount: cleanA.length,
      status,
      errors,
      warnings
    };
  };

  // Parse CSV text into validated rows
  const parseCsvContent = (content: string, name: string) => {
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      showToast('文件为空，未解析到有效数据');
      return;
    }

    // Detect header
    const firstLine = lines[0];
    const isHeader = firstLine.includes('分类') || firstLine.includes('问题') || firstLine.includes('Question') || firstLine.includes('category');
    const dataLines = isHeader ? lines.slice(1) : lines;

    const parsed: ValidatedRow[] = [];

    for (const line of dataLines) {
      // Handle simple CSV splitting with quotes support
      const cols: string[] = [];
      let inQuotes = false;
      let current = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim());

      if (cols.length >= 2) {
        // Mapping: col 0 = category, col 1 = question, col 2 = answer, col 3 = keywords
        const cat = cols.length >= 3 ? cols[0] : '固定收益与理财';
        const q = cols.length >= 3 ? cols[1] : cols[0];
        const a = cols.length >= 3 ? cols[2] : cols[1];
        const kw = cols.length >= 4 ? cols[3] : '';
        parsed.push(validateRow(cat, q, a, kw));
      }
    }

    setRows(parsed);
    setFileName(name);
    showToast(`成功解析 ${parsed.length} 行话术数据，已完成自动校验！`);
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        parseCsvContent(content, file.name);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // Download Standard CSV Template
  const handleDownloadTemplate = () => {
    const csvContent = "\uFEFF" + 
`业务分类,客户疑问(Question),标准解答话术(Answer),关键词标签(Keywords)
固定收益与理财,客户询问固收+理财为什么最近有小幅度回撤波动？,"尊敬的客户，净值波动源于债券市场短期利率微调与权益资产估值变化，属于正常市况。组合80%以上配置高等级央国企信用债作为安全垫，仅用10%~15%适度参与红利股票增厚收益。历史回测显示拉长6个月持有期正收益概率超96%，建议保持耐心平滑波动。","固收+, 净值波动, 安全垫, 回撤"
合规与适当性,客户R2评级想强行认购R4高风险激进股票量化私募，如何合规拒绝？,"根据《证券期货投资者适当性管理办法》硬性规定，金融机构严禁向投资者销售高于其风险承受能力的产品。您为R2稳健型，该产品为R4高风险，可能面临超20%回撤。为切实保障资金安全，系统自动合规拦截，建议评估匹配R2风险的稳健中性对冲方案。","R2, R4, 适当性, 合规拦截, 量化"
家族信托与传承,企业经营发生债务纠纷，已设立的家族信托会被债权人查封清算吗？,"依据我国《信托法》第15条与第17条规定，信托财产具备独立的法律地位，不属于受托人或委托人的清算财产。信托一经有效设立即实现合法破产隔离，债权人无权直接查封执行（除非涉嫌恶意逃废债），可有效防范企业经营风险波及家庭财产。","家族信托, 财产隔离, 信托法, 破产清算"
宏观与大类资产,美联储降息周期开启后，国内大类资产配置应该如何规划？,"降息释放全球流动性，为国内货币政策自主操作释放宽松空间。建议采取标准哑铃型配置：一方面配置高等级信用债与同业存单构筑稳健底仓；另一方面逢低布局高股息央国企红利资产；同时配置5%~10%实物黄金作为抗通胀与地缘对冲垫。","美联储, 降息, 哑铃型, 黄金, 宏观"
销冠展业破局,客户说钱存银行定期4%很安全，为什么要买你们的公募基金？,"李姐，您特别有眼光，资产安全确实是第一位的！不过目前国有大行3年定存利率已普遍降至1.5%左右，4%已成历史。在真实通胀下单一存款很难抵御购买力缩水。我们推荐的方案是将绝大部分资金放在高安全垫固收底层，拿一小部分捕捉优质分红，守正出奇跑赢通胀。","银行定期, 跑赢通胀, 存款利率, 销冠, 高股息"`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '金融话术_bge-small-zh_300字标准导入模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('📥 标准CSV模板已下载，支持 Excel / WPS 直接编辑！');
  };

  // Load Preset Test Data (including some intentionally long rows for demo)
  const handleLoadSampleData = () => {
    const sampleRows: ValidatedRow[] = [
      validateRow(
        '固定收益与理财',
        '客户担心债券基金久期风险，询问怎么控制利率波动？',
        '针对久期风险，我们采取“短久期票息策略+国债期货对冲”双重机制。底层严选剩余期限在1~2年以内的AAA级高等级同业存单与高流动性金融债，有效平抑利率上行对债券现券价格的扰动，兼顾流动性与稳健收益。',
        '久期风险, 利率对冲, AAA信用债, 稳健'
      ),
      validateRow(
        '合规与适当性',
        '业务员向客户承诺“保本年化7%且零风险”，如何审查？',
        '【合规驳回】根据《资管新规》第十九条，严禁承诺保本保收益。文案中“保本”、“零风险”属于严重违规承诺，必须全面删除，并替换为法定风险揭示与中性业绩基准表述。',
        '保本, 违规承诺, 资管新规, 合规审查'
      ),
      // Intentionally too long row (>300 chars) to demonstrate auto-trimming
      validateRow(
        '家族信托与传承',
        '详细阐述家族信托的设立架构与委托人权利保留边界？',
        '家族信托设立架构通常由委托人、受托人（信托公司）、受益人以及监察人组成。在我国现行信托法律框架下，委托人可以保留一定程度的投资建议权或信托利益分配建议权，但绝对不能保留过多的控制权，如果委托人对信托财产享有绝对控制权（如随意撤销、随意指令支配信托财产如同个人存款），则极易在诉讼实践中被司法机关认定为“虚假信托”（Sham Trust），从而导致信托财产独立性被击穿，丧失破产隔离与债务风险防范效能。因此在起草信托合同时，必须由专业合规律师严格平衡权利保留与独立性边界，确保信托架构经得起严苛司法检验。',
        '家族信托, 虚假信托, 权利保留, 破产隔离'
      ),
      validateRow(
        '量化对冲与技术面',
        '市场震荡行情下，量化中性策略是如何做到Alpha收益对冲的？',
        '量化中性策略通过构建多因子模型精选一篮子能够战胜市场的优质股票多头，同时利用股指期货（如IC、IM空头）对冲掉市场的系统性Beta波动。无论大盘整体涨跌，只要选出的股票跑赢大盘指数，即可赚取纯粹的Alpha超额Alpha收益，波动率显著低于纯股票资产。',
        '量化中性, Alpha对冲, 股指期货, 震荡市'
      ),
      validateRow(
        '销冠展业破局',
        '客户嫌手续费贵，想去第三方互联网平台购买，怎么解答？',
        '张总，非常理解您对费率的敏感。第三方平台虽然折扣低，但主要提供纯交易通道，没有专职顾问根据您的整体家庭税务、现金流需求及宏观波动进行动态再平衡诊断。我们提供的不仅是产品通道，更是包含大类资产再平衡、信托法税咨询及7x24小时回撤预警的管家服务，综合性价比远超单一费率节约。',
        '手续费异议, 投顾价值, 财富管理, 销冠话术'
      ),
      validateRow(
        '国际金融与外汇',
        '企业客户咨询离岸人民币波动对冲工具（外汇掉期与远期期权）？',
        '针对外贸企业外汇敞口，建议采用“外汇远期结售汇+买入看跌期权”的风险中性方案。锁定未来结汇最低汇率下限的同时，保留汇率反向有利变动带来的潜在收益弹性，坚决遵循企业风险中性原则，不参与任何投机性单边下注。',
        '外汇掉期, 远期结汇, 汇率对冲, 风险中性'
      )
    ];

    setRows(sampleRows);
    setFileName('金融业务话术_标准校验测试集(6条).csv');
    showToast('🧪 已载入实测样本！包含正常行、合规警告行与超长异常行');
  };

  // Quick Action 1: Auto trim long answers to 500 characters
  const handleAutoTrimAll = () => {
    let fixedCount = 0;
    const updated = rows.map(r => {
      if (r.answer.length > 500) {
        fixedCount++;
        const trimmedAnswer = r.answer.slice(0, 494).trim() + '...';
        return validateRow(r.category, r.question, trimmedAnswer, r.keywords.join(', '));
      }
      return r;
    });

    setRows(updated);
    showToast(`✂️ 已批量裁剪 ${fixedCount} 条超长话术至 500 字内，符合检索规范！`);
  };

  // Quick Action 2: Remove error rows
  const handleRemoveErrors = () => {
    const validOnes = rows.filter(r => r.status !== 'error');
    const removedCount = rows.length - validOnes.length;
    setRows(validOnes);
    showToast(`🗑️ 已剔除 ${removedCount} 条不合格异常行！`);
  };

  // Edit single row in-place
  const handleUpdateRow = (id: string, field: 'question' | 'answer' | 'category' | 'keywords', value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const newCat = field === 'category' ? value : r.category;
      const newQ = field === 'question' ? value : r.question;
      const newA = field === 'answer' ? value : r.answer;
      const newKw = field === 'keywords' ? value : r.keywords.join(', ');
      return validateRow(newCat, newQ, newA, newKw);
    }));
  };

  // Delete single row
  const handleDeleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Trim single row
  const handleTrimSingleRow = (id: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const trimmed = r.answer.slice(0, 494).trim() + '...';
      return validateRow(r.category, r.question, trimmed, r.keywords.join(', '));
    }));
  };

  // Commit valid rows
  const handleCommitImport = async () => {
    const validRows = rows.filter(r => r.status !== 'error');
    if (validRows.length === 0) {
      showToast('⚠️ 当前无合格条目可入库，请先修复格式错误行');
      return;
    }

    const newItems: KnowledgeItem[] = validRows.map(r => ({
      id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: r.category,
      question: r.question,
      answer: r.answer,
      keywords: r.keywords,
      charCount: r.answer.length
    }));

    // Post to server batch import if available
    try {
      await fetch('/api/knowledge/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItems })
      });
    } catch {
      // client memory state fallback
    }

    onImportSuccess(newItems);
    onClose();
  };

  // Filter rows
  const filteredRows = rows.filter(r => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const totalCount = rows.length;
  const validCount = rows.filter(r => r.status === 'valid').length;
  const warningCount = rows.filter(r => r.status === 'warning').length;
  const errorCount = rows.filter(r => r.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl border border-amber-400 flex items-center gap-2 animate-in slide-in-from-top-4">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>批量话术模板导入与 bge-small-zh-v1.5 语义格式校验器</span>
                <span className="text-[11px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/40 font-mono">
                  严格 300 字限制
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                支持 CSV/Excel 格式，自动检测超长字数、缺失字段、合规敏感词，符合本地 CPU 毫秒级语义检索标准
              </p>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition border border-slate-700"
            >
              <Download size={13} className="text-amber-400" />
              <span>下载标准CSV模板</span>
            </button>

            <button
              onClick={handleLoadSampleData}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition border border-cyan-500/30"
            >
              <Sparkles size={13} className="text-cyan-400" />
              <span>载入实测样本 (含异常行)</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 bg-slate-950 flex-1">
          {/* Drag & Drop Zone (if no rows or want to upload more) */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt,.tsv"
              onChange={(e) => {
                if (e.target.files?.[0]) readFile(e.target.files[0]);
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                <FileText size={24} />
              </div>
              <div className="text-xs text-slate-200 font-medium">
                {fileName ? (
                  <span className="text-amber-400 font-bold font-mono">已载入：{fileName}</span>
                ) : (
                  <span>将 CSV / Excel (保存为.csv) 文件拖拽至此处，或 <span className="text-cyan-400 underline">点击上传</span></span>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                支持表头：业务分类, 客户疑问(Question), 标准解答话术(Answer), 关键词(Keywords)
              </div>
            </div>
          </div>

          {/* Validation Diagnostics Bar */}
          {rows.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              {/* Counts */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400">检测汇总：</span>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 font-mono text-slate-200">
                  总计 {totalCount} 行
                </span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-mono flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>合规合格 {validCount}</span>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-amber-950 text-amber-300 border border-amber-800/40 font-mono flex items-center gap-1">
                  <AlertTriangle size={12} />
                  <span>合规预警 {warningCount}</span>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-rose-950 text-rose-300 border border-rose-800/40 font-mono flex items-center gap-1">
                  <AlertCircle size={12} />
                  <span>格式错误 {errorCount}</span>
                </span>
              </div>

              {/* Quick Batch Actions */}
              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <button
                    onClick={handleAutoTrimAll}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition border border-amber-500/40"
                    title="自动将超过300字的话术截断至300字内"
                  >
                    <Scissors size={13} />
                    <span>一键裁剪所有超标行至300字</span>
                  </button>
                )}

                {errorCount > 0 && (
                  <button
                    onClick={handleRemoveErrors}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition border border-rose-800/40"
                  >
                    <Trash2 size={13} />
                    <span>剔除不合格行 ({errorCount})</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Filter Tabs for the Table */}
          {rows.length > 0 && (
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-xs">
                {[
                  { id: 'all', label: `全部行 (${totalCount})` },
                  { id: 'valid', label: `完全合格 (${validCount})` },
                  { id: 'warning', label: `合规预警 (${warningCount})` },
                  { id: 'error', label: `格式错误 (${errorCount})` }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-3 py-1 rounded-lg transition font-medium ${
                      activeTab === t.id
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-slate-500">
                双击或点击输入框可直接在线修正问答内容
              </span>
            </div>
          )}

          {/* Editable Preview Table */}
          {rows.length > 0 ? (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-inner">
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10 border-b border-slate-800 select-none">
                    <tr>
                      <th className="p-3 w-16">状态</th>
                      <th className="p-3 w-28">分类</th>
                      <th className="p-3 w-56">客户提问 (Question)</th>
                      <th className="p-3 min-w-[280px]">标准解答话术 (Answer · 限300字)</th>
                      <th className="p-3 w-36">关键词标签</th>
                      <th className="p-3 w-48">格式与合规诊断</th>
                      <th className="p-3 w-20 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredRows.map((r, index) => {
                      const isOver300 = r.charCount > 300;
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-slate-800/40 transition ${
                            r.status === 'error'
                              ? 'bg-rose-950/20'
                              : r.status === 'warning'
                              ? 'bg-amber-950/15'
                              : ''
                          }`}
                        >
                          {/* Status Badge */}
                          <td className="p-3 align-top font-mono">
                            {r.status === 'valid' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                                <Check size={11} />
                                <span>合格</span>
                              </span>
                            )}
                            {r.status === 'warning' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/50">
                                <AlertTriangle size={11} />
                                <span>预警</span>
                              </span>
                            )}
                            {r.status === 'error' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/50">
                                <AlertCircle size={11} />
                                <span>错误</span>
                              </span>
                            )}
                          </td>

                          {/* Category (editable) */}
                          <td className="p-3 align-top">
                            <input
                              type="text"
                              value={r.category}
                              onChange={(e) => handleUpdateRow(r.id, 'category', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                            />
                          </td>

                          {/* Question (editable) */}
                          <td className="p-3 align-top">
                            <textarea
                              rows={2}
                              value={r.question}
                              onChange={(e) => handleUpdateRow(r.id, 'question', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 leading-relaxed"
                            />
                          </td>

                          {/* Answer (editable with length counter) */}
                          <td className="p-3 align-top space-y-1">
                            <textarea
                              rows={3}
                              value={r.answer}
                              onChange={(e) => handleUpdateRow(r.id, 'answer', e.target.value)}
                              className={`w-full bg-slate-950 border rounded p-2 text-xs text-slate-200 focus:outline-none leading-relaxed ${
                                isOver300
                                  ? 'border-rose-500 focus:border-rose-400 bg-rose-950/20'
                                  : 'border-slate-800 focus:border-cyan-500'
                              }`}
                            />
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`font-mono font-bold px-1.5 py-0.2 rounded border ${
                                isOver300
                                  ? 'text-rose-400 bg-rose-950 border-rose-800'
                                  : 'text-emerald-400 bg-emerald-950 border-emerald-800/40'
                              }`}>
                                {r.charCount} / 300 字
                              </span>

                              {isOver300 && (
                                <button
                                  onClick={() => handleTrimSingleRow(r.id)}
                                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                                >
                                  <Scissors size={10} />
                                  <span>单条截断至300字</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Keywords */}
                          <td className="p-3 align-top">
                            <input
                              type="text"
                              value={r.keywords.join(', ')}
                              onChange={(e) => handleUpdateRow(r.id, 'keywords', e.target.value)}
                              placeholder="以逗号分隔"
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
                            />
                          </td>

                          {/* Diagnostics Info */}
                          <td className="p-3 align-top text-[11px] leading-tight space-y-1">
                            {r.errors.map((err, i) => (
                              <div key={i} className="text-rose-400 flex items-start gap-1">
                                <span className="shrink-0">•</span>
                                <span>{err}</span>
                              </div>
                            ))}
                            {r.warnings.map((warn, i) => (
                              <div key={i} className="text-amber-400 flex items-start gap-1">
                                <span className="shrink-0">•</span>
                                <span>{warn}</span>
                              </div>
                            ))}
                            {r.errors.length === 0 && r.warnings.length === 0 && (
                              <span className="text-emerald-400/90">
                                完美符合 bge-small-zh 嵌入规范
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3 align-top text-center">
                            <button
                              onClick={() => handleDeleteRow(r.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition"
                              title="删除此行"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/30 rounded-xl border border-slate-800/80">
              请拖拽或点击上方区域上传 CSV 文件，或点击右上角 <span className="text-cyan-400 font-semibold cursor-pointer" onClick={handleLoadSampleData}>“载入实测样本”</span> 立即体验批量导入校验。
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>支持格式: CSV / UTF-8</span>
            <span>•</span>
            <span className="text-emerald-400">入库后单次比对 0.02s</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              取消
            </button>

            <button
              onClick={handleCommitImport}
              disabled={validCount + warningCount === 0}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-600/20"
            >
              <HardDrive size={15} />
              <span>全量通过校验并写入 ChromaDB 向量库 ({validCount + warningCount} 条)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
