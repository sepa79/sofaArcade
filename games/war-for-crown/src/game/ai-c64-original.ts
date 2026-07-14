import { DEFAULT_GAME_CONFIG } from './constants';
import { selectC64HomeProvince } from './c64-home-selection';
import type { WarForCrownAction } from './actions';
import type { PlayerView } from './player-view';
import type { GameConfig } from './types';
import { requireActiveAiView } from './ai-shared';

function homeSelectionAction(view: PlayerView, config: GameConfig): WarForCrownAction {
  return {
    type: 'select-home',
    provinceId: selectC64HomeProvince(view, config)
  };
}

function attackAction(): WarForCrownAction {
  return { type: 'run-c64-baron-attack' };
}

function movementAction(): WarForCrownAction {
  return { type: 'run-c64-baron-movement' };
}

function investmentAction(): WarForCrownAction {
  return { type: 'run-c64-baron-economy' };
}

function battleAction(): WarForCrownAction {
  return { type: 'run-c64-battle-command' };
}

export function chooseC64OriginalAiAction(
  view: PlayerView,
  config: GameConfig = DEFAULT_GAME_CONFIG
): WarForCrownAction {
  requireActiveAiView(view);

  if (view.battle !== null) {
    return battleAction();
  }

  if (view.phase === 'home-selection') {
    return homeSelectionAction(view, config);
  }

  if (view.turnStep === 'attack') {
    return attackAction();
  }

  if (view.turnStep === 'movement') {
    return movementAction();
  }

  if (view.turnStep === 'investment') {
    return investmentAction();
  }

  return {
    type: 'advance-step'
  };
}
