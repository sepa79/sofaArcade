import { COURIER_TURNS_PER_LY } from './constants';
import type { Channel, GameState, Owner, RelayLink, StarSystem } from './types';

function requireSystem(state: GameState, systemId: string): StarSystem {
  const system = state.systems.find((candidate) => candidate.id === systemId);
  if (system === undefined) {
    throw new Error(`Unknown system "${systemId}".`);
  }

  return system;
}

export function distanceBetweenSystems(a: StarSystem, b: StarSystem): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function canUseRelayLink(state: GameState, link: RelayLink, owner: Exclude<Owner, 'neutral'>): boolean {
  if (link.owner !== owner) {
    return false;
  }

  const a = requireSystem(state, link.a);
  const b = requireSystem(state, link.b);
  return a.owner === owner && b.owner === owner;
}

function relayNeighbors(
  state: GameState,
  systemId: string,
  owner: Exclude<Owner, 'neutral'>
): ReadonlyArray<{ readonly systemId: string; readonly distance: number }> {
  const neighbors: Array<{ readonly systemId: string; readonly distance: number }> = [];
  for (const link of state.relayLinks) {
    if (!canUseRelayLink(state, link, owner)) {
      continue;
    }

    if (link.a === systemId) {
      const target = requireSystem(state, link.b);
      neighbors.push({ systemId: target.id, distance: distanceBetweenSystems(requireSystem(state, systemId), target) });
      continue;
    }

    if (link.b === systemId) {
      const target = requireSystem(state, link.a);
      neighbors.push({ systemId: target.id, distance: distanceBetweenSystems(requireSystem(state, systemId), target) });
    }
  }

  return neighbors;
}

export function relayPathDistance(
  state: GameState,
  sourceId: string,
  destinationId: string,
  owner: Exclude<Owner, 'neutral'>
): number | null {
  if (sourceId === destinationId) {
    return 0;
  }

  const frontier = new Map<string, number>([[sourceId, 0]]);
  const visited = new Set<string>();

  while (frontier.size > 0) {
    let currentId: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const [candidateId, candidateDistance] of frontier.entries()) {
      if (candidateDistance < currentDistance) {
        currentId = candidateId;
        currentDistance = candidateDistance;
      }
    }

    if (currentId === null) {
      throw new Error('Relay path search exhausted without selecting a node.');
    }

    frontier.delete(currentId);
    if (currentId === destinationId) {
      return currentDistance;
    }

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    for (const neighbor of relayNeighbors(state, currentId, owner)) {
      if (visited.has(neighbor.systemId)) {
        continue;
      }

      const candidateDistance = currentDistance + neighbor.distance;
      const currentBest = frontier.get(neighbor.systemId);
      if (currentBest === undefined || candidateDistance < currentBest) {
        frontier.set(neighbor.systemId, candidateDistance);
      }
    }
  }

  return null;
}

export function travelTurnsForChannel(
  state: GameState,
  sourceId: string,
  destinationId: string,
  channel: Channel,
  owner: Exclude<Owner, 'neutral'>
): number {
  const source = requireSystem(state, sourceId);
  const destination = requireSystem(state, destinationId);
  const directDistance = distanceBetweenSystems(source, destination);

  switch (channel) {
    case 'radio':
      return Math.max(1, Math.ceil(directDistance));
    case 'courier':
      return Math.max(1, Math.ceil(directDistance * COURIER_TURNS_PER_LY));
    case 'relay': {
      const totalPath = relayPathDistance(state, sourceId, destinationId, owner);
      if (totalPath === null) {
        throw new Error(`No relay path from "${sourceId}" to "${destinationId}" for ${owner}.`);
      }

      return Math.max(1, Math.ceil(totalPath));
    }
  }
}
