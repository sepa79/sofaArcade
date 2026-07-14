import Phaser from 'phaser';

import {
  DEFAULT_GAME_CONFIG,
  PLAYER_DEFINITIONS,
  PLAYER_HOME_FORTIFICATION_LEVEL,
  TERRAIN_DEFINITIONS,
  TERRAIN_IDS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../game/constants';
import { applyPlayerAction, type WarForCrownAction } from '../game/actions';
import { chooseAiAction, type WarForCrownAiMode } from '../game/ai';
import { c64CombatSetupForProvince } from '../game/c64-battle';
import { c64TerrainIncomePercentForTerrainId } from '../game/c64-economy';
import { requireC64PlayerMemory } from '../game/c64-state';
import { defenderRetreatProvinceId } from '../game/logic';
import { c64HumanMovementTargetIds } from '../game/human-movement';
import { isPlayerOwner, isRoyalistOwner } from '../game/owners';
import { createPlayerView } from '../game/player-view';
import {
  PLAYER_COLOR_CHOICES,
  PLAYER_CREST_CHOICES,
  type CrestChoice
} from '../game/player-presentation';
import { createInitialState } from '../game/state';
import {
  type WarForCrownSaveGame
} from '../game/save-game';
import { createPlayerStatusSummary } from '../game/status';
import { createJournalEntry, snapshotJournalValue, type WarForCrownJournalEntry } from '../game/journal';
import type { WarForCrownEvent } from '../game/events';
import type {
  BattleResult,
  GameConfig,
  GameState,
  PlayerId,
  ProvinceId,
  ProvinceState,
  TerrainId,
  TileState
} from '../game/types';
import { battleUiCommand, type BattleUiIntent } from './battle-command';
import { battleStartedEvent, createBattleSummary } from './battle-summary';
import { aiActionCues, type AiActionCue } from './ai-action-cue';
import { runWarForCrownAiAutoplay } from './ai-autoplay';
import {
  cycleWarForCrownConfigOption,
  nextOption,
  type WarForCrownConfigOptionId
} from './config-options';
import { changeHireSelection, selectedHireSoldiers } from './hire-selection';
import { disabledButtonMessage as createDisabledButtonMessage } from './disabled-button-message';
import { resumeLoadedGame } from './loaded-game-resume';
import {
  clampMapViewport,
  initialMapViewport,
  mapEdgeVelocity,
  mapTileAtGrid,
  mapTileAtPoint,
  mapTileHeight,
  mapTileRect,
  mapTileWidth,
  mapViewportLabel,
  panMapViewport,
  zoomMapViewport
} from './map-viewport';
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
import { createNewMonthSummary } from './new-month-summary';
import { resolvePointerIntent } from './pointer-intent';
import {
  drawMainMenuScreen,
  drawMapSelectionScreen as drawMapSelectionOverlay,
  drawPlayerSetupScreen as drawPlayerSetupOverlay,
  drawRulesScreen as drawRulesMenu,
  type PreGameScreenBoundary
} from './pre-game-screens';
import {
  appendPlayerNameCharacter,
  playerNamesAreComplete,
  removeLastPlayerNameCharacter
} from './player-name';
import {
  HUMAN_PLAYER_COUNT_OPTIONS,
  humanSetupButtonCommand,
  humanSetupButtonId
} from './player-setup-controls';
import {
  configuredPlayerCount,
  synchronizePlayerSetups,
  updatePlayerSetup as updatePlayerSetupModel,
  type AiPlayerSetup,
  type PlayerSetup
} from './player-setup-model';
import { WAR_FOR_CROWN_RENDER_SCALE } from './render-scale';
import {
  AI_ACTION_CUE_MS,
  AI_ACTION_FLASH_MS,
  AI_AUTOPLAY_STEP_LIMIT,
  AI_PLAYER_COUNT_OPTIONS,
  EVENT_LOG_LIMIT,
  FOOTER_RECT,
  HEADER_RECT,
  isBattleButtonId,
  MAP_DRAG_THRESHOLD,
  MAP_EDGE_EPSILON,
  MAP_RECT,
  MAP_ZOOM_LEVELS,
  PANEL_RECT,
  PANEL_TEXT_WIDTH,
  PLAYER_FACING_AI_MODES,
  type BattleSummary,
  type ButtonId,
  type CommandButton,
  type MapDragState,
  type MapViewport,
  type PhaseOverlay,
  type Point,
  type Rect,
  type SceneMode,
  type SkinFrameOptions,
  type SliderDragState,
  type SliderRegion,
  type TerrainTooltipContent,
  type TooltipRegion,
  type TooltipState,
  type WarForCrownSceneJournal
} from './scene-contracts';
import { parseWarForCrownReturnUrl, parseWarForCrownSeed } from './scene-data';
import {
  createPhaseOverlay,
  phaseKey,
  phaseOverlayAllowed
} from './phase-overlay';
import {
  BATTLE_WINNER_LABELS,
  aiModeButtonId,
  aiModeLabelForLanguage,
  clamp,
  createAttackPreview,
  cssColor,
  formatEventForLog,
  formatFortification,
  formatFortificationLevel,
  formatTerrain,
  fortificationIndex,
  ownerColor,
  ownerLabelForLanguage,
  playerIdFromAiModeButton,
  provinceIncome,
  provinceLabelForLanguage,
  provinceOwnerColor,
  provinceOwnerLabel,
  requirePlayer,
  requireProvince,
  terrainLabelForLanguage,
  turnUiCopy
} from './scene-presentation';
import {
  downloadWarForCrownSaveFile,
  errorMessage,
  readWarForCrownSaveFile
} from './save-file';
import {
  createWarForCrownSaveSnapshot,
  hasWarForCrownBrowserSave,
  loadWarForCrownFromBrowser,
  saveWarForCrownToBrowser
} from './save-storage';
import { UI_COPY, type Language } from './ui-copy';
import {
  BACKGROUND_COLOR,
  BUTTON_COLOR,
  BUTTON_DISABLED_COLOR,
  BUTTON_LINE_COLOR,
  LEGAL_TARGET_COLOR,
  MAP_LINE_COLOR,
  MUTED_TEXT_COLOR,
  MUTED_TEXT_NUMERIC_COLOR,
  PANEL_COLOR,
  PANEL_LINE_COLOR,
  SELECTED_COLOR,
  TARGET_COLOR,
  TEXT_COLOR,
  TEXT_NUMERIC_COLOR,
  UI_SKIN,
  VALUE_TEXT_COLOR,
  WARNING_COLOR,
  WATER_COLOR
} from './ui-skin';
import { titleForRank } from './title-copy';
import * as turnSelection from './turn-selection';

export const WAR_FOR_CROWN_SCENE_KEY = 'war-for-crown';

declare global {
  interface Window {
    warForCrownJournal?: () => WarForCrownSceneJournal;
  }
}



export class WarForCrownScene extends Phaser.Scene {
  private state!: GameState;
  private returnUrl: string | null = null;
  private hasBrowserSave = false;
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
  private selectedMovementTargetSoldiers: number | null = null;
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
      this.updatePlayerName(this.editingNamePlayerId, removeLastPlayerNameCharacter);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey || Array.from(event.key).length !== 1) {
      return;
    }
    this.updatePlayerName(this.editingNamePlayerId, (current) =>
      appendPlayerNameCharacter(current, event.key)
    );
  };
  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const button = this.buttons.find((candidate) => this.contains(candidate, worldPoint.x, worldPoint.y));
    if (this.mode === 'game') {
      const intent = resolvePointerIntent({
        aiActionCueVisible: this.aiActionCue !== null,
        battleActive: this.state.battle !== null,
        battleButton: button !== undefined && isBattleButtonId(button.id),
        battleSummaryVisible: this.battleSummary !== null,
        buttonId: button?.id ?? null,
        gameOver: this.state.phase === 'game-over',
        phaseOverlayVisible: this.phaseOverlay !== null
      });
      if (intent === 'button') {
        if (button === undefined) {
          throw new Error('Pointer intent resolved to button without a hit button.');
        }
        this.handleButton(button);
        return;
      }
      if (intent === 'phase-overlay') {
        this.handlePhaseOverlayClick();
        return;
      }
      if (
        this.state.phase === 'game-over' ||
        this.aiActionCue !== null ||
        this.phaseOverlay !== null ||
        this.battleSummary !== null ||
        this.state.battle !== null
      ) {
        return;
      }
    }

    if (button !== undefined) {
      this.handleButton(button);
      return;
    }

    const movementSlider = this.movementSliderRegion;
    if (movementSlider !== null && this.contains(movementSlider, worldPoint.x, worldPoint.y)) {
      this.setMovementTargetSoldiersFromSlider(worldPoint.x, movementSlider);
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
      this.setMovementTargetSoldiersFromSlider(worldPoint.x, sliderDragState.region);
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
    const seed = parseWarForCrownSeed(rawData);
    this.returnUrl = parseWarForCrownReturnUrl(rawData);
    this.hasBrowserSave = hasWarForCrownBrowserSave();
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

  private syncPlayerSetupsWithConfig(): void {
    const nextSetups = synchronizePlayerSetups(this.gameConfig, this.playerSetups);
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
    if (configuredPlayerCount(nextConfig) > PLAYER_COLOR_CHOICES.length) {
      throw new Error(`Configured players exceed available colors: ${configuredPlayerCount(nextConfig)}.`);
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

  private cycleConfigOption(
    buttonId: WarForCrownConfigOptionId | 'setup-ai-count' | 'setup-human-count'
  ): void {
    switch (buttonId) {
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
      default:
        {
          const result = cycleWarForCrownConfigOption(this.gameConfig, buttonId);
          this.updateGameConfig(() => result.config, result.regenerateMap);
        }
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
    this.playerSetups = updatePlayerSetupModel(this.playerSetups, playerId, update);
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
    return playerNamesAreComplete(this.playerSetups.map((setup) => setup.name));
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
      this.message = this.copy().playerNameRequired;
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
    return createNewMonthSummary(this.state, this.gameConfig, this.language);
  }

  private phaseOverlaySubtitle(): string {
    if (this.state.phase === 'turn' && this.state.turnStep === 'new-month') {
      return this.newMonthSummary();
    }

    return turnUiCopy(this.state, this.language).instruction;
  }

  private canShowPhaseOverlay(): boolean {
    return phaseOverlayAllowed(this.state.battle !== null, this.battleSummary !== null);
  }

  private showCurrentPhaseOverlay(subtitle: string = this.phaseOverlaySubtitle()): void {
    if (!this.canShowPhaseOverlay()) {
      this.phaseOverlay = null;
      return;
    }

    this.announcedPhaseKey = this.currentPhaseKey();
    this.phaseOverlay = createPhaseOverlay({
      language: this.language,
      nowMs: Date.now(),
      state: this.state,
      subtitle
    });
  }

  private currentPhaseKey(): string | null {
    return phaseKey(this.mode, this.state);
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

  private currentSaveGame(): WarForCrownSaveGame {
    return createWarForCrownSaveSnapshot({
      language: this.language,
      config: this.gameConfig,
      playerSetups: this.playerSetups,
      state: this.state
    });
  }

  private saveGameToBrowser(): void {
    saveWarForCrownToBrowser(this.currentSaveGame());
    this.hasBrowserSave = true;
    this.message = this.copy().savedLocal;
    this.renderScene();
  }

  private saveGameToJsonFile(): void {
    downloadWarForCrownSaveFile(this.currentSaveGame());
  }

  private applyLoadedSave(save: WarForCrownSaveGame, message: string): void {
    this.language = save.language;
    this.gameConfig = save.config;
    this.playerSetups = save.playerSetups;
    this.state = save.state;
    this.mode = 'game';
    this.editingNamePlayerId = null;
    this.editingSeed = null;
    this.selectedHireSoldiers = 1;
    this.clearMapSelection();
    this.eventLog = [];
    this.actionJournal = [];
    this.phaseOverlay = null;
    this.battleSummary = null;
    this.aiActionCue = null;
    this.aiActionCueQueue = [];
    this.aiActionCueElapsedMs = 0;
    this.announcedPhaseKey = null;
    this.resetMapView();
    this.message = message;
    resumeLoadedGame({
      battleSummaryVisible: () => this.battleSummary !== null,
      getState: () => this.state,
      markCurrentPhaseAnnounced: () => {
        this.announcedPhaseKey = this.currentPhaseKey();
      },
      playAiUntilHumanTurn: () => this.playAiUntilHumanTurn(),
      showCurrentPhaseOverlay: () => this.showCurrentPhaseOverlay()
    });
    this.renderScene();
  }

  private loadGameFromBrowser(): void {
    try {
      const save = loadWarForCrownFromBrowser();
      this.applyLoadedSave(save, save.language === 'pl' ? UI_COPY.pl.loadedLocal : UI_COPY.en.loadedLocal);
    } catch (error) {
      this.message = errorMessage(error);
      this.renderScene();
    }
  }

  private loadGameFromJsonFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file === undefined) {
        throw new Error('JSON save file selection did not provide a file.');
      }
      void this.applyJsonSaveFile(file);
    }, { once: true });
    input.click();
  }

  private async applyJsonSaveFile(file: File): Promise<void> {
    try {
      const save = await readWarForCrownSaveFile(file);
      this.applyLoadedSave(save, save.language === 'pl' ? UI_COPY.pl.loadedJson : UI_COPY.en.loadedJson);
    } catch (error) {
      this.message = errorMessage(error);
      this.renderScene();
    }
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

  private updateBattleStartMessage(event: Extract<WarForCrownEvent, { readonly type: 'battle-started' }>): void {
    const attacker = requirePlayer(this.state, event.attackerId);
    const target = requireProvince(this.state, event.targetProvinceId);
    const terrainLabel = terrainLabelForLanguage(target.terrainId, this.language);
    this.message = `${attacker.label} ${this.copy().attacksInBattle} ${terrainLabel}: ${event.attackingSoldiers} ${this.copy().soldiers}.`;
  }

  private captureBattleSummary(events: ReadonlyArray<WarForCrownEvent>): void {
    const summary = createBattleSummary(events);
    if (summary !== null) {
      this.battleSummary = summary;
    }
  }

  private isAiPlayer(playerId: PlayerId): boolean {
    return this.playerSetup(playerId).controller === 'ai';
  }

  private playAiUntilHumanTurn(): void {
    if (this.mode !== 'game') {
      return;
    }
    runWarForCrownAiAutoplay({
      applyAction: (playerId, action) => this.applyJournaledActionForPlayer(playerId, action),
      battleSummaryVisible: () => this.battleSummary !== null,
      chooseAction: (playerId) => chooseAiAction(
        createPlayerView(this.state, playerId, this.gameConfig),
        this.gameConfig,
        this.playerAiMode(playerId)
      ),
      getState: () => this.state,
      isAiPlayer: (playerId) => this.isAiPlayer(playerId),
      onActionApplied: (events) => {
        this.captureBattleSummary(events);
        const battleStarted = battleStartedEvent(events);
        if (battleStarted !== null) {
          this.updateBattleStartMessage(battleStarted);
        }
      },
      stepLimit: AI_AUTOPLAY_STEP_LIMIT
    });
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
    return mapTileAtGrid(this.state.map, x, y);
  }

  private tileWidth(): number {
    return mapTileWidth(this.state.map, this.mapViewport);
  }

  private tileHeight(): number {
    return mapTileHeight(this.state.map, this.mapViewport);
  }

  private tileRect(tile: TileState): Rect {
    return mapTileRect(this.state.map, this.mapViewport, tile);
  }

  private clampMapViewport(viewport: MapViewport): MapViewport {
    return clampMapViewport(viewport);
  }

  private tileAt(x: number, y: number): TileState | null {
    return mapTileAtPoint(this.state.map, this.mapViewport, { x, y });
  }

  private mapEdgeVelocity(point: Point): Point {
    return mapEdgeVelocity(this.mapViewport, point);
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
    this.selectedMovementTargetSoldiers = null;
    const hasTarget = c64HumanMovementTargetIds(
      this.state.map,
      this.state.activePlayerId,
      province.id
    ).size > 0;
    this.message = hasTarget
      ? `${province.id}: ${province.soldiers} ${this.copy().soldiers}. ${this.copy().chooseMoveTarget}`
      : `${province.id}: ${this.copy().borderMissing}`;
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

    if (!c64HumanMovementTargetIds(this.state.map, activePlayerId, fromProvince.id).has(province.id)) {
      this.message = this.copy().borderMissing;
      this.renderScene();
      return;
    }

    this.selectedTargetId = province.id;
    this.selectedAttackSourceIds = [];
    this.syncSelectedMovementTargetSoldiers();
    this.message = `${province.id}: ${this.movementTargetSoldiers()} ${this.copy().soldiers}.`;
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
        this.loadGameFromBrowser();
        break;
      case 'main-load-json':
        this.loadGameFromJsonFile();
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
        const soldiers = this.equalizedMovementTargetSoldiers();
        if (soldiers === null) {
          throw new Error('Cannot equalize movement without a legal equalized amount.');
        }
        this.setSelectedMovementTargetSoldiers(soldiers);
        this.renderScene();
        break;
      }
      case 'move-max':
        this.setSelectedMovementTargetSoldiers(this.maximumMovementTargetSoldiers());
        this.renderScene();
        break;
      case 'move-minus':
        this.changeSelectedMovementTargetSoldiers(-1);
        break;
      case 'move-plus':
        this.changeSelectedMovementTargetSoldiers(1);
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
      case 'save-game':
        this.saveGameToBrowser();
        break;
      case 'save-game-json':
        this.saveGameToJsonFile();
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
      case 'setup-color-p2':
      case 'setup-color-p3':
      case 'setup-color-p4':
      case 'setup-crest-p1':
      case 'setup-crest-p2':
      case 'setup-crest-p3':
      case 'setup-crest-p4':
      case 'setup-name-p1':
      case 'setup-name-p2':
      case 'setup-name-p3':
      case 'setup-name-p4': {
        const command = humanSetupButtonCommand(button.id);
        if (command.control === 'color') {
          this.cyclePlayerColor(command.playerId);
        } else if (command.control === 'crest') {
          this.cyclePlayerCrest(command.playerId);
        } else {
          this.editingNamePlayerId = command.playerId;
          this.renderScene();
        }
        break;
      }
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
    return createDisabledButtonMessage({
      config: this.gameConfig,
      id,
      language: this.language,
      selection: this.currentTurnSelection(),
      state: this.state
    });
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

  private panMapBy(deltaX: number, deltaY: number): boolean {
    const result = panMapViewport(this.mapViewport, deltaX, deltaY);
    this.mapViewport = result.viewport;
    return result.moved;
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

    const nextViewport = zoomMapViewport(this.mapViewport, this.mapZoomIndex, index, anchor);
    this.mapZoomIndex = index;
    this.mapViewport = nextViewport;
    return true;
  }

  private resetMapView(): void {
    this.mapZoomIndex = 0;
    this.mapViewport = initialMapViewport();
  }

  private mapViewMessage(): string {
    return mapViewportLabel(this.mapViewport);
  }

  private clearMapSelection(): void {
    this.selectedFromId = null;
    this.selectedTargetId = null;
    this.selectedAttackSourceIds = [];
    this.selectedMovementTargetSoldiers = null;
    this.pendingHomeProvinceId = null;
  }

  private currentTurnSelection(): turnSelection.TurnSelection {
    return {
      attackSourceIds: this.selectedAttackSourceIds,
      fromId: this.selectedFromId,
      movementTargetSoldiers: this.selectedMovementTargetSoldiers,
      targetId: this.selectedTargetId
    };
  }

  private isAttackStep(): boolean {
    return turnSelection.isAttackTurn(this.state);
  }

  private isMovementStep(): boolean {
    return turnSelection.isMovementTurn(this.state);
  }

  private validAttackSourceIds(targetProvinceId: ProvinceId): ReadonlyArray<ProvinceId> {
    return turnSelection.validAttackSourceIds(this.state, targetProvinceId);
  }

  private attackTargetIds(): ReadonlyArray<ProvinceId> {
    return turnSelection.attackTargetIds(this.state);
  }

  private selectedAttackSoldiers(): number {
    return turnSelection.selectedAttackSoldiers(this.state, this.selectedAttackSourceIds);
  }

  private canConfirmAttack(): boolean {
    return turnSelection.canConfirmAttack(this.state, this.currentTurnSelection());
  }

  private movementTargetSoldiers(): number {
    return turnSelection.movementTargetSoldiers(this.state, this.currentTurnSelection());
  }

  private maximumMovementTargetSoldiers(): number {
    return turnSelection.maximumMovementTargetSoldiers(this.state, this.currentTurnSelection());
  }

  private syncSelectedMovementTargetSoldiers(): void {
    this.selectedMovementTargetSoldiers = turnSelection.synchronizeMovementTargetSoldiers(
      this.state,
      this.currentTurnSelection()
    );
  }

  private setSelectedMovementTargetSoldiers(soldiers: number): void {
    this.selectedMovementTargetSoldiers = turnSelection.setMovementTargetSoldiers(
      this.state,
      this.currentTurnSelection(),
      soldiers
    );
  }

  private changeSelectedMovementTargetSoldiers(delta: number): void {
    this.setSelectedMovementTargetSoldiers(this.movementTargetSoldiers() + delta);
    this.renderScene();
  }

  private setMovementTargetSoldiersFromSlider(pointerX: number, region: SliderRegion): void {
    this.selectedMovementTargetSoldiers = turnSelection.movementSliderSoldiers(
      this.state,
      this.currentTurnSelection(),
      (pointerX - region.x) / region.width
    );
    this.renderScene();
  }

  private equalizedMovementTargetSoldiers(): number | null {
    return turnSelection.equalizedMovementTargetSoldiers(this.state, this.currentTurnSelection());
  }

  private canEqualizeMove(): boolean {
    return this.canConfirmMove() && this.equalizedMovementTargetSoldiers() !== null;
  }

  private canConfirmMove(): boolean {
    return turnSelection.canConfirmMove(this.state, this.currentTurnSelection());
  }

  private isInvestmentStep(): boolean {
    return turnSelection.isInvestmentTurn(this.state);
  }

  private canBuildSelectedVillage(): boolean {
    return turnSelection.canBuildSelectedVillage(
      this.state,
      this.gameConfig,
      this.currentTurnSelection()
    );
  }

  private canUpgradeSelectedFortification(): boolean {
    return turnSelection.canUpgradeSelectedFortification(
      this.state,
      this.gameConfig,
      this.currentTurnSelection()
    );
  }

  private affordableHireSoldiers(): number {
    return turnSelection.affordableHireSoldiers(this.state, this.gameConfig);
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
    const targetSoldiers = this.movementTargetSoldiers();
    const targetBefore = requireProvince(this.state, targetProvinceId).soldiers;
    const movedSoldiers = Math.abs(targetSoldiers - targetBefore);
    const eventFromProvinceId = targetSoldiers < targetBefore ? targetProvinceId : fromProvinceId;
    const eventTargetProvinceId = targetSoldiers < targetBefore ? fromProvinceId : targetProvinceId;
    this.applyActiveAction({
      type: 'move-soldiers',
      fromProvinceId,
      targetProvinceId,
      targetSoldiers
    });
    this.clearMapSelection();
    this.message =
      `${this.copy().moved} ${movedSoldiers} ${this.copy().soldiers}: ` +
      `${provinceLabelForLanguage(eventFromProvinceId, this.language)} -> ${provinceLabelForLanguage(eventTargetProvinceId, this.language)}.`;
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
      if (from.ownerId !== this.state.activePlayerId) {
        return [];
      }

      return this.state.map.provinces
        .filter((province) => c64HumanMovementTargetIds(
          this.state.map,
          this.state.activePlayerId,
          from.id
        ).has(province.id))
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
    drawMainMenuScreen(this.preGameScreenBoundary(), {
      copy: this.copy(),
      hasBrowserSave: this.hasBrowserSave,
      message: this.message,
      returnUrl: this.returnUrl
    });
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

  private drawRulesScreen(): void {
    drawRulesMenu(this.preGameScreenBoundary(), {
      config: this.gameConfig,
      copy: this.copy(),
      language: this.language
    });
  }

  private drawMapSelectionScreen(): void {
    drawMapSelectionOverlay(this.preGameScreenBoundary(), {
      config: this.gameConfig,
      copy: this.copy(),
      editingSeed: this.editingSeed,
      seed: this.state.seed
    });
  }

  private drawPlayerSetupScreen(): void {
    drawPlayerSetupOverlay(this.preGameScreenBoundary(), {
      config: this.gameConfig,
      copy: this.copy(),
      playerNamesValid: this.playerNamesAreValid(),
      playerSetups: this.playerSetups
    });
  }

  private preGameScreenBoundary(): PreGameScreenBoundary {
    return {
      addText: (x, y, text, style) => this.addText(x, y, text, style),
      drawAiSetupRow: (setup, x, y) => this.drawAiSetupRow(setup, x, y),
      drawButton: (id, label, x, y, width, height, enabled) =>
        this.drawButton(id, label, x, y, width, height, enabled),
      drawLanguageToggle: () => this.drawLanguageToggle(),
      drawMenuBase: (rect) => this.drawMenuBase(rect),
      drawOptionButton: (id, label, value, x, y, width, tooltip) =>
        this.drawOptionButton(id, label, value, x, y, width, tooltip),
      drawPlayerSetupRow: (playerId, x, y) => this.drawPlayerSetupRow(playerId, x, y),
      drawTerrainLegend: (x, y) => this.drawTerrainLegend(x, y),
      drawTitleDivider: (x, y, width) => this.drawTitleDivider(x, y, width),
      drawTooltipMarker: (x, y, text) => this.drawTooltipMarker(x, y, text)
    };
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
    const colorButtonId = humanSetupButtonId('color', playerId);
    const crestButtonId = humanSetupButtonId('crest', playerId);
    const nameButtonId = humanSetupButtonId('name', playerId);
    const nameLabel = this.editingNamePlayerId === playerId ? `${setup.name}_` : setup.name;

    this.uiGraphics.fillStyle(color, 1);
    this.uiGraphics.fillRect(x, y + 2, 14, 14);
    this.addText(x + 22, y - 2, playerId.toUpperCase(), {
      fontSize: '12px',
      color: TEXT_COLOR
    });

    this.drawButton(nameButtonId, nameLabel, x + 54, y - 6, 214, 26, true);
    this.addText(x, y + 34, copy.color, {
      fontSize: '10px',
      color: MUTED_TEXT_COLOR
    });
    this.drawButton(colorButtonId, cssColor(color), x + 48, y + 28, 82, 26, true);
    this.addText(x + 138, y + 34, copy.crest, {
      fontSize: '10px',
      color: MUTED_TEXT_COLOR
    });
    this.drawButton(
      crestButtonId,
      this.language === 'pl' ? crest.pl : crest.en,
      x + 184,
      y + 28,
      84,
      26,
      true
    );
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
      return `${active.label}: ${this.movementTargetSoldiers()} -> ${provinceLabelForLanguage(this.selectedTargetId, this.language)}`;
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
    const soldiers = this.movementTargetSoldiers();
    const max = this.maximumMovementTargetSoldiers();
    this.addText(x, y, `${this.copy().target}: ${soldiers}/${max} ${this.copy().soldiers}`, {
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
    const max = this.maximumMovementTargetSoldiers();
    const soldiers = this.movementTargetSoldiers();
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
      this.drawButton('confirm-home', copy.confirm, 850, 666, 154, 34, this.pendingHomeProvinceId !== null);
    } else {
      this.drawButton(
        'advance-step',
        turnUiCopy(this.state, this.language).advanceLabel,
        850,
        666,
        154,
        34,
        this.state.phase === 'turn'
      );
    }

    this.drawButton('save-game', copy.save, 1010, 666, 78, 34, true);
    this.drawButton('save-game-json', copy.saveJson, 1094, 666, 60, 34, true);
    this.drawButton('new-map', copy.menu, 1160, 666, 90, 34, true);
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
