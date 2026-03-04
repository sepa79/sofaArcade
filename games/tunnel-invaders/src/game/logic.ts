import {
  ASTEROID_DESPAWN_DEPTH,
  ASTEROID_HIT_ARC,
  ASTEROID_HIT_DEPTH_WINDOW,
  ASTEROID_DEPTH_SPEED,
  ASTEROID_RESPAWN_DEPTH_START,
  ASTEROID_RESPAWN_DEPTH_STEP,
  BULLET_DEPTH_SPEED,
  BULLET_LIFETIME,
  ENEMY_ANGULAR_SPEED,
  ENEMY_BEHIND_DESPAWN_DEPTH,
  ENEMY_BULLET_DEPTH_SPEED,
  ENEMY_BULLET_LIFETIME,
  ENEMY_DEPTH_SPEED,
  ENEMY_DIRECTION_SWITCH_INTERVAL,
  ENEMY_LARGE_HP,
  ENEMY_REINFORCEMENT_BASE_DEPTH,
  ENEMY_REINFORCEMENT_COUNT,
  ENEMY_REINFORCEMENT_DEPTH_STEP,
  ENEMY_REINFORCEMENT_THETA_OFFSET,
  ENEMY_SHOOT_INTERVAL,
  ENEMY_SPIRAL_DEPTH_ACCEL,
  ENEMY_SPIRAL_SPAWN_THETA,
  ENEMY_SPIRAL_SWAY_AMPLITUDE,
  ENEMY_SPIRAL_SWAY_FREQUENCY,
  ENEMY_STANDARD_HP,
  PLAYER_ANGULAR_SPEED,
  PLAYER_INVULNERABILITY,
  PLAYER_JUMP_COOLDOWN,
  PLAYER_JUMP_DURATION,
  PLAYER_SHOOT_COOLDOWN,
  SCORE_PER_ENEMY,
  TAU
} from './constants';
import { enemyHitArc, enemyHitDepthWindow, playerHitArc, playerHitDepthWindow } from './hitbox';
import { createInitialState } from './state';
import type { Asteroid, Bullet, Enemy, EnemyWaveMode, FrameInput, GameState } from './types';

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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function enemyMaxHpForClass(enemyClass: Enemy['enemyClass']): number {
  return enemyClass === 'large' ? ENEMY_LARGE_HP : ENEMY_STANDARD_HP;
}

function moveEnemies(
  enemies: ReadonlyArray<Enemy>,
  direction: -1 | 1,
  enemyWaveMode: EnemyWaveMode,
  dt: number
): ReadonlyArray<Enemy> {
  return enemies.map((enemy) =>
    enemy.alive
      ? (() => {
          const depth01 = clamp01(enemy.depth);
          const spiralProgress = 1 - depth01;
          const baseAngularVelocity = direction * ENEMY_ANGULAR_SPEED;
          const spiralVelocity =
            enemyWaveMode === 'spiral'
              ? baseAngularVelocity * (1 + spiralProgress * ENEMY_SPIRAL_DEPTH_ACCEL) +
                Math.sin(spiralProgress * TAU * ENEMY_SPIRAL_SWAY_FREQUENCY + enemy.id * 0.67) *
                  ENEMY_SPIRAL_SWAY_AMPLITUDE
              : baseAngularVelocity;

          return {
            ...enemy,
            theta: normalizeAngle(enemy.theta + spiralVelocity * dt),
            depth: enemy.depth - ENEMY_DEPTH_SPEED * dt,
            shootCooldown: tickTimer(enemy.shootCooldown, dt)
          };
        })()
      : enemy
  );
}

function moveAsteroids(asteroids: ReadonlyArray<Asteroid>, dt: number): ReadonlyArray<Asteroid> {
  return asteroids.map((asteroid) => {
    const nextTheta = normalizeAngle(asteroid.theta + asteroid.angularSpeed * dt);
    const nextDepth = asteroid.depth - ASTEROID_DEPTH_SPEED * dt;

    if (nextDepth > ASTEROID_DESPAWN_DEPTH) {
      return {
        ...asteroid,
        theta: nextTheta,
        depth: nextDepth
      };
    }

    return {
      ...asteroid,
      theta: normalizeAngle(nextTheta + Math.PI * (0.62 + (asteroid.id % 3) * 0.13)),
      depth: ASTEROID_RESPAWN_DEPTH_START + (asteroid.id % 4) * ASTEROID_RESPAWN_DEPTH_STEP
    };
  });
}

function moveBullets(bullets: ReadonlyArray<Bullet>, dt: number): ReadonlyArray<Bullet> {
  return bullets
    .map((bullet) => ({
      ...bullet,
      depth: bullet.depth + bullet.depthVelocity * dt,
      ttl: bullet.ttl - dt
    }))
    .filter((bullet) => {
      if (bullet.ttl <= 0) {
        return false;
      }

      if (bullet.owner === 'player') {
        return bullet.depth <= 1.05;
      }

      return bullet.depth >= ENEMY_BEHIND_DESPAWN_DEPTH && bullet.depth <= 1.05;
    });
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
  const nextEnemies = enemies.map((enemy) => ({ ...enemy }));
  let nextScore = score;
  const survivingBullets: Bullet[] = [];

  for (const bullet of bullets) {
    if (bullet.owner !== 'player') {
      survivingBullets.push(bullet);
      continue;
    }

    const hitEnemyIndex = nextEnemies.findIndex((enemy) => {
      if (!enemy.alive) {
        return false;
      }

      const hitArc = enemyHitArc(enemy.enemyClass, enemy.depth);
      const hitDepthWindow = enemyHitDepthWindow(enemy.enemyClass, enemy.depth);
      return (
        angleDistance(enemy.theta, bullet.theta) <= hitArc &&
        Math.abs(enemy.depth - bullet.depth) <= hitDepthWindow
      );
    });

    if (hitEnemyIndex === -1) {
      survivingBullets.push(bullet);
      continue;
    }

    const hitEnemy = nextEnemies[hitEnemyIndex];
    if (hitEnemy.hp > 1) {
      nextEnemies[hitEnemyIndex] = {
        ...hitEnemy,
        hp: hitEnemy.hp - 1
      };
      continue;
    }

    nextEnemies[hitEnemyIndex] = {
      ...hitEnemy,
      alive: false,
      hp: 0
    };
    nextScore += SCORE_PER_ENEMY;
  }

  return {
    enemies: nextEnemies,
    bullets: survivingBullets,
    score: nextScore
  };
}

function createEnemyReinforcements(
  sourceEnemy: Enemy,
  nextEnemyId: number,
  enemyWaveMode: EnemyWaveMode
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly nextEnemyId: number;
} {
  const enemies: Enemy[] = [];

  for (let index = 0; index < ENEMY_REINFORCEMENT_COUNT; index += 1) {
    const id = nextEnemyId + index;
    const centeredIndex = index - (ENEMY_REINFORCEMENT_COUNT - 1) / 2;
    const theta =
      enemyWaveMode === 'spiral'
        ? ENEMY_SPIRAL_SPAWN_THETA
        : normalizeAngle(sourceEnemy.theta + centeredIndex * ENEMY_REINFORCEMENT_THETA_OFFSET);
    const maxHp = enemyMaxHpForClass(sourceEnemy.enemyClass);
    enemies.push({
      id,
      theta,
      depth: ENEMY_REINFORCEMENT_BASE_DEPTH + index * ENEMY_REINFORCEMENT_DEPTH_STEP,
      alive: true,
      enemyClass: sourceEnemy.enemyClass,
      maxHp,
      hp: maxHp,
      shootCooldown: enemyWaveMode === 'spiral' ? (index + 1) * 0.34 : (index + 1) * 0.24
    });
  }

  return {
    enemies,
    nextEnemyId: nextEnemyId + ENEMY_REINFORCEMENT_COUNT
  };
}

function resolveEnemyBulletHits(
  bullets: ReadonlyArray<Bullet>,
  lives: number,
  playerTheta: number,
  playerInvulnerabilityTimer: number,
  playerJumpTimer: number
): {
  readonly bullets: ReadonlyArray<Bullet>;
  readonly lives: number;
  readonly playerInvulnerabilityTimer: number;
  readonly phase: 'playing' | 'lost';
} {
  let nextLives = lives;
  let nextInvulnerability = playerInvulnerabilityTimer;
  const playerArc = playerHitArc();
  const playerDepthWindow = playerHitDepthWindow();
  const survivingBullets: Bullet[] = [];

  for (const bullet of bullets) {
    if (bullet.owner !== 'enemy') {
      survivingBullets.push(bullet);
      continue;
    }

    if (Math.abs(bullet.depth) > playerDepthWindow) {
      survivingBullets.push(bullet);
      continue;
    }

    const atPlayerSector = angleDistance(bullet.theta, playerTheta) <= playerArc;
    const canDamagePlayer =
      atPlayerSector && nextInvulnerability === 0 && playerJumpTimer === 0 && nextLives > 0;

    if (canDamagePlayer) {
      nextLives -= 1;
      nextInvulnerability = nextLives > 0 ? PLAYER_INVULNERABILITY : 0;
    }
  }

  return {
    bullets: survivingBullets,
    lives: nextLives,
    playerInvulnerabilityTimer: nextInvulnerability,
    phase: nextLives > 0 ? 'playing' : 'lost'
  };
}

function resolveEnemyLifecycle(
  enemies: ReadonlyArray<Enemy>,
  bullets: ReadonlyArray<Bullet>,
  nextEnemyId: number,
  enemyWaveMode: EnemyWaveMode,
  lives: number,
  playerTheta: number,
  playerInvulnerabilityTimer: number,
  playerJumpTimer: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly nextEnemyId: number;
  readonly lives: number;
  readonly playerInvulnerabilityTimer: number;
  readonly phase: 'playing' | 'lost';
} {
  let nextLives = lives;
  let nextInvulnerability = playerInvulnerabilityTimer;
  const playerArc = playerHitArc();
  let nextNextEnemyId = nextEnemyId;
  let nextBullets = bullets.slice();
  const nextEnemies: Enemy[] = [];

  for (const enemy of enemies) {
    if (!enemy.alive) {
      nextEnemies.push(enemy);
      continue;
    }

    let current = enemy;

    if (current.depth <= 0) {
      const atPlayerSector = angleDistance(current.theta, playerTheta) <= playerArc;
      const canDamagePlayer =
        atPlayerSector && nextInvulnerability === 0 && playerJumpTimer === 0 && nextLives > 0;

      if (canDamagePlayer) {
        nextLives -= 1;
        nextInvulnerability = nextLives > 0 ? PLAYER_INVULNERABILITY : 0;
        nextEnemies.push({
          ...current,
          alive: false,
          depth: 0
        });
        continue;
      }
    }

    const canShootFromFront = current.enemyClass === 'large' && current.depth >= 0;
    if (current.depth < 0 || canShootFromFront) {
      if (current.shootCooldown === 0) {
        const depthVelocity = current.depth >= 0 ? -ENEMY_BULLET_DEPTH_SPEED : ENEMY_BULLET_DEPTH_SPEED;
        nextBullets = nextBullets.concat({
          theta: current.theta,
          depth: current.depth,
          depthVelocity,
          ttl: ENEMY_BULLET_LIFETIME,
          owner: 'enemy'
        });
        current = {
          ...current,
          shootCooldown: ENEMY_SHOOT_INTERVAL
        };
      }

      if (current.depth <= ENEMY_BEHIND_DESPAWN_DEPTH) {
        const reinforcement = createEnemyReinforcements(current, nextNextEnemyId, enemyWaveMode);
        nextNextEnemyId = reinforcement.nextEnemyId;
        nextEnemies.push(...reinforcement.enemies);
        continue;
      }
    }

    nextEnemies.push(current);
  }

  const enemyBulletHits = resolveEnemyBulletHits(
    nextBullets,
    nextLives,
    playerTheta,
    nextInvulnerability,
    playerJumpTimer
  );

  return {
    enemies: nextEnemies,
    bullets: enemyBulletHits.bullets,
    nextEnemyId: nextNextEnemyId,
    lives: enemyBulletHits.lives,
    playerInvulnerabilityTimer: enemyBulletHits.playerInvulnerabilityTimer,
    phase: enemyBulletHits.phase
  };
}

function resolveAsteroidHits(
  asteroids: ReadonlyArray<Asteroid>,
  lives: number,
  playerTheta: number,
  playerInvulnerabilityTimer: number,
  playerJumpTimer: number
): {
  readonly lives: number;
  readonly playerInvulnerabilityTimer: number;
  readonly phase: 'playing' | 'lost';
} {
  let nextLives = lives;
  let nextInvulnerability = playerInvulnerabilityTimer;

  for (const asteroid of asteroids) {
    if (Math.abs(asteroid.depth) > ASTEROID_HIT_DEPTH_WINDOW) {
      continue;
    }

    const atPlayerSector = angleDistance(asteroid.theta, playerTheta) <= ASTEROID_HIT_ARC;
    const canDamagePlayer =
      atPlayerSector && nextInvulnerability === 0 && playerJumpTimer === 0 && nextLives > 0;

    if (!canDamagePlayer) {
      continue;
    }

    nextLives -= 1;
    nextInvulnerability = nextLives > 0 ? PLAYER_INVULNERABILITY : 0;
  }

  return {
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
          ...createInitialState(state.enemyWaveMode),
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
      depthVelocity: BULLET_DEPTH_SPEED,
      ttl: BULLET_LIFETIME,
      owner: 'player'
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

  const movedEnemies = moveEnemies(state.enemies, enemyDirection, state.enemyWaveMode, dt);
  const movedAsteroids = moveAsteroids(state.asteroids, dt);
  const afterBulletHits = resolveBulletHits(movedEnemies, bullets, state.score);
  const lifecycleResult = resolveEnemyLifecycle(
    afterBulletHits.enemies,
    afterBulletHits.bullets,
    state.nextEnemyId,
    state.enemyWaveMode,
    state.lives,
    nextPlayerTheta,
    invulnerabilityTimer,
    jumpTimer
  );
  const asteroidHits = resolveAsteroidHits(
    movedAsteroids,
    lifecycleResult.lives,
    nextPlayerTheta,
    lifecycleResult.playerInvulnerabilityTimer,
    jumpTimer
  );

  let phase: GameState['phase'] = lifecycleResult.phase;
  if (phase === 'playing' && asteroidHits.phase === 'lost') {
    phase = 'lost';
  }
  if (phase === 'playing' && allEnemiesDefeated(lifecycleResult.enemies)) {
    phase = 'won';
  }

  return {
    phase,
    score: afterBulletHits.score,
    lives: asteroidHits.lives,
    playerTheta: nextPlayerTheta,
    playerInvulnerabilityTimer: asteroidHits.playerInvulnerabilityTimer,
    playerShootCooldownTimer: shootCooldown,
    playerJumpTimer: jumpTimer,
    playerJumpCooldownTimer: jumpCooldown,
    enemyDirection,
    enemyDirectionTimer,
    enemyWaveMode: state.enemyWaveMode,
    nextEnemyId: lifecycleResult.nextEnemyId,
    enemies: lifecycleResult.enemies,
    asteroids: movedAsteroids,
    bullets: lifecycleResult.bullets
  };
}
