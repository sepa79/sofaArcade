export interface PlayerState {
  readonly playerIndex: number;
  readonly x: number;
  readonly lives: number;
  readonly respawnTimer: number;
  readonly shootTimer: number;
}

export interface Enemy {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  readonly kind: 'normal' | 'ufo';
  readonly scoreValue: number;
  readonly hitPoints: number;
}

export interface Bullet {
  readonly x: number;
  readonly y: number;
  readonly vy: number;
  readonly owner: 'player' | 'enemy';
  readonly playerIndex: number | null;
}

export interface FrameInput {
  readonly moveAxisSigned: number;
  readonly moveAbsoluteUnit: number | null;
  readonly firePressed: boolean;
  readonly restartPressed: boolean;
}

export type GamePhase = 'ready' | 'playing' | 'lost';

export interface GameState {
  readonly phase: GamePhase;
  readonly score: number;
  readonly hitStreak: number;
  readonly scoreMultiplier: number;
  readonly players: ReadonlyArray<PlayerState>;
  readonly enemyDirection: -1 | 1;
  readonly enemySpeed: number;
  readonly enemyFireTimer: number;
  readonly rngSeed: number;
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
}
