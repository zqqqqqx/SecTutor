@echo off
chcp 65001 >nul
setlocal
set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

echo [SecTutor] 正在启动本地启动器 (launcher) ...
start /min "SecTutor Launcher" node "%DIR%\launcher.js"
ping -n 3 127.0.0.1 >nul

echo [SecTutor] 正在启动后端 (仿真模式) ...
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:8799/start' -UseBasicParsing).StatusCode } catch { Write-Host 'launcher 尚未就绪，请稍后手动点击主页按钮启动' }"
ping -n 5 127.0.0.1 >nul

echo [SecTutor] 打开主页 ...
start "" "http://localhost:8787/"

echo.
echo [SecTutor] 已全部启动。主页上的「启动/停止后端」按钮现在可直接使用。
echo           关闭此窗口不会影响后端运行；停止后端请用主页「■ 停止后端」按钮或运行 dev.bat stop。
echo           启动器窗口 (SecTutor Launcher) 可最小化，但不要关闭它，否则网页按钮将失效。
echo           若希望开机自动就绪，可把本文件加入「启动」文件夹或计划任务。
pause
