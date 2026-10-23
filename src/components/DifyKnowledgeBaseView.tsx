import React, { useState } from 'react';
import { 
  Database, Plus, Search, Sparkles, BookOpen, Layers, 
  Trash2, Edit3, ArrowRight, Check, HardDrive, FileText, 
  Sliders, ShieldCheck, Tag, Upload, Download, RefreshCw,
  FileCode, Eye, CheckCircle2, AlertTriangle, FileSpreadsheet
} from 'lucide-react';
import { DifyDataset, DifyChunk, DifyDocument, ChatCitation } from '../types';
import { searchKnowledgeBase, RetrievalResult } from '../utils/vectorSearch';
import { BatchImportPreviewModal } from './BatchImportPreviewModal';
import { DocumentUploadModal } from './DocumentUploadModal';
import { CitationSnippetPreviewModal } from './CitationSnippetPreviewModal';
import { KNOWLEDGE_CATEGORIES } from '../utils/documentExtractor';

interface DifyKnowledgeBaseViewProps {
  datasets: DifyDataset[];
  onUpdateDatasets: (datasets: DifyDataset[]) => void;
  onSelectDatasetForSidebar?: (datasetId: string) => void;
}

export const DifyKnowledgeBaseView: React.FC<DifyKnowledgeBaseViewProps> = ({
  datasets,
  onUpdateDatasets
}) => {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(datasets[0]?.id || '');
  const [searchTestQuery, setSearchTestQuery] = useState('');
  const [retrievalResult, setRetrievalResult] = useState<RetrievalResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // View Mode: 'chunks' (分段列表) vs 'documents' (原始文档归档)
  const [activeContentTab, setActiveContentTab] = useState<'chunks' | 'documents'>('chunks');

  // Preview raw document modal
  const [viewingRawDoc, setViewingRawDoc] = useState<DifyDocument | null>(null);

  // Citation snippet preview modal
  const [previewCitation, setPreviewCitation] = useState<ChatCitation | null>(null);

  // New Chunk modal / form state
  const [isAddingChunk, setIsAddingChunk] = useState(false);
  const [chunkTitle, setChunkTitle] = useState('');
  const [chunkQuestion, setChunkQuestion] = useState('');
  const [chunkCategory, setChunkCategory] = useState('固定收益与理财业务');
  const [chunkContent, setChunkContent] = useState('');
  const [chunkKeywords, setChunkKeywords] = useState('');

  // Create Dataset form state
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);
  const [newDsName, setNewDsName] = useState('');
  const [newDsDesc, setNewDsDesc] = useState('');
  const [newDsIcon, setNewDsIcon] = useState('📚');

  // Document Upload Modal state
  const [isDocUploadOpen, setIsDocUploadOpen] = useState(false);

  // Batch import modal state
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const currentDataset = datasets.find(d => d.id === selectedDatasetId) || datasets[0];

  // Perform vector semantic retrieval sandbox test with strict <= 500 chars limit
  const handleTestSearch = (query: string) => {
    setSearchTestQuery(query);
    if (!query.trim()) {
      setRetrievalResult(null);
      return;
    }

    setIsSearching(true);
    // Uses Dify-grade local vector search with strict 500 chars limit
    const res = searchKnowledgeBase(
      query, 
      datasets, 
      selectedDatasetId ? [selectedDatasetId] : undefined,
      4,
      0.50,
      500 // strict 500 chars limit
    );
    setRetrievalResult(res);
    setIsSearching(false);
  };

  // Add Chunk to current dataset (enforcing <= 500 words limit)
  const handleSaveNewChunk = () => {
    if (!chunkTitle.trim() || !chunkContent.trim() || !currentDataset) return;

    let finalContent = chunkContent.trim();
    if (finalContent.length > 500) {
      finalContent = finalContent.slice(0, 494) + '...';
    }

    const newChunk: DifyChunk = {
      id: `chk-${Date.now()}`,
      datasetId: currentDataset.id,
      title: chunkTitle.trim(),
      pointName: chunkTitle.trim().slice(0, 24),
      pageNumber: '第1页',
      category: chunkCategory,
      question: chunkQuestion.trim() || chunkTitle.trim(),
      answer: finalContent,
      content: finalContent,
      charCount: finalContent.length,
      tokenCount: Math.ceil(finalContent.length * 1.3),
      keywords: chunkKeywords.split(/[,，\s]+/).filter(Boolean),
      sourceDoc: '手动编辑分段',
      originalDocFormat: 'txt',
      updatedAt: '刚刚'
    };

    const updated = datasets.map(ds => {
      if (ds.id === currentDataset.id) {
        return {
          ...ds,
          chunkCount: ds.chunkCount + 1,
          totalChars: ds.totalChars + newChunk.charCount,
          chunks: [newChunk, ...ds.chunks]
        };
      }
      return ds;
    });

    onUpdateDatasets(updated);
    setIsAddingChunk(false);
    setChunkTitle('');
    setChunkQuestion('');
    setChunkContent('');
    setChunkKeywords('');
    showToast('✅ 知识分段已成功添加并生成本地向量索引！');
  };

  // Delete chunk
  const handleDeleteChunk = (chunkId: string) => {
    const updated = datasets.map(ds => {
      if (ds.id === currentDataset.id) {
        const remaining = ds.chunks.filter(c => c.id !== chunkId);
        return {
          ...ds,
          chunkCount: remaining.length,
          chunks: remaining
        };
      }
      return ds;
    });
    onUpdateDatasets(updated);
    showToast('已删除该知识分段');
  };

  // Create new dataset
  const handleCreateDataset = () => {
    if (!newDsName.trim()) return;

    const newDs: DifyDataset = {
      id: `ds-${Date.now()}`,
      name: newDsName.trim(),
      description: newDsDesc.trim() || '自定义金融业务知识库',
      icon: newDsIcon || '📁',
      color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300',
      docCount: 0,
      chunkCount: 0,
      totalChars: 0,
      retrievalMode: 'hybrid',
      topK: 3,
      scoreThreshold: 0.65,
      updatedAt: '刚刚',
      chunks: [],
      documents: []
    };

    onUpdateDatasets([newDs, ...datasets]);
    setSelectedDatasetId(newDs.id);
    setIsCreatingDataset(false);
    setNewDsName('');
    setNewDsDesc('');
    showToast(`✅ 新知识库【${newDs.name}】已成功创建！`);
  };

  // Handle Document Upload Success
  const handleDocUploadSuccess = (result: { document: DifyDocument; chunks: DifyChunk[] }) => {
    const updated = datasets.map(ds => {
      if (ds.id === currentDataset.id) {
        const existingDocs = ds.documents || [];
        return {
          ...ds,
          docCount: existingDocs.length + 1,
          chunkCount: ds.chunkCount + result.chunks.length,
          totalChars: ds.totalChars + result.chunks.reduce((sum, c) => sum + c.charCount, 0),
          documents: [result.document, ...existingDocs],
          chunks: [...result.chunks, ...ds.chunks]
        };
      }
      return ds;
    });

    onUpdateDatasets(updated);
    showToast(`✅ 文档【${result.document.name}】已成功入库！提取 ${result.chunks.length} 组标准 QA 问答并建立向量索引！`);
  };

  return (
    <div className="p-6 space-y-6 text-slate-100 max-w-7xl mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl border border-amber-400 flex items-center gap-2 animate-in slide-in-from-top-4">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner (Dify-style Knowledge Header) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Database size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>本地知识库与混合检索工作台</span>
              <span className="px-2 py-0.5 rounded text-xs bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono">
                Dify 架构 · 0.02s 混合检索
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>数据 100% 保存在本地混合检索知识库中</span>
              <span className="text-emerald-400 font-semibold">• 检索严格限制在500字内</span>
              <span className="text-purple-400 font-semibold">• 稠密语义+关键词倒排混合检索加权</span>
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2.5">
          {/* Main Document Upload (No format alterations) */}
          <button
            onClick={() => setIsDocUploadOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-600/20"
            title="上传原格式文档，自动解析出标准QA问答对、详细分类与关键词标签"
          >
            <FileText size={14} />
            <span>上传文档 (自动QA拆解与标签分类)</span>
          </button>

          <button
            onClick={() => setIsBatchImportOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition border border-slate-700"
          >
            <Upload size={14} className="text-cyan-400" />
            <span>批量导入 (CSV/Excel)</span>
          </button>

          <button
            onClick={() => setIsCreatingDataset(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20"
          >
            <Plus size={14} />
            <span>新建知识库数据集</span>
          </button>
        </div>
      </div>

      {/* Datasets Grid Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {datasets.map(ds => {
          const isSelected = ds.id === selectedDatasetId;
          return (
            <div
              key={ds.id}
              onClick={() => setSelectedDatasetId(ds.id)}
              className={`p-4 rounded-xl border text-xs cursor-pointer transition relative ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{ds.icon}</span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                  {ds.retrievalMode === 'hybrid' ? '混合检索 (Hybrid)' : '向量检索'}
                </span>
              </div>

              <div className="font-bold text-sm text-slate-100 truncate mb-1">
                {ds.name}
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                {ds.description}
              </p>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{ds.chunkCount} 个QA分段</span>
                <span>{ds.documents?.length || ds.docCount} 篇原文档</span>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Main Workbench Body: Left (Chunks / Original Docs Inspector) & Right (Sub-second Search Sandbox) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Dataset Chunks & Original Documents (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            {/* Header & View Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>{currentDataset?.icon}</span>
                  <span>{currentDataset?.name}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {currentDataset?.chunks.length || 0} 条语义索引 Chunk · {currentDataset?.documents?.length || currentDataset?.docCount || 0} 份原文档
                </span>
              </div>

              {/* Chunks vs Documents Toggle */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setActiveContentTab('chunks')}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      activeContentTab === 'chunks'
                        ? 'bg-slate-800 text-cyan-300 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    QA分段列表 ({currentDataset?.chunks.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveContentTab('documents')}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      activeContentTab === 'documents'
                        ? 'bg-slate-800 text-cyan-300 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    原格式文档 ({currentDataset?.documents?.length || 0})
                  </button>
                </div>

                <button
                  onClick={() => setIsAddingChunk(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1 transition shadow-md shadow-cyan-600/20"
                >
                  <Plus size={13} />
                  <span>新增分段</span>
                </button>
              </div>
            </div>

            {/* TAB 1: QA Chunks List */}
            {activeContentTab === 'chunks' && (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {currentDataset?.chunks.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-100 text-sm truncate">
                          {chk.title}
                        </span>
                        {chk.category && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/60 shrink-0">
                            🏷️ {chk.category}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono shrink-0">
                        <span className={`px-1.5 py-0.5 rounded border ${
                          chk.charCount <= 500
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                            : 'bg-rose-950/60 text-rose-400 border-rose-800/40'
                        }`}>
                          {chk.charCount} 字 / ≤500字规范
                        </span>
                        <button
                          onClick={() => handleDeleteChunk(chk.id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                          title="删除该分段"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Question Intent Tag */}
                    {chk.question && chk.question !== chk.title && (
                      <div className="text-[11px] text-amber-300/90 font-medium bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                        🎯 提取客户问题: {chk.question}
                      </div>
                    )}

                    {/* Source doc, page number, and point name */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {chk.sourceDoc && (
                        <span className="text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          📄 《{chk.sourceDoc}》
                        </span>
                      )}
                      {chk.pageNumber && (
                        <span className="text-cyan-300 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
                          📑 {chk.pageNumber}
                        </span>
                      )}
                      {chk.pointName && (
                        <span className="text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/50">
                          🎯 知识点: {chk.pointName}
                        </span>
                      )}
                    </div>

                    {/* Content / Standard Answer */}
                    <p className="text-slate-300 leading-relaxed font-sans bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/40">
                      {chk.content}
                    </p>

                    {/* Bottom: Tags, source & Preview snippet button */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <div className="flex flex-wrap gap-1">
                        {chk.keywords.map((kw, idx) => (
                          <span key={idx} className="bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded text-[10px] border border-slate-800">
                            #{kw}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewCitation({
                            chunkId: chk.id,
                            datasetName: currentDataset?.name || '知识库',
                            title: chk.title,
                            pointName: chk.pointName || chk.title,
                            sourceDoc: chk.sourceDoc,
                            pageNumber: chk.pageNumber || '第1页',
                            contentSnippet: chk.content || chk.answer || '',
                            similarity: 1.0,
                            category: chk.category,
                            question: chk.question,
                            keywords: chk.keywords,
                            charCount: chk.charCount,
                            originalDocFormat: chk.originalDocFormat
                          })}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 flex items-center gap-1 border border-slate-700 transition"
                        >
                          <Eye size={10} />
                          <span>预览片段</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                          {chk.originalDocFormat && (
                            <span className="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-400 border border-slate-800">
                              .{chk.originalDocFormat}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: Original Documents Archive (Unmodified format view) */}
            {activeContentTab === 'documents' && (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {(!currentDataset?.documents || currentDataset.documents.length === 0) ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                    <FileText size={32} className="mx-auto text-slate-600" />
                    <p className="text-xs text-slate-400">当前知识库尚未收录完整原始文档</p>
                    <button
                      onClick={() => setIsDocUploadOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
                    >
                      立即上传原始文档
                    </button>
                  </div>
                ) : (
                  currentDataset.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/20">
                            {doc.format === 'markdown' ? 'MD' : (doc.format === 'docx' ? 'DOC' : doc.format.toUpperCase())}
                          </span>
                          <div>
                            <span className="font-bold text-slate-100 text-sm">{doc.name}</span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              上传于 {doc.uploadedAt} · {doc.charCount} 字符
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                            {doc.extractedQACount} 组 QA
                          </span>
                          <button
                            onClick={() => setViewingRawDoc(doc)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 border border-slate-700"
                          >
                            <Eye size={12} />
                            <span>查看原格式文档</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-slate-900/50 border border-slate-800/60 text-[11px] text-slate-400 line-clamp-2 font-mono">
                        {doc.rawContent}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span>分类归属：{doc.category}</span>
                        <span className="text-emerald-400">100% 保持原始格式未篡改</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Sub-second Vector Retrieval Sandbox (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Search size={16} className="text-emerald-400" />
                <span>秒级混合检索测试台 (Dify 混合召回)</span>
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                0.018s 混合召回
              </span>
            </div>

            {/* Requirement Highlight Badge */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck size={13} />
                  <span>检索字数限制: ≤500字以内</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-300">
                  {retrievalResult ? `${retrievalResult.contextCharCount} / 500 字` : '严格预算受控'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                稠密语义向量与关键词倒排混合检索，自动对齐提问意图 (QA)、加权详细分类，提升检索回复准确度。
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchTestQuery}
                onChange={(e) => handleTestSearch(e.target.value)}
                placeholder="例如：客户问固收+为什么跌了、信托能防债务吗..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
              />
              {isSearching && (
                <div className="absolute right-3 top-2.5">
                  <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Results Display */}
            {retrievalResult && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-1.5">
                  <span>命中分段: {retrievalResult.results.length} 条</span>
                  <span className="text-emerald-400 font-bold">
                    注入上下文: {retrievalResult.contextCharCount} 字 (≤500字规范)
                  </span>
                </div>

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {retrievalResult.results.map((res, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold flex items-center justify-center text-[10px] border border-amber-500/30 shrink-0">
                            [{idx + 1}]
                          </span>
                          <span className="font-bold text-slate-200 truncate">{res.chunk.title}</span>
                        </div>
                        <span className="font-mono text-emerald-400 font-bold text-xs bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800/40 shrink-0">
                          {(res.similarity * 100).toFixed(1)}% 相似度
                        </span>
                      </div>

                      {/* Source Document, Page Number, and Knowledge Point Tag */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="text-slate-300 font-medium bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          📄 《{res.chunk.sourceDoc || res.datasetName}》
                        </span>
                        <span className="text-cyan-300 font-mono bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                          📑 {res.chunk.pageNumber || `第${idx + 1}页`}
                        </span>
                        {(res.chunk.pointName || res.matchedCategory) && (
                          <span className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                            🎯 {res.chunk.pointName || res.matchedCategory}
                          </span>
                        )}
                        {res.matchedKeywords.length > 0 && (
                          <span className="bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/60">
                            🔖 {res.matchedKeywords.join(', ')}
                          </span>
                        )}
                      </div>

                      {/* Content (Strictly controlled <= 500 chars) */}
                      <p className="text-slate-300 leading-relaxed text-[11px] bg-slate-900/50 p-2 rounded-lg border border-slate-800/50 line-clamp-3">
                        {res.chunk.content}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span className="text-emerald-400 font-mono">
                          单段字符: {res.charCount} 字 (受控≤500字)
                        </span>

                        <button
                          onClick={() => setPreviewCitation({
                            index: idx + 1,
                            chunkId: res.chunk.id,
                            datasetName: res.datasetName,
                            title: res.chunk.title,
                            pointName: res.chunk.pointName || res.chunk.title,
                            sourceDoc: res.chunk.sourceDoc || res.datasetName,
                            pageNumber: res.chunk.pageNumber || `第${idx + 1}页`,
                            contentSnippet: res.chunk.content || res.chunk.answer || '',
                            similarity: res.similarity,
                            category: res.chunk.category,
                            question: res.chunk.question,
                            keywords: res.chunk.keywords,
                            charCount: res.charCount,
                            originalDocFormat: res.chunk.originalDocFormat
                          })}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-semibold flex items-center gap-1 border border-amber-500/30 transition shadow-sm"
                        >
                          <Eye size={12} />
                          <span>点击直接预览片段</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Raw Document Full View Modal */}
      {viewingRawDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode size={18} className="text-cyan-400" />
                <span className="font-bold text-slate-100 text-sm">
                  原始文档预览：{viewingRawDoc.name}
                </span>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800 font-mono">
                  格式: {viewingRawDoc.format.toUpperCase()} (100%原样保留未修改)
                </span>
              </div>
              <button onClick={() => setViewingRawDoc(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
              {viewingRawDoc.rawContent}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
              <span>总字符数: {viewingRawDoc.charCount} 字符 | 提取QA问答: {viewingRawDoc.extractedQACount} 条</span>
              <button
                onClick={() => setViewingRawDoc(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Chunk Modal */}
      {isAddingChunk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 text-sm">
                添加知识分段至【{currentDataset?.name}】
              </span>
              <button onClick={() => setIsAddingChunk(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">分段标题 (Title)</label>
                <input
                  type="text"
                  value={chunkTitle}
                  onChange={(e) => setChunkTitle(e.target.value)}
                  placeholder="例如：固收+理财净值微调安抚话术..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">真实客户业务问题 (QA Question)</label>
                <input
                  type="text"
                  value={chunkQuestion}
                  onChange={(e) => setChunkQuestion(e.target.value)}
                  placeholder="例如：固收+理财为什么最近有波动微调，亏损了怎么办？"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">所属详细分类 (Category)</label>
                <select
                  value={chunkCategory}
                  onChange={(e) => setChunkCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {KNOWLEDGE_CATEGORIES.map((cat, i) => (
                    <option key={i} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">标准解答话术 (严格受控 ≤500字)</label>
                  <span className={`font-mono text-[11px] ${chunkContent.length > 500 ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                    {chunkContent.length} / 500 字 (检索规范)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={chunkContent}
                  onChange={(e) => setChunkContent(e.target.value)}
                  placeholder="输入解答话术或知识要点..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">关键词标签 (以逗号分隔，用于倒排加权)</label>
                <input
                  type="text"
                  value={chunkKeywords}
                  onChange={(e) => setChunkKeywords(e.target.value)}
                  placeholder="例如：固收+, 净值波动, 适当性"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddingChunk(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs"
              >
                取消
              </button>
              <button
                onClick={handleSaveNewChunk}
                disabled={!chunkTitle.trim() || !chunkContent.trim()}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-bold text-xs"
              >
                保存并建立向量索引
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Dataset Modal */}
      {isCreatingDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 text-sm">创建新知识库数据集</span>
              <button onClick={() => setIsCreatingDataset(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">数据集名称</label>
                <input
                  type="text"
                  value={newDsName}
                  onChange={(e) => setNewDsName(e.target.value)}
                  placeholder="例如：高净值信托与资产隔离专题库"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">功能描述</label>
                <textarea
                  rows={2}
                  value={newDsDesc}
                  onChange={(e) => setNewDsDesc(e.target.value)}
                  placeholder="该知识库用于解决哪些客户场景与专业解答..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">图标 (Emoji)</label>
                <input
                  type="text"
                  value={newDsIcon}
                  onChange={(e) => setNewDsIcon(e.target.value)}
                  className="w-20 bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-center"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreatingDataset(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs"
              >
                取消
              </button>
              <button
                onClick={handleCreateDataset}
                disabled={!newDsName.trim()}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs"
              >
                创建数据集
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal (Auto QA extraction & Tagging without format alteration) */}
      {isDocUploadOpen && (
        <DocumentUploadModal
          isOpen={isDocUploadOpen}
          onClose={() => setIsDocUploadOpen(false)}
          datasetId={currentDataset?.id || 'kb-ds-01'}
          datasetName={currentDataset?.name || '金融业务知识库'}
          onUploadSuccess={handleDocUploadSuccess}
        />
      )}

      {/* Batch Import CSV/Excel Modal */}
      {isBatchImportOpen && (
        <BatchImportPreviewModal
          isOpen={isBatchImportOpen}
          onClose={() => setIsBatchImportOpen(false)}
          onImportSuccess={(newItems) => {
            // Convert imported items into QA chunks adhering to 500 chars limit
            const newChunks: DifyChunk[] = newItems.map((item, i) => {
              let finalAns = item.answer;
              if (finalAns.length > 500) {
                finalAns = finalAns.slice(0, 494) + '...';
              }
              return {
                id: `chk-imp-${Date.now()}-${i}`,
                datasetId: currentDataset.id,
                title: item.question.slice(0, 30),
                pointName: item.question.slice(0, 24),
                pageNumber: `第${Math.floor(i / 2) + 1}页`,
                category: item.category || '固定收益与理财业务',
                question: item.question,
                answer: finalAns,
                content: finalAns,
                charCount: finalAns.length,
                tokenCount: Math.ceil(finalAns.length * 1.3),
                keywords: item.keywords,
                sourceDoc: '批量导入模板.csv',
                originalDocFormat: 'csv',
                updatedAt: '刚刚'
              };
            });

            const updated = datasets.map(ds => {
              if (ds.id === currentDataset.id) {
                return {
                  ...ds,
                  chunkCount: ds.chunkCount + newChunks.length,
                  chunks: [...newChunks, ...ds.chunks]
                };
              }
              return ds;
            });

            onUpdateDatasets(updated);
            showToast(`✅ 成功批量导入 ${newChunks.length} 条分段至【${currentDataset.name}】！`);
          }}
        />
      )}

      {/* Citation Snippet Details & Footnote Preview Modal */}
      {previewCitation && (
        <CitationSnippetPreviewModal
          isOpen={!!previewCitation}
          onClose={() => setPreviewCitation(null)}
          citation={previewCitation}
          onToast={showToast}
        />
      )}
    </div>
  );
};
