import { PLAYER_DEFINITIONS, WORLD_WIDTH } from '../game/constants';
import type { WarForCrownAiMode } from '../game/ai';
import type { WarForCrownJournalEntry } from '../game/journal';
import type { OwnerId } from '../game/owners';
import type {
  BattleResult,
  GameConfig,
  GameState,
  PlayerId,
  ProvinceId,
  TerrainId
} from '../game/types';
import type { HumanSetupButtonId } from './player-setup-controls';
import type { PlayerSetup } from './player-setup-model';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface MapViewport {
  readonly zoom: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface MapDragState {
  readonly pointerId: number;
  readonly startPoint: Point;
  readonly startOffsetX: number;
  readonly startOffsetY: number;
  readonly startedAt: Point;
  readonly hasDragged: boolean;
}

export type SceneMode = 'main-menu' | 'rules' | 'map-select' | 'player-setup' | 'game';

export type ButtonId =
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
  | 'main-load-json'
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
  | 'save-game'
  | 'save-game-json'
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
  | HumanSetupButtonId
  | 'setup-start'
  | 'setup-human-count'
  | 'upgrade-fort';

export interface CommandButton extends Rect {
  readonly id: ButtonId;
  readonly enabled: boolean;
}

export function isBattleButtonId(buttonId: ButtonId): boolean {
  return buttonId === 'battle-retreat-attacker' ||
    buttonId === 'battle-retreat-defender' ||
    buttonId === 'battle-round' ||
    buttonId === 'battle-view';
}

interface TextTooltipContent {
  readonly kind: 'text';
  readonly text: string;
}

export interface TerrainTooltipContent {
  readonly kind: 'terrain';
  readonly terrainId: TerrainId | null;
  readonly label: string;
  readonly color: number;
  readonly income: string;
  readonly defence: string;
}

export type TooltipContent = TextTooltipContent | TerrainTooltipContent;

export interface TooltipRegion extends Rect {
  readonly id: string;
  readonly content: TooltipContent;
}

export interface TooltipState {
  readonly id: string;
  readonly content: TooltipContent;
  readonly x: number;
  readonly y: number;
}

export interface SliderRegion extends Rect {
  readonly id: 'move-soldiers';
}

export interface SliderDragState {
  readonly pointerId: number;
  readonly region: SliderRegion;
}

export interface PhaseOverlay {
  readonly title: string;
  readonly subtitle: string;
  readonly hideAtMs: number | null;
}

export interface BattleSummary {
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

export interface WarForCrownSceneJournal {
  readonly seed: number;
  readonly config: GameConfig;
  readonly playerSetups: ReadonlyArray<PlayerSetup>;
  readonly currentState: GameState;
  readonly entries: ReadonlyArray<WarForCrownJournalEntry>;
}

export interface SkinFrameOptions {
  readonly fillColor?: number;
  readonly fillAlpha?: number;
  readonly lineColor?: number;
  readonly lineAlpha?: number;
  readonly decorative?: boolean;
}

export const MAP_RECT: Rect = { x: 42, y: 76, width: 864, height: 548 };
export const PANEL_RECT: Rect = { x: 932, y: 76, width: 306, height: 548 };
export const HEADER_RECT: Rect = { x: 0, y: 0, width: WORLD_WIDTH, height: 56 };
export const FOOTER_RECT: Rect = { x: 0, y: 646, width: WORLD_WIDTH, height: 74 };
export const MAIN_MENU_RECT: Rect = { x: 300, y: 64, width: 680, height: 568 };
export const RULES_MENU_RECT: Rect = { x: 120, y: 34, width: 1040, height: 604 };
export const PANEL_TEXT_WIDTH = PANEL_RECT.width - 58;
export const MAP_ZOOM_LEVELS: ReadonlyArray<number> = [1, 1.35, 1.8, 2.4, 3.2];
export const MAP_EDGE_EPSILON = 0.5;
export const MAP_EDGE_SCROLL_SIZE = 52;
export const MAP_EDGE_SCROLL_SPEED = 540;
export const MAP_DRAG_THRESHOLD = 6;
export const EVENT_LOG_LIMIT = 5;
export const PHASE_OVERLAY_MS = 4000;
export const AI_AUTOPLAY_STEP_LIMIT = 80;
export const AI_ACTION_CUE_MS = 1800;
export const AI_ACTION_FLASH_MS = 220;
export const AI_PLAYER_COUNT_OPTIONS: ReadonlyArray<number> = Array.from(
  { length: PLAYER_DEFINITIONS.length },
  (_value, index) => index
);
export const PLAYER_FACING_AI_MODES: ReadonlyArray<WarForCrownAiMode> = [
  'c64-original',
  'c64-workbench'
];
