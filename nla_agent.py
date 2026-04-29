"""
NLA Activity Agent v2.0
Nature Landscape Architects

Tracks active application usage (Revit, AutoCAD, Teams, etc.)
and syncs to the NLA Timesheet dashboard via Supabase.

Build to .exe:
    pip install pywin32 pynput pystray Pillow requests psutil pyinstaller
    pyinstaller --onefile --noconsole --name "NLA Activity Agent" nla_agent.py

Requirements: Windows 10/11
"""

import time
import json
import threading
import os
import sys
import ctypes
import datetime
from collections import defaultdict

import requests

# ── Platform guards ──────────────────────────────────────────────────────────
IS_WINDOWS = sys.platform == 'win32'

if IS_WINDOWS:
    import win32gui
    import win32process
    try:
        import psutil
        HAS_PSUTIL = True
    except ImportError:
        HAS_PSUTIL = False
    from pynput import mouse as pmouse, keyboard as pkeyboard
    import pystray
    from PIL import Image, ImageDraw
    import tkinter as tk
    from tkinter import ttk, messagebox
else:
    # Allow import on non-Windows for development/testing
    HAS_PSUTIL = False
    print("[NLA Agent] Running in non-Windows mode (no tracking)")

# ── Configuration ─────────────────────────────────────────────────────────────
SUPABASE_URL  = "https://tddegqxozgdnottitzeq.supabase.co"
SUPABASE_KEY  = "sb_publishable_svk_tc3SIHy7e5yL2n3gYA_cH9yTvPg"
DASHBOARD_URL = "https://nla-timesheet-5jc7.vercel.app"

SYNC_INTERVAL    = 300   # seconds between Supabase syncs (5 min)
IDLE_THRESHOLD   = 120   # seconds of no input = idle
SAMPLE_RATE      = 5     # seconds between window checks
AGENT_VERSION    = "2.0"

CONFIG_DIR  = os.path.join(os.environ.get("APPDATA", "."), "NLA_Agent")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
LOG_FILE    = os.path.join(CONFIG_DIR, "agent.log")

# ── App detection map ─────────────────────────────────────────────────────────
APP_PATTERNS = {
    "revit":      ["revit"],
    "acad":       ["autocad", "acad.exe"],
    "navisworks": ["navisworks"],
    "civil3d":    ["civil 3d", "civil3d"],
    "sketchup":   ["sketchup"],
    "rhino":      ["rhinoceros", "rhino.exe"],
    "teams":      ["microsoft teams"],
    "outlook":    ["outlook"],
    "pdf":        ["bluebeam", "adobe acrobat", "pdf-xchange", "foxit"],
    "excel":      ["microsoft excel", "excel.exe"],
    "word":       ["microsoft word", "winword.exe"],
    "chrome":     ["google chrome", "chrome.exe"],
    "explorer":   ["file explorer", "explorer.exe"],
}

APP_LABELS = {
    "revit":      "Autodesk Revit",
    "acad":       "AutoCAD",
    "navisworks": "Navisworks",
    "civil3d":    "Civil 3D",
    "sketchup":   "SketchUp",
    "rhino":      "Rhinoceros",
    "teams":      "Microsoft Teams",
    "outlook":    "Outlook",
    "pdf":        "PDF / Bluebeam",
    "excel":      "Excel",
    "word":       "Word",
    "chrome":     "Chrome",
    "explorer":   "File Explorer",
    "other":      "Other",
}

# ── Global state ──────────────────────────────────────────────────────────────
state = {
    "user_id":      None,
    "username":     None,
    "name":         None,
    "running":      False,
    "idle":         False,
    "last_input":   time.time(),
    "current_app":  "other",
    "focus_secs":   defaultdict(int),
    "last_sync":    time.time(),
    "status":       "Stopped",
    "tray_icon":    None,
    "sync_count":   0,
    "start_time":   None,
}
lock = threading.Lock()


# ── Logging ───────────────────────────────────────────────────────────────────
def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        os.makedirs(CONFIG_DIR, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ── Supabase helpers ──────────────────────────────────────────────────────────
def sb_headers():
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }


def sb_login(username: str, password: str):
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            headers=sb_headers(),
            params={
                "username": f"eq.{username.lower()}",
                "select":   "id,name,username,password,user_type",
            },
            timeout=10,
        )
        if not r.ok:
            return None, f"Server error ({r.status_code}). Check your connection."
        data = r.json()
        if not data:
            return None, "No account found with that username."
        user = data[0]
        if user.get("password") != password:
            return None, "Incorrect password."
        if user.get("user_type") == "manager":
            return None, "Manager accounts cannot run the agent. Use an employee account."
        return user, None
    except requests.exceptions.ConnectionError:
        return None, "Cannot connect to server. Check your internet connection."
    except Exception as e:
        return None, f"Connection error: {e}"


def sb_sync(user_id: str, focus_snapshot: dict) -> bool:
    today = datetime.date.today().isoformat()
    rows = [
        {
            "user_id":       user_id,
            "date":          today,
            "app_key":       app_key,
            "focus_seconds": seconds,
            "sampled_at":    datetime.datetime.utcnow().isoformat() + "Z",
        }
        for app_key, seconds in focus_snapshot.items()
        if seconds > 0
    ]
    if not rows:
        return True
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/app_usage",
            headers=sb_headers(),
            json=rows,
            timeout=15,
        )
        if r.ok:
            log(f"Synced {len(rows)} app records ({sum(s['focus_seconds'] for s in rows)}s total)")
            return True
        else:
            log(f"Sync failed: {r.status_code} {r.text[:100]}")
            return False
    except Exception as e:
        log(f"Sync error: {e}")
        return False


def sb_upsert_profile(user: dict):
    try:
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/profiles",
            headers={**sb_headers(), "Prefer": "resolution=merge-duplicates"},
            params={"id": f"eq.{user['id']}"},
            json={"agent_version": AGENT_VERSION, "agent_last_seen": datetime.datetime.utcnow().isoformat() + "Z"},
            timeout=10,
        )
    except Exception:
        pass


# ── Window detection ──────────────────────────────────────────────────────────
def get_active_app() -> str:
    if not IS_WINDOWS:
        return "other"
    try:
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return "other"
        title = win32gui.GetWindowText(hwnd).lower()
        exe = ""
        if HAS_PSUTIL:
            try:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                proc = psutil.Process(pid)
                exe = proc.name().lower()
            except Exception:
                pass
        combined = title + " " + exe
        for key, patterns in APP_PATTERNS.items():
            for p in patterns:
                if p in combined:
                    return key
        return "other"
    except Exception:
        return "other"


# ── Input tracking ────────────────────────────────────────────────────────────
def on_input(*_):
    state["last_input"] = time.time()


# ── Main tracking loop ────────────────────────────────────────────────────────
def tracking_loop():
    log(f"Tracking started for {state['name']} ({state['username']})")
    state["start_time"] = time.time()

    while state["running"]:
        now = time.time()
        idle_secs = now - state["last_input"]
        state["idle"] = idle_secs > IDLE_THRESHOLD

        if not state["idle"]:
            app = get_active_app()
            state["current_app"] = app
            with lock:
                state["focus_secs"][app] += SAMPLE_RATE

        # Sync to Supabase every SYNC_INTERVAL seconds
        if now - state["last_sync"] >= SYNC_INTERVAL:
            with lock:
                snapshot = dict(state["focus_secs"])
                state["focus_secs"].clear()

            success = sb_sync(state["user_id"], snapshot)
            state["last_sync"] = now
            state["sync_count"] += 1

            if success:
                state["status"] = f"Synced at {datetime.datetime.now().strftime('%H:%M')}"
            else:
                state["status"] = "Sync failed - will retry"

            update_tray()

        time.sleep(SAMPLE_RATE)

    log("Tracking stopped")


# ── System tray ───────────────────────────────────────────────────────────────
def make_tray_icon():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Navy background circle
    d.ellipse([0, 0, 63, 63], fill=(16, 35, 71, 255))
    # White "N"
    d.text((18, 14), "N", fill=(255, 255, 255))
    return img


def update_tray():
    if not state.get("tray_icon"):
        return
    idle_txt = " | IDLE" if state["idle"] else ""
    app_lbl = APP_LABELS.get(state["current_app"], "Other")
    elapsed = ""
    if state["start_time"]:
        mins = int((time.time() - state["start_time"]) / 60)
        h, m = divmod(mins, 60)
        elapsed = f" | {h}h {m:02d}m today"
    state["tray_icon"].title = (
        f"NLA Agent v{AGENT_VERSION} | {state['name']}\n"
        f"{app_lbl}{idle_txt}{elapsed}\n"
        f"{state['status']}"
    )


def show_status_window():
    if not IS_WINDOWS:
        return
    win = tk.Tk()
    win.title("NLA Activity Agent")
    win.geometry("400x340")
    win.resizable(False, False)
    win.configure(bg="#0f1c38")

    # Header
    tk.Label(win, text="NLA Activity Agent", bg="#0f1c38", fg="white",
             font=("Segoe UI", 15, "bold")).pack(pady=(22, 2))
    tk.Label(win, text=f"Version {AGENT_VERSION} | Nature Landscape Architects",
             bg="#0f1c38", fg="#8ea4cc", font=("Segoe UI", 9)).pack()

    sep = tk.Frame(win, height=1, bg="#1e3560")
    sep.pack(fill="x", padx=24, pady=14)

    # Stats frame
    frame = tk.Frame(win, bg="#162040", bd=0, relief="flat")
    frame.pack(fill="x", padx=24, pady=(0, 8))

    def stat_row(label, value, val_color="white"):
        f = tk.Frame(frame, bg="#162040")
        f.pack(fill="x", padx=16, pady=5)
        tk.Label(f, text=label, bg="#162040", fg="#8ea4cc",
                 font=("Segoe UI", 9), anchor="w", width=18).pack(side="left")
        tk.Label(f, text=value, bg="#162040", fg=val_color,
                 font=("Segoe UI", 9, "bold"), anchor="e").pack(side="right")

    stat_row("User",       state.get("name") or "Not logged in")
    stat_row("Username",   "@" + (state.get("username") or "?"))
    stat_row("Status",
             "Tracking" if state["running"] else "Stopped",
             val_color="#4ade80" if state["running"] else "#f87171")
    stat_row("Active now",
             "Yes" if not state["idle"] else "Idle",
             val_color="#fbbf24" if state["idle"] else "#4ade80")
    stat_row("App",        APP_LABELS.get(state["current_app"], "Other"))

    total_secs = sum(state["focus_secs"].values())
    hh, mm = divmod(total_secs // 60, 60)
    stat_row("Session",    f"{hh}h {mm:02d}m (pending sync)")
    stat_row("Last sync",  state["status"])
    stat_row("Syncs done", str(state["sync_count"]))

    sep2 = tk.Frame(win, height=1, bg="#1e3560")
    sep2.pack(fill="x", padx=24, pady=10)

    # Buttons
    btn_frame = tk.Frame(win, bg="#0f1c38")
    btn_frame.pack()

    def open_dashboard():
        import webbrowser
        webbrowser.open(DASHBOARD_URL)

    tk.Button(btn_frame, text="Open Dashboard", command=open_dashboard,
              bg="#1a56d6", fg="white", relief="flat",
              font=("Segoe UI", 9, "bold"), padx=16, pady=7,
              cursor="hand2").pack(side="left", padx=4)

    tk.Button(btn_frame, text="Close", command=win.destroy,
              bg="#253d6b", fg="white", relief="flat",
              font=("Segoe UI", 9), padx=16, pady=7,
              cursor="hand2").pack(side="left", padx=4)

    win.mainloop()


def on_quit(icon, _):
    log("Shutting down agent...")
    with lock:
        snapshot = dict(state["focus_secs"])
    if snapshot and state["user_id"]:
        log("Flushing remaining data before quit...")
        sb_sync(state["user_id"], snapshot)
    state["running"] = False
    icon.stop()


def start_tray(user: dict):
    state["user_id"]  = user["id"]
    state["username"] = user["username"]
    state["name"]     = user["name"]
    state["running"]  = True
    state["status"]   = "Starting..."

    sb_upsert_profile(user)

    # Start tracking thread
    t = threading.Thread(target=tracking_loop, daemon=True)
    t.start()

    # Start input listeners
    if IS_WINDOWS:
        pmouse.Listener(
            on_move=on_input, on_click=on_input, on_scroll=on_input, daemon=True
        ).start()
        pkeyboard.Listener(on_press=on_input, daemon=True).start()

    # Build tray menu
    menu = pystray.Menu(
        pystray.MenuItem(
            "Status / Open",
            lambda: threading.Thread(target=show_status_window, daemon=True).start()
        ),
        pystray.MenuItem("Open Dashboard", lambda: __import__("webbrowser").open(DASHBOARD_URL)),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit (sync & exit)", on_quit),
    )
    icon = pystray.Icon(
        "NLA Agent", make_tray_icon(), "NLA Activity Agent", menu
    )
    state["tray_icon"] = icon
    state["status"] = "Tracking"
    update_tray()
    icon.run()


# ── Config helpers ────────────────────────────────────────────────────────────
def load_config() -> dict:
    try:
        with open(CONFIG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(data: dict):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ── Login window ──────────────────────────────────────────────────────────────
def show_login():
    cfg = load_config()
    win = tk.Tk()
    win.title("NLA Activity Agent")
    win.geometry("420x520")
    win.resizable(False, False)
    win.configure(bg="#0f1c38")

    # Logo area
    logo_frame = tk.Frame(win, bg="#0f1c38")
    logo_frame.pack(pady=(32, 0))

    # NLA logo placeholder (navy circle with N)
    canvas = tk.Canvas(logo_frame, width=64, height=64, bg="#0f1c38", bd=0, highlightthickness=0)
    canvas.create_oval(2, 2, 62, 62, fill="#102347", outline="#1e3560", width=2)
    canvas.create_text(32, 32, text="N", fill="white", font=("Segoe UI", 28, "bold"))
    canvas.pack()

    tk.Label(win, text="NLA Timesheet", bg="#0f1c38", fg="white",
             font=("Segoe UI", 18, "bold")).pack(pady=(12, 2))
    tk.Label(win, text="Activity Agent", bg="#0f1c38", fg="#8ea4cc",
             font=("Segoe UI", 11)).pack()
    tk.Label(win, text="Nature Landscape Architects", bg="#0f1c38", fg="#4a6080",
             font=("Segoe UI", 8)).pack(pady=(2, 0))

    sep = tk.Frame(win, height=1, bg="#1e3560")
    sep.pack(fill="x", padx=32, pady=20)

    # Form
    form = tk.Frame(win, bg="#162040")
    form.pack(fill="x", padx=32)

    tk.Label(form, text="Username", bg="#162040", fg="#8ea4cc",
             font=("Segoe UI", 9, "bold"), anchor="w").pack(fill="x", padx=16, pady=(14, 2))
    u_var = tk.StringVar(value=cfg.get("username", ""))
    u_entry = tk.Entry(form, textvariable=u_var, bg="#1e3560", fg="white",
                       insertbackground="white", relief="flat",
                       font=("Segoe UI", 11), bd=0)
    u_entry.pack(fill="x", padx=16, ipady=10)

    tk.Frame(form, height=1, bg="#253d6b").pack(fill="x", padx=16, pady=(2, 0))

    tk.Label(form, text="Password", bg="#162040", fg="#8ea4cc",
             font=("Segoe UI", 9, "bold"), anchor="w").pack(fill="x", padx=16, pady=(12, 2))
    p_var = tk.StringVar()
    p_entry = tk.Entry(form, textvariable=p_var, show="*", bg="#1e3560", fg="white",
                       insertbackground="white", relief="flat",
                       font=("Segoe UI", 11), bd=0)
    p_entry.pack(fill="x", padx=16, ipady=10)

    tk.Frame(form, height=1, bg="#253d6b").pack(fill="x", padx=16, pady=(2, 4))

    err_var = tk.StringVar()
    err_lbl = tk.Label(form, textvariable=err_var, bg="#162040", fg="#f87171",
                       font=("Segoe UI", 9), wraplength=340, justify="center")
    err_lbl.pack(pady=(6, 2))

    result = {"user": None}

    def attempt_login(event=None):
        un = u_var.get().strip()
        pw = p_var.get().strip()
        if not un or not pw:
            err_var.set("Please enter your username and password.")
            return
        err_var.set("Signing in...")
        win.update()
        user, error = sb_login(un, pw)
        if error:
            err_var.set(error)
        else:
            save_config({"username": un})
            result["user"] = user
            win.destroy()

    btn = tk.Button(form, text="Sign in and start tracking",
                    command=attempt_login,
                    bg="#1a56d6", fg="white", relief="flat",
                    font=("Segoe UI", 10, "bold"), cursor="hand2",
                    activebackground="#1648b8", activeforeground="white")
    btn.pack(fill="x", padx=16, pady=(4, 16), ipady=11)

    note = tk.Label(win,
                    text="Tracks active app usage silently.\nData syncs every 5 minutes. Click tray icon for status.",
                    bg="#0f1c38", fg="#4a6080", font=("Segoe UI", 8), justify="center")
    note.pack(pady=(8, 0))

    # Keyboard shortcuts
    p_entry.bind("<Return>", attempt_login)
    u_entry.bind("<Return>", lambda e: p_entry.focus())

    if cfg.get("username"):
        p_entry.focus()
    else:
        u_entry.focus()

    win.mainloop()
    return result["user"]


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    if not IS_WINDOWS:
        print("[NLA Agent] This application requires Windows 10 or later.")
        print("[NLA Agent] To test on Windows, build with PyInstaller.")
        return

    # Prevent duplicate instances
    mutex = ctypes.windll.kernel32.CreateMutexW(None, False, "NLA_ActivityAgent_v2_Mutex")
    if ctypes.windll.kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        messagebox.showwarning(
            "NLA Activity Agent",
            "NLA Activity Agent is already running.\n\nCheck the system tray (bottom-right)."
        )
        return

    log(f"NLA Activity Agent v{AGENT_VERSION} starting...")
    user = show_login()
    if user:
        log(f"Logged in as {user['name']} ({user['username']})")
        start_tray(user)
    else:
        log("Login cancelled or failed.")


if __name__ == "__main__":
    main()
