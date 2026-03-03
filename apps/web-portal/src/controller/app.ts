import { createPhoneRelayInputMessage, parsePhoneRelayServerMessage } from '@light80/core';

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

export function mountControllerApp(root: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const sessionId = requireParam(params, 'sessionId');
  const relayUrl = requireParam(params, 'relay');

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

  let socket: WebSocket | null = new WebSocket(relayUrl);
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
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = createPhoneRelayInputMessage(seq, Date.now(), {
      moveX: computeMoveX(),
      fire: fireHeld || firePulsePending ? 1 : 0,
      start: startHeld ? 1 : 0,
      recenter: recenterPulsePending ? 1 : 0,
      special: specialPulsePending ? 1 : 0
    });

    socket.send(JSON.stringify(message));
    seq += 1;

    firePulsePending = false;
    recenterPulsePending = false;
    specialPulsePending = false;

    moveDebug.textContent = `MOVE_X: ${message.axes.moveX.toFixed(3)}`;
  }

  function onOrientation(event: DeviceOrientationEvent): void {
    if (event.gamma === null) {
      throw new Error('DeviceOrientationEvent gamma is null.');
    }

    latestGamma = event.gamma;
    tiltState = updateTilt(tiltState, event.gamma, DEFAULT_TILT_CONFIG);
    sensorDebug.textContent = `gamma=${event.gamma.toFixed(2)} baseline=${tiltState.baselineGamma.toFixed(2)}`;
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

  enableMotionBtn.addEventListener('click', () => {
    void (async () => {
      await requestMotionPermission();
      await acquireWakeLock();

      motionEnabled = true;
      window.addEventListener('deviceorientation', onOrientation);
      window.addEventListener('devicemotion', onMotion);
      sensorDebug.textContent = 'motion enabled';
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
      if (!motionEnabled) {
        throw new Error('Cannot recenter tilt before motion is enabled.');
      }

      tiltState = recenterTilt(tiltState, latestGamma);
      recenterPulsePending = true;
      await acquireWakeLock();
    })();
  });

  socket.addEventListener('open', () => {
    if (socket === null) {
      throw new Error('Phone WebSocket missing during open event.');
    }

    socket.send(
      JSON.stringify({
        type: 'join',
        role: 'phone',
        sessionId
      })
    );

    setStatus('connected to relay', true);
  });

  socket.addEventListener('message', (event) => {
    const message = parsePhoneRelayServerMessage(JSON.parse(event.data as string) as unknown);
    if (message.type === 'status') {
      if (message.status === 'host_connected') {
        setStatus('host connected', true);
        return;
      }

      if (message.status === 'host_lost') {
        setStatus('host lost', false);
        return;
      }

      return;
    }

    if (message.type === 'error') {
      setStatus(`error: ${message.message}`, false);
    }
  });

  socket.addEventListener('close', () => {
    setStatus('relay disconnected', false);
    socket = null;
  });

  setMode('tilt');
  setInterval(sendInputFrame, 1000 / 60);
}
