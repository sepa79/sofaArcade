import type Phaser from 'phaser';

import { WORLD_WIDTH } from '../game/constants';
import type { GameConfig, PlayerId } from '../game/types';
import type { AiPlayerSetup, PlayerSetup } from './player-setup-model';
import {
  MAIN_MENU_RECT,
  PANEL_TEXT_WIDTH,
  RULES_MENU_RECT,
  type ButtonId,
  type Rect
} from './scene-contracts';
import {
  ROYALIST_ATTITUDE_LABELS,
  ROYALIST_DISTRIBUTION_LABELS,
  TERRAIN_INFLUENCE_LABELS,
  booleanLabel,
  fortificationLabelForLanguage
} from './scene-presentation';
import type { Language } from './ui-copy';
import { MUTED_TEXT_COLOR, TEXT_COLOR } from './ui-skin';

type UiCopy = (typeof import('./ui-copy').UI_COPY)[Language];

export interface PreGameScreenBoundary {
  readonly addText: (
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ) => Phaser.GameObjects.Text;
  readonly drawAiSetupRow: (setup: AiPlayerSetup, x: number, y: number) => void;
  readonly drawButton: (
    id: ButtonId,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    enabled: boolean
  ) => void;
  readonly drawLanguageToggle: () => void;
  readonly drawMenuBase: (rect: Rect) => void;
  readonly drawOptionButton: (
    id: ButtonId,
    label: string,
    value: string,
    x: number,
    y: number,
    width?: number,
    tooltip?: string | null
  ) => void;
  readonly drawPlayerSetupRow: (playerId: PlayerId, x: number, y: number) => void;
  readonly drawTerrainLegend: (x: number, y: number) => void;
  readonly drawTitleDivider: (x: number, y: number, width: number) => void;
  readonly drawTooltipMarker: (x: number, y: number, text: string) => void;
}

export function drawMainMenuScreen(
  boundary: PreGameScreenBoundary,
  input: {
    readonly copy: UiCopy;
    readonly hasBrowserSave: boolean;
    readonly message: string;
    readonly returnUrl: string | null;
  }
): void {
  boundary.drawMenuBase(MAIN_MENU_RECT);
  boundary.addText(WORLD_WIDTH / 2, 112, input.copy.mainMenuTitle, {
    fontSize: '32px',
    color: TEXT_COLOR
  }).setOrigin(0.5, 0).setShadow(2, 2, '#000000', 1);
  boundary.drawTitleDivider(390, 166, 500);
  boundary.addText(WORLD_WIDTH / 2, 202, input.message, {
    fontSize: '17px',
    color: MUTED_TEXT_COLOR,
    align: 'center'
  }).setOrigin(0.5, 0);
  boundary.drawButton('main-new-game', input.copy.newGame, 430, 282, 420, 48, true);
  boundary.drawButton('main-rules', input.copy.rules, 430, 354, 420, 48, true);
  boundary.drawButton('main-load', input.copy.load, 430, 426, 420, 48, input.hasBrowserSave);
  boundary.drawButton('main-load-json', input.copy.loadJson, 430, 498, 420, 48, true);
  if (input.returnUrl !== null) {
    boundary.drawButton('main-sofa-arcade', input.copy.sofaArcade, 430, 570, 420, 48, true);
  }
}

export function drawRulesScreen(
  boundary: PreGameScreenBoundary,
  input: { readonly config: GameConfig; readonly copy: UiCopy; readonly language: Language }
): void {
  const { config, copy, language } = input;
  boundary.drawMenuBase(RULES_MENU_RECT);
  boundary.addText(WORLD_WIDTH / 2, 68, copy.rulesTitle, {
    fontSize: '28px',
    color: TEXT_COLOR
  }).setOrigin(0.5, 0).setShadow(2, 2, '#000000', 1);
  boundary.drawTitleDivider(190, 108, 900);
  boundary.drawOptionButton('rules-village-cost', copy.villageCost, `${config.villageCost}`, 190, 148, 390, copy.rulesTooltips.villageCost);
  boundary.drawOptionButton('rules-interest', copy.interestRate, `${config.interestRatePercent}%`, 190, 194, 390, copy.rulesTooltips.interestRate);
  boundary.drawOptionButton('rules-start-soldiers', copy.startingSoldiers, `${config.startingSoldiers}`, 190, 240, 390, copy.rulesTooltips.startingSoldiers);
  boundary.drawOptionButton('rules-start-money', copy.startingMoney, `${config.startingMoney}`, 190, 286, 390, copy.rulesTooltips.startingMoney);
  boundary.drawOptionButton('rules-home-max-fort', copy.homeMaxFort, fortificationLabelForLanguage(config.maxHomeFortificationLevel, language), 190, 332, 390, copy.rulesTooltips.homeMaxFort);
  boundary.drawOptionButton('rules-province-max-fort', copy.provinceMaxFort, fortificationLabelForLanguage(config.maxProvinceFortificationLevel, language), 190, 378, 390, copy.rulesTooltips.provinceMaxFort);
  boundary.drawOptionButton('rules-royalist-attitude', copy.royalistAttitude, ROYALIST_ATTITUDE_LABELS[config.royalistAttitude][language], 700, 148, 390, copy.rulesTooltips.royalistAttitude);
  boundary.drawOptionButton('rules-royalist-growth', copy.royalistGrowth, `${config.royalistGrowthPercent}%`, 700, 194, 390, copy.rulesTooltips.royalistGrowth);
  boundary.drawOptionButton('rules-royalist-investment', copy.royalistInvestment, `${config.royalistInvestmentPercent}%`, 700, 240, 390, copy.rulesTooltips.royalistInvestment);
  boundary.drawOptionButton('rules-royalist-distribution', copy.royalistDistribution, ROYALIST_DISTRIBUTION_LABELS[config.royalistDistribution][language], 700, 286, 390, copy.rulesTooltips.royalistDistribution);
  boundary.drawOptionButton('rules-terrain-influence', copy.terrainInfluence, TERRAIN_INFLUENCE_LABELS[config.terrainInfluence][language], 700, 332, 390, copy.rulesTooltips.terrainInfluence);
  boundary.drawOptionButton('rules-show-computer-battles', copy.showComputerBattles, booleanLabel(config.showComputerBattles, language), 700, 378, 390, copy.rulesTooltips.showComputerBattles);
  boundary.drawTitleDivider(190, 452, 900);
  boundary.drawButton('rules-back', copy.back, 392, 500, 210, 40, true);
  boundary.drawButton('rules-new-game', copy.newGame, 678, 500, 210, 40, true);
}

export function drawMapSelectionScreen(
  boundary: PreGameScreenBoundary,
  input: {
    readonly config: GameConfig;
    readonly copy: UiCopy;
    readonly editingSeed: string | null;
    readonly seed: number;
  }
): void {
  const { config, copy } = input;
  boundary.drawLanguageToggle();
  boundary.addText(42, 17, copy.chooseMapTitle, {
    fontSize: '22px',
    color: TEXT_COLOR
  }).setShadow(2, 2, '#000000', 1);
  const seedLabel = input.editingSeed === null ? String(input.seed) : `${input.editingSeed}_`;
  boundary.drawButton('map-seed', `${copy.seed} ${seedLabel}`, 276, 12, 220, 32, true);
  boundary.addText(952, 102, copy.mapInfo, { fontSize: '15px', color: TEXT_COLOR });
  boundary.addText(952, 136, copy.chooseMapInstruction, {
    fontSize: '13px',
    color: TEXT_COLOR,
    wordWrap: { width: PANEL_TEXT_WIDTH }
  });
  boundary.drawOptionButton('map-province-count', copy.continentProvinces, `${config.provinceCount}`, 952, 204, 268);
  boundary.drawOptionButton('map-max-villages', copy.maxVillages, `${config.maxVillages}`, 952, 252, 268);
  boundary.drawOptionButton('map-village-mode', copy.maxVillagesMode, config.maxVillagesMode === 'per-province' ? copy.perProvince : copy.largestProvince, 952, 300, 268);
  boundary.drawTerrainLegend(952, 354);
  boundary.drawButton('map-back', copy.back, 730, 666, 106, 34, true);
  boundary.drawButton('map-regenerate', copy.regenerateMap, 852, 666, 138, 34, true);
  boundary.drawButton('map-accept', copy.acceptMap, 1006, 666, 138, 34, true);
}

export function drawPlayerSetupScreen(
  boundary: PreGameScreenBoundary,
  input: {
    readonly config: GameConfig;
    readonly copy: UiCopy;
    readonly playerNamesValid: boolean;
    readonly playerSetups: ReadonlyArray<PlayerSetup>;
  }
): void {
  const { config, copy } = input;
  boundary.drawLanguageToggle();
  boundary.addText(42, 17, copy.setupTitle, { fontSize: '22px', color: TEXT_COLOR })
    .setShadow(2, 2, '#000000', 1);
  boundary.addText(290, 20, copy.setupInstruction, {
    fontSize: '14px',
    color: MUTED_TEXT_COLOR
  });
  boundary.addText(952, 102, copy.players, { fontSize: '15px', color: TEXT_COLOR });
  boundary.drawOptionButton('setup-human-count', copy.humanPlayers, `${config.humanPlayerCount}`, 952, 144, 268);
  boundary.drawOptionButton('setup-ai-count', copy.aiBarons, `${config.aiPlayerCount}`, 952, 180, 268);

  let rowY = 230;
  for (const setup of input.playerSetups.filter((candidate) => candidate.controller === 'human')) {
    boundary.drawPlayerSetupRow(setup.playerId, 952, rowY);
    rowY += 74;
  }
  const aiSetups = input.playerSetups.filter(
    (setup): setup is AiPlayerSetup => setup.controller === 'ai'
  );
  if (aiSetups.length > 0) {
    boundary.addText(952, rowY + 4, copy.computer, { fontSize: '12px', color: MUTED_TEXT_COLOR });
    boundary.addText(1110, rowY + 4, copy.aiMode, { fontSize: '12px', color: MUTED_TEXT_COLOR });
    boundary.drawTooltipMarker(1170, rowY + 4, copy.aiModeTooltip);
    rowY += 26;
    for (const setup of aiSetups) {
      boundary.drawAiSetupRow(setup, 952, rowY);
      rowY += 30;
    }
  }
  boundary.drawButton('setup-back', copy.back, 808, 666, 106, 34, true);
  boundary.drawButton('setup-start', copy.start, 930, 666, 138, 34, input.playerNamesValid);
}
