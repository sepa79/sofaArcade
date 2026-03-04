import {
  ASTEROID_BASE_ANGULAR_SPEED,
  ASTEROID_COUNT,
  ASTEROID_RESPAWN_DEPTH_START,
  ASTEROID_RESPAWN_DEPTH_STEP,
  ENEMY_COUNT,
  ENEMY_FORMATION_SWEEP_ARC,
  ENEMY_FORMATION_CENTER_THETA,
  ENEMY_FORMATION_COL_SPACING,
  ENEMY_FORMATION_ROW_DEPTH_START,
  ENEMY_FORMATION_ROW_DEPTH_STEP,
  ENEMY_FORMATION_ROWS,
  ENEMY_LARGE_COUNT,
  ENEMY_LARGE_HP,
  ENEMY_LARGE_SWEEP_SPEED,
  ENEMY_STANDARD_HP,
  PLAYER_SHIELD_MAX,
  PLAYER_LIVES,
  TAU
} from './constants';
import type { Asteroid, Enemy, EnemyWaveMode, GameState } from './types';

const DEFAULT_WAVE_MODE: EnemyWaveMode = 'spread';

function normalizeAngle(theta: number): number {
  const wrapped = theta % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

function enemyMaxHpForClass(enemyClass: Enemy['enemyClass']): number {
  return enemyClass === 'large' ? ENEMY_LARGE_HP : ENEMY_STANDARD_HP;
}

function createFormationEnemies(startId: number): ReadonlyArray<Enemy> {
  const columns = ENEMY_COUNT / ENEMY_FORMATION_ROWS;
  if (!Number.isInteger(columns)) {
    throw new Error(
      `ENEMY_COUNT (${ENEMY_COUNT}) must be divisible by ENEMY_FORMATION_ROWS (${ENEMY_FORMATION_ROWS}).`
    );
  }

  const enemies: Enemy[] = [];

  for (let index = 0; index < ENEMY_COUNT; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const enemyClass: Enemy['enemyClass'] = 'standard';
    const maxHp = enemyMaxHpForClass(enemyClass);
    const laneTheta = (column - (columns - 1) / 2) * ENEMY_FORMATION_COL_SPACING;
    const depth = ENEMY_FORMATION_ROW_DEPTH_START + row * ENEMY_FORMATION_ROW_DEPTH_STEP;
    const initialTheta = normalizeAngle(ENEMY_FORMATION_CENTER_THETA + laneTheta);
    enemies.push({
      id: startId + index,
      motion: 'formation',
      formationRow: row,
      laneTheta,
      theta: initialTheta,
      depth,
      lateralSpeed: 0,
      alive: true,
      enemyClass,
      maxHp,
      hp: maxHp,
      shootCooldown: 1.8 + row * 0.38 + column * 0.24
    });
  }

  return enemies;
}

function createLargeEnemy(startId: number): Enemy {
  const direction: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
  const laneTheta = direction < 0 ? ENEMY_FORMATION_SWEEP_ARC * 0.85 : -ENEMY_FORMATION_SWEEP_ARC * 0.85;
  const maxHp = enemyMaxHpForClass('large');
  return {
    id: startId,
    motion: 'sweeper',
    formationRow: -1,
    laneTheta,
    theta: normalizeAngle(ENEMY_FORMATION_CENTER_THETA + laneTheta),
    depth: ENEMY_FORMATION_ROW_DEPTH_START - ENEMY_FORMATION_ROW_DEPTH_STEP * 0.25,
    lateralSpeed: direction * ENEMY_LARGE_SWEEP_SPEED,
    alive: true,
    enemyClass: 'large',
    maxHp,
    hp: maxHp,
    shootCooldown: 2.6
  };
}

export function createEnemyWave(nextEnemyId: number): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly nextEnemyId: number;
} {
  const formationEnemies = createFormationEnemies(nextEnemyId);
  const largeEnemyStartId = nextEnemyId + ENEMY_COUNT;
  const largeEnemies: Enemy[] = [];
  for (let index = 0; index < ENEMY_LARGE_COUNT; index += 1) {
    largeEnemies.push(createLargeEnemy(largeEnemyStartId + index));
  }

  return {
    enemies: formationEnemies.concat(largeEnemies),
    nextEnemyId: nextEnemyId + ENEMY_COUNT + ENEMY_LARGE_COUNT
  };
}

function createAsteroids(): ReadonlyArray<Asteroid> {
  const spacing = TAU / ASTEROID_COUNT;
  const asteroids: Asteroid[] = [];

  for (let index = 0; index < ASTEROID_COUNT; index += 1) {
    const direction = index % 2 === 0 ? 1 : -1;
    const speedOffset = (index % 3) * 0.045;
    asteroids.push({
      id: index,
      laneTheta: normalizeAngle(index * spacing + Math.PI / 7),
      theta: normalizeAngle(index * spacing + Math.PI / 7),
      depth: ASTEROID_RESPAWN_DEPTH_START + (index % 3) * ASTEROID_RESPAWN_DEPTH_STEP,
      angularSpeed: direction * (ASTEROID_BASE_ANGULAR_SPEED + speedOffset)
    });
  }

  return asteroids;
}

export function createInitialState(enemyWaveMode: EnemyWaveMode = DEFAULT_WAVE_MODE): GameState {
  const enemyWave = createEnemyWave(0);
  return {
    phase: 'ready',
    score: 0,
    lives: PLAYER_LIVES,
    playerTheta: Math.PI / 2,
    playerSpinVelocity: 0,
    playerShield: PLAYER_SHIELD_MAX,
    playerShieldRegenDelayTimer: 0,
    playerDeathTimer: 0,
    playerRespawnEntryTimer: 0,
    playerInvulnerabilityTimer: 0,
    playerShootCooldownTimer: 0,
    playerJumpTimer: 0,
    playerJumpCooldownTimer: 0,
    enemyFormationCenterTheta: ENEMY_FORMATION_CENTER_THETA,
    enemyFormationDirection: 1,
    enemyWaveMode,
    nextEnemyId: enemyWave.nextEnemyId,
    enemies: enemyWave.enemies,
    asteroids: createAsteroids(),
    bullets: []
  };
}
