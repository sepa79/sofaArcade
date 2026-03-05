export type SignalRole = 'host' | 'phone';

export interface SignalSession {
  readonly sessionId: string;
  readonly expiresInMs: number;
}

export interface SignalDescription {
  readonly type: 'offer' | 'answer';
  readonly sdp: string;
}

export interface SignalIceCandidate {
  readonly candidate: string;
  readonly sdpMid: string | null;
  readonly sdpMLineIndex: number | null;
  readonly usernameFragment: string | null;
}

export interface SignalCandidateBatch {
  readonly candidates: ReadonlyArray<SignalIceCandidateWithSeq>;
  readonly nextAfter: number;
}

export interface SignalIceCandidateWithSeq extends SignalIceCandidate {
  readonly seq: number;
}

export interface SignalClient {
  createSession(): Promise<SignalSession>;
  setOffer(sessionId: string, offer: SignalDescription): Promise<void>;
  getOffer(sessionId: string): Promise<SignalDescription | null>;
  setAnswer(sessionId: string, answer: SignalDescription): Promise<void>;
  getAnswer(sessionId: string): Promise<SignalDescription | null>;
  pushCandidate(sessionId: string, role: SignalRole, candidate: SignalIceCandidate): Promise<number>;
  listCandidates(sessionId: string, forRole: SignalRole, after: number): Promise<SignalCandidateBatch>;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function requireInt(value: unknown, label: string): number {
  const parsed = requireNumber(value, label);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }

  return parsed;
}

function requireNullableString(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string or null.`);
  }

  return value;
}

function requireNullableInt(value: unknown, label: string): number | null {
  if (value === null) {
    return null;
  }

  return requireInt(value, label);
}

function parseSession(payload: unknown): SignalSession {
  const body = requireObject(payload, 'session payload');
  return {
    sessionId: requireString(body.sessionId, 'sessionId'),
    expiresInMs: requireInt(body.expiresInMs, 'expiresInMs')
  };
}

function parseDescription(payload: unknown, expectedType: SignalDescription['type']): SignalDescription {
  const body = requireObject(payload, 'description payload');
  const type = requireString(body.type, 'type');
  if (type !== expectedType) {
    throw new Error(`type must be "${expectedType}", got "${type}".`);
  }

  return {
    type: expectedType,
    sdp: requireString(body.sdp, 'sdp')
  };
}

function parseCandidate(payload: unknown): SignalIceCandidateWithSeq {
  const body = requireObject(payload, 'candidate payload');
  return {
    seq: requireInt(body.seq, 'candidate.seq'),
    candidate: requireString(body.candidate, 'candidate.candidate'),
    sdpMid: requireNullableString(body.sdpMid, 'candidate.sdpMid'),
    sdpMLineIndex: requireNullableInt(body.sdpMLineIndex, 'candidate.sdpMLineIndex'),
    usernameFragment: requireNullableString(body.usernameFragment, 'candidate.usernameFragment')
  };
}

function parseCandidateBatch(payload: unknown): SignalCandidateBatch {
  const body = requireObject(payload, 'candidate batch payload');
  const rawCandidates = body.candidates;
  if (!Array.isArray(rawCandidates)) {
    throw new Error('candidates must be an array.');
  }

  return {
    candidates: rawCandidates.map((item) => parseCandidate(item)),
    nextAfter: requireInt(body.nextAfter, 'nextAfter')
  };
}

function ensureOk(response: Response): void {
  if (response.ok) {
    return;
  }

  throw new Error(`Signal server request failed: HTTP ${response.status}.`);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  ensureOk(response);
  return (await response.json()) as unknown;
}

function requireBaseUrl(raw: string): URL {
  if (raw.trim().length === 0) {
    throw new Error('Signal HTTP URL is required.');
  }

  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Signal HTTP URL must be http/https, got "${parsed.protocol}".`);
  }

  return parsed;
}

export function createSignalClient(rawBaseUrl: string): SignalClient {
  const baseUrl = requireBaseUrl(rawBaseUrl);

  function toSessionPath(sessionId: string, suffix: string): URL {
    return new URL(`/session/${sessionId}/${suffix}`, baseUrl);
  }

  return {
    async createSession(): Promise<SignalSession> {
      const response = await fetch(new URL('/session', baseUrl), { method: 'POST' });
      const payload = await parseJsonResponse(response);
      return parseSession(payload);
    },

    async setOffer(sessionId: string, offer: SignalDescription): Promise<void> {
      const response = await fetch(toSessionPath(sessionId, 'offer'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(offer)
      });

      ensureOk(response);
    },

    async getOffer(sessionId: string): Promise<SignalDescription | null> {
      const response = await fetch(toSessionPath(sessionId, 'offer'));
      if (response.status === 204) {
        return null;
      }

      const payload = await parseJsonResponse(response);
      return parseDescription(payload, 'offer');
    },

    async setAnswer(sessionId: string, answer: SignalDescription): Promise<void> {
      const response = await fetch(toSessionPath(sessionId, 'answer'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(answer)
      });

      ensureOk(response);
    },

    async getAnswer(sessionId: string): Promise<SignalDescription | null> {
      const response = await fetch(toSessionPath(sessionId, 'answer'));
      if (response.status === 204) {
        return null;
      }

      const payload = await parseJsonResponse(response);
      return parseDescription(payload, 'answer');
    },

    async pushCandidate(sessionId: string, role: SignalRole, candidate: SignalIceCandidate): Promise<number> {
      const response = await fetch(toSessionPath(sessionId, 'candidate'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, candidate })
      });

      const payload = await parseJsonResponse(response);
      const body = requireObject(payload, 'candidate push response');
      return requireInt(body.seq, 'seq');
    },

    async listCandidates(sessionId: string, forRole: SignalRole, after: number): Promise<SignalCandidateBatch> {
      if (!Number.isInteger(after) || after < 0) {
        throw new Error(`after must be a non-negative integer, got ${after}.`);
      }

      const url = toSessionPath(sessionId, 'candidates');
      url.searchParams.set('for', forRole);
      url.searchParams.set('after', String(after));
      const response = await fetch(url);
      const payload = await parseJsonResponse(response);
      return parseCandidateBatch(payload);
    }
  };
}
