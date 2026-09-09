@echo off
REM ===================================================================
REM  daily_check.bat - research schedule daily check
REM
REM  Runs schedule_agent.py and observer.py.
REM  Writes a file on the Desktop ONLY when there is something to act on.
REM  Deletes that file when everything is clear.
REM
REM  ASCII only on purpose: cmd.exe mangles non-ASCII in batch files.
REM  All Korean text comes from Python output, written as UTF-8.
REM ===================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

REM --- locate Desktop (OneDrive redirects it on some setups) ---
set "DESK=%USERPROFILE%\Desktop"
if not exist "%DESK%" set "DESK=%USERPROFILE%\OneDrive\Desktop"
if not exist "%DESK%" set "DESK=%~dp0"

set "ALERT=%DESK%\_SCHEDULE_ALERT.txt"
set "LOGDIR=%~dp0logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

REM  wmic is removed on recent Windows 11 builds; use PowerShell instead.
set "STAMP="
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"`) do set "STAMP=%%d"
if not defined STAMP set "STAMP=latest"
set "LOG=%LOGDIR%\%STAMP%.txt"

REM --- run the alert engine ---
python schedule_agent.py -f ..\schedule.yaml --all > "%LOG%" 2>&1
set "AGENT_RC=%ERRORLEVEL%"

REM --- run the observer, append ---
echo. >> "%LOG%"
echo ---------------------------------------- >> "%LOG%"
python observer.py ..\schedule.yaml observe_map.yaml >> "%LOG%" 2>&1

REM --- decide whether to raise the flag ---
REM  rc 0 = no alerts   rc 1 = alerts   rc 2 = load failure
if "%AGENT_RC%"=="0" (
    if exist "%ALERT%" del /q "%ALERT%"
    goto :eof
)

copy /y "%LOG%" "%ALERT%" >nul

REM --- optional toast; silently skipped if unavailable ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try{Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;$n=New-Object System.Windows.Forms.NotifyIcon;$n.Icon=[System.Drawing.SystemIcons]::Warning;$n.Visible=$true;$n.ShowBalloonTip(10000,'Research schedule','Check the file on your Desktop.',[System.Windows.Forms.ToolTipIcon]::Warning);Start-Sleep -Seconds 8;$n.Dispose()}catch{}" 2>nul

endlocal