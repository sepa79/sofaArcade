import { writeFileSync } from 'node:fs';

import {
  c64FortificationLevelForFortificationLevel,
  c64TerrainIdForTerrainId
} from '../../src/game/c64-battle';
import { generateC64MapWithByteRng } from '../../src/game/c64-map-generator';
import { c64RankThreshold } from '../../src/game/c64-rank';
import { ROYALIST_OWNER_ID } from '../../src/game/owners';
import { nextRngByte, normalizeRngSeed } from '../../src/game/rng';
import type { GameConfig, GameState, PlayerId } from '../../src/game/types';
import { hexAddress, hexByte } from './bytes';

export interface C64ParityModulePaths {
  readonly cbaron: string;
  readonly kampf: string;
  readonly kernal: string;
  readonly main: string;
  readonly sys: string;
}

const RNG_TAPE_ADDRESS = 0x7000;
export const C64_RNG_TAPE_LENGTH = 8_000;

function playerNumber(playerId: PlayerId): number {
  const match = /^p(\d+)$/.exec(playerId);
  if (match === null) {
    throw new Error(`Invalid C64 player id ${playerId}.`);
  }
  return Number(match[1]);
}

function provinceNumber(provinceId: string): number {
  const match = /^province-(\d+)$/.exec(provinceId);
  if (match === null) {
    throw new Error(`Invalid active C64 province id ${provinceId}.`);
  }
  return Number(match[1]);
}

export function c64OwnerByte(
  ownerId: GameState['map']['provinces'][number]['ownerId']
): number {
  return ownerId === ROYALIST_OWNER_ID ? 0 : playerNumber(ownerId);
}

export function c64LowByte(value: number): number {
  return value & 0xff;
}

export function c64MiddleByte(value: number): number {
  return Math.floor(value / 0x100) & 0xff;
}

export function c64HighByte(value: number): number {
  return Math.floor(value / 0x10000) & 0xff;
}

function monitorBytes(bytes: ReadonlyArray<number>): string {
  return bytes.map(hexByte).join(' ');
}

export function c64Bsave(path: string, start: number, end: number): string {
  return `bsave "${path}" 0 ${hexAddress(start)} ${hexAddress(end)}`;
}

export function c64Call(address: number): ReadonlyArray<string> {
  return [
    'r sp = ff',
    `> c000 20 ${hexByte(address & 0xff)} ${hexByte(address >> 8)} ea`,
    'g c000'
  ];
}

function createRngTape(initialRngState: number): Uint8Array {
  let rngState = initialRngState;
  return Uint8Array.from({ length: C64_RNG_TAPE_LENGTH }, () => {
    const next = nextRngByte(rngState);
    rngState = next.rngState;
    return next.byte;
  });
}

function c64MapData(seed: number, config: GameConfig): {
  readonly seedTiles: ReadonlyArray<number>;
  readonly visibleMap: ReadonlyArray<number>;
} {
  let rngState = normalizeRngSeed(seed);
  return generateC64MapWithByteRng(config.provinceCount, {
    nextByte: () => {
      const next = nextRngByte(rngState);
      rngState = next.rngState;
      return next.byte;
    }
  });
}

export function createC64StateSetupCommands(
  state: GameState,
  config: GameConfig,
  tapePath: string,
  modulePaths: C64ParityModulePaths
): ReadonlyArray<string> {
  const mapData = c64MapData(state.seed, config);
  const provinceCount = state.map.provinces.length;
  const playerCount = state.players.length;
  const ownerCounts = [
    state.map.provinces.filter((province) => province.ownerId === ROYALIST_OWNER_ID).length,
    ...state.players.map((player) =>
      state.map.provinces.filter((province) => province.ownerId === player.id).length
    )
  ];
  const homes = state.players.map((player) => {
    if (player.homeProvinceId === null) {
      throw new Error(`Missing home province for ${player.id}.`);
    }
    return provinceNumber(player.homeProvinceId);
  });
  const productionTotal =
    config.royalistGrowthPercent +
    config.royalistInvestmentPercent +
    config.royalistFortificationInvestmentPercent;
  const villageInvestment = Math.floor(
    (config.royalistInvestmentPercent * 0x100) / productionTotal
  );
  const fortificationInvestment = Math.floor(
    (config.royalistFortificationInvestmentPercent * 0x100) / productionTotal
  );
  const computerFlags = state.players.map((_player, index) =>
    index < config.humanPlayerCount ? 0 : 1
  );
  const rememberedTargetIds = state.c64.playerMemory.map((memory) =>
    memory.rememberedTargetProvinceId === null
      ? 0
      : provinceNumber(memory.rememberedTargetProvinceId)
  );
  const rememberedTargetSoldiers = state.c64.playerMemory.map(
    (memory) => memory.rememberedTargetSoldiers
  );
  const hiredSoldiers = state.c64.playerMemory.map((memory) => memory.hiredSoldiers);
  const economyCarryoverMoney = state.c64.playerMemory.map(
    (memory) => memory.economyCarryoverMoney
  );
  const deserterOwner = state.c64.deserterOwnerId === null
    ? 0
    : playerNumber(state.c64.deserterOwnerId);

  writeFileSync(tapePath, createRngTape(state.rngState));
  return [
    `bload "${tapePath}" 0 ${hexAddress(RNG_TAPE_ADDRESS)}`,
    `bload "${modulePaths.kernal}" 0 0800`,
    `bload "${modulePaths.main}" 0 3000`,
    `bload "${modulePaths.cbaron}" 0 5800`,
    `bload "${modulePaths.kampf}" 0 7e00`,
    `bload "${modulePaths.sys}" 0 9400`,
    '> 218b 4c 00 c1',
    '> c100 ad 00 70 ee 01 c1 d0 03 ee 02 c1 ee fd c0 d0 03 ee fe c0 60',
    '> c101 00 70',
    'f c0fd c0fe 00',
    'f c400 ca80 00',
    `> c400 ${monitorBytes(mapData.visibleMap)}`,
    `> c512 ${monitorBytes(mapData.seedTiles)}`,
    `> c5da ${monitorBytes([0, ...state.map.provinces.map((province) => c64OwnerByte(province.ownerId))])}`,
    `> c576 ${monitorBytes([0, ...state.map.provinces.map((province) => c64TerrainIdForTerrainId(province.terrainId))])}`,
    `> c63e ${monitorBytes([0, ...state.map.provinces.map((province) => c64FortificationLevelForFortificationLevel(province.fortificationLevel))])}`,
    `> c6a2 ${monitorBytes([0, ...state.map.provinces.map((province) => province.villages)])}`,
    `> c706 ${monitorBytes([0, ...state.map.provinces.map((province) => c64LowByte(province.soldiers))])}`,
    `> c76a ${monitorBytes([0, ...state.map.provinces.map((province) => c64MiddleByte(province.soldiers))])}`,
    `> c7ce ${monitorBytes([0, ...state.map.provinces.map((province) => c64HighByte(province.soldiers))])}`,
    `> c8bb ${monitorBytes([0, ...state.players.map((player) => c64LowByte(player.money))])}`,
    `> c8c0 ${monitorBytes([0, ...state.players.map((player) => c64MiddleByte(player.money))])}`,
    `> c8c5 ${monitorBytes([0, ...state.players.map((player) => c64HighByte(player.money))])}`,
    `> c8b5 ${monitorBytes(ownerCounts)}`,
    `> c8cf ${monitorBytes([0, ...state.c64.playerMemory.map((memory) => memory.rank)])}`,
    `> c8fb ${monitorBytes([0, ...homes])}`,
    `> c903 ${monitorBytes(state.c64.royalistProvinceMemory.map((memory) => memory.villageInvestmentBucket))}`,
    `> c967 ${monitorBytes(state.c64.royalistProvinceMemory.map((memory) => memory.fortificationInvestmentBucket))}`,
    `> c9ca ${monitorBytes([0, 1, 2, 3, 4].map((rank) => c64RankThreshold(provinceCount, rank)))}`,
    `> c9d9 ${monitorBytes([0, ...computerFlags])}`,
    `> c9df ${monitorBytes(rememberedTargetIds)}`,
    `> c9e3 ${monitorBytes(rememberedTargetSoldiers.map(c64LowByte))}`,
    `> c9e7 ${monitorBytes(rememberedTargetSoldiers.map(c64MiddleByte))}`,
    `> c9eb ${monitorBytes(rememberedTargetSoldiers.map(c64HighByte))}`,
    `> c9ef ${monitorBytes(hiredSoldiers.map(c64LowByte))}`,
    `> c9f3 ${monitorBytes(hiredSoldiers.map(c64MiddleByte))}`,
    `> c9f7 ${monitorBytes(hiredSoldiers.map(c64HighByte))}`,
    `> ca61 ${monitorBytes(state.c64.ca61Bytes)}`,
    `> ca66 ${monitorBytes(economyCarryoverMoney.map(c64LowByte))}`,
    `> ca6a ${monitorBytes(economyCarryoverMoney.map(c64MiddleByte))}`,
    `> ca6e ${monitorBytes(economyCarryoverMoney.map(c64HighByte))}`,
    `> c8a1 ${hexByte(provinceCount)}`,
    `> c896 ${hexByte(playerCount)}`,
    `> c8a2 ${hexByte(state.c64.calendar.year)}`,
    `> c8a3 ${hexByte(state.c64.calendar.month)}`,
    `> c8a4 ${hexByte(config.randomEventsEnabled ? 7 : 0)}`,
    '> c8a5 01',
    '> c8a6 00',
    '> c8a7 01',
    '> c8a8 00',
    `> c8a9 ${hexByte(config.royalistGrowthPercent)}`,
    `> c8aa ${hexByte(config.maxVillages)}`,
    '> c8ab 00',
    '> c8ac 01',
    '> c8ad 03',
    '> c8ae 06',
    '> c8af 01',
    `> c8b0 ${hexByte(state.c64.royalistReinforcementTimer)}`,
    '> c8b1 01',
    `> c8b3 ${hexByte(villageInvestment)}`,
    `> c8b4 ${hexByte(fortificationInvestment)}`,
    `> c8ba ${hexByte(config.startingSoldiers)}`,
    `> c900 ${hexByte(config.villageCost)}`,
    `> c901 ${hexByte(config.interestRatePercent)}`,
    '> ca48 00',
    `> ca49 ${hexByte(state.c64.deserterSoldiers)} ${hexByte(deserterOwner)}`,
    `> ca4b ${monitorBytes([
      state.c64.calendar.weatherIndex,
      state.c64.calendar.weatherFactor,
      state.c64.calendar.weatherDerived
    ])}`,
    '> 1156 60',
    '> 1162 60',
    '> 1204 60',
    '> 1a2b 60',
    '> 1a85 60',
    '> 1ae5 60',
    '> 1b07 60',
    '> 1b0d 60',
    '> 1b3b 60',
    '> 1b69 60',
    '> 1ca0 60',
    '> 1d7d 60',
    '> 1fd5 60',
    '> 2028 a9 ff 60',
    '> 23fb 60',
    '> 2ac5 60',
    '> 2aef 60',
    '> 853a 60',
    '> 8856 60',
    '> 8905 60',
    '> 8c09 60',
    '> 8c71 60',
    '> 8c8e 60',
    '> 9a5d 60',
    '> cde9 60',
    '> ce00 60'
  ];
}
