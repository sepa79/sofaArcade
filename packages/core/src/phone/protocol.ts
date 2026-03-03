export type PhoneRelayRole = 'host' | 'phone';

export interface PhoneRelayJoinMessage {
  readonly type: 'join';
  readonly role: PhoneRelayRole;
  readonly sessionId: string;
}

export interface PhoneRelayInputPayload {
  readonly moveX: number;
  readonly fire: 0 | 1;
  readonly start: 0 | 1;
  readonly recenter: 0 | 1;
  readonly special: 0 | 1;
}

export interface PhoneRelayInputMessage {
  readonly type: 'input';
  readonly seq: number;
  readonly t: number;
  readonly axes: {
    readonly moveX: number;
  };
  readonly btn: {
    readonly fire: 0 | 1;
    readonly start: 0 | 1;
    readonly recenter: 0 | 1;
    readonly special: 0 | 1;
  };
}

export type PhoneRelayStatusKind =
  | 'waiting'
  | 'phone_connected'
  | 'phone_lost'
  | 'host_connected'
  | 'host_lost';

export interface PhoneRelayStatusMessage {
  readonly type: 'status';
  readonly status: PhoneRelayStatusKind;
  readonly sessionId: string;
}

export interface PhoneRelayAckMessage {
  readonly type: 'ack';
  readonly seq: number;
  readonly t: number;
}

export interface PhoneRelayErrorMessage {
  readonly type: 'error';
  readonly message: string;
}

export type PhoneRelayClientMessage = PhoneRelayJoinMessage | PhoneRelayInputMessage | PhoneRelayStatusMessage | PhoneRelayAckMessage;

export type PhoneRelayServerMessage = PhoneRelayInputMessage | PhoneRelayStatusMessage | PhoneRelayAckMessage | PhoneRelayErrorMessage;

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
  const numberValue = requireNumber(value, label);
  if (!Number.isInteger(numberValue)) {
    throw new Error(`${label} must be an integer.`);
  }

  return numberValue;
}

function requireBinary(value: unknown, label: string): 0 | 1 {
  const integer = requireInt(value, label);
  if (integer !== 0 && integer !== 1) {
    throw new Error(`${label} must be 0 or 1.`);
  }

  return integer;
}

function requireRole(value: unknown): PhoneRelayRole {
  const role = requireString(value, 'role');
  if (role !== 'host' && role !== 'phone') {
    throw new Error(`role must be "host" or "phone", got "${role}".`);
  }

  return role;
}

function parseJoinMessage(raw: Record<string, unknown>): PhoneRelayJoinMessage {
  return {
    type: 'join',
    role: requireRole(raw.role),
    sessionId: requireString(raw.sessionId, 'sessionId')
  };
}

function parseInputMessage(raw: Record<string, unknown>): PhoneRelayInputMessage {
  const axes = requireObject(raw.axes, 'axes');
  const btn = requireObject(raw.btn, 'btn');

  return {
    type: 'input',
    seq: requireInt(raw.seq, 'seq'),
    t: requireInt(raw.t, 't'),
    axes: {
      moveX: requireNumber(axes.moveX, 'axes.moveX')
    },
    btn: {
      fire: requireBinary(btn.fire, 'btn.fire'),
      start: requireBinary(btn.start, 'btn.start'),
      recenter: requireBinary(btn.recenter, 'btn.recenter'),
      special: requireBinary(btn.special, 'btn.special')
    }
  };
}

function parseStatusMessage(raw: Record<string, unknown>): PhoneRelayStatusMessage {
  const status = requireString(raw.status, 'status');
  const allowed: ReadonlyArray<PhoneRelayStatusKind> = [
    'waiting',
    'phone_connected',
    'phone_lost',
    'host_connected',
    'host_lost'
  ];

  if (!allowed.includes(status as PhoneRelayStatusKind)) {
    throw new Error(`status is invalid: "${status}".`);
  }

  return {
    type: 'status',
    status: status as PhoneRelayStatusKind,
    sessionId: requireString(raw.sessionId, 'sessionId')
  };
}

function parseAckMessage(raw: Record<string, unknown>): PhoneRelayAckMessage {
  return {
    type: 'ack',
    seq: requireInt(raw.seq, 'seq'),
    t: requireInt(raw.t, 't')
  };
}

function parseErrorMessage(raw: Record<string, unknown>): PhoneRelayErrorMessage {
  return {
    type: 'error',
    message: requireString(raw.message, 'message')
  };
}

export function parsePhoneRelayClientMessage(raw: unknown): PhoneRelayClientMessage {
  const objectValue = requireObject(raw, 'message');
  const type = requireString(objectValue.type, 'type');

  if (type === 'join') {
    return parseJoinMessage(objectValue);
  }

  if (type === 'input') {
    return parseInputMessage(objectValue);
  }

  if (type === 'status') {
    return parseStatusMessage(objectValue);
  }

  if (type === 'ack') {
    return parseAckMessage(objectValue);
  }

  throw new Error(`Unsupported message type: "${type}".`);
}

export function parsePhoneRelayInputMessage(raw: unknown): PhoneRelayInputMessage {
  const message = parsePhoneRelayClientMessage(raw);
  if (message.type !== 'input') {
    throw new Error(`Expected input message, got "${message.type}".`);
  }

  return message;
}

export function parsePhoneRelayServerMessage(raw: unknown): PhoneRelayServerMessage {
  const objectValue = requireObject(raw, 'message');
  const type = requireString(objectValue.type, 'type');

  if (type === 'input') {
    return parseInputMessage(objectValue);
  }

  if (type === 'status') {
    return parseStatusMessage(objectValue);
  }

  if (type === 'ack') {
    return parseAckMessage(objectValue);
  }

  if (type === 'error') {
    return parseErrorMessage(objectValue);
  }

  throw new Error(`Unsupported server message type: "${type}".`);
}

export function createPhoneRelayInputMessage(
  seq: number,
  t: number,
  payload: PhoneRelayInputPayload
): PhoneRelayInputMessage {
  if (!Number.isInteger(seq) || seq < 0) {
    throw new Error(`seq must be a non-negative integer, got ${seq}.`);
  }

  if (!Number.isInteger(t) || t < 0) {
    throw new Error(`t must be a non-negative integer, got ${t}.`);
  }

  if (!Number.isFinite(payload.moveX) || payload.moveX < -1 || payload.moveX > 1) {
    throw new Error(`moveX must be in [-1, 1], got ${payload.moveX}.`);
  }

  return {
    type: 'input',
    seq,
    t,
    axes: {
      moveX: payload.moveX
    },
    btn: {
      fire: payload.fire,
      start: payload.start,
      recenter: payload.recenter,
      special: payload.special
    }
  };
}
