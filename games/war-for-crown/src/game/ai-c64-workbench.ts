import {
  C64_BARON_ATTACK_THRESHOLD,
  chooseC64BattleDecision,
  minimumC64AttackersForThreshold
} from './battle-ai';
import { c64CombatSetupForProvince } from './c64-battle';
import { DEFAULT_GAME_CONFIG } from './constants';
import { isRoyalistOwner } from './owners';
import { terrainIncomeMultiplier } from './rules';
import type { WarForCrownAction } from './actions';
import type { PlayerView } from './player-view';
import type { GameConfig, ProvinceId } from './types';
import {
  fortificationIndex,
  frontierDistances,
  ownedProvinceMap,
  provinceById,
  provinceViewById,
  requireActiveAiView,
  requireSelfPlayer,
  type KnownProvinceView
} from './ai-shared';

const C64_GARRISON_SOLDIERS = 1;
const C64_ENEMY_TARGET_BONUS = 18;
const C64_NEUTRAL_TARGET_BONUS = 10;
const C64_TARGET_INCOME_WEIGHT = 9;
const C64_TARGET_VILLAGE_WEIGHT = 4;
const C64_TARGET_FORTIFICATION_WEIGHT = 5;
const C64_HOME_PROVINCE_BONUS = 8;
const C64_FRONTIER_VILLAGE_BONUS = 6;
const C64_VILLAGE_ROOM_WEIGHT = 3;
const C64_FORT_FRONTIER_BONUS = 12;
const C64_FORT_HOME_BONUS = 8;
const C64_FORT_TERRAIN_WEIGHT = 4;

interface C64FrontierTarget {
  readonly target: KnownProvinceView;
  readonly adjacentOwnedSources: ReadonlyArray<KnownProvinceView>;
  readonly mobileSources: ReadonlyArray<KnownProvinceView>;
  readonly mobileSoldiers: number;
  readonly requiredAttackers: number;
  readonly deficit: number;
  readonly targetValue: number;
}

interface C64AttackCandidate extends C64FrontierTarget {
  readonly selectedSources: ReadonlyArray<KnownProvinceView>;
  readonly committedSoldiers: number;
  readonly overmatch: number;
}

function mobileSoldiers(province: KnownProvinceView): number {
  if (province.attackSpent) {
    return 0;
  }
  return Math.max(0, province.soldiers - C64_GARRISON_SOLDIERS);
}

function targetValue(view: PlayerView, target: KnownProvinceView): number {
  const ownerBonus =
    isRoyalistOwner(target.ownerId) ? C64_NEUTRAL_TARGET_BONUS : C64_ENEMY_TARGET_BONUS;
  return ownerBonus +
    target.income * C64_TARGET_INCOME_WEIGHT +
    target.villages * C64_TARGET_VILLAGE_WEIGHT +
    fortificationIndex(target.fortificationLevel) * C64_TARGET_FORTIFICATION_WEIGHT +
    (target.ownerId === view.playerId ? -1000 : 0);
}

function requiredC64AttackersForTarget(target: KnownProvinceView, config: GameConfig): number {
  const combatSetup = c64CombatSetupForProvince(target, config);
  return minimumC64AttackersForThreshold({
    defenderSoldiers: target.soldiers,
    attackerCombatPercent: combatSetup.attackerCombatPercent,
    defenderCombatPercent: combatSetup.defenderCombatPercent,
    threshold: C64_BARON_ATTACK_THRESHOLD
  });
}

function homeSelectionAction(view: PlayerView, config: GameConfig): WarForCrownAction {
  const candidates = view.selectableHomeProvinceIds
    .map((provinceId) => {
      const province = provinceViewById(view, provinceId);
      return {
        provinceId,
        score:
          Math.round(terrainIncomeMultiplier(province.terrainId, config) * 100) +
          province.neighbours.length * C64_VILLAGE_ROOM_WEIGHT
      };
    })
    .sort((left, right) =>
      right.score - left.score ||
      left.provinceId.localeCompare(right.provinceId)
    );

  const selected = candidates[0];
  if (selected === undefined) {
    throw new Error('No selectable home province is visible.');
  }

  return {
    type: 'select-home',
    provinceId: selected.provinceId
  };
}

function compareSourcesByC64Usefulness(
  left: KnownProvinceView,
  right: KnownProvinceView
): number {
  return mobileSoldiers(right) - mobileSoldiers(left) ||
    right.soldiers - left.soldiers ||
    left.id.localeCompare(right.id);
}

function c64FrontierTargets(
  view: PlayerView,
  config: GameConfig,
  ownedById: ReadonlyMap<ProvinceId, KnownProvinceView>
): ReadonlyArray<C64FrontierTarget> {
  const targetsById = new Map<ProvinceId, C64FrontierTarget>();

  for (const source of ownedById.values()) {
    for (const neighbourId of source.neighbours) {
      const target = provinceById(view, neighbourId);
      if (target === null || target.ownerId === view.playerId || targetsById.has(target.id)) {
        continue;
      }

      const adjacentOwnedSources = target.neighbours
        .map((sourceId) => ownedById.get(sourceId))
        .filter((candidate): candidate is KnownProvinceView => candidate !== undefined)
        .sort(compareSourcesByC64Usefulness);
      const mobileSources = adjacentOwnedSources.filter(
        (candidate) => mobileSoldiers(candidate) > 0
      );
      const availableSoldiers = mobileSources.reduce(
        (total, candidate) => total + mobileSoldiers(candidate),
        0
      );
      const requiredAttackers = requiredC64AttackersForTarget(target, config);

      targetsById.set(target.id, {
        target,
        adjacentOwnedSources,
        mobileSources,
        mobileSoldiers: availableSoldiers,
        requiredAttackers,
        deficit: Math.max(0, requiredAttackers - availableSoldiers),
        targetValue: targetValue(view, target)
      });
    }
  }

  return [...targetsById.values()];
}

function selectedAttackSources(target: C64FrontierTarget): C64AttackCandidate | null {
  let committedSoldiers = 0;
  const selectedSources: KnownProvinceView[] = [];

  for (const source of target.mobileSources) {
    selectedSources.push(source);
    committedSoldiers += mobileSoldiers(source);
    if (committedSoldiers >= target.requiredAttackers) {
      return {
        ...target,
        selectedSources,
        committedSoldiers,
        overmatch: committedSoldiers - target.requiredAttackers
      };
    }
  }

  return null;
}

function attackAction(view: PlayerView, config: GameConfig): WarForCrownAction | null {
  const ownedById = ownedProvinceMap(view);
  const candidates = c64FrontierTargets(view, config, ownedById)
    .map(selectedAttackSources)
    .filter((candidate): candidate is C64AttackCandidate => candidate !== null)
    .sort((left, right) =>
      right.targetValue - left.targetValue ||
      left.overmatch - right.overmatch ||
      left.selectedSources.length - right.selectedSources.length ||
      left.target.id.localeCompare(right.target.id)
    );

  const selected = candidates[0];
  if (selected === undefined) {
    return null;
  }

  return {
    type: 'attack',
    fromProvinceIds: selected.selectedSources.map((source) => source.id),
    targetProvinceId: selected.target.id
  };
}

function movementAction(view: PlayerView, config: GameConfig): WarForCrownAction | null {
  const ownedById = ownedProvinceMap(view);
  const frontierIds = frontierSourceIds(view, config, ownedById);
  if (frontierIds.size < 1) {
    return null;
  }

  const distances = frontierDistances(ownedById, frontierIds);
  const candidates = [...ownedById.values()]
    .flatMap((source) => {
      const sourceDistance = distances.get(source.id);
      if (sourceDistance === undefined || sourceDistance < 1 || mobileSoldiers(source) < 1) {
        return [];
      }

      return source.neighbours.flatMap((targetId) => {
        const nextProvince = ownedById.get(targetId);
        if (nextProvince === undefined) {
          return [];
        }

        const targetDistance = distances.get(nextProvince.id);
        if (targetDistance === undefined || targetDistance >= sourceDistance) {
          return [];
        }

        return [{
          source,
          sourceDistance,
          target: nextProvince,
          targetDistance,
          soldiers: mobileSoldiers(source)
        }];
      });
    })
    .sort((left, right) =>
      right.sourceDistance - left.sourceDistance ||
      right.source.soldiers - left.source.soldiers ||
      left.targetDistance - right.targetDistance ||
      left.source.id.localeCompare(right.source.id) ||
      left.target.id.localeCompare(right.target.id)
    );

  const move = candidates[0];
  if (move === undefined) {
    return null;
  }

  return {
    type: 'move-soldiers',
    fromProvinceId: move.source.id,
    targetProvinceId: move.target.id,
    targetSoldiers: move.target.soldiers + move.soldiers
  };
}

function recruitmentAction(
  view: PlayerView,
  config: GameConfig,
  minimumSoldiers: number
): WarForCrownAction | null {
  const self = requireSelfPlayer(view);
  if (self.homeProvinceId === null) {
    throw new Error(`Player ${view.playerId} has no home province.`);
  }

  const homeProvince = provinceById(view, self.homeProvinceId);
  if (homeProvince === null || homeProvince.ownerId !== view.playerId) {
    return null;
  }

  const affordableSoldiers = Math.floor(self.money / config.soldierCost);
  if (affordableSoldiers < 1) {
    return null;
  }

  return {
    type: 'recruit-soldiers',
    soldiers: Math.max(1, Math.min(affordableSoldiers, minimumSoldiers))
  };
}

function militaryRecruitmentNeed(view: PlayerView, config: GameConfig): number {
  const targets = c64FrontierTargets(view, config, ownedProvinceMap(view));
  return targets.reduce((need, target) => Math.max(need, target.deficit), 0);
}

function frontierSourceIds(
  view: PlayerView,
  config: GameConfig,
  ownedById: ReadonlyMap<ProvinceId, KnownProvinceView>
): ReadonlySet<ProvinceId> {
  const targets = c64FrontierTargets(view, config, ownedById);
  return new Set(targets.flatMap((target) =>
    target.adjacentOwnedSources.map((source) => source.id)
  ));
}

function villageAction(view: PlayerView, config: GameConfig): WarForCrownAction | null {
  const self = requireSelfPlayer(view);
  if (self.money < config.villageCost) {
    return null;
  }

  const ownedById = ownedProvinceMap(view);
  const frontierIds = frontierSourceIds(view, config, ownedById);
  const candidates = [...ownedById.values()]
    .filter((province) => province.villages < config.maxVillages)
    .map((province) => ({
      province,
      score:
        Math.round(terrainIncomeMultiplier(province.terrainId, config) * 100) +
        (config.maxVillages - province.villages) * C64_VILLAGE_ROOM_WEIGHT +
        (frontierIds.has(province.id) ? C64_FRONTIER_VILLAGE_BONUS : 0) +
        (province.id === self.homeProvinceId ? C64_HOME_PROVINCE_BONUS : 0)
    }))
    .sort((left, right) =>
      right.score - left.score ||
      left.province.id.localeCompare(right.province.id)
    );

  const selected = candidates[0];
  if (selected === undefined) {
    return null;
  }

  return {
    type: 'build-village',
    provinceId: selected.province.id
  };
}

function fortificationAction(view: PlayerView, config: GameConfig): WarForCrownAction | null {
  const self = requireSelfPlayer(view);
  if (self.money < config.fortificationUpgradeCost) {
    return null;
  }

  const ownedById = ownedProvinceMap(view);
  const frontierIds = frontierSourceIds(view, config, ownedById);
  const candidates = [...ownedById.values()]
    .filter((province) => {
      const maxLevel =
        province.id === self.homeProvinceId
          ? config.maxHomeFortificationLevel
          : config.maxProvinceFortificationLevel;
      return fortificationIndex(province.fortificationLevel) < fortificationIndex(maxLevel) &&
        !province.upgradedFortificationThisTurn;
    })
    .map((province) => ({
      province,
      score:
        (frontierIds.has(province.id) ? C64_FORT_FRONTIER_BONUS : 0) +
        (province.id === self.homeProvinceId ? C64_FORT_HOME_BONUS : 0) +
        Math.round(c64CombatSetupForProvince(province, config).defenderCombatPercent / C64_FORT_TERRAIN_WEIGHT)
    }))
    .sort((left, right) =>
      right.score - left.score ||
      left.province.id.localeCompare(right.province.id)
    );

  const selected = candidates[0];
  if (selected === undefined) {
    return null;
  }

  return {
    type: 'upgrade-fortification',
    provinceId: selected.province.id
  };
}

function investmentAction(view: PlayerView, config: GameConfig): WarForCrownAction | null {
  const recruitmentNeed = militaryRecruitmentNeed(view, config);
  if (recruitmentNeed > 0) {
    const recruit = recruitmentAction(view, config, recruitmentNeed);
    if (recruit !== null) {
      return recruit;
    }
  }

  const village = villageAction(view, config);
  if (village !== null) {
    return village;
  }

  const fortification = fortificationAction(view, config);
  if (fortification !== null) {
    return fortification;
  }

  return recruitmentAction(view, config, 999);
}

function battleAction(view: PlayerView): WarForCrownAction {
  if (view.battle === null) {
    throw new Error('Cannot choose C64 battle action without battle state.');
  }

  const decision = chooseC64BattleDecision({
    battle: view.battle,
    attackerIsAi: true,
    defenderIsAi: false,
    defenderCanRetreat: false
  });
  return decision === 'retreat-attacker'
    ? { type: 'battle-retreat-attacker' }
    : { type: 'battle-round' };
}

export function chooseC64WorkbenchAiAction(
  view: PlayerView,
  config: GameConfig = DEFAULT_GAME_CONFIG
): WarForCrownAction {
  requireActiveAiView(view);

  if (view.battle !== null) {
    return battleAction(view);
  }

  if (view.phase === 'home-selection') {
    return homeSelectionAction(view, config);
  }

  if (view.turnStep === 'attack') {
    const attack = attackAction(view, config);
    return attack ?? { type: 'advance-step' };
  }

  if (view.turnStep === 'movement') {
    const move = movementAction(view, config);
    return move ?? { type: 'advance-step' };
  }

  if (view.turnStep === 'investment') {
    const investment = investmentAction(view, config);
    return investment ?? { type: 'advance-step' };
  }

  return {
    type: 'advance-step'
  };
}
