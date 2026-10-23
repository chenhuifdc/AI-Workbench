import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, FileText, Tag, Copy, Check, 
  X, Bookmark, Hash, Layers, Sparkles,
  Save, Edit3, HelpCircle, FileCode, CheckCircle2
} from 'lucide-react';
import { ChatCitation } from '../types';

interface CitationSnippetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation: ChatCitation | null;
  onToast?: (msg: string) => void;
  onSaveCitation?: (updatedCitation: ChatCitation) => void;
}

// Helper to compute deterministic vector hash
function getVectorHash(citation: ChatCitation): string {
  const seed = `${citation.chunkId || ''}-${citation.title || ''}-${citation.sourceDoc || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `0x${hex}`;
}

export const CitationSnippetPreviewModal: React.FC<CitationSnippetPreviewModalProps> = ({
  isOpen,
  onClose,
  citation,
  onToast,
  onSaveCitation
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedCitationTag, setCopiedCitationTag] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Editable fields: QA提问场景、关键词、语义/知识点、话术文本
  const [editPointName, setEditPointName] = useState('');
  const [editQuestion, setEditQuestion] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (citation) {
      setEditPointName(citation.pointName || citation.title || '');
      setEditQuestion(citation.question || '');
      setEditKeywords((citation.keywords || []).join('、'));
      setEditContent(citation.contentSnippet || '');
      setIsSaved(false);
    }
  }, [citation]);

  if (!isOpen || !citation) return null;

  const footnoteIndex = citation.index || 1;
  const docName = citation.sourceDoc || citation.datasetName || '本地业务知识库';
  const pageStr = citation.pageNumber || '第1页';
  const charLength = editContent.length;
  const vectorHash = getVectorHash(citation);
  const format = (citation.originalDocFormat || docName.split('.').pop() || 'doc').toUpperCase();

  // 脚标联动：点击正文 [n] 打开本弹层后，自动高亮并滚动定位到命中原文切片
  const highlightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (citation && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [citation]);

  // 命中关键词 / QA 提问 / 知识点名称 → 在原文切片中高亮
  const highlightTerms = Array.from(new Set([
    ...(citation.keywords || []),
    ...(citation.question ? citation.question.split(/[\s,，。？?！!、；;：:]+/).filter(t => t.length >= 2) : []),
    citation.pointName || '',
    citation.title || ''
  ].map(t => String(t).trim()).filter(t => t.length >= 2)))
    .sort((a, b) => b.length - a.length)
    .slice(0, 20);


  const buildHighlighted = (source: string) => {
    if (!source) return null;
    // 纯字符串切分（不用正则，避免转义问题），逐词标记命中片段用于高亮
    let segments: { text: string; hit: boolean }[] = [{ text: source, hit: false }];
    for (const term of highlightTerms) {
      if (!term) continue;
      const next: { text: string; hit: boolean }[] = [];
      for (const seg of segments) {
        if (seg.hit) { next.push(seg); continue; }
        const pieces = seg.text.split(term);
        pieces.forEach((piece, i) => {
          if (i > 0) next.push({ text: term, hit: true });
          if (piece) next.push({ text: piece, hit: false });
        });
      }
      segments = next;
    }
    return segments.map((seg, i) =>
      seg.hit
        ? <mark key={i} className="bg-amber-500/40 text-amber-100 rounded px-0.5 font-semibold">{seg.text}</mark>
        : <React.Fragment key={i}>{seg.text}</React.Fragment>
    );
  };

  /** 命中切片定位节点：优先高亮关键词/知识点/QA 提问；词面无重合时整段作为命中切片高亮 */
  const hitSliceNode = (() => {
    const source = citation.contentSnippet || '';
    if (!source) return null;
    const hasKeywordOverlap = highlightTerms.some(t => source.includes(t));
    if (hasKeywordOverlap) return buildHighlighted(source);
    return (
      <span className="bg-amber-500/25 text-amber-100 rounded px-0.5 font-semibold">{source}</span>
    );
  })();

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(editContent);
    setCopiedSnippet(true);
    if (onToast) onToast('📋 知识点话术原文已复制到剪贴板！');
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleCopyCitationReference = () => {
    const citationRefText = `[${footnoteIndex}] 《${docName}》${pageStr} · 知识点：${editPointName || citation.title}`;
    navigator.clipboard.writeText(citationRefText);
    setCopiedCitationTag(true);
    if (onToast) onToast(`📑 已复制标准引用标注：${citationRefText}`);
    setTimeout(() => setCopiedCitationTag(false), 2000);
  };

  const handleSaveAndSync = () => {
    const parsedKeywords = editKeywords
      .split(/[,，、\s]+/)
      .map(k => k.trim())
      .filter(Boolean);

    const updated: ChatCitation = {
      ...citation,
      pointName: editPointName.trim() || citation.title,
      title: editPointName.trim() || citation.title,
      question: editQuestion.trim(),
      keywords: parsedKeywords,
      contentSnippet: editContent.trim(),
      charCount: editContent.trim().length
    };

    if (onSaveCitation) {
      onSaveCitation(updated);
    }

    setIsSaved(true);
    if (onToast) {
      onToast(`✅ 知识库QA提问场景与话术已保存更新！下次检索将直接命中新数据。`);
    }
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in select-none"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-extrabold text-sm flex items-center justify-center shadow-lg shadow-amber-500/20">
              [{footnoteIndex}]
            </span>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>知识点引用来源与在线优化工作台</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/80 font-mono">
                  {format} 原档
                </span>
                {isSaved && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1 font-sans">
                    <CheckCircle2 size={11} /> 已同步更新
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                支持编辑QA意图、关键词与话术文本 · 实时热更新本地混合知识库
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            title="关闭窗口 (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Detailed Hit Metadata Grid (命中详细信息) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
          {/* Source Document */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <FileText size={11} className="text-amber-400" />
              <span>来源文件名</span>
            </span>
            <div className="font-semibold text-slate-200 truncate text-[11px]" title={docName}>
              《{docName}》
            </div>
          </div>

          {/* Location / Page Number */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Bookmark size={11} className="text-cyan-400" />
              <span>段落位置 / 页码</span>
            </span>
            <div className="font-mono font-bold text-cyan-300 text-[11px]">
              📑 {pageStr}
            </div>
          </div>

          {/* Similarity Score */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Sparkles size={11} className="text-emerald-400" />
              <span>相似度分数</span>
            </span>
            <div className="font-mono font-bold text-emerald-400 text-[11px]">
              {(citation.similarity * 100).toFixed(1)}% 向量对齐
            </div>
          </div>

          {/* Vector Hash */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Hash size={11} className="text-purple-400" />
              <span>向量哈希校验</span>
            </span>
            <div className="font-mono font-bold text-purple-300 text-[11px]" title={`Chunk ID: ${citation.chunkId}`}>
              {vectorHash}
            </div>
          </div>
        </div>

        {/* 命中原文切片高亮定位（由正文脚标 [n] 联动打开，自动滚动到此处） */}
        <div
          ref={highlightRef}
          className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 border-l-2 border-l-amber-500 shrink-0"
        >
          <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5 mb-1.5">
            <Sparkles size={12} className="text-amber-400" />
            <span>命中原文切片高亮定位 · 脚标 [{footnoteIndex}] ·《{docName}》· 📑 {pageStr}</span>
            <span className="font-mono text-[10px] text-emerald-400 ml-auto shrink-0">
              相似度 {(citation.similarity * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-[11px] leading-relaxed text-slate-200 max-h-36 overflow-y-auto select-text">
            {hitSliceNode}
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500 font-mono">
            {highlightTerms.some(t => (citation.contentSnippet || '').includes(t))
              ? '命中位置：已高亮匹配到的关键词片段（黄色标记）'
              : '命中位置：本条为词面弱匹配，整段切片已高亮定位'}
          </div>
        </div>

        {/* Scrollable Editable Form Body */}
        <div className="space-y-3.5 flex-1 min-h-0 overflow-y-auto pr-1">
          {/* 1. 语义与知识点名称 */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Edit3 size={12} className="text-amber-400" />
                <span>语义与知识点名称 (标题匹配)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                用于意图标题稠密对齐
              </span>
            </label>
            <input
              type="text"
              value={editPointName}
              onChange={(e) => setEditPointName(e.target.value)}
              placeholder="输入精炼的业务知识点名称..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 shadow-inner font-medium"
            />
          </div>

          {/* 2. QA业务提问场景 */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <HelpCircle size={12} className="text-cyan-400" />
                <span>QA业务提问场景 (客户真实咨询问题对齐)</span>
              </span>
              <span className="text-[10px] text-cyan-400/80 font-mono">
                最高检索权重匹配
              </span>
            </label>
            <textarea
              rows={2}
              value={editQuestion}
              onChange={(e) => setEditQuestion(e.target.value)}
              placeholder="例如：客户担心固收+理财净值微调回撤，咨询底层安全垫怎么安抚？"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 leading-relaxed shadow-inner"
            />
          </div>

          {/* 3. 关键词标签 */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag size={12} className="text-purple-400" />
                <span>检索关键词标签 (BM25 倒排索引)</span>
              </span>
              <span className="text-[10px] text-slate-500">
                用顿号、逗号或空格隔开
              </span>
            </label>
            <input
              type="text"
              value={editKeywords}
              onChange={(e) => setEditKeywords(e.target.value)}
              placeholder="例如：固收+、净值波动、回撤、安全垫、持有期"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono shadow-inner"
            />
          </div>

          {/* 4. 话术文本内容 / 原文知识片段 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <BookOpen size={12} className="text-emerald-400" />
                <span>话术文本内容 / 原文知识片段</span>
              </label>
              <span className={`font-mono text-[11px] px-1.5 py-0.2 rounded border ${
                charLength <= 500 
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' 
                  : 'bg-rose-950/60 text-rose-400 border-rose-800/40'
              }`}>
                {charLength} / 500 字受控规范
              </span>
            </div>
            <textarea
              rows={6}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="在此编写严谨、专业的标准解答话术内容..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 leading-relaxed font-sans focus:outline-none focus:border-emerald-500 shadow-inner select-text"
            />
            <p className="text-[10px] text-slate-500">
              提示：修改后点击下方“保存修改并更新知识库”，新设定的QA意图、关键词与话术将即刻热更新入知识库，下次用户提问时将以新内容秒级精准匹配。
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySnippet}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition border border-slate-700 font-medium"
              title="复制当前话术文本"
            >
              {copiedSnippet ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedSnippet ? '已复制话术' : '复制话术'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              取消
            </button>

            <button
              onClick={handleSaveAndSync}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
              title="保存修改并热更新入混合知识库"
            >
              <Save size={13} />
              <span>保存修改并更新知识库</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
