import type { MatchInput } from '@light80/core';

import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  ENEMY_BULLET_SPEED,
  LOST_RESTART_DELAY_SEC,
  PLAYER_HEIGHT,
  PLAYER_RESPAWN_INVULNERABILITY,
  PLAYER_SHOT_SPEED,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from './constants';
import {
  createInitialBossState,
  resolveBossHazards,
  resolvePlayerShotsAgainstBoss,
  stepBossState,
  type BossScoreEvent
} from './boss';
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
import { stepEnemies } from './enemy-motion';
import { resolveFriendlyFire } from './friendly-fire';
import { applyLaneInput, playerLaneWorldY } from './player-lanes';
import { spawnPickupsFromDefeatedUfos, stepPickups } from './pickups';
import { clampPlayerX, decayPushbackVelocity, resolvePlayerSeparation, updateRecentMovementMomentum } from './player-separation';
import { consumeShield, playerShootCooldown, playerTapShootCooldown, tickPlayersPowerups } from './powerups';
import { detectNewlyDefeatedRowIndices, drainRowRespawnQueue, enqueueDefeatedRows } from './row-respawn';
import { createInitialState } from './state';
import type { Bullet, Enemy, FrameInput, GameState, PlayerState } from './types';
import {
  advanceCampaignState,
  enemyBaseSpeedForCampaign,
  enemyDiveCooldownForCampaign,
  enemyFireIntervalForCampaign,
  spawnGalagaRow
} from './waves';

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

function applyScoreEvents(
  players: ReadonlyArray<PlayerState>,
  scoreEvents: ReadonlyArray<BossScoreEvent>
): ReadonlyArray<PlayerState> {
  if (scoreEvents.length === 0) {
    return players;
  }

  const playersByIndex = new Map<number, PlayerState>(players.map((player) => [player.playerIndex, player]));
  for (const scoreEvent of scoreEvents) {
    const player = playersByIndex.get(scoreEvent.playerIndex);
    if (player === undefined) {
      throw new Error(`Player state is missing for boss score playerIndex ${scoreEvent.playerIndex}.`);
    }

    playersByIndex.set(scoreEvent.playerIndex, awardPlayerScore(player, scoreEvent.points));
  }

  return players.map((player) => {
    const nextPlayer = playersByIndex.get(player.playerIndex);
    if (nextPlayer === undefined) {
      throw new Error(`Resolved boss score state is missing for playerIndex ${player.playerIndex}.`);
    }

    return nextPlayer;
  });
}

function applyHazardHit(playersByIndex: Map<number, PlayerState>, hitPlayerIndex: number): boolean {
  const hitPlayer = playersByIndex.get(hitPlayerIndex);
  if (hitPlayer === undefined) {
    throw new Error(`Player state is missing for hit playerIndex ${hitPlayerIndex}.`);
  }

  const shield = consumeShield(hitPlayer);
  if (shield.consumed) {
    playersByIndex.set(hitPlayerIndex, shield.player);
    return false;
  }

  const nextLives = hitPlayer.lives - 1;
  playersByIndex.set(hitPlayerIndex, {
    ...resetPlayerBonus(hitPlayer),
    lives: nextLives,
    respawnTimer: nextLives > 0 ? PLAYER_RESPAWN_INVULNERABILITY : 0,
    shootTimer: nextLives > 0 ? hitPlayer.shootTimer : 0,
    recentMovementMomentum: 0,
    pushbackVelocityX: 0
  });
  return true;
}

function resolveBossHazardHits(
  players: ReadonlyArray<PlayerState>,
  hitPlayerIndices: ReadonlyArray<number>
): {
  readonly players: ReadonlyArray<PlayerState>;
  readonly phase: 'playing' | 'lost';
} {
  if (hitPlayerIndices.length === 0) {
    return {
      players,
      phase: 'playing'
    };
  }

  const playersByIndex = new Map<number, PlayerState>(players.map((player) => [player.playerIndex, { ...player }]));
  let anyPlayerHit = false;
  for (const hitPlayerIndex of hitPlayerIndices) {
    anyPlayerHit = applyHazardHit(playersByIndex, hitPlayerIndex) || anyPlayerHit;
  }

  const nextPlayers = players.map((player) => {
    const nextPlayer = playersByIndex.get(player.playerIndex);
    if (nextPlayer === undefined) {
      throw new Error(`Resolved boss hazard state is missing for playerIndex ${player.playerIndex}.`);
    }

    return nextPlayer;
  });

  return {
    players: nextPlayers,
    phase: anyPlayerHit && nextPlayers.every((player) => player.lives <= 0) ? 'lost' : 'playing'
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

function anyFireJustPressed(matchInput: MatchInput<FrameInput>): boolean {
  return matchInput.players.some((player) => player.input.fireJustPressed);
}

function anyRestartRequested(matchInput: MatchInput<FrameInput>): boolean {
  return anyRestartPressed(matchInput) || anyFireJustPressed(matchInput);
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

function enemiesAbleToFire(enemies: ReadonlyArray<Enemy>): ReadonlyArray<Enemy> {
  return enemies.filter(
    (enemy) => enemy.alive && (enemy.motion.kind === 'formation' || (enemy.motion.kind === 'path' && enemy.motion.path === 'attack'))
  );
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

    const wantsToFire = input.firePressed || input.fireJustPressed;
    if (!wantsToFire || player.shootTimer !== 0) {
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
      shootTimer: input.fireJustPressed ? playerTapShootCooldown(player) : playerShootCooldown(player)
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
  readonly defeatedEnemies: ReadonlyArray<Enemy>;
} {
  const playersByIndex = new Map<number, PlayerState>(players.map((player) => [player.playerIndex, { ...player }]));
  const aliveById = new Set<number>();
  const hitPointsById = new Map<number, number>();
  const defeatedEnemies: Enemy[] = [];
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
      defeatedEnemies.push(target);
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
    bullets: nextBullets,
    defeatedEnemies
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

    anyPlayerHit = applyHazardHit(playersByIndex, hitPlayerIndex) || anyPlayerHit;
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

function enemiesReachedPlayer(
  enemies: ReadonlyArray<Enemy>,
  players: ReadonlyArray<PlayerState>
): boolean {
  const livingPlayers = players.filter((player) => player.lives > 0);
  if (livingPlayers.length === 0) {
    throw new Error('enemiesReachedPlayer requires at least one living player.');
  }

  const defenseLineY = playerLaneWorldY('low') - playerActiveHeight();
  return enemies.some(
    (enemy) =>
      enemy.alive &&
      enemy.motion.kind === 'formation' &&
      enemy.y + enemyActiveHeight(enemy.kind) / 2 >= defenseLineY
  );
}

function hasLivingFormationEnemies(enemies: ReadonlyArray<Enemy>): boolean {
  return enemies.some((enemy) => enemy.alive && enemy.motion.kind === 'formation');
}

function applyMissPenalties(
  players: ReadonlyArray<PlayerState>,
  playerMisses: ReadonlySet<number>
): ReadonlyArray<PlayerState> {
  return players.map((player) => (playerMisses.has(player.playerIndex) ? resetPlayerBonus(player) : player));
}

function stepBossBattle(
  state: GameState,
  inputByPlayerIndex: ReadonlyMap<number, FrameInput>,
  dt: number,
  options: StepGameOptions,
  collisionDebug: MutableCollisionDebugFrame | null
): StepGameResult {
  if (state.campaign.phase !== 'boss') {
    throw new Error('stepBossBattle requires boss campaign phase.');
  }
  if (state.boss === null) {
    throw new Error('Boss campaign phase requires boss state.');
  }

  const elapsedTimeSec = state.elapsedTimeSec + dt;
  let players = tickPlayersPowerups(resolvePlayerSeparation(updatePlayers(state.players, inputByPlayerIndex, dt)), dt);
  let bullets = moveBullets(state.bullets, dt);
  const steppedPickups = stepPickups(players, state.pickups, dt);
  players = steppedPickups.players;
  const pickups = steppedPickups.pickups;

  const spawnedShots = spawnPlayerShots(players, bullets, inputByPlayerIndex);
  players = spawnedShots.players;
  bullets = spawnedShots.bullets;

  const bossStep = stepBossState(state.boss, dt, state.rngSeed);
  let boss = bossStep.boss;
  const rngSeed = bossStep.rngSeed;
  bullets = bullets.concat(bossStep.bullets);

  const friendlyFire = resolveFriendlyFire(players, bullets, dt, options.collisionRuntime, collisionDebug);
  players = resolvePlayerSeparation(friendlyFire.players);
  bullets = friendlyFire.bullets;

  const resolvedBossShots = resolvePlayerShotsAgainstBoss(boss, bullets, dt);
  bullets = resolvedBossShots.bullets;
  players = applyScoreEvents(players, resolvedBossShots.scoreEvents);

  const resolvedEnemyShots = resolveEnemyShots(players, bullets, dt, options.collisionRuntime, collisionDebug);
  const filteredBullets = filterBulletsAndCountPlayerMisses(resolvedEnemyShots.bullets);
  const playersAfterMisses = applyMissPenalties(resolvedEnemyShots.players, filteredBullets.playerMisses);

  if (resolvedEnemyShots.phase === 'lost') {
    return {
      state: {
        phase: 'lost',
        elapsedTimeSec,
        lostRestartDelaySec: LOST_RESTART_DELAY_SEC,
        campaign: state.campaign,
        boss: resolvedBossShots.boss,
        players: playersAfterMisses,
        enemyDirection: 1,
        enemySpeed: state.enemySpeed,
        enemyFireTimer: Number.POSITIVE_INFINITY,
        enemyDiveTimer: Number.POSITIVE_INFINITY,
        rngSeed,
        enemies: [],
        bullets: filteredBullets.bullets,
        pickups,
        nextPickupId: state.nextPickupId,
        pendingRowRespawns: []
      },
      collisionDebug: freezeCollisionDebugFrame(collisionDebug)
    };
  }

  if (resolvedBossShots.boss === null) {
    return {
      state: {
        phase: 'won',
        elapsedTimeSec,
        lostRestartDelaySec: 0,
        campaign: state.campaign,
        boss: null,
        players: playersAfterMisses,
        enemyDirection: 1,
        enemySpeed: state.enemySpeed,
        enemyFireTimer: Number.POSITIVE_INFINITY,
        enemyDiveTimer: Number.POSITIVE_INFINITY,
        rngSeed,
        enemies: [],
        bullets: filteredBullets.bullets,
        pickups,
        nextPickupId: state.nextPickupId,
        pendingRowRespawns: []
      },
      collisionDebug: freezeCollisionDebugFrame(collisionDebug)
    };
  }

  boss = resolvedBossShots.boss;
  const resolvedBossHazards = resolveBossHazards(boss, playersAfterMisses);
  const bossHazardHits = resolveBossHazardHits(playersAfterMisses, resolvedBossHazards.hitPlayerIndices);
  const phase = bossHazardHits.phase;

  return {
    state: {
      phase,
      elapsedTimeSec,
      lostRestartDelaySec: phase === 'lost' ? LOST_RESTART_DELAY_SEC : state.lostRestartDelaySec,
      campaign: state.campaign,
      boss: resolvedBossHazards.boss,
      players: bossHazardHits.players,
      enemyDirection: 1,
      enemySpeed: state.enemySpeed,
      enemyFireTimer: Number.POSITIVE_INFINITY,
      enemyDiveTimer: Number.POSITIVE_INFINITY,
      rngSeed,
      enemies: [],
      bullets: filteredBullets.bullets,
      pickups,
      nextPickupId: state.nextPickupId,
      pendingRowRespawns: []
    },
    collisionDebug: freezeCollisionDebugFrame(collisionDebug)
  };
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

  if (state.phase === 'boss-ready') {
    if (state.campaign.phase !== 'boss') {
      throw new Error('boss-ready phase requires boss campaign phase.');
    }
    if (state.boss === null) {
      throw new Error('boss-ready phase requires boss state.');
    }

    return {
      state:
        anyRestartPressed(matchInput)
          ? createInitialState(state.rngSeed + 1, state.players.length)
          : anyFirePressed(matchInput)
            ? {
                ...state,
                phase: 'playing'
              }
            : state,
      collisionDebug: createEmptyCollisionDebugFrame()
    };
  }

  if (state.phase === 'won') {
    return {
      state:
        anyRestartRequested(matchInput) || anyFirePressed(matchInput)
          ? createInitialState(state.rngSeed + 1, state.players.length)
          : state,
      collisionDebug: createEmptyCollisionDebugFrame()
    };
  }

  if (state.phase !== 'playing') {
    const nextLostRestartDelaySec = Math.max(0, state.lostRestartDelaySec - dt);
    return {
      state:
        nextLostRestartDelaySec === 0 && anyRestartRequested(matchInput)
          ? createInitialState(state.rngSeed + 1, state.players.length)
          : {
              ...state,
              lostRestartDelaySec: nextLostRestartDelaySec
            },
      collisionDebug: createEmptyCollisionDebugFrame()
    };
  }

  const elapsedTimeSec = state.elapsedTimeSec + dt;
  let players = tickPlayersPowerups(resolvePlayerSeparation(updatePlayers(state.players, inputByPlayerIndex, dt)), dt);
  let bullets = state.campaign.transitionTimerSec > 0 ? [] : moveBullets(state.bullets, dt);
  const steppedPickups = stepPickups(players, state.pickups, dt);
  players = steppedPickups.players;
  let pickups = state.campaign.transitionTimerSec > 0 ? [] : steppedPickups.pickups;
  let enemyDirection = state.enemyDirection;
  let enemySpeed = state.enemySpeed;
  let enemyFireTimer = state.enemyFireTimer;
  let enemyDiveTimer = state.enemyDiveTimer;
  let rngSeed = state.rngSeed;

  if (state.campaign.transitionTimerSec > 0) {
    const nextTransitionTimerSec = Math.max(0, state.campaign.transitionTimerSec - dt);
    if (nextTransitionTimerSec > 0) {
      return {
        state: {
          ...state,
          elapsedTimeSec,
          players,
          bullets: [],
          pickups: [],
          campaign: {
            ...state.campaign,
            transitionTimerSec: nextTransitionTimerSec
          }
        },
        collisionDebug: createEmptyCollisionDebugFrame()
      };
    }

    if (state.campaign.phase === 'boss') {
      return {
        state: {
          ...state,
          phase: 'boss-ready',
          elapsedTimeSec,
          boss: createInitialBossState(),
          players,
          bullets: [],
          pickups: [],
          enemies: [],
          enemyFireTimer: Number.POSITIVE_INFINITY,
          enemyDiveTimer: Number.POSITIVE_INFINITY,
          campaign: {
            ...state.campaign,
            transitionTimerSec: 0
          }
        },
        collisionDebug: createEmptyCollisionDebugFrame()
      };
    }

    if (state.campaign.phase === 'classic-endless') {
      throw new Error('Classic endless campaign should not enter phase transition spawn path.');
    }

    const nextCampaign = {
      ...state.campaign,
      transitionTimerSec: 0
    };
    const spawnedWave = spawnGalagaRow(nextCampaign, true);
    bullets = [];
    pickups = [];
    enemyDirection = 1;
    enemySpeed = spawnedWave.enemySpeed;
    enemyFireTimer = spawnedWave.enemyFireTimer;
    enemyDiveTimer = spawnedWave.enemyDiveTimer;

    return {
      state: {
        ...state,
        elapsedTimeSec,
        players,
        enemyDirection,
        enemySpeed,
        enemyFireTimer,
        enemyDiveTimer,
        enemies: spawnedWave.enemies,
        bullets,
        pickups,
        pendingRowRespawns: [],
        campaign: {
          ...state.campaign,
          transitionTimerSec: 0
        }
      },
      collisionDebug: createEmptyCollisionDebugFrame()
    };
  }

  if (state.campaign.phase === 'boss') {
    return stepBossBattle(state, inputByPlayerIndex, dt, options, collisionDebug);
  }

  const spawnedShots = spawnPlayerShots(players, bullets, inputByPlayerIndex);
  players = spawnedShots.players;
  bullets = spawnedShots.bullets;

  const movedEnemies = stepEnemies(
    state.enemies,
    players,
    state.campaign,
    state.enemyDirection,
    state.enemySpeed,
    state.enemyDiveTimer,
    dt,
    rngSeed
  );
  enemyDirection = movedEnemies.direction;
  enemySpeed = movedEnemies.speed;
  enemyDiveTimer = movedEnemies.diveTimer;
  rngSeed = movedEnemies.rngSeed;
  enemyFireTimer -= dt;

  const livingEnemies = enemiesAbleToFire(movedEnemies.enemies);
  if (enemyFireTimer <= 0 && livingEnemies.length > 0) {
    const shot = spawnEnemyBullet(livingEnemies, rngSeed, bullets);
    rngSeed = shot.rngSeed;
    bullets = shot.bullets;
    enemyFireTimer = enemyFireIntervalForCampaign(state.campaign);
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
  const spawnedPickups = spawnPickupsFromDefeatedUfos(
    pickups,
    state.nextPickupId,
    rngSeed,
    resolvedPlayerShots.defeatedEnemies
  );
  pickups = spawnedPickups.pickups;
  rngSeed = spawnedPickups.rngSeed;
  const resolvedEnemyShots = resolveEnemyShots(
    resolvedPlayerShots.players,
    resolvedPlayerShots.bullets,
    dt,
    options.collisionRuntime,
    collisionDebug
  );
  const filteredBullets = filterBulletsAndCountPlayerMisses(resolvedEnemyShots.bullets);
  const playersAfterMisses = applyMissPenalties(resolvedEnemyShots.players, filteredBullets.playerMisses);
  let campaign = state.campaign;
  let enemies = resolvedPlayerShots.enemies;
  let pendingRowRespawns = state.pendingRowRespawns;
  if (campaign.phase === 'classic-endless') {
    const classicFormationWasEmpty = !hasLivingFormationEnemies(enemies);
    const defeatedRows = detectNewlyDefeatedRowIndices(movedEnemies.enemies, resolvedPlayerShots.enemies);
    if (defeatedRows.length > 0) {
      campaign = {
        ...campaign,
        rowsCleared: Math.min(campaign.rowsTarget, campaign.rowsCleared + defeatedRows.length)
      };
    }

    const maxAdditionalTickets = Math.max(0, campaign.rowsTarget - campaign.rowsSpawned - pendingRowRespawns.length);
    pendingRowRespawns = enqueueDefeatedRows(
      pendingRowRespawns,
      defeatedRows,
      elapsedTimeSec,
      maxAdditionalTickets
    );

    const nextClassicRowNumber = campaign.rowsSpawned < campaign.rowsTarget ? campaign.rowsSpawned + 1 : null;
    const respawnResult = drainRowRespawnQueue(
      pendingRowRespawns,
      enemies,
      rngSeed,
      elapsedTimeSec,
      nextClassicRowNumber
    );
    pendingRowRespawns = respawnResult.pendingRowRespawns;
    enemies = respawnResult.enemies;
    rngSeed = respawnResult.rngSeed;
    if (respawnResult.respawnedRow) {
      if (classicFormationWasEmpty) {
        enemyDirection = 1;
        enemySpeed = enemyBaseSpeedForCampaign(campaign);
        enemyFireTimer = enemyFireIntervalForCampaign(campaign);
      }
      campaign = {
        ...campaign,
        rowsSpawned: campaign.rowsSpawned + 1
      };
    }
  }

  const phase =
    resolvedEnemyShots.phase === 'lost'
      ? 'lost'
      : enemiesReachedPlayer(enemies, playersAfterMisses)
        ? 'lost'
        : 'playing';
  if (phase === 'lost') {
    return {
      state: {
        phase,
        elapsedTimeSec,
        lostRestartDelaySec: LOST_RESTART_DELAY_SEC,
        campaign,
        boss: state.boss,
        players: playersAfterMisses,
        enemyDirection,
        enemySpeed,
        enemyFireTimer,
        enemyDiveTimer,
        rngSeed,
        enemies,
        bullets: filteredBullets.bullets,
        pickups,
        nextPickupId: spawnedPickups.nextPickupId,
        pendingRowRespawns
      },
      collisionDebug: freezeCollisionDebugFrame(collisionDebug)
    };
  }

  const survivingEnemies = enemies.filter((enemy) => enemy.alive);
  const classicStageComplete =
    campaign.phase === 'classic-endless' &&
    campaign.rowsCleared >= campaign.rowsTarget &&
    survivingEnemies.length === 0 &&
    pendingRowRespawns.length === 0;
  const galagaRowCleared = campaign.phase === 'galaga-rows' && survivingEnemies.length === 0;

  if (classicStageComplete || galagaRowCleared) {
    const progressedCampaign =
      campaign.phase === 'galaga-rows'
        ? {
            ...campaign,
            rowsCleared: campaign.rowsCleared + 1
          }
        : campaign;
    const nextCampaign = advanceCampaignState(progressedCampaign);
    return {
      state: {
        phase: nextCampaign.phase === 'boss' ? 'boss-ready' : 'playing',
        elapsedTimeSec,
        lostRestartDelaySec: state.lostRestartDelaySec,
        campaign:
          nextCampaign.phase === 'boss'
            ? {
                ...nextCampaign,
                transitionTimerSec: 0
              }
            : nextCampaign,
        boss: nextCampaign.phase === 'boss' ? createInitialBossState() : null,
        players: playersAfterMisses,
        enemyDirection: 1,
        enemySpeed: enemyBaseSpeedForCampaign(nextCampaign),
        enemyFireTimer: enemyFireIntervalForCampaign(nextCampaign),
        enemyDiveTimer: enemyDiveCooldownForCampaign(nextCampaign),
        rngSeed,
        enemies: [],
        bullets: [],
        pickups: [],
        nextPickupId: spawnedPickups.nextPickupId,
        pendingRowRespawns: []
      },
      collisionDebug: freezeCollisionDebugFrame(collisionDebug)
    };
  }

  return {
    state: {
      phase,
      elapsedTimeSec,
      lostRestartDelaySec: state.lostRestartDelaySec,
      campaign,
      boss: state.boss,
      players: playersAfterMisses,
      enemyDirection,
      enemySpeed,
      enemyFireTimer,
      enemyDiveTimer,
      rngSeed,
      enemies,
      bullets: filteredBullets.bullets,
      pickups,
      nextPickupId: spawnedPickups.nextPickupId,
      pendingRowRespawns
    },
    collisionDebug: freezeCollisionDebugFrame(collisionDebug)
  };
}
