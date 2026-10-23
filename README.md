\# 本地挂靠型 AI 业务侧边栏 (Universal Dockable AI Sidebar)



这是一个基于 Python 和 PySide6 开发的桌面智能侧边栏客户端，旨在通过始终置顶、边缘挂靠的特性，无缝辅助业务人员进行微信/钉钉/CRM 话术回复。项目采用前后端分离架构，通过 API 请求本地 AI 网关。



\## 🛠️ 技术栈

\- \*\*前端客户端\*\*: Python 3.10+ / PySide6 (Qt for Python) / Requests

\- \*\*后端网关 (建议)\*\*: FastAPI / Uvicorn (运行于 http://127.0.0.1:8000)

\- \*\*向量数据库\*\*: ChromaDB (嵌入模型: bge-small-zh-v1.5)

\- \*\*大模型驱动\*\*: Dify API / Ollama / Local LLM



\## 📦 环境准备与安装



1\. \*\*克隆项目到本地\*\*:

&#x20;  ```bash

&#x20;  git clone <你的GitHub仓库链接>

&#x20;  cd my-ai-sidebar

&#x20;  ```



2\. \*\*创建并激活虚拟环境\*\*:

&#x20;  ```bash

&#x20;  python -m venv venv

&#x20;  # Windows 激活:

&#x20;  .\\venv\\Scripts\\activate

&#x20;  # Mac/Linux 激活:

&#x20;  source venv/bin/activate

&#x20;  ```



3\. \*\*安装依赖\*\*:

&#x20;  ```bash

&#x20;  pip install -r requirements.txt

&#x20;  ```

&#x20;  \*(注：requirements.txt 必须包含: PySide6, requests。若包含后端，还需添加 fastapi, uvicorn, chromadb 等)\*



\## 🚀 运行指引



项目需要\*\*同时启动后端与前端\*\*才能正常工作：



1\. \*\*第一步：启动本地 AI 后端服务\*\*

&#x20;  ```bash

&#x20;  python server.py

&#x20;  ```

&#x20;  \*确认终端输出 `Application startup complete.` 且服务运行在 `http://127.0.0.1:8000`。\*



2\. \*\*第二步：启动 PySide6 侧边栏前端\*\*

&#x20;  ```bash

&#x20;  python client.py

&#x20;  ```



\## 🤖 给审查 AI 的提示 (Prompt for Code Review AI)

如果你是正在帮我检查代码的 AI，请注意以下核心逻辑与潜在审查重点：

1\. \*\*窗口特性\*\*: `client.py` 实现了无边框 (`FramelessWindowHint`) 和始终置顶 (`WindowStaysOnTopHint`)，请检查在不同分辨率屏幕下的靠右对齐计算是否存在越界风险。

2\. \*\*异步阻塞风险\*\*: 目前 `send\_request` 函数中使用的是同步的 `requests.post`。虽然调用了 `QApplication.processEvents()` 刷新界面，但当本地大模型生成时间过长（如超过 5 秒）时，界面仍可能出现假死。请评估是否需要重构为 `QThread` 或 `QNetworkAccessManager` 异步请求。

3\. \*\*合规审计模块\*\*: `client.py` 内部包含一个 `audit\_compliance` 函数，但目前未在 `send\_request` 返回后被触发调用。请帮我审查如何优雅地在 AI 回复渲染前自动执行合规词拦截。



"# AI-Workbench" 
