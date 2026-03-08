export interface SignalConfig {
  readonly port: number;
  readonly sessionTtlMs: number;
  readonly httpsPort: number | null;
  readonly httpsPfxPath: string | null;
  readonly httpsPfxPassword: string | null;
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

function parseOptionalIntEnv(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }

  return parsed;
}

function parseOptionalStringEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function loadSignalConfig(): SignalConfig {
  const httpsPort = parseOptionalIntEnv('SIGNAL_HTTPS_PORT');
  const httpsPfxPath = parseOptionalStringEnv('SIGNAL_HTTPS_PFX_PATH');
  const httpsPfxPassword = parseOptionalStringEnv('SIGNAL_HTTPS_PFX_PASSWORD');

  if (httpsPort !== null && (httpsPfxPath === null || httpsPfxPassword === null)) {
    throw new Error('SIGNAL_HTTPS_PFX_PATH and SIGNAL_HTTPS_PFX_PASSWORD are required when SIGNAL_HTTPS_PORT is set.');
  }

  return {
    port: parseIntEnv('SIGNAL_PORT'),
    sessionTtlMs: parseIntEnv('SIGNAL_SESSION_TTL_MS'),
    httpsPort,
    httpsPfxPath,
    httpsPfxPassword
  };
}
