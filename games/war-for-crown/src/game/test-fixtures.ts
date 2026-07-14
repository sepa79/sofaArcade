import { createC64CompatibilityState } from './c64-state';
import type { GameState, PlayerState, ProvinceState } from './types';

type ProvinceFixture = Omit<
  ProvinceState,
  'fortificationLevel' | 'upgradedFortificationThisTurn'
> &
  Partial<Pick<ProvinceState, 'fortificationLevel' | 'upgradedFortificationThisTurn'>>;

type PlayerFixture = Omit<PlayerState, 'money'> & Partial<Pick<PlayerState, 'money'>>;

type GameStateFixture = Omit<GameState, 'c64'> & Partial<Pick<GameState, 'c64'>>;

export function testProvince(province: ProvinceFixture): ProvinceState {
  return {
    fortificationLevel: 'none',
    upgradedFortificationThisTurn: false,
    ...province
  };
}

export function testPlayer(player: PlayerFixture): PlayerState {
  return {
    money: 20,
    ...player
  };
}

export function testGameState(state: GameStateFixture): GameState {
  const { c64, ...stateWithoutC64 } = state;
  void c64;
  return {
    ...stateWithoutC64,
    c64: createC64CompatibilityState(state.players, state.map)
  };
}
