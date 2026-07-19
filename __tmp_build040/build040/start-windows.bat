@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencies are missing. Running setup first...
  call setup-windows.bat
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  echo Production build is missing. Building now...
  call npm run build
  if errorlevel 1 exit /b 1
)
if "%ADMIN_KEY%"=="" set "ADMIN_KEY=nexus-local-admin-change-me"
echo Starting NEXUS ONE at http://localhost:4173
echo Operations workspace: http://localhost:4173/operations
echo Local admin key: %ADMIN_KEY%
echo.
call npm start
