import { DEFAULT_GAME_CONFIG, PLAYER_DEFINITIONS } from './constants';
import { validateGameConfig } from './config-validation';
import { createC64CompatibilityState } from './c64-state';
import { generateProvinceMapWithRngState } from './map';
import type { GameConfig, GameState, PlayerState } from './types';

function totalPlayerCount(config: GameConfig): number {
  validateGameConfig(config);
  return config.humanPlayerCount + config.aiPlayerCount;
}

function createPlayers(config: GameConfig): ReadonlyArray<PlayerState> {
  return PLAYER_DEFINITIONS.slice(0, totalPlayerCount(config)).map((player) => ({
    ...player,
    money: config.startingMoney,
    homeProvinceId: null
  }));
}

export function createInitialState(seed: number = 1, config: GameConfig = DEFAULT_GAME_CONFIG): GameState {
  const players = createPlayers(config);
  const generatedMap = generateProvinceMapWithRngState(config, seed);
  const firstPlayer = players[0];
  if (firstPlayer === undefined) {
    throw new Error('Cannot create game state without players.');
  }

  return {
    seed,
    rngState: generatedMap.rngState,
    phase: 'home-selection',
    map: generatedMap.map,
    players,
    c64: createC64CompatibilityState(players, generatedMap.map),
    activePlayerId: firstPlayer.id,
    turnStep: 'new-month',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  };
}
