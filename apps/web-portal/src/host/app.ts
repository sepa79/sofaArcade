import QRCode from 'qrcode';
import {
  createPhoneControllerProvider,
  parsePhoneRelayInputMessage
} from '@light80/core';

import { createSignalClient, type SignalClient, type SignalIceCandidate } from '../signal/client';

interface SessionResponse {
  readonly sessionId: string;
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

function buildPhoneSignalUrl(signalHttpUrl: string, publicBaseUrl: URL): string {
  const signalUrl = new URL(signalHttpUrl);
  if (signalUrl.protocol !== 'http:' && signalUrl.protocol !== 'https:') {
    throw new Error(`Signal URL must use http/https, got "${signalUrl.protocol}".`);
  }

  if (isLocalHostname(signalUrl.hostname)) {
    signalUrl.hostname = publicBaseUrl.hostname;
  }

  return signalUrl.toString();
}

function buildControllerUrl(base: URL, sessionId: string, signalHttpUrl: string): string {
  const controllerUrl = new URL('/controller', base);
  controllerUrl.searchParams.set('sessionId', sessionId);
  controllerUrl.searchParams.set('signal', signalHttpUrl);
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

function normalizeCandidate(candidate: RTCIceCandidate): SignalIceCandidate {
  const init = candidate.toJSON();
  if (typeof init.candidate !== 'string' || init.candidate.length === 0) {
    throw new Error('ICE candidate string is missing.');
  }

  return {
    candidate: init.candidate,
    sdpMid: init.sdpMid ?? null,
    sdpMLineIndex: init.sdpMLineIndex ?? null,
    usernameFragment: init.usernameFragment ?? null
  };
}

function asSignalDescription(description: RTCSessionDescriptionInit): { type: 'offer' | 'answer'; sdp: string } {
  if (description.type !== 'offer' && description.type !== 'answer') {
    throw new Error(`Unsupported local description type: ${description.type}.`);
  }

  if (typeof description.sdp !== 'string' || description.sdp.length === 0) {
    throw new Error('Local description SDP is missing.');
  }

  return {
    type: description.type,
    sdp: description.sdp
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function mountHostApp(root: HTMLElement, signalHttpUrl: string): void {
  const signalClient = createSignalClient(signalHttpUrl);
  const defaultPublicBase =
    isLocalHostname(window.location.hostname)
      ? ''
      : `${window.location.protocol}//${window.location.host}`;

  root.className = 'portal-root';
  root.innerHTML = `
    <div class="panel">
      <div class="value">Light80 Host</div>
      <div class="label">Signaling: ${signalHttpUrl}</div>
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
  let paddleX = inputPreview.width / 2;
  let fireFlashFrames = 0;
  let lastSeq = 0;
  let lastTimestamp = 0;

  let sessionToken = 0;
  let hostPeer: RTCPeerConnection | null = null;
  let inputChannel: RTCDataChannel | null = null;
  let pendingRemoteCandidates: RTCIceCandidateInit[] = [];

  function setStatus(status: string, ok: boolean): void {
    sessionStatus.textContent = status;
    sessionStatus.className = ok ? 'value status-ok' : 'value status-warn';
  }

  function releasePeer(): void {
    sessionToken += 1;
    pendingRemoteCandidates = [];

    if (inputChannel !== null) {
      inputChannel.close();
      inputChannel = null;
    }

    if (hostPeer !== null) {
      hostPeer.close();
      hostPeer = null;
    }

    provider.setConnected(false);
  }

  async function flushPendingCandidates(peer: RTCPeerConnection): Promise<void> {
    if (peer.remoteDescription === null) {
      return;
    }

    for (const candidate of pendingRemoteCandidates) {
      await peer.addIceCandidate(candidate);
    }

    pendingRemoteCandidates = [];
  }

  async function pollAnswer(
    token: number,
    sessionId: string,
    peer: RTCPeerConnection,
    signal: SignalClient
  ): Promise<void> {
    while (token === sessionToken && peer.remoteDescription === null) {
      const answer = await signal.getAnswer(sessionId);
      if (answer !== null) {
        await peer.setRemoteDescription(answer);
        await flushPendingCandidates(peer);
        setStatus('phone answered, establishing direct link...', false);
        return;
      }

      await delay(240);
    }
  }

  async function pollRemoteCandidates(
    token: number,
    sessionId: string,
    peer: RTCPeerConnection,
    signal: SignalClient
  ): Promise<void> {
    let after = 0;

    while (token === sessionToken) {
      const batch = await signal.listCandidates(sessionId, 'host', after);
      for (const candidate of batch.candidates) {
        const candidateInit: RTCIceCandidateInit = {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment
        };

        if (peer.remoteDescription === null) {
          pendingRemoteCandidates.push(candidateInit);
        } else {
          await peer.addIceCandidate(candidateInit);
        }
      }

      after = batch.nextAfter;
      await delay(120);
    }
  }

  async function startHostPeer(sessionId: string): Promise<void> {
    releasePeer();

    sessionToken += 1;
    const token = sessionToken;
    const peer = new RTCPeerConnection({ iceServers: [] });
    const channel = peer.createDataChannel('light80-input', {
      ordered: false,
      maxRetransmits: 0
    });

    hostPeer = peer;
    inputChannel = channel;

    channel.addEventListener('open', () => {
      if (token !== sessionToken) {
        return;
      }

      provider.setConnected(true);
      setStatus('phone connected (p2p)', true);
    });

    channel.addEventListener('close', () => {
      if (token !== sessionToken) {
        return;
      }

      provider.setConnected(false);
      setStatus('phone disconnected', false);
    });

    channel.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        throw new Error('Data channel payload must be string JSON.');
      }

      const parsed = parsePhoneRelayInputMessage(JSON.parse(event.data) as unknown);
      provider.ingest(parsed);
      lastSeq = parsed.seq;
      lastTimestamp = parsed.t;
    });

    peer.addEventListener('icecandidate', (event) => {
      if (event.candidate === null || token !== sessionToken) {
        return;
      }

      void signalClient
        .pushCandidate(sessionId, 'host', normalizeCandidate(event.candidate))
        .catch((error: unknown) => {
          if (token !== sessionToken) {
            return;
          }

          const message = error instanceof Error ? error.message : 'unknown candidate push error';
          setStatus(`signal error: ${message}`, false);
        });
    });

    peer.addEventListener('connectionstatechange', () => {
      if (token !== sessionToken) {
        return;
      }

      if (peer.connectionState === 'failed') {
        setStatus('p2p connection failed', false);
      }

      if (peer.connectionState === 'disconnected') {
        setStatus('p2p disconnected', false);
      }
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    if (peer.localDescription === null) {
      throw new Error('Local offer missing after setLocalDescription.');
    }

    await signalClient.setOffer(sessionId, asSignalDescription(peer.localDescription));
    setStatus('offer published, waiting for phone...', false);

    void pollAnswer(token, sessionId, peer, signalClient).catch((error: unknown) => {
      if (token !== sessionToken) {
        return;
      }

      const message = error instanceof Error ? error.message : 'unknown answer poll error';
      setStatus(`signal error: ${message}`, false);
    });
    void pollRemoteCandidates(token, sessionId, peer, signalClient).catch((error: unknown) => {
      if (token !== sessionToken) {
        return;
      }

      const message = error instanceof Error ? error.message : 'unknown candidate poll error';
      setStatus(`signal error: ${message}`, false);
    });
  }

  createButton.addEventListener('click', () => {
    void (async () => {
      try {
        createButton.disabled = true;
        setStatus('creating session...', false);

        const session: SessionResponse = await signalClient.createSession();
        const publicBaseUrl = normalizePublicBaseUrl(publicBaseUrlInput.value);
        const phoneSignalUrl = buildPhoneSignalUrl(signalHttpUrl, publicBaseUrl);
        const url = buildControllerUrl(publicBaseUrl, session.sessionId, phoneSignalUrl);

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

        await startHostPeer(session.sessionId);
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

    inputDebug.textContent = 'Preview uses P2P WebRTC input channel + PhoneControllerProvider.';

    if (fireFlashFrames > 0) {
      fireFlashFrames -= 1;
    }

    window.requestAnimationFrame(renderPreview);
  }

  renderPreview();
}
