@echo off
setlocal
cd /d "%~dp0"
echo =========================================
echo    OFFLINE PDF STUDIO PRO - BUILD
 echo =========================================
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js 22 is required. Download from https://nodejs.org/
  pause
  exit /b 1
)
echo Installing locked dependencies from npm...
call npm install --no-audit --no-fund
if errorlevel 1 goto :failed
echo Checking source files...
call npm run check
if errorlevel 1 goto :failed
echo Running real PDF engine unit tests...
call npm test
if errorlevel 1 goto :failed
echo Building HTTPS-ready iPhone web app...
call npm run build
if errorlevel 1 goto :failed
echo.
echo SUCCESS. Deploy the CONTENTS of the dist folder to an HTTPS site.
echo No Apple App Store upload is needed for this web app.
pause
exit /b 0
:failed
echo.
echo BUILD FAILED. See the error above. Do not deploy until resolved.
pause
exit /b 1
