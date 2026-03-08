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
import { readOrientationAngle, resolveMoveGamma } from './orientation';

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

interface MotionPermissionRequester {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

function readMotionPermissionRequester(globalName: 'DeviceOrientationEvent' | 'DeviceMotionEvent'): MotionPermissionRequester | null {
  const value = (globalThis as Record<string, unknown>)[globalName];
  if (value === undefined) {
    return null;
  }

  return value as MotionPermissionRequester;
}

async function requestMotionPermission(): Promise<void> {
  const orientationPermissionEvent = readMotionPermissionRequester('DeviceOrientationEvent');
  const motionPermissionEvent = readMotionPermissionRequester('DeviceMotionEvent');

  if (orientationPermissionEvent === null && motionPermissionEvent === null) {
    if (!window.isSecureContext) {
      throw new Error('Motion sensors are unavailable here. Open the phone controller over HTTPS on iPhone/iPad.');
    }

    throw new Error('This browser does not expose DeviceOrientation/DeviceMotion APIs.');
  }

  if (typeof orientationPermissionEvent?.requestPermission === 'function') {
    const result = await orientationPermissionEvent.requestPermission();
    if (result !== 'granted') {
      throw new Error('DeviceOrientation permission denied.');
    }
  }

  if (typeof motionPermissionEvent?.requestPermission === 'function') {
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
    <div id="controller-control-chrome" class="controller-control-chrome">
      <button id="start-btn" class="controller-mini-btn">START</button>
      <div id="home-drag-track" class="controller-home-drag-track">
        <div id="home-drag-thumb" class="controller-home-drag-thumb">HOME</div>
      </div>
    </div>

    <div id="screen-home" class="controller-screen controller-screen-home">
      <div class="controller-card controller-card-home-status">
        <div class="controller-heading">SofaArcade</div>
        <div class="controller-session">Session ${sessionId}</div>
        <div id="controller-status" class="controller-meta status-warn">connecting...</div>
        <div id="wake-status" class="controller-meta status-warn">Wake lock: not acquired</div>
      </div>

      <div class="controller-card controller-card-home-nav">
        <div class="controller-section-label">Choose Layout</div>
        <div class="controller-home-grid">
          <button id="go-tilt-btn" class="controller-home-btn">TILT</button>
          <button id="go-slider-btn" class="controller-home-btn">SLIDER</button>
          <button id="go-joypad-btn" class="controller-home-btn">JOYPAD</button>
        </div>
      </div>

      <div class="controller-card controller-card-home-tools">
        <div class="controller-section-label">Motion</div>
        <div class="controller-tools-row">
          <button id="enable-motion-btn" class="controller-tool-btn">Enable Motion</button>
          <button id="recenter-btn" class="controller-tool-btn controller-tool-btn-secondary">Recenter</button>
        </div>
        <div class="controller-meta" id="sensor-debug">tap Enable Motion to allow gyro</div>
      </div>

      <div class="controller-card controller-card-home-debug">
        <div class="controller-section-label">Status</div>
        <div id="debug-summary" class="controller-meta controller-debug-summary">waiting for controller telemetry...</div>
        <div id="debug-log" class="controller-debug-log"></div>
      </div>
    </div>

    <div id="screen-tilt" class="controller-screen controller-screen-tilt">
      <button id="tilt-fire-left-btn" class="controller-action-btn controller-action-btn-round controller-action-fire">FIRE</button>
      <div class="controller-tilt-spacer"></div>
      <button id="tilt-fire-right-btn" class="controller-action-btn controller-action-btn-round controller-action-fire">FIRE</button>
    </div>

    <div id="screen-slider" class="controller-screen controller-screen-slider">
      <button id="slider-fire-btn" class="controller-action-btn controller-action-fire controller-action-btn-wide">FIRE</button>
      <div class="controller-card controller-slider-panel">
        <div id="slider-shell" class="controller-slider-shell">
          <input id="slider-movex" type="range" min="-1" max="1" step="0.01" value="0" />
        </div>
      </div>
    </div>

    <div id="screen-joypad" class="controller-screen controller-screen-joypad">
      <div class="controller-card controller-joystick-panel">
        <div id="joystick-pad" class="controller-joystick-pad">
          <div id="joystick-thumb" class="controller-joystick-thumb"></div>
        </div>
      </div>
      <div class="controller-joypad-actions">
        <button id="joy-fire-primary-btn" class="controller-action-btn controller-action-fire">A</button>
        <button id="joy-fire-secondary-btn" class="controller-action-btn controller-action-secondary">B</button>
      </div>
    </div>

  `;

  const controlChrome = requireElement(root.querySelector<HTMLElement>('#controller-control-chrome'), '#controller-control-chrome');
  const statusEl = requireElement(root.querySelector<HTMLElement>('#controller-status'), '#controller-status');
  const wakeStatusEl = requireElement(root.querySelector<HTMLElement>('#wake-status'), '#wake-status');
  const startBtn = requireElement(root.querySelector<HTMLButtonElement>('#start-btn'), '#start-btn');
  const homeDragTrack = requireElement(root.querySelector<HTMLElement>('#home-drag-track'), '#home-drag-track');
  const homeDragThumb = requireElement(root.querySelector<HTMLElement>('#home-drag-thumb'), '#home-drag-thumb');
  const goTiltBtn = requireElement(root.querySelector<HTMLButtonElement>('#go-tilt-btn'), '#go-tilt-btn');
  const goSliderBtn = requireElement(root.querySelector<HTMLButtonElement>('#go-slider-btn'), '#go-slider-btn');
  const goJoypadBtn = requireElement(root.querySelector<HTMLButtonElement>('#go-joypad-btn'), '#go-joypad-btn');
  const screenHome = requireElement(root.querySelector<HTMLElement>('#screen-home'), '#screen-home');
  const screenTilt = requireElement(root.querySelector<HTMLElement>('#screen-tilt'), '#screen-tilt');
  const screenSlider = requireElement(root.querySelector<HTMLElement>('#screen-slider'), '#screen-slider');
  const screenJoypad = requireElement(root.querySelector<HTMLElement>('#screen-joypad'), '#screen-joypad');
  const sliderShell = requireElement(root.querySelector<HTMLElement>('#slider-shell'), '#slider-shell');
  const slider = requireElement(root.querySelector<HTMLInputElement>('#slider-movex'), '#slider-movex');
  const joystickPad = requireElement(root.querySelector<HTMLElement>('#joystick-pad'), '#joystick-pad');
  const joystickThumb = requireElement(root.querySelector<HTMLElement>('#joystick-thumb'), '#joystick-thumb');
  const debugSummary = requireElement(root.querySelector<HTMLElement>('#debug-summary'), '#debug-summary');
  const debugLog = requireElement(root.querySelector<HTMLElement>('#debug-log'), '#debug-log');
  const sensorDebug = requireElement(root.querySelector<HTMLElement>('#sensor-debug'), '#sensor-debug');
  const enableMotionBtn = requireElement(
    root.querySelector<HTMLButtonElement>('#enable-motion-btn'),
    '#enable-motion-btn'
  );
  const recenterBtn = requireElement(root.querySelector<HTMLButtonElement>('#recenter-btn'), '#recenter-btn');
  const tiltFireLeftBtn = requireElement(root.querySelector<HTMLButtonElement>('#tilt-fire-left-btn'), '#tilt-fire-left-btn');
  const tiltFireRightBtn = requireElement(root.querySelector<HTMLButtonElement>('#tilt-fire-right-btn'), '#tilt-fire-right-btn');
  const sliderFireBtn = requireElement(root.querySelector<HTMLButtonElement>('#slider-fire-btn'), '#slider-fire-btn');
  const joyFirePrimaryBtn = requireElement(root.querySelector<HTMLButtonElement>('#joy-fire-primary-btn'), '#joy-fire-primary-btn');
  const joyFireSecondaryBtn = requireElement(root.querySelector<HTMLButtonElement>('#joy-fire-secondary-btn'), '#joy-fire-secondary-btn');

  let screen: 'home' | 'tilt' | 'slider' | 'joypad' = 'home';
  let motionEnabled = false;
  let seq = 0;
  let sliderMoveX = 0;
  let joystickMoveX = 0;
  let joystickMoveY = 0;
  let joystickPointerId: number | null = null;
  let homeDragPointerId: number | null = null;
  let homeDragProgress = 0;
  let fireHeld = false;
  let firePulsePending = false;
  let startHeld = false;
  let specialHeld = false;
  let recenterPulsePending = false;
  let specialPulsePending = false;
  let latestGamma = 0;
  let tiltState = createInitialTiltState();
  let shakeState = createInitialShakeState();

  let token = 0;
  let peer: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  let debugEntries: ReadonlyArray<string> = [];

  function appendDebugLog(message: string): void {
    const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
    debugEntries = [entry, ...debugEntries].slice(0, 10);
    debugLog.innerHTML = debugEntries.map((line) => `<div class="controller-debug-line">${line}</div>`).join('');
  }

  function renderDebugSummary(): void {
    debugSummary.textContent =
      `screen=${screen} move=${computeMoveX().toFixed(3)} joy=(${joystickMoveX.toFixed(2)}, ${joystickMoveY.toFixed(2)}) ` +
      `motion=${motionEnabled ? 'on' : 'off'} channel=${channel?.readyState ?? 'closed'} ` +
      `fire=${fireHeld ? 'held' : 'idle'} special=${specialHeld ? 'held' : 'idle'} start=${startHeld ? 'held' : 'idle'}`;
  }

  function setStatus(text: string, ok: boolean): void {
    statusEl.textContent = text;
    statusEl.className = ok ? 'controller-meta status-ok' : 'controller-meta status-warn';
    appendDebugLog(`status: ${text}`);
    renderDebugSummary();
  }

  async function acquireWakeLock(): Promise<void> {
    const wakeLockApi = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
    if (wakeLockApi === undefined) {
      wakeStatusEl.textContent = 'Wake lock unsupported. Keep screen on manually.';
      wakeStatusEl.className = 'controller-meta status-warn';
      appendDebugLog('wake lock unsupported');
      return;
    }

    await wakeLockApi.request('screen');
    wakeStatusEl.textContent = 'Wake lock active';
    wakeStatusEl.className = 'controller-meta status-ok';
    appendDebugLog('wake lock active');
  }

  function errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'unknown controller error';
  }

  function setHomeDragProgress(nextProgress: number): void {
    homeDragProgress = Math.max(0, Math.min(1, nextProgress));
    const maxOffset = Math.max(0, homeDragTrack.clientWidth - homeDragThumb.clientWidth - 4);
    homeDragThumb.style.transform = `translateX(${Math.round(maxOffset * homeDragProgress)}px)`;
  }

  function navigateHome(): void {
    screen = 'home';
    setHomeDragProgress(0);
    renderScreen();
  }

  function renderScreen(): void {
    goTiltBtn.className = screen === 'tilt' ? 'controller-home-btn is-active' : 'controller-home-btn';
    goSliderBtn.className = screen === 'slider' ? 'controller-home-btn is-active' : 'controller-home-btn';
    goJoypadBtn.className = screen === 'joypad' ? 'controller-home-btn is-active' : 'controller-home-btn';
    controlChrome.style.display = screen === 'home' ? 'none' : 'grid';
    screenHome.style.display = screen === 'home' ? 'grid' : 'none';
    screenTilt.style.display = screen === 'tilt' ? 'grid' : 'none';
    screenSlider.style.display = screen === 'slider' ? 'grid' : 'none';
    screenJoypad.style.display = screen === 'joypad' ? 'grid' : 'none';
    slider.disabled = screen !== 'slider';
    sliderShell.classList.toggle('is-disabled', screen !== 'slider');
    renderDebugSummary();
  }

  function computeMoveX(): number {
    if (screen === 'slider') {
      return sliderMoveX;
    }

    if (screen === 'joypad') {
      return joystickMoveX;
    }

    if (screen !== 'tilt') {
      return 0;
    }

    return tiltState.smoothedMoveX;
  }

  function updateMoveDebugs(): void {
    renderDebugSummary();
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
      special: specialHeld || specialPulsePending ? 1 : 0
    });

    channel.send(JSON.stringify(message));
    seq += 1;

    firePulsePending = false;
    recenterPulsePending = false;
    specialPulsePending = false;

    updateMoveDebugs();
    renderDebugSummary();
  }

  function onOrientation(event: DeviceOrientationEvent): void {
    const moveGamma = resolveMoveGamma(event, readOrientationAngle(window));
    latestGamma = moveGamma;
    tiltState = updateTilt(tiltState, moveGamma, DEFAULT_TILT_CONFIG);
    sensorDebug.textContent = `gamma=${moveGamma.toFixed(2)} baseline=${tiltState.baselineGamma.toFixed(2)}`;
    updateMoveDebugs();
    renderDebugSummary();
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
    renderDebugSummary();
  }

  function updateJoystickThumb(): void {
    const radiusPx = Math.max(0, (joystickPad.clientWidth - joystickThumb.clientWidth) / 2 - 8);
    joystickThumb.style.transform = `translate(${Math.round(joystickMoveX * radiusPx)}px, ${Math.round(joystickMoveY * radiusPx)}px)`;
    updateMoveDebugs();
    renderDebugSummary();
  }

  function resetJoystick(): void {
    joystickMoveX = 0;
    joystickMoveY = 0;
    joystickPointerId = null;
    updateJoystickThumb();
  }

  function updateJoystickFromPointer(clientX: number, clientY: number): void {
    const rect = joystickPad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
    const deltaX = (clientX - centerX) / radius;
    const deltaY = (clientY - centerY) / radius;
    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const normalizedScale = magnitude > 1 ? 1 / magnitude : 1;
    joystickMoveX = Math.max(-1, Math.min(1, deltaX * normalizedScale));
    joystickMoveY = Math.max(-1, Math.min(1, deltaY * normalizedScale));
    updateJoystickThumb();
  }

  function bindHoldButton(button: HTMLButtonElement, onChange: (pressed: boolean) => void): void {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.classList.add('is-held');
      onChange(true);
    });

    button.addEventListener('pointerup', (event) => {
      event.preventDefault();
      button.classList.remove('is-held');
      onChange(false);
    });

    button.addEventListener('pointercancel', (event) => {
      event.preventDefault();
      button.classList.remove('is-held');
      onChange(false);
    });

    button.addEventListener('pointerleave', (event) => {
      event.preventDefault();
      button.classList.remove('is-held');
      onChange(false);
    });
  }

  function bindHomeDrag(): void {
    homeDragTrack.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      homeDragPointerId = event.pointerId;
      homeDragTrack.setPointerCapture(event.pointerId);
      const rect = homeDragTrack.getBoundingClientRect();
      setHomeDragProgress((event.clientX - rect.left) / rect.width);
    });

    homeDragTrack.addEventListener('pointermove', (event) => {
      if (homeDragPointerId !== event.pointerId) {
        return;
      }
      const rect = homeDragTrack.getBoundingClientRect();
      setHomeDragProgress((event.clientX - rect.left) / rect.width);
    });

    const finishHomeDrag = (event: PointerEvent): void => {
      if (homeDragPointerId !== event.pointerId) {
        return;
      }
      const shouldGoHome = homeDragProgress >= 0.66;
      homeDragPointerId = null;
      setHomeDragProgress(0);
      if (shouldGoHome) {
        appendDebugLog('navigated to home');
        navigateHome();
      }
    };

    homeDragTrack.addEventListener('pointerup', finishHomeDrag);
    homeDragTrack.addEventListener('pointercancel', finishHomeDrag);
  }

  function bindJoystick(): void {
    joystickPad.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      joystickPointerId = event.pointerId;
      joystickPad.setPointerCapture(event.pointerId);
      updateJoystickFromPointer(event.clientX, event.clientY);
    });

    joystickPad.addEventListener('pointermove', (event) => {
      if (joystickPointerId !== event.pointerId) {
        return;
      }
      updateJoystickFromPointer(event.clientX, event.clientY);
    });

    joystickPad.addEventListener('pointerup', (event) => {
      if (joystickPointerId !== event.pointerId) {
        return;
      }
      resetJoystick();
    });

    joystickPad.addEventListener('pointercancel', (event) => {
      if (joystickPointerId !== event.pointerId) {
        return;
      }
      resetJoystick();
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
        appendDebugLog('data channel open');
      });

      channel.addEventListener('close', () => {
        if (localToken !== token) {
          return;
        }

        setStatus('disconnected', false);
        appendDebugLog('data channel closed');
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
        sensorDebug.textContent = 'motion enabled, tilt phone to steer';
        appendDebugLog('motion enabled');
      } catch (error) {
        const message = errorMessage(error);
        setStatus(`motion error: ${message}`, false);
        sensorDebug.textContent = `motion error: ${message}`;
      }
    })();
  });

  goTiltBtn.addEventListener('click', () => {
    screen = 'tilt';
    renderScreen();
    appendDebugLog('screen: tilt');
  });

  goSliderBtn.addEventListener('click', () => {
    screen = 'slider';
    renderScreen();
    appendDebugLog('screen: slider');
  });

  goJoypadBtn.addEventListener('click', () => {
    screen = 'joypad';
    renderScreen();
    appendDebugLog('screen: joypad');
  });

  slider.addEventListener('input', () => {
    sliderMoveX = Number.parseFloat(slider.value);
    updateMoveDebugs();
    renderDebugSummary();
  });

  const fireButtons = [tiltFireLeftBtn, tiltFireRightBtn, sliderFireBtn, joyFirePrimaryBtn];
  for (const button of fireButtons) {
    bindHoldButton(button, (pressed) => {
      fireHeld = pressed;
      if (pressed) {
        firePulsePending = true;
      }
    });
  }

  bindHoldButton(startBtn, (pressed) => {
    startHeld = pressed;
    renderDebugSummary();
  });

  bindHoldButton(joyFireSecondaryBtn, (pressed) => {
    specialHeld = pressed;
    if (pressed) {
      specialPulsePending = true;
    }
    renderDebugSummary();
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
        appendDebugLog('tilt recentered');
        updateMoveDebugs();
      } catch (error) {
        const message = errorMessage(error);
        setStatus(`recenter error: ${message}`, false);
        sensorDebug.textContent = `recenter error: ${message}`;
      }
    })();
  });

  bindHomeDrag();
  bindJoystick();
  updateMoveDebugs();
  setHomeDragProgress(0);
  appendDebugLog(`controller mounted for session ${sessionId}`);
  renderScreen();
  void (async () => {
    try {
      await startPeer();
    } catch (error) {
      setStatus(`signal error: ${errorMessage(error)}`, false);
    }
  })();

  window.setInterval(sendInputFrame, 1000 / 60);
}
