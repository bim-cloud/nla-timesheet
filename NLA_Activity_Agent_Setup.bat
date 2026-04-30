@echo off
setlocal

:: Always keep window open
title NLA Activity Agent Setup

echo.
echo  ============================================================
echo   NLA Activity Agent - Setup
echo   Nature Landscape Architects
echo  ============================================================
echo.
echo  Do NOT close this window until setup is complete.
echo.

:: ── Find Python ──────────────────────────────────────────────
echo  Step 1: Finding Python...

set "PY="

:: Check specific known paths
if exist "%LOCALAPPDATA%\Python\bin\python.exe" set "PY=%LOCALAPPDATA%\Python\bin\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
if exist "C:\Python313\python.exe" set "PY=C:\Python313\python.exe"
if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"

:: Try system PATH if not found yet
if "%PY%"=="" (
    where python >nul 2>&1 && set "PY=python"
)
if "%PY%"=="" (
    where py >nul 2>&1 && set "PY=py"
)

if "%PY%"=="" (
    echo.
    echo  ERROR: Python not found on this PC.
    echo.
    echo  FIX: Install Python from https://www.python.org/downloads/
    echo       During install, check "Add Python to PATH"
    echo       Then run this file again.
    echo.
    start https://www.python.org/downloads/
    pause
    exit /b 1
)

echo  Found Python: %PY%
"%PY%" --version
echo.

:: ── Create folders ────────────────────────────────────────────
echo  Step 2: Creating agent folder...
set "DIR=%APPDATA%\NLA_Agent"
mkdir "%DIR%" 2>nul
echo  Folder: %DIR%
echo.

:: ── Download agent script ─────────────────────────────────────
echo  Step 3: Downloading agent script...
set "SCRIPT=%DIR%\nla_agent.py"
set "URL=https://nla-timesheet-5jc7.vercel.app/nla_agent.py"

"%PY%" -c "import urllib.request; urllib.request.urlretrieve('%URL%', r'%SCRIPT%'); print('  Downloaded OK')"

if errorlevel 1 (
    echo.
    echo  ERROR: Download failed. Check internet connection.
    echo  URL: %URL%
    pause
    exit /b 1
)
echo.

:: ── Install packages ──────────────────────────────────────────
echo  Step 4: Installing required packages (2-3 minutes)...
echo  Please wait - do not close this window.
echo.

"%PY%" -m pip install --quiet --upgrade pip
"%PY%" -m pip install --quiet pywin32 pynput pystray Pillow requests psutil

if errorlevel 1 (
    echo.
    echo  WARNING: Some packages failed. Trying anyway...
)
echo  Packages ready.
echo.

:: ── Create launcher script ────────────────────────────────────
echo  Step 5: Creating launcher...

:: Write a simple launcher .bat that can be double-clicked
set "LAUNCHER=%DIR%\Run NLA Agent.bat"
(
echo @echo off
echo start "" "%PY%" "%SCRIPT%"
) > "%LAUNCHER%"

:: Create desktop shortcut via Python (simpler than PowerShell)
"%PY%" -c "import os,sys; script=r'%SCRIPT%'; py=r'%PY%'; desktop=os.path.join(os.environ['USERPROFILE'],'Desktop'); launcher=r'%LAUNCHER%'; content=f'@echo off\nstart \"\" \"{py}\" \"{script}\"\n'; open(os.path.join(desktop,'NLA Activity Agent.bat'),'w').write(content); print('  Desktop shortcut created')"

:: Add to Windows startup
"%PY%" -c "import os,sys; script=r'%SCRIPT%'; py=r'%PY%'; startup=os.path.join(os.environ['APPDATA'],'Microsoft','Windows','Start Menu','Programs','Startup'); launcher=os.path.join(startup,'NLA Activity Agent.bat'); content=f'@echo off\nstart \"\" \"{py}\" \"{script}\"\n'; open(launcher,'w').write(content); print('  Added to Windows startup')"

echo.
echo  ============================================================
echo   SETUP COMPLETE!
echo  ============================================================
echo.
echo  The agent is starting now...
echo  Look for the NLA icon in your system tray (bottom-right).
echo.
echo  - Desktop shortcut: "NLA Activity Agent.bat" on Desktop
echo  - Auto-starts every time Windows boots
echo.

:: ── Launch the agent ──────────────────────────────────────────
start "" "%PY%" "%SCRIPT%"

echo  Agent launched! Login with your NLA username and password.
echo.
echo  To check if running:
echo    - Look for NLA tray icon (bottom right)
echo    - Or open Task Manager and find "python.exe"
echo.
timeout /t 8 /nobreak
