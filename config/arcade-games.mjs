const arcadeGames = [
  {
    id: 'pixel-invaders',
    packageName: 'pixel-invaders',
    route: 'PixelInvaders',
    title: 'Pixel Invaders',
    description: 'Kanapowa strzelanka dla załogi broniącej wspólnego ekranu.',
    players: '1–4 graczy'
  },
  {
    id: 'artillery-duel',
    packageName: 'artillery-duel',
    route: 'ArtilleryDuel',
    title: 'Artillery Duel',
    description: 'Pojedynek dział, w którym liczą się kąt, siła i wiatr.',
    players: '1–2 graczy'
  },
  {
    id: 'tunnel-invaders',
    packageName: 'tunnel-invaders',
    route: 'TunnelInvaders',
    title: 'Tunnel Invaders',
    description: 'Szybka wyprawa przez tunel pełen przeszkód i przeciwników.',
    players: '1 gracz'
  },
  {
    id: 'war-for-crown',
    packageName: 'war-for-crown',
    route: 'WarForCrown',
    title: 'War for Crown',
    description: 'Strategia o prowincjach, armiach i koronie inspirowana wersją C64.',
    players: '1–4 graczy'
  }
];

const REQUIRED_FIELDS = ['id', 'packageName', 'route', 'title', 'description', 'players'];

function validateArcadeGames(games) {
  if (!Array.isArray(games) || games.length === 0) {
    throw new Error('Sofa Arcade catalog must contain at least one game.');
  }

  const ids = new Set();
  const routes = new Set();
  for (const game of games) {
    for (const field of REQUIRED_FIELDS) {
      if (typeof game[field] !== 'string' || game[field].length === 0) {
        throw new Error(`Sofa Arcade game field "${field}" must be a non-empty string.`);
      }
    }
    if (ids.has(game.id)) {
      throw new Error(`Duplicate Sofa Arcade game id: ${game.id}`);
    }
    if (routes.has(game.route)) {
      throw new Error(`Duplicate Sofa Arcade game route: ${game.route}`);
    }
    ids.add(game.id);
    routes.add(game.route);
  }
}

validateArcadeGames(arcadeGames);

export const ARCADE_GAMES = Object.freeze(arcadeGames.map((game) => Object.freeze(game)));
