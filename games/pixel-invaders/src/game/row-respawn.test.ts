import { describe, expect, it } from 'vitest';

import { ENEMY_COLS, ENEMY_ROW_RESPAWN_Y, ENEMY_START_X, ROW_RESPAWN_QUEUE_DELAY_SEC } from './constants';
import { drainRowRespawnQueue, enqueueDefeatedRows } from './row-respawn';
import { createInitialState } from './state';

describe('row respawn queue', () => {
  it('queues only newly defeated rows and spaces tickets in FIFO order', () => {
    const state = createInitialState(71, 1);
    const nextEnemies = state.enemies.map((enemy) =>
      enemy.id < ENEMY_COLS * 2
        ? {
            ...enemy,
            alive: false
          }
        : enemy
    );

    const queue = enqueueDefeatedRows([], state.enemies, nextEnemies, 1.25);

    expect(queue).toHaveLength(2);
    expect(queue[0]?.rowIndex).toBe(0);
    expect(queue[0]?.notBeforeTimeSec).toBe(1.25 + ROW_RESPAWN_QUEUE_DELAY_SEC);
    expect(queue[1]?.rowIndex).toBe(1);
    expect(queue[1]?.notBeforeTimeSec).toBe(1.25 + ROW_RESPAWN_QUEUE_DELAY_SEC * 2);
  });

  it('keeps queued row invisible until there is space to respawn it', () => {
    const state = createInitialState(72, 1);
    const deadTopRow = state.enemies.map((enemy) =>
      enemy.id < ENEMY_COLS
        ? {
            ...enemy,
            alive: false
          }
        : enemy.id < ENEMY_COLS * 2
          ? {
              ...enemy,
              y: ENEMY_ROW_RESPAWN_Y + 20
            }
          : enemy
    );
    const queue = enqueueDefeatedRows([], state.enemies, deadTopRow, 0);

    const blocked = drainRowRespawnQueue(queue, deadTopRow, 99, 1);
    expect(blocked.pendingRowRespawns).toHaveLength(1);
    expect(blocked.enemies.filter((enemy) => enemy.id < ENEMY_COLS).every((enemy) => !enemy.alive)).toBe(true);

    const clearedSpaceEnemies = deadTopRow.map((enemy) =>
      enemy.id < ENEMY_COLS * 2 && enemy.id >= ENEMY_COLS
        ? {
            ...enemy,
            y: ENEMY_ROW_RESPAWN_Y + 80
          }
        : enemy
    );
    const respawned = drainRowRespawnQueue(queue, clearedSpaceEnemies, 99, 1);
    expect(respawned.pendingRowRespawns).toHaveLength(0);
    expect(respawned.enemies.filter((enemy) => enemy.id < ENEMY_COLS).every((enemy) => enemy.alive)).toBe(true);
    expect(respawned.enemies[0]?.x).toBe(ENEMY_START_X);
  });

  it('respawns queued row with the current formation x offset', () => {
    const state = createInitialState(73, 1);
    const shiftedEnemies = state.enemies.map((enemy) => ({
      ...enemy,
      x: enemy.x + 96
    }));
    const defeatedTopRow = shiftedEnemies.map((enemy) =>
      enemy.id < ENEMY_COLS
        ? {
            ...enemy,
            alive: false
          }
        : enemy
    );
    const queue = enqueueDefeatedRows([], shiftedEnemies, defeatedTopRow, 0);

    const respawned = drainRowRespawnQueue(queue, defeatedTopRow, 99, 1);
    const topRowEnemies = respawned.enemies.filter((enemy) => enemy.id < ENEMY_COLS);

    expect(topRowEnemies[0]?.x).toBe(ENEMY_START_X + 96);
    expect(topRowEnemies[1]?.x).toBe(ENEMY_START_X + 96 + state.enemies[1].x - state.enemies[0].x);
  });
});
