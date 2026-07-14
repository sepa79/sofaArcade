import type { WarForCrownAiMode } from '../game/ai';
import { c64CombatSetupForProvince, type C64CombatSetup } from '../game/c64-battle';
import { calculateProvinceIncome } from '../game/economy';
import type { WarForCrownEvent } from '../game/events';
import { isRoyalistOwner, type OwnerId } from '../game/owners';
import {
  fortificationIndex as ruleFortificationIndex,
  provinceFortificationLimit
} from '../game/rules';
import type {
  BattleResult,
  FortificationLevel,
  GameConfig,
  GameState,
  PlayerId,
  PlayerState,
  ProvinceId,
  ProvinceState,
  StandardFortificationLevel,
  TerrainId
} from '../game/types';
import { c64RandomEventCopy } from './c64-event-copy';
import type { ButtonId } from './scene-contracts';
import { titleForRank } from './title-copy';
import { UI_COPY, type Language } from './ui-copy';
import { NEUTRAL_COLOR } from './ui-skin';

export interface TurnUiCopy {
  readonly title: string;
  readonly instruction: string;
  readonly advanceLabel: string;
}

interface AiModeChoice {
  readonly mode: WarForCrownAiMode;
  readonly pl: string;
  readonly en: string;
}

interface AiModeButtonChoice {
  readonly buttonId: ButtonId;
  readonly playerId: PlayerId;
}

const AI_MODE_CHOICES: ReadonlyArray<AiModeChoice> = [
  { mode: 'c64-original', pl: 'C64', en: 'C64' },
  { mode: 'c64-workbench', pl: 'Nasze', en: 'Our AI' },
  { mode: 'deterministic-debug', pl: 'Test', en: 'Test' }
];

const AI_MODE_BUTTONS: ReadonlyArray<AiModeButtonChoice> = [
  { buttonId: 'setup-ai-mode-p1', playerId: 'p1' },
  { buttonId: 'setup-ai-mode-p2', playerId: 'p2' },
  { buttonId: 'setup-ai-mode-p3', playerId: 'p3' },
  { buttonId: 'setup-ai-mode-p4', playerId: 'p4' }
];

const TERRAIN_LABELS: Readonly<Record<TerrainId, Record<Language, string>>> = {
  plains: { pl: 'trawa', en: 'grass' },
  brushland: { pl: 'krzaki', en: 'bushes' },
  desert: { pl: 'pustynia', en: 'desert' },
  marshland: { pl: 'bagna', en: 'swamp' },
  forest: { pl: 'las', en: 'forest' },
  hills: { pl: 'wzgorza', en: 'hills' },
  mountains: { pl: 'gory', en: 'mountain chain' }
};

const FORTIFICATION_LABELS: Readonly<Record<StandardFortificationLevel, Record<Language, string>>> = {
  none: { pl: 'brak', en: 'none' },
  watchtower: { pl: 'wieza', en: 'watchtower' },
  fort: { pl: 'fort', en: 'fort' },
  castle: { pl: 'zamek', en: 'castle' },
  stronghold: { pl: 'warownia', en: 'stronghold' },
  fortress: { pl: 'twierdza', en: 'fortress' },
  citadel: { pl: 'cytadela', en: 'citadel' }
};

export const TERRAIN_INFLUENCE_LABELS: Readonly<Record<GameConfig['terrainInfluence'], Record<Language, string>>> = {
  none: { pl: 'Nic', en: 'None' },
  income: { pl: 'Dochody', en: 'Income' },
  combat: { pl: 'Walki', en: 'Combat' },
  both: { pl: 'Oba', en: 'Both' }
};

export const ROYALIST_ATTITUDE_LABELS: Readonly<Record<GameConfig['royalistAttitude'], Record<Language, string>>> = {
  friendly: { pl: 'Przyjazni', en: 'Friendly' },
  neutral: { pl: 'Neutralni', en: 'Neutral' },
  hostile: { pl: 'Wrodzy', en: 'Hostile' }
};

export const ROYALIST_DISTRIBUTION_LABELS: Readonly<Record<GameConfig['royalistDistribution'], Record<Language, string>>> = {
  none: { pl: 'Brak', en: 'None' },
  even: { pl: 'Rowno', en: 'Even' },
  border: { pl: 'Przy granicach', en: 'Border' }
};

export const BATTLE_WINNER_LABELS: Readonly<Record<BattleResult['winner'], Record<Language, string>>> = {
  attacker: { pl: 'atakujacy', en: 'attacker' },
  defender: { pl: 'obronca', en: 'defender' }
};

export const WEATHER_LABELS: ReadonlyArray<Readonly<Record<Language, string>>> = [
  { pl: 'doskonala', en: 'excellent' },
  { pl: 'sloneczna', en: 'sunny' },
  { pl: 'ciepla', en: 'warm' },
  { pl: 'pochmurna', en: 'cloudy' },
  { pl: 'chlodna', en: 'cool' },
  { pl: 'zimna', en: 'cold' },
  { pl: 'burzowa', en: 'stormy' }
];

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function requireProvince(state: GameState, provinceId: ProvinceId): ProvinceState {
  const province = state.map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown province id: ${provinceId}.`);
  }
  return province;
}

export function requirePlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Unknown player id: ${playerId}.`);
  }
  return player;
}

export function provinceOwnerColor(state: GameState, province: ProvinceState): number {
  return isRoyalistOwner(province.ownerId)
    ? NEUTRAL_COLOR
    : requirePlayer(state, province.ownerId).color;
}

export function terrainLabelForLanguage(terrainId: TerrainId, language: Language): string {
  return TERRAIN_LABELS[terrainId][language];
}

function aiModeChoice(mode: WarForCrownAiMode): AiModeChoice {
  const choice = AI_MODE_CHOICES.find((candidate) => candidate.mode === mode);
  if (choice === undefined) {
    throw new Error(`Missing UI label for AI mode ${mode}.`);
  }
  return choice;
}

export function aiModeLabelForLanguage(mode: WarForCrownAiMode, language: Language): string {
  return aiModeChoice(mode)[language];
}

export function aiModeButtonId(playerId: PlayerId): ButtonId {
  const choice = AI_MODE_BUTTONS.find((candidate) => candidate.playerId === playerId);
  if (choice === undefined) {
    throw new Error(`Missing AI mode button for player ${playerId}.`);
  }
  return choice.buttonId;
}

export function playerIdFromAiModeButton(buttonId: ButtonId): PlayerId {
  const choice = AI_MODE_BUTTONS.find((candidate) => candidate.buttonId === buttonId);
  if (choice === undefined) {
    throw new Error(`Button ${buttonId} is not an AI mode button.`);
  }
  return choice.playerId;
}

export function provinceLabelForLanguage(provinceId: ProvinceId, language: Language): string {
  const match = /^province-(\d+)$/.exec(provinceId);
  if (match === null) {
    throw new Error(`Cannot localize province id: ${provinceId}.`);
  }
  return language === 'pl' ? `prow. ${match[1]}` : `province ${match[1]}`;
}

export function provinceOwnerLabel(
  state: GameState,
  province: ProvinceState,
  language: Language
): string {
  return isRoyalistOwner(province.ownerId)
    ? UI_COPY[language].neutral
    : requirePlayer(state, province.ownerId).label;
}

export function ownerLabelForLanguage(
  state: GameState,
  ownerId: OwnerId,
  language: Language
): string {
  return isRoyalistOwner(ownerId)
    ? UI_COPY[language].neutral
    : requirePlayer(state, ownerId).label;
}

export function ownerColor(state: GameState, ownerId: OwnerId): number {
  return isRoyalistOwner(ownerId) ? NEUTRAL_COLOR : requirePlayer(state, ownerId).color;
}

export function tileIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

export function formatTerrain(
  terrainId: TerrainId,
  config: GameConfig,
  language: Language
): string {
  const combat = c64CombatSetupForProvince({ terrainId, fortificationLevel: 'none' }, config);
  return `${terrainLabelForLanguage(terrainId, language)}, ` +
    `${UI_COPY[language].defenceColumn.toLowerCase()} ${combat.defenderCombatPercent}%`;
}

export function fortificationLabelForLanguage(
  level: FortificationLevel,
  language: Language
): string {
  const standard = FORTIFICATION_LABELS[level as StandardFortificationLevel];
  return standard === undefined ? `C64 ${ruleFortificationIndex(level)}` : standard[language];
}

export function formatFortificationLevel(
  level: FortificationLevel,
  language: Language,
  label: string
): string {
  return `${label}: ${fortificationLabelForLanguage(level, language)}`;
}

export function formatFortification(province: ProvinceState, language: Language): string {
  return formatFortificationLevel(province.fortificationLevel, language, UI_COPY[language].fort);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function booleanLabel(value: boolean, language: Language): string {
  return value ? UI_COPY[language].yes : UI_COPY[language].no;
}

export function createAttackPreview(
  province: ProvinceState,
  config: GameConfig
): C64CombatSetup {
  return c64CombatSetupForProvince(province, config);
}

export function provinceIncome(province: ProvinceState, config: GameConfig): number {
  return calculateProvinceIncome(province, config);
}

export function fortificationIndex(province: ProvinceState): number {
  return ruleFortificationIndex(province.fortificationLevel);
}

export function maxFortificationIndex(
  province: ProvinceState,
  state: GameState,
  config: GameConfig
): number {
  return ruleFortificationIndex(
    provinceFortificationLimit(
      province,
      config,
      state.players.some((player) => player.homeProvinceId === province.id)
    )
  );
}

export function turnUiCopy(state: GameState, language: Language): TurnUiCopy {
  const active = requirePlayer(state, state.activePlayerId);
  if (state.phase === 'home-selection') {
    return {
      title: language === 'pl' ? 'WYBOR STOLICY' : 'CAPITAL SELECTION',
      instruction: language === 'pl'
        ? `Kliknij neutralna prowincje dla ${active.label}.`
        : `Click a neutral province for ${active.label}.`,
      advanceLabel: language === 'pl' ? 'WYBIERZ STOLICE' : 'CHOOSE CAPITAL'
    };
  }
  if (state.phase === 'game-over') {
    return {
      title: UI_COPY[language].gameOver,
      instruction: language === 'pl' ? 'Korona zostala zdobyta.' : 'The crown has been claimed.',
      advanceLabel: UI_COPY[language].gameOver
    };
  }
  switch (state.turnStep) {
    case 'new-month':
      return {
        title: language === 'pl' ? 'NOWY MIESIAC' : 'NEW MONTH',
        instruction: language === 'pl' ? 'Pogoda, dochod i zdarzenia.' : 'Weather, income, and events.',
        advanceLabel: language === 'pl' ? 'DALEJ' : 'NEXT'
      };
    case 'attack':
      return {
        title: language === 'pl' ? 'ATAK' : 'ATTACK',
        instruction: language === 'pl'
          ? 'Kliknij cel, potem swoje prowincje przy celu.'
          : 'Click a target, then your provinces next to it.',
        advanceLabel: language === 'pl' ? 'KONIEC ATAKU' : 'END ATTACK'
      };
    case 'movement':
      return {
        title: language === 'pl' ? 'RUCH' : 'MOVE',
        instruction: language === 'pl'
          ? 'Przesun wojsko miedzy swoimi prowincjami.'
          : 'Move soldiers between your provinces.',
        advanceLabel: language === 'pl' ? 'KONIEC RUCHU' : 'END MOVE'
      };
    case 'investment':
      return {
        title: language === 'pl' ? 'BUDOWA' : 'BUILD',
        instruction: language === 'pl'
          ? 'Buduj w prowincji albo najmij wojsko.'
          : 'Build in a province or recruit soldiers.',
        advanceLabel: language === 'pl' ? 'KONIEC TURY' : 'END TURN'
      };
    default:
      state.turnStep satisfies never;
      throw new Error('Unhandled turn step.');
  }
}

export function formatEventForLog(
  state: GameState,
  event: WarForCrownEvent,
  language: Language
): string | null {
  const copy = UI_COPY[language];
  switch (event.type) {
    case 'home-selected':
      return language === 'pl'
        ? `${requirePlayer(state, event.playerId).label} stolica ${provinceLabelForLanguage(event.provinceId, language)}`
        : `${requirePlayer(state, event.playerId).label} capital ${provinceLabelForLanguage(event.provinceId, language)}`;
    case 'turn-step-advanced': return null;
    case 'income-collected':
      return language === 'pl'
        ? `${requirePlayer(state, event.playerId).label} kasa +${event.money}`
        : `${requirePlayer(state, event.playerId).label} income +${event.money}`;
    case 'c64-random-event':
      return `${requirePlayer(state, event.playerId).label}: ${c64RandomEventCopy({
        eventId: event.eventId,
        amount: event.amount,
        provinceId: event.provinceId,
        provinceLabel: event.provinceId === null
          ? null
          : provinceLabelForLanguage(event.provinceId, language)
      }, language)}`;
    case 'player-title-changed': {
      const player = requirePlayer(state, event.playerId);
      const title = titleForRank(event.rank, language);
      return event.rank > event.previousRank
        ? language === 'pl' ? `${player.label} otrzymuje tytul: ${title}` : `${player.label} is granted the title: ${title}`
        : language === 'pl' ? `${player.label} traci tytul i zostaje: ${title}` : `${player.label} loses rank and becomes: ${title}`;
    }
    case 'soldiers-recruited':
      return language === 'pl'
        ? `${requirePlayer(state, event.playerId).label} najmuje ${event.soldiers} ${provinceLabelForLanguage(event.provinceId, language)}`
        : `${requirePlayer(state, event.playerId).label} recruits ${event.soldiers} ${provinceLabelForLanguage(event.provinceId, language)}`;
    case 'village-built':
      return language === 'pl'
        ? `${requirePlayer(state, event.playerId).label} buduje wies ${provinceLabelForLanguage(event.provinceId, language)}`
        : `${requirePlayer(state, event.playerId).label} builds village ${provinceLabelForLanguage(event.provinceId, language)}`;
    case 'fortification-upgraded':
      return `${requirePlayer(state, event.playerId).label} fort ${provinceLabelForLanguage(event.provinceId, language)} ${fortificationLabelForLanguage(event.level, language)}`;
    case 'c64-baron-economy-resolved':
      return language === 'pl'
        ? `${requirePlayer(state, event.playerId).label} gospodarka: +${event.recruitedSoldiers} zoln., +${event.villagesBought} wsi, kasa ${event.finalMoney}`
        : `${requirePlayer(state, event.playerId).label} economy: +${event.recruitedSoldiers} soldiers, +${event.villagesBought} villages, money ${event.finalMoney}`;
    case 'c64-baron-movement-resolved': {
      const target = event.rememberedTargetProvinceId === null
        ? ''
        : ` ${provinceLabelForLanguage(event.rememberedTargetProvinceId, language)}`;
      return language === 'pl'
        ? `${requirePlayer(state, event.playerId).label} ruch AI: ${event.pulledMobileSoldiers}/${event.defensiveRequirement}${target}`
        : `${requirePlayer(state, event.playerId).label} AI movement: ${event.pulledMobileSoldiers}/${event.defensiveRequirement}${target}`;
    }
    case 'soldiers-moved':
      return language === 'pl'
        ? `${requirePlayer(state, event.playerId).label} ruch ${event.soldiers} ${provinceLabelForLanguage(event.fromProvinceId, language)}->${provinceLabelForLanguage(event.targetProvinceId, language)}`
        : `${requirePlayer(state, event.playerId).label} moves ${event.soldiers} ${provinceLabelForLanguage(event.fromProvinceId, language)}->${provinceLabelForLanguage(event.targetProvinceId, language)}`;
    case 'battle-resolved':
      return language === 'pl'
        ? `${requirePlayer(state, event.attackerId).label} atak ${provinceLabelForLanguage(event.targetProvinceId, language)} z ${event.fromProvinceIds.length}: ${BATTLE_WINNER_LABELS[event.result.winner][language]}`
        : `${requirePlayer(state, event.attackerId).label} attacks ${provinceLabelForLanguage(event.targetProvinceId, language)} from ${event.fromProvinceIds.length}: ${BATTLE_WINNER_LABELS[event.result.winner][language]}`;
    case 'battle-started':
      return language === 'pl'
        ? `${requirePlayer(state, event.attackerId).label} zaczyna walke ${provinceLabelForLanguage(event.targetProvinceId, language)}`
        : `${requirePlayer(state, event.attackerId).label} starts battle ${provinceLabelForLanguage(event.targetProvinceId, language)}`;
    case 'battle-round-resolved':
      return language === 'pl'
        ? `Runda ${event.round}: -${event.attackerLosses}/-${event.defenderLosses}`
        : `Round ${event.round}: -${event.attackerLosses}/-${event.defenderLosses}`;
    case 'royalist-battle-resolved':
      return language === 'pl'
        ? `Krolewscy atak ${provinceLabelForLanguage(event.targetProvinceId, language)} z ${event.fromProvinceIds.length}: ${BATTLE_WINNER_LABELS[event.result.winner][language]}`
        : `Royalists attack ${provinceLabelForLanguage(event.targetProvinceId, language)} from ${event.fromProvinceIds.length}: ${BATTLE_WINNER_LABELS[event.result.winner][language]}`;
    case 'turn-ended':
      return language === 'pl'
        ? `${requirePlayer(state, event.endedPlayerId).label} koniec tury`
        : `${requirePlayer(state, event.endedPlayerId).label} ends turn`;
    case 'game-won':
      return language === 'pl'
        ? `${ownerLabelForLanguage(state, event.winnerId, language)} ${copy.takes} korone`
        : `${ownerLabelForLanguage(state, event.winnerId, language)} wins the crown`;
    default:
      event satisfies never;
      throw new Error('Unhandled War for Crown event.');
  }
}
