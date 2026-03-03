import {
  ENEMY_COLS,
  ENEMY_FIRE_INTERVAL,
  ENEMY_GAP_X,
  ENEMY_GAP_Y,
  ENEMY_ROWS,
  ENEMY_SPEED_START,
  ENEMY_START_X,
  ENEMY_START_Y,
  PLAYER_LIVES,
  WORLD_WIDTH
} from './constants';
import type { Enemy, GameState } from './types';

function createEnemyGrid(): ReadonlyArray<Enemy> {
  const enemies: Enemy[] = [];
  let id = 0;

  for (let row = 0; row < ENEMY_ROWS; row += 1) {
    for (let col = 0; col < ENEMY_COLS; col += 1) {
      enemies.push({
        id,
        x: ENEMY_START_X + col * ENEMY_GAP_X,
        y: ENEMY_START_Y + row * ENEMY_GAP_Y,
        alive: true
      });
      id += 1;
    }
  }

  return enemies;
}

export function createInitialState(seed: number): GameState {
  return {
    phase: 'playing',
    score: 0,
    lives: PLAYER_LIVES,
    playerX: WORLD_WIDTH / 2,
    playerRespawnTimer: 0,
    playerShootTimer: 0,
    enemyDirection: 1,
    enemySpeed: ENEMY_SPEED_START,
    enemyFireTimer: ENEMY_FIRE_INTERVAL,
    rngSeed: seed,
    enemies: createEnemyGrid(),
    bullets: []
  };
}
