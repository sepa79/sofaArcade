import { ENEMY_CAPITAL_ID, MAX_EVENT_LOG, PLAYER_CAPITAL_ID, STARTING_TURN } from './constants';
import { INITIAL_KNOWLEDGE, INITIAL_RELAY_LINKS, INITIAL_SYSTEMS } from './scenario';
import type { GameEvent, GameState } from './types';

const INITIAL_EVENT_LOG: ReadonlyArray<GameEvent> = [
  { turn: STARTING_TURN, text: 'Strategic archive loaded. Remote truth is already old.' }
];

export function withEventLog(
  existing: ReadonlyArray<GameEvent>,
  additions: ReadonlyArray<GameEvent>
): ReadonlyArray<GameEvent> {
  return existing.concat(additions).slice(-MAX_EVENT_LOG);
}

export function createInitialState(): GameState {
  return {
    turn: STARTING_TURN,
    playerCapitalId: PLAYER_CAPITAL_ID,
    enemyCapitalId: ENEMY_CAPITAL_ID,
    systems: INITIAL_SYSTEMS,
    relayLinks: INITIAL_RELAY_LINKS,
    relayConstructions: [],
    fleets: [],
    messages: [],
    knowledge: INITIAL_KNOWLEDGE,
    eventLog: INITIAL_EVENT_LOG,
    nextFleetId: 1,
    nextMessageId: 1
  };
}
