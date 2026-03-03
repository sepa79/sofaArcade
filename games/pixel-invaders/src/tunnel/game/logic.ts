import {
  BULLET_DEPTH_SPEED,
  BULLET_HIT_ARC,
  BULLET_HIT_DEPTH,
  BULLET_LIFETIME,
  ENEMY_ANGULAR_SPEED,
  ENEMY_DEPTH_SPEED,
  ENEMY_DIRECTION_SWITCH_INTERVAL,
  PLAYER_ANGULAR_SPEED,
  PLAYER_HIT_ARC,
  PLAYER_INVULNERABILITY,
  PLAYER_JUMP_COOLDOWN,
  PLAYER_JUMP_DURATION,
  PLAYER_SHOOT_COOLDOWN,
  SCORE_PER_ENEMY,
  TAU
} from './constants';
import { createInitialState } from './state';
import type { Bullet, Enemy, FrameInput, GameState } from './types';

function normalizeAngle(theta: number): number {
  const wrapped = theta % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

function angleDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > Math.PI ? TAU - diff : diff;
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function tickTimer(value: number, dt: number): number {
  return Math.max(0, value - dt);
}

function moveEnemies(
  enemies: ReadonlyArray<Enemy>,
  direction: -1 | 1,
  dt: number
): ReadonlyArray<Enemy> {
  return enemies.map((enemy) =>
    enemy.alive
      ? {
          ...enemy,
          theta: normalizeAngle(enemy.theta + direction * ENEMY_ANGULAR_SPEED * dt),
          depth: enemy.depth - ENEMY_DEPTH_SPEED * dt
        }
      : enemy
  );
}

function moveBullets(bullets: ReadonlyArray<Bullet>, dt: number): ReadonlyArray<Bullet> {
  return bullets
    .map((bullet) => ({
      ...bullet,
      depth: bullet.depth + BULLET_DEPTH_SPEED * dt,
      ttl: bullet.ttl - dt
    }))
    .filter((bullet) => bullet.ttl > 0 && bullet.depth <= 1.05);
}

function resolveBulletHits(
  enemies: ReadonlyArray<Enemy>,
  bullets: ReadonlyArray<Bullet>,
  score: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly score: number;
} {
  const aliveById = new Set<number>();
  for (const enemy of enemies) {
    if (enemy.alive) {
      aliveById.add(enemy.id);
    }
  }

  let nextScore = score;
  const survivingBullets: Bullet[] = [];

  for (const bullet of bullets) {
    const hitEnemy = enemies.find(
      (enemy) =>
        enemy.alive &&
        aliveById.has(enemy.id) &&
        angleDistance(enemy.theta, bullet.theta) <= BULLET_HIT_ARC &&
        Math.abs(enemy.depth - bullet.depth) <= BULLET_HIT_DEPTH
    );

    if (hitEnemy === undefined) {
      survivingBullets.push(bullet);
      continue;
    }

    aliveById.delete(hitEnemy.id);
    nextScore += SCORE_PER_ENEMY;
  }

  return {
    enemies: enemies.map((enemy) => ({
      ...enemy,
      alive: aliveById.has(enemy.id)
    })),
    bullets: survivingBullets,
    score: nextScore
  };
}

function resolveTunnelEdge(
  enemies: ReadonlyArray<Enemy>,
  lives: number,
  playerTheta: number,
  playerInvulnerabilityTimer: number,
  playerJumpTimer: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly lives: number;
  readonly playerInvulnerabilityTimer: number;
  readonly phase: 'playing' | 'lost';
} {
  let nextLives = lives;
  let nextInvulnerability = playerInvulnerabilityTimer;

  const nextEnemies = enemies.map((enemy) => {
    if (!enemy.alive || enemy.depth > 0) {
      return enemy;
    }

    const atPlayerSector = angleDistance(enemy.theta, playerTheta) <= PLAYER_HIT_ARC;
    const canDamagePlayer =
      atPlayerSector && nextInvulnerability === 0 && playerJumpTimer === 0 && nextLives > 0;

    if (canDamagePlayer) {
      nextLives -= 1;
      nextInvulnerability = nextLives > 0 ? PLAYER_INVULNERABILITY : 0;
      return {
        ...enemy,
        alive: false,
        depth: 0
      };
    }

    return {
      ...enemy,
      depth: 1
    };
  });

  return {
    enemies: nextEnemies,
    lives: nextLives,
    playerInvulnerabilityTimer: nextInvulnerability,
    phase: nextLives > 0 ? 'playing' : 'lost'
  };
}

function allEnemiesDefeated(enemies: ReadonlyArray<Enemy>): boolean {
  return enemies.every((enemy) => !enemy.alive);
}

export function stepGame(state: GameState, input: FrameInput, dt: number): GameState {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error(`dt must be > 0, got ${dt}.`);
  }

  if (!Number.isFinite(input.moveXSigned) || input.moveXSigned < -1 || input.moveXSigned > 1) {
    throw new Error(`moveXSigned must be in [-1, 1], got ${input.moveXSigned}.`);
  }

  if (state.phase === 'ready') {
    return input.startPressed
      ? {
          ...state,
          phase: 'playing'
        }
      : state;
  }

  if (state.phase === 'paused') {
    return input.pausePressed
      ? {
          ...state,
          phase: 'playing'
        }
      : state;
  }

  if (state.phase === 'won' || state.phase === 'lost') {
    return input.startPressed
      ? {
          ...createInitialState(),
          phase: 'playing'
        }
      : state;
  }

  if (input.pausePressed) {
    return {
      ...state,
      phase: 'paused'
    };
  }

  const moveXSigned = clampSigned(input.moveXSigned);
  const nextPlayerTheta = normalizeAngle(state.playerTheta + moveXSigned * PLAYER_ANGULAR_SPEED * dt);

  let bullets = moveBullets(state.bullets, dt);
  let shootCooldown = tickTimer(state.playerShootCooldownTimer, dt);
  let jumpTimer = tickTimer(state.playerJumpTimer, dt);
  let jumpCooldown = tickTimer(state.playerJumpCooldownTimer, dt);
  const invulnerabilityTimer = tickTimer(state.playerInvulnerabilityTimer, dt);

  if (input.fireHeld && shootCooldown === 0) {
    bullets = bullets.concat({
      theta: nextPlayerTheta,
      depth: 0.02,
      ttl: BULLET_LIFETIME
    });
    shootCooldown = PLAYER_SHOOT_COOLDOWN;
  }

  if (input.jumpPressed && jumpCooldown === 0) {
    jumpTimer = PLAYER_JUMP_DURATION;
    jumpCooldown = PLAYER_JUMP_COOLDOWN;
  }

  let enemyDirection = state.enemyDirection;
  let enemyDirectionTimer = state.enemyDirectionTimer - dt;
  if (enemyDirectionTimer <= 0) {
    enemyDirection = enemyDirection === 1 ? -1 : 1;
    enemyDirectionTimer = ENEMY_DIRECTION_SWITCH_INTERVAL;
  }

  const movedEnemies = moveEnemies(state.enemies, enemyDirection, dt);
  const afterBulletHits = resolveBulletHits(movedEnemies, bullets, state.score);
  const edgeResult = resolveTunnelEdge(
    afterBulletHits.enemies,
    state.lives,
    nextPlayerTheta,
    invulnerabilityTimer,
    jumpTimer
  );

  let phase: GameState['phase'] = edgeResult.phase;
  if (phase === 'playing' && allEnemiesDefeated(edgeResult.enemies)) {
    phase = 'won';
  }

  return {
    phase,
    score: afterBulletHits.score,
    lives: edgeResult.lives,
    playerTheta: nextPlayerTheta,
    playerInvulnerabilityTimer: edgeResult.playerInvulnerabilityTimer,
    playerShootCooldownTimer: shootCooldown,
    playerJumpTimer: jumpTimer,
    playerJumpCooldownTimer: jumpCooldown,
    enemyDirection,
    enemyDirectionTimer,
    enemies: edgeResult.enemies,
    bullets: afterBulletHits.bullets
  };
}
