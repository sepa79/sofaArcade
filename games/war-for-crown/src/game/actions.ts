import { DEFAULT_GAME_CONFIG } from './constants';
import { chooseC64BattleDecision } from './battle-ai';
import { runC64CbaronAttack, type C64CbaronAttackPlayerSlot } from './c64-cbaron-attack';
import { runC64CbaronEconomy } from './c64-cbaron-economy';
import { c64CbaronRememberedTargetPressure } from './c64-cbaron-memory';
import { runC64CbaronMovement } from './c64-cbaron-movement';
import type { C64CbaronOwnerSlot } from './c64-cbaron-threat';
import { requireC64Ca61Byte, requireC64PlayerMemory } from './c64-state';
import { isRoyalistOwner, ROYALIST_OWNER_ID } from './owners';
import { nextRngByte } from './rng';
import {
  advanceTurnStep,
  attackProvinceWithResult,
  buildVillage,
  defenderRetreatProvinceId,
  endTurnWithResult,
  fightBattleRound,
  moveSoldiers,
  recruitSoldiers,
  retreatAttackerFromBattle,
  retreatDefenderFromBattle,
  retreatDefenderFromBattleByOwner,
  selectHomeProvince,
  upgradeFortification,
  type BattleActionResult
} from './logic';
import type { WarForCrownEvent } from './events';
import type { OwnerId } from './owners';
import type { GameConfig, GameState, PlayerId, PlayerState, ProvinceId, ProvinceState } from './types';

export type WarForCrownAction =
  | { readonly type: 'select-home'; readonly provinceId: ProvinceId }
  | { readonly type: 'advance-step' }
  | { readonly type: 'run-c64-baron-attack' }
  | { readonly type: 'run-c64-baron-economy' }
  | { readonly type: 'run-c64-baron-movement' }
  | { readonly type: 'recruit-soldiers'; readonly soldiers: number }
  | { readonly type: 'build-village'; readonly provinceId: ProvinceId }
  | { readonly type: 'upgrade-fortification'; readonly provinceId: ProvinceId }
  | {
      readonly type: 'move-soldiers';
      readonly fromProvinceId: ProvinceId;
      readonly targetProvinceId: ProvinceId;
      readonly soldiers: number;
    }
  | {
      readonly type: 'attack';
      readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
      readonly targetProvinceId: ProvinceId;
    }
  | { readonly type: 'battle-round' }
  | { readonly type: 'battle-retreat-attacker' }
  | { readonly type: 'battle-retreat-defender' }
  | { readonly type: 'run-c64-battle-command' }
  | { readonly type: 'end-turn' };

export interface ApplyPlayerActionResult {
  readonly state: GameState;
  readonly events: ReadonlyArray<WarForCrownEvent>;
}

function requireActionObject(action: WarForCrownAction): void {
  if (typeof action !== 'object' || action === null) {
    throw new Error('War for Crown action must be an object.');
  }
}

function requireActivePlayer(state: GameState, playerId: PlayerId, actionType: string): void {
  if (state.activePlayerId !== playerId) {
    throw new Error(
      `Cannot apply "${actionType}" for ${playerId}; active player is ${state.activePlayerId}.`
    );
  }
}

function requireTurnInvestment(state: GameState, actionType: string): void {
  if (state.phase !== 'turn') {
    throw new Error(`Cannot apply "${actionType}" during phase "${state.phase}".`);
  }
  if (state.battle !== null) {
    throw new Error(`Cannot apply "${actionType}" while battle is active.`);
  }
  if (state.turnStep !== 'investment') {
    throw new Error(`Cannot apply "${actionType}" during turn step "${state.turnStep}".`);
  }
}

function requireTurnAttack(state: GameState, actionType: string): void {
  if (state.phase !== 'turn') {
    throw new Error(`Cannot apply "${actionType}" during phase "${state.phase}".`);
  }
  if (state.battle !== null) {
    throw new Error(`Cannot apply "${actionType}" while battle is active.`);
  }
  if (state.turnStep !== 'attack') {
    throw new Error(`Cannot apply "${actionType}" during turn step "${state.turnStep}".`);
  }
}

function requireTurnMovement(state: GameState, actionType: string): void {
  if (state.phase !== 'turn') {
    throw new Error(`Cannot apply "${actionType}" during phase "${state.phase}".`);
  }
  if (state.battle !== null) {
    throw new Error(`Cannot apply "${actionType}" while battle is active.`);
  }
  if (state.turnStep !== 'movement') {
    throw new Error(`Cannot apply "${actionType}" during turn step "${state.turnStep}".`);
  }
}

function requirePlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Unknown player id: ${playerId}.`);
  }
  return player;
}

function requireProvince(state: GameState, provinceId: ProvinceId): ProvinceState {
  const province = state.map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown province id: ${provinceId}.`);
  }
  return province;
}

function c64BaronOwnerSlots(
  state: GameState,
  config: GameConfig
): ReadonlyArray<C64CbaronOwnerSlot> {
  return [
    { ownerId: ROYALIST_OWNER_ID, isComputer: false },
    ...state.players.map((player) => ({
      ownerId: player.id,
      isComputer: playerIsC64Computer(state, player.id, config)
    }))
  ];
}

function c64BaronAttackPlayerSlots(state: GameState): ReadonlyArray<C64CbaronAttackPlayerSlot> {
  return state.players.map((player) => ({
    ownerId: player.id,
    homeProvinceId: player.homeProvinceId,
    provinceCount: state.map.provinces.filter((province) => province.ownerId === player.id).length
  }));
}

interface C64RngByteSequence {
  readonly bytes: ReadonlyArray<number>;
  readonly rngStates: ReadonlyArray<number>;
}

function c64RngByteSequence(initialRngState: number, count: number): C64RngByteSequence {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`C64 RNG byte count must be a non-negative integer, got ${count}.`);
  }

  let rngState = initialRngState;
  const bytes: number[] = [];
  const rngStates: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const next = nextRngByte(rngState);
    bytes.push(next.byte);
    rngStates.push(next.rngState);
    rngState = next.rngState;
  }
  return { bytes, rngStates };
}

function c64RngStateAfterConsumed(
  initialRngState: number,
  sequence: C64RngByteSequence,
  consumed: number
): number {
  if (!Number.isInteger(consumed) || consumed < 0) {
    throw new Error(`C64 consumed RNG byte count must be a non-negative integer, got ${consumed}.`);
  }
  if (consumed === 0) {
    return initialRngState;
  }

  const rngState = sequence.rngStates[consumed - 1];
  if (rngState === undefined) {
    throw new Error(`C64 consumed ${consumed} RNG bytes, but only ${sequence.rngStates.length} were generated.`);
  }
  return rngState;
}

function c64Unsigned24(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}.`);
  }
  return value % 0x1000000;
}

function playerIsC64Computer(
  state: GameState,
  playerId: PlayerId,
  config: GameConfig
): boolean {
  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Unknown player id: ${playerId}.`);
  }

  return playerIndex >= config.humanPlayerCount;
}

function ownerIsC64Ai(
  state: GameState,
  ownerId: OwnerId,
  config: GameConfig
): boolean {
  return isRoyalistOwner(ownerId) || playerIsC64Computer(state, ownerId, config);
}

function battleActionEvents(result: BattleActionResult): ReadonlyArray<WarForCrownEvent> {
  const events: WarForCrownEvent[] = [
    {
      type: 'battle-round-resolved',
      attackerId: result.battle.attackerId,
      defenderId: result.battle.defenderId,
      targetProvinceId: result.battle.targetProvinceId,
      round: result.battle.round,
      attackerLosses: result.round.attackerLosses,
      defenderLosses: result.round.defenderLosses,
      attackerSoldiers: result.battle.attackerSoldiers,
      defenderSoldiers: result.battle.defenderSoldiers
    }
  ];

  if (result.result !== null) {
    events.push({
      type: 'battle-resolved',
      attackerId: result.battle.attackerId,
      defenderId: result.battle.defenderId,
      fromProvinceIds: result.battle.fromProvinceIds,
      targetProvinceId: result.battle.targetProvinceId,
      attackingSoldiers: result.battle.attackerInitialSoldiers,
      result: result.result
    });
  }

  if (result.state.winnerId !== null) {
    events.push({
      type: 'game-won',
      winnerId: result.state.winnerId
    });
  }

  return events;
}

function consumeC64RememberedAttackTarget(state: GameState, playerId: PlayerId): GameState {
  const memory = requireC64PlayerMemory(state, playerId);
  if (memory.rememberedTargetProvinceId === null) {
    return state;
  }

  const target = requireProvince(state, memory.rememberedTargetProvinceId);
  const pressure = c64CbaronRememberedTargetPressure({
    currentTargetSoldiers: target.soldiers,
    rememberedTargetSoldiers: memory.rememberedTargetSoldiers,
    ca61: requireC64Ca61Byte(state, 0),
    ca62: requireC64Ca61Byte(state, 1)
  });
  const ca61Bytes = [...state.c64.ca61Bytes];
  ca61Bytes[0] = pressure.ca61;
  ca61Bytes[1] = pressure.ca62;

  return {
    ...state,
    c64: {
      ...state.c64,
      ca61Bytes,
      playerMemory: state.c64.playerMemory.map((candidate) =>
        candidate.playerId === playerId
          ? {
              ...candidate,
              rememberedTargetProvinceId: null
            }
          : candidate
      )
    }
  };
}

function normalizeC64EconomyInputState(state: GameState, playerId: PlayerId): GameState {
  const player = requirePlayer(state, playerId);
  requireC64PlayerMemory(state, playerId);
  return {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            money: c64Unsigned24(player.money, `C64 economy money for ${playerId}`)
          }
        : candidate
    ),
    c64: {
      ...state.c64,
      playerMemory: state.c64.playerMemory.map((memory) =>
        memory.playerId === playerId
          ? {
              ...memory,
              economyCarryoverMoney: c64Unsigned24(
                memory.economyCarryoverMoney,
                `C64 economy carryover for ${playerId}`
              )
            }
          : memory
      )
    }
  };
}

export function applyPlayerAction(
  state: GameState,
  playerId: PlayerId,
  action: WarForCrownAction,
  config: GameConfig = DEFAULT_GAME_CONFIG
): ApplyPlayerActionResult {
  requireActionObject(action);

  switch (action.type) {
    case 'select-home': {
      const nextState = selectHomeProvince(state, playerId, action.provinceId, config);
      return {
        state: nextState,
        events: [
          {
            type: 'home-selected',
            playerId,
            provinceId: action.provinceId
          }
        ]
      };
    }

    case 'advance-step': {
      const result = advanceTurnStep(state, playerId, config);
      const events: WarForCrownEvent[] = [
        {
          type: 'turn-step-advanced',
          playerId,
          from: result.from,
          to: result.to
        }
      ];

      if (result.from === 'new-month') {
        const previousRank = requireC64PlayerMemory(state, playerId).rank;
        const rank = requireC64PlayerMemory(result.state, playerId).rank;
        if (rank !== previousRank) {
          events.push({
            type: 'player-title-changed',
            playerId,
            previousRank,
            rank
          });
        }
        events.push({
          type: 'income-collected',
          playerId,
          money: result.income
        });
      }

      if (result.endedPlayerId !== null && result.nextPlayerId !== null) {
        events.push({
          type: 'turn-ended',
          endedPlayerId: result.endedPlayerId,
          nextPlayerId: result.nextPlayerId,
          turnNumber: result.state.turnNumber
        });
      }
      events.push(...result.events);

      return {
        state: result.state,
        events
      };
    }

    case 'run-c64-baron-attack': {
      requireActivePlayer(state, playerId, action.type);
      requireTurnAttack(state, action.type);
      const stateAfterMemory = consumeC64RememberedAttackTarget(state, playerId);
      const activePlayer = requirePlayer(stateAfterMemory, playerId);
      const rngSequence = c64RngByteSequence(
        stateAfterMemory.rngState,
        stateAfterMemory.map.provinces.length
      );
      const c64Attack = runC64CbaronAttack({
        provinces: stateAfterMemory.map.provinces,
        activeOwnerId: playerId,
        activeMoney: c64Unsigned24(activePlayer.money, `C64 active money for ${playerId}`),
        ownerSlots: c64BaronOwnerSlots(stateAfterMemory, config),
        playerSlots: c64BaronAttackPlayerSlots(stateAfterMemory),
        lockedProvinceIds: stateAfterMemory.attackSpentProvinceIds,
        rngBytes: rngSequence.bytes,
        config
      });
      const stateAfterRng: GameState = {
        ...stateAfterMemory,
        rngState: c64RngStateAfterConsumed(
          stateAfterMemory.rngState,
          rngSequence,
          c64Attack.rngBytesConsumed
        )
      };

      if (c64Attack.selection === null) {
        const advanced = advanceTurnStep(stateAfterRng, playerId, config);
        const events: WarForCrownEvent[] = [{
          type: 'turn-step-advanced',
          playerId,
          from: advanced.from,
          to: advanced.to
        }];

        if (advanced.endedPlayerId !== null && advanced.nextPlayerId !== null) {
          events.push({
            type: 'turn-ended',
            endedPlayerId: advanced.endedPlayerId,
            nextPlayerId: advanced.nextPlayerId,
            turnNumber: advanced.state.turnNumber
          });
        }
        events.push(...advanced.events);

        return {
          state: advanced.state,
          events
        };
      }

      const defenderId = requireProvince(
        stateAfterRng,
        c64Attack.selection.targetProvinceId
      ).ownerId;
      const result = attackProvinceWithResult(
        stateAfterRng,
        playerId,
        c64Attack.selection.sourceProvinceIds,
        c64Attack.selection.targetProvinceId,
        config
      );
      return {
        state: result.state,
        events: [
          {
            type: 'battle-started',
            attackerId: playerId,
            defenderId,
            fromProvinceIds: result.fromProvinceIds,
            targetProvinceId: c64Attack.selection.targetProvinceId,
            attackingSoldiers: result.attackingSoldiers,
            defendingSoldiers: result.battle.defenderSoldiers
          }
        ]
      };
    }

    case 'run-c64-baron-economy': {
      requireActivePlayer(state, playerId, action.type);
      requireTurnInvestment(state, action.type);
      const c64State = normalizeC64EconomyInputState(state, playerId);
      const result = runC64CbaronEconomy({
        state: c64State,
        activePlayerId: playerId,
        ownerSlots: c64BaronOwnerSlots(c64State, config),
        config
      });
      const villagesBought = result.villagePurchases.reduce(
        (total, purchase) => total + purchase.villagesBought,
        0
      );
      const events: WarForCrownEvent[] = [{
        type: 'c64-baron-economy-resolved',
        playerId,
        recruitedSoldiers:
          result.decision.branch === 'recruitment' ? result.decision.hiredSoldiers : 0,
        villagesBought,
        finalMoney: result.finalMoney
      }];

      if (result.decision.branch === 'recruitment' && result.decision.hiredSoldiers > 0) {
        events.push({
          type: 'soldiers-recruited',
          playerId,
          provinceId: result.decision.homeProvinceId,
          soldiers: result.decision.hiredSoldiers,
          cost: result.decision.hiredSoldiers
        });
      }

      const advanced = advanceTurnStep(result.state, playerId, config);
      events.push({
        type: 'turn-step-advanced',
        playerId,
        from: advanced.from,
        to: advanced.to
      });

      if (advanced.endedPlayerId !== null && advanced.nextPlayerId !== null) {
        events.push({
          type: 'turn-ended',
          endedPlayerId: advanced.endedPlayerId,
          nextPlayerId: advanced.nextPlayerId,
          turnNumber: advanced.state.turnNumber
        });
      }
      events.push(...advanced.events);

      return {
        state: advanced.state,
        events
      };
    }

    case 'run-c64-baron-movement': {
      requireActivePlayer(state, playerId, action.type);
      requireTurnMovement(state, action.type);
      const activePlayer = requirePlayer(state, playerId);
      if (activePlayer.homeProvinceId === null) {
        throw new Error(`Player ${playerId} has no home province for C64 movement.`);
      }
      const memory = requireC64PlayerMemory(state, playerId);
      const movement = runC64CbaronMovement({
        provinces: state.map.provinces,
        activeOwnerId: playerId,
        activeHomeProvinceId: activePlayer.homeProvinceId,
        activeMoney: c64Unsigned24(activePlayer.money, `C64 movement money for ${playerId}`),
        turnNumber: state.turnNumber,
        ownerSlots: c64BaronOwnerSlots(state, config),
        rememberedTargetProvinceId: memory.rememberedTargetProvinceId,
        ca61: requireC64Ca61Byte(state, 0),
        ca62: requireC64Ca61Byte(state, 1),
        maxHomeFortificationLevel: config.maxHomeFortificationLevel,
        maxProvinceFortificationLevel: config.maxProvinceFortificationLevel,
        config
      });
      const stateAfterMovement: GameState = {
        ...state,
        map: {
          ...state.map,
          provinces: movement.provinces
        },
        players: state.players.map((candidate) =>
          candidate.id === playerId
            ? {
                ...candidate,
                money: movement.finalMoney
              }
            : candidate
        ),
        c64: {
          ...state.c64,
          playerMemory: state.c64.playerMemory.map((candidate) => {
            if (candidate.playerId !== playerId) {
              return candidate;
            }
            if (candidate.rememberedTargetProvinceId !== null) {
              return candidate;
            }
            return {
              ...candidate,
              rememberedTargetProvinceId: movement.rememberedTargetProvinceId,
              rememberedTargetSoldiers: movement.rememberedTargetSoldiers
            };
          })
        }
      };
      const advanced = advanceTurnStep(stateAfterMovement, playerId, config);
      const events: WarForCrownEvent[] = [
        ...movement.fortificationUpgrades.map((upgrade) => ({
          type: 'fortification-upgraded' as const,
          playerId,
          provinceId: upgrade.provinceId,
          level: upgrade.level,
          cost: upgrade.cost
        })),
        {
          type: 'c64-baron-movement-resolved',
          playerId,
          pulledMobileSoldiers: movement.pulledMobileSoldiers,
          defensiveRequirement: movement.defensiveRequirement,
          rememberedTargetProvinceId: movement.rememberedTargetProvinceId
        },
        {
          type: 'turn-step-advanced',
          playerId,
          from: advanced.from,
          to: advanced.to
        }
      ];

      if (advanced.endedPlayerId !== null && advanced.nextPlayerId !== null) {
        events.push({
          type: 'turn-ended',
          endedPlayerId: advanced.endedPlayerId,
          nextPlayerId: advanced.nextPlayerId,
          turnNumber: advanced.state.turnNumber
        });
      }
      events.push(...advanced.events);

      return {
        state: advanced.state,
        events
      };
    }

    case 'recruit-soldiers': {
      const playerBefore = requirePlayer(state, playerId);
      const homeProvinceId = playerBefore.homeProvinceId;
      if (homeProvinceId === null) {
        throw new Error(`Player ${playerId} has no home province for recruitment.`);
      }

      const nextState = recruitSoldiers(state, playerId, action.soldiers, config);
      const playerAfter = requirePlayer(nextState, playerId);
      return {
        state: nextState,
        events: [
          {
            type: 'soldiers-recruited',
            playerId,
            provinceId: homeProvinceId,
            soldiers: action.soldiers,
            cost: playerBefore.money - playerAfter.money
          }
        ]
      };
    }

    case 'build-village': {
      const playerBefore = requirePlayer(state, playerId);
      const nextState = buildVillage(state, playerId, action.provinceId, config);
      const playerAfter = requirePlayer(nextState, playerId);
      return {
        state: nextState,
        events: [
          {
            type: 'village-built',
            playerId,
            provinceId: action.provinceId,
            cost: playerBefore.money - playerAfter.money
          }
        ]
      };
    }

    case 'upgrade-fortification': {
      const playerBefore = requirePlayer(state, playerId);
      const nextState = upgradeFortification(state, playerId, action.provinceId, config);
      const playerAfter = requirePlayer(nextState, playerId);
      const provinceAfter = requireProvince(nextState, action.provinceId);
      return {
        state: nextState,
        events: [
          {
            type: 'fortification-upgraded',
            playerId,
            provinceId: action.provinceId,
            level: provinceAfter.fortificationLevel,
            cost: playerBefore.money - playerAfter.money
          }
        ]
      };
    }

    case 'move-soldiers': {
      const nextState = moveSoldiers(
        state,
        playerId,
        action.fromProvinceId,
        action.targetProvinceId,
        action.soldiers
      );
      return {
        state: nextState,
        events: [
          {
            type: 'soldiers-moved',
            playerId,
            fromProvinceId: action.fromProvinceId,
            targetProvinceId: action.targetProvinceId,
            soldiers: action.soldiers
          }
        ]
      };
    }

    case 'attack': {
      const defenderId = requireProvince(state, action.targetProvinceId).ownerId;
      const result = attackProvinceWithResult(
        state,
        playerId,
        action.fromProvinceIds,
        action.targetProvinceId,
        config
      );
      return {
        state: result.state,
        events: [
          {
            type: 'battle-started',
            attackerId: playerId,
            defenderId,
            fromProvinceIds: result.fromProvinceIds,
            targetProvinceId: action.targetProvinceId,
            attackingSoldiers: result.attackingSoldiers,
            defendingSoldiers: result.battle.defenderSoldiers
          }
        ]
      };
    }

    case 'battle-round':
    case 'battle-retreat-attacker':
    case 'battle-retreat-defender': {
      const result =
        action.type === 'battle-round'
          ? fightBattleRound(state, playerId)
          : action.type === 'battle-retreat-attacker'
            ? retreatAttackerFromBattle(state, playerId)
            : retreatDefenderFromBattle(state, playerId);

      return {
        state: result.state,
        events: battleActionEvents(result)
      };
    }

    case 'run-c64-battle-command': {
      requireActivePlayer(state, playerId, action.type);
      if (state.battle === null) {
        throw new Error('Cannot run C64 battle command without active battle.');
      }

      const decision = chooseC64BattleDecision({
        battle: state.battle,
        attackerIsAi: ownerIsC64Ai(state, state.battle.attackerId, config),
        defenderIsAi: ownerIsC64Ai(state, state.battle.defenderId, config),
        defenderCanRetreat: defenderRetreatProvinceId(state) !== null
      });
      const result =
        decision === 'retreat-attacker'
          ? retreatAttackerFromBattle(state, state.battle.attackerId)
          : decision === 'retreat-defender'
            ? retreatDefenderFromBattleByOwner(state)
            : fightBattleRound(state, state.battle.attackerId);

      return {
        state: result.state,
        events: battleActionEvents(result)
      };
    }

    case 'end-turn': {
      requireActivePlayer(state, playerId, action.type);
      const result = endTurnWithResult(state, config);
      return {
        state: result.state,
        events: [
          {
            type: 'turn-ended',
            endedPlayerId: result.endedPlayerId,
            nextPlayerId: result.nextPlayerId,
            turnNumber: result.state.turnNumber
          },
          ...result.events
        ]
      };
    }

    default:
      action satisfies never;
      throw new Error('Unhandled War for Crown action.');
  }
}
