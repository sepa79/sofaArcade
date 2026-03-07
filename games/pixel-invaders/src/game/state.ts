import { PLAYER_LIVES, PLAYER_WIDTH, WORLD_WIDTH } from './constants';
import { defaultPlayerLaneForIndex } from './player-lanes';
import type { GameState, PlayerState } from './types';
import { createInitialCampaignState, enemyBaseSpeedForCampaign, enemyFireIntervalForCampaign, spawnInitialClassicFormation } from './waves';

function createPlayers(playerCount: number): ReadonlyArray<PlayerState> {
  if (!Number.isInteger(playerCount) || playerCount <= 0) {
    throw new Error(`playerCount must be a positive integer, got ${playerCount}.`);
  }

  const centerX = WORLD_WIDTH / 2;
  const spacing = Math.min(220, Math.max(90, WORLD_WIDTH / (playerCount + 2)));

  return Array.from({ length: playerCount }, (_, playerIndex) => ({
    playerIndex,
    x: Math.max(
      PLAYER_WIDTH / 2,
      Math.min(
        WORLD_WIDTH - PLAYER_WIDTH / 2,
        centerX + (playerIndex - (playerCount - 1) / 2) * spacing
      )
    ),
    lives: PLAYER_LIVES,
    respawnTimer: 0,
    shootTimer: 0,
    lane: defaultPlayerLaneForIndex(playerIndex),
    recentMovementMomentum: 0,
    pushbackVelocityX: 0,
    score: 0,
    hitStreak: 0,
    scoreMultiplier: 1,
    activePowerups: []
  }));
}

export function createInitialState(seed: number, playerCount: number): GameState {
  const campaign = createInitialCampaignState();
  const initialFormation = spawnInitialClassicFormation(seed);

  return {
    phase: 'ready',
    elapsedTimeSec: 0,
    campaign,
    players: createPlayers(playerCount),
    enemyDirection: 1,
    enemySpeed: enemyBaseSpeedForCampaign(campaign),
    enemyFireTimer: enemyFireIntervalForCampaign(campaign),
    enemyDiveTimer: Number.POSITIVE_INFINITY,
    rngSeed: initialFormation.rngSeed,
    enemies: initialFormation.enemies,
    bullets: [],
    pickups: [],
    nextPickupId: 0,
    pendingRowRespawns: []
  };
}
