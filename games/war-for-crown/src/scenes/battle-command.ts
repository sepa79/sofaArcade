import type { WarForCrownAction } from '../game/actions';
import { isPlayerOwner } from '../game/owners';
import type { BattleState, PlayerId } from '../game/types';

export type BattleUiIntent =
  | 'advance-ai'
  | 'fight-round'
  | 'retreat-attacker'
  | 'retreat-defender';

export interface BattleUiCommand {
  readonly playerId: PlayerId;
  readonly action: WarForCrownAction;
}

export function battleUiCommand(battle: BattleState, intent: BattleUiIntent): BattleUiCommand {
  switch (intent) {
    case 'advance-ai':
    case 'fight-round':
      return {
        playerId: battle.attackerId,
        action: { type: 'run-c64-battle-command' }
      };
    case 'retreat-attacker':
      return {
        playerId: battle.attackerId,
        action: { type: 'battle-retreat-attacker' }
      };
    case 'retreat-defender':
      if (!isPlayerOwner(battle.defenderId)) {
        throw new Error(`Royalist defender ${battle.defenderId} cannot receive a human retreat command.`);
      }
      return {
        playerId: battle.defenderId,
        action: { type: 'battle-retreat-defender' }
      };
    default:
      intent satisfies never;
      throw new Error('Unhandled battle UI intent.');
  }
}
