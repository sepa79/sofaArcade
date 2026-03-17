export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type GamePhase = 'planning' | 'turn-timer' | 'resolution' | 'summer-tender-event' | 'land-auction' | 'game-over';
export type MenuSectionId = 'crops' | 'animals' | 'house';
export type GoodId = 'grain' | 'potatoes' | 'roots' | 'hay' | 'wood' | 'stone' | 'milk' | 'eggs';
export type AnimalType = 'cow' | 'pig' | 'chicken';
export type AnimalQuality = 'poor' | 'ok' | 'good' | 'very-good' | 'excellent';
export type SoilClassId = 'poor' | 'normal' | 'rich';
export type TerrainBonusId = 'stream' | 'deep-soil' | 'open-plain' | 'sheltered-field';
export type FieldModeId = 'grain' | 'potatoes' | 'roots' | 'meadow';
export type MeadowUsageId = 'hay' | 'pasture';
export type StartingProfileId = 'dairy-start' | 'pork-start' | 'poultry-start';
export type DetailModeId = 'menu' | 'fields' | 'animals' | 'buildings';
export type BuildingId =
  | 'house'
  | 'cow-barn'
  | 'pig-pen'
  | 'coop'
  | 'granary'
  | 'root-storage'
  | 'hay-barn'
  | 'machinery-shed'
  | 'mill'
  | 'fries-kitchen'
  | 'sugar-works'
  | 'feed-mill'
  | 'cheese-dairy'
  | 'sausage-house'
  | 'fast-food-outlet';

export interface CropPlanEntry {
  readonly season: SeasonId;
  readonly mode: FieldModeId;
  readonly meadowUsage: MeadowUsageId | null;
}

export interface FieldState {
  readonly id: string;
  readonly soilClass: SoilClassId;
  readonly terrainBonus: TerrainBonusId;
  readonly mode: FieldModeId;
  readonly meadowUsage: MeadowUsageId | null;
  readonly cropPlan: ReadonlyArray<CropPlanEntry>;
}

export interface BuildingState {
  readonly id: BuildingId;
  readonly level: number;
  readonly specialization: boolean;
}

export interface AnimalState {
  readonly type: AnimalType;
  readonly count: number;
  readonly quality: AnimalQuality;
  readonly totalLiveWeightKg: number;
}

export interface FarmState {
  readonly cash: number;
  readonly goods: Readonly<Record<GoodId, number>>;
  readonly animals: Readonly<Record<AnimalType, AnimalState>>;
  readonly buildings: ReadonlyArray<BuildingState>;
  readonly fields: ReadonlyArray<FieldState>;
}

export interface PlayerState {
  readonly index: number;
  readonly label: string;
  readonly startingProfileId: StartingProfileId;
  readonly activeMenuSection: MenuSectionId;
  readonly activeSubmenuIndex: number;
  readonly detailMode: DetailModeId;
  readonly detailIndex: number;
  readonly detailMenuIndex: number;
  readonly farm: FarmState;
}

export interface GameState {
  readonly year: number;
  readonly season: SeasonId;
  readonly phase: GamePhase;
  readonly activePlayerIndex: number;
  readonly players: ReadonlyArray<PlayerState>;
}

export interface CreateInitialStateOptions {
  readonly startingProfileIds: ReadonlyArray<StartingProfileId>;
}

export interface FrameInput {
  readonly menuLeftPressed: boolean;
  readonly menuRightPressed: boolean;
  readonly submenuUpPressed: boolean;
  readonly submenuDownPressed: boolean;
  readonly selectPressed: boolean;
  readonly backPressed: boolean;
  readonly endTurnPressed: boolean;
}
