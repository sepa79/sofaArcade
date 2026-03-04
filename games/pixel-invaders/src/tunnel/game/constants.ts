export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 720;

export const TAU = Math.PI * 2;
export const FIXED_TIMESTEP = 1 / 60;

export const TUNNEL_OUTER_RADIUS = 276;
export const TUNNEL_INNER_RADIUS = 76;

export const PLAYER_LIVES = 3;
export const PLAYER_ANGULAR_SPEED = 2.45;
export const PLAYER_INVULNERABILITY = 1.0;
export const PLAYER_SHOOT_COOLDOWN = 0.14;
export const PLAYER_JUMP_DURATION = 0.2;
export const PLAYER_JUMP_COOLDOWN = 0.35;

// Active alpha bounds measured from sprites:
// player 24x21, enemy_standard 24x21, enemy_large 40x25.
export const PLAYER_ACTIVE_WIDTH_PX = 24;
export const PLAYER_ACTIVE_HEIGHT_PX = 21;
export const ENEMY_STANDARD_ACTIVE_WIDTH_PX = 24;
export const ENEMY_STANDARD_ACTIVE_HEIGHT_PX = 21;
export const ENEMY_LARGE_ACTIVE_WIDTH_PX = 40;
export const ENEMY_LARGE_ACTIVE_HEIGHT_PX = 25;

export const PLAYER_SPRITE_SCALE = 2.1;
export const ENEMY_SPRITE_SCALE_NEAR = 2.1;
export const ENEMY_SPRITE_SCALE_FAR = 0.14;
export const ENEMY_LARGE_SCALE_MULTIPLIER = 1;

export const HIT_ARC_PER_SCREEN_PIXEL = 0.00105;
export const HIT_DEPTH_PER_SCREEN_PIXEL = 0.00045;
export const HIT_ARC_MIN = 0.006;
export const HIT_DEPTH_MIN = 0.01;
export const PLAYER_BULLET_HIT_ARC_PADDING = 0.004;
export const PLAYER_BULLET_HIT_DEPTH_PADDING = 0.006;
export const ENEMY_BULLET_HIT_ARC_PADDING = 0.005;
export const ENEMY_BULLET_HIT_DEPTH_PADDING = 0.004;

export const BULLET_DEPTH_SPEED = 0.95;
export const BULLET_LIFETIME = 1.2;
export const ENEMY_BULLET_DEPTH_SPEED = 0.7;
export const ENEMY_BULLET_LIFETIME = 1.3;

export const ENEMY_COUNT = 12;
export const ENEMY_ANGULAR_SPEED = 0.37;
export const ENEMY_DEPTH_SPEED = 0.11;
export const ENEMY_DIRECTION_SWITCH_INTERVAL = 3.8;
export const ENEMY_SHOOT_INTERVAL = 1.2;
export const ENEMY_BEHIND_DESPAWN_DEPTH = -0.72;
export const ENEMY_REINFORCEMENT_COUNT = 2;
export const ENEMY_REINFORCEMENT_THETA_OFFSET = 0.12;
export const ENEMY_REINFORCEMENT_BASE_DEPTH = 1.14;
export const ENEMY_REINFORCEMENT_DEPTH_STEP = 0.08;
export const ENEMY_SPIRAL_SPAWN_THETA = (3 * Math.PI) / 2;
export const ENEMY_SPIRAL_DEPTH_ACCEL = 1.15;
export const ENEMY_SPIRAL_SWAY_AMPLITUDE = 0.22;
export const ENEMY_SPIRAL_SWAY_FREQUENCY = 2.8;
export const ENEMY_STANDARD_HP = 1;
export const ENEMY_LARGE_HP = 4;

export const SCORE_PER_ENEMY = 100;
