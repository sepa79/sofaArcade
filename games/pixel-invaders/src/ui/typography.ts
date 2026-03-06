import type Phaser from 'phaser';

import orbitronFontUrl from '../assets/fonts/Orbitron[wght].ttf';
import pressStart2PFontUrl from '../assets/fonts/PressStart2P-Regular.ttf';

const ORBITRON_FONT_FAMILY = 'Orbitron';
const PRESS_START_2P_FONT_FAMILY = 'Press Start 2P';
const MAX_UI_SCALE = 2;

interface FontDefinition {
  readonly family: string;
  readonly sourceUrl: string;
  readonly weight: string;
}

interface ShadowToken {
  readonly color: string;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number;
}

export interface TypographyToken {
  readonly fontFamily: string;
  readonly baseFontSize: number;
  readonly letterSpacing: number;
  readonly lineSpacing: number;
  readonly color: string;
  readonly strokeColor: string;
  readonly strokeThickness: number;
  readonly shadow: ShadowToken;
  readonly paddingX: number;
  readonly paddingY: number;
}

const FONT_DEFINITIONS: ReadonlyArray<FontDefinition> = [
  {
    family: ORBITRON_FONT_FAMILY,
    sourceUrl: orbitronFontUrl,
    weight: '600'
  },
  {
    family: PRESS_START_2P_FONT_FAMILY,
    sourceUrl: pressStart2PFontUrl,
    weight: '400'
  }
] as const;

export const HUD_LABEL_TOKEN: TypographyToken = {
  fontFamily: ORBITRON_FONT_FAMILY,
  baseFontSize: 24,
  letterSpacing: 1.2,
  lineSpacing: 0,
  color: '#f5fbff',
  strokeColor: '#071224',
  strokeThickness: 3,
  shadow: {
    color: 'rgba(3, 10, 28, 0.68)',
    offsetX: 0,
    offsetY: 2,
    blur: 0
  },
  paddingX: 6,
  paddingY: 6
};

export const HUD_VALUE_TOKEN: TypographyToken = {
  fontFamily: ORBITRON_FONT_FAMILY,
  baseFontSize: 28,
  letterSpacing: 1.4,
  lineSpacing: 0,
  color: '#ffdca4',
  strokeColor: '#091427',
  strokeThickness: 3,
  shadow: {
    color: 'rgba(2, 10, 22, 0.72)',
    offsetX: 0,
    offsetY: 2,
    blur: 0
  },
  paddingX: 6,
  paddingY: 6
};

export const PROMPT_TOKEN: TypographyToken = {
  fontFamily: PRESS_START_2P_FONT_FAMILY,
  baseFontSize: 48,
  letterSpacing: 0,
  lineSpacing: 12,
  color: '#fff0cc',
  strokeColor: '#0b1630',
  strokeThickness: 4,
  shadow: {
    color: 'rgba(103, 209, 255, 0.26)',
    offsetX: 0,
    offsetY: 0,
    blur: 8
  },
  paddingX: 10,
  paddingY: 10
};

export const HINT_TOKEN: TypographyToken = {
  fontFamily: ORBITRON_FONT_FAMILY,
  baseFontSize: 18,
  letterSpacing: 1,
  lineSpacing: 0,
  color: '#b9efff',
  strokeColor: '#08152c',
  strokeThickness: 2,
  shadow: {
    color: 'rgba(3, 10, 28, 0.6)',
    offsetX: 0,
    offsetY: 2,
    blur: 0
  },
  paddingX: 4,
  paddingY: 4
};

let fontLoadPromise: Promise<void> | null = null;

function requireDocumentFonts(): FontFaceSet {
  if (typeof document === 'undefined' || document.fonts === undefined) {
    throw new Error('Pixel Invaders UI fonts require document.fonts support.');
  }

  return document.fonts;
}

function snapUiValue(value: number): number {
  return Math.round(value);
}

async function loadFont(definition: FontDefinition): Promise<void> {
  const fontFace = new FontFace(
    definition.family,
    `url(${definition.sourceUrl}) format("truetype")`,
    {
      style: 'normal',
      weight: definition.weight
    }
  );
  const loadedFont = await fontFace.load();
  const fontSet = requireDocumentFonts();
  fontSet.add(loadedFont);
  await fontSet.load(`${definition.weight} 16px "${definition.family}"`);
}

export function clampUiScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`UI scale must be a positive finite number, got ${scale}.`);
  }

  return Math.min(MAX_UI_SCALE, Math.max(1, scale));
}

export async function loadPixelUiFonts(): Promise<void> {
  if (fontLoadPromise !== null) {
    return fontLoadPromise;
  }

  fontLoadPromise = Promise.all(FONT_DEFINITIONS.map((definition) => loadFont(definition))).then(() => undefined);
  return fontLoadPromise;
}

export function applyTypographyToken(
  text: Phaser.GameObjects.Text,
  token: TypographyToken,
  uiScale: number
): void {
  const scale = clampUiScale(uiScale);
  text.setFontFamily(token.fontFamily);
  text.setFontSize(snapUiValue(token.baseFontSize * scale));
  text.setLetterSpacing(token.letterSpacing * scale);
  text.setLineSpacing(snapUiValue(token.lineSpacing * scale));
  text.setColor(token.color);
  text.setStroke(token.strokeColor, Math.max(1, snapUiValue(token.strokeThickness * scale)));
  text.setShadow(
    snapUiValue(token.shadow.offsetX * scale),
    snapUiValue(token.shadow.offsetY * scale),
    token.shadow.color,
    snapUiValue(token.shadow.blur * scale),
    true,
    true
  );
  text.setPadding(
    snapUiValue(token.paddingX * scale),
    snapUiValue(token.paddingY * scale),
    snapUiValue(token.paddingX * scale),
    snapUiValue(token.paddingY * scale)
  );
}

export function snapUiPixel(value: number): number {
  return snapUiValue(value);
}
