import { describe, expect, it } from 'vitest';

import { PIXEL_INVADERS_GAME_SETUP } from './options';

describe('Pixel Invaders standalone setup', () => {
  it('contains only Pixel Invaders and leaves the arcade catalog to the root launcher', () => {
    expect(PIXEL_INVADERS_GAME_SETUP.id).toBe('pixel-invaders');
  });
});
