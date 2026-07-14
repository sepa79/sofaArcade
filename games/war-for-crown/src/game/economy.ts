import { c64TerrainIncomePercent } from './c64-economy';
import type { GameConfig, PlayerId, ProvinceMapState, ProvinceState } from './types';

function requireProvinceIncomeInput(province: ProvinceState): void {
  if (!Number.isInteger(province.villages) || province.villages < 0) {
    throw new Error(`Province ${province.id} has invalid village count ${province.villages}.`);
  }
}

export function calculateProvinceIncome(
  province: ProvinceState,
  config: GameConfig
): number {
  requireProvinceIncomeInput(province);

  return Math.floor((province.villages * c64TerrainIncomePercent(province, config)) / 100);
}

export function calculateIncome(
  map: ProvinceMapState,
  playerId: PlayerId,
  config: GameConfig
): number {
  let weightedIncome = 0;

  for (const province of map.provinces) {
    if (province.ownerId !== playerId) {
      continue;
    }

    requireProvinceIncomeInput(province);
    weightedIncome = (
      weightedIncome + province.villages * c64TerrainIncomePercent(province, config)
    ) % 0x1000000;
  }

  return Math.floor(weightedIncome / 100);
}
