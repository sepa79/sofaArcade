Light80 Local Playable (Windows, no npm)

1) Run start-local.cmd
2) Open game in browser on your PC (use LAN IP, not localhost):
   http://<YOUR_PC_IP>:5173
3) In launcher:
   Controllers -> Phone Link -> Connect Phone
4) Scan QR with phone.
5) On iPhone/iPad open the HTTPS controller link and accept the local certificate warning once.

Ports:
- 5173: static game page
- 8788: signaling API
- 5443: HTTPS phone controller page
- 8789: HTTPS signaling API

Optional env vars (before start-local.cmd):
- STATIC_PORT
- STATIC_HTTPS_PORT
- SIGNAL_PORT
- SIGNAL_HTTPS_PORT
- SIGNAL_SESSION_TTL_MS
- LIGHT80_HTTPS_HOST
