#!/usr/bin/env bash
PORT="${1:-8000}"
echo "Starting local HTTP server on http://localhost:${PORT}/"
echo "(Ctrl+C to stop)"
python3 -m http.server "${PORT}"
