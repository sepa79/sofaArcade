import { BULLET_HEIGHT, BULLET_WIDTH, PLAYER_FRIENDLY_FIRE_PUSHBACK_DISTANCE, PLAYER_FRIENDLY_FIRE_PUSHBACK_VELOCITY } from './constants';
import { collideEnemyBulletWithPlayer, type CollisionRuntime, type MutableCollisionDebugFrame } from './collision';
import { canHitLaneAbove, playerLaneWorldY } from './player-lanes';
import { addPushbackVelocity, clampPlayerX } from './player-separation';
import type { Bullet, PlayerState } from './types';

interface FriendlyFireHit {
  readonly targetPlayerIndex: number;
  readonly pushDirectionX: -1 | 1;
}

function pushDirection(shooterX: number, targetX: number): -1 | 1 {
  return shooterX <= targetX ? 1 : -1;
}

export function resolveFriendlyFire(
  players: ReadonlyArray<PlayerState>,
  bullets: ReadonlyArray<Bullet>,
  dt: number,
  collisionRuntime: CollisionRuntime,
  collisionDebug: MutableCollisionDebugFrame | null
): {
  readonly players: ReadonlyArray<PlayerState>;
  readonly bullets: ReadonlyArray<Bullet>;
} {
  const playersByIndex = new Map<number, PlayerState>(players.map((player) => [player.playerIndex, { ...player }]));
  const accumulatedPushDirection = new Map<number, number>();
  const nextBullets: Bullet[] = [];

  for (const bullet of bullets) {
    if (bullet.owner !== 'player') {
      nextBullets.push(bullet);
      continue;
    }
    if (bullet.playerIndex === null) {
      throw new Error('Player-owned bullet is missing playerIndex.');
    }

    const shooter = playersByIndex.get(bullet.playerIndex);
    if (shooter === undefined) {
      throw new Error(`Missing shooter for playerIndex ${bullet.playerIndex}.`);
    }

    const segmentStartX = bullet.x;
    const segmentStartY = bullet.y - bullet.vy * dt;
    const segmentEndX = bullet.x;
    const segmentEndY = bullet.y;

    let bestHit: FriendlyFireHit | null = null;
    let bestT = Number.POSITIVE_INFINITY;

    for (const target of playersByIndex.values()) {
      if (target.playerIndex === shooter.playerIndex || target.lives <= 0 || target.respawnTimer > 0) {
        continue;
      }
      if (!canHitLaneAbove(shooter.lane, target.lane)) {
        continue;
      }

      const hit = collideEnemyBulletWithPlayer(
        collisionRuntime,
        target.x,
        playerLaneWorldY(target.lane),
        segmentStartX,
        segmentStartY,
        segmentEndX,
        segmentEndY,
        BULLET_WIDTH,
        BULLET_HEIGHT,
        collisionDebug
      );
      if (!hit.hit || hit.t >= bestT) {
        continue;
      }

      bestT = hit.t;
      bestHit = {
        targetPlayerIndex: target.playerIndex,
        pushDirectionX: pushDirection(shooter.x, target.x)
      };
    }

    if (bestHit === null) {
      nextBullets.push(bullet);
      continue;
    }

    accumulatedPushDirection.set(
      bestHit.targetPlayerIndex,
      (accumulatedPushDirection.get(bestHit.targetPlayerIndex) ?? 0) + bestHit.pushDirectionX
    );
  }

  const nextPlayers = players.map((player) => {
    const pushDirectionX = accumulatedPushDirection.get(player.playerIndex);
    if (pushDirectionX === undefined || pushDirectionX === 0) {
      return playersByIndex.get(player.playerIndex) ?? player;
    }

    const nextPlayer = playersByIndex.get(player.playerIndex);
    if (nextPlayer === undefined) {
      throw new Error(`Missing resolved player for playerIndex ${player.playerIndex}.`);
    }

    const normalizedDirection: -1 | 1 = pushDirectionX > 0 ? 1 : -1;
    return addPushbackVelocity(
      {
        ...nextPlayer,
        x: clampPlayerX(nextPlayer.x + normalizedDirection * PLAYER_FRIENDLY_FIRE_PUSHBACK_DISTANCE)
      },
      normalizedDirection * PLAYER_FRIENDLY_FIRE_PUSHBACK_VELOCITY
    );
  });

  return {
    players: nextPlayers,
    bullets: nextBullets
  };
}
