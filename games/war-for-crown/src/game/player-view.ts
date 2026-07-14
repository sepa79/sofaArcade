import { DEFAULT_GAME_CONFIG } from './constants';
import { calculateProvinceIncome } from './economy';
import { isRoyalistOwner } from './owners';
import type { OwnerId } from './owners';
import type {
  GameConfig,
  GamePhase,
  GameState,
  BattleState,
  PlayerId,
  ProvinceId,
  FortificationLevel,
  TerrainId,
  TileState,
  TurnStep
} from './types';

export type PlayerPublicView =
  | {
      readonly visibility: 'self';
      readonly id: PlayerId;
      readonly label: string;
      readonly color: number;
      readonly money: number;
      readonly homeProvinceId: ProvinceId | null;
      readonly provinceCount: number;
    }
  | {
      readonly visibility: 'opponent';
      readonly id: PlayerId;
      readonly label: string;
      readonly color: number;
      readonly homeProvinceId: ProvinceId | null;
      readonly provinceCount: number;
    };

export type PlayerProvinceView =
  | {
      readonly visibility: 'known';
      readonly id: ProvinceId;
      readonly terrainId: TerrainId;
      readonly neighbours: ReadonlyArray<ProvinceId>;
      readonly ownerId: OwnerId;
      readonly soldiers: number;
      readonly villages: number;
      readonly fortificationLevel: FortificationLevel;
      readonly upgradedFortificationThisTurn: boolean;
      readonly attackSpent: boolean;
      readonly income: number;
    }
  | {
      readonly visibility: 'distant';
      readonly id: ProvinceId;
      readonly terrainId: TerrainId;
      readonly neighbours: ReadonlyArray<ProvinceId>;
    };

export interface PlayerMapView {
  readonly width: number;
  readonly height: number;
  readonly tiles: ReadonlyArray<TileState>;
  readonly provinces: ReadonlyArray<PlayerProvinceView>;
}

export interface PlayerView {
  readonly playerId: PlayerId;
  readonly phase: GamePhase;
  readonly activePlayerId: PlayerId;
  readonly turnStep: TurnStep;
  readonly turnNumber: number;
  readonly winnerId: OwnerId | null;
  readonly battle: BattleState | null;
  readonly selectableHomeProvinceIds: ReadonlyArray<ProvinceId>;
  readonly map: PlayerMapView;
  readonly players: ReadonlyArray<PlayerPublicView>;
}

function requireKnownPlayer(state: GameState, playerId: PlayerId): void {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Unknown player id: ${playerId}.`);
  }
}

function visibleProvinceIds(state: GameState, playerId: PlayerId): ReadonlySet<ProvinceId> {
  if (state.phase === 'home-selection') {
    return new Set(state.map.provinces.map((province) => province.id));
  }

  const visible = new Set<ProvinceId>();
  for (const province of state.map.provinces) {
    if (province.ownerId !== playerId) {
      continue;
    }

    visible.add(province.id);
    for (const neighbourId of province.neighbours) {
      visible.add(neighbourId);
    }
  }
  return visible;
}

function createProvinceView(
  state: GameState,
  config: GameConfig,
  visible: ReadonlySet<ProvinceId>,
  provinceId: ProvinceId
): PlayerProvinceView {
  const province = state.map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown province id: ${provinceId}.`);
  }

  if (!visible.has(province.id)) {
    return {
      visibility: 'distant',
      id: province.id,
      terrainId: province.terrainId,
      neighbours: province.neighbours
    };
  }

  return {
    visibility: 'known',
    id: province.id,
    terrainId: province.terrainId,
    neighbours: province.neighbours,
    ownerId: province.ownerId,
    soldiers: province.soldiers,
    villages: province.villages,
    fortificationLevel: province.fortificationLevel,
    upgradedFortificationThisTurn: province.upgradedFortificationThisTurn,
    attackSpent: state.attackSpentProvinceIds.includes(province.id),
    income: calculateProvinceIncome(province, config)
  };
}

export function createPlayerView(
  state: GameState,
  playerId: PlayerId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): PlayerView {
  requireKnownPlayer(state, playerId);
  const visible = visibleProvinceIds(state, playerId);

  return {
    playerId,
    phase: state.phase,
    activePlayerId: state.activePlayerId,
    turnStep: state.turnStep,
    turnNumber: state.turnNumber,
    winnerId: state.winnerId,
    battle: state.battle,
    selectableHomeProvinceIds:
      state.phase === 'home-selection'
        ? state.map.provinces
            .filter((province) => isRoyalistOwner(province.ownerId))
            .map((province) => province.id)
        : [],
    map: {
      width: state.map.width,
      height: state.map.height,
      tiles: state.map.tiles,
      provinces: state.map.provinces.map((province) =>
        createProvinceView(state, config, visible, province.id)
      )
    },
    players: state.players.map((player) => {
      const provinceCount = state.map.provinces.filter((province) => province.ownerId === player.id).length;
      if (player.id === playerId) {
        return {
          visibility: 'self',
          id: player.id,
          label: player.label,
          color: player.color,
          money: player.money,
          homeProvinceId: player.homeProvinceId,
          provinceCount
        };
      }

      return {
        visibility: 'opponent',
        id: player.id,
        label: player.label,
        color: player.color,
        homeProvinceId: player.homeProvinceId,
        provinceCount
      };
    })
  };
}
