import { describe, expect, it } from 'vitest';

import { PLAYER_RESPAWN_INVULNERABILITY } from './constants';
import { buildBossVisualState, bossCoreIsVulnerable, countLivingShieldSegments, createInitialBossState, resolveBossHazards, resolvePlayerShotsAgainstBoss, stepBossState } from './boss';
import type { BossState, Bullet, PlayerState } from './types';

function createPlayer(playerIndex: number, x: number): PlayerState {
  return {
    playerIndex,
    x,
    lives: 3,
    respawnTimer: 0,
    shootTimer: 0,
    lane: 'low',
    recentMovementMomentum: 0,
    pushbackVelocityX: 0,
    score: 0,
    hitStreak: 0,
    scoreMultiplier: 1,
    activePowerups: []
  };
}

function coreHitBullet(boss: BossState): Bullet {
  const visual = buildBossVisualState(boss);
  return {
    owner: 'player',
    playerIndex: 0,
    x: visual.core.x,
    y: visual.core.y,
    vy: 0
  };
}

describe('boss', () => {
  it('starts with shielded core and both claws online', () => {
    const boss = createInitialBossState();
    const visual = buildBossVisualState(boss);

    expect(countLivingShieldSegments(boss)).toBe(4);
    expect(bossCoreIsVulnerable(boss)).toBe(false);
    expect(visual.claws).toHaveLength(2);
    expect(visual.core.hitPoints).toBeGreaterThan(0);
  });

  it('absorbs shots on the locked core until shield and claws are destroyed', () => {
    const boss = createInitialBossState();
    const resolution = resolvePlayerShotsAgainstBoss(boss, [coreHitBullet(boss)], 1 / 60);

    expect(resolution.boss).not.toBeNull();
    expect(resolution.bullets).toHaveLength(0);
    expect(resolution.boss?.coreHitPoints).toBe(boss.coreHitPoints);
  });

  it('can be defeated once the core is exposed', () => {
    const boss = createInitialBossState();
    const exposedBoss: BossState = {
      ...boss,
      coreHitPoints: 1,
      leftClawHitPoints: 0,
      rightClawHitPoints: 0,
      shieldSegments: boss.shieldSegments.map((segment) => ({
        ...segment,
        hitPoints: 0
      }))
    };

    const resolution = resolvePlayerShotsAgainstBoss(exposedBoss, [coreHitBullet(exposedBoss)], 1 / 60);

    expect(resolution.boss).toBeNull();
    expect(resolution.scoreEvents).toHaveLength(1);
  });

  it('reports hits from flying orb hazards and consumes the projectile', () => {
    const boss = createInitialBossState();
    const hazardBoss: BossState = {
      ...boss,
      projectiles: [
        {
          id: 10,
          kind: 'orb',
          side: 'left',
          x: 320,
          y: 648,
          radius: 24,
          phase: 'flying',
          elapsedSec: 1,
          vx: 0,
          vy: 0
        }
      ]
    };

    const resolution = resolveBossHazards(hazardBoss, [createPlayer(0, 320)]);

    expect(resolution.hitPlayerIndices).toEqual([0]);
    expect(resolution.boss.projectiles).toHaveLength(0);
  });

  it('moves and eventually leaves idle state while stepping', () => {
    let boss = createInitialBossState();
    let rngSeed = 17;
    let spawnedEnemyBullets = 0;

    for (let index = 0; index < 120; index += 1) {
      const stepped = stepBossState(boss, 1 / 60, rngSeed);
      boss = stepped.boss;
      rngSeed = stepped.rngSeed;
      spawnedEnemyBullets += stepped.bullets.length;
    }

    expect(boss.coreX).not.toBe(createInitialBossState().coreX);
    expect(boss.attack.kind !== 'idle' || boss.projectiles.length > 0 || spawnedEnemyBullets > 0).toBe(true);
  });

  it('ignores players who are respawning when resolving hazards', () => {
    const boss = createInitialBossState();
    const hazardBoss: BossState = {
      ...boss,
      projectiles: [
        {
          id: 11,
          kind: 'orb',
          side: 'right',
          x: 420,
          y: 648,
          radius: 24,
          phase: 'flying',
          elapsedSec: 1,
          vx: 0,
          vy: 0
        }
      ]
    };

    const respawningPlayer: PlayerState = {
      ...createPlayer(0, 420),
      respawnTimer: PLAYER_RESPAWN_INVULNERABILITY
    };
    const resolution = resolveBossHazards(hazardBoss, [respawningPlayer]);

    expect(resolution.hitPlayerIndices).toHaveLength(0);
    expect(resolution.boss.projectiles).toHaveLength(1);
  });
});
