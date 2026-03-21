import { describe, expect, it } from 'vitest';

import { spawnInitialClassicFormation } from './waves';
import { detectNewlyDefeatedRowIndices, drainRowRespawnQueue, enqueueDefeatedRows } from './row-respawn';

describe('row respawn queue', () => {
  it('detects newly defeated classic rows', () => {
    const initial = spawnInitialClassicFormation(71).enemies;
    const next = initial.map((enemy) =>
      enemy.id < 9
        ? {
            ...enemy,
            alive: false
          }
        : enemy
    );

    expect(detectNewlyDefeatedRowIndices(initial, next)).toEqual([0]);
  });

  it('enqueues only as many classic respawns as the campaign still allows', () => {
    const queue = enqueueDefeatedRows([], [0, 1], 1.25, 1);

    expect(queue).toHaveLength(1);
    expect(queue[0]?.rowIndex).toBe(0);
  });

  it('respawns the next classic row into the queued slot', () => {
    const initial = spawnInitialClassicFormation(72);
    const clearedTopRow = initial.enemies.map((enemy) =>
      enemy.id < 9
        ? {
            ...enemy,
            alive: false
          }
        : enemy
    );
    const queue = enqueueDefeatedRows([], [0], 0, 1);
    const respawned = drainRowRespawnQueue(queue, clearedTopRow, initial.rngSeed, 1, 3);

    expect(respawned.pendingRowRespawns).toHaveLength(0);
    expect(respawned.respawnedRow).toBe(true);
    expect(respawned.enemies.filter((enemy) => enemy.id < 9 && enemy.alive)).toHaveLength(9);
  });
});
