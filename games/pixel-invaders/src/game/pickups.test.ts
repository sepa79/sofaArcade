import { describe, expect, it } from 'vitest';

import { PICKUP_FALL_SPEED } from './constants';
import { defaultPlayerLaneForIndex, playerLaneWorldY } from './player-lanes';
import { spawnPickupsFromDefeatedUfos, stepPickups } from './pickups';
import type { Enemy, PickupEntity, PlayerState } from './types';

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

function createUfo(): Enemy {
  return {
    id: 7,
    x: 280,
    y: 180,
    alive: false,
    kind: 'ufo',
    scoreValue: 10,
    hitPoints: 0,
    motion: {
      kind: 'formation'
    },
    guaranteedPickupKind: null
  };
}

describe('pickups', () => {
  it('spawns one pickup for each defeated ufo', () => {
    const next = spawnPickupsFromDefeatedUfos([], 0, 123, [createUfo()]);

    expect(next.pickups).toHaveLength(1);
    expect(next.pickups[0]?.id).toBe(0);
    expect(next.pickups[0]?.vy).toBe(PICKUP_FALL_SPEED);
    expect(next.nextPickupId).toBe(1);
  });

  it('collects pickup on matching player lane and position', () => {
    const player = createPlayer();
    const pickup: PickupEntity = {
      id: 0,
      kind: 'shield',
      x: player.x,
      y: playerLaneWorldY(player.lane),
      vy: 0
    };

    const next = stepPickups([player], [pickup], 1 / 60);

    expect(next.pickups).toHaveLength(0);
    expect(next.players[0]?.activePowerups[0]?.kind).toBe('shield');
  });

  it('does not collect pickup from another lane', () => {
    const player = createPlayer();
    const pickup: PickupEntity = {
      id: 0,
      kind: 'shield',
      x: player.x,
      y: playerLaneWorldY('high'),
      vy: 0
    };

    const next = stepPickups([player], [pickup], 1 / 60);

    expect(next.pickups).toHaveLength(1);
    expect(next.players[0]?.activePowerups).toHaveLength(0);
  });
});
