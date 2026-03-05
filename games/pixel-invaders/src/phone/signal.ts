export interface TiltState {
  readonly baselineGamma: number;
  readonly smoothedMoveX: number;
}

export interface ShakeState {
  readonly baselineRms: number;
  readonly smoothedRms: number;
  readonly windowStartMs: number;
  readonly peakRms: number;
  readonly lastFireMs: number;
  readonly lastSpecialMs: number;
}

export interface TiltConfig {
  readonly rangeDegrees: number;
  readonly deadzone: number;
  readonly smoothingAlpha: number;
}

export interface ShakeConfig {
  readonly baselineAlpha: number;
  readonly rmsAlpha: number;
  readonly fireThresholdMul: number;
  readonly specialThresholdMul: number;
  readonly fireCooldownMs: number;
  readonly specialCooldownMs: number;
  readonly windowMs: number;
}

export const DEFAULT_TILT_CONFIG: TiltConfig = {
  rangeDegrees: 25,
  deadzone: 0.05,
  smoothingAlpha: 0.25
};

export const DEFAULT_SHAKE_CONFIG: ShakeConfig = {
  baselineAlpha: 0.01,
  rmsAlpha: 0.25,
  fireThresholdMul: 2.1,
  specialThresholdMul: 2.9,
  fireCooldownMs: 220,
  specialCooldownMs: 420,
  windowMs: 120
};

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function applyDeadzone(value: number, deadzone: number): number {
  return Math.abs(value) < deadzone ? 0 : value;
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

export function createInitialTiltState(): TiltState {
  return {
    baselineGamma: 0,
    smoothedMoveX: 0
  };
}

export function recenterTilt(state: TiltState, gamma: number): TiltState {
  if (!Number.isFinite(gamma)) {
    throw new Error(`gamma must be finite, got ${gamma}.`);
  }

  return {
    baselineGamma: gamma,
    smoothedMoveX: state.smoothedMoveX
  };
}

export function updateTilt(state: TiltState, gamma: number, config: TiltConfig): TiltState {
  if (!Number.isFinite(gamma)) {
    throw new Error(`gamma must be finite, got ${gamma}.`);
  }

  const delta = gamma - state.baselineGamma;
  const raw = clampSigned(delta / config.rangeDegrees);
  const withDeadzone = applyDeadzone(raw, config.deadzone);
  const smoothed = lerp(state.smoothedMoveX, withDeadzone, config.smoothingAlpha);

  return {
    baselineGamma: state.baselineGamma,
    smoothedMoveX: clampSigned(smoothed)
  };
}

export function createInitialShakeState(): ShakeState {
  return {
    baselineRms: 0.2,
    smoothedRms: 0.2,
    windowStartMs: 0,
    peakRms: 0,
    lastFireMs: -1_000_000,
    lastSpecialMs: -1_000_000
  };
}

export interface ShakeUpdateResult {
  readonly state: ShakeState;
  readonly fire: boolean;
  readonly special: boolean;
}

export function updateShake(
  state: ShakeState,
  sampleMagnitude: number,
  nowMs: number,
  config: ShakeConfig
): ShakeUpdateResult {
  if (!Number.isFinite(sampleMagnitude) || sampleMagnitude < 0) {
    throw new Error(`sampleMagnitude must be finite and >=0, got ${sampleMagnitude}.`);
  }

  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new Error(`nowMs must be finite and >=0, got ${nowMs}.`);
  }

  const smoothedRms = lerp(state.smoothedRms, sampleMagnitude, config.rmsAlpha);
  const baselineRms = lerp(state.baselineRms, smoothedRms, config.baselineAlpha);
  const peakRms = Math.max(state.peakRms, smoothedRms);

  let nextWindowStartMs = state.windowStartMs;
  let nextPeakRms = peakRms;
  if (state.windowStartMs === 0) {
    nextWindowStartMs = nowMs;
  } else if (nowMs - state.windowStartMs >= config.windowMs) {
    nextWindowStartMs = nowMs;
    nextPeakRms = smoothedRms;
  }

  const fireThreshold = baselineRms * config.fireThresholdMul;
  const specialThreshold = baselineRms * config.specialThresholdMul;

  let fire = false;
  let special = false;
  let lastFireMs = state.lastFireMs;
  let lastSpecialMs = state.lastSpecialMs;

  if (nextPeakRms >= specialThreshold && nowMs - state.lastSpecialMs >= config.specialCooldownMs) {
    special = true;
    lastSpecialMs = nowMs;
  } else if (nextPeakRms >= fireThreshold && nowMs - state.lastFireMs >= config.fireCooldownMs) {
    fire = true;
    lastFireMs = nowMs;
  }

  return {
    state: {
      baselineRms,
      smoothedRms,
      windowStartMs: nextWindowStartMs,
      peakRms: nextPeakRms,
      lastFireMs,
      lastSpecialMs
    },
    fire,
    special
  };
}
