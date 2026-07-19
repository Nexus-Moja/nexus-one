@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencies are missing. Installing now...
  call npm install
  if errorlevel 1 exit /b 1
)
echo Starting Vite development server...
call npm run dev
