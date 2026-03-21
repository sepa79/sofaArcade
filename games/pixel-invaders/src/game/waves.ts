import {
  CAMPAIGN_TRANSITION_DURATION_SEC,
  ENEMY_COLS,
  ENEMY_FIRE_INTERVAL,
  ENEMY_GAP_X,
  ENEMY_GAP_Y,
  ENEMY_ROW_UFO_CHANCE,
  ENEMY_ROWS,
  ENEMY_SPEED_START,
  ENEMY_START_X,
  ENEMY_START_Y,
  ENEMY_UFO_HIT_POINTS,
  ENEMY_UFO_SCORE,
  SCORE_PER_ENEMY
} from './constants';
import type {
  CampaignState,
  ClassicEndlessCampaignState,
  Enemy,
  EnemyPathMotion,
  EnemyWavePhase,
  GalagaRowsCampaignState,
  PowerupKind
} from './types';

export const CLASSIC_START_ROWS = 3;
export const CLASSIC_TOTAL_ROWS = 3;
export const GALAGA_TOTAL_ROWS = 3;

export interface GalagaRowDefinition {
  readonly rowNumber: number;
  readonly rowsTarget: number;
  readonly enemySpeed: number;
  readonly enemyFireInterval: number;
  readonly entryDurationSec: number;
  readonly entrySwayAmplitudeX: number;
  readonly diveCooldownSec: number;
  readonly maxConcurrentDivers: number;
  readonly attackDurationSec: number;
  readonly attackLoopDepthY: number;
  readonly attackSwayAmplitudeX: number;
  readonly attackSwayCycles: number;
  readonly ufoColumn: number | null;
}

interface RandomValue {
  readonly seed: number;
  readonly value: number;
}

function nextRandom(seed: number): RandomValue {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  return {
    seed: nextSeed,
    value: nextSeed / 4294967296
  };
}

function requireClassicRowNumber(rowNumber: number): number {
  if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > CLASSIC_TOTAL_ROWS) {
    throw new Error(`classic rowNumber must be an integer in [1, ${CLASSIC_TOTAL_ROWS}], got ${rowNumber}.`);
  }

  return rowNumber;
}

function requireGalagaRowNumber(rowNumber: number): number {
  if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > GALAGA_TOTAL_ROWS) {
    throw new Error(`galaga rowNumber must be an integer in [1, ${GALAGA_TOTAL_ROWS}], got ${rowNumber}.`);
  }

  return rowNumber;
}

function classicGuaranteedPickupKind(rowNumber: number): PowerupKind | null {
  return rowNumber <= CLASSIC_START_ROWS ? 'rapid-fire' : null;
}

function classicGuaranteedUfoColumn(rowNumber: number): number {
  return (rowNumber * 2 + 1) % ENEMY_COLS;
}

function classicRowUfoColumn(rowNumber: number, rngSeed: number): { readonly column: number | null; readonly rngSeed: number } {
  const guaranteedColumn = rowNumber <= CLASSIC_START_ROWS ? classicGuaranteedUfoColumn(rowNumber) : null;
  if (guaranteedColumn !== null) {
    return {
      column: guaranteedColumn,
      rngSeed
    };
  }

  const ufoRoll = nextRandom(rngSeed);
  if (ufoRoll.value >= ENEMY_ROW_UFO_CHANCE) {
    return {
      column: null,
      rngSeed: ufoRoll.seed
    };
  }

  const columnRoll = nextRandom(ufoRoll.seed);
  return {
    column: Math.floor(columnRoll.value * ENEMY_COLS),
    rngSeed: columnRoll.seed
  };
}

function galagaUfoColumn(rowNumber: number): number | null {
  if (rowNumber === 1 || rowNumber % 3 === 0) {
    return (rowNumber * 3 + 2) % ENEMY_COLS;
  }

  return null;
}

export function createInitialCampaignState(): ClassicEndlessCampaignState {
  return {
    phase: 'classic-endless',
    rowsCleared: 0,
    rowsSpawned: CLASSIC_START_ROWS,
    rowsTarget: CLASSIC_TOTAL_ROWS,
    startRows: CLASSIC_START_ROWS,
    transitionTimerSec: 0
  };
}

export function advanceCampaignState(campaign: CampaignState): CampaignState {
  if (campaign.phase === 'boss') {
    return campaign;
  }

  if (campaign.phase === 'classic-endless') {
    return {
      phase: 'galaga-rows',
      rowsCleared: 0,
      currentRowNumber: 1,
      rowsTarget: GALAGA_TOTAL_ROWS,
      transitionTimerSec: CAMPAIGN_TRANSITION_DURATION_SEC
    };
  }

  if (campaign.rowsCleared >= campaign.rowsTarget) {
    return {
      phase: 'boss',
      transitionTimerSec: CAMPAIGN_TRANSITION_DURATION_SEC
    };
  }

  return {
    ...campaign,
    currentRowNumber: campaign.currentRowNumber + 1,
    transitionTimerSec: CAMPAIGN_TRANSITION_DURATION_SEC
  };
}

export function classicEnemyFireInterval(campaign: ClassicEndlessCampaignState): number {
  return Math.max(0.4, ENEMY_FIRE_INTERVAL - campaign.rowsCleared * 0.03);
}

export function classicEnemyBaseSpeed(campaign: ClassicEndlessCampaignState): number {
  return ENEMY_SPEED_START + 18 + campaign.rowsCleared * 2.4;
}

export function galagaRowDefinition(rowNumber: number): GalagaRowDefinition {
  const normalizedRowNumber = requireGalagaRowNumber(rowNumber);

  return {
    rowNumber: normalizedRowNumber,
    rowsTarget: GALAGA_TOTAL_ROWS,
    enemySpeed: ENEMY_SPEED_START + 44 + normalizedRowNumber * 4,
    enemyFireInterval: Math.max(0.3, 0.56 - normalizedRowNumber * 0.018),
    entryDurationSec: Math.max(0.64, 0.9 - normalizedRowNumber * 0.018),
    entrySwayAmplitudeX: 58 + normalizedRowNumber * 4,
    diveCooldownSec: Math.max(0.42, 0.95 - normalizedRowNumber * 0.045),
    maxConcurrentDivers: normalizedRowNumber >= 6 ? 2 : 1,
    attackDurationSec: Math.max(1.45, 1.85 - normalizedRowNumber * 0.02),
    attackLoopDepthY: 150 + normalizedRowNumber * 7,
    attackSwayAmplitudeX: 68 + normalizedRowNumber * 4,
    attackSwayCycles: 2,
    ufoColumn: galagaUfoColumn(normalizedRowNumber)
  };
}

function createEntryMotion(
  x: number,
  y: number,
  rowNumber: number,
  rowIndex: number,
  col: number,
  entryDurationSec: number,
  entrySwayAmplitudeX: number
): EnemyPathMotion {
  const direction = (rowIndex + col + rowNumber) % 2 === 0 ? -1 : 1;
  return {
    kind: 'path',
    path: 'entry',
    elapsedSec: 0,
    durationSec: entryDurationSec + Math.abs(col - (ENEMY_COLS - 1) / 2) * 0.012,
    startX: x + direction * entrySwayAmplitudeX * 0.65,
    startY: y - 130 - rowIndex * 22,
    targetX: x,
    targetY: y,
    swayAmplitudeX: direction * entrySwayAmplitudeX,
    swayCycles: 1.5,
    loopDepthY: 28 + rowIndex * 3
  };
}

function createEnemy(
  id: number,
  x: number,
  y: number,
  kind: Enemy['kind'],
  motion: Enemy['motion'],
  guaranteedPickupKind: PowerupKind | null
): Enemy {
  return {
    id,
    x,
    y,
    alive: true,
    kind,
    scoreValue: kind === 'ufo' ? ENEMY_UFO_SCORE : SCORE_PER_ENEMY,
    hitPoints: kind === 'ufo' ? ENEMY_UFO_HIT_POINTS : 1,
    motion,
    guaranteedPickupKind
  };
}

export function spawnInitialClassicFormation(rngSeed: number): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly rngSeed: number;
} {
  let nextSeed = rngSeed;
  const enemies: Enemy[] = [];

  for (let row = 0; row < CLASSIC_START_ROWS; row += 1) {
    const rowNumber = row + 1;
    const ufo = classicRowUfoColumn(rowNumber, nextSeed);
    nextSeed = ufo.rngSeed;
    for (let col = 0; col < ENEMY_COLS; col += 1) {
      const id = row * ENEMY_COLS + col;
      const x = ENEMY_START_X + col * ENEMY_GAP_X;
      const y = ENEMY_START_Y + row * ENEMY_GAP_Y;
      const kind: Enemy['kind'] = ufo.column === col ? 'ufo' : 'normal';
      enemies.push(
        createEnemy(id, x, y, kind, { kind: 'formation' }, kind === 'ufo' ? classicGuaranteedPickupKind(rowNumber) : null)
      );
    }
  }

  return {
    enemies,
    rngSeed: nextSeed
  };
}

export function spawnClassicRowInSlot(
  enemies: ReadonlyArray<Enemy>,
  rowIndex: number,
  rowNumber: number,
  rngSeed: number
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly rngSeed: number;
} {
  requireClassicRowNumber(rowNumber);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= ENEMY_ROWS) {
    throw new Error(`rowIndex must be an integer in [0, ${ENEMY_ROWS - 1}], got ${rowIndex}.`);
  }

  const formationOffsetX = (() => {
    const anchorEnemy = enemies.find((enemy) => enemy.alive && enemy.motion.kind === 'formation');
    if (anchorEnemy === undefined) {
      return 0;
    }

    const anchorColumn = anchorEnemy.id % ENEMY_COLS;
    return anchorEnemy.x - (ENEMY_START_X + anchorColumn * ENEMY_GAP_X);
  })();
  const ufo = classicRowUfoColumn(rowNumber, rngSeed);

  return {
    enemies: enemies.map((enemy) => {
      if (Math.floor(enemy.id / ENEMY_COLS) !== rowIndex) {
        return enemy;
      }

      const col = enemy.id % ENEMY_COLS;
      const kind: Enemy['kind'] = ufo.column === col ? 'ufo' : 'normal';
      return createEnemy(
        enemy.id,
        formationOffsetX + ENEMY_START_X + col * ENEMY_GAP_X,
        ENEMY_START_Y - ENEMY_GAP_Y * 0.7,
        kind,
        { kind: 'formation' },
        kind === 'ufo' ? classicGuaranteedPickupKind(rowNumber) : null
      );
    }),
    rngSeed: ufo.rngSeed
  };
}

export function spawnGalagaRow(
  campaign: GalagaRowsCampaignState,
  spawnWithEntryMotion: boolean
): {
  readonly enemies: ReadonlyArray<Enemy>;
  readonly enemySpeed: number;
  readonly enemyFireTimer: number;
  readonly enemyDiveTimer: number;
} {
  const definition = galagaRowDefinition(campaign.currentRowNumber);
  const enemies: Enemy[] = [];

  for (let col = 0; col < ENEMY_COLS; col += 1) {
    const x = ENEMY_START_X + col * ENEMY_GAP_X;
    const y = ENEMY_START_Y + ENEMY_GAP_Y;
    const kind: Enemy['kind'] = definition.ufoColumn === col ? 'ufo' : 'normal';
    const motion = spawnWithEntryMotion
      ? createEntryMotion(x, y, definition.rowNumber, 0, col, definition.entryDurationSec, definition.entrySwayAmplitudeX)
      : { kind: 'formation' as const };
    enemies.push(createEnemy(col, motion.kind === 'path' ? motion.startX : x, motion.kind === 'path' ? motion.startY : y, kind, motion, null));
  }

  return {
    enemies,
    enemySpeed: definition.enemySpeed,
    enemyFireTimer: definition.enemyFireInterval,
    enemyDiveTimer: definition.diveCooldownSec
  };
}

export function enemyFireIntervalForCampaign(campaign: CampaignState): number {
  if (campaign.phase === 'classic-endless') {
    return classicEnemyFireInterval(campaign);
  }
  if (campaign.phase === 'galaga-rows') {
    return galagaRowDefinition(campaign.currentRowNumber).enemyFireInterval;
  }

  return Number.POSITIVE_INFINITY;
}

export function enemyBaseSpeedForCampaign(campaign: CampaignState): number {
  if (campaign.phase === 'classic-endless') {
    return classicEnemyBaseSpeed(campaign);
  }
  if (campaign.phase === 'galaga-rows') {
    return galagaRowDefinition(campaign.currentRowNumber).enemySpeed;
  }

  return ENEMY_SPEED_START;
}

export function enemyDiveCooldownForCampaign(campaign: CampaignState): number {
  if (campaign.phase !== 'galaga-rows') {
    return Number.POSITIVE_INFINITY;
  }

  return galagaRowDefinition(campaign.currentRowNumber).diveCooldownSec;
}

export function stageLabel(phase: EnemyWavePhase): 'CLASSIC' | 'GALAGA' | 'BOSS' {
  if (phase === 'classic-endless') {
    return 'CLASSIC';
  }
  if (phase === 'galaga-rows') {
    return 'GALAGA';
  }
  if (phase === 'boss') {
    return 'BOSS';
  }

  throw new Error(`Unsupported campaign phase: "${String(phase)}".`);
}
