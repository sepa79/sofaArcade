import { MAX_BUILDING_SLOTS, MAX_SPECIALIZATION_BUILDINGS } from './constants';
import type {
  AnimalState,
  AnimalType,
  BuildingId,
  BuildingState,
  CreateInitialStateOptions,
  FarmState,
  FieldState,
  GameState,
  GoodId,
  PlayerState,
  StartingProfileId
} from './types';

interface StartingProfileDefinition {
  readonly id: StartingProfileId;
  readonly label: string;
  readonly cash: number;
  readonly goods: Readonly<Record<GoodId, number>>;
  readonly animals: Readonly<Record<AnimalType, AnimalState>>;
  readonly buildings: ReadonlyArray<BuildingState>;
  readonly fields: ReadonlyArray<FieldState>;
}

type SlotUsageRule = number | 'level';

const BUILDING_SLOT_USAGE: Readonly<Record<BuildingId, SlotUsageRule>> = {
  house: 0,
  'cow-barn': 'level',
  'pig-pen': 'level',
  coop: 'level',
  granary: 1,
  'root-storage': 1,
  'hay-barn': 1,
  'machinery-shed': 'level',
  mill: 1,
  'fries-kitchen': 1,
  'sugar-works': 1,
  'feed-mill': 1,
  'cheese-dairy': 1,
  'sausage-house': 1,
  'fast-food-outlet': 1
};

const STARTING_PROFILES: Readonly<Record<StartingProfileId, StartingProfileDefinition>> = {
  'dairy-start': {
    id: 'dairy-start',
    label: 'Dairy Farm',
    cash: 180,
    goods: {
      grain: 8,
      potatoes: 2,
      roots: 0,
      hay: 12,
      wood: 4,
      stone: 3,
      milk: 0,
      eggs: 0
    },
    animals: {
      cow: {
        type: 'cow',
        count: 2,
        quality: 'good',
        totalLiveWeightKg: 900
      },
      pig: {
        type: 'pig',
        count: 0,
        quality: 'ok',
        totalLiveWeightKg: 0
      },
      chicken: {
        type: 'chicken',
        count: 6,
        quality: 'ok',
        totalLiveWeightKg: 12
      }
    },
    buildings: [
      { id: 'house', level: 1, specialization: false },
      { id: 'cow-barn', level: 1, specialization: false },
      { id: 'hay-barn', level: 1, specialization: false }
    ],
    fields: [
      {
        id: 'field-a',
        soilClass: 'rich',
        terrainBonus: 'stream',
        mode: 'meadow',
        meadowUsage: 'hay',
        cropPlan: [{ season: 'spring', mode: 'meadow', meadowUsage: 'hay' }]
      },
      {
        id: 'field-b',
        soilClass: 'normal',
        terrainBonus: 'open-plain',
        mode: 'grain',
        meadowUsage: null,
        cropPlan: [{ season: 'spring', mode: 'grain', meadowUsage: null }]
      }
    ]
  },
  'pork-start': {
    id: 'pork-start',
    label: 'Pork Farm',
    cash: 170,
    goods: {
      grain: 4,
      potatoes: 10,
      roots: 2,
      hay: 6,
      wood: 5,
      stone: 3,
      milk: 0,
      eggs: 0
    },
    animals: {
      cow: {
        type: 'cow',
        count: 0,
        quality: 'ok',
        totalLiveWeightKg: 0
      },
      pig: {
        type: 'pig',
        count: 4,
        quality: 'good',
        totalLiveWeightKg: 360
      },
      chicken: {
        type: 'chicken',
        count: 0,
        quality: 'ok',
        totalLiveWeightKg: 0
      }
    },
    buildings: [
      { id: 'house', level: 1, specialization: false },
      { id: 'pig-pen', level: 1, specialization: false },
      { id: 'root-storage', level: 1, specialization: false }
    ],
    fields: [
      {
        id: 'field-a',
        soilClass: 'rich',
        terrainBonus: 'deep-soil',
        mode: 'potatoes',
        meadowUsage: null,
        cropPlan: [{ season: 'spring', mode: 'potatoes', meadowUsage: null }]
      },
      {
        id: 'field-b',
        soilClass: 'normal',
        terrainBonus: 'deep-soil',
        mode: 'roots',
        meadowUsage: null,
        cropPlan: [{ season: 'winter', mode: 'roots', meadowUsage: null }]
      }
    ]
  },
  'poultry-start': {
    id: 'poultry-start',
    label: 'Poultry Farm',
    cash: 165,
    goods: {
      grain: 12,
      potatoes: 3,
      roots: 0,
      hay: 3,
      wood: 4,
      stone: 2,
      milk: 0,
      eggs: 0
    },
    animals: {
      cow: {
        type: 'cow',
        count: 0,
        quality: 'ok',
        totalLiveWeightKg: 0
      },
      pig: {
        type: 'pig',
        count: 0,
        quality: 'ok',
        totalLiveWeightKg: 0
      },
      chicken: {
        type: 'chicken',
        count: 20,
        quality: 'good',
        totalLiveWeightKg: 40
      }
    },
    buildings: [
      { id: 'house', level: 1, specialization: false },
      { id: 'coop', level: 1, specialization: false },
      { id: 'granary', level: 1, specialization: false }
    ],
    fields: [
      {
        id: 'field-a',
        soilClass: 'normal',
        terrainBonus: 'open-plain',
        mode: 'grain',
        meadowUsage: null,
        cropPlan: [{ season: 'spring', mode: 'grain', meadowUsage: null }]
      },
      {
        id: 'field-b',
        soilClass: 'poor',
        terrainBonus: 'stream',
        mode: 'meadow',
        meadowUsage: 'hay',
        cropPlan: [{ season: 'spring', mode: 'meadow', meadowUsage: 'hay' }]
      }
    ]
  }
};

function requireProfile(profileId: StartingProfileId): StartingProfileDefinition {
  const profile = STARTING_PROFILES[profileId];
  if (profile === undefined) {
    throw new Error(`Unknown starting profile "${profileId}".`);
  }

  return profile;
}

function buildingSlotUsage(building: BuildingState): number {
  const rule = BUILDING_SLOT_USAGE[building.id];
  if (rule === undefined) {
    throw new Error(`Missing slot usage rule for building "${building.id}".`);
  }

  return rule === 'level' ? building.level : rule;
}

export function computeUsedBuildingSlots(buildings: ReadonlyArray<BuildingState>): number {
  return buildings.reduce((total, building) => total + buildingSlotUsage(building), 0);
}

function validateAnimalState(profileId: StartingProfileId, animal: AnimalState): void {
  if (!Number.isInteger(animal.count) || animal.count < 0) {
    throw new Error(`Starting profile "${profileId}" has invalid ${animal.type} count ${animal.count}.`);
  }

  if (!Number.isFinite(animal.totalLiveWeightKg) || animal.totalLiveWeightKg < 0) {
    throw new Error(
      `Starting profile "${profileId}" has invalid ${animal.type} live weight ${animal.totalLiveWeightKg}.`
    );
  }

  if (animal.type === 'pig' && animal.count > 0 && animal.totalLiveWeightKg <= 0) {
    throw new Error(`Starting profile "${profileId}" must define positive pig live weight.`);
  }
}

function validateProfile(profile: StartingProfileDefinition): void {
  const specializationCount = profile.buildings.filter((building) => building.specialization).length;
  if (specializationCount > MAX_SPECIALIZATION_BUILDINGS) {
    throw new Error(
      `Starting profile "${profile.id}" exceeds specialization building limit (${MAX_SPECIALIZATION_BUILDINGS}).`
    );
  }

  const usedSlots = computeUsedBuildingSlots(profile.buildings);
  if (usedSlots > MAX_BUILDING_SLOTS) {
    throw new Error(
      `Starting profile "${profile.id}" exceeds building slot limit (${usedSlots}/${MAX_BUILDING_SLOTS}).`
    );
  }

  if (profile.fields.length === 0) {
    throw new Error(`Starting profile "${profile.id}" must define at least one field.`);
  }

  const hasPlayableOpening = profile.fields.some((field) => field.cropPlan.length > 0);
  if (!hasPlayableOpening) {
    throw new Error(`Starting profile "${profile.id}" must include at least one active field plan.`);
  }

  if (!Number.isFinite(profile.cash) || profile.cash < 0) {
    throw new Error(`Starting profile "${profile.id}" has invalid starting cash ${profile.cash}.`);
  }

  const totalSeedLikeGoods = profile.goods.grain + profile.goods.potatoes + profile.goods.roots + profile.goods.hay;
  if (totalSeedLikeGoods <= 0 && profile.cash <= 0) {
    throw new Error(`Starting profile "${profile.id}" must provide seeds or sowing cash.`);
  }

  validateAnimalState(profile.id, profile.animals.cow);
  validateAnimalState(profile.id, profile.animals.pig);
  validateAnimalState(profile.id, profile.animals.chicken);
}

function cloneFarm(profile: StartingProfileDefinition): FarmState {
  return {
    cash: profile.cash,
    goods: { ...profile.goods },
    animals: {
      cow: { ...profile.animals.cow },
      pig: { ...profile.animals.pig },
      chicken: { ...profile.animals.chicken }
    },
    buildings: profile.buildings.map((building) => ({ ...building })),
    fields: profile.fields.map((field) => ({
      ...field,
      cropPlan: field.cropPlan.map((entry) => ({ ...entry }))
    }))
  };
}

function createPlayer(index: number, profile: StartingProfileDefinition): PlayerState {
  return {
    index,
    label: `Player ${index + 1}`,
    startingProfileId: profile.id,
    activeMenuSection: 'crops',
    activeSubmenuIndex: 0,
    detailMode: 'menu',
    detailIndex: 0,
    detailMenuIndex: 0,
    farm: cloneFarm(profile)
  };
}

export function getStartingProfileDefinition(profileId: StartingProfileId): StartingProfileDefinition {
  const profile = requireProfile(profileId);
  validateProfile(profile);
  return profile;
}

export function createInitialState(options: CreateInitialStateOptions): GameState {
  if (options.startingProfileIds.length < 2 || options.startingProfileIds.length > 4) {
    throw new Error(
      `Rolnik requires 2 to 4 players, received ${options.startingProfileIds.length}.`
    );
  }

  const players = options.startingProfileIds.map((profileId, index) =>
    createPlayer(index, getStartingProfileDefinition(profileId))
  );

  return {
    year: 1,
    season: 'spring',
    phase: 'planning',
    activePlayerIndex: 0,
    players
  };
}
