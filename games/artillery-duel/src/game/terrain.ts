import {
  TERRAIN_BASELINE_MAX,
  TERRAIN_BASELINE_MIN,
  TERRAIN_CONTROL_STEP,
  TERRAIN_MARGIN_BOTTOM,
  TERRAIN_SAMPLE_COUNT,
  TERRAIN_VARIANCE,
  TANK_BODY_HEIGHT,
  TANK_HALF_WIDTH,
  TANK_SAMPLE_MARGIN,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from './constants';
import type { PlayerState, TerrainState } from './types';

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function plateauHeight(heights: number[], centerIndex: number): void {
  const left = Math.max(0, centerIndex - 2);
  const right = Math.min(heights.length - 1, centerIndex + 2);
  const sum = heights.slice(left, right + 1).reduce((acc, value) => acc + value, 0);
  const flatHeight = sum / (right - left + 1);
  for (let index = left; index <= right; index += 1) {
    heights[index] = flatHeight;
  }
}

function smoothHeights(heights: readonly number[]): number[] {
  const smoothed = [...heights];
  for (let index = 1; index < heights.length - 1; index += 1) {
    smoothed[index] = (heights[index - 1] + heights[index] * 2 + heights[index + 1]) / 4;
  }

  return smoothed;
}

export function terrainSampleX(index: number): number {
  const spacing = WORLD_WIDTH / (TERRAIN_SAMPLE_COUNT - 1);
  return index * spacing;
}

export function tankSampleIndex(playerIndex: 0 | 1): number {
  if (playerIndex === 0) {
    return TANK_SAMPLE_MARGIN;
  }

  return TERRAIN_SAMPLE_COUNT - 1 - TANK_SAMPLE_MARGIN;
}

export function generateTerrain(seed: number): TerrainState {
  if (!Number.isInteger(seed)) {
    throw new Error(`Terrain seed must be an integer, got ${seed}.`);
  }

  const random = createSeededRandom(seed);
  const sampleSpacing = WORLD_WIDTH / (TERRAIN_SAMPLE_COUNT - 1);
  const controlPointCount = Math.floor((TERRAIN_SAMPLE_COUNT - 1) / TERRAIN_CONTROL_STEP) + 1;
  const controlHeights: number[] = [];
  const baselineMidpoint = (TERRAIN_BASELINE_MIN + TERRAIN_BASELINE_MAX) / 2;
  const baselineSwing = (TERRAIN_BASELINE_MAX - TERRAIN_BASELINE_MIN) * 0.18;

  for (let controlIndex = 0; controlIndex < controlPointCount; controlIndex += 1) {
    if (controlIndex === 0) {
      controlHeights.push(clamp(baselineMidpoint + (random() * 2 - 1) * baselineSwing, TERRAIN_BASELINE_MIN, TERRAIN_BASELINE_MAX));
      continue;
    }

    const previousHeight = controlHeights[controlIndex - 1];
    const drift = (random() * 2 - 1) * (TERRAIN_VARIANCE * 0.55);
    const nextHeight = clamp(previousHeight + drift, TERRAIN_BASELINE_MIN, TERRAIN_BASELINE_MAX);
    controlHeights.push(nextHeight);
  }

  let heights: number[] = [];
  for (let sampleIndex = 0; sampleIndex < TERRAIN_SAMPLE_COUNT; sampleIndex += 1) {
    const controlIndex = Math.floor(sampleIndex / TERRAIN_CONTROL_STEP);
    const localIndex = sampleIndex % TERRAIN_CONTROL_STEP;
    const interpolation = smoothstep(localIndex / TERRAIN_CONTROL_STEP);
    const p0 = controlHeights[Math.max(0, controlIndex - 1)];
    const p1 = controlHeights[controlIndex];
    const p2 = controlHeights[Math.min(controlHeights.length - 1, controlIndex + 1)];
    const p3 = controlHeights[Math.min(controlHeights.length - 1, controlIndex + 2)];
    heights.push(clamp(catmullRom(p0, p1, p2, p3, interpolation), TERRAIN_BASELINE_MIN, TERRAIN_BASELINE_MAX));
  }

  heights = smoothHeights(smoothHeights(heights));
  plateauHeight(heights, tankSampleIndex(0));
  plateauHeight(heights, tankSampleIndex(1));

  return {
    heights,
    sampleSpacing
  };
}

export function sampleTerrainHeight(terrain: TerrainState, x: number): number {
  const clampedX = clamp(x, 0, WORLD_WIDTH);
  const position = clampedX / terrain.sampleSpacing;
  const leftIndex = Math.floor(position);
  const rightIndex = Math.min(terrain.heights.length - 1, leftIndex + 1);
  const leftHeight = terrain.heights[leftIndex];
  const rightHeight = terrain.heights[rightIndex];
  if (leftHeight === undefined || rightHeight === undefined) {
    throw new Error(`Terrain sample missing for x=${x}.`);
  }
  const mix = position - leftIndex;
  return leftHeight + (rightHeight - leftHeight) * mix;
}

export function tankPositionX(playerIndex: 0 | 1): number {
  return terrainSampleX(tankSampleIndex(playerIndex));
}

export function anchorPlayersToTerrain(players: readonly [PlayerState, PlayerState], terrain: TerrainState): readonly [PlayerState, PlayerState] {
  return [
    {
      ...players[0],
      tankY: sampleTerrainHeight(terrain, players[0].tankX) - TANK_BODY_HEIGHT / 2
    },
    {
      ...players[1],
      tankY: sampleTerrainHeight(terrain, players[1].tankX) - TANK_BODY_HEIGHT / 2
    }
  ];
}

export function deformTerrain(terrain: TerrainState, impactX: number, radius: number, depth: number): TerrainState {
  const nextHeights = [...terrain.heights];
  for (let index = 0; index < nextHeights.length; index += 1) {
    const sampleX = index * terrain.sampleSpacing;
    const distance = Math.abs(sampleX - impactX);
    if (distance > radius) {
      continue;
    }

    const influence = 1 - distance / radius;
    const crater = depth * influence * influence;
    nextHeights[index] = Math.min(WORLD_HEIGHT - TERRAIN_MARGIN_BOTTOM, nextHeights[index] + crater);
  }

  return {
    heights: nextHeights,
    sampleSpacing: terrain.sampleSpacing
  };
}

export function tankHitCircleCenter(player: PlayerState): { readonly x: number; readonly y: number } {
  return {
    x: player.tankX,
    y: player.tankY - TANK_BODY_HEIGHT / 2
  };
}

export function tankBodyRect(player: PlayerState): { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } {
  return {
    left: player.tankX - TANK_HALF_WIDTH,
    right: player.tankX + TANK_HALF_WIDTH,
    top: player.tankY - TANK_BODY_HEIGHT,
    bottom: player.tankY
  };
}
