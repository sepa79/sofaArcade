import type { MatchInput } from '@light80/core';

import {
  BULLET_WIDTH,
  BULLET_HEIGHT,
  ENEMY_COLS,
  ENEMY_BULLET_SPEED,
  ENEMY_DESCEND_STEP,
  ENEMY_DRIFT_DOWN_SPEED,
  ENEMY_FIRE_INTERVAL,
  ENEMY_ROW_RESPAWN_Y,
  ENEMY_ROW_UFO_CHANCE,
  ENEMY_UFO_HIT_POINTS,
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
import {
  collideEnemyBulletWithPlayer,
  collidePlayerBulletWithEnemy,
  createEmptyCollisionDebugFrame,
  createMutableCollisionDebugFrame,
  enemyActiveHeight,
  freezeCollisionDebugFrame,
  playerActiveHeight,
  type CollisionDebugFrame,
  type CollisionRuntime,
  type MutableCollisionDebugFrame
} from './collision';
import { createInitialState } from './state';
import type { Bullet, Enemy, FrameInput, GameState, PlayerState } from './types';

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

function requireFiniteDt(dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error(`dt must be a positive finite number, got ${dt}.`);
  }
}

function requirePlayerInputMap(
  state: GameState,
  matchInput: MatchInput<FrameInput>
): ReadonlyMap<number, FrameInput> {
  if (matchInput.players.length !== state.players.length) {
    throw new Error(
      `Match input player count mismatch: expected ${state.players.length}, got ${matchInput.players.length}.`
    );
  }

  const byPlayerIndex = new Map<number, FrameInput>();
  for (const player of matchInput.players) {
    if (byPlayerIndex.has(player.playerIndex)) {
      throw new Error(`Match input has duplicate playerIndex: ${player.playerIndex}.`);
    }

    if (!Number.isFinite(player.input.moveAxisSigned) || player.input.moveAxisSigned < -1 || player.input.moveAxisSigned > 1) {
      throw new Error(`moveAxisSigned must be in [-1, 1], got ${player.input.moveAxisSigned}.`);
    }

    byPlayerIndex.set(player.playerIndex, player.input);
  }

  for (const player of state.players) {
    if (!byPlayerIndex.has(player.playerIndex)) {
      throw new Error(`Missing match input for playerIndex ${player.playerIndex}.`);
    }
  }

  return byPlayerIndex;
}

function anyFirePressed(matchInput: MatchInput<FrameInput>): boolean {
  return matchInput.players.some((player) => player.input.firePressed);
}

function anyRestartPressed(matchInput: MatchInput<FrameInput>): boolean {
  return matchInput.players.some((player) => player.input.restartPressed);
}

function updatePlayers(
  players: ReadonlyArray<PlayerState>,
  inputByPlayerIndex: ReadonlyMap<number, FrameInput>,
  dt: number
): ReadonlyArray<PlayerState> {
  return players.map((player) => {
    const input = inputByPlayerIndex.get(player.playerIndex);
    if (input === undefined) {
      throw new Error(`Player input is missing for playerIndex ${player.playerIndex}.`);
    }

    if (player.lives <= 0) {
      return {
        ...player,
        respawnTimer: 0,
        shootTimer: 0
      };
    }

    return {
      ...player,
      x:
        input.moveAbsoluteUnit === null
          ? clampPlayerX(player.x + input.moveAxisSigned * PLAYER_SPEED * dt)
          : playerXFromAbsoluteUnit(input.moveAbsoluteUnit),
      respawnTimer: Math.max(0, player.respawnTimer - dt),
      shootTimer: Math.max(0, player.shootTimer - dt)
    };
  });
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
      playerIndex: null,
      x: shooter.x,
      y: shooter.y + enemyActiveHeight(shooter.kind) / 2,
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
      scoreValue: kind === 'ufo' ? ENEMY_UFO_SCORE : SCORE_PER_ENEMY,
      hitPoints: kind === 'ufo' ? ENEMY_UFO_HIT_POINTS : 1
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
  scoreMultiplier: number,
  dt: number,
  collisionRuntime: CollisionRuntime,
  collisionDebug: MutableCollisionDebugFrame | null
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly score: number;
  readonly hitStreak: number;
  readonly scoreMultiplier: number;
} {
  const aliveById = new Set<number>();
  const hitPointsById = new Map<number, number>();
  enemies.forEach((enemy) => {
    if (enemy.alive) {
      aliveById.add(enemy.id);
      hitPointsById.set(enemy.id, enemy.hitPoints);
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

    const segmentStartX = bullet.x;
    const segmentStartY = bullet.y - bullet.vy * dt;
    const segmentEndX = bullet.x;
    const segmentEndY = bullet.y;

    let target: Enemy | null = null;
    let bestT = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      if (!enemy.alive || !aliveById.has(enemy.id)) {
        continue;
      }

      const hit = collidePlayerBulletWithEnemy(
        collisionRuntime,
        enemy,
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
      target = enemy;
    }

    if (target === null) {
      nextBullets.push(bullet);
      continue;
    }

    const targetHitPoints = hitPointsById.get(target.id);
    if (targetHitPoints === undefined) {
      throw new Error(`Hit points are missing for alive enemy ${target.id}.`);
    }
    const remainingHitPoints = targetHitPoints - 1;
    if (remainingHitPoints <= 0) {
      aliveById.delete(target.id);
      hitPointsById.set(target.id, 0);
      nextScore += target.scoreValue * nextScoreMultiplier;
      nextHitStreak += 1;
      nextScoreMultiplier = Math.min(32, nextHitStreak + 1);
      continue;
    }

    hitPointsById.set(target.id, remainingHitPoints);
  }

  const nextEnemies = enemies.map((enemy) => {
    const alive = aliveById.has(enemy.id);
    const hitPoints = hitPointsById.get(enemy.id);
    if (alive) {
      if (hitPoints === undefined) {
        throw new Error(`Hit points are missing for surviving enemy ${enemy.id}.`);
      }
      return {
        ...enemy,
        alive: true,
        hitPoints
      };
    }

    return {
      ...enemy,
      alive: false,
      hitPoints: hitPoints === undefined ? enemy.hitPoints : hitPoints
    };
  });

  return {
    enemies: nextEnemies,
    bullets: nextBullets,
    score: nextScore,
    hitStreak: nextHitStreak,
    scoreMultiplier: nextScoreMultiplier
  };
}

function resolveEnemyShots(
  players: ReadonlyArray<PlayerState>,
  bullets: ReadonlyArray<Bullet>,
  dt: number,
  collisionRuntime: CollisionRuntime,
  collisionDebug: MutableCollisionDebugFrame | null
): {
  readonly players: ReadonlyArray<PlayerState>;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly phase: 'playing' | 'lost';
} {
  const playersByIndex = new Map<number, PlayerState>(
    players.map((player) => [player.playerIndex, { ...player }])
  );
  let anyPlayerHit = false;
  const nextBullets = bullets.filter((bullet) => {
    if (bullet.owner !== 'enemy') {
      return true;
    }

    const segmentStartX = bullet.x;
    const segmentStartY = bullet.y - bullet.vy * dt;
    const segmentEndX = bullet.x;
    const segmentEndY = bullet.y;
    let hitPlayerIndex: number | null = null;
    let bestT = Number.POSITIVE_INFINITY;
    for (const player of playersByIndex.values()) {
      if (player.lives <= 0 || player.respawnTimer > 0) {
        continue;
      }

      const hit = collideEnemyBulletWithPlayer(
        collisionRuntime,
        player.x,
        PLAYER_Y,
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
      hitPlayerIndex = player.playerIndex;
    }

    if (hitPlayerIndex !== null) {
      const hitPlayer = playersByIndex.get(hitPlayerIndex);
      if (hitPlayer === undefined) {
        throw new Error(`Player state is missing for hit playerIndex ${hitPlayerIndex}.`);
      }

      anyPlayerHit = true;
      const nextLives = hitPlayer.lives - 1;
      playersByIndex.set(hitPlayerIndex, {
        ...hitPlayer,
        lives: nextLives,
        respawnTimer: nextLives > 0 ? PLAYER_RESPAWN_INVULNERABILITY : 0,
        shootTimer: nextLives > 0 ? hitPlayer.shootTimer : 0
      });
      return false;
    }

    return true;
  });

  const nextPlayers = players.map((player) => {
    const nextPlayer = playersByIndex.get(player.playerIndex);
    if (nextPlayer === undefined) {
      throw new Error(`Resolved player state is missing for playerIndex ${player.playerIndex}.`);
    }

    return nextPlayer;
  });

  return {
    players: nextPlayers,
    bullets: nextBullets,
    phase: anyPlayerHit && nextPlayers.every((player) => player.lives <= 0) ? 'lost' : 'playing'
  };
}

function enemiesReachedPlayer(enemies: ReadonlyArray<Enemy>): boolean {
  return enemies.some((enemy) => enemy.alive && enemy.y + enemyActiveHeight(enemy.kind) / 2 >= PLAYER_Y - playerActiveHeight());
}

export interface StepGameOptions {
  readonly collisionRuntime: CollisionRuntime;
  readonly captureCollisionDebug: boolean;
}

export interface StepGameResult {
  readonly state: GameState;
  readonly collisionDebug: CollisionDebugFrame;
}

export function stepGame(
  state: GameState,
  matchInput: MatchInput<FrameInput>,
  dt: number,
  options: StepGameOptions
): StepGameResult {
  requireFiniteDt(dt);
  const inputByPlayerIndex = requirePlayerInputMap(state, matchInput);
  const collisionDebug = createMutableCollisionDebugFrame(options.captureCollisionDebug);

  if (state.phase === 'ready') {
    if (anyRestartPressed(matchInput)) {
      return {
        state: createInitialState(state.rngSeed + 1, state.players.length),
        collisionDebug: createEmptyCollisionDebugFrame()
      };
    }

    if (anyFirePressed(matchInput)) {
      return {
        state: {
          ...state,
          phase: 'playing'
        },
        collisionDebug: createEmptyCollisionDebugFrame()
      };
    }

    return {
      state,
      collisionDebug: createEmptyCollisionDebugFrame()
    };
  }

  if (state.phase !== 'playing') {
    return {
      state: anyRestartPressed(matchInput) ? createInitialState(state.rngSeed + 1, state.players.length) : state,
      collisionDebug: createEmptyCollisionDebugFrame()
    };
  }

  let players = updatePlayers(state.players, inputByPlayerIndex, dt);
  let bullets = moveBullets(state.bullets, dt);

  const nextPlayers: PlayerState[] = [];
  for (const player of players) {
    const input = inputByPlayerIndex.get(player.playerIndex);
    if (input === undefined) {
      throw new Error(`Player input is missing for playerIndex ${player.playerIndex}.`);
    }

    if (player.lives > 0) {
      const hasPlayerBullet = bullets.some(
        (bullet) => bullet.owner === 'player' && bullet.playerIndex === player.playerIndex
      );
      if (input.firePressed && player.shootTimer === 0 && !hasPlayerBullet) {
        bullets = bullets.concat({
          owner: 'player',
          playerIndex: player.playerIndex,
          x: player.x,
          y: PLAYER_Y - PLAYER_HEIGHT / 2,
          vy: -PLAYER_SHOT_SPEED
        });
        nextPlayers.push({
          ...player,
          shootTimer: PLAYER_SHOOT_COOLDOWN
        });
        continue;
      }
    }

    nextPlayers.push(player);
  }
  players = nextPlayers;

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
    state.scoreMultiplier,
    dt,
    options.collisionRuntime,
    collisionDebug
  );
  const resolvedEnemyShots = resolveEnemyShots(
    players,
    resolvedPlayerShots.bullets,
    dt,
    options.collisionRuntime,
    collisionDebug
  );
  const filteredBullets = filterBulletsAndCountPlayerMisses(resolvedEnemyShots.bullets);
  const playerWasHit = resolvedEnemyShots.players.some((player, index) => player.lives < state.players[index].lives);
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
    state: {
      phase,
      score: resolvedPlayerShots.score,
      hitStreak: nextHitStreak,
      scoreMultiplier: nextScoreMultiplier,
      players: resolvedEnemyShots.players,
      enemyDirection: movedEnemies.direction,
      enemySpeed: movedEnemies.speed,
      enemyFireTimer,
      rngSeed,
      enemies: respawnResult.enemies,
      bullets: filteredBullets.bullets
    },
    collisionDebug: freezeCollisionDebugFrame(collisionDebug)
  };
}
