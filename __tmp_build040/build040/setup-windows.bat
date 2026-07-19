@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not in PATH.
  echo Install Node.js 22 LTS from https://nodejs.org and reopen Command Prompt.
  pause
  exit /b 1
)
echo Installing project dependencies...
call npm install
if errorlevel 1 goto :fail
echo Building NEXUS ONE...
call npm run build
if errorlevel 1 goto :fail
echo.
echo Setup completed successfully.
echo Run start-windows.bat to launch the platform.
pause
exit /b 0
:fail
echo.
echo Setup failed. Review the error above.
pause
exit /b 1
