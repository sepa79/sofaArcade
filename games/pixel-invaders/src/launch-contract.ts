import { createInputSessionPlan, type InputSessionSlot } from '@light80/core';
import type { AudioMixProfileId } from '@light80/game-sdk';

export const PIXEL_PHONE_LINK_CONTROLLER_ID = 'pixel-phone-1';

export interface MultiplayerGameLaunchPlayerSlot extends InputSessionSlot {
  readonly controllerLabel: string;
}

export interface MultiplayerGameLaunchData {
  readonly playerSlots: ReadonlyArray<MultiplayerGameLaunchPlayerSlot>;
  readonly audioMixProfileId: AudioMixProfileId;
}

function requireNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
}

function requireAudioMixProfileId(audioMixProfileId: AudioMixProfileId): void {
  if (
    audioMixProfileId !== 'cinema' &&
    audioMixProfileId !== 'arcade' &&
    audioMixProfileId !== 'late-night'
  ) {
    throw new Error(`Unsupported audio mix profile id: "${String(audioMixProfileId)}".`);
  }
}

export function createMultiplayerGameLaunchData(
  data: MultiplayerGameLaunchData
): MultiplayerGameLaunchData {
  requireAudioMixProfileId(data.audioMixProfileId);
  createInputSessionPlan({
    slots: data.playerSlots
  });

  for (const playerSlot of data.playerSlots) {
    requireNonEmptyString(
      playerSlot.controllerLabel,
      `Launch player slot "${playerSlot.slotId}" controllerLabel`
    );
  }

  return data;
}
