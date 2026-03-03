import { describe, expect, it } from 'vitest';

import {
  createPhoneRelayInputMessage,
  parsePhoneRelayClientMessage,
  parsePhoneRelayInputMessage,
  parsePhoneRelayServerMessage
} from './protocol';

describe('phone protocol parser', () => {
  it('parses valid join message', () => {
    const parsed = parsePhoneRelayClientMessage({
      type: 'join',
      role: 'phone',
      sessionId: 'ABCD'
    });

    if (parsed.type !== 'join') {
      throw new Error(`expected join, got ${parsed.type}`);
    }

    expect(parsed.role).toBe('phone');
  });

  it('rejects invalid button payload', () => {
    expect(() =>
      parsePhoneRelayInputMessage({
        type: 'input',
        seq: 1,
        t: 1,
        axes: { moveX: 0 },
        btn: { fire: 2, start: 0, recenter: 0, special: 0 }
      })
    ).toThrowError('btn.fire must be 0 or 1.');
  });

  it('creates input message with validated moveX', () => {
    const message = createPhoneRelayInputMessage(4, 99, {
      moveX: 0.5,
      fire: 1,
      start: 0,
      recenter: 0,
      special: 0
    });

    expect(message.type).toBe('input');
    expect(message.axes.moveX).toBe(0.5);
  });

  it('parses server error message', () => {
    const parsed = parsePhoneRelayServerMessage({
      type: 'error',
      message: 'boom'
    });

    if (parsed.type !== 'error') {
      throw new Error(`expected error, got ${parsed.type}`);
    }

    expect(parsed.message).toBe('boom');
  });
});
