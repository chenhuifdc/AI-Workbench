import React, { useState } from 'react';
import { 
  Download, Copy, Check, Terminal, FileCode, CheckCircle2, 
  ExternalLink, HardDrive, ShieldCheck, Play, ArrowRight,
  Layers, Package, Monitor
} from 'lucide-react';
import { DEPLOYMENT_FILES, DeploymentFile } from '../data/deploymentFiles';

export const DeploymentStudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<DeploymentFile>(DEPLOYMENT_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [pipCopied, setPipCopied] = useState(false);

  const PIP_INSTALL_CMD = "pip install fastapi uvicorn chromadb pydantic requests PySide6 pyinstaller pandas openpyxl python-docx pypdf";

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPip = () => {
    navigator.clipboard.writeText(PIP_INSTALL_CMD);
    setPipCopied(true);
    setTimeout(() => setPipCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const STEPS = [
    {
      num: 1,
      title: '装好底层环境',
      desc: '在你的 32G 纯CPU 服务器上安装 Python 3.10/3.11 与 Ollama，并在终端执行 pip install 安装所需库。',
      action: 'pip install'
    },
    {
      num: 2,
      title: '下载本地大模型',
      desc: '终端执行 `ollama pull bge-small-zh-v1.5` (向量模型) 与 `ollama pull qwen2.5:7b` (核心文本)，内存仅占 4.7GB。',
      action: 'ollama pull'
    },
    {
      num: 3,
      title: '清洗话术入库',
      desc: '运行 `clean_data.py` 将历史杂乱文档提炼为 300 字内的标准 QA 表格，建立 ChromaDB 毫秒级向量索引。',
      action: 'python clean_data.py'
    },
    {
      num: 4,
      title: '启动服务与自启守护',
      desc: '运行 `server.py`，并使用 NSSM 工具注册为 Windows 系统服务，实现开机静默自启与崩溃 3 秒拉起。',
      action: 'nssm_install.bat'
    },
    {
      num: 5,
      title: '分发客户端给30位业务员',
      desc: '运行 `build_client.bat` 用 PyInstaller 打包生成 `金融AI业务侧边栏.exe` (约30MB)，发给员工双击即用！',
      action: '分发 .exe'
    }
  ];

  return (
    <div className="p-6 space-y-6 text-slate-100 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>一键部署与客户端打包发布中心</span>
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-mono">
                纯CPU 32G生产级落地
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              包含完整中央服务器代码、PySide6 侧边栏桌面客户端、ChromaDB 清洗脚本与 NSSM 静默守护配置
            </p>
          </div>
        </div>

        {/* Client Footprint Badge */}
        <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-0.5">
            <Monitor size={14} />
            <span>业务员电脑（30 位员工端）：零环境要求</span>
          </div>
          <span className="text-slate-400 text-[11px]">
            无需安装 Python/Ollama，单文件可执行文件仅占内存 30MB，双击直接挂靠右侧
          </span>
        </div>
      </div>

      {/* 5-Step Execution Workflow Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {STEPS.map((s) => (
          <div
            key={s.num}
            className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2 relative"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                {s.num}
              </span>
              <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">
                {s.action}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-100">{s.title}</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Python pip dependencies shortcut */}
      <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">中央服务器 Python 核心依赖：</span>
          <code className="bg-slate-950 px-2.5 py-1 rounded text-amber-300 font-mono border border-slate-800 select-all">
            {PIP_INSTALL_CMD}
          </code>
        </div>
        <button
          onClick={handleCopyPip}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition border border-slate-700 shrink-0"
        >
          {pipCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span>{pipCopied ? '已复制命令' : '复制终端安装命令'}</span>
        </button>
      </div>

      {/* Source Code Studio Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* File Tabs */}
        <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {DEPLOYMENT_FILES.map((file) => (
              <button
                key={file.filename}
                onClick={() => setSelectedFile(file)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                  selectedFile.filename === file.filename
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FileCode size={13} />
                <span>{file.filename}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition border border-slate-700"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? '已复制源码' : '复制完整代码'}</span>
            </button>

            <button
              onClick={handleDownloadFile}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
            >
              <Download size={14} />
              <span>下载 {selectedFile.filename}</span>
            </button>
          </div>
        </div>

        {/* Current File Metadata */}
        <div className="px-5 py-3 bg-slate-900/60 border-b border-slate-800/80 text-xs text-slate-300 flex items-center justify-between">
          <div>
            <span className="font-semibold text-amber-300 mr-2">{selectedFile.title}</span>
            <span className="text-slate-400">{selectedFile.description}</span>
          </div>
          <span className="font-mono text-slate-500 text-[11px] uppercase">{selectedFile.language}</span>
        </div>

        {/* Code Content Display */}
        <div className="p-4 bg-slate-950 overflow-x-auto max-h-[520px] overflow-y-auto">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
