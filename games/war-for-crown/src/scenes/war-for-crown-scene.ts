import Phaser from 'phaser';

import {
  DEFAULT_GAME_CONFIG,
  FORTIFICATION_LEVELS,
  PLAYER_DEFINITIONS,
  PLAYER_HOME_FORTIFICATION_LEVEL,
  TERRAIN_DEFINITIONS,
  TERRAIN_IDS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../game/constants';
import { applyPlayerAction, type WarForCrownAction } from '../game/actions';
import { chooseAiAction, type WarForCrownAiMode } from '../game/ai';
import { c64CombatSetupForProvince, type C64CombatSetup } from '../game/c64-battle';
import { c64TerrainIncomePercentForTerrainId } from '../game/c64-economy';
import { requireC64PlayerMemory } from '../game/c64-state';
import { calculateProvinceIncome } from '../game/economy';
import { defenderRetreatProvinceId } from '../game/logic';
import { isPlayerOwner, isRoyalistOwner } from '../game/owners';
import { createPlayerView } from '../game/player-view';
import {
  fortificationIndex as ruleFortificationIndex,
  provinceFortificationLimit
} from '../game/rules';
import { createInitialState } from '../game/state';
import { createPlayerStatusSummary } from '../game/status';
import { createJournalEntry, snapshotJournalValue, type WarForCrownJournalEntry } from '../game/journal';
import type { WarForCrownEvent } from '../game/events';
import type { OwnerId } from '../game/owners';
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
  TerrainId,
  TileState
} from '../game/types';
import { battleUiCommand, type BattleUiIntent } from './battle-command';
import { aiActionCues, type AiActionCue } from './ai-action-cue';
import { c64RandomEventCopy } from './c64-event-copy';
import { changeHireSelection, selectedHireSoldiers } from './hire-selection';
import { createMapDisplayFrame } from './map-display-frame';
import {
  WAR_FOR_CROWN_SOLDIER_ICON_KEY,
  WAR_FOR_CROWN_SOLDIER_ICON_URL
} from './icon-assets';
import {
  createProvinceBadgeLayout,
  drawCrownMarker,
  drawFortificationMarker,
  drawProvinceBadge,
  drawStoneBoundary,
  drawTerrainTile,
  drawWaterTile,
  WAR_FOR_CROWN_MAP_SKIN
} from './map-visuals';
import { parseMapSeedInput } from './map-seed-input';
import { WAR_FOR_CROWN_RENDER_SCALE } from './render-scale';
import { WAR_FOR_CROWN_FONT_FAMILY } from './ui-font';
import { titleForRank } from './title-copy';

export const WAR_FOR_CROWN_SCENE_KEY = 'war-for-crown';

export interface WarForCrownSceneData {
  readonly seed?: number;
  readonly returnUrl?: string;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface MapViewport {
  readonly zoom: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface MapDragState {
  readonly pointerId: number;
  readonly startPoint: Point;
  readonly startOffsetX: number;
  readonly startOffsetY: number;
  readonly startedAt: Point;
  readonly hasDragged: boolean;
}

type Language = 'pl' | 'en';

type SceneMode = 'main-menu' | 'rules' | 'map-select' | 'player-setup' | 'game';

type PlayerController = 'human' | 'ai';

type ButtonId =
  | 'advance-step'
  | 'attack'
  | 'battle-retreat-attacker'
  | 'battle-retreat-defender'
  | 'battle-round'
  | 'battle-summary-confirm'
  | 'battle-view'
  | 'build-village'
  | 'confirm-home'
  | 'end-turn'
  | 'hire-soldiers'
  | 'hire-max'
  | 'hire-minus'
  | 'hire-plus'
  | 'language-toggle'
  | 'main-load'
  | 'main-new-game'
  | 'main-rules'
  | 'main-sofa-arcade'
  | 'map-accept'
  | 'map-back'
  | 'map-max-villages'
  | 'map-province-count'
  | 'map-regenerate'
  | 'map-seed'
  | 'map-village-mode'
  | 'move-equal'
  | 'move-max'
  | 'move-minus'
  | 'move-plus'
  | 'move-soldiers'
  | 'new-map'
  | 'victory-menu'
  | 'rules-home-max-fort'
  | 'rules-interest'
  | 'rules-province-max-fort'
  | 'rules-royalist-attitude'
  | 'rules-royalist-distribution'
  | 'rules-royalist-growth'
  | 'rules-royalist-investment'
  | 'rules-back'
  | 'rules-new-game'
  | 'rules-show-computer-battles'
  | 'rules-start-money'
  | 'rules-start-soldiers'
  | 'rules-terrain-influence'
  | 'rules-village-cost'
  | 'setup-ai-count'
  | 'setup-ai-mode-p1'
  | 'setup-ai-mode-p2'
  | 'setup-ai-mode-p3'
  | 'setup-ai-mode-p4'
  | 'setup-back'
  | 'setup-color-p1'
  | 'setup-color-p2'
  | 'setup-crest-p1'
  | 'setup-crest-p2'
  | 'setup-name-p1'
  | 'setup-name-p2'
  | 'setup-start'
  | 'setup-human-count'
  | 'upgrade-fort';

interface CommandButton extends Rect {
  readonly id: ButtonId;
  readonly enabled: boolean;
}

function isBattleButtonId(buttonId: ButtonId): boolean {
  return buttonId === 'battle-retreat-attacker' ||
    buttonId === 'battle-retreat-defender' ||
    buttonId === 'battle-round' ||
    buttonId === 'battle-view';
}

interface TextTooltipContent {
  readonly kind: 'text';
  readonly text: string;
}

interface TerrainTooltipContent {
  readonly kind: 'terrain';
  readonly terrainId: TerrainId | null;
  readonly label: string;
  readonly color: number;
  readonly income: string;
  readonly defence: string;
}

type TooltipContent = TextTooltipContent | TerrainTooltipContent;

interface TooltipRegion extends Rect {
  readonly id: string;
  readonly content: TooltipContent;
}

interface TooltipState {
  readonly id: string;
  readonly content: TooltipContent;
  readonly x: number;
  readonly y: number;
}

interface SliderRegion extends Rect {
  readonly id: 'move-soldiers';
}

interface SliderDragState {
  readonly pointerId: number;
  readonly region: SliderRegion;
}

interface TurnUiCopy {
  readonly title: string;
  readonly instruction: string;
  readonly advanceLabel: string;
}

interface BasePlayerSetup {
  readonly playerId: PlayerId;
  readonly name: string;
  readonly colorIndex: number;
  readonly crestIndex: number;
}

interface HumanPlayerSetup extends BasePlayerSetup {
  readonly controller: 'human';
}

interface AiPlayerSetup extends BasePlayerSetup {
  readonly controller: 'ai';
  readonly aiMode: WarForCrownAiMode;
}

type PlayerSetup = HumanPlayerSetup | AiPlayerSetup;

interface AiModeChoice {
  readonly mode: WarForCrownAiMode;
  readonly pl: string;
  readonly en: string;
}

interface AiModeButtonChoice {
  readonly buttonId: ButtonId;
  readonly playerId: PlayerId;
}

interface CrestChoice {
  readonly shortLabel: string;
  readonly pl: string;
  readonly en: string;
}

interface PhaseOverlay {
  readonly title: string;
  readonly subtitle: string;
  readonly hideAtMs: number | null;
}

interface BattleSummary {
  readonly attackerId: PlayerId;
  readonly defenderId: OwnerId;
  readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
  readonly targetProvinceId: ProvinceId;
  readonly attackingSoldiers: number;
  readonly round: number;
  readonly attackerLosses: number;
  readonly defenderLosses: number;
  readonly result: BattleResult;
}

interface WarForCrownSceneJournal {
  readonly seed: number;
  readonly config: GameConfig;
  readonly playerSetups: ReadonlyArray<PlayerSetup>;
  readonly currentState: GameState;
  readonly entries: ReadonlyArray<WarForCrownJournalEntry>;
}

declare global {
  interface Window {
    warForCrownJournal?: () => WarForCrownSceneJournal;
  }
}

interface SkinFrameOptions {
  readonly fillColor?: number;
  readonly fillAlpha?: number;
  readonly lineColor?: number;
  readonly lineAlpha?: number;
  readonly decorative?: boolean;
}

const MAP_RECT: Rect = { x: 42, y: 76, width: 864, height: 548 };
const PANEL_RECT: Rect = { x: 932, y: 76, width: 306, height: 548 };
const HEADER_RECT: Rect = { x: 0, y: 0, width: WORLD_WIDTH, height: 56 };
const FOOTER_RECT: Rect = { x: 0, y: 646, width: WORLD_WIDTH, height: 74 };
const MAIN_MENU_RECT: Rect = { x: 300, y: 64, width: 680, height: 568 };
const RULES_MENU_RECT: Rect = { x: 120, y: 34, width: 1040, height: 604 };
const PANEL_TEXT_WIDTH = PANEL_RECT.width - 58;
const UI_SKIN = {
  fonts: {
    ui: WAR_FOR_CROWN_FONT_FAMILY,
    map: WAR_FOR_CROWN_FONT_FAMILY
  },
  colors: {
    background: 0x040809,
    panel: 0x0b1416,
    panelAlt: 0x070c0e,
    panelLine: 0xc0883f,
    panelLineBright: 0xe1aa55,
    panelLineDark: 0x583718,
    frameTexture: 0x7a4a21,
    mapLine: 0x17110b,
    water: WAR_FOR_CROWN_MAP_SKIN.water.base,
    text: '#79e4df',
    valueText: '#aaa5ff',
    mutedText: '#bec8c4',
    warning: '#f1c65f',
    button: 0x0d1719,
    buttonHover: 0x17272a,
    buttonDisabled: 0x080d0f,
    buttonLine: 0x9c672f,
    legalTarget: 0xf4ca64,
    selected: 0xffe082,
    target: 0xffffff,
    neutral: 0xc4b997
  },
  frame: {
    cornerSize: 28,
    cornerInset: 7,
    notchSize: 10,
    notchSpacing: 58,
    pillarWidth: 12,
    textureStep: 8
  }
} as const;
const BACKGROUND_COLOR = UI_SKIN.colors.background;
const PANEL_COLOR = UI_SKIN.colors.panel;
const PANEL_LINE_COLOR = UI_SKIN.colors.panelLine;
const MAP_LINE_COLOR = UI_SKIN.colors.mapLine;
const WATER_COLOR = UI_SKIN.colors.water;
const TEXT_COLOR = UI_SKIN.colors.text;
const VALUE_TEXT_COLOR = UI_SKIN.colors.valueText;
const MUTED_TEXT_COLOR = UI_SKIN.colors.mutedText;
const TEXT_NUMERIC_COLOR = 0x8ff6f2;
const MUTED_TEXT_NUMERIC_COLOR = 0xb6c3be;
const WARNING_COLOR = UI_SKIN.colors.warning;
const BUTTON_COLOR = UI_SKIN.colors.button;
const BUTTON_DISABLED_COLOR = UI_SKIN.colors.buttonDisabled;
const BUTTON_LINE_COLOR = UI_SKIN.colors.buttonLine;
const LEGAL_TARGET_COLOR = UI_SKIN.colors.legalTarget;
const SELECTED_COLOR = UI_SKIN.colors.selected;
const TARGET_COLOR = UI_SKIN.colors.target;
const NEUTRAL_COLOR = UI_SKIN.colors.neutral;
const MAP_ZOOM_LEVELS: ReadonlyArray<number> = [1, 1.35, 1.8, 2.4, 3.2];
const MAP_EDGE_EPSILON = 0.5;
const MAP_EDGE_SCROLL_SIZE = 52;
const MAP_EDGE_SCROLL_SPEED = 540;
const MAP_DRAG_THRESHOLD = 6;
const EVENT_LOG_LIMIT = 5;
const PHASE_OVERLAY_MS = 4000;
const MAX_PLAYER_NAME_LENGTH = 12;
const AI_AUTOPLAY_STEP_LIMIT = 80;
const AI_ACTION_CUE_MS = 1800;
const AI_ACTION_FLASH_MS = 220;
const HUMAN_PLAYER_COUNT_OPTIONS: ReadonlyArray<number> = [1, 2];
const AI_PLAYER_COUNT_OPTIONS: ReadonlyArray<number> = Array.from(
  { length: PLAYER_DEFINITIONS.length },
  (_value, index) => index
);
const PLAYER_FACING_AI_MODES: ReadonlyArray<WarForCrownAiMode> = ['c64-original', 'c64-workbench'];
const PROVINCE_COUNT_OPTIONS: ReadonlyArray<number> = [16, 20, 24, 30];
const MAX_VILLAGE_OPTIONS: ReadonlyArray<number> = [5, 8, 12, 16];
const VILLAGE_COST_OPTIONS: ReadonlyArray<number> = [2, 4, 8, 12];
const INTEREST_RATE_OPTIONS: ReadonlyArray<number> = [0, 4, 8, 12];
const PERCENT_OPTIONS: ReadonlyArray<number> = [0, 20, 40, 60, 80];
const STARTING_SOLDIER_OPTIONS: ReadonlyArray<number> = [10, 20, 30, 40];
const STARTING_MONEY_OPTIONS: ReadonlyArray<number> = [10, 20, 30, 40];
const HOME_FORTIFICATION_LEVEL_OPTIONS: ReadonlyArray<StandardFortificationLevel> = FORTIFICATION_LEVELS.filter(
  (level) => ruleFortificationIndex(level) >= ruleFortificationIndex(PLAYER_HOME_FORTIFICATION_LEVEL)
);

const PLAYER_COLOR_CHOICES: ReadonlyArray<number> = [
  0xd9534f,
  0x3f88c5,
  0xe0b341,
  0x58a55c,
  0xa66bd6,
  0xd7793f
];

const PLAYER_CREST_CHOICES: ReadonlyArray<CrestChoice> = [
  { shortLabel: 'KRN', pl: 'Korona', en: 'Crown' },
  { shortLabel: 'WZA', pl: 'Wieza', en: 'Tower' },
  { shortLabel: 'MCZ', pl: 'Miecz', en: 'Sword' },
  { shortLabel: 'KSC', pl: 'Ksiezyc', en: 'Moon' }
];

const C64_AI_NAME_CHOICES: ReadonlyArray<string> = [
  'Ortnid',
  'Siegeband',
  'Herbrand',
  'Oserich',
  'Wabtrud',
  'Liebgard',
  'Fenrir',
  'Renndavon',
  'Nixdrauf',
  'Harbart',
  'Walgund',
  'Hal9000',
  'Waghild',
  'Kunigunde',
  'Marpalei',
  'Agrippina'
];

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

const TERRAIN_INFLUENCE_LABELS: Readonly<Record<GameConfig['terrainInfluence'], Record<Language, string>>> = {
  none: { pl: 'Nic', en: 'None' },
  income: { pl: 'Dochody', en: 'Income' },
  combat: { pl: 'Walki', en: 'Combat' },
  both: { pl: 'Oba', en: 'Both' }
};

const ROYALIST_ATTITUDE_LABELS: Readonly<Record<GameConfig['royalistAttitude'], Record<Language, string>>> = {
  friendly: { pl: 'Przyjazni', en: 'Friendly' },
  neutral: { pl: 'Neutralni', en: 'Neutral' },
  hostile: { pl: 'Wrodzy', en: 'Hostile' }
};

const ROYALIST_DISTRIBUTION_LABELS: Readonly<Record<GameConfig['royalistDistribution'], Record<Language, string>>> = {
  none: { pl: 'Brak', en: 'None' },
  even: { pl: 'Rowno', en: 'Even' },
  border: { pl: 'Przy granicach', en: 'Border' }
};

const BATTLE_WINNER_LABELS: Readonly<Record<BattleResult['winner'], Record<Language, string>>> = {
  attacker: { pl: 'atakujacy', en: 'attacker' },
  defender: { pl: 'obronca', en: 'defender' }
};

const WEATHER_LABELS: ReadonlyArray<Readonly<Record<Language, string>>> = [
  { pl: 'doskonala', en: 'excellent' },
  { pl: 'sloneczna', en: 'sunny' },
  { pl: 'ciepla', en: 'warm' },
  { pl: 'pochmurna', en: 'cloudy' },
  { pl: 'chlodna', en: 'cool' },
  { pl: 'zimna', en: 'cold' },
  { pl: 'burzowa', en: 'stormy' }
];

const UI_COPY = {
  pl: {
    language: 'PL',
    turn: 'Tura',
    seed: 'Ziarno',
    mainMenuTitle: 'WAR FOR CROWN',
    mainMenuSubtitle: 'Najpierw wybierz tryb gry.',
    sofaArcade: 'SOFA ARCADE',
    newGame: 'NOWA GRA',
    rules: 'ZASADY',
    load: 'WCZYTAJ',
    loadUnavailable: 'Wczytywanie bedzie pozniej.',
    back: 'WSTECZ',
    chooseMapTitle: 'WYBIERZ MAPE',
    chooseMapInstruction: 'Obejrzyj mape. Jesli pasuje, potwierdz wybor.',
    seedInputInstruction: 'Wpisz seed. Enter zatwierdza, Esc anuluje.',
    invalidSeed: 'Seed musi byc liczba od 1 do 4294967295.',
    regenerateMap: 'INNA MAPA',
    acceptMap: 'TA MAPA',
    setupTitle: 'GRACZE',
    setupInstruction: 'Wpisz imiona, wybierz kolor i herb.',
    name: 'Imie',
    color: 'Kolor',
    crest: 'Herb',
    start: 'DALEJ',
    confirm: 'POTWIERDZ',
    menu: 'MENU',
    mapInfo: 'MAPA',
    terrainLegend: 'TEREN',
    water: 'Woda',
    terrainColumn: 'Teren',
    incomeColumn: 'Dochod',
    defenceColumn: 'Obrona',
    terrainLegendTooltip: 'Dochod: procent bazowego dochodu z wiosek. Obrona: bazowa sila walki obroncy w tabeli C64.',
    rulesTitle: 'ZASADY',
    rulesTooltips: {
      villageCost: 'Koszt dobudowania jednej wioski w wybranej prowincji.',
      interestRate: 'Odsetki doliczane do posiadanej kasy przy miesiecznym dochodzie.',
      startingSoldiers: 'Armia wpisywana do potwierdzonej stolicy gracza. Nie zmienia neutralnych prowincji.',
      startingMoney: 'Kasa kazdego gracza na poczatku partii.',
      homeMaxFort: 'Najwyzszy poziom fortyfikacji, do ktorego mozna rozbudowac stolice.',
      provinceMaxFort: 'Najwyzszy poziom fortyfikacji w zwyklych prowincjach.',
      royalistAttitude: 'Nastawienie neutralnych rodow. Pelne zachowanie AI bedzie dopinane pozniej.',
      royalistGrowth: 'Docelowy przyrost sil neutralnych rodow w pelniejszych zasadach.',
      royalistInvestment: 'Docelowa sklonnosc neutralnych rodow do inwestowania w pelniejszych zasadach.',
      royalistDistribution: 'Sposob rozlozenia neutralnych rodow na starcie pelniejszych zasad.',
      terrainInfluence: 'Okresla, czy teren zmienia dochody, walke, oba elementy albo nic.',
      showComputerBattles: 'Pokazuje wpisy walk, w ktorych oba rody prowadzi komputer.'
    },
    yes: 'TAK',
    no: 'NIE',
    players: 'Gracze',
    alive: 'zywych',
    total: 'razem',
    provinces: 'Prowincje',
    tiles: 'Pola',
    startingSoldiers: 'Wojsko w stolicy',
    startingMoney: 'Startowa kasa',
    incomePerVillage: 'Dochod za wies',
    villageRange: 'Wioski na prowincji',
    villageCost: 'Koszt wioski',
    soldierCost: 'Koszt zolnierza',
    fortCost: 'Koszt fortu',
    fortLevels: 'Fortyfikacje',
    humanPlayers: 'Graczy ludzi',
    aiBarons: 'Baronow AI',
    aiMode: 'Tryb AI',
    aiModeTooltip: 'C64: zgodnosc z oryginalem. Nasze: porownawczy bot roboczy, docelowo z poziomami trudnosci.',
    computer: 'Komputer',
    continentProvinces: 'Prowincje',
    maxVillages: 'Maks. wiosek',
    maxVillagesMode: 'Limit wiosek',
    perProvince: 'Kazda prow.',
    largestProvince: 'Najwieksza',
    royalistAttitude: 'Krolewscy',
    royalistGrowth: 'Przyrost krolewskich',
    royalistInvestment: 'Inwestycje krolewskich',
    royalistDistribution: 'Rozklad krolewskich',
    terrainInfluence: 'Wplyw terenu',
    showComputerBattles: 'Walki AI vs AI',
    homeMaxFort: 'Maks. fort stolicy',
    provinceMaxFort: 'Maks. fort prowincji',
    playerCastle: 'Zamek gracza',
    interestRate: 'Procent',
    houses: 'RODY',
    houseColumn: 'Rod',
    provinceCountColumn: 'Prow.',
    soldierCountColumn: 'Wojsko',
    mapSoldiersShort: 'Z:',
    mapVillagesShort: 'W:',
    province: 'PROWINCJA',
    events: 'ZDARZENIA',
    noEvents: 'Brak zdarzen',
    money: 'KASA',
    land: 'ziemie',
    noProvince: 'Woda nie jest prowincja.',
    chooseNeutral: 'Wybierz neutralna prowincje i potwierdz.',
    pendingHome: 'Wybrana stolica',
    noHomePending: 'Najpierw kliknij neutralna prowincje.',
    occupied: 'Ta prowincja jest juz zajeta.',
    selectOwnProvince: 'Najpierw wybierz swoja prowincje.',
    borderMissing: 'Brak granicy.',
    chooseTarget: 'Wybierz sasiedni cel.',
    chooseAttackSource: 'Wybierz swoje prowincje przy celu.',
    attackAgain: 'Kolejny atak albo koniec fazy.',
    notEnoughMoney: 'Za malo kasy.',
    notEnoughSoldiers: 'Za malo wojska.',
    villageLimit: 'Limit wiosek osiagniety.',
    fortMaxed: 'Fort jest maksymalny.',
    fortAlready: 'Fort juz ulepszony w tej turze.',
    buildStep: 'Budowa jest w kroku BUDOWA.',
    hireStep: 'Najem jest w kroku BUDOWA.',
    attackStep: 'Atak bedzie w kroku ATAK.',
    moveStep: 'Ruch jest w kroku RUCH.',
    chooseMoveTarget: 'Wybierz inna wlasna prowincje.',
    cannotEqualizeMove: 'Nie da sie wyrownac ruchem w tym kierunku.',
    fortStep: 'Fort jest w kroku BUDOWA.',
    clearSelection: 'Nic nie jest wybrane.',
    neutral: 'Neutralna',
    duplicateNames: 'Imiona musza byc rozne.',
    holdsCrown: 'trzyma korone',
    takes: 'zdobywa',
    holds: 'broni sie',
    battle: 'WALKA',
    battleRound: 'RUNDA',
    battleSummaryTitle: 'WYNIK WALKI',
    battleSummaryConfirm: 'ZAMKNIJ',
    winnerLabel: 'Zwyciezca',
    resolutionLabel: 'Wynik',
    lossesLabel: 'Straty',
    survivorsLabel: 'Zostalo',
    resolutionElimination: 'wybicie',
    resolutionAttackerRetreat: 'odwrot atakujacego',
    resolutionDefenderRetreat: 'odwrot obroncy',
    combatPower: 'SILA',
    fightRound: 'WALCZ',
    viewBattle: 'ZOBACZ',
    retreatAttacker: 'ODWROT ATAKU',
    retreatDefender: 'ODWROT OBRONY',
    attacksInBattle: 'atakuje',
    sources: 'zrodla',
    inProvince: 'w',
    villageBuilt: 'wioski',
    hired: 'Najeto',
    moved: 'Przeniesiono',
    soldiers: 'zolnierzy',
    defenders: 'obroncow',
    target: 'CEL',
    need: 'potrzeba',
    win: 'Wygrana',
    lose: 'Przegrana',
    attack: 'ATAK',
    move: 'PRZENIES',
    village: 'WIES',
    fort: 'FORT',
    recruit: 'NAJMIJ',
    all: 'WSZ',
    gameOver: 'KONIEC GRY',
    crownTaken: 'KORONA ZDOBYTA',
    wins: 'WYGRYWA'
  },
  en: {
    language: 'ENG',
    turn: 'Turn',
    seed: 'Seed',
    mainMenuTitle: 'WAR FOR CROWN',
    mainMenuSubtitle: 'Choose how to start.',
    sofaArcade: 'SOFA ARCADE',
    newGame: 'NEW GAME',
    rules: 'RULES',
    load: 'LOAD',
    loadUnavailable: 'Loading is not available yet.',
    back: 'BACK',
    chooseMapTitle: 'CHOOSE MAP',
    chooseMapInstruction: 'Inspect the map. Confirm it if it looks good.',
    seedInputInstruction: 'Enter a seed. Enter confirms, Esc cancels.',
    invalidSeed: 'Seed must be a number from 1 to 4294967295.',
    regenerateMap: 'NEW MAP',
    acceptMap: 'USE MAP',
    setupTitle: 'PLAYERS',
    setupInstruction: 'Enter names, choose colors and crests.',
    name: 'Name',
    color: 'Color',
    crest: 'Crest',
    start: 'NEXT',
    confirm: 'CONFIRM',
    menu: 'MENU',
    mapInfo: 'MAP',
    terrainLegend: 'TERRAIN',
    water: 'Water',
    terrainColumn: 'Terrain',
    incomeColumn: 'Income',
    defenceColumn: 'Defence',
    terrainLegendTooltip: 'Income: percent of base village income. Defence: base defender combat power from the C64 table.',
    rulesTitle: 'RULES',
    rulesTooltips: {
      villageCost: 'Cost of building one village in the selected province.',
      interestRate: 'Interest added to saved money during monthly income.',
      startingSoldiers: 'Army placed in a confirmed player home. It does not change neutral provinces.',
      startingMoney: 'Money each player receives at match start.',
      homeMaxFort: 'Highest fortification level available for home provinces.',
      provinceMaxFort: 'Highest fortification level available for regular provinces.',
      royalistAttitude: 'Neutral house attitude. Full AI behavior will be wired later.',
      royalistGrowth: 'Target neutral-house force growth for fuller rules.',
      royalistInvestment: 'Target neutral-house investment tendency for fuller rules.',
      royalistDistribution: 'Starting layout rule for neutral houses in fuller rules.',
      terrainInfluence: 'Controls whether terrain changes income, combat, both, or neither.',
      showComputerBattles: 'Shows battle log entries where both houses are computer-controlled.'
    },
    yes: 'YES',
    no: 'NO',
    players: 'Players',
    alive: 'alive',
    total: 'total',
    provinces: 'Provinces',
    tiles: 'Tiles',
    startingSoldiers: 'Capital soldiers',
    startingMoney: 'Starting money',
    incomePerVillage: 'Income per village',
    villageRange: 'Villages per province',
    villageCost: 'Village cost',
    soldierCost: 'Soldier cost',
    fortCost: 'Fort cost',
    fortLevels: 'Fortifications',
    humanPlayers: 'Human players',
    aiBarons: 'AI barons',
    aiMode: 'AI mode',
    aiModeTooltip: 'C64: original compatibility. Our AI: comparison workbench bot, later with difficulty levels.',
    computer: 'Computer',
    continentProvinces: 'Provinces',
    maxVillages: 'Max villages',
    maxVillagesMode: 'Village limit',
    perProvince: 'Every province',
    largestProvince: 'Largest province',
    royalistAttitude: 'Royalists',
    royalistGrowth: 'Royalist growth',
    royalistInvestment: 'Royalist investment',
    royalistDistribution: 'Royalist layout',
    terrainInfluence: 'Terrain influence',
    showComputerBattles: 'AI vs AI battles',
    homeMaxFort: 'Max home fort',
    provinceMaxFort: 'Max province fort',
    playerCastle: 'Player castle',
    interestRate: 'Interest',
    houses: 'HOUSES',
    houseColumn: 'House',
    provinceCountColumn: 'Prov.',
    soldierCountColumn: 'Army',
    mapSoldiersShort: 'S:',
    mapVillagesShort: 'V:',
    province: 'PROVINCE',
    events: 'EVENTS',
    noEvents: 'No events yet',
    money: 'MONEY',
    land: 'land',
    noProvince: 'Water has no province.',
    chooseNeutral: 'Choose a neutral province and confirm.',
    pendingHome: 'Selected capital',
    noHomePending: 'Click a neutral province first.',
    occupied: 'That province is already taken.',
    selectOwnProvince: 'Select your province first.',
    borderMissing: 'No border.',
    chooseTarget: 'Choose a border target.',
    chooseAttackSource: 'Choose your provinces next to the target.',
    attackAgain: 'Attack again or end the phase.',
    notEnoughMoney: 'Not enough money.',
    notEnoughSoldiers: 'Not enough soldiers.',
    villageLimit: 'Village limit reached.',
    fortMaxed: 'Fort is maxed.',
    fortAlready: 'Fort already upgraded this turn.',
    buildStep: 'Build during BUILD.',
    hireStep: 'Recruit during BUILD.',
    attackStep: 'Attack during ATTACK.',
    moveStep: 'Move during MOVE.',
    chooseMoveTarget: 'Choose another owned province.',
    cannotEqualizeMove: 'Cannot equalize in this direction.',
    fortStep: 'Upgrade forts during BUILD.',
    clearSelection: 'Nothing is selected.',
    neutral: 'Neutral',
    duplicateNames: 'Player names must be unique.',
    holdsCrown: 'holds the crown',
    takes: 'takes',
    holds: 'holds',
    battle: 'BATTLE',
    battleRound: 'ROUND',
    battleSummaryTitle: 'BATTLE RESULT',
    battleSummaryConfirm: 'CLOSE',
    winnerLabel: 'Winner',
    resolutionLabel: 'Result',
    lossesLabel: 'Losses',
    survivorsLabel: 'Survivors',
    resolutionElimination: 'elimination',
    resolutionAttackerRetreat: 'attacker retreat',
    resolutionDefenderRetreat: 'defender retreat',
    combatPower: 'POWER',
    fightRound: 'FIGHT',
    viewBattle: 'VIEW',
    retreatAttacker: 'RETREAT ATTACK',
    retreatDefender: 'RETREAT DEFENCE',
    attacksInBattle: 'attack',
    sources: 'sources',
    inProvince: 'in',
    villageBuilt: 'villages',
    hired: 'Recruited',
    moved: 'Moved',
    soldiers: 'soldiers',
    defenders: 'defenders',
    target: 'TARGET',
    need: 'need',
    win: 'Win',
    lose: 'Lose',
    attack: 'ATTACK',
    move: 'MOVE',
    village: 'VILLAGE',
    fort: 'FORT',
    recruit: 'RECRUIT',
    all: 'ALL',
    gameOver: 'GAME OVER',
    crownTaken: 'CROWN CLAIMED',
    wins: 'WINS'
  }
} as const;

function parseSeed(rawData: unknown): number {
  if (rawData === undefined) {
    return 1;
  }

  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('War for Crown scene data must be an object.');
  }

  const data = rawData as WarForCrownSceneData;
  if (data.seed === undefined) {
    return 1;
  }

  if (!Number.isInteger(data.seed) || data.seed < 1) {
    throw new Error(`War for Crown seed must be a positive integer, got ${data.seed}.`);
  }

  return data.seed;
}

function parseReturnUrl(rawData: unknown): string | null {
  if (rawData === undefined) {
    return null;
  }
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('War for Crown scene data must be an object.');
  }
  const data = rawData as WarForCrownSceneData;
  if (data.returnUrl === undefined) {
    return null;
  }
  if (!data.returnUrl.startsWith('/') || !data.returnUrl.endsWith('/')) {
    throw new Error(`War for Crown return URL must start and end with "/": ${data.returnUrl}`);
  }
  return data.returnUrl;
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function requireProvince(state: GameState, provinceId: ProvinceId): ProvinceState {
  const province = state.map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown province id: ${provinceId}.`);
  }
  return province;
}

function requirePlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Unknown player id: ${playerId}.`);
  }
  return player;
}

function provinceOwnerColor(state: GameState, province: ProvinceState): number {
  if (isRoyalistOwner(province.ownerId)) {
    return NEUTRAL_COLOR;
  }

  return requirePlayer(state, province.ownerId).color;
}

function terrainLabelForLanguage(terrainId: TerrainId, language: Language): string {
  return TERRAIN_LABELS[terrainId][language];
}

function aiModeChoice(mode: WarForCrownAiMode): AiModeChoice {
  const choice = AI_MODE_CHOICES.find((candidate) => candidate.mode === mode);
  if (choice === undefined) {
    throw new Error(`Missing UI label for AI mode ${mode}.`);
  }
  return choice;
}

function aiModeLabelForLanguage(mode: WarForCrownAiMode, language: Language): string {
  return aiModeChoice(mode)[language];
}

function aiModeButtonId(playerId: PlayerId): ButtonId {
  const choice = AI_MODE_BUTTONS.find((candidate) => candidate.playerId === playerId);
  if (choice === undefined) {
    throw new Error(`Missing AI mode button for player ${playerId}.`);
  }
  return choice.buttonId;
}

function playerIdFromAiModeButton(buttonId: ButtonId): PlayerId {
  const choice = AI_MODE_BUTTONS.find((candidate) => candidate.buttonId === buttonId);
  if (choice === undefined) {
    throw new Error(`Button ${buttonId} is not an AI mode button.`);
  }
  return choice.playerId;
}

function provinceLabelForLanguage(provinceId: ProvinceId, language: Language): string {
  const match = /^province-(\d+)$/.exec(provinceId);
  if (match === null) {
    throw new Error(`Cannot localize province id: ${provinceId}.`);
  }

  return language === 'pl' ? `prow. ${match[1]}` : `province ${match[1]}`;
}

function provinceOwnerLabel(state: GameState, province: ProvinceState, language: Language): string {
  if (isRoyalistOwner(province.ownerId)) {
    return UI_COPY[language].neutral;
  }

  return requirePlayer(state, province.ownerId).label;
}

function ownerLabelForLanguage(state: GameState, ownerId: OwnerId, language: Language): string {
  return isRoyalistOwner(ownerId)
    ? UI_COPY[language].neutral
    : requirePlayer(state, ownerId).label;
}

function ownerColor(state: GameState, ownerId: OwnerId): number {
  return isRoyalistOwner(ownerId) ? NEUTRAL_COLOR : requirePlayer(state, ownerId).color;
}

function tileIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

function formatTerrain(terrainId: TerrainId, config: GameConfig, language: Language): string {
  const combat = c64CombatSetupForProvince(
    { terrainId, fortificationLevel: 'none' },
    config
  );
  return `${terrainLabelForLanguage(terrainId, language)}, ` +
    `${UI_COPY[language].defenceColumn.toLowerCase()} ${combat.defenderCombatPercent}%`;
}

function fortificationLabelForLanguage(level: FortificationLevel, language: Language): string {
  const standard = FORTIFICATION_LABELS[level as StandardFortificationLevel];
  return standard === undefined ? `C64 ${ruleFortificationIndex(level)}` : standard[language];
}

function formatFortificationLevel(
  level: FortificationLevel,
  language: Language,
  label: string
): string {
  return `${label}: ${fortificationLabelForLanguage(level, language)}`;
}

function formatFortification(province: ProvinceState, language: Language): string {
  return formatFortificationLevel(province.fortificationLevel, language, UI_COPY[language].fort);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nextOption<T>(values: ReadonlyArray<T>, current: T): T {
  const index = values.indexOf(current);
  if (index === -1) {
    throw new Error(`Current option is not in configured option list: ${String(current)}.`);
  }

  const next = values[(index + 1) % values.length];
  if (next === undefined) {
    throw new Error('Configured option list is empty.');
  }
  return next;
}

function booleanLabel(value: boolean, language: Language): string {
  return value ? UI_COPY[language].yes : UI_COPY[language].no;
}

function createAttackPreview(
  province: ProvinceState,
  config: GameConfig
): C64CombatSetup {
  return c64CombatSetupForProvince(province, config);
}

function provinceIncome(province: ProvinceState, config: GameConfig): number {
  return calculateProvinceIncome(province, config);
}

function fortificationIndex(province: ProvinceState): number {
  return ruleFortificationIndex(province.fortificationLevel);
}

function maxFortificationIndex(province: ProvinceState, state: GameState, config: GameConfig): number {
  return ruleFortificationIndex(
    provinceFortificationLimit(
      province,
      config,
      state.players.some((player) => player.homeProvinceId === province.id)
    )
  );
}

function turnUiCopy(state: GameState, language: Language): TurnUiCopy {
  const active = requirePlayer(state, state.activePlayerId);

  if (state.phase === 'home-selection') {
    return {
      title: language === 'pl' ? 'WYBOR STOLICY' : 'CAPITAL SELECTION',
      instruction:
        language === 'pl'
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
        instruction:
          language === 'pl'
            ? 'Kliknij cel, potem swoje prowincje przy celu.'
            : 'Click a target, then your provinces next to it.',
        advanceLabel: language === 'pl' ? 'KONIEC ATAKU' : 'END ATTACK'
      };
    case 'movement':
      return {
        title: language === 'pl' ? 'RUCH' : 'MOVE',
        instruction:
          language === 'pl'
            ? 'Przesun wojsko miedzy swoimi prowincjami.'
            : 'Move soldiers between your provinces.',
        advanceLabel: language === 'pl' ? 'KONIEC RUCHU' : 'END MOVE'
      };
    case 'investment':
      return {
        title: language === 'pl' ? 'BUDOWA' : 'BUILD',
        instruction:
          language === 'pl'
            ? 'Buduj w prowincji albo najmij wojsko.'
            : 'Build in a province or recruit soldiers.',
        advanceLabel: language === 'pl' ? 'KONIEC TURY' : 'END TURN'
      };
    default:
      state.turnStep satisfies never;
      throw new Error('Unhandled turn step.');
  }
}

function formatEventForLog(
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
    case 'turn-step-advanced':
      return null;
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
      return language === 'pl'
        ? `${requirePlayer(state, event.playerId).label} fort ${provinceLabelForLanguage(event.provinceId, language)} ${fortificationLabelForLanguage(event.level, language)}`
        : `${requirePlayer(state, event.playerId).label} fort ${provinceLabelForLanguage(event.provinceId, language)} ${fortificationLabelForLanguage(event.level, language)}`;
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

export class WarForCrownScene extends Phaser.Scene {
  private state!: GameState;
  private returnUrl: string | null = null;
  private mode: SceneMode = 'main-menu';
  private language: Language = 'pl';
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private mapGraphics!: Phaser.GameObjects.Graphics;
  private mapMask!: Phaser.Display.Masks.GeometryMask;
  private mapMaskShape!: Phaser.GameObjects.Graphics;
  private uiGraphics!: Phaser.GameObjects.Graphics;
  private dynamicObjects!: Phaser.GameObjects.Group;
  private buttons: CommandButton[] = [];
  private tooltipRegions: TooltipRegion[] = [];
  private hoveredTooltip: TooltipState | null = null;
  private hoveredButtonId: ButtonId | null = null;
  private movementSliderRegion: SliderRegion | null = null;
  private movementSliderDragState: SliderDragState | null = null;
  private mapViewport: MapViewport = { zoom: 1, offsetX: 0, offsetY: 0 };
  private mapZoomIndex = 0;
  private mapDragState: MapDragState | null = null;
  private selectedFromId: ProvinceId | null = null;
  private selectedTargetId: ProvinceId | null = null;
  private selectedAttackSourceIds: ProvinceId[] = [];
  private selectedMoveSoldiers: number | null = null;
  private selectedHireSoldiers = 1;
  private pendingHomeProvinceId: ProvinceId | null = null;
  private editingNamePlayerId: PlayerId | null = null;
  private editingSeed: string | null = null;
  private phaseOverlay: PhaseOverlay | null = null;
  private battleSummary: BattleSummary | null = null;
  private aiActionCue: AiActionCue | null = null;
  private aiActionCueQueue: ReadonlyArray<AiActionCue> = [];
  private aiActionCueElapsedMs = 0;
  private announcedPhaseKey: string | null = null;
  private message = '';
  private eventLog: ReadonlyArray<string> = [];
  private actionJournal: ReadonlyArray<WarForCrownJournalEntry> = [];
  private gameConfig: GameConfig = DEFAULT_GAME_CONFIG;
  private playerSetups: ReadonlyArray<PlayerSetup> = [
    { playerId: 'p1', name: 'P1', colorIndex: 0, crestIndex: 0, controller: 'human' },
    { playerId: 'p2', name: 'P2', colorIndex: 1, crestIndex: 1, controller: 'human' }
  ];
  private readonly onResize = (): void => {
    this.resizeCamera();
    this.renderScene();
  };
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.mode === 'map-select' && this.editingSeed !== null) {
      if (event.key === 'Enter') {
        this.commitSeedEdit();
        return;
      }

      if (event.key === 'Escape') {
        this.editingSeed = null;
        this.message = this.copy().chooseMapInstruction;
        this.renderScene();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        this.editingSeed = this.editingSeed.slice(0, -1);
        this.renderScene();
        return;
      }

      if (/^[0-9]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        this.editingSeed += event.key;
        this.renderScene();
      }
      return;
    }

    if (this.mode !== 'player-setup' || this.editingNamePlayerId === null) {
      return;
    }

    if (event.key === 'Enter') {
      this.editingNamePlayerId = null;
      this.renderScene();
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.updatePlayerName(this.editingNamePlayerId, (current) => current.slice(0, -1));
      return;
    }

    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (!/^[a-zA-Z0-9 _-]$/.test(event.key)) {
      return;
    }

    this.updatePlayerName(this.editingNamePlayerId, (current) =>
      `${current}${event.key}`.slice(0, MAX_PLAYER_NAME_LENGTH)
    );
  };
  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (this.mode === 'game' && this.state.phase === 'game-over') {
      const victoryButton = this.buttons.find((candidate) =>
        candidate.id === 'victory-menu' && this.contains(candidate, worldPoint.x, worldPoint.y)
      );
      if (victoryButton !== undefined) {
        this.handleButton(victoryButton);
      }
      return;
    }

    if (this.mode === 'game' && this.aiActionCue !== null) {
      return;
    }

    if (this.mode === 'game' && this.phaseOverlay !== null) {
      this.handlePhaseOverlayClick();
      return;
    }

    const button = this.buttons.find((candidate) => this.contains(candidate, worldPoint.x, worldPoint.y));
    if (this.mode === 'game' && this.battleSummary !== null) {
      if (button?.id === 'battle-summary-confirm') {
        this.handleButton(button);
      }
      return;
    }

    if (this.mode === 'game' && this.state.battle !== null) {
      if (button !== undefined && isBattleButtonId(button.id)) {
        this.handleButton(button);
      }
      return;
    }

    if (button !== undefined) {
      this.handleButton(button);
      return;
    }

    const movementSlider = this.movementSliderRegion;
    if (movementSlider !== null && this.contains(movementSlider, worldPoint.x, worldPoint.y)) {
      this.setMoveSoldiersFromSlider(worldPoint.x, movementSlider);
      this.movementSliderDragState = {
        pointerId: pointer.id,
        region: movementSlider
      };
      return;
    }

    if (this.isMapVisible() && this.contains(MAP_RECT, worldPoint.x, worldPoint.y)) {
      this.mapDragState = {
        pointerId: pointer.id,
        startPoint: { x: worldPoint.x, y: worldPoint.y },
        startedAt: { x: worldPoint.x, y: worldPoint.y },
        startOffsetX: this.mapViewport.offsetX,
        startOffsetY: this.mapViewport.offsetY,
        hasDragged: false
      };
    }
  };
  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    const sliderDragState = this.movementSliderDragState;
    if (sliderDragState !== null) {
      if (sliderDragState.pointerId !== pointer.id) {
        return;
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.setMoveSoldiersFromSlider(worldPoint.x, sliderDragState.region);
      return;
    }

    const dragState = this.mapDragState;
    if (dragState === null) {
      this.updatePointerHover(pointer);
      return;
    }

    if (dragState.pointerId !== pointer.id) {
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const deltaX = worldPoint.x - dragState.startPoint.x;
    const deltaY = worldPoint.y - dragState.startPoint.y;
    const hasDragged =
      dragState.hasDragged || Math.hypot(worldPoint.x - dragState.startedAt.x, worldPoint.y - dragState.startedAt.y) >= MAP_DRAG_THRESHOLD;
    const nextViewport = this.clampMapViewport({
      ...this.mapViewport,
      offsetX: dragState.startOffsetX - deltaX,
      offsetY: dragState.startOffsetY - deltaY
    });
    const moved =
      Math.abs(nextViewport.offsetX - this.mapViewport.offsetX) > MAP_EDGE_EPSILON ||
      Math.abs(nextViewport.offsetY - this.mapViewport.offsetY) > MAP_EDGE_EPSILON;

    this.mapDragState = {
      ...dragState,
      hasDragged
    };

    if (moved) {
      this.mapViewport = nextViewport;
      this.message = this.mapViewMessage();
      this.renderScene();
    }
  };
  private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    const sliderDragState = this.movementSliderDragState;
    if (sliderDragState !== null) {
      if (sliderDragState.pointerId === pointer.id) {
        this.movementSliderDragState = null;
      }
      return;
    }

    const dragState = this.mapDragState;
    if (dragState === null || dragState.pointerId !== pointer.id) {
      return;
    }

    this.mapDragState = null;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (dragState.hasDragged) {
      return;
    }

    this.handleMapClick(worldPoint);
  };
  private readonly onPointerWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: ReadonlyArray<Phaser.GameObjects.GameObject>,
    _deltaX: number,
    deltaY: number
  ): void => {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (!this.isMapVisible() || !this.contains(MAP_RECT, worldPoint.x, worldPoint.y)) {
      return;
    }

    if (deltaY === 0) {
      return;
    }

    const nextIndex = deltaY > 0 ? this.mapZoomIndex - 1 : this.mapZoomIndex + 1;
    if (this.trySetMapZoomIndex(nextIndex, { x: worldPoint.x, y: worldPoint.y })) {
      this.message = this.mapViewMessage();
      this.renderScene();
    }
  };

  constructor() {
    super(WAR_FOR_CROWN_SCENE_KEY);
  }

  preload(): void {
    this.load.svg(
      WAR_FOR_CROWN_SOLDIER_ICON_KEY,
      WAR_FOR_CROWN_SOLDIER_ICON_URL,
      { width: 64, height: 52 }
    );
  }

  private handlePhaseOverlayClick(): void {
    if (this.state.phase === 'turn' && this.state.turnStep === 'new-month') {
      const events = this.applyActiveAction({ type: 'advance-step' });
      this.playAiUntilHumanTurn();
      this.clearMapSelection();
      const importantEvents = events.filter(
        (event) => event.type === 'c64-random-event' || event.type === 'player-title-changed'
      );
      this.message = importantEvents.length === 0
        ? turnUiCopy(this.state, this.language).instruction
        : importantEvents
            .map((event) => formatEventForLog(this.state, event, this.language))
            .filter((line): line is string => line !== null)
            .join('  ');
      this.phaseOverlay = null;
      this.announcedPhaseKey = this.currentPhaseKey();
      this.renderScene();
      return;
    }

    this.phaseOverlay = null;
    this.renderScene();
  }

  create(rawData?: unknown): void {
    if (!this.textures.exists(WAR_FOR_CROWN_SOLDIER_ICON_KEY)) {
      throw new Error('War for Crown soldier icon failed to load.');
    }
    const seed = parseSeed(rawData);
    this.returnUrl = parseReturnUrl(rawData);
    this.syncPlayerSetupsWithConfig();
    this.state = createInitialState(seed, this.gameConfig);
    this.mode = 'main-menu';
    this.message = UI_COPY[this.language].mainMenuSubtitle;
    this.backgroundGraphics = this.add.graphics().setDepth(0);
    this.mapMaskShape = this.make.graphics();
    this.mapMaskShape.fillStyle(0xffffff, 1);
    this.mapMaskShape.fillRect(MAP_RECT.x, MAP_RECT.y, MAP_RECT.width, MAP_RECT.height);
    this.mapMask = this.mapMaskShape.createGeometryMask();
    this.mapGraphics = this.add.graphics().setDepth(1);
    this.mapGraphics.setMask(this.mapMask);
    this.uiGraphics = this.add.graphics().setDepth(2);
    this.dynamicObjects = this.add.group();
    this.cameras.main.setBackgroundColor('#0d1417');
    this.resizeCamera();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onPointerWheel, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    window.warForCrownJournal = () => this.exportJournal();
    window.addEventListener('keydown', this.onKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
      this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onPointerWheel, this);
      window.removeEventListener('keydown', this.onKeyDown);
      delete window.warForCrownJournal;
      this.mapMaskShape.destroy();
    });

    this.renderScene();
  }

  update(_time: number, deltaMs: number): void {
    if (this.aiActionCue !== null) {
      const previousFlash = Math.floor(this.aiActionCueElapsedMs / AI_ACTION_FLASH_MS);
      this.aiActionCueElapsedMs += deltaMs;
      if (this.aiActionCueElapsedMs >= AI_ACTION_CUE_MS) {
        this.startNextAiActionCue();
        this.renderScene();
      } else if (Math.floor(this.aiActionCueElapsedMs / AI_ACTION_FLASH_MS) !== previousFlash) {
        this.renderScene();
      }
      return;
    }

    if (
      this.phaseOverlay !== null &&
      this.phaseOverlay.hideAtMs !== null &&
      Date.now() >= this.phaseOverlay.hideAtMs
    ) {
      this.phaseOverlay = null;
      this.renderScene();
    }

    if (this.mapDragState !== null || this.movementSliderDragState !== null) {
      return;
    }

    if (!this.isMapVisible()) {
      return;
    }

    if (this.state.battle !== null || this.battleSummary !== null) {
      return;
    }

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (!this.contains(MAP_RECT, worldPoint.x, worldPoint.y)) {
      return;
    }

    const edgeVelocity = this.mapEdgeVelocity(worldPoint);
    if (edgeVelocity.x === 0 && edgeVelocity.y === 0) {
      return;
    }

    if (this.panMapBy(edgeVelocity.x * deltaMs * 0.001, edgeVelocity.y * deltaMs * 0.001)) {
      this.renderScene();
    }
  }

  private resizeCamera(): void {
    this.cameras.main
      .setViewport(
        0,
        0,
        WORLD_WIDTH * WAR_FOR_CROWN_RENDER_SCALE,
        WORLD_HEIGHT * WAR_FOR_CROWN_RENDER_SCALE
      )
      .setOrigin(0, 0)
      .setZoom(WAR_FOR_CROWN_RENDER_SCALE)
      .setScroll(0, 0);
  }

  private contains(rect: Rect, x: number, y: number): boolean {
    return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
  }

  private updatePointerHover(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const region = this.tooltipRegions.find((candidate) =>
      this.contains(candidate, worldPoint.x, worldPoint.y)
    );
    const button = this.buttons.find((candidate) =>
      candidate.enabled && this.contains(candidate, worldPoint.x, worldPoint.y)
    );
    const nextTooltip: TooltipState | null =
      region === undefined
        ? null
        : {
            id: region.id,
            content: region.content,
            x: region.x,
            y: region.y
          };
    const nextButtonId = button?.id ?? null;

    if (
      this.hoveredTooltip?.id === nextTooltip?.id &&
      this.hoveredTooltip?.x === nextTooltip?.x &&
      this.hoveredTooltip?.y === nextTooltip?.y &&
      this.hoveredButtonId === nextButtonId
    ) {
      return;
    }

    this.hoveredTooltip = nextTooltip;
    this.hoveredButtonId = nextButtonId;
    this.renderScene();
  }

  private drawTooltip(): void {
    if (this.hoveredTooltip === null) {
      return;
    }

    if (this.hoveredTooltip.content.kind === 'terrain') {
      this.drawTerrainTooltip(this.hoveredTooltip, this.hoveredTooltip.content);
      return;
    }

    const width = 300;
    const height = 86;
    const x = clamp(this.hoveredTooltip.x - 12, 18, WORLD_WIDTH - width - 18);
    const y = clamp(this.hoveredTooltip.y + 24, 18, WORLD_HEIGHT - height - 18);
    this.drawSkinFrame(this.uiGraphics, { x, y, width, height }, {
      fillColor: UI_SKIN.colors.panelAlt,
      fillAlpha: 0.98,
      lineColor: LEGAL_TARGET_COLOR
    });
    this.addText(x + 14, y + 12, this.hoveredTooltip.content.text, {
      fontSize: '11px',
      color: TEXT_COLOR,
      wordWrap: { width: width - 28 }
    });
  }

  private drawTerrainTooltip(tooltip: TooltipState, content: TerrainTooltipContent): void {
    const width = 276;
    const height = 190;
    const x = clamp(tooltip.x - width - 18, 18, WORLD_WIDTH - width - 18);
    const y = clamp(tooltip.y - 64, 18, WORLD_HEIGHT - height - 18);
    this.drawSkinFrame(this.uiGraphics, { x, y, width, height }, {
      fillColor: UI_SKIN.colors.panelAlt,
      fillAlpha: 0.98,
      lineColor: LEGAL_TARGET_COLOR,
      decorative: true
    });
    this.addText(x + 18, y + 14, content.label, {
      fontSize: '15px',
      color: TEXT_COLOR
    });

    const previewRect = { x: x + 18, y: y + 44, width: width - 36, height: 104 };
    if (content.terrainId === null) {
      drawWaterTile(this.uiGraphics, previewRect, 0, 0);
    } else {
      drawTerrainTile(this.uiGraphics, previewRect, content.terrainId, content.color, 0, 0);
    }
    drawStoneBoundary(
      this.uiGraphics,
      { x: previewRect.x, y: previewRect.y },
      { x: previewRect.x + previewRect.width, y: previewRect.y }
    );
    drawStoneBoundary(
      this.uiGraphics,
      { x: previewRect.x + previewRect.width, y: previewRect.y },
      { x: previewRect.x + previewRect.width, y: previewRect.y + previewRect.height }
    );
    drawStoneBoundary(
      this.uiGraphics,
      { x: previewRect.x + previewRect.width, y: previewRect.y + previewRect.height },
      { x: previewRect.x, y: previewRect.y + previewRect.height }
    );
    drawStoneBoundary(
      this.uiGraphics,
      { x: previewRect.x, y: previewRect.y + previewRect.height },
      { x: previewRect.x, y: previewRect.y }
    );

    const stats = content.income.length === 0
      ? ''
      : `${this.copy().incomeColumn}: ${content.income}    ${this.copy().defenceColumn}: ${content.defence}`;
    this.addText(x + 18, y + 158, stats, {
      fontSize: '11px',
      color: MUTED_TEXT_COLOR
    });
  }

  private isMapVisible(): boolean {
    return this.mode === 'map-select' || this.mode === 'player-setup' || this.mode === 'game';
  }

  private copy() {
    return UI_COPY[this.language];
  }

  private totalConfiguredPlayers(config: GameConfig = this.gameConfig): number {
    return config.humanPlayerCount + config.aiPlayerCount;
  }

  private c64AiName(aiIndex: number): string {
    const name = C64_AI_NAME_CHOICES[aiIndex - 1];
    if (name === undefined) {
      throw new Error(`Missing C64 AI name for AI index ${aiIndex}.`);
    }
    return name;
  }

  private defaultPlayerSetup(index: number, controller: PlayerController): PlayerSetup {
    const playerId = `p${index + 1}`;
    const aiIndex = index - this.gameConfig.humanPlayerCount + 1;
    const base = {
      playerId,
      name: controller === 'human' ? `P${index + 1}` : this.c64AiName(aiIndex),
      colorIndex: index % PLAYER_COLOR_CHOICES.length,
      crestIndex: index % PLAYER_CREST_CHOICES.length
    };

    if (controller === 'human') {
      return {
        ...base,
        controller
      };
    }

    return {
      ...base,
      controller,
      aiMode: 'c64-original'
    };
  }

  private syncExistingPlayerSetup(current: PlayerSetup, index: number, controller: PlayerController): PlayerSetup {
    const fallback = this.defaultPlayerSetup(index, controller);
    const base = {
      playerId: fallback.playerId,
      name: controller === 'human' && current.controller === 'human' ? current.name : fallback.name,
      colorIndex: current.colorIndex,
      crestIndex: current.crestIndex
    };

    if (controller === 'human') {
      return {
        ...base,
        controller
      };
    }

    return {
      ...base,
      controller,
      aiMode: current.controller === 'ai' ? current.aiMode : 'c64-original'
    };
  }

  private syncPlayerSetupsWithConfig(): void {
    const existing = new Map(this.playerSetups.map((setup) => [setup.playerId, setup]));
    const nextSetups: PlayerSetup[] = [];
    const totalPlayers = this.totalConfiguredPlayers();

    for (let index = 0; index < totalPlayers; index += 1) {
      const playerId = `p${index + 1}`;
      const controller: PlayerController = index < this.gameConfig.humanPlayerCount ? 'human' : 'ai';
      const current = existing.get(playerId);
      nextSetups.push(
        current === undefined
          ? this.defaultPlayerSetup(index, controller)
          : this.syncExistingPlayerSetup(current, index, controller)
      );
    }

    this.playerSetups = nextSetups;
    if (
      this.editingNamePlayerId !== null &&
      !nextSetups.some((setup) => setup.playerId === this.editingNamePlayerId && setup.controller === 'human')
    ) {
      this.editingNamePlayerId = nextSetups.find((setup) => setup.controller === 'human')?.playerId ?? null;
    }
  }

  private updateGameConfig(update: (config: GameConfig) => GameConfig, regenerateMap: boolean): void {
    const nextConfig = update(this.gameConfig);
    if (this.totalConfiguredPlayers(nextConfig) > PLAYER_COLOR_CHOICES.length) {
      throw new Error(`Configured players exceed available colors: ${this.totalConfiguredPlayers(nextConfig)}.`);
    }

    this.gameConfig = nextConfig;
    this.syncPlayerSetupsWithConfig();
    if (regenerateMap) {
      this.state = createInitialState(this.state.seed, this.gameConfig);
      this.resetMapView();
      this.clearMapSelection();
      this.battleSummary = null;
      this.actionJournal = [];
    }
    this.renderScene();
  }

  private updatePlayerCounts(humanPlayerCount: number, aiPlayerCount: number): void {
    const totalPlayers = humanPlayerCount + aiPlayerCount;
    if (totalPlayers < 2 || totalPlayers > PLAYER_DEFINITIONS.length) {
      throw new Error(
        `Configured C64 player count must be 2..${PLAYER_DEFINITIONS.length}, got ${totalPlayers}.`
      );
    }
    this.updateGameConfig(
      (config) => ({
        ...config,
        humanPlayerCount,
        aiPlayerCount
      }),
      false
    );
  }

  private cycleConfigOption(buttonId: ButtonId): void {
    switch (buttonId) {
      case 'map-province-count':
        this.updateGameConfig(
          (config) => ({ ...config, provinceCount: nextOption(PROVINCE_COUNT_OPTIONS, config.provinceCount) }),
          true
        );
        return;
      case 'map-max-villages':
        this.updateGameConfig(
          (config) => ({ ...config, maxVillages: nextOption(MAX_VILLAGE_OPTIONS, config.maxVillages) }),
          true
        );
        return;
      case 'map-village-mode':
        this.updateGameConfig(
          (config) => ({
            ...config,
            maxVillagesMode:
              config.maxVillagesMode === 'per-province' ? 'largest-province' : 'per-province'
          }),
          true
        );
        return;
      case 'setup-human-count':
        {
          const humanPlayerCount = nextOption(
            HUMAN_PLAYER_COUNT_OPTIONS,
            this.gameConfig.humanPlayerCount
          );
          const minimumAiCount = Math.max(0, 2 - humanPlayerCount);
          const maximumAiCount = PLAYER_DEFINITIONS.length - humanPlayerCount;
          this.updatePlayerCounts(
            humanPlayerCount,
            Math.max(minimumAiCount, Math.min(maximumAiCount, this.gameConfig.aiPlayerCount))
          );
        }
        return;
      case 'setup-ai-count':
        {
          const validAiCounts = AI_PLAYER_COUNT_OPTIONS.filter((aiPlayerCount) => {
            const totalPlayers = this.gameConfig.humanPlayerCount + aiPlayerCount;
            return totalPlayers >= 2 && totalPlayers <= PLAYER_DEFINITIONS.length;
          });
          this.updatePlayerCounts(
            this.gameConfig.humanPlayerCount,
            nextOption(validAiCounts, this.gameConfig.aiPlayerCount)
          );
        }
        return;
      case 'rules-village-cost':
        this.updateGameConfig(
          (config) => ({ ...config, villageCost: nextOption(VILLAGE_COST_OPTIONS, config.villageCost) }),
          false
        );
        return;
      case 'rules-interest':
        this.updateGameConfig(
          (config) => ({
            ...config,
            interestRatePercent: nextOption(INTEREST_RATE_OPTIONS, config.interestRatePercent)
          }),
          false
        );
        return;
      case 'rules-start-soldiers':
        this.updateGameConfig(
          (config) => ({
            ...config,
            startingSoldiers: nextOption(STARTING_SOLDIER_OPTIONS, config.startingSoldiers)
          }),
          false
        );
        return;
      case 'rules-start-money':
        this.updateGameConfig(
          (config) => ({ ...config, startingMoney: nextOption(STARTING_MONEY_OPTIONS, config.startingMoney) }),
          false
        );
        return;
      case 'rules-home-max-fort':
        this.updateGameConfig(
          (config) => ({
            ...config,
            maxHomeFortificationLevel: nextOption(
              HOME_FORTIFICATION_LEVEL_OPTIONS,
              config.maxHomeFortificationLevel
            )
          }),
          false
        );
        return;
      case 'rules-province-max-fort':
        this.updateGameConfig(
          (config) => ({
            ...config,
            maxProvinceFortificationLevel: nextOption(FORTIFICATION_LEVELS, config.maxProvinceFortificationLevel)
          }),
          false
        );
        return;
      case 'rules-royalist-growth':
        this.updateGameConfig(
          (config) => ({
            ...config,
            royalistGrowthPercent: nextOption(PERCENT_OPTIONS, config.royalistGrowthPercent)
          }),
          false
        );
        return;
      case 'rules-royalist-investment':
        this.updateGameConfig(
          (config) => ({
            ...config,
            royalistInvestmentPercent: nextOption(PERCENT_OPTIONS, config.royalistInvestmentPercent)
          }),
          false
        );
        return;
      case 'rules-terrain-influence':
        this.updateGameConfig(
          (config) => ({
            ...config,
            terrainInfluence: nextOption(['none', 'income', 'combat', 'both'] as const, config.terrainInfluence)
          }),
          false
        );
        return;
      case 'rules-royalist-attitude':
        this.updateGameConfig(
          (config) => ({
            ...config,
            royalistAttitude: nextOption(['friendly', 'neutral', 'hostile'] as const, config.royalistAttitude)
          }),
          false
        );
        return;
      case 'rules-royalist-distribution':
        this.updateGameConfig(
          (config) => ({
            ...config,
            royalistDistribution: nextOption(['none', 'even', 'border'] as const, config.royalistDistribution)
          }),
          false
        );
        return;
      case 'rules-show-computer-battles':
        this.updateGameConfig(
          (config) => ({ ...config, showComputerBattles: !config.showComputerBattles }),
          false
        );
        return;
      default:
        throw new Error(`Button ${buttonId} is not a config option.`);
    }
  }

  private toggleLanguage(): void {
    this.language = this.language === 'pl' ? 'en' : 'pl';
    this.message = this.mode === 'main-menu' ? this.copy().mainMenuSubtitle : this.message;
    if (this.phaseOverlay !== null) {
      this.showCurrentPhaseOverlay();
    }
    this.renderScene();
  }

  private playerSetup(playerId: PlayerId): PlayerSetup {
    const setup = this.playerSetups.find((candidate) => candidate.playerId === playerId);
    if (setup === undefined) {
      throw new Error(`Missing setup for player ${playerId}.`);
    }
    return setup;
  }

  private playerCrest(playerId: PlayerId): CrestChoice {
    const setup = this.playerSetup(playerId);
    const crest = PLAYER_CREST_CHOICES[setup.crestIndex];
    if (crest === undefined) {
      throw new Error(`Missing crest ${setup.crestIndex} for ${playerId}.`);
    }
    return crest;
  }

  private playerColor(playerId: PlayerId): number {
    const setup = this.playerSetup(playerId);
    const color = PLAYER_COLOR_CHOICES[setup.colorIndex];
    if (color === undefined) {
      throw new Error(`Missing color ${setup.colorIndex} for ${playerId}.`);
    }
    return color;
  }

  private playerAiMode(playerId: PlayerId): WarForCrownAiMode {
    const setup = this.playerSetup(playerId);
    if (setup.controller !== 'ai') {
      throw new Error(`Player ${playerId} is not controlled by AI.`);
    }
    return setup.aiMode;
  }

  private updatePlayerSetup(playerId: PlayerId, update: (setup: PlayerSetup) => PlayerSetup): void {
    this.playerSetups = this.playerSetups.map((setup) =>
      setup.playerId === playerId ? update(setup) : setup
    );
    this.renderScene();
  }

  private updatePlayerName(playerId: PlayerId, update: (current: string) => string): void {
    this.updatePlayerSetup(playerId, (setup) => ({
      ...setup,
      name: update(setup.name)
    }));
  }

  private cyclePlayerColor(playerId: PlayerId): void {
    this.updatePlayerSetup(playerId, (setup) => ({
      ...setup,
      colorIndex: (setup.colorIndex + 1) % PLAYER_COLOR_CHOICES.length
    }));
  }

  private cyclePlayerCrest(playerId: PlayerId): void {
    this.updatePlayerSetup(playerId, (setup) => ({
      ...setup,
      crestIndex: (setup.crestIndex + 1) % PLAYER_CREST_CHOICES.length
    }));
  }

  private cyclePlayerAiMode(playerId: PlayerId): void {
    this.updatePlayerSetup(playerId, (setup) => {
      if (setup.controller !== 'ai') {
        throw new Error(`Cannot set AI mode for human player ${playerId}.`);
      }

      return {
        ...setup,
        aiMode: nextOption(PLAYER_FACING_AI_MODES, setup.aiMode)
      };
    });
  }

  private playerNamesAreValid(): boolean {
    const names = this.playerSetups.map((setup) => setup.name.trim());
    return names.every((name) => name.length > 0) && new Set(names).size === names.length;
  }

  private startMapSelection(seed: number = this.state.seed + 1): void {
    this.mode = 'map-select';
    this.editingSeed = null;
    this.state = createInitialState(seed, this.gameConfig);
    this.selectedFromId = null;
    this.selectedTargetId = null;
    this.selectedAttackSourceIds = [];
    this.pendingHomeProvinceId = null;
    this.editingNamePlayerId = null;
    this.eventLog = [];
    this.actionJournal = [];
    this.phaseOverlay = null;
    this.battleSummary = null;
    this.announcedPhaseKey = null;
    this.resetMapView();
    this.message = this.copy().chooseMapInstruction;
    this.renderScene();
  }

  private commitSeedEdit(): void {
    if (this.editingSeed === null) {
      throw new Error('Cannot commit a map seed outside seed editing.');
    }

    let seed: number;
    try {
      seed = parseMapSeedInput(this.editingSeed);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      this.message = this.copy().invalidSeed;
      this.renderScene();
      return;
    }

    this.startMapSelection(seed);
  }

  private startPlayerSetup(): void {
    this.mode = 'player-setup';
    this.editingSeed = null;
    this.syncPlayerSetupsWithConfig();
    this.editingNamePlayerId = 'p1';
    this.message = this.copy().setupInstruction;
    this.renderScene();
  }

  private configuredState(state: GameState): GameState {
    return {
      ...state,
      players: state.players.map((player) => ({
        ...player,
        label: this.playerSetup(player.id).name.trim(),
        color: this.playerColor(player.id)
      }))
    };
  }

  private startHomeSelection(): void {
    if (!this.playerNamesAreValid()) {
      this.message = this.copy().duplicateNames;
      this.renderScene();
      return;
    }

    this.mode = 'game';
    this.state = this.configuredState(createInitialState(this.state.seed, this.gameConfig));
    this.selectedFromId = null;
    this.selectedTargetId = null;
    this.selectedAttackSourceIds = [];
    this.selectedHireSoldiers = 1;
    this.pendingHomeProvinceId = null;
    this.editingNamePlayerId = null;
    this.eventLog = [];
    this.actionJournal = [];
    this.battleSummary = null;
    this.aiActionCue = null;
    this.aiActionCueQueue = [];
    this.announcedPhaseKey = null;
    this.message = turnUiCopy(this.state, this.language).instruction;
    this.playAiUntilHumanTurn();
    this.renderScene();
  }

  private newMonthSummary(): string {
    const preview = applyPlayerAction(
      this.state,
      this.state.activePlayerId,
      { type: 'advance-step' },
      this.gameConfig
    );
    const incomeEvent = preview.events.find((event) => event.type === 'income-collected');
    if (incomeEvent === undefined) {
      throw new Error('New-month preview did not emit income-collected.');
    }
    const weather = WEATHER_LABELS[preview.state.c64.calendar.weatherIndex];
    if (weather === undefined) {
      throw new Error(
        `Missing weather label for index ${preview.state.c64.calendar.weatherIndex}.`
      );
    }
    const randomEvent = preview.events.find((event) => event.type === 'c64-random-event');
    const eventLabel = randomEvent === undefined
      ? (this.language === 'pl' ? 'brak' : 'none')
      : `${randomEvent.eventId} (${randomEvent.effect})`;

    return this.language === 'pl'
      ? `Miesiac ${this.state.turnNumber}. Pogoda: ${weather.pl}. Dochod: +${incomeEvent.money}. Zdarzenie: ${eventLabel}.`
      : `Month ${this.state.turnNumber}. Weather: ${weather.en}. Income: +${incomeEvent.money}. Event: ${eventLabel}.`;
  }

  private phaseOverlaySubtitle(): string {
    if (this.state.phase === 'turn' && this.state.turnStep === 'new-month') {
      return this.newMonthSummary();
    }

    return turnUiCopy(this.state, this.language).instruction;
  }

  private canShowPhaseOverlay(): boolean {
    return this.state.battle === null && this.battleSummary === null;
  }

  private showCurrentPhaseOverlay(subtitle: string = this.phaseOverlaySubtitle()): void {
    if (!this.canShowPhaseOverlay()) {
      this.phaseOverlay = null;
      return;
    }

    this.announcedPhaseKey = this.currentPhaseKey();
    this.phaseOverlay = {
      title: turnUiCopy(this.state, this.language).title,
      subtitle,
      hideAtMs:
        this.state.phase === 'turn' && this.state.turnStep === 'new-month'
          ? null
          : Date.now() + PHASE_OVERLAY_MS
    };
  }

  private currentPhaseKey(): string | null {
    if (this.mode !== 'game') {
      return null;
    }

    return `${this.state.activePlayerId}:${this.state.phase}:${this.state.turnStep}:${this.state.turnNumber}`;
  }

  private ensurePhaseOverlay(): void {
    if (!this.canShowPhaseOverlay()) {
      this.phaseOverlay = null;
      return;
    }

    const phaseKey = this.currentPhaseKey();
    if (phaseKey === null || phaseKey === this.announcedPhaseKey) {
      return;
    }

    this.showCurrentPhaseOverlay();
  }

  private exportJournal(): WarForCrownSceneJournal {
    return {
      seed: this.state.seed,
      config: snapshotJournalValue(this.gameConfig),
      playerSetups: snapshotJournalValue(this.playerSetups),
      currentState: snapshotJournalValue(this.state),
      entries: snapshotJournalValue(this.actionJournal)
    };
  }

  private applyJournaledActionForPlayer(playerId: PlayerId, action: WarForCrownAction): ReadonlyArray<WarForCrownEvent> {
    const before = this.state;
    const result = applyPlayerAction(this.state, playerId, action, this.gameConfig);
    this.state = result.state;
    this.actionJournal = [
      ...this.actionJournal,
      createJournalEntry(
        this.actionJournal.length + 1,
        before,
        playerId,
        action,
        result.events,
        result.state
      )
    ];
    this.appendEventLog(result.events);
    if (this.state.phase === 'game-over') {
      this.aiActionCue = null;
      this.aiActionCueQueue = [];
    } else {
      const cues = aiActionCues(result.events).filter((cue) =>
        isRoyalistOwner(cue.actorId) || (isPlayerOwner(cue.actorId) && this.isAiPlayer(cue.actorId))
      );
      if (cues.length > 0) {
        this.aiActionCueQueue = [...this.aiActionCueQueue, ...cues];
        if (this.aiActionCue === null) {
          this.startNextAiActionCue();
        }
      }
    }
    return result.events;
  }

  private startNextAiActionCue(): void {
    const [next, ...remaining] = this.aiActionCueQueue;
    this.aiActionCue = next ?? null;
    this.aiActionCueQueue = remaining;
    this.aiActionCueElapsedMs = 0;
  }

  private applyActiveAction(action: WarForCrownAction): ReadonlyArray<WarForCrownEvent> {
    return this.applyJournaledActionForPlayer(this.state.activePlayerId, action);
  }

  private battleStartedEvent(
    events: ReadonlyArray<WarForCrownEvent>
  ): Extract<WarForCrownEvent, { readonly type: 'battle-started' }> | null {
    return events.find(
      (event): event is Extract<WarForCrownEvent, { readonly type: 'battle-started' }> =>
        event.type === 'battle-started'
    ) ?? null;
  }

  private battleRoundEvent(
    events: ReadonlyArray<WarForCrownEvent>
  ): Extract<WarForCrownEvent, { readonly type: 'battle-round-resolved' }> | null {
    return events.find(
      (event): event is Extract<WarForCrownEvent, { readonly type: 'battle-round-resolved' }> =>
        event.type === 'battle-round-resolved'
    ) ?? null;
  }

  private battleResolvedEvent(
    events: ReadonlyArray<WarForCrownEvent>
  ): Extract<WarForCrownEvent, { readonly type: 'battle-resolved' }> | null {
    return events.find(
      (event): event is Extract<WarForCrownEvent, { readonly type: 'battle-resolved' }> =>
        event.type === 'battle-resolved'
    ) ?? null;
  }

  private updateBattleStartMessage(event: Extract<WarForCrownEvent, { readonly type: 'battle-started' }>): void {
    const attacker = requirePlayer(this.state, event.attackerId);
    const target = requireProvince(this.state, event.targetProvinceId);
    const terrainLabel = terrainLabelForLanguage(target.terrainId, this.language);
    this.message = `${attacker.label} ${this.copy().attacksInBattle} ${terrainLabel}: ${event.attackingSoldiers} ${this.copy().soldiers}.`;
  }

  private captureBattleSummary(events: ReadonlyArray<WarForCrownEvent>): void {
    const battleResult = this.battleResolvedEvent(events);
    if (battleResult === null) {
      return;
    }

    const round = this.battleRoundEvent(events);
    if (round === null) {
      throw new Error('Battle resolution requires a battle-round-resolved event.');
    }

    this.battleSummary = {
      attackerId: battleResult.attackerId,
      defenderId: battleResult.defenderId,
      fromProvinceIds: battleResult.fromProvinceIds,
      targetProvinceId: battleResult.targetProvinceId,
      attackingSoldiers: battleResult.attackingSoldiers,
      round: round.round,
      attackerLosses: battleResult.result.attackerLosses,
      defenderLosses: battleResult.result.defenderLosses,
      result: battleResult.result
    };
  }

  private isAiPlayer(playerId: PlayerId): boolean {
    return this.playerSetup(playerId).controller === 'ai';
  }

  private playAiUntilHumanTurn(): void {
    let steps = 0;
    while (
      this.mode === 'game' &&
      this.state.phase !== 'game-over' &&
      this.state.battle === null &&
      this.battleSummary === null &&
      this.isAiPlayer(this.state.activePlayerId)
    ) {
      if (steps >= AI_AUTOPLAY_STEP_LIMIT) {
        throw new Error(`AI autoplay exceeded ${AI_AUTOPLAY_STEP_LIMIT} steps.`);
      }

      const playerId = this.state.activePlayerId;
      const view = createPlayerView(this.state, playerId, this.gameConfig);
      const action = chooseAiAction(view, this.gameConfig, this.playerAiMode(playerId));
      const events = this.applyJournaledActionForPlayer(playerId, action);
      this.captureBattleSummary(events);
      const battleStarted = this.battleStartedEvent(events);
      if (battleStarted !== null) {
        this.updateBattleStartMessage(battleStarted);
      }
      steps += 1;
    }
  }

  private appendEventLog(events: ReadonlyArray<WarForCrownEvent>): void {
    const lines = events
      .filter((event) => this.shouldDisplayEvent(event))
      .map((event) => formatEventForLog(this.state, event, this.language))
      .filter((line): line is string => line !== null);
    if (lines.length === 0) {
      return;
    }

    this.eventLog = [...this.eventLog, ...lines].slice(-EVENT_LOG_LIMIT);
  }

  private shouldDisplayEvent(event: WarForCrownEvent): boolean {
    if (event.type !== 'battle-resolved' || this.gameConfig.showComputerBattles) {
      return true;
    }

    return !(
      this.isAiPlayer(event.attackerId) &&
      isPlayerOwner(event.defenderId) &&
      this.isAiPlayer(event.defenderId)
    );
  }

  private tileAtGrid(x: number, y: number): TileState | null {
    if (x < 0 || y < 0 || x >= this.state.map.width || y >= this.state.map.height) {
      return null;
    }

    return this.state.map.tiles[tileIndex(this.state.map.width, x, y)] ?? null;
  }

  private tileWidth(): number {
    return (MAP_RECT.width / createMapDisplayFrame(this.state.map).width) * this.mapViewport.zoom;
  }

  private tileHeight(): number {
    return (MAP_RECT.height / createMapDisplayFrame(this.state.map).height) * this.mapViewport.zoom;
  }

  private tileRect(tile: TileState): Rect {
    const frame = createMapDisplayFrame(this.state.map);
    return {
      x: MAP_RECT.x + (tile.x - frame.x) * this.tileWidth() - this.mapViewport.offsetX,
      y: MAP_RECT.y + (tile.y - frame.y) * this.tileHeight() - this.mapViewport.offsetY,
      width: this.tileWidth(),
      height: this.tileHeight()
    };
  }

  private mapContentWidth(zoom: number = this.mapViewport.zoom): number {
    return MAP_RECT.width * zoom;
  }

  private mapContentHeight(zoom: number = this.mapViewport.zoom): number {
    return MAP_RECT.height * zoom;
  }

  private maxMapOffsetX(zoom: number = this.mapViewport.zoom): number {
    return Math.max(0, this.mapContentWidth(zoom) - MAP_RECT.width);
  }

  private maxMapOffsetY(zoom: number = this.mapViewport.zoom): number {
    return Math.max(0, this.mapContentHeight(zoom) - MAP_RECT.height);
  }

  private clampMapViewport(viewport: MapViewport): MapViewport {
    return {
      zoom: viewport.zoom,
      offsetX: clamp(viewport.offsetX, 0, this.maxMapOffsetX(viewport.zoom)),
      offsetY: clamp(viewport.offsetY, 0, this.maxMapOffsetY(viewport.zoom))
    };
  }

  private tileAt(x: number, y: number): TileState | null {
    if (!this.contains(MAP_RECT, x, y)) {
      return null;
    }

    const frame = createMapDisplayFrame(this.state.map);
    const tileX = frame.x + Math.floor((x - MAP_RECT.x + this.mapViewport.offsetX) / this.tileWidth());
    const tileY = frame.y + Math.floor((y - MAP_RECT.y + this.mapViewport.offsetY) / this.tileHeight());

    return this.tileAtGrid(tileX, tileY);
  }

  private mapEdgeVelocity(point: Point): Point {
    const left = point.x - MAP_RECT.x;
    const right = MAP_RECT.x + MAP_RECT.width - point.x;
    const top = point.y - MAP_RECT.y;
    const bottom = MAP_RECT.y + MAP_RECT.height - point.y;
    let x = 0;
    let y = 0;

    if (left < MAP_EDGE_SCROLL_SIZE && this.canPanLeft()) {
      x = -MAP_EDGE_SCROLL_SPEED * ((MAP_EDGE_SCROLL_SIZE - left) / MAP_EDGE_SCROLL_SIZE);
    } else if (right < MAP_EDGE_SCROLL_SIZE && this.canPanRight()) {
      x = MAP_EDGE_SCROLL_SPEED * ((MAP_EDGE_SCROLL_SIZE - right) / MAP_EDGE_SCROLL_SIZE);
    }

    if (top < MAP_EDGE_SCROLL_SIZE && this.canPanUp()) {
      y = -MAP_EDGE_SCROLL_SPEED * ((MAP_EDGE_SCROLL_SIZE - top) / MAP_EDGE_SCROLL_SIZE);
    } else if (bottom < MAP_EDGE_SCROLL_SIZE && this.canPanDown()) {
      y = MAP_EDGE_SCROLL_SPEED * ((MAP_EDGE_SCROLL_SIZE - bottom) / MAP_EDGE_SCROLL_SIZE);
    }

    return { x, y };
  }

  private handleMapClick(worldPoint: Point): void {
    if (this.mode !== 'game') {
      return;
    }

    const tile = this.tileAt(worldPoint.x, worldPoint.y);
    if (tile === null) {
      return;
    }

    if (tile.provinceId === null) {
      this.clearMapSelection();
      this.message = this.copy().clearSelection;
      this.renderScene();
      return;
    }

    this.handleProvinceClick(tile.provinceId);
  }

  private handleProvinceClick(provinceId: ProvinceId): void {
    const province = requireProvince(this.state, provinceId);

    if (this.state.phase === 'home-selection') {
      if (!isRoyalistOwner(province.ownerId)) {
        this.message = `${provinceOwnerLabel(this.state, province, this.language)}: ${this.copy().occupied}`;
        this.renderScene();
        return;
      }

      this.pendingHomeProvinceId = provinceId;
      this.selectedFromId = provinceId;
      this.selectedTargetId = null;
      this.selectedAttackSourceIds = [];
      this.message = `${this.copy().pendingHome}: ${provinceId}.`;
      this.renderScene();
      return;
    }

    if (this.state.phase === 'game-over') {
      this.message = turnUiCopy(this.state, this.language).instruction;
      this.renderScene();
      return;
    }

    if (this.isAttackStep()) {
      this.handleAttackProvinceClick(province);
      return;
    }

    if (this.isMovementStep()) {
      this.handleMovementProvinceClick(province);
      return;
    }

    if (province.ownerId === this.state.activePlayerId) {
      this.selectedFromId = province.id;
      this.selectedTargetId = null;
      this.selectedAttackSourceIds = [];
      this.message =
        province.soldiers > 1
          ? `${province.id}: ${province.soldiers} ${this.copy().soldiers}.`
          : `${province.id}: ${this.copy().notEnoughSoldiers}`;
      this.renderScene();
      return;
    }

    if (this.selectedFromId === null) {
      this.message = this.copy().selectOwnProvince;
      this.renderScene();
      return;
    }

    const fromProvince = requireProvince(this.state, this.selectedFromId);
    if (!fromProvince.neighbours.includes(province.id)) {
      this.message = `${this.copy().borderMissing} ${fromProvince.id}.`;
      this.renderScene();
      return;
    }

    this.selectedTargetId = province.id;
    this.message = `${province.id}: ${province.soldiers} ${this.copy().defenders}.`;
    this.renderScene();
  }

  private selectMovementSource(province: ProvinceState): void {
    this.selectedFromId = province.id;
    this.selectedTargetId = null;
    this.selectedAttackSourceIds = [];
    this.selectedMoveSoldiers = province.soldiers > 1 ? province.soldiers - 1 : null;
    this.message =
      province.soldiers > 1
        ? `${province.id}: ${province.soldiers} ${this.copy().soldiers}. ${this.copy().chooseMoveTarget}`
        : `${province.id}: ${this.copy().notEnoughSoldiers}`;
    this.renderScene();
  }

  private handleMovementProvinceClick(province: ProvinceState): void {
    const activePlayerId = this.state.activePlayerId;
    if (province.ownerId !== activePlayerId) {
      this.message =
        this.selectedFromId === null ? this.copy().selectOwnProvince : this.copy().chooseMoveTarget;
      this.renderScene();
      return;
    }

    if (this.selectedFromId === null || this.selectedFromId === province.id) {
      this.selectMovementSource(province);
      return;
    }

    const fromProvince = requireProvince(this.state, this.selectedFromId);
    if (fromProvince.ownerId !== activePlayerId) {
      throw new Error(`Selected movement source ${fromProvince.id} is not owned by ${activePlayerId}.`);
    }

    if (fromProvince.soldiers <= 1) {
      this.message = this.copy().notEnoughSoldiers;
      this.renderScene();
      return;
    }

    this.selectedTargetId = province.id;
    this.selectedAttackSourceIds = [];
    this.syncSelectedMoveSoldiers();
    this.message = `${fromProvince.id} -> ${province.id}: ${this.movementSoldiers()} ${this.copy().soldiers}.`;
    this.renderScene();
  }

  private handleAttackProvinceClick(province: ProvinceState): void {
    if (province.ownerId !== this.state.activePlayerId) {
      const sourceIds = this.validAttackSourceIds(province.id);
      if (sourceIds.length < 1) {
        this.message = this.copy().borderMissing;
        this.renderScene();
        return;
      }

      this.selectedFromId = null;
      this.selectedTargetId = province.id;
      this.selectedAttackSourceIds = [];
      this.message = `${province.id}: ${this.copy().chooseAttackSource}`;
      this.renderScene();
      return;
    }

    if (this.selectedTargetId === null) {
      this.message = this.copy().chooseTarget;
      this.renderScene();
      return;
    }

    const validSourceIds = this.validAttackSourceIds(this.selectedTargetId);
    if (!validSourceIds.includes(province.id)) {
      this.message = this.copy().borderMissing;
      this.renderScene();
      return;
    }

    this.selectedFromId = province.id;
    this.selectedAttackSourceIds = this.selectedAttackSourceIds.includes(province.id)
      ? this.selectedAttackSourceIds.filter((sourceId) => sourceId !== province.id)
      : [...this.selectedAttackSourceIds, province.id];
    this.message =
      this.selectedAttackSourceIds.length > 0
        ? `${this.selectedAttackSourceIds.length} -> ${this.selectedTargetId}, ${this.selectedAttackSoldiers()} ${this.copy().soldiers}.`
        : this.copy().chooseAttackSource;
    this.renderScene();
  }

  private handleButton(button: CommandButton): void {
    if (!button.enabled) {
      this.message = this.disabledButtonMessage(button.id);
      this.renderScene();
      return;
    }

    if (this.battleSummary !== null && button.id !== 'battle-summary-confirm') {
      return;
    }

    switch (button.id) {
      case 'advance-step':
        this.applyActiveAction({
          type: 'advance-step'
        });
        this.playAiUntilHumanTurn();
        this.clearMapSelection();
        this.message = turnUiCopy(this.state, this.language).instruction;
        this.showCurrentPhaseOverlay();
        this.renderScene();
        break;
      case 'attack':
        this.performAttack();
        break;
      case 'battle-retreat-attacker':
        this.performBattleAction({ type: 'battle-retreat-attacker' });
        break;
      case 'battle-retreat-defender':
        this.performBattleAction({ type: 'battle-retreat-defender' });
        break;
      case 'battle-round':
        this.performBattleAction({ type: 'battle-round' });
        break;
      case 'battle-view':
        this.performVisibleAiBattleAction();
        break;
      case 'battle-summary-confirm':
        this.confirmBattleSummary();
        break;
      case 'build-village':
        this.performBuildVillage();
        break;
      case 'confirm-home':
        this.confirmPendingHome();
        this.renderScene();
        break;
      case 'end-turn':
        this.applyActiveAction({
          type: 'end-turn'
        });
        this.playAiUntilHumanTurn();
        this.clearMapSelection();
        this.message = turnUiCopy(this.state, this.language).instruction;
        this.showCurrentPhaseOverlay();
        this.renderScene();
        break;
      case 'language-toggle':
        this.toggleLanguage();
        break;
      case 'main-load':
        this.message = this.copy().loadUnavailable;
        this.renderScene();
        break;
      case 'main-new-game':
        this.startMapSelection(this.state.seed);
        break;
      case 'main-rules':
        this.mode = 'rules';
        this.message = this.copy().rulesTitle;
        this.renderScene();
        break;
      case 'main-sofa-arcade':
        if (this.returnUrl === null) {
          throw new Error('Cannot return to Sofa Arcade without a configured return URL.');
        }
        window.location.assign(this.returnUrl);
        break;
      case 'map-accept':
        this.startPlayerSetup();
        break;
      case 'map-back':
        this.mode = 'main-menu';
        this.message = this.copy().mainMenuSubtitle;
        this.renderScene();
        break;
      case 'map-max-villages':
      case 'map-province-count':
      case 'map-village-mode':
        this.cycleConfigOption(button.id);
        break;
      case 'map-regenerate':
        this.startMapSelection(this.state.seed + 1);
        break;
      case 'map-seed':
        this.editingSeed = '';
        this.message = this.copy().seedInputInstruction;
        this.renderScene();
        break;
      case 'move-equal': {
        const soldiers = this.equalizedMoveSoldiers();
        if (soldiers === null) {
          throw new Error('Cannot equalize movement without a legal equalized amount.');
        }
        this.setSelectedMoveSoldiers(soldiers);
        this.renderScene();
        break;
      }
      case 'move-max':
        this.setSelectedMoveSoldiers(this.maxMovementSoldiers());
        this.renderScene();
        break;
      case 'move-minus':
        this.changeSelectedMoveSoldiers(-1);
        break;
      case 'move-plus':
        this.changeSelectedMoveSoldiers(1);
        break;
      case 'move-soldiers':
        this.performMoveSoldiers();
        break;
      case 'new-map':
        this.mode = 'main-menu';
        this.phaseOverlay = null;
        this.battleSummary = null;
        this.message = this.copy().mainMenuSubtitle;
        this.renderScene();
        break;
      case 'hire-soldiers':
        this.performHireSoldiers();
        break;
      case 'hire-minus':
        this.changeSelectedHireSoldiers(-1);
        break;
      case 'hire-plus':
        this.changeSelectedHireSoldiers(1);
        break;
      case 'hire-max':
        this.selectedHireSoldiers = this.affordableHireSoldiers();
        this.renderScene();
        break;
      case 'victory-menu':
        this.mode = 'main-menu';
        this.phaseOverlay = null;
        this.battleSummary = null;
        this.aiActionCue = null;
        this.aiActionCueQueue = [];
        this.message = this.copy().mainMenuSubtitle;
        this.renderScene();
        break;
      case 'rules-back':
        this.mode = 'main-menu';
        this.message = this.copy().mainMenuSubtitle;
        this.renderScene();
        break;
      case 'rules-new-game':
        this.startMapSelection(this.state.seed);
        break;
      case 'rules-home-max-fort':
      case 'rules-interest':
      case 'rules-province-max-fort':
      case 'rules-royalist-attitude':
      case 'rules-royalist-distribution':
      case 'rules-royalist-growth':
      case 'rules-royalist-investment':
      case 'rules-start-money':
      case 'rules-start-soldiers':
      case 'rules-show-computer-battles':
      case 'rules-terrain-influence':
      case 'rules-village-cost':
        this.cycleConfigOption(button.id);
        break;
      case 'setup-ai-count':
      case 'setup-human-count':
        this.cycleConfigOption(button.id);
        break;
      case 'setup-ai-mode-p1':
      case 'setup-ai-mode-p2':
      case 'setup-ai-mode-p3':
      case 'setup-ai-mode-p4':
        this.cyclePlayerAiMode(playerIdFromAiModeButton(button.id));
        break;
      case 'setup-back':
        this.mode = 'map-select';
        this.editingNamePlayerId = null;
        this.message = this.copy().chooseMapInstruction;
        this.renderScene();
        break;
      case 'setup-color-p1':
        this.cyclePlayerColor('p1');
        break;
      case 'setup-color-p2':
        this.cyclePlayerColor('p2');
        break;
      case 'setup-crest-p1':
        this.cyclePlayerCrest('p1');
        break;
      case 'setup-crest-p2':
        this.cyclePlayerCrest('p2');
        break;
      case 'setup-name-p1':
        this.editingNamePlayerId = 'p1';
        this.renderScene();
        break;
      case 'setup-name-p2':
        this.editingNamePlayerId = 'p2';
        this.renderScene();
        break;
      case 'setup-start':
        this.startHomeSelection();
        break;
      case 'upgrade-fort':
        this.performUpgradeFortification();
        break;
      default:
        button.id satisfies never;
    }
  }

  private disabledButtonMessage(id: ButtonId): string {
    switch (id) {
      case 'advance-step':
        return this.state.phase === 'home-selection'
          ? this.copy().noHomePending
          : turnUiCopy(this.state, this.language).instruction;
      case 'attack':
        if (this.state.turnStep !== 'attack') {
          return this.copy().attackStep;
        }
        if (this.selectedTargetId === null) {
          return this.copy().chooseTarget;
        }
        if (this.selectedAttackSourceIds.length < 1) {
          return this.copy().chooseAttackSource;
        }
        return this.copy().notEnoughSoldiers;
      case 'battle-retreat-attacker':
      case 'battle-retreat-defender':
      case 'battle-round':
      case 'battle-view':
        return this.copy().battle;
      case 'battle-summary-confirm':
        return this.copy().battleSummaryTitle;
      case 'build-village':
        if (this.selectedFromId === null) {
          return this.copy().selectOwnProvince;
        }
        if (this.state.phase !== 'turn' || this.state.turnStep !== 'investment') {
          return this.copy().buildStep;
        }
        if (requireProvince(this.state, this.selectedFromId).ownerId !== this.state.activePlayerId) {
          return this.copy().selectOwnProvince;
        }
        if (requireProvince(this.state, this.selectedFromId).villages >= this.gameConfig.maxVillages) {
          return this.copy().villageLimit;
        }
        if (requirePlayer(this.state, this.state.activePlayerId).money < this.gameConfig.villageCost) {
          return this.copy().notEnoughMoney;
        }
        return this.copy().buildStep;
      case 'confirm-home':
        return this.copy().noHomePending;
      case 'end-turn':
        return this.state.phase === 'home-selection'
          ? this.copy().noHomePending
          : turnUiCopy(this.state, this.language).instruction;
      case 'hire-soldiers':
        if (this.state.phase !== 'turn' || this.state.turnStep !== 'investment') {
          return this.copy().hireStep;
        }
        if (requirePlayer(this.state, this.state.activePlayerId).homeProvinceId === null) {
          return this.copy().noHomePending;
        }
        return this.copy().notEnoughMoney;
      case 'hire-minus':
      case 'hire-plus':
      case 'hire-max':
        return this.copy().recruit;
      case 'language-toggle':
        return this.copy().language;
      case 'main-load':
        return this.copy().loadUnavailable;
      case 'main-new-game':
      case 'main-rules':
      case 'main-sofa-arcade':
      case 'map-accept':
      case 'map-back':
      case 'map-max-villages':
      case 'map-province-count':
      case 'map-regenerate':
      case 'map-seed':
      case 'map-village-mode':
        return this.copy().chooseMapInstruction;
      case 'move-equal':
      case 'move-max':
      case 'move-minus':
      case 'move-plus':
      case 'move-soldiers':
        if (this.state.phase !== 'turn' || this.state.turnStep !== 'movement') {
          return this.copy().moveStep;
        }
        if (this.selectedFromId === null) {
          return this.copy().selectOwnProvince;
        }
        if (this.selectedTargetId === null) {
          return this.copy().chooseMoveTarget;
        }
        if (id === 'move-equal') {
          return this.copy().cannotEqualizeMove;
        }
        return this.copy().notEnoughSoldiers;
      case 'new-map':
      case 'victory-menu':
        return this.copy().menu;
      case 'rules-back':
      case 'rules-new-game':
      case 'rules-home-max-fort':
      case 'rules-interest':
      case 'rules-province-max-fort':
      case 'rules-royalist-attitude':
      case 'rules-royalist-distribution':
      case 'rules-royalist-growth':
      case 'rules-royalist-investment':
      case 'rules-start-money':
      case 'rules-start-soldiers':
      case 'rules-show-computer-battles':
      case 'rules-terrain-influence':
      case 'rules-village-cost':
        return this.copy().rulesTitle;
      case 'setup-back':
      case 'setup-ai-count':
      case 'setup-ai-mode-p1':
      case 'setup-ai-mode-p2':
      case 'setup-ai-mode-p3':
      case 'setup-ai-mode-p4':
      case 'setup-color-p1':
      case 'setup-color-p2':
      case 'setup-crest-p1':
      case 'setup-crest-p2':
      case 'setup-name-p1':
      case 'setup-name-p2':
      case 'setup-start':
      case 'setup-human-count':
        return this.copy().setupInstruction;
      case 'upgrade-fort':
        if (this.selectedFromId === null) {
          return this.copy().selectOwnProvince;
        }
        if (this.state.phase !== 'turn' || this.state.turnStep !== 'investment') {
          return this.copy().fortStep;
        }
        if (requireProvince(this.state, this.selectedFromId).ownerId !== this.state.activePlayerId) {
          return this.copy().selectOwnProvince;
        }
        if (requireProvince(this.state, this.selectedFromId).upgradedFortificationThisTurn) {
          return this.copy().fortAlready;
        }
        if (
          fortificationIndex(requireProvince(this.state, this.selectedFromId)) >=
          maxFortificationIndex(requireProvince(this.state, this.selectedFromId), this.state, this.gameConfig)
        ) {
          return this.copy().fortMaxed;
        }
        if (requirePlayer(this.state, this.state.activePlayerId).money < this.gameConfig.fortificationUpgradeCost) {
          return this.copy().notEnoughMoney;
        }
        return this.copy().fortStep;
      default:
        id satisfies never;
        throw new Error('Unhandled disabled button id.');
    }
  }

  private confirmPendingHome(): void {
    if (this.pendingHomeProvinceId === null) {
      this.message = this.copy().noHomePending;
      return;
    }

    const confirmedProvinceId = this.pendingHomeProvinceId;
    this.applyActiveAction({
      type: 'select-home',
      provinceId: confirmedProvinceId
    });
    this.playAiUntilHumanTurn();
    this.pendingHomeProvinceId = null;
    this.selectedFromId = null;
    this.selectedTargetId = null;
    this.selectedAttackSourceIds = [];
    this.message = turnUiCopy(this.state, this.language).instruction;
    this.showCurrentPhaseOverlay();
  }

  private canPanLeft(): boolean {
    return this.mapViewport.offsetX > MAP_EDGE_EPSILON;
  }

  private canPanRight(): boolean {
    return this.mapViewport.offsetX < this.maxMapOffsetX() - MAP_EDGE_EPSILON;
  }

  private canPanUp(): boolean {
    return this.mapViewport.offsetY > MAP_EDGE_EPSILON;
  }

  private canPanDown(): boolean {
    return this.mapViewport.offsetY < this.maxMapOffsetY() - MAP_EDGE_EPSILON;
  }

  private panMapBy(deltaX: number, deltaY: number): boolean {
    const nextViewport = this.clampMapViewport({
      ...this.mapViewport,
      offsetX: this.mapViewport.offsetX + deltaX,
      offsetY: this.mapViewport.offsetY + deltaY
    });
    const moved =
      Math.abs(nextViewport.offsetX - this.mapViewport.offsetX) > MAP_EDGE_EPSILON ||
      Math.abs(nextViewport.offsetY - this.mapViewport.offsetY) > MAP_EDGE_EPSILON;
    this.mapViewport = nextViewport;
    return moved;
  }

  private trySetMapZoomIndex(index: number, anchor: Point): boolean {
    if (index < 0 || index >= MAP_ZOOM_LEVELS.length) {
      return false;
    }

    return this.setMapZoomIndex(index, anchor);
  }

  private setMapZoomIndex(index: number, anchor: Point): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= MAP_ZOOM_LEVELS.length) {
      throw new Error(`Map zoom index ${index} is outside configured levels.`);
    }

    if (index === this.mapZoomIndex) {
      return false;
    }

    const previousZoom = this.mapViewport.zoom;
    const nextZoom = MAP_ZOOM_LEVELS[index];
    const anchorX = anchor.x;
    const anchorY = anchor.y;
    const baseAnchorX = (anchorX - MAP_RECT.x + this.mapViewport.offsetX) / previousZoom;
    const baseAnchorY = (anchorY - MAP_RECT.y + this.mapViewport.offsetY) / previousZoom;

    this.mapZoomIndex = index;
    this.mapViewport = this.clampMapViewport({
      zoom: nextZoom,
      offsetX: baseAnchorX * nextZoom - (anchorX - MAP_RECT.x),
      offsetY: baseAnchorY * nextZoom - (anchorY - MAP_RECT.y)
    });
    return true;
  }

  private resetMapView(): void {
    this.mapZoomIndex = 0;
    this.mapViewport = { zoom: MAP_ZOOM_LEVELS[0], offsetX: 0, offsetY: 0 };
  }

  private mapViewMessage(): string {
    return `Map ${Math.round(this.mapViewport.zoom * 100)}%`;
  }

  private clearMapSelection(): void {
    this.selectedFromId = null;
    this.selectedTargetId = null;
    this.selectedAttackSourceIds = [];
    this.selectedMoveSoldiers = null;
    this.pendingHomeProvinceId = null;
  }

  private isAttackStep(): boolean {
    return this.state.phase === 'turn' && this.state.turnStep === 'attack';
  }

  private isMovementStep(): boolean {
    return this.state.phase === 'turn' && this.state.turnStep === 'movement';
  }

  private mobileAttackSoldiers(province: ProvinceState): number {
    if (province.ownerId !== this.state.activePlayerId) {
      return 0;
    }

    if (this.state.attackSpentProvinceIds.includes(province.id)) {
      return 0;
    }

    return Math.max(0, province.soldiers - 1);
  }

  private validAttackSourceIds(targetProvinceId: ProvinceId): ReadonlyArray<ProvinceId> {
    return this.state.map.provinces
      .filter(
        (province) =>
          province.ownerId === this.state.activePlayerId &&
          province.neighbours.includes(targetProvinceId) &&
          this.mobileAttackSoldiers(province) > 0
      )
      .map((province) => province.id);
  }

  private attackTargetIds(): ReadonlyArray<ProvinceId> {
    if (!this.isAttackStep()) {
      return [];
    }

    return this.state.map.provinces
      .filter(
        (province) =>
          province.ownerId !== this.state.activePlayerId &&
          this.validAttackSourceIds(province.id).length > 0
      )
      .map((province) => province.id);
  }

  private selectedAttackSoldiers(): number {
    return this.selectedAttackSourceIds.reduce((total, provinceId) => {
      const province = requireProvince(this.state, provinceId);
      return total + this.mobileAttackSoldiers(province);
    }, 0);
  }

  private canConfirmAttack(): boolean {
    return (
      this.isAttackStep() &&
      this.selectedTargetId !== null &&
      this.selectedAttackSourceIds.length > 0 &&
      this.selectedAttackSoldiers() > 0
    );
  }

  private movementSoldiers(): number {
    const max = this.maxMovementSoldiers();
    if (max < 1 || this.selectedMoveSoldiers === null) {
      return 0;
    }

    return clamp(this.selectedMoveSoldiers, 1, max);
  }

  private maxMovementSoldiers(): number {
    if (this.selectedFromId === null) {
      return 0;
    }

    const from = requireProvince(this.state, this.selectedFromId);
    return Math.max(0, from.soldiers - 1);
  }

  private syncSelectedMoveSoldiers(): void {
    const max = this.maxMovementSoldiers();
    if (max < 1) {
      this.selectedMoveSoldiers = null;
      return;
    }

    this.selectedMoveSoldiers =
      this.selectedMoveSoldiers === null ? max : clamp(this.selectedMoveSoldiers, 1, max);
  }

  private setSelectedMoveSoldiers(soldiers: number): void {
    const max = this.maxMovementSoldiers();
    if (max < 1) {
      this.selectedMoveSoldiers = null;
      return;
    }

    this.selectedMoveSoldiers = clamp(Math.round(soldiers), 1, max);
  }

  private changeSelectedMoveSoldiers(delta: number): void {
    this.setSelectedMoveSoldiers(this.movementSoldiers() + delta);
    this.renderScene();
  }

  private setMoveSoldiersFromSlider(pointerX: number, region: SliderRegion): void {
    const max = this.maxMovementSoldiers();
    if (max < 1) {
      this.selectedMoveSoldiers = null;
      this.renderScene();
      return;
    }

    if (max === 1) {
      this.selectedMoveSoldiers = 1;
      this.renderScene();
      return;
    }

    const ratio = clamp((pointerX - region.x) / region.width, 0, 1);
    this.selectedMoveSoldiers = Math.round(1 + ratio * (max - 1));
    this.renderScene();
  }

  private equalizedMoveSoldiers(): number | null {
    if (this.selectedFromId === null || this.selectedTargetId === null) {
      return null;
    }

    const from = requireProvince(this.state, this.selectedFromId);
    const target = requireProvince(this.state, this.selectedTargetId);
    const soldiers = Math.floor((from.soldiers - target.soldiers) / 2);
    if (soldiers < 1) {
      return null;
    }

    return Math.min(soldiers, this.maxMovementSoldiers());
  }

  private canEqualizeMove(): boolean {
    return this.canConfirmMove() && this.equalizedMoveSoldiers() !== null;
  }

  private canConfirmMove(): boolean {
    if (!this.isMovementStep() || this.selectedFromId === null || this.selectedTargetId === null) {
      return false;
    }

    const activePlayerId = this.state.activePlayerId;
    const from = requireProvince(this.state, this.selectedFromId);
    const target = requireProvince(this.state, this.selectedTargetId);
    return (
      from.ownerId === activePlayerId &&
      target.ownerId === activePlayerId &&
      from.id !== target.id &&
      this.movementSoldiers() > 0
    );
  }

  private selectedProvince(): ProvinceState | null {
    if (this.selectedFromId === null) {
      return null;
    }

    return requireProvince(this.state, this.selectedFromId);
  }

  private isInvestmentStep(): boolean {
    return this.state.phase === 'turn' && this.state.turnStep === 'investment';
  }

  private canBuildSelectedVillage(): boolean {
    const province = this.selectedProvince();
    if (province === null) {
      return false;
    }

    const active = requirePlayer(this.state, this.state.activePlayerId);
    return (
      this.isInvestmentStep() &&
      province.ownerId === active.id &&
      active.money >= this.gameConfig.villageCost &&
      province.villages < this.gameConfig.maxVillages
    );
  }

  private canUpgradeSelectedFortification(): boolean {
    const province = this.selectedProvince();
    if (province === null) {
      return false;
    }

    const active = requirePlayer(this.state, this.state.activePlayerId);
    return (
      this.isInvestmentStep() &&
      province.ownerId === active.id &&
      active.money >= this.gameConfig.fortificationUpgradeCost &&
      !province.upgradedFortificationThisTurn &&
      fortificationIndex(province) < maxFortificationIndex(province, this.state, this.gameConfig)
    );
  }

  private affordableHireSoldiers(): number {
    const active = requirePlayer(this.state, this.state.activePlayerId);
    if (active.homeProvinceId === null) {
      return 0;
    }

    return Math.floor(active.money / this.gameConfig.soldierCost);
  }

  private canHireSoldiers(): boolean {
    return this.isInvestmentStep() && this.affordableHireSoldiers() > 0;
  }

  private hireSoldiers(): number {
    return selectedHireSoldiers(this.selectedHireSoldiers, this.affordableHireSoldiers());
  }

  private changeSelectedHireSoldiers(delta: number): void {
    this.selectedHireSoldiers = changeHireSelection(
      this.selectedHireSoldiers,
      this.affordableHireSoldiers(),
      delta
    );
    this.renderScene();
  }

  private performAttack(): void {
    if (this.selectedTargetId === null) {
      this.message = this.copy().chooseTarget;
      this.renderScene();
      return;
    }

    if (this.selectedAttackSourceIds.length < 1) {
      this.message = this.copy().chooseAttackSource;
      this.renderScene();
      return;
    }

    const attacker = requirePlayer(this.state, this.state.activePlayerId);
    const targetBefore = requireProvince(this.state, this.selectedTargetId);
    const events = this.applyActiveAction({
      type: 'attack',
      fromProvinceIds: this.selectedAttackSourceIds,
      targetProvinceId: this.selectedTargetId
    });
    const terrainLabel = terrainLabelForLanguage(targetBefore.terrainId, this.language);
    const battleEvent = events.find((event) => event.type === 'battle-started');
    if (battleEvent === undefined) {
      throw new Error('Attack action did not emit battle-started.');
    }

    this.message = `${attacker.label} ${this.copy().attacksInBattle} ${terrainLabel}: ${battleEvent.attackingSoldiers} ${this.copy().soldiers}.`;
    this.clearMapSelection();
    this.renderScene();
  }

  private performBattleActionForPlayer(playerId: PlayerId, action: WarForCrownAction): void {
    const events = this.applyJournaledActionForPlayer(playerId, action);
    const battleResult = events.find((event) => event.type === 'battle-resolved');
    if (battleResult === undefined) {
      const round = events.find((event) => event.type === 'battle-round-resolved');
      if (round === undefined) {
        throw new Error(`Battle action ${action.type} did not emit battle progress.`);
      }

      this.message =
        `${this.copy().battleRound} ${round.round}: -${round.attackerLosses}/-${round.defenderLosses}.`;
      this.renderScene();
      return;
    }

    this.captureBattleSummary(events);
    const target = requireProvince(this.state, battleResult.targetProvinceId);
    const attacker = requirePlayer(this.state, battleResult.attackerId);
    this.clearMapSelection();
    this.message =
      battleResult.result.winner === 'attacker'
        ? `${attacker.label} ${this.copy().takes} ${provinceLabelForLanguage(target.id, this.language)}. ${this.copy().attackAgain}`
        : `${provinceLabelForLanguage(target.id, this.language)} ${this.copy().holds}. ${this.copy().attackAgain}`;

    if (this.state.phase === 'game-over') {
      this.message = `${attacker.label} ${this.copy().wins}.`;
    }

    this.renderScene();
  }

  private performVisibleAiBattleAction(): void {
    const battle = this.state.battle;
    if (battle === null) {
      throw new Error('Cannot advance visible AI battle without an active battle.');
    }
    const command = battleUiCommand(battle, 'advance-ai');
    this.performBattleActionForPlayer(command.playerId, command.action);
  }

  private performBattleAction(action: WarForCrownAction): void {
    const battle = this.state.battle;
    if (battle === null) {
      throw new Error(`Cannot perform ${action.type} without an active battle.`);
    }

    const intent: BattleUiIntent =
      action.type === 'battle-round'
        ? 'fight-round'
        : action.type === 'battle-retreat-attacker'
          ? 'retreat-attacker'
          : action.type === 'battle-retreat-defender'
            ? 'retreat-defender'
            : (() => {
                throw new Error(`Unsupported battle UI action ${action.type}.`);
              })();
    const command = battleUiCommand(battle, intent);
    this.performBattleActionForPlayer(command.playerId, command.action);
  }

  private confirmBattleSummary(): void {
    if (this.battleSummary === null) {
      throw new Error('Cannot confirm battle summary without a battle summary.');
    }

    this.battleSummary = null;
    if (this.mode === 'game' && this.state.phase !== 'game-over' && this.state.battle === null) {
      this.playAiUntilHumanTurn();
    }
    this.renderScene();
  }

  private performBuildVillage(): void {
    if (this.selectedFromId === null) {
      this.message = this.copy().selectOwnProvince;
      this.renderScene();
      return;
    }

    const provinceId = this.selectedFromId;
    this.applyActiveAction({
      type: 'build-village',
      provinceId
    });
    const province = requireProvince(this.state, provinceId);
    this.message = `${province.id}: ${this.copy().villageBuilt} ${province.villages}.`;
    this.renderScene();
  }

  private performUpgradeFortification(): void {
    if (this.selectedFromId === null) {
      this.message = this.copy().selectOwnProvince;
      this.renderScene();
      return;
    }

    const provinceId = this.selectedFromId;
    this.applyActiveAction({
      type: 'upgrade-fortification',
      provinceId
    });
    const province = requireProvince(this.state, provinceId);
    this.message = `${province.id} ${formatFortification(province, this.language)}`;
    this.renderScene();
  }

  private performMoveSoldiers(): void {
    if (this.selectedFromId === null) {
      this.message = this.copy().selectOwnProvince;
      this.renderScene();
      return;
    }

    if (this.selectedTargetId === null) {
      this.message = this.copy().chooseMoveTarget;
      this.renderScene();
      return;
    }

    if (!this.canConfirmMove()) {
      this.message = this.copy().notEnoughSoldiers;
      this.renderScene();
      return;
    }

    const fromProvinceId = this.selectedFromId;
    const targetProvinceId = this.selectedTargetId;
    const soldiers = this.movementSoldiers();
    this.applyActiveAction({
      type: 'move-soldiers',
      fromProvinceId,
      targetProvinceId,
      soldiers
    });
    this.clearMapSelection();
    this.message =
      `${this.copy().moved} ${soldiers} ${this.copy().soldiers}: ` +
      `${provinceLabelForLanguage(fromProvinceId, this.language)} -> ${provinceLabelForLanguage(targetProvinceId, this.language)}.`;
    this.renderScene();
  }

  private performHireSoldiers(): void {
    const soldiers = this.hireSoldiers();
    if (soldiers < 1) {
      this.message = this.copy().notEnoughMoney;
      this.renderScene();
      return;
    }

    this.applyActiveAction({
      type: 'recruit-soldiers',
      soldiers
    });
    this.selectedHireSoldiers = 1;
    this.message = `${this.copy().hired} ${soldiers} ${this.copy().soldiers}.`;
    this.renderScene();
  }

  private legalTargetIds(): ReadonlyArray<ProvinceId> {
    if (this.isMovementStep()) {
      if (this.selectedFromId === null) {
        return [];
      }

      const from = requireProvince(this.state, this.selectedFromId);
      if (from.ownerId !== this.state.activePlayerId || from.soldiers <= 1) {
        return [];
      }

      return this.state.map.provinces
        .filter((province) => province.id !== from.id && province.ownerId === this.state.activePlayerId)
        .map((province) => province.id);
    }

    if (!this.isAttackStep()) {
      return [];
    }

    if (this.selectedTargetId !== null) {
      return this.validAttackSourceIds(this.selectedTargetId);
    }

    return this.attackTargetIds();
  }

  private renderScene(): void {
    this.ensurePhaseOverlay();
    this.buttons = [];
    this.tooltipRegions = [];
    this.movementSliderRegion = null;
    this.backgroundGraphics.clear();
    this.mapGraphics.clear();
    this.uiGraphics.clear();
    this.dynamicObjects.clear(true, true);

    switch (this.mode) {
      case 'main-menu':
        this.drawMenuScreen();
        break;
      case 'rules':
        this.drawRulesScreen();
        break;
      case 'map-select':
        this.drawBackground();
        this.drawMap();
        this.drawMapSelectionScreen();
        break;
      case 'player-setup':
        this.drawBackground();
        this.drawMap();
        this.drawPlayerSetupScreen();
        break;
      case 'game':
        this.drawBackground();
        this.drawMap();
        this.drawHud();
        break;
      default:
        this.mode satisfies never;
        throw new Error('Unhandled War for Crown scene mode.');
    }

    if (
      this.hoveredTooltip !== null &&
      !this.tooltipRegions.some(
        (region) =>
          region.id === this.hoveredTooltip?.id &&
          region.x === this.hoveredTooltip.x &&
          region.y === this.hoveredTooltip.y
      )
    ) {
      this.hoveredTooltip = null;
    }
    this.drawTooltip();
  }

  private drawSkinFrame(
    graphics: Phaser.GameObjects.Graphics,
    rect: Rect,
    options: SkinFrameOptions = {}
  ): void {
    const fillColor = options.fillColor ?? PANEL_COLOR;
    const fillAlpha = options.fillAlpha ?? 1;
    const lineColor = options.lineColor ?? PANEL_LINE_COLOR;
    const lineAlpha = options.lineAlpha ?? 1;

    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(2, lineColor, lineAlpha);
    graphics.strokeRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(1, UI_SKIN.colors.panelLineDark, lineAlpha);
    graphics.strokeRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8);

    if (options.decorative !== true) {
      return;
    }

    const corner = UI_SKIN.frame.cornerSize;
    const inset = UI_SKIN.frame.cornerInset;
    const notch = UI_SKIN.frame.notchSize;
    const notchSpacing = UI_SKIN.frame.notchSpacing;
    const pillarWidth = UI_SKIN.frame.pillarWidth;
    const textureStep = UI_SKIN.frame.textureStep;
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;

    graphics.lineStyle(3, lineColor, lineAlpha);
    graphics.lineBetween(left + inset, top + corner, left + inset, top + inset);
    graphics.lineBetween(left + inset, top + inset, left + corner, top + inset);
    graphics.lineBetween(right - corner, top + inset, right - inset, top + inset);
    graphics.lineBetween(right - inset, top + inset, right - inset, top + corner);
    graphics.lineBetween(left + inset, bottom - corner, left + inset, bottom - inset);
    graphics.lineBetween(left + inset, bottom - inset, left + corner, bottom - inset);
    graphics.lineBetween(right - corner, bottom - inset, right - inset, bottom - inset);
    graphics.lineBetween(right - inset, bottom - corner, right - inset, bottom - inset);

    graphics.fillStyle(UI_SKIN.colors.panelLineDark, lineAlpha);
    graphics.fillRect(left + inset, top + corner, pillarWidth, rect.height - corner * 2);
    graphics.fillRect(right - inset - pillarWidth, top + corner, pillarWidth, rect.height - corner * 2);
    graphics.lineStyle(1, UI_SKIN.colors.panelLine, lineAlpha);
    for (let y = top + corner + 4; y < bottom - corner; y += textureStep) {
      graphics.lineBetween(left + inset + 2, y, left + inset + pillarWidth - 2, y + 3);
      graphics.lineBetween(right - inset - pillarWidth + 2, y + 3, right - inset - 2, y);
    }

    graphics.lineStyle(2, UI_SKIN.colors.panelLineDark, lineAlpha);
    for (let x = left + corner + notchSpacing; x < right - corner; x += notchSpacing) {
      graphics.lineBetween(x, top + inset, x + notch, top + inset);
      graphics.lineBetween(x, bottom - inset, x + notch, bottom - inset);
    }
  }

  private drawMenuBase(rect: Rect): void {
    this.backgroundGraphics.fillStyle(BACKGROUND_COLOR, 1);
    this.backgroundGraphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawSkinFrame(
      this.backgroundGraphics,
      rect,
      { fillColor: UI_SKIN.colors.panelAlt, decorative: true }
    );
    this.drawLanguageToggle();
  }

  private drawTitleDivider(x: number, y: number, width: number): void {
    const centerX = x + width / 2;
    this.uiGraphics.lineStyle(1, UI_SKIN.colors.panelLineDark, 1);
    this.uiGraphics.lineBetween(x, y, centerX - 16, y);
    this.uiGraphics.lineBetween(centerX + 16, y, x + width, y);
    this.uiGraphics.fillStyle(UI_SKIN.colors.panelLine, 1);
    this.uiGraphics.fillTriangle(centerX, y - 5, centerX + 7, y, centerX, y + 5);
    this.uiGraphics.fillTriangle(centerX, y - 5, centerX - 7, y, centerX, y + 5);
  }

  private drawMenuScreen(): void {
    const copy = this.copy();
    this.drawMenuBase(MAIN_MENU_RECT);
    this.addText(WORLD_WIDTH / 2, 112, copy.mainMenuTitle, {
      fontSize: '32px',
      color: TEXT_COLOR
    }).setOrigin(0.5, 0).setShadow(2, 2, '#000000', 1);
    this.drawTitleDivider(390, 166, 500);
    this.addText(WORLD_WIDTH / 2, 202, this.message, {
      fontSize: '17px',
      color: MUTED_TEXT_COLOR,
      align: 'center'
    }).setOrigin(0.5, 0);

    this.drawButton('main-new-game', copy.newGame, 430, 282, 420, 48, true);
    this.drawButton('main-rules', copy.rules, 430, 354, 420, 48, true);
    this.drawButton('main-load', copy.load, 430, 426, 420, 48, false);
    if (this.returnUrl !== null) {
      this.drawButton('main-sofa-arcade', copy.sofaArcade, 430, 498, 420, 48, true);
    }

  }

  private drawOptionButton(
    id: ButtonId,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number = 332,
    tooltip: string | null = null
  ): void {
    const labelText = this.addText(x, y, label, {
      fontSize: '13px',
      color: TEXT_COLOR
    });
    if (tooltip !== null) {
      this.drawTooltipMarker(x + Math.min(labelText.width + 10, width - 148), y, tooltip);
    }
    this.drawButton(id, value, x + width - 128, y - 8, 128, 30, true, VALUE_TEXT_COLOR);
  }

  private drawTooltipMarker(x: number, y: number, text: string): void {
    this.addText(x, y, '?', {
      fontSize: '12px',
      color: WARNING_COLOR
    });
    this.tooltipRegions.push({
      id: `text:${text}`,
      x: x - 4,
      y: y - 2,
      width: 18,
      height: 18,
      content: { kind: 'text', text }
    });
  }

  private fortificationLabel(level: FortificationLevel): string {
    return fortificationLabelForLanguage(level, this.language);
  }

  private terrainInfluenceLabel(): string {
    return TERRAIN_INFLUENCE_LABELS[this.gameConfig.terrainInfluence][this.language];
  }

  private royalistAttitudeLabel(): string {
    return ROYALIST_ATTITUDE_LABELS[this.gameConfig.royalistAttitude][this.language];
  }

  private royalistDistributionLabel(): string {
    return ROYALIST_DISTRIBUTION_LABELS[this.gameConfig.royalistDistribution][this.language];
  }

  private maxVillagesModeLabel(): string {
    return this.gameConfig.maxVillagesMode === 'per-province'
      ? this.copy().perProvince
      : this.copy().largestProvince;
  }

  private drawRulesScreen(): void {
    const copy = this.copy();
    this.drawMenuBase(RULES_MENU_RECT);
    this.addText(WORLD_WIDTH / 2, 68, copy.rulesTitle, {
      fontSize: '28px',
      color: TEXT_COLOR
    }).setOrigin(0.5, 0).setShadow(2, 2, '#000000', 1);
    this.drawTitleDivider(190, 108, 900);
    this.drawOptionButton('rules-village-cost', copy.villageCost, `${this.gameConfig.villageCost}`, 190, 148, 390, copy.rulesTooltips.villageCost);
    this.drawOptionButton('rules-interest', copy.interestRate, `${this.gameConfig.interestRatePercent}%`, 190, 194, 390, copy.rulesTooltips.interestRate);
    this.drawOptionButton('rules-start-soldiers', copy.startingSoldiers, `${this.gameConfig.startingSoldiers}`, 190, 240, 390, copy.rulesTooltips.startingSoldiers);
    this.drawOptionButton('rules-start-money', copy.startingMoney, `${this.gameConfig.startingMoney}`, 190, 286, 390, copy.rulesTooltips.startingMoney);
    this.drawOptionButton(
      'rules-home-max-fort',
      copy.homeMaxFort,
      this.fortificationLabel(this.gameConfig.maxHomeFortificationLevel),
      190,
      332,
      390,
      copy.rulesTooltips.homeMaxFort
    );
    this.drawOptionButton(
      'rules-province-max-fort',
      copy.provinceMaxFort,
      this.fortificationLabel(this.gameConfig.maxProvinceFortificationLevel),
      190,
      378,
      390,
      copy.rulesTooltips.provinceMaxFort
    );

    this.drawOptionButton(
      'rules-royalist-attitude',
      copy.royalistAttitude,
      this.royalistAttitudeLabel(),
      700,
      148,
      390,
      copy.rulesTooltips.royalistAttitude
    );
    this.drawOptionButton(
      'rules-royalist-growth',
      copy.royalistGrowth,
      `${this.gameConfig.royalistGrowthPercent}%`,
      700,
      194,
      390,
      copy.rulesTooltips.royalistGrowth
    );
    this.drawOptionButton(
      'rules-royalist-investment',
      copy.royalistInvestment,
      `${this.gameConfig.royalistInvestmentPercent}%`,
      700,
      240,
      390,
      copy.rulesTooltips.royalistInvestment
    );
    this.drawOptionButton(
      'rules-royalist-distribution',
      copy.royalistDistribution,
      this.royalistDistributionLabel(),
      700,
      286,
      390,
      copy.rulesTooltips.royalistDistribution
    );
    this.drawOptionButton(
      'rules-terrain-influence',
      copy.terrainInfluence,
      this.terrainInfluenceLabel(),
      700,
      332,
      390,
      copy.rulesTooltips.terrainInfluence
    );
    this.drawOptionButton(
      'rules-show-computer-battles',
      copy.showComputerBattles,
      booleanLabel(this.gameConfig.showComputerBattles, this.language),
      700,
      378,
      390,
      copy.rulesTooltips.showComputerBattles
    );

    this.drawTitleDivider(190, 452, 900);
    this.drawButton('rules-back', copy.back, 392, 500, 210, 40, true);
    this.drawButton('rules-new-game', copy.newGame, 678, 500, 210, 40, true);
  }

  private drawMapSelectionScreen(): void {
    const copy = this.copy();
    this.drawLanguageToggle();
    this.addText(42, 17, copy.chooseMapTitle, {
      fontSize: '22px',
      color: TEXT_COLOR
    }).setShadow(2, 2, '#000000', 1);
    const seedLabel = this.editingSeed === null ? String(this.state.seed) : `${this.editingSeed}_`;
    this.drawButton('map-seed', `${copy.seed} ${seedLabel}`, 276, 12, 220, 32, true);

    this.addText(952, 102, copy.mapInfo, {
      fontSize: '15px',
      color: TEXT_COLOR
    });
    this.addText(952, 136, copy.chooseMapInstruction, {
      fontSize: '13px',
      color: TEXT_COLOR,
      wordWrap: { width: PANEL_TEXT_WIDTH }
    });
    this.drawOptionButton('map-province-count', copy.continentProvinces, `${this.gameConfig.provinceCount}`, 952, 204, 268);
    this.drawOptionButton('map-max-villages', copy.maxVillages, `${this.gameConfig.maxVillages}`, 952, 252, 268);
    this.drawOptionButton('map-village-mode', copy.maxVillagesMode, this.maxVillagesModeLabel(), 952, 300, 268);
    this.drawTerrainLegend(952, 354);

    this.drawButton('map-back', copy.back, 730, 666, 106, 34, true);
    this.drawButton('map-regenerate', copy.regenerateMap, 852, 666, 138, 34, true);
    this.drawButton('map-accept', copy.acceptMap, 1006, 666, 138, 34, true);
  }

  private drawPlayerSetupScreen(): void {
    const copy = this.copy();
    this.drawLanguageToggle();
    this.addText(42, 17, copy.setupTitle, {
      fontSize: '22px',
      color: TEXT_COLOR
    }).setShadow(2, 2, '#000000', 1);
    this.addText(290, 20, copy.setupInstruction, {
      fontSize: '14px',
      color: MUTED_TEXT_COLOR
    });

    this.addText(952, 102, copy.players, {
      fontSize: '15px',
      color: TEXT_COLOR
    });

    this.drawOptionButton('setup-human-count', copy.humanPlayers, `${this.gameConfig.humanPlayerCount}`, 952, 144, 268);
    this.drawOptionButton('setup-ai-count', copy.aiBarons, `${this.gameConfig.aiPlayerCount}`, 952, 180, 268);

    let rowY = 236;
    for (const setup of this.playerSetups.filter((candidate) => candidate.controller === 'human')) {
      this.drawPlayerSetupRow(setup.playerId, 952, rowY);
      rowY += 132;
    }

    const aiSetups = this.aiSetups();
    if (aiSetups.length > 0) {
      this.addText(952, rowY + 4, copy.computer, {
        fontSize: '12px',
        color: MUTED_TEXT_COLOR
      });
      this.addText(1110, rowY + 4, copy.aiMode, {
        fontSize: '12px',
        color: MUTED_TEXT_COLOR
      });
      this.drawTooltipMarker(1170, rowY + 4, copy.aiModeTooltip);
      rowY += 26;

      for (const setup of aiSetups) {
        this.drawAiSetupRow(setup, 952, rowY);
        rowY += 30;
      }
    }

    this.drawButton('setup-back', copy.back, 808, 666, 106, 34, true);
    this.drawButton('setup-start', copy.start, 930, 666, 138, 34, this.playerNamesAreValid());
  }

  private aiSetups(): ReadonlyArray<AiPlayerSetup> {
    return this.playerSetups
      .filter((setup): setup is AiPlayerSetup => setup.controller === 'ai');
  }

  private drawTerrainLegend(x: number, y: number): void {
    const copy = this.copy();
    this.addText(x, y, copy.terrainLegend, {
      fontSize: '14px',
      color: TEXT_COLOR
    });
    this.drawTooltipMarker(x + 62, y, copy.terrainLegendTooltip);

    const nameX = x + 24;
    const incomeX = x + 154;
    const defenceX = x + 218;
    this.addText(nameX, y + 24, copy.terrainColumn, {
      fontSize: '10px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(incomeX, y + 24, copy.incomeColumn, {
      fontSize: '10px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(defenceX, y + 24, copy.defenceColumn, {
      fontSize: '10px',
      color: MUTED_TEXT_COLOR
    });

    let rowY = y + 44;
    this.drawTerrainLegendRow(x, rowY, null, WATER_COLOR, copy.water, '', '');
    rowY += 20;

    for (const terrainId of TERRAIN_IDS) {
      const terrain = TERRAIN_DEFINITIONS[terrainId];
      const incomePercent = c64TerrainIncomePercentForTerrainId(terrainId, this.gameConfig);
      const defencePercent = c64CombatSetupForProvince(
        { terrainId, fortificationLevel: 'none' },
        this.gameConfig
      ).defenderCombatPercent;
      this.drawTerrainLegendRow(
        x,
        rowY,
        terrainId,
        terrain.color,
        terrainLabelForLanguage(terrainId, this.language),
        `${incomePercent}%`,
        `${defencePercent}%`
      );
      rowY += 20;
    }
  }

  private drawTerrainLegendRow(
    x: number,
    y: number,
    terrainId: TerrainId | null,
    color: number,
    label: string,
    income: string,
    defence: string
  ): void {
    const tooltipId = terrainId === null ? 'terrain:water' : `terrain:${terrainId}`;
    this.tooltipRegions.push({
      id: tooltipId,
      x: x - 4,
      y: y - 1,
      width: 272,
      height: 19,
      content: {
        kind: 'terrain',
        terrainId,
        label,
        color,
        income,
        defence
      }
    });
    if (this.hoveredTooltip?.id === tooltipId) {
      this.uiGraphics.fillStyle(UI_SKIN.colors.buttonHover, 0.88);
      this.uiGraphics.fillRoundedRect(x - 4, y - 1, 272, 19, 3);
    }

    const swatchRect = { x, y: y + 2, width: 14, height: 14 };
    if (terrainId === null) {
      drawWaterTile(this.uiGraphics, swatchRect, 0, 0);
    } else {
      drawTerrainTile(this.uiGraphics, swatchRect, terrainId, color, 0, 0);
    }
    this.uiGraphics.lineStyle(1, MAP_LINE_COLOR, 1);
    this.uiGraphics.strokeRect(swatchRect.x, swatchRect.y, swatchRect.width, swatchRect.height);
    this.addText(x + 24, y, label, {
      fontSize: '10px',
      color: TEXT_COLOR
    });
    this.addText(x + 154, y, income, {
      fontSize: '10px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(x + 218, y, defence, {
      fontSize: '10px',
      color: MUTED_TEXT_COLOR
    });
  }

  private drawPlayerSetupRow(playerId: PlayerId, x: number, y: number): void {
    const copy = this.copy();
    const setup = this.playerSetup(playerId);
    const color = this.playerColor(playerId);
    const crest = this.playerCrest(playerId);
    const colorButtonId: ButtonId = playerId === 'p1' ? 'setup-color-p1' : 'setup-color-p2';
    const crestButtonId: ButtonId = playerId === 'p1' ? 'setup-crest-p1' : 'setup-crest-p2';
    const nameButtonId: ButtonId = playerId === 'p1' ? 'setup-name-p1' : 'setup-name-p2';
    const nameLabel = this.editingNamePlayerId === playerId ? `${setup.name}_` : setup.name;

    this.uiGraphics.fillStyle(color, 1);
    this.uiGraphics.fillRect(x, y + 4, 16, 16);
    this.addText(x + 26, y, playerId.toUpperCase(), {
      fontSize: '14px',
      color: TEXT_COLOR
    });

    this.addText(x, y + 34, copy.name, {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });
    this.drawButton(nameButtonId, nameLabel, x + 78, y + 26, 156, 30, true);

    this.addText(x, y + 72, copy.color, {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });
    this.drawButton(colorButtonId, cssColor(color), x + 78, y + 64, 156, 30, true);

    this.addText(x, y + 110, copy.crest, {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });
    this.drawButton(crestButtonId, this.language === 'pl' ? crest.pl : crest.en, x + 78, y + 102, 156, 30, true);
  }

  private drawAiSetupRow(setup: AiPlayerSetup, x: number, y: number): void {
    const color = this.playerColor(setup.playerId);
    this.uiGraphics.fillStyle(color, 1);
    this.uiGraphics.fillRect(x, y + 2, 14, 14);
    this.addText(x + 24, y - 2, setup.name, {
      fontSize: '12px',
      color: TEXT_COLOR
    });
    this.drawButton(
      aiModeButtonId(setup.playerId),
      aiModeLabelForLanguage(setup.aiMode, this.language),
      x + 158,
      y - 4,
      110,
      26,
      true
    );
  }

  private drawLanguageToggle(): void {
    const nextLanguage = this.language === 'pl' ? 'ENG' : 'PL';
    this.drawButton('language-toggle', nextLanguage, 1154, 20, 82, 30, true);
  }

  private drawBackground(): void {
    this.backgroundGraphics.fillStyle(BACKGROUND_COLOR, 1);
    this.backgroundGraphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawSkinFrame(this.backgroundGraphics, HEADER_RECT, { fillColor: PANEL_COLOR });
    this.drawSkinFrame(this.backgroundGraphics, FOOTER_RECT, { fillColor: PANEL_COLOR });
    this.drawSkinFrame(
      this.backgroundGraphics,
      MAP_RECT,
      { fillColor: UI_SKIN.colors.panelAlt, decorative: true }
    );
    this.drawSkinFrame(
      this.backgroundGraphics,
      PANEL_RECT,
      { fillColor: PANEL_COLOR, decorative: true }
    );
  }

  private drawMap(): void {
    const provinceById = new Map(this.state.map.provinces.map((province) => [province.id, province]));

    this.mapGraphics.fillStyle(WATER_COLOR, 1);
    this.mapGraphics.fillRect(MAP_RECT.x, MAP_RECT.y, MAP_RECT.width, MAP_RECT.height);

    for (const tile of this.state.map.tiles) {
      const rect = this.tileRect(tile);
      if (tile.provinceId === null) {
        drawWaterTile(this.mapGraphics, rect, tile.x, tile.y);
        continue;
      }

      const province = provinceById.get(tile.provinceId);
      if (province === undefined) {
        throw new Error(`Tile references missing province ${tile.provinceId}.`);
      }

      const terrain = TERRAIN_DEFINITIONS[province.terrainId];
      drawTerrainTile(this.mapGraphics, rect, province.terrainId, terrain.color, tile.x, tile.y);

      if (isPlayerOwner(province.ownerId)) {
        this.mapGraphics.fillStyle(
          requirePlayer(this.state, province.ownerId).color,
          WAR_FOR_CROWN_MAP_SKIN.ownerTintAlpha
        );
        this.mapGraphics.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }

    this.drawProvinceBorders();
    if (this.selectedFromId !== null) {
      this.drawProvinceHighlight(this.selectedFromId, SELECTED_COLOR, 4);
    }
    for (const targetId of this.legalTargetIds()) {
      if (targetId !== this.selectedTargetId) {
        this.drawProvinceHighlight(targetId, LEGAL_TARGET_COLOR, 3);
      }
    }
    for (const sourceId of this.selectedAttackSourceIds) {
      this.drawProvinceHighlight(sourceId, SELECTED_COLOR, 5);
    }
    if (this.selectedTargetId !== null) {
      this.drawProvinceHighlight(this.selectedTargetId, TARGET_COLOR, 4);
    }
    this.drawAiMapCue();
    this.drawProvinceLabels();
    this.drawCastleMarkers();
  }

  private drawProvinceBorders(): void {
    for (const tile of this.state.map.tiles) {
      if (tile.provinceId === null) {
        continue;
      }

      const rect = this.tileRect(tile);
      const left = this.tileAtGrid(tile.x - 1, tile.y);
      const right = this.tileAtGrid(tile.x + 1, tile.y);
      const up = this.tileAtGrid(tile.x, tile.y - 1);
      const down = this.tileAtGrid(tile.x, tile.y + 1);

      if (left?.provinceId === null || left === null) {
        drawStoneBoundary(this.mapGraphics, { x: rect.x, y: rect.y }, { x: rect.x, y: rect.y + rect.height });
      }
      if (right?.provinceId !== tile.provinceId) {
        drawStoneBoundary(this.mapGraphics, { x: rect.x + rect.width, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height });
      }
      if (up?.provinceId === null || up === null) {
        drawStoneBoundary(this.mapGraphics, { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y });
      }
      if (down?.provinceId !== tile.provinceId) {
        drawStoneBoundary(this.mapGraphics, { x: rect.x, y: rect.y + rect.height }, { x: rect.x + rect.width, y: rect.y + rect.height });
      }
    }

    this.mapGraphics.strokeRect(MAP_RECT.x, MAP_RECT.y, MAP_RECT.width, MAP_RECT.height);
  }

  private drawProvinceHighlight(provinceId: ProvinceId, color: number, lineWidth: number): void {
    this.mapGraphics.lineStyle(lineWidth, color, 1);
    for (const tile of this.state.map.tiles) {
      if (tile.provinceId !== provinceId) {
        continue;
      }

      const rect = this.tileRect(tile);
      const left = this.tileAtGrid(tile.x - 1, tile.y);
      const right = this.tileAtGrid(tile.x + 1, tile.y);
      const up = this.tileAtGrid(tile.x, tile.y - 1);
      const down = this.tileAtGrid(tile.x, tile.y + 1);

      if (left?.provinceId !== provinceId) {
        this.mapGraphics.lineBetween(rect.x, rect.y, rect.x, rect.y + rect.height);
      }
      if (right?.provinceId !== provinceId) {
        this.mapGraphics.lineBetween(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height);
      }
      if (up?.provinceId !== provinceId) {
        this.mapGraphics.lineBetween(rect.x, rect.y, rect.x + rect.width, rect.y);
      }
      if (down?.provinceId !== provinceId) {
        this.mapGraphics.lineBetween(rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height);
      }
    }
  }

  private drawProvinceLabels(): void {
    const homeProvinceIds = new Set(
      this.state.players
        .map((player) => player.homeProvinceId)
        .filter((provinceId): provinceId is ProvinceId => provinceId !== null)
    );

    for (const province of this.state.map.provinces) {
      const center = this.provinceCenter(province.id);
      const ownerColor = isPlayerOwner(province.ownerId)
        ? requirePlayer(this.state, province.ownerId).color
        : null;
      const badgeLayout = createProvinceBadgeLayout(this.tileWidth(), this.tileHeight());
      drawProvinceBadge(this.mapGraphics, center, ownerColor, badgeLayout);

      const soldierIcon = this.add.image(
        center.x + badgeLayout.soldierIconOffsetX,
        center.y,
        WAR_FOR_CROWN_SOLDIER_ICON_KEY
      );
      soldierIcon
        .setDisplaySize(badgeLayout.soldierIconWidth, badgeLayout.soldierIconHeight)
        .setTint(WAR_FOR_CROWN_MAP_SKIN.badge.soldiers)
        .setDepth(1.5)
        .setMask(this.mapMask);
      this.dynamicObjects.add(soldierIcon);

      const soldiers = this.addMapText(center.x + badgeLayout.soldierCountOffsetX, center.y - badgeLayout.fontSize * 0.58, `${province.soldiers}`, {
        fontSize: `${badgeLayout.fontSize}px`,
        color: WAR_FOR_CROWN_MAP_SKIN.badge.text,
        align: 'center'
      });
      soldiers.setOrigin(0.5, 0);

      const villages = this.addMapText(center.x + badgeLayout.villageCountOffsetX, center.y - badgeLayout.fontSize * 0.58, `${province.villages}`, {
        fontSize: `${badgeLayout.fontSize}px`,
        color: WAR_FOR_CROWN_MAP_SKIN.badge.text,
        align: 'center'
      });
      villages.setOrigin(0.5, 0);

      if (isPlayerOwner(province.ownerId)) {
        const owner = requirePlayer(this.state, province.ownerId);
        if (!homeProvinceIds.has(province.id)) {
          drawCrownMarker(this.mapGraphics, center, owner.color);
        }
        const ownerLabel = this.addMapText(center.x, center.y + 13, owner.label, {
          fontSize: '8px',
          color: cssColor(owner.color),
          align: 'center'
        });
        ownerLabel.setOrigin(0.5, 0.5);
        ownerLabel.setShadow(1, 1, '#111111', 2);
      }

      const fortificationTier = fortificationIndex(province);
      if (fortificationTier > 0 && !homeProvinceIds.has(province.id)) {
        drawFortificationMarker(this.mapGraphics, center, fortificationTier);
      }
    }
  }

  private provinceCenter(provinceId: ProvinceId): Point {
    const provinceTiles = this.state.map.tiles.filter((tile) => tile.provinceId === provinceId);
    if (provinceTiles.length === 0) {
      throw new Error(`Province ${provinceId} has no tiles.`);
    }

    const centroid = provinceTiles.reduce(
      (acc, tile) => {
        const rect = this.tileRect(tile);
        return {
          x: acc.x + rect.x + rect.width / 2,
          y: acc.y + rect.y + rect.height / 2
        };
      },
      { x: 0, y: 0 }
    );

    const target = {
      x: centroid.x / provinceTiles.length,
      y: centroid.y / provinceTiles.length
    };
    const markerTile = provinceTiles.reduce((nearest, tile) => {
      const nearestRect = this.tileRect(nearest);
      const tileRect = this.tileRect(tile);
      const nearestDistance = Math.hypot(
        nearestRect.x + nearestRect.width / 2 - target.x,
        nearestRect.y + nearestRect.height / 2 - target.y
      );
      const tileDistance = Math.hypot(
        tileRect.x + tileRect.width / 2 - target.x,
        tileRect.y + tileRect.height / 2 - target.y
      );
      return tileDistance < nearestDistance ? tile : nearest;
    });
    const markerRect = this.tileRect(markerTile);
    return {
      x: markerRect.x + markerRect.width / 2,
      y: markerRect.y + markerRect.height / 2
    };
  }

  private drawAiMapCue(): void {
    const cue = this.aiActionCue;
    if (cue === null || Math.floor(this.aiActionCueElapsedMs / AI_ACTION_FLASH_MS) % 2 !== 0) {
      return;
    }

    const actorColor = ownerColor(this.state, cue.actorId);
    this.drawProvinceHighlight(cue.targetProvinceId, TARGET_COLOR, 7);
    for (const sourceId of cue.fromProvinceIds) {
      this.drawProvinceHighlight(sourceId, actorColor, 6);
      const from = this.provinceCenter(sourceId);
      const target = this.provinceCenter(cue.targetProvinceId);
      const angle = Math.atan2(target.y - from.y, target.x - from.x);
      const end = { x: target.x - Math.cos(angle) * 20, y: target.y - Math.sin(angle) * 20 };
      this.mapGraphics.lineStyle(6, actorColor, 0.98);
      this.mapGraphics.beginPath();
      this.mapGraphics.moveTo(from.x, from.y);
      this.mapGraphics.lineTo(end.x, end.y);
      this.mapGraphics.strokePath();
      this.mapGraphics.fillStyle(TARGET_COLOR, 1);
      this.mapGraphics.fillTriangle(
        end.x,
        end.y,
        end.x - Math.cos(angle - 0.55) * 18,
        end.y - Math.sin(angle - 0.55) * 18,
        end.x - Math.cos(angle + 0.55) * 18,
        end.y - Math.sin(angle + 0.55) * 18
      );
    }
  }

  private drawCastleMarkers(): void {
    for (const player of this.state.players) {
      if (player.homeProvinceId !== null) {
        this.drawCastleMarker(player.homeProvinceId, player.color, false);
      }
    }

    if (this.state.phase !== 'home-selection' || this.pendingHomeProvinceId === null) {
      return;
    }

    const province = requireProvince(this.state, this.pendingHomeProvinceId);
    if (!isRoyalistOwner(province.ownerId)) {
      throw new Error(`Pending home province ${province.id} is already owned.`);
    }

    const activePlayer = requirePlayer(this.state, this.state.activePlayerId);
    this.drawCastleMarker(province.id, activePlayer.color, true);
  }

  private drawCastleMarker(provinceId: ProvinceId, color: number, pending: boolean): void {
    const center = this.provinceCenter(provinceId);
    const tileSize = Math.min(this.tileWidth(), this.tileHeight());
    const size = clamp(tileSize * 0.58, 15, 34);
    const x = center.x;
    const y = center.y - size * 0.72;
    const left = x - size * 0.5;
    const top = y - size * 0.36;
    const wallTop = top + size * 0.28;
    const wallHeight = size * 0.46;
    const towerWidth = size * 0.2;
    const towerHeight = size * 0.62;
    const alpha = pending ? 0.64 : 0.9;

    if (pending) {
      this.mapGraphics.lineStyle(3, LEGAL_TARGET_COLOR, 0.95);
      this.mapGraphics.strokeCircle(x, y + size * 0.18, size * 0.72);
    }

    this.mapGraphics.fillStyle(0x050505, 0.72);
    this.mapGraphics.fillRect(left - 2, wallTop - 2, size + 4, wallHeight + 4);
    this.mapGraphics.fillRect(left - 2, top - 2, towerWidth + 4, towerHeight + 4);
    this.mapGraphics.fillRect(left + size - towerWidth - 2, top - 2, towerWidth + 4, towerHeight + 4);

    this.mapGraphics.fillStyle(color, alpha);
    this.mapGraphics.fillRect(left, wallTop, size, wallHeight);
    this.mapGraphics.fillRect(left, top, towerWidth, towerHeight);
    this.mapGraphics.fillRect(left + size - towerWidth, top, towerWidth, towerHeight);

    this.mapGraphics.fillStyle(LEGAL_TARGET_COLOR, pending ? 0.95 : 0.82);
    this.mapGraphics.fillRect(left + size * 0.12, wallTop, size * 0.12, size * 0.14);
    this.mapGraphics.fillRect(left + size * 0.44, wallTop, size * 0.12, size * 0.14);
    this.mapGraphics.fillRect(left + size * 0.76, wallTop, size * 0.12, size * 0.14);
    this.mapGraphics.fillTriangle(x, top - size * 0.16, x - size * 0.18, top + size * 0.08, x + size * 0.18, top + size * 0.08);
  }

  private drawHud(): void {
    const active = requirePlayer(this.state, this.state.activePlayerId);
    const copy = this.copy();
    const turnCopy = turnUiCopy(this.state, this.language);
    const resources =
      this.state.phase === 'turn'
        ? `${copy.money} ${active.money}`
        : turnCopy.instruction;
    this.drawSkinFrame(this.uiGraphics, MAP_RECT, { fillAlpha: 0, decorative: true });
    this.addText(42, 17, 'WAR FOR CROWN', {
      fontSize: '22px',
      color: TEXT_COLOR
    }).setShadow(2, 2, '#000000', 1);
    this.addText(290, 20, `${copy.turn} ${this.state.turnNumber}`, {
      fontSize: '14px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(390, 20, `${copy.seed} ${this.state.seed}`, {
      fontSize: '14px',
      color: MUTED_TEXT_COLOR
    });
    const activeTitle = titleForRank(requireC64PlayerMemory(this.state, active.id).rank, this.language);
    this.addText(500, 12, `${activeTitle} ${active.label}: ${turnCopy.title}`, {
      fontSize: '18px',
      color: cssColor(active.color)
    });
    this.addText(500, 34, resources, {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(42, 628, this.statusLine(), {
      fontSize: '15px',
      color: this.state.phase === 'game-over' ? WARNING_COLOR : TEXT_COLOR
    });

    if (this.message.length > 0) {
      this.addText(600, 628, this.message, {
        fontSize: '15px',
        color: WARNING_COLOR
      });
    }

    if (this.state.phase === 'home-selection') {
      this.drawProvincePanel(952, 96);
    } else {
      this.drawPlayerPanel(952, 96);
      const playerRowsBottom = 96 + 46 + this.state.players.length * 24;
      const playerPanelBottom = playerRowsBottom + (this.isInvestmentStep() ? 42 : 0);
      this.drawProvincePanel(952, Math.max(this.isInvestmentStep() ? 264 : 208, playerPanelBottom + 10));
    }
    if (this.eventLog.length > 0 && this.selectedTargetId === null) {
      this.drawEventLog(952, 526);
    }
    this.drawFooterButtons();
    this.drawLanguageToggle();
    if (this.aiActionCue === null) {
      this.drawPhaseOverlay();
      this.drawBattleScreen();
      this.drawBattleSummary();
    }
    this.drawAiActionCueBanner();
    if (this.state.phase === 'game-over') {
      this.drawVictoryScreen();
    }
  }

  private statusLine(): string {
    if (this.state.phase === 'game-over') {
      const winnerLabel = this.state.winnerId === null
        ? null
        : ownerLabelForLanguage(this.state, this.state.winnerId, this.language);
      return winnerLabel === null
        ? this.copy().gameOver
        : `${winnerLabel} ${this.copy().holdsCrown}`;
    }

    const active = requirePlayer(this.state, this.state.activePlayerId);
    if (this.state.battle !== null) {
      return `${active.label}: ${this.copy().battle} ${this.state.battle.round + 1}  ${this.state.battle.attackerSoldiers}:${this.state.battle.defenderSoldiers}`;
    }

    if (this.state.phase === 'home-selection') {
      return `${active.label}: ${turnUiCopy(this.state, this.language).title}`;
    }

    if (this.selectedTargetId !== null && this.isAttackStep()) {
      const attackers = this.selectedAttackSoldiers();
      return attackers > 0
        ? `${active.label}: ${attackers} -> ${provinceLabelForLanguage(this.selectedTargetId, this.language)}`
        : `${active.label}: ${this.copy().chooseAttackSource}`;
    }

    if (this.selectedTargetId !== null && this.isMovementStep()) {
      return `${active.label}: ${this.movementSoldiers()} -> ${provinceLabelForLanguage(this.selectedTargetId, this.language)}`;
    }

    if (this.selectedFromId === null) {
      return `${active.label}: ${turnUiCopy(this.state, this.language).title}`;
    }

    const from = requireProvince(this.state, this.selectedFromId);
    if (this.selectedTargetId === null) {
      return `${active.label}: ${from.soldiers} ${this.copy().inProvince} ${provinceLabelForLanguage(from.id, this.language)}`;
    }

    return `${active.label}: ${provinceLabelForLanguage(from.id, this.language)} -> ${provinceLabelForLanguage(this.selectedTargetId, this.language)}`;
  }

  private drawAiActionCueBanner(): void {
    const cue = this.aiActionCue;
    if (cue === null) {
      return;
    }
    const actor = ownerLabelForLanguage(this.state, cue.actorId, this.language);
    const sources = cue.fromProvinceIds
      .map((provinceId) => provinceLabelForLanguage(provinceId, this.language))
      .join(', ');
    const target = provinceLabelForLanguage(cue.targetProvinceId, this.language);
    const action = cue.kind === 'attack'
      ? this.language === 'pl' ? 'ATAKUJE' : 'ATTACKS'
      : this.language === 'pl' ? 'PRZESUWA WOJSKO' : 'MOVES TROOPS';
    const label = `${actor} ${action}: ${sources}  ->  ${target}  (${cue.soldiers})`;
    this.drawSkinFrame(
      this.uiGraphics,
      { x: 190, y: 34, width: 700, height: 58 },
      { fillColor: UI_SKIN.colors.panelAlt, fillAlpha: 0.98, lineColor: ownerColor(this.state, cue.actorId), decorative: true }
    );
    this.addText(540, 52, label, { fontSize: '17px', color: TEXT_COLOR, align: 'center' })
      .setOrigin(0.5, 0);
  }

  private drawVictoryScreen(): void {
    const winnerId = this.state.winnerId;
    const winnerLabel = winnerId === null
      ? null
      : ownerLabelForLanguage(this.state, winnerId, this.language);
    if (winnerLabel === null || winnerId === null) {
      throw new Error('Game-over screen requires a winner.');
    }
    const playerWon = isPlayerOwner(winnerId);
    const title = playerWon
      ? titleForRank(5, this.language)
      : this.language === 'pl' ? 'PRAWOWITY DZIEDZIC' : 'RIGHTFUL HEIR';
    const result = playerWon
      ? this.language === 'pl'
        ? 'Wszyscy rywale zostali pokonani. Kontynent ma nowego wladce.'
        : 'Every rival has been defeated. The continent has a new ruler.'
      : this.language === 'pl'
        ? 'Ostatni zbuntowany baron upadl. Krolewscy przywracaja prawowitego dziedzica.'
        : 'The last rebel baron has fallen. The royalists restore the rightful heir.';

    this.uiGraphics.fillStyle(0x020405, 0.91);
    this.uiGraphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawSkinFrame(
      this.uiGraphics,
      { x: 250, y: 108, width: 780, height: 470 },
      { fillColor: UI_SKIN.colors.panelAlt, fillAlpha: 1, lineColor: LEGAL_TARGET_COLOR, decorative: true }
    );
    this.addText(640, 154, this.language === 'pl' ? 'KONIEC WOJNY' : 'THE WAR IS OVER', {
      fontSize: '24px',
      color: WARNING_COLOR,
      align: 'center'
    }).setOrigin(0.5, 0);
    this.addText(640, 212, title.toUpperCase(), {
      fontSize: '42px', color: TEXT_COLOR, align: 'center'
    }).setOrigin(0.5, 0).setShadow(2, 2, '#000000', 2);
    this.addText(640, 272, winnerLabel, {
      fontSize: '28px', color: cssColor(ownerColor(this.state, winnerId)), align: 'center'
    }).setOrigin(0.5, 0);
    this.addText(640, 334, result, {
      fontSize: '16px',
      color: TEXT_COLOR,
      align: 'center',
      wordWrap: { width: 600 }
    }).setOrigin(0.5, 0);
    this.drawButton(
      'victory-menu',
      this.language === 'pl' ? 'MENU GLOWNE' : 'MAIN MENU',
      515,
      492,
      250,
      42,
      true
    );
  }

  private drawBattleScreen(): void {
    const battle = this.state.battle;
    if (battle === null) {
      return;
    }

    const attacker = requirePlayer(this.state, battle.attackerId);
    const defenderLabel = ownerLabelForLanguage(this.state, battle.defenderId, this.language);
    const target = requireProvince(this.state, battle.targetProvinceId);
    const panel: Rect = { x: 118, y: 96, width: 760, height: 500 };
    this.drawSkinFrame(this.uiGraphics, panel, {
      fillColor: 0x030405,
      fillAlpha: 0.98,
      lineColor: PANEL_LINE_COLOR,
      decorative: true
    });

    this.addText(panel.x + 54, panel.y + 28, attacker.label.toUpperCase(), {
      fontSize: '18px',
      color: cssColor(attacker.color)
    });
    this.addText(panel.x + panel.width - 54, panel.y + 28, defenderLabel.toUpperCase(), {
      fontSize: '18px',
      color: cssColor(ownerColor(this.state, battle.defenderId)),
      align: 'right'
    }).setOrigin(1, 0);

    this.addText(panel.x + panel.width / 2, panel.y + 30, `${this.copy().battle} ${battle.round + 1}`, {
      fontSize: '16px',
      color: WARNING_COLOR,
      align: 'center'
    }).setOrigin(0.5, 0);

    this.drawBattleMeter(panel.x + 32, panel.y + 72, battle.attackerSoldiers, battle.attackerInitialSoldiers, attacker.color);
    this.drawBattleMeter(
      panel.x + panel.width - 52,
      panel.y + 72,
      battle.defenderSoldiers,
      battle.defenderInitialSoldiers,
      ownerColor(this.state, battle.defenderId)
    );

    this.addText(panel.x + 130, panel.y + 90, `${battle.attackerCombatPercent}% < ${this.copy().combatPower} > ${battle.defenderCombatPercent}%`, {
      fontSize: '15px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(panel.x + 150, panel.y + 126, `${battle.attackerSoldiers} <<< ${this.copy().soldiers.toUpperCase()} >>> ${battle.defenderSoldiers}`, {
      fontSize: '18px',
      color: TEXT_COLOR
    });
    this.addText(panel.x + 94, panel.y + 174, `${this.copy().terrainColumn.toUpperCase()}:`, {
      fontSize: '15px',
      color: WARNING_COLOR
    });
    this.addText(panel.x + 94, panel.y + 204, terrainLabelForLanguage(target.terrainId, this.language).toUpperCase(), {
      fontSize: '15px',
      color: TEXT_COLOR
    });

    this.drawBattleGround(panel.x + 68, panel.y + 360, panel.width - 136);
    this.drawBattleFlag(panel.x + 78, panel.y + 316, attacker.color);
    this.drawBattleFlag(panel.x + panel.width - 118, panel.y + 316, ownerColor(this.state, battle.defenderId));

    const buttonY = panel.y + panel.height - 54;
    if (this.isAiPlayer(battle.attackerId)) {
      this.drawButton('battle-view', this.copy().viewBattle, panel.x + 296, buttonY, 168, 32, true);
      return;
    }

    const defenderIsHuman = isPlayerOwner(battle.defenderId) && !this.isAiPlayer(battle.defenderId);
    this.drawButton('battle-retreat-attacker', this.copy().retreatAttacker, panel.x + 54, buttonY, 168, 32, true);
    this.drawButton('battle-round', this.copy().fightRound, panel.x + 296, buttonY, 168, 32, true);
    this.drawButton(
      'battle-retreat-defender',
      this.copy().retreatDefender,
      panel.x + 538,
      buttonY,
      168,
      32,
      defenderIsHuman && defenderRetreatProvinceId(this.state) !== null
    );
  }

  private drawBattleMeter(x: number, y: number, soldiers: number, initialSoldiers: number, color: number): void {
    const height = 286;
    const ratio = initialSoldiers < 1 ? 0 : clamp(soldiers / initialSoldiers, 0, 1);
    this.uiGraphics.lineStyle(2, MUTED_TEXT_NUMERIC_COLOR, 1);
    this.uiGraphics.strokeRect(x, y, 12, height);
    this.uiGraphics.fillStyle(0x10181b, 1);
    this.uiGraphics.fillRect(x + 3, y + 3, 6, height - 6);
    this.uiGraphics.fillStyle(color, 1);
    this.uiGraphics.fillRect(x + 3, y + height - 3 - (height - 6) * ratio, 6, (height - 6) * ratio);
  }

  private drawBattleGround(x: number, y: number, width: number): void {
    this.uiGraphics.fillStyle(WATER_COLOR, 1);
    this.uiGraphics.fillRect(x, y, width, 22);
    this.uiGraphics.lineStyle(1, TEXT_NUMERIC_COLOR, 0.55);
    for (let offset = 0; offset < width; offset += 18) {
      this.uiGraphics.lineBetween(x + offset, y + 8, x + offset + 10, y + 14);
    }
  }

  private drawBattleFlag(x: number, y: number, color: number): void {
    this.uiGraphics.lineStyle(2, MUTED_TEXT_NUMERIC_COLOR, 1);
    this.uiGraphics.lineBetween(x, y, x, y + 68);
    this.uiGraphics.fillStyle(color, 1);
    this.uiGraphics.fillTriangle(x, y + 8, x + 34, y + 18, x, y + 30);
    this.uiGraphics.lineStyle(1, MAP_LINE_COLOR, 1);
    this.uiGraphics.strokeTriangle(x, y + 8, x + 34, y + 18, x, y + 30);
  }

  private battleResolutionLabel(resolution: BattleResult['resolution']): string {
    switch (resolution) {
      case 'elimination':
        return this.copy().resolutionElimination;
      case 'attacker-retreat':
        return this.copy().resolutionAttackerRetreat;
      case 'defender-retreat':
        return this.copy().resolutionDefenderRetreat;
      default:
        resolution satisfies never;
        throw new Error('Unhandled battle resolution.');
    }
  }

  private drawBattleSummary(): void {
    const summary = this.battleSummary;
    if (summary === null) {
      return;
    }

    const copy = this.copy();
    const attacker = requirePlayer(this.state, summary.attackerId);
    const defenderLabel = ownerLabelForLanguage(this.state, summary.defenderId, this.language);
    const target = requireProvince(this.state, summary.targetProvinceId);
    const panel: Rect = { x: 118, y: 96, width: 760, height: 500 };
    const winnerLabel = BATTLE_WINNER_LABELS[summary.result.winner][this.language];

    this.drawSkinFrame(this.uiGraphics, panel, {
      fillColor: UI_SKIN.colors.panelAlt,
      fillAlpha: 0.98,
      lineColor: LEGAL_TARGET_COLOR,
      decorative: true
    });

    this.addText(panel.x + panel.width / 2, panel.y + 30, copy.battleSummaryTitle, {
      fontSize: '24px',
      color: WARNING_COLOR,
      align: 'center'
    }).setOrigin(0.5, 0);

    const lines = [
      `${attacker.label} -> ${provinceLabelForLanguage(target.id, this.language)} (${defenderLabel})`,
      `${copy.sources}: ${summary.fromProvinceIds.length}, ${copy.soldiers}: ${summary.attackingSoldiers}`,
      `${copy.winnerLabel}: ${winnerLabel}`,
      `${copy.resolutionLabel}: ${this.battleResolutionLabel(summary.result.resolution)}`,
      `${copy.lossesLabel}: ${attacker.label} -${summary.attackerLosses}, ${defenderLabel} -${summary.defenderLosses}`,
      `${copy.survivorsLabel}: ${attacker.label} ${summary.result.survivingAttackers}, ${defenderLabel} ${summary.result.survivingDefenders}`,
      `${copy.battleRound}: ${summary.round}`
    ];

    let y = panel.y + 102;
    for (const line of lines) {
      this.addText(panel.x + 44, y, line, {
        fontSize: '15px',
        color: TEXT_COLOR
      });
      y += 30;
    }

    this.drawBattleGround(panel.x + 68, panel.y + 360, panel.width - 136);
    this.drawBattleFlag(panel.x + 78, panel.y + 316, attacker.color);
    this.drawBattleFlag(
      panel.x + panel.width - 118,
      panel.y + 316,
      ownerColor(this.state, summary.defenderId)
    );

    this.drawButton(
      'battle-summary-confirm',
      copy.battleSummaryConfirm,
      panel.x + panel.width / 2 - 86,
      panel.y + panel.height - 58,
      172,
      34,
      true
    );
  }

  private drawPlayerPanel(x: number, y: number): void {
    const copy = this.copy();
    this.addText(x, y, copy.houses, {
      fontSize: '13px',
      color: MUTED_TEXT_COLOR
    });

    const nameX = x + 22;
    const provinceX = x + 132;
    const armyX = x + 180;
    const incomeX = x + 238;
    const headerY = y + 24;

    this.addText(nameX, headerY, copy.houseColumn, {
      fontSize: '11px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(provinceX, headerY, copy.provinceCountColumn, {
      fontSize: '11px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(armyX, headerY, copy.soldierCountColumn, {
      fontSize: '11px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(incomeX, headerY, copy.incomeColumn, {
      fontSize: '11px',
      color: MUTED_TEXT_COLOR
    });

    let rowY = y + 46;
    for (const player of this.state.players) {
      const summary = createPlayerStatusSummary(this.state, player.id, this.gameConfig);
      const crest = this.playerCrest(player.id);
      const color = player.id === this.state.activePlayerId ? TEXT_COLOR : MUTED_TEXT_COLOR;
      this.uiGraphics.fillStyle(player.color, 1);
      this.uiGraphics.fillRect(x, rowY + 5, 12, 12);
      this.addText(nameX, rowY, `${crest.shortLabel} ${player.label}`, {
        fontSize: '13px',
        color
      });
      this.addText(provinceX, rowY, String(summary.ownedProvinceCount), {
        fontSize: '13px',
        color
      });
      this.addText(armyX, rowY, String(summary.soldierCount), {
        fontSize: '13px',
        color
      });
      this.addText(incomeX, rowY, `+${summary.income}`, {
        fontSize: '13px',
        color
      });
      rowY += 24;
    }

    if (this.isInvestmentStep()) {
      const affordable = this.affordableHireSoldiers();
      const selected = this.hireSoldiers();
      this.drawButton('hire-minus', '-', x, rowY + 4, 34, 30, affordable > 0 && selected > 1);
      this.addText(x + 52, rowY + 10, String(selected), {
        fontSize: '14px',
        color: affordable > 0 ? TEXT_COLOR : MUTED_TEXT_COLOR,
        align: 'center'
      }).setOrigin(0.5, 0);
      this.drawButton('hire-plus', '+', x + 70, rowY + 4, 34, 30, affordable > 0 && selected < affordable);
      this.drawButton('hire-max', 'MAX', x + 110, rowY + 4, 54, 30, affordable > 0 && selected < affordable);
      this.drawButton('hire-soldiers', copy.recruit, x + 170, rowY + 4, 108, 30, this.canHireSoldiers());
    }
  }

  private drawProvincePanel(x: number, y: number): void {
    const copy = this.copy();
    this.addText(x, y, copy.province, {
      fontSize: '13px',
      color: MUTED_TEXT_COLOR
    });

    if (this.selectedFromId === null) {
      const turnCopy = turnUiCopy(this.state, this.language);
      this.addText(x, y + 25, turnCopy.title, {
        fontSize: '15px',
        color: TEXT_COLOR
      });
      this.addText(x, y + 47, this.state.phase === 'home-selection' ? copy.chooseNeutral : turnCopy.instruction, {
        fontSize: '12px',
        color: MUTED_TEXT_COLOR,
        wordWrap: { width: PANEL_TEXT_WIDTH }
      });
      return;
    }

    const from = requireProvince(this.state, this.selectedFromId);
    this.drawProvinceSwatch(x, y + 27, from);
    this.addText(x + 22, y + 22, `${from.soldiers} ${copy.soldiers}`, {
      fontSize: '16px',
      color: TEXT_COLOR
    });
    this.addText(
      x + 22,
      y + 44,
      `${provinceOwnerLabel(this.state, from, this.language)}  ${copy.incomeColumn} +${provinceIncome(from, this.gameConfig)}`,
      {
        fontSize: '12px',
        color: MUTED_TEXT_COLOR
      }
    );
    this.addText(x + 22, y + 60, `${from.villages} ${copy.villageBuilt}  ${formatTerrain(from.terrainId, this.gameConfig, this.language)}`, {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });
    const fortificationText =
      this.state.phase === 'home-selection'
        ? formatFortificationLevel(
            PLAYER_HOME_FORTIFICATION_LEVEL,
            this.language,
            copy.playerCastle
          )
        : formatFortification(from, this.language);
    this.addText(x + 22, y + 76, fortificationText, {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });

    const active = requirePlayer(this.state, this.state.activePlayerId);

    if (this.selectedTargetId === null) {
      if (this.state.phase === 'home-selection') {
        this.addText(x, y + 104, `${copy.pendingHome}: ${provinceLabelForLanguage(from.id, this.language)}`, {
          fontSize: '12px',
          color: WARNING_COLOR
        });
        return;
      }

      if (this.state.phase === 'turn' && this.state.turnStep === 'attack' && from.ownerId === active.id) {
        this.addText(x, y + 104, copy.chooseTarget, {
          fontSize: '12px',
          color: MUTED_TEXT_COLOR
        });
      }

      if (this.state.phase === 'turn' && this.state.turnStep === 'movement' && from.ownerId === active.id) {
        this.addText(x, y + 104, turnUiCopy(this.state, this.language).instruction, {
          fontSize: '12px',
          color: MUTED_TEXT_COLOR,
          wordWrap: { width: PANEL_TEXT_WIDTH }
        });
      }

      if (this.isInvestmentStep() && from.ownerId === active.id) {
        this.drawButton('build-village', copy.village, x, y + 132, 118, 30, this.canBuildSelectedVillage());
        this.drawButton(
          'upgrade-fort',
          copy.fort,
          x + 128,
          y + 132,
          118,
          30,
          this.canUpgradeSelectedFortification()
        );
      }
      return;
    }

    if (this.isMovementStep()) {
      const target = requireProvince(this.state, this.selectedTargetId);
      this.addText(x, y + 132, copy.target, {
        fontSize: '13px',
        color: MUTED_TEXT_COLOR
      });
      this.drawProvinceSwatch(x, y + 158, target);
      this.addText(x + 22, y + 150, `${target.soldiers} ${copy.soldiers}`, {
        fontSize: '16px',
        color: TEXT_COLOR
      });
      this.addText(
        x + 22,
        y + 172,
        `${provinceOwnerLabel(this.state, target, this.language)}  ${copy.incomeColumn} +${provinceIncome(target, this.gameConfig)}`,
        {
          fontSize: '12px',
          color: MUTED_TEXT_COLOR
        }
      );
      this.addText(x + 22, y + 190, formatTerrain(target.terrainId, this.gameConfig, this.language), {
        fontSize: '12px',
        color: MUTED_TEXT_COLOR
      });
      this.drawMovementAmountControl(x + 22, y + 214);
      this.drawButton('move-soldiers', copy.move, x, y + 304, 194, 30, this.canConfirmMove());
      return;
    }

    const target = requireProvince(this.state, this.selectedTargetId);
    const attackers = this.selectedAttackSoldiers();
    const ownerColor = provinceOwnerColor(this.state, target);
    const canAttack = this.canConfirmAttack();
    const preview = attackers > 0 ? createAttackPreview(target, this.gameConfig) : null;

    this.addText(x, y + 132, copy.target, {
      fontSize: '13px',
      color: MUTED_TEXT_COLOR
    });
    this.uiGraphics.fillStyle(ownerColor, 1);
    this.uiGraphics.fillRect(x, y + 158, 14, 14);
    this.addText(x + 22, y + 150, `${target.soldiers} ${copy.soldiers}`, {
      fontSize: '16px',
      color: TEXT_COLOR
    });
    this.addText(
      x + 22,
      y + 172,
      `${provinceOwnerLabel(this.state, target, this.language)}  ${copy.incomeColumn} +${provinceIncome(target, this.gameConfig)}`,
      {
        fontSize: '12px',
        color: MUTED_TEXT_COLOR
      }
    );
    this.addText(x + 22, y + 190, formatTerrain(target.terrainId, this.gameConfig, this.language), {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });
    this.addText(x + 22, y + 208, formatFortification(target, this.language), {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });

    this.addText(
      x + 22,
      y + 224,
      attackers > 0
        ? `${this.selectedAttackSourceIds.length} ${copy.sources}  ${attackers} ${copy.soldiers}`
        : copy.chooseAttackSource,
      {
        fontSize: '12px',
        color: attackers > 0 ? TEXT_COLOR : WARNING_COLOR,
        wordWrap: { width: PANEL_TEXT_WIDTH }
      }
    );

    if (preview !== null) {
      const previewText = `${attackers} @ ${preview.attackerCombatPercent}% < ` +
        `${copy.combatPower} > ${target.soldiers} @ ${preview.defenderCombatPercent}%`;
      this.addText(x + 22, y + 244, previewText, {
        fontSize: '12px',
        color: TEXT_COLOR
      });
    }

    if (canAttack) {
      this.drawButton('attack', copy.attack, x, y + 280, 194, 30, true);
    }
  }

  private drawMovementAmountControl(x: number, y: number): void {
    const soldiers = this.movementSoldiers();
    const max = this.maxMovementSoldiers();
    this.addText(x, y, `${this.copy().move}: ${soldiers}/${max} ${this.copy().soldiers}`, {
      fontSize: '12px',
      color: soldiers > 0 ? TEXT_COLOR : WARNING_COLOR
    });

    this.drawMovementSlider(x, y + 24, 218);

    this.drawButton('move-minus', '-', x, y + 50, 42, 26, soldiers > 1);
    this.drawButton('move-plus', '+', x + 50, y + 50, 42, 26, soldiers < max);
    this.drawButton('move-max', this.copy().all, x + 100, y + 50, 56, 26, soldiers < max);
    this.drawButton('move-equal', '=', x + 164, y + 50, 54, 26, this.canEqualizeMove());
  }

  private drawMovementSlider(x: number, y: number, width: number): void {
    const max = this.maxMovementSoldiers();
    const soldiers = this.movementSoldiers();
    const trackY = y + 11;
    const region: SliderRegion = {
      id: 'move-soldiers',
      x,
      y: y - 4,
      width,
      height: 28
    };
    this.movementSliderRegion = region;

    this.uiGraphics.fillStyle(BUTTON_DISABLED_COLOR, 1);
    this.uiGraphics.fillRect(x, trackY, width, 4);
    this.uiGraphics.lineStyle(1, BUTTON_LINE_COLOR, 1);
    this.uiGraphics.strokeRect(x, trackY, width, 4);

    const knobRatio = max <= 1 ? 1 : (soldiers - 1) / (max - 1);
    const knobX = x + knobRatio * width;
    this.uiGraphics.fillStyle(LEGAL_TARGET_COLOR, 1);
    this.uiGraphics.fillRect(x, trackY, knobX - x, 4);
    this.uiGraphics.fillStyle(BUTTON_COLOR, 1);
    this.uiGraphics.fillRect(knobX - 5, y + 2, 10, 22);
    this.uiGraphics.lineStyle(1, BUTTON_LINE_COLOR, 1);
    this.uiGraphics.strokeRect(knobX - 5, y + 2, 10, 22);
  }

  private drawProvinceSwatch(x: number, y: number, province: ProvinceState): void {
    this.uiGraphics.fillStyle(TERRAIN_DEFINITIONS[province.terrainId].color, 1);
    this.uiGraphics.fillRect(x, y, 14, 14);
    this.uiGraphics.lineStyle(2, provinceOwnerColor(this.state, province), 1);
    this.uiGraphics.strokeRect(x, y, 14, 14);
  }

  private drawEventLog(x: number, y: number): void {
    const copy = this.copy();
    this.addText(x, y, copy.events, {
      fontSize: '13px',
      color: MUTED_TEXT_COLOR
    });

    if (this.eventLog.length === 0) {
      this.addText(x, y + 24, copy.noEvents, {
        fontSize: '12px',
        color: MUTED_TEXT_COLOR
      });
      return;
    }

    let rowY = y + 24;
    for (const line of this.eventLog.slice(-5)) {
      this.addText(x, rowY, line, {
        fontSize: '11px',
        color: TEXT_COLOR
      });
      rowY += 16;
    }
  }

  private drawFooterButtons(): void {
    const copy = this.copy();
    this.addText(42, 674, this.mapViewMessage(), {
      fontSize: '12px',
      color: MUTED_TEXT_COLOR
    });

    if (this.state.phase === 'home-selection') {
      this.drawButton('confirm-home', copy.confirm, 914, 666, 154, 34, this.pendingHomeProvinceId !== null);
    } else {
      this.drawButton(
        'advance-step',
        turnUiCopy(this.state, this.language).advanceLabel,
        914,
        666,
        154,
        34,
        this.state.phase === 'turn'
      );
    }

    this.drawButton('new-map', copy.menu, 1154, 666, 96, 34, true);
  }

  private drawPhaseOverlay(): void {
    if (this.phaseOverlay === null) {
      return;
    }

    this.drawSkinFrame(
      this.uiGraphics,
      { x: 246, y: 278, width: 456, height: 112 },
      { fillColor: UI_SKIN.colors.panelAlt, lineColor: LEGAL_TARGET_COLOR, decorative: true }
    );
    this.addText(474, 306, this.phaseOverlay.title, {
      fontSize: '28px',
      color: WARNING_COLOR,
      align: 'center'
    })
      .setOrigin(0.5, 0)
      .setShadow(2, 2, '#000000', 2);
    this.addText(474, 348, this.phaseOverlay.subtitle, {
      fontSize: '13px',
      color: TEXT_COLOR,
      align: 'center',
      wordWrap: { width: 410 }
    }).setOrigin(0.5, 0);
  }

  private drawButton(
    id: ButtonId,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    enabled: boolean,
    textColor: string = TEXT_COLOR
  ): void {
    this.buttons.push({ id, x, y, width, height, enabled });
    const hovered = enabled && this.hoveredButtonId === id;
    this.drawSkinFrame(
      this.uiGraphics,
      { x, y, width, height },
      {
        fillColor: enabled ? (hovered ? UI_SKIN.colors.buttonHover : BUTTON_COLOR) : BUTTON_DISABLED_COLOR,
        lineColor: enabled ? (hovered ? UI_SKIN.colors.panelLineBright : BUTTON_LINE_COLOR) : MAP_LINE_COLOR
      }
    );

    if (hovered) {
      this.drawButtonPointer(x - 18, y + height / 2);
    }

    const fontSize = height >= 34 ? '14px' : '12px';
    const text = this.addText(x + width / 2, y + height / 2 - 7, label, {
      fontSize,
      color: enabled ? textColor : MUTED_TEXT_COLOR,
      align: 'center'
    });
    text.setOrigin(0.5, 0);
  }

  private drawButtonPointer(x: number, y: number): void {
    this.uiGraphics.fillStyle(UI_SKIN.colors.panelLineBright, 1);
    this.uiGraphics.fillTriangle(x, y - 4, x + 10, y, x, y + 4);
    this.uiGraphics.lineStyle(2, TEXT_NUMERIC_COLOR, 1);
    this.uiGraphics.lineBetween(x - 8, y, x, y);
    this.uiGraphics.lineStyle(2, UI_SKIN.colors.panelLine, 1);
    this.uiGraphics.lineBetween(x - 7, y - 5, x - 7, y + 5);
  }

  private addText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const textObject = this.add.text(x, y, text, {
      ...style,
      fontFamily: UI_SKIN.fonts.ui,
      resolution: WAR_FOR_CROWN_RENDER_SCALE
    });
    textObject.setDepth(3);
    this.dynamicObjects.add(textObject);
    return textObject;
  }

  private addMapText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const textObject = this.add.text(x, y, text, {
      ...style,
      fontFamily: UI_SKIN.fonts.map,
      resolution: WAR_FOR_CROWN_RENDER_SCALE
    });
    textObject.setDepth(1.5);
    textObject.setMask(this.mapMask);
    this.dynamicObjects.add(textObject);
    return textObject;
  }

}
