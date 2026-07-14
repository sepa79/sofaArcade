import type { WarForCrownEvent } from '../game/events';
import { ROYALIST_OWNER_ID, type OwnerId } from '../game/owners';
import type { ProvinceId } from '../game/types';

export interface AiActionCue {
  readonly kind: 'attack' | 'move';
  readonly actorId: OwnerId;
  readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
  readonly targetProvinceId: ProvinceId;
  readonly soldiers: number;
}

export function aiActionCues(events: ReadonlyArray<WarForCrownEvent>): ReadonlyArray<AiActionCue> {
  return events.flatMap((event): ReadonlyArray<AiActionCue> => {
    switch (event.type) {
      case 'battle-started':
        return [{ kind: 'attack', actorId: event.attackerId, fromProvinceIds: event.fromProvinceIds, targetProvinceId: event.targetProvinceId, soldiers: event.attackingSoldiers }];
      case 'royalist-battle-resolved':
        return [{ kind: 'attack', actorId: ROYALIST_OWNER_ID, fromProvinceIds: event.fromProvinceIds, targetProvinceId: event.targetProvinceId, soldiers: event.attackingSoldiers }];
      case 'soldiers-moved':
        return [{ kind: 'move', actorId: event.playerId, fromProvinceIds: [event.fromProvinceId], targetProvinceId: event.targetProvinceId, soldiers: event.soldiers }];
      default:
        return [];
    }
  });
}
