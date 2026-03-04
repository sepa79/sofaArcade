export type EnemyClass = 'standard' | 'large';
export type EnemyWaveMode = 'spread' | 'spiral';

export interface Enemy {
  readonly id: number;
  readonly theta: number;
  readonly depth: number;
  readonly alive: boolean;
  readonly enemyClass: EnemyClass;
  readonly maxHp: number;
  readonly hp: number;
  readonly shootCooldown: number;
}

export interface Asteroid {
  readonly id: number;
  readonly theta: number;
  readonly depth: number;
  readonly angularSpeed: number;
}

export type BulletOwner = 'player' | 'enemy';

export interface Bullet {
  readonly theta: number;
  readonly depth: number;
  readonly depthVelocity: number;
  readonly ttl: number;
  readonly owner: BulletOwner;
}

export type TunnelPhase = 'ready' | 'playing' | 'paused' | 'won' | 'lost';

export interface FrameInput {
  readonly moveXSigned: number;
  readonly fireHeld: boolean;
  readonly jumpPressed: boolean;
  readonly pausePressed: boolean;
  readonly startPressed: boolean;
}

export interface GameState {
  readonly phase: TunnelPhase;
  readonly score: number;
  readonly lives: number;
  readonly playerTheta: number;
  readonly playerInvulnerabilityTimer: number;
  readonly playerShootCooldownTimer: number;
  readonly playerJumpTimer: number;
  readonly playerJumpCooldownTimer: number;
  readonly enemyDirection: -1 | 1;
  readonly enemyDirectionTimer: number;
  readonly enemyWaveMode: EnemyWaveMode;
  readonly nextEnemyId: number;
  readonly enemies: ReadonlyArray<Enemy>;
  readonly asteroids: ReadonlyArray<Asteroid>;
  readonly bullets: ReadonlyArray<Bullet>;
}
