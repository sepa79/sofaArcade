import { applyPlayerAction } from '../../src/game/actions';
import { chooseC64OriginalAiAction } from '../../src/game/ai-c64-original';
import { DEFAULT_GAME_CONFIG } from '../../src/game/constants';
import type { WarForCrownEvent } from '../../src/game/events';
import { ROYALIST_OWNER_ID } from '../../src/game/owners';
import { createPlayerView } from '../../src/game/player-view';
import { createInitialState } from '../../src/game/state';
import type { GameConfig } from '../../src/game/types';

const BEHAVIOR_SEED = 11;
const COMPLETED_ROUNDS = 12;
const STEP_LIMIT = 2_000;

interface GameplayObservations {
  battleCaptures: number;
  battleRounds: number;
  battlesStarted: number;
  fortificationsUpgraded: number;
  incomeCollections: number;
  recruitedSoldiers: number;
  redistributedSoldiers: number;
  royalistDefenderRetreats: number;
  villagesBought: number;
}

function emptyObservations(): GameplayObservations {
  return {
    battleCaptures: 0,
    battleRounds: 0,
    battlesStarted: 0,
    fortificationsUpgraded: 0,
    incomeCollections: 0,
    recruitedSoldiers: 0,
    redistributedSoldiers: 0,
    royalistDefenderRetreats: 0,
    villagesBought: 0
  };
}

function observeEvent(observations: GameplayObservations, event: WarForCrownEvent): void {
  switch (event.type) {
    case 'battle-started':
      observations.battlesStarted += 1;
      break;
    case 'battle-round-resolved':
      observations.battleRounds += 1;
      break;
    case 'battle-resolved':
      if (event.result.winner === 'attacker') {
        observations.battleCaptures += 1;
      }
      if (
        event.defenderId === ROYALIST_OWNER_ID &&
        event.result.resolution === 'defender-retreat'
      ) {
        observations.royalistDefenderRetreats += 1;
      }
      break;
    case 'c64-baron-economy-resolved':
      observations.recruitedSoldiers += event.recruitedSoldiers;
      observations.villagesBought += event.villagesBought;
      break;
    case 'c64-baron-movement-resolved':
      observations.redistributedSoldiers += event.pulledMobileSoldiers;
      break;
    case 'fortification-upgraded':
      observations.fortificationsUpgraded += 1;
      break;
    case 'income-collected':
      observations.incomeCollections += 1;
      break;
    default:
      break;
  }
}

function requireObserved(value: number, behavior: string): void {
  if (value < 1) {
    throw new Error(
      `C64 gameplay behavior gate did not observe ${behavior} in seed ${BEHAVIOR_SEED} ` +
      `after ${COMPLETED_ROUNDS} completed rounds.`
    );
  }
}

function verifyGameplayBehaviors(): GameplayObservations {
  const config: GameConfig = {
    ...DEFAULT_GAME_CONFIG,
    humanPlayerCount: 0,
    aiPlayerCount: 4
  };
  const observations = emptyObservations();
  let state = createInitialState(BEHAVIOR_SEED, config);
  let steps = 0;

  while (state.phase !== 'game-over' && state.turnNumber <= COMPLETED_ROUNDS) {
    if (steps >= STEP_LIMIT) {
      throw new Error(`C64 gameplay behavior gate exceeded ${STEP_LIMIT} actions.`);
    }

    const playerId = state.activePlayerId;
    const action = chooseC64OriginalAiAction(createPlayerView(state, playerId, config), config);
    const result = applyPlayerAction(state, playerId, action, config);
    for (const event of result.events) {
      observeEvent(observations, event);
    }
    state = result.state;
    steps += 1;
  }

  if (state.phase === 'game-over') {
    throw new Error(
      `C64 gameplay behavior gate ended before ${COMPLETED_ROUNDS} completed rounds; ` +
      `winner was ${state.winnerId}.`
    );
  }
  if (state.turnNumber !== COMPLETED_ROUNDS + 1) {
    throw new Error(
      `C64 gameplay behavior gate ended at round ${state.turnNumber}, expected ` +
      `${COMPLETED_ROUNDS + 1}.`
    );
  }

  requireObserved(observations.battlesStarted, 'AI attacks');
  requireObserved(observations.battleRounds, 'battle rounds');
  requireObserved(observations.battleCaptures, 'province captures');
  requireObserved(observations.royalistDefenderRetreats, 'royalist defender retreats');
  requireObserved(observations.recruitedSoldiers, 'AI recruitment');
  requireObserved(observations.redistributedSoldiers, 'AI soldier distribution');
  requireObserved(observations.villagesBought, 'AI village purchases');
  requireObserved(observations.fortificationsUpgraded, 'AI fortification upgrades');
  requireObserved(observations.incomeCollections, 'monthly income collection');

  return observations;
}

const observations = verifyGameplayBehaviors();
process.stdout.write(
  `PASS C64 gameplay behavior gate: seed ${BEHAVIOR_SEED}, ` +
  `${COMPLETED_ROUNDS} rounds, ${JSON.stringify(observations)}\n`
);
