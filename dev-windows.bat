@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not in PATH.
  pause
  exit /b 1
)

if not exist node_modules\stripe\package.json (
  echo Stripe dependency is missing or outdated. Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting Vite development server...
call npm run dev
