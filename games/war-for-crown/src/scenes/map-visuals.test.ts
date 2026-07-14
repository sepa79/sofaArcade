import { describe, expect, it } from 'vitest';

import { createProvinceBadgeLayout } from './map-visuals';

describe('createProvinceBadgeLayout', () => {
  it('keeps a badge narrower than its tile at overview zoom', () => {
    const tileWidth = 39.27;
    const layout = createProvinceBadgeLayout(tileWidth, 45.67);

    expect(layout.width).toBe(tileWidth - 6);
    expect(layout.width).toBeLessThan(tileWidth);
    expect(layout.fontSize).toBe(8);
  });

  it('caps the badge after zooming in', () => {
    const layout = createProvinceBadgeLayout(92, 84);

    expect(layout.width).toBe(52);
    expect(layout.height).toBe(19);
    expect(layout.fontSize).toBe(10);
  });

  it('fails when the tile cannot contain readable badge content', () => {
    expect(() => createProvinceBadgeLayout(30, 20)).toThrow(
      'Province badge cannot fit inside a 30x20 tile.'
    );
  });
});
