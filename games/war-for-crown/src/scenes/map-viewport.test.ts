import { describe, expect, it } from 'vitest';

import { MAP_RECT } from './scene-contracts';
import {
  initialMapViewport,
  mapCanPanRight,
  panMapViewport,
  zoomMapViewport
} from './map-viewport';

describe('War for Crown map viewport', () => {
  it('zooms around the requested anchor and clamps panning', () => {
    const initial = initialMapViewport();
    const zoomed = zoomMapViewport(initial, 0, 1, {
      x: MAP_RECT.x + MAP_RECT.width / 2,
      y: MAP_RECT.y + MAP_RECT.height / 2
    });

    expect(zoomed.zoom).toBe(1.35);
    expect(mapCanPanRight(zoomed)).toBe(true);
    const panned = panMapViewport(zoomed, Number.MAX_SAFE_INTEGER, 0);
    expect(panned.moved).toBe(true);
    expect(mapCanPanRight(panned.viewport)).toBe(false);
  });

  it('fails fast when asked to reapply the active zoom index', () => {
    expect(() => zoomMapViewport(initialMapViewport(), 0, 0, { x: 0, y: 0 }))
      .toThrow('already active');
  });
});
