@echo off
set PORT=8000
echo Starting local HTTP server on http://localhost:%PORT%/
echo (Close this window to stop)
python -m http.server %PORT%
