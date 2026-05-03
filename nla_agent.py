"""
NLA Desktop Helper v3.0
Nature Landscape Architects

Captures application usage and project context for productivity insights.

Build to .exe:
    pip install pywin32 pynput pystray Pillow requests psutil pyinstaller
    pyinstaller --onefile --noconsole --name "NLA Helper" nla_agent.py

Requirements: Windows 10/11
"""

import time
import json
import threading
import os
import sys
import re
import ctypes
import datetime
from collections import defaultdict

import requests

# - Platform guards -
IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:
    try:
        import win32gui
        import win32process
        HAS_WIN32 = True
    except ImportError:
        HAS_WIN32 = False
        print("[NLA Helper] WARNING: pywin32 not found. Run: pip install pywin32")
    try:
        import psutil
        HAS_PSUTIL = True
    except ImportError:
        HAS_PSUTIL = False
    try:
        from pynput import mouse as pmouse, keyboard as pkeyboard
        HAS_PYNPUT = True
    except ImportError:
        HAS_PYNPUT = False
        print("[NLA Helper] WARNING: pynput not found. Run: pip install pynput")
    try:
        import pystray
        from PIL import Image, ImageDraw
        HAS_TRAY = True
    except ImportError:
        HAS_TRAY = False
        print("[NLA Helper] WARNING: pystray/Pillow not found. Run: pip install pystray Pillow")
    try:
        import tkinter as tk
        from tkinter import ttk, messagebox
        HAS_TK = True
    except ImportError:
        HAS_TK = False
        print("[NLA Helper] WARNING: tkinter not available")
else:
    HAS_WIN32 = HAS_PYNPUT = HAS_TRAY = HAS_TK = False
    HAS_PSUTIL = False
    print("[NLA Helper] Running in non-Windows mode (no detection)")

# - Configuration -
SUPABASE_URL  = "https://tddegqxozgdnottitzeq.supabase.co"
SUPABASE_KEY  = "sb_publishable_svk_tc3SIHy7e5yL2n3gYA_cH9yTvPg"
DASHBOARD_URL = "https://nla-timesheet-5jc7.vercel.app"

SYNC_INTERVAL    = 300   # seconds between Supabase syncs (5 min)
IDLE_THRESHOLD   = 120   # seconds of no input = idle
SAMPLE_RATE      = 5     # seconds between window checks
AGENT_VERSION    = "3.0"

CONFIG_DIR  = os.path.join(os.environ.get("APPDATA", "."), "NLA_Helper")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
LOG_FILE    = os.path.join(CONFIG_DIR, "helper.log")

# - BIM apps category vs Other -
BIM_APPS = {"revit", "acad", "navisworks", "civil3d", "sketchup", "rhino"}

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

# File extensions per app for project detection
APP_EXTENSIONS = {
    "revit":      [".rvt", ".rfa", ".rte", ".rft"],
    "acad":       [".dwg", ".dxf", ".dwt"],
    "navisworks": [".nwd", ".nwf", ".nwc"],
    "civil3d":    [".dwg"],
    "sketchup":   [".skp"],
    "rhino":      [".3dm"],
}

# - Global state -
state = {
    "user_id":         None,
    "username":        None,
    "name":            None,
    "running":         False,
    "idle":            False,
    "last_input":      time.time(),
    "current_app":     "other",
    "current_project": None,
    "current_doc":     None,
    "session_data":    defaultdict(lambda: {"seconds": 0, "doc": None, "project": None}),
    "last_sync":       time.time(),
    "status":          "Stopped",
    "tray_icon":       None,
    "sync_count":      0,
    "start_time":      None,
    "projects":        [],  # cached project list from dashboard
}
lock = threading.Lock()


# - Logging -
def log(msg):
    try:
        os.makedirs(CONFIG_DIR, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except Exception:
        pass


# - Project detection from window title -
def fetch_projects():
    """Fetch project list from Supabase (we use the projects table or fallback)."""
    # Since projects are stored in localStorage of the dashboard, we use a known set
    # In production, this would come from a /projects table. For now, use cached list.
    try:
        # Try to read from a projects.json the dashboard might publish
        r = requests.get(f"{DASHBOARD_URL}/projects.json", timeout=5)
        if r.ok:
            return r.json()
    except Exception:
        pass
    return []


def extract_project_from_title(title: str, app_key: str):
    """Parse window title to find project name and document.
    
    Examples:
      Revit:  "Autodesk Revit 2024 - [Dubai_Creek_Harbor_F09.rvt - 3D View: ...]"
      AutoCAD: "AutoCAD 2024 - [DCH-F09 Site Plan.dwg]"
      SketchUp: "Untitled - SketchUp Pro 2023" or "MyProject.skp - SketchUp"
      Navisworks: "Navisworks Manage 2024 - [Project.nwd]"
    """
    if not title:
        return None, None

    # Find document name by extension
    doc_name = None
    extensions = APP_EXTENSIONS.get(app_key, [])
    for ext in extensions:
        # Match "filename.ext" - take the longest sensible match
        pattern = r"([A-Za-z0-9_\-\s\.\(\)]+" + re.escape(ext) + r")"
        m = re.search(pattern, title, re.IGNORECASE)
        if m:
            doc_name = m.group(1).strip()
            # Trim leading [ if present
            doc_name = doc_name.lstrip("[").strip()
            break

    if not doc_name:
        # SketchUp special case: title sometimes is just "ProjectName - SketchUp Pro"
        if app_key == "sketchup" and " - SketchUp" in title:
            doc_name = title.split(" - SketchUp")[0].strip()

    # Match doc name against known projects
    project_match = None
    if doc_name and state["projects"]:
        doc_lower = doc_name.lower()
        for p in state["projects"]:
            code = (p.get("code") or "").lower()
            name = (p.get("name") or "").lower()
            # Fuzzy match: project code or name appears in document name
            if code and code in doc_lower:
                project_match = p
                break
            if name and any(part in doc_lower for part in name.split() if len(part) > 3):
                project_match = p
                break

    return doc_name, project_match


def get_active_window_info():
    """Returns (app_key, title, doc_name, project_dict)."""
    if not IS_WINDOWS or not HAS_WIN32:
        return "other", "", None, None
    try:
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return "other", "", None, None
        title = win32gui.GetWindowText(hwnd)
        title_lower = title.lower()
        exe = ""
        if HAS_PSUTIL:
            try:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                proc = psutil.Process(pid)
                exe = proc.name().lower()
            except Exception:
                pass
        combined = title_lower + " " + exe
        app_key = "other"
        for key, patterns in APP_PATTERNS.items():
            for p in patterns:
                if p in combined:
                    app_key = key
                    break
            if app_key != "other":
                break

        doc_name, project = None, None
        if app_key in BIM_APPS:
            doc_name, project = extract_project_from_title(title, app_key)

        return app_key, title, doc_name, project
    except Exception as e:
        log(f"window detection error: {e}")
        return "other", "", None, None


# - Supabase API -
def sb_headers():
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }


def sb_login(email: str, password: str):
    try:
        r = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_KEY, "Content-Type": "application/json"},
            json={"email": email, "password": password},
            timeout=10,
        )
        if r.ok:
            data = r.json()
            return {
                "id":       data["user"]["id"],
                "email":    data["user"]["email"],
                "username": data["user"]["email"].split("@")[0],
                "name":     data["user"].get("user_metadata", {}).get("name") or data["user"]["email"].split("@")[0],
                "token":    data["access_token"],
            }, None
        return None, "Invalid email or password"
    except requests.exceptions.ConnectionError:
        return None, "Cannot connect to server. Check your internet connection."
    except Exception as e:
        return None, f"Connection error: {e}"


def sb_sync(user_id: str, sessions: list) -> bool:
    """Sync detailed session records to app_usage table.
    
    Each session is: {app_key, seconds, doc, project_id, project_name, started_at}
    """
    if not sessions:
        return True

    today = datetime.date.today().isoformat()
    rows = []
    for s in sessions:
        if s["seconds"] <= 0:
            continue
        app_key = s["app_key"]
        category = "BIM Apps" if app_key in BIM_APPS else "Other"
        rows.append({
            "user_id":          user_id,
            "date":             today,
            "app_name":         APP_LABELS.get(app_key, app_key),
            "app_category":    category,
            "project_id":       s.get("project_id"),
            "project_name":     s.get("project_name"),
            "document_name":    s.get("doc"),
            "start_time":       s.get("started_at"),
            "duration_seconds": s["seconds"],
        })

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
            total_secs = sum(row["duration_seconds"] for row in rows)
            log(f"Synced {len(rows)} session records ({total_secs}s)")
            return True
        else:
            log(f"Sync failed: {r.status_code} {r.text[:200]}")
            return False
    except Exception as e:
        log(f"Sync error: {e}")
        return False


def sb_upsert_profile(user: dict):
    """Update agent heartbeat in profiles table."""
    try:
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/profiles",
            headers={**sb_headers(), "Prefer": "return=minimal"},
            params={"id": f"eq.{user['id']}"},
            json={
                "agent_version":   AGENT_VERSION,
                "agent_last_seen": datetime.datetime.utcnow().isoformat() + "Z",
            },
            timeout=10,
        )
    except Exception:
        pass


def heartbeat_loop():
    """Send heartbeat to Supabase every 5 minutes while running."""
    while state["running"]:
        if state["user_id"]:
            sb_upsert_profile({"id": state["user_id"]})
        time.sleep(300)


# - Input tracking -
def on_input(*_):
    state["last_input"] = time.time()


# - Main detection loop -
def tracking_loop():
    log(f"Helper started for {state['name']}")
    state["start_time"] = time.time()

    # Refresh projects list every 30 minutes
    last_proj_fetch = 0

    # Track current session: when app/project changes, close prior session and open new
    current_session = None  # {app_key, doc, project_id, project_name, started_at, seconds}

    while state["running"]:
        now = time.time()

        # Refresh projects cache
        if now - last_proj_fetch >= 1800:
            state["projects"] = fetch_projects() or state["projects"]
            last_proj_fetch = now

        idle_secs = now - state["last_input"]
        state["idle"] = idle_secs > IDLE_THRESHOLD

        if not state["idle"]:
            app_key, title, doc, proj = get_active_window_info()
            state["current_app"] = app_key
            state["current_doc"] = doc
            state["current_project"] = proj["name"] if proj else None

            proj_id = proj["id"] if proj else None
            proj_name = proj["name"] if proj else None

            # Session continuity: if app/doc/project unchanged, just add seconds
            if (current_session and
                current_session["app_key"] == app_key and
                current_session["doc"] == doc and
                current_session["project_id"] == proj_id):
                current_session["seconds"] += SAMPLE_RATE
            else:
                # Close previous session, push to outbox
                if current_session and current_session["seconds"] > 0:
                    with lock:
                        state["session_data"][id(current_session)] = current_session
                # Start a new session
                current_session = {
                    "app_key":      app_key,
                    "doc":          doc,
                    "project_id":   proj_id,
                    "project_name": proj_name,
                    "started_at":   datetime.datetime.utcnow().isoformat() + "Z",
                    "seconds":      SAMPLE_RATE,
                }

        # Sync to Supabase every SYNC_INTERVAL seconds
        if now - state["last_sync"] >= SYNC_INTERVAL:
            with lock:
                # Include the in-progress session in this sync, then continue counting it
                pending = list(state["session_data"].values())
                state["session_data"].clear()
            if current_session and current_session["seconds"] > 0:
                pending.append(dict(current_session))
                # reset the in-progress counter so we don't double-count
                current_session["seconds"] = 0
                current_session["started_at"] = datetime.datetime.utcnow().isoformat() + "Z"

            ok = sb_sync(state["user_id"], pending)
            state["last_sync"] = now
            state["sync_count"] += 1
            state["status"] = (f"Synced at {datetime.datetime.now().strftime('%H:%M')}"
                              if ok else "Sync failed - will retry")
            update_tray()

        time.sleep(SAMPLE_RATE)

    # Final flush on shutdown
    if current_session and current_session["seconds"] > 0:
        sb_sync(state["user_id"], [current_session])

    log("Helper stopped")



# - Tray icon -
def make_tray_icon():
    img = Image.new("RGB", (64, 64), (16, 35, 71))
    d = ImageDraw.Draw(img)
    d.polygon([14, 12, 22, 12, 42, 40, 42, 12, 50, 12, 50, 52, 42, 52, 22, 24, 22, 52, 14, 52], fill=(255, 255, 255))
    return img


def update_tray():
    if not state.get("tray_icon"):
        return
    idle_txt = " | Idle" if state["idle"] else ""
    app_lbl = APP_LABELS.get(state["current_app"], "Other")
    proj = state.get("current_project")
    proj_txt = f" - {proj}" if proj else ""
    elapsed = ""
    if state["start_time"]:
        mins = int((time.time() - state["start_time"]) / 60)
        h, m = divmod(mins, 60)
        elapsed = f" | {h}h {m:02d}m"
    state["tray_icon"].title = (
        f"NLA Helper v{AGENT_VERSION} | {state['name']}\n"
        f"{app_lbl}{proj_txt}{idle_txt}{elapsed}\n"
        f"{state['status']}"
    )


def show_status_window():
    if not IS_WINDOWS:
        return
    win = tk.Tk()
    win.title("NLA Desktop Helper")
    win.geometry("420x380")
    win.resizable(False, False)
    win.configure(bg="#0f1c38")

    tk.Label(win, text="NLA Desktop Helper", bg="#0f1c38", fg="white",
             font=("Segoe UI", 15, "bold")).pack(pady=(22, 2))
    tk.Label(win, text=f"v{AGENT_VERSION} | Productivity insights for your workflow",
             bg="#0f1c38", fg="#8ea4cc", font=("Segoe UI", 9)).pack()

    tk.Frame(win, height=1, bg="#1e3560").pack(fill="x", padx=24, pady=14)

    frame = tk.Frame(win, bg="#162040")
    frame.pack(fill="x", padx=24, pady=(0, 8))

    def stat_row(label, value, val_color="white"):
        f = tk.Frame(frame, bg="#162040")
        f.pack(fill="x", padx=16, pady=5)
        tk.Label(f, text=label, bg="#162040", fg="#8ea4cc",
                 font=("Segoe UI", 9), anchor="w", width=18).pack(side="left")
        tk.Label(f, text=value, bg="#162040", fg=val_color,
                 font=("Segoe UI", 9, "bold"), anchor="e").pack(side="right")

    stat_row("Signed in as", state.get("name") or "Not signed in")
    stat_row("Status",
             "Active" if state["running"] else "Stopped",
             val_color="#4ade80" if state["running"] else "#f87171")
    stat_row("Currently",
             "Working" if not state["idle"] else "Away",
             val_color="#fbbf24" if state["idle"] else "#4ade80")
    stat_row("Application", APP_LABELS.get(state["current_app"], "Other"))
    if state.get("current_project"):
        stat_row("Project",  state["current_project"])
    if state.get("current_doc"):
        doc = state["current_doc"]
        if len(doc) > 28: doc = doc[:25] + "..."
        stat_row("Document", doc)
    stat_row("Last sync",  state["status"])
    stat_row("Syncs done", str(state["sync_count"]))

    tk.Frame(win, height=1, bg="#1e3560").pack(fill="x", padx=24, pady=10)

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
    log("Shutting down helper...")
    state["running"] = False
    icon.stop()


def start_tray(user: dict):
    state["user_id"]  = user["id"]
    state["username"] = user["username"]
    state["name"]     = user["name"]
    state["running"]  = True
    state["status"]   = "Starting..."

    sb_upsert_profile(user)

    # Pre-fetch project list
    state["projects"] = fetch_projects() or []

    # Start tracking + heartbeat threads
    threading.Thread(target=tracking_loop, daemon=True).start()
    threading.Thread(target=heartbeat_loop, daemon=True).start()

    # Start input listeners
    if IS_WINDOWS and HAS_PYNPUT:
        pmouse.Listener(
            on_move=on_input, on_click=on_input, on_scroll=on_input, daemon=True
        ).start()
        pkeyboard.Listener(on_press=on_input, daemon=True).start()

    if not HAS_TRAY:
        log("ERROR: pystray not installed. Run: pip install pystray Pillow")
        while state["running"]:
            time.sleep(60)
        return

    menu = pystray.Menu(
        pystray.MenuItem(
            "Status",
            lambda: threading.Thread(target=show_status_window, daemon=True).start()
        ),
        pystray.MenuItem("Open Dashboard", lambda: __import__("webbrowser").open(DASHBOARD_URL)),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", on_quit),
    )
    icon = pystray.Icon("NLA Helper", make_tray_icon(), "NLA Desktop Helper", menu)
    state["tray_icon"] = icon
    state["status"] = "Active"
    update_tray()
    icon.run()


# - Config helpers -
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


# - Login window -
def show_login():
    cfg = load_config()
    win = tk.Tk()
    win.title("NLA Desktop Helper")
    win.geometry("420x520")
    win.resizable(False, False)
    win.configure(bg="#0f1c38")

    logo_frame = tk.Frame(win, bg="#0f1c38")
    logo_frame.pack(pady=(32, 0))

    canvas = tk.Canvas(logo_frame, width=64, height=64, bg="#0f1c38", bd=0, highlightthickness=0)
    canvas.create_oval(2, 2, 62, 62, fill="#102347", outline="#1e3560", width=2)
    canvas.create_text(32, 32, text="N", fill="white", font=("Segoe UI", 28, "bold"))
    canvas.pack()

    tk.Label(win, text="NLA Timesheet", bg="#0f1c38", fg="white",
             font=("Segoe UI", 18, "bold")).pack(pady=(12, 2))
    tk.Label(win, text="Desktop Helper", bg="#0f1c38", fg="#8ea4cc",
             font=("Segoe UI", 11)).pack()
    tk.Label(win, text="Nature Landscape Architects", bg="#0f1c38", fg="#4a6080",
             font=("Segoe UI", 8)).pack(pady=(2, 0))

    tk.Frame(win, height=1, bg="#1e3560").pack(fill="x", padx=32, pady=20)

    form = tk.Frame(win, bg="#162040")
    form.pack(fill="x", padx=32)

    tk.Label(form, text="Email", bg="#162040", fg="#8ea4cc",
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
            err_var.set("Please enter your email and password.")
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

    btn = tk.Button(form, text="Sign in",
                    command=attempt_login,
                    bg="#1a56d6", fg="white", relief="flat",
                    font=("Segoe UI", 10, "bold"), cursor="hand2",
                    activebackground="#1648b8", activeforeground="white")
    btn.pack(fill="x", padx=16, pady=(4, 16), ipady=11)

    note = tk.Label(win,
                    text="Captures BIM tool usage to help you log accurate timesheet entries.\nRuns in your system tray. Open dashboard anytime for insights.",
                    bg="#0f1c38", fg="#4a6080", font=("Segoe UI", 8), justify="center")
    note.pack(pady=(8, 0))

    p_entry.bind("<Return>", attempt_login)
    u_entry.bind("<Return>", lambda e: p_entry.focus())

    if cfg.get("username"):
        p_entry.focus()
    else:
        u_entry.focus()

    win.mainloop()
    return result["user"]


# - Entry point -
def main():
    if not IS_WINDOWS:
        print("[NLA Helper] This application requires Windows 10 or later.")
        return

    # Prevent duplicate instances
    mutex = ctypes.windll.kernel32.CreateMutexW(None, False, "NLA_DesktopHelper_v3_Mutex")
    if ctypes.windll.kernel32.GetLastError() == 183:
        messagebox.showwarning(
            "NLA Desktop Helper",
            "NLA Desktop Helper is already running.\n\nCheck the system tray (bottom-right)."
        )
        return

    log(f"NLA Helper v{AGENT_VERSION} starting...")
    if not HAS_TK:
        log("ERROR: tkinter not available. Cannot show login window.")
        return
    user = show_login()
    if user:
        log(f"Signed in as {user['name']}")
        start_tray(user)
    else:
        log("Sign-in cancelled.")


if __name__ == "__main__":
    main()
