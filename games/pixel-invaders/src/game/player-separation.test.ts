import { describe, expect, it } from 'vitest';

import { PLAYER_COLLISION_WIDTH } from './constants';
import { resolvePlayerSeparation, updateRecentMovementMomentum } from './player-separation';
import type { PlayerState } from './types';

const BASE_PLAYERS: ReadonlyArray<PlayerState> = [
  {
    playerIndex: 0,
    x: 400,
    lives: 3,
    respawnTimer: 0,
    shootTimer: 0,
    lane: 'mid',
    recentMovementMomentum: 2,
    pushbackVelocityX: 0,
    score: 0,
    hitStreak: 0,
    scoreMultiplier: 1
  },
  {
    playerIndex: 1,
    x: 430,
    lives: 3,
    respawnTimer: 0,
    shootTimer: 0,
    lane: 'mid',
    recentMovementMomentum: 0,
    pushbackVelocityX: 0,
    score: 0,
    hitStreak: 0,
    scoreMultiplier: 1
  }
];

describe('player separation', () => {
  it('keeps same-lane players from overlapping', () => {
    const nextPlayers = resolvePlayerSeparation(BASE_PLAYERS);

    expect(Math.abs(nextPlayers[1].x - nextPlayers[0].x)).toBeGreaterThanOrEqual(PLAYER_COLLISION_WIDTH);
  });

  it('lets stronger recent momentum keep more of its position', () => {
    const nextPlayers = resolvePlayerSeparation(BASE_PLAYERS);

    expect(nextPlayers[1].x - BASE_PLAYERS[1].x).toBeGreaterThan(
      Math.abs(nextPlayers[0].x - BASE_PLAYERS[0].x)
    );
  });

  it('builds momentum from recent movement and decays when standing still', () => {
    const gained = updateRecentMovementMomentum(0, 7, 1 / 60);
    const decayed = updateRecentMovementMomentum(gained, 0, 1 / 60);

    expect(gained).toBeGreaterThan(0);
    expect(decayed).toBeLessThan(gained);
  });
});
