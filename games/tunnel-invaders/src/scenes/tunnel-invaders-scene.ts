import Phaser from 'phaser';
import { RetroSfx, type AudioMixProfileId } from '@light80/game-sdk';

import {
  FIXED_TIMESTEP,
  PLAYER_SHIELD_MAX,
  PLAYER_SPRITE_SCALE,
  PLAYER_RESPAWN_ENTRY_DURATION,
  ENEMY_SPRITE_SCALE_FAR,
  ENEMY_SPRITE_SCALE_NEAR,
  ENEMY_LARGE_SCALE_MULTIPLIER,
  TAU,
  TUNNEL_INNER_RADIUS,
  TUNNEL_OUTER_RADIUS
} from '../game/constants';
import backgroundMusicTrack from '../assets/game-bgm.mp3';
import { enemyHitArc, enemyHitDepthWindow, playerHitArc, playerHitDepthWindow } from '../game/hitbox';
import { createInputContext, readFrameInput } from '../game/input';
import { stepGame } from '../game/logic';
import { createInitialState } from '../game/state';
import explosionSrc1Image from '../assets/explosion_src_1.png';
import explosionSrc2Image from '../assets/explosion_src_2.png';
import asteroidSpriteImage from '../assets/sprite_asteroid_1.png';
import enemyFighterImage from '../assets/sprite_enemy_1.png';
import enemyFighterImageAlt from '../assets/sprite_enemy_2.png';
import enemyLargeImage from '../assets/sprite_enemy_3.png';
import fighterShipAltImage from '../assets/sprite_player_1a.png';
import fighterShipImage from '../assets/sprite_player_1.png';
import type { InputContext } from '../game/input';
import type { Bullet, Enemy, GameState, TunnelPhase } from '../game/types';

export const TUNNEL_INVADERS_SCENE_KEY = 'tunnel-invaders';
const PLAYER_SPRITE_KEY = 'tunnel-player-ship';
const PLAYER_SPRITE_ALT_KEY = 'tunnel-player-ship-alt';
const ENEMY_SPRITE_KEY = 'tunnel-enemy-ship';
const ENEMY_SPRITE_ALT_KEY = 'tunnel-enemy-ship-alt';
const ENEMY_LARGE_SPRITE_KEY = 'tunnel-enemy-ship-large';
const ASTEROID_SPRITE_KEY = 'tunnel-asteroid';
const EXPLOSION_TEXTURE_KEY_1 = 'tunnel-explosion-1';
const EXPLOSION_TEXTURE_KEY_2 = 'tunnel-explosion-2';
const EXPLOSION_ANIM_KEY_1 = 'tunnel-explosion-anim-1';
const EXPLOSION_ANIM_KEY_2 = 'tunnel-explosion-anim-2';
const BACKGROUND_MUSIC_KEY = 'tunnel-invaders-background-music';
const BACKGROUND_MUSIC_VOLUME = 0.42;

const WORM_DRIFT_CAP_X = 18;
const WORM_DRIFT_CAP_Y = 16;
const OUTER_DRIFT_INFLUENCE = 0.2;
const TWIST_BASE_AMP = 0.08;
const TWIST_WAVE_AMP = 0.04;
const TUNNEL_RING_COUNT = 64;
const TUNNEL_STARS_PER_RING = 20;
const TUNNEL_FLOW_SPEED = 0.24;
const TUNNEL_STAR_SIZE_SCALE = 0.48;
const DEBUG_TUNING_ENABLED = true;
const PIXEL_OFFSET_MIN = -3;
const PIXEL_OFFSET_MAX = 4;
const FLOW_SPEED_MIN = 0.05;
const FLOW_SPEED_MAX = 0.8;
const FLOW_SPEED_STEP = 0.02;
const TWIST_SCALE_MIN = 0;
const TWIST_SCALE_MAX = 2;
const TWIST_SCALE_STEP = 0.05;
const DEPTH_SCALE_DEFAULT = 1;
const DEPTH_SCALE_DEEP = 20;
const DEPTH_SCALE_MAX = 50;
const DEPTH_SCALE_STEP = 0.5;
const DEPTH_CAMERA_NEAR = 8;
const PLAYER_EDGE_MARGIN_RATIO = 0.15;
const STAR_OUTER_SPILL_STRENGTH = 0.28;
const STAR_OUTER_SPILL_EXPONENT = 1.35;
const STAR_BEHIND_DEPTH_RANGE = 0.65;
const STAR_BEHIND_RADIUS_SCALE = 1.1;
const STAR_LAYER_COUNT = 3;
const STAR_LAYER_FLOW_SCALE: readonly [number, number, number] = [0.72, 1, 1.34];
const STAR_LAYER_ALPHA_SCALE: readonly [number, number, number] = [0.62, 0.84, 1];
const STAR_LAYER_SIZE_SCALE: readonly [number, number, number] = [0.76, 1, 1.22];
const STAR_LAYER_JITTER_SCALE: readonly [number, number, number] = [0.88, 1, 1.14];
const DEBUG_RING_AHEAD_COUNT = 28;
const DEBUG_RING_BEHIND_COUNT = 7;
const DEBUG_RING_BEYOND_COUNT = 4;
const CRT_SCANLINE_STEP = 3;
const CRT_SCANLINE_ALPHA = 0.08;
const CRT_VIGNETTE_BANDS = 8;
const CRT_VIGNETTE_BAND_THICKNESS_RATIO = 0.008;
const CRT_VIGNETTE_ALPHA_MAX = 0.16;
const HIT_FLASH_DECAY_PER_SECOND = 2.8;
const HIT_FLASH_ENEMY = 0.09;
const HIT_FLASH_PLAYER = 0.2;
const HIT_SHAKE_ENEMY_DURATION_MS = 85;
const HIT_SHAKE_ENEMY_INTENSITY = 0.0018;
const HIT_SHAKE_PLAYER_DURATION_MS = 190;
const HIT_SHAKE_PLAYER_INTENSITY = 0.0048;
const EXPLOSION_FRAME_WIDTH = 24;
const EXPLOSION_FRAME_HEIGHT = 21;
const EXPLOSION_FRAME_COUNT = 10;
const EXPLOSION_ANIMATION_RATE = 28;
const EXPLOSION_SCALE_NEAR = 1.5;
const EXPLOSION_SCALE_FAR = 0.95;
const EXPLOSION_GLOW_DURATION_MS = 260;
const EXPLOSION_GLOW_RADIUS_NEAR = 44;
const EXPLOSION_GLOW_RADIUS_FAR = 26;
const ASTEROID_SPRITE_SCALE_NEAR = 2;
const ASTEROID_SPRITE_SCALE_FAR = 0.22;
const CAMERA_ZOOM_DEFAULT = 1;
const CAMERA_ZOOM_OUT = 0.72;
const CAMERA_ZOOM_SPEED = 1.8;
const CAMERA_ZOOM_DEPTH_THRESHOLD = -0.02;
const PLAYER_SPRITE_SCALE_JUMP = 2.46;
const INNER_RADIUS_RATIO = TUNNEL_INNER_RADIUS / TUNNEL_OUTER_RADIUS;
const ENEMY_BULLET_CORE_SIZE_NEAR = 5.2;
const ENEMY_BULLET_CORE_SIZE_FAR = 2.8;
const ENEMY_BULLET_SMOKE_HEAD_SCALE = 1.22;
const ENEMY_BULLET_SMOKE_TAIL_SCALE = 1.08;
const ENEMY_BULLET_TRAIL_DEPTH = 0.08;
const CENTER_ANOMALY_CORE_RATIO = 0.56;
const CENTER_ANOMALY_RING_RATIO = 1.28;
const CENTER_ANOMALY_RING_THICKNESS_RATIO = 0.16;
const CENTER_ANOMALY_SWIRL_SEGMENTS = 40;
const PLAYER_DEATH_CLUSTER_DURATION_MS = 920;
const PLAYER_DEATH_CLUSTER_BURST_INTERVAL_MS = 95;
const PLAYER_DEATH_CLUSTER_BURST_COUNT = 3;
const PLAYER_DEATH_CLUSTER_THETA_JITTER = 0.24;
const PLAYER_DEATH_CLUSTER_DEPTH_JITTER = 0.11;
const PLAYER_RESPAWN_DEPTH_START = -0.38;

interface RenderFrame {
  readonly timeSeconds: number;
  readonly driftX: number;
  readonly driftY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly baseCenterX: number;
  readonly baseCenterY: number;
  readonly outerRadiusX: number;
  readonly outerRadiusY: number;
  readonly innerRadiusX: number;
  readonly innerRadiusY: number;
}

interface RenderCenter {
  readonly x: number;
  readonly y: number;
}

interface RenderRadius {
  readonly x: number;
  readonly y: number;
}

interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly pixelSize: number;
  readonly centerX: number;
  readonly centerY: number;
}

interface TunnelStar {
  readonly ringIndex: number;
  readonly layer: 0 | 1 | 2;
  readonly theta: number;
  readonly radialJitter: number;
  readonly alpha: number;
  readonly sizeScale: number;
}

interface ExplosionGlowFx {
  readonly theta: number;
  readonly depth: number;
  readonly startAtMs: number;
}

interface PlayerDeathCluster {
  readonly theta: number;
  readonly remainingMs: number;
  readonly burstTimerMs: number;
}

interface RenderTuning {
  readonly pixelOffset: number;
  readonly flowSpeed: number;
  readonly twistScale: number;
  readonly depthScale: number;
}

interface DebugKeys {
  readonly pixelDown: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly pixelUp: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly flowDown: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly flowUp: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly twistDown: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly twistUp: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly depthDown: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly depthUp: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly nextMixProfile: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly toggleRings: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly toggleHitboxes: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly toggleOverlay: ReadonlyArray<Phaser.Input.Keyboard.Key>;
}

const DEFAULT_RENDER_TUNING: RenderTuning = {
  pixelOffset: -1,
  flowSpeed: TUNNEL_FLOW_SPEED,
  twistScale: 0.25,
  depthScale: DEPTH_SCALE_DEEP
};

export interface TunnelInvadersSceneData {
  readonly controllerProfileId: string;
  readonly controllerLabel: string;
  readonly audioMixProfileId: AudioMixProfileId;
}

function requireKeyboard(scene: Phaser.Scene): Phaser.Input.Keyboard.KeyboardPlugin {
  if (scene.input.keyboard === undefined || scene.input.keyboard === null) {
    throw new Error('Phaser keyboard plugin is required for Tunnel Invaders scene.');
  }

  return scene.input.keyboard;
}

function parseSceneData(rawData: unknown): TunnelInvadersSceneData {
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Tunnel Invaders scene requires launch data object.');
  }

  const data = rawData as Record<string, unknown>;
  if (typeof data.controllerProfileId !== 'string' || data.controllerProfileId.trim().length === 0) {
    throw new Error('Tunnel Invaders scene requires a valid controllerProfileId.');
  }

  if (typeof data.controllerLabel !== 'string' || data.controllerLabel.trim().length === 0) {
    throw new Error('Tunnel Invaders scene requires a valid controllerLabel.');
  }

  if (
    data.audioMixProfileId !== 'cinema' &&
    data.audioMixProfileId !== 'arcade' &&
    data.audioMixProfileId !== 'late-night'
  ) {
    throw new Error('Tunnel Invaders scene requires a valid audioMixProfileId.');
  }

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel,
    audioMixProfileId: data.audioMixProfileId
  };
}

function phaseMessage(phase: TunnelPhase): string {
  if (phase === 'ready') {
    return 'PRESS ENTER TO START';
  }

  if (phase === 'paused') {
    return 'PAUSED\nPRESS ESC OR SELECT';
  }

  if (phase === 'won') {
    return 'SECTOR CLEARED\nPRESS ENTER TO RESTART';
  }

  if (phase === 'lost') {
    return 'BREACH AT TUNNEL EDGE\nPRESS ENTER TO RESTART';
  }

  return '';
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function thetaToStereoPan(theta: number): number {
  return Math.max(-1, Math.min(1, Math.cos(theta)));
}

function depthToRadius(depth: number, frame: RenderFrame): RenderRadius {
  return {
    x: frame.outerRadiusX - depth * (frame.outerRadiusX - frame.innerRadiusX),
    y: frame.outerRadiusY - depth * (frame.outerRadiusY - frame.innerRadiusY)
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function snapToGrid(value: number, pixelSize: number): number {
  if (!Number.isInteger(pixelSize) || pixelSize <= 0) {
    throw new Error(`pixelSize must be positive integer, got ${pixelSize}.`);
  }

  return Math.round(value / pixelSize) * pixelSize;
}

function pixelSizeForDepth(depth: number, pixelOffset: number): number {
  const clampedDepth = clamp01(depth);
  const farSize = Math.max(1, 2 + pixelOffset);
  const midSize = Math.max(farSize, 3 + pixelOffset);
  const nearSize = Math.max(midSize, 4 + pixelOffset);

  if (clampedDepth >= 2 / 3) {
    return farSize;
  }

  if (clampedDepth >= 1 / 3) {
    return midSize;
  }

  return nearSize;
}

function computeRenderFrame(
  timeSeconds: number,
  viewportWidth: number,
  viewportHeight: number,
  cameraZoom: number
): RenderFrame {
  const driftX = Math.sin(timeSeconds * 0.74) * 12 + Math.sin(timeSeconds * 1.23 + 0.7) * 6;
  const driftY = Math.cos(timeSeconds * 0.82 + 0.2) * 10 + Math.sin(timeSeconds * 1.36 + 1.1) * 5;
  const baseCenterX = viewportWidth / 2;
  const baseCenterY = viewportHeight / 2;
  const edgeMarginX = baseCenterX * PLAYER_EDGE_MARGIN_RATIO;
  const edgeMarginY = baseCenterY * PLAYER_EDGE_MARGIN_RATIO;
  const outerRadiusX = Math.max(32, (baseCenterX - edgeMarginX) * cameraZoom);
  const outerRadiusY = Math.max(32, (baseCenterY - edgeMarginY) * cameraZoom);
  const innerRadiusX = Math.max(18, outerRadiusX * INNER_RADIUS_RATIO);
  const innerRadiusY = Math.max(18, outerRadiusY * INNER_RADIUS_RATIO);

  return {
    timeSeconds,
    driftX: Math.max(-WORM_DRIFT_CAP_X, Math.min(WORM_DRIFT_CAP_X, driftX)),
    driftY: Math.max(-WORM_DRIFT_CAP_Y, Math.min(WORM_DRIFT_CAP_Y, driftY)),
    viewportWidth,
    viewportHeight,
    baseCenterX,
    baseCenterY,
    outerRadiusX,
    outerRadiusY,
    innerRadiusX,
    innerRadiusY
  };
}

function centerForDepth(depth: number, frame: RenderFrame): RenderCenter {
  const clampedDepth = clamp01(depth);
  const depthInfluence = OUTER_DRIFT_INFLUENCE + (1 - OUTER_DRIFT_INFLUENCE) * Math.pow(clampedDepth, 1.45);

  return {
    x: frame.baseCenterX + frame.driftX * depthInfluence,
    y: frame.baseCenterY + frame.driftY * depthInfluence
  };
}

function depthTwist(depth: number, timeSeconds: number, twistScale: number): number {
  const clampedDepth = clamp01(depth);
  return (
    TWIST_BASE_AMP * twistScale * clampedDepth +
    TWIST_WAVE_AMP * twistScale * clampedDepth * Math.sin(timeSeconds * 3.2 + clampedDepth * TAU * 2.3)
  );
}

function wrapUnit(value: number): number {
  const remainder = value % 1;
  return remainder < 0 ? remainder + 1 : remainder;
}

function mapDepthForPerspective(depth: number, depthScale: number): number {
  const clampedScale = Math.max(DEPTH_SCALE_DEFAULT, depthScale);
  const zNear = DEPTH_CAMERA_NEAR;
  const zFar = zNear + clampedScale;
  const z = zNear + depth * clampedScale;
  const invNear = 1 / zNear;
  const invFar = 1 / zFar;
  const invDepth = 1 / z;

  return (invNear - invDepth) / (invNear - invFar);
}

function ringDepthAt(ringIndex: number, timeSeconds: number, flowSpeed: number): number {
  const totalRange = 1 + STAR_BEHIND_DEPTH_RANGE;
  const normalized = ringIndex / TUNNEL_RING_COUNT;
  return wrapUnit(normalized - timeSeconds * flowSpeed) * totalRange - STAR_BEHIND_DEPTH_RANGE;
}

function createTunnelStars(): ReadonlyArray<TunnelStar> {
  const rng = new Phaser.Math.RandomDataGenerator(['tunnel-stars-v2']);
  const stars: TunnelStar[] = [];

  for (let ringIndex = 0; ringIndex < TUNNEL_RING_COUNT; ringIndex += 1) {
    for (let starIndex = 0; starIndex < TUNNEL_STARS_PER_RING; starIndex += 1) {
      const layer = (starIndex % STAR_LAYER_COUNT) as 0 | 1 | 2;
      stars.push({
        ringIndex,
        layer,
        theta: rng.frac() * TAU,
        radialJitter: rng.realInRange(-5, 5) * STAR_LAYER_JITTER_SCALE[layer],
        alpha: rng.realInRange(0.45, 0.95) * STAR_LAYER_ALPHA_SCALE[layer],
        sizeScale: rng.realInRange(0.75, 1.05) * STAR_LAYER_SIZE_SCALE[layer]
      });
    }
  }

  return stars;
}

function projectPolar(
  theta: number,
  depth: number,
  frame: RenderFrame,
  tuning: RenderTuning,
  radiusOffset = 0
): ProjectedPoint {
  return projectPolarInternal(theta, depth, frame, tuning, radiusOffset, true);
}

function projectPolarSmooth(
  theta: number,
  depth: number,
  frame: RenderFrame,
  tuning: RenderTuning,
  radiusOffset = 0
): ProjectedPoint {
  return projectPolarInternal(theta, depth, frame, tuning, radiusOffset, false);
}

function projectPolarInternal(
  theta: number,
  depth: number,
  frame: RenderFrame,
  tuning: RenderTuning,
  radiusOffset: number,
  snap: boolean
): ProjectedPoint {
  const projectedDepth = mapDepthForPerspective(depth < 0 ? 0 : depth, tuning.depthScale);
  const pixelSize = pixelSizeForDepth(projectedDepth, tuning.pixelOffset);
  const center = centerForDepth(projectedDepth, frame);
  const radius = depthToRadius(projectedDepth, frame);
  const behindDepth = depth < 0 ? -depth : 0;
  const behindRadiusOffset =
    behindDepth * Math.min(frame.viewportWidth, frame.viewportHeight) * STAR_BEHIND_RADIUS_SCALE;
  const radiusX = radius.x + radiusOffset + behindRadiusOffset;
  const radiusY = radius.y + radiusOffset + behindRadiusOffset;
  const renderTheta = theta + depthTwist(projectedDepth, frame.timeSeconds, tuning.twistScale);

  const x = center.x + Math.cos(renderTheta) * radiusX;
  const y = center.y + Math.sin(renderTheta) * radiusY;

  return {
    x: snap ? snapToGrid(x, pixelSize) : x,
    y: snap ? snapToGrid(y, pixelSize) : y,
    pixelSize,
    centerX: center.x,
    centerY: center.y
  };
}

function quantizeSize(size: number, pixelSize: number): number {
  return Math.max(pixelSize, Math.round(size / pixelSize) * pixelSize);
}

function applyOuterSpill(
  point: ProjectedPoint,
  depth: number,
  frame: RenderFrame,
  pixelSize: number
): { readonly x: number; readonly y: number } {
  const vecX = point.x - point.centerX;
  const vecY = point.y - point.centerY;
  const radius = Math.hypot(vecX, vecY);
  if (radius === 0) {
    return {
      x: point.x,
      y: point.y
    };
  }

  const dirX = vecX / radius;
  const dirY = vecY / radius;
  const spillFactor = Math.pow(1 - clamp01(depth), STAR_OUTER_SPILL_EXPONENT);
  const spill =
    Math.min(frame.viewportWidth, frame.viewportHeight) * spillFactor * STAR_OUTER_SPILL_STRENGTH;
  const extendedRadius = radius + spill;

  return {
    x: snapToGrid(point.centerX + dirX * extendedRadius, pixelSize),
    y: snapToGrid(point.centerY + dirY * extendedRadius, pixelSize)
  };
}

function justDownAny(keys: ReadonlyArray<Phaser.Input.Keyboard.Key>): boolean {
  for (const key of keys) {
    if (Phaser.Input.Keyboard.JustDown(key)) {
      return true;
    }
  }

  return false;
}

function isLargeEnemy(enemyClass: Enemy['enemyClass']): boolean {
  return enemyClass === 'large';
}

function enemySpriteKeyFor(enemy: Enemy): string {
  if (isLargeEnemy(enemy.enemyClass)) {
    return ENEMY_LARGE_SPRITE_KEY;
  }

  return enemy.formationRow % 2 === 0 ? ENEMY_SPRITE_KEY : ENEMY_SPRITE_ALT_KEY;
}

export class TunnelInvadersScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private crtOverlay!: Phaser.GameObjects.Graphics;
  private hitFlashOverlay!: Phaser.GameObjects.Rectangle;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private asteroidSprites = new Map<number, Phaser.GameObjects.Image>();
  private tunnelStars: ReadonlyArray<TunnelStar> = [];
  private hudText!: Phaser.GameObjects.Text;
  private debugText: Phaser.GameObjects.Text | null = null;
  private debugKeys: DebugKeys | null = null;
  private debugOverlayVisible = DEBUG_TUNING_ENABLED;
  private debugRingsVisible = false;
  private debugHitboxesVisible = false;
  private readonly sfx = new RetroSfx();
  private explosionGlows: ReadonlyArray<ExplosionGlowFx> = [];
  private backgroundMusic: Phaser.Sound.BaseSound | null = null;
  private renderTuning: RenderTuning = DEFAULT_RENDER_TUNING;
  private hintText!: Phaser.GameObjects.Text;
  private inputContext!: InputContext;
  private state: GameState = createInitialState();
  private accumulator = 0;
  private cameraZoom = CAMERA_ZOOM_DEFAULT;
  private hitFlashAlpha = 0;
  private crtOverlayWidth = -1;
  private crtOverlayHeight = -1;
  private launchData: TunnelInvadersSceneData | null = null;
  private playerDeathCluster: PlayerDeathCluster | null = null;

  constructor() {
    super(TUNNEL_INVADERS_SCENE_KEY);
  }

  preload(): void {
    this.load.image(PLAYER_SPRITE_KEY, fighterShipImage);
    this.load.image(PLAYER_SPRITE_ALT_KEY, fighterShipAltImage);
    this.load.image(ENEMY_SPRITE_KEY, enemyFighterImage);
    this.load.image(ENEMY_SPRITE_ALT_KEY, enemyFighterImageAlt);
    this.load.image(ENEMY_LARGE_SPRITE_KEY, enemyLargeImage);
    this.load.image(ASTEROID_SPRITE_KEY, asteroidSpriteImage);
    this.load.audio(BACKGROUND_MUSIC_KEY, backgroundMusicTrack);
    this.load.spritesheet(EXPLOSION_TEXTURE_KEY_1, explosionSrc1Image, {
      frameWidth: EXPLOSION_FRAME_WIDTH,
      frameHeight: EXPLOSION_FRAME_HEIGHT,
      endFrame: EXPLOSION_FRAME_COUNT - 1
    });
    this.load.spritesheet(EXPLOSION_TEXTURE_KEY_2, explosionSrc2Image, {
      frameWidth: EXPLOSION_FRAME_WIDTH,
      frameHeight: EXPLOSION_FRAME_HEIGHT,
      endFrame: EXPLOSION_FRAME_COUNT - 1
    });
  }

  init(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
  }

  create(): void {
    if (this.launchData === null) {
      throw new Error('Tunnel Invaders launchData is missing in create().');
    }

    this.sfx.setMixProfile(this.launchData.audioMixProfileId);

    this.graphics = this.add.graphics();
    this.crtOverlay = this.add.graphics();
    this.crtOverlay.setDepth(10_000);
    this.hitFlashOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0)
      .setOrigin(0, 0)
      .setDepth(10_001);
    this.playerSprite = this.add.image(this.scale.width / 2, this.scale.height / 2, PLAYER_SPRITE_KEY);
    this.playerSprite.setOrigin(0.5, 0.5);
    this.playerSprite.setScale(PLAYER_SPRITE_SCALE);
    this.tunnelStars = createTunnelStars();

    for (const enemy of this.state.enemies) {
      const spriteKey = enemySpriteKeyFor(enemy);
      const sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, spriteKey);
      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(ENEMY_SPRITE_SCALE_FAR);
      this.enemySprites.set(enemy.id, sprite);
    }

    for (const asteroid of this.state.asteroids) {
      const sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, ASTEROID_SPRITE_KEY);
      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(ASTEROID_SPRITE_SCALE_FAR);
      this.asteroidSprites.set(asteroid.id, sprite);
    }
    this.setupExplosionAnimations();

    this.hudText = this.add.text(20, 18, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      color: '#f4f7ff'
    });

    this.add.text(20, 52, `CTRL ${this.launchData.controllerLabel}`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '18px',
      color: '#90f0ff'
    });

    this.hintText = this.add.text(this.scale.width / 2, this.scale.height / 2, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '34px',
      color: '#ffe4a8',
      align: 'center'
    });
    this.hintText.setOrigin(0.5, 0.5);

    if (DEBUG_TUNING_ENABLED) {
      const keyboard = requireKeyboard(this);
      this.debugKeys = {
        pixelDown: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NINE)
        ],
        pixelUp: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO)
        ],
        flowDown: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
        ],
        flowUp: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
        ],
        twistDown: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.COMMA),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
        ],
        twistUp: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PERIOD),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X)
        ],
        depthDown: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN)
        ],
        depthUp: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_UP)
        ],
        nextMixProfile: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M)],
        toggleRings: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)],
        toggleHitboxes: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H)],
        toggleOverlay: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1)]
      };

      this.debugText = this.add.text(20, this.scale.height - 88, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '16px',
        color: '#9be7ff'
      });
      this.debugText.setVisible(this.debugOverlayVisible);
    }

    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);
    this.cameras.main.setBackgroundColor('#000000');
    this.refreshCrtOverlay();
    this.initializeBackgroundMusic();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopBackgroundMusic();
      this.sfx.shutdown();
    });
  }

  update(_: number, delta: number): void {
    this.applyDebugHotkeys();
    this.accumulator += delta / 1000;
    let enemyHit = false;
    let shieldHit = false;
    let playerHit = false;
    let playerShot = false;
    let enemyShot = false;
    let won = false;
    let lost = false;
    const destroyedEnemies: Enemy[] = [];
    let playerExplosionTheta: number | null = null;
    let playerShotTheta: number | null = null;
    let enemyShotSpatial: { readonly theta: number; readonly depth: number } | null = null;
    let maxMoveSpeed = 0;
    let playerDeathTriggered = false;

    while (this.accumulator >= FIXED_TIMESTEP) {
      const input = readFrameInput(this.inputContext);
      maxMoveSpeed = Math.max(maxMoveSpeed, Math.abs(input.moveXSigned));
      if (
        input.startPressed ||
        input.pausePressed ||
        input.jumpPressed ||
        input.fireHeld ||
        input.moveXSigned !== 0
      ) {
        this.ensureFullscreenOnInteraction();
        this.startBackgroundMusic();
        this.sfx.unlock();
      }

      const prevState = this.state;
      const nextState = stepGame(this.state, input, FIXED_TIMESTEP);
      const prevPlayerBullets = prevState.bullets.filter((bullet) => bullet.owner === 'player').length;
      const nextPlayerBullets = nextState.bullets.filter((bullet) => bullet.owner === 'player').length;
      const prevEnemyBullets = prevState.bullets.filter((bullet) => bullet.owner === 'enemy').length;
      const nextEnemyBullets = nextState.bullets.filter((bullet) => bullet.owner === 'enemy').length;
      enemyHit = enemyHit || nextState.score > prevState.score;
      shieldHit = shieldHit || nextState.playerShield < prevState.playerShield;
      playerHit = playerHit || nextState.lives < prevState.lives;
      if (nextPlayerBullets > prevPlayerBullets) {
        playerShot = true;
        playerShotTheta = nextState.playerTheta;
      }
      if (nextEnemyBullets > prevEnemyBullets) {
        enemyShot = true;
        const newestEnemyBullet = nextState.bullets.reduce<Bullet | null>((current, bullet) => {
          if (bullet.owner !== 'enemy') {
            return current;
          }

          if (current === null || bullet.ttl > current.ttl) {
            return bullet;
          }

          return current;
        }, null);
        if (newestEnemyBullet !== null) {
          enemyShotSpatial = {
            theta: newestEnemyBullet.theta,
            depth: clamp01(newestEnemyBullet.depth)
          };
        }
      }
      won = won || (prevState.phase === 'playing' && nextState.phase === 'won');
      lost = lost || (prevState.phase === 'playing' && nextState.phase === 'lost');
      if (nextState.lives < prevState.lives) {
        playerExplosionTheta = prevState.playerTheta;
      }
      if (prevState.playerDeathTimer === 0 && nextState.playerDeathTimer > 0) {
        playerDeathTriggered = true;
      }

      for (const prevEnemy of prevState.enemies) {
        const nextEnemy = nextState.enemies.find((enemy) => enemy.id === prevEnemy.id);
        if (prevEnemy.alive && nextEnemy !== undefined && !nextEnemy.alive) {
          destroyedEnemies.push(prevEnemy);
        }
      }

      this.state = nextState;
      this.accumulator -= FIXED_TIMESTEP;
    }

    if (playerShot) {
      this.sfx.playPlayerShot({
        pan: thetaToStereoPan(playerShotTheta ?? this.state.playerTheta),
        depth: 0
      });
    }
    if (enemyShot && enemyShotSpatial !== null) {
      this.sfx.playEnemyShot({
        pan: thetaToStereoPan(enemyShotSpatial.theta),
        depth: enemyShotSpatial.depth
      });
    }
    for (const enemy of destroyedEnemies.slice(0, 3)) {
      this.sfx.playExplosion({
        pan: thetaToStereoPan(enemy.theta),
        depth: clamp01(enemy.depth),
        large: enemy.enemyClass === 'large'
      });
    }
    if (playerHit) {
      this.sfx.playPlayerHit({
        pan: thetaToStereoPan(this.state.playerTheta),
        depth: 0
      });
    } else if (shieldHit) {
      this.sfx.playPlayerHit({
        pan: thetaToStereoPan(this.state.playerTheta),
        depth: 0
      });
    }
    if (won) {
      this.sfx.playWin();
    }
    if (lost) {
      this.sfx.playLose();
    }

    this.sfx.updateTunnelMotion({
      theta: this.state.playerTheta + Math.PI / 2,
      speedUnit: clamp01(maxMoveSpeed),
      active: this.state.phase === 'playing' && maxMoveSpeed > 0.02
    });

    if (playerDeathTriggered && playerExplosionTheta !== null) {
      this.startPlayerDeathCluster(playerExplosionTheta);
      this.spawnExplosion(playerExplosionTheta, 0);
    }
    for (const enemy of destroyedEnemies) {
      this.spawnExplosion(enemy.theta, enemy.depth);
    }
    this.updatePlayerDeathCluster(delta);
    this.updateExplosionGlows();

    if (playerHit) {
      this.triggerHitFeedback(HIT_FLASH_PLAYER, HIT_SHAKE_PLAYER_DURATION_MS, HIT_SHAKE_PLAYER_INTENSITY);
    } else if (enemyHit) {
      this.triggerHitFeedback(HIT_FLASH_ENEMY, HIT_SHAKE_ENEMY_DURATION_MS, HIT_SHAKE_ENEMY_INTENSITY);
    }

    this.updateCameraZoom(delta / 1000);
    this.hitFlashAlpha = Math.max(0, this.hitFlashAlpha - (delta / 1000) * HIT_FLASH_DECAY_PER_SECOND);
    this.renderState();
  }

  private renderState(): void {
    this.refreshCrtOverlay();
    const graphics = this.graphics;
    graphics.clear();

    const frame = computeRenderFrame(
      this.time.now / 1000,
      this.scale.width,
      this.scale.height,
      this.cameraZoom
    );
    this.hintText.setPosition(this.scale.width / 2, this.scale.height / 2);

    this.syncEnemySprites();
    this.syncAsteroidSprites();
    this.drawTunnelStars(graphics, frame);
    this.drawCenterAnomaly(graphics, frame);
    this.drawExplosionGlows(graphics, frame);
    this.drawDebugRings(graphics, frame);
    this.drawAsteroids(frame);
    this.drawBullets(graphics, frame);
    this.drawEnemies(frame);
    this.drawHitboxes(graphics, frame);
    this.drawPlayer(graphics, frame);
    this.drawHud();
    this.hintText.setText(phaseMessage(this.state.phase));
    this.hitFlashOverlay.setDisplaySize(this.scale.width, this.scale.height);
    this.hitFlashOverlay.setFillStyle(0xffffff, this.hitFlashAlpha);
  }

  private triggerHitFeedback(flashAlpha: number, shakeDurationMs: number, shakeIntensity: number): void {
    this.hitFlashAlpha = Math.max(this.hitFlashAlpha, flashAlpha);
    this.cameras.main.shake(shakeDurationMs, shakeIntensity, true);
  }

  private startPlayerDeathCluster(theta: number): void {
    this.playerDeathCluster = {
      theta,
      remainingMs: PLAYER_DEATH_CLUSTER_DURATION_MS,
      burstTimerMs: 0
    };
  }

  private updatePlayerDeathCluster(deltaMs: number): void {
    if (this.playerDeathCluster === null) {
      return;
    }

    const remainingMs = Math.max(0, this.playerDeathCluster.remainingMs - deltaMs);
    let burstTimerMs = this.playerDeathCluster.burstTimerMs - deltaMs;
    while (remainingMs > 0 && burstTimerMs <= 0) {
      for (let index = 0; index < PLAYER_DEATH_CLUSTER_BURST_COUNT; index += 1) {
        const thetaJitter = Phaser.Math.FloatBetween(
          -PLAYER_DEATH_CLUSTER_THETA_JITTER,
          PLAYER_DEATH_CLUSTER_THETA_JITTER
        );
        const depthJitter = Phaser.Math.FloatBetween(
          -PLAYER_DEATH_CLUSTER_DEPTH_JITTER,
          PLAYER_DEATH_CLUSTER_DEPTH_JITTER
        );
        this.spawnExplosion(
          this.playerDeathCluster.theta + thetaJitter,
          clamp01(0.06 + depthJitter)
        );
      }

      this.sfx.playExplosion({
        pan: thetaToStereoPan(this.playerDeathCluster.theta),
        depth: 0,
        large: true
      });
      burstTimerMs += PLAYER_DEATH_CLUSTER_BURST_INTERVAL_MS;
    }

    if (remainingMs === 0) {
      this.playerDeathCluster = null;
      return;
    }

    this.playerDeathCluster = {
      theta: this.playerDeathCluster.theta,
      remainingMs,
      burstTimerMs
    };
  }

  private setupExplosionAnimations(): void {
    if (!this.anims.exists(EXPLOSION_ANIM_KEY_1)) {
      this.anims.create({
        key: EXPLOSION_ANIM_KEY_1,
        frames: this.anims.generateFrameNumbers(EXPLOSION_TEXTURE_KEY_1, {
          start: 0,
          end: EXPLOSION_FRAME_COUNT - 1
        }),
        frameRate: EXPLOSION_ANIMATION_RATE,
        repeat: 0
      });
    }

    if (!this.anims.exists(EXPLOSION_ANIM_KEY_2)) {
      this.anims.create({
        key: EXPLOSION_ANIM_KEY_2,
        frames: this.anims.generateFrameNumbers(EXPLOSION_TEXTURE_KEY_2, {
          start: 0,
          end: EXPLOSION_FRAME_COUNT - 1
        }),
        frameRate: EXPLOSION_ANIMATION_RATE,
        repeat: 0
      });
    }
  }

  private spawnExplosion(theta: number, depth: number): void {
    const frame = computeRenderFrame(
      this.time.now / 1000,
      this.scale.width,
      this.scale.height,
      this.cameraZoom
    );
    const projected = projectPolarSmooth(theta, depth, frame, this.renderTuning);
    const useFirstSet = Phaser.Math.Between(0, 1) === 0;
    const textureKey = useFirstSet ? EXPLOSION_TEXTURE_KEY_1 : EXPLOSION_TEXTURE_KEY_2;
    const animKey = useFirstSet ? EXPLOSION_ANIM_KEY_1 : EXPLOSION_ANIM_KEY_2;
    const sprite = this.add
      .sprite(projected.x, projected.y, textureKey, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(6_500);

    sprite.setScale(lerp(EXPLOSION_SCALE_NEAR, EXPLOSION_SCALE_FAR, clamp01(depth)));
    sprite.play(animKey);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      sprite.destroy();
    });

    this.explosionGlows = this.explosionGlows.concat({
      theta,
      depth,
      startAtMs: this.time.now
    });
  }

  private updateExplosionGlows(): void {
    const now = this.time.now;
    this.explosionGlows = this.explosionGlows.filter(
      (explosionGlow) => now - explosionGlow.startAtMs < EXPLOSION_GLOW_DURATION_MS
    );
  }

  private drawExplosionGlows(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    const now = this.time.now;
    for (const explosionGlow of this.explosionGlows) {
      const progress = clamp01((now - explosionGlow.startAtMs) / EXPLOSION_GLOW_DURATION_MS);
      const alpha = 1 - progress;
      const projected = projectPolarSmooth(
        explosionGlow.theta,
        explosionGlow.depth,
        frame,
        this.renderTuning
      );
      const depth = clamp01(explosionGlow.depth);
      const baseRadius = lerp(EXPLOSION_GLOW_RADIUS_NEAR, EXPLOSION_GLOW_RADIUS_FAR, depth);
      const outerRadius = baseRadius * lerp(0.35, 1.15, progress);
      const innerRadius = outerRadius * 0.44;

      graphics.fillStyle(0xff7c3a, 0.42 * alpha);
      graphics.fillCircle(projected.x, projected.y, outerRadius);
      graphics.fillStyle(0xfff3b0, 0.84 * alpha);
      graphics.fillCircle(projected.x, projected.y, innerRadius);
    }
  }

  private refreshCrtOverlay(): void {
    const width = Math.max(1, Math.floor(this.scale.width));
    const height = Math.max(1, Math.floor(this.scale.height));
    if (width === this.crtOverlayWidth && height === this.crtOverlayHeight) {
      return;
    }

    this.crtOverlayWidth = width;
    this.crtOverlayHeight = height;
    this.crtOverlay.clear();

    this.crtOverlay.fillStyle(0x000000, CRT_SCANLINE_ALPHA);
    for (let y = 0; y < height; y += CRT_SCANLINE_STEP) {
      this.crtOverlay.fillRect(0, y, width, 1);
    }

    const bandThickness = Math.max(
      1,
      Math.floor(Math.min(width, height) * CRT_VIGNETTE_BAND_THICKNESS_RATIO)
    );
    for (let band = 0; band < CRT_VIGNETTE_BANDS; band += 1) {
      const inset = band * bandThickness;
      const innerWidth = width - inset * 2;
      const innerHeight = height - inset * 2;
      if (innerWidth <= 0 || innerHeight <= 0) {
        break;
      }

      const alpha = lerp(0.02, CRT_VIGNETTE_ALPHA_MAX, (band + 1) / CRT_VIGNETTE_BANDS);
      this.crtOverlay.fillStyle(0x000000, alpha);
      this.crtOverlay.fillRect(inset, inset, innerWidth, bandThickness);
      this.crtOverlay.fillRect(inset, inset + innerHeight - bandThickness, innerWidth, bandThickness);
      this.crtOverlay.fillRect(inset, inset, bandThickness, innerHeight);
      this.crtOverlay.fillRect(inset + innerWidth - bandThickness, inset, bandThickness, innerHeight);
    }
  }

  private drawTunnelStars(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    for (const star of this.tunnelStars) {
      const layerFlowSpeed = this.renderTuning.flowSpeed * STAR_LAYER_FLOW_SCALE[star.layer];
      const depth = ringDepthAt(star.ringIndex, frame.timeSeconds, layerFlowSpeed);
      const visualDepth = clamp01(depth);
      const point = projectPolar(star.theta, depth, frame, this.renderTuning, star.radialJitter);
      const starPixelSize = point.pixelSize;
      const starSize = quantizeSize(
        lerp(1.2, 3.4, 1 - visualDepth) * star.sizeScale * TUNNEL_STAR_SIZE_SCALE,
        starPixelSize
      );
      const starHalf = starSize / 2;
      const spilled = applyOuterSpill(point, depth, frame, starPixelSize);
      const starX = snapToGrid(spilled.x - starHalf, starPixelSize);
      const starY = snapToGrid(spilled.y - starHalf, starPixelSize);

      const color = Phaser.Display.Color.GetColor(
        Math.round(lerp(90, 212, 1 - visualDepth)),
        Math.round(lerp(120, 236, 1 - visualDepth)),
        Math.round(lerp(170, 255, 1 - visualDepth))
      );

      graphics.fillStyle(color, star.alpha * lerp(0.45, 1, 1 - visualDepth));
      graphics.fillRect(starX, starY, starSize, starSize);

      const trailDepth = Math.min(1, depth + 0.04 * STAR_LAYER_FLOW_SCALE[star.layer]);
      const trailPoint = projectPolar(star.theta, trailDepth, frame, this.renderTuning, star.radialJitter);
      const trailPixelSize = trailPoint.pixelSize;
      const trailSize = Math.max(trailPixelSize, Math.round(starSize * 0.6));
      const spilledTrail = applyOuterSpill(trailPoint, trailDepth, frame, trailPixelSize);
      graphics.fillStyle(0x6bb4ff, 0.2 * star.alpha);
      graphics.fillRect(
        snapToGrid(spilledTrail.x - trailSize / 2, trailPixelSize),
        snapToGrid(spilledTrail.y - trailSize / 2, trailPixelSize),
        trailSize,
        trailSize
      );
    }
  }

  private drawCenterAnomaly(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    const center = centerForDepth(1, frame);
    const innerBaseRadius = Math.min(frame.innerRadiusX, frame.innerRadiusY);
    const coreRadius = Math.max(16, innerBaseRadius * CENTER_ANOMALY_CORE_RATIO);
    const ringRadius = coreRadius * CENTER_ANOMALY_RING_RATIO;
    const ringThickness = Math.max(2, coreRadius * CENTER_ANOMALY_RING_THICKNESS_RATIO);

    graphics.fillStyle(0x000000, 0.98);
    graphics.fillCircle(center.x, center.y, coreRadius);

    for (let swirlPass = 0; swirlPass < 2; swirlPass += 1) {
      const alpha = swirlPass === 0 ? 0.42 : 0.26;
      const color = swirlPass === 0 ? 0x53aaff : 0x9fd3ff;
      const phase = this.time.now * 0.0011 * (swirlPass === 0 ? 1 : -0.72);
      graphics.lineStyle(swirlPass === 0 ? 2 : 1, color, alpha);
      graphics.beginPath();

      for (let step = 0; step <= CENTER_ANOMALY_SWIRL_SEGMENTS; step += 1) {
        const unit = step / CENTER_ANOMALY_SWIRL_SEGMENTS;
        const theta = unit * TAU;
        const wobble = Math.sin(theta * 3.1 + phase) * ringThickness;
        const radius = ringRadius + wobble;
        const x = center.x + Math.cos(theta + phase) * radius;
        const y = center.y + Math.sin(theta + phase) * radius;
        if (step === 0) {
          graphics.moveTo(x, y);
        } else {
          graphics.lineTo(x, y);
        }
      }

      graphics.strokePath();
    }

    graphics.fillStyle(0x000000, 0.9);
    graphics.fillCircle(center.x, center.y, coreRadius * 0.7);
  }

  private drawHitboxes(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    if (!this.debugHitboxesVisible) {
      return;
    }

    this.drawHitArcBand(
      graphics,
      frame,
      this.state.playerTheta,
      playerHitArc(),
      0,
      playerHitDepthWindow(),
      0xff6f7a,
      0.42
    );

    for (const enemy of this.state.enemies) {
      if (!enemy.alive) {
        continue;
      }

      this.drawHitArcBand(
        graphics,
        frame,
        enemy.theta,
        enemyHitArc(enemy.enemyClass, enemy.depth),
        enemy.depth,
        enemyHitDepthWindow(enemy.enemyClass, enemy.depth),
        0x7dffb4,
        0.42
      );
    }
  }

  private drawHitArcBand(
    graphics: Phaser.GameObjects.Graphics,
    frame: RenderFrame,
    centerTheta: number,
    halfArc: number,
    centerDepth: number,
    halfDepth: number,
    color: number,
    alpha: number
  ): void {
    const segments = 18;
    const fromTheta = centerTheta - halfArc;
    const toTheta = centerTheta + halfArc;
    const nearDepth = centerDepth - halfDepth;
    const farDepth = centerDepth + halfDepth;

    graphics.fillStyle(color, alpha * 0.12);
    graphics.lineStyle(1, color, alpha);
    graphics.beginPath();

    for (let index = 0; index <= segments; index += 1) {
      const unit = index / segments;
      const theta = fromTheta + (toTheta - fromTheta) * unit;
      const point = projectPolarSmooth(theta, nearDepth, frame, this.renderTuning);
      if (index === 0) {
        graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(point.x, point.y);
      }
    }

    for (let index = segments; index >= 0; index -= 1) {
      const unit = index / segments;
      const theta = fromTheta + (toTheta - fromTheta) * unit;
      const point = projectPolarSmooth(theta, farDepth, frame, this.renderTuning);
      graphics.lineTo(point.x, point.y);
    }

    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private drawDebugRings(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    if (!this.debugRingsVisible) {
      return;
    }

    const ringSegments = 64;
    const stepFrom = -DEBUG_RING_BEHIND_COUNT;
    const stepTo = DEBUG_RING_AHEAD_COUNT + DEBUG_RING_BEYOND_COUNT;

    for (let step = stepFrom; step <= stepTo; step += 1) {
      const depth = step / DEBUG_RING_AHEAD_COUNT;
      const visualDepth = clamp01(depth);

      const alpha = lerp(0.16, 0.52, 1 - visualDepth);
      const color = Phaser.Display.Color.GetColor(
        Math.round(lerp(58, 130, 1 - visualDepth)),
        Math.round(lerp(136, 220, 1 - visualDepth)),
        Math.round(lerp(210, 255, 1 - visualDepth))
      );

      graphics.lineStyle(1, color, alpha);
      graphics.beginPath();

      for (let segment = 0; segment <= ringSegments; segment += 1) {
        const theta = (segment / ringSegments) * TAU;
        const point = projectPolar(theta, depth, frame, this.renderTuning);

        if (segment === 0) {
          graphics.moveTo(point.x, point.y);
        } else {
          graphics.lineTo(point.x, point.y);
        }
      }

      graphics.strokePath();
    }
  }

  private drawPlayer(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    if (this.state.playerDeathTimer > 0) {
      this.playerSprite.setVisible(false);
      return;
    }

    const blink =
      this.state.playerInvulnerabilityTimer > 0 && Math.floor(this.time.now / 100) % 2 === 0;
    if (blink) {
      this.playerSprite.setVisible(false);
      return;
    }

    this.playerSprite.setVisible(true);
    const playerTextureKey = Math.floor(this.time.now / 120) % 2 === 0 ? PLAYER_SPRITE_KEY : PLAYER_SPRITE_ALT_KEY;
    if (this.playerSprite.texture.key !== playerTextureKey) {
      this.playerSprite.setTexture(playerTextureKey);
    }
    const respawnProgress =
      this.state.playerRespawnEntryTimer > 0
        ? 1 - this.state.playerRespawnEntryTimer / PLAYER_RESPAWN_ENTRY_DURATION
        : 1;
    const playerDepth = this.state.playerRespawnEntryTimer > 0
      ? lerp(PLAYER_RESPAWN_DEPTH_START, 0, clamp01(respawnProgress))
      : 0;
    const playerRadiusOffset = this.state.playerJumpTimer > 0
      ? 18
      : lerp(44, 7, clamp01(respawnProgress));
    const position = projectPolarSmooth(
      this.state.playerTheta,
      playerDepth,
      frame,
      this.renderTuning,
      playerRadiusOffset
    );
    const center = centerForDepth(1, frame);
    const facingCenterAngle = Phaser.Math.Angle.Between(position.x, position.y, center.x, center.y);

    this.playerSprite.setPosition(position.x, position.y);
    this.playerSprite.setRotation(facingCenterAngle + Math.PI / 2);
    const respawnScale = lerp(0.68, 1, clamp01(respawnProgress));
    this.playerSprite.setScale(
      (this.state.playerJumpTimer > 0 ? PLAYER_SPRITE_SCALE_JUMP : PLAYER_SPRITE_SCALE) * respawnScale
    );

    const shieldRatio = clamp01(this.state.playerShield / PLAYER_SHIELD_MAX);
    if (shieldRatio > 0) {
      graphics.lineStyle(2, 0x74d8ff, 0.24 + shieldRatio * 0.36);
      graphics.strokeCircle(position.x, position.y, 22 + shieldRatio * 8);
    }

    if (this.state.playerJumpTimer > 0) {
      graphics.fillStyle(0xb2f1ff, 0.3);
      graphics.fillCircle(position.x, position.y, 28);
    }
  }

  private drawEnemies(frame: RenderFrame): void {
    for (const enemy of this.state.enemies) {
      const spriteKey = enemySpriteKeyFor(enemy);
      let sprite = this.enemySprites.get(enemy.id);
      if (sprite === undefined) {
        sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, spriteKey);
        sprite.setOrigin(0.5, 0.5);
        sprite.setScale(ENEMY_SPRITE_SCALE_FAR);
        this.enemySprites.set(enemy.id, sprite);
      } else if (sprite.texture.key !== spriteKey) {
        sprite.setTexture(spriteKey);
      }

      if (!enemy.alive) {
        sprite.setVisible(false);
        continue;
      }

      const position = projectPolarSmooth(enemy.theta, enemy.depth, frame, this.renderTuning);
      const outwardAngle = Phaser.Math.Angle.Between(
        position.centerX,
        position.centerY,
        position.x,
        position.y
      );

      sprite.setVisible(true);
      sprite.setPosition(position.x, position.y);
      const behindTurn = clamp01((-enemy.depth) / 0.18) * Math.PI;
      sprite.setRotation(outwardAngle + Math.PI / 2 + Math.PI + behindTurn);
      const depthCurve = Math.pow(clamp01(enemy.depth), 0.55);
      const baseScale = lerp(ENEMY_SPRITE_SCALE_NEAR, ENEMY_SPRITE_SCALE_FAR, depthCurve);
      const scaleMultiplier = isLargeEnemy(enemy.enemyClass) ? ENEMY_LARGE_SCALE_MULTIPLIER : 1;
      sprite.setScale(baseScale * scaleMultiplier);

      const healthRatio = enemy.maxHp === 0 ? 1 : enemy.hp / enemy.maxHp;
      const damageRatio = 1 - clamp01(healthRatio);
      if (damageRatio <= 0) {
        sprite.clearTint();
      } else {
        const tintColor = Phaser.Display.Color.GetColor(
          255,
          Math.round(lerp(255, 124, damageRatio)),
          Math.round(lerp(255, 92, damageRatio))
        );
        sprite.setTint(tintColor);
      }
    }
  }

  private drawAsteroids(frame: RenderFrame): void {
    for (const asteroid of this.state.asteroids) {
      let sprite = this.asteroidSprites.get(asteroid.id);
      if (sprite === undefined) {
        sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, ASTEROID_SPRITE_KEY);
        sprite.setOrigin(0.5, 0.5);
        sprite.setScale(ASTEROID_SPRITE_SCALE_FAR);
        this.asteroidSprites.set(asteroid.id, sprite);
      }

      const position = projectPolarSmooth(asteroid.theta, asteroid.depth, frame, this.renderTuning);
      const depthCurve = Math.pow(clamp01(asteroid.depth), 0.55);
      const scale = lerp(ASTEROID_SPRITE_SCALE_NEAR, ASTEROID_SPRITE_SCALE_FAR, depthCurve);
      const spin = this.time.now / 650 + asteroid.id * 0.58;

      sprite.setVisible(true);
      sprite.setPosition(position.x, position.y);
      sprite.setRotation(spin);
      sprite.setScale(scale);
    }
  }

  private syncEnemySprites(): void {
    const activeIds = new Set(this.state.enemies.map((enemy) => enemy.id));
    for (const [id, sprite] of this.enemySprites.entries()) {
      if (activeIds.has(id)) {
        continue;
      }

      sprite.destroy();
      this.enemySprites.delete(id);
    }
  }

  private syncAsteroidSprites(): void {
    const activeIds = new Set(this.state.asteroids.map((asteroid) => asteroid.id));
    for (const [id, sprite] of this.asteroidSprites.entries()) {
      if (activeIds.has(id)) {
        continue;
      }

      sprite.destroy();
      this.asteroidSprites.delete(id);
    }
  }

  private drawBullets(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    for (const bullet of this.state.bullets) {
      const depth = bullet.owner === 'enemy' ? bullet.depth : clamp01(bullet.depth);
      const visualDepth = clamp01(depth);
      const head = projectPolar(bullet.theta, depth, frame, this.renderTuning);
      if (bullet.owner === 'enemy') {
        const trailDirection = Math.sign(bullet.depthVelocity);
        const coreSize = quantizeSize(
          lerp(ENEMY_BULLET_CORE_SIZE_NEAR, ENEMY_BULLET_CORE_SIZE_FAR, visualDepth),
          head.pixelSize
        );
        const smokeHead = projectPolar(
          bullet.theta,
          depth - trailDirection * 0.03,
          frame,
          this.renderTuning
        );
        const smokeTail = projectPolar(
          bullet.theta,
          depth - trailDirection * ENEMY_BULLET_TRAIL_DEPTH,
          frame,
          this.renderTuning
        );
        const smokeHeadSize = quantizeSize(
          Math.max(coreSize * ENEMY_BULLET_SMOKE_HEAD_SCALE, smokeHead.pixelSize),
          smokeHead.pixelSize
        );
        const smokeTailSize = quantizeSize(
          Math.max(coreSize * ENEMY_BULLET_SMOKE_TAIL_SCALE, smokeTail.pixelSize),
          smokeTail.pixelSize
        );

        graphics.fillStyle(0xff4c56, 0.38);
        graphics.fillRect(
          snapToGrid(smokeHead.x - smokeHeadSize / 2, smokeHead.pixelSize),
          snapToGrid(smokeHead.y - smokeHeadSize / 2, smokeHead.pixelSize),
          smokeHeadSize,
          smokeHeadSize
        );

        graphics.fillStyle(0xff7b42, 0.46);
        graphics.fillRect(
          snapToGrid(smokeTail.x - smokeTailSize / 2, smokeTail.pixelSize),
          snapToGrid(smokeTail.y - smokeTailSize / 2, smokeTail.pixelSize),
          smokeTailSize,
          smokeTailSize
        );

        graphics.fillStyle(0xffc8cf, 0.95);
        graphics.fillRect(
          snapToGrid(head.x - coreSize / 2, head.pixelSize),
          snapToGrid(head.y - coreSize / 2, head.pixelSize),
          coreSize,
          coreSize
        );
        continue;
      }

      const noseSize = quantizeSize(lerp(4.2, 2.2, visualDepth), head.pixelSize);
      const trailDepth = clamp01(depth - 0.06);
      const trail = projectPolar(bullet.theta, trailDepth, frame, this.renderTuning);
      const bodySize = quantizeSize(Math.max(noseSize * 0.7, head.pixelSize), head.pixelSize);
      const finSize = quantizeSize(Math.max(noseSize * 0.55, head.pixelSize), head.pixelSize);

      const deltaX = head.x - trail.x;
      const deltaY = head.y - trail.y;
      const deltaLength = Math.hypot(deltaX, deltaY);
      const dirX = deltaLength === 0 ? Math.cos(bullet.theta) : deltaX / deltaLength;
      const dirY = deltaLength === 0 ? Math.sin(bullet.theta) : deltaY / deltaLength;
      const sideX = -dirY;
      const sideY = dirX;
      const step = Math.max(head.pixelSize, noseSize * 0.8);

      const drawPixelBlock = (cx: number, cy: number, size: number, color: number, alpha: number): void => {
        graphics.fillStyle(color, alpha);
        graphics.fillRect(
          snapToGrid(cx - size / 2, head.pixelSize),
          snapToGrid(cy - size / 2, head.pixelSize),
          size,
          size
        );
      };

      drawPixelBlock(trail.x, trail.y, quantizeSize(bodySize * 0.8, head.pixelSize), 0xff8a42, 0.42);
      drawPixelBlock(
        head.x - dirX * step * 2.2,
        head.y - dirY * step * 2.2,
        bodySize,
        0xffb866,
        0.72
      );
      drawPixelBlock(
        head.x - dirX * step * 1.25,
        head.y - dirY * step * 1.25,
        bodySize,
        0xffd39a,
        0.95
      );
      drawPixelBlock(
        head.x - dirX * step * 1.4 + sideX * step * 0.9,
        head.y - dirY * step * 1.4 + sideY * step * 0.9,
        finSize,
        0xffa95f,
        0.88
      );
      drawPixelBlock(
        head.x - dirX * step * 1.4 - sideX * step * 0.9,
        head.y - dirY * step * 1.4 - sideY * step * 0.9,
        finSize,
        0xffa95f,
        0.88
      );
      drawPixelBlock(head.x, head.y, noseSize, 0xfff6b2, 1);
    }
  }

  private shouldZoomOut(): boolean {
    return this.state.enemies.some((enemy) => enemy.alive && enemy.depth < CAMERA_ZOOM_DEPTH_THRESHOLD);
  }

  private updateCameraZoom(deltaSeconds: number): void {
    const target = this.shouldZoomOut() ? CAMERA_ZOOM_OUT : CAMERA_ZOOM_DEFAULT;
    const delta = target - this.cameraZoom;
    const maxStep = CAMERA_ZOOM_SPEED * deltaSeconds;

    if (Math.abs(delta) <= maxStep) {
      this.cameraZoom = target;
      return;
    }

    this.cameraZoom += Math.sign(delta) * maxStep;
  }

  private applyDebugHotkeys(): void {
    if (!DEBUG_TUNING_ENABLED || this.debugKeys === null) {
      return;
    }

    if (justDownAny(this.debugKeys.toggleOverlay)) {
      this.debugOverlayVisible = !this.debugOverlayVisible;
      if (this.debugText !== null) {
        this.debugText.setVisible(this.debugOverlayVisible);
      }
    }

    if (justDownAny(this.debugKeys.toggleRings)) {
      this.debugRingsVisible = !this.debugRingsVisible;
    }

    if (justDownAny(this.debugKeys.toggleHitboxes)) {
      this.debugHitboxesVisible = !this.debugHitboxesVisible;
    }

    if (justDownAny(this.debugKeys.depthDown)) {
      this.renderTuning = {
        ...this.renderTuning,
        depthScale: Math.max(DEPTH_SCALE_DEEP, this.renderTuning.depthScale - DEPTH_SCALE_STEP)
      };
    }

    if (justDownAny(this.debugKeys.depthUp)) {
      this.renderTuning = {
        ...this.renderTuning,
        depthScale: Math.min(DEPTH_SCALE_MAX, this.renderTuning.depthScale + DEPTH_SCALE_STEP)
      };
    }

    if (justDownAny(this.debugKeys.pixelDown)) {
      const next = Math.max(PIXEL_OFFSET_MIN, this.renderTuning.pixelOffset - 1);
      this.renderTuning = {
        ...this.renderTuning,
        pixelOffset: next
      };
    }

    if (justDownAny(this.debugKeys.pixelUp)) {
      const next = Math.min(PIXEL_OFFSET_MAX, this.renderTuning.pixelOffset + 1);
      this.renderTuning = {
        ...this.renderTuning,
        pixelOffset: next
      };
    }

    if (justDownAny(this.debugKeys.flowDown)) {
      const next = Math.max(FLOW_SPEED_MIN, this.renderTuning.flowSpeed - FLOW_SPEED_STEP);
      this.renderTuning = {
        ...this.renderTuning,
        flowSpeed: next
      };
    }

    if (justDownAny(this.debugKeys.flowUp)) {
      const next = Math.min(FLOW_SPEED_MAX, this.renderTuning.flowSpeed + FLOW_SPEED_STEP);
      this.renderTuning = {
        ...this.renderTuning,
        flowSpeed: next
      };
    }

    if (justDownAny(this.debugKeys.twistDown)) {
      const next = Math.max(TWIST_SCALE_MIN, this.renderTuning.twistScale - TWIST_SCALE_STEP);
      this.renderTuning = {
        ...this.renderTuning,
        twistScale: next
      };
    }

    if (justDownAny(this.debugKeys.twistUp)) {
      const next = Math.min(TWIST_SCALE_MAX, this.renderTuning.twistScale + TWIST_SCALE_STEP);
      this.renderTuning = {
        ...this.renderTuning,
        twistScale: next
      };
    }

    if (justDownAny(this.debugKeys.nextMixProfile)) {
      this.sfx.nextMixProfile();
      this.sfx.playUiMove();
    }
  }

  private updateDebugOverlay(): void {
    if (!DEBUG_TUNING_ENABLED || this.debugText === null || !this.debugOverlayVisible) {
      return;
    }

    const far = Math.max(1, 2 + this.renderTuning.pixelOffset);
    const mid = Math.max(far, 3 + this.renderTuning.pixelOffset);
    const near = Math.max(mid, 4 + this.renderTuning.pixelOffset);

    this.debugText.setText(
      `DEBUG TUNING [F1]\nPIXELS [ ] / 9 0: ${far}/${mid}/${near}\nFLOW - + / S W: ${this.renderTuning.flowSpeed.toFixed(2)}\nTWIST , . / Z X: ${this.renderTuning.twistScale.toFixed(2)}\nDEPTH D/F (PgDn/PgUp): ${this.renderTuning.depthScale.toFixed(1)}\nMIX M: ${this.sfx.getMixProfile()}\nRINGS R: ${this.debugRingsVisible ? 'ON' : 'OFF'}\nHITBOX H: ${this.debugHitboxesVisible ? 'ON' : 'OFF'}`
    );
    this.debugText.setPosition(20, Math.max(20, this.scale.height - this.debugText.height - 20));
  }

  private drawHud(): void {
    const shieldPercent = Math.round((this.state.playerShield / PLAYER_SHIELD_MAX) * 100);
    this.hudText.setText(
      `SCORE ${this.state.score.toString().padStart(5, '0')}    LIVES ${this.state.lives}    SHIELD ${shieldPercent}%    JUMP ${(this.state.playerJumpCooldownTimer === 0).toString()}`
    );
    this.updateDebugOverlay();
  }

  private initializeBackgroundMusic(): void {
    if (!this.cache.audio.exists(BACKGROUND_MUSIC_KEY)) {
      throw new Error(`Missing audio asset for key "${BACKGROUND_MUSIC_KEY}".`);
    }

    this.backgroundMusic = this.sound.add(BACKGROUND_MUSIC_KEY, {
      loop: true,
      volume: BACKGROUND_MUSIC_VOLUME
    });
    this.startBackgroundMusic();
  }

  private requireBackgroundMusic(): Phaser.Sound.BaseSound {
    if (this.backgroundMusic === null) {
      throw new Error('Background music is not initialized in Tunnel Invaders scene.');
    }

    return this.backgroundMusic;
  }

  private startBackgroundMusic(): void {
    const backgroundMusic = this.requireBackgroundMusic();
    if (backgroundMusic.isPlaying) {
      return;
    }

    backgroundMusic.play();
  }

  private stopBackgroundMusic(): void {
    const backgroundMusic = this.requireBackgroundMusic();
    backgroundMusic.stop();
    backgroundMusic.destroy();
    this.backgroundMusic = null;
  }

  private ensureFullscreenOnInteraction(): void {
    if (this.scale.isFullscreen) {
      return;
    }

    this.scale.startFullscreen();
  }
}
