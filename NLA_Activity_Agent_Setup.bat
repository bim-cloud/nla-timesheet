@echo off
setlocal enabledelayedexpansion
title NLA Activity Agent - Setup
color 0B

:: ============================================================
::  NLA Activity Agent - One-Click Installer
::  Nature Landscape Architects
::  Double-click this file to install and launch the agent.
:: ============================================================

:: Show PowerShell UI installer
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$host.ui.RawUI.WindowTitle = 'NLA Activity Agent Setup';" ^
"Write-Host '';" ^
"Write-Host '  ==============================================' -ForegroundColor DarkBlue;" ^
"Write-Host '   NLA Activity Agent - Installing...' -ForegroundColor White;" ^
"Write-Host '  ==============================================' -ForegroundColor DarkBlue;" ^
"Write-Host '';"

:: Run the PowerShell installer
powershell -NoProfile -ExecutionPolicy Bypass -Command "
$ErrorActionPreference = 'Stop'
$AgentDir = Join-Path $env:APPDATA 'NLA_Agent'
$AgentScript = Join-Path $AgentDir 'nla_agent.py'
$AgentExe = Join-Path $AgentDir 'NLA Activity Agent.exe'
$BaseUrl = 'https://nla-timesheet-5jc7.vercel.app'

function Write-Step($msg) { Write-Host '  > ' -ForegroundColor Cyan -NoNewline; Write-Host $msg -ForegroundColor White }
function Write-OK($msg) { Write-Host '  [OK] ' -ForegroundColor Green -NoNewline; Write-Host $msg -ForegroundColor White }
function Write-Fail($msg) { Write-Host '  [!] ' -ForegroundColor Red -NoNewline; Write-Host $msg -ForegroundColor White }

Write-Host ''
Write-Host '  NLA Activity Agent v2.0' -ForegroundColor White
Write-Host '  Nature Landscape Architects' -ForegroundColor DarkGray
Write-Host ''

# Create agent directory
New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null
Write-OK 'Agent directory ready'

# Check Python
$PythonExe = $null
$PythonPaths = @(
    (Join-Path $env:LOCALAPPDATA 'Python\bin\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
    'C:\Python313\python.exe', 'C:\Python312\python.exe', 'C:\Python311\python.exe'
)
foreach ($p in $PythonPaths) {
    if (Test-Path $p) { $PythonExe = $p; break }
}
if (-not $PythonExe) {
    try { $PythonExe = (Get-Command python -ErrorAction Stop).Source } catch {}
}
if (-not $PythonExe) {
    try { $PythonExe = (Get-Command py -ErrorAction Stop).Source } catch {}
}

if ($PythonExe) {
    Write-OK \"Python found: $PythonExe\"
} else {
    Write-Step 'Python not found - downloading Python 3.12...'
    $PythonInstaller = Join-Path $env:TEMP 'python_installer.exe'
    Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.9/python-3.12.9-amd64.exe' -OutFile $PythonInstaller -UseBasicParsing
    Write-Step 'Installing Python 3.12 (silent install)...'
    Start-Process -FilePath $PythonInstaller -ArgumentList '/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=0' -Wait
    Remove-Item $PythonInstaller -Force -ErrorAction SilentlyContinue
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
    try { $PythonExe = (Get-Command python -ErrorAction Stop).Source } catch { $PythonExe = 'python' }
    Write-OK 'Python installed'
}

# Download agent script
Write-Step 'Downloading NLA agent script...'
try {
    Invoke-WebRequest -Uri \"$BaseUrl/nla_agent.py\" -OutFile $AgentScript -UseBasicParsing
    Write-OK 'Agent script downloaded'
} catch {
    Write-Fail 'Download failed. Check internet connection.'
    Read-Host 'Press Enter to exit'
    exit 1
}

# Install dependencies
Write-Step 'Installing dependencies (this takes 1-2 minutes)...'
$deps = 'pywin32', 'pynput', 'pystray', 'Pillow', 'requests', 'psutil', 'pyinstaller'
& $PythonExe -m pip install --quiet --upgrade pip 2>&1 | Out-Null
& $PythonExe -m pip install --quiet $deps 2>&1 | Out-Null
Write-OK 'Dependencies installed'

# Build .exe with PyInstaller
Write-Step 'Building NLA Activity Agent.exe...'
$BuildDir = Join-Path $env:TEMP 'nla_build'
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
$BuildArgs = @(
    '--onefile', '--noconsole',
    \"--name=NLA Activity Agent\",
    '--hidden-import=win32gui', '--hidden-import=win32process',
    '--hidden-import=win32api', '--hidden-import=pywintypes',
    '--hidden-import=psutil',
    '--hidden-import=pynput.keyboard._win32',
    '--hidden-import=pynput.mouse._win32',
    '--hidden-import=pystray._win32',
    '--collect-all=pystray', '--collect-all=pynput',
    \"--distpath=$AgentDir\",
    \"--workpath=$BuildDir\",
    \"--specpath=$BuildDir\",
    $AgentScript
)
& $PythonExe -m PyInstaller @BuildArgs 2>&1 | Out-Null

if (Test-Path $AgentExe) {
    Write-OK 'NLA Activity Agent.exe built successfully'
    Remove-Item $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Fail 'Build failed - running from script directly'
    \$AgentExe = \$null
}

# Create desktop shortcut
Write-Step 'Creating desktop shortcut...'
\$DesktopPath = [Environment]::GetFolderPath('Desktop')
\$ShortcutPath = Join-Path \$DesktopPath 'NLA Activity Agent.lnk'
\$Shell = New-Object -ComObject WScript.Shell
\$Shortcut = \$Shell.CreateShortcut(\$ShortcutPath)
if (\$AgentExe) {
    \$Shortcut.TargetPath = \$AgentExe
} else {
    \$Shortcut.TargetPath = \$PythonExe
    \$Shortcut.Arguments = \$AgentScript
}
\$Shortcut.Description = 'NLA Activity Agent - Time Tracker'
\$Shortcut.WorkingDirectory = \$AgentDir
\$Shortcut.Save()
Write-OK 'Desktop shortcut created'

# Create startup shortcut (auto-start with Windows)
\$StartupPath = Join-Path \$env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
\$StartupShortcut = Join-Path \$StartupPath 'NLA Activity Agent.lnk'
\$Shortcut2 = \$Shell.CreateShortcut(\$StartupShortcut)
if (\$AgentExe) {
    \$Shortcut2.TargetPath = \$AgentExe
} else {
    \$Shortcut2.TargetPath = \$PythonExe
    \$Shortcut2.Arguments = \$AgentScript
}
\$Shortcut2.Description = 'NLA Activity Agent'
\$Shortcut2.WindowStyle = 7
\$Shortcut2.Save()
Write-OK 'Added to Windows startup (auto-starts on login)'

Write-Host ''
Write-Host '  =============================================' -ForegroundColor Green
Write-Host '   Setup Complete!' -ForegroundColor White
Write-Host '  =============================================' -ForegroundColor Green
Write-Host ''
Write-Host '  The agent is launching now.' -ForegroundColor White
Write-Host '  Look for the NLA icon in your system tray (bottom-right).' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  - Desktop shortcut created' -ForegroundColor DarkGray
Write-Host '  - Auto-starts when Windows boots' -ForegroundColor DarkGray
Write-Host ''

Start-Sleep -Seconds 2

# Launch the agent
if (\$AgentExe -and (Test-Path \$AgentExe)) {
    Start-Process -FilePath \$AgentExe
} else {
    Start-Process -FilePath \$PythonExe -ArgumentList \$AgentScript
}
"

if errorlevel 1 (
    echo.
    echo  Something went wrong. Please check your internet connection.
    echo  Or contact IT support.
    pause
)
