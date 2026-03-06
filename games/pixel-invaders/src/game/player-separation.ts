import {
  PLAYER_COLLISION_WIDTH,
  PLAYER_MOMENTUM_DECAY_PER_SECOND,
  PLAYER_MOMENTUM_GAIN_PER_SECOND,
  PLAYER_MOMENTUM_MAX,
  PLAYER_PUSHBACK_DECAY_PER_SECOND,
  PLAYER_PUSHBACK_SPEED_MAX,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  WORLD_WIDTH
} from './constants';
import type { PlayerState } from './types';

export function clampPlayerX(x: number): number {
  const minX = PLAYER_WIDTH / 2;
  const maxX = WORLD_WIDTH - PLAYER_WIDTH / 2;
  return Math.max(minX, Math.min(maxX, x));
}

export function decayPushbackVelocity(pushbackVelocityX: number, dt: number): number {
  if (!Number.isFinite(pushbackVelocityX)) {
    throw new Error(`pushbackVelocityX must be finite, got ${pushbackVelocityX}.`);
  }
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error(`dt must be a positive finite number, got ${dt}.`);
  }

  const decayAmount = PLAYER_PUSHBACK_DECAY_PER_SECOND * dt;
  if (pushbackVelocityX > 0) {
    return Math.max(0, pushbackVelocityX - decayAmount);
  }

  return Math.min(0, pushbackVelocityX + decayAmount);
}

export function updateRecentMovementMomentum(
  previousMomentum: number,
  movedDistanceX: number,
  dt: number
): number {
  if (!Number.isFinite(previousMomentum) || previousMomentum < 0) {
    throw new Error(`previousMomentum must be a non-negative finite number, got ${previousMomentum}.`);
  }
  if (!Number.isFinite(movedDistanceX) || movedDistanceX < 0) {
    throw new Error(`movedDistanceX must be a non-negative finite number, got ${movedDistanceX}.`);
  }
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error(`dt must be a positive finite number, got ${dt}.`);
  }

  const movementUnit = Math.min(1, movedDistanceX / (PLAYER_SPEED * dt));
  const decayed = Math.max(0, previousMomentum - PLAYER_MOMENTUM_DECAY_PER_SECOND * dt);
  return Math.min(PLAYER_MOMENTUM_MAX, decayed + movementUnit * PLAYER_MOMENTUM_GAIN_PER_SECOND * dt);
}

export function addPushbackVelocity(player: PlayerState, pushbackVelocityDelta: number): PlayerState {
  if (!Number.isFinite(pushbackVelocityDelta)) {
    throw new Error(`pushbackVelocityDelta must be finite, got ${pushbackVelocityDelta}.`);
  }

  const nextPushbackVelocityX = Math.max(
    -PLAYER_PUSHBACK_SPEED_MAX,
    Math.min(PLAYER_PUSHBACK_SPEED_MAX, player.pushbackVelocityX + pushbackVelocityDelta)
  );

  return {
    ...player,
    pushbackVelocityX: nextPushbackVelocityX
  };
}

function resolveOverlapAtIndices(players: PlayerState[], leftIndex: number, rightIndex: number): boolean {
  const left = players[leftIndex];
  const right = players[rightIndex];
  if (left === undefined || right === undefined) {
    throw new Error(`Cannot resolve player overlap for indices ${leftIndex} and ${rightIndex}.`);
  }

  if (left.lane !== right.lane || left.lives <= 0 || right.lives <= 0) {
    return false;
  }

  const minGap = PLAYER_COLLISION_WIDTH;
  const distance = right.x - left.x;
  if (distance >= minGap) {
    return false;
  }

  const overlap = minGap - distance;
  const leftResistance = 1 + left.recentMovementMomentum;
  const rightResistance = 1 + right.recentMovementMomentum;
  const totalResistance = leftResistance + rightResistance;
  const leftShift = overlap * (rightResistance / totalResistance);
  const rightShift = overlap - leftShift;

  let nextLeftX = clampPlayerX(left.x - leftShift);
  let nextRightX = clampPlayerX(right.x + rightShift);
  let remainingOverlap = minGap - (nextRightX - nextLeftX);

  if (remainingOverlap > 0) {
    const leftSpare = nextLeftX - PLAYER_WIDTH / 2;
    const rightSpare = WORLD_WIDTH - PLAYER_WIDTH / 2 - nextRightX;
    if (leftSpare >= rightSpare) {
      const extraLeftShift = Math.min(leftSpare, remainingOverlap);
      nextLeftX -= extraLeftShift;
      remainingOverlap -= extraLeftShift;
    }
    if (remainingOverlap > 0) {
      const extraRightShift = Math.min(rightSpare, remainingOverlap);
      nextRightX += extraRightShift;
      remainingOverlap -= extraRightShift;
    }
  }

  if (remainingOverlap > 0) {
    throw new Error(
      `Players ${left.playerIndex} and ${right.playerIndex} still overlap after separation resolution.`
    );
  }

  players[leftIndex] = {
    ...left,
    x: nextLeftX
  };
  players[rightIndex] = {
    ...right,
    x: nextRightX
  };
  return true;
}

export function resolvePlayerSeparation(players: ReadonlyArray<PlayerState>): ReadonlyArray<PlayerState> {
  const nextPlayers = players.map((player) => ({ ...player }));
  const passes = nextPlayers.length;

  for (let pass = 0; pass < passes; pass += 1) {
    let anyResolved = false;
    const sortedPlayerIndices = nextPlayers
      .map((player, index) => ({ index, lane: player.lane, x: player.x, playerIndex: player.playerIndex }))
      .sort((a, b) => {
        if (a.lane !== b.lane) {
          return a.lane.localeCompare(b.lane);
        }
        if (a.x !== b.x) {
          return a.x - b.x;
        }
        return a.playerIndex - b.playerIndex;
      });

    for (let index = 0; index < sortedPlayerIndices.length - 1; index += 1) {
      const current = sortedPlayerIndices[index];
      const next = sortedPlayerIndices[index + 1];
      if (current === undefined || next === undefined || current.lane !== next.lane) {
        continue;
      }

      anyResolved = resolveOverlapAtIndices(nextPlayers, current.index, next.index) || anyResolved;
    }

    if (!anyResolved) {
      return nextPlayers;
    }
  }

  for (let index = 0; index < nextPlayers.length - 1; index += 1) {
    for (let nextIndex = index + 1; nextIndex < nextPlayers.length; nextIndex += 1) {
      const left = nextPlayers[index];
      const right = nextPlayers[nextIndex];
      if (left === undefined || right === undefined || left.lane !== right.lane || left.lives <= 0 || right.lives <= 0) {
        continue;
      }

      if (Math.abs(right.x - left.x) < PLAYER_COLLISION_WIDTH) {
        throw new Error(`Players ${left.playerIndex} and ${right.playerIndex} overlap after separation passes.`);
      }
    }
  }

  return nextPlayers;
}
