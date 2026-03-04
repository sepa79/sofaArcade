import Phaser from 'phaser';
import { RetroSfx } from '@light80/game-sdk';

import enemyShipImage from '../assets/sprite_enemy_1.png';
import explosionSrc1Image from '../assets/explosion_src_1.png';
import explosionSrc2Image from '../assets/explosion_src_2.png';
import backgroundMusicTrack from '../assets/game-bgm.mp3';
import playerShipAltImage from '../assets/sprite_player_1a.png';
import playerShipImage from '../assets/sprite_player_1.png';
import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
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
const ENEMY_SPRITE_KEY = 'pixel-invaders-enemy-ship';
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

export interface PixelInvadersSceneData {
  readonly controllerProfileId: string;
  readonly controllerLabel: string;
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

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function xToStereoPan(x: number): number {
  const centered = (x - WORLD_WIDTH / 2) / (WORLD_WIDTH / 2);
  return Math.max(-1, Math.min(1, centered));
}

function playerXToMotionTheta(x: number): number {
  return xToStereoPan(x) * (Math.PI / 2);
}

export class PixelInvadersScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
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
    this.load.image(ENEMY_SPRITE_KEY, enemyShipImage);
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

    this.graphics = this.add.graphics();
    this.updateLayout();
    this.stars = this.createStars();
    this.playerSprite = this.add.image(this.scale.width / 2, this.scale.height / 2, PLAYER_SPRITE_KEY);
    this.playerSprite.setOrigin(0.5, 0.5);
    this.playerSprite.setScale(PLAYER_SPRITE_SCALE * this.visualScale());

    for (const enemy of this.state.enemies) {
      const sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, ENEMY_SPRITE_KEY);
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

    this.controllerText = this.add.text(20, 52, `CTRL ${this.launchData.controllerLabel}`, {
      fontFamily: 'Trebuchet MS',
      fontSize: '18px',
      color: '#90f0ff'
    });

    this.bannerText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '42px',
      color: '#fff1d8',
      align: 'center'
    });
    this.bannerText.setOrigin(0.5, 0.5);

    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);
    this.cameras.main.setBackgroundColor('#060913');
    this.initializeBackgroundMusic();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sfx.shutdown();
      this.stopBackgroundMusic();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    });
  }

  update(_: number, delta: number): void {
    this.accumulator += delta / 1000;
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
      let nextY = star.y + speed * delta * 0.001;
      if (nextY > WORLD_HEIGHT + 8) {
        nextY = -8;
      }

      return {
        ...star,
        y: nextY
      };
    });

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
    for (const enemy of this.state.enemies) {
      let sprite = this.enemySprites.get(enemy.id);
      if (sprite === undefined) {
        sprite = this.add.image(this.scale.width / 2, this.scale.height / 2, ENEMY_SPRITE_KEY);
        sprite.setOrigin(0.5, 0.5);
        sprite.setScale(ENEMY_SPRITE_SCALE * this.visualScale());
        this.enemySprites.set(enemy.id, sprite);
      }

      if (!enemy.alive) {
        sprite.setVisible(false);
        continue;
      }

      sprite.setVisible(true);
      sprite.setPosition(this.worldToScreenX(enemy.x), this.worldToScreenY(enemy.y));
      sprite.setRotation(ENEMY_SPRITE_ROTATION);
      sprite.setScale(ENEMY_SPRITE_SCALE * this.visualScale());
    }
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
    graphics.fillStyle(0x03070f, 1);
    graphics.fillRect(this.playfieldOffsetX, this.playfieldOffsetY, this.playfieldWidth, this.playfieldHeight);

    for (const star of this.stars) {
      const starSize = Math.max(1, STAR_LAYER_SIZE[star.layer] * this.visualScale());
      const alpha = STAR_LAYER_ALPHA[star.layer];
      graphics.fillStyle(0x9fd8ff, alpha);
      graphics.fillRect(
        Math.round(this.worldToScreenX(star.x)),
        Math.round(this.worldToScreenY(star.y)),
        starSize,
        starSize
      );
    }
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
