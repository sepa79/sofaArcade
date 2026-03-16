import {
  AIM_SPEED_DEGREES_PER_SECOND,
  CPU_FIRE_DELAY_SEC,
  CRATER_DEPTH,
  CRATER_RADIUS,
  EXPLOSION_DURATION_SEC,
  EXPLOSION_RADIUS,
  FIRE_POWER_MAX,
  FIRE_POWER_MIN,
  FIRE_POWER_SPEED_PER_SECOND,
  OUT_OF_BOUNDS_MARGIN,
  PLAYER_ONE_ANGLE_MAX,
  PLAYER_ONE_ANGLE_MIN,
  PLAYER_TWO_ANGLE_MAX,
  PLAYER_TWO_ANGLE_MIN,
  PROJECTILE_SUBSTEPS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from './constants';
import { applyOpeningCpuBias, computeCpuAimPlan } from './ai';
import { createProjectile, projectileHitsPlayer, stepProjectile } from './ballistics';
import { anchorPlayersToTerrain, deformTerrain, sampleTerrainHeight } from './terrain';
import { restartState } from './state';
import type { ExplosionState, FrameInput, GameState, PlayerState, ProjectileState } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function angleBounds(playerIndex: 0 | 1): { readonly min: number; readonly max: number } {
  if (playerIndex === 0) {
    return {
      min: PLAYER_ONE_ANGLE_MIN,
      max: PLAYER_ONE_ANGLE_MAX
    };
  }

  return {
    min: PLAYER_TWO_ANGLE_MIN,
    max: PLAYER_TWO_ANGLE_MAX
  };
}

function activePlayer(state: GameState): PlayerState {
  const player = state.players[state.activePlayerIndex];
  if (player === undefined) {
    throw new Error(`Active player missing for index ${state.activePlayerIndex}.`);
  }

  return player;
}

function waitingPlayer(state: GameState): PlayerState {
  return state.players[state.activePlayerIndex === 0 ? 1 : 0];
}

function updatePlayerAim(player: PlayerState, input: FrameInput, deltaSec: number): PlayerState {
  const bounds = angleBounds(player.index);
  return {
    ...player,
    angleDeg: clamp(
      player.angleDeg + input.aimXSigned * AIM_SPEED_DEGREES_PER_SECOND * deltaSec,
      bounds.min,
      bounds.max
    ),
    power: clamp(
      player.power + input.powerYSigned * FIRE_POWER_SPEED_PER_SECOND * deltaSec,
      FIRE_POWER_MIN,
      FIRE_POWER_MAX
    )
  };
}

function replaceActivePlayer(state: GameState, player: PlayerState): GameState {
  const players: readonly [PlayerState, PlayerState] =
    player.index === 0 ? [player, state.players[1]] : [state.players[0], player];
  return {
    ...state,
    players
  };
}

function tickExplosion(explosion: ExplosionState | null, deltaSec: number): ExplosionState | null {
  if (explosion === null) {
    return null;
  }

  const remainingSec = explosion.remainingSec - deltaSec;
  if (remainingSec <= 0) {
    return null;
  }

  return {
    ...explosion,
    remainingSec
  };
}

function createExplosion(x: number, y: number): ExplosionState {
  return {
    x,
    y,
    radius: EXPLOSION_RADIUS,
    remainingSec: EXPLOSION_DURATION_SEC
  };
}

function nextPlayerIndex(activePlayerIndex: 0 | 1): 0 | 1 {
  return activePlayerIndex === 0 ? 1 : 0;
}

function armCpuTurn(state: GameState): GameState {
  const player = activePlayer(state);
  if (!player.isCpu) {
    return {
      ...state,
      cpuAimPlan: null,
      cpuFireDelaySec: 0
    };
  }

  const cpuAimPlan = computeCpuAimPlan(player, waitingPlayer(state), state.terrain);
  const adjustedPlan =
    state.mode === 'solo-ai' && state.activePlayerIndex === 1 && state.turnNumber === 2
      ? applyOpeningCpuBias(cpuAimPlan, player.index)
      : cpuAimPlan;

  return {
    ...state,
    cpuAimPlan: adjustedPlan,
    cpuFireDelaySec: CPU_FIRE_DELAY_SEC
  };
}

function switchTurns(state: GameState, terrain: GameState['terrain'], players: readonly [PlayerState, PlayerState], explosion: ExplosionState | null): GameState {
  const activePlayerIndex = nextPlayerIndex(state.activePlayerIndex);
  const nextState: GameState = {
    ...state,
    phase: 'aiming',
    terrain,
    players,
    activePlayerIndex,
    projectile: null,
    explosion,
    winnerIndex: null,
    turnNumber: state.turnNumber + 1,
    cpuAimPlan: null,
    cpuFireDelaySec: 0
  };
  return armCpuTurn(nextState);
}

function finishMatch(
  state: GameState,
  terrain: GameState['terrain'],
  players: readonly [PlayerState, PlayerState],
  winnerIndex: 0 | 1,
  explosion: ExplosionState
): GameState {
  return {
    ...state,
    phase: 'won',
    terrain,
    players,
    projectile: null,
    explosion,
    winnerIndex,
    cpuAimPlan: null,
    cpuFireDelaySec: 0
  };
}

function launchProjectile(state: GameState): GameState {
  const shooter = activePlayer(state);
  return {
    ...state,
    phase: 'projectile',
    projectile: createProjectile(shooter),
    cpuAimPlan: null,
    cpuFireDelaySec: 0
  };
}

function resolveExplosion(state: GameState, impactX: number, impactY: number): GameState {
  const terrain = deformTerrain(state.terrain, impactX, CRATER_RADIUS, CRATER_DEPTH);
  const players = anchorPlayersToTerrain(state.players, terrain);
  const explosion = createExplosion(impactX, impactY);
  const opponentIndex = nextPlayerIndex(state.activePlayerIndex);
  const opponentHit = distanceSq(players[opponentIndex], impactX, impactY) <= EXPLOSION_RADIUS * EXPLOSION_RADIUS;
  const activeHit = distanceSq(players[state.activePlayerIndex], impactX, impactY) <= EXPLOSION_RADIUS * EXPLOSION_RADIUS;

  if (opponentHit) {
    return finishMatch(state, terrain, players, state.activePlayerIndex, explosion);
  }

  if (activeHit) {
    return finishMatch(state, terrain, players, opponentIndex, explosion);
  }

  return switchTurns(state, terrain, players, explosion);
}

function distanceSq(player: PlayerState, x: number, y: number): number {
  const deltaX = player.tankX - x;
  const deltaY = (player.tankY - 3) - y;
  return deltaX * deltaX + deltaY * deltaY;
}

function stepProjectilePhase(state: GameState, deltaSec: number): GameState {
  if (state.projectile === null) {
    throw new Error('Projectile phase requires active projectile.');
  }

  let projectile: ProjectileState = state.projectile;
  const stepSec = deltaSec / PROJECTILE_SUBSTEPS;
  for (let substepIndex = 0; substepIndex < PROJECTILE_SUBSTEPS; substepIndex += 1) {
    projectile = stepProjectile(projectile, stepSec);

    const opponent = waitingPlayer(state);
    if (projectileHitsPlayer(projectile, opponent)) {
      return resolveExplosion(state, projectile.x, projectile.y);
    }

    if (projectile.x >= 0 && projectile.x <= WORLD_WIDTH) {
      const terrainHeight = sampleTerrainHeight(state.terrain, projectile.x);
      if (projectile.y >= terrainHeight) {
        return resolveExplosion(state, projectile.x, terrainHeight);
      }
    }

    if (
      projectile.x < -OUT_OF_BOUNDS_MARGIN ||
      projectile.x > WORLD_WIDTH + OUT_OF_BOUNDS_MARGIN ||
      projectile.y > WORLD_HEIGHT + OUT_OF_BOUNDS_MARGIN
    ) {
      return switchTurns(state, state.terrain, state.players, null);
    }
  }

  return {
    ...state,
    projectile,
    explosion: tickExplosion(state.explosion, deltaSec)
  };
}

function stepCpuAiming(state: GameState, deltaSec: number): GameState {
  const player = activePlayer(state);
  if (!player.isCpu) {
    throw new Error('CPU aiming step requires CPU active player.');
  }
  if (state.cpuAimPlan === null) {
    throw new Error('CPU aiming step requires cpuAimPlan.');
  }

  const aimedState = replaceActivePlayer(state, {
    ...player,
    angleDeg: state.cpuAimPlan.angleDeg,
    power: state.cpuAimPlan.power
  });
  const remainingDelay = state.cpuFireDelaySec - deltaSec;
  if (remainingDelay > 0) {
    return {
      ...aimedState,
      cpuFireDelaySec: remainingDelay,
      explosion: tickExplosion(state.explosion, deltaSec)
    };
  }

  return launchProjectile({
    ...aimedState,
    cpuFireDelaySec: 0
  });
}

export function stepGame(state: GameState, input: FrameInput, deltaSec: number): GameState {
  if (!Number.isFinite(deltaSec) || deltaSec <= 0) {
    throw new Error(`deltaSec must be a positive finite number, got ${deltaSec}.`);
  }

  if (state.phase === 'won') {
    if (input.firePressed || input.startPressed) {
      return restartState(state);
    }
    return {
      ...state,
      explosion: tickExplosion(state.explosion, deltaSec)
    };
  }

  if (state.phase === 'ready') {
    if (input.firePressed || input.startPressed) {
      return armCpuTurn({
        ...state,
        phase: 'aiming'
      });
    }
    return {
      ...state,
      explosion: tickExplosion(state.explosion, deltaSec)
    };
  }

  if (state.phase === 'projectile') {
    return stepProjectilePhase(state, deltaSec);
  }

  const player = activePlayer(state);
  if (player.isCpu) {
    if (state.cpuAimPlan === null) {
      return stepGame(armCpuTurn(state), input, deltaSec);
    }
    return stepCpuAiming(state, deltaSec);
  }

  const aimedState = replaceActivePlayer(state, updatePlayerAim(player, input, deltaSec));
  if (input.firePressed) {
    return launchProjectile(aimedState);
  }

  return {
    ...aimedState,
    explosion: tickExplosion(state.explosion, deltaSec)
  };
}
