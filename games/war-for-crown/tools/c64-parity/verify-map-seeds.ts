import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  c64FortificationLevelForFortificationLevel,
  c64TerrainIdForTerrainId
} from '../../src/game/c64-battle';
import { applyPlayerAction } from '../../src/game/actions';
import { chooseC64OriginalAiAction } from '../../src/game/ai-c64-original';
import {
  runC64CbaronAttack,
  type C64CbaronAttackPlayerSlot,
  type C64CbaronAttackResult
} from '../../src/game/c64-cbaron-attack';
import { runC64CbaronEconomy } from '../../src/game/c64-cbaron-economy';
import type { C64CbaronOwnerSlot } from '../../src/game/c64-cbaron-threat';
import { DEFAULT_GAME_CONFIG } from '../../src/game/constants';
import { generateProvinceMapWithRngState } from '../../src/game/map';
import { ROYALIST_OWNER_ID } from '../../src/game/owners';
import { createPlayerView } from '../../src/game/player-view';
import { nextRngByte, normalizeRngSeed } from '../../src/game/rng';
import {
  runHostileRoyalistAttackPhase,
  runRoyalistWorldPhase
} from '../../src/game/royalists';
import { createInitialState } from '../../src/game/state';
import { selectHomeProvince } from '../../src/game/logic';
import type { GameConfig, GameState, ProvinceMapState, TerrainInfluence } from '../../src/game/types';
import { requireRawModulePath, verifyC64Baseline } from './baseline';
import { hexAddress, hexByte, readSnapshot, requireEqualBytes } from './bytes';
import { runViceMonitor, writeMonitorCommands } from './vice';

interface MapParityScenario {
  readonly seed: number;
  readonly provinceCount: number;
  readonly extendedBaronRound?: boolean;
  readonly maxVillagesMode?: GameConfig['maxVillagesMode'];
  readonly royalistAttackCooperation?: GameConfig['royalistAttackCooperation'];
  readonly royalistAttackThreshold?: GameConfig['royalistAttackThreshold'];
  readonly royalistAttitude?: GameConfig['royalistAttitude'];
  readonly terrainInfluence?: TerrainInfluence;
}

interface ScenarioPaths {
  readonly map: string;
  readonly terrain: string;
  readonly villages: string;
  readonly soldiers: string;
  readonly owners: string;
  readonly fortifications: string;
  readonly finalOwners: string;
  readonly finalSoldiers: string;
  readonly finalFortifications: string;
  readonly initialCalendar: string;
  readonly initialIncomeMoneyHigh: string;
  readonly initialIncomeMoneyLow: string;
  readonly initialIncomeMoneyMiddle: string;
  readonly initialTurnRngCount: string;
  readonly initialWeather: string;
  readonly fullAttackFortifications: string;
  readonly fullAttackOwners: string;
  readonly fullAttackRngCount: string;
  readonly fullAttackSoldiersHigh: string;
  readonly fullAttackSoldiersLow: string;
  readonly fullAttackSoldiersMiddle: string;
  readonly homeProvinces: string;
  readonly movementFortifications: string;
  readonly movementMoneyHigh: string;
  readonly movementMoneyLow: string;
  readonly movementMoneyMiddle: string;
  readonly movementMemory: string;
  readonly movementOwners: string;
  readonly movementOwnerCounts: string;
  readonly movementRngCount: string;
  readonly movementSoldiersHigh: string;
  readonly movementSoldiersLow: string;
  readonly movementSoldiersMiddle: string;
  readonly nextRoundCalendar: string;
  readonly nextRoundIncomeMoneyHigh: string;
  readonly nextRoundIncomeMoneyLow: string;
  readonly nextRoundIncomeMoneyMiddle: string;
  readonly nextRoundRngCount: string;
  readonly nextRoundWeather: string;
  readonly economyFortifications: string;
  readonly economyMoneyHigh: string;
  readonly economyMoneyLow: string;
  readonly economyMoneyMiddle: string;
  readonly economyMemory: string;
  readonly economyOwners: string;
  readonly economyRngCount: string;
  readonly economySoldiersHigh: string;
  readonly economySoldiersLow: string;
  readonly economySoldiersMiddle: string;
  readonly economyVillages: string;
  readonly extendedFortifications: string;
  readonly extendedMoneyHigh: string;
  readonly extendedMoneyLow: string;
  readonly extendedMoneyMiddle: string;
  readonly extendedOwners: string;
  readonly extendedRngCount: string;
  readonly extendedSoldiersHigh: string;
  readonly extendedSoldiersLow: string;
  readonly extendedSoldiersMiddle: string;
  readonly extendedVillages: string;
  readonly player2Fortifications: string;
  readonly player2MoneyHigh: string;
  readonly player2MoneyLow: string;
  readonly player2MoneyMiddle: string;
  readonly player2Owners: string;
  readonly player2RngCount: string;
  readonly player2SoldiersHigh: string;
  readonly player2SoldiersLow: string;
  readonly player2SoldiersMiddle: string;
  readonly player2Villages: string;
  readonly player3AttackFortifications: string;
  readonly player3AttackMoneyLow: string;
  readonly player3AttackOwners: string;
  readonly player3AttackRngCount: string;
  readonly player3AttackSoldiersLow: string;
  readonly player3MovementFortifications: string;
  readonly player3MovementMoneyLow: string;
  readonly player3MovementOwners: string;
  readonly player3MovementRngCount: string;
  readonly player3MovementSoldiersLow: string;
  readonly worldFortBuckets: string;
  readonly worldFortifications: string;
  readonly worldMoneyHigh: string;
  readonly worldMoneyLow: string;
  readonly worldMoneyMiddle: string;
  readonly worldOwners: string;
  readonly worldRngCount: string;
  readonly worldSoldiersHigh: string;
  readonly worldSoldiersLow: string;
  readonly worldSoldiersMiddle: string;
  readonly worldVillageBuckets: string;
  readonly worldVillages: string;
  readonly preWorldOwners: string;
  readonly preWorldRngCount: string;
  readonly preWorldSoldiersLow: string;
  readonly royalistAttackOwners: string;
  readonly royalistAttackRngCount: string;
  readonly royalistAttackSoldiersLow: string;
  readonly player4PreCleanupFlags: string;
  readonly player4PreCleanupSoldiersLow: string;
  readonly attackFlags: string;
  readonly attackRngCount: string;
  readonly attackTarget: string;
  readonly battleFortifications: string;
  readonly battleFlags: string;
  readonly battleKampfScratch: string;
  readonly battleOwners: string;
  readonly battleRngCount: string;
  readonly battleRngRoutine: string;
  readonly battleRoundScratch: string;
  readonly battleSetup: string;
  readonly battleSoldiersHigh: string;
  readonly battleSoldiersLow: string;
  readonly battleSoldiersMiddle: string;
  readonly battleStateScratch: string;
  readonly battleTables: string;
  readonly rngCount: string;
  readonly rngTape: string;
  readonly selectedHomes: string;
}

const RNG_TAPE_LENGTH = 3_000;
const RNG_TAPE_ADDRESS = 0x7000;

const SCENARIOS: ReadonlyArray<MapParityScenario> = [
  { seed: 1, provinceCount: 30, extendedBaronRound: true },
  { seed: 2, provinceCount: 30, extendedBaronRound: true },
  { seed: 3, provinceCount: 30 },
  { seed: 4, provinceCount: 30 },
  { seed: 5, provinceCount: 30 },
  { seed: 11, provinceCount: 30, extendedBaronRound: true },
  { seed: 42, provinceCount: 30, extendedBaronRound: true },
  { seed: 99, provinceCount: 30 },
  { seed: 23, provinceCount: 16 },
  { seed: 97, provinceCount: 99 },
  { seed: 19, provinceCount: 30, maxVillagesMode: 'largest-province' },
  { seed: 31, provinceCount: 30, terrainInfluence: 'none' },
  {
    seed: 7,
    provinceCount: 30,
    extendedBaronRound: true,
    royalistAttitude: 'hostile'
  },
  {
    seed: 17,
    provinceCount: 30,
    extendedBaronRound: true,
    royalistAttitude: 'hostile',
    royalistAttackCooperation: 'combined-sources',
    royalistAttackThreshold: 'loose'
  }
];

function scenarioId(scenario: MapParityScenario): string {
  const mode = scenario.maxVillagesMode ?? DEFAULT_GAME_CONFIG.maxVillagesMode;
  const terrain = scenario.terrainInfluence ?? DEFAULT_GAME_CONFIG.terrainInfluence;
  const attitude = scenario.royalistAttitude ?? DEFAULT_GAME_CONFIG.royalistAttitude;
  return `seed-${scenario.seed}-provinces-${scenario.provinceCount}-${mode}-${terrain}-${attitude}`;
}

function scenarioConfig(scenario: MapParityScenario): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    humanPlayerCount: 0,
    aiPlayerCount: DEFAULT_GAME_CONFIG.humanPlayerCount + DEFAULT_GAME_CONFIG.aiPlayerCount,
    provinceCount: scenario.provinceCount,
    maxVillagesMode: scenario.maxVillagesMode ?? DEFAULT_GAME_CONFIG.maxVillagesMode,
    royalistAttackCooperation:
      scenario.royalistAttackCooperation ?? DEFAULT_GAME_CONFIG.royalistAttackCooperation,
    royalistAttackThreshold:
      scenario.royalistAttackThreshold ?? DEFAULT_GAME_CONFIG.royalistAttackThreshold,
    royalistAttitude: scenario.royalistAttitude ?? DEFAULT_GAME_CONFIG.royalistAttitude,
    terrainInfluence: scenario.terrainInfluence ?? DEFAULT_GAME_CONFIG.terrainInfluence
  };
}

function scenarioPaths(directory: string, scenario: MapParityScenario): ScenarioPaths {
  const prefix = join(directory, scenarioId(scenario));
  return {
    map: `${prefix}-map.bin`,
    terrain: `${prefix}-terrain.bin`,
    villages: `${prefix}-villages.bin`,
    soldiers: `${prefix}-soldiers.bin`,
    owners: `${prefix}-owners.bin`,
    fortifications: `${prefix}-fortifications.bin`,
    finalOwners: `${prefix}-final-owners.bin`,
    finalSoldiers: `${prefix}-final-soldiers.bin`,
    finalFortifications: `${prefix}-final-fortifications.bin`,
    initialCalendar: `${prefix}-initial-calendar.bin`,
    initialIncomeMoneyHigh: `${prefix}-initial-income-money-high.bin`,
    initialIncomeMoneyLow: `${prefix}-initial-income-money-low.bin`,
    initialIncomeMoneyMiddle: `${prefix}-initial-income-money-middle.bin`,
    initialTurnRngCount: `${prefix}-initial-turn-rng-count.bin`,
    initialWeather: `${prefix}-initial-weather.bin`,
    fullAttackFortifications: `${prefix}-full-attack-fortifications.bin`,
    fullAttackOwners: `${prefix}-full-attack-owners.bin`,
    fullAttackRngCount: `${prefix}-full-attack-rng-count.bin`,
    fullAttackSoldiersHigh: `${prefix}-full-attack-soldiers-high.bin`,
    fullAttackSoldiersLow: `${prefix}-full-attack-soldiers-low.bin`,
    fullAttackSoldiersMiddle: `${prefix}-full-attack-soldiers-middle.bin`,
    homeProvinces: `${prefix}-home-provinces.bin`,
    movementFortifications: `${prefix}-movement-fortifications.bin`,
    movementMoneyHigh: `${prefix}-movement-money-high.bin`,
    movementMoneyLow: `${prefix}-movement-money-low.bin`,
    movementMoneyMiddle: `${prefix}-movement-money-middle.bin`,
    movementMemory: `${prefix}-movement-memory.bin`,
    movementOwners: `${prefix}-movement-owners.bin`,
    movementOwnerCounts: `${prefix}-movement-owner-counts.bin`,
    movementRngCount: `${prefix}-movement-rng-count.bin`,
    movementSoldiersHigh: `${prefix}-movement-soldiers-high.bin`,
    movementSoldiersLow: `${prefix}-movement-soldiers-low.bin`,
    movementSoldiersMiddle: `${prefix}-movement-soldiers-middle.bin`,
    nextRoundCalendar: `${prefix}-next-round-calendar.bin`,
    nextRoundIncomeMoneyHigh: `${prefix}-next-round-income-money-high.bin`,
    nextRoundIncomeMoneyLow: `${prefix}-next-round-income-money-low.bin`,
    nextRoundIncomeMoneyMiddle: `${prefix}-next-round-income-money-middle.bin`,
    nextRoundRngCount: `${prefix}-next-round-rng-count.bin`,
    nextRoundWeather: `${prefix}-next-round-weather.bin`,
    economyFortifications: `${prefix}-economy-fortifications.bin`,
    economyMoneyHigh: `${prefix}-economy-money-high.bin`,
    economyMoneyLow: `${prefix}-economy-money-low.bin`,
    economyMoneyMiddle: `${prefix}-economy-money-middle.bin`,
    economyMemory: `${prefix}-economy-memory.bin`,
    economyOwners: `${prefix}-economy-owners.bin`,
    economyRngCount: `${prefix}-economy-rng-count.bin`,
    economySoldiersHigh: `${prefix}-economy-soldiers-high.bin`,
    economySoldiersLow: `${prefix}-economy-soldiers-low.bin`,
    economySoldiersMiddle: `${prefix}-economy-soldiers-middle.bin`,
    economyVillages: `${prefix}-economy-villages.bin`,
    extendedFortifications: `${prefix}-extended-fortifications.bin`,
    extendedMoneyHigh: `${prefix}-extended-money-high.bin`,
    extendedMoneyLow: `${prefix}-extended-money-low.bin`,
    extendedMoneyMiddle: `${prefix}-extended-money-middle.bin`,
    extendedOwners: `${prefix}-extended-owners.bin`,
    extendedRngCount: `${prefix}-extended-rng-count.bin`,
    extendedSoldiersHigh: `${prefix}-extended-soldiers-high.bin`,
    extendedSoldiersLow: `${prefix}-extended-soldiers-low.bin`,
    extendedSoldiersMiddle: `${prefix}-extended-soldiers-middle.bin`,
    extendedVillages: `${prefix}-extended-villages.bin`,
    player2Fortifications: `${prefix}-player2-fortifications.bin`,
    player2MoneyHigh: `${prefix}-player2-money-high.bin`,
    player2MoneyLow: `${prefix}-player2-money-low.bin`,
    player2MoneyMiddle: `${prefix}-player2-money-middle.bin`,
    player2Owners: `${prefix}-player2-owners.bin`,
    player2RngCount: `${prefix}-player2-rng-count.bin`,
    player2SoldiersHigh: `${prefix}-player2-soldiers-high.bin`,
    player2SoldiersLow: `${prefix}-player2-soldiers-low.bin`,
    player2SoldiersMiddle: `${prefix}-player2-soldiers-middle.bin`,
    player2Villages: `${prefix}-player2-villages.bin`,
    player3AttackFortifications: `${prefix}-player3-attack-fortifications.bin`,
    player3AttackMoneyLow: `${prefix}-player3-attack-money-low.bin`,
    player3AttackOwners: `${prefix}-player3-attack-owners.bin`,
    player3AttackRngCount: `${prefix}-player3-attack-rng-count.bin`,
    player3AttackSoldiersLow: `${prefix}-player3-attack-soldiers-low.bin`,
    player3MovementFortifications: `${prefix}-player3-movement-fortifications.bin`,
    player3MovementMoneyLow: `${prefix}-player3-movement-money-low.bin`,
    player3MovementOwners: `${prefix}-player3-movement-owners.bin`,
    player3MovementRngCount: `${prefix}-player3-movement-rng-count.bin`,
    player3MovementSoldiersLow: `${prefix}-player3-movement-soldiers-low.bin`,
    worldFortBuckets: `${prefix}-world-fort-buckets.bin`,
    worldFortifications: `${prefix}-world-fortifications.bin`,
    worldMoneyHigh: `${prefix}-world-money-high.bin`,
    worldMoneyLow: `${prefix}-world-money-low.bin`,
    worldMoneyMiddle: `${prefix}-world-money-middle.bin`,
    worldOwners: `${prefix}-world-owners.bin`,
    worldRngCount: `${prefix}-world-rng-count.bin`,
    worldSoldiersHigh: `${prefix}-world-soldiers-high.bin`,
    worldSoldiersLow: `${prefix}-world-soldiers-low.bin`,
    worldSoldiersMiddle: `${prefix}-world-soldiers-middle.bin`,
    worldVillageBuckets: `${prefix}-world-village-buckets.bin`,
    worldVillages: `${prefix}-world-villages.bin`,
    preWorldOwners: `${prefix}-pre-world-owners.bin`,
    preWorldRngCount: `${prefix}-pre-world-rng-count.bin`,
    preWorldSoldiersLow: `${prefix}-pre-world-soldiers-low.bin`,
    royalistAttackOwners: `${prefix}-royalist-attack-owners.bin`,
    royalistAttackRngCount: `${prefix}-royalist-attack-rng-count.bin`,
    royalistAttackSoldiersLow: `${prefix}-royalist-attack-soldiers-low.bin`,
    player4PreCleanupFlags: `${prefix}-player4-pre-cleanup-flags.bin`,
    player4PreCleanupSoldiersLow: `${prefix}-player4-pre-cleanup-soldiers-low.bin`,
    attackFlags: `${prefix}-attack-flags.bin`,
    attackRngCount: `${prefix}-attack-rng-count.bin`,
    attackTarget: `${prefix}-attack-target.bin`,
    battleFortifications: `${prefix}-battle-fortifications.bin`,
    battleFlags: `${prefix}-battle-flags.bin`,
    battleKampfScratch: `${prefix}-battle-kampf-scratch.bin`,
    battleOwners: `${prefix}-battle-owners.bin`,
    battleRngCount: `${prefix}-battle-rng-count.bin`,
    battleRngRoutine: `${prefix}-battle-rng-routine.bin`,
    battleRoundScratch: `${prefix}-battle-round-scratch.bin`,
    battleSetup: `${prefix}-battle-setup.bin`,
    battleSoldiersHigh: `${prefix}-battle-soldiers-high.bin`,
    battleSoldiersLow: `${prefix}-battle-soldiers-low.bin`,
    battleSoldiersMiddle: `${prefix}-battle-soldiers-middle.bin`,
    battleStateScratch: `${prefix}-battle-state-scratch.bin`,
    battleTables: `${prefix}-battle-tables.bin`,
    rngCount: `${prefix}-rng-count.bin`,
    rngTape: `${prefix}-rng-tape.bin`,
    selectedHomes: `${prefix}-selected-homes.bin`
  };
}

function createRngTape(seed: number): Uint8Array {
  let rngState = normalizeRngSeed(seed);
  return Uint8Array.from({ length: RNG_TAPE_LENGTH }, () => {
    const next = nextRngByte(rngState);
    rngState = next.rngState;
    return next.byte;
  });
}

function bsave(path: string, start: number, end: number): string {
  return `bsave "${path}" 0 ${hexAddress(start)} ${hexAddress(end)}`;
}

function byteAddress(address: number): string {
  return hexAddress(address).slice(-2);
}

function c64TerrainInfluenceEnabled(config: GameConfig): boolean {
  return config.terrainInfluence === 'combat' || config.terrainInfluence === 'both';
}

function c64TerrainIncomeEnabled(config: GameConfig): boolean {
  return config.terrainInfluence === 'income' || config.terrainInfluence === 'both';
}

function c64RoyalistAttitude(config: GameConfig): number {
  switch (config.royalistAttitude) {
    case 'friendly':
      return 0;
    case 'neutral':
      return 1;
    case 'hostile':
      return 2;
  }
}

function c64RoyalistCooperation(config: GameConfig): number {
  return config.royalistAttackCooperation === 'combined-sources' ? 1 : 0;
}

function c64RoyalistThreshold(config: GameConfig): number {
  return config.royalistAttackThreshold === 'strict' ? 1 : 0;
}

function c64RoyalistDistribution(config: GameConfig): number {
  switch (config.royalistDistribution) {
    case 'none':
      return 0;
    case 'even':
      return 1;
    case 'border':
      return 2;
  }
}

function c64RoyalistProductionBytes(config: GameConfig): {
  readonly villageInvestment: number;
  readonly fortificationInvestment: number;
} {
  const total =
    config.royalistGrowthPercent +
    config.royalistInvestmentPercent +
    config.royalistFortificationInvestmentPercent;
  return {
    villageInvestment: Math.floor((config.royalistInvestmentPercent * 0x100) / total),
    fortificationInvestment: Math.floor(
      (config.royalistFortificationInvestmentPercent * 0x100) / total
    )
  };
}

function monitorBytes(bytes: ReadonlyArray<number>): string {
  return bytes.map(hexByte).join(' ');
}

function monitorCommands(
  kernalPath: string,
  menuePath: string,
  sysPath: string,
  mainPath: string,
  cbaronPath: string,
  kampfPath: string,
  directory: string
): ReadonlyArray<string> {
  const commands: string[] = [
    'break c003',
    'break 3117',
    'break 31b8',
    'break 4c50',
    'break 7fd6',
    'break 6a64',
    'disable 6'
  ];
  for (const scenario of SCENARIOS) {
    const config = scenarioConfig(scenario);
    const productionBytes = c64RoyalistProductionBytes(config);
    const playerCount = config.humanPlayerCount + config.aiPlayerCount;
    const expectedHomeSelection = runTypeScriptHomeSelection(scenario, config);
    const expectedInitialTurn = runTypeScriptNewMonthPhase(expectedHomeSelection.state, config);
    const expectedAttack = runTypeScriptInitialAttack(expectedInitialTurn, config);
    const paths = scenarioPaths(directory, scenario);
    writeFileSync(paths.rngTape, createRngTape(scenario.seed));
    commands.push(
      `bload "${paths.rngTape}" 0 ${hexAddress(RNG_TAPE_ADDRESS)}`,
      `bload "${kernalPath}" 0 0800`,
      `bload "${menuePath}" 0 3000`,
      `bload "${sysPath}" 0 9400`,
      '> 218b 4c 00 c1',
      '> c100 ad 00 70 ee 01 c1 d0 03 ee 02 c1 ee fd c0 d0 03 ee fe c0 60',
      'f c0fd c0fe 00',
      'f c400 c503 00',
      'f c512 c575 00',
      'f c576 c5d9 00',
      `> c8a1 ${hexByte(scenario.provinceCount)}`,
      '> c000 20 01 51 ea',
      'g c000',
      '> 1b69 60',
      'f c5da c63d 00',
      'f c63e c6a1 00',
      'f c6a2 c705 00',
      'f c706 c7cd 00',
      'f c8fb c900 00',
      'f c0e0 c0e5 00',
      `> 161f ${hexByte(scenario.provinceCount)}`,
      'g 30e5',
      bsave(paths.map, 0xc400, 0xc4ef),
      bsave(paths.terrain, 0xc576, 0xc576 + scenario.provinceCount),
      bsave(paths.villages, 0xc6a2, 0xc6a2 + scenario.provinceCount),
      bsave(paths.soldiers, 0xc706, 0xc706 + scenario.provinceCount),
      bsave(paths.owners, 0xc5da, 0xc5da + scenario.provinceCount),
      bsave(paths.fortifications, 0xc63e, 0xc63e + scenario.provinceCount),
      bsave(paths.rngCount, 0xc0fd, 0xc0fe),
      `> c8aa ${hexByte(config.maxVillages)}`,
      `> c8ab ${hexByte(config.maxVillagesMode === 'largest-province' ? 1 : 0)}`,
      `> c8b1 ${hexByte(c64TerrainInfluenceEnabled(config) ? 1 : 0)}`,
      `> c8ba ${hexByte(config.startingSoldiers)}`,
      '> c8ad 03',
      'r sp = ff',
      '> c000 20 39 54 ea',
      'g c000'
    );
    for (let player = 1; player <= playerCount; player += 1) {
      const selectedHomeScratchAddress = 0xc0e0 + player - 1;
      commands.push(
        `> 1624 ${hexByte(player)}`,
        `> c120 20 92 54 ad 1f 16 8d ${byteAddress(selectedHomeScratchAddress)} c0 ac 1f 16 4c 9f 31`,
        'r sp = ff',
        'g c120'
      );
    }
    commands.push(
      bsave(paths.selectedHomes, 0xc0e0, 0xc0e0 + playerCount - 1),
      bsave(paths.homeProvinces, 0xc8fb, 0xc8fb + playerCount),
      bsave(paths.finalOwners, 0xc5da, 0xc5da + scenario.provinceCount),
      bsave(paths.finalSoldiers, 0xc706, 0xc706 + scenario.provinceCount),
      bsave(paths.finalFortifications, 0xc63e, 0xc63e + scenario.provinceCount),
      `bload "${mainPath}" 0 3000`,
      `bload "${cbaronPath}" 0 5800`,
      `bload "${kampfPath}" 0 7e00`,
      '> 4a49 a9 aa 8d 08 16 60',
      'f c832 c895 00',
      'f c8b5 c8ca 00',
      'f c9d0 c9f9 00',
      'f c902 c965 00',
      'f c966 c9c9 00',
      'f ca09 ca14 00',
      'f ca55 ca71 00',
      '> 1624 01',
      `> c896 ${hexByte(playerCount)}`,
      `> c8a1 ${hexByte(scenario.provinceCount)}`,
      '> c8a2 01',
      '> c8a3 00',
      `> c8a4 ${hexByte(config.randomEventsEnabled ? 7 : 0)}`,
      `> c8a5 ${hexByte(c64RoyalistAttitude(config))}`,
      `> c8a6 ${hexByte(c64RoyalistCooperation(config))}`,
      `> c8a7 ${hexByte(c64RoyalistThreshold(config))}`,
      `> c8a8 ${hexByte(c64RoyalistDistribution(config))}`,
      `> c8a9 ${hexByte(config.royalistGrowthPercent)}`,
      `> c8ac ${hexByte(c64TerrainIncomeEnabled(config) ? 1 : 0)}`,
      `> c8b1 ${hexByte(c64TerrainInfluenceEnabled(config) ? 1 : 0)}`,
      `> c8b3 ${hexByte(productionBytes.villageInvestment)}`,
      `> c8b4 ${hexByte(productionBytes.fortificationInvestment)}`,
      '> c8b0 04',
      `> c8ae ${hexByte(c64FortificationLevelForFortificationLevel(config.maxHomeFortificationLevel))}`,
      `> c8af ${hexByte(c64FortificationLevelForFortificationLevel(config.maxProvinceFortificationLevel))}`,
      `> c900 ${hexByte(config.villageCost)}`,
      `> c901 ${hexByte(config.interestRatePercent)}`,
      '> ca48 00',
      '> ca4b 04',
      '> ca4c 64',
      '> ca4d 46',
      '> ca55 00',
      `> c8b5 ${monitorBytes([scenario.provinceCount - playerCount, ...Array<number>(playerCount).fill(1)])}`,
      `> c8bc ${monitorBytes(Array<number>(playerCount).fill(config.startingMoney))}`,
      `> c9da ${monitorBytes(Array.from(
        { length: playerCount },
        (_, index) => index >= config.humanPlayerCount ? 1 : 0
      ))}`,
      '> 1156 60',
      '> 1a2b 60',
      '> 1ca0 60',
      '> 2028 a9 ff 60',
      '> 2ac5 60',
      '> 2aef 60',
      'r sp = ff',
      '> c000 20 e5 35 ea',
      'g c000',
      bsave(paths.initialCalendar, 0xc8a2, 0xc8a3),
      bsave(paths.initialWeather, 0xca4b, 0xca4d),
      'r sp = ff',
      '> c000 20 98 3a ea',
      'g c000',
      bsave(paths.initialIncomeMoneyLow, 0xc8bc, 0xc8bb + playerCount),
      bsave(paths.initialIncomeMoneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
      bsave(paths.initialIncomeMoneyHigh, 0xc8c6, 0xc8c5 + playerCount),
      bsave(paths.initialTurnRngCount, 0xc0fd, 0xc0fe),
      'r sp = ff',
      '> c000 20 03 58 ea',
      'g c000',
      bsave(paths.attackTarget, 0x1602, 0x1602),
      bsave(paths.attackFlags, 0xc833, 0xc832 + scenario.provinceCount),
      bsave(paths.attackRngCount, 0xc0fd, 0xc0fe)
    );
    if (expectedAttack.selection !== null) {
      commands.push(
        'enable 4',
        'enable 5',
        `bload "${mainPath}" 0 3000`,
        '> 1162 60',
        '> 1204 60',
        '> 1ca0 60',
        '> 1d7d 60',
        '> 1b3b 60',
        '> 1b69 60',
        '> 1fd5 60',
        '> 23fb 60',
        '> 2ac5 60',
        '> 2aef 60',
        '> 853a 60',
        '> 8856 60',
        '> 8c09 60',
        '> 8c71 60',
        '> 8c8e 60',
        '> 8905 60',
        '> 9a5d 60',
        '> cde9 60',
        '> ce00 60',
        'r sp = ff',
        '> c000 20 49 4a ea',
        'g c000',
        bsave(paths.battleSetup, 0x9400, 0x9408),
        bsave(paths.battleTables, 0x7e09, 0x7e2d),
        'g'
      );
    }
    commands.push(
      bsave(paths.battleOwners, 0xc5db, 0xc5da + scenario.provinceCount),
      bsave(paths.battleFortifications, 0xc63f, 0xc63e + scenario.provinceCount),
      bsave(paths.battleSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
      bsave(paths.battleSoldiersMiddle, 0xc76b, 0xc76a + scenario.provinceCount),
      bsave(paths.battleSoldiersHigh, 0xc7cf, 0xc7ce + scenario.provinceCount),
      bsave(paths.battleFlags, 0xc833, 0xc832 + scenario.provinceCount),
      bsave(paths.battleStateScratch, 0xc9d0, 0xc9d9),
      bsave(paths.battleKampfScratch, 0x9400, 0x9408),
      bsave(paths.battleRoundScratch, 0x92c2, 0x92c7),
      bsave(paths.battleRngRoutine, 0xc100, 0xc115),
      bsave(paths.battleRngCount, 0xc0fd, 0xc0fe)
    );
    if (expectedAttack.selection !== null) {
      commands.push('disable 4', 'disable 5', 'g');
    }
    commands.push(
      bsave(paths.fullAttackOwners, 0xc5db, 0xc5da + scenario.provinceCount),
      bsave(paths.fullAttackFortifications, 0xc63f, 0xc63e + scenario.provinceCount),
      bsave(paths.fullAttackSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
      bsave(paths.fullAttackSoldiersMiddle, 0xc76b, 0xc76a + scenario.provinceCount),
      bsave(paths.fullAttackSoldiersHigh, 0xc7cf, 0xc7ce + scenario.provinceCount),
      bsave(paths.fullAttackRngCount, 0xc0fd, 0xc0fe)
    );
    commands.push(
      'r sp = ff',
      '> c000 20 06 58 ea',
      'g c000',
      bsave(paths.movementOwners, 0xc5db, 0xc5da + scenario.provinceCount),
      bsave(paths.movementFortifications, 0xc63f, 0xc63e + scenario.provinceCount),
      bsave(paths.movementSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
      bsave(paths.movementSoldiersMiddle, 0xc76b, 0xc76a + scenario.provinceCount),
      bsave(paths.movementSoldiersHigh, 0xc7cf, 0xc7ce + scenario.provinceCount),
      bsave(paths.movementMoneyLow, 0xc8bc, 0xc8bb + playerCount),
      bsave(paths.movementMoneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
      bsave(paths.movementMoneyHigh, 0xc8c6, 0xc8c5 + playerCount),
      bsave(paths.movementOwnerCounts, 0xc8b5, 0xc8b5 + playerCount),
      bsave(paths.movementMemory, 0xc9d0, 0xc9f9),
      bsave(paths.movementRngCount, 0xc0fd, 0xc0fe),
      'r sp = ff',
      '> c000 20 00 58 ea',
      'g c000',
      bsave(paths.economyOwners, 0xc5db, 0xc5da + scenario.provinceCount),
      bsave(paths.economyFortifications, 0xc63f, 0xc63e + scenario.provinceCount),
      bsave(paths.economyVillages, 0xc6a3, 0xc6a2 + scenario.provinceCount),
      bsave(paths.economySoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
      bsave(paths.economySoldiersMiddle, 0xc76b, 0xc76a + scenario.provinceCount),
      bsave(paths.economySoldiersHigh, 0xc7cf, 0xc7ce + scenario.provinceCount),
      bsave(paths.economyMoneyLow, 0xc8bc, 0xc8bb + playerCount),
      bsave(paths.economyMoneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
      bsave(paths.economyMoneyHigh, 0xc8c6, 0xc8c5 + playerCount),
      bsave(paths.economyMemory, 0xc9d0, 0xc9f9),
      bsave(paths.economyRngCount, 0xc0fd, 0xc0fe)
    );
    if (scenario.extendedBaronRound === true) {
      for (let player = 2; player <= 3; player += 1) {
        commands.push(
          `> 1624 ${hexByte(player)}`,
          'r sp = ff',
          '> c000 20 98 3a ea',
          'g c000',
          'r sp = ff',
          '> c000 20 03 58 ea',
          'g c000'
        );
        if (player === 3) {
          commands.push(
            bsave(paths.player3AttackOwners, 0xc5db, 0xc5da + scenario.provinceCount),
            bsave(paths.player3AttackFortifications, 0xc63f, 0xc63e + scenario.provinceCount),
            bsave(paths.player3AttackSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
            bsave(paths.player3AttackMoneyLow, 0xc8bc, 0xc8bb + playerCount),
            bsave(paths.player3AttackRngCount, 0xc0fd, 0xc0fe)
          );
        }
        commands.push(
          'r sp = ff',
          '> c000 20 06 58 ea',
          'g c000'
        );
        if (player === 3) {
          commands.push(
            bsave(paths.player3MovementOwners, 0xc5db, 0xc5da + scenario.provinceCount),
            bsave(paths.player3MovementFortifications, 0xc63f, 0xc63e + scenario.provinceCount),
            bsave(paths.player3MovementSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
            bsave(paths.player3MovementMoneyLow, 0xc8bc, 0xc8bb + playerCount),
            bsave(paths.player3MovementRngCount, 0xc0fd, 0xc0fe)
          );
        }
        commands.push(
          'r sp = ff',
          '> c000 20 00 58 ea',
          'g c000'
        );
        if (player === 2) {
          commands.push(
            bsave(paths.player2Owners, 0xc5db, 0xc5da + scenario.provinceCount),
            bsave(paths.player2Fortifications, 0xc63f, 0xc63e + scenario.provinceCount),
            bsave(paths.player2Villages, 0xc6a3, 0xc6a2 + scenario.provinceCount),
            bsave(paths.player2SoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
            bsave(paths.player2SoldiersMiddle, 0xc76b, 0xc76a + scenario.provinceCount),
            bsave(paths.player2SoldiersHigh, 0xc7cf, 0xc7ce + scenario.provinceCount),
            bsave(paths.player2MoneyLow, 0xc8bc, 0xc8bb + playerCount),
            bsave(paths.player2MoneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
            bsave(paths.player2MoneyHigh, 0xc8c6, 0xc8c5 + playerCount),
            bsave(paths.player2RngCount, 0xc0fd, 0xc0fe)
          );
        }
      }
      commands.push(
        bsave(paths.extendedOwners, 0xc5db, 0xc5da + scenario.provinceCount),
        bsave(paths.extendedFortifications, 0xc63f, 0xc63e + scenario.provinceCount),
        bsave(paths.extendedVillages, 0xc6a3, 0xc6a2 + scenario.provinceCount),
        bsave(paths.extendedSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
        bsave(paths.extendedSoldiersMiddle, 0xc76b, 0xc76a + scenario.provinceCount),
        bsave(paths.extendedSoldiersHigh, 0xc7cf, 0xc7ce + scenario.provinceCount),
        bsave(paths.extendedMoneyLow, 0xc8bc, 0xc8bb + playerCount),
        bsave(paths.extendedMoneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
        bsave(paths.extendedMoneyHigh, 0xc8c6, 0xc8c5 + playerCount),
        bsave(paths.extendedRngCount, 0xc0fd, 0xc0fe)
      );
      commands.push(
        '> 1624 04',
        'r sp = ff',
        '> c000 20 98 3a ea',
        'g c000',
        'r sp = ff',
        '> c000 20 03 58 ea',
        'g c000',
        'enable 6',
        'r sp = ff',
        '> c000 20 06 58 ea',
        'g c000',
        bsave(paths.player4PreCleanupSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
        bsave(paths.player4PreCleanupFlags, 0xc833, 0xc832 + scenario.provinceCount),
        'disable 6',
        'g',
        'r sp = ff',
        '> c000 20 00 58 ea',
        'g c000',
        bsave(paths.preWorldOwners, 0xc5db, 0xc5da + scenario.provinceCount),
        bsave(paths.preWorldSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
        bsave(paths.preWorldRngCount, 0xc0fd, 0xc0fe),
        '> 1624 00',
        '> 0044 00 04',
      );
      if (config.royalistAttitude === 'hostile') {
        commands.push(
          'r sp = ff',
          '> c000 20 03 7e ea',
          'g c000',
          bsave(paths.royalistAttackOwners, 0xc5db, 0xc5da + scenario.provinceCount),
          bsave(paths.royalistAttackSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
          bsave(paths.royalistAttackRngCount, 0xc0fd, 0xc0fe)
        );
      }
      commands.push(
        'r sp = ff',
        '> c000 20 09 52 ea',
        'g c000',
        'r sp = ff',
        '> c000 20 d3 50 ea',
        'g c000',
        bsave(paths.worldOwners, 0xc5db, 0xc5da + scenario.provinceCount),
        bsave(paths.worldFortifications, 0xc63f, 0xc63e + scenario.provinceCount),
        bsave(paths.worldVillages, 0xc6a3, 0xc6a2 + scenario.provinceCount),
        bsave(paths.worldSoldiersLow, 0xc707, 0xc706 + scenario.provinceCount),
        bsave(paths.worldSoldiersMiddle, 0xc76b, 0xc76a + scenario.provinceCount),
        bsave(paths.worldSoldiersHigh, 0xc7cf, 0xc7ce + scenario.provinceCount),
        bsave(paths.worldMoneyLow, 0xc8bc, 0xc8bb + playerCount),
        bsave(paths.worldMoneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
        bsave(paths.worldMoneyHigh, 0xc8c6, 0xc8c5 + playerCount),
        bsave(paths.worldVillageBuckets, 0xc903, 0xc902 + scenario.provinceCount),
        bsave(paths.worldFortBuckets, 0xc967, 0xc966 + scenario.provinceCount),
        bsave(paths.worldRngCount, 0xc0fd, 0xc0fe),
        'r sp = ff',
        '> c000 20 e5 35 ea',
        'g c000',
        bsave(paths.nextRoundCalendar, 0xc8a2, 0xc8a3),
        bsave(paths.nextRoundWeather, 0xca4b, 0xca4d),
        '> 1624 01',
        'r sp = ff',
        '> c000 20 98 3a ea',
        'g c000',
        bsave(paths.nextRoundIncomeMoneyLow, 0xc8bc, 0xc8bb + playerCount),
        bsave(paths.nextRoundIncomeMoneyMiddle, 0xc8c1, 0xc8c0 + playerCount),
        bsave(paths.nextRoundIncomeMoneyHigh, 0xc8c6, 0xc8c5 + playerCount),
        bsave(paths.nextRoundRngCount, 0xc0fd, 0xc0fe)
      );
    }
  }
  commands.push('quit');
  return commands;
}

function c64ProvinceNumber(provinceId: string): number {
  const match = /^province-(\d+)$/.exec(provinceId);
  if (match === null) {
    throw new Error(`Active C64 map has invalid province id ${provinceId}.`);
  }
  return Number(match[1]);
}

function mapBytes(map: ProvinceMapState): ReadonlyArray<number> {
  return map.tiles.map((tile) => tile.provinceId === null ? 0 : c64ProvinceNumber(tile.provinceId));
}

function provinceBytes(
  map: ProvinceMapState,
  value: (province: ProvinceMapState['provinces'][number]) => number
): ReadonlyArray<number> {
  const bytes = Array<number>(map.provinces.length + 1).fill(0);
  for (const province of map.provinces) {
    bytes[c64ProvinceNumber(province.id)] = value(province);
  }
  return bytes;
}

function rngStateAfter(seed: number, consumed: number): number {
  if (consumed > RNG_TAPE_LENGTH) {
    throw new Error(`C64 consumed ${consumed} RNG bytes, exceeding tape length ${RNG_TAPE_LENGTH}.`);
  }
  let rngState = normalizeRngSeed(seed);
  for (let index = 0; index < consumed; index += 1) {
    rngState = nextRngByte(rngState).rngState;
  }
  return rngState;
}

interface TypeScriptHomeSelectionResult {
  readonly state: GameState;
  readonly selectedHomes: ReadonlyArray<number>;
}

function runTypeScriptHomeSelection(
  scenario: MapParityScenario,
  config: GameConfig
): TypeScriptHomeSelectionResult {
  let state = createInitialState(scenario.seed, config);
  const selectedHomes: number[] = [];
  while (state.phase === 'home-selection') {
    const playerId = state.activePlayerId;
    const action = chooseC64OriginalAiAction(createPlayerView(state, playerId, config), config);
    if (action.type !== 'select-home') {
      throw new Error(`${scenarioId(scenario)} C64 AI did not select a home province.`);
    }
    selectedHomes.push(c64ProvinceNumber(action.provinceId));
    state = selectHomeProvince(state, playerId, action.provinceId, config);
  }
  return { state, selectedHomes };
}

function c64OwnerSlots(
  state: GameState,
  config: GameConfig
): ReadonlyArray<C64CbaronOwnerSlot> {
  return [
    { ownerId: ROYALIST_OWNER_ID, isComputer: false },
    ...state.players.map((player, index) => ({
      ownerId: player.id,
      isComputer: index >= config.humanPlayerCount
    }))
  ];
}

function c64AttackPlayerSlots(state: GameState): ReadonlyArray<C64CbaronAttackPlayerSlot> {
  return state.players.map((player) => ({
    ownerId: player.id,
    homeProvinceId: player.homeProvinceId,
    provinceCount: state.map.provinces.filter((province) => province.ownerId === player.id).length
  }));
}

function rngBytes(initialRngState: number, count: number): ReadonlyArray<number> {
  let rngState = initialRngState;
  return Array.from({ length: count }, () => {
    const next = nextRngByte(rngState);
    rngState = next.rngState;
    return next.byte;
  });
}

function runTypeScriptInitialAttack(
  state: GameState,
  config: GameConfig
): C64CbaronAttackResult {
  const activePlayer = state.players.find((player) => player.id === state.activePlayerId);
  if (activePlayer === undefined) {
    throw new Error(`Missing active C64 attack player ${state.activePlayerId}.`);
  }
  return runC64CbaronAttack({
    provinces: state.map.provinces,
    activeOwnerId: state.activePlayerId,
    activeMoney: activePlayer.money,
    ownerSlots: c64OwnerSlots(state, config),
    playerSlots: c64AttackPlayerSlots(state),
    lockedProvinceIds: [],
    rngBytes: rngBytes(state.rngState, state.map.provinces.length),
    config
  });
}

function runTypeScriptInitialBattle(state: GameState, config: GameConfig): GameState {
  let current: GameState = {
    ...state,
    turnStep: 'attack'
  };
  const attackResult = applyPlayerAction(
    current,
    current.activePlayerId,
    { type: 'run-c64-baron-attack' },
    config
  );
  current = attackResult.state;
  while (current.battle !== null) {
    current = applyPlayerAction(
      current,
      current.activePlayerId,
      { type: 'run-c64-battle-command' },
      config
    ).state;
  }
  return current;
}

function runTypeScriptAttackPhase(state: GameState, config: GameConfig): GameState {
  let current: GameState = {
    ...state,
    turnStep: 'attack'
  };
  while (current.turnStep === 'attack') {
    current = applyPlayerAction(
      current,
      current.activePlayerId,
      { type: 'run-c64-baron-attack' },
      config
    ).state;
    while (current.battle !== null) {
      current = applyPlayerAction(
        current,
        current.activePlayerId,
        { type: 'run-c64-battle-command' },
        config
      ).state;
    }
  }
  return current;
}

function runTypeScriptMovementPhase(state: GameState, config: GameConfig): GameState {
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'run-c64-baron-movement' },
    config
  ).state;
}

function runTypeScriptEconomyPhase(state: GameState, config: GameConfig): GameState {
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'run-c64-baron-economy' },
    config
  ).state;
}

function runTypeScriptNewMonthPhase(state: GameState, config: GameConfig): GameState {
  if (state.turnStep !== 'new-month') {
    throw new Error(
      `C64 new-month parity phase requires new-month state, got ${state.turnStep}.`
    );
  }
  return applyPlayerAction(
    state,
    state.activePlayerId,
    { type: 'advance-step' },
    config
  ).state;
}

function runTypeScriptBaronTurn(
  state: GameState,
  config: GameConfig
): GameState {
  const newMonthState = runTypeScriptNewMonthPhase(state, config);
  const attackState = runTypeScriptAttackPhase(
    {
      ...newMonthState,
      turnStep: 'attack'
    },
    config
  );
  return runTypeScriptEconomyPhase(runTypeScriptMovementPhase(attackState, config), config);
}

function runTypeScriptBaronTurnBeforeWorldPhase(
  state: GameState,
  config: GameConfig
): GameState {
  const newMonthState = runTypeScriptNewMonthPhase(state, config);
  const attackState = runTypeScriptAttackPhase(
    {
      ...newMonthState,
      turnStep: 'attack'
    },
    config
  );
  const movementState = runTypeScriptMovementPhase(attackState, config);
  return runC64CbaronEconomy({
    state: movementState,
    activePlayerId: movementState.activePlayerId,
    ownerSlots: c64OwnerSlots(movementState, config),
    config
  }).state;
}

function lowByte(value: number): number {
  return value & 0xff;
}

function middleByte(value: number): number {
  return Math.floor(value / 0x100) & 0xff;
}

function highByte(value: number): number {
  return Math.floor(value / 0x10000) & 0xff;
}

function ownerByte(ownerId: GameState['map']['provinces'][number]['ownerId']): number {
  return ownerId === 0 ? 0 : Number(ownerId.slice(1));
}

function stateOwnerBytes(state: GameState): ReadonlyArray<number> {
  return state.map.provinces.map((province) => ownerByte(province.ownerId));
}

function stateFortificationBytes(state: GameState): ReadonlyArray<number> {
  return state.map.provinces.map((province) =>
    c64FortificationLevelForFortificationLevel(province.fortificationLevel)
  );
}

function stateSoldierBytes(
  state: GameState,
  byte: (soldiers: number) => number
): ReadonlyArray<number> {
  return state.map.provinces.map((province) => byte(province.soldiers));
}

function stateMoneyBytes(
  state: GameState,
  byte: (money: number) => number
): ReadonlyArray<number> {
  return state.players.map((player) => byte(player.money));
}

function requireRngStateAtCount(
  label: string,
  state: GameState,
  path: string,
  scenario: MapParityScenario
): void {
  const countBytes = readSnapshot(path, 2);
  const count = (countBytes[0] ?? 0) | ((countBytes[1] ?? 0) << 8);
  const expectedRngState = rngStateAfter(scenario.seed, count);
  if (state.rngState !== expectedRngState) {
    throw new Error(
      `${label} RNG mismatch: C64 consumed ${count} total bytes, TypeScript ended at state ` +
      `${state.rngState} instead of ${expectedRngState}.`
    );
  }
}

function verifyScenario(directory: string, scenario: MapParityScenario): void {
  const config = scenarioConfig(scenario);
  const generated = generateProvinceMapWithRngState(
    config,
    scenario.seed
  );
  const paths = scenarioPaths(directory, scenario);
  requireEqualBytes(
    `${scenarioId(scenario)} visible map`,
    readSnapshot(paths.map, generated.map.width * generated.map.height),
    mapBytes(generated.map)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} terrain table`,
    readSnapshot(paths.terrain, scenario.provinceCount + 1),
    provinceBytes(generated.map, (province) => c64TerrainIdForTerrainId(province.terrainId))
  );
  requireEqualBytes(
    `${scenarioId(scenario)} village table`,
    readSnapshot(paths.villages, scenario.provinceCount + 1),
    provinceBytes(generated.map, (province) => province.villages)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} soldier table`,
    readSnapshot(paths.soldiers, scenario.provinceCount + 1),
    provinceBytes(generated.map, (province) => province.soldiers)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} owner table`,
    readSnapshot(paths.owners, scenario.provinceCount + 1),
    provinceBytes(generated.map, () => 0)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} fortification table`,
    readSnapshot(paths.fortifications, scenario.provinceCount + 1),
    provinceBytes(generated.map, () => 0)
  );
  const countBytes = readSnapshot(paths.rngCount, 2);
  const consumed = (countBytes[0] ?? 0) | ((countBytes[1] ?? 0) << 8);
  const expectedRngState = rngStateAfter(scenario.seed, consumed);
  if (generated.rngState !== expectedRngState) {
    throw new Error(
      `${scenarioId(scenario)} RNG consumption mismatch: C64 consumed ${consumed} bytes, ` +
      `TypeScript ended at state ${generated.rngState} instead of ${expectedRngState}.`
    );
  }

  const homeSelection = runTypeScriptHomeSelection(scenario, config);
  requireEqualBytes(
    `${scenarioId(scenario)} AI home selections`,
    readSnapshot(paths.selectedHomes, homeSelection.selectedHomes.length),
    homeSelection.selectedHomes
  );
  requireEqualBytes(
    `${scenarioId(scenario)} home province table`,
    readSnapshot(paths.homeProvinces, homeSelection.selectedHomes.length + 1),
    [0, ...homeSelection.selectedHomes]
  );
  requireEqualBytes(
    `${scenarioId(scenario)} final owner table`,
    readSnapshot(paths.finalOwners, scenario.provinceCount + 1),
    provinceBytes(homeSelection.state.map, (province) =>
      province.ownerId === 0 ? 0 : Number(province.ownerId.slice(1))
    )
  );
  requireEqualBytes(
    `${scenarioId(scenario)} final soldier table`,
    readSnapshot(paths.finalSoldiers, scenario.provinceCount + 1),
    provinceBytes(homeSelection.state.map, (province) => province.soldiers)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} final fortification table`,
    readSnapshot(paths.finalFortifications, scenario.provinceCount + 1),
    provinceBytes(homeSelection.state.map, (province) =>
      province.fortificationLevel === 'castle' ? 3 : 0
    )
  );
  const initialTurnState = runTypeScriptNewMonthPhase(homeSelection.state, config);
  requireEqualBytes(
    `${scenarioId(scenario)} initial C64 calendar`,
    readSnapshot(paths.initialCalendar, 2),
    [initialTurnState.c64.calendar.year, initialTurnState.c64.calendar.month]
  );
  requireEqualBytes(
    `${scenarioId(scenario)} initial C64 weather`,
    readSnapshot(paths.initialWeather, 3),
    [
      initialTurnState.c64.calendar.weatherIndex,
      initialTurnState.c64.calendar.weatherFactor,
      initialTurnState.c64.calendar.weatherDerived
    ]
  );
  requireEqualBytes(
    `${scenarioId(scenario)} initial income money low bytes`,
    readSnapshot(paths.initialIncomeMoneyLow, initialTurnState.players.length),
    stateMoneyBytes(initialTurnState, lowByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} initial income money middle bytes`,
    readSnapshot(paths.initialIncomeMoneyMiddle, initialTurnState.players.length),
    stateMoneyBytes(initialTurnState, middleByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} initial income money high bytes`,
    readSnapshot(paths.initialIncomeMoneyHigh, initialTurnState.players.length),
    stateMoneyBytes(initialTurnState, highByte)
  );
  requireRngStateAtCount(
    `${scenarioId(scenario)} initial month and income`,
    initialTurnState,
    paths.initialTurnRngCount,
    scenario
  );
  const initialCountBytes = readSnapshot(paths.initialTurnRngCount, 2);
  const initialRngCount = (initialCountBytes[0] ?? 0) | ((initialCountBytes[1] ?? 0) << 8);
  const attack = runTypeScriptInitialAttack(initialTurnState, config);
  requireEqualBytes(
    `${scenarioId(scenario)} first cbaron attack target`,
    readSnapshot(paths.attackTarget, 1),
    [attack.selection === null ? 0 : c64ProvinceNumber(attack.selection.targetProvinceId)]
  );
  requireEqualBytes(
    `${scenarioId(scenario)} first cbaron attack flags`,
    readSnapshot(paths.attackFlags, scenario.provinceCount),
    homeSelection.state.map.provinces.map((province) => attack.flagsByProvinceId[province.id] ?? 0)
  );
  const attackCountBytes = readSnapshot(paths.attackRngCount, 2);
  const attackRngCount = (attackCountBytes[0] ?? 0) | ((attackCountBytes[1] ?? 0) << 8);
  if (attackRngCount - initialRngCount !== attack.rngBytesConsumed) {
    throw new Error(
      `${scenarioId(scenario)} first cbaron attack RNG mismatch: C64 consumed ` +
      `${attackRngCount - initialRngCount}, TypeScript consumed ${attack.rngBytesConsumed}.`
    );
  }
  const battleState = runTypeScriptInitialBattle(initialTurnState, config);
  requireEqualBytes(
    `${scenarioId(scenario)} first cbaron battle owner table`,
    readSnapshot(paths.battleOwners, scenario.provinceCount),
    battleState.map.provinces.map((province) =>
      province.ownerId === 0 ? 0 : Number(province.ownerId.slice(1))
    )
  );
  requireEqualBytes(
    `${scenarioId(scenario)} first cbaron battle fortification table`,
    readSnapshot(paths.battleFortifications, scenario.provinceCount),
    battleState.map.provinces.map((province) =>
      province.fortificationLevel === 'castle' ? 3 : 0
    )
  );
  requireEqualBytes(
    `${scenarioId(scenario)} first cbaron battle soldier low bytes`,
    readSnapshot(paths.battleSoldiersLow, scenario.provinceCount),
    battleState.map.provinces.map((province) => lowByte(province.soldiers))
  );
  requireEqualBytes(
    `${scenarioId(scenario)} first cbaron battle soldier middle bytes`,
    readSnapshot(paths.battleSoldiersMiddle, scenario.provinceCount),
    battleState.map.provinces.map((province) => middleByte(province.soldiers))
  );
  requireEqualBytes(
    `${scenarioId(scenario)} first cbaron battle soldier high bytes`,
    readSnapshot(paths.battleSoldiersHigh, scenario.provinceCount),
    battleState.map.provinces.map((province) => highByte(province.soldiers))
  );
  const battleCountBytes = readSnapshot(paths.battleRngCount, 2);
  const battleRngCount = (battleCountBytes[0] ?? 0) | ((battleCountBytes[1] ?? 0) << 8);
  const expectedBattleRngState = rngStateAfter(scenario.seed, battleRngCount);
  if (battleState.rngState !== expectedBattleRngState) {
    throw new Error(
      `${scenarioId(scenario)} first cbaron battle RNG mismatch: C64 consumed ` +
      `${battleRngCount} total bytes, TypeScript ended at state ${battleState.rngState} ` +
      `instead of ${expectedBattleRngState}.`
    );
  }
  const fullAttackState = runTypeScriptAttackPhase(initialTurnState, config);
  requireEqualBytes(
    `${scenarioId(scenario)} full cbaron attack owner table`,
    readSnapshot(paths.fullAttackOwners, scenario.provinceCount),
    fullAttackState.map.provinces.map((province) =>
      province.ownerId === 0 ? 0 : Number(province.ownerId.slice(1))
    )
  );
  requireEqualBytes(
    `${scenarioId(scenario)} full cbaron attack fortification table`,
    readSnapshot(paths.fullAttackFortifications, scenario.provinceCount),
    fullAttackState.map.provinces.map((province) =>
      province.fortificationLevel === 'castle' ? 3 : 0
    )
  );
  requireEqualBytes(
    `${scenarioId(scenario)} full cbaron attack soldier low bytes`,
    readSnapshot(paths.fullAttackSoldiersLow, scenario.provinceCount),
    fullAttackState.map.provinces.map((province) => lowByte(province.soldiers))
  );
  requireEqualBytes(
    `${scenarioId(scenario)} full cbaron attack soldier middle bytes`,
    readSnapshot(paths.fullAttackSoldiersMiddle, scenario.provinceCount),
    fullAttackState.map.provinces.map((province) => middleByte(province.soldiers))
  );
  requireEqualBytes(
    `${scenarioId(scenario)} full cbaron attack soldier high bytes`,
    readSnapshot(paths.fullAttackSoldiersHigh, scenario.provinceCount),
    fullAttackState.map.provinces.map((province) => highByte(province.soldiers))
  );
  const fullAttackCountBytes = readSnapshot(paths.fullAttackRngCount, 2);
  const fullAttackRngCount =
    (fullAttackCountBytes[0] ?? 0) | ((fullAttackCountBytes[1] ?? 0) << 8);
  const expectedFullAttackRngState = rngStateAfter(scenario.seed, fullAttackRngCount);
  if (fullAttackState.rngState !== expectedFullAttackRngState) {
    throw new Error(
      `${scenarioId(scenario)} full cbaron attack RNG mismatch: C64 consumed ` +
      `${fullAttackRngCount} total bytes, TypeScript ended at state ${fullAttackState.rngState} ` +
      `instead of ${expectedFullAttackRngState}.`
    );
  }
  const movementState = runTypeScriptMovementPhase(fullAttackState, config);
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron movement owner table`,
    readSnapshot(paths.movementOwners, scenario.provinceCount),
    stateOwnerBytes(movementState)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron movement fortification table`,
    readSnapshot(paths.movementFortifications, scenario.provinceCount),
    stateFortificationBytes(movementState)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron movement soldier low bytes`,
    readSnapshot(paths.movementSoldiersLow, scenario.provinceCount),
    stateSoldierBytes(movementState, lowByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron movement soldier middle bytes`,
    readSnapshot(paths.movementSoldiersMiddle, scenario.provinceCount),
    stateSoldierBytes(movementState, middleByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron movement soldier high bytes`,
    readSnapshot(paths.movementSoldiersHigh, scenario.provinceCount),
    stateSoldierBytes(movementState, highByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron movement money low bytes`,
    readSnapshot(paths.movementMoneyLow, movementState.players.length),
    stateMoneyBytes(movementState, lowByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron movement money middle bytes`,
    readSnapshot(paths.movementMoneyMiddle, movementState.players.length),
    stateMoneyBytes(movementState, middleByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron movement money high bytes`,
    readSnapshot(paths.movementMoneyHigh, movementState.players.length),
    stateMoneyBytes(movementState, highByte)
  );
  requireRngStateAtCount(
    `${scenarioId(scenario)} cbaron movement`,
    movementState,
    paths.movementRngCount,
    scenario
  );

  const economyState = runTypeScriptEconomyPhase(movementState, config);
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy owner table`,
    readSnapshot(paths.economyOwners, scenario.provinceCount),
    stateOwnerBytes(economyState)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy fortification table`,
    readSnapshot(paths.economyFortifications, scenario.provinceCount),
    stateFortificationBytes(economyState)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy village table`,
    readSnapshot(paths.economyVillages, scenario.provinceCount),
    economyState.map.provinces.map((province) => province.villages)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy soldier low bytes`,
    readSnapshot(paths.economySoldiersLow, scenario.provinceCount),
    stateSoldierBytes(economyState, lowByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy soldier middle bytes`,
    readSnapshot(paths.economySoldiersMiddle, scenario.provinceCount),
    stateSoldierBytes(economyState, middleByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy soldier high bytes`,
    readSnapshot(paths.economySoldiersHigh, scenario.provinceCount),
    stateSoldierBytes(economyState, highByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy money low bytes`,
    readSnapshot(paths.economyMoneyLow, economyState.players.length),
    stateMoneyBytes(economyState, lowByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy money middle bytes`,
    readSnapshot(paths.economyMoneyMiddle, economyState.players.length),
    stateMoneyBytes(economyState, middleByte)
  );
  requireEqualBytes(
    `${scenarioId(scenario)} cbaron economy money high bytes`,
    readSnapshot(paths.economyMoneyHigh, economyState.players.length),
    stateMoneyBytes(economyState, highByte)
  );
  requireRngStateAtCount(
    `${scenarioId(scenario)} cbaron economy`,
    economyState,
    paths.economyRngCount,
    scenario
  );

  if (scenario.extendedBaronRound === true) {
    let extendedState = economyState;
    for (let player = 2; player <= 3; player += 1) {
      if (extendedState.activePlayerId !== `p${player}`) {
        throw new Error(
          `${scenarioId(scenario)} expected active player p${player}, got ` +
          `${extendedState.activePlayerId}.`
        );
      }
      if (player === 2) {
        extendedState = runTypeScriptBaronTurn(extendedState, config);
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 owner table`,
          readSnapshot(paths.player2Owners, scenario.provinceCount),
          stateOwnerBytes(extendedState)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 fortification table`,
          readSnapshot(paths.player2Fortifications, scenario.provinceCount),
          stateFortificationBytes(extendedState)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 village table`,
          readSnapshot(paths.player2Villages, scenario.provinceCount),
          extendedState.map.provinces.map((province) => province.villages)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 soldier low bytes`,
          readSnapshot(paths.player2SoldiersLow, scenario.provinceCount),
          stateSoldierBytes(extendedState, lowByte)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 soldier middle bytes`,
          readSnapshot(paths.player2SoldiersMiddle, scenario.provinceCount),
          stateSoldierBytes(extendedState, middleByte)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 soldier high bytes`,
          readSnapshot(paths.player2SoldiersHigh, scenario.provinceCount),
          stateSoldierBytes(extendedState, highByte)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 money low bytes`,
          readSnapshot(paths.player2MoneyLow, extendedState.players.length),
          stateMoneyBytes(extendedState, lowByte)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 money middle bytes`,
          readSnapshot(paths.player2MoneyMiddle, extendedState.players.length),
          stateMoneyBytes(extendedState, middleByte)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 2 money high bytes`,
          readSnapshot(paths.player2MoneyHigh, extendedState.players.length),
          stateMoneyBytes(extendedState, highByte)
        );
        requireRngStateAtCount(
          `${scenarioId(scenario)} player 2 cbaron turn`,
          extendedState,
          paths.player2RngCount,
          scenario
        );
      } else {
        const player3NewMonthState = runTypeScriptNewMonthPhase(extendedState, config);
        const player3AttackState = runTypeScriptAttackPhase(
          {
            ...player3NewMonthState,
            turnStep: 'attack'
          },
          config
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 3 attack owner table`,
          readSnapshot(paths.player3AttackOwners, scenario.provinceCount),
          stateOwnerBytes(player3AttackState)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 3 attack fortification table`,
          readSnapshot(paths.player3AttackFortifications, scenario.provinceCount),
          stateFortificationBytes(player3AttackState)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 3 attack soldier low bytes`,
          readSnapshot(paths.player3AttackSoldiersLow, scenario.provinceCount),
          stateSoldierBytes(player3AttackState, lowByte)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 3 attack money low bytes`,
          readSnapshot(paths.player3AttackMoneyLow, player3AttackState.players.length),
          stateMoneyBytes(player3AttackState, lowByte)
        );
        requireRngStateAtCount(
          `${scenarioId(scenario)} player 3 attack`,
          player3AttackState,
          paths.player3AttackRngCount,
          scenario
        );

        const player3MovementState = runTypeScriptMovementPhase(player3AttackState, config);
        requireEqualBytes(
          `${scenarioId(scenario)} player 3 movement owner table`,
          readSnapshot(paths.player3MovementOwners, scenario.provinceCount),
          stateOwnerBytes(player3MovementState)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 3 movement fortification table`,
          readSnapshot(paths.player3MovementFortifications, scenario.provinceCount),
          stateFortificationBytes(player3MovementState)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 3 movement soldier low bytes`,
          readSnapshot(paths.player3MovementSoldiersLow, scenario.provinceCount),
          stateSoldierBytes(player3MovementState, lowByte)
        );
        requireEqualBytes(
          `${scenarioId(scenario)} player 3 movement money low bytes`,
          readSnapshot(paths.player3MovementMoneyLow, player3MovementState.players.length),
          stateMoneyBytes(player3MovementState, lowByte)
        );
        requireRngStateAtCount(
          `${scenarioId(scenario)} player 3 movement`,
          player3MovementState,
          paths.player3MovementRngCount,
          scenario
        );
        extendedState = runTypeScriptEconomyPhase(player3MovementState, config);
      }
    }
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron owner table`,
      readSnapshot(paths.extendedOwners, scenario.provinceCount),
      stateOwnerBytes(extendedState)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron fortification table`,
      readSnapshot(paths.extendedFortifications, scenario.provinceCount),
      stateFortificationBytes(extendedState)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron village table`,
      readSnapshot(paths.extendedVillages, scenario.provinceCount),
      extendedState.map.provinces.map((province) => province.villages)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron soldier low bytes`,
      readSnapshot(paths.extendedSoldiersLow, scenario.provinceCount),
      stateSoldierBytes(extendedState, lowByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron soldier middle bytes`,
      readSnapshot(paths.extendedSoldiersMiddle, scenario.provinceCount),
      stateSoldierBytes(extendedState, middleByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron soldier high bytes`,
      readSnapshot(paths.extendedSoldiersHigh, scenario.provinceCount),
      stateSoldierBytes(extendedState, highByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron money low bytes`,
      readSnapshot(paths.extendedMoneyLow, extendedState.players.length),
      stateMoneyBytes(extendedState, lowByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron money middle bytes`,
      readSnapshot(paths.extendedMoneyMiddle, extendedState.players.length),
      stateMoneyBytes(extendedState, middleByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} extended cbaron money high bytes`,
      readSnapshot(paths.extendedMoneyHigh, extendedState.players.length),
      stateMoneyBytes(extendedState, highByte)
    );
    requireRngStateAtCount(
      `${scenarioId(scenario)} extended cbaron round`,
      extendedState,
      paths.extendedRngCount,
      scenario
    );

    const beforeWorldState = runTypeScriptBaronTurnBeforeWorldPhase(extendedState, config);
    requireEqualBytes(
      `${scenarioId(scenario)} pre-world owner table`,
      readSnapshot(paths.preWorldOwners, scenario.provinceCount),
      stateOwnerBytes(beforeWorldState)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} pre-world soldier low bytes`,
      readSnapshot(paths.preWorldSoldiersLow, scenario.provinceCount),
      stateSoldierBytes(beforeWorldState, lowByte)
    );
    requireRngStateAtCount(
      `${scenarioId(scenario)} pre-world state`,
      beforeWorldState,
      paths.preWorldRngCount,
      scenario
    );

    const afterRoyalistAttackState = config.royalistAttitude === 'hostile'
      ? runHostileRoyalistAttackPhase(beforeWorldState, config).state
      : beforeWorldState;
    if (config.royalistAttitude === 'hostile') {
      requireEqualBytes(
        `${scenarioId(scenario)} hostile royalist attack owner table`,
        readSnapshot(paths.royalistAttackOwners, scenario.provinceCount),
        stateOwnerBytes(afterRoyalistAttackState)
      );
      requireEqualBytes(
        `${scenarioId(scenario)} hostile royalist attack soldier low bytes`,
        readSnapshot(paths.royalistAttackSoldiersLow, scenario.provinceCount),
        stateSoldierBytes(afterRoyalistAttackState, lowByte)
      );
      requireRngStateAtCount(
        `${scenarioId(scenario)} hostile royalist attack`,
        afterRoyalistAttackState,
        paths.royalistAttackRngCount,
        scenario
      );
    }
    const worldState = runRoyalistWorldPhase(afterRoyalistAttackState, config).state;
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world owner table`,
      readSnapshot(paths.worldOwners, scenario.provinceCount),
      stateOwnerBytes(worldState)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world fortification table`,
      readSnapshot(paths.worldFortifications, scenario.provinceCount),
      stateFortificationBytes(worldState)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world village table`,
      readSnapshot(paths.worldVillages, scenario.provinceCount),
      worldState.map.provinces.map((province) => province.villages)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world soldier low bytes`,
      readSnapshot(paths.worldSoldiersLow, scenario.provinceCount),
      stateSoldierBytes(worldState, lowByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world soldier middle bytes`,
      readSnapshot(paths.worldSoldiersMiddle, scenario.provinceCount),
      stateSoldierBytes(worldState, middleByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world soldier high bytes`,
      readSnapshot(paths.worldSoldiersHigh, scenario.provinceCount),
      stateSoldierBytes(worldState, highByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world money low bytes`,
      readSnapshot(paths.worldMoneyLow, worldState.players.length),
      stateMoneyBytes(worldState, lowByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world money middle bytes`,
      readSnapshot(paths.worldMoneyMiddle, worldState.players.length),
      stateMoneyBytes(worldState, middleByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world money high bytes`,
      readSnapshot(paths.worldMoneyHigh, worldState.players.length),
      stateMoneyBytes(worldState, highByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world village buckets`,
      readSnapshot(paths.worldVillageBuckets, scenario.provinceCount),
      worldState.c64.royalistProvinceMemory.map((memory) => memory.villageInvestmentBucket)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} royalist world fortification buckets`,
      readSnapshot(paths.worldFortBuckets, scenario.provinceCount),
      worldState.c64.royalistProvinceMemory.map(
        (memory) => memory.fortificationInvestmentBucket
      )
    );
    requireRngStateAtCount(
      `${scenarioId(scenario)} royalist world phase`,
      worldState,
      paths.worldRngCount,
      scenario
    );

    if (!worldState.map.provinces.some((province) => province.ownerId === 'p1')) {
      throw new Error(`${scenarioId(scenario)} next-round fixture requires live player p1.`);
    }
    const nextRoundState = runTypeScriptNewMonthPhase({
      ...worldState,
      activePlayerId: 'p1',
      turnStep: 'new-month',
      turnNumber: worldState.turnNumber + 1,
      attackSpentProvinceIds: [],
      c64: {
        ...worldState.c64,
        calendar: {
          ...worldState.c64.calendar,
          monthWeatherPending: true
        }
      }
    }, config);
    requireEqualBytes(
      `${scenarioId(scenario)} next-round C64 calendar`,
      readSnapshot(paths.nextRoundCalendar, 2),
      [nextRoundState.c64.calendar.year, nextRoundState.c64.calendar.month]
    );
    requireEqualBytes(
      `${scenarioId(scenario)} next-round C64 weather`,
      readSnapshot(paths.nextRoundWeather, 3),
      [
        nextRoundState.c64.calendar.weatherIndex,
        nextRoundState.c64.calendar.weatherFactor,
        nextRoundState.c64.calendar.weatherDerived
      ]
    );
    requireEqualBytes(
      `${scenarioId(scenario)} next-round income money low bytes`,
      readSnapshot(paths.nextRoundIncomeMoneyLow, nextRoundState.players.length),
      stateMoneyBytes(nextRoundState, lowByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} next-round income money middle bytes`,
      readSnapshot(paths.nextRoundIncomeMoneyMiddle, nextRoundState.players.length),
      stateMoneyBytes(nextRoundState, middleByte)
    );
    requireEqualBytes(
      `${scenarioId(scenario)} next-round income money high bytes`,
      readSnapshot(paths.nextRoundIncomeMoneyHigh, nextRoundState.players.length),
      stateMoneyBytes(nextRoundState, highByte)
    );
    requireRngStateAtCount(
      `${scenarioId(scenario)} next-round month and income`,
      nextRoundState,
      paths.nextRoundRngCount,
      scenario
    );
  }
}

const baseline = verifyC64Baseline();
const directory = mkdtempSync(join(tmpdir(), 'wfc-c64-map-parity-'));
const monitorPath = join(directory, 'verify-map-seeds.mon');
writeMonitorCommands(
  monitorPath,
  monitorCommands(
    requireRawModulePath(baseline, 'kernal'),
    requireRawModulePath(baseline, 'menue'),
    requireRawModulePath(baseline, 'sys'),
    requireRawModulePath(baseline, 'main'),
    requireRawModulePath(baseline, 'cbaron'),
    requireRawModulePath(baseline, 'kampf'),
    directory
  )
);
runViceMonitor(monitorPath, 300_000_000);
for (const scenario of SCENARIOS) {
  verifyScenario(directory, scenario);
  process.stdout.write(`PASS ${scenarioId(scenario)}\n`);
}
rmSync(directory, { recursive: true });
process.stdout.write(`Verified ${SCENARIOS.length} active C64 setup parity scenarios.\n`);
