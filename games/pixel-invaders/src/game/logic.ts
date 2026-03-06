import type { MatchInput } from '@light80/core';

import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  ENEMY_BULLET_SPEED,
  ENEMY_DESCEND_STEP,
  ENEMY_DRIFT_DOWN_SPEED,
  ENEMY_FIRE_INTERVAL,
  ENEMY_SPEED_STEP,
  ENEMY_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_RESPAWN_INVULNERABILITY,
  PLAYER_SHOOT_COOLDOWN,
  PLAYER_SHOT_SPEED,
  PLAYER_SPEED,
  PLAYER_WIDTH,
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
import { resolveFriendlyFire } from './friendly-fire';
import { applyLaneInput, playerLaneWorldY } from './player-lanes';
import { clampPlayerX, decayPushbackVelocity, resolvePlayerSeparation, updateRecentMovementMomentum } from './player-separation';
import { drainRowRespawnQueue, enqueueDefeatedRows } from './row-respawn';
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

function resetPlayerBonus(player: PlayerState): PlayerState {
  if (player.hitStreak === 0 && player.scoreMultiplier === 1) {
    return player;
  }

  return {
    ...player,
    hitStreak: 0,
    scoreMultiplier: 1
  };
}

function awardPlayerScore(player: PlayerState, points: number): PlayerState {
  const nextHitStreak = player.hitStreak + 1;
  return {
    ...player,
    score: player.score + points * player.scoreMultiplier,
    hitStreak: nextHitStreak,
    scoreMultiplier: Math.min(32, nextHitStreak + 1)
  };
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

    if (
      !Number.isFinite(player.input.moveAxisSigned) ||
      player.input.moveAxisSigned < -1 ||
      player.input.moveAxisSigned > 1
    ) {
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
        shootTimer: 0,
        recentMovementMomentum: 0,
        pushbackVelocityX: 0
      };
    }

    const nextLane = applyLaneInput(player.lane, input);
    const desiredX =
      input.moveAbsoluteUnit === null
        ? player.x + input.moveAxisSigned * PLAYER_SPEED * dt
        : playerXFromAbsoluteUnit(input.moveAbsoluteUnit);
    const movedByPushbackX = desiredX + player.pushbackVelocityX * dt;
    const nextX = clampPlayerX(movedByPushbackX);
    const movedDistanceX = Math.abs(nextX - player.x);

    return {
      ...player,
      x: nextX,
      lane: nextLane,
      respawnTimer: Math.max(0, player.respawnTimer - dt),
      shootTimer: Math.max(0, player.shootTimer - dt),
      recentMovementMomentum: updateRecentMovementMomentum(player.recentMovementMomentum, movedDistanceX, dt),
      pushbackVelocityX: decayPushbackVelocity(player.pushbackVelocityX, dt)
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

  return {
    enemies: moved.map((enemy) =>
      enemy.alive
        ? {
            ...enemy,
            y: enemy.y + ENEMY_DESCEND_STEP
          }
        : enemy
    ),
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
  if (shooter === undefined) {
    throw new Error(`Missing living enemy for shooterIndex ${shooterIndex}.`);
  }

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
  readonly playerMisses: ReadonlySet<number>;
} {
  const playerMisses = new Set<number>();
  const nextBullets: Bullet[] = [];
  for (const bullet of bullets) {
    if (bullet.y <= -BULLET_HEIGHT) {
      if (bullet.owner === 'player') {
        if (bullet.playerIndex === null) {
          throw new Error('Player-owned bullet is missing playerIndex.');
        }
        playerMisses.add(bullet.playerIndex);
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

function spawnPlayerShots(
  players: ReadonlyArray<PlayerState>,
  bullets: ReadonlyArray<Bullet>,
  inputByPlayerIndex: ReadonlyMap<number, FrameInput>
): {
  readonly players: ReadonlyArray<PlayerState>;
  readonly bullets: ReadonlyArray<Bullet>;
} {
  let nextBullets = bullets.slice();
  const nextPlayers = players.map((player) => {
    const input = inputByPlayerIndex.get(player.playerIndex);
    if (input === undefined) {
      throw new Error(`Player input is missing for playerIndex ${player.playerIndex}.`);
    }

    if (player.lives <= 0) {
      return player;
    }

    const hasPlayerBullet = nextBullets.some(
      (bullet) => bullet.owner === 'player' && bullet.playerIndex === player.playerIndex
    );
    if (!input.firePressed || player.shootTimer !== 0 || hasPlayerBullet) {
      return player;
    }

    nextBullets = nextBullets.concat({
      owner: 'player',
      playerIndex: player.playerIndex,
      x: player.x,
      y: playerLaneWorldY(player.lane) - PLAYER_HEIGHT / 2,
      vy: -PLAYER_SHOT_SPEED
    });

    return {
      ...player,
      shootTimer: PLAYER_SHOOT_COOLDOWN
    };
  });

  return {
    players: nextPlayers,
    bullets: nextBullets
  };
}

function resolvePlayerShots(
  players: ReadonlyArray<PlayerState>,
  enemies: ReadonlyArray<Enemy>,
  bullets: ReadonlyArray<Bullet>,
  dt: number,
  collisionRuntime: CollisionRuntime,
  collisionDebug: MutableCollisionDebugFrame | null
): {
  readonly players: ReadonlyArray<PlayerState>;
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
} {
  const playersByIndex = new Map<number, PlayerState>(players.map((player) => [player.playerIndex, { ...player }]));
  const aliveById = new Set<number>();
  const hitPointsById = new Map<number, number>();
  enemies.forEach((enemy) => {
    if (enemy.alive) {
      aliveById.add(enemy.id);
      hitPointsById.set(enemy.id, enemy.hitPoints);
    }
  });

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
      if (bullet.playerIndex === null) {
        throw new Error('Player-owned bullet is missing playerIndex.');
      }

      const shooter = playersByIndex.get(bullet.playerIndex);
      if (shooter === undefined) {
        throw new Error(`Player state is missing for scoring playerIndex ${bullet.playerIndex}.`);
      }

      aliveById.delete(target.id);
      hitPointsById.set(target.id, 0);
      playersByIndex.set(bullet.playerIndex, awardPlayerScore(shooter, target.scoreValue));
      continue;
    }

    hitPointsById.set(target.id, remainingHitPoints);
  }

  return {
    players: players.map((player) => {
      const nextPlayer = playersByIndex.get(player.playerIndex);
      if (nextPlayer === undefined) {
        throw new Error(`Resolved player score state is missing for playerIndex ${player.playerIndex}.`);
      }

      return nextPlayer;
    }),
    enemies: enemies.map((enemy) => {
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
    }),
    bullets: nextBullets
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
  const playersByIndex = new Map<number, PlayerState>(players.map((player) => [player.playerIndex, { ...player }]));
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
        playerLaneWorldY(player.lane),
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

    if (hitPlayerIndex === null) {
      return true;
    }

    const hitPlayer = playersByIndex.get(hitPlayerIndex);
    if (hitPlayer === undefined) {
      throw new Error(`Player state is missing for hit playerIndex ${hitPlayerIndex}.`);
    }

    anyPlayerHit = true;
    const nextLives = hitPlayer.lives - 1;
    playersByIndex.set(hitPlayerIndex, {
      ...resetPlayerBonus(hitPlayer),
      lives: nextLives,
      respawnTimer: nextLives > 0 ? PLAYER_RESPAWN_INVULNERABILITY : 0,
      shootTimer: nextLives > 0 ? hitPlayer.shootTimer : 0,
      recentMovementMomentum: 0,
      pushbackVelocityX: 0
    });
    return false;
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

function livingPlayerFrontlineY(players: ReadonlyArray<PlayerState>): number {
  const livingPlayers = players.filter((player) => player.lives > 0);
  if (livingPlayers.length === 0) {
    return playerLaneWorldY('low');
  }

  return Math.min(...livingPlayers.map((player) => playerLaneWorldY(player.lane)));
}

function enemiesReachedPlayer(
  enemies: ReadonlyArray<Enemy>,
  players: ReadonlyArray<PlayerState>
): boolean {
  const frontlineY = livingPlayerFrontlineY(players);
  return enemies.some((enemy) => enemy.alive && enemy.y + enemyActiveHeight(enemy.kind) / 2 >= frontlineY - playerActiveHeight());
}

function applyMissPenalties(
  players: ReadonlyArray<PlayerState>,
  playerMisses: ReadonlySet<number>
): ReadonlyArray<PlayerState> {
  return players.map((player) => (playerMisses.has(player.playerIndex) ? resetPlayerBonus(player) : player));
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

  const elapsedTimeSec = state.elapsedTimeSec + dt;
  let players = resolvePlayerSeparation(updatePlayers(state.players, inputByPlayerIndex, dt));
  let bullets = moveBullets(state.bullets, dt);

  const spawnedShots = spawnPlayerShots(players, bullets, inputByPlayerIndex);
  players = spawnedShots.players;
  bullets = spawnedShots.bullets;

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

  const friendlyFire = resolveFriendlyFire(players, bullets, dt, options.collisionRuntime, collisionDebug);
  players = resolvePlayerSeparation(friendlyFire.players);
  bullets = friendlyFire.bullets;

  const resolvedPlayerShots = resolvePlayerShots(
    players,
    movedEnemies.enemies,
    bullets,
    dt,
    options.collisionRuntime,
    collisionDebug
  );
  const resolvedEnemyShots = resolveEnemyShots(
    resolvedPlayerShots.players,
    resolvedPlayerShots.bullets,
    dt,
    options.collisionRuntime,
    collisionDebug
  );
  const filteredBullets = filterBulletsAndCountPlayerMisses(resolvedEnemyShots.bullets);
  const playersAfterMisses = applyMissPenalties(resolvedEnemyShots.players, filteredBullets.playerMisses);
  const pendingRowRespawns = enqueueDefeatedRows(
    state.pendingRowRespawns,
    movedEnemies.enemies,
    resolvedPlayerShots.enemies,
    elapsedTimeSec
  );
  const respawnResult = drainRowRespawnQueue(
    pendingRowRespawns,
    resolvedPlayerShots.enemies,
    rngSeed,
    elapsedTimeSec
  );

  const phase = enemiesReachedPlayer(respawnResult.enemies, playersAfterMisses) ? 'lost' : resolvedEnemyShots.phase;

  return {
    state: {
      phase,
      elapsedTimeSec,
      players: playersAfterMisses,
      enemyDirection: movedEnemies.direction,
      enemySpeed: movedEnemies.speed,
      enemyFireTimer,
      rngSeed: respawnResult.rngSeed,
      enemies: respawnResult.enemies,
      bullets: filteredBullets.bullets,
      pendingRowRespawns: respawnResult.pendingRowRespawns
    },
    collisionDebug: freezeCollisionDebugFrame(collisionDebug)
  };
}
