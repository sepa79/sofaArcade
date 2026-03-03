# Phone Controller MVP Setup

## Run locally

1. Start relay server:

```bash
pnpm dev:relay-server
```

2. In second terminal start web portal:

```bash
pnpm dev:web-portal
```

3. Open host page on PC:

- `http://localhost:5174/`
- Click **Create Session**
- Set **Public Base URL for phone** to LAN adres komputera, np. `http://192.168.1.50:5174`
- Scan QR with phone

4. Phone page:

- Opens `/controller?sessionId=...&relay=...`
- Tap **Enable Motion**
- Pick **Tilt** or **Slider** mode
- Use **FIRE / START / RECENTER**

## WSL2 + phone on LAN

If you run from WSL2 (NAT), phone cannot reach WSL ports directly via Windows LAN IP without port forwarding.

Run in **PowerShell as Administrator**:

```powershell
cd \\wsl$\Ubuntu\home\sepa\light80
powershell -ExecutionPolicy Bypass -File .\scripts\setup-wsl-portproxy.ps1
```

Then in host UI set:

- **Public Base URL for phone** to your Windows LAN address, for example: `http://192.168.88.50:5174`

Notes:

- WSL IP changes after restart; rerun the script after `wsl --shutdown` or reboot.

## Env knobs

Relay server defaults from script:

- `RELAY_PORT=8787`
- `RELAY_PUBLIC_WS_URL=ws://localhost:8787/ws`
- `RELAY_SESSION_TTL_MS=600000`

Web portal default from script:

- `VITE_RELAY_HTTP_URL=http://localhost:8787`
