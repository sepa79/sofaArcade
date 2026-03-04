import {
  ASTEROID_COLLISION_BOUNCE_DEPTH,
  ASTEROID_COLLISION_SHIELD_DAMAGE,
  ASTEROID_DEPTH_SPEED,
  ASTEROID_DESPAWN_DEPTH,
  ASTEROID_HIT_ARC,
  ASTEROID_HIT_DEPTH_WINDOW,
  ASTEROID_LATERAL_FOLLOW_SPEED,
  ASTEROID_LATERAL_SWAY_AMPLITUDE,
  ASTEROID_LATERAL_SWAY_FREQUENCY,
  ASTEROID_RESPAWN_DEPTH_START,
  ASTEROID_RESPAWN_DEPTH_STEP,
  BULLET_DEPTH_SPEED,
  BULLET_LIFETIME,
  ENEMY_BEHIND_DESPAWN_DEPTH,
  ENEMY_BULLET_DEPTH_SPEED,
  ENEMY_BULLET_LIFETIME,
  ENEMY_BULLET_SHIELD_DAMAGE,
  ENEMY_COLLISION_BOUNCE_DEPTH,
  ENEMY_COLLISION_SHIELD_DAMAGE_LARGE,
  ENEMY_COLLISION_SHIELD_DAMAGE_STANDARD,
  ENEMY_DEPTH_SPEED,
  ENEMY_FORMATION_CENTER_THETA,
  ENEMY_FORMATION_SWEEP_ARC,
  ENEMY_FORMATION_SWEEP_SPEED,
  ENEMY_LARGE_SWEEP_ARC,
  ENEMY_SHOOT_INTERVAL,
  ENEMY_SHOOT_INTERVAL_BEHIND,
  PLAYER_ANGULAR_SPEED,
  PLAYER_COLLISION_INVULNERABILITY,
  PLAYER_COLLISION_THETA_PUSH,
  PLAYER_DEATH_SEQUENCE_DURATION,
  PLAYER_INVULNERABILITY,
  PLAYER_JUMP_COOLDOWN,
  PLAYER_JUMP_DURATION,
  PLAYER_RESPAWN_ENTRY_DURATION,
  PLAYER_RESPAWN_INVULNERABILITY,
  PLAYER_SHIELD_MAX,
  PLAYER_SHIELD_REGEN_DELAY,
  PLAYER_SHIELD_REGEN_PER_SECOND,
  PLAYER_SHOOT_COOLDOWN,
  PLAYER_SPIN_DAMPING_PER_SECOND,
  PLAYER_SPIN_IMPULSE,
  SCORE_PER_ENEMY,
  TAU
} from './constants';
import { enemyHitArc, enemyHitDepthWindow, playerHitArc, playerHitDepthWindow } from './hitbox';
import { createEnemyWave, createInitialState } from './state';
import type { Asteroid, Bullet, Enemy, FrameInput, GameState } from './types';

interface PlayerImpactState {
  readonly lives: number;
  readonly shield: number;
  readonly shieldRegenDelayTimer: number;
  readonly invulnerabilityTimer: number;
  readonly deathTimer: number;
  readonly respawnEntryTimer: number;
  readonly spinVelocity: number;
  readonly phase: 'playing' | 'lost';
}

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

function shortestAngleDelta(fromTheta: number, toTheta: number): number {
  const wrapped = normalizeAngle(toTheta - fromTheta);
  return wrapped > Math.PI ? wrapped - TAU : wrapped;
}

function moveAngleTowards(currentTheta: number, targetTheta: number, maxStep: number): number {
  const delta = shortestAngleDelta(currentTheta, targetTheta);
  if (Math.abs(delta) <= maxStep) {
    return normalizeAngle(targetTheta);
  }

  return normalizeAngle(currentTheta + Math.sign(delta) * maxStep);
}

function dampSignedVelocity(value: number, dampingPerSecond: number, dt: number): number {
  const damping = dampingPerSecond * dt;
  if (Math.abs(value) <= damping) {
    return 0;
  }

  return value - Math.sign(value) * damping;
}

function moveEnemies(
  enemies: ReadonlyArray<Enemy>,
  formationCenterTheta: number,
  formationDirection: -1 | 1,
  dt: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly formationCenterTheta: number;
  readonly formationDirection: -1 | 1;
} {
  const centerDelta = shortestAngleDelta(ENEMY_FORMATION_CENTER_THETA, formationCenterTheta);
  let nextDirection: -1 | 1 = formationDirection;
  let nextCenterDelta = centerDelta + nextDirection * ENEMY_FORMATION_SWEEP_SPEED * dt;

  if (nextCenterDelta > ENEMY_FORMATION_SWEEP_ARC) {
    const overflow = nextCenterDelta - ENEMY_FORMATION_SWEEP_ARC;
    nextCenterDelta = ENEMY_FORMATION_SWEEP_ARC - overflow;
    nextDirection = -1;
  } else if (nextCenterDelta < -ENEMY_FORMATION_SWEEP_ARC) {
    const overflow = -ENEMY_FORMATION_SWEEP_ARC - nextCenterDelta;
    nextCenterDelta = -ENEMY_FORMATION_SWEEP_ARC + overflow;
    nextDirection = 1;
  }

  const nextFormationCenterTheta = normalizeAngle(ENEMY_FORMATION_CENTER_THETA + nextCenterDelta);
  const enemiesNext = enemies.map((enemy) => {
    if (!enemy.alive) {
      return enemy;
    }

    const baseDepth = enemy.depth - ENEMY_DEPTH_SPEED * dt;
    if (enemy.motion === 'formation') {
      return {
        ...enemy,
        theta: normalizeAngle(nextFormationCenterTheta + enemy.laneTheta),
        depth: baseDepth,
        shootCooldown: tickTimer(enemy.shootCooldown, dt)
      };
    }

    let nextLaneTheta = enemy.laneTheta + enemy.lateralSpeed * dt;
    let nextLateralSpeed = enemy.lateralSpeed;
    if (nextLaneTheta > ENEMY_LARGE_SWEEP_ARC) {
      const overflow = nextLaneTheta - ENEMY_LARGE_SWEEP_ARC;
      nextLaneTheta = ENEMY_LARGE_SWEEP_ARC - overflow;
      nextLateralSpeed = -Math.abs(nextLateralSpeed);
    } else if (nextLaneTheta < -ENEMY_LARGE_SWEEP_ARC) {
      const overflow = -ENEMY_LARGE_SWEEP_ARC - nextLaneTheta;
      nextLaneTheta = -ENEMY_LARGE_SWEEP_ARC + overflow;
      nextLateralSpeed = Math.abs(nextLateralSpeed);
    }

    return {
      ...enemy,
      laneTheta: nextLaneTheta,
      lateralSpeed: nextLateralSpeed,
      theta: normalizeAngle(nextFormationCenterTheta + nextLaneTheta),
      depth: baseDepth,
      shootCooldown: tickTimer(enemy.shootCooldown, dt)
    };
  });

  return {
    enemies: enemiesNext,
    formationCenterTheta: nextFormationCenterTheta,
    formationDirection: nextDirection
  };
}

function moveAsteroids(asteroids: ReadonlyArray<Asteroid>, dt: number): ReadonlyArray<Asteroid> {
  return asteroids.map((asteroid) => {
    const nextLaneTheta = normalizeAngle(asteroid.laneTheta + asteroid.angularSpeed * dt);
    const nextDepth = asteroid.depth - ASTEROID_DEPTH_SPEED * dt;
    const approachProgress = 1 - clamp01(nextDepth);
    const sway =
      Math.sin(approachProgress * TAU * ASTEROID_LATERAL_SWAY_FREQUENCY + asteroid.id * 0.93) *
      ASTEROID_LATERAL_SWAY_AMPLITUDE;
    const desiredTheta = normalizeAngle(nextLaneTheta + sway);
    const nextTheta = moveAngleTowards(asteroid.theta, desiredTheta, ASTEROID_LATERAL_FOLLOW_SPEED * dt);

    if (nextDepth > ASTEROID_DESPAWN_DEPTH) {
      return {
        ...asteroid,
        laneTheta: nextLaneTheta,
        theta: nextTheta,
        depth: nextDepth
      };
    }

    return {
      ...asteroid,
      laneTheta: nextLaneTheta,
      theta: nextTheta,
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
    if (hitEnemy === undefined) {
      throw new Error(`Enemy at hit index ${hitEnemyIndex} is missing.`);
    }

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

function collisionSpinDirection(playerTheta: number, impactTheta: number): -1 | 1 {
  const delta = shortestAngleDelta(playerTheta, impactTheta);
  if (delta < 0) {
    return -1;
  }

  return 1;
}

function applyShieldDamage(
  current: PlayerImpactState,
  damage: number,
  playerTheta: number,
  impactTheta: number
): PlayerImpactState {
  if (current.phase !== 'playing' || current.lives <= 0) {
    return current;
  }

  if (current.invulnerabilityTimer > 0) {
    return current;
  }

  const spinDirection = collisionSpinDirection(playerTheta, impactTheta);
  const nextSpinVelocity = current.spinVelocity + spinDirection * PLAYER_SPIN_IMPULSE;
  const remainingShield = Math.max(0, current.shield - damage);

  if (remainingShield > 0) {
    return {
      ...current,
      shield: remainingShield,
      shieldRegenDelayTimer: PLAYER_SHIELD_REGEN_DELAY,
      invulnerabilityTimer: PLAYER_COLLISION_INVULNERABILITY,
      spinVelocity: nextSpinVelocity
    };
  }

  const remainingLives = current.lives - 1;
  if (remainingLives <= 0) {
    return {
      ...current,
      lives: 0,
      shield: 0,
      shieldRegenDelayTimer: 0,
      invulnerabilityTimer: 0,
      deathTimer: PLAYER_DEATH_SEQUENCE_DURATION,
      respawnEntryTimer: 0,
      spinVelocity: nextSpinVelocity,
      phase: 'lost'
    };
  }

  return {
    ...current,
    lives: remainingLives,
    shield: PLAYER_SHIELD_MAX,
    shieldRegenDelayTimer: PLAYER_SHIELD_REGEN_DELAY,
    invulnerabilityTimer:
      PLAYER_RESPAWN_INVULNERABILITY +
      PLAYER_RESPAWN_ENTRY_DURATION +
      PLAYER_DEATH_SEQUENCE_DURATION,
    deathTimer: PLAYER_DEATH_SEQUENCE_DURATION,
    respawnEntryTimer: PLAYER_DEATH_SEQUENCE_DURATION + PLAYER_RESPAWN_ENTRY_DURATION,
    spinVelocity: nextSpinVelocity,
    phase: 'playing'
  };
}

function resolveEnemyLifecycle(
  enemies: ReadonlyArray<Enemy>,
  bullets: ReadonlyArray<Bullet>,
  playerTheta: number,
  playerJumpTimer: number,
  playerImpact: PlayerImpactState
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly playerImpact: PlayerImpactState;
} {
  const playerArc = playerHitArc();
  const playerDepthWindow = playerHitDepthWindow();
  const nextEnemies: Enemy[] = [];
  let nextBullets = bullets.slice();
  let nextImpact = playerImpact;

  for (const enemy of enemies) {
    if (!enemy.alive) {
      nextEnemies.push(enemy);
      continue;
    }

    let current = enemy;

    if (current.depth >= 0 && current.shootCooldown === 0) {
      nextBullets = nextBullets.concat({
        theta: current.theta,
        depth: current.depth,
        depthVelocity: -ENEMY_BULLET_DEPTH_SPEED,
        ttl: ENEMY_BULLET_LIFETIME,
        owner: 'enemy'
      });
      current = {
        ...current,
        shootCooldown: ENEMY_SHOOT_INTERVAL
      };
    } else if (current.depth < 0 && current.shootCooldown === 0) {
      nextBullets = nextBullets.concat({
        theta: current.theta,
        depth: current.depth,
        depthVelocity: ENEMY_BULLET_DEPTH_SPEED,
        ttl: ENEMY_BULLET_LIFETIME,
        owner: 'enemy'
      });
      current = {
        ...current,
        shootCooldown: ENEMY_SHOOT_INTERVAL_BEHIND
      };
    }

    const atPlayerSector = angleDistance(current.theta, playerTheta) <= playerArc;
    const atPlayerDepth = Math.abs(current.depth) <= playerDepthWindow;
    const canCollide =
      atPlayerSector &&
      atPlayerDepth &&
      playerJumpTimer === 0 &&
      nextImpact.phase === 'playing' &&
      nextImpact.deathTimer === 0 &&
      nextImpact.respawnEntryTimer === 0;

    if (canCollide) {
      const collisionDamage =
        current.enemyClass === 'large'
          ? ENEMY_COLLISION_SHIELD_DAMAGE_LARGE
          : ENEMY_COLLISION_SHIELD_DAMAGE_STANDARD;
      nextImpact = applyShieldDamage(nextImpact, collisionDamage, playerTheta, current.theta);

      const pushDirection = collisionSpinDirection(playerTheta, current.theta);
      const laneShift = pushDirection * PLAYER_COLLISION_THETA_PUSH;
      const nextLaneTheta =
        current.motion === 'formation'
          ? current.laneTheta + laneShift
          : current.laneTheta + laneShift * 0.45;

      current = {
        ...current,
        laneTheta: nextLaneTheta,
        theta: normalizeAngle(current.theta + laneShift),
        depth: Math.max(current.depth, ENEMY_COLLISION_BOUNCE_DEPTH),
        lateralSpeed:
          current.motion === 'sweeper' ? -current.lateralSpeed : current.lateralSpeed,
        shootCooldown: Math.max(current.shootCooldown, 0.85)
      };
    }

    if (current.depth <= ENEMY_BEHIND_DESPAWN_DEPTH) {
      nextEnemies.push({
        ...current,
        alive: false
      });
      continue;
    }

    nextEnemies.push(current);
  }

  return {
    enemies: nextEnemies,
    bullets: nextBullets,
    playerImpact: nextImpact
  };
}

function resolveEnemyBulletHits(
  bullets: ReadonlyArray<Bullet>,
  playerTheta: number,
  playerJumpTimer: number,
  playerImpact: PlayerImpactState
): {
  readonly bullets: ReadonlyArray<Bullet>;
  readonly playerImpact: PlayerImpactState;
} {
  const playerArc = playerHitArc();
  const playerDepthWindow = playerHitDepthWindow();
  const survivingBullets: Bullet[] = [];
  let nextImpact = playerImpact;

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
    if (!atPlayerSector) {
      survivingBullets.push(bullet);
      continue;
    }

    if (
      playerJumpTimer === 0 &&
      nextImpact.phase === 'playing' &&
      nextImpact.deathTimer === 0 &&
      nextImpact.respawnEntryTimer === 0
    ) {
      nextImpact = applyShieldDamage(nextImpact, ENEMY_BULLET_SHIELD_DAMAGE, playerTheta, bullet.theta);
    }
  }

  return {
    bullets: survivingBullets,
    playerImpact: nextImpact
  };
}

function resolveAsteroidHits(
  asteroids: ReadonlyArray<Asteroid>,
  playerTheta: number,
  playerJumpTimer: number,
  playerImpact: PlayerImpactState
): {
  readonly asteroids: ReadonlyArray<Asteroid>;
  readonly playerImpact: PlayerImpactState;
} {
  let nextImpact = playerImpact;
  const nextAsteroids: Asteroid[] = [];

  for (const asteroid of asteroids) {
    const atPlayerDepth = Math.abs(asteroid.depth) <= ASTEROID_HIT_DEPTH_WINDOW;
    const atPlayerSector = angleDistance(asteroid.theta, playerTheta) <= ASTEROID_HIT_ARC;
    const canCollide =
      atPlayerDepth &&
      atPlayerSector &&
      playerJumpTimer === 0 &&
      nextImpact.phase === 'playing' &&
      nextImpact.deathTimer === 0 &&
      nextImpact.respawnEntryTimer === 0;

    if (!canCollide) {
      nextAsteroids.push(asteroid);
      continue;
    }

    nextImpact = applyShieldDamage(nextImpact, ASTEROID_COLLISION_SHIELD_DAMAGE, playerTheta, asteroid.theta);
    const pushDirection = collisionSpinDirection(playerTheta, asteroid.theta);
    const laneShift = pushDirection * PLAYER_COLLISION_THETA_PUSH;

    nextAsteroids.push({
      ...asteroid,
      laneTheta: normalizeAngle(asteroid.laneTheta + laneShift),
      theta: normalizeAngle(asteroid.theta + laneShift),
      depth: Math.max(asteroid.depth, ASTEROID_COLLISION_BOUNCE_DEPTH),
      angularSpeed: -asteroid.angularSpeed
    });
  }

  return {
    asteroids: nextAsteroids,
    playerImpact: nextImpact
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

  const deathTimer = tickTimer(state.playerDeathTimer, dt);
  const respawnEntryTimer = tickTimer(state.playerRespawnEntryTimer, dt);
  const canControlPlayer = deathTimer === 0 && respawnEntryTimer === 0;
  const moveXSigned = canControlPlayer ? clampSigned(input.moveXSigned) : 0;

  const nextSpinVelocity = dampSignedVelocity(state.playerSpinVelocity, PLAYER_SPIN_DAMPING_PER_SECOND, dt);
  const nextPlayerTheta = normalizeAngle(
    state.playerTheta + (moveXSigned * PLAYER_ANGULAR_SPEED + nextSpinVelocity) * dt
  );

  let bullets = moveBullets(state.bullets, dt);
  let shootCooldown = tickTimer(state.playerShootCooldownTimer, dt);
  let jumpTimer = tickTimer(state.playerJumpTimer, dt);
  let jumpCooldown = tickTimer(state.playerJumpCooldownTimer, dt);

  if (canControlPlayer && input.fireHeld && shootCooldown === 0) {
    bullets = bullets.concat({
      theta: nextPlayerTheta,
      depth: 0.02,
      depthVelocity: BULLET_DEPTH_SPEED,
      ttl: BULLET_LIFETIME,
      owner: 'player'
    });
    shootCooldown = PLAYER_SHOOT_COOLDOWN;
  }

  if (canControlPlayer && input.jumpPressed && jumpCooldown === 0) {
    jumpTimer = PLAYER_JUMP_DURATION;
    jumpCooldown = PLAYER_JUMP_COOLDOWN;
  }

  const movedEnemyFormation = moveEnemies(
    state.enemies,
    state.enemyFormationCenterTheta,
    state.enemyFormationDirection,
    dt
  );
  const movedAsteroids = moveAsteroids(state.asteroids, dt);
  const afterBulletHits = resolveBulletHits(movedEnemyFormation.enemies, bullets, state.score);

  const baseImpact: PlayerImpactState = {
    lives: state.lives,
    shield: state.playerShield,
    shieldRegenDelayTimer: tickTimer(state.playerShieldRegenDelayTimer, dt),
    invulnerabilityTimer: tickTimer(state.playerInvulnerabilityTimer, dt),
    deathTimer,
    respawnEntryTimer,
    spinVelocity: nextSpinVelocity,
    phase: 'playing'
  };

  const afterLifecycle = resolveEnemyLifecycle(
    afterBulletHits.enemies,
    afterBulletHits.bullets,
    nextPlayerTheta,
    jumpTimer,
    baseImpact
  );
  const afterEnemyBullets = resolveEnemyBulletHits(
    afterLifecycle.bullets,
    nextPlayerTheta,
    jumpTimer,
    afterLifecycle.playerImpact
  );
  const afterAsteroids = resolveAsteroidHits(
    movedAsteroids,
    nextPlayerTheta,
    jumpTimer,
    afterEnemyBullets.playerImpact
  );

  let phase: GameState['phase'] = afterAsteroids.playerImpact.phase;
  let nextShield = afterAsteroids.playerImpact.shield;
  const nextShieldRegenDelay = afterAsteroids.playerImpact.shieldRegenDelayTimer;

  if (
    phase === 'playing' &&
    nextShieldRegenDelay === 0 &&
    afterAsteroids.playerImpact.deathTimer === 0 &&
    afterAsteroids.playerImpact.respawnEntryTimer === 0
  ) {
    nextShield = Math.min(PLAYER_SHIELD_MAX, nextShield + PLAYER_SHIELD_REGEN_PER_SECOND * dt);
  }

  let nextEnemyId = state.nextEnemyId;
  let enemies = afterLifecycle.enemies;
  let enemyFormationCenterTheta = movedEnemyFormation.formationCenterTheta;
  let enemyFormationDirection = movedEnemyFormation.formationDirection;

  if (phase === 'playing' && allEnemiesDefeated(enemies)) {
    const enemyWave = createEnemyWave(nextEnemyId);
    nextEnemyId = enemyWave.nextEnemyId;
    enemies = enemyWave.enemies;
    enemyFormationCenterTheta = ENEMY_FORMATION_CENTER_THETA;
    enemyFormationDirection = 1;
  }

  if (phase !== 'playing' && phase !== 'lost') {
    phase = 'lost';
  }

  const lives = afterAsteroids.playerImpact.lives;
  if (lives <= 0) {
    phase = 'lost';
  }

  const invulnerabilityTimer =
    phase === 'playing' || phase === 'lost'
      ? afterAsteroids.playerImpact.invulnerabilityTimer
      : PLAYER_INVULNERABILITY;

  return {
    phase,
    score: afterBulletHits.score,
    lives,
    playerTheta: nextPlayerTheta,
    playerSpinVelocity: afterAsteroids.playerImpact.spinVelocity,
    playerShield: nextShield,
    playerShieldRegenDelayTimer: nextShieldRegenDelay,
    playerDeathTimer: afterAsteroids.playerImpact.deathTimer,
    playerRespawnEntryTimer: afterAsteroids.playerImpact.respawnEntryTimer,
    playerInvulnerabilityTimer: invulnerabilityTimer,
    playerShootCooldownTimer: shootCooldown,
    playerJumpTimer: jumpTimer,
    playerJumpCooldownTimer: jumpCooldown,
    enemyFormationCenterTheta,
    enemyFormationDirection,
    enemyWaveMode: state.enemyWaveMode,
    nextEnemyId,
    enemies,
    asteroids: afterAsteroids.asteroids,
    bullets: afterEnemyBullets.bullets
  };
}
