import {
  AUTO_REPORT_CHANNEL_PRIORITY,
  EXPAND_LAUNCH_COOLDOWN_YEARS,
  EXPAND_LAUNCH_STRENGTH,
  EXPAND_LAUNCH_THRESHOLD
} from './constants';
import { relayPathDistance, travelTurnsForChannel } from './relay';
import { withEventLog } from './state';
import type {
  BuildRelayCommand,
  GameEvent,
  GameState,
  KnowledgeRecord,
  Message,
  OrderPayload,
  Owner,
  PlayerCommand,
  RelayConstruction,
  RelayLink,
  SetDoctrineCommand,
  StarSystem,
  SystemReportPayload
} from './types';

function requireSystem(state: GameState, systemId: string): StarSystem {
  const system = state.systems.find((candidate) => candidate.id === systemId);
  if (system === undefined) {
    throw new Error(`Unknown system "${systemId}".`);
  }

  return system;
}

function replaceSystem(state: GameState, updated: StarSystem): ReadonlyArray<StarSystem> {
  return state.systems.map((system) => (system.id === updated.id ? updated : system));
}

function findKnowledge(state: GameState, systemId: string): KnowledgeRecord {
  const record = state.knowledge.find((candidate) => candidate.systemId === systemId);
  if (record === undefined) {
    throw new Error(`Missing knowledge record for system "${systemId}".`);
  }

  return record;
}

function replaceKnowledgeRecord(
  knowledge: ReadonlyArray<KnowledgeRecord>,
  updated: KnowledgeRecord
): ReadonlyArray<KnowledgeRecord> {
  return knowledge.map((record) => (record.systemId === updated.systemId ? updated : record));
}

function createReportPayload(system: StarSystem, originTurn: number): SystemReportPayload {
  return {
    systemId: system.id,
    owner: system.owner,
    population: system.population,
    industry: system.industry,
    defense: system.defense,
    garrison: system.garrison,
    doctrine: system.doctrine,
    originTurn
  };
}

function pushEvent(events: GameEvent[], turn: number, text: string): void {
  events.push({ turn, text });
}

function commandDestination(command: PlayerCommand): string {
  switch (command.type) {
    case 'SET_DOCTRINE':
      return command.systemId;
    case 'BUILD_RELAY':
      return command.fromSystemId;
  }
}

function createPlayerOrderMessage(state: GameState, command: PlayerCommand): Message {
  const destinationId = commandDestination(command);
  const arrivalTurn = state.turn + travelTurnsForChannel(
    state,
    state.playerCapitalId,
    destinationId,
    command.channel,
    'player'
  );

  return {
    id: state.nextMessageId,
    owner: 'player',
    class: 'ORDER',
    originId: state.playerCapitalId,
    destinationId,
    channel: command.channel,
    dispatchTurn: state.turn,
    arrivalTurn,
    payload: command
  };
}

function enqueuePlayerCommands(state: GameState, commands: ReadonlyArray<PlayerCommand>): GameState {
  let nextMessageId = state.nextMessageId;
  const queuedMessages: Message[] = [];
  for (const command of commands) {
    const draftState = {
      ...state,
      nextMessageId
    };
    const message = createPlayerOrderMessage(draftState, command);
    queuedMessages.push(message);
    nextMessageId += 1;
  }

  const newEvents = queuedMessages.map((message) => ({
    turn: state.turn,
    text: `${message.channel.toUpperCase()} order sent to ${requireSystem(state, message.destinationId).name}.`
  }));

  return {
    ...state,
    messages: state.messages.concat(queuedMessages),
    nextMessageId,
    eventLog: withEventLog(state.eventLog, newEvents)
  };
}

function applyDoctrineOrder(
  state: GameState,
  order: SetDoctrineCommand
): GameState {
  const target = requireSystem(state, order.systemId);
  if (target.owner !== 'player') {
    return state;
  }

  const updated = {
    ...target,
    doctrine: order.doctrine
  };

  return {
    ...state,
    systems: replaceSystem(state, updated)
  };
}

function relayLinkExists(links: ReadonlyArray<RelayLink>, a: string, b: string, owner: Exclude<Owner, 'neutral'>): boolean {
  return links.some(
    (link) => link.owner === owner && ((link.a === a && link.b === b) || (link.a === b && link.b === a))
  );
}

function applyBuildRelayOrder(
  state: GameState,
  order: BuildRelayCommand
): GameState {
  const from = requireSystem(state, order.fromSystemId);
  const to = requireSystem(state, order.toSystemId);
  if (from.owner !== 'player' || to.owner !== 'player') {
    return state;
  }

  if (relayLinkExists(state.relayLinks, from.id, to.id, 'player')) {
    return state;
  }

  const alreadyBuilding = state.relayConstructions.some(
    (construction) =>
      construction.owner === 'player' &&
      ((construction.fromSystemId === from.id && construction.toSystemId === to.id) ||
        (construction.fromSystemId === to.id && construction.toSystemId === from.id))
  );
  if (alreadyBuilding) {
    return state;
  }

  return {
    ...state,
    relayConstructions: state.relayConstructions.concat({
      owner: 'player',
      fromSystemId: from.id,
      toSystemId: to.id,
      completeTurn: state.turn + 2
    })
  };
}

function applyArrivedOrders(state: GameState, arrivals: ReadonlyArray<Message>): { readonly state: GameState; readonly events: ReadonlyArray<GameEvent> } {
  let nextState = state;

  for (const message of arrivals) {
    if (message.class !== 'ORDER') {
      continue;
    }

    const order = message.payload as OrderPayload;
    switch (order.type) {
      case 'SET_DOCTRINE':
        nextState = applyDoctrineOrder(nextState, order);
        break;
      case 'BUILD_RELAY':
        nextState = applyBuildRelayOrder(nextState, order);
        break;
    }
  }

  return {
    state: nextState,
    events: []
  };
}

function applyArrivedReports(state: GameState, arrivals: ReadonlyArray<Message>): { readonly knowledge: ReadonlyArray<KnowledgeRecord>; readonly events: ReadonlyArray<GameEvent> } {
  let knowledge = state.knowledge;
  const events: GameEvent[] = [];

  for (const message of arrivals) {
    if (message.class !== 'REPORT') {
      continue;
    }

    const payload = message.payload as SystemReportPayload;
    const currentRecord = findKnowledge(state, payload.systemId);
    const updated: KnowledgeRecord = {
      systemId: payload.systemId,
      lastKnownOwner: payload.owner,
      lastKnownPopulation: payload.population,
      lastKnownIndustry: payload.industry,
      lastKnownDefense: payload.defense,
      lastKnownGarrison: payload.garrison,
      lastKnownDoctrine: payload.doctrine,
      reportOriginTurn: payload.originTurn,
      reportArrivalTurn: message.arrivalTurn,
      sourceChannel: message.channel
    };
    if (
      updated.reportOriginTurn > currentRecord.reportOriginTurn ||
      updated.reportArrivalTurn >= currentRecord.reportArrivalTurn
    ) {
      knowledge = replaceKnowledgeRecord(knowledge, updated);
      pushEvent(
        events,
        state.turn,
        `Report received from ${requireSystem(state, payload.systemId).name}. Knowledge age reset to ${state.turn - payload.originTurn}y.`
      );
    }
  }

  return {
    knowledge,
    events
  };
}

function applyEconomy(system: StarSystem): StarSystem {
  switch (system.doctrine) {
    case 'BALANCED':
      return {
        ...system,
        stockpile: system.stockpile + system.industry,
        garrison: system.garrison + Math.max(1, Math.floor(system.shipyard / 2)),
        launchCooldown: Math.max(0, system.launchCooldown - 1)
      };
    case 'MILITARY':
      return {
        ...system,
        stockpile: system.stockpile + Math.max(1, Math.floor(system.industry / 2)),
        garrison: system.garrison + system.shipyard + 1,
        launchCooldown: Math.max(0, system.launchCooldown - 1)
      };
    case 'SURVIVAL':
      return {
        ...system,
        defense: system.defense + 1 + Math.floor(system.industry / 2),
        garrison: system.garrison + 1,
        launchCooldown: Math.max(0, system.launchCooldown - 1)
      };
    case 'EXPAND':
      return {
        ...system,
        stockpile: system.stockpile + Math.max(1, Math.floor(system.industry / 2)),
        garrison: system.garrison + 1 + Math.max(1, Math.floor(system.shipyard / 2)),
        launchCooldown: Math.max(0, system.launchCooldown - 1)
      };
  }
}

function nearestNonOwnedSystem(state: GameState, origin: StarSystem): StarSystem | null {
  const candidates = state.systems.filter((system) => system.owner !== origin.owner);
  if (candidates.length === 0) {
    return null;
  }

  const ranked = candidates
    .map((system) => ({
      system,
      distance: Math.hypot(origin.x - system.x, origin.y - system.y)
    }))
    .sort((a, b) => a.distance - b.distance);

  return ranked[0]?.system ?? null;
}

function maybeAutoLaunchFleet(state: GameState, system: StarSystem): { readonly system: StarSystem; readonly fleet: GameState['fleets'][number] | null } {
  if (system.owner === 'neutral') {
    return { system, fleet: null };
  }

  if (system.doctrine !== 'EXPAND' || system.garrison < EXPAND_LAUNCH_THRESHOLD || system.launchCooldown > 0) {
    return { system, fleet: null };
  }

  const target = nearestNonOwnedSystem(state, system);
  if (target === null) {
    return { system, fleet: null };
  }

  const strength = Math.min(EXPAND_LAUNCH_STRENGTH, system.garrison - 3);
  if (strength <= 0) {
    return { system, fleet: null };
  }

  const updatedSystem: StarSystem = {
    ...system,
    garrison: system.garrison - strength,
    launchCooldown: EXPAND_LAUNCH_COOLDOWN_YEARS
  };
  const arrivalTurn = state.turn + Math.max(1, Math.ceil(Math.hypot(target.x - system.x, target.y - system.y) * 10));

  return {
    system: updatedSystem,
    fleet: {
      id: state.nextFleetId,
      owner: system.owner,
      originId: system.id,
      destinationId: target.id,
      strength,
      arrivalTurn
    }
  };
}

function executeLocalYear(state: GameState): GameState {
  let nextState = state;
  const updatedSystems = state.systems.map((system) => applyEconomy(system));
  nextState = {
    ...nextState,
    systems: updatedSystems
  };

  const launchedFleets: GameState['fleets'][number][] = [];
  let systemsAfterLaunch = updatedSystems;
  let nextFleetId = state.nextFleetId;

  for (const system of updatedSystems) {
    const launchResult = maybeAutoLaunchFleet(
      {
        ...nextState,
        systems: systemsAfterLaunch,
        nextFleetId
      },
      system
    );
    systemsAfterLaunch = systemsAfterLaunch.map((candidate) =>
      candidate.id === launchResult.system.id ? launchResult.system : candidate
    );

    if (launchResult.fleet !== null) {
      launchedFleets.push(launchResult.fleet);
      nextFleetId += 1;
    }
  }

  return {
    ...nextState,
    systems: systemsAfterLaunch,
    fleets: nextState.fleets.concat(launchedFleets),
    nextFleetId
  };
}

function queueReport(
  state: GameState,
  owner: Exclude<Owner, 'neutral'>,
  originId: string,
  destinationId: string,
  channel: 'radio' | 'relay',
  nextMessageId: number,
  payload: SystemReportPayload
): Message {
  return {
    id: nextMessageId,
    owner,
    class: 'REPORT',
    originId,
    destinationId,
    channel,
    dispatchTurn: state.turn,
    arrivalTurn: state.turn + travelTurnsForChannel(state, originId, destinationId, channel, owner),
    payload
  };
}

function bestAutoReportChannel(state: GameState, originId: string, destinationId: string, owner: Exclude<Owner, 'neutral'>): 'radio' | 'relay' {
  for (const channel of AUTO_REPORT_CHANNEL_PRIORITY) {
    if (channel === 'relay' && relayPathDistance(state, originId, destinationId, owner) !== null) {
      return channel;
    }

    if (channel === 'radio') {
      return 'radio';
    }
  }

  throw new Error(`No auto-report channel available from "${originId}" to "${destinationId}".`);
}

function queueRoutineReports(state: GameState): GameState {
  const queued: Message[] = [];
  let nextMessageId = state.nextMessageId;

  for (const system of state.systems) {
    if (system.owner !== 'player' || system.id === state.playerCapitalId) {
      continue;
    }

    const channel = bestAutoReportChannel(state, system.id, state.playerCapitalId, 'player');
    queued.push(
      queueReport(
        state,
        'player',
        system.id,
        state.playerCapitalId,
        channel,
        nextMessageId,
        createReportPayload(system, state.turn)
      )
    );
    nextMessageId += 1;
  }

  return {
    ...state,
    messages: state.messages.concat(queued),
    nextMessageId
  };
}

function completeRelayConstructions(state: GameState): GameState {
  const completing = state.relayConstructions.filter((construction) => construction.completeTurn <= state.turn);
  if (completing.length === 0) {
    return state;
  }

  const remaining = state.relayConstructions.filter((construction) => construction.completeTurn > state.turn);
  let relayLinks = state.relayLinks;

  for (const construction of completing) {
    if (relayLinkExists(relayLinks, construction.fromSystemId, construction.toSystemId, construction.owner)) {
      continue;
    }

    const from = requireSystem(state, construction.fromSystemId);
    const to = requireSystem(state, construction.toSystemId);
    if (from.owner !== construction.owner || to.owner !== construction.owner) {
      continue;
    }

    relayLinks = relayLinks.concat({
      a: construction.fromSystemId,
      b: construction.toSystemId,
      owner: construction.owner
    });
  }

  return {
    ...state,
    relayLinks,
    relayConstructions: remaining
  };
}

function resolveFleetArrival(state: GameState, arrivingFleet: GameState['fleets'][number]): GameState {
  const destination = requireSystem(state, arrivingFleet.destinationId);
  const sourceOwner = arrivingFleet.owner;
  const destinationOwner = destination.owner;

  if (sourceOwner === destinationOwner) {
    const reinforced = {
      ...destination,
      garrison: destination.garrison + arrivingFleet.strength
    };
    return {
      ...state,
      systems: replaceSystem(state, reinforced)
    };
  }

  const defensePower = destination.garrison + destination.defense;
  if (arrivingFleet.strength > defensePower) {
    const remaining = arrivingFleet.strength - defensePower;
    const conquered: StarSystem = {
      ...destination,
      owner: sourceOwner,
      defense: 2,
      garrison: remaining,
      doctrine: sourceOwner === 'player' ? 'SURVIVAL' : 'EXPAND',
      launchCooldown: 2
    };
    return {
      ...state,
      systems: replaceSystem(state, conquered)
    };
  }

  const survivingDefense = defensePower - arrivingFleet.strength;
  const updatedDestination: StarSystem = {
    ...destination,
    defense: Math.max(1, Math.min(destination.defense, survivingDefense)),
    garrison: Math.max(0, survivingDefense - Math.max(1, destination.defense))
  };
  return {
    ...state,
    systems: replaceSystem(state, updatedDestination)
  };
}

function queueCombatReports(state: GameState, before: StarSystem, after: StarSystem): GameState {
  let nextState = state;
  let nextMessageId = state.nextMessageId;
  const messages: Message[] = [];

  if (before.owner === 'player') {
    messages.push(
      queueReport(
        state,
        'player',
        before.id,
        state.playerCapitalId,
        'radio',
        nextMessageId,
        createReportPayload(after, state.turn)
      )
    );
    nextMessageId += 1;
  }

  if (after.owner === 'player' && before.owner !== 'player') {
    messages.push(
      queueReport(
        state,
        'player',
        after.id,
        state.playerCapitalId,
        'radio',
        nextMessageId,
        createReportPayload(after, state.turn)
      )
    );
    nextMessageId += 1;
  }

  nextState = {
    ...nextState,
    messages: nextState.messages.concat(messages),
    nextMessageId
  };

  return nextState;
}

function resolveFleetArrivals(state: GameState): GameState {
  const arriving = state.fleets.filter((fleet) => fleet.arrivalTurn === state.turn);
  const remaining = state.fleets.filter((fleet) => fleet.arrivalTurn > state.turn);
  let nextState: GameState = {
    ...state,
    fleets: remaining
  };

  for (const fleet of arriving) {
    const before = requireSystem(nextState, fleet.destinationId);
    nextState = resolveFleetArrival(nextState, fleet);
    const after = requireSystem(nextState, fleet.destinationId);
    nextState = queueCombatReports(nextState, before, after);
  }

  return nextState;
}

function applyCapitalTruth(state: GameState): GameState {
  const capital = requireSystem(state, state.playerCapitalId);
  const updatedKnowledge: KnowledgeRecord = {
    systemId: capital.id,
    lastKnownOwner: capital.owner,
    lastKnownPopulation: capital.population,
    lastKnownIndustry: capital.industry,
    lastKnownDefense: capital.defense,
    lastKnownGarrison: capital.garrison,
    lastKnownDoctrine: capital.doctrine,
    reportOriginTurn: state.turn,
    reportArrivalTurn: state.turn,
    sourceChannel: 'radio'
  };

  return {
    ...state,
    knowledge: replaceKnowledgeRecord(state.knowledge, updatedKnowledge)
  };
}

export function knowledgeAge(state: GameState, systemId: string): number {
  return state.turn - findKnowledge(state, systemId).reportOriginTurn;
}

export function estimatedTravelTurns(
  state: GameState,
  destinationId: string,
  channel: 'radio' | 'relay' | 'courier'
): number | null {
  try {
    return travelTurnsForChannel(state, state.playerCapitalId, destinationId, channel, 'player');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('No relay path')) {
      return null;
    }

    throw error;
  }
}

export function canBuildRelay(state: GameState, fromSystemId: string, toSystemId: string): boolean {
  if (fromSystemId === toSystemId) {
    return false;
  }

  const from = requireSystem(state, fromSystemId);
  const to = requireSystem(state, toSystemId);
  if (from.owner !== 'player' || to.owner !== 'player') {
    return false;
  }

  const alreadyBuilding = state.relayConstructions.some(
    (construction) =>
      construction.owner === 'player' &&
      ((construction.fromSystemId === fromSystemId && construction.toSystemId === toSystemId) ||
        (construction.fromSystemId === toSystemId && construction.toSystemId === fromSystemId))
  );

  return !relayLinkExists(state.relayLinks, fromSystemId, toSystemId, 'player') && !alreadyBuilding;
}

export function playerRelayConstructions(state: GameState): ReadonlyArray<RelayConstruction> {
  return state.relayConstructions.filter((construction) => construction.owner === 'player');
}

export function advanceTurn(state: GameState, commands: ReadonlyArray<PlayerCommand>): GameState {
  const withQueuedCommands = enqueuePlayerCommands(state, commands);
  let nextState: GameState = {
    ...withQueuedCommands,
    turn: withQueuedCommands.turn + 1
  };

  const arrivingMessages = nextState.messages.filter((message) => message.arrivalTurn === nextState.turn);
  nextState = {
    ...nextState,
    messages: nextState.messages.filter((message) => message.arrivalTurn > nextState.turn)
  };

  const orderResolution = applyArrivedOrders(nextState, arrivingMessages);
  nextState = orderResolution.state;
  const reportResolution = applyArrivedReports(nextState, arrivingMessages);
  nextState = {
    ...nextState,
    knowledge: reportResolution.knowledge,
    eventLog: withEventLog(
      nextState.eventLog,
      orderResolution.events.concat(reportResolution.events)
    )
  };

  nextState = completeRelayConstructions(nextState);
  nextState = executeLocalYear(nextState);
  nextState = resolveFleetArrivals(nextState);
  nextState = queueRoutineReports(nextState);
  nextState = applyCapitalTruth(nextState);

  return nextState;
}
