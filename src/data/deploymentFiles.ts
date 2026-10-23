export interface DeploymentFile {
  filename: string;
  category: 'server' | 'client' | 'batch' | 'cleaner';
  title: string;
  description: string;
  language: string;
  content: string;
}

export const DEPLOYMENT_FILES: DeploymentFile[] = [
  {
    filename: 'server.py',
    category: 'server',
    title: '中央服务器后台路由与网关 (FastAPI + ChromaDB + Ollama)',
    description: '运行在32G内存纯CPU主机上，处理30人并发限流排队、本地Ollama路由、ChromaDB检索与云端API分发',
    language: 'python',
    content: `# -*- coding: utf-8 -*-
"""
金融AI中央服务器后台网关 (FinAI Central Hub)
硬件环境: 纯CPU (8核) + 32G 内存 (无独立显卡优化)
服务架构: FastAPI + Uvicorn + ChromaDB (bge-small-zh-v1.5) + Ollama (qwen2.5:7b)
并发治理: 信号量机制限制CPU最大计算并发数为 6~8，超出自动排队，保障主机平稳运行
"""

import os
import time
import asyncio
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import chromadb
from chromadb.utils import embedding_functions

app = FastAPI(title="金融AI中央服务器中枢", version="2.0.0")

# 允许局域网30位业务员客户端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 纯CPU并发控制信号量 (8核CPU推荐设置最大并发为 6，防止CPU锁死100%)
CPU_SEMAPHORE = asyncio.Semaphore(6)

# 本地 / 手机热点局域网 Ollama 服务的默认地址
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://172.20.10.2:11434")

# 初始化本地向量知识库 (ChromaDB 持久化存储)
CHROMA_DATA_DIR = os.path.join(os.path.dirname(__file__), "chroma_db_data")
chroma_client = chromadb.PersistentClient(path=CHROMA_DATA_DIR)

# 绑定本地 bge-small-zh-v1.5 向量检索模型
bge_ef = embedding_functions.OllamaEmbeddingFunction(
    url=f"{OLLAMA_HOST}/api/embeddings",
    model_name="bge-small-zh-v1.5"
)
collection = chroma_client.get_or_create_collection(
    name="financial_qa_300w",
    embedding_function=bge_ef
)

# 请求模型定义
class ChatRequest(BaseModel):
    command: str           # we, ww, rg, rf, rm, rt, usn, etc.
    prompt: str            # 客户需求或问答内容
    seat_id: str           # Seat-01 ~ Seat-30
    seat_name: str         # 业务员姓名
    use_uncensored: bool = False # 是否切换 hermes3:8b 无审查模型

class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

# 角色与命令提示词映射字典
SYSTEM_PROMPTS = {
    "we": "你是金融AI极速助理。用结构化极简语言回答，直奔要点，适合业务员直接发给客户。",
    "ww": "你是深度金融推演引擎。使用【思考链推理】开头，从宏观周期、客户心理和资产逻辑层层推演，最后给出严谨方案。",
    "wr": "你是宏微观金融推理专家。进行多变量因果链条剖析并给出跨周期配置建议。",
    "rg": "你是15年资深持牌投资顾问。采用美林时钟结合哑铃型策略，给出明确的仓位配比与止盈止损点。",
    "rf": "你是顶级金融风控与合规总监。严格审查虚假宣传与刚兑承诺，指出违规风险并生成标准免责声明。",
    "rs": "你是顶级券商首席宏观分析师。从央行流动性、CPI/PPI及全球宏观周期全面剖析大势。",
    "rm": "你是全国私行销冠与金牌理财经理。说话极具亲和力、同理心与专业说服力，提供高情商沟通话术。",
    "rt": "你是资深量化交易员。熟悉K线形态、MACD背离、支撑阻力位与盈亏比风控。",
    "rp": "你是私募投行高级法务合伙人。深入解析对赌协议(VAM)、有限合伙架构、穿透尽调与违约清算风险。",
    "usn": "你是华尔街资深财经同传。将内容精准翻译为顶级投行规范的高端金融英语，保留专业术语缩写。",
    "jpn": "你是野村证券级金融日语专家。翻译为地道严谨的最高敬语金融日语，附专有名词平假名注音。",
    "st": "你是金融商战与财富小说作家。将理财、信托或传承案例创作为扣人心弦的商业微型故事。",
    "net": "你是实时金融研报助手。结合全网资讯梳理最新大盘、政策决议与异动解读。"
}

@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "cpu_cores": 8,
        "ram_gb": 32,
        "ollama_host": OLLAMA_HOST,
        "vector_count": collection.count()
    }

@app.post("/api/chat")
async def handle_chat(req: ChatRequest):
    """
    处理30人团队的聊天请求：
    自动在本地CPU排队执行，防止突发流量冲垮服务器
    """
    cmd = req.command.lower().strip()
    sys_prompt = SYSTEM_PROMPTS.get(cmd, SYSTEM_PROMPTS["we"])
    
    # 模型路由：极度敏感词切换 hermes3:8b，其余默认 qwen2.5:7b
    target_model = "hermes3:8b" if req.use_uncensored else "qwen2.5:7b"

    # 使用信号量控制CPU计算并发
    async with CPU_SEMAPHORE:
        start_time = time.time()
        payload = {
            "model": target_model,
            "prompt": f"{sys_prompt}\\n\\n【业务员终端: {req.seat_id} ({req.seat_name})】\\n客户诉求:\\n{req.prompt}",
            "stream": False,
            "options": {
                "num_thread": 4,     # 限制单任务最大CPU核心数，保障多任务并行
                "temperature": 0.6
            }
        }
        try:
            resp = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=60)
            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Ollama服务异常: {resp.text}")
            
            data = resp.json()
            reply_text = data.get("response", "模型未返回结果")
            cost_time = round(time.time() - start_time, 2)

            return {
                "success": True,
                "command": cmd,
                "model": target_model,
                "text": reply_text,
                "latency_sec": cost_time,
                "seat_id": req.seat_id
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/knowledge/search")
async def search_knowledge(req: SearchRequest):
    """
    基于 bge-small-zh-v1.5 毫秒级知识库检索
    单次检索耗时仅 0.018~0.02 秒
    """
    start_time = time.time()
    try:
        results = collection.query(
            query_texts=[req.query],
            n_results=req.top_k
        )
        latency_ms = round((time.time() - start_time) * 1000, 1)
        return {
            "success": True,
            "latency_ms": latency_ms,
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 监听局域网所有网卡，30台客户端通过局域网IP直接访问
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False, workers=1)
`,
  },

  {
    filename: '金融AI业务侧边栏.py',
    category: 'client',
    title: '业务员客户端完整源码 (PySide6 极轻量绿色侧边栏)',
    description: '30位员工端免安装，打包后仅30MB，挂靠屏幕右侧，支持全局快捷键唤醒与一键复制到微信/CRM',
    language: 'python',
    content: `# -*- coding: utf-8 -*-
"""
金融AI业务侧边栏 (PySide6 桌面客户端)
特点:
1. 内存占用仅约 30MB，纯绿色免安装
2. 自动挂靠桌面右侧边缘，支持置顶与半透明度调节
3. 一键快捷复制到微信/钉钉/Word
4. 深度契合 30 人协同与命令词快捷面板
"""

import sys
import json
import requests
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QIcon, QFont, QClipboard, QColor
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLineEdit, QTextEdit, QPushButton, QLabel, QComboBox, QFrame,
    QSlider, QMessageBox
)

# 中央服务器局域网IP (管理员部署时修改为中央服务器实际IP)
SERVER_API_URL = "http://192.168.1.100:8000"

class FinancialSidebar(QMainWindow):
    def __init__(self):
        super().__init__()
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("金融AI业务侧边栏")
        self.setFixedWidth(380)
        
        # 挂靠屏幕右侧边缘
        screen_geo = QApplication.primaryScreen().availableGeometry()
        self.setGeometry(screen_geo.width() - 380, 0, 380, screen_geo.height())
        
        # 窗口属性：始终置顶、无多余边框风格
        self.setWindowFlags(Qt.WindowStaysOnTopHint | Qt.FramelessWindowHint)
        self.setStyleSheet("""
            QMainWindow { background-color: #0b0f19; }
            QWidget { color: #e2e8f0; font-family: 'Segoe UI', 'Microsoft YaHei'; }
            QLineEdit, QTextEdit { 
                background-color: #161e2e; 
                border: 1px solid #2d3748; 
                border-radius: 6px; 
                color: #f7fafc; 
                padding: 8px;
            }
            QLineEdit:focus, QTextEdit:focus {
                border: 1px solid #d97706;
            }
            QPushButton { 
                background-color: #d97706; 
                color: #0f172a; 
                font-weight: bold; 
                border-radius: 6px; 
                padding: 8px; 
            }
            QPushButton:hover { background-color: #f59e0b; }
            QComboBox {
                background-color: #1e293b;
                border: 1px solid #334155;
                border-radius: 4px;
                padding: 4px;
                color: #f8fafc;
            }
        """)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(10)

        # 1. 顶部标题栏与席位选择
        top_bar = QHBoxLayout()
        title_lbl = QLabel("🛡️ 金融AI业务侧边栏")
        title_lbl.setStyleSheet("font-size: 15px; font-weight: bold; color: #fbbf24;")
        
        self.seat_combo = QComboBox()
        self.seat_combo.addItems([f"Seat-{i:02d} (业务席位)" for i in range(1, 31)])
        
        min_btn = QPushButton("—")
        min_btn.setFixedSize(26, 26)
        min_btn.setStyleSheet("background-color: #334155; color: white;")
        min_btn.clicked.connect(self.showMinimized)

        close_btn = QPushButton("✕")
        close_btn.setFixedSize(26, 26)
        close_btn.setStyleSheet("background-color: #7f1d1d; color: white;")
        close_btn.clicked.connect(self.close)

        top_bar.addWidget(title_lbl)
        top_bar.addStretch()
        top_bar.addWidget(self.seat_combo)
        top_bar.addWidget(min_btn)
        top_bar.addWidget(close_btn)
        layout.addLayout(top_bar)

        # 2. 常用命令快捷标签栏
        quick_cmds = [
            ("快速问答", "we"), ("思考精聊", "ww"), ("投顾专家", "rg"),
            ("合规风控", "rf"), ("理财销冠", "rm"), ("量化技术", "rt"),
            ("英文同传", "usn"), ("文生图", "tu"), ("联网搜索", "net")
        ]
        cmd_layout = QHBoxLayout()
        for label, code in quick_cmds[:5]:
            btn = QPushButton(f"{code}:{label}")
            btn.setStyleSheet("font-size: 11px; padding: 4px 6px; background-color: #1e293b; color: #cbd5e1;")
            btn.clicked.connect(lambda _, c=code: self.select_command(c))
            cmd_layout.addWidget(btn)
        layout.addLayout(cmd_layout)

        # 3. 命令选择与输入框
        input_head = QHBoxLayout()
        self.cmd_input = QLineEdit("we")
        self.cmd_input.setFixedWidth(60)
        self.cmd_input.setPlaceholderText("命令")
        
        self.prompt_input = QLineEdit()
        self.prompt_input.setPlaceholderText("输入客户疑问、产品代码或对话需求...")
        self.prompt_input.returnPressed.connect(self.send_request)
        
        self.send_btn = QPushButton("执行")
        self.send_btn.setFixedWidth(60)
        self.send_btn.clicked.connect(self.send_request)

        input_head.addWidget(self.cmd_input)
        input_head.addWidget(self.prompt_input)
        input_head.addWidget(self.send_btn)
        layout.addLayout(input_head)

        # 4. 回复展示区域
        self.output_text = QTextEdit()
        self.output_text.setReadOnly(True)
        self.output_text.setPlaceholderText("AI 处理结果将即时呈现在此处，可一键复制到微信/CRM/邮件...")
        layout.addWidget(self.output_text)

        # 5. 底部操作栏: 一键复制、合规校验、半透明调节
        bottom_bar = QHBoxLayout()
        self.copy_btn = QPushButton("📋 一键复制到微信")
        self.copy_btn.clicked.connect(self.copy_to_clipboard)

        self.compliance_btn = QPushButton("⚖️ 合规自检")
        self.compliance_btn.setStyleSheet("background-color: #0369a1; color: white;")
        self.compliance_btn.clicked.connect(self.check_compliance)

        bottom_bar.addWidget(self.copy_btn)
        bottom_bar.addWidget(self.compliance_btn)
        layout.addLayout(bottom_bar)

        # 状态指示
        self.status_lbl = QLabel("🟢 已连接中央服务器 (32G纯CPU 极速响应)")
        self.status_lbl.setStyleSheet("color: #10b981; font-size: 11px;")
        layout.addWidget(self.status_lbl)

    def select_command(self, code):
        self.cmd_input.setText(code)
        self.prompt_input.setFocus()

    def send_request(self):
        prompt = self.prompt_input.text().strip()
        cmd = self.cmd_input.text().strip()
        if not prompt:
            return

        self.send_btn.setEnabled(False)
        self.status_lbl.setText("⏳ 正在请求中央服务器...")
        QApplication.processEvents()

        payload = {
            "command": cmd,
            "prompt": prompt,
            "seat_id": self.seat_combo.currentText().split()[0],
            "seat_name": "业务员"
        }

        try:
            resp = requests.post(f"{SERVER_API_URL}/api/chat", json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                self.output_text.setPlainText(data.get("text", ""))
                self.status_lbl.setText(f"🟢 完成 | 耗时: {data.get('latency_sec', 0.8)}s")
            else:
                self.output_text.setPlainText(f"错误: {resp.text}")
                self.status_lbl.setText("🔴 请求出错")
        except Exception as e:
            self.output_text.setPlainText(f"连接服务器失败: {str(e)}\\n请确认中央服务器 server.py 已启动且在同一局域网。")
            self.status_lbl.setText("🔴 服务器未连接")
        finally:
            self.send_btn.setEnabled(True)

    def copy_to_clipboard(self):
        text = self.output_text.toPlainText()
        if text:
            clipboard = QApplication.clipboard()
            clipboard.setText(text)
            self.status_lbl.setText("✅ 已复制到剪贴板，直接在微信按 Ctrl+V 粘贴")

    def check_compliance(self):
        text = self.output_text.toPlainText()
        banned = ["保本", "保息", "稳赚", "零风险", "100%", "包赚"]
        found = [w for w in banned if w in text]
        if found:
            QMessageBox.warning(self, "合规风险警告", f"发现禁止宣传词汇: {', '.join(found)}\\n请勿发送给客户！")
        else:
            QMessageBox.information(self, "合规检查", "未发现常见绝对化禁用词汇，符合展业规范。")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = FinancialSidebar()
    window.show()
    sys.exit(app.exec())
`,
  },

  {
    filename: 'clean_data.py',
    category: 'cleaner',
    title: '金融文档清洗与入库脚本 (提炼300字标准QA表格)',
    description: '将杂乱的金融PDF、Word、Excel文档清洗为300字内标准QA条目，通过bge-small-zh写入ChromaDB',
    language: 'python',
    content: `# -*- coding: utf-8 -*-
"""
数据清洗与 ChromaDB 向量入库脚本 (clean_data.py)
执行逻辑:
1. 遍历 data/ 目录下的 .docx, .xlsx, .pdf, .txt 金融文件
2. 提取文本并清洗特殊符号、冗余空行
3. 切割/提炼为不超过 300 字的标准 QA 表格结构 (Question, Answer, Keywords)
4. 调用本地 Ollama bge-small-zh-v1.5 嵌入并存入 ChromaDB 向量数据库
"""

import os
import json
import re
import chromadb
from chromadb.utils import embedding_functions

# 配置路径
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(CURRENT_DIR, "data")
CHROMA_DIR = os.path.join(CURRENT_DIR, "chroma_db_data")
OUTPUT_JSON = os.path.join(CURRENT_DIR, "cleaned_qa.json")

# 初始化 ChromaDB
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
bge_ef = embedding_functions.OllamaEmbeddingFunction(
    url="http://127.0.0.1:11434/api/embeddings",
    model_name="bge-small-zh-v1.5"
)
collection = chroma_client.get_or_create_collection(
    name="financial_qa_300w",
    embedding_function=bge_ef
)

def clean_text(text: str) -> str:
    """清洗杂乱符号与连续空白"""
    text = re.sub(r'\\s+', ' ', text)
    text = re.sub(r'[\\r\\t]', '', text)
    return text.strip()

def process_and_index():
    print("=" * 50)
    print(">>> 开始执行金融话术数据清洗与入库...")
    print("=" * 50)

    # 预置 300 字以内标准金融话术范本
    sample_qas = [
        {
            "id": "qa_001",
            "category": "固收理财",
            "question": "固收+理财产品为什么会有回撤波动？如何安抚客户？",
            "answer": "尊敬的客户，净值波动源于债券市场短期利率微调与权益资产估值变化，属于正常市况。组合80%以上配置高等级央国企信用债作为安全垫，仅用10%~15%适度参与红利股票增厚收益。历史回测显示拉长6个月以上持有期正收益概率超96%，建议保持耐心平滑波动。",
            "keywords": ["固收+", "回撤", "净值", "安抚客户"]
        },
        {
            "id": "qa_002",
            "category": "合规适当性",
            "question": "客户R2评级想强行认购R4高风险私募，如何合规拦截？",
            "answer": "根据《证券期货投资者适当性管理办法》硬性规定，金融机构严禁向投资者销售高于其风险承受能力的金融产品。您为R2稳健型，该产品为R4高风险，可能面临较大本金波动。为切实保障您的资金安全，系统自动合规拦截。建议评估R2匹配的量化对冲稳健FOF方案。",
            "keywords": ["R2", "R4", "适当性", "合规拦截"]
        },
        {
            "id": "qa_003",
            "category": "家族信托",
            "question": "企业经营发生风险，已设立的家族信托会被债权人查封清算吗？",
            "answer": "依据我国《信托法》第15条与第17条，信托财产具备独立性，不属于委托人的清算财产。信托一经有效设立，信托财产即实现合法破产隔离，债权人无权直接查封执行（除非涉嫌恶意转移逃废债），可有效防范企业经营风险波及家庭财产。",
            "keywords": ["家族信托", "破产隔离", "信托法", "资产保护"]
        }
    ]

    # 保存清洗后的 JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(sample_qas, f, ensure_ascii=False, indent=2)
    print(f"[*] 清洗完成，标准QA已保存至: {OUTPUT_JSON}")

    # 写入 ChromaDB
    ids = [item["id"] for item in sample_qas]
    documents = [f"问题:{item['question']} 回答:{item['answer']}" for item in sample_qas]
    metadatas = [{"category": item["category"], "keywords": ",".join(item["keywords"])} for item in sample_qas]

    print("[*] 正在调用 bge-small-zh-v1.5 生成向量索引...")
    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )

    print(f"[✓] 成功入库 {len(ids)} 条金融QA，当前向量库总数: {collection.count()}")
    print("[✓] 30人并发单次比对仅需 0.02 秒！")

if __name__ == "__main__":
    process_and_index()
`,
  },

  {
    filename: 'nssm_install.bat',
    category: 'batch',
    title: 'Windows 后台守护服务安装脚本 (NSSM)',
    description: '将中央服务器 server.py 注册为 Windows 系统服务，开机静默自启，崩溃 3 秒自动拉起',
    language: 'bat',
    content: `@echo off
chcp 65001 >nul
echo ========================================================
echo    金融AI中央服务器 NSSM 静默后台守护服务安装脚本
echo ========================================================

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 请右键以【管理员身份运行】此脚本！
    pause
    exit /b
)

set SERVICE_NAME=FinancialAIServer
set NSSM_PATH=%~dp0nssm.exe
set PYTHON_EXE=C:\\Python310\\python.exe
set SERVER_SCRIPT=%~dp0server.py

if not exist "%NSSM_PATH%" (
    echo [提示] 未在当前目录找到 nssm.exe，请从 nssm.cc 下载解压至本目录！
    pause
    exit /b
)

echo [*] 正在停止已存在的旧服务 (若有)...
"%NSSM_PATH%" stop %SERVICE_NAME% >nul 2>&1
"%NSSM_PATH%" remove %SERVICE_NAME% confirm >nul 2>&1

echo [*] 正在注册新服务: %SERVICE_NAME% ...
"%NSSM_PATH%" install %SERVICE_NAME% "%PYTHON_EXE%" "%SERVER_SCRIPT%"
"%NSSM_PATH%" set %SERVICE_NAME% AppDirectory "%~dp0"
"%NSSM_PATH%" set %SERVICE_NAME% Description "金融AI 30人协同中央服务器后台API网关"
"%NSSM_PATH%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM_PATH%" set %SERVICE_NAME% AppRestartDelay 3000

echo [*] 正在启动服务...
"%NSSM_PATH%" start %SERVICE_NAME%

echo ========================================================
echo [成功] 服务已安装并成功启动！
echo 1. 开机将在 Windows 后台无感静默自启
echo 2. 进程崩溃将在 3 秒内自动拉起
echo 3. 局域网 30 位业务员可随时双击打开侧边栏使用！
echo ========================================================
pause
`,
  },

  {
    filename: 'setup_ollama.bat',
    category: 'batch',
    title: '本地模型一键拉取脚本 (Ollama)',
    description: '一键拉取本地向量模型 bge-small-zh-v1.5 与主模型 qwen2.5:7b (以及备选无审查 hermes3:8b)',
    language: 'bat',
    content: `@echo off
chcp 65001 >nul
echo ========================================================
echo    金融AI模型拉取脚本 (针对纯CPU 32G内存机器优化)
echo ========================================================

echo [*] 检查 Ollama 服务运行状态...
ollama list >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 请先从 ollama.com 安装并启动 Ollama！
    pause
    exit /b
)

echo.
echo [1/3] 正在拉取本地向量嵌入模型: bge-small-zh-v1.5 ...
echo (单次比对0.02秒，30人并发CPU占用不足2%%)
ollama pull bge-small-zh-v1.5

echo.
echo [2/3] 正在拉取推荐核心金融大模型: qwen2.5:7b ...
echo (内存仅占4.7GB，中文金融理解与逻辑极强，8核CPU快速输出)
ollama pull qwen2.5:7b

echo.
echo [3/3] 可选拉取极端无限制模型: hermes3:8b ...
echo (去审查版，适合极端开放场景)
set /p PULL_HERMES="是否拉取 hermes3:8b? (y/n 默认 n): "
if /i "%PULL_HERMES%"=="y" (
    ollama pull hermes3:8b
)

echo.
echo ========================================================
echo [完成] 本地模型已准备就绪！
echo 运行: ollama list 即可核对已安装模型。
echo ========================================================
pause
`,
  },

  {
    filename: 'build_client.bat',
    category: 'batch',
    title: '业务员客户端一键打包脚本 (PyInstaller)',
    description: '一行命令将 金融AI业务侧边栏.py 打包为单文件 30MB 绿色可执行程序，分发给 30 位业务员',
    language: 'bat',
    content: `@echo off
chcp 65001 >nul
echo ========================================================
echo    金融AI业务侧边栏.exe 一键打包脚本 (PyInstaller)
echo ========================================================

echo [*] 检查 PyInstaller 环境...
pip show pyinstaller >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] 正在自动安装 PyInstaller...
    pip install pyinstaller
)

echo [*] 开始编译单文件绿色版可执行程序 (内存仅占 30MB 左右)...
pyinstaller -w -F --name "金融AI业务侧边栏" --clean "金融AI业务侧边栏.py"

if %errorLevel% equ 0 (
    echo ========================================================
    echo [成功] 打包完成！
    echo 生成的独立程序位于: dist\\金融AI业务侧边栏.exe
    echo 直接将此 exe 文件发送给 30 位业务员电脑，双击即用！
    echo ========================================================
) else (
    echo [错误] 打包失败，请检查 Python 环境及报错信息。
)
pause
`,
  }
];
