import { describe, expect, it } from 'vitest';

import {
  PIXEL_PHONE_LINK_CONTROLLER_ID,
  createMultiplayerGameLaunchData
} from './launch-contract';

describe('createMultiplayerGameLaunchData', () => {
  it('accepts distinct couch multiplayer slots', () => {
    const data = createMultiplayerGameLaunchData({
      playerSlots: [
        {
          slotId: 'p1',
          playerIndex: 0,
          profileId: 'pixel-keyboard',
          controllerLabel: 'Keyboard',
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
          profileId: 'pixel-gamepad',
          controllerLabel: 'Gamepad 1',
          binding: {
            transport: 'local',
            device: {
              kind: 'gamepad',
              gamepadIndex: 0
            }
          }
        }
      ],
      audioMixProfileId: 'cinema'
    });

    expect(data.playerSlots).toHaveLength(2);
  });

  it('rejects empty controller labels', () => {
    expect(() =>
      createMultiplayerGameLaunchData({
        playerSlots: [
          {
            slotId: 'p1',
            playerIndex: 0,
            profileId: 'pixel-keyboard',
            controllerLabel: '',
            binding: {
              transport: 'local',
              device: {
                kind: 'keyboard_mouse'
              }
            }
          }
        ],
        audioMixProfileId: 'cinema'
      })
    ).toThrowError('Launch player slot "p1" controllerLabel cannot be empty.');
  });
});

describe('phone link slot', () => {
  it('accepts named phone controller slots', () => {
    const data = createMultiplayerGameLaunchData({
      playerSlots: [
        {
          slotId: 'p1',
          playerIndex: 0,
          profileId: 'pixel-invaders-phone-link',
          controllerLabel: 'Phone Link',
          binding: {
            transport: 'phone_link',
            phoneControllerId: PIXEL_PHONE_LINK_CONTROLLER_ID
          }
        }
      ],
      audioMixProfileId: 'arcade'
    });

    expect(data.playerSlots[0]?.binding).toEqual({
      transport: 'phone_link',
      phoneControllerId: PIXEL_PHONE_LINK_CONTROLLER_ID
    });
  });
});
