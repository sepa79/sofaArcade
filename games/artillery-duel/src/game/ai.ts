import { AI_ANGLE_STEP, AI_POWER_STEP, CPU_OPENING_ANGLE_BIAS_DEG, CPU_OPENING_POWER_BIAS, FIRE_POWER_MAX, FIRE_POWER_MIN, OUT_OF_BOUNDS_MARGIN, PLAYER_ONE_ANGLE_MAX, PLAYER_ONE_ANGLE_MIN, PLAYER_TWO_ANGLE_MAX, PLAYER_TWO_ANGLE_MIN, PROJECTILE_SUBSTEPS, TRAJECTORY_STEP_SEC, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { createProjectile, projectileHitsPlayer, stepProjectile } from './ballistics';
import { sampleTerrainHeight, tankHitCircleCenter } from './terrain';
import type { CpuAimPlan, PlayerState, TerrainState, TrajectoryResult } from './types';

function angleBoundsForPlayer(playerIndex: 0 | 1): { readonly min: number; readonly max: number } {
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

function simulateTrajectory(
  owner: PlayerState,
  target: PlayerState,
  terrain: TerrainState,
  angleDeg: number,
  power: number
): TrajectoryResult {
  let projectile = createProjectile({
    ...owner,
    angleDeg,
    power
  });
  const targetCenter = tankHitCircleCenter(target);
  let closestDistanceSq = Number.POSITIVE_INFINITY;

  for (let stepIndex = 0; stepIndex < 720; stepIndex += 1) {
    for (let substepIndex = 0; substepIndex < PROJECTILE_SUBSTEPS; substepIndex += 1) {
      projectile = stepProjectile(projectile, TRAJECTORY_STEP_SEC / PROJECTILE_SUBSTEPS);

      const deltaX = projectile.x - targetCenter.x;
      const deltaY = projectile.y - targetCenter.y;
      const distanceSq = deltaX * deltaX + deltaY * deltaY;
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
      }

      if (projectileHitsPlayer(projectile, target)) {
        return {
          directHit: true,
          closestDistanceSq: 0
        };
      }

      if (projectile.x >= 0 && projectile.x <= WORLD_WIDTH) {
        const terrainHeight = sampleTerrainHeight(terrain, projectile.x);
        if (projectile.y >= terrainHeight) {
          return {
            directHit: false,
            closestDistanceSq
          };
        }
      }

      if (
        projectile.x < -OUT_OF_BOUNDS_MARGIN ||
        projectile.x > WORLD_WIDTH + OUT_OF_BOUNDS_MARGIN ||
        projectile.y > WORLD_HEIGHT + OUT_OF_BOUNDS_MARGIN
      ) {
        return {
          directHit: false,
          closestDistanceSq
        };
      }
    }
  }

  return {
    directHit: false,
    closestDistanceSq
  };
}

export function computeCpuAimPlan(
  owner: PlayerState,
  target: PlayerState,
  terrain: TerrainState
): CpuAimPlan {
  const bounds = angleBoundsForPlayer(owner.index);
  let bestPlan: CpuAimPlan | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let angleDeg = bounds.min; angleDeg <= bounds.max; angleDeg += AI_ANGLE_STEP) {
    for (let power = FIRE_POWER_MIN; power <= FIRE_POWER_MAX; power += AI_POWER_STEP) {
      const result = simulateTrajectory(owner, target, terrain, angleDeg, power);
      if (result.directHit) {
        return { angleDeg, power };
      }

      if (result.closestDistanceSq < bestScore) {
        bestScore = result.closestDistanceSq;
        bestPlan = { angleDeg, power };
      }
    }
  }

  if (bestPlan === null) {
    throw new Error('CPU aim search produced no valid plan.');
  }

  return bestPlan;
}

export function applyOpeningCpuBias(plan: CpuAimPlan, ownerIndex: 0 | 1): CpuAimPlan {
  const bounds = angleBoundsForPlayer(ownerIndex);
  const signedAngleBias = ownerIndex === 0 ? CPU_OPENING_ANGLE_BIAS_DEG : -CPU_OPENING_ANGLE_BIAS_DEG;

  return {
    angleDeg: Math.max(bounds.min, Math.min(bounds.max, plan.angleDeg + signedAngleBias)),
    power: Math.max(FIRE_POWER_MIN, Math.min(FIRE_POWER_MAX, plan.power + CPU_OPENING_POWER_BIAS))
  };
}
