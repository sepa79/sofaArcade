import {
  ENEMY_COLS,
  ENEMY_ROW_RESPAWN_Y,
  ENEMY_ROWS,
  ROW_RESPAWN_MIN_VERTICAL_GAP,
  ROW_RESPAWN_QUEUE_DELAY_SEC
} from './constants';
import type { Enemy, RowRespawnTicket } from './types';
import { spawnClassicRowInSlot } from './waves';

export function detectNewlyDefeatedRowIndices(
  previousEnemies: ReadonlyArray<Enemy>,
  nextEnemies: ReadonlyArray<Enemy>
): ReadonlyArray<number> {
  const defeatedRows: number[] = [];

  for (let rowIndex = 0; rowIndex < ENEMY_ROWS; rowIndex += 1) {
    const previousRowAlive = previousEnemies.some(
      (enemy) => Math.floor(enemy.id / ENEMY_COLS) === rowIndex && enemy.alive
    );
    const nextRowAlive = nextEnemies.some(
      (enemy) => Math.floor(enemy.id / ENEMY_COLS) === rowIndex && enemy.alive
    );
    if (previousRowAlive && !nextRowAlive) {
      defeatedRows.push(rowIndex);
    }
  }

  return defeatedRows;
}

function queuedRowIndices(tickets: ReadonlyArray<RowRespawnTicket>): ReadonlySet<number> {
  return new Set(tickets.map((ticket) => ticket.rowIndex));
}

function canRespawnQueuedRow(enemies: ReadonlyArray<Enemy>): boolean {
  return !enemies.some(
    (enemy) => enemy.alive && Math.abs(enemy.y - ENEMY_ROW_RESPAWN_Y) < ROW_RESPAWN_MIN_VERTICAL_GAP
  );
}

export function enqueueDefeatedRows(
  queue: ReadonlyArray<RowRespawnTicket>,
  defeatedRowIndices: ReadonlyArray<number>,
  currentTimeSec: number,
  maxAdditionalTickets: number
): ReadonlyArray<RowRespawnTicket> {
  if (!Number.isFinite(currentTimeSec) || currentTimeSec < 0) {
    throw new Error(`currentTimeSec must be a non-negative finite number, got ${currentTimeSec}.`);
  }
  if (!Number.isInteger(maxAdditionalTickets) || maxAdditionalTickets < 0) {
    throw new Error(`maxAdditionalTickets must be a non-negative integer, got ${maxAdditionalTickets}.`);
  }

  if (maxAdditionalTickets === 0 || defeatedRowIndices.length === 0) {
    return queue;
  }

  const queuedRows = queuedRowIndices(queue);
  const nextQueue = queue.slice();
  const lastQueuedTicket = nextQueue[nextQueue.length - 1];
  let nextNotBeforeTimeSec =
    lastQueuedTicket === undefined
      ? currentTimeSec + ROW_RESPAWN_QUEUE_DELAY_SEC
      : lastQueuedTicket.notBeforeTimeSec + ROW_RESPAWN_QUEUE_DELAY_SEC;
  let remainingTicketCapacity = maxAdditionalTickets;

  for (const rowIndex of defeatedRowIndices) {
    if (remainingTicketCapacity === 0 || queuedRows.has(rowIndex)) {
      continue;
    }

    nextQueue.push({
      rowIndex,
      queuedAtTimeSec: currentTimeSec,
      notBeforeTimeSec: nextNotBeforeTimeSec
    });
    nextNotBeforeTimeSec += ROW_RESPAWN_QUEUE_DELAY_SEC;
    remainingTicketCapacity -= 1;
  }

  return nextQueue;
}

export function drainRowRespawnQueue(
  queue: ReadonlyArray<RowRespawnTicket>,
  enemies: ReadonlyArray<Enemy>,
  rngSeed: number,
  currentTimeSec: number,
  nextClassicRowNumber: number | null
): {
  readonly pendingRowRespawns: ReadonlyArray<RowRespawnTicket>;
  readonly enemies: ReadonlyArray<Enemy>;
  readonly rngSeed: number;
  readonly respawnedRow: boolean;
} {
  if (queue.length === 0 || nextClassicRowNumber === null) {
    return {
      pendingRowRespawns: queue,
      enemies,
      rngSeed,
      respawnedRow: false
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
      rngSeed,
      respawnedRow: false
    };
  }

  const respawned = spawnClassicRowInSlot(enemies, nextTicket.rowIndex, nextClassicRowNumber, rngSeed);
  return {
    pendingRowRespawns: queue.slice(1),
    enemies: respawned.enemies,
    rngSeed: respawned.rngSeed,
    respawnedRow: true
  };
}
