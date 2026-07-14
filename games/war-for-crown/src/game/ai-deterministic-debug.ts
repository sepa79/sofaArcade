import { minimumWinningAttackers } from './battle';
import { DEFAULT_GAME_CONFIG } from './constants';
import type { WarForCrownAction } from './actions';
import type { PlayerView } from './player-view';
import type { GameConfig, ProvinceId } from './types';
import {
  fortificationIndex,
  frontierDistances,
  ownedProvinceMap,
  ownedProvinces,
  provinceById,
  provinceDefenceMultiplier,
  requireActiveAiView,
  requireSelfPlayer,
  type KnownProvinceView
} from './ai-shared';

function attackAction(view: PlayerView, config: GameConfig): WarForCrownAction | null {
  const owned = [...ownedProvinces(view)].sort((left, right) => right.soldiers - left.soldiers);
  for (const from of owned) {
    if (from.attackSpent) {
      continue;
    }

    const maxAttackers = from.soldiers - 1;
    if (maxAttackers < 1) {
      continue;
    }

    for (const neighbourId of from.neighbours) {
      const target = provinceById(view, neighbourId);
      if (target === null || target.ownerId === view.playerId) {
        continue;
      }

      const required = minimumWinningAttackers({
        defendingSoldiers: target.soldiers,
        attackerMultiplier: 1,
        defenderMultiplier: provinceDefenceMultiplier(target, config)
      });
      if (required <= maxAttackers) {
        return {
          type: 'attack',
          fromProvinceIds: [from.id],
          targetProvinceId: target.id
        };
      }
    }
  }

  return null;
}

function investmentAction(view: PlayerView, config: GameConfig): WarForCrownAction | null {
  const self = requireSelfPlayer(view);
  const owned = [...ownedProvinces(view)].sort((left, right) => left.id.localeCompare(right.id));

  if (self.money >= config.villageCost) {
    const province = owned.find((candidate) => candidate.villages < config.maxVillages);
    if (province !== undefined) {
      return {
        type: 'build-village',
        provinceId: province.id
      };
    }
  }

  if (self.money >= config.fortificationUpgradeCost) {
    const province = owned.find((candidate) => {
      const maxLevel =
        candidate.id === self.homeProvinceId
          ? config.maxHomeFortificationLevel
          : config.maxProvinceFortificationLevel;
      return fortificationIndex(candidate.fortificationLevel) < fortificationIndex(maxLevel) &&
        !candidate.upgradedFortificationThisTurn;
    });
    if (province !== undefined) {
      return {
        type: 'upgrade-fortification',
        provinceId: province.id
      };
    }
  }

  if (self.money >= config.soldierCost) {
    if (self.homeProvinceId === null) {
      throw new Error(`Player ${view.playerId} has no home province.`);
    }

    const homeProvince = provinceById(view, self.homeProvinceId);
    if (homeProvince !== null && homeProvince.ownerId === view.playerId) {
      return {
        type: 'recruit-soldiers',
        soldiers: Math.floor(self.money / config.soldierCost)
      };
    }
  }

  return null;
}

function frontierProvinceIds(
  view: PlayerView,
  ownedById: ReadonlyMap<ProvinceId, KnownProvinceView>
): ReadonlySet<ProvinceId> {
  const frontier = new Set<ProvinceId>();
  for (const province of ownedById.values()) {
    const hasEnemyNeighbour = province.neighbours.some((neighbourId) => {
      const neighbour = provinceById(view, neighbourId);
      return neighbour !== null && neighbour.ownerId !== view.playerId;
    });
    if (hasEnemyNeighbour) {
      frontier.add(province.id);
    }
  }
  return frontier;
}

function movementAction(view: PlayerView): WarForCrownAction | null {
  const ownedById = ownedProvinceMap(view);
  const frontierIds = frontierProvinceIds(view, ownedById);
  if (frontierIds.size < 1) {
    return null;
  }

  const distances = frontierDistances(ownedById, frontierIds);
  const candidates = [...ownedById.values()]
    .flatMap((source) => {
      const sourceDistance = distances.get(source.id);
      if (sourceDistance === undefined || source.soldiers < 2) {
        return [];
      }

      return source.neighbours.flatMap((targetId) => {
        const target = ownedById.get(targetId);
        if (target === undefined) {
          return [];
        }

        const targetDistance = distances.get(target.id);
        if (targetDistance === undefined || targetDistance >= sourceDistance) {
          return [];
        }

        if (source.soldiers <= target.soldiers + 1) {
          return [];
        }

        return [{
          source,
          sourceDistance,
          target,
          targetDistance,
          soldiers: Math.max(1, Math.floor((source.soldiers - target.soldiers) / 2))
        }];
      });
    })
    .sort((left, right) =>
      right.sourceDistance - left.sourceDistance ||
      right.source.soldiers - left.source.soldiers ||
      left.target.soldiers - right.target.soldiers ||
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

export function chooseDeterministicAiAction(
  view: PlayerView,
  config: GameConfig = DEFAULT_GAME_CONFIG
): WarForCrownAction {
  requireActiveAiView(view);

  if (view.battle !== null) {
    return { type: 'battle-round' };
  }

  if (view.phase === 'home-selection') {
    const provinceId = view.selectableHomeProvinceIds[0];
    if (provinceId === undefined) {
      throw new Error('No selectable home province is visible.');
    }

    return {
      type: 'select-home',
      provinceId
    };
  }

  if (view.turnStep === 'attack') {
    const attack = attackAction(view, config);
    return attack ?? { type: 'advance-step' };
  }

  if (view.turnStep === 'movement') {
    const move = movementAction(view);
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
