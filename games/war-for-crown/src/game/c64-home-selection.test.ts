import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from './constants';
import { selectC64HomeProvince } from './c64-home-selection';
import { ROYALIST_OWNER_ID } from './owners';
import { createPlayerView } from './player-view';
import { createInitialState } from './state';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { GameState, ProvinceId } from './types';

function cycleState(
  activePlayerId: 'p1' | 'p2',
  firstPlayerHomeProvinceId: ProvinceId | null
): GameState {
  const provinceIds = ['province-1', 'province-2', 'province-3', 'province-4', 'province-5', 'province-6'];
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'home-selection',
    map: {
      width: 6,
      height: 1,
      tiles: provinceIds.map((provinceId, x) => ({ x, y: 0, provinceId })),
      provinces: provinceIds.map((provinceId, index) =>
        testProvince({
          id: provinceId,
          terrainId: 'plains',
          ownerId: provinceId === firstPlayerHomeProvinceId ? 'p1' : ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 3,
          neighbours: [
            provinceIds[(index + provinceIds.length - 1) % provinceIds.length],
            provinceIds[(index + 1) % provinceIds.length]
          ]
        })
      )
    },
    players: [
      testPlayer({
        id: 'p1',
        label: 'P1',
        color: 1,
        homeProvinceId: firstPlayerHomeProvinceId
      }),
      testPlayer({ id: 'p2', label: 'P2', color: 2, homeProvinceId: null })
    ],
    activePlayerId,
    turnStep: 'new-month',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function singleBoundaryState(): GameState {
  const provinceIds = ['province-1', 'province-2', 'province-3', 'province-4'];
  return testGameState({
    ...cycleState('p1', null),
    map: {
      width: 4,
      height: 1,
      tiles: provinceIds.map((provinceId, x) => ({ x, y: 0, provinceId })),
      provinces: provinceIds.map((provinceId, index) =>
        testProvince({
          id: provinceId,
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: index === 0 ? 99 : 0,
          soldiers: 3,
          neighbours: [
            ...(index > 0 ? [provinceIds[index - 1]] : []),
            ...(index < provinceIds.length - 1 ? [provinceIds[index + 1]] : [])
          ]
        })
      )
    }
  });
}

describe('C64 computer home selection', () => {
  it('matches the first active VICE seed fixture', () => {
    const state = createInitialState(1);

    expect(selectC64HomeProvince(createPlayerView(state, 'p1'), DEFAULT_GAME_CONFIG)).toBe(
      'province-11'
    );
  });

  it('uses the C64 descending scan tie break so the lower province wins equal scores', () => {
    const state = cycleState('p1', null);

    expect(selectC64HomeProvince(createPlayerView(state, 'p1'), DEFAULT_GAME_CONFIG)).toBe(
      'province-1'
    );
  });

  it('penalizes candidates whose selected neighbourhood approaches an earlier home', () => {
    const state = cycleState('p2', 'province-1');

    expect(selectC64HomeProvince(createPlayerView(state, 'p2'), DEFAULT_GAME_CONFIG)).toBe(
      'province-4'
    );
  });

  it('moves the winner to the sole unowned boundary province', () => {
    const state = singleBoundaryState();

    expect(selectC64HomeProvince(createPlayerView(state, 'p1'), DEFAULT_GAME_CONFIG)).toBe(
      'province-2'
    );
  });
});
