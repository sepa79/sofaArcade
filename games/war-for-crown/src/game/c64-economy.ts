import { c64TerrainIdForTerrainId, type C64TerrainId } from './c64-battle';
import type { GameConfig, ProvinceState, TerrainId } from './types';

const C64_TERRAIN_INCOME_PERCENT_BY_TERRAIN_ID: Readonly<Record<C64TerrainId, number>> = {
  1: 150,
  2: 100,
  3: 140,
  4: 130,
  5: 120,
  6: 100,
  7: 110
};

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}.`);
  }
}

export function c64TerrainIncomePercent(
  province: ProvinceState,
  config: Pick<GameConfig, 'terrainInfluence'>
): number {
  return c64TerrainIncomePercentForTerrainId(province.terrainId, config);
}

export function c64TerrainIncomePercentForTerrainId(
  terrainId: TerrainId,
  config: Pick<GameConfig, 'terrainInfluence'>
): number {
  if (config.terrainInfluence === 'none' || config.terrainInfluence === 'combat') {
    return 100;
  }

  return C64_TERRAIN_INCOME_PERCENT_BY_TERRAIN_ID[c64TerrainIdForTerrainId(terrainId)];
}

export function calculateC64ProvinceIncome(
  province: ProvinceState,
  config: Pick<GameConfig, 'terrainInfluence'>
): number {
  requireNonNegativeInteger(province.villages, `Province ${province.id} village count`);

  return Math.floor((province.villages * c64TerrainIncomePercent(province, config)) / 100);
}
