Light80 Signal Server - Windows Portable

1) Double click: start-signal.cmd
2) Server starts on port 8788 by default
3) In web portal use signal URL: http://<YOUR_PC_IP>:8788

Optional env vars before start:
- SIGNAL_PORT (default: 8788)
- SIGNAL_SESSION_TTL_MS (default: 600000)

Health check:
- http://localhost:8788/health
