import {
  BULLET_HEIGHT,
  ENEMY_COLS,
  ENEMY_BULLET_SPEED,
  ENEMY_DESCEND_STEP,
  ENEMY_DRIFT_DOWN_SPEED,
  ENEMY_FIRE_INTERVAL,
  ENEMY_HEIGHT,
  ENEMY_ROW_RESPAWN_Y,
  ENEMY_ROW_UFO_CHANCE,
  ENEMY_ROWS,
  ENEMY_SPEED_STEP,
  ENEMY_START_X,
  ENEMY_GAP_X,
  ENEMY_UFO_SCORE,
  ENEMY_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_RESPAWN_INVULNERABILITY,
  PLAYER_SHOOT_COOLDOWN,
  PLAYER_SHOT_SPEED,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  PLAYER_Y,
  SCORE_PER_ENEMY,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from './constants';
import { createInitialState } from './state';
import type { Bullet, Enemy, FrameInput, GameState } from './types';

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

function intersectsRectPoint(
  pointX: number,
  pointY: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  const halfWidth = rectWidth / 2;
  const halfHeight = rectHeight / 2;
  return (
    pointX >= rectX - halfWidth &&
    pointX <= rectX + halfWidth &&
    pointY >= rectY - halfHeight &&
    pointY <= rectY + halfHeight
  );
}

function clampPlayerX(x: number): number {
  const minX = PLAYER_WIDTH / 2;
  const maxX = WORLD_WIDTH - PLAYER_WIDTH / 2;
  return Math.max(minX, Math.min(maxX, x));
}

function playerXFromAbsoluteUnit(unitValue: number): number {
  if (!Number.isFinite(unitValue) || unitValue < 0 || unitValue > 1) {
    throw new Error(`moveAbsoluteUnit must be in [0, 1], got ${unitValue}.`);
  }

  return clampPlayerX(PLAYER_WIDTH / 2 + unitValue * (WORLD_WIDTH - PLAYER_WIDTH));
}

function moveEnemies(
  enemies: ReadonlyArray<Enemy>,
  direction: -1 | 1,
  speed: number,
  dt: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly direction: -1 | 1;
  readonly speed: number;
} {
  const moved = enemies.map((enemy) => ({
    ...enemy,
    x: enemy.x + direction * speed * dt,
    y: enemy.y + ENEMY_DRIFT_DOWN_SPEED * dt
  }));

  const touchedBoundary = moved.some(
    (enemy) => enemy.alive && (enemy.x <= ENEMY_WIDTH / 2 || enemy.x >= WORLD_WIDTH - ENEMY_WIDTH / 2)
  );

  if (!touchedBoundary) {
    return {
      enemies: moved,
      direction,
      speed
    };
  }

  const shiftedDown = moved.map((enemy) =>
    enemy.alive
      ? {
          ...enemy,
          y: enemy.y + ENEMY_DESCEND_STEP
        }
      : enemy
  );

  return {
    enemies: shiftedDown,
    direction: direction === 1 ? -1 : 1,
    speed: speed + ENEMY_SPEED_STEP
  };
}

function spawnEnemyBullet(
  livingEnemies: ReadonlyArray<Enemy>,
  rngSeed: number,
  bullets: ReadonlyArray<Bullet>
): { readonly rngSeed: number; readonly bullets: ReadonlyArray<Bullet> } {
  const random = nextRandom(rngSeed);
  const shooterIndex = Math.floor(random.value * livingEnemies.length);
  const shooter = livingEnemies[shooterIndex];
  return {
    rngSeed: random.seed,
    bullets: bullets.concat({
      owner: 'enemy',
      x: shooter.x,
      y: shooter.y + ENEMY_HEIGHT / 2,
      vy: ENEMY_BULLET_SPEED
    })
  };
}

function collectDefeatedRows(enemies: ReadonlyArray<Enemy>): ReadonlyArray<number> {
  const defeatedRows: number[] = [];
  for (let row = 0; row < ENEMY_ROWS; row += 1) {
    let rowAlive = false;
    for (const enemy of enemies) {
      if (Math.floor(enemy.id / ENEMY_COLS) !== row) {
        continue;
      }
      if (enemy.alive) {
        rowAlive = true;
        break;
      }
    }
    if (!rowAlive) {
      defeatedRows.push(row);
    }
  }

  return defeatedRows;
}

function respawnRows(
  enemies: ReadonlyArray<Enemy>,
  rows: ReadonlyArray<number>,
  rngSeed: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly rngSeed: number;
} {
  if (rows.length === 0) {
    return {
      enemies,
      rngSeed
    };
  }

  const rowsToRespawn = new Set(rows);
  const ufoColumnByRow = new Map<number, number | null>();
  let nextSeed = rngSeed;
  for (const row of rows) {
    const roll = nextRandom(nextSeed);
    nextSeed = roll.seed;
    if (roll.value >= ENEMY_ROW_UFO_CHANCE) {
      ufoColumnByRow.set(row, null);
      continue;
    }

    const columnRoll = nextRandom(nextSeed);
    nextSeed = columnRoll.seed;
    ufoColumnByRow.set(row, Math.floor(columnRoll.value * ENEMY_COLS));
  }

  const nextEnemies = enemies.map((enemy) => {
    const row = Math.floor(enemy.id / ENEMY_COLS);
    if (!rowsToRespawn.has(row)) {
      return enemy;
    }

    const col = enemy.id % ENEMY_COLS;
    const ufoCol = ufoColumnByRow.get(row);
    const isUfo = ufoCol !== null && ufoCol === col;
    const kind: Enemy['kind'] = isUfo ? 'ufo' : 'normal';
    return {
      ...enemy,
      alive: true,
      x: ENEMY_START_X + col * ENEMY_GAP_X,
      y: ENEMY_ROW_RESPAWN_Y,
      kind,
      scoreValue: kind === 'ufo' ? ENEMY_UFO_SCORE : SCORE_PER_ENEMY
    };
  });

  return {
    enemies: nextEnemies,
    rngSeed: nextSeed
  };
}

function moveBullets(bullets: ReadonlyArray<Bullet>, dt: number): ReadonlyArray<Bullet> {
  return bullets.map((bullet) => ({
    ...bullet,
    y: bullet.y + bullet.vy * dt
  }));
}

function filterBulletsAndCountPlayerMisses(
  bullets: ReadonlyArray<Bullet>
): {
  readonly bullets: ReadonlyArray<Bullet>;
  readonly playerMisses: number;
} {
  let playerMisses = 0;
  const nextBullets: Bullet[] = [];
  for (const bullet of bullets) {
    if (bullet.y <= -BULLET_HEIGHT) {
      if (bullet.owner === 'player') {
        playerMisses += 1;
      }
      continue;
    }

    if (bullet.y >= WORLD_HEIGHT + BULLET_HEIGHT) {
      continue;
    }

    nextBullets.push(bullet);
  }

  return {
    bullets: nextBullets,
    playerMisses
  };
}

function resolvePlayerShots(
  enemies: ReadonlyArray<Enemy>,
  bullets: ReadonlyArray<Bullet>,
  score: number,
  hitStreak: number,
  scoreMultiplier: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly score: number;
  readonly hitStreak: number;
  readonly scoreMultiplier: number;
} {
  const aliveById = new Set<number>();
  enemies.forEach((enemy) => {
    if (enemy.alive) {
      aliveById.add(enemy.id);
    }
  });

  let nextScore = score;
  let nextHitStreak = hitStreak;
  let nextScoreMultiplier = scoreMultiplier;
  const nextBullets: Bullet[] = [];

  for (const bullet of bullets) {
    if (bullet.owner !== 'player') {
      nextBullets.push(bullet);
      continue;
    }

    const target = enemies.find(
      (enemy) => enemy.alive && aliveById.has(enemy.id) && intersectsRectPoint(bullet.x, bullet.y, enemy.x, enemy.y, ENEMY_WIDTH, ENEMY_HEIGHT)
    );

    if (target === undefined) {
      nextBullets.push(bullet);
      continue;
    }

    aliveById.delete(target.id);
    nextScore += target.scoreValue * nextScoreMultiplier;
    nextHitStreak += 1;
    nextScoreMultiplier = Math.min(32, nextHitStreak + 1);
  }

  const nextEnemies = enemies.map((enemy) => ({
    ...enemy,
    alive: aliveById.has(enemy.id)
  }));

  return {
    enemies: nextEnemies,
    bullets: nextBullets,
    score: nextScore,
    hitStreak: nextHitStreak,
    scoreMultiplier: nextScoreMultiplier
  };
}

function resolveEnemyShots(
  lives: number,
  playerX: number,
  playerRespawnTimer: number,
  bullets: ReadonlyArray<Bullet>
): {
  readonly lives: number;
  readonly playerRespawnTimer: number;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly phase: 'playing' | 'lost';
} {
  if (playerRespawnTimer > 0) {
    return {
      lives,
      playerRespawnTimer,
      bullets,
      phase: 'playing'
    };
  }

  let playerHit = false;
  const nextBullets = bullets.filter((bullet) => {
    if (bullet.owner !== 'enemy') {
      return true;
    }

    const hit = intersectsRectPoint(bullet.x, bullet.y, playerX, PLAYER_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
    if (hit) {
      playerHit = true;
      return false;
    }

    return true;
  });

  if (!playerHit) {
    return {
      lives,
      playerRespawnTimer,
      bullets: nextBullets,
      phase: 'playing'
    };
  }

  const nextLives = lives - 1;
  return {
    lives: nextLives,
    playerRespawnTimer: nextLives > 0 ? PLAYER_RESPAWN_INVULNERABILITY : 0,
    bullets: nextBullets,
    phase: nextLives > 0 ? 'playing' : 'lost'
  };
}

function enemiesReachedPlayer(enemies: ReadonlyArray<Enemy>): boolean {
  return enemies.some((enemy) => enemy.alive && enemy.y + ENEMY_HEIGHT / 2 >= PLAYER_Y - PLAYER_HEIGHT);
}

export function stepGame(state: GameState, input: FrameInput, dt: number): GameState {
  if (!Number.isFinite(input.moveAxisSigned) || input.moveAxisSigned < -1 || input.moveAxisSigned > 1) {
    throw new Error(`moveAxisSigned must be in [-1, 1], got ${input.moveAxisSigned}.`);
  }

  if (state.phase === 'ready') {
    if (input.restartPressed) {
      return createInitialState(state.rngSeed + 1);
    }

    if (input.firePressed) {
      return {
        ...state,
        phase: 'playing'
      };
    }

    return state;
  }

  if (state.phase !== 'playing') {
    return input.restartPressed ? createInitialState(state.rngSeed + 1) : state;
  }

  const playerRespawnTimer = Math.max(0, state.playerRespawnTimer - dt);
  const playerX =
    input.moveAbsoluteUnit === null
      ? clampPlayerX(state.playerX + input.moveAxisSigned * PLAYER_SPEED * dt)
      : playerXFromAbsoluteUnit(input.moveAbsoluteUnit);

  let playerShootTimer = Math.max(0, state.playerShootTimer - dt);
  let bullets = moveBullets(state.bullets, dt);

  const hasPlayerBullet = bullets.some((bullet) => bullet.owner === 'player');
  if (input.firePressed && playerShootTimer === 0 && !hasPlayerBullet) {
    bullets = bullets.concat({
      owner: 'player',
      x: playerX,
      y: PLAYER_Y - PLAYER_HEIGHT / 2,
      vy: -PLAYER_SHOT_SPEED
    });
    playerShootTimer = PLAYER_SHOOT_COOLDOWN;
  }

  const movedEnemies = moveEnemies(state.enemies, state.enemyDirection, state.enemySpeed, dt);
  let enemyFireTimer = state.enemyFireTimer - dt;
  let rngSeed = state.rngSeed;

  const livingEnemies = movedEnemies.enemies.filter((enemy) => enemy.alive);
  if (enemyFireTimer <= 0 && livingEnemies.length > 0) {
    const shot = spawnEnemyBullet(livingEnemies, rngSeed, bullets);
    rngSeed = shot.rngSeed;
    bullets = shot.bullets;
    enemyFireTimer = ENEMY_FIRE_INTERVAL;
  }

  const resolvedPlayerShots = resolvePlayerShots(
    movedEnemies.enemies,
    bullets,
    state.score,
    state.hitStreak,
    state.scoreMultiplier
  );
  const resolvedEnemyShots = resolveEnemyShots(
    state.lives,
    playerX,
    playerRespawnTimer,
    resolvedPlayerShots.bullets
  );
  const filteredBullets = filterBulletsAndCountPlayerMisses(resolvedEnemyShots.bullets);
  const playerWasHit = resolvedEnemyShots.lives < state.lives;
  const shouldResetBonus = filteredBullets.playerMisses > 0 || playerWasHit;
  const nextHitStreak = shouldResetBonus ? 0 : resolvedPlayerShots.hitStreak;
  const nextScoreMultiplier = shouldResetBonus ? 1 : resolvedPlayerShots.scoreMultiplier;
  const respawnResult = respawnRows(
    resolvedPlayerShots.enemies,
    collectDefeatedRows(resolvedPlayerShots.enemies),
    rngSeed
  );
  rngSeed = respawnResult.rngSeed;

  const reachedPlayer = enemiesReachedPlayer(respawnResult.enemies);

  const phase = reachedPlayer ? 'lost' : resolvedEnemyShots.phase;

  return {
    phase,
    score: resolvedPlayerShots.score,
    hitStreak: nextHitStreak,
    scoreMultiplier: nextScoreMultiplier,
    lives: resolvedEnemyShots.lives,
    playerX,
    playerRespawnTimer: resolvedEnemyShots.playerRespawnTimer,
    playerShootTimer,
    enemyDirection: movedEnemies.direction,
    enemySpeed: movedEnemies.speed,
    enemyFireTimer,
    rngSeed,
    enemies: respawnResult.enemies,
    bullets: filteredBullets.bullets
  };
}
