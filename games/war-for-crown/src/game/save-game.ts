import { WAR_FOR_CROWN_AI_STRATEGIES, type WarForCrownAiMode } from './ai';
import { DEFAULT_GAME_CONFIG } from './constants';
import { validateGameConfig } from './config-validation';
import { validateGameState } from './invariants';
import { PLAYER_COLOR_CHOICES, PLAYER_CREST_CHOICES } from './player-presentation';
import type { GameConfig, GameState, PlayerId } from './types';

export const WAR_FOR_CROWN_SAVE_FORMAT = 'war-for-crown';
export const WAR_FOR_CROWN_SAVE_VERSION = 1;

export type SaveLanguage = 'pl' | 'en';

interface SavedPlayerSetupBase {
  readonly playerId: PlayerId;
  readonly name: string;
  readonly colorIndex: number;
  readonly crestIndex: number;
}

export interface SavedHumanPlayerSetup extends SavedPlayerSetupBase {
  readonly controller: 'human';
}

export interface SavedAiPlayerSetup extends SavedPlayerSetupBase {
  readonly controller: 'ai';
  readonly aiMode: WarForCrownAiMode;
}

export type SavedPlayerSetup = SavedHumanPlayerSetup | SavedAiPlayerSetup;

export interface WarForCrownSaveGame {
  readonly format: typeof WAR_FOR_CROWN_SAVE_FORMAT;
  readonly version: typeof WAR_FOR_CROWN_SAVE_VERSION;
  readonly language: SaveLanguage;
  readonly config: GameConfig;
  readonly playerSetups: ReadonlyArray<SavedPlayerSetup>;
  readonly state: GameState;
}

const CONFIG_KEYS = Object.keys(DEFAULT_GAME_CONFIG) as ReadonlyArray<keyof GameConfig>;
const CONFIG_STRING_VALUES: Readonly<Record<string, ReadonlyArray<string>>> = {
  maxVillagesMode: ['per-province', 'largest-province'],
  royalistAttitude: ['friendly', 'neutral', 'hostile'],
  royalistAttackCooperation: ['single-source', 'combined-sources'],
  royalistAttackThreshold: ['loose', 'strict'],
  royalistDistribution: ['none', 'even', 'border'],
  maxHomeFortificationLevel: ['none', 'watchtower', 'fort', 'castle', 'stronghold', 'fortress', 'citadel'],
  maxProvinceFortificationLevel: ['none', 'watchtower', 'fort', 'castle', 'stronghold', 'fortress', 'citadel'],
  terrainInfluence: ['none', 'income', 'combat', 'both']
};

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return value as number;
}

function parseConfig(value: unknown): GameConfig {
  const config = requireRecord(value, 'Saved game config');
  const keys = Object.keys(config);
  if (keys.length !== CONFIG_KEYS.length || !CONFIG_KEYS.every((key) => key in config)) {
    throw new Error('Saved game config fields do not match the current format.');
  }

  for (const key of CONFIG_KEYS) {
    const candidate = config[key];
    const expected = DEFAULT_GAME_CONFIG[key];
    if (typeof candidate !== typeof expected) {
      throw new Error(`Saved game config field "${key}" has an invalid type.`);
    }
    if (typeof expected === 'number' && (!Number.isSafeInteger(candidate) || (candidate as number) < 0)) {
      throw new Error(`Saved game config field "${key}" must be a non-negative safe integer.`);
    }
    if (typeof expected === 'string') {
      const allowedValues = CONFIG_STRING_VALUES[key];
      if (allowedValues === undefined || !allowedValues.includes(candidate as string)) {
        throw new Error(`Saved game config field "${key}" has an invalid value.`);
      }
    }
  }

  const parsed = config as unknown as GameConfig;
  validateGameConfig(parsed);
  return parsed;
}

function parsePlayerSetups(
  value: unknown,
  config: GameConfig,
  state: GameState
): ReadonlyArray<SavedPlayerSetup> {
  if (!Array.isArray(value)) {
    throw new Error('Saved game player setups must be an array.');
  }
  if (value.length !== config.humanPlayerCount + config.aiPlayerCount) {
    throw new Error('Saved game player setup count does not match game config.');
  }
  if (value.length !== state.players.length) {
    throw new Error('Saved game player setup count does not match game state.');
  }

  const setups = value.map((candidate, index): SavedPlayerSetup => {
    const setup = requireRecord(candidate, `Saved player setup ${index + 1}`);
    const playerId = requireNonEmptyString(setup.playerId, `Saved player setup ${index + 1} id`);
    const statePlayer = state.players[index];
    if (statePlayer === undefined || statePlayer.id !== playerId) {
      throw new Error(`Saved player setup ${index + 1} does not match game state player order.`);
    }
    const base = {
      playerId,
      name: requireNonEmptyString(setup.name, `Saved player setup ${index + 1} name`),
      colorIndex: requireNonNegativeInteger(setup.colorIndex, `Saved player setup ${index + 1} color index`),
      crestIndex: requireNonNegativeInteger(setup.crestIndex, `Saved player setup ${index + 1} crest index`)
    };
    if (PLAYER_COLOR_CHOICES[base.colorIndex] === undefined) {
      throw new Error(`Saved player setup ${index + 1} has an invalid color index.`);
    }
    if (PLAYER_CREST_CHOICES[base.crestIndex] === undefined) {
      throw new Error(`Saved player setup ${index + 1} has an invalid crest index.`);
    }
    if (statePlayer.label !== base.name.trim()) {
      throw new Error(`Saved player setup ${index + 1} name does not match game state.`);
    }
    if (statePlayer.color !== PLAYER_COLOR_CHOICES[base.colorIndex]) {
      throw new Error(`Saved player setup ${index + 1} color does not match game state.`);
    }

    if (setup.controller === 'human') {
      if (index >= config.humanPlayerCount) {
        throw new Error(`Saved player setup ${index + 1} must be AI-controlled.`);
      }
      return { ...base, controller: 'human' };
    }
    if (setup.controller !== 'ai') {
      throw new Error(`Saved player setup ${index + 1} has an invalid controller.`);
    }
    if (index < config.humanPlayerCount) {
      throw new Error(`Saved player setup ${index + 1} must be human-controlled.`);
    }
    const aiMode = requireNonEmptyString(setup.aiMode, `Saved player setup ${index + 1} AI mode`);
    if (!Object.hasOwn(WAR_FOR_CROWN_AI_STRATEGIES, aiMode)) {
      throw new Error(`Saved player setup ${index + 1} has an invalid AI mode.`);
    }
    return { ...base, controller: 'ai', aiMode: aiMode as WarForCrownAiMode };
  });

  if (setups.filter((setup) => setup.controller === 'human').length !== config.humanPlayerCount) {
    throw new Error('Saved game human player count does not match game config.');
  }
  if (setups.filter((setup) => setup.controller === 'ai').length !== config.aiPlayerCount) {
    throw new Error('Saved game AI player count does not match game config.');
  }
  return setups;
}

function parseState(value: unknown): GameState {
  const state = requireRecord(value, 'Saved game state');
  const map = requireRecord(state.map, 'Saved game map');
  const c64 = requireRecord(state.c64, 'Saved game C64 state');
  if (!Array.isArray(map.tiles) || !Array.isArray(map.provinces)) {
    throw new Error('Saved game map tiles and provinces must be arrays.');
  }
  if (!Array.isArray(state.players) || !Array.isArray(state.attackSpentProvinceIds)) {
    throw new Error('Saved game players and attack-spent provinces must be arrays.');
  }
  if (!Array.isArray(c64.ca61Bytes) || !Array.isArray(c64.playerMemory) || !Array.isArray(c64.royalistProvinceMemory)) {
    throw new Error('Saved game C64 memory fields must be arrays.');
  }
  if (state.battle !== null) {
    requireRecord(state.battle, 'Saved game battle');
  }

  const parsed = state as unknown as GameState;
  validateGameState(parsed);
  return parsed;
}

export function parseWarForCrownSaveGame(value: unknown): WarForCrownSaveGame {
  const save = requireRecord(value, 'War for Crown save');
  if (save.format !== WAR_FOR_CROWN_SAVE_FORMAT) {
    throw new Error(`Unsupported save format: ${String(save.format)}.`);
  }
  if (save.version !== WAR_FOR_CROWN_SAVE_VERSION) {
    throw new Error(`Unsupported War for Crown save version: ${String(save.version)}.`);
  }
  if (save.language !== 'pl' && save.language !== 'en') {
    throw new Error(`Unsupported save language: ${String(save.language)}.`);
  }

  const state = parseState(save.state);
  const config = parseConfig(save.config);
  if (state.map.width !== config.mapWidth || state.map.height !== config.mapHeight) {
    throw new Error('Saved game map dimensions do not match game config.');
  }
  if (state.map.provinces.length !== config.provinceCount) {
    throw new Error('Saved game province count does not match game config.');
  }
  const playerSetups = parsePlayerSetups(save.playerSetups, config, state);
  return {
    format: WAR_FOR_CROWN_SAVE_FORMAT,
    version: WAR_FOR_CROWN_SAVE_VERSION,
    language: save.language,
    config,
    playerSetups,
    state
  };
}

export function createWarForCrownSaveGame(input: {
  readonly language: SaveLanguage;
  readonly config: GameConfig;
  readonly playerSetups: ReadonlyArray<SavedPlayerSetup>;
  readonly state: GameState;
}): WarForCrownSaveGame {
  return parseWarForCrownSaveGame({
    format: WAR_FOR_CROWN_SAVE_FORMAT,
    version: WAR_FOR_CROWN_SAVE_VERSION,
    ...input
  });
}
