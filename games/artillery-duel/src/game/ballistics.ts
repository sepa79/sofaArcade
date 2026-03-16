import {
  GRAVITY_PER_SECOND,
  MUZZLE_HEIGHT_OFFSET,
  PROJECTILE_RADIUS,
  TANK_HIT_RADIUS,
  TANK_TURRET_LENGTH
} from './constants';
import { tankHitCircleCenter } from './terrain';
import type { PlayerState, ProjectileState } from './types';

function degreesToRadians(angleDeg: number): number {
  return (angleDeg * Math.PI) / 180;
}

export function createProjectile(owner: PlayerState): ProjectileState {
  const radians = degreesToRadians(owner.angleDeg);
  const muzzleX = owner.tankX + Math.cos(radians) * TANK_TURRET_LENGTH;
  const muzzleY = owner.tankY - MUZZLE_HEIGHT_OFFSET - Math.sin(radians) * TANK_TURRET_LENGTH;
  const speed = owner.power;
  return {
    ownerIndex: owner.index,
    x: muzzleX,
    y: muzzleY,
    velocityX: Math.cos(radians) * speed,
    velocityY: -Math.sin(radians) * speed
  };
}

export function stepProjectile(projectile: ProjectileState, deltaSec: number): ProjectileState {
  return {
    ...projectile,
    x: projectile.x + projectile.velocityX * deltaSec,
    y: projectile.y + projectile.velocityY * deltaSec,
    velocityY: projectile.velocityY + GRAVITY_PER_SECOND * deltaSec
  };
}

export function projectileHitsPlayer(projectile: ProjectileState, player: PlayerState): boolean {
  const center = tankHitCircleCenter(player);
  const deltaX = projectile.x - center.x;
  const deltaY = projectile.y - center.y;
  const radius = PROJECTILE_RADIUS + TANK_HIT_RADIUS;
  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
}
