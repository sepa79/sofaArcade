import { describe, expect, it } from 'vitest';

import { createPhoneRelayInputMessage } from './protocol';
import { createPhoneControllerProvider } from './provider';

describe('PhoneControllerProvider', () => {
  it('smooths and clamps moveX', () => {
    const provider = createPhoneControllerProvider({
      deadzone: 0,
      smoothingAlpha: 0.5
    });

    provider.setConnected(true);
    provider.ingest(
      createPhoneRelayInputMessage(1, 10, {
        moveX: 1,
        fire: 0,
        start: 0,
        recenter: 0,
        special: 0
      })
    );

    const frame = provider.nextFrame();
    expect(frame.moveX).toBe(0.5);
  });

  it('emits fire/recenter/special as pulses', () => {
    const provider = createPhoneControllerProvider();
    provider.setConnected(true);

    provider.ingest(
      createPhoneRelayInputMessage(2, 20, {
        moveX: 0,
        fire: 1,
        start: 1,
        recenter: 1,
        special: 1
      })
    );

    const first = provider.nextFrame();
    expect(first.fire).toBe(true);
    expect(first.recenter).toBe(true);
    expect(first.special).toBe(true);
    expect(first.start).toBe(true);

    const second = provider.nextFrame();
    expect(second.fire).toBe(false);
    expect(second.recenter).toBe(false);
    expect(second.special).toBe(false);
    expect(second.start).toBe(true);
  });

  it('resets state when disconnected', () => {
    const provider = createPhoneControllerProvider();
    provider.setConnected(true);

    provider.ingest(
      createPhoneRelayInputMessage(3, 30, {
        moveX: 0.8,
        fire: 1,
        start: 1,
        recenter: 0,
        special: 0
      })
    );

    provider.setConnected(false);
    const frame = provider.nextFrame();

    expect(frame.connected).toBe(false);
    expect(frame.moveX).toBe(0);
    expect(frame.start).toBe(false);
    expect(frame.fire).toBe(false);
  });
});
