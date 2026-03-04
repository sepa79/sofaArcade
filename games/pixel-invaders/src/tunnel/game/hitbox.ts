import {
  ENEMY_BULLET_HIT_ARC_PADDING,
  ENEMY_BULLET_HIT_DEPTH_PADDING,
  ENEMY_LARGE_ACTIVE_HEIGHT_PX,
  ENEMY_LARGE_ACTIVE_WIDTH_PX,
  ENEMY_LARGE_SCALE_MULTIPLIER,
  ENEMY_SPRITE_SCALE_FAR,
  ENEMY_SPRITE_SCALE_NEAR,
  ENEMY_STANDARD_ACTIVE_HEIGHT_PX,
  ENEMY_STANDARD_ACTIVE_WIDTH_PX,
  HIT_ARC_MIN,
  HIT_ARC_PER_SCREEN_PIXEL,
  HIT_DEPTH_MIN,
  HIT_DEPTH_PER_SCREEN_PIXEL,
  PLAYER_ACTIVE_HEIGHT_PX,
  PLAYER_ACTIVE_WIDTH_PX,
  PLAYER_BULLET_HIT_ARC_PADDING,
  PLAYER_BULLET_HIT_DEPTH_PADDING,
  PLAYER_SPRITE_SCALE
} from './constants';
import type { EnemyClass } from './types';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function enemyActiveSize(enemyClass: EnemyClass): { readonly width: number; readonly height: number } {
  if (enemyClass === 'large') {
    return {
      width: ENEMY_LARGE_ACTIVE_WIDTH_PX,
      height: ENEMY_LARGE_ACTIVE_HEIGHT_PX
    };
  }

  return {
    width: ENEMY_STANDARD_ACTIVE_WIDTH_PX,
    height: ENEMY_STANDARD_ACTIVE_HEIGHT_PX
  };
}

function enemyScaleAtDepth(enemyClass: EnemyClass, depth: number): number {
  const depthCurve = Math.pow(clamp01(depth), 0.55);
  const baseScale = lerp(ENEMY_SPRITE_SCALE_NEAR, ENEMY_SPRITE_SCALE_FAR, depthCurve);
  const multiplier = enemyClass === 'large' ? ENEMY_LARGE_SCALE_MULTIPLIER : 1;
  return baseScale * multiplier;
}

export function enemyHitArc(enemyClass: EnemyClass, depth: number): number {
  const scale = enemyScaleAtDepth(enemyClass, depth);
  const active = enemyActiveSize(enemyClass);
  return Math.max(
    HIT_ARC_MIN,
    active.width * scale * HIT_ARC_PER_SCREEN_PIXEL + PLAYER_BULLET_HIT_ARC_PADDING
  );
}

export function enemyHitDepthWindow(enemyClass: EnemyClass, depth: number): number {
  const scale = enemyScaleAtDepth(enemyClass, depth);
  const active = enemyActiveSize(enemyClass);
  return Math.max(
    HIT_DEPTH_MIN,
    active.height * scale * HIT_DEPTH_PER_SCREEN_PIXEL + PLAYER_BULLET_HIT_DEPTH_PADDING
  );
}

export function playerHitArc(): number {
  return Math.max(
    HIT_ARC_MIN,
    PLAYER_ACTIVE_WIDTH_PX * PLAYER_SPRITE_SCALE * HIT_ARC_PER_SCREEN_PIXEL + ENEMY_BULLET_HIT_ARC_PADDING
  );
}

export function playerHitDepthWindow(): number {
  return Math.max(
    HIT_DEPTH_MIN,
    PLAYER_ACTIVE_HEIGHT_PX * PLAYER_SPRITE_SCALE * HIT_DEPTH_PER_SCREEN_PIXEL + ENEMY_BULLET_HIT_DEPTH_PADDING
  );
}
