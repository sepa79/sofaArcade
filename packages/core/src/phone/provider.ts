import type { PhoneRelayInputMessage } from './protocol';

export interface PhoneControllerProviderConfig {
  readonly deadzone: number;
  readonly smoothingAlpha: number;
}

export interface PhoneControllerFrame {
  readonly connected: boolean;
  readonly moveX: number;
  readonly fire: boolean;
  readonly start: boolean;
  readonly recenter: boolean;
  readonly special: boolean;
  readonly seq: number;
  readonly t: number;
}

export interface PhoneControllerProvider {
  setConnected(connected: boolean): void;
  ingest(message: PhoneRelayInputMessage): void;
  nextFrame(): PhoneControllerFrame;
}

const DEFAULT_CONFIG: PhoneControllerProviderConfig = {
  deadzone: 0.05,
  smoothingAlpha: 0.25
};

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function applyDeadzone(value: number, deadzone: number): number {
  return Math.abs(value) < deadzone ? 0 : value;
}

export function createPhoneControllerProvider(
  config: Partial<PhoneControllerProviderConfig> = {}
): PhoneControllerProvider {
  const deadzone = config.deadzone ?? DEFAULT_CONFIG.deadzone;
  const smoothingAlpha = config.smoothingAlpha ?? DEFAULT_CONFIG.smoothingAlpha;

  if (!Number.isFinite(deadzone) || deadzone < 0 || deadzone >= 1) {
    throw new Error(`deadzone must be in [0, 1), got ${deadzone}.`);
  }

  if (!Number.isFinite(smoothingAlpha) || smoothingAlpha <= 0 || smoothingAlpha > 1) {
    throw new Error(`smoothingAlpha must be in (0, 1], got ${smoothingAlpha}.`);
  }

  let connected = false;
  let moveX = 0;
  let start = false;
  let firePulse = false;
  let recenterPulse = false;
  let specialPulse = false;
  let seq = 0;
  let t = 0;

  return {
    setConnected(nextConnected: boolean): void {
      connected = nextConnected;
      if (!connected) {
        moveX = 0;
        start = false;
        firePulse = false;
        recenterPulse = false;
        specialPulse = false;
      }
    },

    ingest(message: PhoneRelayInputMessage): void {
      const clamped = clampSigned(message.axes.moveX);
      const smoothed = moveX + (clamped - moveX) * smoothingAlpha;
      moveX = applyDeadzone(smoothed, deadzone);

      start = message.btn.start === 1;
      firePulse = firePulse || message.btn.fire === 1;
      recenterPulse = recenterPulse || message.btn.recenter === 1;
      specialPulse = specialPulse || message.btn.special === 1;

      seq = message.seq;
      t = message.t;
    },

    nextFrame(): PhoneControllerFrame {
      const frame: PhoneControllerFrame = {
        connected,
        moveX,
        fire: firePulse,
        start,
        recenter: recenterPulse,
        special: specialPulse,
        seq,
        t
      };

      firePulse = false;
      recenterPulse = false;
      specialPulse = false;

      return frame;
    }
  };
}
