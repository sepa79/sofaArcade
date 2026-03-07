import {
  PICKUP_FALL_SPEED,
  PICKUP_SIZE,
  PLAYER_ACTIVE_HEIGHT,
  PLAYER_ACTIVE_WIDTH,
  WORLD_HEIGHT
} from './constants';
import { playerLaneWorldY } from './player-lanes';
import { applyPowerup } from './powerups';
import type { Enemy, PickupEntity, PlayerState, PowerupKind } from './types';

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

function randomPickupKind(seed: number): { readonly kind: PowerupKind; readonly seed: number } {
  const roll = nextRandom(seed);
  return {
    kind: roll.value < 0.5 ? 'shield' : 'rapid-fire',
    seed: roll.seed
  };
}

export function spawnPickupsFromDefeatedUfos(
  pickups: ReadonlyArray<PickupEntity>,
  nextPickupId: number,
  rngSeed: number,
  defeatedEnemies: ReadonlyArray<Enemy>
): {
  readonly pickups: ReadonlyArray<PickupEntity>;
  readonly nextPickupId: number;
  readonly rngSeed: number;
} {
  if (!Number.isInteger(nextPickupId) || nextPickupId < 0) {
    throw new Error(`nextPickupId must be a non-negative integer, got ${nextPickupId}.`);
  }

  let mutablePickupId = nextPickupId;
  let nextSeed = rngSeed;
  const spawned: PickupEntity[] = [];

  for (const enemy of defeatedEnemies) {
    if (enemy.kind !== 'ufo') {
      continue;
    }

    const nextKind = randomPickupKind(nextSeed);
    nextSeed = nextKind.seed;
    spawned.push({
      id: mutablePickupId,
      kind: nextKind.kind,
      x: enemy.x,
      y: enemy.y,
      vy: PICKUP_FALL_SPEED
    });
    mutablePickupId += 1;
  }

  if (spawned.length === 0) {
    return {
      pickups,
      nextPickupId,
      rngSeed
    };
  }

  return {
    pickups: pickups.concat(spawned),
    nextPickupId: mutablePickupId,
    rngSeed: nextSeed
  };
}

function canCollectPickup(player: PlayerState, pickup: PickupEntity): boolean {
  if (player.lives <= 0 || player.respawnTimer > 0) {
    return false;
  }

  const laneY = playerLaneWorldY(player.lane);
  return (
    Math.abs(player.x - pickup.x) <= PLAYER_ACTIVE_WIDTH / 2 + PICKUP_SIZE / 2 &&
    Math.abs(laneY - pickup.y) <= PLAYER_ACTIVE_HEIGHT / 2 + PICKUP_SIZE / 2
  );
}

export function stepPickups(
  players: ReadonlyArray<PlayerState>,
  pickups: ReadonlyArray<PickupEntity>,
  dt: number
): {
  readonly players: ReadonlyArray<PlayerState>;
  readonly pickups: ReadonlyArray<PickupEntity>;
} {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error(`dt must be a positive finite number, got ${dt}.`);
  }

  const playersByIndex = new Map<number, PlayerState>(players.map((player) => [player.playerIndex, { ...player }]));
  const nextPickups: PickupEntity[] = [];

  for (const pickup of pickups) {
    const movedPickup: PickupEntity = {
      ...pickup,
      y: pickup.y + pickup.vy * dt
    };

    if (movedPickup.y > WORLD_HEIGHT + PICKUP_SIZE) {
      continue;
    }

    let collectedByPlayerIndex: number | null = null;
    for (const player of players) {
      const currentPlayer = playersByIndex.get(player.playerIndex);
      if (currentPlayer === undefined) {
        throw new Error(`Missing player state for playerIndex ${player.playerIndex}.`);
      }

      if (!canCollectPickup(currentPlayer, movedPickup)) {
        continue;
      }

      collectedByPlayerIndex = currentPlayer.playerIndex;
      playersByIndex.set(currentPlayer.playerIndex, applyPowerup(currentPlayer, movedPickup.kind));
      break;
    }

    if (collectedByPlayerIndex !== null) {
      continue;
    }

    nextPickups.push(movedPickup);
  }

  return {
    players: players.map((player) => {
      const nextPlayer = playersByIndex.get(player.playerIndex);
      if (nextPlayer === undefined) {
        throw new Error(`Missing stepped player state for playerIndex ${player.playerIndex}.`);
      }

      return nextPlayer;
    }),
    pickups: nextPickups
  };
}
