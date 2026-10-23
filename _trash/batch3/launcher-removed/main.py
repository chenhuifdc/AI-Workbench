"""AI工作台 桌面程序：后台隐藏运行 node server.js，以独立应用窗口（WebView2）显示界面，
并在任务栏右下角常驻托盘图标。

- 双击 exe：启动服务并打开应用窗口；再次双击：唤出已打开的窗口
- 关闭窗口：缩到托盘，服务继续运行
- 托盘菜单：打开主窗口（左键单击同效）/ 重启服务 / 彻底退出
"""
import ctypes
import os
import socket
import subprocess
import sys
import threading
import time
import webbrowser

import pystray
import webview
from PIL import Image, ImageDraw, ImageFont

APP = "AI工作台"
PORT = 38080
URL = f"http://localhost:{PORT}/"
NO_WINDOW = 0x08000000  # CREATE_NO_WINDOW
MUTEX_NAME = "Local\\AIWorkbench_Tray_38080"
IPC_PORT = 38081  # 第二次双击时通知已运行的实例显示窗口


# ---------------- 基础工具 ----------------
def base_dir():
    # 打包后 exe 所在目录；开发时为上级目录
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


BASE = base_dir()
LOG_DIR = os.path.join(BASE, "logs")
# 应用窗口的本地存储（localStorage / Cookie）持久化目录，保证设置重启后不丢
STORAGE_DIR = os.path.join(os.environ.get("LOCALAPPDATA", BASE), "AI工作台", "WebView2")


def run_quiet(args):
    """执行命令且不弹出黑窗口，返回文本输出。"""
    try:
        out = subprocess.run(args, capture_output=True, creationflags=NO_WINDOW, timeout=15)
        return out.stdout.decode("mbcs", errors="ignore")
    except Exception:
        return ""


def port_open():
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def listening_pids():
    """找出占用 38080 端口（LISTENING）的进程 PID。"""
    pids = set()
    for line in run_quiet(["netstat", "-ano", "-p", "TCP"]).splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[1].endswith(f":{PORT}") and parts[3].upper() == "LISTENING":
            if parts[4].isdigit():
                pids.add(int(parts[4]))
    return pids


def is_node(pid):
    return "node.exe" in run_quiet(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"]).lower()


def kill_tree(pid):
    run_quiet(["taskkill", "/PID", str(pid), "/T", "/F"])


def pin_tray_icon():
    """Win11 默认把新托盘图标收进“^”折叠区；首次运行时自动固定到任务栏。
    用户若手动设置过（存在 IsPromoted 值）则尊重其选择，不覆盖。"""
    if not getattr(sys, "frozen", False):
        return
    import winreg
    me = os.path.normcase(os.path.abspath(sys.executable))
    root = r"Control Panel\NotifyIconSettings"
    for _ in range(10):  # 图标注册写入注册表可能有延迟
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, root) as k:
                i = 0
                while True:
                    try:
                        sub = winreg.EnumKey(k, i)
                    except OSError:
                        break
                    i += 1
                    with winreg.OpenKey(k, sub, 0, winreg.KEY_READ | winreg.KEY_SET_VALUE) as s:
                        try:
                            path = winreg.QueryValueEx(s, "ExecutablePath")[0]
                        except OSError:
                            continue
                        if os.path.normcase(os.path.abspath(path)) != me:
                            continue
                        try:
                            winreg.QueryValueEx(s, "IsPromoted")
                        except OSError:
                            winreg.SetValueEx(s, "IsPromoted", 0, winreg.REG_DWORD, 1)
                        return
        except OSError:
            return
        time.sleep(1)


# ---------------- 服务管理 ----------------
class Server:
    def __init__(self):
        self.proc = None
        self.stopping = False
        self.log = None

    def start(self):
        """启动服务；若端口上已有服务则直接接管。返回 (成功, 说明)。"""
        if port_open():
            return True, "检测到服务已在运行，已接管"
        if not os.path.exists(os.path.join(BASE, "server.js")):
            return False, "未找到 server.js，请把本程序放在 AI工作台 项目文件夹内。"
        os.makedirs(LOG_DIR, exist_ok=True)
        self.log = open(os.path.join(LOG_DIR, "server.log"), "a", encoding="utf-8", errors="ignore")
        self.log.write(f"\n===== {time.strftime('%Y-%m-%d %H:%M:%S')} 启动服务 =====\n")
        self.log.flush()
        env = dict(os.environ, NODE_ENV="production", PORT=str(PORT))
        try:
            self.proc = subprocess.Popen(
                ["node", "server.js"], cwd=BASE, env=env, creationflags=NO_WINDOW,
                stdin=subprocess.DEVNULL, stdout=self.log, stderr=subprocess.STDOUT,
            )
        except FileNotFoundError:
            return False, "未检测到 Node.js，请先安装 Node.js 后再运行。"
        for _ in range(120):  # 最多等 60 秒
            if port_open():
                return True, "服务已启动"
            if self.proc.poll() is not None:
                return False, f"服务启动失败，请检查 {PORT} 端口是否被占用，详见 logs\\server.log"
            time.sleep(0.5)
        return False, "服务启动超时（60 秒），详见 logs\\server.log"

    def stop(self):
        self.stopping = True
        if self.proc and self.proc.poll() is None:
            kill_tree(self.proc.pid)
        # 清理接管的 / 残留的 node 服务进程（只结束 node.exe，不误伤其他程序）
        for pid in listening_pids():
            if is_node(pid):
                kill_tree(pid)
        for _ in range(20):
            if not port_open():
                break
            time.sleep(0.25)
        self.proc = None
        if self.log:
            self.log.close()
            self.log = None
        self.stopping = False


# ---------------- 托盘图标 ----------------
COLORS = {"run": (34, 197, 94), "busy": (245, 158, 11), "down": (239, 68, 68)}
STATUS_TEXT = {"run": f"● 运行中 · 端口 {PORT}", "busy": "◌ 处理中…", "down": "○ 服务已停止"}


def make_image(state):
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((2, 2, size - 2, size - 2), radius=14, fill=(15, 23, 42),
                        outline=COLORS[state], width=4)
    try:
        font = ImageFont.truetype("arialbd.ttf", 30)
    except OSError:
        font = ImageFont.load_default()
    d.text((size / 2, size / 2 - 2), "AI", font=font, fill=(255, 255, 255), anchor="mm")
    d.ellipse((size - 22, size - 22, size - 6, size - 6), fill=COLORS[state],
              outline=(15, 23, 42), width=2)
    return img


LOADING_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{height:100%;margin:0;background:#020617;color:#cbd5e1;font-family:'Microsoft YaHei',sans-serif}
.w{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
.s{width:42px;height:42px;border:4px solid #1e293b;border-top-color:#f59e0b;border-radius:50%;animation:r 1s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}</style></head>
<body><div class="w"><div class="s"></div><div>AI工作台 正在启动服务…</div></div></body></html>"""


def error_html(text):
    return ("<!doctype html><html><head><meta charset='utf-8'></head>"
            "<body style='margin:0;height:100vh;display:flex;align-items:center;justify-content:center;"
            "background:#020617;color:#fca5a5;font-family:Microsoft YaHei,sans-serif'>"
            f"<div style='text-align:center;line-height:2'>⚠ {text}<br>"
            "<span style='color:#94a3b8'>可右键右下角托盘图标 → “重启服务”</span></div></body></html>")


class App:
    def __init__(self):
        self.server = Server()
        self.state = "busy"
        self.busy = False
        self.alive = True
        self.quitting = False
        self.hidden_tip_shown = False
        self.window = webview.create_window(
            APP, html=LOADING_HTML, width=1440, height=900, min_size=(1024, 680),
            background_color="#020617", text_select=True,
        )
        self.window.events.closing += self.on_window_closing
        self.icon = pystray.Icon(
            "AIWorkbench", make_image("busy"), f"{APP} - 启动中…",
            menu=pystray.Menu(
                pystray.MenuItem(lambda _: STATUS_TEXT[self.state], None, enabled=False),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("打开主窗口", self.on_show, default=True),
                pystray.MenuItem("重启服务", self.on_restart, enabled=lambda _: not self.busy),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("彻底退出", self.on_quit),
            ),
        )

    # ---- 状态 ----
    def set_state(self, state):
        if state != self.state:
            self.state = state
            self.icon.icon = make_image(state)
            self.icon.title = f"{APP} - {STATUS_TEXT[state][2:]}"
            self.icon.update_menu()

    def notify(self, text):
        try:
            self.icon.notify(text, APP)
        except Exception:
            pass

    # ---- 窗口 ----
    def show_window(self):
        try:
            self.window.show()
            self.window.restore()
            self.window.on_top = True   # 抢到前台后立即取消置顶
            self.window.on_top = False
        except Exception:
            pass

    def on_window_closing(self):
        if self.quitting:
            return True
        # 点窗口右上角 ✕：只隐藏到托盘，服务继续运行
        threading.Thread(target=self.window.hide, daemon=True).start()
        if not self.hidden_tip_shown:
            self.hidden_tip_shown = True
            self.notify("已缩到右下角托盘，服务仍在运行。\n单击托盘图标可重新打开，右键可彻底退出。")
        return False

    def load_app(self, ok, info):
        try:
            if ok:
                self.window.load_url(URL)
            else:
                self.window.load_html(error_html(info))
        except Exception:
            pass

    # ---- 托盘菜单 ----
    def on_show(self, *_):
        self.show_window()

    def on_restart(self, *_):
        if not self.busy:
            threading.Thread(target=self._restart, daemon=True).start()

    def _restart(self):
        self.busy = True
        self.set_state("busy")
        try:
            self.window.load_html(LOADING_HTML)
        except Exception:
            pass
        self.server.stop()
        ok, info = self.server.start()
        self.busy = False
        self.set_state("run" if ok else "down")
        self.load_app(ok, info)
        self.notify("服务已重启" if ok else info)

    def on_quit(self, *_):
        self.alive = False
        self.quitting = True
        self.busy = True
        self.set_state("busy")
        self.server.stop()
        self.icon.stop()
        try:
            self.window.destroy()
        except Exception:
            pass

    # ---- 后台线程 ----
    def ipc_listen(self):
        """监听本机 38081：第二次双击 exe 时收到 show 指令，唤出窗口。"""
        srv = socket.socket()
        try:
            srv.bind(("127.0.0.1", IPC_PORT))
        except OSError:
            return
        srv.listen(4)
        while self.alive:
            try:
                conn, _ = srv.accept()
                with conn:
                    if conn.recv(16).startswith(b"show"):
                        self.show_window()
            except OSError:
                break

    def watch(self):
        while self.alive:
            time.sleep(3)
            if self.busy or self.server.stopping:
                continue
            up = port_open()
            if self.state == "run" and not up:
                self.set_state("down")
                self.notify("服务意外停止，可右键托盘图标“重启服务”")
            elif self.state == "down" and up:
                self.set_state("run")

    def boot(self):
        """webview 启动后在后台线程执行：起托盘、起服务、加载界面。"""
        threading.Thread(target=self.icon.run, daemon=True).start()
        threading.Thread(target=self.ipc_listen, daemon=True).start()
        time.sleep(0.5)
        threading.Thread(target=pin_tray_icon, daemon=True).start()
        self.busy = True
        ok, info = self.server.start()
        self.busy = False
        self.set_state("run" if ok else "down")
        self.load_app(ok, info)
        threading.Thread(target=self.watch, daemon=True).start()

    def run(self):
        os.makedirs(STORAGE_DIR, exist_ok=True)
        webview.settings["ALLOW_DOWNLOADS"] = True
        webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
        webview.start(self.boot, private_mode=False, storage_path=STORAGE_DIR)
        # 窗口被系统强制关闭等异常情况下也确保清理
        if not self.quitting:
            self.alive = False
            self.server.stop()
            try:
                self.icon.stop()
            except Exception:
                pass


def main():
    # 单实例：再次双击 exe 时不重复启动，直接唤出已打开的窗口
    ctypes.windll.kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if ctypes.windll.kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        try:
            with socket.create_connection(("127.0.0.1", IPC_PORT), timeout=2) as s:
                s.sendall(b"show")
        except OSError:
            pass
        return
    App().run()


if __name__ == "__main__":
    main()
