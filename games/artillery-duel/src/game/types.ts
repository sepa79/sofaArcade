export type MatchMode = 'solo-ai' | 'hotseat-2p';

export type ArtilleryPhase = 'ready' | 'aiming' | 'projectile' | 'won';

export interface TerrainState {
  readonly heights: ReadonlyArray<number>;
  readonly sampleSpacing: number;
}

export interface PlayerState {
  readonly index: 0 | 1;
  readonly label: string;
  readonly isCpu: boolean;
  readonly color: number;
  readonly tankX: number;
  readonly tankY: number;
  readonly angleDeg: number;
  readonly power: number;
}

export interface ProjectileState {
  readonly ownerIndex: 0 | 1;
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
}

export interface ExplosionState {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly remainingSec: number;
}

export interface CpuAimPlan {
  readonly angleDeg: number;
  readonly power: number;
}

export interface GameState {
  readonly mode: MatchMode;
  readonly phase: ArtilleryPhase;
  readonly seed: number;
  readonly terrain: TerrainState;
  readonly players: readonly [PlayerState, PlayerState];
  readonly activePlayerIndex: 0 | 1;
  readonly projectile: ProjectileState | null;
  readonly explosion: ExplosionState | null;
  readonly winnerIndex: 0 | 1 | null;
  readonly turnNumber: number;
  readonly cpuFireDelaySec: number;
  readonly cpuAimPlan: CpuAimPlan | null;
}

export interface FrameInput {
  readonly aimXSigned: number;
  readonly powerYSigned: number;
  readonly firePressed: boolean;
  readonly startPressed: boolean;
}

export interface TrajectoryResult {
  readonly directHit: boolean;
  readonly closestDistanceSq: number;
}
