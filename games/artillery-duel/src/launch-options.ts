import type { ArtilleryDuelSceneData } from './scenes/artillery-duel-scene';

export interface ArtilleryLaunchOption {
  readonly description: string;
  readonly id: ArtilleryDuelSceneData['matchMode'];
  readonly label: string;
}

export const ARTILLERY_LAUNCH_OPTIONS: ReadonlyArray<ArtilleryLaunchOption> = [
  {
    id: 'solo-ai',
    label: 'SOLO VS CPU',
    description: 'Jeden gracz przeciw komputerowi.'
  },
  {
    id: 'hotseat-2p',
    label: '2P HOTSEAT',
    description: 'Dwaj gracze na zmiane przy jednym ekranie.'
  }
];

export function artilleryLaunchData(
  matchMode: ArtilleryDuelSceneData['matchMode']
): ArtilleryDuelSceneData {
  if (!ARTILLERY_LAUNCH_OPTIONS.some((option) => option.id === matchMode)) {
    throw new Error(`Unsupported Artillery Duel match mode: ${String(matchMode)}.`);
  }
  return {
    controllerProfileId: 'artillery-duel-shared-keyboard-gamepad',
    controllerLabel: 'Shared Keyboard + Gamepad',
    audioMixProfileId: 'arcade',
    matchMode
  };
}
