import type { OwnerId } from './owners';
import type { C64RandomEventEffect, C64RandomEventId } from './c64-events';
import type { BattleResult, FortificationLevel, PlayerId, ProvinceId, TurnStep } from './types';

export type WarForCrownEvent =
  | {
      readonly type: 'home-selected';
      readonly playerId: PlayerId;
      readonly provinceId: ProvinceId;
    }
  | {
      readonly type: 'turn-step-advanced';
      readonly playerId: PlayerId;
      readonly from: TurnStep;
      readonly to: TurnStep;
    }
  | {
      readonly type: 'income-collected';
      readonly playerId: PlayerId;
      readonly money: number;
    }
  | {
      readonly type: 'c64-random-event';
      readonly playerId: PlayerId;
      readonly eventId: C64RandomEventId;
      readonly effect: C64RandomEventEffect;
      readonly amount: number;
      readonly provinceId: ProvinceId | null;
    }
  | {
      readonly type: 'player-title-changed';
      readonly playerId: PlayerId;
      readonly previousRank: number;
      readonly rank: number;
    }
  | {
      readonly type: 'soldiers-recruited';
      readonly playerId: PlayerId;
      readonly provinceId: ProvinceId;
      readonly soldiers: number;
      readonly cost: number;
    }
  | {
      readonly type: 'village-built';
      readonly playerId: PlayerId;
      readonly provinceId: ProvinceId;
      readonly cost: number;
    }
  | {
      readonly type: 'fortification-upgraded';
      readonly playerId: PlayerId;
      readonly provinceId: ProvinceId;
      readonly level: FortificationLevel;
      readonly cost: number;
    }
  | {
      readonly type: 'c64-baron-economy-resolved';
      readonly playerId: PlayerId;
      readonly recruitedSoldiers: number;
      readonly villagesBought: number;
      readonly finalMoney: number;
    }
  | {
      readonly type: 'c64-baron-movement-resolved';
      readonly playerId: PlayerId;
      readonly pulledMobileSoldiers: number;
      readonly defensiveRequirement: number;
      readonly rememberedTargetProvinceId: ProvinceId | null;
    }
  | {
      readonly type: 'soldiers-moved';
      readonly playerId: PlayerId;
      readonly fromProvinceId: ProvinceId;
      readonly targetProvinceId: ProvinceId;
      readonly soldiers: number;
    }
  | {
      readonly type: 'battle-resolved';
      readonly attackerId: PlayerId;
      readonly defenderId: OwnerId;
      readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
      readonly targetProvinceId: ProvinceId;
      readonly attackingSoldiers: number;
      readonly result: BattleResult;
    }
  | {
      readonly type: 'battle-started';
      readonly attackerId: PlayerId;
      readonly defenderId: OwnerId;
      readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
      readonly targetProvinceId: ProvinceId;
      readonly attackingSoldiers: number;
      readonly defendingSoldiers: number;
    }
  | {
      readonly type: 'battle-round-resolved';
      readonly attackerId: PlayerId;
      readonly defenderId: OwnerId;
      readonly targetProvinceId: ProvinceId;
      readonly round: number;
      readonly attackerLosses: number;
      readonly defenderLosses: number;
      readonly attackerSoldiers: number;
      readonly defenderSoldiers: number;
    }
  | {
      readonly type: 'royalist-battle-resolved';
      readonly defenderId: PlayerId;
      readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
      readonly targetProvinceId: ProvinceId;
      readonly attackingSoldiers: number;
      readonly result: BattleResult;
    }
  | {
      readonly type: 'turn-ended';
      readonly endedPlayerId: PlayerId;
      readonly nextPlayerId: PlayerId;
      readonly turnNumber: number;
    }
  | {
      readonly type: 'game-won';
      readonly winnerId: OwnerId;
    };
