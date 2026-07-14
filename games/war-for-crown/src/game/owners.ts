import type { PlayerId } from './types';

export const ROYALIST_OWNER_ID = 0 as const;

export type RoyalistOwnerId = typeof ROYALIST_OWNER_ID;
export type OwnerId = PlayerId | RoyalistOwnerId;

export function isRoyalistOwner(ownerId: OwnerId): ownerId is RoyalistOwnerId {
  return ownerId === ROYALIST_OWNER_ID;
}

export function isPlayerOwner(ownerId: OwnerId): ownerId is PlayerId {
  return ownerId !== ROYALIST_OWNER_ID;
}

export function requirePlayerOwner(ownerId: OwnerId, context: string): PlayerId {
  if (!isPlayerOwner(ownerId)) {
    throw new Error(`${context} requires a player owner, got royalist owner 0.`);
  }
  return ownerId;
}
