import type { WarForCrownEvent } from '../game/events';
import type { BattleSummary } from './scene-contracts';

export function battleStartedEvent(
  events: ReadonlyArray<WarForCrownEvent>
): Extract<WarForCrownEvent, { readonly type: 'battle-started' }> | null {
  return events.find(
    (event): event is Extract<WarForCrownEvent, { readonly type: 'battle-started' }> =>
      event.type === 'battle-started'
  ) ?? null;
}

export function battleResolvedEvent(
  events: ReadonlyArray<WarForCrownEvent>
): Extract<WarForCrownEvent, { readonly type: 'battle-resolved' }> | null {
  return events.find(
    (event): event is Extract<WarForCrownEvent, { readonly type: 'battle-resolved' }> =>
      event.type === 'battle-resolved'
  ) ?? null;
}

export function createBattleSummary(
  events: ReadonlyArray<WarForCrownEvent>
): BattleSummary | null {
  const resolved = battleResolvedEvent(events);
  if (resolved === null) {
    return null;
  }
  const round = events.find(
    (event): event is Extract<WarForCrownEvent, { readonly type: 'battle-round-resolved' }> =>
      event.type === 'battle-round-resolved'
  );
  if (round === undefined) {
    throw new Error('Battle resolution requires a battle-round-resolved event.');
  }
  return {
    attackerId: resolved.attackerId,
    defenderId: resolved.defenderId,
    fromProvinceIds: resolved.fromProvinceIds,
    targetProvinceId: resolved.targetProvinceId,
    attackingSoldiers: resolved.attackingSoldiers,
    round: round.round,
    attackerLosses: resolved.result.attackerLosses,
    defenderLosses: resolved.result.defenderLosses,
    result: resolved.result
  };
}
