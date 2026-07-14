import { PLAYER_DEFINITIONS } from '../game/constants';
import {
  C64_AI_NAME_CHOICES,
  PLAYER_COLOR_CHOICES,
  PLAYER_CREST_CHOICES
} from '../game/player-presentation';
import type { SavedPlayerSetup } from '../game/save-game';
import type { GameConfig, PlayerId } from '../game/types';

export type PlayerSetup = SavedPlayerSetup;
export type AiPlayerSetup = Extract<PlayerSetup, { readonly controller: 'ai' }>;

export function configuredPlayerCount(config: GameConfig): number {
  return config.humanPlayerCount + config.aiPlayerCount;
}

function requireAiName(index: number): string {
  const name = C64_AI_NAME_CHOICES[index];
  if (name === undefined) {
    throw new Error(`Missing C64 AI name for zero-based AI index ${index}.`);
  }
  return name;
}

function createPlayerSetup(config: GameConfig, index: number): PlayerSetup {
  const playerId = `p${index + 1}`;
  const controller = index < config.humanPlayerCount ? 'human' : 'ai';
  const base = {
    playerId,
    name: controller === 'human'
      ? `P${index + 1}`
      : requireAiName(index - config.humanPlayerCount),
    colorIndex: index % PLAYER_COLOR_CHOICES.length,
    crestIndex: index % PLAYER_CREST_CHOICES.length
  };
  return controller === 'human'
    ? { ...base, controller }
    : { ...base, controller, aiMode: 'c64-original' };
}

function synchronizePlayerSetup(
  config: GameConfig,
  current: PlayerSetup,
  index: number
): PlayerSetup {
  const created = createPlayerSetup(config, index);
  const base = {
    playerId: created.playerId,
    name: created.controller === 'human' && current.controller === 'human'
      ? current.name
      : created.name,
    colorIndex: current.colorIndex,
    crestIndex: current.crestIndex
  };
  if (created.controller === 'human') {
    return { ...base, controller: 'human' };
  }
  return {
    ...base,
    controller: 'ai',
    aiMode: current.controller === 'ai' ? current.aiMode : 'c64-original'
  };
}

export function synchronizePlayerSetups(
  config: GameConfig,
  currentSetups: ReadonlyArray<PlayerSetup>
): ReadonlyArray<PlayerSetup> {
  const count = configuredPlayerCount(config);
  if (count < 2 || count > PLAYER_DEFINITIONS.length) {
    throw new Error(`Configured player count must be 2..${PLAYER_DEFINITIONS.length}, got ${count}.`);
  }
  if (count > PLAYER_COLOR_CHOICES.length || count > PLAYER_CREST_CHOICES.length) {
    throw new Error(`Configured player count ${count} exceeds presentation choices.`);
  }

  const currentById = new Map(currentSetups.map((setup) => [setup.playerId, setup]));
  return Array.from({ length: count }, (_value, index) => {
    const playerId = `p${index + 1}`;
    const current = currentById.get(playerId);
    return current === undefined
      ? createPlayerSetup(config, index)
      : synchronizePlayerSetup(config, current, index);
  });
}

export function updatePlayerSetup(
  setups: ReadonlyArray<PlayerSetup>,
  playerId: PlayerId,
  update: (setup: PlayerSetup) => PlayerSetup
): ReadonlyArray<PlayerSetup> {
  if (!setups.some((setup) => setup.playerId === playerId)) {
    throw new Error(`Cannot update missing player setup ${playerId}.`);
  }
  return setups.map((setup) => setup.playerId === playerId ? update(setup) : setup);
}
