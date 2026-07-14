import artilleryDuelThumbnail from '../../../games/artillery-duel/src/assets/launcher-thumbnail.svg';
import pixelInvadersThumbnail from '../../../games/pixel-invaders/screenshots/start-screen-1080p.png';
import tunnelInvadersThumbnail from '../../../games/tunnel-invaders/screenshots/launcher-thumbnail.png';
import warForCrownThumbnail from '../../../games/war-for-crown/src/assets/launcher-thumbnail.svg';
import { ARCADE_GAMES } from '../../../config/arcade-games.mjs';

export interface ArcadeGame {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly players: string;
  readonly thumbnailUrl: string;
  readonly href: string;
}

const THUMBNAILS: Readonly<Record<string, string>> = {
  'pixel-invaders': pixelInvadersThumbnail,
  'artillery-duel': artilleryDuelThumbnail,
  'tunnel-invaders': tunnelInvadersThumbnail,
  'war-for-crown': warForCrownThumbnail
};

function requireThumbnail(gameId: string): string {
  const thumbnail = THUMBNAILS[gameId];
  if (thumbnail === undefined) {
    throw new Error(`Missing Sofa Arcade thumbnail for game "${gameId}".`);
  }
  return thumbnail;
}

export function createArcadeCatalog(baseUrl: string): readonly ArcadeGame[] {
  if (!baseUrl.startsWith('/') || !baseUrl.endsWith('/')) {
    throw new Error(`Sofa Arcade base URL must start and end with "/": ${baseUrl}`);
  }

  return ARCADE_GAMES.map((game) => ({
    id: game.id,
    title: game.title,
    description: game.description,
    players: game.players,
    thumbnailUrl: requireThumbnail(game.id),
    href: `${baseUrl}${game.route}/`
  }));
}
