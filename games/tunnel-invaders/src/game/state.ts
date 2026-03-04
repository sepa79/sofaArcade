import {
  ASTEROID_BASE_ANGULAR_SPEED,
  ASTEROID_COUNT,
  ASTEROID_RESPAWN_DEPTH_START,
  ASTEROID_RESPAWN_DEPTH_STEP,
  ENEMY_COUNT,
  ENEMY_DIRECTION_SWITCH_INTERVAL,
  ENEMY_LARGE_HP,
  ENEMY_SPIRAL_SPAWN_THETA,
  ENEMY_STANDARD_HP,
  PLAYER_LIVES,
  TAU
} from './constants';
import type { Asteroid, Enemy, EnemyWaveMode, GameState } from './types';

const DEFAULT_WAVE_MODE: EnemyWaveMode = 'spiral';
const SPIRAL_SPAWN_DEPTH_START = 1.08;
const SPIRAL_SPAWN_DEPTH_STEP = 0.085;

function normalizeAngle(theta: number): number {
  const wrapped = theta % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

function enemyMaxHpForClass(enemyClass: Enemy['enemyClass']): number {
  return enemyClass === 'large' ? ENEMY_LARGE_HP : ENEMY_STANDARD_HP;
}

function createEnemies(enemyWaveMode: EnemyWaveMode): ReadonlyArray<Enemy> {
  const spacing = TAU / ENEMY_COUNT;
  const enemies: Enemy[] = [];

  for (let index = 0; index < ENEMY_COUNT; index += 1) {
    const enemyClass: Enemy['enemyClass'] = index === 0 ? 'large' : 'standard';
    const maxHp = enemyMaxHpForClass(enemyClass);
    const theta =
      enemyWaveMode === 'spiral' ? ENEMY_SPIRAL_SPAWN_THETA : normalizeAngle(index * spacing);
    const depth =
      enemyWaveMode === 'spiral'
        ? SPIRAL_SPAWN_DEPTH_START + index * SPIRAL_SPAWN_DEPTH_STEP
        : 0.75 + (index % 3) * 0.1;
    enemies.push({
      id: index,
      theta,
      depth,
      alive: true,
      enemyClass,
      maxHp,
      hp: maxHp,
      shootCooldown: enemyWaveMode === 'spiral' ? index * 0.1 : (index % 4) * 0.16
    });
  }

  return enemies;
}

function createAsteroids(): ReadonlyArray<Asteroid> {
  const spacing = TAU / ASTEROID_COUNT;
  const asteroids: Asteroid[] = [];

  for (let index = 0; index < ASTEROID_COUNT; index += 1) {
    const direction = index % 2 === 0 ? 1 : -1;
    const speedOffset = (index % 3) * 0.045;
    asteroids.push({
      id: index,
      theta: normalizeAngle(index * spacing + Math.PI / 7),
      depth: ASTEROID_RESPAWN_DEPTH_START + (index % 3) * ASTEROID_RESPAWN_DEPTH_STEP,
      angularSpeed: direction * (ASTEROID_BASE_ANGULAR_SPEED + speedOffset)
    });
  }

  return asteroids;
}

export function createInitialState(enemyWaveMode: EnemyWaveMode = DEFAULT_WAVE_MODE): GameState {
  return {
    phase: 'ready',
    score: 0,
    lives: PLAYER_LIVES,
    playerTheta: Math.PI / 2,
    playerInvulnerabilityTimer: 0,
    playerShootCooldownTimer: 0,
    playerJumpTimer: 0,
    playerJumpCooldownTimer: 0,
    enemyDirection: 1,
    enemyDirectionTimer: ENEMY_DIRECTION_SWITCH_INTERVAL,
    enemyWaveMode,
    nextEnemyId: ENEMY_COUNT,
    enemies: createEnemies(enemyWaveMode),
    asteroids: createAsteroids(),
    bullets: []
  };
}
