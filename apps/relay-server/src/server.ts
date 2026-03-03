import { createServer } from 'node:http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import {
  parsePhoneRelayClientMessage,
  type PhoneRelayAckMessage,
  type PhoneRelayErrorMessage,
  type PhoneRelayInputMessage,
  type PhoneRelayJoinMessage,
  type PhoneRelayStatusMessage
} from '@light80/core';

import { loadRelayConfig } from './config';
import { createSessionStore } from './session-store';

interface SessionSockets {
  host: WebSocket | null;
  phone: WebSocket | null;
}

interface SocketMeta {
  role: 'host' | 'phone';
  sessionId: string;
}

function nowMs(): number {
  return Date.now();
}

function asJson(data: unknown): string {
  return JSON.stringify(data);
}

function sendJson(socket: WebSocket, payload: unknown): void {
  socket.send(asJson(payload));
}

function setCorsHeaders(res: import('node:http').ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function rawDataToString(chunk: RawData): string {
  if (typeof chunk === 'string') {
    return chunk;
  }

  if (Buffer.isBuffer(chunk)) {
    return chunk.toString('utf8');
  }

  if (chunk instanceof ArrayBuffer) {
    return Buffer.from(chunk).toString('utf8');
  }

  if (Array.isArray(chunk)) {
    return Buffer.concat(chunk).toString('utf8');
  }

  throw new Error('Unsupported WebSocket message payload type.');
}

function createStatus(sessionId: string, status: PhoneRelayStatusMessage['status']): PhoneRelayStatusMessage {
  return {
    type: 'status',
    status,
    sessionId
  };
}

const config = loadRelayConfig();
const sessionStore = createSessionStore(config.sessionTtlMs);
const socketsBySession = new Map<string, SessionSockets>();
const socketMeta = new Map<WebSocket, SocketMeta>();

const server = createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(asJson({ ok: true }));
    return;
  }

  if (req.url === '/session' && req.method === 'POST') {
    const created = sessionStore.createSession(nowMs());
    socketsBySession.set(created.sessionId, { host: null, phone: null });

    res.statusCode = 201;
    res.setHeader('content-type', 'application/json');
    res.end(
      asJson({
        sessionId: created.sessionId,
        wsUrl: config.publicWsUrl
      })
    );
    return;
  }

  res.statusCode = 404;
  res.setHeader('content-type', 'application/json');
  res.end(asJson({ error: 'not_found' }));
});

const wsServer = new WebSocketServer({ noServer: true });

function closeWithError(socket: WebSocket, message: string): void {
  const payload: PhoneRelayErrorMessage = {
    type: 'error',
    message
  };

  sendJson(socket, payload);
  socket.close(1008, message);
}

function handleJoin(socket: WebSocket, message: PhoneRelayJoinMessage): void {
  sessionStore.requireSession(message.sessionId, nowMs());

  const sessionSockets = socketsBySession.get(message.sessionId);
  if (sessionSockets === undefined) {
    throw new Error(`Session socket state missing: "${message.sessionId}".`);
  }

  if (message.role === 'host' && sessionSockets.host !== null) {
    throw new Error(`Host already connected for session "${message.sessionId}".`);
  }

  if (message.role === 'phone' && sessionSockets.phone !== null) {
    throw new Error(`Phone already connected for session "${message.sessionId}".`);
  }

  if (message.role === 'host') {
    sessionSockets.host = socket;
    socketMeta.set(socket, { role: 'host', sessionId: message.sessionId });

    sendJson(socket, createStatus(message.sessionId, sessionSockets.phone === null ? 'waiting' : 'phone_connected'));
    if (sessionSockets.phone !== null) {
      sendJson(sessionSockets.phone, createStatus(message.sessionId, 'host_connected'));
    }

    sessionStore.touch(message.sessionId, nowMs());
    return;
  }

  sessionSockets.phone = socket;
  socketMeta.set(socket, { role: 'phone', sessionId: message.sessionId });
  if (sessionSockets.host !== null) {
    sendJson(sessionSockets.host, createStatus(message.sessionId, 'phone_connected'));
  }
  sendJson(socket, createStatus(message.sessionId, 'host_connected'));
  sessionStore.touch(message.sessionId, nowMs());
}

function handlePhoneInput(meta: SocketMeta, message: PhoneRelayInputMessage): void {
  if (meta.role !== 'phone') {
    throw new Error('Only phone role can send input messages.');
  }

  const session = socketsBySession.get(meta.sessionId);
  if (session === undefined) {
    throw new Error(`Session socket state missing: "${meta.sessionId}".`);
  }

  if (session.host !== null) {
    sendJson(session.host, message);
  }

  sessionStore.touch(meta.sessionId, nowMs());
}

function handleHostForward(meta: SocketMeta, message: PhoneRelayStatusMessage | PhoneRelayAckMessage): void {
  if (meta.role !== 'host') {
    throw new Error(`Only host role can send "${message.type}" messages.`);
  }

  const session = socketsBySession.get(meta.sessionId);
  if (session === undefined) {
    throw new Error(`Session socket state missing: "${meta.sessionId}".`);
  }

  if (session.phone !== null) {
    sendJson(session.phone, message);
  }

  sessionStore.touch(meta.sessionId, nowMs());
}

function handleSocketMessage(socket: WebSocket, raw: string): void {
  const parsedJson = JSON.parse(raw) as unknown;
  const parsed = parsePhoneRelayClientMessage(parsedJson);

  if (parsed.type === 'join') {
    if (socketMeta.has(socket)) {
      throw new Error('Socket already joined.');
    }

    handleJoin(socket, parsed);
    return;
  }

  const meta = socketMeta.get(socket);
  if (meta === undefined) {
    throw new Error('Socket must send join before other messages.');
  }

  if (parsed.type === 'input') {
    handlePhoneInput(meta, parsed);
    return;
  }

  handleHostForward(meta, parsed);
}

function cleanupSocket(socket: WebSocket): void {
  const meta = socketMeta.get(socket);
  if (meta === undefined) {
    return;
  }

  const session = socketsBySession.get(meta.sessionId);
  if (session === undefined) {
    socketMeta.delete(socket);
    return;
  }

  if (meta.role === 'host') {
    session.host = null;
    if (session.phone !== null) {
      sendJson(session.phone, createStatus(meta.sessionId, 'host_lost'));
    }
  } else {
    session.phone = null;
    if (session.host !== null) {
      sendJson(session.host, createStatus(meta.sessionId, 'phone_lost'));
    }
  }

  sessionStore.touch(meta.sessionId, nowMs());
  socketMeta.delete(socket);
}

wsServer.on('connection', (socket, request) => {
  if (request.url !== '/ws') {
    closeWithError(socket, `Invalid WebSocket path: "${request.url}".`);
    return;
  }

  socket.on('message', (chunk) => {
    try {
      handleSocketMessage(socket, rawDataToString(chunk));
    } catch (error) {
      if (error instanceof Error) {
        closeWithError(socket, error.message);
        return;
      }

      closeWithError(socket, 'Unknown relay message error.');
    }
  });

  socket.on('close', () => {
    cleanupSocket(socket);
  });
});

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }

  wsServer.handleUpgrade(req, socket, head, (client) => {
    wsServer.emit('connection', client, req);
  });
});

setInterval(() => {
  const expired = sessionStore.pruneExpired(nowMs());
  for (const sessionId of expired) {
    const sockets = socketsBySession.get(sessionId);
    if (sockets !== undefined) {
      sockets.host?.close(4000, 'Session expired.');
      sockets.phone?.close(4000, 'Session expired.');
    }

    socketsBySession.delete(sessionId);
  }
}, 5_000);

server.listen(config.port, () => {
  console.log(`relay-server listening on :${config.port}`);
});
