export type Owner = 'player' | 'enemy' | 'neutral';
export type Channel = 'radio' | 'relay' | 'courier';
export type Doctrine = 'BALANCED' | 'MILITARY' | 'SURVIVAL' | 'EXPAND';
export type MessageClass = 'REPORT' | 'ORDER';
export type OrderType = 'SET_DOCTRINE' | 'BUILD_RELAY';

export interface StarSystem {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly owner: Owner;
  readonly population: number;
  readonly industry: number;
  readonly defense: number;
  readonly shipyard: number;
  readonly stockpile: number;
  readonly doctrine: Doctrine;
  readonly stability: number;
  readonly garrison: number;
  readonly launchCooldown: number;
}

export interface RelayLink {
  readonly a: string;
  readonly b: string;
  readonly owner: Exclude<Owner, 'neutral'>;
}

export interface KnowledgeRecord {
  readonly systemId: string;
  readonly lastKnownOwner: Owner;
  readonly lastKnownPopulation: number;
  readonly lastKnownIndustry: number;
  readonly lastKnownDefense: number;
  readonly lastKnownGarrison: number;
  readonly lastKnownDoctrine: Doctrine;
  readonly reportOriginTurn: number;
  readonly reportArrivalTurn: number;
  readonly sourceChannel: Channel;
}

export interface Fleet {
  readonly id: number;
  readonly owner: Exclude<Owner, 'neutral'>;
  readonly originId: string;
  readonly destinationId: string;
  readonly strength: number;
  readonly arrivalTurn: number;
}

export interface RelayConstruction {
  readonly owner: Exclude<Owner, 'neutral'>;
  readonly fromSystemId: string;
  readonly toSystemId: string;
  readonly completeTurn: number;
}

export interface SystemReportPayload {
  readonly systemId: string;
  readonly owner: Owner;
  readonly population: number;
  readonly industry: number;
  readonly defense: number;
  readonly garrison: number;
  readonly doctrine: Doctrine;
  readonly originTurn: number;
}

export interface Message {
  readonly id: number;
  readonly owner: Exclude<Owner, 'neutral'>;
  readonly class: MessageClass;
  readonly originId: string;
  readonly destinationId: string;
  readonly channel: Channel;
  readonly dispatchTurn: number;
  readonly arrivalTurn: number;
  readonly payload: SystemReportPayload | OrderPayload;
}

export interface GameEvent {
  readonly turn: number;
  readonly text: string;
}

export interface GameState {
  readonly turn: number;
  readonly playerCapitalId: string;
  readonly enemyCapitalId: string;
  readonly systems: ReadonlyArray<StarSystem>;
  readonly relayLinks: ReadonlyArray<RelayLink>;
  readonly relayConstructions: ReadonlyArray<RelayConstruction>;
  readonly fleets: ReadonlyArray<Fleet>;
  readonly messages: ReadonlyArray<Message>;
  readonly knowledge: ReadonlyArray<KnowledgeRecord>;
  readonly eventLog: ReadonlyArray<GameEvent>;
  readonly nextFleetId: number;
  readonly nextMessageId: number;
}

export interface SetDoctrineCommand {
  readonly type: 'SET_DOCTRINE';
  readonly systemId: string;
  readonly doctrine: Doctrine;
  readonly channel: Channel;
}

export interface BuildRelayCommand {
  readonly type: 'BUILD_RELAY';
  readonly fromSystemId: string;
  readonly toSystemId: string;
  readonly channel: Channel;
}

export type PlayerCommand = SetDoctrineCommand | BuildRelayCommand;
export type OrderPayload = PlayerCommand;
