export interface Enemy {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
}

export interface Bullet {
  readonly x: number;
  readonly y: number;
  readonly vy: number;
  readonly owner: 'player' | 'enemy';
}

export interface FrameInput {
  readonly moveAxisSigned: number;
  readonly moveAbsoluteUnit: number | null;
  readonly firePressed: boolean;
  readonly restartPressed: boolean;
}

export type GamePhase = 'playing' | 'won' | 'lost';

export interface GameState {
  readonly phase: GamePhase;
  readonly score: number;
  readonly lives: number;
  readonly playerX: number;
  readonly playerRespawnTimer: number;
  readonly playerShootTimer: number;
  readonly enemyDirection: -1 | 1;
  readonly enemySpeed: number;
  readonly enemyFireTimer: number;
  readonly rngSeed: number;
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
}
