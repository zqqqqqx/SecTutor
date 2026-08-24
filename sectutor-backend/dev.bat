@echo off
chcp 65001 >nul
setlocal
set "PORT=8787"
rem script dir (strip trailing backslash to avoid start /D quote escaping)
set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"
set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=start"

if /i "%ACTION%"=="start"   call :do_start  & exit /b 0
if /i "%ACTION%"=="stop"    call :do_stop   & exit /b 0
if /i "%ACTION%"=="restart" call :do_stop & call :do_start & exit /b 0
if /i "%ACTION%"=="status"  call :do_status & exit /b 0
echo 用法: dev.bat [start ^| stop ^| restart ^| status]
exit /b 1

:do_status
call :findpid PID
if defined PID (echo [运行中] 后端已在端口 %PORT% 监听 ^(PID=%PID%^)) else (echo [未运行] 端口 %PORT% 无后端进程)
exit /b 0

:do_start
call :findpid PID
if defined PID (
  echo [已运行] 后端已在端口 %PORT% 运行 ^(PID=%PID%^)
) else (
  echo [启动] 正在启动 SecTutor 后端 ^(dev:fe, 仿真模式^) ...
  echo [调试] where node: & where node
  echo [调试] where npm: & where npm
  echo [调试] script dir=%DIR%
  echo [调试] 启动命令: cmd /k npm run dev:fe  (工作目录 %DIR%)
  start "SecTutor 后端" /D "%DIR%" cmd /k npm run dev:fe
  echo [等待] 等待 3 秒让服务就绪 ...
  ping -n 4 127.0.0.1 >nul
  call :findpid PID2
  if defined PID2 (echo [就绪] 后端已启动 ^(PID=%PID2%^)) else (echo [提示] 未检测到监听，请查看 "SecTutor 后端" 窗口的日志)
)
start "" "http://localhost:%PORT%/"
echo [完成] 浏览器已打开 http://localhost:%PORT%/
echo         停止后端请用 dev.bat stop （或关闭 "SecTutor 后端" 窗口 / 按 Ctrl+C）
exit /b 0

:do_stop
call :findpid PID
if not defined PID (echo [未运行] 端口 %PORT% 没有后端进程，无需停止 & exit /b 0)
echo [停止] 正在结束 PID=%PID% ...
taskkill /PID %PID% /F >nul 2>&1
if %errorlevel%==0 (echo [已停止] 后端已关闭) else (echo [失败] 无法结束进程，请手动结束)
exit /b 0

rem find listener PID on PORT via netstat, store into first arg
:findpid
set "%~1="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  set "%~1=%%a"
  goto :eof
)
goto :eof
