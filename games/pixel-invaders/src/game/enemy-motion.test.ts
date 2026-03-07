import { describe, expect, it } from 'vitest';

import {
  ENEMY_DESCEND_STEP,
  ENEMY_DRIFT_DOWN_SPEED,
  ENEMY_WIDTH,
  FIXED_TIMESTEP,
  WORLD_WIDTH
} from './constants';
import { stepEnemies } from './enemy-motion';
import { defaultPlayerLaneForIndex } from './player-lanes';
import type { PlayerState } from './types';
import { advanceCampaignState, CLASSIC_TOTAL_ROWS, createInitialCampaignState, spawnGalagaRow, spawnInitialClassicFormation } from './waves';

function createPlayer(): PlayerState {
  return {
    playerIndex: 0,
    x: WORLD_WIDTH / 2,
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

describe('enemy motion', () => {
  it('moves only living formation enemies during the classic phase', () => {
    const classic = spawnInitialClassicFormation(101).enemies;
    const motionInput = classic.map((enemy, index) =>
      index === 0
        ? {
            ...enemy,
            alive: false
          }
        : enemy
    );

    const next = stepEnemies(
      motionInput,
      [createPlayer()],
      createInitialCampaignState(),
      1,
      120,
      Number.POSITIVE_INFINITY,
      FIXED_TIMESTEP,
      5
    );

    expect(next.enemies[0]?.x).toBe(motionInput[0]?.x);
    expect(next.enemies[0]?.y).toBe(motionInput[0]?.y);
    expect(next.enemies[1]?.x).toBeGreaterThan(motionInput[1]?.x ?? 0);
    expect(next.enemies[1]?.y).toBeCloseTo(
      (motionInput[1]?.y ?? 0) + ENEMY_DRIFT_DOWN_SPEED * FIXED_TIMESTEP
    );
  });

  it('clamps the formation to the playfield, descends once, and reverses direction on boundary contact', () => {
    const classic = spawnInitialClassicFormation(102).enemies;
    const rightmostX = Math.max(...classic.map((enemy) => enemy.x));
    const shiftX = WORLD_WIDTH - ENEMY_WIDTH / 2 - rightmostX - 0.5;
    const nearBoundary = classic.map((enemy) => ({
      ...enemy,
      x: enemy.x + shiftX
    }));

    const next = stepEnemies(
      nearBoundary,
      [createPlayer()],
      createInitialCampaignState(),
      1,
      120,
      Number.POSITIVE_INFINITY,
      FIXED_TIMESTEP,
      6
    );

    const nextRightmostX = Math.max(...next.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.x));
    expect(next.direction).toBe(-1);
    expect(next.speed).toBeGreaterThan(120);
    expect(nextRightmostX).toBeLessThanOrEqual(WORLD_WIDTH - ENEMY_WIDTH / 2);
    expect(next.enemies[0]?.y).toBeCloseTo(
      (nearBoundary[0]?.y ?? 0) + ENEMY_DRIFT_DOWN_SPEED * FIXED_TIMESTEP + ENEMY_DESCEND_STEP
    );
  });

  it('finishes entry paths by snapping enemies back into formation', () => {
    const campaign = advanceCampaignState({
      phase: 'classic-endless',
      rowsCleared: CLASSIC_TOTAL_ROWS,
      rowsSpawned: CLASSIC_TOTAL_ROWS,
      rowsTarget: CLASSIC_TOTAL_ROWS,
      startRows: 4,
      transitionTimerSec: 0
    });
    if (campaign.phase !== 'galaga-rows') {
      throw new Error('Expected galaga-rows campaign state.');
    }

    const spawned = spawnGalagaRow(
      {
        ...campaign,
        transitionTimerSec: 0
      },
      true
    );
    const entryEnemy = spawned.enemies.find((enemy) => enemy.motion.kind === 'path' && enemy.motion.path === 'entry');
    if (entryEnemy === undefined || entryEnemy.motion.kind !== 'path') {
      throw new Error('Expected an entry-path enemy.');
    }

    const next = stepEnemies(
      spawned.enemies,
      [createPlayer()],
      campaign,
      1,
      spawned.enemySpeed,
      spawned.enemyDiveTimer,
      entryEnemy.motion.durationSec + FIXED_TIMESTEP,
      7
    );

    const settledEnemy = next.enemies.find((enemy) => enemy.id === entryEnemy.id);
    expect(settledEnemy?.motion.kind).toBe('formation');
    expect(settledEnemy?.x).toBe(entryEnemy.motion.targetX);
    expect(settledEnemy?.y).toBe(entryEnemy.motion.targetY);
  });

  it('launches galaga dive attacks when the dive timer elapses', () => {
    const campaign = advanceCampaignState({
      phase: 'classic-endless',
      rowsCleared: CLASSIC_TOTAL_ROWS,
      rowsSpawned: CLASSIC_TOTAL_ROWS,
      rowsTarget: CLASSIC_TOTAL_ROWS,
      startRows: 4,
      transitionTimerSec: 0
    });
    if (campaign.phase !== 'galaga-rows') {
      throw new Error('Expected galaga-rows campaign state.');
    }

    const spawned = spawnGalagaRow(
      {
        ...campaign,
        transitionTimerSec: 0
      },
      false
    );

    const next = stepEnemies(
      spawned.enemies,
      [createPlayer()],
      campaign,
      1,
      spawned.enemySpeed,
      FIXED_TIMESTEP,
      FIXED_TIMESTEP,
      8
    );

    expect(next.enemies.some((enemy) => enemy.motion.kind === 'path' && enemy.motion.path === 'attack')).toBe(true);
    expect(next.diveTimer).toBeGreaterThan(0);
  });

  it('keeps galaga attack return smooth near the end of the path', () => {
    const campaign = advanceCampaignState({
      phase: 'classic-endless',
      rowsCleared: CLASSIC_TOTAL_ROWS,
      rowsSpawned: CLASSIC_TOTAL_ROWS,
      rowsTarget: CLASSIC_TOTAL_ROWS,
      startRows: 4,
      transitionTimerSec: 0
    });
    if (campaign.phase !== 'galaga-rows') {
      throw new Error('Expected galaga-rows campaign state.');
    }

    const spawned = spawnGalagaRow(
      {
        ...campaign,
        transitionTimerSec: 0
      },
      false
    );
    const launched = stepEnemies(
      spawned.enemies,
      [createPlayer()],
      campaign,
      1,
      spawned.enemySpeed,
      FIXED_TIMESTEP,
      FIXED_TIMESTEP,
      9
    );
    const attacker = launched.enemies.find((enemy) => enemy.motion.kind === 'path' && enemy.motion.path === 'attack');
    if (attacker === undefined || attacker.motion.kind !== 'path') {
      throw new Error('Expected a launched attack path.');
    }

    const almostDone = stepEnemies(
      launched.enemies,
      [createPlayer()],
      campaign,
      launched.direction,
      launched.speed,
      launched.diveTimer,
      attacker.motion.durationSec - FIXED_TIMESTEP,
      launched.rngSeed
    );
    const returningAttacker = almostDone.enemies.find((enemy) => enemy.id === attacker.id);
    if (returningAttacker === undefined) {
      throw new Error('Expected returning attacker.');
    }
    const settled = stepEnemies(
      almostDone.enemies,
      [createPlayer()],
      campaign,
      almostDone.direction,
      almostDone.speed,
      almostDone.diveTimer,
      FIXED_TIMESTEP,
      almostDone.rngSeed
    );
    const settledAttacker = settled.enemies.find((enemy) => enemy.id === attacker.id);
    if (settledAttacker === undefined) {
      throw new Error('Expected settled attacker.');
    }

    expect(Math.abs((returningAttacker.x ?? 0) - settledAttacker.x)).toBeLessThan(10);
    expect(Math.abs((returningAttacker.y ?? 0) - settledAttacker.y)).toBeLessThan(10);
    expect(settledAttacker.motion.kind).toBe('formation');
  });
});
