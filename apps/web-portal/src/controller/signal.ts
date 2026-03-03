export interface TiltConfig {
  readonly rangeDegrees: number;
  readonly deadzone: number;
  readonly smoothingAlpha: number;
}

export interface TiltState {
  readonly baselineGamma: number;
  readonly smoothedMoveX: number;
}

export interface ShakeConfig {
  readonly energyAlpha: number;
  readonly fireThreshold: number;
  readonly specialThreshold: number;
  readonly cooldownMs: number;
}

export interface ShakeState {
  readonly energy: number;
  readonly lastTriggerMs: number;
}

export interface ShakeUpdate {
  readonly state: ShakeState;
  readonly fire: boolean;
  readonly special: boolean;
}

export const DEFAULT_TILT_CONFIG: TiltConfig = {
  rangeDegrees: 25,
  deadzone: 0.05,
  smoothingAlpha: 0.25
};

export const DEFAULT_SHAKE_CONFIG: ShakeConfig = {
  energyAlpha: 0.22,
  fireThreshold: 10,
  specialThreshold: 16,
  cooldownMs: 250
};

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function applyDeadzone(value: number, deadzone: number): number {
  return Math.abs(value) < deadzone ? 0 : value;
}

export function createInitialTiltState(): TiltState {
  return {
    baselineGamma: 0,
    smoothedMoveX: 0
  };
}

export function recenterTilt(state: TiltState, gamma: number): TiltState {
  return {
    ...state,
    baselineGamma: gamma
  };
}

export function updateTilt(state: TiltState, gamma: number, config: TiltConfig): TiltState {
  if (!Number.isFinite(gamma)) {
    throw new Error(`gamma must be finite, got ${gamma}.`);
  }

  if (!Number.isFinite(config.rangeDegrees) || config.rangeDegrees <= 0) {
    throw new Error(`rangeDegrees must be > 0, got ${config.rangeDegrees}.`);
  }

  if (!Number.isFinite(config.smoothingAlpha) || config.smoothingAlpha <= 0 || config.smoothingAlpha > 1) {
    throw new Error(`smoothingAlpha must be in (0, 1], got ${config.smoothingAlpha}.`);
  }

  if (!Number.isFinite(config.deadzone) || config.deadzone < 0 || config.deadzone >= 1) {
    throw new Error(`deadzone must be in [0, 1), got ${config.deadzone}.`);
  }

  const raw = clampSigned((gamma - state.baselineGamma) / config.rangeDegrees);
  const smoothed = state.smoothedMoveX + (raw - state.smoothedMoveX) * config.smoothingAlpha;

  return {
    baselineGamma: state.baselineGamma,
    smoothedMoveX: applyDeadzone(smoothed, config.deadzone)
  };
}

export function createInitialShakeState(): ShakeState {
  return {
    energy: 0,
    lastTriggerMs: -1_000_000
  };
}

export function updateShake(
  state: ShakeState,
  accelerationMagnitude: number,
  nowMs: number,
  config: ShakeConfig
): ShakeUpdate {
  if (!Number.isFinite(accelerationMagnitude) || accelerationMagnitude < 0) {
    throw new Error(`accelerationMagnitude must be >= 0, got ${accelerationMagnitude}.`);
  }

  if (!Number.isInteger(nowMs) || nowMs < 0) {
    throw new Error(`nowMs must be a non-negative integer, got ${nowMs}.`);
  }

  if (!Number.isFinite(config.energyAlpha) || config.energyAlpha <= 0 || config.energyAlpha > 1) {
    throw new Error(`energyAlpha must be in (0, 1], got ${config.energyAlpha}.`);
  }

  if (!Number.isFinite(config.fireThreshold) || config.fireThreshold <= 0) {
    throw new Error(`fireThreshold must be > 0, got ${config.fireThreshold}.`);
  }

  if (!Number.isFinite(config.specialThreshold) || config.specialThreshold <= config.fireThreshold) {
    throw new Error(
      `specialThreshold must be greater than fireThreshold, got ${config.specialThreshold}.`
    );
  }

  if (!Number.isInteger(config.cooldownMs) || config.cooldownMs <= 0) {
    throw new Error(`cooldownMs must be a positive integer, got ${config.cooldownMs}.`);
  }

  const nextEnergy = state.energy + (accelerationMagnitude - state.energy) * config.energyAlpha;
  const canTrigger = nowMs - state.lastTriggerMs >= config.cooldownMs;

  if (!canTrigger) {
    return {
      state: {
        energy: nextEnergy,
        lastTriggerMs: state.lastTriggerMs
      },
      fire: false,
      special: false
    };
  }

  if (nextEnergy >= config.specialThreshold) {
    return {
      state: {
        energy: nextEnergy,
        lastTriggerMs: nowMs
      },
      fire: true,
      special: true
    };
  }

  if (nextEnergy >= config.fireThreshold) {
    return {
      state: {
        energy: nextEnergy,
        lastTriggerMs: nowMs
      },
      fire: true,
      special: false
    };
  }

  return {
    state: {
      energy: nextEnergy,
      lastTriggerMs: state.lastTriggerMs
    },
    fire: false,
    special: false
  };
}
