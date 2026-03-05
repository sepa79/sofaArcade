export interface GameOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly sceneKey: string;
  readonly controllerOptions: ReadonlyArray<ControllerOption>;
}

export interface ControllerOption {
  readonly profileId: string;
  readonly label: string;
  readonly description: string;
}

export const GAME_OPTIONS: ReadonlyArray<GameOption> = [
  {
    id: 'pixel-invaders',
    label: 'Pixel Invaders',
    description: 'Klasyczny test loop: ruch, strzal, fala przeciwnikow.',
    sceneKey: 'pixel-invaders',
    controllerOptions: [
      {
        profileId: 'pixel-invaders-keyboard-gamepad',
        label: 'Keyboard + Gamepad',
        description: 'Ruch wzgledny, idealne pod pad i klasyczne klawisze.'
      },
      {
        profileId: 'pixel-invaders-mouse-paddle',
        label: 'Mouse Paddle',
        description: 'Ruch absolutny (0-255), jak paddle na osi ekranu.'
      },
      {
        profileId: 'pixel-invaders-hybrid',
        label: 'Hybrid',
        description: 'Laczy wzgledny ruch i tryb absolutny po przytrzymaniu myszy.'
      },
      {
        profileId: 'pixel-invaders-phone-link',
        label: 'Phone Link',
        description: 'Sterowanie telefonem przez WebRTC (P2P).'
      }
    ]
  },
  {
    id: 'tunnel-invaders',
    label: 'Tunnel Invaders',
    description: 'Pseudo-3D tunel: przeciwnicy nadlatuja z glebi na krawedz.',
    sceneKey: 'tunnel-invaders',
    controllerOptions: [
      {
        profileId: 'tunnel-invaders-keyboard-gamepad',
        label: 'Keyboard + Gamepad',
        description: 'Ruch wzgledny po obwodzie tunelu + strzal i skok fazowy.'
      }
    ]
  }
];
