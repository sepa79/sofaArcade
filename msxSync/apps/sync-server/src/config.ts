export interface SyncServerConfig {
  readonly port: number;
  readonly sampleRateHz: number;
  readonly curveFps: number;
  readonly beatsPerBar: number;
}

function requireIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be integer, got "${raw}".`);
  }

  return parsed;
}

export function loadConfig(): SyncServerConfig {
  const port = requireIntEnv('SYNC_SERVER_PORT', 8788);
  if (port <= 0 || port > 65535) {
    throw new Error(`SYNC_SERVER_PORT is out of range: ${port}.`);
  }

  const sampleRateHz = requireIntEnv('SYNC_SAMPLE_RATE_HZ', 44_100);
  if (sampleRateHz < 8_000 || sampleRateHz > 96_000) {
    throw new Error(`SYNC_SAMPLE_RATE_HZ is out of range: ${sampleRateHz}.`);
  }

  const curveFps = requireIntEnv('SYNC_CURVE_FPS', 50);
  if (curveFps < 10 || curveFps > 200) {
    throw new Error(`SYNC_CURVE_FPS is out of range: ${curveFps}.`);
  }

  const beatsPerBar = requireIntEnv('SYNC_BEATS_PER_BAR', 4);
  if (beatsPerBar <= 0 || beatsPerBar > 16) {
    throw new Error(`SYNC_BEATS_PER_BAR is out of range: ${beatsPerBar}.`);
  }

  return {
    port,
    sampleRateHz,
    curveFps,
    beatsPerBar
  };
}
