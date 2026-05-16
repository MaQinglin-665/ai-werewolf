@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-alpha.ps1"
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo AI Werewolf setup exited with code %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)
