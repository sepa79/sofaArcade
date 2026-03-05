export interface PortalConfig {
  readonly signalHttpUrl: string;
}

export function loadPortalConfig(): PortalConfig {
  const signalHttpUrlUnknown: unknown = import.meta.env['VITE_SIGNAL_HTTP_URL'];
  const signalHttpUrl =
    typeof signalHttpUrlUnknown === 'string' ? signalHttpUrlUnknown : undefined;
  if (typeof signalHttpUrl !== 'string' || signalHttpUrl.trim().length === 0) {
    throw new Error('Missing required VITE_SIGNAL_HTTP_URL for web-portal.');
  }

  return {
    signalHttpUrl
  };
}
