@echo off
title POS Server
cd /d "%~dp0"

echo ==========================================
echo              Starting POS
echo ==========================================
echo.

rem --- 1. Node.js must be installed ---
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install it from https://nodejs.org ^(LTS version^), then run this file again.
  echo.
  pause
  exit /b 1
)

rem --- 2. Install packages the first time (or after they were deleted) ---
if not exist "node_modules\" (
  echo Installing packages. This happens only once and needs internet...
  call npm install
  if errorlevel 1 (
    echo.
    echo Package install failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
)

rem --- 3. Build the app the first time. Delete the "dist" folder to rebuild after updating the code. ---
if not exist "dist\index.html" (
  echo Building the app...
  call npm run build
  if errorlevel 1 (
    echo.
    echo Build failed. See the messages above.
    pause
    exit /b 1
  )
)

rem --- 4. Start the server and open the browser ---
if not defined API_PORT set API_PORT=3001
echo.
echo POS is running at http://localhost:%API_PORT%
echo Other computers on the network: http://THIS-PC-IP:%API_PORT%
echo.
echo Keep this window open while using POS. Close it to stop POS.
echo.
if not defined NO_BROWSER start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:%API_PORT%"
node server/index.js

echo.
echo POS stopped.
pause
