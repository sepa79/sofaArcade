import type { GameConfig, GameState } from '../game/types';
import type { ButtonId } from './scene-contracts';
import {
  fortificationIndex,
  maxFortificationIndex,
  requirePlayer,
  requireProvince,
  turnUiCopy
} from './scene-presentation';
import type { TurnSelection } from './turn-selection';
import { UI_COPY, type Language } from './ui-copy';

export function disabledButtonMessage(input: {
  readonly config: GameConfig;
  readonly id: ButtonId;
  readonly language: Language;
  readonly selection: TurnSelection;
  readonly state: GameState;
}): string {
  const { config, id, language, selection, state } = input;
  const copy = UI_COPY[language];
  switch (id) {
    case 'advance-step':
    case 'end-turn':
      return state.phase === 'home-selection'
        ? copy.noHomePending
        : turnUiCopy(state, language).instruction;
    case 'attack':
      if (state.turnStep !== 'attack') return copy.attackStep;
      if (selection.targetId === null) return copy.chooseTarget;
      if (selection.attackSourceIds.length < 1) return copy.chooseAttackSource;
      return copy.notEnoughSoldiers;
    case 'battle-retreat-attacker':
    case 'battle-retreat-defender':
    case 'battle-round':
    case 'battle-view': return copy.battle;
    case 'battle-summary-confirm': return copy.battleSummaryTitle;
    case 'build-village': {
      if (selection.fromId === null) return copy.selectOwnProvince;
      if (state.phase !== 'turn' || state.turnStep !== 'investment') return copy.buildStep;
      const province = requireProvince(state, selection.fromId);
      if (province.ownerId !== state.activePlayerId) return copy.selectOwnProvince;
      if (province.villages >= config.maxVillages) return copy.villageLimit;
      if (requirePlayer(state, state.activePlayerId).money < config.villageCost) {
        return copy.notEnoughMoney;
      }
      return copy.buildStep;
    }
    case 'confirm-home': return copy.noHomePending;
    case 'hire-soldiers':
      if (state.phase !== 'turn' || state.turnStep !== 'investment') return copy.hireStep;
      if (requirePlayer(state, state.activePlayerId).homeProvinceId === null) return copy.noHomePending;
      return copy.notEnoughMoney;
    case 'hire-minus':
    case 'hire-plus':
    case 'hire-max': return copy.recruit;
    case 'language-toggle': return copy.language;
    case 'main-load': return copy.loadMissing;
    case 'main-load-json': return copy.loadJson;
    case 'main-new-game':
    case 'main-rules':
    case 'main-sofa-arcade':
    case 'map-accept':
    case 'map-back':
    case 'map-max-villages':
    case 'map-province-count':
    case 'map-regenerate':
    case 'map-seed':
    case 'map-village-mode': return copy.chooseMapInstruction;
    case 'move-equal':
    case 'move-max':
    case 'move-minus':
    case 'move-plus':
    case 'move-soldiers':
      if (state.phase !== 'turn' || state.turnStep !== 'movement') return copy.moveStep;
      if (selection.fromId === null) return copy.selectOwnProvince;
      if (selection.targetId === null) return copy.chooseMoveTarget;
      return id === 'move-equal' ? copy.cannotEqualizeMove : copy.notEnoughSoldiers;
    case 'new-map':
    case 'victory-menu': return copy.menu;
    case 'save-game':
    case 'save-game-json': return copy.save;
    case 'rules-back':
    case 'rules-new-game':
    case 'rules-home-max-fort':
    case 'rules-interest':
    case 'rules-province-max-fort':
    case 'rules-royalist-attitude':
    case 'rules-royalist-distribution':
    case 'rules-royalist-growth':
    case 'rules-royalist-investment':
    case 'rules-start-money':
    case 'rules-start-soldiers':
    case 'rules-show-computer-battles':
    case 'rules-terrain-influence':
    case 'rules-village-cost': return copy.rulesTitle;
    case 'setup-back':
    case 'setup-ai-count':
    case 'setup-ai-mode-p1':
    case 'setup-ai-mode-p2':
    case 'setup-ai-mode-p3':
    case 'setup-ai-mode-p4':
    case 'setup-color-p1':
    case 'setup-color-p2':
    case 'setup-color-p3':
    case 'setup-color-p4':
    case 'setup-crest-p1':
    case 'setup-crest-p2':
    case 'setup-crest-p3':
    case 'setup-crest-p4':
    case 'setup-name-p1':
    case 'setup-name-p2':
    case 'setup-name-p3':
    case 'setup-name-p4':
    case 'setup-start':
    case 'setup-human-count': return copy.setupInstruction;
    case 'upgrade-fort': {
      if (selection.fromId === null) return copy.selectOwnProvince;
      if (state.phase !== 'turn' || state.turnStep !== 'investment') return copy.fortStep;
      const province = requireProvince(state, selection.fromId);
      if (province.ownerId !== state.activePlayerId) return copy.selectOwnProvince;
      if (province.upgradedFortificationThisTurn) return copy.fortAlready;
      if (fortificationIndex(province) >= maxFortificationIndex(province, state, config)) {
        return copy.fortMaxed;
      }
      if (requirePlayer(state, state.activePlayerId).money < config.fortificationUpgradeCost) {
        return copy.notEnoughMoney;
      }
      return copy.fortStep;
    }
    default:
      id satisfies never;
      throw new Error('Unhandled disabled button id.');
  }
}
