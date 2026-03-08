import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';

import { loadSignalConfig } from './config';
import {
  SessionConflictError,
  SessionExpiredError,
  SessionNotFoundError,
  createSessionStore,
  type SignalDescription,
  type SignalIceCandidate,
  type SignalRole
} from './session-store';

function nowMs(): number {
  return Date.now();
}

function asJson(data: unknown): string {
  return JSON.stringify(data);
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(asJson(payload));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk, 'utf8'));
      continue;
    }

    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    throw new Error('Request body chunk must be string or Uint8Array.');
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req);
  if (raw.trim().length === 0) {
    throw new Error('Request body cannot be empty.');
  }

  return JSON.parse(raw) as unknown;
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

function requireNullableString(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be string or null.`);
  }

  return value;
}

function requireNullableInteger(value: unknown, label: string): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${label} must be integer or null.`);
  }

  return value;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return value;
}

function parseRole(value: unknown): SignalRole {
  const role = requireString(value, 'role');
  if (role !== 'host' && role !== 'phone') {
    throw new Error(`role must be "host" or "phone", got "${role}".`);
  }

  return role;
}

function parseDescription(payload: unknown, expectedType: SignalDescription['type']): SignalDescription {
  const objectValue = requireObject(payload, 'body');
  const type = requireString(objectValue.type, 'type');
  if (type !== expectedType) {
    throw new Error(`type must be "${expectedType}", got "${type}".`);
  }

  return {
    type: expectedType,
    sdp: requireString(objectValue.sdp, 'sdp')
  };
}

function parseCandidate(payload: unknown): { role: SignalRole; candidate: SignalIceCandidate } {
  const objectValue = requireObject(payload, 'body');
  const candidatePayload = requireObject(objectValue.candidate, 'candidate');

  return {
    role: parseRole(objectValue.role),
    candidate: {
      candidate: requireString(candidatePayload.candidate, 'candidate.candidate'),
      sdpMid: requireNullableString(candidatePayload.sdpMid, 'candidate.sdpMid'),
      sdpMLineIndex: requireNullableInteger(candidatePayload.sdpMLineIndex, 'candidate.sdpMLineIndex'),
      usernameFragment: requireNullableString(candidatePayload.usernameFragment, 'candidate.usernameFragment')
    }
  };
}

function parseSessionAction(pathname: string): { sessionId: string; action: string } | null {
  const match = pathname.match(/^\/session\/([A-Z0-9]{4})\/(offer|answer|candidate|candidates)$/);
  if (match === null) {
    return null;
  }

  return {
    sessionId: match[1] ?? '',
    action: match[2] ?? ''
  };
}

const config = loadSignalConfig();
const sessionStore = createSessionStore(config.sessionTtlMs);

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname, searchParams } = url;

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (pathname === '/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/session' && req.method === 'POST') {
    const created = sessionStore.createSession(nowMs());
    sendJson(res, 201, {
      sessionId: created.sessionId,
      expiresInMs: config.sessionTtlMs
    });
    return;
  }

  const actionMatch = parseSessionAction(pathname);
  if (actionMatch === null) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  const { sessionId, action } = actionMatch;

  if (action === 'offer') {
    if (req.method === 'POST') {
      const body = await readJson(req);
      const offer = parseDescription(body, 'offer');
      sessionStore.setOffer(sessionId, offer, nowMs());
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const offer = sessionStore.getOffer(sessionId, nowMs());
      if (offer === null) {
        res.statusCode = 204;
        res.end();
        return;
      }

      sendJson(res, 200, offer);
      return;
    }
  }

  if (action === 'answer') {
    if (req.method === 'POST') {
      const body = await readJson(req);
      const answer = parseDescription(body, 'answer');
      sessionStore.setAnswer(sessionId, answer, nowMs());
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const answer = sessionStore.getAnswer(sessionId, nowMs());
      if (answer === null) {
        res.statusCode = 204;
        res.end();
        return;
      }

      sendJson(res, 200, answer);
      return;
    }
  }

  if (action === 'candidate') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    const body = await readJson(req);
    const parsed = parseCandidate(body);
    const seq = sessionStore.pushCandidate(sessionId, parsed.role, parsed.candidate, nowMs());
    sendJson(res, 200, { seq });
    return;
  }

  if (action === 'candidates') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    const forRole = parseRole(searchParams.get('for'));
    const after = requireNonNegativeInteger(Number(searchParams.get('after') ?? '0'), 'after');
    const candidates = sessionStore.listCandidates(sessionId, forRole, after, nowMs());
    const nextAfter = candidates.length === 0 ? after : (candidates[candidates.length - 1]?.seq ?? after);
    sendJson(res, 200, { candidates, nextAfter });
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
}

const requestListener = (req: IncomingMessage, res: ServerResponse): void => {
  void (async () => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        sendJson(res, 404, { error: error.message });
        return;
      }

      if (error instanceof SessionExpiredError) {
        sendJson(res, 410, { error: error.message });
        return;
      }

      if (error instanceof SessionConflictError) {
        sendJson(res, 409, { error: error.message });
        return;
      }

      if (error instanceof Error) {
        sendJson(res, 400, { error: error.message });
        return;
      }

      sendJson(res, 500, { error: 'Unknown server error.' });
    }
  })();
};

const server = createServer(requestListener);

setInterval(() => {
  sessionStore.pruneExpired(nowMs());
}, 5_000);

server.listen(config.port, () => {
  console.log(`signal-server listening on :${config.port}`);
});

if (config.httpsPort !== null) {
  const httpsServer = createHttpsServer(
    {
      pfx: readFileSync(config.httpsPfxPath as string),
      passphrase: config.httpsPfxPassword as string
    },
    requestListener
  );

  httpsServer.listen(config.httpsPort, () => {
    console.log(`signal-server https listening on :${config.httpsPort}`);
  });
}
