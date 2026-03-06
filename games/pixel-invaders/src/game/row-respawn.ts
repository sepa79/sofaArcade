import {
  ENEMY_COLS,
  ENEMY_GAP_X,
  ENEMY_ROW_RESPAWN_Y,
  ENEMY_ROW_UFO_CHANCE,
  ENEMY_UFO_HIT_POINTS,
  ENEMY_UFO_SCORE,
  ENEMY_ROWS,
  ENEMY_START_X,
  ROW_RESPAWN_MIN_VERTICAL_GAP,
  ROW_RESPAWN_QUEUE_DELAY_SEC,
  SCORE_PER_ENEMY
} from './constants';
import type { Enemy, RowRespawnTicket } from './types';

interface RandomValue {
  readonly seed: number;
  readonly value: number;
}

function nextRandom(seed: number): RandomValue {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  return {
    seed: nextSeed,
    value: nextSeed / 4294967296
  };
}

function rowHasLivingEnemy(enemies: ReadonlyArray<Enemy>, rowIndex: number): boolean {
  for (const enemy of enemies) {
    if (Math.floor(enemy.id / ENEMY_COLS) !== rowIndex) {
      continue;
    }
    if (enemy.alive) {
      return true;
    }
  }

  return false;
}

function queuedRowIndices(tickets: ReadonlyArray<RowRespawnTicket>): ReadonlySet<number> {
  return new Set(tickets.map((ticket) => ticket.rowIndex));
}

function canRespawnQueuedRow(enemies: ReadonlyArray<Enemy>): boolean {
  return !enemies.some(
    (enemy) => enemy.alive && Math.abs(enemy.y - ENEMY_ROW_RESPAWN_Y) < ROW_RESPAWN_MIN_VERTICAL_GAP
  );
}

function enemyFormationOffsetX(enemies: ReadonlyArray<Enemy>): number {
  const firstEnemy = enemies[0];
  if (firstEnemy === undefined) {
    throw new Error('Enemy formation offset requires at least one enemy.');
  }

  const firstColumn = firstEnemy.id % ENEMY_COLS;
  const firstOffsetX = firstEnemy.x - (ENEMY_START_X + firstColumn * ENEMY_GAP_X);
  for (const enemy of enemies) {
    const column = enemy.id % ENEMY_COLS;
    const offsetX = enemy.x - (ENEMY_START_X + column * ENEMY_GAP_X);
    if (Math.abs(offsetX - firstOffsetX) > 0.0001) {
      throw new Error(
        `Enemy formation X offset is inconsistent: expected ${firstOffsetX}, got ${offsetX} for enemy ${enemy.id}.`
      );
    }
  }

  return firstOffsetX;
}

function respawnRow(
  enemies: ReadonlyArray<Enemy>,
  rowIndex: number,
  rngSeed: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly rngSeed: number;
} {
  const ufoRoll = nextRandom(rngSeed);
  let nextSeed = ufoRoll.seed;
  let ufoColumn: number | null = null;
  const formationOffsetX = enemyFormationOffsetX(enemies);
  if (ufoRoll.value < ENEMY_ROW_UFO_CHANCE) {
    const columnRoll = nextRandom(nextSeed);
    nextSeed = columnRoll.seed;
    ufoColumn = Math.floor(columnRoll.value * ENEMY_COLS);
  }

  const nextEnemies = enemies.map((enemy) => {
    if (Math.floor(enemy.id / ENEMY_COLS) !== rowIndex) {
      return enemy;
    }

    const col = enemy.id % ENEMY_COLS;
    const kind: Enemy['kind'] = ufoColumn === col ? 'ufo' : 'normal';
    return {
      ...enemy,
      alive: true,
      x: formationOffsetX + ENEMY_START_X + col * ENEMY_GAP_X,
      y: ENEMY_ROW_RESPAWN_Y,
      kind,
      scoreValue: kind === 'ufo' ? ENEMY_UFO_SCORE : SCORE_PER_ENEMY,
      hitPoints: kind === 'ufo' ? ENEMY_UFO_HIT_POINTS : 1
    };
  });

  return {
    enemies: nextEnemies,
    rngSeed: nextSeed
  };
}

export function enqueueDefeatedRows(
  queue: ReadonlyArray<RowRespawnTicket>,
  previousEnemies: ReadonlyArray<Enemy>,
  nextEnemies: ReadonlyArray<Enemy>,
  currentTimeSec: number
): ReadonlyArray<RowRespawnTicket> {
  if (!Number.isFinite(currentTimeSec) || currentTimeSec < 0) {
    throw new Error(`currentTimeSec must be a non-negative finite number, got ${currentTimeSec}.`);
  }

  const queuedRows = queuedRowIndices(queue);
  const nextQueue = queue.slice();
  const lastQueuedTicket = nextQueue[nextQueue.length - 1];
  let nextNotBeforeTimeSec =
    lastQueuedTicket === undefined
      ? currentTimeSec + ROW_RESPAWN_QUEUE_DELAY_SEC
      : lastQueuedTicket.notBeforeTimeSec + ROW_RESPAWN_QUEUE_DELAY_SEC;

  for (let rowIndex = 0; rowIndex < ENEMY_ROWS; rowIndex += 1) {
    if (queuedRows.has(rowIndex)) {
      continue;
    }
    if (!rowHasLivingEnemy(previousEnemies, rowIndex) || rowHasLivingEnemy(nextEnemies, rowIndex)) {
      continue;
    }

    nextQueue.push({
      rowIndex,
      queuedAtTimeSec: currentTimeSec,
      notBeforeTimeSec: nextNotBeforeTimeSec
    });
    nextNotBeforeTimeSec += ROW_RESPAWN_QUEUE_DELAY_SEC;
  }

  return nextQueue;
}

export function drainRowRespawnQueue(
  queue: ReadonlyArray<RowRespawnTicket>,
  enemies: ReadonlyArray<Enemy>,
  rngSeed: number,
  currentTimeSec: number
): {
  readonly pendingRowRespawns: ReadonlyArray<RowRespawnTicket>;
  readonly enemies: ReadonlyArray<Enemy>;
  readonly rngSeed: number;
} {
  if (queue.length === 0) {
    return {
      pendingRowRespawns: queue,
      enemies,
      rngSeed
    };
  }

  const nextTicket = queue[0];
  if (nextTicket === undefined) {
    throw new Error('Missing first row respawn ticket.');
  }
  if (currentTimeSec < nextTicket.notBeforeTimeSec || !canRespawnQueuedRow(enemies)) {
    return {
      pendingRowRespawns: queue,
      enemies,
      rngSeed
    };
  }

  const respawned = respawnRow(enemies, nextTicket.rowIndex, rngSeed);
  return {
    pendingRowRespawns: queue.slice(1),
    enemies: respawned.enemies,
    rngSeed: respawned.rngSeed
  };
}
