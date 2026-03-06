import { PLAYER_LANE_STEP_Y, PLAYER_Y } from './constants';
import type { FrameInput, PlayerLane } from './types';

const PLAYER_LANES: readonly PlayerLane[] = ['low', 'mid', 'high'] as const;

export function defaultPlayerLaneForIndex(playerIndex: number): PlayerLane {
  if (!Number.isInteger(playerIndex) || playerIndex < 0) {
    throw new Error(`playerIndex must be a non-negative integer, got ${playerIndex}.`);
  }

  const initialLanes: readonly PlayerLane[] = ['low', 'high', 'mid'] as const;
  const lane = initialLanes[playerIndex % initialLanes.length];
  if (lane === undefined) {
    throw new Error(`Missing default lane for playerIndex ${playerIndex}.`);
  }

  return lane;
}

export function playerLaneIndex(lane: PlayerLane): number {
  const laneIndex = PLAYER_LANES.indexOf(lane);
  if (laneIndex < 0) {
    throw new Error(`Unsupported player lane "${lane}".`);
  }

  return laneIndex;
}

export function playerLaneWorldY(lane: PlayerLane): number {
  return PLAYER_Y - playerLaneIndex(lane) * PLAYER_LANE_STEP_Y;
}

export function playerLaneLabel(lane: PlayerLane): string {
  return lane.toUpperCase();
}

export function applyLaneInput(lane: PlayerLane, input: FrameInput): PlayerLane {
  const laneOffset = (input.moveLaneUpPressed ? 1 : 0) - (input.moveLaneDownPressed ? 1 : 0);
  if (laneOffset === 0) {
    return lane;
  }

  const nextLaneIndex = Math.max(0, Math.min(PLAYER_LANES.length - 1, playerLaneIndex(lane) + laneOffset));
  const nextLane = PLAYER_LANES[nextLaneIndex];
  if (nextLane === undefined) {
    throw new Error(`Lane index ${nextLaneIndex} is out of range.`);
  }

  return nextLane;
}

export function canHitLaneAbove(sourceLane: PlayerLane, targetLane: PlayerLane): boolean {
  return playerLaneIndex(targetLane) > playerLaneIndex(sourceLane);
}
