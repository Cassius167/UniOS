@echo off
REM Double-click to open UniOS. Keep this window open while you use the app; close it to stop.
cd /d "%~dp0"
if not exist node_modules (
  echo Installing UniOS for the first time, this takes a minute...
  call npm install
)
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
echo Starting UniOS at http://localhost:3000 ...
call npm run dev
