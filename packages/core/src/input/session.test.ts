import { describe, expect, it } from 'vitest';

import { createInputSessionPlan } from './session';

describe('createInputSessionPlan', () => {
  it('accepts a couch multiplayer plan with distinct local devices', () => {
    const plan = createInputSessionPlan({
      slots: [
        {
          slotId: 'p1',
          playerIndex: 0,
          profileId: 'pong-keyboard',
          binding: {
            transport: 'local',
            device: {
              kind: 'keyboard'
            }
          }
        },
        {
          slotId: 'p2',
          playerIndex: 1,
          profileId: 'pong-mouse',
          binding: {
            transport: 'local',
            device: {
              kind: 'mouse'
            }
          }
        },
        {
          slotId: 'p3',
          playerIndex: 2,
          profileId: 'pong-gamepad',
          binding: {
            transport: 'local',
            device: {
              kind: 'gamepad',
              gamepadIndex: 0
            }
          }
        }
      ]
    });

    expect(plan.slots).toHaveLength(3);
  });

  it('rejects mixing keyboard_mouse with separate keyboard slot', () => {
    expect(() =>
      createInputSessionPlan({
        slots: [
          {
            slotId: 'p1',
            playerIndex: 0,
            profileId: 'pixel-shared-kbm',
            binding: {
              transport: 'local',
              device: {
                kind: 'keyboard_mouse'
              }
            }
          },
          {
            slotId: 'p2',
            playerIndex: 1,
            profileId: 'pixel-keyboard',
            binding: {
              transport: 'local',
              device: {
                kind: 'keyboard'
              }
            }
          }
        ]
      })
    ).toThrowError('Input session plan cannot mix keyboard with keyboard_mouse slot.');
  });

  it('rejects mixing shared_local with any other slot', () => {
    expect(() =>
      createInputSessionPlan({
        slots: [
          {
            slotId: 'p1',
            playerIndex: 0,
            profileId: 'pixel-shared',
            binding: {
              transport: 'local',
              device: {
                kind: 'shared_local'
              }
            }
          },
          {
            slotId: 'p2',
            playerIndex: 1,
            profileId: 'pong-gamepad',
            binding: {
              transport: 'local',
              device: {
                kind: 'gamepad',
                gamepadIndex: 0
              }
            }
          }
        ]
      })
    ).toThrowError('Input session plan cannot mix shared_local binding with any other slot.');
  });

  it('rejects duplicate gamepad assignments', () => {
    expect(() =>
      createInputSessionPlan({
        slots: [
          {
            slotId: 'p1',
            playerIndex: 0,
            profileId: 'pong-gamepad-a',
            binding: {
              transport: 'local',
              device: {
                kind: 'gamepad',
                gamepadIndex: 0
              }
            }
          },
          {
            slotId: 'p2',
            playerIndex: 1,
            profileId: 'pong-gamepad-b',
            binding: {
              transport: 'local',
              device: {
                kind: 'gamepad',
                gamepadIndex: 0
              }
            }
          }
        ]
      })
    ).toThrowError('Input session plan has duplicate gamepadIndex: 0.');
  });

  it('rejects duplicate phone link assignments', () => {
    expect(() =>
      createInputSessionPlan({
        slots: [
          {
            slotId: 'p1',
            playerIndex: 0,
            profileId: 'pixel-phone-a',
            binding: {
              transport: 'phone_link',
              phoneControllerId: 'phone-1'
            }
          },
          {
            slotId: 'p2',
            playerIndex: 1,
            profileId: 'pixel-phone-b',
            binding: {
              transport: 'phone_link',
              phoneControllerId: 'phone-1'
            }
          }
        ]
      })
    ).toThrowError('Input session plan has duplicate phoneControllerId: "phone-1".');
  });
});
