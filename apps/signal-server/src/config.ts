export interface SignalConfig {
  readonly port: number;
  readonly sessionTtlMs: number;
}

function parseIntEnv(name: string): number {
  const raw = process.env[name];
  if (raw === undefined) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }

  return parsed;
}

export function loadSignalConfig(): SignalConfig {
  return {
    port: parseIntEnv('SIGNAL_PORT'),
    sessionTtlMs: parseIntEnv('SIGNAL_SESSION_TTL_MS')
  };
}
