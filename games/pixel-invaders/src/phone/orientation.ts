export interface DeviceOrientationSample {
  readonly gamma: number | null;
  readonly beta: number | null;
}

export interface ScreenOrientationLike {
  readonly angle: number;
}

export interface WindowOrientationLike {
  readonly screen: {
    readonly orientation?: ScreenOrientationLike;
  };
  readonly orientation?: unknown;
}

export function normalizeOrientationAngle(rawAngle: number): 0 | 90 | 180 | 270 {
  if (!Number.isInteger(rawAngle)) {
    throw new Error(`Orientation angle must be an integer, got ${rawAngle}.`);
  }

  const normalized = ((rawAngle % 360) + 360) % 360;
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }

  throw new Error(`Unsupported orientation angle: ${rawAngle}.`);
}

export function readOrientationAngle(browserWindow: WindowOrientationLike): 0 | 90 | 180 | 270 {
  const screenAngle = browserWindow.screen.orientation?.angle;
  if (Number.isInteger(screenAngle)) {
    return normalizeOrientationAngle(screenAngle as number);
  }

  const legacyAngle = browserWindow.orientation;
  if (Number.isInteger(legacyAngle)) {
    return normalizeOrientationAngle(legacyAngle as number);
  }

  throw new Error('Browser orientation angle API is unavailable.');
}

export function resolveMoveGamma(sample: DeviceOrientationSample, angle: 0 | 90 | 180 | 270): number {
  if (sample.gamma === null) {
    throw new Error('DeviceOrientationEvent gamma is null.');
  }

  if (sample.beta === null) {
    throw new Error('DeviceOrientationEvent beta is null.');
  }

  if (angle === 90) {
    return sample.beta;
  }

  if (angle === 270) {
    return -sample.beta;
  }

  if (angle === 180) {
    return -sample.gamma;
  }

  return sample.gamma;
}
