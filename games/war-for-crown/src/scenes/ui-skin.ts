import { WAR_FOR_CROWN_MAP_SKIN } from './map-visuals';
import { WAR_FOR_CROWN_FONT_FAMILY } from './ui-font';

export const UI_SKIN = {
  fonts: { ui: WAR_FOR_CROWN_FONT_FAMILY, map: WAR_FOR_CROWN_FONT_FAMILY },
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

export const BACKGROUND_COLOR = UI_SKIN.colors.background;
export const PANEL_COLOR = UI_SKIN.colors.panel;
export const PANEL_LINE_COLOR = UI_SKIN.colors.panelLine;
export const MAP_LINE_COLOR = UI_SKIN.colors.mapLine;
export const WATER_COLOR = UI_SKIN.colors.water;
export const TEXT_COLOR = UI_SKIN.colors.text;
export const VALUE_TEXT_COLOR = UI_SKIN.colors.valueText;
export const MUTED_TEXT_COLOR = UI_SKIN.colors.mutedText;
export const TEXT_NUMERIC_COLOR = 0x8ff6f2;
export const MUTED_TEXT_NUMERIC_COLOR = 0xb6c3be;
export const WARNING_COLOR = UI_SKIN.colors.warning;
export const BUTTON_COLOR = UI_SKIN.colors.button;
export const BUTTON_DISABLED_COLOR = UI_SKIN.colors.buttonDisabled;
export const BUTTON_LINE_COLOR = UI_SKIN.colors.buttonLine;
export const LEGAL_TARGET_COLOR = UI_SKIN.colors.legalTarget;
export const SELECTED_COLOR = UI_SKIN.colors.selected;
export const TARGET_COLOR = UI_SKIN.colors.target;
export const NEUTRAL_COLOR = UI_SKIN.colors.neutral;
