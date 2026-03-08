import {
  ENEMY_COLS,
  ENEMY_DESCEND_STEP,
  ENEMY_DRIFT_DOWN_SPEED,
  ENEMY_GAP_X,
  ENEMY_GAP_Y,
  ENEMY_SPEED_STEP,
  ENEMY_START_X,
  ENEMY_START_Y,
  ENEMY_WIDTH,
  WORLD_WIDTH
} from './constants';
import type { CampaignState, Enemy, EnemyPathMotion, PlayerState } from './types';
import { galagaRowDefinition } from './waves';

interface RandomValue {
  readonly seed: number;
  readonly value: number;
}

interface FormationStepResult {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly direction: -1 | 1;
  readonly speed: number;
}

export interface EnemyStepResult {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly direction: -1 | 1;
  readonly speed: number;
  readonly diveTimer: number;
  readonly rngSeed: number;
}

function nextRandom(seed: number): RandomValue {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  return {
    seed: nextSeed,
    value: nextSeed / 4294967296
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function averageLivingPlayerX(players: ReadonlyArray<PlayerState>): number {
  const livingPlayers = players.filter((player) => player.lives > 0);
  if (livingPlayers.length === 0) {
    return WORLD_WIDTH / 2;
  }

  const totalX = livingPlayers.reduce((sum, player) => sum + player.x, 0);
  return totalX / livingPlayers.length;
}

function galagaFormationOffset(enemies: ReadonlyArray<Enemy>): Readonly<{ x: number; y: number }> | null {
  const anchorEnemy = enemies.find((enemy) => enemy.alive && enemy.motion.kind === 'formation');
  if (anchorEnemy === undefined) {
    return null;
  }

  return {
    x: anchorEnemy.x - (ENEMY_START_X + anchorEnemy.id * ENEMY_GAP_X),
    y: anchorEnemy.y - (ENEMY_START_Y + ENEMY_GAP_Y)
  };
}

function pathTargetPosition(
  enemy: Enemy,
  campaign: CampaignState,
  formationOffset: Readonly<{ x: number; y: number }> | null
): Readonly<{ x: number; y: number }> {
  if (enemy.motion.kind !== 'path') {
    throw new Error('Path target resolution requires path motion.');
  }

  if (enemy.motion.path !== 'attack') {
    return {
      x: enemy.motion.targetX,
      y: enemy.motion.targetY
    };
  }
  if (campaign.phase !== 'galaga-rows') {
    throw new Error('Attack path target resolution requires galaga-rows campaign phase.');
  }
  if (formationOffset === null) {
    return {
      x: ENEMY_START_X + enemy.id * ENEMY_GAP_X,
      y: enemy.motion.targetY
    };
  }

  return {
    x: ENEMY_START_X + enemy.id * ENEMY_GAP_X + formationOffset.x,
    y: enemy.motion.targetY
  };
}

function updatePathEnemy(
  enemy: Enemy,
  dt: number,
  campaign: CampaignState,
  formationOffset: Readonly<{ x: number; y: number }> | null
): Enemy {
  if (!enemy.alive || enemy.motion.kind !== 'path') {
    return enemy;
  }

  const nextElapsedSec = Math.min(enemy.motion.durationSec, enemy.motion.elapsedSec + dt);
  const progress = nextElapsedSec / enemy.motion.durationSec;
  const target = pathTargetPosition(enemy, campaign, formationOffset);
  const swayEnvelope = Math.sin(progress * Math.PI);
  const swayX =
    enemy.motion.path === 'attack'
      ? Math.sin(progress * Math.PI * 2) * enemy.motion.swayAmplitudeX * swayEnvelope
      : Math.sin(progress * Math.PI * enemy.motion.swayCycles) * enemy.motion.swayAmplitudeX;
  const swayY = swayEnvelope * enemy.motion.loopDepthY;
  if (nextElapsedSec >= enemy.motion.durationSec) {
    return {
      ...enemy,
      x: target.x,
      y: target.y,
      motion: { kind: 'formation' }
    };
  }

  return {
    ...enemy,
    x: lerp(enemy.motion.startX, target.x, progress) + swayX,
    y: lerp(enemy.motion.startY, target.y, progress) + swayY,
    motion: {
      ...enemy.motion,
      elapsedSec: nextElapsedSec
    }
  };
}

function movableFormationEnemyIds(
  previousEnemies: ReadonlyArray<Enemy>,
  updatedEnemies: ReadonlyArray<Enemy>
): ReadonlySet<number> {
  const previousFormationIds = new Set(
    previousEnemies
      .filter((enemy) => enemy.alive && enemy.motion.kind === 'formation')
      .map((enemy) => enemy.id)
  );
  return new Set(
    updatedEnemies
      .filter((enemy) => enemy.alive && enemy.motion.kind === 'formation' && previousFormationIds.has(enemy.id))
      .map((enemy) => enemy.id)
  );
}

function translateFormationEnemies(
  enemies: ReadonlyArray<Enemy>,
  movableIds: ReadonlySet<number>,
  deltaX: number,
  deltaY: number
): ReadonlyArray<Enemy> {
  return enemies.map((enemy) =>
    movableIds.has(enemy.id)
      ? {
          ...enemy,
          x: enemy.x + deltaX,
          y: enemy.y + deltaY
        }
      : enemy
  );
}

function stepFormationEnemies(
  previousEnemies: ReadonlyArray<Enemy>,
  updatedEnemies: ReadonlyArray<Enemy>,
  campaign: CampaignState,
  direction: -1 | 1,
  speed: number,
  dt: number
): FormationStepResult {
  const movableIds = movableFormationEnemyIds(previousEnemies, updatedEnemies);
  const formation = updatedEnemies.filter((enemy) => movableIds.has(enemy.id));
  if (formation.length === 0) {
    return {
      enemies: updatedEnemies,
      direction,
      speed
    };
  }

  const leftBoundaryX = ENEMY_WIDTH / 2;
  const rightBoundaryX = WORLD_WIDTH - ENEMY_WIDTH / 2;
  const horizontalStep = direction * speed * dt;
  const topLevelDriftY = campaign.phase === 'classic-endless' ? ENEMY_DRIFT_DOWN_SPEED * dt : 0;
  const leftmostX = Math.min(...formation.map((enemy) => enemy.x));
  const rightmostX = Math.max(...formation.map((enemy) => enemy.x));

  let safeHorizontalStep = horizontalStep;
  if (direction > 0) {
    safeHorizontalStep = Math.min(horizontalStep, rightBoundaryX - rightmostX);
  } else {
    safeHorizontalStep = Math.max(horizontalStep, leftBoundaryX - leftmostX);
  }

  const moved = translateFormationEnemies(updatedEnemies, movableIds, safeHorizontalStep, topLevelDriftY);
  const touchedBoundary = safeHorizontalStep !== horizontalStep;
  if (!touchedBoundary) {
    return {
      enemies: moved,
      direction,
      speed
    };
  }

  return {
    enemies: translateFormationEnemies(
      moved,
      movableIds,
      0,
      campaign.phase === 'classic-endless' ? ENEMY_DESCEND_STEP : 0
    ),
    direction: direction === 1 ? -1 : 1,
    speed: campaign.phase === 'classic-endless' ? speed + ENEMY_SPEED_STEP : speed
  };
}

function currentDivers(enemies: ReadonlyArray<Enemy>): number {
  return enemies.filter((enemy) => enemy.alive && enemy.motion.kind === 'path' && enemy.motion.path === 'attack').length;
}

function selectableDiveAttackers(enemies: ReadonlyArray<Enemy>): ReadonlyArray<Enemy> {
  const livingFormationCount = enemies.filter((enemy) => enemy.alive && enemy.motion.kind === 'formation').length;
  if (livingFormationCount <= 1) {
    return [];
  }

  return enemies.filter((enemy) => {
    if (!enemy.alive || enemy.motion.kind !== 'formation') {
      return false;
    }

    const rowIndex = Math.floor(enemy.id / ENEMY_COLS);
    return rowIndex <= 2;
  });
}

function attackMotion(enemy: Enemy, players: ReadonlyArray<PlayerState>, campaign: CampaignState): EnemyPathMotion {
  if (campaign.phase !== 'galaga-rows') {
    throw new Error('Dive attack motion requires galaga-rows campaign phase.');
  }

  const definition = galagaRowDefinition(campaign.currentRowNumber);
  const playerX = averageLivingPlayerX(players);
  const attackDirection = playerX >= enemy.x ? 1 : -1;
  const playerBiasX = Math.max(-36, Math.min(36, (playerX - enemy.x) * 0.12));

  return {
    kind: 'path',
    path: 'attack',
    elapsedSec: 0,
    durationSec: definition.attackDurationSec,
    startX: enemy.x,
    startY: enemy.y,
    targetX: enemy.x,
    targetY: enemy.y,
    swayAmplitudeX: attackDirection * (definition.attackSwayAmplitudeX + playerBiasX),
    swayCycles: 2,
    loopDepthY: definition.attackLoopDepthY
  };
}

function launchDiveAttack(
  enemies: ReadonlyArray<Enemy>,
  players: ReadonlyArray<PlayerState>,
  campaign: CampaignState,
  rngSeed: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly rngSeed: number;
} {
  const candidates = selectableDiveAttackers(enemies);
  if (candidates.length === 0) {
    return {
      enemies,
      rngSeed
    };
  }

  const random = nextRandom(rngSeed);
  const attackerIndex = Math.floor(random.value * candidates.length);
  const attacker = candidates[attackerIndex];
  if (attacker === undefined) {
    throw new Error(`Missing dive attacker for index ${attackerIndex}.`);
  }

  return {
    enemies: enemies.map((enemy) =>
      enemy.id === attacker.id
        ? {
            ...enemy,
            motion: attackMotion(enemy, players, campaign)
          }
        : enemy
    ),
    rngSeed: random.seed
  };
}

export function stepEnemies(
  enemies: ReadonlyArray<Enemy>,
  players: ReadonlyArray<PlayerState>,
  campaign: CampaignState,
  direction: -1 | 1,
  speed: number,
  diveTimer: number,
  dt: number,
  rngSeed: number
): EnemyStepResult {
  const formationStep = stepFormationEnemies(enemies, enemies, campaign, direction, speed, dt);
  const formationOffset = campaign.phase === 'galaga-rows' ? galagaFormationOffset(formationStep.enemies) : null;
  const pathUpdatedEnemies = formationStep.enemies.map((enemy) =>
    updatePathEnemy(enemy, dt, campaign, formationOffset)
  );

  if (campaign.phase !== 'galaga-rows') {
    return {
      enemies: pathUpdatedEnemies,
      direction: formationStep.direction,
      speed: formationStep.speed,
      diveTimer,
      rngSeed
    };
  }

  const definition = galagaRowDefinition(campaign.currentRowNumber);
  let nextDiveTimer = diveTimer - dt;
  let nextRngSeed = rngSeed;
  let nextEnemies: ReadonlyArray<Enemy> = pathUpdatedEnemies;

  while (nextDiveTimer <= 0) {
    if (currentDivers(nextEnemies) >= definition.maxConcurrentDivers) {
      nextDiveTimer += definition.diveCooldownSec;
      break;
    }

    const launched = launchDiveAttack(nextEnemies, players, campaign, nextRngSeed);
    if (launched.enemies === nextEnemies) {
      nextDiveTimer += definition.diveCooldownSec;
      break;
    }

    nextEnemies = launched.enemies;
    nextRngSeed = launched.rngSeed;
    nextDiveTimer += definition.diveCooldownSec;
  }

  return {
    enemies: nextEnemies,
    direction: formationStep.direction,
    speed: formationStep.speed,
    diveTimer: nextDiveTimer,
    rngSeed: nextRngSeed
  };
}
