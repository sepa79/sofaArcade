export interface SessionRecord {
  readonly sessionId: string;
  readonly lastActivityMs: number;
}

export interface SessionStore {
  createSession(nowMs: number): SessionRecord;
  requireSession(sessionId: string, nowMs: number): SessionRecord;
  touch(sessionId: string, nowMs: number): void;
  pruneExpired(nowMs: number): ReadonlyArray<string>;
}

interface MutableSessionRecord {
  sessionId: string;
  lastActivityMs: number;
}

function generateSessionId(existingIds: ReadonlySet<string>, randomValue: () => number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let attempt = 0; attempt < 1024; attempt += 1) {
    let id = '';
    for (let index = 0; index < 4; index += 1) {
      const charIndex = Math.floor(randomValue() * alphabet.length);
      id += alphabet[charIndex];
    }

    if (!existingIds.has(id)) {
      return id;
    }
  }

  throw new Error('Unable to generate a unique session id after 1024 attempts.');
}

export function createSessionStore(
  ttlMs: number,
  randomValue: () => number = Math.random
): SessionStore {
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error(`ttlMs must be a positive integer, got ${ttlMs}.`);
  }

  const sessions = new Map<string, MutableSessionRecord>();

  return {
    createSession(nowMs: number): SessionRecord {
      if (!Number.isInteger(nowMs) || nowMs < 0) {
        throw new Error(`nowMs must be a non-negative integer, got ${nowMs}.`);
      }

      const sessionId = generateSessionId(new Set<string>(sessions.keys()), randomValue);
      const record: MutableSessionRecord = {
        sessionId,
        lastActivityMs: nowMs
      };

      sessions.set(sessionId, record);
      return {
        sessionId,
        lastActivityMs: record.lastActivityMs
      };
    },

    requireSession(sessionId: string, nowMs: number): SessionRecord {
      const record = sessions.get(sessionId);
      if (record === undefined) {
        throw new Error(`Session not found: "${sessionId}".`);
      }

      if (nowMs - record.lastActivityMs > ttlMs) {
        sessions.delete(sessionId);
        throw new Error(`Session expired: "${sessionId}".`);
      }

      return {
        sessionId: record.sessionId,
        lastActivityMs: record.lastActivityMs
      };
    },

    touch(sessionId: string, nowMs: number): void {
      const record = sessions.get(sessionId);
      if (record === undefined) {
        throw new Error(`Session not found: "${sessionId}".`);
      }

      record.lastActivityMs = nowMs;
    },

    pruneExpired(nowMs: number): ReadonlyArray<string> {
      const expired: string[] = [];
      for (const record of sessions.values()) {
        if (nowMs - record.lastActivityMs > ttlMs) {
          expired.push(record.sessionId);
        }
      }

      for (const sessionId of expired) {
        sessions.delete(sessionId);
      }

      return expired;
    }
  };
}
