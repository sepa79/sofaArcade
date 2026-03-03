export interface PortalConfig {
  readonly relayHttpUrl: string;
}

export function loadPortalConfig(): PortalConfig {
  const relayHttpUrlUnknown: unknown = import.meta.env['VITE_RELAY_HTTP_URL'];
  const relayHttpUrl =
    typeof relayHttpUrlUnknown === 'string' ? relayHttpUrlUnknown : undefined;
  if (typeof relayHttpUrl !== 'string' || relayHttpUrl.trim().length === 0) {
    throw new Error('Missing required VITE_RELAY_HTTP_URL for web-portal.');
  }

  return {
    relayHttpUrl
  };
}
