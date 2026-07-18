@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not in PATH.
  echo Install Node.js 22 LTS, then reopen Command Prompt.
  pause
  exit /b 1
)

if not exist node_modules\stripe\package.json (
  echo Stripe dependency is missing or outdated. Installing locked dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed. Review the message above.
    pause
    exit /b 1
  )
)

if not exist dist\index.html (
  echo Production build is missing. Building now...
  call npm run build
  if errorlevel 1 (
    echo ERROR: Production build failed.
    pause
    exit /b 1
  )
)

if "%ADMIN_KEY%"=="" set "ADMIN_KEY=nexus-local-admin-change-me"
echo Starting NEXUS ONE at http://localhost:4173
echo Operations workspace: http://localhost:4173/operations
echo.
call npm start
