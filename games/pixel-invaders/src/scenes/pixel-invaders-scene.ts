import Phaser from 'phaser';
import { RetroSfx, type AudioMixProfileId } from '@light80/game-sdk';

import enemyShipImage from '../assets/sprite_enemy_1.png';
import enemyShipImage2 from '../assets/sprite_enemy_2.png';
import enemyShipImage3 from '../assets/sprite_enemy_3.png';
import enemyShipImage4 from '../assets/sprite_enemy_4.png';
import explosionSrc1Image from '../assets/explosion_src_1.png';
import explosionSrc2Image from '../assets/explosion_src_2.png';
import backgroundMusicTrack from '../assets/game-bgm.mp3';
import backgroundMusicSyncRaw from '../assets/game-bgm.sync.json';
import playerShipAltImage from '../assets/sprite_player_1a.png';
import playerShipImage from '../assets/sprite_player_1.png';
import { SyncClock, createSyncTrackRuntime, type SyncCurveSample, type SyncFrame } from '../audio-sync';
import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  ENEMY_COLS,
  FIXED_TIMESTEP,
  PLAYER_SPEED,
  PLAYER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../game/constants';
import { createInputContext, readFrameInput } from '../game/input';
import { stepGame } from '../game/logic';
import { createInitialState } from '../game/state';
import type { InputContext } from '../game/input';
import type { Bullet, Enemy, GameState } from '../game/types';

export const PIXEL_INVADERS_SCENE_KEY = 'pixel-invaders';
const PLAYER_SPRITE_KEY = 'pixel-invaders-player-ship';
const PLAYER_SPRITE_ALT_KEY = 'pixel-invaders-player-ship-alt';
const ENEMY_SPRITE_KEYS = [
  'pixel-invaders-enemy-ship-1',
  'pixel-invaders-enemy-ship-2',
  'pixel-invaders-enemy-ship-3',
  'pixel-invaders-enemy-ship-4'
] as const;
const EXPLOSION_TEXTURE_KEY_1 = 'pixel-explosion-1';
const EXPLOSION_TEXTURE_KEY_2 = 'pixel-explosion-2';
const EXPLOSION_ANIM_KEY_1 = 'pixel-explosion-anim-1';
const EXPLOSION_ANIM_KEY_2 = 'pixel-explosion-anim-2';
const BACKGROUND_MUSIC_KEY = 'pixel-invaders-background-music';
const BACKGROUND_MUSIC_VOLUME = 0.42;
const PLAYER_SPRITE_SCALE = 2.1;
const ENEMY_SPRITE_SCALE = 1.5;
const ENEMY_SPRITE_ROTATION = 0;
const STAR_COUNT = 180;
const STAR_LAYER_SPEED: readonly [number, number, number] = [46, 88, 138];
const STAR_LAYER_ALPHA: readonly [number, number, number] = [0.33, 0.58, 0.9];
const STAR_LAYER_SIZE: readonly [number, number, number] = [1, 2, 2.8];
const EXPLOSION_FRAME_WIDTH = 24;
const EXPLOSION_FRAME_HEIGHT = 21;
const EXPLOSION_FRAME_COUNT = 10;
const EXPLOSION_ANIMATION_RATE = 28;
const EXPLOSION_SPRITE_SCALE = 1.5;
const EXPLOSION_DURATION_MS = 260;
const EXPLOSION_RADIUS_PX = 44;
const SYNC_VIGNETTE_TEXTURE_KEY = 'pixel-invaders-sync-vignette';
const SYNC_VIGNETTE_TEXTURE_SIZE = 512;
const SYNC_VIGNETTE_DEPTH = 900;
const HUD_DEPTH = 1_100;
const SYNC_PULSE_DECAY_PER_SECOND = 2.2;
const SYNC_BAR_PULSE_DECAY_PER_SECOND = 1.6;
const SYNC_ONSET_DECAY_PER_SECOND = 4.2;
const HIGH_ONSET_SPIN_TRIGGER = 0.62;
const MID_ONSET_SWAY_TRIGGER = 0.56;
const BOTTOM_GRID_LINE_COUNT = 8;
const BOTTOM_GRID_FLOW_SPEED_PX_PER_SEC = 56;
const BOTTOM_GRID_TOP_SPACING = 44;
const BOTTOM_GRID_BOTTOM_SPREAD = 4.8;
const BOTTOM_GRID_FADE_SEGMENTS = 10;
const BOTTOM_GRID_PARALLAX_MAX_X = 18;

const PIXEL_BGM_SYNC_TRACK = createSyncTrackRuntime(
  backgroundMusicSyncRaw,
  'pixel-invaders.assets.game-bgm.sync.json'
);
const PIXEL_BGM_INITIAL_CURVE = PIXEL_BGM_SYNC_TRACK.track.curves.samples[0];
if (PIXEL_BGM_INITIAL_CURVE === undefined) {
  throw new Error('pixel-invaders.assets.game-bgm.sync.json contains no curve samples.');
}

interface ExplosionFx {
  readonly x: number;
  readonly y: number;
  readonly startAtMs: number;
}

interface PixelStar {
  readonly x: number;
  readonly y: number;
  readonly layer: 0 | 1 | 2;
}

interface MusicReactiveState {
  readonly sectionId: number;
  readonly curve: SyncCurveSample;
  readonly beatPulse: number;
  readonly barPulse: number;
  readonly lowOnsetPulse: number;
  readonly midOnsetPulse: number;
  readonly highOnsetPulse: number;
}

interface EnemyReactiveBurst {
  readonly spinTimerSec: number;
  readonly spinDurationSec: number;
  readonly spinTurns: number;
  readonly spinDirection: -1 | 1;
  readonly swayTimerSec: number;
  readonly swayDurationSec: number;
  readonly swayAngleAmplitude: number;
  readonly swayXAmplitude: number;
  readonly swayDirection: -1 | 1;
}

export interface PixelInvadersSceneData {
  readonly controllerProfileId: string;
  readonly controllerLabel: string;
  readonly audioMixProfileId: AudioMixProfileId;
}

function parseSceneData(rawData: unknown): PixelInvadersSceneData {
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Pixel Invaders scene requires launch data object.');
  }

  const data = rawData as Record<string, unknown>;
  if (typeof data.controllerProfileId !== 'string' || data.controllerProfileId.trim().length === 0) {
    throw new Error('Pixel Invaders scene requires a valid controllerProfileId.');
  }

  if (typeof data.controllerLabel !== 'string' || data.controllerLabel.trim().length === 0) {
    throw new Error('Pixel Invaders scene requires a valid controllerLabel.');
  }

  if (
    data.audioMixProfileId !== 'cinema' &&
    data.audioMixProfileId !== 'arcade' &&
    data.audioMixProfileId !== 'late-night'
  ) {
    throw new Error('Pixel Invaders scene requires a valid audioMixProfileId.');
  }

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel,
    audioMixProfileId: data.audioMixProfileId
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function decayPulse(value: number, decayPerSecond: number, deltaSeconds: number): number {
  return Math.max(0, value - decayPerSecond * deltaSeconds);
}

function applySyncFrame(
  previous: MusicReactiveState,
  frame: SyncFrame,
  deltaSeconds: number
): MusicReactiveState {
  let beatPulse = decayPulse(previous.beatPulse, SYNC_PULSE_DECAY_PER_SECOND, deltaSeconds);
  let barPulse = decayPulse(previous.barPulse, SYNC_BAR_PULSE_DECAY_PER_SECOND, deltaSeconds);
  let lowOnsetPulse = decayPulse(previous.lowOnsetPulse, SYNC_ONSET_DECAY_PER_SECOND, deltaSeconds);
  let midOnsetPulse = decayPulse(previous.midOnsetPulse, SYNC_ONSET_DECAY_PER_SECOND, deltaSeconds);
  let highOnsetPulse = decayPulse(previous.highOnsetPulse, SYNC_ONSET_DECAY_PER_SECOND, deltaSeconds);

  for (const beatEvent of frame.beats) {
    beatPulse = Math.max(beatPulse, 0.08 + beatEvent.strength * 0.16);
  }

  for (const barEvent of frame.bars) {
    barPulse = Math.max(barPulse, 0.11 + barEvent.strength * 0.22);
  }

  for (const onsetEvent of frame.onsets) {
    if (onsetEvent.band === 'low') {
      lowOnsetPulse = Math.max(lowOnsetPulse, 0.04 + onsetEvent.strength * 0.26);
      continue;
    }

    if (onsetEvent.band === 'mid') {
      midOnsetPulse = Math.max(midOnsetPulse, 0.04 + onsetEvent.strength * 0.26);
      continue;
    }

    highOnsetPulse = Math.max(highOnsetPulse, 0.04 + onsetEvent.strength * 0.28);
  }

  return {
    sectionId: frame.sectionId,
    curve: frame.curve,
    beatPulse,
    barPulse,
    lowOnsetPulse,
    midOnsetPulse,
    highOnsetPulse
  };
}

function xToStereoPan(x: number): number {
  const centered = (x - WORLD_WIDTH / 2) / (WORLD_WIDTH / 2);
  return Math.max(-1, Math.min(1, centered));
}

function playerXToMotionTheta(x: number): number {
  return xToStereoPan(x) * (Math.PI / 2);
}

function isSeekableSound(
  sound: Phaser.Sound.BaseSound
): sound is Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound {
  return 'seek' in sound;
}

function emptyEnemyReactiveBurst(): EnemyReactiveBurst {
  return {
    spinTimerSec: 0,
    spinDurationSec: 0,
    spinTurns: 0,
    spinDirection: 1,
    swayTimerSec: 0,
    swayDurationSec: 0,
    swayAngleAmplitude: 0,
    swayXAmplitude: 0,
    swayDirection: 1
  };
}

export class PixelInvadersScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private syncVignette!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private hudText!: Phaser.GameObjects.Text;
  private controllerText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private readonly sfx = new RetroSfx();
  private backgroundMusic: Phaser.Sound.BaseSound | null = null;
  private explosions: ReadonlyArray<ExplosionFx> = [];
  private inputContext!: InputContext;
  private state: GameState = createInitialState(1337);
  private stars: ReadonlyArray<PixelStar> = [];
  private enemyReactiveBursts = new Map<number, EnemyReactiveBurst>();
  private lastHighReactiveEnemyId: number | null = null;
  private lastMidReactiveEnemyId: number | null = null;
  private readonly syncClock = new SyncClock(PIXEL_BGM_SYNC_TRACK);
  private musicReactive: MusicReactiveState = {
    sectionId: 0,
    curve: PIXEL_BGM_INITIAL_CURVE,
    beatPulse: 0,
    barPulse: 0,
    lowOnsetPulse: 0,
    midOnsetPulse: 0,
    highOnsetPulse: 0
  };
  private playfieldOffsetX = 0;
  private playfieldOffsetY = 0;
  private playfieldWidth = WORLD_WIDTH;
  private playfieldHeight = WORLD_HEIGHT;
  private playfieldScaleX = 1;
  private playfieldScaleY = 1;
  private readonly onResize = (): void => {
    this.updateLayout();
  };
  private accumulator = 0;
  private launchData: PixelInvadersSceneData | null = null;

  constructor() {
    super(PIXEL_INVADERS_SCENE_KEY);
  }

  init(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
  }

  preload(): void {
    this.load.image(PLAYER_SPRITE_KEY, playerShipImage);
    this.load.image(PLAYER_SPRITE_ALT_KEY, playerShipAltImage);
    this.load.image(ENEMY_SPRITE_KEYS[0], enemyShipImage);
    this.load.image(ENEMY_SPRITE_KEYS[1], enemyShipImage2);
    this.load.image(ENEMY_SPRITE_KEYS[2], enemyShipImage3);
    this.load.image(ENEMY_SPRITE_KEYS[3], enemyShipImage4);
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
    this.load.audio(BACKGROUND_MUSIC_KEY, backgroundMusicTrack);
  }

  create(): void {
    if (this.launchData === null) {
      throw new Error('Pixel Invaders launchData is missing in create().');
    }

    this.sfx.setMixProfile(this.launchData.audioMixProfileId);

    this.graphics = this.add.graphics();
    this.updateLayout();
    this.createSyncVignetteTexture();
    this.syncVignette = this.add.image(this.scale.width / 2, this.scale.height / 2, SYNC_VIGNETTE_TEXTURE_KEY);
    this.syncVignette.setOrigin(0.5);
    this.syncVignette.setDepth(SYNC_VIGNETTE_DEPTH);
    this.stars = this.createStars();
    this.playerSprite = this.add.image(this.scale.width / 2, this.scale.height / 2, PLAYER_SPRITE_KEY);
    this.playerSprite.setOrigin(0.5, 0.5);
    this.playerSprite.setScale(PLAYER_SPRITE_SCALE * this.visualScale());

    for (const enemy of this.state.enemies) {
      const sprite = this.add.image(
        this.scale.width / 2,
        this.scale.height / 2,
        this.enemySpriteKeyFor(enemy)
      );
      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(ENEMY_SPRITE_SCALE * this.visualScale());
      this.enemySprites.set(enemy.id, sprite);
    }
    this.setupExplosionAnimations();

    this.hudText = this.add.text(20, 18, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      color: '#f4f7ff'
    });
    this.hudText.setDepth(HUD_DEPTH);

    this.controllerText = this.add.text(20, 52, `CTRL ${this.launchData.controllerLabel}`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '18px',
      color: '#90f0ff'
    });
    this.controllerText.setDepth(HUD_DEPTH);

    this.bannerText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '42px',
      color: '#fff1d8',
      align: 'center'
    });
    this.bannerText.setOrigin(0.5, 0.5);
    this.bannerText.setDepth(HUD_DEPTH);

    this.updateLayout();

    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);
    this.cameras.main.setBackgroundColor('#060913');
    this.initializeBackgroundMusic();
    this.musicReactive = applySyncFrame(this.musicReactive, this.syncClock.reset(this.readMusicTimeSec()), 0);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sfx.shutdown();
      this.stopBackgroundMusic();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    });
  }

  update(_: number, delta: number): void {
    const deltaSeconds = delta * 0.001;
    this.accumulator += deltaSeconds;
    let playerShot = false;
    let playerShotX = this.state.playerX;
    let enemyShot = false;
    let enemyShotX = this.state.playerX;
    let playerHit = false;
    let playerHitX = this.state.playerX;
    let won = false;
    let lost = false;
    let maxMoveSpeedUnit = 0;
    const destroyedEnemies: Enemy[] = [];

    while (this.accumulator >= FIXED_TIMESTEP) {
      const input = readFrameInput(this, this.inputContext, {
        minX: this.playfieldOffsetX,
        maxX: this.playfieldOffsetX + this.playfieldWidth
      });
      if (input.firePressed || input.restartPressed || input.moveAxisSigned !== 0 || input.moveAbsoluteUnit !== null) {
        this.ensureFullscreenOnInteraction();
        this.startBackgroundMusic();
        this.sfx.unlock();
      }

      const previous = this.state;
      const next = stepGame(this.state, input, FIXED_TIMESTEP);

      const previousPlayerBullets = previous.bullets.filter((bullet) => bullet.owner === 'player').length;
      const nextPlayerBullets = next.bullets.filter((bullet) => bullet.owner === 'player').length;
      const previousEnemyBullets = previous.bullets.filter((bullet) => bullet.owner === 'enemy').length;
      const nextEnemyBullets = next.bullets.filter((bullet) => bullet.owner === 'enemy').length;

      if (nextPlayerBullets > previousPlayerBullets) {
        playerShot = true;
        playerShotX = next.playerX;
      }
      if (nextEnemyBullets > previousEnemyBullets) {
        enemyShot = true;
        const newestEnemyBullet = next.bullets.reduce<Bullet | null>((current, bullet) => {
          if (bullet.owner !== 'enemy') {
            return current;
          }

          if (current === null || bullet.y < current.y) {
            return bullet;
          }

          return current;
        }, null);
        if (newestEnemyBullet !== null) {
          enemyShotX = newestEnemyBullet.x;
        }
      }
      for (const previousEnemy of previous.enemies) {
        const nextEnemy = next.enemies.find((enemy) => enemy.id === previousEnemy.id);
        if (previousEnemy.alive && nextEnemy !== undefined && !nextEnemy.alive) {
          destroyedEnemies.push(previousEnemy);
        }
      }
      if (next.lives < previous.lives) {
        playerHit = true;
        playerHitX = previous.playerX;
      }
      if (previous.phase === 'playing' && next.phase === 'won') {
        won = true;
      }
      if (previous.phase === 'playing' && next.phase === 'lost') {
        lost = true;
      }
      const moveSpeedUnit = Math.min(1, Math.abs(next.playerX - previous.playerX) / (PLAYER_SPEED * FIXED_TIMESTEP));
      maxMoveSpeedUnit = Math.max(maxMoveSpeedUnit, moveSpeedUnit);

      this.state = next;
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.stars = this.stars.map((star) => {
      const speed = STAR_LAYER_SPEED[star.layer];
      let nextY = star.y + speed * deltaSeconds;
      if (nextY > WORLD_HEIGHT + 8) {
        nextY = -8;
      }

      return {
        ...star,
        y: nextY
      };
    });
    this.updateMusicReactive(deltaSeconds);

    if (playerShot) {
      this.sfx.playPlayerShot({ pan: xToStereoPan(playerShotX), depth: 0 });
    }
    if (enemyShot) {
      this.sfx.playEnemyShot({ pan: xToStereoPan(enemyShotX), depth: 0 });
    }
    for (const enemy of destroyedEnemies.slice(0, 3)) {
      this.sfx.playExplosion({ pan: xToStereoPan(enemy.x), depth: 0, large: false });
      this.spawnExplosion(enemy.x, enemy.y);
    }
    if (playerHit) {
      this.sfx.playPlayerHit({ pan: xToStereoPan(playerHitX), depth: 0 });
      this.spawnExplosion(playerHitX, PLAYER_Y);
    }
    if (won) {
      this.sfx.playWin();
    }
    if (lost) {
      this.sfx.playLose();
    }
    this.sfx.updateTunnelMotion({
      theta: playerXToMotionTheta(this.state.playerX),
      speedUnit: maxMoveSpeedUnit,
      active: this.state.phase === 'playing' && maxMoveSpeedUnit > 0.02
    });
    this.updateExplosions();

    this.renderState();
  }

  private renderState(): void {
    const graphics = this.graphics;
    graphics.clear();

    this.drawBackground(graphics);
    this.syncEnemySprites();
    this.drawPlayer();
    this.drawEnemies();
    this.drawBullets(graphics);
    this.drawExplosions(graphics);
    this.drawHud();
    this.drawBanner();
  }

  private drawPlayer(): void {
    const blink = this.state.playerRespawnTimer > 0 && Math.floor(this.time.now / 100) % 2 === 0;
    if (blink) {
      this.playerSprite.setVisible(false);
      return;
    }

    this.playerSprite.setVisible(true);
    const playerTextureKey = Math.floor(this.time.now / 120) % 2 === 0 ? PLAYER_SPRITE_KEY : PLAYER_SPRITE_ALT_KEY;
    if (this.playerSprite.texture.key !== playerTextureKey) {
      this.playerSprite.setTexture(playerTextureKey);
    }
    this.playerSprite.setPosition(this.worldToScreenX(this.state.playerX), this.worldToScreenY(PLAYER_Y));
    this.playerSprite.setRotation(0);
    this.playerSprite.setScale(PLAYER_SPRITE_SCALE * this.visualScale());
  }

  private drawEnemies(): void {
    const visualScale = this.visualScale();
    const bumpPx =
      (this.musicReactive.curve.low * 4.6 +
        this.musicReactive.lowOnsetPulse * 6.2 +
        this.musicReactive.beatPulse * 3.1) *
      visualScale;

    for (const enemy of this.state.enemies) {
      const enemySpriteKey = this.enemySpriteKeyFor(enemy);
      let sprite = this.enemySprites.get(enemy.id);
      if (sprite === undefined) {
        sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, enemySpriteKey);
        sprite.setOrigin(0.5, 0.5);
        sprite.setScale(ENEMY_SPRITE_SCALE * this.visualScale());
        this.enemySprites.set(enemy.id, sprite);
      } else if (sprite.texture.key !== enemySpriteKey) {
        sprite.setTexture(enemySpriteKey);
      }

      if (!enemy.alive) {
        sprite.setVisible(false);
        sprite.clearTint();
        continue;
      }

      const burst = this.enemyReactiveBursts.get(enemy.id) ?? emptyEnemyReactiveBurst();
      let spriteX = this.worldToScreenX(enemy.x);
      let spriteY = this.worldToScreenY(enemy.y);
      sprite.setVisible(true);
      const bumpOffsetY = Math.sin(this.time.now * 0.012 + enemy.id * 0.9) * bumpPx;
      spriteY += bumpOffsetY;
      let rotation = ENEMY_SPRITE_ROTATION;

      if (burst.spinTimerSec > 0 && burst.spinDurationSec > 0) {
        const progress = 1 - burst.spinTimerSec / burst.spinDurationSec;
        const easedProgress = 1 - Math.pow(1 - clamp01(progress), 3);
        rotation += burst.spinDirection * burst.spinTurns * Math.PI * 2 * easedProgress;
      }

      if (burst.swayTimerSec > 0 && burst.swayDurationSec > 0) {
        const progress = 1 - burst.swayTimerSec / burst.swayDurationSec;
        const envelope = 1 - clamp01(progress);
        const wave = Math.sin(progress * Math.PI * 4);
        spriteX += burst.swayDirection * wave * burst.swayXAmplitude * envelope * visualScale;
        rotation += burst.swayDirection * wave * burst.swayAngleAmplitude * envelope;
        const tintMix = clamp01(0.16 + envelope * 0.35 + this.musicReactive.curve.mid * 0.24);
        const tintColor = Phaser.Display.Color.GetColor(
          Math.round(lerp(255, 188, tintMix)),
          Math.round(lerp(255, 230, tintMix)),
          Math.round(lerp(255, 255, tintMix))
        );
        sprite.setTint(tintColor);
      } else {
        sprite.clearTint();
      }

      sprite.setPosition(spriteX, spriteY);
      sprite.setRotation(rotation);
      sprite.setScale(ENEMY_SPRITE_SCALE * visualScale);
    }
  }

  private enemySpriteKeyFor(enemy: Enemy): (typeof ENEMY_SPRITE_KEYS)[number] {
    const rowIndex = Math.floor(enemy.id / ENEMY_COLS);
    const keyCount = ENEMY_SPRITE_KEYS.length;
    const index = ((rowIndex % keyCount) + keyCount) % keyCount;
    const spriteKey = ENEMY_SPRITE_KEYS[index];
    if (spriteKey === undefined) {
      throw new Error(`Enemy sprite key is missing for index ${index}.`);
    }

    return spriteKey;
  }

  private drawBullets(graphics: Phaser.GameObjects.Graphics): void {
    const shotPixelSize = Math.max(1, Math.round(2 * this.visualScale()));

    for (const bullet of this.state.bullets) {
      if (bullet.owner === 'enemy') {
        graphics.fillStyle(0xffe274, 1);
        graphics.fillRect(
          this.worldToScreenX(bullet.x) - (BULLET_WIDTH * this.playfieldScaleX) / 2,
          this.worldToScreenY(bullet.y) - (BULLET_HEIGHT * this.playfieldScaleY) / 2,
          BULLET_WIDTH * this.playfieldScaleX,
          BULLET_HEIGHT * this.playfieldScaleY
        );
        continue;
      }

      const headX = this.worldToScreenX(bullet.x);
      const headY = this.worldToScreenY(bullet.y);
      const trailX = headX;
      const trailY = this.worldToScreenY(bullet.y + 9);

      const deltaX = headX - trailX;
      const deltaY = headY - trailY;
      const deltaLength = Math.hypot(deltaX, deltaY);
      const dirX = deltaLength === 0 ? 0 : deltaX / deltaLength;
      const dirY = deltaLength === 0 ? -1 : deltaY / deltaLength;
      const sideX = -dirY;
      const sideY = dirX;
      const step = Math.max(shotPixelSize, 3.4 * this.visualScale());
      const bodySize = Math.max(shotPixelSize, Math.round(3 * this.visualScale()));
      const finSize = Math.max(shotPixelSize, Math.round(2 * this.visualScale()));
      const noseSize = Math.max(shotPixelSize, Math.round(4 * this.visualScale()));

      const drawPixelBlock = (cx: number, cy: number, size: number, color: number, alpha: number): void => {
        graphics.fillStyle(color, alpha);
        graphics.fillRect(
          Math.round((cx - size / 2) / shotPixelSize) * shotPixelSize,
          Math.round((cy - size / 2) / shotPixelSize) * shotPixelSize,
          size,
          size
        );
      };

      drawPixelBlock(trailX, trailY, Math.max(shotPixelSize, Math.round(bodySize * 0.8)), 0xff8a42, 0.42);
      drawPixelBlock(
        headX - dirX * step * 2.2,
        headY - dirY * step * 2.2,
        bodySize,
        0xffb866,
        0.72
      );
      drawPixelBlock(
        headX - dirX * step * 1.25,
        headY - dirY * step * 1.25,
        bodySize,
        0xffd39a,
        0.95
      );
      drawPixelBlock(
        headX - dirX * step * 1.4 + sideX * step * 0.9,
        headY - dirY * step * 1.4 + sideY * step * 0.9,
        finSize,
        0xffa95f,
        0.88
      );
      drawPixelBlock(
        headX - dirX * step * 1.4 - sideX * step * 0.9,
        headY - dirY * step * 1.4 - sideY * step * 0.9,
        finSize,
        0xffa95f,
        0.88
      );
      drawPixelBlock(headX, headY, noseSize, 0xfff6b2, 1);
    }
  }

  private drawHud(): void {
    this.hudText.setPosition(this.playfieldOffsetX + 20, this.playfieldOffsetY + 18);
    this.controllerText.setPosition(this.playfieldOffsetX + 20, this.playfieldOffsetY + 52);
    this.hudText.setText(`SCORE ${this.state.score.toString().padStart(5, '0')}    LIVES ${this.state.lives}`);
    const hudPulse = clamp01(
      this.musicReactive.beatPulse * 0.85 + this.musicReactive.barPulse + this.musicReactive.midOnsetPulse * 0.65
    );
    const hudColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(244, 255, hudPulse)),
      Math.round(lerp(247, 231, hudPulse)),
      Math.round(lerp(255, 232, hudPulse))
    );
    const controllerColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(144, 210, hudPulse)),
      Math.round(lerp(240, 248, hudPulse)),
      Math.round(lerp(255, 255, hudPulse))
    );
    this.hudText.setTint(hudColor);
    this.controllerText.setTint(controllerColor);
  }

  private syncEnemySprites(): void {
    const activeIds = new Set(this.state.enemies.map((enemy) => enemy.id));
    for (const [enemyId, sprite] of this.enemySprites.entries()) {
      if (activeIds.has(enemyId)) {
        continue;
      }

      sprite.destroy();
      this.enemySprites.delete(enemyId);
    }
  }

  private drawBanner(): void {
    this.bannerText.setPosition(this.worldToScreenX(WORLD_WIDTH / 2), this.worldToScreenY(WORLD_HEIGHT / 2 - 40));

    if (this.state.phase === 'playing') {
      this.bannerText.setText('');
      return;
    }

    if (this.state.phase === 'won') {
      this.bannerText.setText('SECTOR SECURED\nPRESS ENTER');
      return;
    }

    this.bannerText.setText('PIXEL INVADERS PREVAILED\nPRESS ENTER');
  }

  private updateLayout(): void {
    this.playfieldOffsetX = 0;
    this.playfieldOffsetY = 0;
    this.playfieldWidth = Math.max(1, this.scale.width);
    this.playfieldHeight = Math.max(1, this.scale.height);
    this.playfieldScaleX = this.playfieldWidth / WORLD_WIDTH;
    this.playfieldScaleY = this.playfieldHeight / WORLD_HEIGHT;

    if (this.syncVignette !== undefined) {
      this.syncVignette.setPosition(this.scale.width / 2, this.scale.height / 2);
      this.syncVignette.setDisplaySize(this.playfieldWidth * 1.45, this.playfieldHeight * 1.45);
    }
  }

  private createStars(): ReadonlyArray<PixelStar> {
    const rng = new Phaser.Math.RandomDataGenerator(['pixel-stars-v1']);
    const stars: PixelStar[] = [];
    for (let i = 0; i < STAR_COUNT; i += 1) {
      stars.push({
        x: rng.realInRange(0, WORLD_WIDTH),
        y: rng.realInRange(0, WORLD_HEIGHT),
        layer: (i % 3) as 0 | 1 | 2
      });
    }

    return stars;
  }

  private drawBackground(graphics: Phaser.GameObjects.Graphics): void {
    const curve = this.musicReactive.curve;
    const sectionAccent = this.musicReactive.sectionId % 3;
    const rhythmPulse = clamp01(this.musicReactive.beatPulse * 0.8 + this.musicReactive.barPulse);
    const lowEnergy = clamp01(curve.low * 0.72 + curve.rms * 0.35 + this.musicReactive.lowOnsetPulse * 0.9);
    const bgEnergy = clamp01(0.12 + lowEnergy * 0.45 + rhythmPulse * 0.5);
    const bgColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(3, 14 + sectionAccent * 2, bgEnergy)),
      Math.round(lerp(7, 18 + sectionAccent * 4, bgEnergy)),
      Math.round(lerp(15, 34 + sectionAccent * 6, bgEnergy))
    );
    graphics.fillStyle(bgColor, 1);
    graphics.fillRect(this.playfieldOffsetX, this.playfieldOffsetY, this.playfieldWidth, this.playfieldHeight);

    const sparkleGain = clamp01(0.84 + curve.high * 0.32 + this.musicReactive.highOnsetPulse * 0.55);
    const densityGain = clamp01(0.92 + curve.mid * 0.24 + this.musicReactive.midOnsetPulse * 0.35);
    for (const star of this.stars) {
      const starSize = Math.max(1, STAR_LAYER_SIZE[star.layer] * this.visualScale() * densityGain);
      const alpha = clamp01(STAR_LAYER_ALPHA[star.layer] * sparkleGain);
      graphics.fillStyle(0x9fd8ff, alpha);
      graphics.fillRect(
        Math.round(this.worldToScreenX(star.x)),
        Math.round(this.worldToScreenY(star.y)),
        starSize,
        starSize
      );
    }

    this.drawBottomGrid(graphics);
  }

  private updateMusicReactive(deltaSeconds: number): void {
    const backgroundMusic = this.requireBackgroundMusic();
    const nowSec = this.readMusicTimeSec();
    const playbackState = backgroundMusic.isPlaying ? 'playing' : 'paused';
    const syncFrame = this.syncClock.tick(nowSec, playbackState);
    this.musicReactive = applySyncFrame(this.musicReactive, syncFrame, deltaSeconds);
    this.updateEnemyReactiveBursts(syncFrame, deltaSeconds);

    const blinkPulse = clamp01(
      this.musicReactive.lowOnsetPulse * 0.9 +
        this.musicReactive.beatPulse * 0.7 +
        this.musicReactive.barPulse * 0.9
    );
    const vignetteAlpha = clamp01(
      0.06 + this.musicReactive.curve.low * 0.2 + this.musicReactive.curve.rms * 0.08 + blinkPulse * 0.42
    );
    this.syncVignette.setAlpha(vignetteAlpha);
  }

  private drawBottomGrid(graphics: Phaser.GameObjects.Graphics): void {
    const width = this.playfieldWidth;
    const height = this.playfieldHeight;
    const horizonY = this.playfieldOffsetY + Math.floor(height * 0.79);
    const nearestY = this.playfieldOffsetY + height + 2;
    const travelRange = nearestY - horizonY;
    const spacing = travelRange / BOTTOM_GRID_LINE_COUNT;
    const flowOffset = ((this.time.now * BOTTOM_GRID_FLOW_SPEED_PX_PER_SEC) / 1000) % spacing;
    const playerParallax = ((this.state.playerX / WORLD_WIDTH) * 2 - 1) * BOTTOM_GRID_PARALLAX_MAX_X;
    const centerX = this.playfieldOffsetX + width / 2 + playerParallax;
    const gridEnergy = clamp01(
      this.musicReactive.curve.low * 0.52 +
        this.musicReactive.curve.mid * 0.34 +
        this.musicReactive.beatPulse * 0.42 +
        this.musicReactive.barPulse * 0.7
    );
    const gridColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(74, 124, gridEnergy)),
      Math.round(lerp(34, 88, gridEnergy)),
      Math.round(lerp(202, 255, gridEnergy))
    );

    const perspectiveCount = Math.ceil((width * 0.5) / BOTTOM_GRID_TOP_SPACING) + 2;
    for (let index = -perspectiveCount; index <= perspectiveCount; index += 1) {
      const xTop = centerX + index * BOTTOM_GRID_TOP_SPACING;
      const xBottom = centerX + index * BOTTOM_GRID_TOP_SPACING * BOTTOM_GRID_BOTTOM_SPREAD;
      for (let segment = 0; segment < BOTTOM_GRID_FADE_SEGMENTS; segment += 1) {
        const t0 = segment / BOTTOM_GRID_FADE_SEGMENTS;
        const t1 = (segment + 1) / BOTTOM_GRID_FADE_SEGMENTS;
        const y0 = lerp(horizonY, nearestY, t0);
        const y1 = lerp(horizonY, nearestY, t1);
        const sx0 = lerp(xTop, xBottom, t0);
        const sx1 = lerp(xTop, xBottom, t1);
        const depthUnit = (t0 + t1) * 0.5;
        graphics.lineStyle(2, gridColor, lerp(0.08, 0.62, depthUnit) * (0.68 + gridEnergy * 0.42));
        graphics.beginPath();
        graphics.moveTo(sx0, y0);
        graphics.lineTo(sx1, y1);
        graphics.strokePath();
      }
    }

    const drawnRows = new Set<number>();
    for (let line = -1; line <= BOTTOM_GRID_LINE_COUNT; line += 1) {
      let y = horizonY + line * spacing + flowOffset;
      if (y < horizonY) {
        y += travelRange;
      }
      if (y > nearestY) {
        y -= travelRange;
      }
      if (y < horizonY || y > nearestY) {
        continue;
      }

      const yRow = Math.round(y);
      if (drawnRows.has(yRow)) {
        continue;
      }
      drawnRows.add(yRow);
      const depthUnit = (yRow - horizonY) / travelRange;
      graphics.lineStyle(2, gridColor, lerp(0.08, 0.62, depthUnit) * (0.64 + gridEnergy * 0.5));
      graphics.beginPath();
      graphics.moveTo(this.playfieldOffsetX, yRow);
      graphics.lineTo(this.playfieldOffsetX + width, yRow);
      graphics.strokePath();
    }
  }

  private updateEnemyReactiveBursts(syncFrame: SyncFrame, deltaSeconds: number): void {
    const nextBursts = new Map<number, EnemyReactiveBurst>();
    for (const [enemyId, burst] of this.enemyReactiveBursts.entries()) {
      const spinTimerSec = Math.max(0, burst.spinTimerSec - deltaSeconds);
      const swayTimerSec = Math.max(0, burst.swayTimerSec - deltaSeconds);
      if (spinTimerSec === 0 && swayTimerSec === 0) {
        continue;
      }

      nextBursts.set(enemyId, {
        ...burst,
        spinTimerSec,
        swayTimerSec
      });
    }

    this.enemyReactiveBursts = nextBursts;
    let strongestHigh = 0;
    let strongestMid = 0;
    for (const onsetEvent of syncFrame.onsets) {
      if (onsetEvent.band === 'high') {
        strongestHigh = Math.max(strongestHigh, onsetEvent.strength);
        continue;
      }

      if (onsetEvent.band === 'mid') {
        strongestMid = Math.max(strongestMid, onsetEvent.strength);
      }
    }

    if (strongestHigh >= HIGH_ONSET_SPIN_TRIGGER) {
      this.triggerEnemySpin(strongestHigh);
    }

    if (strongestMid >= MID_ONSET_SWAY_TRIGGER) {
      this.triggerEnemySway(strongestMid);
    }
  }

  private triggerEnemySpin(strength: number): void {
    const enemyId = this.pickReactiveEnemyId(this.lastHighReactiveEnemyId);
    if (enemyId === null) {
      return;
    }

    const burst = this.enemyReactiveBursts.get(enemyId) ?? emptyEnemyReactiveBurst();
    const spinDurationSec = 0.45 + strength * 0.28;
    const spinTurns = 0.95 + strength * 0.95;
    const spinDirection: -1 | 1 = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    this.enemyReactiveBursts.set(enemyId, {
      ...burst,
      spinTimerSec: spinDurationSec,
      spinDurationSec,
      spinTurns,
      spinDirection
    });
    this.lastHighReactiveEnemyId = enemyId;
  }

  private triggerEnemySway(strength: number): void {
    const enemyId = this.pickReactiveEnemyId(this.lastMidReactiveEnemyId);
    if (enemyId === null) {
      return;
    }

    const burst = this.enemyReactiveBursts.get(enemyId) ?? emptyEnemyReactiveBurst();
    const swayDurationSec = 0.56 + strength * 0.34;
    const swayDirection: -1 | 1 = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    this.enemyReactiveBursts.set(enemyId, {
      ...burst,
      swayTimerSec: swayDurationSec,
      swayDurationSec,
      swayAngleAmplitude: Phaser.Math.DEG_TO_RAD * (2.6 + strength * 5.4),
      swayXAmplitude: 1.8 + strength * 4.1,
      swayDirection
    });
    this.lastMidReactiveEnemyId = enemyId;
  }

  private pickReactiveEnemyId(lastEnemyId: number | null): number | null {
    const aliveEnemyIds = this.state.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.id);
    if (aliveEnemyIds.length === 0) {
      return null;
    }

    const candidates =
      lastEnemyId === null || aliveEnemyIds.length <= 1
        ? aliveEnemyIds
        : aliveEnemyIds.filter((enemyId) => enemyId !== lastEnemyId);
    const selectedIndex = Phaser.Math.Between(0, candidates.length - 1);
    const selectedEnemyId = candidates[selectedIndex];
    if (selectedEnemyId === undefined) {
      throw new Error(`Reactive enemy selection failed at index ${selectedIndex}.`);
    }

    return selectedEnemyId;
  }

  private createSyncVignetteTexture(): void {
    if (this.textures.exists(SYNC_VIGNETTE_TEXTURE_KEY)) {
      return;
    }

    const canvasTexture = this.textures.createCanvas(
      SYNC_VIGNETTE_TEXTURE_KEY,
      SYNC_VIGNETTE_TEXTURE_SIZE,
      SYNC_VIGNETTE_TEXTURE_SIZE
    );
    if (canvasTexture === null) {
      throw new Error(`Failed to create texture "${SYNC_VIGNETTE_TEXTURE_KEY}".`);
    }

    const ctx = canvasTexture.context;
    const size = SYNC_VIGNETTE_TEXTURE_SIZE;
    const center = size * 0.5;
    ctx.clearRect(0, 0, size, size);
    const radial = ctx.createRadialGradient(center, center, size * 0.16, center, center, size * 0.5);
    radial.addColorStop(0, 'rgba(0, 0, 0, 0)');
    radial.addColorStop(0.38, 'rgba(0, 0, 0, 0.03)');
    radial.addColorStop(0.62, 'rgba(0, 0, 0, 0.16)');
    radial.addColorStop(0.82, 'rgba(0, 0, 0, 0.34)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);
    canvasTexture.refresh();
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

  private spawnExplosion(x: number, y: number): void {
    const useFirstSet = Phaser.Math.Between(0, 1) === 0;
    const textureKey = useFirstSet ? EXPLOSION_TEXTURE_KEY_1 : EXPLOSION_TEXTURE_KEY_2;
    const animKey = useFirstSet ? EXPLOSION_ANIM_KEY_1 : EXPLOSION_ANIM_KEY_2;
    const sprite = this.add
      .sprite(this.worldToScreenX(x), this.worldToScreenY(y), textureKey, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(500);

    sprite.setScale(EXPLOSION_SPRITE_SCALE * this.visualScale());
    sprite.play(animKey);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      sprite.destroy();
    });

    this.explosions = this.explosions.concat({
      x,
      y,
      startAtMs: this.time.now
    });
  }

  private worldToScreenX(worldX: number): number {
    return this.playfieldOffsetX + worldX * this.playfieldScaleX;
  }

  private worldToScreenY(worldY: number): number {
    return this.playfieldOffsetY + worldY * this.playfieldScaleY;
  }

  private visualScale(): number {
    return Math.min(this.playfieldScaleX, this.playfieldScaleY);
  }

  private updateExplosions(): void {
    const now = this.time.now;
    this.explosions = this.explosions.filter((explosion) => now - explosion.startAtMs < EXPLOSION_DURATION_MS);
  }

  private drawExplosions(graphics: Phaser.GameObjects.Graphics): void {
    const now = this.time.now;
    for (const explosion of this.explosions) {
      const progress = clamp01((now - explosion.startAtMs) / EXPLOSION_DURATION_MS);
      const alpha = 1 - progress;
      const outerRadius = (8 + EXPLOSION_RADIUS_PX * progress) * this.visualScale();
      const innerRadius = (4 + EXPLOSION_RADIUS_PX * 0.44 * progress) * this.visualScale();
      const screenX = this.worldToScreenX(explosion.x);
      const screenY = this.worldToScreenY(explosion.y);

      graphics.fillStyle(0xff7c3a, 0.42 * alpha);
      graphics.fillCircle(screenX, screenY, outerRadius);
      graphics.fillStyle(0xfff3b0, 0.84 * alpha);
      graphics.fillCircle(screenX, screenY, innerRadius);
    }
  }

  private ensureFullscreenOnInteraction(): void {
    if (this.scale.isFullscreen) {
      return;
    }

    this.scale.startFullscreen();
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
      throw new Error('Background music is not initialized in Pixel Invaders scene.');
    }

    return this.backgroundMusic;
  }

  private readMusicTimeSec(): number {
    const backgroundMusic = this.requireBackgroundMusic();
    if (!isSeekableSound(backgroundMusic)) {
      throw new Error('Pixel Invaders background music does not expose seek time.');
    }

    if (typeof backgroundMusic.seek !== 'number' || !Number.isFinite(backgroundMusic.seek)) {
      throw new Error(`Pixel Invaders background music seek is invalid: ${String(backgroundMusic.seek)}.`);
    }

    return backgroundMusic.seek;
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
}
