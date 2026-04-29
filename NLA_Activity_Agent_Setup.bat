@echo off
setlocal enabledelayedexpansion
title NLA Activity Agent - Setup
color 0A

echo.
echo  ================================================
echo   NLA Activity Agent - Setup
echo   Nature Landscape Architects
echo  ================================================
echo.

:: Keep window open on any error
if "%1"=="/debug" set DEBUG=1

:: ── Step 1: Find Python ───────────────────────────────────────
echo  [1/5] Checking Python...

set PYTHON=
for %%P in (
    "%LOCALAPPDATA%\Python\bin\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
) do (
    if exist %%P (
        set PYTHON=%%P
        goto :python_found
    )
)

python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON=python
    goto :python_found
)

py --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON=py
    goto :python_found
)

echo.
echo  [!] Python not found on this PC.
echo.
echo  Please install Python first:
echo    1. Go to: https://www.python.org/downloads/
echo    2. Download Python 3.12
echo    3. During install: CHECK "Add Python to PATH"
echo    4. Then run this setup again.
echo.
echo  Opening Python download page...
start https://www.python.org/downloads/
echo.
pause
exit /b 1

:python_found
echo      Found: %PYTHON%

:: ── Step 2: Create agent folder ──────────────────────────────
echo.
echo  [2/5] Preparing agent folder...

set AGENT_DIR=%APPDATA%\NLA_Agent
if not exist "%AGENT_DIR%" mkdir "%AGENT_DIR%"
echo      Folder: %AGENT_DIR%

:: ── Step 3: Download agent script ────────────────────────────
echo.
echo  [3/5] Downloading agent script...

set AGENT_SCRIPT=%AGENT_DIR%\nla_agent.py
set DOWNLOAD_URL=https://nla-timesheet-5jc7.vercel.app/nla_agent.py

powershell -NoProfile -NonInteractive -Command "try { Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%AGENT_SCRIPT%' -UseBasicParsing; Write-Host '     Downloaded successfully.' } catch { Write-Host '     ERROR: ' $_.Exception.Message; exit 1 }"

if errorlevel 1 (
    echo.
    echo  [!] Download failed. Check internet connection.
    echo      Trying to use existing script if available...
    if not exist "%AGENT_SCRIPT%" (
        echo  [!] No agent script found. Cannot continue.
        pause
        exit /b 1
    )
)
echo      Script saved.

:: ── Step 4: Install Python packages ──────────────────────────
echo.
echo  [4/5] Installing required packages...
echo      (This may take 2-3 minutes - please wait)

%PYTHON% -m pip install --quiet --upgrade pip 2>nul
%PYTHON% -m pip install --quiet pywin32 pynput pystray Pillow requests psutil pyinstaller

if errorlevel 1 (
    echo.
    echo  [!] Some packages failed to install.
    echo      Trying to run anyway...
)
echo      Packages installed.

:: ── Step 5: Build the .exe ───────────────────────────────────
echo.
echo  [5/5] Building NLA Activity Agent.exe...
echo      (This takes 2-4 minutes - DO NOT CLOSE this window)
echo.

set BUILD_TEMP=%TEMP%\nla_build_%RANDOM%
mkdir "%BUILD_TEMP%" 2>nul

%PYTHON% -m PyInstaller ^
    --onefile ^
    --noconsole ^
    --name "NLA Activity Agent" ^
    --hidden-import=win32gui ^
    --hidden-import=win32process ^
    --hidden-import=win32api ^
    --hidden-import=win32con ^
    --hidden-import=pywintypes ^
    --hidden-import=psutil ^
    --hidden-import=pynput.keyboard._win32 ^
    --hidden-import=pynput.mouse._win32 ^
    --hidden-import=pystray._win32 ^
    --collect-all=pystray ^
    --collect-all=pynput ^
    --distpath="%AGENT_DIR%" ^
    --workpath="%BUILD_TEMP%" ^
    --specpath="%BUILD_TEMP%" ^
    --log-level=ERROR ^
    "%AGENT_SCRIPT%"

set AGENT_EXE=%AGENT_DIR%\NLA Activity Agent.exe

if exist "%AGENT_EXE%" (
    echo      Build complete!
    rmdir /s /q "%BUILD_TEMP%" 2>nul
) else (
    echo.
    echo  [!] Build failed - will run from Python script directly.
    set AGENT_EXE=
)

:: ── Create desktop shortcut ───────────────────────────────────
echo.
echo  Creating desktop shortcut...

set SHORTCUT=%USERPROFILE%\Desktop\NLA Activity Agent.lnk
if defined AGENT_EXE (
    powershell -NoProfile -NonInteractive -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT%');$s.TargetPath='%AGENT_EXE%';$s.Description='NLA Activity Agent';$s.Save()"
) else (
    powershell -NoProfile -NonInteractive -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT%');$s.TargetPath='%PYTHON%';$s.Arguments='%AGENT_SCRIPT%';$s.Description='NLA Activity Agent';$s.Save()"
)
echo      Desktop shortcut created.

:: ── Add to Windows startup ────────────────────────────────────
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NLA Activity Agent.lnk
if defined AGENT_EXE (
    powershell -NoProfile -NonInteractive -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%STARTUP%');$s.TargetPath='%AGENT_EXE%';$s.WindowStyle=7;$s.Description='NLA Activity Agent';$s.Save()"
) else (
    powershell -NoProfile -NonInteractive -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%STARTUP%');$s.TargetPath='%PYTHON%';$s.Arguments='%AGENT_SCRIPT%';$s.WindowStyle=7;$s.Save()"
)
echo      Added to Windows startup (auto-starts on every login).

:: ── Done! ─────────────────────────────────────────────────────
echo.
echo  ================================================
echo   DONE! NLA Activity Agent is ready.
echo  ================================================
echo.
echo   What happens now:
echo    - The agent will launch in 3 seconds
echo    - Look for the NLA icon in your system tray
echo    - Right-click tray icon: Status / Open Dashboard / Quit
echo    - It will auto-start every time Windows boots
echo.
echo   Location: %AGENT_DIR%
echo.
timeout /t 3 /nobreak >nul

:: ── Launch the agent ──────────────────────────────────────────
if defined AGENT_EXE (
    if exist "%AGENT_EXE%" (
        start "" "%AGENT_EXE%"
        goto :done
    )
)
start "" %PYTHON% "%AGENT_SCRIPT%"

:done
echo  Agent launched! You can close this window.
echo.
timeout /t 5 /nobreak >nul
exit /b 0
