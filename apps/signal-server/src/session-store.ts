export type SignalRole = 'host' | 'phone';

export interface SessionRecord {
  readonly sessionId: string;
  readonly lastActivityMs: number;
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

export interface SequencedIceCandidate extends SignalIceCandidate {
  readonly seq: number;
}

export class SessionNotFoundError extends Error {}
export class SessionExpiredError extends Error {}
export class SessionConflictError extends Error {}

export interface SessionStore {
  createSession(nowMs: number): SessionRecord;
  requireSession(sessionId: string, nowMs: number): SessionRecord;
  touch(sessionId: string, nowMs: number): void;
  pruneExpired(nowMs: number): ReadonlyArray<string>;
  setOffer(sessionId: string, offer: SignalDescription, nowMs: number): void;
  getOffer(sessionId: string, nowMs: number): SignalDescription | null;
  setAnswer(sessionId: string, answer: SignalDescription, nowMs: number): void;
  getAnswer(sessionId: string, nowMs: number): SignalDescription | null;
  pushCandidate(sessionId: string, role: SignalRole, candidate: SignalIceCandidate, nowMs: number): number;
  listCandidates(sessionId: string, forRole: SignalRole, afterSeq: number, nowMs: number): ReadonlyArray<SequencedIceCandidate>;
}

interface MutableSessionRecord {
  sessionId: string;
  lastActivityMs: number;
  offer: SignalDescription | null;
  answer: SignalDescription | null;
  hostCandidates: SequencedIceCandidate[];
  phoneCandidates: SequencedIceCandidate[];
  hostCandidateSeq: number;
  phoneCandidateSeq: number;
}

function requireNowMs(nowMs: number): void {
  if (!Number.isInteger(nowMs) || nowMs < 0) {
    throw new Error(`nowMs must be a non-negative integer, got ${nowMs}.`);
  }
}

function requireAfterSeq(afterSeq: number): void {
  if (!Number.isInteger(afterSeq) || afterSeq < 0) {
    throw new Error(`afterSeq must be a non-negative integer, got ${afterSeq}.`);
  }
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

function copySessionRecord(record: MutableSessionRecord): SessionRecord {
  return {
    sessionId: record.sessionId,
    lastActivityMs: record.lastActivityMs
  };
}

export function createSessionStore(
  ttlMs: number,
  randomValue: () => number = Math.random
): SessionStore {
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error(`ttlMs must be a positive integer, got ${ttlMs}.`);
  }

  const sessions = new Map<string, MutableSessionRecord>();

  function requireMutableSession(sessionId: string, nowMs: number): MutableSessionRecord {
    requireNowMs(nowMs);

    const record = sessions.get(sessionId);
    if (record === undefined) {
      throw new SessionNotFoundError(`Session not found: "${sessionId}".`);
    }

    if (nowMs - record.lastActivityMs > ttlMs) {
      sessions.delete(sessionId);
      throw new SessionExpiredError(`Session expired: "${sessionId}".`);
    }

    return record;
  }

  return {
    createSession(nowMs: number): SessionRecord {
      requireNowMs(nowMs);

      const sessionId = generateSessionId(new Set<string>(sessions.keys()), randomValue);
      const record: MutableSessionRecord = {
        sessionId,
        lastActivityMs: nowMs,
        offer: null,
        answer: null,
        hostCandidates: [],
        phoneCandidates: [],
        hostCandidateSeq: 0,
        phoneCandidateSeq: 0
      };

      sessions.set(sessionId, record);
      return copySessionRecord(record);
    },

    requireSession(sessionId: string, nowMs: number): SessionRecord {
      const record = requireMutableSession(sessionId, nowMs);
      return copySessionRecord(record);
    },

    touch(sessionId: string, nowMs: number): void {
      const record = requireMutableSession(sessionId, nowMs);
      record.lastActivityMs = nowMs;
    },

    pruneExpired(nowMs: number): ReadonlyArray<string> {
      requireNowMs(nowMs);

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
    },

    setOffer(sessionId: string, offer: SignalDescription, nowMs: number): void {
      const record = requireMutableSession(sessionId, nowMs);
      if (record.offer !== null) {
        throw new SessionConflictError(`Offer already set for session "${sessionId}".`);
      }

      record.offer = offer;
      record.lastActivityMs = nowMs;
    },

    getOffer(sessionId: string, nowMs: number): SignalDescription | null {
      const record = requireMutableSession(sessionId, nowMs);
      record.lastActivityMs = nowMs;
      return record.offer;
    },

    setAnswer(sessionId: string, answer: SignalDescription, nowMs: number): void {
      const record = requireMutableSession(sessionId, nowMs);
      if (record.answer !== null) {
        throw new SessionConflictError(`Answer already set for session "${sessionId}".`);
      }

      record.answer = answer;
      record.lastActivityMs = nowMs;
    },

    getAnswer(sessionId: string, nowMs: number): SignalDescription | null {
      const record = requireMutableSession(sessionId, nowMs);
      record.lastActivityMs = nowMs;
      return record.answer;
    },

    pushCandidate(sessionId: string, role: SignalRole, candidate: SignalIceCandidate, nowMs: number): number {
      const record = requireMutableSession(sessionId, nowMs);

      if (role === 'host') {
        record.hostCandidateSeq += 1;
        record.hostCandidates.push({
          seq: record.hostCandidateSeq,
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment
        });
        record.lastActivityMs = nowMs;
        return record.hostCandidateSeq;
      }

      record.phoneCandidateSeq += 1;
      record.phoneCandidates.push({
        seq: record.phoneCandidateSeq,
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment
      });
      record.lastActivityMs = nowMs;
      return record.phoneCandidateSeq;
    },

    listCandidates(
      sessionId: string,
      forRole: SignalRole,
      afterSeq: number,
      nowMs: number
    ): ReadonlyArray<SequencedIceCandidate> {
      requireAfterSeq(afterSeq);

      const record = requireMutableSession(sessionId, nowMs);
      record.lastActivityMs = nowMs;

      const source = forRole === 'host' ? record.phoneCandidates : record.hostCandidates;
      return source.filter((item) => item.seq > afterSeq);
    }
  };
}
