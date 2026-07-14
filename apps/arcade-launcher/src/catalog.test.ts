import { describe, expect, it } from 'vitest';

import { createArcadeCatalog } from './catalog';

describe('createArcadeCatalog', () => {
  it('builds routes for every standalone game under the deployment base', () => {
    const catalog = createArcadeCatalog('/sofaArcade/');

    expect(catalog.map(({ id, href }) => ({ id, href }))).toEqual([
      { id: 'pixel-invaders', href: '/sofaArcade/PixelInvaders/' },
      { id: 'artillery-duel', href: '/sofaArcade/ArtilleryDuel/' },
      { id: 'tunnel-invaders', href: '/sofaArcade/TunnelInvaders/' },
      { id: 'war-for-crown', href: '/sofaArcade/WarForCrown/' }
    ]);
  });

  it.each(['sofaArcade/', '/sofaArcade', ''])('rejects invalid base URL %j', (baseUrl) => {
    expect(() => createArcadeCatalog(baseUrl)).toThrow('base URL must start and end');
  });

  it('reports the human player counts supported by standalone game setup', () => {
    const catalog = createArcadeCatalog('/');

    expect(catalog.find((game) => game.id === 'tunnel-invaders')?.players).toBe('1 gracz');
    expect(catalog.find((game) => game.id === 'war-for-crown')?.players).toBe('1–4 graczy');
  });
});
