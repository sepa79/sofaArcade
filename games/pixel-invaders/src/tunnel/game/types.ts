export interface Enemy {
  readonly id: number;
  readonly theta: number;
  readonly depth: number;
  readonly alive: boolean;
}

export interface Bullet {
  readonly theta: number;
  readonly depth: number;
  readonly ttl: number;
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
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
}
