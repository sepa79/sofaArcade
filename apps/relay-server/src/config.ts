export interface RelayConfig {
  readonly port: number;
  readonly publicWsUrl: string;
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

function parseStringEnv(name: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }

  return raw;
}

export function loadRelayConfig(): RelayConfig {
  return {
    port: parseIntEnv('RELAY_PORT'),
    publicWsUrl: parseStringEnv('RELAY_PUBLIC_WS_URL'),
    sessionTtlMs: parseIntEnv('RELAY_SESSION_TTL_MS')
  };
}
