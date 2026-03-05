import { describe, expect, it } from 'vitest';

import {
  SessionConflictError,
  SessionExpiredError,
  createSessionStore
} from './session-store';

describe('session store', () => {
  it('creates unique 4-char session ids', () => {
    const store = createSessionStore(1000, () => 0.1);

    const first = store.createSession(1);
    expect(first.sessionId).toHaveLength(4);

    const secondStore = createSessionStore(1000, () => 0.2);
    const second = secondStore.createSession(1);
    expect(second.sessionId).toHaveLength(4);
  });

  it('expires sessions after ttl', () => {
    const store = createSessionStore(10);
    const session = store.createSession(0);

    expect(() => store.requireSession(session.sessionId, 11)).toThrowError(SessionExpiredError);
  });

  it('touch extends session life', () => {
    const store = createSessionStore(10);
    const session = store.createSession(0);

    store.touch(session.sessionId, 8);
    const fetched = store.requireSession(session.sessionId, 15);

    expect(fetched.sessionId).toBe(session.sessionId);
  });

  it('stores offer/answer and rejects duplicates', () => {
    const store = createSessionStore(1000);
    const session = store.createSession(0);

    store.setOffer(session.sessionId, { type: 'offer', sdp: 'offer-sdp' }, 1);
    store.setAnswer(session.sessionId, { type: 'answer', sdp: 'answer-sdp' }, 2);

    expect(store.getOffer(session.sessionId, 3)).toEqual({ type: 'offer', sdp: 'offer-sdp' });
    expect(store.getAnswer(session.sessionId, 3)).toEqual({ type: 'answer', sdp: 'answer-sdp' });

    expect(() => store.setOffer(session.sessionId, { type: 'offer', sdp: 'again' }, 4)).toThrowError(
      SessionConflictError
    );
    expect(() => store.setAnswer(session.sessionId, { type: 'answer', sdp: 'again' }, 4)).toThrowError(
      SessionConflictError
    );
  });

  it('returns only peer candidates after sequence', () => {
    const store = createSessionStore(1000);
    const session = store.createSession(0);

    store.pushCandidate(
      session.sessionId,
      'host',
      {
        candidate: 'host-c1',
        sdpMid: '0',
        sdpMLineIndex: 0,
        usernameFragment: null
      },
      1
    );

    store.pushCandidate(
      session.sessionId,
      'phone',
      {
        candidate: 'phone-c1',
        sdpMid: '0',
        sdpMLineIndex: 0,
        usernameFragment: null
      },
      2
    );

    const forHost = store.listCandidates(session.sessionId, 'host', 0, 3);
    const forPhone = store.listCandidates(session.sessionId, 'phone', 0, 3);

    expect(forHost).toHaveLength(1);
    expect(forHost[0]?.candidate).toBe('phone-c1');
    expect(forPhone).toHaveLength(1);
    expect(forPhone[0]?.candidate).toBe('host-c1');

    const emptyForHost = store.listCandidates(session.sessionId, 'host', forHost[0]?.seq ?? 0, 4);
    expect(emptyForHost).toHaveLength(0);
  });
});
