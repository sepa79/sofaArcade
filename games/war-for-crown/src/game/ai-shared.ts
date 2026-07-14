import {
  fortificationDefinition,
  fortificationIndex,
  terrainDefenceMultiplier
} from './rules';
import type { PlayerProvinceView, PlayerPublicView, PlayerView } from './player-view';
import type { GameConfig, ProvinceId } from './types';

export type KnownProvinceView = Extract<PlayerProvinceView, { visibility: 'known' }>;

export function requireActiveAiView(view: PlayerView): void {
  if (view.phase === 'game-over') {
    throw new Error('Cannot choose an AI action after game over.');
  }

  if (view.activePlayerId !== view.playerId) {
    throw new Error(`Cannot choose an AI action for inactive player ${view.playerId}.`);
  }
}

export function requireSelfPlayer(
  view: PlayerView
): Extract<PlayerPublicView, { visibility: 'self' }> {
  const player = view.players.find((candidate) => candidate.id === view.playerId);
  if (player === undefined) {
    throw new Error(`Missing player view for ${view.playerId}.`);
  }

  if (player.visibility !== 'self') {
    throw new Error(`Player ${view.playerId} view does not include self details.`);
  }

  return player;
}

export function provinceViewById(
  view: PlayerView,
  provinceId: ProvinceId
): PlayerProvinceView {
  const province = view.map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown province id in player view: ${provinceId}.`);
  }

  return province;
}

export function provinceById(
  view: PlayerView,
  provinceId: ProvinceId
): KnownProvinceView | null {
  const province = provinceViewById(view, provinceId);
  return province.visibility === 'known' ? province : null;
}

export function knownProvinces(view: PlayerView): ReadonlyArray<KnownProvinceView> {
  return view.map.provinces.filter(
    (province): province is KnownProvinceView => province.visibility === 'known'
  );
}

export function ownedProvinces(view: PlayerView): ReadonlyArray<KnownProvinceView> {
  return knownProvinces(view).filter((province) => province.ownerId === view.playerId);
}

export function ownedProvinceMap(
  view: PlayerView
): ReadonlyMap<ProvinceId, KnownProvinceView> {
  return new Map(ownedProvinces(view).map((province) => [province.id, province]));
}

export { fortificationIndex };

export function provinceDefenceMultiplier(
  province: KnownProvinceView,
  config: GameConfig
): number {
  return terrainDefenceMultiplier(province.terrainId, config) *
    fortificationDefinition(province.fortificationLevel).defenceMultiplier;
}

export function frontierDistances(
  ownedById: ReadonlyMap<ProvinceId, KnownProvinceView>,
  frontierIds: ReadonlySet<ProvinceId>
): ReadonlyMap<ProvinceId, number> {
  const distances = new Map<ProvinceId, number>();
  const queue: ProvinceId[] = [];

  for (const provinceId of frontierIds) {
    if (!ownedById.has(provinceId)) {
      throw new Error(`Frontier province is not owned: ${provinceId}.`);
    }
    distances.set(provinceId, 0);
    queue.push(provinceId);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const provinceId = queue[cursor];
    if (provinceId === undefined) {
      throw new Error(`Missing frontier queue item at ${cursor}.`);
    }
    const province = ownedById.get(provinceId);
    if (province === undefined) {
      throw new Error(`Missing owned province for frontier distance: ${provinceId}.`);
    }
    const distance = distances.get(province.id);
    if (distance === undefined) {
      throw new Error(`Missing frontier distance for ${province.id}.`);
    }

    for (const neighbourId of province.neighbours) {
      if (!ownedById.has(neighbourId) || distances.has(neighbourId)) {
        continue;
      }
      distances.set(neighbourId, distance + 1);
      queue.push(neighbourId);
    }
  }

  return distances;
}
