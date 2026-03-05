import { createPhoneRelayInputMessage } from '@light80/core';

import { createSignalClient, type SignalIceCandidate } from './signal-client';
import {
  DEFAULT_SHAKE_CONFIG,
  DEFAULT_TILT_CONFIG,
  createInitialShakeState,
  createInitialTiltState,
  recenterTilt,
  updateShake,
  updateTilt
} from './signal';

interface MotionPermissionRequester {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

function requireParam(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (value === null || value.trim().length === 0) {
    throw new Error(`Missing required query parameter: ${name}.`);
  }

  return value;
}

function requireElement<T extends Element>(element: T | null, label: string): T {
  if (element === null) {
    throw new Error(`Missing required controller element: ${label}.`);
  }

  return element;
}

function magnitude3d(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function readScreenOrientationAngle(): number {
  const screenOrientation = window.screen.orientation;
  if (screenOrientation === undefined) {
    throw new Error('screen.orientation API is required for controller orientation mapping.');
  }

  if (!Number.isInteger(screenOrientation.angle)) {
    throw new Error('screen.orientation.angle must be an integer.');
  }

  const normalized = ((screenOrientation.angle % 360) + 360) % 360;
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }

  throw new Error(`Unsupported screen orientation angle: ${screenOrientation.angle}.`);
}

function resolveMoveGamma(event: DeviceOrientationEvent): number {
  if (event.gamma === null) {
    throw new Error('DeviceOrientationEvent gamma is null.');
  }

  if (event.beta === null) {
    throw new Error('DeviceOrientationEvent beta is null.');
  }

  const angle = readScreenOrientationAngle();
  if (angle === 90) {
    return -event.beta;
  }

  if (angle === 270) {
    return event.beta;
  }

  if (angle === 180) {
    return -event.gamma;
  }

  return event.gamma;
}

async function requestMotionPermission(): Promise<void> {
  const orientationPermissionEvent = DeviceOrientationEvent as unknown as MotionPermissionRequester;
  if (typeof orientationPermissionEvent.requestPermission === 'function') {
    const result = await orientationPermissionEvent.requestPermission();
    if (result !== 'granted') {
      throw new Error('DeviceOrientation permission denied.');
    }
  }

  const motionPermissionEvent = DeviceMotionEvent as unknown as MotionPermissionRequester;
  if (typeof motionPermissionEvent.requestPermission === 'function') {
    const result = await motionPermissionEvent.requestPermission();
    if (result !== 'granted') {
      throw new Error('DeviceMotion permission denied.');
    }
  }
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

export function isControllerMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('controller') === '1';
}

export function mountControllerMode(root: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const sessionId = requireParam(params, 'sessionId');
  const signalUrl = requireParam(params, 'signal');
  const signalClient = createSignalClient(signalUrl);

  root.id = 'controller-root';
  root.innerHTML = `
    <div class="panel">
      <div class="value">Light80 Phone Controller</div>
      <div class="label">Session ${sessionId}</div>
      <div id="controller-status" class="label status-warn">connecting...</div>
      <div id="wake-status" class="label status-warn">Wake lock: not acquired</div>
    </div>

    <div class="panel">
      <div class="controller-row">
        <button id="enable-motion-btn" class="controller-btn">Enable Motion</button>
      </div>
      <div class="controller-row two" style="margin-top:10px">
        <button id="mode-tilt" class="secondary">Tilt</button>
        <button id="mode-slider" class="secondary">Slider</button>
      </div>
      <div class="controller-row">
        <input id="slider-movex" type="range" min="-1" max="1" step="0.01" value="0" />
      </div>
      <div class="label" id="move-debug">MOVE_X: 0.000</div>
    </div>

    <div class="panel">
      <div class="controller-row two">
        <button id="fire-btn" class="controller-btn">FIRE</button>
        <button id="start-btn" class="controller-btn">START</button>
      </div>
      <div class="controller-row">
        <button id="recenter-btn" class="controller-btn secondary">RECENTER</button>
      </div>
      <div class="label" id="sensor-debug">motion disabled</div>
    </div>
  `;

  const statusEl = requireElement(root.querySelector<HTMLElement>('#controller-status'), '#controller-status');
  const wakeStatusEl = requireElement(root.querySelector<HTMLElement>('#wake-status'), '#wake-status');
  const modeTiltBtn = requireElement(root.querySelector<HTMLButtonElement>('#mode-tilt'), '#mode-tilt');
  const modeSliderBtn = requireElement(root.querySelector<HTMLButtonElement>('#mode-slider'), '#mode-slider');
  const slider = requireElement(root.querySelector<HTMLInputElement>('#slider-movex'), '#slider-movex');
  const moveDebug = requireElement(root.querySelector<HTMLElement>('#move-debug'), '#move-debug');
  const sensorDebug = requireElement(root.querySelector<HTMLElement>('#sensor-debug'), '#sensor-debug');
  const enableMotionBtn = requireElement(
    root.querySelector<HTMLButtonElement>('#enable-motion-btn'),
    '#enable-motion-btn'
  );
  const fireBtn = requireElement(root.querySelector<HTMLButtonElement>('#fire-btn'), '#fire-btn');
  const startBtn = requireElement(root.querySelector<HTMLButtonElement>('#start-btn'), '#start-btn');
  const recenterBtn = requireElement(root.querySelector<HTMLButtonElement>('#recenter-btn'), '#recenter-btn');

  let mode: 'tilt' | 'slider' = 'tilt';
  let motionEnabled = false;
  let seq = 0;
  let sliderMoveX = 0;
  let fireHeld = false;
  let firePulsePending = false;
  let startHeld = false;
  let recenterPulsePending = false;
  let specialPulsePending = false;
  let latestGamma = 0;
  let tiltState = createInitialTiltState();
  let shakeState = createInitialShakeState();

  let token = 0;
  let peer: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let pendingRemoteCandidates: RTCIceCandidateInit[] = [];

  function setStatus(text: string, ok: boolean): void {
    statusEl.textContent = text;
    statusEl.className = ok ? 'label status-ok' : 'label status-warn';
  }

  async function acquireWakeLock(): Promise<void> {
    const wakeLockApi = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
    if (wakeLockApi === undefined) {
      wakeStatusEl.textContent = 'Wake lock unsupported. Keep screen on manually.';
      wakeStatusEl.className = 'label status-warn';
      return;
    }

    await wakeLockApi.request('screen');
    wakeStatusEl.textContent = 'Wake lock active';
    wakeStatusEl.className = 'label status-ok';
  }

  function errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'unknown controller error';
  }

  function setMode(nextMode: 'tilt' | 'slider'): void {
    mode = nextMode;
    modeTiltBtn.className = nextMode === 'tilt' ? '' : 'secondary';
    modeSliderBtn.className = nextMode === 'slider' ? '' : 'secondary';
    slider.disabled = nextMode !== 'slider';
  }

  function computeMoveX(): number {
    if (mode === 'slider') {
      return sliderMoveX;
    }

    return tiltState.smoothedMoveX;
  }

  function sendInputFrame(): void {
    if (channel === null || channel.readyState !== 'open') {
      return;
    }

    const message = createPhoneRelayInputMessage(seq, Date.now(), {
      moveX: computeMoveX(),
      fire: fireHeld || firePulsePending ? 1 : 0,
      start: startHeld ? 1 : 0,
      recenter: recenterPulsePending ? 1 : 0,
      special: specialPulsePending ? 1 : 0
    });

    channel.send(JSON.stringify(message));
    seq += 1;

    firePulsePending = false;
    recenterPulsePending = false;
    specialPulsePending = false;

    moveDebug.textContent = `MOVE_X: ${message.axes.moveX.toFixed(3)}`;
  }

  function onOrientation(event: DeviceOrientationEvent): void {
    const moveGamma = resolveMoveGamma(event);
    latestGamma = moveGamma;
    tiltState = updateTilt(tiltState, moveGamma, DEFAULT_TILT_CONFIG);
    sensorDebug.textContent = `gamma=${moveGamma.toFixed(2)} baseline=${tiltState.baselineGamma.toFixed(2)}`;
  }

  function onMotion(event: DeviceMotionEvent): void {
    const acceleration = event.acceleration ?? event.accelerationIncludingGravity;
    if (acceleration === null || acceleration.x === null || acceleration.y === null || acceleration.z === null) {
      throw new Error('DeviceMotionEvent acceleration data is unavailable.');
    }

    const shake = updateShake(
      shakeState,
      magnitude3d(acceleration.x, acceleration.y, acceleration.z),
      Date.now(),
      DEFAULT_SHAKE_CONFIG
    );

    shakeState = shake.state;
    if (shake.fire) {
      firePulsePending = true;
    }

    if (shake.special) {
      specialPulsePending = true;
    }
  }

  function bindHoldButton(button: HTMLButtonElement, onChange: (pressed: boolean) => void): void {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      onChange(true);
    });

    button.addEventListener('pointerup', (event) => {
      event.preventDefault();
      onChange(false);
    });

    button.addEventListener('pointercancel', (event) => {
      event.preventDefault();
      onChange(false);
    });

    button.addEventListener('pointerleave', (event) => {
      event.preventDefault();
      onChange(false);
    });
  }

  function resetPeer(): void {
    token += 1;
    pendingRemoteCandidates = [];

    if (channel !== null) {
      channel.close();
      channel = null;
    }

    if (peer !== null) {
      peer.close();
      peer = null;
    }
  }

  async function flushPendingCandidates(activePeer: RTCPeerConnection): Promise<void> {
    if (activePeer.remoteDescription === null) {
      return;
    }

    for (const candidate of pendingRemoteCandidates) {
      await activePeer.addIceCandidate(candidate);
    }

    pendingRemoteCandidates = [];
  }

  async function pollOfferAndAnswer(localToken: number, activePeer: RTCPeerConnection): Promise<void> {
    setStatus('waiting for host offer...', false);

    while (localToken === token && activePeer.remoteDescription === null) {
      const offer = await signalClient.getOffer(sessionId);
      if (offer !== null) {
        await activePeer.setRemoteDescription(offer);
        await flushPendingCandidates(activePeer);

        const answer = await activePeer.createAnswer();
        await activePeer.setLocalDescription(answer);
        if (activePeer.localDescription === null) {
          throw new Error('Local answer missing after setLocalDescription.');
        }

        await signalClient.setAnswer(sessionId, asSignalDescription(activePeer.localDescription));
        setStatus('answer sent, waiting for direct link...', false);
        return;
      }

      await delay(240);
    }
  }

  async function pollHostCandidates(localToken: number, activePeer: RTCPeerConnection): Promise<void> {
    let after = 0;

    while (localToken === token) {
      const batch = await signalClient.listCandidates(sessionId, 'phone', after);
      for (const candidate of batch.candidates) {
        const candidateInit: RTCIceCandidateInit = {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment
        };

        if (activePeer.remoteDescription === null) {
          pendingRemoteCandidates.push(candidateInit);
        } else {
          await activePeer.addIceCandidate(candidateInit);
        }
      }

      after = batch.nextAfter;
      await delay(120);
    }
  }

  async function startPeer(): Promise<void> {
    resetPeer();
    token += 1;
    const localToken = token;
    const activePeer = new RTCPeerConnection({ iceServers: [] });
    peer = activePeer;

    activePeer.addEventListener('datachannel', (event) => {
      if (localToken !== token) {
        return;
      }

      channel = event.channel;
      channel.addEventListener('open', () => {
        if (localToken !== token) {
          return;
        }

        setStatus('connected (p2p)', true);
      });

      channel.addEventListener('close', () => {
        if (localToken !== token) {
          return;
        }

        setStatus('disconnected', false);
      });
    });

    activePeer.addEventListener('icecandidate', (event) => {
      if (event.candidate === null || localToken !== token) {
        return;
      }

      void signalClient.pushCandidate(sessionId, 'phone', normalizeCandidate(event.candidate)).catch((error) => {
        if (localToken !== token) {
          return;
        }

        setStatus(`signal error: ${errorMessage(error)}`, false);
      });
    });

    await pollOfferAndAnswer(localToken, activePeer);
    void pollHostCandidates(localToken, activePeer).catch((error) => {
      if (localToken !== token) {
        return;
      }

      setStatus(`signal error: ${errorMessage(error)}`, false);
    });
  }

  enableMotionBtn.addEventListener('click', () => {
    void (async () => {
      try {
        await requestMotionPermission();
        await acquireWakeLock();
        motionEnabled = true;
        window.addEventListener('deviceorientation', onOrientation);
        window.addEventListener('devicemotion', onMotion);
        sensorDebug.textContent = 'motion enabled';
      } catch (error) {
        const message = errorMessage(error);
        setStatus(`motion error: ${message}`, false);
        sensorDebug.textContent = `motion error: ${message}`;
      }
    })();
  });

  modeTiltBtn.addEventListener('click', () => {
    setMode('tilt');
  });

  modeSliderBtn.addEventListener('click', () => {
    setMode('slider');
  });

  slider.addEventListener('input', () => {
    sliderMoveX = Number.parseFloat(slider.value);
  });

  bindHoldButton(fireBtn, (pressed) => {
    fireHeld = pressed;
    if (pressed) {
      firePulsePending = true;
    }
  });

  bindHoldButton(startBtn, (pressed) => {
    startHeld = pressed;
  });

  recenterBtn.addEventListener('click', () => {
    void (async () => {
      try {
        if (!motionEnabled) {
          throw new Error('Cannot recenter tilt before motion is enabled.');
        }

        tiltState = recenterTilt(tiltState, latestGamma);
        recenterPulsePending = true;
        await acquireWakeLock();
      } catch (error) {
        const message = errorMessage(error);
        setStatus(`recenter error: ${message}`, false);
        sensorDebug.textContent = `recenter error: ${message}`;
      }
    })();
  });

  setMode('tilt');
  void (async () => {
    try {
      await startPeer();
    } catch (error) {
      setStatus(`signal error: ${errorMessage(error)}`, false);
    }
  })();

  window.setInterval(sendInputFrame, 1000 / 60);
}
