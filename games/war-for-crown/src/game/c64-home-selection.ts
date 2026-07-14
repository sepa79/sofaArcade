import { c64Divide32, c64Multiply32 } from './c64-arithmetic';
import { c64TerrainIdForTerrainId, type C64TerrainId } from './c64-battle';
import { buildMapProvinceTileCounts, provinceVillageCap } from './map';
import { isRoyalistOwner } from './owners';
import type { KnownProvinceView } from './ai-shared';
import type { PlayerView } from './player-view';
import type { GameConfig, ProvinceId } from './types';

const C64_SCORE_MODULUS = 0x1000000;
const C64_NORMAL_PROXIMITY_WEIGHT = 100;
const C64_NEAR_HOME_PROXIMITY_WEIGHT = 10;
const C64_OWNED_HOME_PROXIMITY_WEIGHT = 1;

const C64_HOME_TERRAIN_WEIGHT: Readonly<Record<C64TerrainId, number>> = {
  1: 60,
  2: 40,
  3: 56,
  4: 52,
  5: 48,
  6: 40,
  7: 44
};

const C64_HOME_TERRAIN_COMBAT_BONUS: Readonly<Record<C64TerrainId, number>> = {
  1: 0,
  2: 0,
  3: 40,
  4: 80,
  5: 120,
  6: 160,
  7: 200
};

interface C64HomeSelectionContext {
  readonly provinces: ReadonlyArray<KnownProvinceView>;
  readonly provinceById: ReadonlyMap<ProvinceId, KnownProvinceView>;
  readonly selectableProvinceIds: ReadonlySet<ProvinceId>;
  readonly previousHomeProximityIds: ReadonlySet<ProvinceId>;
  readonly tileCounts: ReadonlyMap<ProvinceId, number>;
}

function c64Score(value: number): number {
  return value % C64_SCORE_MODULUS;
}

function requireKnownHomeSelectionProvinces(
  view: PlayerView
): ReadonlyArray<KnownProvinceView> {
  if (view.phase !== 'home-selection') {
    throw new Error(`C64 home selection requires home-selection phase, got ${view.phase}.`);
  }

  return view.map.provinces.map((province) => {
    if (province.visibility !== 'known') {
      throw new Error(`C64 home selection requires known details for province ${province.id}.`);
    }
    return province;
  });
}

function previousHomeProximityIds(
  view: PlayerView,
  provinceById: ReadonlyMap<ProvinceId, KnownProvinceView>
): ReadonlySet<ProvinceId> {
  const activePlayerIndex = view.players.findIndex((player) => player.id === view.playerId);
  if (activePlayerIndex < 0) {
    throw new Error(`Missing C64 home-selection player ${view.playerId}.`);
  }

  const proximityIds = new Set<ProvinceId>();
  for (const player of view.players.slice(0, activePlayerIndex)) {
    if (player.homeProvinceId === null) {
      throw new Error(`Previous C64 player ${player.id} has no home province.`);
    }
    const home = provinceById.get(player.homeProvinceId);
    if (home === undefined) {
      throw new Error(`Unknown previous C64 home province ${player.homeProvinceId}.`);
    }
    proximityIds.add(home.id);
    for (const neighbourId of home.neighbours) {
      proximityIds.add(neighbourId);
    }
  }
  return proximityIds;
}

function createContext(view: PlayerView): C64HomeSelectionContext {
  const provinces = requireKnownHomeSelectionProvinces(view);
  const provinceById = new Map(provinces.map((province) => [province.id, province]));
  const selectableProvinceIds = new Set(view.selectableHomeProvinceIds);
  for (const provinceId of selectableProvinceIds) {
    const province = provinceById.get(provinceId);
    if (province === undefined) {
      throw new Error(`Unknown selectable C64 home province ${provinceId}.`);
    }
    if (!isRoyalistOwner(province.ownerId)) {
      throw new Error(`Selectable C64 home province ${provinceId} is already owned.`);
    }
  }

  return {
    provinces,
    provinceById,
    selectableProvinceIds,
    previousHomeProximityIds: previousHomeProximityIds(view, provinceById),
    tileCounts: buildMapProvinceTileCounts(view.map)
  };
}

function requireProvince(
  context: C64HomeSelectionContext,
  provinceId: ProvinceId
): KnownProvinceView {
  const province = context.provinceById.get(provinceId);
  if (province === undefined) {
    throw new Error(`Unknown C64 home-selection province ${provinceId}.`);
  }
  return province;
}

function selectedProvinceIds(
  context: C64HomeSelectionContext,
  provinceId: ProvinceId
): ReadonlySet<ProvinceId> {
  const province = requireProvince(context, provinceId);
  const selected = new Set<ProvinceId>([province.id]);
  for (const neighbourId of province.neighbours) {
    requireProvince(context, neighbourId);
    selected.add(neighbourId);
  }
  return selected;
}

function boundaryProvinceIds(
  context: C64HomeSelectionContext,
  selectedIds: ReadonlySet<ProvinceId>
): ReadonlySet<ProvinceId> {
  const boundaryIds = new Set<ProvinceId>();
  for (const provinceId of selectedIds) {
    const province = requireProvince(context, provinceId);
    if (province.neighbours.some((neighbourId) => !selectedIds.has(neighbourId))) {
      boundaryIds.add(provinceId);
    }
  }
  return boundaryIds;
}

function terrainCombatInfluenceEnabled(config: GameConfig): boolean {
  return config.terrainInfluence === 'combat' || config.terrainInfluence === 'both';
}

function baseProvinceScore(
  context: C64HomeSelectionContext,
  province: KnownProvinceView,
  config: GameConfig
): number {
  const terrainId = c64TerrainIdForTerrainId(province.terrainId);
  const villageCapacity = provinceVillageCap(config, province.id, context.tileCounts);
  const terrainScore = (villageCapacity + province.villages) * C64_HOME_TERRAIN_WEIGHT[terrainId];
  const combatBonus = terrainCombatInfluenceEnabled(config)
    ? C64_HOME_TERRAIN_COMBAT_BONUS[terrainId]
    : 0;
  return c64Score(terrainScore + combatBonus);
}

function proximityWeight(
  context: C64HomeSelectionContext,
  selectedIds: ReadonlySet<ProvinceId>
): number {
  let weight = C64_NORMAL_PROXIMITY_WEIGHT;
  for (const provinceId of selectedIds) {
    if (!context.previousHomeProximityIds.has(provinceId)) {
      continue;
    }
    const province = requireProvince(context, provinceId);
    const candidateWeight = isRoyalistOwner(province.ownerId)
      ? C64_NEAR_HOME_PROXIMITY_WEIGHT
      : C64_OWNED_HOME_PROXIMITY_WEIGHT;
    weight = Math.min(weight, candidateWeight);
  }
  return weight;
}

function candidateScore(
  context: C64HomeSelectionContext,
  candidate: KnownProvinceView,
  config: GameConfig
): number {
  const selectedIds = selectedProvinceIds(context, candidate.id);
  const boundaryCount = boundaryProvinceIds(context, selectedIds).size;
  if (boundaryCount === 0) {
    throw new Error(`C64 home candidate ${candidate.id} has no selected-set boundary.`);
  }

  let aggregateScore = c64Score(baseProvinceScore(context, candidate, config) * 2);
  for (const province of context.provinces) {
    if (selectedIds.has(province.id)) {
      aggregateScore = c64Score(aggregateScore + baseProvinceScore(context, province, config));
    }
  }

  const weightedScore = c64Multiply32(aggregateScore, proximityWeight(context, selectedIds));
  return c64Score(c64Divide32(weightedScore, boundaryCount).quotient);
}

function applySingleBoundaryAdjustment(
  context: C64HomeSelectionContext,
  provinceId: ProvinceId
): ProvinceId {
  const boundaryIds = boundaryProvinceIds(context, selectedProvinceIds(context, provinceId));
  if (boundaryIds.size !== 1) {
    return provinceId;
  }

  for (let index = context.provinces.length - 1; index >= 0; index -= 1) {
    const province = context.provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 province at index ${index}.`);
    }
    if (boundaryIds.has(province.id) && isRoyalistOwner(province.ownerId)) {
      return province.id;
    }
  }
  return provinceId;
}

export function selectC64HomeProvince(view: PlayerView, config: GameConfig): ProvinceId {
  const context = createContext(view);
  let bestProvinceId: ProvinceId | null = null;
  let bestScore = 0;

  for (let index = context.provinces.length - 1; index >= 0; index -= 1) {
    const province = context.provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 province at index ${index}.`);
    }
    if (!context.selectableProvinceIds.has(province.id)) {
      continue;
    }
    const score = candidateScore(context, province, config);
    if (score >= bestScore) {
      bestScore = score;
      bestProvinceId = province.id;
    }
  }

  if (bestProvinceId === null) {
    throw new Error('No selectable C64 home province exists.');
  }
  return applySingleBoundaryAdjustment(context, bestProvinceId);
}
