import { describe, expect, it } from 'vitest';

import { createSessionStore } from './session-store';

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

    expect(() => store.requireSession(session.sessionId, 11)).toThrowError(
      `Session expired: "${session.sessionId}".`
    );
  });

  it('touch extends session life', () => {
    const store = createSessionStore(10);
    const session = store.createSession(0);

    store.touch(session.sessionId, 8);
    const fetched = store.requireSession(session.sessionId, 15);

    expect(fetched.sessionId).toBe(session.sessionId);
  });
});
