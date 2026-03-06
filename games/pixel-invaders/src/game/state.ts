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
  SCORE_PER_ENEMY,
  PLAYER_WIDTH,
  WORLD_WIDTH
} from './constants';
import type { Enemy, GameState, PlayerState } from './types';

function createEnemyGrid(): ReadonlyArray<Enemy> {
  const enemies: Enemy[] = [];
  let id = 0;

  for (let row = 0; row < ENEMY_ROWS; row += 1) {
    for (let col = 0; col < ENEMY_COLS; col += 1) {
      enemies.push({
        id,
        x: ENEMY_START_X + col * ENEMY_GAP_X,
        y: ENEMY_START_Y + row * ENEMY_GAP_Y,
        alive: true,
        kind: 'normal',
        scoreValue: SCORE_PER_ENEMY,
        hitPoints: 1
      });
      id += 1;
    }
  }

  return enemies;
}

function createPlayers(playerCount: number): ReadonlyArray<PlayerState> {
  if (!Number.isInteger(playerCount) || playerCount <= 0) {
    throw new Error(`playerCount must be a positive integer, got ${playerCount}.`);
  }

  const centerX = WORLD_WIDTH / 2;
  const spacing = Math.min(220, Math.max(90, WORLD_WIDTH / (playerCount + 2)));

  return Array.from({ length: playerCount }, (_, playerIndex) => ({
    playerIndex,
    x: Math.max(
      PLAYER_WIDTH / 2,
      Math.min(
        WORLD_WIDTH - PLAYER_WIDTH / 2,
        centerX + (playerIndex - (playerCount - 1) / 2) * spacing
      )
    ),
    lives: PLAYER_LIVES,
    respawnTimer: 0,
    shootTimer: 0
  }));
}

export function createInitialState(seed: number, playerCount: number): GameState {
  return {
    phase: 'ready',
    score: 0,
    hitStreak: 0,
    scoreMultiplier: 1,
    players: createPlayers(playerCount),
    enemyDirection: 1,
    enemySpeed: ENEMY_SPEED_START,
    enemyFireTimer: ENEMY_FIRE_INTERVAL,
    rngSeed: seed,
    enemies: createEnemyGrid(),
    bullets: []
  };
}
