@echo off
setlocal
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
set "DESK=%USERPROFILE%\Desktop"
if not exist "%DESK%" set "DESK=%USERPROFILE%\OneDrive\Desktop"
if not exist "%DESK%" set "DESK=%~dp0"
set "ALERT=%DESK%\_SCHEDULE_ALERT.txt"
if not exist "%~dp0logs" mkdir "%~dp0logs"
set "LOG=%~dp0logs\latest.txt"
python schedule_agent.py -f ..\schedule.yaml --all > "%LOG%" 2>&1
set RC=%ERRORLEVEL%
echo. >> "%LOG%"
echo ---------------------------------------- >> "%LOG%"
python observer.py ..\schedule.yaml observe_map.yaml >> "%LOG%" 2>&1
if "%RC%"=="0" (
  if exist "%ALERT%" del /q "%ALERT%"
) else (
  copy /y "%LOG%" "%ALERT%" >nul
)
endlocal
