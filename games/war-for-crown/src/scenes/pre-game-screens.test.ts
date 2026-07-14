import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import {
  drawMainMenuScreen,
  drawRulesScreen,
  type PreGameScreenBoundary
} from './pre-game-screens';
import { UI_COPY } from './ui-copy';

function boundary(): PreGameScreenBoundary {
  const text = {
    setOrigin: vi.fn().mockReturnThis(),
    setShadow: vi.fn().mockReturnThis()
  };
  return {
    addText: vi.fn(() => text) as unknown as PreGameScreenBoundary['addText'],
    drawAiSetupRow: vi.fn(),
    drawButton: vi.fn(),
    drawLanguageToggle: vi.fn(),
    drawMenuBase: vi.fn(),
    drawOptionButton: vi.fn(),
    drawPlayerSetupRow: vi.fn(),
    drawTerrainLegend: vi.fn(),
    drawTitleDivider: vi.fn(),
    drawTooltipMarker: vi.fn()
  };
}

describe('War for Crown pre-game screens', () => {
  it('adds the Sofa Arcade return only when a return route exists', () => {
    const target = boundary();
    drawMainMenuScreen(target, {
      copy: UI_COPY.pl,
      hasBrowserSave: false,
      message: 'menu',
      returnUrl: '/sofaArcade/'
    });

    expect(target.drawButton).toHaveBeenCalledWith(
      'main-sofa-arcade',
      UI_COPY.pl.sofaArcade,
      430,
      570,
      420,
      48,
      true
    );
  });

  it('renders every configurable royalist rule', () => {
    const target = boundary();
    drawRulesScreen(target, {
      config: DEFAULT_GAME_CONFIG,
      copy: UI_COPY.en,
      language: 'en'
    });

    const ids = vi.mocked(target.drawOptionButton).mock.calls.map(([id]) => id);
    expect(ids).toEqual(expect.arrayContaining([
      'rules-royalist-attitude',
      'rules-royalist-growth',
      'rules-royalist-investment',
      'rules-royalist-distribution'
    ]));
  });
});
