import { describe, expect, it } from 'vitest';

import { PLAYER_RAPID_FIRE_BULLET_CAPACITY, PLAYER_RAPID_FIRE_SHOOT_COOLDOWN, PLAYER_SHOOT_COOLDOWN } from './constants';
import { defaultPlayerLaneForIndex } from './player-lanes';
import { applyPowerup, consumeShield, playerBulletCapacity, playerShootCooldown, tickPlayerPowerups } from './powerups';
import type { PlayerState } from './types';

function createPlayer(): PlayerState {
  return {
    playerIndex: 0,
    x: 320,
    lives: 3,
    respawnTimer: 0,
    shootTimer: 0,
    lane: defaultPlayerLaneForIndex(0),
    recentMovementMomentum: 0,
    pushbackVelocityX: 0,
    score: 0,
    hitStreak: 0,
    scoreMultiplier: 1,
    activePowerups: []
  };
}

describe('powerups', () => {
  it('refreshes the same powerup instead of duplicating it', () => {
    const once = applyPowerup(createPlayer(), 'shield');
    const twice = applyPowerup(once, 'shield');

    expect(twice.activePowerups).toHaveLength(1);
    expect(twice.activePowerups[0]?.kind).toBe('shield');
  });

  it('consumes shield on use', () => {
    const shielded = applyPowerup(createPlayer(), 'shield');
    const consumed = consumeShield(shielded);

    expect(consumed.consumed).toBe(true);
    expect(consumed.player.activePowerups).toHaveLength(0);
  });

  it('rapid fire changes cooldown and bullet capacity', () => {
    const player = applyPowerup(createPlayer(), 'rapid-fire');

    expect(playerShootCooldown(createPlayer())).toBe(PLAYER_SHOOT_COOLDOWN);
    expect(playerShootCooldown(player)).toBe(PLAYER_RAPID_FIRE_SHOOT_COOLDOWN);
    expect(playerBulletCapacity(player)).toBe(PLAYER_RAPID_FIRE_BULLET_CAPACITY);
  });

  it('expires timed powerups', () => {
    const player = applyPowerup(createPlayer(), 'rapid-fire');
    const expired = tickPlayerPowerups(player, 60);

    expect(expired.activePowerups).toHaveLength(0);
  });
});
