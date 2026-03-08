@echo off
setlocal

if "%SIGNAL_PORT%"=="" set SIGNAL_PORT=8788
if "%SIGNAL_HTTPS_PORT%"=="" set SIGNAL_HTTPS_PORT=8789
if "%SIGNAL_SESSION_TTL_MS%"=="" set SIGNAL_SESSION_TTL_MS=600000
if "%STATIC_PORT%"=="" set STATIC_PORT=5173
if "%STATIC_HTTPS_PORT%"=="" set STATIC_HTTPS_PORT=5443

set "SCRIPT_DIR=%~dp0"
set "CERT_PASSWORD=light80-local-dev"
set "CERT_PATH=%SCRIPT_DIR%certs\light80-local.pfx"

for /f "usebackq delims=" %%H in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%ensure-dev-cert.ps1" -OutputPath "%CERT_PATH%" -Password "%CERT_PASSWORD%" -HttpsHost "%LIGHT80_HTTPS_HOST%"`) do set "LIGHT80_HTTPS_HOST_RESOLVED=%%H"
if "%LIGHT80_HTTPS_HOST_RESOLVED%"=="" (
  echo Failed to prepare HTTPS certificate.
  exit /b 1
)

set "STATIC_HTTPS_PFX_PATH=%CERT_PATH%"
set "STATIC_HTTPS_PFX_PASSWORD=%CERT_PASSWORD%"
set "SIGNAL_HTTPS_PFX_PATH=%CERT_PATH%"
set "SIGNAL_HTTPS_PFX_PASSWORD=%CERT_PASSWORD%"

echo Starting Light80 local stack...
start "Light80 Signal" "%SCRIPT_DIR%node\node.exe" "%SCRIPT_DIR%signal-server\server.js"
start "Light80 Web" "%SCRIPT_DIR%node\node.exe" "%SCRIPT_DIR%static-server.cjs"

echo.
echo Signal: http://localhost:%SIGNAL_PORT%/health
echo Signal HTTPS: https://%LIGHT80_HTTPS_HOST_RESOLVED%:%SIGNAL_HTTPS_PORT%/health
echo Game:   http://localhost:%STATIC_PORT%
echo Phone:  https://%LIGHT80_HTTPS_HOST_RESOLVED%:%STATIC_HTTPS_PORT%
echo.
echo Open game on PC using your LAN IP for phone pairing, e.g.
echo http://192.168.1.50:%STATIC_PORT%
echo.
echo For iPhone/iPad motion controls, open the HTTPS phone link and accept the local certificate warning once.
