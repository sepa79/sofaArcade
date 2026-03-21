import {
  BOSS_ATTACK_COOLDOWN_SEC,
  BOSS_CLAW_ACTIVE_HEIGHT,
  BOSS_CLAW_ACTIVE_WIDTH,
  BOSS_CLAW_BASE_Y,
  BOSS_CLAW_HIT_POINTS,
  BOSS_CLAW_OFFSET_X,
  BOSS_CLAW_RECOVER_DURATION_SEC,
  BOSS_CLAW_SCORE,
  BOSS_CLAW_STRIKE_DURATION_SEC,
  BOSS_CLAW_STRIKE_TARGET_Y,
  BOSS_CLAW_SWAY_SPEED,
  BOSS_CLAW_TELEGRAPH_DURATION_SEC,
  BOSS_CORE_ACTIVE_HEIGHT,
  BOSS_CORE_ACTIVE_WIDTH,
  BOSS_CORE_BURST_BULLET_SPEED,
  BOSS_CORE_BURST_CHARGE_DURATION_SEC,
  BOSS_CORE_BURST_RECOVER_DURATION_SEC,
  BOSS_CORE_ENRAGED_SPEED,
  BOSS_CORE_HIT_POINTS,
  BOSS_CORE_MAX_X,
  BOSS_CORE_MIN_X,
  BOSS_CORE_SCORE,
  BOSS_CORE_SPEED,
  BOSS_CORE_Y,
  BOSS_ENRAGED_ATTACK_COOLDOWN_SEC,
  BOSS_LEFT_CLAW_SWAY_RANGE,
  BOSS_ORB_CHARGE_DURATION_SEC,
  BOSS_ORB_MAX_RADIUS,
  BOSS_ORB_MIN_RADIUS,
  BOSS_ORB_RECOVER_DURATION_SEC,
  BOSS_ORB_SPEED_X,
  BOSS_ORB_SPEED_Y,
  BOSS_RIGHT_CLAW_SWAY_RANGE,
  BOSS_SHIELD_ORBIT_RADIUS,
  BOSS_SHIELD_ORBIT_SPEED,
  BOSS_SHIELD_SEGMENT_COUNT,
  BOSS_SHIELD_SEGMENT_HIT_POINTS,
  BOSS_SHIELD_SEGMENT_SCORE,
  BOSS_SHIELD_SEGMENT_SIZE,
  BOSS_SKULL_ACTIVE_HEIGHT,
  BOSS_SKULL_ACTIVE_WIDTH,
  BOSS_SKULL_FALL_SPEED,
  BOSS_SKULL_HIT_POINTS,
  BOSS_SKULL_RECOVER_DURATION_SEC,
  BOSS_SKULL_SCORE,
  BOSS_SKULL_SLALOM_AMPLITUDE,
  BOSS_SKULL_SLALOM_FREQUENCY,
  BOSS_SKULL_START_Y,
  BOSS_SKULL_WALL_COUNT,
  BULLET_HEIGHT,
  BULLET_WIDTH,
  PLAYER_ACTIVE_HEIGHT,
  PLAYER_ACTIVE_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from './constants';
import { playerLaneWorldY } from './player-lanes';
import type { BossAttackState, BossClawSide, BossProjectile, BossShieldSegment, BossState, Bullet, PlayerState } from './types';

export interface BossScoreEvent {
  readonly playerIndex: number;
  readonly points: number;
}

export interface BossVisualCore {
  readonly x: number;
  readonly y: number;
  readonly vulnerable: boolean;
  readonly hitPoints: number;
  readonly maxHitPoints: number;
}

export interface BossVisualClaw {
  readonly side: BossClawSide;
  readonly x: number;
  readonly y: number;
  readonly rotationRad: number;
  readonly vulnerable: boolean;
  readonly striking: boolean;
  readonly hitPoints: number;
  readonly maxHitPoints: number;
}

export interface BossVisualShieldSegment {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly hitPoints: number;
}

export interface BossVisualOrb {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly charging: boolean;
}

export interface BossVisualSkull {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly rotationRad: number;
  readonly hitPoints: number;
}

export interface BossVisualWarningLine {
  readonly x: number;
  readonly width: number;
  readonly alpha: number;
}

export interface BossVisualState {
  readonly core: BossVisualCore;
  readonly claws: ReadonlyArray<BossVisualClaw>;
  readonly shieldSegments: ReadonlyArray<BossVisualShieldSegment>;
  readonly orbs: ReadonlyArray<BossVisualOrb>;
  readonly skulls: ReadonlyArray<BossVisualSkull>;
  readonly warningLines: ReadonlyArray<BossVisualWarningLine>;
  readonly attackKind: BossAttackState['kind'];
}

export interface BossStepResult {
  readonly boss: BossState;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly rngSeed: number;
}

export interface BossShotResolution {
  readonly boss: BossState | null;
  readonly bullets: ReadonlyArray<Bullet>;
  readonly scoreEvents: ReadonlyArray<BossScoreEvent>;
}

export interface BossHazardResolution {
  readonly boss: BossState;
  readonly hitPlayerIndices: ReadonlyArray<number>;
}

interface RandomValue {
  readonly seed: number;
  readonly value: number;
}

interface Rect {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
}

interface SegmentRectHit {
  readonly hit: boolean;
  readonly t: number;
}

interface BossPartSnapshot {
  readonly coreHitPoints: number;
  readonly leftClawHitPoints: number;
  readonly rightClawHitPoints: number;
  readonly shieldSegments: ReadonlyArray<BossShieldSegment>;
  readonly projectiles: ReadonlyArray<BossProjectile>;
}

function nextRandom(seed: number): RandomValue {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  return {
    seed: nextSeed,
    value: nextSeed / 4294967296
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  const aLeft = a.centerX - a.width * 0.5;
  const aRight = a.centerX + a.width * 0.5;
  const aTop = a.centerY - a.height * 0.5;
  const aBottom = a.centerY + a.height * 0.5;
  const bLeft = b.centerX - b.width * 0.5;
  const bRight = b.centerX + b.width * 0.5;
  const bTop = b.centerY - b.height * 0.5;
  const bBottom = b.centerY + b.height * 0.5;
  return aLeft <= bRight && aRight >= bLeft && aTop <= bBottom && aBottom >= bTop;
}

function collideSweptPointWithRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  rect: Rect,
  pointWidth: number,
  pointHeight: number
): SegmentRectHit {
  const minX = rect.centerX - rect.width * 0.5 - pointWidth * 0.5;
  const maxX = rect.centerX + rect.width * 0.5 + pointWidth * 0.5;
  const minY = rect.centerY - rect.height * 0.5 - pointHeight * 0.5;
  const maxY = rect.centerY + rect.height * 0.5 + pointHeight * 0.5;
  const dx = endX - startX;
  const dy = endY - startY;
  let tEnter = 0;
  let tExit = 1;

  if (dx === 0) {
    if (startX < minX || startX > maxX) {
      return {
        hit: false,
        t: 1
      };
    }
  } else {
    const invDx = 1 / dx;
    let tx1 = (minX - startX) * invDx;
    let tx2 = (maxX - startX) * invDx;
    if (tx1 > tx2) {
      const swap = tx1;
      tx1 = tx2;
      tx2 = swap;
    }
    tEnter = Math.max(tEnter, tx1);
    tExit = Math.min(tExit, tx2);
  }

  if (dy === 0) {
    if (startY < minY || startY > maxY) {
      return {
        hit: false,
        t: 1
      };
    }
  } else {
    const invDy = 1 / dy;
    let ty1 = (minY - startY) * invDy;
    let ty2 = (maxY - startY) * invDy;
    if (ty1 > ty2) {
      const swap = ty1;
      ty1 = ty2;
      ty2 = swap;
    }
    tEnter = Math.max(tEnter, ty1);
    tExit = Math.min(tExit, ty2);
  }

  return {
    hit: tEnter <= tExit && tEnter <= 1 && tExit >= 0,
    t: clamp01(tEnter)
  };
}

function bossCorePosition(boss: BossState): Readonly<{ x: number; y: number }> {
  return {
    x: boss.coreX,
    y: BOSS_CORE_Y + Math.sin(boss.elapsedSec * 1.2) * 6
  };
}

function livingClawSides(snapshot: BossPartSnapshot): ReadonlyArray<BossClawSide> {
  const sides: BossClawSide[] = [];
  if (snapshot.leftClawHitPoints > 0) {
    sides.push('left');
  }
  if (snapshot.rightClawHitPoints > 0) {
    sides.push('right');
  }
  return sides;
}

function livingShieldSegmentCount(snapshot: BossPartSnapshot): number {
  return snapshot.shieldSegments.filter((segment) => segment.hitPoints > 0).length;
}

export function countLivingShieldSegments(boss: BossState): number {
  return livingShieldSegmentCount(boss);
}

export function countLivingClaws(boss: BossState): number {
  return livingClawSides(boss).length;
}

function coreVulnerableFromSnapshot(snapshot: BossPartSnapshot): boolean {
  return snapshot.coreHitPoints > 0 && livingShieldSegmentCount(snapshot) === 0 && livingClawSides(snapshot).length === 0;
}

export function bossCoreIsVulnerable(boss: BossState): boolean {
  return coreVulnerableFromSnapshot(boss);
}

function bossAttackCooldown(snapshot: BossPartSnapshot): number {
  return livingClawSides(snapshot).length === 0 ? BOSS_ENRAGED_ATTACK_COOLDOWN_SEC : BOSS_ATTACK_COOLDOWN_SEC;
}

function clawHomePose(boss: BossState, side: BossClawSide): Readonly<{ x: number; y: number; rotationRad: number }> {
  const core = bossCorePosition(boss);
  const phase = side === 'left' ? 0.15 : 1.35;
  const swayRange = side === 'left' ? BOSS_LEFT_CLAW_SWAY_RANGE : BOSS_RIGHT_CLAW_SWAY_RANGE;
  return {
    x: core.x + (side === 'left' ? -BOSS_CLAW_OFFSET_X : BOSS_CLAW_OFFSET_X),
    y: BOSS_CLAW_BASE_Y + Math.sin(boss.elapsedSec * BOSS_CLAW_SWAY_SPEED + phase) * swayRange,
    rotationRad: Math.sin(boss.elapsedSec * 1.8 + phase) * 0.12
  };
}

function clawPose(boss: BossState, side: BossClawSide): Readonly<{ x: number; y: number; rotationRad: number; striking: boolean }> {
  const home = clawHomePose(boss, side);
  if (boss.attack.kind !== 'claw-slam') {
    return {
      ...home,
      striking: false
    };
  }

  const lane = boss.attack.lanes.find((entry) => entry.side === side);
  if (lane === undefined) {
    return {
      ...home,
      striking: false
    };
  }

  const spinDirection = side === 'left' ? -1 : 1;
  if (boss.attack.phase === 'telegraph') {
    const progress = clamp01(boss.attack.phaseElapsedSec / BOSS_CLAW_TELEGRAPH_DURATION_SEC);
    return {
      x: lane.x,
      y: lane.startY,
      rotationRad: spinDirection * progress * Math.PI * 2,
      striking: false
    };
  }

  if (boss.attack.phase === 'strike') {
    const progress = clamp01(boss.attack.phaseElapsedSec / BOSS_CLAW_STRIKE_DURATION_SEC);
    return {
      x: lane.x,
      y: lerp(lane.startY, lane.targetY, progress),
      rotationRad: spinDirection * (Math.PI * 2 + progress * Math.PI * 0.75),
      striking: true
    };
  }

  const progress = clamp01(boss.attack.phaseElapsedSec / BOSS_CLAW_RECOVER_DURATION_SEC);
  return {
    x: lerp(lane.x, home.x, progress),
    y: lerp(lane.targetY, home.y, progress),
    rotationRad: spinDirection * (1 - progress) * Math.PI * 0.45,
    striking: false
  };
}

function shieldPose(boss: BossState, id: number): Readonly<{ x: number; y: number }> {
  const core = bossCorePosition(boss);
  const angle = boss.elapsedSec * BOSS_SHIELD_ORBIT_SPEED + (id / BOSS_SHIELD_SEGMENT_COUNT) * Math.PI * 2;
  return {
    x: core.x + Math.cos(angle) * BOSS_SHIELD_ORBIT_RADIUS,
    y: core.y + Math.sin(angle) * (BOSS_SHIELD_ORBIT_RADIUS * 0.72)
  };
}

function offscreenProjectile(projectile: BossProjectile): boolean {
  if (projectile.kind === 'orb') {
    return projectile.y - projectile.radius > WORLD_HEIGHT + 40 || projectile.x < -80 || projectile.x > WORLD_WIDTH + 80;
  }

  return projectile.y - BOSS_SKULL_ACTIVE_HEIGHT * 0.5 > WORLD_HEIGHT + 40;
}

function startClawSlamAttack(boss: BossState, sides: ReadonlyArray<BossClawSide>): BossState {
  const lanes = sides.map((side) => {
    const pose = clawHomePose(boss, side);
    return {
      side,
      x: pose.x,
      startY: pose.y,
      targetY: BOSS_CLAW_STRIKE_TARGET_Y
    };
  });

  return {
    ...boss,
    attack: {
      kind: 'claw-slam',
      phase: 'telegraph',
      phaseElapsedSec: 0,
      lanes
    }
  };
}

function spawnOrbProjectiles(
  boss: BossState,
  sides: ReadonlyArray<BossClawSide>
): Readonly<{ projectiles: ReadonlyArray<BossProjectile>; nextProjectileId: number }> {
  const projectiles: BossProjectile[] = [];
  let nextProjectileId = boss.nextProjectileId;

  for (const side of sides) {
    const pose = clawHomePose(boss, side);
    projectiles.push({
      id: nextProjectileId,
      kind: 'orb',
      side,
      x: pose.x,
      y: pose.y,
      radius: BOSS_ORB_MIN_RADIUS,
      phase: 'charge',
      elapsedSec: 0,
      vx: side === 'left' ? BOSS_ORB_SPEED_X : -BOSS_ORB_SPEED_X,
      vy: BOSS_ORB_SPEED_Y
    });
    nextProjectileId += 1;
  }

  return {
    projectiles,
    nextProjectileId
  };
}

function startEnergyOrbAttack(boss: BossState, sides: ReadonlyArray<BossClawSide>): BossState {
  const spawned = spawnOrbProjectiles(boss, sides);
  return {
    ...boss,
    projectiles: boss.projectiles.concat(spawned.projectiles),
    nextProjectileId: spawned.nextProjectileId,
    attack: {
      kind: 'energy-orbs',
      recoverSec: BOSS_ORB_RECOVER_DURATION_SEC
    }
  };
}

function startSkullWallAttack(boss: BossState, rngSeed: number): Readonly<{ boss: BossState; rngSeed: number }> {
  const span = WORLD_WIDTH - 220;
  const step = span / (BOSS_SKULL_WALL_COUNT - 1);
  const projectiles: BossProjectile[] = [];
  let nextProjectileId = boss.nextProjectileId;
  let nextSeed = rngSeed;

  for (let index = 0; index < BOSS_SKULL_WALL_COUNT; index += 1) {
    const random = nextRandom(nextSeed);
    nextSeed = random.seed;
    const baseX = 110 + index * step;
    projectiles.push({
      id: nextProjectileId,
      kind: 'skull',
      x: baseX,
      y: BOSS_SKULL_START_Y,
      baseX,
      hitPoints: BOSS_SKULL_HIT_POINTS,
      elapsedSec: 0,
      driftPhase: random.value * Math.PI * 2,
      driftDirection: index % 2 === 0 ? -1 : 1
    });
    nextProjectileId += 1;
  }

  return {
    boss: {
      ...boss,
      projectiles: boss.projectiles.concat(projectiles),
      nextProjectileId,
      attack: {
        kind: 'skull-wall',
        recoverSec: BOSS_SKULL_RECOVER_DURATION_SEC
      }
    },
    rngSeed: nextSeed
  };
}

function startCoreBurstAttack(boss: BossState): BossState {
  return {
    ...boss,
    attack: {
      kind: 'core-burst',
      phase: 'charge',
      phaseElapsedSec: 0
    }
  };
}

function requirePlayerBulletIndex(bullet: Bullet): number {
  if (bullet.playerIndex === null) {
    throw new Error('Player-owned boss-hit bullet is missing playerIndex.');
  }

  return bullet.playerIndex;
}

function chooseAttack(
  boss: BossState,
  rngSeed: number
): Readonly<{ boss: BossState; bullets: ReadonlyArray<Bullet>; rngSeed: number }> {
  const livingClaws = livingClawSides(boss);
  if (livingClaws.length === 0) {
    const attackRoll = nextRandom(rngSeed);
    const skullWall = startSkullWallAttack(boss, attackRoll.seed);
    return {
      boss: attackRoll.value < 0.55 ? startCoreBurstAttack(boss) : skullWall.boss,
      bullets: [],
      rngSeed: attackRoll.value < 0.55 ? attackRoll.seed : skullWall.rngSeed
    };
  }

  const attackRoll = nextRandom(rngSeed);
  if (attackRoll.value < 0.36) {
    if (livingClaws.length === 2) {
      const variantRoll = nextRandom(attackRoll.seed);
      const sides: ReadonlyArray<BossClawSide> =
        variantRoll.value < 0.34 ? ['left'] : variantRoll.value < 0.68 ? ['right'] : ['left', 'right'];
      return {
        boss: startClawSlamAttack(boss, sides),
        bullets: [],
        rngSeed: variantRoll.seed
      };
    }

    return {
      boss: startClawSlamAttack(boss, livingClaws),
      bullets: [],
      rngSeed: attackRoll.seed
    };
  }

  if (attackRoll.value < 0.68) {
    return {
      boss: startEnergyOrbAttack(boss, livingClaws),
      bullets: [],
      rngSeed: attackRoll.seed
    };
  }

  const skullWall = startSkullWallAttack(boss, attackRoll.seed);
  return {
    boss: skullWall.boss,
    bullets: [],
    rngSeed: skullWall.rngSeed
  };
}

function spawnCoreBurstBullets(boss: BossState): ReadonlyArray<Bullet> {
  const core = bossCorePosition(boss);
  const offsets = [-56, -28, 0, 28, 56];
  return offsets.map((offset) => ({
    owner: 'enemy' as const,
    playerIndex: null,
    x: core.x + offset,
    y: core.y + BOSS_CORE_ACTIVE_HEIGHT * 0.45,
    vy: BOSS_CORE_BURST_BULLET_SPEED
  }));
}

function stepProjectiles(boss: BossState, dt: number): BossState {
  return {
    ...boss,
    projectiles: boss.projectiles
      .map<BossProjectile>((projectile) => {
        if (projectile.kind === 'orb') {
          if (projectile.phase === 'charge') {
            const elapsedSec = projectile.elapsedSec + dt;
            const progress = clamp01(elapsedSec / BOSS_ORB_CHARGE_DURATION_SEC);
            return {
              ...projectile,
              elapsedSec,
              radius: lerp(BOSS_ORB_MIN_RADIUS, BOSS_ORB_MAX_RADIUS, progress),
              phase: elapsedSec >= BOSS_ORB_CHARGE_DURATION_SEC ? ('flying' as const) : ('charge' as const)
            };
          }

          return {
            ...projectile,
            elapsedSec: projectile.elapsedSec + dt,
            x: projectile.x + projectile.vx * dt,
            y: projectile.y + projectile.vy * dt
          };
        }

        const elapsedSec = projectile.elapsedSec + dt;
        return {
          ...projectile,
          elapsedSec,
          y: projectile.y + BOSS_SKULL_FALL_SPEED * dt,
          x:
            projectile.baseX +
            Math.sin(elapsedSec * BOSS_SKULL_SLALOM_FREQUENCY + projectile.driftPhase) *
              BOSS_SKULL_SLALOM_AMPLITUDE *
              projectile.driftDirection
        };
      })
      .filter((projectile) => !offscreenProjectile(projectile) && (projectile.kind !== 'skull' || projectile.hitPoints > 0))
  };
}

function stepAttack(
  boss: BossState,
  dt: number,
  rngSeed: number
): Readonly<{ boss: BossState; bullets: ReadonlyArray<Bullet>; rngSeed: number }> {
  if (boss.attack.kind === 'idle') {
    const cooldownSec = Math.max(0, boss.attack.cooldownSec - dt);
    if (cooldownSec > 0) {
      return {
        boss: {
          ...boss,
          attack: {
            kind: 'idle',
            cooldownSec
          }
        },
        bullets: [],
        rngSeed
      };
    }

    return chooseAttack(
      {
        ...boss,
        attack: {
          kind: 'idle',
          cooldownSec: 0
        }
      },
      rngSeed
    );
  }

  if (boss.attack.kind === 'claw-slam') {
    const nextElapsedSec = boss.attack.phaseElapsedSec + dt;
    if (boss.attack.phase === 'telegraph') {
      if (nextElapsedSec < BOSS_CLAW_TELEGRAPH_DURATION_SEC) {
        return {
          boss: {
            ...boss,
            attack: {
              ...boss.attack,
              phaseElapsedSec: nextElapsedSec
            }
          },
          bullets: [],
          rngSeed
        };
      }

      return {
        boss: {
          ...boss,
          attack: {
            ...boss.attack,
            phase: 'strike',
            phaseElapsedSec: 0
          }
        },
        bullets: [],
        rngSeed
      };
    }

    if (boss.attack.phase === 'strike') {
      if (nextElapsedSec < BOSS_CLAW_STRIKE_DURATION_SEC) {
        return {
          boss: {
            ...boss,
            attack: {
              ...boss.attack,
              phaseElapsedSec: nextElapsedSec
            }
          },
          bullets: [],
          rngSeed
        };
      }

      return {
        boss: {
          ...boss,
          attack: {
            ...boss.attack,
            phase: 'recover',
            phaseElapsedSec: 0
          }
        },
        bullets: [],
        rngSeed
      };
    }

    if (nextElapsedSec < BOSS_CLAW_RECOVER_DURATION_SEC) {
      return {
        boss: {
          ...boss,
          attack: {
            ...boss.attack,
            phaseElapsedSec: nextElapsedSec
          }
        },
        bullets: [],
        rngSeed
      };
    }

    return {
      boss: {
        ...boss,
        attack: {
          kind: 'idle',
          cooldownSec: bossAttackCooldown(boss)
        }
      },
      bullets: [],
      rngSeed
    };
  }

  if (boss.attack.kind === 'energy-orbs') {
    const recoverSec = Math.max(0, boss.attack.recoverSec - dt);
    return {
      boss: {
        ...boss,
        attack:
          recoverSec === 0
            ? {
                kind: 'idle',
                cooldownSec: bossAttackCooldown(boss)
              }
            : {
                kind: 'energy-orbs',
                recoverSec
              }
      },
      bullets: [],
      rngSeed
    };
  }

  if (boss.attack.kind === 'skull-wall') {
    const recoverSec = Math.max(0, boss.attack.recoverSec - dt);
    return {
      boss: {
        ...boss,
        attack:
          recoverSec === 0
            ? {
                kind: 'idle',
                cooldownSec: bossAttackCooldown(boss)
              }
            : {
                kind: 'skull-wall',
                recoverSec
              }
      },
      bullets: [],
      rngSeed
    };
  }

  const nextElapsedSec = boss.attack.phaseElapsedSec + dt;
  if (boss.attack.phase === 'charge') {
    if (nextElapsedSec < BOSS_CORE_BURST_CHARGE_DURATION_SEC) {
      return {
        boss: {
          ...boss,
          attack: {
            ...boss.attack,
            phaseElapsedSec: nextElapsedSec
          }
        },
        bullets: [],
        rngSeed
      };
    }

    return {
      boss: {
        ...boss,
        attack: {
          kind: 'core-burst',
          phase: 'recover',
          phaseElapsedSec: 0
        }
      },
      bullets: spawnCoreBurstBullets(boss),
      rngSeed
    };
  }

  if (nextElapsedSec < BOSS_CORE_BURST_RECOVER_DURATION_SEC) {
    return {
      boss: {
        ...boss,
        attack: {
          ...boss.attack,
          phaseElapsedSec: nextElapsedSec
        }
      },
      bullets: [],
      rngSeed
    };
  }

  return {
    boss: {
      ...boss,
      attack: {
        kind: 'idle',
        cooldownSec: bossAttackCooldown(boss)
      }
    },
    bullets: [],
    rngSeed
  };
}

export function createInitialBossState(): BossState {
  return {
    elapsedSec: 0,
    coreX: WORLD_WIDTH * 0.5,
    coreDirection: 1,
    coreHitPoints: BOSS_CORE_HIT_POINTS,
    leftClawHitPoints: BOSS_CLAW_HIT_POINTS,
    rightClawHitPoints: BOSS_CLAW_HIT_POINTS,
    shieldSegments: Array.from({ length: BOSS_SHIELD_SEGMENT_COUNT }, (_, id) => ({
      id,
      hitPoints: BOSS_SHIELD_SEGMENT_HIT_POINTS
    })),
    projectiles: [],
    nextProjectileId: 0,
    attack: {
      kind: 'idle',
      cooldownSec: BOSS_ATTACK_COOLDOWN_SEC
    }
  };
}

export function stepBossState(
  boss: BossState,
  dt: number,
  rngSeed: number
): BossStepResult {
  const speed = livingClawSides(boss).length === 0 ? BOSS_CORE_ENRAGED_SPEED : BOSS_CORE_SPEED;
  const rawCoreX = boss.coreX + boss.coreDirection * speed * dt;
  const clampedCoreX = Math.max(BOSS_CORE_MIN_X, Math.min(BOSS_CORE_MAX_X, rawCoreX));
  const coreDirection =
    rawCoreX <= BOSS_CORE_MIN_X ? 1 : rawCoreX >= BOSS_CORE_MAX_X ? -1 : boss.coreDirection;
  const movedBoss = {
    ...boss,
    elapsedSec: boss.elapsedSec + dt,
    coreX: clampedCoreX,
    coreDirection
  };
  const projectileSteppedBoss = stepProjectiles(movedBoss, dt);
  const attackStep = stepAttack(projectileSteppedBoss, dt, rngSeed);

  return {
    boss: attackStep.boss,
    bullets: attackStep.bullets,
    rngSeed: attackStep.rngSeed
  };
}

export function buildBossVisualState(boss: BossState): BossVisualState {
  const core = bossCorePosition(boss);
  const claws: BossVisualClaw[] = [];

  for (const side of ['left', 'right'] as const) {
    const hitPoints = side === 'left' ? boss.leftClawHitPoints : boss.rightClawHitPoints;
    if (hitPoints <= 0) {
      continue;
    }

    const pose = clawPose(boss, side);
    claws.push({
      side,
      x: pose.x,
      y: pose.y,
      rotationRad: pose.rotationRad,
      vulnerable: true,
      striking: pose.striking,
      hitPoints,
      maxHitPoints: BOSS_CLAW_HIT_POINTS
    });
  }

  const shieldSegments = boss.shieldSegments.flatMap((segment) => {
    if (segment.hitPoints <= 0) {
      return [];
    }
    const pose = shieldPose(boss, segment.id);
    return [
      {
        id: segment.id,
        x: pose.x,
        y: pose.y,
        hitPoints: segment.hitPoints
      }
    ];
  });

  const orbs = boss.projectiles.flatMap((projectile) =>
    projectile.kind !== 'orb'
      ? []
      : [
          {
            id: projectile.id,
            x: projectile.x,
            y: projectile.y,
            radius: projectile.radius,
            charging: projectile.phase === 'charge'
          }
        ]
  );

  const skulls = boss.projectiles.flatMap((projectile) =>
    projectile.kind !== 'skull'
      ? []
      : [
          {
            id: projectile.id,
            x: projectile.x,
            y: projectile.y,
            rotationRad:
              Math.sin(projectile.elapsedSec * 6 + projectile.driftPhase) *
              projectile.driftDirection *
              0.32,
            hitPoints: projectile.hitPoints
          }
        ]
  );

  const warningLines =
    boss.attack.kind === 'claw-slam' && boss.attack.phase === 'telegraph'
      ? boss.attack.lanes.map((lane) => ({
          x: lane.x,
          width: BOSS_CLAW_ACTIVE_WIDTH * 0.8,
          alpha: 0.44 + Math.sin((boss.attack as Extract<BossAttackState, { kind: 'claw-slam' }>).phaseElapsedSec * 18 + lane.x * 0.03) * 0.16
        }))
      : [];

  return {
    core: {
      x: core.x,
      y: core.y,
      vulnerable: bossCoreIsVulnerable(boss),
      hitPoints: boss.coreHitPoints,
      maxHitPoints: BOSS_CORE_HIT_POINTS
    },
    claws,
    shieldSegments,
    orbs,
    skulls,
    warningLines,
    attackKind: boss.attack.kind
  };
}

export function resolvePlayerShotsAgainstBoss(
  boss: BossState,
  bullets: ReadonlyArray<Bullet>,
  dt: number
): BossShotResolution {
  const visuals = buildBossVisualState(boss);
  let coreHitPoints = boss.coreHitPoints;
  let leftClawHitPoints = boss.leftClawHitPoints;
  let rightClawHitPoints = boss.rightClawHitPoints;
  const shieldHitPointsById = new Map<number, number>(boss.shieldSegments.map((segment) => [segment.id, segment.hitPoints]));
  const projectileById = new Map<number, BossProjectile>(boss.projectiles.map((projectile) => [projectile.id, projectile]));
  const nextBullets: Bullet[] = [];
  const scoreEvents: BossScoreEvent[] = [];

  for (const bullet of bullets) {
    if (bullet.owner !== 'player') {
      nextBullets.push(bullet);
      continue;
    }

    const segmentStartX = bullet.x;
    const segmentStartY = bullet.y - bullet.vy * dt;
    const segmentEndX = bullet.x;
    const segmentEndY = bullet.y;
    let bestTarget:
      | Readonly<{ kind: 'skull'; id: number; t: number }>
      | Readonly<{ kind: 'shield'; id: number; t: number }>
      | Readonly<{ kind: 'claw'; side: BossClawSide; t: number }>
      | Readonly<{ kind: 'core'; t: number }>
      | null = null;

    for (const skull of visuals.skulls) {
      const projectile = projectileById.get(skull.id);
      if (projectile === undefined || projectile.kind !== 'skull' || projectile.hitPoints <= 0) {
        continue;
      }

      const hit = collideSweptPointWithRect(
        segmentStartX,
        segmentStartY,
        segmentEndX,
        segmentEndY,
        {
          centerX: skull.x,
          centerY: skull.y,
          width: BOSS_SKULL_ACTIVE_WIDTH,
          height: BOSS_SKULL_ACTIVE_HEIGHT
        },
        BULLET_WIDTH,
        BULLET_HEIGHT
      );
      if (!hit.hit || (bestTarget !== null && hit.t >= bestTarget.t)) {
        continue;
      }

      bestTarget = {
        kind: 'skull',
        id: skull.id,
        t: hit.t
      };
    }

    for (const segment of visuals.shieldSegments) {
      const hitPoints = shieldHitPointsById.get(segment.id);
      if (hitPoints === undefined || hitPoints <= 0) {
        continue;
      }

      const hit = collideSweptPointWithRect(
        segmentStartX,
        segmentStartY,
        segmentEndX,
        segmentEndY,
        {
          centerX: segment.x,
          centerY: segment.y,
          width: BOSS_SHIELD_SEGMENT_SIZE,
          height: BOSS_SHIELD_SEGMENT_SIZE
        },
        BULLET_WIDTH,
        BULLET_HEIGHT
      );
      if (!hit.hit || (bestTarget !== null && hit.t >= bestTarget.t)) {
        continue;
      }

      bestTarget = {
        kind: 'shield',
        id: segment.id,
        t: hit.t
      };
    }

    for (const claw of visuals.claws) {
      const hitPoints = claw.side === 'left' ? leftClawHitPoints : rightClawHitPoints;
      if (hitPoints <= 0) {
        continue;
      }

      const hit = collideSweptPointWithRect(
        segmentStartX,
        segmentStartY,
        segmentEndX,
        segmentEndY,
        {
          centerX: claw.x,
          centerY: claw.y,
          width: BOSS_CLAW_ACTIVE_WIDTH,
          height: BOSS_CLAW_ACTIVE_HEIGHT
        },
        BULLET_WIDTH,
        BULLET_HEIGHT
      );
      if (!hit.hit || (bestTarget !== null && hit.t >= bestTarget.t)) {
        continue;
      }

      bestTarget = {
        kind: 'claw',
        side: claw.side,
        t: hit.t
      };
    }

    if (coreHitPoints > 0) {
      const hit = collideSweptPointWithRect(
        segmentStartX,
        segmentStartY,
        segmentEndX,
        segmentEndY,
        {
          centerX: visuals.core.x,
          centerY: visuals.core.y,
          width: BOSS_CORE_ACTIVE_WIDTH,
          height: BOSS_CORE_ACTIVE_HEIGHT
        },
        BULLET_WIDTH,
        BULLET_HEIGHT
      );
      if (hit.hit && (bestTarget === null || hit.t < bestTarget.t)) {
        bestTarget = {
          kind: 'core',
          t: hit.t
        };
      }
    }

    if (bestTarget === null) {
      nextBullets.push(bullet);
      continue;
    }

    if (bestTarget.kind === 'skull') {
      const projectile = projectileById.get(bestTarget.id);
      if (projectile === undefined || projectile.kind !== 'skull') {
        throw new Error(`Boss skull projectile ${bestTarget.id} is missing.`);
      }
      const nextHitPoints = projectile.hitPoints - 1;
      if (nextHitPoints <= 0) {
        projectileById.delete(bestTarget.id);
        scoreEvents.push({
          playerIndex: requirePlayerBulletIndex(bullet),
          points: BOSS_SKULL_SCORE
        });
      } else {
        projectileById.set(bestTarget.id, {
          ...projectile,
          hitPoints: nextHitPoints
        });
      }
      continue;
    }

    if (bestTarget.kind === 'shield') {
      const currentHitPoints = shieldHitPointsById.get(bestTarget.id);
      if (currentHitPoints === undefined) {
        throw new Error(`Boss shield segment ${bestTarget.id} is missing.`);
      }
      const nextHitPoints = currentHitPoints - 1;
      shieldHitPointsById.set(bestTarget.id, nextHitPoints);
      if (nextHitPoints <= 0) {
        scoreEvents.push({
          playerIndex: requirePlayerBulletIndex(bullet),
          points: BOSS_SHIELD_SEGMENT_SCORE
        });
      }
      continue;
    }

    if (bestTarget.kind === 'claw') {
      if (bestTarget.side === 'left') {
        leftClawHitPoints -= 1;
        if (leftClawHitPoints === 0) {
          scoreEvents.push({
            playerIndex: requirePlayerBulletIndex(bullet),
            points: BOSS_CLAW_SCORE
          });
        }
      } else {
        rightClawHitPoints -= 1;
        if (rightClawHitPoints === 0) {
          scoreEvents.push({
            playerIndex: requirePlayerBulletIndex(bullet),
            points: BOSS_CLAW_SCORE
          });
        }
      }
      continue;
    }

    if (!coreVulnerableFromSnapshot({
      ...boss,
      coreHitPoints,
      leftClawHitPoints,
      rightClawHitPoints,
      shieldSegments: boss.shieldSegments.map((segment) => ({
        ...segment,
        hitPoints: shieldHitPointsById.get(segment.id) ?? 0
      })),
      projectiles: Array.from(projectileById.values())
    })) {
      continue;
    }

    coreHitPoints -= 1;
    if (coreHitPoints === 0) {
      scoreEvents.push({
        playerIndex: requirePlayerBulletIndex(bullet),
        points: BOSS_CORE_SCORE
      });
    }
  }

  if (coreHitPoints <= 0) {
    return {
      boss: null,
      bullets: nextBullets,
      scoreEvents
    };
  }

  return {
    boss: {
      ...boss,
      coreHitPoints,
      leftClawHitPoints: Math.max(0, leftClawHitPoints),
      rightClawHitPoints: Math.max(0, rightClawHitPoints),
      shieldSegments: boss.shieldSegments.map((segment) => ({
        ...segment,
        hitPoints: Math.max(0, shieldHitPointsById.get(segment.id) ?? 0)
      })),
      projectiles: boss.projectiles.flatMap((projectile) => {
        const nextProjectile = projectileById.get(projectile.id);
        return nextProjectile === undefined ? [] : [nextProjectile];
      })
    },
    bullets: nextBullets,
    scoreEvents
  };
}

function playerRect(player: PlayerState): Rect {
  return {
    centerX: player.x,
    centerY: playerLaneWorldY(player.lane),
    width: PLAYER_ACTIVE_WIDTH,
    height: PLAYER_ACTIVE_HEIGHT
  };
}

export function resolveBossHazards(
  boss: BossState,
  players: ReadonlyArray<PlayerState>
): BossHazardResolution {
  const visuals = buildBossVisualState(boss);
  const hittablePlayers = players.filter((player) => player.lives > 0 && player.respawnTimer === 0);
  const playerRects = new Map<number, Rect>(hittablePlayers.map((player) => [player.playerIndex, playerRect(player)]));
  const hitPlayerIndices: number[] = [];
  const consumedProjectileIds = new Set<number>();

  for (const claw of visuals.claws) {
    if (!claw.striking) {
      continue;
    }

    const clawRect: Rect = {
      centerX: claw.x,
      centerY: claw.y,
      width: BOSS_CLAW_ACTIVE_WIDTH,
      height: BOSS_CLAW_ACTIVE_HEIGHT
    };
    for (const player of hittablePlayers) {
      const rect = playerRects.get(player.playerIndex);
      if (rect === undefined || !rectsOverlap(rect, clawRect)) {
        continue;
      }
      hitPlayerIndices.push(player.playerIndex);
    }
  }

  for (const orb of visuals.orbs) {
    if (orb.charging) {
      continue;
    }

    const orbRect: Rect = {
      centerX: orb.x,
      centerY: orb.y,
      width: orb.radius * 1.9,
      height: orb.radius * 4.4
    };
    for (const player of hittablePlayers) {
      const rect = playerRects.get(player.playerIndex);
      if (rect === undefined || !rectsOverlap(rect, orbRect)) {
        continue;
      }
      hitPlayerIndices.push(player.playerIndex);
      consumedProjectileIds.add(orb.id);
    }
  }

  for (const skull of visuals.skulls) {
    const skullRect: Rect = {
      centerX: skull.x,
      centerY: skull.y,
      width: BOSS_SKULL_ACTIVE_WIDTH,
      height: BOSS_SKULL_ACTIVE_HEIGHT
    };
    for (const player of hittablePlayers) {
      const rect = playerRects.get(player.playerIndex);
      if (rect === undefined || !rectsOverlap(rect, skullRect)) {
        continue;
      }
      hitPlayerIndices.push(player.playerIndex);
      consumedProjectileIds.add(skull.id);
    }
  }

  return {
    boss: {
      ...boss,
      projectiles: boss.projectiles.filter((projectile) => !consumedProjectileIds.has(projectile.id))
    },
    hitPlayerIndices
  };
}
