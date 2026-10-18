@echo off
setlocal
cd /d "%~dp0"
title Build REGION Overlay

rem Usage:
rem   build.bat             - build portable .exe and installer
rem   build.bat portable    - build only the portable .exe (single file, no installer)
rem   build.bat installer   - build only the installer

set TARGET=portable nsis
if /i "%~1"=="portable" set TARGET=portable
if /i "%~1"=="installer" set TARGET=nsis

echo ============================================
echo   Building REGION Overlay for Windows
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install the LTS version: https://nodejs.org
  echo After installing, close this window and run build.bat again.
  goto :fail
)

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo.
echo [2/3] Running checks (search, punishments, updater, backup, log)...
call npm test
if errorlevel 1 (
  echo [ERROR] Tests failed, build stopped.
  goto :fail
)

echo.
echo [3/3] Building (%TARGET%). The first run may take a few minutes...
call npx electron-builder --win %TARGET%
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed.
  echo If the text above has "Cannot create symbolic link", run build.bat as administrator
  echo or turn on Developer Mode in Windows Settings.
  goto :fail
)

echo.
echo ============================================
echo   Done. Files are in the dist folder:
echo ============================================
dir /b dist\*.exe
echo.
echo Put the portable file ^(REGION Overlay-X.Y.Z.exe, without the word Setup^) into the
echo overlay-downloads folder of the site: the /overlay page and auto-update use the newest file.
echo The installer is named REGION Overlay-Setup-X.Y.Z.exe.
echo.
echo Updates must be signed: run  npm run sign -- "dist\REGION Overlay-X.Y.Z.exe"  and put the .sig file next to the .exe.
echo (first time only: npm run keygen, then commit update-key.pub).
echo.
start "" explorer "%~dp0dist"
pause
exit /b 0

:fail
echo.
pause
exit /b 1
