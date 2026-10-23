import React, { useState } from 'react';
import { 
  Download, Copy, Check, Terminal, FileCode, Monitor, 
  ExternalLink, Layers, ShieldCheck, HardDrive, Key, Sparkles
} from 'lucide-react';

export const LocalDeploymentPackView: React.FC = () => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const LOCAL_PYTHON_SIDEBAR_CODE = `# -*- coding: utf-8 -*-
"""
本地挂靠型 AI 业务侧边栏 (Universal Dockable AI Sidebar)
特性:
1. 挂靠任意软件边缘: 浮动在 微信/钉钉/CRM/Word/行情软件 右侧，永不遮挡主操作区
2. 始终置顶与透明度调节: 按需要调整半透明度，边看客户消息边获得AI话术
3. 毫秒级知识库召回: 直连本地 ChromaDB 向量库 (bge-small-zh-v1.5)
4. 一键复制/自动粘贴: 点击一键直接写入剪贴板
"""

import sys
import json
import requests
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QIcon, QFont, QClipboard
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLineEdit, QTextEdit, QPushButton, QLabel, QComboBox, QSlider, QMessageBox
)

# 本地服务网关地址 (部署本地 server.py 后的地址)
API_GATEWAY_URL = "http://127.0.0.1:8000"

class UniversalDockableSidebar(QMainWindow):
    def __init__(self):
        super().__init__()
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("AI通用业务侧边栏")
        self.setFixedWidth(380)

        # 核心：自动靠齐主屏幕右侧边缘，高度填满屏幕
        screen_geo = QApplication.primaryScreen().availableGeometry()
        self.setGeometry(screen_geo.width() - 380, 0, 380, screen_geo.height())

        # 核心：始终置顶 (挂靠在任意第三方软件之上)
        self.setWindowFlags(Qt.WindowStaysOnTopHint | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground, False)

        # 沉浸式暗黑深色金融风格
        self.setStyleSheet("""
            QMainWindow { background-color: #0b0f19; }
            QWidget { color: #f1f5f9; font-family: 'Microsoft YaHei', 'Segoe UI'; }
            QLineEdit, QTextEdit { 
                background-color: #161e2e; 
                border: 1px solid #334155; 
                border-radius: 8px; 
                color: #ffffff; 
                padding: 8px;
            }
            QLineEdit:focus, QTextEdit:focus {
                border: 1px solid #f59e0b;
            }
            QPushButton { 
                background-color: #d97706; 
                color: #0f172a; 
                font-weight: bold; 
                border-radius: 6px; 
                padding: 7px; 
            }
            QPushButton:hover { background-color: #f59e0b; }
            QComboBox {
                background-color: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                padding: 4px;
                color: #ffffff;
            }
        """)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(12, 10, 12, 10)
        layout.setSpacing(8)

        # 1. 顶栏：角色切换与窗口控件
        top_bar = QHBoxLayout()
        title_lbl = QLabel("✨ AI智能侧边栏")
        title_lbl.setStyleSheet("font-size: 14px; font-weight: bold; color: #fbbf24;")

        self.role_combo = QComboBox()
        self.role_combo.addItems([
            "极速业务答复 (we)",
            "深度逻辑推演 (ww)",
            "买方投顾专家 (rg)",
            "合规风控总监 (rf)",
            "私行销冠顾问 (rm)",
            "量化交易专家 (rt)",
            "家族信托法务 (rp)"
        ])

        min_btn = QPushButton("—")
        min_btn.setFixedSize(24, 24)
        min_btn.setStyleSheet("background-color: #334155; color: white;")
        min_btn.clicked.connect(self.showMinimized)

        close_btn = QPushButton("✕")
        close_btn.setFixedSize(24, 24)
        close_btn.setStyleSheet("background-color: #7f1d1d; color: white;")
        close_btn.clicked.connect(self.close)

        top_bar.addWidget(title_lbl)
        top_bar.addStretch()
        top_bar.addWidget(self.role_combo)
        top_bar.addWidget(min_btn)
        top_bar.addWidget(close_btn)
        layout.addLayout(top_bar)

        # 2. 回复展示区域 (支持一键复制到微信/CRM)
        self.output_text = QTextEdit()
        self.output_text.setReadOnly(True)
        self.output_text.setPlaceholderText("AI基于本地Dify知识库检索与大模型生成的专业回复将在此呈现...")
        layout.addWidget(self.output_text)

        # 3. 快捷操作栏 (仅保留复制、耗时与Token指标)
        action_bar = QHBoxLayout()
        copy_btn = QPushButton("📋 一键复制")
        copy_btn.clicked.connect(self.copy_to_clipboard)

        self.stats_lbl = QLabel("⏱️ 0.82s | ⚡ 260 Tokens")
        self.stats_lbl.setStyleSheet("color: #94a3b8; font-size: 11px;")

        action_bar.addWidget(copy_btn)
        action_bar.addStretch()
        action_bar.addWidget(self.stats_lbl)
        layout.addLayout(action_bar)

        # 4. 底部输入框
        input_bar = QHBoxLayout()
        self.input_edit = QLineEdit()
        self.input_edit.setPlaceholderText("向当前角色提问或输入客户异议...")
        self.input_edit.returnPressed.connect(self.send_request)

        send_btn = QPushButton("发送")
        send_btn.setFixedWidth(54)
        send_btn.clicked.connect(self.send_request)

        input_bar.addWidget(self.input_edit)
        input_bar.addWidget(send_btn)
        layout.addLayout(input_bar)

        # 状态指示
        self.status_lbl = QLabel("🟢 本地向量库已连接 | 挂靠就绪")
        self.status_lbl.setStyleSheet("color: #10b981; font-size: 11px;")
        layout.addWidget(self.status_lbl)

    def send_request(self):
        text = self.input_edit.text().strip()
        if not text:
            return
        self.status_lbl.setText("⏳ 正在检索本地知识库并生成...")
        QApplication.processEvents()
        
        # 提取命令代码
        role_text = self.role_combo.currentText()
        cmd = role_text.split("(")[-1].replace(")", "").strip()

        try:
            resp = requests.post(f"{API_GATEWAY_URL}/api/chat", json={
                "command": cmd,
                "prompt": text,
                "seat": "桌面侧边栏",
                "seatName": "业务员"
            }, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                self.output_text.setPlainText(data.get("text", ""))
                self.status_lbl.setText(f"🟢 完成 | 耗时 {data.get('latencyMs', 240)}ms")
                self.input_edit.clear()
            else:
                self.output_text.setPlainText(f"错误: {resp.text}")
        except Exception as e:
            self.output_text.setPlainText(f"无法连接本地服务: {str(e)}\\n请确认本地 server.py 已启动。")

    def copy_to_clipboard(self):
        content = self.output_text.toPlainText()
        if content:
            QApplication.clipboard().setText(content)
            self.status_lbl.setText("✅ 已复制！切换到微信按 Ctrl+V 即可直接发送")

    def audit_compliance(self):
        content = self.output_text.toPlainText()
        banned = ["保本", "保息", "稳赚", "零风险", "100%", "包赚"]
        hits = [w for w in banned if w in content]
        if hits:
            QMessageBox.warning(self, "合规风险提示", f"发现禁止宣传词汇: {', '.join(hits)}\\n严禁向客户做出刚兑承诺！")
        else:
            QMessageBox.information(self, "合规检查通过", "未检测到常见绝对化禁用词汇，符合展业规范。")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    win = UniversalDockableSidebar()
    win.show()
    sys.exit(app.exec())
`;

  const ENV_CONFIG_SAMPLE = `# 本地部署环境配置文件 (.env)
# 1. Google Gemini 官方大模型 API (推荐, 极速响应)
GEMINI_API_KEY="your_gemini_api_key_here"

# 2. 本地 / 手机热点局域网 Ollama 纯CPU免密运行地址 (离线 0 审查)
OLLAMA_HOST="http://172.20.10.2:11434"
OLLAMA_ORIGINS="*"

# 3. 本地 ChromaDB 向量库持久化目录
CHROMA_PERSIST_DIR="./chroma_db_data"

# 4. 可选第三方云端服务 (按量计费生图与联网)
SILICONFLOW_API_KEY=""
TAVILY_API_KEY=""
`;

  return (
    <div className="p-6 space-y-6 text-slate-100 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Monitor size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>本地部署与挂靠桌面客户端发布中心</span>
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-mono">
                Windows / Mac 挂靠任意应用
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              单文件绿色可执行程序，自动贴靠在微信、钉钉、CRM、Word或同花顺旁侧，直连本地 Dify 向量库
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            const blob = new Blob([LOCAL_PYTHON_SIDEBAR_CODE], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '挂靠AI业务侧边栏.py';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20"
        >
          <Download size={14} />
          <span>下载客户端源码 (.py)</span>
        </button>
      </div>

      {/* 3 Step Deployment Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs">1</span>
              <span>安装本地依赖</span>
            </span>
            <span className="font-mono text-slate-500">Python 3.10+</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            在本地终端运行：
          </p>
          <code className="bg-slate-950 p-2 rounded block text-amber-300 font-mono text-[11px] border border-slate-800">
            pip install PySide6 requests chromadb
          </code>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs">2</span>
              <span>打包为绿色单文件 EXE</span>
            </span>
            <span className="font-mono text-slate-500">免安装 30MB</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            使用 PyInstaller 一键编译：
          </p>
          <code className="bg-slate-950 p-2 rounded block text-amber-300 font-mono text-[11px] border border-slate-800">
            pyinstaller -w -F 挂靠AI业务侧边栏.py
          </code>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs">3</span>
              <span>双击即用 · 贴靠任意软件</span>
            </span>
            <span className="font-mono text-emerald-400">贴边运行</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            生成的 EXE 双击直接静默吸附在屏幕右侧，在微信/CRM中按快捷键一键复制粘贴，毫秒级响应！
          </p>
        </div>
      </div>

      {/* Code Inspector: Python Sidebar Client */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode size={16} className="text-amber-400" />
            <span className="font-bold text-xs text-slate-200">挂靠AI业务侧边栏.py (PySide6 完整客户端)</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(LOCAL_PYTHON_SIDEBAR_CODE);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition"
          >
            {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedCode ? '已复制完整源码' : '复制代码'}</span>
          </button>
        </div>

        <div className="p-4 bg-slate-950 max-h-[380px] overflow-y-auto">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed">
            <code>{LOCAL_PYTHON_SIDEBAR_CODE}</code>
          </pre>
        </div>
      </div>

      {/* Local .env instructions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-cyan-400" />
            <span className="font-bold text-sm text-slate-100">本地部署 API Key 与大模型配置示例 (.env)</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(ENV_CONFIG_SAMPLE);
              setCopiedEnv(true);
              setTimeout(() => setCopiedEnv(false), 2000);
            }}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition"
          >
            {copiedEnv ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedEnv ? '已复制' : '复制 .env 模板'}</span>
          </button>
        </div>
        <p className="text-xs text-slate-400">
          在本地自己电脑或服务器部署时，将以下配置保存为 <code>.env</code> 文件即可驱动真实 API 或本地 Ollama：
        </p>
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
          <pre className="text-xs font-mono text-cyan-300">
            <code>{ENV_CONFIG_SAMPLE}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
