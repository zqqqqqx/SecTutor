@echo off
setlocal

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo Requesting administrator privileges to unregister sectutor:// protocol...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

reg delete "HKEY_CLASSES_ROOT\sectutor" /f
echo.
echo sectutor:// protocol removed.
pause
