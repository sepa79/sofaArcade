@echo off
setlocal

if "%SIGNAL_PORT%"=="" set SIGNAL_PORT=8788
if "%SIGNAL_SESSION_TTL_MS%"=="" set SIGNAL_SESSION_TTL_MS=600000

set "SCRIPT_DIR=%~dp0"
"%SCRIPT_DIR%node\node.exe" "%SCRIPT_DIR%signal-server\server.js"
