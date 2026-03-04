export type EnemyClass = 'standard' | 'large';
export type EnemyWaveMode = 'spread' | 'spiral';

export interface Enemy {
  readonly id: number;
  readonly motion: 'formation' | 'sweeper';
  readonly formationRow: number;
  readonly laneTheta: number;
  readonly theta: number;
  readonly depth: number;
  readonly lateralSpeed: number;
  readonly alive: boolean;
  readonly enemyClass: EnemyClass;
  readonly maxHp: number;
  readonly hp: number;
  readonly shootCooldown: number;
}

export interface Asteroid {
  readonly id: number;
  readonly laneTheta: number;
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
  readonly playerSpinVelocity: number;
  readonly playerShield: number;
  readonly playerShieldRegenDelayTimer: number;
  readonly playerDeathTimer: number;
  readonly playerRespawnEntryTimer: number;
  readonly playerInvulnerabilityTimer: number;
  readonly playerShootCooldownTimer: number;
  readonly playerJumpTimer: number;
  readonly playerJumpCooldownTimer: number;
  readonly enemyFormationCenterTheta: number;
  readonly enemyFormationDirection: -1 | 1;
  readonly enemyWaveMode: EnemyWaveMode;
  readonly nextEnemyId: number;
  readonly enemies: ReadonlyArray<Enemy>;
  readonly asteroids: ReadonlyArray<Asteroid>;
  readonly bullets: ReadonlyArray<Bullet>;
}
