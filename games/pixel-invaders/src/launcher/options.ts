import pixelInvadersThumbnail from '../../screenshots/start-screen-1080p.png';
import tunnelInvadersThumbnail from '../../../tunnel-invaders/screenshots/launcher-thumbnail.png';
import type { MultiplayerGameLaunchPlayerSlot } from '../launch-contract';
import { PIXEL_PHONE_LINK_CONTROLLER_ID } from '../launch-contract';

export interface GameOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly sceneKey: string;
  readonly thumbnailSrc: string;
  readonly thumbnailAlt: string;
  readonly controllerOptions: ReadonlyArray<ControllerOption>;
}

export interface LegacyControllerOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly launchMode: 'legacy_single';
  readonly controllerProfileId: string;
  readonly phoneLinkEnabled: boolean;
}

export interface MultiplayerControllerOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly launchMode: 'pixel_multiplayer';
  readonly playerSlots: ReadonlyArray<MultiplayerGameLaunchPlayerSlot>;
}

export type ControllerOption = LegacyControllerOption | MultiplayerControllerOption;

function createPixelSlot(
  slotId: string,
  playerIndex: number,
  profileId: string,
  controllerLabel: string,
  device:
    | { readonly kind: 'shared_local' }
    | { readonly kind: 'keyboard' }
    | { readonly kind: 'mouse' }
    | { readonly kind: 'gamepad'; readonly gamepadIndex: number }
): MultiplayerGameLaunchPlayerSlot {
  return {
    slotId,
    playerIndex,
    profileId,
    controllerLabel,
    binding: {
      transport: 'local',
      device
    }
  };
}

function createPixelPhoneSlot(
  slotId: string,
  playerIndex: number,
  controllerLabel: string
): MultiplayerGameLaunchPlayerSlot {
  return {
    slotId,
    playerIndex,
    profileId: 'pixel-invaders-phone-link',
    controllerLabel,
    binding: {
      transport: 'phone_link',
      phoneControllerId: PIXEL_PHONE_LINK_CONTROLLER_ID
    }
  };
}

export function optionUsesPhoneLink(option: ControllerOption): boolean {
  if (option.launchMode === 'legacy_single') {
    return option.phoneLinkEnabled;
  }

  return option.playerSlots.some((playerSlot) => playerSlot.binding.transport === 'phone_link');
}

export const GAME_OPTIONS: ReadonlyArray<GameOption> = [
  {
    id: 'pixel-invaders',
    label: 'Pixel Invaders',
    description: 'Klasyczny test loop: ruch, strzal, fala przeciwnikow.',
    sceneKey: 'pixel-invaders',
    thumbnailSrc: pixelInvadersThumbnail,
    thumbnailAlt: 'Pixel Invaders screenshot',
    controllerOptions: [
      {
        id: 'pixel-solo-keyboard',
        label: 'Solo Keyboard',
        description: 'Jeden gracz: osobny slot klawiatury.',
        launchMode: 'pixel_multiplayer',
        playerSlots: [
          createPixelSlot('player-1', 0, 'pixel-invaders-keyboard-only', 'Keyboard', {
            kind: 'keyboard'
          })
        ]
      },
      {
        id: 'pixel-solo-mouse',
        label: 'Solo Mouse',
        description: 'Jeden gracz: osobny slot myszy z ruchem X/Y i fire na klik.',
        launchMode: 'pixel_multiplayer',
        playerSlots: [
          createPixelSlot('player-1', 0, 'pixel-invaders-mouse-paddle', 'Mouse', {
            kind: 'mouse'
          })
        ]
      },
      {
        id: 'pixel-coop-kb-mouse',
        label: 'KB + Mouse',
        description: 'Dwa lokalne sloty: klawiatura dla P1 i mysz dla P2.',
        launchMode: 'pixel_multiplayer',
        playerSlots: [
          createPixelSlot('player-1', 0, 'pixel-invaders-keyboard-only', 'Keyboard', {
            kind: 'keyboard'
          }),
          createPixelSlot('player-2', 1, 'pixel-invaders-mouse-paddle', 'Mouse', {
            kind: 'mouse'
          })
        ]
      },
      {
        id: 'pixel-coop-kb-pad',
        label: 'KB + Pad',
        description: 'Dwa lokalne sloty: klawiatura dla P1 i pad 1 dla P2.',
        launchMode: 'pixel_multiplayer',
        playerSlots: [
          createPixelSlot('player-1', 0, 'pixel-invaders-keyboard-only', 'Keyboard', {
            kind: 'keyboard'
          }),
          createPixelSlot('player-2', 1, 'pixel-invaders-keyboard-gamepad', 'Gamepad 1', {
            kind: 'gamepad',
            gamepadIndex: 0
          })
        ]
      },
      {
        id: 'pixel-coop-two-pads',
        label: '2 Pads',
        description: 'Dwa pady na dwoch slotach lokalnych. Dobre pod kanape bez klawiatury.',
        launchMode: 'pixel_multiplayer',
        playerSlots: [
          createPixelSlot('player-1', 0, 'pixel-invaders-keyboard-gamepad', 'Gamepad 1', {
            kind: 'gamepad',
            gamepadIndex: 0
          }),
          createPixelSlot('player-2', 1, 'pixel-invaders-keyboard-gamepad', 'Gamepad 2', {
            kind: 'gamepad',
            gamepadIndex: 1
          })
        ]
      },
      {
        id: 'pixel-phone-solo',
        label: 'Phone Solo',
        description: 'Jeden slot telefonu przez WebRTC phone link.',
        launchMode: 'pixel_multiplayer',
        playerSlots: [createPixelPhoneSlot('player-1', 0, 'Phone Link')]
      },
      {
        id: 'pixel-pad-phone',
        label: 'Pad + Phone',
        description: 'Dwa sloty: pad 1 lokalnie oraz jeden telefon przez phone link.',
        launchMode: 'pixel_multiplayer',
        playerSlots: [
          createPixelSlot('player-1', 0, 'pixel-invaders-keyboard-gamepad', 'Gamepad 1', {
            kind: 'gamepad',
            gamepadIndex: 0
          }),
          createPixelPhoneSlot('player-2', 1, 'Phone Link')
        ]
      }
    ]
  },
  {
    id: 'tunnel-invaders',
    label: 'Tunnel Invaders',
    description: 'Pseudo-3D tunel: przeciwnicy nadlatuja z glebi na krawedz.',
    sceneKey: 'tunnel-invaders',
    thumbnailSrc: tunnelInvadersThumbnail,
    thumbnailAlt: 'Tunnel Invaders screenshot',
    controllerOptions: [
      {
        id: 'tunnel-solo-default',
        label: 'Keyboard + Gamepad',
        description: 'Ruch wzgledny po obwodzie tunelu + strzal i skok fazowy.',
        launchMode: 'legacy_single',
        controllerProfileId: 'tunnel-invaders-keyboard-gamepad',
        phoneLinkEnabled: false
      }
    ]
  }
];
