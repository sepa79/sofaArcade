import Phaser from 'phaser';

import {
  FIXED_TIMESTEP,
  TAU,
  TUNNEL_INNER_RADIUS,
  TUNNEL_OUTER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../tunnel/game/constants';
import { createInputContext, readFrameInput } from '../tunnel/game/input';
import { stepGame } from '../tunnel/game/logic';
import { createInitialState } from '../tunnel/game/state';
import enemyFighterImage from '../assets/sprite_enemy_1.png';
import fighterShipImage from '../assets/sprite_player_1.png';
import type { InputContext } from '../tunnel/game/input';
import type { GameState, TunnelPhase } from '../tunnel/game/types';

export const TUNNEL_INVADERS_SCENE_KEY = 'tunnel-invaders';
const PLAYER_SPRITE_KEY = 'tunnel-player-ship';
const ENEMY_SPRITE_KEY = 'tunnel-enemy-ship';

const WORM_DRIFT_CAP_X = 18;
const WORM_DRIFT_CAP_Y = 16;
const OUTER_DRIFT_INFLUENCE = 0.2;
const TUNNEL_DENSITY_EXPONENT = 0.58;
const TWIST_BASE_AMP = 0.08;
const TWIST_WAVE_AMP = 0.04;
const ENEMY_WAVE_AMP = 0.08;
const TUNNEL_RING_COUNT = 34;
const TUNNEL_STARS_PER_RING = 18;
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
const DEPTH_SCALE_DEEP = 4.5;
const DEPTH_PERSPECTIVE_BIAS = 1.2;
const PLAYER_SPRITE_SCALE = 0.7;
const PLAYER_SPRITE_SCALE_JUMP = 0.82;
const ENEMY_SPRITE_SCALE_NEAR = 0.75;
const ENEMY_SPRITE_SCALE_FAR = 0.35;

interface RenderFrame {
  readonly timeSeconds: number;
  readonly driftX: number;
  readonly driftY: number;
}

interface RenderCenter {
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
  readonly theta: number;
  readonly radialJitter: number;
  readonly alpha: number;
  readonly sizeScale: number;
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
  readonly toggleDepthMode: ReadonlyArray<Phaser.Input.Keyboard.Key>;
  readonly toggleOverlay: ReadonlyArray<Phaser.Input.Keyboard.Key>;
}

const DEFAULT_RENDER_TUNING: RenderTuning = {
  pixelOffset: -3,
  flowSpeed: TUNNEL_FLOW_SPEED,
  twistScale: 0.25,
  depthScale: DEPTH_SCALE_DEFAULT
};

export interface TunnelInvadersSceneData {
  readonly controllerProfileId: string;
  readonly controllerLabel: string;
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

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel
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

function depthToRadius(depth: number): number {
  const clampedDepth = clamp01(depth);
  const depthCurve = Math.pow(clampedDepth, TUNNEL_DENSITY_EXPONENT);
  return TUNNEL_OUTER_RADIUS - depthCurve * (TUNNEL_OUTER_RADIUS - TUNNEL_INNER_RADIUS);
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

function computeRenderFrame(timeSeconds: number): RenderFrame {
  const driftX = Math.sin(timeSeconds * 0.74) * 12 + Math.sin(timeSeconds * 1.23 + 0.7) * 6;
  const driftY = Math.cos(timeSeconds * 0.82 + 0.2) * 10 + Math.sin(timeSeconds * 1.36 + 1.1) * 5;

  return {
    timeSeconds,
    driftX: Math.max(-WORM_DRIFT_CAP_X, Math.min(WORM_DRIFT_CAP_X, driftX)),
    driftY: Math.max(-WORM_DRIFT_CAP_Y, Math.min(WORM_DRIFT_CAP_Y, driftY))
  };
}

function centerForDepth(depth: number, frame: RenderFrame): RenderCenter {
  const clampedDepth = clamp01(depth);
  const depthInfluence = OUTER_DRIFT_INFLUENCE + (1 - OUTER_DRIFT_INFLUENCE) * Math.pow(clampedDepth, 1.45);

  return {
    x: WORLD_WIDTH / 2 + frame.driftX * depthInfluence,
    y: WORLD_HEIGHT / 2 + frame.driftY * depthInfluence
  };
}

function depthTwist(depth: number, timeSeconds: number, twistScale: number): number {
  const clampedDepth = clamp01(depth);
  return (
    TWIST_BASE_AMP * twistScale * clampedDepth +
    TWIST_WAVE_AMP * twistScale * clampedDepth * Math.sin(timeSeconds * 3.2 + clampedDepth * TAU * 2.3)
  );
}

function enemyWaveOffset(enemyId: number, depth: number, timeSeconds: number): number {
  const clampedDepth = clamp01(depth);
  return ENEMY_WAVE_AMP * clampedDepth * Math.sin(timeSeconds * 2.6 + enemyId * 0.67 + clampedDepth * TAU);
}

function wrapUnit(value: number): number {
  const remainder = value % 1;
  return remainder < 0 ? remainder + 1 : remainder;
}

function mapDepthForPerspective(depth: number, depthScale: number): number {
  const normalizedDepth = clamp01(depth);
  const clampedScale = Math.max(DEPTH_SCALE_DEFAULT, depthScale);

  const virtualDepth = normalizedDepth * clampedScale;
  const projected = virtualDepth / (virtualDepth + DEPTH_PERSPECTIVE_BIAS);
  const projectedMax = clampedScale / (clampedScale + DEPTH_PERSPECTIVE_BIAS);

  return projectedMax === 0 ? 0 : projected / projectedMax;
}

function ringDepthAt(ringIndex: number, timeSeconds: number, flowSpeed: number): number {
  const normalized = ringIndex / TUNNEL_RING_COUNT;
  return wrapUnit(normalized - timeSeconds * flowSpeed);
}

function createTunnelStars(): ReadonlyArray<TunnelStar> {
  const rng = new Phaser.Math.RandomDataGenerator(['tunnel-stars-v2']);
  const stars: TunnelStar[] = [];

  for (let ringIndex = 0; ringIndex < TUNNEL_RING_COUNT; ringIndex += 1) {
    for (let starIndex = 0; starIndex < TUNNEL_STARS_PER_RING; starIndex += 1) {
      stars.push({
        ringIndex,
        theta: rng.frac() * TAU,
        radialJitter: rng.realInRange(-5, 5),
        alpha: rng.realInRange(0.45, 0.95),
        sizeScale: rng.realInRange(0.75, 1.05)
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
  const clampedDepth = clamp01(depth);
  const projectedDepth = mapDepthForPerspective(clampedDepth, tuning.depthScale);
  const pixelSize = pixelSizeForDepth(projectedDepth, tuning.pixelOffset);
  const center = centerForDepth(projectedDepth, frame);
  const radius = depthToRadius(projectedDepth) + radiusOffset;
  const renderTheta = theta + depthTwist(projectedDepth, frame.timeSeconds, tuning.twistScale);

  return {
    x: snapToGrid(center.x + Math.cos(renderTheta) * radius, pixelSize),
    y: snapToGrid(center.y + Math.sin(renderTheta) * radius, pixelSize),
    pixelSize,
    centerX: center.x,
    centerY: center.y
  };
}

function quantizeSize(size: number, pixelSize: number): number {
  return Math.max(pixelSize, Math.round(size / pixelSize) * pixelSize);
}

function justDownAny(keys: ReadonlyArray<Phaser.Input.Keyboard.Key>): boolean {
  for (const key of keys) {
    if (Phaser.Input.Keyboard.JustDown(key)) {
      return true;
    }
  }

  return false;
}

export class TunnelInvadersScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private tunnelStars: ReadonlyArray<TunnelStar> = [];
  private hudText!: Phaser.GameObjects.Text;
  private debugText: Phaser.GameObjects.Text | null = null;
  private debugKeys: DebugKeys | null = null;
  private debugOverlayVisible = DEBUG_TUNING_ENABLED;
  private renderTuning: RenderTuning = DEFAULT_RENDER_TUNING;
  private hintText!: Phaser.GameObjects.Text;
  private inputContext!: InputContext;
  private state: GameState = createInitialState();
  private accumulator = 0;
  private launchData: TunnelInvadersSceneData | null = null;

  constructor() {
    super(TUNNEL_INVADERS_SCENE_KEY);
  }

  preload(): void {
    this.load.image(PLAYER_SPRITE_KEY, fighterShipImage);
    this.load.image(ENEMY_SPRITE_KEY, enemyFighterImage);
  }

  init(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
  }

  create(): void {
    if (this.launchData === null) {
      throw new Error('Tunnel Invaders launchData is missing in create().');
    }

    this.graphics = this.add.graphics();
    this.playerSprite = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, PLAYER_SPRITE_KEY);
    this.playerSprite.setOrigin(0.5, 0.5);
    this.playerSprite.setScale(PLAYER_SPRITE_SCALE);
    this.tunnelStars = createTunnelStars();

    for (const enemy of this.state.enemies) {
      const sprite = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, ENEMY_SPRITE_KEY);
      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(ENEMY_SPRITE_SCALE_FAR);
      this.enemySprites.set(enemy.id, sprite);
    }

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

    this.hintText = this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, '', {
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
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
        ],
        flowUp: [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_UP),
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
        toggleDepthMode: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)],
        toggleOverlay: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1)]
      };

      this.debugText = this.add.text(20, WORLD_HEIGHT - 88, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '16px',
        color: '#9be7ff'
      });
      this.debugText.setVisible(this.debugOverlayVisible);
    }

    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);
    this.cameras.main.setBackgroundColor('#070d1e');
  }

  update(_: number, delta: number): void {
    this.applyDebugHotkeys();
    this.accumulator += delta / 1000;

    while (this.accumulator >= FIXED_TIMESTEP) {
      const input = readFrameInput(this.inputContext);
      this.state = stepGame(this.state, input, FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.renderState();
  }

  private renderState(): void {
    const graphics = this.graphics;
    graphics.clear();

    const frame = computeRenderFrame(this.time.now / 1000);

    this.drawTunnelStars(graphics, frame);
    this.drawBullets(graphics, frame);
    this.drawEnemies(frame);
    this.drawPlayer(graphics, frame);
    this.drawHud();
    this.hintText.setText(phaseMessage(this.state.phase));
  }

  private drawTunnelStars(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    for (const star of this.tunnelStars) {
      const depth = ringDepthAt(star.ringIndex, frame.timeSeconds, this.renderTuning.flowSpeed);
      const point = projectPolar(star.theta, depth, frame, this.renderTuning, star.radialJitter);
      const starPixelSize = point.pixelSize;
      const starSize = quantizeSize(
        lerp(1.2, 3.4, 1 - depth) * star.sizeScale * TUNNEL_STAR_SIZE_SCALE,
        starPixelSize
      );
      const starHalf = starSize / 2;
      const starX = snapToGrid(point.x - starHalf, starPixelSize);
      const starY = snapToGrid(point.y - starHalf, starPixelSize);

      const color = Phaser.Display.Color.GetColor(
        Math.round(lerp(90, 212, 1 - depth)),
        Math.round(lerp(120, 236, 1 - depth)),
        Math.round(lerp(170, 255, 1 - depth))
      );

      graphics.fillStyle(color, star.alpha * lerp(0.45, 1, 1 - depth));
      graphics.fillRect(starX, starY, starSize, starSize);

      const trailDepth = clamp01(depth + 0.045);
      const trailPoint = projectPolar(star.theta, trailDepth, frame, this.renderTuning, star.radialJitter);
      const trailPixelSize = trailPoint.pixelSize;
      const trailSize = Math.max(trailPixelSize, Math.round(starSize * 0.6));
      graphics.fillStyle(0x6bb4ff, 0.2 * star.alpha);
      graphics.fillRect(
        snapToGrid(trailPoint.x - trailSize / 2, trailPixelSize),
        snapToGrid(trailPoint.y - trailSize / 2, trailPixelSize),
        trailSize,
        trailSize
      );
    }
  }

  private drawPlayer(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    const blink =
      this.state.playerInvulnerabilityTimer > 0 && Math.floor(this.time.now / 100) % 2 === 0;
    if (blink) {
      this.playerSprite.setVisible(false);
      return;
    }

    this.playerSprite.setVisible(true);
    const playerRadiusOffset = this.state.playerJumpTimer > 0 ? 18 : 7;
    const position = projectPolar(this.state.playerTheta, 0, frame, this.renderTuning, playerRadiusOffset);
    const center = centerForDepth(1, frame);
    const facingCenterAngle = Phaser.Math.Angle.Between(position.x, position.y, center.x, center.y);

    this.playerSprite.setPosition(position.x, position.y);
    this.playerSprite.setRotation(facingCenterAngle + Math.PI / 2);
    this.playerSprite.setScale(this.state.playerJumpTimer > 0 ? PLAYER_SPRITE_SCALE_JUMP : PLAYER_SPRITE_SCALE);

    if (this.state.playerJumpTimer > 0) {
      graphics.fillStyle(0xb2f1ff, 0.3);
      graphics.fillCircle(position.x, position.y, 28);
    }
  }

  private drawEnemies(frame: RenderFrame): void {
    for (const enemy of this.state.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (sprite === undefined) {
        throw new Error(`Missing enemy sprite for id ${enemy.id}.`);
      }

      if (!enemy.alive) {
        sprite.setVisible(false);
        continue;
      }

      const renderTheta = enemy.theta + enemyWaveOffset(enemy.id, enemy.depth, frame.timeSeconds);
      const position = projectPolar(renderTheta, enemy.depth, frame, this.renderTuning);
      const outwardAngle = Phaser.Math.Angle.Between(
        position.centerX,
        position.centerY,
        position.x,
        position.y
      );

      sprite.setVisible(true);
      sprite.setPosition(position.x, position.y);
      sprite.setRotation(outwardAngle + Math.PI / 2);
      sprite.setScale(lerp(ENEMY_SPRITE_SCALE_NEAR, ENEMY_SPRITE_SCALE_FAR, clamp01(enemy.depth)));
    }
  }

  private drawBullets(graphics: Phaser.GameObjects.Graphics, frame: RenderFrame): void {
    for (const bullet of this.state.bullets) {
      const depth = clamp01(bullet.depth);
      const head = projectPolar(bullet.theta, depth, frame, this.renderTuning);
      const headSize = quantizeSize(lerp(5, 2, depth), head.pixelSize);
      const trailDepth = clamp01(depth - 0.06);
      const trail = projectPolar(bullet.theta, trailDepth, frame, this.renderTuning);
      const trailSize = quantizeSize(headSize + 1, trail.pixelSize);

      graphics.fillStyle(0xffb866, 0.35);
      graphics.fillRect(
        snapToGrid(trail.x - trailSize / 2, trail.pixelSize),
        snapToGrid(trail.y - trailSize / 2, trail.pixelSize),
        trailSize,
        trailSize
      );

      graphics.fillStyle(0xffef96, 1);
      graphics.fillRect(
        snapToGrid(head.x - headSize / 2, head.pixelSize),
        snapToGrid(head.y - headSize / 2, head.pixelSize),
        headSize,
        headSize
      );
    }
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

    if (justDownAny(this.debugKeys.toggleDepthMode)) {
      this.renderTuning = {
        ...this.renderTuning,
        depthScale:
          this.renderTuning.depthScale > DEPTH_SCALE_DEFAULT
            ? DEPTH_SCALE_DEFAULT
            : DEPTH_SCALE_DEEP
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
  }

  private updateDebugOverlay(): void {
    if (!DEBUG_TUNING_ENABLED || this.debugText === null || !this.debugOverlayVisible) {
      return;
    }

    const far = Math.max(1, 2 + this.renderTuning.pixelOffset);
    const mid = Math.max(far, 3 + this.renderTuning.pixelOffset);
    const near = Math.max(mid, 4 + this.renderTuning.pixelOffset);

    this.debugText.setText(
      `DEBUG TUNING [F1]\nPIXELS [ ] / 9 0: ${far}/${mid}/${near}\nFLOW - + / PgDn PgUp / S W: ${this.renderTuning.flowSpeed.toFixed(2)}\nTWIST , . / Z X: ${this.renderTuning.twistScale.toFixed(2)}\nDEEP D: ${this.renderTuning.depthScale > DEPTH_SCALE_DEFAULT ? 'ON' : 'OFF'} (${this.renderTuning.depthScale.toFixed(2)})`
    );
  }

  private drawHud(): void {
    this.hudText.setText(
      `SCORE ${this.state.score.toString().padStart(5, '0')}    LIVES ${this.state.lives}    JUMP ${(this.state.playerJumpCooldownTimer === 0).toString()}`
    );
    this.updateDebugOverlay();
  }
}
