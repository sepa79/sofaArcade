import {
  C64_AI_DEFENDER_RETREAT_THRESHOLD,
  C64_BARON_ATTACK_THRESHOLD,
  c64BattleMeetsThreshold
} from './battle-ai';
import { c64CombatSetupForProvince } from './c64-battle';
import { c64CbaronConnectivityClass } from './c64-cbaron-connectivity';
import { c64CbaronRequiredStrength, type C64CbaronOwnerSlot } from './c64-cbaron-threat';
import { calculateC64ProvinceIncome } from './c64-economy';
import { isPlayerOwner, isRoyalistOwner, ROYALIST_OWNER_ID } from './owners';
import type { OwnerId } from './owners';
import type { GameConfig, PlayerId, ProvinceId, ProvinceState } from './types';

const C64_FLAG_LOCKED = 0x01;
const C64_FLAG_ACCEPTED_TARGET = 0x02;
const C64_FLAG_SOURCE = 0x10;
const C64_FLAG_ADJACENT = 0x80;
const C64_GARRISON_SOLDIERS = 1;
const C64_TARGET_TYPE_DEFAULT = 0xff;
const C64_TARGET_TYPE_CONTESTED = 0x80;
const C64_HOME_TARGET_SCORE_SCALE = 0x8000;
const C64_RANDOM_HOME_PRESSURE_THRESHOLD = 0x40;
const C64_24_BIT_MASK = 0xffffff;

export interface C64CbaronAttackPlayerSlot {
  readonly ownerId: PlayerId;
  readonly homeProvinceId: ProvinceId | null;
  readonly provinceCount: number;
}

export interface C64CbaronAttackInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly activeOwnerId: PlayerId;
  readonly activeMoney: number;
  readonly ownerSlots: ReadonlyArray<C64CbaronOwnerSlot>;
  readonly playerSlots: ReadonlyArray<C64CbaronAttackPlayerSlot>;
  readonly lockedProvinceIds: ReadonlyArray<ProvinceId>;
  readonly rngBytes: ReadonlyArray<number>;
  readonly config: Pick<
    GameConfig,
    'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'
  >;
}

export interface C64CbaronTargetScore {
  readonly provinceId: ProvinceId;
  readonly score: number;
  readonly strategicWeight: number;
  readonly targetSupportEstimate: number;
  readonly worklistThreat: number;
  readonly targetDebt: number;
}

export interface C64CbaronAttackSelection {
  readonly targetProvinceId: ProvinceId;
  readonly sourceProvinceIds: ReadonlyArray<ProvinceId>;
  readonly attackingSoldiers: number;
  readonly defenderSoldiers: number;
  readonly selectedTargetScore: C64CbaronTargetScore;
  readonly targetScores: ReadonlyArray<C64CbaronTargetScore>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly rngBytesConsumed: number;
}

export interface C64CbaronAttackResult {
  readonly selection: C64CbaronAttackSelection | null;
  readonly targetScores: ReadonlyArray<C64CbaronTargetScore>;
  readonly flagsByProvinceId: Readonly<Record<ProvinceId, number>>;
  readonly rngBytesConsumed: number;
}

interface C64CbaronAttackContext {
  readonly input: C64CbaronAttackInput;
  readonly provincesById: ReadonlyMap<ProvinceId, ProvinceState>;
  readonly provinceIndexById: ReadonlyMap<ProvinceId, number>;
  readonly flags: number[];
  rngByteCursor: number;
}

interface C64CbaronScoredTarget {
  readonly target: ProvinceState;
  readonly targetIndex: number;
  readonly score: C64CbaronTargetScore;
}

function requireByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} must be a C64 byte, got ${value}.`);
  }
}

function require24Bit(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > C64_24_BIT_MASK) {
    throw new Error(`${label} must be a C64 24-bit value, got ${value}.`);
  }
}

function add24Bit(left: number, right: number): number {
  require24Bit(left, 'C64 24-bit add left operand');
  require24Bit(right, 'C64 24-bit add right operand');
  return (left + right) & C64_24_BIT_MASK;
}

function subtract24Bit(left: number, right: number): number {
  require24Bit(left, 'C64 24-bit subtract left operand');
  require24Bit(right, 'C64 24-bit subtract right operand');
  return (left - right + C64_24_BIT_MASK + 1) & C64_24_BIT_MASK;
}

function requireUniqueProvinces(
  provinces: ReadonlyArray<ProvinceState>
): ReadonlyMap<ProvinceId, ProvinceState> {
  const provincesById = new Map<ProvinceId, ProvinceState>();
  for (const province of provinces) {
    if (provincesById.has(province.id)) {
      throw new Error(`Duplicate C64 cbaron attack province ${province.id}.`);
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
    throw new Error(`Unknown C64 cbaron attack province ${provinceId}.`);
  }
  return province;
}

function requireProvinceIndex(
  provinceIndexById: ReadonlyMap<ProvinceId, number>,
  provinceId: ProvinceId
): number {
  const index = provinceIndexById.get(provinceId);
  if (index === undefined) {
    throw new Error(`Missing C64 province order for ${provinceId}.`);
  }
  return index;
}

function createProvinceIndexById(
  provinces: ReadonlyArray<ProvinceState>
): ReadonlyMap<ProvinceId, number> {
  return new Map(provinces.map((province, index) => [province.id, index]));
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

function validateOwnerSlots(input: C64CbaronAttackInput): void {
  const royalistSlot = input.ownerSlots[0];
  if (royalistSlot === undefined || royalistSlot.ownerId !== ROYALIST_OWNER_ID) {
    throw new Error('C64 cbaron attack owner slot 0 must be royalists.');
  }
  if (!input.ownerSlots.some((slot) => slot.ownerId === input.activeOwnerId)) {
    throw new Error(`Missing active C64 cbaron attack owner slot ${input.activeOwnerId}.`);
  }
  if (!input.playerSlots.some((slot) => slot.ownerId === input.activeOwnerId)) {
    throw new Error(`Missing active C64 cbaron attack player slot ${input.activeOwnerId}.`);
  }
}

function createContext(input: C64CbaronAttackInput): C64CbaronAttackContext {
  require24Bit(input.activeMoney, 'C64 cbaron active money');
  for (const [index, rngByte] of input.rngBytes.entries()) {
    requireByte(rngByte, `C64 cbaron L6808 RNG byte ${index}`);
  }
  validateOwnerSlots(input);

  const provincesById = requireUniqueProvinces(input.provinces);
  validateNeighbours(input.provinces, provincesById);
  const provinceIndexById = createProvinceIndexById(input.provinces);
  const flags = input.provinces.map(() => 0);

  for (const provinceId of input.lockedProvinceIds) {
    const index = requireProvinceIndex(provinceIndexById, provinceId);
    flags[index] |= C64_FLAG_LOCKED;
  }

  return {
    input,
    provincesById,
    provinceIndexById,
    flags,
    rngByteCursor: 0
  };
}

function consumeRngByte(context: C64CbaronAttackContext): number {
  const rngByte = context.input.rngBytes[context.rngByteCursor];
  if (rngByte === undefined) {
    throw new Error('C64 cbaron L6808 ran out of RNG bytes.');
  }
  context.rngByteCursor += 1;
  return rngByte;
}

function provinceAt(context: C64CbaronAttackContext, index: number): ProvinceState {
  const province = context.input.provinces[index];
  if (province === undefined) {
    throw new Error(`Missing C64 cbaron province at index ${index}.`);
  }
  return province;
}

function scanDescending(
  context: C64CbaronAttackContext,
  callback: (province: ProvinceState, index: number) => void
): void {
  for (let index = context.input.provinces.length - 1; index >= 0; index -= 1) {
    callback(provinceAt(context, index), index);
  }
}

function applyFlagMask(context: C64CbaronAttackContext, mask: number): void {
  for (let index = 0; index < context.flags.length; index += 1) {
    context.flags[index] &= mask;
  }
}

function markAdjacent(context: C64CbaronAttackContext, province: ProvinceState): void {
  for (const neighbourId of province.neighbours) {
    const neighbourIndex = requireProvinceIndex(context.provinceIndexById, neighbourId);
    context.flags[neighbourIndex] |= C64_FLAG_ADJACENT;
  }
}

function clearHighBitsFromNonOwner(
  context: C64CbaronAttackContext,
  ownerId: OwnerId
): void {
  for (let index = 0; index < context.input.provinces.length; index += 1) {
    if (provinceAt(context, index).ownerId !== ownerId) {
      context.flags[index] &= 0x3f;
    }
  }
}

function clearHighBitsFromOwner(
  context: C64CbaronAttackContext,
  ownerId: PlayerId
): void {
  for (let index = 0; index < context.input.provinces.length; index += 1) {
    if (provinceAt(context, index).ownerId === ownerId) {
      context.flags[index] &= 0x3f;
    }
  }
}

function mobileSoldiers(province: ProvinceState): number {
  return Math.max(0, province.soldiers - C64_GARRISON_SOLDIERS);
}

function markActiveOwnedSources(context: C64CbaronAttackContext): void {
  applyFlagMask(context, 0xef);
  scanDescending(context, (province, index) => {
    if (province.ownerId === context.input.activeOwnerId) {
      context.flags[index] |= C64_FLAG_SOURCE;
    }
  });
}

function sumMobileSoldiersForFlag(context: C64CbaronAttackContext, flag: number): number {
  let total = 0;
  scanDescending(context, (province, index) => {
    if ((context.flags[index] & flag) === 0) {
      return;
    }
    total = add24Bit(total, mobileSoldiers(province));
  });
  return total;
}

function markC64FrontierTargets(context: C64CbaronAttackContext): void {
  scanDescending(context, (province, index) => {
    if ((context.flags[index] & C64_FLAG_SOURCE) !== 0) {
      markAdjacent(context, province);
    }
  });
  clearHighBitsFromOwner(context, context.input.activeOwnerId);
  applyFlagMask(context, 0xef);
  scanDescending(context, (_province, index) => {
    if ((context.flags[index] & C64_FLAG_ADJACENT) !== 0) {
      context.flags[index] = (context.flags[index] & 0x7f) | C64_FLAG_SOURCE;
    }
  });
}

function battleMeetsThreshold(
  target: ProvinceState,
  attackingSoldiers: number,
  threshold: number,
  config: Pick<GameConfig, 'terrainInfluence'>
): boolean {
  if (attackingSoldiers < 1) {
    return false;
  }
  const combatSetup = c64CombatSetupForProvince(target, config);
  return c64BattleMeetsThreshold({
    attackerSoldiers: attackingSoldiers,
    defenderSoldiers: target.soldiers,
    attackerCombatPercent: combatSetup.attackerCombatPercent,
    defenderCombatPercent: combatSetup.defenderCombatPercent
  }, threshold);
}

function collectAdjacentSourceSoldiers(
  context: C64CbaronAttackContext,
  target: ProvinceState,
  gross: boolean
): number {
  applyFlagMask(context, 0x3f);
  markAdjacent(context, target);
  clearHighBitsFromNonOwner(context, context.input.activeOwnerId);

  let soldiers = 0;
  scanDescending(context, (province, index) => {
    if ((context.flags[index] & C64_FLAG_ADJACENT) === 0) {
      return;
    }
    if ((context.flags[index] & C64_FLAG_LOCKED) !== 0) {
      return;
    }
    soldiers = add24Bit(
      soldiers,
      gross ? province.soldiers : mobileSoldiers(province)
    );
  });
  return soldiers;
}

function markAcceptedAttackTargets(context: C64CbaronAttackContext): void {
  scanDescending(context, (target, targetIndex) => {
    if ((context.flags[targetIndex] & C64_FLAG_SOURCE) === 0) {
      return;
    }
    const attackingSoldiers = collectAdjacentSourceSoldiers(context, target, false);
    if (attackingSoldiers < 1) {
      return;
    }
    if (
      isRoyalistOwner(target.ownerId) &&
      context.input.config.royalistAttitude === 'friendly'
    ) {
      context.flags[targetIndex] |= C64_FLAG_ACCEPTED_TARGET;
      return;
    }
    if (
      battleMeetsThreshold(
        target,
        attackingSoldiers,
        C64_BARON_ATTACK_THRESHOLD,
        context.input.config
      )
    ) {
      context.flags[targetIndex] |= C64_FLAG_ACCEPTED_TARGET;
    }
  });
}

function targetSupportEstimate(
  context: C64CbaronAttackContext,
  target: ProvinceState
): number {
  const adjacentSourceSoldiers = collectAdjacentSourceSoldiers(context, target, true);
  if (adjacentSourceSoldiers < 1) {
    throw new Error(`Cannot score C64 cbaron target ${target.id} without gross adjacent source soldiers.`);
  }

  const combatSetup = c64CombatSetupForProvince(target, context.input.config);
  return Math.floor(
    Math.floor(
      target.soldiers * target.soldiers * combatSetup.defenderCombatPercent /
        combatSetup.attackerCombatPercent
    ) / adjacentSourceSoldiers
  );
}

function provincesWithTemporaryOwner(
  context: C64CbaronAttackContext,
  target: ProvinceState,
  ownerId: PlayerId
): ReadonlyArray<ProvinceState> {
  return context.input.provinces.map((province) =>
    province.id === target.id
      ? { ...province, ownerId }
      : province
  );
}

function worklistProvinceIds(context: C64CbaronAttackContext): ReadonlyArray<ProvinceId> {
  const ids: ProvinceId[] = [];
  scanDescending(context, (province, index) => {
    if ((context.flags[index] & C64_FLAG_SOURCE) !== 0) {
      ids.push(province.id);
    }
  });
  return ids;
}

function byte0(value: number): number {
  return value & 0xff;
}

function byte1(value: number): number {
  return Math.floor(value / 0x100) & 0xff;
}

function byte2(value: number): number {
  return Math.floor(value / 0x10000) & 0xff;
}

function bytesTo24Bit(low: number, middle: number, high: number): number {
  return low + middle * 0x100 + high * 0x10000;
}

export function c64CbaronL63CECapRequirementByMoney(
  activeMoney: number,
  requirement: number
): number {
  require24Bit(activeMoney, 'C64 cbaron active money cap');
  require24Bit(requirement, 'C64 cbaron home requirement cap');

  const moneyLow = byte0(activeMoney);
  const moneyMiddle = byte1(activeMoney);
  const moneyHigh = byte2(activeMoney);
  const requirementLow = byte0(requirement);
  const requirementMiddle = byte1(requirement);
  const requirementHigh = byte2(requirement);

  let comparedByte = moneyHigh;
  let carry = moneyHigh >= requirementHigh;
  if (moneyHigh === requirementHigh) {
    comparedByte = moneyMiddle;
    carry = moneyMiddle >= requirementMiddle;
    if (moneyMiddle === requirementMiddle) {
      comparedByte = moneyLow;
      carry = moneyLow >= requirementLow;
    }
  }

  if (carry) {
    return requirement;
  }

  return bytesTo24Bit(comparedByte, moneyMiddle, moneyHigh);
}

export function c64CbaronL63CEHomePressureAdjustment(
  input: C64CbaronAttackInput,
  flagsByProvinceId: Readonly<Record<ProvinceId, number>>,
  worklistThreat: number,
  provincesWithTargetOwner: ReadonlyArray<ProvinceState>
): number {
  require24Bit(worklistThreat, 'C64 cbaron L63CE worklist threat');
  const activeSlot = input.playerSlots.find((slot) => slot.ownerId === input.activeOwnerId);
  if (activeSlot === undefined) {
    throw new Error(`Missing active C64 cbaron L63CE player slot ${input.activeOwnerId}.`);
  }
  if (activeSlot.homeProvinceId === null) {
    throw new Error(`Active C64 cbaron player ${input.activeOwnerId} has no home province.`);
  }
  if ((flagsByProvinceId[activeSlot.homeProvinceId] & C64_FLAG_SOURCE) === 0) {
    return worklistThreat;
  }

  const homeRequirement = c64CbaronRequiredStrength({
    provinces: provincesWithTargetOwner,
    activeOwnerId: input.activeOwnerId,
    ownerSlots: input.ownerSlots,
    worklistProvinceIds: [activeSlot.homeProvinceId],
    config: input.config
  }).totalRequiredSoldiers;
  const cappedRequirement = c64CbaronL63CECapRequirementByMoney(
    input.activeMoney,
    homeRequirement
  );
  return (worklistThreat - cappedRequirement) & C64_24_BIT_MASK;
}

function targetOwnerProvinceCount(
  context: C64CbaronAttackContext,
  target: ProvinceState
): number {
  const homeOwner = context.input.playerSlots.find((slot) => slot.homeProvinceId === target.id);
  return homeOwner?.provinceCount ?? 0;
}

function targetTouchesNonRoyalistNonActive(
  context: C64CbaronAttackContext,
  target: ProvinceState
): boolean {
  applyFlagMask(context, 0x3f);
  markAdjacent(context, target);
  clearHighBitsFromOwner(context, context.input.activeOwnerId);

  let touches = false;
  scanDescending(context, (province, index) => {
    if ((context.flags[index] & C64_FLAG_ADJACENT) === 0) {
      return;
    }
    context.flags[index] &= 0x7f;
    if (isPlayerOwner(province.ownerId)) {
      touches = true;
    }
  });
  return touches;
}

function scoreAcceptedTargets(context: C64CbaronAttackContext): ReadonlyArray<C64CbaronScoredTarget> {
  markActiveOwnedSources(context);
  const totalMobileArmy = sumMobileSoldiersForFlag(context, C64_FLAG_SOURCE);
  const scores: C64CbaronScoredTarget[] = [];

  scanDescending(context, (target, targetIndex) => {
    if ((context.flags[targetIndex] & C64_FLAG_ACCEPTED_TARGET) === 0) {
      return;
    }

    const strategicWeight =
      calculateC64ProvinceIncome(target, context.input.config) +
      4 * c64CbaronConnectivityClass({
        provinces: context.input.provinces,
        provinceIndexById: context.provinceIndexById,
        flagsByProvinceIndex: context.flags,
        activeOwnerId: context.input.activeOwnerId,
        targetProvinceId: target.id
      });
    let typeFlag = targetTouchesNonRoyalistNonActive(context, target)
      ? C64_TARGET_TYPE_CONTESTED
      : C64_TARGET_TYPE_DEFAULT;
    const supportEstimate = targetSupportEstimate(context, target);

    context.flags[targetIndex] |= C64_FLAG_SOURCE;
    const temporaryProvinces = provincesWithTemporaryOwner(
      context,
      target,
      context.input.activeOwnerId
    );
    let threat = c64CbaronRequiredStrength({
      provinces: temporaryProvinces,
      activeOwnerId: context.input.activeOwnerId,
      ownerSlots: context.input.ownerSlots,
      worklistProvinceIds: worklistProvinceIds(context),
      config: context.input.config
    }).totalRequiredSoldiers;
    const rngByte = consumeRngByte(context);
    if (rngByte < C64_RANDOM_HOME_PRESSURE_THRESHOLD) {
      threat = c64CbaronL63CEHomePressureAdjustment(
        context.input,
        flagsByProvinceId(context),
        threat,
        temporaryProvinces
      );
    }
    context.flags[targetIndex] &= ~C64_FLAG_SOURCE;

    const targetDebt = supportEstimate + threat;
    if (totalMobileArmy < targetDebt) {
      if (isRoyalistOwner(target.ownerId) && context.input.config.royalistAttitude !== 'friendly') {
        return;
      }
      typeFlag = 0;
    }

    const homeCastleBonus =
      targetOwnerProvinceCount(context, target) * C64_HOME_TARGET_SCORE_SCALE;
    const scoreBase = homeCastleBonus + 1 + (typeFlag << 8);
    const score =
      scoreBase * strategicWeight +
      Math.floor(target.soldiers / 2) -
      supportEstimate;
    if (score < 0) {
      return;
    }

    scores.push({
      target,
      targetIndex,
      score: {
        provinceId: target.id,
        score,
        strategicWeight,
        targetSupportEstimate: supportEstimate,
        worklistThreat: threat,
        targetDebt
      }
    });
  });

  return scores;
}

function chooseBestScoredTarget(
  scoredTargets: ReadonlyArray<C64CbaronScoredTarget>
): C64CbaronScoredTarget | null {
  let best: C64CbaronScoredTarget | null = null;
  for (const scoredTarget of scoredTargets) {
    if (best === null || scoredTarget.score.score >= best.score.score) {
      best = scoredTarget;
    }
  }
  return best;
}

function rebuildSelectedSourceSet(
  context: C64CbaronAttackContext,
  target: ProvinceState
): number {
  const targetIndex = requireProvinceIndex(context.provinceIndexById, target.id);
  context.flags[targetIndex] &= ~C64_FLAG_ACCEPTED_TARGET;
  applyFlagMask(context, 0x2f);
  markAdjacent(context, target);
  clearHighBitsFromNonOwner(context, context.input.activeOwnerId);

  let attackingSoldiers = 0;
  scanDescending(context, (province, index) => {
    if ((context.flags[index] & C64_FLAG_ADJACENT) === 0) {
      return;
    }
    if ((context.flags[index] & C64_FLAG_LOCKED) !== 0) {
      return;
    }
    context.flags[index] |= C64_FLAG_SOURCE;
    attackingSoldiers = add24Bit(attackingSoldiers, mobileSoldiers(province));
  });
  return attackingSoldiers;
}

function pruneCompetingFrontierSources(
  context: C64CbaronAttackContext,
  selectedTarget: ProvinceState,
  attackingSoldiers: number
): number {
  let committedSoldiers = attackingSoldiers;
  applyFlagMask(context, 0x3f);

  scanDescending(context, (remainingTarget) => {
    const remainingTargetIndex = requireProvinceIndex(context.provinceIndexById, remainingTarget.id);
    if ((context.flags[remainingTargetIndex] & C64_FLAG_ACCEPTED_TARGET) === 0) {
      return;
    }
    markAdjacent(context, remainingTarget);
    clearHighBitsFromNonOwner(context, context.input.activeOwnerId);

    scanDescending(context, (source, sourceIndex) => {
      if ((context.flags[sourceIndex] & (C64_FLAG_ADJACENT | C64_FLAG_SOURCE)) !==
        (C64_FLAG_ADJACENT | C64_FLAG_SOURCE)) {
        return;
      }

      const reducedSoldiers = subtract24Bit(committedSoldiers, mobileSoldiers(source));
      context.flags[sourceIndex] &= ~C64_FLAG_SOURCE;
      if (
        battleMeetsThreshold(
          selectedTarget,
          reducedSoldiers,
          C64_AI_DEFENDER_RETREAT_THRESHOLD,
          context.input.config
        )
      ) {
        committedSoldiers = reducedSoldiers;
        return;
      }

      context.flags[sourceIndex] |= C64_FLAG_SOURCE;
    });

    applyFlagMask(context, 0x3f);
  });

  return committedSoldiers;
}

function selectedSourceProvinceIds(context: C64CbaronAttackContext): ReadonlyArray<ProvinceId> {
  const sourceIds: ProvinceId[] = [];
  scanDescending(context, (province, index) => {
    if ((context.flags[index] & C64_FLAG_SOURCE) !== 0) {
      if (mobileSoldiers(province) < 1) {
        return;
      }
      sourceIds.push(province.id);
    }
  });
  return sourceIds;
}

function flagsByProvinceId(context: C64CbaronAttackContext): Readonly<Record<ProvinceId, number>> {
  return Object.fromEntries(
    context.input.provinces.map((province, index) => [province.id, context.flags[index]])
  );
}

export function runC64CbaronAttack(input: C64CbaronAttackInput): C64CbaronAttackResult {
  const context = createContext(input);
  markActiveOwnedSources(context);
  markC64FrontierTargets(context);
  markAcceptedAttackTargets(context);
  const scoredTargets = scoreAcceptedTargets(context);
  const selectedTarget = chooseBestScoredTarget(scoredTargets);
  const targetScores = scoredTargets.map((scoredTarget) => scoredTarget.score);
  if (selectedTarget === null) {
    return {
      selection: null,
      targetScores,
      flagsByProvinceId: flagsByProvinceId(context),
      rngBytesConsumed: context.rngByteCursor
    };
  }

  const attackingSoldiersBeforePruning = rebuildSelectedSourceSet(context, selectedTarget.target);
  const attackingSoldiers = pruneCompetingFrontierSources(
    context,
    selectedTarget.target,
    attackingSoldiersBeforePruning
  );

  const selection = {
    targetProvinceId: selectedTarget.target.id,
    sourceProvinceIds: selectedSourceProvinceIds(context),
    attackingSoldiers,
    defenderSoldiers: selectedTarget.target.soldiers,
    selectedTargetScore: selectedTarget.score,
    targetScores,
    flagsByProvinceId: flagsByProvinceId(context),
    rngBytesConsumed: context.rngByteCursor
  };
  return {
    selection,
    targetScores,
    flagsByProvinceId: selection.flagsByProvinceId,
    rngBytesConsumed: context.rngByteCursor
  };
}

export function chooseC64CbaronAttack(input: C64CbaronAttackInput): C64CbaronAttackSelection | null {
  return runC64CbaronAttack(input).selection;
}
