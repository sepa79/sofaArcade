import QRCode from 'qrcode';
import {
  createPhoneControllerProvider,
  parsePhoneRelayServerMessage
} from '@light80/core';

interface SessionResponse {
  readonly sessionId: string;
  readonly wsUrl: string;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function normalizePublicBaseUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('Public Base URL is required.');
  }

  const url = new URL(trimmed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Public Base URL must use http/https, got "${url.protocol}".`);
  }

  if (isLocalHostname(url.hostname)) {
    throw new Error('Public Base URL cannot use localhost for phone QR.');
  }

  return url;
}

function buildPhoneRelayWsUrl(sessionWsUrl: string, publicBaseUrl: URL): string {
  const relayUrl = new URL(sessionWsUrl);
  if (relayUrl.protocol !== 'ws:' && relayUrl.protocol !== 'wss:') {
    throw new Error(`Relay wsUrl must use ws/wss, got "${relayUrl.protocol}".`);
  }

  if (isLocalHostname(relayUrl.hostname)) {
    relayUrl.hostname = publicBaseUrl.hostname;
  }

  return relayUrl.toString();
}

function buildControllerUrl(base: URL, sessionId: string, relayWsUrl: string): string {
  const controllerUrl = new URL('/controller', base);
  controllerUrl.searchParams.set('sessionId', sessionId);
  controllerUrl.searchParams.set('relay', relayWsUrl);
  return controllerUrl.toString();
}

function requireElement<T extends Element>(element: T | null, label: string): T {
  if (element === null) {
    throw new Error(`Missing required host element: ${label}.`);
  }

  return element;
}

function requireCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('2D canvas context is required in host view.');
  }

  return context;
}

async function createSession(relayHttpUrl: string): Promise<SessionResponse> {
  const response = await fetch(`${relayHttpUrl}/session`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`Session creation failed: HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid /session response shape.');
  }

  const body = payload as Record<string, unknown>;
  if (typeof body.sessionId !== 'string' || typeof body.wsUrl !== 'string') {
    throw new Error('Session response must include string sessionId and wsUrl.');
  }

  return {
    sessionId: body.sessionId,
    wsUrl: body.wsUrl
  };
}

export function mountHostApp(root: HTMLElement, relayHttpUrl: string): void {
  const defaultPublicBase =
    isLocalHostname(window.location.hostname)
      ? ''
      : `${window.location.protocol}//${window.location.host}`;

  root.className = 'portal-root';
  root.innerHTML = `
    <div class="panel">
      <div class="value">Light80 Host</div>
      <div class="label">Relay: ${relayHttpUrl}</div>
    </div>
    <div class="host-grid">
      <div class="panel">
        <button id="create-session-btn">Create Session</button>
        <div style="height:12px"></div>
        <div class="label">Public Base URL for phone (LAN)</div>
        <input id="public-base-url" type="text" value="${defaultPublicBase}" placeholder="http://192.168.1.50:5174" style="width:100%;padding:10px;border-radius:10px;border:1px solid #3a4e7d;background:#0b1631;color:#dfe8ff" />
        <div style="height:12px"></div>
        <div class="label">Session code</div>
        <div id="session-code" class="value">-</div>
        <div style="height:12px"></div>
        <div class="label">Status</div>
        <div id="session-status" class="value status-warn">idle</div>
      </div>
      <div class="panel">
        <div class="label">Scan QR on phone</div>
        <canvas id="qr-canvas" width="220" height="220"></canvas>
        <div style="height:8px"></div>
        <div class="label" id="controller-url">controller URL not generated</div>
      </div>
    </div>
    <div class="panel">
      <div class="label">Live phone input preview</div>
      <canvas id="input-preview" width="860" height="220" style="width:100%;height:auto;border-radius:10px"></canvas>
      <div id="input-debug" class="label"></div>
    </div>
  `;

  const createButton = requireElement(
    root.querySelector<HTMLButtonElement>('#create-session-btn'),
    '#create-session-btn'
  );
  const sessionCode = requireElement(root.querySelector<HTMLElement>('#session-code'), '#session-code');
  const sessionStatus = requireElement(
    root.querySelector<HTMLElement>('#session-status'),
    '#session-status'
  );
  const qrCanvas = requireElement(root.querySelector<HTMLCanvasElement>('#qr-canvas'), '#qr-canvas');
  const controllerUrl = requireElement(
    root.querySelector<HTMLElement>('#controller-url'),
    '#controller-url'
  );
  const publicBaseUrlInput = requireElement(
    root.querySelector<HTMLInputElement>('#public-base-url'),
    '#public-base-url'
  );
  const inputPreview = requireElement(
    root.querySelector<HTMLCanvasElement>('#input-preview'),
    '#input-preview'
  );
  const inputDebug = requireElement(root.querySelector<HTMLElement>('#input-debug'), '#input-debug');

  const previewContext = requireCanvasContext(inputPreview);
  const provider = createPhoneControllerProvider();
  let hostSocket: WebSocket | null = null;
  let paddleX = inputPreview.width / 2;
  let fireFlashFrames = 0;
  let lastSeq = 0;
  let lastTimestamp = 0;

  function setStatus(status: string, ok: boolean): void {
    sessionStatus.textContent = status;
    sessionStatus.className = ok ? 'value status-ok' : 'value status-warn';
  }

  function attachHostSocket(wsUrl: string, sessionId: string): void {
    if (hostSocket !== null) {
      hostSocket.close();
      hostSocket = null;
    }

    hostSocket = new WebSocket(wsUrl);

    hostSocket.addEventListener('open', () => {
      hostSocket?.send(
        JSON.stringify({
          type: 'join',
          role: 'host',
          sessionId
        })
      );
      setStatus('waiting', false);
    });

    hostSocket.addEventListener('message', (event) => {
      const raw = JSON.parse(event.data as string) as unknown;
      const message = parsePhoneRelayServerMessage(raw);

      if (message.type === 'status') {
        if (message.status === 'phone_connected') {
          setStatus('phone connected', true);
          provider.setConnected(true);
          return;
        }

        if (message.status === 'phone_lost') {
          setStatus('phone lost', false);
          provider.setConnected(false);
          return;
        }

        if (message.status === 'waiting') {
          setStatus('waiting', false);
          provider.setConnected(false);
          return;
        }

        return;
      }

      if (message.type === 'input') {
        provider.ingest(message);
        lastSeq = message.seq;
        lastTimestamp = message.t;
        return;
      }

      if (message.type === 'error') {
        setStatus(`error: ${message.message}`, false);
      }
    });

    hostSocket.addEventListener('close', () => {
      setStatus('lost', false);
      provider.setConnected(false);
    });
  }

  createButton.addEventListener('click', () => {
    void (async () => {
      try {
        createButton.disabled = true;
        setStatus('creating session...', false);

        const session = await createSession(relayHttpUrl);
        const publicBaseUrl = normalizePublicBaseUrl(publicBaseUrlInput.value);
        const phoneRelayWsUrl = buildPhoneRelayWsUrl(session.wsUrl, publicBaseUrl);
        const url = buildControllerUrl(publicBaseUrl, session.sessionId, phoneRelayWsUrl);

        sessionCode.textContent = session.sessionId;
        controllerUrl.textContent = url;
        await QRCode.toCanvas(qrCanvas, url, {
          width: 220,
          margin: 1,
          color: {
            dark: '#E9F4FF',
            light: '#0C132B'
          }
        });

        attachHostSocket(session.wsUrl, session.sessionId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown host error';
        setStatus(`create failed: ${message}`, false);
      } finally {
        createButton.disabled = false;
      }
    })();
  });

  function renderPreview(): void {
    const frame = provider.nextFrame();
    paddleX += frame.moveX * 7;
    paddleX = Math.max(80, Math.min(inputPreview.width - 80, paddleX));

    if (frame.fire) {
      fireFlashFrames = 8;
    }

    previewContext.clearRect(0, 0, inputPreview.width, inputPreview.height);
    previewContext.fillStyle = '#081124';
    previewContext.fillRect(0, 0, inputPreview.width, inputPreview.height);

    previewContext.fillStyle = '#1f2f58';
    previewContext.fillRect(0, 170, inputPreview.width, 20);

    previewContext.fillStyle = fireFlashFrames > 0 ? '#ffe06f' : '#87e7ff';
    previewContext.fillRect(paddleX - 70, 145, 140, 22);

    previewContext.fillStyle = '#cfe6ff';
    previewContext.font = '20px Trebuchet MS';
    previewContext.fillText(frame.connected ? 'PHONE ONLINE' : 'PHONE OFFLINE', 20, 38);
    previewContext.fillText(`MOVE_X ${frame.moveX.toFixed(3)}`, 20, 64);
    previewContext.fillText(`START ${frame.start ? '1' : '0'} FIRE ${frame.fire ? '1' : '0'}`, 20, 90);
    previewContext.fillText(`SEQ ${lastSeq} T ${lastTimestamp}`, 20, 116);

    inputDebug.textContent = 'Preview uses PhoneControllerProvider from @light80/core.';

    if (fireFlashFrames > 0) {
      fireFlashFrames -= 1;
    }

    window.requestAnimationFrame(renderPreview);
  }

  renderPreview();
}
