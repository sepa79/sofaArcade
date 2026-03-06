import { describe, expect, it } from 'vitest';

import { defaultPlayerLaneForIndex } from './player-lanes';
import { highestPlayerMultiplier, totalPlayerScore } from './score';
import type { PlayerState } from './types';

const TEST_PLAYERS: ReadonlyArray<PlayerState> = [
  {
    playerIndex: 0,
    x: 120,
    lives: 3,
    respawnTimer: 0,
    shootTimer: 0,
    lane: defaultPlayerLaneForIndex(0),
    recentMovementMomentum: 0,
    pushbackVelocityX: 0,
    score: 12,
    hitStreak: 2,
    scoreMultiplier: 3
  },
  {
    playerIndex: 1,
    x: 240,
    lives: 2,
    respawnTimer: 0,
    shootTimer: 0,
    lane: defaultPlayerLaneForIndex(1),
    recentMovementMomentum: 0,
    pushbackVelocityX: 0,
    score: 7,
    hitStreak: 1,
    scoreMultiplier: 2
  }
];

describe('score helpers', () => {
  it('sums total score from all players', () => {
    expect(totalPlayerScore(TEST_PLAYERS)).toBe(19);
  });

  it('reads the highest active multiplier from players', () => {
    expect(highestPlayerMultiplier(TEST_PLAYERS)).toBe(3);
  });
});
