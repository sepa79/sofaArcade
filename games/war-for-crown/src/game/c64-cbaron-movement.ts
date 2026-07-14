import { c64CbaronMovementTargetRequirement, c64Divide32 } from './c64-arithmetic';
import { c64CombatSetupForProvince } from './c64-battle';
import { c64CbaronRequiredStrength, type C64CbaronOwnerSlot } from './c64-cbaron-threat';
import { c64CbaronConnectivityClass } from './c64-cbaron-connectivity';
import { c64CbaronL5C6E } from './c64-cbaron-date';
import { isRoyalistOwner } from './owners';
import { fortificationIndex, fortificationLevelAtIndex } from './rules';
import type { FortificationLevel, GameConfig, PlayerId, ProvinceId, ProvinceState } from './types';

const C64_FLAG_COMPONENT = 0x01;
const C64_FLAG_CLEANUP = 0x04;
const C64_FLAG_PLACEMENT_TARGET = 0x08;
const C64_FLAG_TARGET_WORKLIST = 0x10;
const C64_FLAG_SURPLUS_MARKER = 0x20;
const C64_MAX_24_BIT = 0xffffff;
const C64_24_BIT_MODULO = 0x1000000;
const C64_L6DF3_CLASS_MULTIPLIER: ReadonlyArray<number> = [1, 3, 5, 7, 8, 9, 10];
const C64_FORTIFICATION_UPGRADE_COST_BY_LEVEL: ReadonlyArray<number> = [20, 30, 40, 50, 60, 80];
const C64_FLAG_HIGH_SENTINEL = 0x80;
const C64_L6A64_TEMP_OWNER_ID: PlayerId = '__c64-l6a64-owner-5';

export interface C64CbaronMovementInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly activeHomeProvinceId: ProvinceId;
  readonly activeMoney: number;
  readonly turnNumber: number;
  readonly ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly ca61: number;
  readonly ca62: number;
  readonly maxHomeFortificationLevel: FortificationLevel;
  readonly maxProvinceFortificationLevel: FortificationLevel;
  readonly config: Pick<
    GameConfig,
    'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'
  >;
}

export interface C64CbaronFortificationUpgrade {
  readonly provinceId: ProvinceId;
  readonly level: FortificationLevel;
  readonly cost: number;
}

export interface C64CbaronMovementResult {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly finalMoney: number;
  readonly fortificationUpgrades: ReadonlyArray<C64CbaronFortificationUpgrade>;
  readonly pulledMobileSoldiers: number;
  readonly defensiveRequirement: number;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly rememberedTargetSoldiers: number;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
}

export interface C64CbaronL6C49PlacementInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly surplusSoldiers: number;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly ca61: number;
  readonly ca62: number;
  readonly config: Pick<GameConfig, 'royalistAttitude' | 'terrainInfluence'>;
  readonly connectivityClassOverrideByTargetId?: Readonly<Record<ProvinceId, number>>;
}

export interface C64CbaronL6BC5TargetMarkingInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly surplusSoldiers: number;
  readonly ca61: number;
  readonly ca62: number;
  readonly config: Pick<GameConfig, 'royalistAttitude' | 'terrainInfluence'>;
}

export interface C64CbaronL6BC5TargetMarkingResult {
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly candidateCount: number;
  readonly targetNeedsByProvinceId: Readonly<Record<ProvinceId, number>>;
}

export interface C64CbaronL6DFAFallbackInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly surplusSoldiers: number;
}

export interface C64CbaronL6DFAFallbackResult {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly distributedSoldiers: number;
}

export interface C64CbaronL6AC3SurplusRedistributionInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly ca61: number;
  readonly ca62: number;
  readonly config: Pick<
    GameConfig,
    'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'
  >;
}

export interface C64CbaronL6AC3SurplusRedistributionResult {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly selectedProvinceId: ProvinceId;
  readonly localRequirement: number;
  readonly initialSurplusSoldiers: number;
  readonly scratchSurplusSoldiers: number;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly rememberedTargetSoldiers: number;
}

export interface C64CbaronL6A64CleanupInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly ca61: number;
  readonly ca62: number;
  readonly config: Pick<
    GameConfig,
    'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'
  >;
}

export interface C64CbaronL6A64CleanupResult {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly cleanupRequirementsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly rememberedTargetSoldiers: number;
}

export interface C64CbaronL6207FortCompensationInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly activeHomeProvinceId: ProvinceId;
  readonly ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly money: number;
  readonly maxHomeFortificationLevel: FortificationLevel;
  readonly maxProvinceFortificationLevel: FortificationLevel;
  readonly config: Pick<
    GameConfig,
    'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'
  >;
}

export interface C64CbaronL6207FortCompensationResult {
  readonly selectedProvinceId: ProvinceId | null;
  readonly strengthReduction: number;
  readonly upgradeCost: number;
}

export interface C64CbaronL6C49PlacementResult {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly selectedTargetProvinceId: ProvinceId | null;
  readonly selectedStagingProvinceId: ProvinceId | null;
  readonly selectedAmount: number;
  readonly remainingSurplusSoldiers: number;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly rememberedTargetSoldiers: number;
}

interface MovementContext {
  readonly input: C64CbaronMovementInput;
  readonly provincesById: ReadonlyMap<ProvinceId, ProvinceState>;
  readonly provinceIndexById: ReadonlyMap<ProvinceId, number>;
  readonly flags: number[];
  provinces: ProvinceState[];
  money: number;
  fortificationUpgrades: C64CbaronFortificationUpgrade[];
  pulledMobileSoldiers: number;
  defensiveRequirement: number;
  rememberedTargetProvinceId: ProvinceId | null;
  rememberedTargetSoldiers: number;
}

function require24Bit(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > C64_MAX_24_BIT) {
    throw new Error(`${label} must be a C64 24-bit value, got ${value}.`);
  }
}

function requireByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} must be a C64 byte, got ${value}.`);
  }
}

function requireClass(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= C64_L6DF3_CLASS_MULTIPLIER.length) {
    throw new Error(`${label} must be a C64 connectivity class from 0 to 6, got ${value}.`);
  }
}

function requireUniqueProvinces(
  provinces: ReadonlyArray<ProvinceState>
): ReadonlyMap<ProvinceId, ProvinceState> {
  const provincesById = new Map<ProvinceId, ProvinceState>();
  for (const province of provinces) {
    if (provincesById.has(province.id)) {
      throw new Error(`Duplicate C64 cbaron movement province ${province.id}.`);
    }
    require24Bit(province.soldiers, `Province ${province.id} soldiers`);
    provincesById.set(province.id, province);
  }
  return provincesById;
}

function requireProvince(
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  provinceId: ProvinceId
): ProvinceState {
  const province = provincesById.get(provinceId);
  if (province === undefined) {
    throw new Error(`Unknown C64 cbaron movement province ${provinceId}.`);
  }
  return province;
}

function createProvinceIndexById(
  provinces: ReadonlyArray<ProvinceState>
): ReadonlyMap<ProvinceId, number> {
  return new Map(provinces.map((province, index) => [province.id, index]));
}

function provinceOrderDescending(
  provinceIndexById: ReadonlyMap<ProvinceId, number>,
  left: ProvinceState,
  right: ProvinceState
): number {
  return requireProvinceIndex(provinceIndexById, right.id) -
    requireProvinceIndex(provinceIndexById, left.id);
}

function requireProvinceIndex(
  provinceIndexById: ReadonlyMap<ProvinceId, number>,
  provinceId: ProvinceId
): number {
  const index = provinceIndexById.get(provinceId);
  if (index === undefined) {
    throw new Error(`Missing C64 cbaron movement province order for ${provinceId}.`);
  }
  return index;
}

function validateNeighbours(
  provinces: ReadonlyArray<ProvinceState>,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): void {
  for (const province of provinces) {
    for (const neighbourId of province.neighbours) {
      requireProvince(provincesById, neighbourId);
    }
  }
}

function mobileSoldiers(province: ProvinceState): number {
  return Math.max(0, province.soldiers - 1);
}

function createContext(input: C64CbaronMovementInput): MovementContext {
  const provincesById = requireUniqueProvinces(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  requireProvince(provincesById, input.activeHomeProvinceId);
  require24Bit(input.activeMoney, 'C64 movement active money');
  if (!Number.isInteger(input.turnNumber) || input.turnNumber < 1) {
    throw new Error(`C64 movement turn number must be a positive integer, got ${input.turnNumber}.`);
  }

  return {
    input,
    provincesById,
    provinceIndexById: createProvinceIndexById(input.provinces),
    flags: input.provinces.map((_province, index) => index === 0 ? C64_FLAG_HIGH_SENTINEL : 0),
    provinces: input.provinces.map((province) => ({ ...province })),
    money: input.activeMoney,
    fortificationUpgrades: [],
    pulledMobileSoldiers: 0,
    defensiveRequirement: 0,
    rememberedTargetProvinceId: input.rememberedTargetProvinceId,
    rememberedTargetSoldiers: 0
  };
}

function provinceAt(context: MovementContext, index: number): ProvinceState {
  const province = context.provinces[index];
  if (province === undefined) {
    throw new Error(`Missing C64 cbaron movement province at index ${index}.`);
  }
  return province;
}

function replaceProvince(
  context: MovementContext,
  provinceId: ProvinceId,
  update: (province: ProvinceState) => ProvinceState
): void {
  const index = requireProvinceIndex(context.provinceIndexById, provinceId);
  context.provinces[index] = update(provinceAt(context, index));
}

function connectedActiveComponent(
  context: MovementContext,
  startProvinceId: ProvinceId
): ReadonlyArray<ProvinceId> {
  const start = requireProvince(context.provincesById, startProvinceId);
  if (start.ownerId !== context.input.activeOwnerId) {
    throw new Error(`C64 movement component start ${startProvinceId} is not active-owned.`);
  }

  const component = new Set<ProvinceId>([startProvinceId]);
  const stack = [startProvinceId];
  while (stack.length > 0) {
    const provinceId = stack.pop();
    if (provinceId === undefined) {
      throw new Error('Missing C64 movement component stack item.');
    }
    const province = requireProvince(context.provincesById, provinceId);
    for (const neighbourId of province.neighbours) {
      const neighbour = requireProvince(context.provincesById, neighbourId);
      if (neighbour.ownerId !== context.input.activeOwnerId || component.has(neighbour.id)) {
        continue;
      }
      component.add(neighbour.id);
      stack.push(neighbour.id);
    }
  }

  return [...component];
}

function frontierComponentProvinceIds(
  context: MovementContext,
  componentProvinceIds: ReadonlyArray<ProvinceId>
): ReadonlyArray<ProvinceId> {
  const component = new Set(componentProvinceIds);
  return componentProvinceIds.filter((provinceId) => {
    const province = requireProvince(context.provincesById, provinceId);
    return province.neighbours.some((neighbourId) => !component.has(neighbourId));
  }).sort((left, right) =>
    requireProvinceIndex(context.provinceIndexById, right) -
    requireProvinceIndex(context.provinceIndexById, left)
  );
}

function activeComponents(context: MovementContext): ReadonlyArray<ReadonlyArray<ProvinceId>> {
  const processed = new Set<ProvinceId>();
  const components: Array<ReadonlyArray<ProvinceId>> = [];
  for (let index = context.provinces.length - 1; index >= 0; index -= 1) {
    const province = provinceAt(context, index);
    if (
      province.ownerId !== context.input.activeOwnerId ||
      processed.has(province.id)
    ) {
      continue;
    }
    const component = connectedActiveComponent(context, province.id);
    for (const provinceId of component) {
      processed.add(provinceId);
    }
    components.push(component);
  }
  return components;
}

function pullMobileSoldiers(
  context: MovementContext,
  componentProvinceIds: ReadonlyArray<ProvinceId>
): number {
  let pulled = 0;
  for (const provinceId of componentProvinceIds) {
    const province = requireProvince(context.provincesById, provinceId);
    pulled = add24Bit(pulled, mobileSoldiers(province));
    replaceProvince(context, provinceId, (current) => ({
      ...current,
      soldiers: 1
    }));
  }
  return pulled;
}

function flagsByProvinceId(context: MovementContext): Readonly<Record<ProvinceId, number>> {
  return Object.fromEntries(
    context.provinces.map((province, index) => [province.id, context.flags[index] ?? 0])
  );
}

function flagsRecordByProvinceId(
  provinces: ReadonlyArray<ProvinceState>,
  flags: ReadonlyArray<number>
): Readonly<Record<ProvinceId, number>> {
  return Object.fromEntries(
    provinces.map((province, index) => [province.id, flags[index] ?? 0])
  );
}

function add24Bit(left: number, right: number): number {
  require24Bit(left, 'C64 24-bit add left operand');
  require24Bit(right, 'C64 24-bit add right operand');
  return (left + right) % C64_24_BIT_MODULO;
}

function subtract24BitWithInitialBorrow(left: number, right: number): number {
  require24Bit(left, 'C64 24-bit subtract left operand');
  require24Bit(right, 'C64 24-bit subtract right operand');
  return (left - right - 1 + C64_24_BIT_MODULO) % C64_24_BIT_MODULO;
}

function subtract24Bit(left: number, right: number): number {
  require24Bit(left, 'C64 24-bit subtract left operand');
  require24Bit(right, 'C64 24-bit subtract right operand');
  return (left - right + C64_24_BIT_MODULO) % C64_24_BIT_MODULO;
}

function c64FortificationUpgradeCost(currentLevel: FortificationLevel): number {
  const currentIndex = fortificationIndex(currentLevel);
  const cost = C64_FORTIFICATION_UPGRADE_COST_BY_LEVEL[currentIndex];
  if (cost === undefined) {
    throw new Error(`Missing C64 fortification upgrade cost for level ${currentIndex}.`);
  }
  return cost;
}

function c64L6484TargetNeed(
  target: ProvinceState,
  input: Pick<C64CbaronL6C49PlacementInput, 'ca61' | 'ca62' | 'config'>
): number {
  requireByte(input.ca61, 'C64 L6484 $CA61 pressure low byte');
  requireByte(input.ca62, 'C64 L6484 $CA62 pressure high byte');

  if (input.config.royalistAttitude === 'friendly' && isRoyalistOwner(target.ownerId)) {
    return 1;
  }

  const combatSetup = c64CombatSetupForProvince(target, input.config);
  return c64CbaronMovementTargetRequirement({
    attackerCombatPercent: combatSetup.attackerCombatPercent,
    defenderCombatPercent: combatSetup.defenderCombatPercent,
    targetSoldiers: target.soldiers,
    pressureWord: input.ca61 + input.ca62 * 0x100
  });
}

function adjacentActiveMobileSupport(
  target: ProvinceState,
  input: C64CbaronL6C49PlacementInput,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): number {
  return adjacentActiveMobileSupportForOwner(target, input.activeOwnerId, provincesById);
}

function adjacentActiveMobileSupportForOwner(
  target: ProvinceState,
  activeOwnerId: PlayerId,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): number {
  return target.neighbours
    .map((provinceId) => requireProvince(provincesById, provinceId))
    .filter((province) => province.ownerId === activeOwnerId)
    .reduce((total, province) => total + mobileSoldiers(province), 0);
}

function c64L6BC5RemainingNeed(
  target: ProvinceState,
  input: C64CbaronL6BC5TargetMarkingInput,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): number | null {
  const requiredBeforeSupport = c64L6484TargetNeed(target, input);
  const adjacentSupport = adjacentActiveMobileSupportForOwner(
    target,
    input.activeOwnerId,
    provincesById
  );
  if (adjacentSupport > requiredBeforeSupport) {
    return null;
  }

  const remainingNeed = requiredBeforeSupport - adjacentSupport;
  if (remainingNeed < 1 || remainingNeed > input.surplusSoldiers) {
    return null;
  }
  return remainingNeed;
}

function isActiveFrontierProvince(
  province: ProvinceState,
  activeOwnerId: PlayerId,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): boolean {
  if (province.ownerId !== activeOwnerId) {
    return false;
  }

  return province.neighbours.some((neighbourId) => {
    const neighbour = requireProvince(provincesById, neighbourId);
    return neighbour.ownerId !== activeOwnerId;
  });
}

function c64MainL514AFrontierFilter(
  provinces: ReadonlyArray<ProvinceState>,
  activeOwnerId: PlayerId,
  flags: number[],
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  provinceIndexById: ReadonlyMap<ProvinceId, number>
): void {
  const candidates = provinces
    .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_TARGET_WORKLIST) !== 0)
    .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right));

  for (const province of candidates) {
    const index = requireProvinceIndex(provinceIndexById, province.id);
    if (!isActiveFrontierProvince(province, activeOwnerId, provincesById)) {
      flags[index] = (flags[index] ?? 0) & ~C64_FLAG_TARGET_WORKLIST;
    }
  }

  for (const province of provinces) {
    const index = requireProvinceIndex(provinceIndexById, province.id);
    flags[index] = (flags[index] ?? 0) & 0x3f;
  }

  for (const province of provinces) {
    const index = requireProvinceIndex(provinceIndexById, province.id);
    if (((flags[index] ?? 0) & C64_FLAG_TARGET_WORKLIST) !== 0) {
      flags[index] = (flags[index] ?? 0) | C64_FLAG_HIGH_SENTINEL;
    }
  }
}

function distributeC64L4F49Soldiers(
  provinces: ProvinceState[],
  flags: ReadonlyArray<number>,
  surplusSoldiers: number,
  provinceIndexById: ReadonlyMap<ProvinceId, number>
): number {
  if (surplusSoldiers === 0) {
    return 0;
  }

  const targets = provinces
    .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_TARGET_WORKLIST) !== 0)
    .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right));
  if (targets.length < 1) {
    throw new Error('C64 L4F49 distribution requires at least one $10 target.');
  }

  const distribution = c64Divide32(surplusSoldiers, targets.length);
  let remainingRemainder = distribution.remainder;

  for (const target of targets) {
    const index = requireProvinceIndex(provinceIndexById, target.id);
    const current = provinces[index];
    if (current === undefined) {
      throw new Error(`Missing C64 L4F49 target province ${target.id}.`);
    }

    const extra = remainingRemainder > 0 ? 1 : 0;
    if (remainingRemainder > 0) {
      remainingRemainder -= 1;
    }
    provinces[index] = {
      ...current,
      soldiers: add24Bit(current.soldiers, distribution.quotient + extra)
    };
  }

  return surplusSoldiers;
}

function selectedL6AC3Province(
  provinces: ReadonlyArray<ProvinceState>,
  flags: ReadonlyArray<number>,
  provinceIndexById: ReadonlyMap<ProvinceId, number>
): ProvinceState {
  const selected = provinces
    .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_SURPLUS_MARKER) !== 0)
    .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right))[0];
  if (selected === undefined) {
    throw new Error('C64 L6AC3 requires a $20 selected province marker.');
  }
  return selected;
}

function updateProvinceById(
  provinces: ReadonlyArray<ProvinceState>,
  provinceIndexById: ReadonlyMap<ProvinceId, number>,
  provinceId: ProvinceId,
  update: (province: ProvinceState) => ProvinceState
): ProvinceState[] {
  const next = provinces.map((province) => ({ ...province }));
  const index = requireProvinceIndex(provinceIndexById, provinceId);
  const province = next[index];
  if (province === undefined) {
    throw new Error(`Missing C64 province ${provinceId}.`);
  }
  next[index] = update(province);
  return next;
}

function setProvinceSoldiers(
  provinces: ReadonlyArray<ProvinceState>,
  provinceIndexById: ReadonlyMap<ProvinceId, number>,
  provinceId: ProvinceId,
  soldiers: number
): ProvinceState[] {
  require24Bit(soldiers, `C64 soldiers for ${provinceId}`);
  return updateProvinceById(provinces, provinceIndexById, provinceId, (province) => ({
    ...province,
    soldiers
  }));
}

function markActiveComponentForL6AC3(
  provinces: ReadonlyArray<ProvinceState>,
  selectedProvinceId: ProvinceId,
  activeOwnerId: PlayerId,
  flags: number[],
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  provinceIndexById: ReadonlyMap<ProvinceId, number>
): void {
  const component = new Set<ProvinceId>([selectedProvinceId]);
  const stack = [selectedProvinceId];

  while (stack.length > 0) {
    const provinceId = stack.pop();
    if (provinceId === undefined) {
      throw new Error('Missing C64 L6AC3 component stack item.');
    }
    const province = requireProvince(provincesById, provinceId);
    if (province.ownerId !== activeOwnerId) {
      throw new Error(`C64 L6AC3 component province ${province.id} is not active-owned.`);
    }

    for (const neighbourId of province.neighbours) {
      if (component.has(neighbourId)) {
        continue;
      }
      const neighbour = requireProvince(provincesById, neighbourId);
      if (neighbour.ownerId !== activeOwnerId) {
        continue;
      }
      component.add(neighbourId);
      stack.push(neighbourId);
    }
  }

  for (const province of provinces) {
    const index = requireProvinceIndex(provinceIndexById, province.id);
    flags[index] = (flags[index] ?? 0) & 0x3f;
  }

  for (const provinceId of component) {
    const index = requireProvinceIndex(provinceIndexById, provinceId);
    flags[index] = (flags[index] ?? 0) | C64_FLAG_COMPONENT | C64_FLAG_TARGET_WORKLIST;
  }
}

function buildL6B8CTargetWorklist(
  provinces: ReadonlyArray<ProvinceState>,
  activeOwnerId: PlayerId,
  flags: number[],
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  provinceIndexById: ReadonlyMap<ProvinceId, number>
): void {
  const targetProvinceIds = new Set<ProvinceId>();
  const sourceProvinces = provinces
    .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_TARGET_WORKLIST) !== 0)
    .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right));

  for (const source of sourceProvinces) {
    for (const neighbourId of source.neighbours) {
      const neighbour = requireProvince(provincesById, neighbourId);
      if (neighbour.ownerId !== activeOwnerId) {
        targetProvinceIds.add(neighbour.id);
      }
    }
  }

  for (const province of provinces) {
    const index = requireProvinceIndex(provinceIndexById, province.id);
    flags[index] = (flags[index] ?? 0) & ~C64_FLAG_TARGET_WORKLIST;
  }

  for (const targetProvinceId of targetProvinceIds) {
    const index = requireProvinceIndex(provinceIndexById, targetProvinceId);
    flags[index] = ((flags[index] ?? 0) & ~C64_FLAG_HIGH_SENTINEL) | C64_FLAG_TARGET_WORKLIST;
  }
}

function flagsFromRecord(
  provinces: ReadonlyArray<ProvinceState>,
  flagsByProvinceId: Readonly<Record<ProvinceId, number>>
): number[] {
  return provinces.map((province) => flagsByProvinceId[province.id] ?? 0);
}

export function runC64CbaronL6BC5TargetMarking(
  input: C64CbaronL6BC5TargetMarkingInput
): C64CbaronL6BC5TargetMarkingResult {
  require24Bit(input.surplusSoldiers, 'C64 L6BC5 surplus soldiers');
  const provincesById = requireUniqueProvinces(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  const provinceIndexById = createProvinceIndexById(input.provinces);
  const flags = input.provinces.map((province) => input.flagsByProvinceId[province.id] ?? 0);
  const targetNeedsByProvinceId: Record<ProvinceId, number> = {};
  let candidateCount = 0;

  const targets = input.provinces
    .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_TARGET_WORKLIST) !== 0)
    .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right));

  for (const target of targets) {
    const remainingNeed = c64L6BC5RemainingNeed(target, input, provincesById);
    if (remainingNeed === null) {
      continue;
    }

    const index = requireProvinceIndex(provinceIndexById, target.id);
    flags[index] = (flags[index] ?? 0) | C64_FLAG_PLACEMENT_TARGET;
    targetNeedsByProvinceId[target.id] = remainingNeed;
    candidateCount += 1;
  }

  return {
    flagsByProvinceId: flagsRecordByProvinceId(
      input.provinces,
      flags.map((flag) => flag & 0x3f)
    ),
    candidateCount,
    targetNeedsByProvinceId
  };
}

export function runC64CbaronL6AC3SurplusRedistribution(
  input: C64CbaronL6AC3SurplusRedistributionInput
): C64CbaronL6AC3SurplusRedistributionResult {
  requireByte(input.ca61, 'C64 L6AC3 $CA61 pressure low byte');
  requireByte(input.ca62, 'C64 L6AC3 $CA62 pressure high byte');
  const provincesById = requireUniqueProvinces(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  const provinceIndexById = createProvinceIndexById(input.provinces);
  const flags = flagsFromRecord(input.provinces, input.flagsByProvinceId)
    .map((flag) => flag & 0x24);
  const selectedProvince = selectedL6AC3Province(input.provinces, flags, provinceIndexById);
  const selectedIndex = requireProvinceIndex(provinceIndexById, selectedProvince.id);
  flags[selectedIndex] = (flags[selectedIndex] ?? 0) & ~0x20;

  const requirementResult = c64CbaronRequiredStrength({
    provinces: input.provinces,
    activeOwnerId: input.activeOwnerId,
    ownerSlots: input.ownerSlots,
    worklistProvinceIds: [selectedProvince.id],
    config: input.config
  });
  const localRequirement = requirementResult.totalRequiredSoldiers;
  const initialSurplusSoldiers = subtract24BitWithInitialBorrow(
    selectedProvince.soldiers,
    localRequirement
  );
  let provinces = setProvinceSoldiers(
    input.provinces,
    provinceIndexById,
    selectedProvince.id,
    add24Bit(localRequirement, 1)
  );
  let scratchSurplusSoldiers = initialSurplusSoldiers;
  let rememberedTargetProvinceId = input.rememberedTargetProvinceId;
  let rememberedTargetSoldiers = 0;
  let rememberedStagingProvinceId: ProvinceId | null = null;

  if (scratchSurplusSoldiers !== 0) {
    markActiveComponentForL6AC3(
      provinces,
      selectedProvince.id,
      input.activeOwnerId,
      flags,
      provincesById,
      provinceIndexById
    );
    c64MainL514AFrontierFilter(
      provinces,
      input.activeOwnerId,
      flags,
      provincesById,
      provinceIndexById
    );
    buildL6B8CTargetWorklist(
      provinces,
      input.activeOwnerId,
      flags,
      provincesById,
      provinceIndexById
    );

    for (;;) {
      const marked = runC64CbaronL6BC5TargetMarking({
        provinces,
        activeOwnerId: input.activeOwnerId,
        flagsByProvinceId: flagsRecordByProvinceId(provinces, flags),
        surplusSoldiers: scratchSurplusSoldiers,
        ca61: input.ca61,
        ca62: input.ca62,
        config: input.config
      });
      for (let index = 0; index < flags.length; index += 1) {
        const province = provinces[index];
        if (province === undefined) {
          throw new Error(`Missing C64 L6AC3 province at index ${index}.`);
        }
        flags[index] = marked.flagsByProvinceId[province.id] ?? 0;
      }
      if (marked.candidateCount === 0) {
        break;
      }
      const targetMemoryWasEmpty = rememberedTargetProvinceId === null;
      const placed = runC64CbaronL6C49Placement({
        provinces,
        activeOwnerId: input.activeOwnerId,
        flagsByProvinceId: flagsRecordByProvinceId(provinces, flags),
        surplusSoldiers: scratchSurplusSoldiers,
        rememberedTargetProvinceId,
        ca61: input.ca61,
        ca62: input.ca62,
        config: input.config
      });
      if (placed.selectedStagingProvinceId === null) {
        throw new Error('C64 L6AC3 target marking did not produce a placement staging province.');
      }
      provinces = [...placed.provinces];
      if (targetMemoryWasEmpty) {
        rememberedStagingProvinceId = placed.selectedStagingProvinceId;
      }
      scratchSurplusSoldiers = placed.remainingSurplusSoldiers;
      rememberedTargetProvinceId = placed.rememberedTargetProvinceId;
      if (placed.rememberedTargetSoldiers !== 0) {
        rememberedTargetSoldiers = placed.rememberedTargetSoldiers;
      }
      for (let index = 0; index < flags.length; index += 1) {
        const province = provinces[index];
        if (province === undefined) {
          throw new Error(`Missing C64 L6AC3 province after placement at index ${index}.`);
        }
        flags[index] = placed.flagsByProvinceId[province.id] ?? 0;
      }
    }

    const rememberedStagingIndex = rememberedStagingProvinceId === null
      ? null
      : requireProvinceIndex(provinceIndexById, rememberedStagingProvinceId);
    if (
      rememberedTargetProvinceId !== null &&
      rememberedStagingIndex !== null &&
      ((flags[rememberedStagingIndex] ?? 0) & C64_FLAG_COMPONENT) !== 0
    ) {
      const staging = provinces[rememberedStagingIndex];
      if (staging === undefined) {
        throw new Error(`Missing C64 remembered staging province ${rememberedStagingProvinceId}.`);
      }
      provinces[rememberedStagingIndex] = {
        ...staging,
        soldiers: add24Bit(staging.soldiers, scratchSurplusSoldiers)
      };
    } else {
      const fallbackMarked = runC64CbaronL6BC5TargetMarking({
        provinces,
        activeOwnerId: input.activeOwnerId,
        flagsByProvinceId: flagsRecordByProvinceId(provinces, flags),
        surplusSoldiers: scratchSurplusSoldiers,
        ca61: 0x00,
        ca62: 0x01,
        config: input.config
      });
      for (let index = 0; index < flags.length; index += 1) {
        const province = provinces[index];
        if (province === undefined) {
          throw new Error(`Missing C64 L6AC3 fallback province at index ${index}.`);
        }
        flags[index] = fallbackMarked.flagsByProvinceId[province.id] ?? 0;
      }

      if (fallbackMarked.candidateCount === 0) {
        const fallback = runC64CbaronL6DFAFallback({
          provinces,
          activeOwnerId: input.activeOwnerId,
          flagsByProvinceId: flagsRecordByProvinceId(provinces, flags),
          surplusSoldiers: scratchSurplusSoldiers
        });
        provinces = [...fallback.provinces];
        for (let index = 0; index < flags.length; index += 1) {
          const province = provinces[index];
          if (province === undefined) {
            throw new Error(`Missing C64 L6AC3 L6DFA province at index ${index}.`);
          }
          flags[index] = fallback.flagsByProvinceId[province.id] ?? 0;
        }
      } else {
        const placed = runC64CbaronL6C49Placement({
          provinces,
          activeOwnerId: input.activeOwnerId,
          flagsByProvinceId: flagsRecordByProvinceId(provinces, flags),
          surplusSoldiers: scratchSurplusSoldiers,
          rememberedTargetProvinceId,
          ca61: 0x00,
          ca62: 0x01,
          config: input.config
        });
        provinces = [...placed.provinces];
        scratchSurplusSoldiers = placed.remainingSurplusSoldiers;
        rememberedTargetProvinceId = placed.rememberedTargetProvinceId;
        if (placed.rememberedTargetSoldiers !== 0) {
          rememberedTargetSoldiers = placed.rememberedTargetSoldiers;
        }
        const stagingProvinceId = placed.selectedStagingProvinceId;
        if (stagingProvinceId === null) {
          throw new Error('C64 L6AC3 fallback placement did not select a staging province.');
        }
        const stagingIndex = requireProvinceIndex(provinceIndexById, stagingProvinceId);
        const staging = provinces[stagingIndex];
        if (staging === undefined) {
          throw new Error(`Missing C64 L6AC3 fallback staging province ${stagingProvinceId}.`);
        }
        provinces[stagingIndex] = {
          ...staging,
          soldiers: add24Bit(staging.soldiers, scratchSurplusSoldiers)
        };
        for (let index = 0; index < flags.length; index += 1) {
          const province = provinces[index];
          if (province === undefined) {
            throw new Error(`Missing C64 L6AC3 placed province at index ${index}.`);
          }
          flags[index] = placed.flagsByProvinceId[province.id] ?? 0;
        }
      }
    }
  }

  for (let index = 0; index < flags.length; index += 1) {
    flags[index] = (flags[index] ?? 0) & 0x24;
  }

  return {
    provinces,
    flagsByProvinceId: flagsRecordByProvinceId(provinces, flags),
    selectedProvinceId: selectedProvince.id,
    localRequirement,
    initialSurplusSoldiers,
    scratchSurplusSoldiers,
    rememberedTargetProvinceId,
    rememberedTargetSoldiers
  };
}

export function runC64CbaronL6DFAFallback(
  input: C64CbaronL6DFAFallbackInput
): C64CbaronL6DFAFallbackResult {
  require24Bit(input.surplusSoldiers, 'C64 L6DFA surplus soldiers');
  const provincesById = requireUniqueProvinces(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  const provinceIndexById = createProvinceIndexById(input.provinces);
  const flags = input.provinces.map((province) => input.flagsByProvinceId[province.id] ?? 0);
  const provinces = input.provinces.map((province) => ({ ...province }));

  for (let index = 0; index < flags.length; index += 1) {
    flags[index] = (flags[index] ?? 0) & 0x2f;
  }

  const componentProvinces = input.provinces
    .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_COMPONENT) !== 0)
    .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right));

  for (const province of componentProvinces) {
    if (province.ownerId !== input.activeOwnerId) {
      throw new Error(`C64 L6DFA $01 marker on non-active province ${province.id}.`);
    }
    const index = requireProvinceIndex(provinceIndexById, province.id);
    flags[index] = (flags[index] ?? 0) | C64_FLAG_TARGET_WORKLIST;
  }

  c64MainL514AFrontierFilter(
    input.provinces,
    input.activeOwnerId,
    flags,
    provincesById,
    provinceIndexById
  );

  const distributedSoldiers = distributeC64L4F49Soldiers(
    provinces,
    flags,
    input.surplusSoldiers,
    provinceIndexById
  );

  return {
    provinces,
    flagsByProvinceId: flagsRecordByProvinceId(input.provinces, flags),
    distributedSoldiers
  };
}

export function runC64CbaronL6A64Cleanup(
  input: C64CbaronL6A64CleanupInput
): C64CbaronL6A64CleanupResult {
  requireByte(input.ca61, 'C64 L6A64 $CA61 pressure low byte');
  requireByte(input.ca62, 'C64 L6A64 $CA62 pressure high byte');
  const provincesById = requireUniqueProvinces(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  const provinceIndexById = createProvinceIndexById(input.provinces);
  let provinces = input.provinces.map((province) => ({ ...province }));
  let flags = flagsFromRecord(input.provinces, input.flagsByProvinceId);
  const cleanupRequirementsByProvinceId: Record<ProvinceId, number> = {};
  let rememberedTargetProvinceId = input.rememberedTargetProvinceId;
  let rememberedTargetSoldiers = 0;

  for (let index = provinces.length - 1; index >= 0; index -= 1) {
    const province = provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 L6A64 cleanup province at index ${index}.`);
    }
    if (((flags[index] ?? 0) & C64_FLAG_CLEANUP) === 0 || province.soldiers >= 2) {
      continue;
    }

    const requirement = c64CbaronRequiredStrength({
      provinces,
      activeOwnerId: input.activeOwnerId,
      ownerSlots: input.ownerSlots,
      worklistProvinceIds: [province.id],
      config: input.config
    });
    cleanupRequirementsByProvinceId[province.id] = requirement.totalRequiredSoldiers;
    provinces = updateProvinceById(provinces, provinceIndexById, province.id, (current) => ({
      ...current,
      ownerId: C64_L6A64_TEMP_OWNER_ID,
      soldiers: requirement.totalRequiredSoldiers
    }));
  }

  for (;;) {
    flags = flags.map((flag) => flag & 0x24);
    const selected = provinces
      .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_SURPLUS_MARKER) !== 0)
      .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right))[0];
    if (selected === undefined) {
      break;
    }

    const redistributed = runC64CbaronL6AC3SurplusRedistribution({
      provinces,
      activeOwnerId: input.activeOwnerId,
      ownerSlots: input.ownerSlots,
      flagsByProvinceId: flagsRecordByProvinceId(provinces, flags),
      rememberedTargetProvinceId,
      ca61: input.ca61,
      ca62: input.ca62,
      config: input.config
    });
    provinces = redistributed.provinces.map((province) => ({ ...province }));
    flags = flagsFromRecord(provinces, redistributed.flagsByProvinceId);
    rememberedTargetProvinceId = redistributed.rememberedTargetProvinceId;
    if (redistributed.rememberedTargetSoldiers !== 0) {
      rememberedTargetSoldiers = redistributed.rememberedTargetSoldiers;
    }
  }

  for (let index = provinces.length - 1; index >= 0; index -= 1) {
    const province = provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 L6A64 final cleanup province at index ${index}.`);
    }
    if (((flags[index] ?? 0) & C64_FLAG_CLEANUP) === 0) {
      continue;
    }
    provinces = updateProvinceById(provinces, provinceIndexById, province.id, (current) => ({
      ...current,
      ownerId: input.activeOwnerId,
      soldiers: 1
    }));
  }

  return {
    provinces,
    flagsByProvinceId: flagsRecordByProvinceId(provinces, flags),
    cleanupRequirementsByProvinceId,
    rememberedTargetProvinceId,
    rememberedTargetSoldiers
  };
}

export function runC64CbaronL6207FortCompensation(
  input: C64CbaronL6207FortCompensationInput
): C64CbaronL6207FortCompensationResult {
  if (!Number.isInteger(input.money) || input.money < 0) {
    throw new Error(`C64 L6207 active money must be a non-negative integer, got ${input.money}.`);
  }
  const provincesById = requireUniqueProvinces(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  requireProvince(provincesById, input.activeHomeProvinceId);
  const provinceIndexById = createProvinceIndexById(input.provinces);
  const flags = flagsFromRecord(input.provinces, input.flagsByProvinceId);
  let selectedProvinceId: ProvinceId | null = null;
  let strengthReduction = 0;
  let upgradeCost = 0;

  const candidates = input.provinces
    .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_TARGET_WORKLIST) !== 0)
    .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right));

  for (const province of candidates) {
    const provinceIndex = requireProvinceIndex(provinceIndexById, province.id);
    if (((flags[provinceIndex] ?? 0) & 0x02) !== 0) {
      continue;
    }
    if (province.ownerId !== input.activeOwnerId) {
      throw new Error(`C64 L6207 marked province ${province.id} is not active-owned.`);
    }

    const currentFortificationIndex = fortificationIndex(province.fortificationLevel);
    const maxFortificationLevel = province.id === input.activeHomeProvinceId
      ? input.maxHomeFortificationLevel
      : input.maxProvinceFortificationLevel;
    const maxFortificationIndex = fortificationIndex(maxFortificationLevel);
    if (currentFortificationIndex >= maxFortificationIndex) {
      continue;
    }

    const candidateUpgradeCost = c64FortificationUpgradeCost(province.fortificationLevel);
    if (input.money < candidateUpgradeCost) {
      continue;
    }

    const before = c64CbaronRequiredStrength({
      provinces: input.provinces,
      activeOwnerId: input.activeOwnerId,
      ownerSlots: input.ownerSlots,
      worklistProvinceIds: [province.id],
      config: input.config
    }).totalRequiredSoldiers;
    const upgradedProvinces = updateProvinceById(
      input.provinces,
      provinceIndexById,
      province.id,
      (current) => ({
        ...current,
        fortificationLevel: fortificationLevelAtIndex(currentFortificationIndex + 1)
      })
    );
    const after = c64CbaronRequiredStrength({
      provinces: upgradedProvinces,
      activeOwnerId: input.activeOwnerId,
      ownerSlots: input.ownerSlots,
      worklistProvinceIds: [province.id],
      config: input.config
    }).totalRequiredSoldiers;
    const candidateReduction = subtract24Bit(before, after);
    if (selectedProvinceId !== null && candidateReduction < strengthReduction) {
      continue;
    }

    selectedProvinceId = province.id;
    strengthReduction = candidateReduction;
    upgradeCost = candidateUpgradeCost;
  }

  return {
    selectedProvinceId,
    strengthReduction,
    upgradeCost
  };
}

function c64L6C49PlacementScore(
  stagingProvince: ProvinceState,
  target: ProvinceState,
  targetNeed: number,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  placementClass: number,
  activeOwnerId: PlayerId
): number {
  require24Bit(targetNeed, `C64 L6C49 target need for ${target.id}`);
  if (targetNeed < 1) {
    throw new Error(`C64 L6C49 target need for ${target.id} must be positive.`);
  }
  requireClass(placementClass, `C64 L6C49 connectivity class for ${target.id}`);

  const nonActiveNeighbours = stagingProvince.neighbours
    .map((provinceId) => requireProvince(provincesById, provinceId))
    .filter((province) => province.ownerId !== activeOwnerId);
  const neighbourCount = nonActiveNeighbours.length;
  const neighbourVillages = nonActiveNeighbours.reduce(
    (total, province) => total + province.villages,
    0
  );
  const raw = neighbourVillages * neighbourCount;
  const multiplier = C64_L6DF3_CLASS_MULTIPLIER[placementClass];
  if (multiplier === undefined) {
    throw new Error(`Missing C64 L6DF3 class multiplier for ${placementClass}.`);
  }
  const weightedLow16 = (raw * 2 * multiplier) & 0xffff;
  return Math.floor((weightedLow16 * 0x10000) / targetNeed) % C64_24_BIT_MODULO;
}

export function runC64CbaronL6C49Placement(
  input: C64CbaronL6C49PlacementInput
): C64CbaronL6C49PlacementResult {
  require24Bit(input.surplusSoldiers, 'C64 L6C49 surplus soldiers');
  const provincesById = requireUniqueProvinces(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  const provinceIndexById = createProvinceIndexById(input.provinces);
  const flags = input.provinces.map((province) => input.flagsByProvinceId[province.id] ?? 0);
  const provinces = input.provinces.map((province) => ({ ...province }));
  let selectedTargetProvinceId: ProvinceId | null = null;
  let selectedStagingProvinceId: ProvinceId | null = null;
  let selectedAmount = 0;
  let selectedScore = 0;

  const targets = input.provinces
    .filter((_province, index) => ((flags[index] ?? 0) & C64_FLAG_PLACEMENT_TARGET) !== 0)
    .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right));

  for (const target of targets) {
    const targetNeedBeforeSupport = c64L6484TargetNeed(target, input);
    const targetNeed = targetNeedBeforeSupport - adjacentActiveMobileSupport(
      target,
      input,
      provincesById
    );
    if (targetNeed < 1 || targetNeed > input.surplusSoldiers) {
      continue;
    }

    const overrideClass = input.connectivityClassOverrideByTargetId?.[target.id];
    const placementClass = overrideClass ?? c64CbaronConnectivityClass({
      provinces: input.provinces,
      provinceIndexById,
      flagsByProvinceIndex: flags,
      activeOwnerId: input.activeOwnerId,
      targetProvinceId: target.id
    });
    requireClass(placementClass, `C64 L6C49 connectivity class for ${target.id}`);

    const stagingCandidates = target.neighbours
      .map((provinceId) => requireProvince(provincesById, provinceId))
      .filter((province) => {
        const index = requireProvinceIndex(provinceIndexById, province.id);
        return province.ownerId === input.activeOwnerId &&
          ((flags[index] ?? 0) & C64_FLAG_COMPONENT) !== 0;
      })
      .sort((left, right) => provinceOrderDescending(provinceIndexById, left, right));

    for (const stagingProvince of stagingCandidates) {
      const score = c64L6C49PlacementScore(
        stagingProvince,
        target,
        targetNeed,
        provincesById,
        placementClass,
        input.activeOwnerId
      );
      if (selectedStagingProvinceId !== null && score < selectedScore) {
        continue;
      }
      selectedTargetProvinceId = target.id;
      selectedStagingProvinceId = stagingProvince.id;
      selectedAmount = targetNeed;
      selectedScore = score;
    }
  }

  if (selectedTargetProvinceId === null || selectedStagingProvinceId === null) {
    return {
      provinces,
      flagsByProvinceId: flagsRecordByProvinceId(input.provinces, flags),
      selectedTargetProvinceId: null,
      selectedStagingProvinceId: null,
      selectedAmount: 0,
      remainingSurplusSoldiers: input.surplusSoldiers,
      rememberedTargetProvinceId: input.rememberedTargetProvinceId,
      rememberedTargetSoldiers: 0
    };
  }

  const selectedStagingIndex = requireProvinceIndex(provinceIndexById, selectedStagingProvinceId);
  const selectedTargetIndex = requireProvinceIndex(provinceIndexById, selectedTargetProvinceId);
  const selectedStaging = provinces[selectedStagingIndex];
  const selectedTarget = provinces[selectedTargetIndex];
  if (selectedStaging === undefined || selectedTarget === undefined) {
    throw new Error('C64 L6C49 selected missing province.');
  }
  provinces[selectedStagingIndex] = {
    ...selectedStaging,
    soldiers: add24Bit(selectedStaging.soldiers, selectedAmount)
  };
  flags[selectedTargetIndex] = (flags[selectedTargetIndex] ?? 0) & ~C64_FLAG_PLACEMENT_TARGET;

  return {
    provinces,
    flagsByProvinceId: flagsRecordByProvinceId(input.provinces, flags),
    selectedTargetProvinceId,
    selectedStagingProvinceId,
    selectedAmount,
    remainingSurplusSoldiers: input.surplusSoldiers - selectedAmount,
    rememberedTargetProvinceId: input.rememberedTargetProvinceId ?? selectedTargetProvinceId,
    rememberedTargetSoldiers: input.rememberedTargetProvinceId === null ? selectedTarget.soldiers : 0
  };
}

function runSurplusMovement(
  context: MovementContext,
  frontierProvinceIds: ReadonlyArray<ProvinceId>,
  requirementByProvinceId: ReadonlyMap<ProvinceId, number>,
  surplus: number
): void {
  for (const provinceId of frontierProvinceIds) {
    const requiredSoldiers = requirementByProvinceId.get(provinceId);
    if (requiredSoldiers === undefined) {
      throw new Error(`Missing C64 movement requirement for ${provinceId}.`);
    }
    replaceProvince(context, provinceId, (province) => ({
      ...province,
      soldiers: add24Bit(province.soldiers, requiredSoldiers)
    }));
  }

  const stagingProvinceId = frontierProvinceIds[frontierProvinceIds.length - 1];
  if (stagingProvinceId === undefined) {
    throw new Error('C64 surplus movement requires a frontier staging province.');
  }
  const stagingIndex = requireProvinceIndex(context.provinceIndexById, stagingProvinceId);
  replaceProvince(context, stagingProvinceId, (province) => ({
    ...province,
    soldiers: add24Bit(province.soldiers, surplus)
  }));
  context.flags[stagingIndex] |= C64_FLAG_SURPLUS_MARKER;
}

function runUnderpoweredMovement(
  context: MovementContext,
  componentProvinceIds: ReadonlyArray<ProvinceId>,
  frontierProvinceIds: ReadonlyArray<ProvinceId>
): void {
  if (frontierProvinceIds.length === 1) {
    const frontierProvinceId = frontierProvinceIds[0];
    if (frontierProvinceId === undefined) {
      throw new Error('C64 underpowered single-front movement requires a frontier province.');
    }
    if (frontierProvinceId === context.input.activeHomeProvinceId) {
      replaceProvince(context, frontierProvinceId, (province) => ({
        ...province,
        soldiers: add24Bit(
          province.soldiers,
          add24Bit(context.pulledMobileSoldiers, context.money)
        )
      }));
      context.money = 0;
      return;
    }

    const playerSlotMatch = /^p(\d+)$/.exec(context.input.activeOwnerId);
    if (playerSlotMatch === null) {
      throw new Error(`Invalid C64 player id ${context.input.activeOwnerId}.`);
    }
    const playerSlotProvinceIndex = Number(playerSlotMatch[1]) - 1;
    const playerSlotProvince = context.provinces[playerSlotProvinceIndex];
    if (playerSlotProvince === undefined) {
      throw new Error(
        `Missing C64 player-slot province for ${context.input.activeOwnerId}.`
      );
    }
    if (((context.flags[playerSlotProvinceIndex] ?? 0) & 0x02) !== 0) {
      const currentFortificationIndex = fortificationIndex(
        playerSlotProvince.fortificationLevel
      );
      if (currentFortificationIndex < 1) {
        throw new Error(
          `C64 player-slot province ${playerSlotProvince.id} has an upgrade flag at level 0.`
        );
      }
      const previousLevel = fortificationLevelAtIndex(currentFortificationIndex - 1);
      context.money += c64FortificationUpgradeCost(previousLevel);
      replaceProvince(context, playerSlotProvince.id, (province) => ({
        ...province,
        fortificationLevel: previousLevel,
        upgradedFortificationThisTurn: requireProvince(
          context.provincesById,
          province.id
        ).upgradedFortificationThisTurn
      }));
      context.flags[playerSlotProvinceIndex] =
        (context.flags[playerSlotProvinceIndex] ?? 0) & 0xfd;
      let upgradeIndex = -1;
      for (let index = context.fortificationUpgrades.length - 1; index >= 0; index -= 1) {
        if (context.fortificationUpgrades[index]?.provinceId === playerSlotProvince.id) {
          upgradeIndex = index;
          break;
        }
      }
      if (upgradeIndex === -1) {
        throw new Error(
          `Missing C64 player-slot fortification upgrade for ${playerSlotProvince.id}.`
        );
      }
      context.fortificationUpgrades.splice(upgradeIndex, 1);
    }
    replaceProvince(context, frontierProvinceId, (province) => ({
      ...province,
      soldiers: add24Bit(province.soldiers, context.pulledMobileSoldiers)
    }));
    return;
  }

  if (runL5EA4MultiFrontUnderpoweredMovement(context, componentProvinceIds, frontierProvinceIds)) {
    return;
  }

  const homeInComponent = componentProvinceIds.includes(context.input.activeHomeProvinceId);
  const stagingProvinceId = homeInComponent
    ? context.input.activeHomeProvinceId
    : frontierProvinceIds[frontierProvinceIds.length - 1];
  if (stagingProvinceId === undefined) {
    throw new Error('C64 underpowered movement requires a staging province.');
  }
  replaceProvince(context, stagingProvinceId, (province) => ({
    ...province,
    soldiers: add24Bit(province.soldiers, context.pulledMobileSoldiers)
  }));

  for (const provinceId of frontierProvinceIds) {
    if (provinceId === stagingProvinceId) {
      continue;
    }
    const index = requireProvinceIndex(context.provinceIndexById, provinceId);
    context.flags[index] |= C64_FLAG_CLEANUP;
  }
}

interface RequirementResult {
  readonly defensiveRequirement: number;
  readonly requirementByProvinceId: ReadonlyMap<ProvinceId, number>;
}

interface L5EA4CandidateSelection {
  readonly cleanupProvinceId: ProvinceId;
  readonly remainingFrontierProvinceIds: ReadonlyArray<ProvinceId>;
  readonly requirement: RequirementResult;
}

function c64MovementRequirement(
  context: MovementContext,
  frontierProvinceIds: ReadonlyArray<ProvinceId>
): RequirementResult {
  const requiredStrength = c64CbaronRequiredStrength({
    provinces: context.provinces,
    activeOwnerId: context.input.activeOwnerId,
    ownerSlots: context.input.ownerSlots,
    worklistProvinceIds: frontierProvinceIds,
    config: context.input.config
  });

  return {
    defensiveRequirement: requiredStrength.totalRequiredSoldiers,
    requirementByProvinceId: new Map(
      requiredStrength.provinceRequirements.map((requirement) => [
        requirement.provinceId,
        requirement.requiredSoldiers
      ])
    )
  };
}

function selectL5EA4CleanupCandidate(
  context: MovementContext,
  frontierProvinceIds: ReadonlyArray<ProvinceId>
): L5EA4CandidateSelection | null {
  const candidates = frontierProvinceIds
    .filter((provinceId) => provinceId !== context.input.activeHomeProvinceId)
    .map((provinceId) => requireProvince(context.provincesById, provinceId))
    .sort((left, right) => provinceOrderDescending(context.provinceIndexById, left, right));

  let selected: L5EA4CandidateSelection | null = null;
  for (const candidate of candidates) {
    const remainingFrontierProvinceIds = frontierProvinceIds.filter(
      (provinceId) => provinceId !== candidate.id
    );
    if (remainingFrontierProvinceIds.length < 1) {
      continue;
    }
    const requirement = c64MovementRequirement(context, remainingFrontierProvinceIds);
    if (
      selected !== null &&
      requirement.defensiveRequirement > selected.requirement.defensiveRequirement
    ) {
      continue;
    }

    selected = {
      cleanupProvinceId: candidate.id,
      remainingFrontierProvinceIds,
      requirement
    };
  }

  return selected;
}

function runL5EA4MultiFrontUnderpoweredMovement(
  context: MovementContext,
  componentProvinceIds: ReadonlyArray<ProvinceId>,
  frontierProvinceIds: ReadonlyArray<ProvinceId>
): boolean {
  const selection = selectL5EA4CleanupCandidate(context, frontierProvinceIds);
  if (selection === null) {
    return false;
  }

  const cleanupIndex = requireProvinceIndex(
    context.provinceIndexById,
    selection.cleanupProvinceId
  );
  context.flags[cleanupIndex] = (context.flags[cleanupIndex] ?? 0) | C64_FLAG_CLEANUP;

  if (context.pulledMobileSoldiers >= selection.requirement.defensiveRequirement) {
    runSurplusMovement(
      context,
      selection.remainingFrontierProvinceIds,
      selection.requirement.requirementByProvinceId,
      context.pulledMobileSoldiers - selection.requirement.defensiveRequirement
    );
    return true;
  }

  if (
    selection.remainingFrontierProvinceIds.length === 1 &&
    selection.remainingFrontierProvinceIds[0] === context.input.activeHomeProvinceId
  ) {
    runUnderpoweredMovement(
      context,
      componentProvinceIds,
      selection.remainingFrontierProvinceIds
    );
  } else {
    resolveComponentMovement(
      context,
      componentProvinceIds,
      selection.remainingFrontierProvinceIds,
      selection.requirement
    );
  }
  return true;
}

function fortCompensationFlagsByProvinceId(
  context: MovementContext,
  frontierProvinceIds: ReadonlyArray<ProvinceId>
): Readonly<Record<ProvinceId, number>> {
  const flags = Object.fromEntries(
    Object.entries(flagsByProvinceId(context)).map(([provinceId, flag]) => [
      provinceId,
      flag & ~C64_FLAG_TARGET_WORKLIST
    ])
  );
  for (const provinceId of frontierProvinceIds) {
    flags[provinceId] = (flags[provinceId] ?? 0) | C64_FLAG_TARGET_WORKLIST;
  }
  return flags;
}

function applyFortificationCompensation(
  context: MovementContext,
  frontierProvinceIds: ReadonlyArray<ProvinceId>,
  requirement: RequirementResult
): RequirementResult {
  let currentRequirement = requirement;

  while (context.pulledMobileSoldiers < currentRequirement.defensiveRequirement) {
    const compensation = runC64CbaronL6207FortCompensation({
      provinces: context.provinces,
      activeOwnerId: context.input.activeOwnerId,
      activeHomeProvinceId: context.input.activeHomeProvinceId,
      ownerSlots: context.input.ownerSlots,
      flagsByProvinceId: fortCompensationFlagsByProvinceId(context, frontierProvinceIds),
      money: context.money,
      maxHomeFortificationLevel: context.input.maxHomeFortificationLevel,
      maxProvinceFortificationLevel: context.input.maxProvinceFortificationLevel,
      config: context.input.config
    });
    const provinceId = compensation.selectedProvinceId;
    if (provinceId === null) {
      return currentRequirement;
    }

    const province = requireProvince(
      new Map(context.provinces.map((candidate) => [candidate.id, candidate])),
      provinceId
    );
    const nextLevel = fortificationLevelAtIndex(fortificationIndex(province.fortificationLevel) + 1);
    context.money -= compensation.upgradeCost;
    replaceProvince(context, provinceId, (candidate) => ({
      ...candidate,
      fortificationLevel: nextLevel,
      upgradedFortificationThisTurn: true
    }));
    const provinceIndex = requireProvinceIndex(context.provinceIndexById, provinceId);
    context.flags[provinceIndex] = (context.flags[provinceIndex] ?? 0) | 0x02;
    context.fortificationUpgrades.push({
      provinceId,
      level: nextLevel,
      cost: compensation.upgradeCost
    });
    currentRequirement = c64MovementRequirement(context, frontierProvinceIds);
  }

  return currentRequirement;
}

function rollbackFortificationCompensation(
  context: MovementContext,
  moneyBeforeCompensation: number,
  upgradeStartIndex: number
): void {
  const rolledBackUpgrades = context.fortificationUpgrades.slice(upgradeStartIndex);
  for (const upgrade of rolledBackUpgrades) {
    const original = requireProvince(context.provincesById, upgrade.provinceId);
    replaceProvince(context, upgrade.provinceId, (province) => ({
      ...province,
      fortificationLevel: original.fortificationLevel,
      upgradedFortificationThisTurn: original.upgradedFortificationThisTurn
    }));
    const provinceIndex = requireProvinceIndex(
      context.provinceIndexById,
      upgrade.provinceId
    );
    context.flags[provinceIndex] = (context.flags[provinceIndex] ?? 0) & 0xfd;
  }
  context.money = moneyBeforeCompensation;
  context.fortificationUpgrades = context.fortificationUpgrades.slice(0, upgradeStartIndex);
}

function applyMoneyCompensation(
  context: MovementContext,
  componentProvinceIds: ReadonlyArray<ProvinceId>,
  frontierProvinceIds: ReadonlyArray<ProvinceId>,
  requirement: RequirementResult
): boolean {
  if (!componentProvinceIds.includes(context.input.activeHomeProvinceId)) {
    return false;
  }

  const shortage = requirement.defensiveRequirement - context.pulledMobileSoldiers;
  if (context.money < shortage) {
    return false;
  }
  const homeRequirement = c64MovementRequirement(context, [context.input.activeHomeProvinceId]);
  if (homeRequirement.defensiveRequirement < shortage) {
    return false;
  }

  context.money -= shortage;
  runSurplusMovement(context, frontierProvinceIds, requirement.requirementByProvinceId, 0);
  return true;
}

function resolveComponentMovement(
  context: MovementContext,
  componentProvinceIds: ReadonlyArray<ProvinceId>,
  frontierProvinceIds: ReadonlyArray<ProvinceId>,
  initialRequirement: RequirementResult
): void {
  context.defensiveRequirement = initialRequirement.defensiveRequirement;
  if (context.pulledMobileSoldiers >= initialRequirement.defensiveRequirement) {
    runSurplusMovement(
      context,
      frontierProvinceIds,
      initialRequirement.requirementByProvinceId,
      context.pulledMobileSoldiers - initialRequirement.defensiveRequirement
    );
    return;
  }

  const lateCompensationOrder = c64CbaronL5C6E(
    context.input.turnNumber,
    context.provinces.length
  ) !== 0;
  if (
    !lateCompensationOrder &&
    applyMoneyCompensation(
      context,
      componentProvinceIds,
      frontierProvinceIds,
      initialRequirement
    )
  ) {
    return;
  }

  const moneyBeforeFortificationCompensation = context.money;
  const upgradeStartIndex = context.fortificationUpgrades.length;
  const requirement = applyFortificationCompensation(
    context,
    frontierProvinceIds,
    initialRequirement
  );
  context.defensiveRequirement = requirement.defensiveRequirement;

  if (context.pulledMobileSoldiers >= requirement.defensiveRequirement) {
    runSurplusMovement(
      context,
      frontierProvinceIds,
      requirement.requirementByProvinceId,
      context.pulledMobileSoldiers - requirement.defensiveRequirement
    );
    return;
  }

  if (
    lateCompensationOrder &&
    applyMoneyCompensation(
      context,
      componentProvinceIds,
      frontierProvinceIds,
      requirement
    )
  ) {
    return;
  }

  if (frontierProvinceIds.length > 1) {
    rollbackFortificationCompensation(
      context,
      moneyBeforeFortificationCompensation,
      upgradeStartIndex
    );
    context.defensiveRequirement = initialRequirement.defensiveRequirement;
  }
  runUnderpoweredMovement(context, componentProvinceIds, frontierProvinceIds);
}

export function runC64CbaronMovement(
  input: C64CbaronMovementInput
): C64CbaronMovementResult {
  requireByte(input.ca61, 'C64 movement $CA61 pressure low byte');
  requireByte(input.ca62, 'C64 movement $CA62 pressure high byte');
  const context = createContext(input);
  const components = activeComponents(context);
  if (components.length === 0) {
    return {
      provinces: context.provinces,
      finalMoney: context.money,
      fortificationUpgrades: context.fortificationUpgrades,
      pulledMobileSoldiers: 0,
      defensiveRequirement: 0,
      rememberedTargetProvinceId: input.rememberedTargetProvinceId,
      rememberedTargetSoldiers: 0,
      flagsByProvinceId: flagsByProvinceId(context)
    };
  }

  for (const componentProvinceIds of components) {
    const frontierProvinceIds = frontierComponentProvinceIds(context, componentProvinceIds);
    if (frontierProvinceIds.length < 1) {
      context.pulledMobileSoldiers = pullMobileSoldiers(context, componentProvinceIds);
      context.defensiveRequirement = 0;
      continue;
    }

    context.pulledMobileSoldiers = pullMobileSoldiers(context, componentProvinceIds);
    const initialRequirement = c64MovementRequirement(context, frontierProvinceIds);
    resolveComponentMovement(
      context,
      componentProvinceIds,
      frontierProvinceIds,
      initialRequirement
    );
  }

  const cleanup = runC64CbaronL6A64Cleanup({
    provinces: context.provinces,
    activeOwnerId: input.activeOwnerId,
    ownerSlots: input.ownerSlots,
    flagsByProvinceId: flagsByProvinceId(context),
    rememberedTargetProvinceId: context.rememberedTargetProvinceId,
    ca61: input.ca61,
    ca62: input.ca62,
    config: input.config
  });
  context.provinces = cleanup.provinces.map((province) => ({ ...province }));
  for (let index = 0; index < context.flags.length; index += 1) {
    const province = context.provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 movement cleanup province at index ${index}.`);
    }
    context.flags[index] = cleanup.flagsByProvinceId[province.id] ?? 0;
  }
  context.rememberedTargetProvinceId = cleanup.rememberedTargetProvinceId;
  if (cleanup.rememberedTargetSoldiers !== 0) {
    context.rememberedTargetSoldiers = cleanup.rememberedTargetSoldiers;
  }

  return {
    provinces: context.provinces,
    finalMoney: context.money,
    fortificationUpgrades: context.fortificationUpgrades,
    pulledMobileSoldiers: context.pulledMobileSoldiers,
    defensiveRequirement: context.defensiveRequirement,
    rememberedTargetProvinceId: context.rememberedTargetProvinceId,
    rememberedTargetSoldiers: context.rememberedTargetSoldiers,
    flagsByProvinceId: flagsByProvinceId(context)
  };
}
