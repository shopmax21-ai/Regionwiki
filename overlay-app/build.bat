@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Сборка REGION Overlay

rem Использование:
rem   build.bat             - собрать portable .exe и установщик
rem   build.bat portable    - собрать только portable .exe (один файл, без установки)
rem   build.bat installer   - собрать только установщик

set TARGET=portable nsis
if /i "%~1"=="portable" set TARGET=portable
if /i "%~1"=="installer" set TARGET=nsis

echo ============================================
echo   Сборка REGION Overlay для Windows
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден. Установите версию LTS: https://nodejs.org
  echo После установки закройте это окно и запустите build.bat снова.
  goto :fail
)

echo [1/3] Установка зависимостей...
call npm install
if errorlevel 1 goto :fail

echo.
echo [2/3] Проверка (тесты поиска и наказаний)...
call npm test
if errorlevel 1 (
  echo [ОШИБКА] Тесты не прошли, сборка остановлена.
  goto :fail
)

echo.
echo [3/3] Сборка (%TARGET%). Первый раз может занять несколько минут...
call npx electron-builder --win %TARGET%
if errorlevel 1 (
  echo.
  echo [ОШИБКА] Сборка не удалась.
  echo Если в тексте выше есть "Cannot create symbolic link", запустите build.bat от имени администратора
  echo или включите "Режим разработчика" в Параметрах Windows.
  goto :fail
)

echo.
echo ============================================
echo   Готово. Файлы в папке dist:
echo ============================================
dir /b dist\*.exe
echo.
echo Portable-версию ^(REGION Overlay-*.exe^) положите в папку overlay-downloads сайта,
echo старый файл оттуда удалите: страница /overlay предложит самый свежий.
echo.
start "" explorer "%~dp0dist"
pause
exit /b 0

:fail
echo.
pause
exit /b 1
