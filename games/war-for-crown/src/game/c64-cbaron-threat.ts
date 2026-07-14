import { c64CbaronThreatRequirement } from './c64-arithmetic';
import { c64CombatSetupForProvince } from './c64-battle';
import { isRoyalistOwner, ROYALIST_OWNER_ID } from './owners';
import type { OwnerId } from './owners';
import type { GameConfig, PlayerId, ProvinceId, ProvinceState } from './types';

const C64_MAX_24_BIT = 0xffffff;
const C64_24_BIT_MODULO = 0x1000000;
const C64_GARRISON_SOLDIERS = 1;

export interface C64CbaronOwnerSlot {
  readonly ownerId: OwnerId;
  readonly isComputer: boolean;
}

export interface C64CbaronProvinceRequirement {
  readonly provinceId: ProvinceId;
  readonly strongestOwnerSlot: number;
  readonly strongestOwnerId: OwnerId;
  readonly strongestAdjacentMobileSoldiers: number;
  readonly requiredSoldiers: number;
}

export interface C64CbaronRequiredStrengthInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>;
  readonly worklistProvinceIds: ReadonlyArray<ProvinceId>;
  readonly config: Pick<
    GameConfig,
    'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'
  >;
}

export interface C64CbaronRequiredStrengthResult {
  readonly totalRequiredSoldiers: number;
  readonly provinceRequirements: ReadonlyArray<C64CbaronProvinceRequirement>;
}

function requireC64Soldiers(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > C64_MAX_24_BIT) {
    throw new Error(`${label} must be a C64 24-bit non-negative integer, got ${value}.`);
  }
}

function c64Add24(left: number, right: number): number {
  requireC64Soldiers(left, 'C64 24-bit add left operand');
  requireC64Soldiers(right, 'C64 24-bit add right operand');

  return (left + right) % C64_24_BIT_MODULO;
}

function requireUniqueProvinceIds(provinces: ReadonlyArray<ProvinceState>): ReadonlyMap<ProvinceId, ProvinceState> {
  const byId = new Map<ProvinceId, ProvinceState>();
  for (const province of provinces) {
    if (byId.has(province.id)) {
      throw new Error(`Duplicate C64 province id ${province.id}.`);
    }
    requireC64Soldiers(province.soldiers, `Province ${province.id} soldiers`);
    byId.set(province.id, province);
  }
  return byId;
}

function requireProvince(
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  provinceId: ProvinceId
): ProvinceState {
  const province = provincesById.get(provinceId);
  if (province === undefined) {
    throw new Error(`Unknown C64 cbaron province ${provinceId}.`);
  }
  return province;
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

function validateOwnerSlots(
  ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>,
  activeOwnerId: PlayerId
): void {
  if (ownerSlots.length < 2) {
    throw new Error('C64 cbaron owner slots must include royalists and at least one player.');
  }

  const royalistSlot = ownerSlots[0];
  if (royalistSlot === undefined || royalistSlot.ownerId !== ROYALIST_OWNER_ID) {
    throw new Error('C64 cbaron owner slot 0 must be the royalist owner.');
  }

  const seenOwners = new Set<OwnerId>();
  for (const slot of ownerSlots) {
    if (seenOwners.has(slot.ownerId)) {
      throw new Error(`Duplicate C64 cbaron owner slot for ${slot.ownerId}.`);
    }
    seenOwners.add(slot.ownerId);
  }

  if (!seenOwners.has(activeOwnerId)) {
    throw new Error(`Missing active C64 cbaron owner slot for ${activeOwnerId}.`);
  }
}

function validateWorklist(
  worklistProvinceIds: ReadonlyArray<ProvinceId>,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): ReadonlySet<ProvinceId> {
  const worklist = new Set<ProvinceId>();
  for (const provinceId of worklistProvinceIds) {
    requireProvince(provincesById, provinceId);
    if (worklist.has(provinceId)) {
      throw new Error(`Duplicate C64 cbaron worklist province ${provinceId}.`);
    }
    worklist.add(provinceId);
  }
  return worklist;
}

function provinceCountForOwner(
  provinces: ReadonlyArray<ProvinceState>,
  ownerId: OwnerId
): number {
  return provinces.filter((province) => province.ownerId === ownerId).length;
}

function mobileSoldiers(province: ProvinceState): number {
  return Math.max(0, province.soldiers - C64_GARRISON_SOLDIERS);
}

function adjacentOwnedProvinces(
  province: ProvinceState,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  ownerId: OwnerId
): ReadonlyArray<ProvinceState> {
  return province.neighbours
    .map((neighbourId) => requireProvince(provincesById, neighbourId))
    .filter((neighbour) => neighbour.ownerId === ownerId);
}

function sumAdjacentMobileSoldiers(
  province: ProvinceState,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  ownerId: OwnerId
): number {
  return adjacentOwnedProvinces(province, provincesById, ownerId).reduce(
    (total, neighbour) => c64Add24(total, mobileSoldiers(neighbour)),
    0
  );
}

function strongestSingleRoyalistMobileSoldiers(
  province: ProvinceState,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>
): number {
  const strongestProvinceSoldiers = adjacentOwnedProvinces(
    province,
    provincesById,
    ROYALIST_OWNER_ID
  ).reduce((strongest, neighbour) => Math.max(strongest, neighbour.soldiers), 0);
  const mobile = Math.max(0, strongestProvinceSoldiers - C64_GARRISON_SOLDIERS);
  requireC64Soldiers(mobile, `C64 cbaron royalist single-source mobile soldiers for ${province.id}`);
  return mobile;
}

function adjacentMobileThreatForOwner(
  province: ProvinceState,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  ownerId: OwnerId,
  config: Pick<GameConfig, 'royalistAttitude' | 'royalistAttackCooperation'>
): number {
  if (!isRoyalistOwner(ownerId)) {
    return sumAdjacentMobileSoldiers(province, provincesById, ownerId);
  }

  if (config.royalistAttitude !== 'hostile') {
    return 0;
  }

  if (config.royalistAttackCooperation === 'single-source') {
    return strongestSingleRoyalistMobileSoldiers(province, provincesById);
  }

  return sumAdjacentMobileSoldiers(province, provincesById, ROYALIST_OWNER_ID);
}

function c64ComputerOwnerThreatPass(value: number): number {
  requireC64Soldiers(value, 'C64 cbaron computer-owner threat input');
  return value;
}

function strongestAdjacentThreat(
  province: ProvinceState,
  provinces: ReadonlyArray<ProvinceState>,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  activeOwnerId: PlayerId,
  ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>,
  config: Pick<GameConfig, 'royalistAttitude' | 'royalistAttackCooperation'>
): Omit<C64CbaronProvinceRequirement, 'provinceId' | 'requiredSoldiers'> {
  let strongestOwnerSlot = 0;
  let strongestOwnerId: OwnerId = ROYALIST_OWNER_ID;
  let strongestAdjacentMobileSoldiers = 0;

  for (let ownerSlotIndex = 0; ownerSlotIndex < ownerSlots.length; ownerSlotIndex += 1) {
    const ownerSlot = ownerSlots[ownerSlotIndex];
    if (ownerSlot === undefined) {
      throw new Error(`Missing C64 cbaron owner slot ${ownerSlotIndex}.`);
    }

    if (ownerSlot.ownerId === activeOwnerId) {
      continue;
    }

    if (provinceCountForOwner(provinces, ownerSlot.ownerId) === 0) {
      continue;
    }

    const rawThreat = adjacentMobileThreatForOwner(
      province,
      provincesById,
      ownerSlot.ownerId,
      config
    );
    const threat = ownerSlot.isComputer
      ? c64ComputerOwnerThreatPass(rawThreat)
      : rawThreat;

    if (threat >= strongestAdjacentMobileSoldiers) {
      strongestOwnerSlot = ownerSlotIndex;
      strongestOwnerId = ownerSlot.ownerId;
      strongestAdjacentMobileSoldiers = threat;
    }
  }

  return {
    strongestOwnerSlot,
    strongestOwnerId,
    strongestAdjacentMobileSoldiers
  };
}

function provinceRequirement(
  province: ProvinceState,
  provinces: ReadonlyArray<ProvinceState>,
  provincesById: ReadonlyMap<ProvinceId, ProvinceState>,
  activeOwnerId: PlayerId,
  ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>,
  config: Pick<
    GameConfig,
    'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'
  >
): C64CbaronProvinceRequirement {
  const strongest = strongestAdjacentThreat(
    province,
    provinces,
    provincesById,
    activeOwnerId,
    ownerSlots,
    config
  );
  const combatSetup = c64CombatSetupForProvince(province, config);
  const requiredSoldiers = c64CbaronThreatRequirement({
    attackerCombatPercent: combatSetup.attackerCombatPercent,
    defenderCombatPercent: combatSetup.defenderCombatPercent,
    strongestAdjacentMobileSoldiers: strongest.strongestAdjacentMobileSoldiers
  });

  return {
    provinceId: province.id,
    ...strongest,
    requiredSoldiers
  };
}

export function c64CbaronRequiredStrength(
  input: C64CbaronRequiredStrengthInput
): C64CbaronRequiredStrengthResult {
  const provincesById = requireUniqueProvinceIds(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  validateOwnerSlots(input.ownerSlots, input.activeOwnerId);
  const worklist = validateWorklist(input.worklistProvinceIds, provincesById);

  const provinceRequirements: C64CbaronProvinceRequirement[] = [];
  let totalRequiredSoldiers = 0;

  for (let index = input.provinces.length - 1; index >= 0; index -= 1) {
    const province = input.provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 cbaron province at index ${index}.`);
    }

    if (!worklist.has(province.id)) {
      continue;
    }

    const requirement = provinceRequirement(
      province,
      input.provinces,
      provincesById,
      input.activeOwnerId,
      input.ownerSlots,
      input.config
    );
    totalRequiredSoldiers = c64Add24(totalRequiredSoldiers, requirement.requiredSoldiers);
    provinceRequirements.push(requirement);
  }

  return {
    totalRequiredSoldiers,
    provinceRequirements
  };
}
