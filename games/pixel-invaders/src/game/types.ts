export type PlayerLane = 'low' | 'mid' | 'high';
export type PowerupKind = 'shield' | 'rapid-fire';
export type EnemyWavePhase = 'classic-endless' | 'galaga-rows' | 'boss';

export interface ActivePowerup {
  readonly kind: PowerupKind;
  readonly remainingSec: number;
}

export interface PlayerState {
  readonly playerIndex: number;
  readonly x: number;
  readonly lives: number;
  readonly respawnTimer: number;
  readonly shootTimer: number;
  readonly lane: PlayerLane;
  readonly recentMovementMomentum: number;
  readonly pushbackVelocityX: number;
  readonly score: number;
  readonly hitStreak: number;
  readonly scoreMultiplier: number;
  readonly activePowerups: ReadonlyArray<ActivePowerup>;
}

export interface EnemyFormationMotion {
  readonly kind: 'formation';
}

export interface EnemyPathMotion {
  readonly kind: 'path';
  readonly path: 'entry' | 'attack';
  readonly elapsedSec: number;
  readonly durationSec: number;
  readonly startX: number;
  readonly startY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly swayAmplitudeX: number;
  readonly swayCycles: number;
  readonly loopDepthY: number;
}

export type EnemyMotion = EnemyFormationMotion | EnemyPathMotion;

export interface Enemy {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  readonly kind: 'normal' | 'ufo';
  readonly scoreValue: number;
  readonly hitPoints: number;
  readonly motion: EnemyMotion;
  readonly guaranteedPickupKind: PowerupKind | null;
}

export interface Bullet {
  readonly x: number;
  readonly y: number;
  readonly vy: number;
  readonly owner: 'player' | 'enemy';
  readonly playerIndex: number | null;
}

export interface PickupEntity {
  readonly id: number;
  readonly kind: PowerupKind;
  readonly x: number;
  readonly y: number;
  readonly vy: number;
}

export interface FrameInput {
  readonly moveAxisSigned: number;
  readonly moveAbsoluteUnit: number | null;
  readonly moveLaneTarget: PlayerLane | null;
  readonly moveLaneUpPressed: boolean;
  readonly moveLaneDownPressed: boolean;
  readonly firePressed: boolean;
  readonly fireJustPressed: boolean;
  readonly restartPressed: boolean;
}

export type GamePhase = 'ready' | 'playing' | 'boss-ready' | 'lost';

export interface ClassicEndlessCampaignState {
  readonly phase: 'classic-endless';
  readonly rowsCleared: number;
  readonly rowsSpawned: number;
  readonly rowsTarget: number;
  readonly startRows: number;
  readonly transitionTimerSec: number;
}

export interface GalagaRowsCampaignState {
  readonly phase: 'galaga-rows';
  readonly rowsCleared: number;
  readonly currentRowNumber: number;
  readonly rowsTarget: number;
  readonly transitionTimerSec: number;
}

export interface BossCampaignState {
  readonly phase: 'boss';
  readonly transitionTimerSec: number;
}

export type CampaignState = ClassicEndlessCampaignState | GalagaRowsCampaignState | BossCampaignState;

export interface RowRespawnTicket {
  readonly rowIndex: number;
  readonly queuedAtTimeSec: number;
  readonly notBeforeTimeSec: number;
}

export interface GameState {
  readonly phase: GamePhase;
  readonly elapsedTimeSec: number;
  readonly lostRestartDelaySec: number;
  readonly campaign: CampaignState;
  readonly players: ReadonlyArray<PlayerState>;
  readonly enemyDirection: -1 | 1;
  readonly enemySpeed: number;
  readonly enemyFireTimer: number;
  readonly enemyDiveTimer: number;
  readonly rngSeed: number;
  readonly enemies: ReadonlyArray<Enemy>;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly pickups: ReadonlyArray<PickupEntity>;
  readonly nextPickupId: number;
  readonly pendingRowRespawns: ReadonlyArray<RowRespawnTicket>;
}
