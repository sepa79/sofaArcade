import { MENU_SECTION_ORDER, SEASON_ORDER } from './constants';
import type { DetailModeId, FrameInput, GameState, MenuSectionId, PlayerState, SeasonId } from './types';

function currentSeasonIndex(season: SeasonId): number {
  const index = SEASON_ORDER.indexOf(season);
  if (index < 0) {
    throw new Error(`Unknown season "${season}".`);
  }

  return index;
}

function nextSeason(season: SeasonId): { readonly season: SeasonId; readonly yearOffset: number } {
  const index = currentSeasonIndex(season);
  const nextIndex = (index + 1) % SEASON_ORDER.length;
  return {
    season: SEASON_ORDER[nextIndex],
    yearOffset: nextIndex === 0 ? 1 : 0
  };
}

function rotateMenu(section: MenuSectionId, delta: number): MenuSectionId {
  const index = MENU_SECTION_ORDER.indexOf(section);
  if (index < 0) {
    throw new Error(`Unknown menu section "${section}".`);
  }

  const nextIndex = (index + delta + MENU_SECTION_ORDER.length) % MENU_SECTION_ORDER.length;
  return MENU_SECTION_ORDER[nextIndex];
}

function submenuCount(section: MenuSectionId): number {
  switch (section) {
    case 'crops':
      return 0;
    case 'animals':
      return 3;
    case 'house':
      return 3;
  }
}

function menuSubmenuCount(player: PlayerState): number {
  if (player.activeMenuSection === 'crops') {
    return player.farm.fields.length;
  }

  return submenuCount(player.activeMenuSection);
}

function rotateSubmenuIndex(player: PlayerState, delta: number): number {
  const count = menuSubmenuCount(player);
  if (count <= 0) {
    throw new Error(`Cannot rotate submenu for section "${player.activeMenuSection}" with count ${count}.`);
  }

  const currentIndex = player.activeSubmenuIndex;
  return (currentIndex + delta + count) % count;
}

function detailCount(player: PlayerState): number {
  switch (player.detailMode) {
    case 'menu':
      return 0;
    case 'fields':
      return player.farm.fields.length;
    case 'animals':
      return 3;
    case 'buildings':
      return player.farm.buildings.length;
  }
}

function detailMenuCount(player: PlayerState): number {
  if (player.detailMode === 'fields') {
    return 1;
  }

  return player.detailMode === 'menu' ? menuSubmenuCount(player) : detailCount(player) + 1;
}

function rotateDetailMenuIndex(player: PlayerState, delta: number): number {
  const count = detailMenuCount(player);
  return (player.detailMenuIndex + delta + count) % count;
}

function nextDetailIndex(player: PlayerState, detailMenuIndex: number): number {
  const count = detailCount(player);
  if (count <= 0) {
    throw new Error(`Cannot select detail index for mode "${player.detailMode}" with count ${count}.`);
  }

  if (detailMenuIndex >= count) {
    return player.detailIndex;
  }

  return detailMenuIndex;
}

function nextDetailMode(player: PlayerState): DetailModeId {
  if (player.activeMenuSection === 'crops' && player.activeSubmenuIndex < player.farm.fields.length) {
    return 'fields';
  }

  if (player.activeMenuSection === 'animals' && player.activeSubmenuIndex === 0) {
    return 'animals';
  }

  if (player.activeMenuSection === 'house' && player.activeSubmenuIndex === 0) {
    return 'buildings';
  }

  return 'menu';
}

function updateActivePlayer(
  state: GameState,
  update: (player: PlayerState) => PlayerState
): ReadonlyArray<PlayerState> {
  return state.players.map((player, index) => (index === state.activePlayerIndex ? update(player) : player));
}

function nextPlayerIndex(state: GameState): { readonly activePlayerIndex: number; readonly wrapped: boolean } {
  const nextIndex = state.activePlayerIndex + 1;
  if (nextIndex < state.players.length) {
    return {
      activePlayerIndex: nextIndex,
      wrapped: false
    };
  }

  return {
    activePlayerIndex: 0,
    wrapped: true
  };
}

export function stepGame(state: GameState, input: FrameInput): GameState {
  let nextState = state;

  if (input.menuRightPressed) {
    nextState = {
      ...nextState,
      players: updateActivePlayer(nextState, (player) => ({
        ...player,
        ...(player.detailMode === 'fields'
          ? {
              detailMode: 'menu' as const,
              detailIndex: 0,
              detailMenuIndex: 0
            }
          : player.detailMode === 'menu'
            ? {
                activeMenuSection: rotateMenu(player.activeMenuSection, 1),
                activeSubmenuIndex: 0,
                detailMode: 'menu' as const,
                detailIndex: 0,
                detailMenuIndex: 0
              }
            : {})
      }))
    };
  }

  if (input.menuLeftPressed) {
    nextState = {
      ...nextState,
      players: updateActivePlayer(nextState, (player) => ({
        ...player,
        ...(player.detailMode === 'fields'
          ? {
              detailMode: 'menu' as const,
              detailIndex: 0,
              detailMenuIndex: 0
            }
          : player.detailMode === 'menu'
            ? {
                activeMenuSection: rotateMenu(player.activeMenuSection, -1),
                activeSubmenuIndex: 0,
                detailMode: 'menu' as const,
                detailIndex: 0,
                detailMenuIndex: 0
              }
            : {})
      }))
    };
  }

  if (input.submenuDownPressed) {
    nextState = {
      ...nextState,
      players: updateActivePlayer(nextState, (player) => ({
        ...player,
        ...(player.detailMode === 'menu'
          ? {
              activeSubmenuIndex: rotateSubmenuIndex(player, 1)
            }
          : {
              detailMenuIndex: rotateDetailMenuIndex(player, 1),
              detailIndex: nextDetailIndex(player, rotateDetailMenuIndex(player, 1))
            })
      }))
    };
  }

  if (input.submenuUpPressed) {
    nextState = {
      ...nextState,
      players: updateActivePlayer(nextState, (player) => ({
        ...player,
        ...(player.detailMode === 'menu'
          ? {
              activeSubmenuIndex: rotateSubmenuIndex(player, -1)
            }
          : {
              detailMenuIndex: rotateDetailMenuIndex(player, -1),
              detailIndex: nextDetailIndex(player, rotateDetailMenuIndex(player, -1))
            })
      }))
    };
  }

  if (input.selectPressed) {
    nextState = {
      ...nextState,
      players: updateActivePlayer(nextState, (player) => {
        if (player.detailMode !== 'menu') {
          if (player.detailMode === 'fields') {
            return player;
          }

          if (player.detailMenuIndex === detailMenuCount(player) - 1) {
            return {
              ...player,
              detailMode: 'menu',
              detailIndex: 0,
              detailMenuIndex: 0
            };
          }

          return player;
        }

        const mode = nextDetailMode(player);
        if (mode === 'menu') {
          return player;
        }

        const detailPlayer: PlayerState = {
          ...player,
          detailMode: mode,
          detailIndex: player.activeMenuSection === 'crops' ? player.activeSubmenuIndex : 0,
          detailMenuIndex: 0
        };

        if (detailCount(detailPlayer) <= 0) {
          throw new Error(`Cannot enter detail mode "${mode}" without data for player ${player.label}.`);
        }

        return detailPlayer;
      })
    };
  }

  if (input.backPressed) {
    nextState = {
      ...nextState,
      players: updateActivePlayer(nextState, (player) => ({
        ...player,
        detailMode: 'menu',
        detailIndex: 0,
        detailMenuIndex: 0
      }))
    };
  }

  if (input.endTurnPressed) {
    const nextPlayer = nextPlayerIndex(nextState);
    if (nextPlayer.wrapped) {
      const next = nextSeason(nextState.season);
      nextState = {
        ...nextState,
        activePlayerIndex: nextPlayer.activePlayerIndex,
        season: next.season,
        year: nextState.year + next.yearOffset
      };
    } else {
      nextState = {
        ...nextState,
        activePlayerIndex: nextPlayer.activePlayerIndex
      };
    }
  }

  return nextState;
}
