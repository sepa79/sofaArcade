import {
  ENEMY_COUNT,
  ENEMY_DIRECTION_SWITCH_INTERVAL,
  PLAYER_LIVES,
  TAU
} from './constants';
import type { Enemy, GameState } from './types';

function createEnemies(): ReadonlyArray<Enemy> {
  const spacing = TAU / ENEMY_COUNT;
  const enemies: Enemy[] = [];

  for (let index = 0; index < ENEMY_COUNT; index += 1) {
    enemies.push({
      id: index,
      theta: index * spacing,
      depth: 0.75 + (index % 3) * 0.1,
      alive: true
    });
  }

  return enemies;
}

export function createInitialState(): GameState {
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
    enemies: createEnemies(),
    bullets: []
  };
}
