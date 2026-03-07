import Phaser from 'phaser';
import {
  RetroSfx,
  getCachedAlphaMaskFromSource,
  getGlobalDebugMode,
  toggleGlobalDebugMode
} from '@light80/game-sdk';
import { loadPersistentNonNegativeInt, savePersistentNonNegativeInt } from '@light80/core';

import enemyShipImage from '../../../shared-assets/src/sprite_enemy_1.png';
import enemyShipImage2 from '../../../shared-assets/src/sprite_enemy_2.png';
import enemyShipImage3 from '../../../shared-assets/src/sprite_enemy_3.png';
import enemyShipImage4 from '../../../shared-assets/src/sprite_enemy_4.png';
import enemyBig1Image from '../../../shared-assets/src/sprite_enemy_big_1.png';
import explosionSrc1Image from '../../../shared-assets/src/explosion_src_1.png';
import explosionSrc2Image from '../../../shared-assets/src/explosion_src_2.png';
import backgroundMusicTrack from '../../../shared-assets/src/game-bgm.mp3';
import backgroundMusicSyncRaw from '../../../shared-assets/src/game-bgm.sync.json';
import kosmicznaPodrozTrack from '../../../shared-assets/src/kosmiczna_podroz_fade_out.ogg';
import kosmicznaPodrozSyncRaw from '../../../shared-assets/src/kosmiczna_podroz_fade_out.sync.json';
import playerShipAltImage from '../../../shared-assets/src/sprite_player_1a.png';
import playerShipImage from '../../../shared-assets/src/sprite_player_1.png';
import {
  SyncClock,
  createSyncTrackRuntime,
  type SyncCurveSample,
  type SyncFrame,
  type SyncTrackRuntime
} from '../audio-sync';
import { readTrackHeaderMetadata, type TrackHeaderMetadata } from '../audio-metadata';
import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  ENEMY_COLS,
  ENEMY_UFO_HIT_POINTS,
  FIXED_TIMESTEP,
  PICKUP_SIZE,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../game/constants';
import {
  createCollisionRuntime,
  createEmptyCollisionDebugFrame,
  mergeAlphaMasks,
  type AlphaMask,
  type CollisionDebugFrame,
  type CollisionRuntime
} from '../game/collision';
import { createInputContext, describeInputContext, inputContextUsesMouseControl, readMatchInput } from '../game/input';
import { stepGame } from '../game/logic';
import { playerLaneWorldY } from '../game/player-lanes';
import { hasActivePowerup, powerupHudLabel } from '../game/powerups';
import { highestPlayerMultiplier, totalPlayerScore } from '../game/score';
import { createInitialState } from '../game/state';
import {
  createMultiplayerGameLaunchData,
  type MultiplayerGameLaunchData
} from '../launch-contract';
import {
  applyTypographyToken,
  HUD_LABEL_TOKEN,
  HINT_TOKEN,
  PROMPT_TOKEN,
  snapUiPixel
} from '../ui/typography';
import type { InputContext } from '../game/input';
import type { Bullet, Enemy, GameState, PickupEntity, PlayerState } from '../game/types';

export const PIXEL_INVADERS_SCENE_KEY = 'pixel-invaders';
const PLAYER_SPRITE_KEY = 'pixel-invaders-player-ship';
const PLAYER_SPRITE_ALT_KEY = 'pixel-invaders-player-ship-alt';
const ENEMY_SPRITE_KEYS = [
  'pixel-invaders-enemy-ship-1',
  'pixel-invaders-enemy-ship-2',
  'pixel-invaders-enemy-ship-3',
  'pixel-invaders-enemy-ship-4'
] as const;
const ENEMY_NORMAL_SPRITE_KEYS = ENEMY_SPRITE_KEYS;
const ENEMY_UFO_SPRITE_KEY = 'pixel-invaders-enemy-big-1';
const EXPLOSION_TEXTURE_KEY_1 = 'pixel-explosion-1';
const EXPLOSION_TEXTURE_KEY_2 = 'pixel-explosion-2';
const EXPLOSION_ANIM_KEY_1 = 'pixel-explosion-anim-1';
const EXPLOSION_ANIM_KEY_2 = 'pixel-explosion-anim-2';
const HIGH_SCORE_STORAGE_KEY = 'pixel-invaders.high-score.v1';
const BACKGROUND_MUSIC_VOLUME = 0.42;
const SONG_BANNER_VISIBLE_MS = 2_600;
const PLAYER_SPRITE_SCALE = 2.1;
const ENEMY_SPRITE_SCALE = 1.5;
const ENEMY_UFO_SCALE_MULTIPLIER = 1.24;
const ENEMY_SPRITE_ROTATION = 0;
const STAR_COUNT = 220;
const STAR_COLORS: readonly number[] = [0x63d6ff, 0xff58d6, 0xffcf5e, 0xa78bff];
const PLAYFIELD_HORIZON_Y_RATIO = 0.79;
const EXPLOSION_FRAME_WIDTH = 24;
const EXPLOSION_FRAME_HEIGHT = 21;
const EXPLOSION_FRAME_COUNT = 10;
const EXPLOSION_ANIMATION_RATE = 28;
const EXPLOSION_SPRITE_SCALE = 1.5;
const EXPLOSION_DURATION_MS = 260;
const EXPLOSION_RADIUS_PX = 44;
const ROW_RESPAWN_FLASH_DURATION_MS = 420;
const ROW_RESPAWN_FLASH_HALF_HEIGHT_PX = 42;
const PLAYER_DEATH_CLUSTER_BURST_COUNT = 3;
const PLAYER_DEATH_CLUSTER_BURST_TOTAL = 7;
const PLAYER_DEATH_CLUSTER_BURST_INTERVAL_MS = 62;
const PLAYER_DEATH_CLUSTER_RADIUS_X = PLAYER_WIDTH * 1.7;
const PLAYER_DEATH_CLUSTER_RADIUS_Y = PLAYER_HEIGHT * 1.9;
const SCORE_MULTIPLIER_PULSE_DURATION_MS = 220;
const SYNC_VIGNETTE_TEXTURE_KEY = 'pixel-invaders-sync-vignette';
const SYNC_VIGNETTE_TEXTURE_SIZE = 512;
const SYNC_VIGNETTE_DEPTH = 900;
const HUD_DEPTH = 1_100;
const PLAYER_LANE_FLASH_DURATION_MS = 220;
const PLAYER_PUSH_FLASH_DURATION_MS = 160;
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
const MUSIC_LANE_PULSE_TRAVEL_BEATS = 1.25;
const MUSIC_LANE_BLOCK_DEPTH = 0.064;
const MUSIC_LANE_CENTER_CLEAR_HALF_WIDTH = 146;
const SKYLINE_BASE_OFFSET_PX = 2;
const SKYLINE_HEIGHT_SCALE = 0.52;
const SKYLINE_ISO_DEPTH_T_BASE = 0.036;
const SKYLINE_ISO_DEPTH_T_BY_DISTANCE = 0.052;
const SKYLINE_ISO_DEPTH_T_BY_WIDTH = 0.11;
const SKYLINE_NEON_COLORS = [
  [86, 236, 255],
  [255, 118, 226],
  [112, 152, 255]
] as const;
interface MusicTrackDefinition {
  readonly id: string;
  readonly audioCacheKey: string;
  readonly binaryCacheKey: string;
  readonly audioSource: string;
  readonly syncRuntime: SyncTrackRuntime;
  readonly syncSource: string;
}

interface MusicTrackRuntime {
  readonly id: string;
  readonly audioCacheKey: string;
  readonly binaryCacheKey: string;
  readonly syncRuntime: SyncTrackRuntime;
  readonly metadata: TrackHeaderMetadata;
}

const MUSIC_TRACK_DEFINITIONS: ReadonlyArray<MusicTrackDefinition> = [
  {
    id: 'pixel-bgm-main',
    audioCacheKey: 'pixel-invaders-background-music-main',
    binaryCacheKey: 'pixel-invaders-background-music-main-bytes',
    audioSource: backgroundMusicTrack,
    syncRuntime: createSyncTrackRuntime(backgroundMusicSyncRaw, 'pixel-invaders.assets.game-bgm.sync.json'),
    syncSource: 'pixel-invaders.assets.game-bgm.mp3'
  },
  {
    id: 'pixel-bgm-kosmiczna-podroz',
    audioCacheKey: 'pixel-invaders-background-music-kosmiczna-podroz',
    binaryCacheKey: 'pixel-invaders-background-music-kosmiczna-podroz-bytes',
    audioSource: kosmicznaPodrozTrack,
    syncRuntime: createSyncTrackRuntime(
      kosmicznaPodrozSyncRaw,
      'pixel-invaders.assets.kosmiczna_podroz_fade_out.sync.json'
    ),
    syncSource: 'pixel-invaders.assets.kosmiczna_podroz_fade_out.ogg'
  }
];
const ZERO_SYNC_CURVE: SyncCurveSample = {
  t: 0,
  low: 0,
  mid: 0,
  high: 0,
  rms: 0
};

interface ExplosionFx {
  readonly x: number;
  readonly y: number;
  readonly startAtMs: number;
}

interface RowRespawnFlashFx {
  readonly y: number;
  readonly startAtMs: number;
}

interface PixelStar {
  readonly x: number;
  readonly y: number;
  readonly speed: number;
  readonly size: number;
  readonly alpha: number;
  readonly color: number;
  readonly twinklePhase: number;
}

interface PixelSkylineBuilding {
  readonly x: number;
  readonly width: number;
  readonly height: number;
  readonly crownHeight: number;
  readonly depth: number;
  readonly style: 0 | 1 | 2;
  readonly patternSeed: number;
  readonly skyscraper: boolean;
}

type MusicLaneBand = 'low' | 'mid' | 'high';

interface MusicLanePulse {
  readonly lane: 0 | 1 | 2 | 3 | 4 | 5;
  readonly band: MusicLaneBand;
  readonly intensity: number;
  readonly progress: number;
}

interface DebugKeys {
  readonly pulseToggle: Phaser.Input.Keyboard.Key;
  readonly guideToggle: Phaser.Input.Keyboard.Key;
  readonly bottomToggle: Phaser.Input.Keyboard.Key;
  readonly backgroundFlashToggle: Phaser.Input.Keyboard.Key;
}

interface RuntimeHotkeys {
  readonly debugToggle: Phaser.Input.Keyboard.Key;
  readonly sfxToggle: Phaser.Input.Keyboard.Key;
  readonly playPause: Phaser.Input.Keyboard.Key;
  readonly previousSong: Phaser.Input.Keyboard.Key;
  readonly nextSong: Phaser.Input.Keyboard.Key;
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

function parseSceneData(rawData: unknown): MultiplayerGameLaunchData {
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Pixel Invaders scene requires launch data object.');
  }

  const data = rawData as Record<string, unknown>;
  if (!Array.isArray(data.playerSlots)) {
    throw new Error('Pixel Invaders scene requires playerSlots array in launch data.');
  }

  return createMultiplayerGameLaunchData(rawData as MultiplayerGameLaunchData);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixColor(fromColor: number, toColor: number, t: number): number {
  const clamped = clamp01(t);
  const from = Phaser.Display.Color.IntegerToColor(fromColor);
  const to = Phaser.Display.Color.IntegerToColor(toColor);
  return Phaser.Display.Color.GetColor(
    Math.round(lerp(from.red, to.red, clamped)),
    Math.round(lerp(from.green, to.green, clamped)),
    Math.round(lerp(from.blue, to.blue, clamped))
  );
}

function ufoDamageTint(hitPoints: number): number | null {
  if (hitPoints === ENEMY_UFO_HIT_POINTS) {
    return null;
  }

  if (hitPoints === ENEMY_UFO_HIT_POINTS - 1) {
    return Phaser.Display.Color.GetColor(255, 205, 118);
  }

  if (hitPoints === ENEMY_UFO_HIT_POINTS - 2) {
    return Phaser.Display.Color.GetColor(255, 115, 152);
  }

  throw new Error(`Invalid UFO hit points for tint mapping: ${hitPoints}.`);
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

function playerColor(playerIndex: number): number {
  const palette: readonly number[] = [0x90f0ff, 0xffc06a, 0xc6ffa4, 0xff8ed8];
  const color = palette[playerIndex];
  if (color === undefined) {
    throw new Error(`Missing player color for playerIndex ${playerIndex}.`);
  }

  return color;
}

function pickupColor(pickup: PickupEntity): number {
  return pickup.kind === 'shield' ? 0x83f6ff : 0xffb870;
}

function playerPowerupSummary(player: PlayerState): string {
  const activeLabels = player.activePowerups.map((powerup) => powerupHudLabel(powerup.kind)).join(' ');
  return activeLabels.length === 0 ? `x${player.scoreMultiplier}` : `x${player.scoreMultiplier} ${activeLabels}`;
}

function activePowerupSignature(player: PlayerState): string {
  return player.activePowerups.map((powerup) => powerup.kind).join('|');
}

function averageLivingPlayerX(players: ReadonlyArray<PlayerState>): number {
  const livingPlayers = players.filter((player) => player.lives > 0);
  if (livingPlayers.length === 0) {
    return WORLD_WIDTH / 2;
  }

  const totalX = livingPlayers.reduce((sum, player) => sum + player.x, 0);
  return totalX / livingPlayers.length;
}

function informationPulse(timeMs: number): number {
  return 0.5 + 0.5 * Math.sin(timeMs * 0.008);
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

function requireKeyboard(scene: Phaser.Scene): Phaser.Input.Keyboard.KeyboardPlugin {
  if (scene.input.keyboard === undefined || scene.input.keyboard === null) {
    throw new Error('Phaser keyboard plugin is required for Pixel Invaders controls.');
  }

  return scene.input.keyboard;
}

function normalizeBinaryBytes(raw: unknown, source: string): Uint8Array {
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw);
  }
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  throw new Error(`${source} did not return binary audio data.`);
}

export class PixelInvadersScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private syncVignette!: Phaser.GameObjects.Image;
  private playerSprites = new Map<number, Phaser.GameObjects.Image>();
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private controllerText!: Phaser.GameObjects.Text;
  private bonusText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private readonly sfx = new RetroSfx();
  private debugModeEnabled = getGlobalDebugMode();
  private runtimeHotkeys!: RuntimeHotkeys;
  private debugKeys: DebugKeys | null = null;
  private backgroundMusic: Phaser.Sound.BaseSound | null = null;
  private musicTracks: ReadonlyArray<MusicTrackRuntime> = [];
  private activeMusicTrackIndex = 0;
  private musicBannerElement: HTMLDivElement | null = null;
  private musicBannerHideAtMs = 0;
  private musicPausedByUser = false;
  private sfxEnabled = true;
  private explosions: ReadonlyArray<ExplosionFx> = [];
  private rowRespawnFlashes: ReadonlyArray<RowRespawnFlashFx> = [];
  private inputContext: InputContext | null = null;
  private collisionRuntime!: CollisionRuntime;
  private collisionDebugFrame: CollisionDebugFrame = createEmptyCollisionDebugFrame();
  private state!: GameState;
  private stars: ReadonlyArray<PixelStar> = [];
  private readonly starRespawnRng = new Phaser.Math.RandomDataGenerator(['pixel-stars-respawn-v1']);
  private skylineBuildings: ReadonlyArray<PixelSkylineBuilding> = [];
  private bassLaneToggle = false;
  private musicLanePulses: ReadonlyArray<MusicLanePulse> = [];
  private debugMusicLanePulsesEnabled = true;
  private debugMusicLaneGuidesEnabled = true;
  private debugBottomVisualsEnabled = true;
  private debugBackgroundFlashEnabled = false;
  private enemyReactiveBursts = new Map<number, EnemyReactiveBurst>();
  private lastHighReactiveEnemyId: number | null = null;
  private lastMidReactiveEnemyId: number | null = null;
  private syncClock: SyncClock | null = null;
  private musicReactive: MusicReactiveState = {
    sectionId: 0,
    curve: ZERO_SYNC_CURVE,
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
  private scoreMultiplierPulseUntilMs = 0;
  private readonly playerLaneFlashUntilMs = new Map<number, number>();
  private readonly playerPushFlashUntilMs = new Map<number, number>();
  private readonly onResize = (): void => {
    this.updateLayout();
  };
  private accumulator = 0;
  private launchData: MultiplayerGameLaunchData | null = null;
  private highScore = 0;

  constructor() {
    super(PIXEL_INVADERS_SCENE_KEY);
  }

  init(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
    this.state = createInitialState(1337, this.launchData.playerSlots.length);
  }

  preload(): void {
    this.load.image(PLAYER_SPRITE_KEY, playerShipImage);
    this.load.image(PLAYER_SPRITE_ALT_KEY, playerShipAltImage);
    this.load.image(ENEMY_SPRITE_KEYS[0], enemyShipImage);
    this.load.image(ENEMY_SPRITE_KEYS[1], enemyShipImage2);
    this.load.image(ENEMY_SPRITE_KEYS[2], enemyShipImage3);
    this.load.image(ENEMY_SPRITE_KEYS[3], enemyShipImage4);
    this.load.image(ENEMY_UFO_SPRITE_KEY, enemyBig1Image);
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
    for (const track of MUSIC_TRACK_DEFINITIONS) {
      this.load.audio(track.audioCacheKey, track.audioSource);
      this.load.binary(track.binaryCacheKey, track.audioSource);
    }
  }

  create(): void {
    if (this.launchData === null) {
      throw new Error('Pixel Invaders launchData is missing in create().');
    }
    const keyboard = requireKeyboard(this);
    this.debugKeys = {
      pulseToggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F7),
      guideToggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F8),
      bottomToggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9),
      backgroundFlashToggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F10)
    };
    this.runtimeHotkeys = {
      debugToggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F6),
      sfxToggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1),
      playPause: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2),
      previousSong: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3),
      nextSong: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F4)
    };

    this.sfx.setMixProfile(this.launchData.audioMixProfileId);
    this.highScore = loadPersistentNonNegativeInt(HIGH_SCORE_STORAGE_KEY) ?? 0;

    this.graphics = this.add.graphics();
    this.updateLayout();
    this.createSyncVignetteTexture();
    this.syncVignette = this.add.image(this.scale.width / 2, this.scale.height / 2, SYNC_VIGNETTE_TEXTURE_KEY);
    this.syncVignette.setOrigin(0.5);
    this.syncVignette.setDepth(SYNC_VIGNETTE_DEPTH);
    this.syncVignette.setAlpha(0);
    this.stars = this.createStars();
    this.skylineBuildings = this.createSkylineBuildings();
    this.collisionRuntime = this.buildCollisionRuntime();
    this.collisionDebugFrame = createEmptyCollisionDebugFrame();
    for (const player of this.state.players) {
      const playerSprite = this.add.image(this.scale.width / 2, this.scale.height / 2, PLAYER_SPRITE_KEY);
      playerSprite.setOrigin(0.5, 0.5);
      playerSprite.setScale(PLAYER_SPRITE_SCALE * this.visualScale());
      playerSprite.setTint(playerColor(player.playerIndex));
      this.playerSprites.set(player.playerIndex, playerSprite);
    }

    for (const enemy of this.state.enemies) {
      const sprite = this.add.image(
        this.scale.width / 2,
        this.scale.height / 2,
        this.enemySpriteKeyFor(enemy)
      );
      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(this.enemySpriteScaleFor(enemy, this.visualScale()));
      this.enemySprites.set(enemy.id, sprite);
    }
    this.setupExplosionAnimations();

    this.scoreText = this.add.text(20, 18, '');
    this.scoreText.setDepth(HUD_DEPTH);

    this.highScoreText = this.add.text(this.scale.width / 2, 18, '');
    this.highScoreText.setOrigin(0.5, 0);
    this.highScoreText.setDepth(HUD_DEPTH);

    this.bonusText = this.add.text(this.scale.width / 2, 52, '');
    this.bonusText.setOrigin(0.5, 0);
    this.bonusText.setDepth(HUD_DEPTH);

    this.livesText = this.add.text(this.scale.width - 20, 18, '');
    this.livesText.setOrigin(1, 0);
    this.livesText.setDepth(HUD_DEPTH);

    this.controllerText = this.add.text(20, 52, '');
    this.controllerText.setOrigin(0, 1);
    this.controllerText.setDepth(HUD_DEPTH);

    this.debugText = this.add.text(this.scale.width - 16, 18, '');
    this.debugText.setOrigin(0, 1);
    this.debugText.setDepth(HUD_DEPTH);

    this.bannerText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, '');
    this.bannerText.setOrigin(0.5, 0.5);
    this.bannerText.setDepth(HUD_DEPTH);

    this.updateLayout();

    this.inputContext = createInputContext(this, this.launchData.playerSlots);
    this.input.setDefaultCursor(inputContextUsesMouseControl(this.inputContext) ? 'none' : 'default');
    this.cameras.main.setBackgroundColor('#060913');
    this.musicTracks = this.readMusicTrackRuntimes();
    this.musicBannerElement = this.createMusicBannerElement();
    this.initializeBackgroundMusic();
    this.musicReactive = applySyncFrame(this.musicReactive, this.requireSyncClock().reset(this.readMusicTimeSec()), 0);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sfx.shutdown();
      this.stopBackgroundMusic();
      if (this.musicBannerElement !== null) {
        this.musicBannerElement.remove();
        this.musicBannerElement = null;
      }
      this.input.setDefaultCursor('default');
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    });
  }

  update(_: number, delta: number): void {
    this.updateHotkeys();
    this.updateMusicBannerVisibility();
    const deltaSeconds = delta * 0.001;
    this.accumulator += deltaSeconds;
    const playerShotXs: number[] = [];
    let enemyShot = false;
    let enemyShotX = averageLivingPlayerX(this.state.players);
    const playerHitPoints: Array<{ readonly x: number; readonly y: number }> = [];
    let lost = false;
    let maxMoveSpeedUnit = 0;
    const destroyedEnemies: Enemy[] = [];
    const respawnedRows = new Set<number>();
    let frameCollisionDebug: CollisionDebugFrame | null = null;

    while (this.accumulator >= FIXED_TIMESTEP) {
      const input = this.readControlInput();
      const hasInteraction = input.players.some(
        (player) =>
          player.input.firePressed ||
          player.input.restartPressed ||
          player.input.moveAxisSigned !== 0 ||
          player.input.moveAbsoluteUnit !== null
      );
      if (hasInteraction) {
        this.ensureFullscreenOnInteraction();
        this.startBackgroundMusic();
        this.sfx.unlock();
      }

      const previous = this.state;
      const step = stepGame(this.state, input, FIXED_TIMESTEP, {
        collisionRuntime: this.collisionRuntime,
        captureCollisionDebug: this.debugModeEnabled
      });
      const next = step.state;
      frameCollisionDebug = step.collisionDebug;

      const previousPlayerBulletCounts = new Map<number, number>();
      for (const bullet of previous.bullets) {
        if (bullet.owner !== 'player') {
          continue;
        }
        if (bullet.playerIndex === null) {
          throw new Error('Player-owned bullet is missing playerIndex in previous state.');
        }

        previousPlayerBulletCounts.set(
          bullet.playerIndex,
          (previousPlayerBulletCounts.get(bullet.playerIndex) ?? 0) + 1
        );
      }
      const nextPlayerBulletsByPlayerIndex = new Map<number, Bullet[]>();
      for (const bullet of next.bullets) {
        if (bullet.owner !== 'player') {
          continue;
        }
        if (bullet.playerIndex === null) {
          throw new Error('Player-owned bullet is missing playerIndex in next state.');
        }

        const playerBullets = nextPlayerBulletsByPlayerIndex.get(bullet.playerIndex) ?? [];
        playerBullets.push(bullet);
        nextPlayerBulletsByPlayerIndex.set(bullet.playerIndex, playerBullets);
      }
      const previousEnemyBullets = previous.bullets.filter((bullet) => bullet.owner === 'enemy').length;
      const nextEnemyBullets = next.bullets.filter((bullet) => bullet.owner === 'enemy').length;

      for (const [playerIndex, playerBullets] of nextPlayerBulletsByPlayerIndex.entries()) {
        const previousCount = previousPlayerBulletCounts.get(playerIndex) ?? 0;
        const spawnedCount = playerBullets.length - previousCount;
        if (spawnedCount <= 0) {
          continue;
        }

        const spawnedBullets = playerBullets
          .slice()
          .sort((left, right) => Math.abs(right.vy) - Math.abs(left.vy) || right.y - left.y)
          .slice(0, spawnedCount);
        for (const bullet of spawnedBullets) {
          playerShotXs.push(bullet.x);
        }
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
      const previousEnemyById = new Map<number, Enemy>();
      for (const previousEnemy of previous.enemies) {
        previousEnemyById.set(previousEnemy.id, previousEnemy);
      }
      for (const nextEnemy of next.enemies) {
        const previousEnemy = previousEnemyById.get(nextEnemy.id);
        if (previousEnemy === undefined) {
          throw new Error(`Missing previous enemy state for id ${nextEnemy.id}.`);
        }
        if (!previousEnemy.alive && nextEnemy.alive) {
          respawnedRows.add(Math.floor(nextEnemy.id / ENEMY_COLS));
        }
      }
      for (const previousPlayer of previous.players) {
        const nextPlayer = next.players.find((player) => player.playerIndex === previousPlayer.playerIndex);
        if (nextPlayer === undefined) {
          throw new Error(`Missing next player state for playerIndex ${previousPlayer.playerIndex}.`);
        }
        if (nextPlayer.lives < previousPlayer.lives) {
          playerHitPoints.push({
            x: previousPlayer.x,
            y: playerLaneWorldY(previousPlayer.lane)
          });
        }
        if (nextPlayer.lane !== previousPlayer.lane) {
          this.playerLaneFlashUntilMs.set(nextPlayer.playerIndex, this.time.now + PLAYER_LANE_FLASH_DURATION_MS);
        }
        if (
          nextPlayer.lives === previousPlayer.lives &&
          Math.abs(nextPlayer.pushbackVelocityX) > Math.abs(previousPlayer.pushbackVelocityX) + 12
        ) {
          this.playerPushFlashUntilMs.set(nextPlayer.playerIndex, this.time.now + PLAYER_PUSH_FLASH_DURATION_MS);
        }
        if (
          nextPlayer.lives === previousPlayer.lives &&
          Math.abs(nextPlayer.x - previousPlayer.x) > PLAYER_SPEED * FIXED_TIMESTEP + 1
        ) {
          this.playerPushFlashUntilMs.set(nextPlayer.playerIndex, this.time.now + PLAYER_PUSH_FLASH_DURATION_MS);
        }
        if (
          nextPlayer.scoreMultiplier !== previousPlayer.scoreMultiplier ||
          activePowerupSignature(nextPlayer) !== activePowerupSignature(previousPlayer)
        ) {
          this.scoreMultiplierPulseUntilMs = this.time.now + SCORE_MULTIPLIER_PULSE_DURATION_MS;
        }
      }
      if (previous.phase === 'playing' && next.phase === 'lost') {
        lost = true;
      }
      for (const previousPlayer of previous.players) {
        const nextPlayer = next.players.find((player) => player.playerIndex === previousPlayer.playerIndex);
        if (nextPlayer === undefined) {
          throw new Error(`Missing moved player state for playerIndex ${previousPlayer.playerIndex}.`);
        }
        const moveSpeedUnit = Math.min(
          1,
          Math.abs(nextPlayer.x - previousPlayer.x) / (PLAYER_SPEED * FIXED_TIMESTEP)
        );
        maxMoveSpeedUnit = Math.max(maxMoveSpeedUnit, moveSpeedUnit);
      }

      this.state = next;
      this.accumulator -= FIXED_TIMESTEP;
    }
    this.collisionDebugFrame = frameCollisionDebug ?? createEmptyCollisionDebugFrame();
    for (const row of respawnedRows) {
      this.spawnRowRespawnFlash(row);
    }

    this.stars = this.stars.map((star) => {
      let nextY = star.y + star.speed * deltaSeconds;
      let nextX = star.x;
      if (nextY > WORLD_HEIGHT + 6) {
        nextY = -6;
        nextX = this.starRespawnRng.realInRange(0, WORLD_WIDTH);
      }

      return {
        ...star,
        x: nextX,
        y: nextY
      };
    });
    this.updateMusicReactive(deltaSeconds);
    const totalScore = totalPlayerScore(this.state.players);
    if (totalScore > this.highScore) {
      this.highScore = totalScore;
      savePersistentNonNegativeInt(HIGH_SCORE_STORAGE_KEY, this.highScore);
    }

    for (const playerShotX of playerShotXs.slice(0, 2)) {
      if (!this.sfxEnabled) {
        continue;
      }
      this.sfx.playPlayerShot({ pan: xToStereoPan(playerShotX), depth: 0 });
    }
    if (this.sfxEnabled && enemyShot) {
      this.sfx.playEnemyShot({ pan: xToStereoPan(enemyShotX), depth: 0 });
    }
    for (const enemy of destroyedEnemies.slice(0, 3)) {
      if (this.sfxEnabled) {
        this.sfx.playExplosion({ pan: xToStereoPan(enemy.x), depth: 0, large: false });
      }
      this.spawnExplosion(enemy.x, enemy.y);
    }
    for (const playerHitPoint of playerHitPoints.slice(0, 2)) {
      if (this.sfxEnabled) {
        this.sfx.playPlayerHit({ pan: xToStereoPan(playerHitPoint.x), depth: 0 });
      }
      this.spawnPlayerDeathCluster(playerHitPoint.x, playerHitPoint.y);
    }
    if (this.sfxEnabled && lost) {
      this.sfx.playLose();
    }
    this.sfx.updateTunnelMotion({
      theta: playerXToMotionTheta(averageLivingPlayerX(this.state.players)),
      speedUnit: maxMoveSpeedUnit,
      active: this.sfxEnabled && this.state.phase === 'playing' && maxMoveSpeedUnit > 0.02
    });
    this.updateExplosions();

    this.renderState();
  }

  private readControlInput() {
    if (this.inputContext === null) {
      throw new Error('Input context is missing for Pixel Invaders.');
    }

    return readMatchInput(this, this.inputContext, {
      minX: this.playfieldOffsetX,
      maxX: this.playfieldOffsetX + this.playfieldWidth,
      minY: this.playfieldOffsetY,
      maxY: this.playfieldOffsetY + this.playfieldHeight
    });
  }

  private renderState(): void {
    const graphics = this.graphics;
    graphics.clear();

    this.drawBackground(graphics);
    this.drawRowRespawnFlashes(graphics);
    this.syncPlayerSprites();
    this.syncEnemySprites();
    this.drawPlayers(graphics);
    this.drawEnemies();
    this.drawPickups(graphics);
    this.drawBullets(graphics);
    this.drawCollisionDebug(graphics);
    this.drawExplosions(graphics);
    this.drawHud();
    this.drawBanner();
  }

  private buildCollisionRuntime(): CollisionRuntime {
    const playerMaskPrimary = this.readTextureAlphaMask(PLAYER_SPRITE_KEY);
    const playerMaskAlt = this.readTextureAlphaMask(PLAYER_SPRITE_ALT_KEY);
    return createCollisionRuntime({
      playerMask: mergeAlphaMasks(playerMaskPrimary, playerMaskAlt),
      enemySmallMasks: [
        this.readTextureAlphaMask(ENEMY_SPRITE_KEYS[0]),
        this.readTextureAlphaMask(ENEMY_SPRITE_KEYS[1]),
        this.readTextureAlphaMask(ENEMY_SPRITE_KEYS[2]),
        this.readTextureAlphaMask(ENEMY_SPRITE_KEYS[3])
      ],
      enemyBig1Mask: this.readTextureAlphaMask(ENEMY_UFO_SPRITE_KEY)
    });
  }

  private readTextureAlphaMask(textureKey: string): AlphaMask {
    const texture = this.textures.get(textureKey);
    const sourceImage = texture.getSourceImage() as (CanvasImageSource & { readonly width: number; readonly height: number }) | null;
    if (sourceImage === null) {
      throw new Error(`Texture source image is missing for key "${textureKey}".`);
    }
    const cached = getCachedAlphaMaskFromSource(sourceImage, 10);
    return {
      width: cached.width,
      height: cached.height,
      alpha: cached.alpha
    };
  }

  private drawPlayers(graphics: Phaser.GameObjects.Graphics): void {
    const visualScale = this.visualScale();
    const playerTextureKey = Math.floor(this.time.now / 120) % 2 === 0 ? PLAYER_SPRITE_KEY : PLAYER_SPRITE_ALT_KEY;

    for (const player of this.state.players) {
      const playerSprite = this.playerSprites.get(player.playerIndex);
      if (playerSprite === undefined) {
        throw new Error(`Player sprite is missing for playerIndex ${player.playerIndex}.`);
      }

      const blink = player.respawnTimer > 0 && Math.floor(this.time.now / 100) % 2 === 0;
      if (blink || player.lives <= 0) {
        playerSprite.setVisible(false);
        continue;
      }

      const laneFlashActive = (this.playerLaneFlashUntilMs.get(player.playerIndex) ?? 0) > this.time.now;
      const pushFlashActive = (this.playerPushFlashUntilMs.get(player.playerIndex) ?? 0) > this.time.now;
      const laneY = playerLaneWorldY(player.lane);
      const pushTilt = Math.max(-0.18, Math.min(0.18, player.pushbackVelocityX / 900));
      const displayScale =
        PLAYER_SPRITE_SCALE *
        visualScale *
        (pushFlashActive ? 1.05 : laneFlashActive ? 1.03 : 1);

      playerSprite.setVisible(true);
      if (playerSprite.texture.key !== playerTextureKey) {
        playerSprite.setTexture(playerTextureKey);
      }
      playerSprite.setTint(
        pushFlashActive
          ? mixColor(playerColor(player.playerIndex), 0xffffff, 0.38)
          : laneFlashActive
            ? mixColor(playerColor(player.playerIndex), 0xffdd9c, 0.32)
            : playerColor(player.playerIndex)
      );
      playerSprite.setPosition(this.worldToScreenX(player.x), this.worldToScreenY(laneY));
      playerSprite.setRotation(pushTilt);
      playerSprite.setScale(displayScale);

      if (hasActivePowerup(player, 'shield')) {
        const centerX = Math.round(this.worldToScreenX(player.x));
        const centerY = Math.round(this.worldToScreenY(laneY));
        const auraPulse = 0.5 + Math.sin(this.time.now * 0.01 + player.playerIndex * 0.8) * 0.5;
        const auraRadius = Math.max(16, Math.round((PLAYER_WIDTH * 0.48 + auraPulse * 5) * visualScale));
        const auraCoreRadius = Math.max(12, auraRadius - Math.max(3, Math.round(visualScale * 3)));
        const auraThickness = Math.max(2, Math.round(visualScale * 2));

        graphics.fillStyle(0x83f6ff, 0.08 + auraPulse * 0.06);
        graphics.fillCircle(centerX, centerY, auraCoreRadius);
        graphics.lineStyle(auraThickness, 0xb8fbff, 0.85);
        graphics.strokeCircle(centerX, centerY, auraRadius);
        graphics.lineStyle(Math.max(1, auraThickness - 1), 0x3bdcff, 0.6);
        graphics.strokeCircle(centerX, centerY, Math.max(8, auraRadius - auraThickness * 2));
      }
    }
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
        sprite.setScale(this.enemySpriteScaleFor(enemy, this.visualScale()));
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
      const baseTint = enemy.kind === 'ufo' ? ufoDamageTint(enemy.hitPoints) : null;

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
        const finalTint = baseTint === null ? tintColor : mixColor(baseTint, tintColor, 0.5);
        sprite.setTint(finalTint);
      } else {
        if (baseTint === null) {
          sprite.clearTint();
        } else {
          sprite.setTint(baseTint);
        }
      }

      sprite.setPosition(spriteX, spriteY);
      sprite.setRotation(rotation);
      sprite.setScale(this.enemySpriteScaleFor(enemy, visualScale));
    }
  }

  private enemySpriteKeyFor(enemy: Enemy): (typeof ENEMY_SPRITE_KEYS)[number] | typeof ENEMY_UFO_SPRITE_KEY {
    if (enemy.kind === 'ufo') {
      return ENEMY_UFO_SPRITE_KEY;
    }

    const rowIndex = Math.floor(enemy.id / ENEMY_COLS);
    const keyCount = ENEMY_NORMAL_SPRITE_KEYS.length;
    const index = ((rowIndex % keyCount) + keyCount) % keyCount;
    const spriteKey = ENEMY_NORMAL_SPRITE_KEYS[index];
    if (spriteKey === undefined) {
      throw new Error(`Enemy sprite key is missing for index ${index}.`);
    }

    return spriteKey;
  }

  private enemySpriteScaleFor(enemy: Enemy, visualScale: number): number {
    const multiplier = enemy.kind === 'ufo' ? ENEMY_UFO_SCALE_MULTIPLIER : 1;
    return ENEMY_SPRITE_SCALE * multiplier * visualScale;
  }

  private drawBullets(graphics: Phaser.GameObjects.Graphics): void {
    const shotPixelSize = Math.max(1, Math.round(2 * this.visualScale()));

    for (const bullet of this.state.bullets) {
      const snapRect = (
        centerX: number,
        centerY: number,
        width: number,
        height: number
      ): Readonly<{ x: number; y: number; width: number; height: number }> => ({
        x: Math.round((centerX - width / 2) / shotPixelSize) * shotPixelSize,
        y: Math.round((centerY - height / 2) / shotPixelSize) * shotPixelSize,
        width,
        height
      });

      if (bullet.owner === 'enemy') {
        const centerX = this.worldToScreenX(bullet.x);
        const centerY = this.worldToScreenY(bullet.y);
        const bodyWidth = Math.max(shotPixelSize * 2, Math.round(BULLET_WIDTH * this.playfieldScaleX));
        const bodyHeight = Math.max(shotPixelSize * 5, Math.round(BULLET_HEIGHT * this.playfieldScaleY));
        const glowRect = snapRect(centerX, centerY, bodyWidth + shotPixelSize * 2, bodyHeight + shotPixelSize * 2);
        const outerRect = snapRect(centerX, centerY, bodyWidth, bodyHeight);
        const middleRect = snapRect(centerX, centerY - shotPixelSize, Math.max(shotPixelSize, bodyWidth - shotPixelSize * 2), Math.max(shotPixelSize * 3, bodyHeight - shotPixelSize * 4));
        const coreRect = snapRect(centerX, centerY - shotPixelSize * 2, Math.max(shotPixelSize, bodyWidth - shotPixelSize * 3), Math.max(shotPixelSize * 2, bodyHeight - shotPixelSize * 7));
        const tailRect = snapRect(centerX, centerY + bodyHeight * 0.18, Math.max(shotPixelSize, bodyWidth - shotPixelSize), Math.max(shotPixelSize * 2, Math.round(bodyHeight * 0.28)));

        graphics.fillStyle(0xff8e66, 0.14);
        graphics.fillRect(glowRect.x, glowRect.y, glowRect.width, glowRect.height);
        graphics.fillStyle(0xffa852, 0.92);
        graphics.fillRect(outerRect.x, outerRect.y, outerRect.width, outerRect.height);
        graphics.fillStyle(0xffd56e, 0.96);
        graphics.fillRect(middleRect.x, middleRect.y, middleRect.width, middleRect.height);
        graphics.fillStyle(0xfff3ba, 1);
        graphics.fillRect(coreRect.x, coreRect.y, coreRect.width, coreRect.height);
        graphics.fillStyle(0xff6b58, 0.82);
        graphics.fillRect(tailRect.x, tailRect.y, tailRect.width, tailRect.height);
        continue;
      }

      const color = bullet.playerIndex === null ? 0xfff6b2 : playerColor(bullet.playerIndex);
      const glowColor = mixColor(color, 0xffffff, 0.24);
      const coreColor = mixColor(color, 0xffffff, 0.56);
      const trailColor = mixColor(color, 0x0f1630, 0.18);
      const headX = this.worldToScreenX(bullet.x);
      const headY = this.worldToScreenY(bullet.y);
      const bodyWidth = Math.max(shotPixelSize * 2, Math.round(BULLET_WIDTH * this.playfieldScaleX));
      const bodyHeight = Math.max(shotPixelSize * 5, Math.round(BULLET_HEIGHT * this.playfieldScaleY));
      const glowRect = snapRect(headX, headY - shotPixelSize, bodyWidth + shotPixelSize * 2, bodyHeight + shotPixelSize * 3);
      const bodyRect = snapRect(headX, headY - shotPixelSize, bodyWidth, bodyHeight);
      const coreRect = snapRect(headX, headY - shotPixelSize * 2, Math.max(shotPixelSize, bodyWidth - shotPixelSize * 2), Math.max(shotPixelSize * 3, bodyHeight - shotPixelSize * 4));
      const trailTopRect = snapRect(headX, headY + bodyHeight * 0.46, Math.max(shotPixelSize, bodyWidth - shotPixelSize), Math.max(shotPixelSize * 2, Math.round(bodyHeight * 0.34)));
      const trailBottomRect = snapRect(headX, headY + bodyHeight * 0.82, Math.max(shotPixelSize, bodyWidth - shotPixelSize * 2), Math.max(shotPixelSize * 2, Math.round(bodyHeight * 0.24)));
      const noseLeftX = Math.round(headX - bodyWidth / 2);
      const noseRightX = Math.round(headX + bodyWidth / 2);
      const noseBaseY = Math.round(headY - bodyHeight / 2 + shotPixelSize);
      const noseTipY = Math.round(noseBaseY - shotPixelSize * 2);

      graphics.fillStyle(glowColor, 0.18);
      graphics.fillRect(glowRect.x, glowRect.y, glowRect.width, glowRect.height);
      graphics.fillStyle(color, 0.96);
      graphics.fillRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      graphics.fillStyle(coreColor, 1);
      graphics.fillRect(coreRect.x, coreRect.y, coreRect.width, coreRect.height);
      graphics.fillStyle(trailColor, 0.88);
      graphics.fillRect(trailTopRect.x, trailTopRect.y, trailTopRect.width, trailTopRect.height);
      graphics.fillStyle(glowColor, 0.76);
      graphics.fillRect(trailBottomRect.x, trailBottomRect.y, trailBottomRect.width, trailBottomRect.height);
      graphics.fillStyle(coreColor, 1);
      graphics.fillTriangle(
        Math.round(headX),
        noseTipY,
        noseLeftX,
        noseBaseY,
        noseRightX,
        noseBaseY
      );
    }
  }

  private drawPickups(graphics: Phaser.GameObjects.Graphics): void {
    const visualScale = this.visualScale();
    const outerSize = Math.max(8, Math.round(PICKUP_SIZE * visualScale));
    const innerSize = Math.max(4, outerSize - Math.max(4, Math.round(visualScale * 4)));

    for (const pickup of this.state.pickups) {
      const centerX = Math.round(this.worldToScreenX(pickup.x));
      const centerY = Math.round(this.worldToScreenY(pickup.y));
      const baseColor = pickupColor(pickup);
      const coreColor = mixColor(baseColor, 0xffffff, 0.5);
      const shadowColor = mixColor(baseColor, 0x091120, 0.7);

      graphics.fillStyle(baseColor, 0.16);
      graphics.fillCircle(centerX, centerY, outerSize * 0.9);
      graphics.fillStyle(shadowColor, 0.92);
      graphics.fillRect(centerX - outerSize / 2, centerY - outerSize / 2, outerSize, outerSize);
      graphics.fillStyle(baseColor, 0.98);
      graphics.fillTriangle(
        centerX,
        centerY - outerSize / 2,
        centerX + outerSize / 2,
        centerY,
        centerX,
        centerY + outerSize / 2
      );
      graphics.fillTriangle(
        centerX,
        centerY - outerSize / 2,
        centerX - outerSize / 2,
        centerY,
        centerX,
        centerY + outerSize / 2
      );
      graphics.fillStyle(coreColor, 1);
      graphics.fillRect(centerX - innerSize / 2, centerY - innerSize / 2, innerSize, innerSize);
    }
  }

  private drawCollisionDebug(graphics: Phaser.GameObjects.Graphics): void {
    if (!this.debugModeEnabled) {
      return;
    }

    const broad = this.collisionDebugFrame.broadPhaseEnvelopes;
    if (broad.length > 0) {
      for (const envelope of broad) {
        const color = envelope.owner === 'player' ? 0x65f2ff : 0xffa65b;
        graphics.lineStyle(1, color, 0.62);
        graphics.strokeRect(
          this.worldToScreenX(envelope.centerX - envelope.width / 2),
          this.worldToScreenY(envelope.centerY - envelope.height / 2),
          envelope.width * this.playfieldScaleX,
          envelope.height * this.playfieldScaleY
        );
      }
    }

    const narrow = this.collisionDebugFrame.narrowPhaseMarkers;
    for (const marker of narrow) {
      const color = marker.owner === 'player' ? 0xc9ffff : 0xffd1b0;
      const x = this.worldToScreenX(marker.x);
      const y = this.worldToScreenY(marker.y);
      graphics.fillStyle(color, 0.95);
      graphics.fillCircle(x, y, Math.max(2, Math.round(this.visualScale() * 2.8)));
      graphics.lineStyle(1, 0xffffff, 0.5);
      graphics.strokeCircle(x, y, Math.max(3, Math.round(this.visualScale() * 4.8)));
    }
  }

  private drawHud(): void {
    if (this.launchData === null) {
      throw new Error('Pixel Invaders launchData is missing in drawHud().');
    }
    const totalScore = totalPlayerScore(this.state.players);
    const playerScoreLines = this.state.players
      .map((player) => `P${player.playerIndex + 1} ${player.score.toString().padStart(6, '0')}`)
      .join('\n');
    const playerBonusSummary = this.state.players
      .map((player) => playerPowerupSummary(player))
      .join('\n');
    this.scoreText.setPosition(snapUiPixel(this.playfieldOffsetX + 20), snapUiPixel(this.playfieldOffsetY + 18));
    this.highScoreText.setPosition(
      snapUiPixel(this.playfieldOffsetX + this.playfieldWidth * 0.5),
      snapUiPixel(this.playfieldOffsetY + 18)
    );
    this.livesText.setPosition(
      snapUiPixel(this.playfieldOffsetX + this.playfieldWidth - 20),
      snapUiPixel(this.playfieldOffsetY + 18)
    );
    this.controllerText.setPosition(
      snapUiPixel(this.playfieldOffsetX + 20),
      snapUiPixel(this.playfieldOffsetY + this.playfieldHeight - 18)
    );
    this.scoreText.setText(
      this.state.players.length === 1
        ? `SCORE ${this.state.players[0]?.score.toString().padStart(6, '0')}`
        : playerScoreLines
    );
    this.highScoreText.setText(`TOTAL ${totalScore.toString().padStart(6, '0')}\nHI ${this.highScore.toString().padStart(6, '0')}`);
    if (this.state.players.length === 1) {
      const singlePlayer = this.state.players[0];
      if (singlePlayer === undefined) {
        throw new Error('Single-player HUD expected player state at index 0.');
      }
      this.bonusText.setText(playerPowerupSummary(singlePlayer));
    } else {
      this.bonusText.setText(playerBonusSummary);
    }
    this.bonusText.setOrigin(0, 0);
    this.bonusText.setPosition(
      snapUiPixel(this.scoreText.getTopRight().x + 28),
      snapUiPixel(this.scoreText.y)
    );
    if (this.state.players.length === 1) {
      const singlePlayer = this.state.players[0];
      if (singlePlayer === undefined) {
        throw new Error('Single-player HUD expected player state at index 0.');
      }
      this.livesText.setText(`LIVES ${singlePlayer.lives}`);
    } else {
      this.livesText.setText(
        this.state.players.map((player) => `P${player.playerIndex + 1}:${player.lives}`).join('  ')
      );
    }
    if (this.inputContext === null) {
      throw new Error('Input context is missing in drawHud().');
    }

    this.controllerText.setText(`CTRL ${describeInputContext(this.inputContext)}`);
    const infoPulse = informationPulse(this.time.now);
    const hudPulse = clamp01(
      this.musicReactive.beatPulse * 0.85 + this.musicReactive.barPulse + this.musicReactive.midOnsetPulse * 0.65
    );
    const scoreColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(244, 255, hudPulse)),
      Math.round(lerp(247, 231, hudPulse)),
      Math.round(lerp(255, 232, hudPulse))
    );
    const highScoreColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(214, 255, hudPulse)),
      Math.round(lerp(222, 248, hudPulse)),
      Math.round(lerp(255, 255, hudPulse))
    );
    const controllerColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(144, 210, hudPulse)),
      Math.round(lerp(240, 248, hudPulse)),
      Math.round(lerp(255, 255, hudPulse))
    );
    const bonusPulse = clamp01(hudPulse * 0.6 + highestPlayerMultiplier(this.state.players) / 14);
    const bonusColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(255, 255, bonusPulse)),
      Math.round(lerp(215, 144, bonusPulse)),
      Math.round(lerp(168, 106, bonusPulse))
    );
    const multiplierPulse = Math.max(0, (this.scoreMultiplierPulseUntilMs - this.time.now) / SCORE_MULTIPLIER_PULSE_DURATION_MS);
    const multiplierScale = 1 + multiplierPulse * 0.18;
    const multiplierAlpha = 0.82 + multiplierPulse * 0.18;
    this.scoreText.setTint(scoreColor);
    this.highScoreText.setTint(highScoreColor);
    this.livesText.setTint(scoreColor);
    this.controllerText.setTint(controllerColor);
    this.bonusText.setTint(bonusColor);
    this.scoreText.setScale(1);
    this.bonusText.setScale(multiplierScale);
    this.scoreText.setAlpha(1);
    this.bonusText.setAlpha(multiplierAlpha);
    this.controllerText.setAlpha(this.state.phase === 'playing' ? 0.94 : 0.72 + infoPulse * 0.28);
    if (!this.debugModeEnabled) {
      this.debugText.setText('');
      return;
    }

    this.debugText.setPosition(
      snapUiPixel(this.playfieldOffsetX + 16),
      snapUiPixel(this.playfieldOffsetY + this.playfieldHeight - 16)
    );
    this.debugText.setText(
      `DEBUG MODE [F6]\nPULSES [F7]: ${this.debugMusicLanePulsesEnabled ? 'ON' : 'OFF'}\nLANES [F8]: ${this.debugMusicLaneGuidesEnabled ? 'ON' : 'OFF'}\nBOTTOM [F9]: ${this.debugBottomVisualsEnabled ? 'ON' : 'OFF'}\nBG FLASH [F10]: ${this.debugBackgroundFlashEnabled ? 'ON' : 'OFF'}\nCOLLISION B/N: ${this.collisionDebugFrame.broadPhaseEnvelopes.length}/${this.collisionDebugFrame.narrowPhaseMarkers.length}`
    );
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

  private syncPlayerSprites(): void {
    const activePlayerIndices = new Set(this.state.players.map((player) => player.playerIndex));
    for (const [playerIndex, sprite] of this.playerSprites.entries()) {
      if (activePlayerIndices.has(playerIndex)) {
        continue;
      }

      sprite.destroy();
      this.playerSprites.delete(playerIndex);
    }
  }

  private drawBanner(): void {
    this.bannerText.setPosition(
      snapUiPixel(this.worldToScreenX(WORLD_WIDTH / 2)),
      snapUiPixel(this.worldToScreenY(WORLD_HEIGHT / 2 - 40))
    );
    const pulse = informationPulse(this.time.now);

    if (this.state.phase === 'playing') {
      this.bannerText.setText('');
      this.bannerText.setAlpha(1);
      this.bannerText.setScale(1);
      return;
    }

    if (this.state.phase === 'ready') {
      this.bannerText.setText('PRESS FIRE TO START');
      this.bannerText.setAlpha(0.74 + pulse * 0.26);
      this.bannerText.setTint(mixColor(0xffd9a8, 0xffffff, pulse));
      this.bannerText.setScale(1.55);
      return;
    }

    this.bannerText.setText('GAME OVER\nPRESS ENTER');
    this.bannerText.setAlpha(0.76 + pulse * 0.24);
    this.bannerText.setTint(mixColor(0xffc4a1, 0xfff7df, pulse));
    this.bannerText.setScale(1.75);
  }

  private updateLayout(): void {
    this.playfieldOffsetX = 0;
    this.playfieldOffsetY = 0;
    this.playfieldWidth = Math.max(1, this.scale.width);
    this.playfieldHeight = Math.max(1, this.scale.height);
    this.playfieldScaleX = this.playfieldWidth / WORLD_WIDTH;
    this.playfieldScaleY = this.playfieldHeight / WORLD_HEIGHT;

    if (this.syncVignette !== undefined) {
      this.syncVignette.setPosition(snapUiPixel(this.scale.width / 2), snapUiPixel(this.scale.height / 2));
      this.syncVignette.setDisplaySize(this.playfieldWidth * 1.45, this.playfieldHeight * 1.45);
    }

    this.updateTextStyles();
  }

  private updateTextStyles(): void {
    if (this.scoreText === undefined) {
      return;
    }

    const uiScale = this.visualScale();
    applyTypographyToken(this.scoreText, HUD_LABEL_TOKEN, uiScale);
    applyTypographyToken(this.highScoreText, HUD_LABEL_TOKEN, uiScale);
    applyTypographyToken(this.bonusText, HUD_LABEL_TOKEN, uiScale);
    applyTypographyToken(this.livesText, HUD_LABEL_TOKEN, uiScale);
    applyTypographyToken(this.controllerText, HINT_TOKEN, uiScale);
    applyTypographyToken(this.debugText, HINT_TOKEN, uiScale);
    applyTypographyToken(this.bannerText, PROMPT_TOKEN, uiScale);
    this.highScoreText.setAlign('center');
    this.bonusText.setAlign('left');
    this.livesText.setAlign('right');
    this.debugText.setAlign('left');
    this.bannerText.setAlign('center');
  }

  private createStars(): ReadonlyArray<PixelStar> {
    const rng = new Phaser.Math.RandomDataGenerator(['launcher-stars-v5']);
    const stars: PixelStar[] = [];
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const starColor = STAR_COLORS[Math.floor(rng.realInRange(0, STAR_COLORS.length))];
      if (starColor === undefined) {
        throw new Error(`Pixel Invaders star color is missing for index ${i}.`);
      }
      stars.push({
        x: rng.realInRange(0, WORLD_WIDTH),
        y: rng.realInRange(0, WORLD_HEIGHT),
        speed: rng.realInRange(8, 44),
        size: rng.realInRange(1, 3),
        alpha: rng.realInRange(0.25, 1),
        color: starColor,
        twinklePhase: rng.realInRange(0, Math.PI * 2)
      });
    }

    return stars;
  }

  private createSkylineBuildings(): ReadonlyArray<PixelSkylineBuilding> {
    const rng = new Phaser.Math.RandomDataGenerator(['pixel-skyline-v1']);
    const buildings: PixelSkylineBuilding[] = [];
    let x = -26;
    const centerMinX = WORLD_WIDTH / 2 - MUSIC_LANE_CENTER_CLEAR_HALF_WIDTH;
    const centerMaxX = WORLD_WIDTH / 2 + MUSIC_LANE_CENTER_CLEAR_HALF_WIDTH;

    while (x < WORLD_WIDTH + 26) {
      const skyscraper = rng.realInRange(0, 1) > 0.88;
      const width = skyscraper ? rng.integerInRange(14, 28) : rng.integerInRange(18, 56);
      const baseHeight = skyscraper ? rng.integerInRange(208, 340) : rng.integerInRange(58, 182);
      const towerHeightBoost = skyscraper ? rng.integerInRange(0, 48) : rng.realInRange(0, 1) > 0.88 ? rng.integerInRange(34, 96) : 0;
      const height = Math.min(360, baseHeight + towerHeightBoost);
      const depth = skyscraper ? rng.realInRange(0.52, 1) : rng.realInRange(0.32, 1);
      const style = rng.integerInRange(0, 2) as 0 | 1 | 2;
      const crownHeight = skyscraper
        ? Math.min(48, Math.max(7, Math.round(height * rng.realInRange(0.08, 0.16))))
        : Math.min(26, Math.max(5, Math.round(height * rng.realInRange(0.08, 0.2))));
      const buildingLeft = x;
      const buildingRight = x + width;
      const intersectsCenterClear = buildingRight > centerMinX && buildingLeft < centerMaxX;
      if (intersectsCenterClear) {
        x += width + (skyscraper ? rng.integerInRange(10, 24) : rng.integerInRange(4, 14));
        continue;
      }
      buildings.push({
        x: x + width / 2,
        width,
        height,
        crownHeight,
        depth,
        style,
        patternSeed: rng.integerInRange(0, 8192),
        skyscraper
      });
      x += width + (skyscraper ? rng.integerInRange(10, 24) : rng.integerInRange(4, 14));
    }

    return buildings.sort((a, b) => a.depth - b.depth || a.x - b.x);
  }

  private drawBackground(graphics: Phaser.GameObjects.Graphics): void {
    const curve = this.musicReactive.curve;
    const sectionAccent = this.debugBackgroundFlashEnabled ? this.musicReactive.sectionId % 3 : 0;
    const rhythmPulse = clamp01(this.musicReactive.beatPulse * 0.8 + this.musicReactive.barPulse);
    const lowEnergy = clamp01(curve.low * 0.72 + curve.rms * 0.35 + this.musicReactive.lowOnsetPulse * 0.9);
    const bgEnergy = this.debugBackgroundFlashEnabled
      ? clamp01(0.12 + lowEnergy * 0.45 + rhythmPulse * 0.5)
      : 0.16;
    const bgColor = Phaser.Display.Color.GetColor(
      Math.round(lerp(3, 14 + sectionAccent * 2, bgEnergy)),
      Math.round(lerp(7, 18 + sectionAccent * 4, bgEnergy)),
      Math.round(lerp(15, 34 + sectionAccent * 6, bgEnergy))
    );
    graphics.fillStyle(bgColor, 1);
    graphics.fillRect(this.playfieldOffsetX, this.playfieldOffsetY, this.playfieldWidth, this.playfieldHeight);

    const starCutoffY = this.debugBottomVisualsEnabled
      ? WORLD_HEIGHT * PLAYFIELD_HORIZON_Y_RATIO - 1
      : WORLD_HEIGHT + 8;
    for (const star of this.stars) {
      if (star.y > starCutoffY) {
        continue;
      }
      const twinkle = 0.65 + 0.35 * Math.sin(this.time.now * 0.003 + star.x * 0.02 + star.twinklePhase);
      const starSize = Math.max(1, star.size * this.visualScale());
      graphics.fillStyle(star.color, star.alpha * twinkle);
      graphics.fillRect(
        Math.round(this.worldToScreenX(star.x)),
        Math.round(this.worldToScreenY(star.y)),
        starSize,
        starSize
      );
    }

    if (this.debugBottomVisualsEnabled) {
      this.drawSkyline(graphics);
      this.drawBottomGrid(graphics);
    }
  }


  private updateMusicReactive(deltaSeconds: number): void {
    const backgroundMusic = this.requireBackgroundMusic();
    const syncClock = this.requireSyncClock();
    const nowSec = this.readMusicTimeSec();
    const playbackState = backgroundMusic.isPlaying ? 'playing' : 'paused';
    const syncFrame = syncClock.tick(nowSec, playbackState);
    this.updateMusicLanePulses(syncFrame, deltaSeconds);
    this.musicReactive = applySyncFrame(this.musicReactive, syncFrame, deltaSeconds);
    this.updateEnemyReactiveBursts(syncFrame, deltaSeconds);

    const blinkPulse = clamp01(
      this.musicReactive.lowOnsetPulse * 0.9 +
        this.musicReactive.beatPulse * 0.7 +
        this.musicReactive.barPulse * 0.9
    );
    const vignetteAlpha = this.debugBackgroundFlashEnabled
      ? clamp01(0.06 + this.musicReactive.curve.low * 0.2 + this.musicReactive.curve.rms * 0.08 + blinkPulse * 0.42)
      : 0;
    this.syncVignette.setAlpha(vignetteAlpha);
  }

  private updateMusicLanePulses(syncFrame: SyncFrame, deltaSeconds: number): void {
    const pulseSpeedPerSecond = (this.activeMusicTrackBpm() / 60) / MUSIC_LANE_PULSE_TRAVEL_BEATS;
    let strongestLowOnset = 0;
    let strongestMidOnset = 0;
    let strongestHighOnset = 0;
    for (const onsetEvent of syncFrame.onsets) {
      if (onsetEvent.band === 'low') {
        strongestLowOnset = Math.max(strongestLowOnset, onsetEvent.strength);
        continue;
      }
      if (onsetEvent.band === 'mid') {
        strongestMidOnset = Math.max(strongestMidOnset, onsetEvent.strength);
        continue;
      }
      strongestHighOnset = Math.max(strongestHighOnset, onsetEvent.strength);
    }

    const lowEnergy = clamp01(syncFrame.curve.low * 0.72 + strongestLowOnset * 0.68);
    const midEnergy = clamp01(syncFrame.curve.mid * 0.64 + strongestMidOnset * 0.72);
    const highEnergy = clamp01(syncFrame.curve.high * 0.66 + strongestHighOnset * 0.74);
    const nextPulses: MusicLanePulse[] = [];

    for (const pulse of this.musicLanePulses) {
      const nextProgress = pulse.progress + pulseSpeedPerSecond * deltaSeconds;
      if (nextProgress >= 1.02) {
        continue;
      }

      nextPulses.push({
        ...pulse,
        progress: nextProgress
      });
    }

    for (const beatEvent of syncFrame.beats) {
      this.bassLaneToggle = !this.bassLaneToggle;
      const bassLane: 2 | 3 = this.bassLaneToggle ? 3 : 2;
      const laneSpecs: ReadonlyArray<Readonly<{ lane: 0 | 1 | 2 | 3 | 4 | 5; band: MusicLaneBand; intensity: number }>> = [
        { lane: 0, band: 'high', intensity: clamp01(highEnergy * 0.88 + beatEvent.strength * 0.24) },
        { lane: 1, band: 'mid', intensity: clamp01(midEnergy * 0.92 + beatEvent.strength * 0.2) },
        { lane: bassLane, band: 'low', intensity: clamp01(lowEnergy * 1 + beatEvent.strength * 0.26) },
        { lane: 4, band: 'mid', intensity: clamp01(midEnergy * 0.92 + beatEvent.strength * 0.2) },
        { lane: 5, band: 'high', intensity: clamp01(highEnergy * 0.88 + beatEvent.strength * 0.24) }
      ];

      for (const laneSpec of laneSpecs) {
        if (laneSpec.intensity < 0.18) {
          continue;
        }
        nextPulses.push({
          lane: laneSpec.lane,
          band: laneSpec.band,
          intensity: laneSpec.intensity,
          progress: 0
        });
      }
    }

    this.musicLanePulses = nextPulses;
  }

  private drawBottomGrid(graphics: Phaser.GameObjects.Graphics): void {
    const width = this.playfieldWidth;
    const height = this.playfieldHeight;
    const horizonY = this.playfieldOffsetY + Math.floor(height * PLAYFIELD_HORIZON_Y_RATIO);
    const nearestY = this.playfieldOffsetY + height + 2;
    const travelRange = nearestY - horizonY;
    const spacing = travelRange / BOTTOM_GRID_LINE_COUNT;
    const flowOffset = ((this.time.now * BOTTOM_GRID_FLOW_SPEED_PX_PER_SEC) / 1000) % spacing;
    const centerX = this.playfieldOffsetX + width / 2;
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

    this.drawMusicLaneFlow(graphics, horizonY, nearestY, centerX);

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

    this.drawLaneSourceLights(graphics, horizonY, centerX);
  }

  private musicLaneEnergyByBand(): Readonly<Record<MusicLaneBand, number>> {
    return {
      low: clamp01(
        this.musicReactive.curve.low * 0.62 +
          this.musicReactive.lowOnsetPulse * 0.96 +
          this.musicReactive.beatPulse * 0.58 +
          this.musicReactive.barPulse * 0.26
      ),
      mid: clamp01(
        this.musicReactive.curve.mid * 0.64 +
          this.musicReactive.midOnsetPulse * 0.92 +
          this.musicReactive.beatPulse * 0.28 +
          this.musicReactive.barPulse * 0.36
      ),
      high: clamp01(
        this.musicReactive.curve.high * 0.68 +
          this.musicReactive.highOnsetPulse * 0.95 +
          this.musicReactive.beatPulse * 0.24 +
          this.musicReactive.barPulse * 0.22
      )
    };
  }

  private drawMusicLaneFlow(
    graphics: Phaser.GameObjects.Graphics,
    horizonY: number,
    nearestY: number,
    centerX: number
  ): void {
    const laneStartIndices = [-3, -2, -1, 0, 1, 2] as const;
    const laneBands = ['high', 'mid', 'low', 'low', 'mid', 'high'] as const;
    const laneBrightColors: Readonly<Record<MusicLaneBand, number>> = {
      low: Phaser.Display.Color.GetColor(255, 84, 104),
      mid: Phaser.Display.Color.GetColor(209, 124, 252),
      high: Phaser.Display.Color.GetColor(120, 232, 255)
    };
    const laneNeutralColors: Readonly<Record<MusicLaneBand, number>> = {
      low: Phaser.Display.Color.GetColor(126, 74, 84),
      mid: Phaser.Display.Color.GetColor(104, 88, 128),
      high: Phaser.Display.Color.GetColor(72, 102, 120)
    };
    const laneEnergies = this.musicLaneEnergyByBand();
    const travelRange = nearestY - horizonY;
    const lineX = (lineIndex: number, depth: number): number => {
      const xTop = centerX + lineIndex * BOTTOM_GRID_TOP_SPACING;
      const xBottom = centerX + lineIndex * BOTTOM_GRID_TOP_SPACING * BOTTOM_GRID_BOTTOM_SPREAD;
      return lerp(xTop, xBottom, depth);
    };

    if (this.debugMusicLaneGuidesEnabled) {
      for (let lane = 0; lane < laneStartIndices.length; lane += 1) {
        const lineStart = laneStartIndices[lane];
        if (lineStart === undefined) {
          throw new Error(`Lane start index missing for lane ${lane}.`);
        }
        const band = laneBands[lane];
        if (band === undefined) {
          throw new Error(`Lane band missing for lane ${lane}.`);
        }
        const lineEnd = lineStart + 1;
        const laneColor = laneNeutralColors[band];
        const laneEnergy = laneEnergies[band];
        const breathing = 0.5 + 0.5 * Math.sin(this.time.now * 0.0032 + lane * 0.8);
        const xLeftTop = lineX(lineStart, 0);
        const xRightTop = lineX(lineEnd, 0);
        const xLeftBottom = lineX(lineStart, 1);
        const xRightBottom = lineX(lineEnd, 1);
        const laneAlpha = clamp01(0.03 + laneEnergy * 0.12 + breathing * 0.028);
        graphics.fillStyle(laneColor, laneAlpha);
        graphics.beginPath();
        graphics.moveTo(xLeftTop, horizonY);
        graphics.lineTo(xRightTop, horizonY);
        graphics.lineTo(xRightBottom, nearestY);
        graphics.lineTo(xLeftBottom, nearestY);
        graphics.closePath();
        graphics.fillPath();
      }
    }

    if (!this.debugMusicLanePulsesEnabled) {
      return;
    }

    for (const pulse of this.musicLanePulses) {
      const lineStart = laneStartIndices[pulse.lane];
      if (lineStart === undefined) {
        throw new Error(`Lane start index missing for lane ${pulse.lane}.`);
      }
      const brightColor = laneBrightColors[pulse.band];
      const neutralColor = laneNeutralColors[pulse.band];
      const t0 = clamp01(pulse.progress);
      const t1 = clamp01(pulse.progress + MUSIC_LANE_BLOCK_DEPTH);
      if (t1 <= t0) {
        continue;
      }
      const y0 = horizonY + travelRange * t0;
      const y1 = horizonY + travelRange * t1;
      const xLeft0 = lineX(lineStart, t0);
      const xRight0 = lineX(lineStart + 1, t0);
      const xLeft1 = lineX(lineStart, t1);
      const xRight1 = lineX(lineStart + 1, t1);
      const tMid = (t0 + t1) * 0.5;
      const entryFlash = Math.exp(-pulse.progress * 14);
      const release = 1 - entryFlash;
      const tileColor = mixColor(brightColor, neutralColor, release);
      const alpha = clamp01(0.12 + pulse.intensity * 0.36) * lerp(0.45, 0.75, tMid);
      const glowAlpha = clamp01(0.06 + pulse.intensity * 0.2 + entryFlash * 0.58);
      const expandPx = Math.max(1, Math.round(lerp(7, 2, tMid) * this.visualScale()));

      graphics.fillStyle(brightColor, glowAlpha * 0.5);
      graphics.beginPath();
      graphics.moveTo(xLeft0 - expandPx, y0);
      graphics.lineTo(xRight0 + expandPx, y0);
      graphics.lineTo(xRight1 + expandPx, y1);
      graphics.lineTo(xLeft1 - expandPx, y1);
      graphics.closePath();
      graphics.fillPath();

      graphics.fillStyle(tileColor, alpha);
      graphics.beginPath();
      graphics.moveTo(xLeft0, y0);
      graphics.lineTo(xRight0, y0);
      graphics.lineTo(xRight1, y1);
      graphics.lineTo(xLeft1, y1);
      graphics.closePath();
      graphics.fillPath();

      graphics.lineStyle(
        Math.max(1, Math.round(this.visualScale() * 2)),
        brightColor,
        clamp01(0.1 + entryFlash * 0.7)
      );
      graphics.beginPath();
      graphics.moveTo(xLeft0, y0);
      graphics.lineTo(xRight0, y0);
      graphics.lineTo(xRight1, y1);
      graphics.lineTo(xLeft1, y1);
      graphics.closePath();
      graphics.strokePath();
    }
  }

  private drawLaneSourceLights(
    graphics: Phaser.GameObjects.Graphics,
    horizonY: number,
    centerX: number
  ): void {
    const laneCenters = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] as const;
    const laneBands = ['high', 'mid', 'low', 'low', 'mid', 'high'] as const;
    const brightColors: Readonly<Record<MusicLaneBand, number>> = {
      low: Phaser.Display.Color.GetColor(255, 84, 104),
      mid: Phaser.Display.Color.GetColor(209, 124, 252),
      high: Phaser.Display.Color.GetColor(120, 232, 255)
    };
    const laneEnergies = this.musicLaneEnergyByBand();
    const sourceY = horizonY + Math.max(2, Math.round(2 * this.visualScale()));

    for (let lane = 0; lane < laneCenters.length; lane += 1) {
      const laneCenter = laneCenters[lane];
      if (laneCenter === undefined) {
        throw new Error(`Lane center index missing for lane ${lane}.`);
      }
      const band = laneBands[lane];
      if (band === undefined) {
        throw new Error(`Lane band missing for lane source ${lane}.`);
      }

      const laneX = centerX + laneCenter * BOTTOM_GRID_TOP_SPACING;
      const bandEnergy = laneEnergies[band];
      let flashBoost = 0;
      for (const pulse of this.musicLanePulses) {
        if (pulse.lane !== lane) {
          continue;
        }
        if (pulse.progress > 0.12) {
          continue;
        }
        flashBoost = Math.max(flashBoost, (0.12 - pulse.progress) / 0.12 * pulse.intensity);
      }

      const brightness = clamp01(bandEnergy * 0.72 + flashBoost * 0.84);
      if (brightness < 0.05) {
        continue;
      }

      const color = brightColors[band];
      const coreWidth = Math.max(2, Math.round(11 * this.visualScale()));
      const coreHeight = Math.max(1, Math.round(4 * this.visualScale()));
      const glowWidth = Math.max(8, Math.round(coreWidth * (1.8 + brightness * 0.8)));
      const glowHeight = Math.max(5, Math.round(coreHeight * (2.2 + brightness * 0.7)));
      graphics.fillStyle(color, clamp01(0.06 + brightness * 0.36));
      graphics.fillEllipse(laneX, sourceY + coreHeight * 0.25, glowWidth, glowHeight);
      graphics.fillStyle(color, clamp01(0.22 + brightness * 0.56));
      graphics.fillRect(
        Math.round(laneX - coreWidth / 2),
        Math.round(sourceY - coreHeight / 2),
        coreWidth,
        coreHeight
      );
      graphics.lineStyle(Math.max(1, Math.round(this.visualScale() * 1.5)), color, clamp01(0.2 + brightness * 0.48));
      graphics.strokeRect(
        Math.round(laneX - coreWidth / 2),
        Math.round(sourceY - coreHeight / 2),
        coreWidth,
        coreHeight
      );
    }
  }

  private drawSkyline(graphics: Phaser.GameObjects.Graphics): void {
    const width = this.playfieldWidth;
    const height = this.playfieldHeight;
    const horizonY = this.playfieldOffsetY + Math.floor(height * PLAYFIELD_HORIZON_Y_RATIO);
    const baseY = horizonY + SKYLINE_BASE_OFFSET_PX * this.playfieldScaleY;
    const vanishX = this.playfieldOffsetX + width * 0.5;
    const glowPulse = clamp01(
      this.musicReactive.curve.low * 0.26 +
        this.musicReactive.curve.mid * 0.16 +
        this.musicReactive.lowOnsetPulse * 0.2 +
        this.musicReactive.barPulse * 0.32
    );

    const projectToVanish = (x: number, y: number, depthT: number): Readonly<{ x: number; y: number }> => ({
      x: lerp(x, vanishX, depthT),
      y: lerp(y, horizonY, depthT)
    });

    const drawQueue = this.skylineBuildings
      .map((building) => {
        const centerX = this.worldToScreenX(building.x);
        const buildingWidth = Math.max(3, Math.round(building.width * this.playfieldScaleX));
        const buildingHeight = Math.max(4, Math.round(building.height * this.playfieldScaleY * SKYLINE_HEIGHT_SCALE));
        const crownHeight = Math.max(2, Math.round(building.crownHeight * this.playfieldScaleY * SKYLINE_HEIGHT_SCALE));
        const left = Math.round(centerX - buildingWidth / 2);
        const right = left + buildingWidth;
        const top = Math.round(baseY - buildingHeight);
        return {
          building,
          centerX,
          buildingWidth,
          buildingHeight,
          crownHeight,
          left,
          right,
          top,
          centerDistance: Math.abs(centerX - vanishX)
        };
      })
      .filter((entry) => !(entry.left > this.playfieldOffsetX + width + 40 || entry.right < this.playfieldOffsetX - 40))
      .sort((a, b) => {
        if (a.centerDistance !== b.centerDistance) {
          return b.centerDistance - a.centerDistance;
        }
        if (a.building.depth !== b.building.depth) {
          return a.building.depth - b.building.depth;
        }
        return a.centerX - b.centerX;
      });

    for (const entry of drawQueue) {
      const building = entry.building;
      const centerX = entry.centerX;
      const buildingWidth = entry.buildingWidth;
      const buildingHeight = entry.buildingHeight;
      const crownHeight = entry.crownHeight;
      const left = entry.left;
      const right = entry.right;
      const top = entry.top;

      const [neonR, neonG, neonB] = SKYLINE_NEON_COLORS[building.style];
      const colorVisibility = 0.62;
      const dim = (value: number): number => Math.round(lerp(4, value, colorVisibility));
      const edgeColor = Phaser.Display.Color.GetColor(neonR, neonG, neonB);
      const bodyColor = Phaser.Display.Color.GetColor(
        dim(lerp(6, neonR * 0.2, building.depth)),
        dim(lerp(7, neonG * 0.16, building.depth)),
        dim(lerp(16, neonB * 0.24, building.depth))
      );
      const topColor = Phaser.Display.Color.GetColor(
        dim(lerp(26, neonR * 0.46, building.depth)),
        dim(lerp(22, neonG * 0.4, building.depth)),
        dim(lerp(40, neonB * 0.54, building.depth))
      );
      const sideColor = Phaser.Display.Color.GetColor(
        dim(lerp(10, neonR * 0.24, building.depth)),
        dim(lerp(9, neonG * 0.2, building.depth)),
        dim(lerp(24, neonB * 0.3, building.depth))
      );
      const depthT = clamp01(
        SKYLINE_ISO_DEPTH_T_BASE +
          building.depth * SKYLINE_ISO_DEPTH_T_BY_DISTANCE +
          (buildingWidth / Math.max(1, width)) * SKYLINE_ISO_DEPTH_T_BY_WIDTH
      );
      const backTopLeft = projectToVanish(left, top, depthT);
      const backTopRight = projectToVanish(right, top, depthT);
      const backBaseLeft = projectToVanish(left, baseY, depthT);
      const backBaseRight = projectToVanish(right, baseY, depthT);
      const showRightSide = centerX <= vanishX;
      const visibilityAlpha = 1;

      graphics.fillStyle(topColor, visibilityAlpha);
      graphics.beginPath();
      graphics.moveTo(left, top);
      graphics.lineTo(right, top);
      graphics.lineTo(backTopRight.x, backTopRight.y);
      graphics.lineTo(backTopLeft.x, backTopLeft.y);
      graphics.closePath();
      graphics.fillPath();

      graphics.fillStyle(sideColor, visibilityAlpha);
      if (showRightSide) {
        graphics.beginPath();
        graphics.moveTo(right, top);
        graphics.lineTo(right, baseY);
        graphics.lineTo(backBaseRight.x, backBaseRight.y);
        graphics.lineTo(backTopRight.x, backTopRight.y);
        graphics.closePath();
        graphics.fillPath();
      } else {
        graphics.beginPath();
        graphics.moveTo(left, top);
        graphics.lineTo(left, baseY);
        graphics.lineTo(backBaseLeft.x, backBaseLeft.y);
        graphics.lineTo(backTopLeft.x, backTopLeft.y);
        graphics.closePath();
        graphics.fillPath();
      }

      graphics.fillStyle(bodyColor, visibilityAlpha);
      graphics.fillRect(left, top, buildingWidth, buildingHeight);

      const crownWidth = Math.max(2, Math.round(buildingWidth * 0.72));
      const crownLeft = Math.round(centerX - crownWidth / 2);
      const crownRight = crownLeft + crownWidth;
      const crownTop = top - crownHeight;
      const crownDepthT = depthT * 0.86;
      const crownBackTopLeft = projectToVanish(crownLeft, crownTop, crownDepthT);
      const crownBackTopRight = projectToVanish(crownRight, crownTop, crownDepthT);
      graphics.fillStyle(topColor, visibilityAlpha);
      graphics.beginPath();
      graphics.moveTo(crownLeft, crownTop);
      graphics.lineTo(crownRight, crownTop);
      graphics.lineTo(crownBackTopRight.x, crownBackTopRight.y);
      graphics.lineTo(crownBackTopLeft.x, crownBackTopLeft.y);
      graphics.closePath();
      graphics.fillPath();

      graphics.fillStyle(bodyColor, visibilityAlpha);
      graphics.fillRect(crownLeft, crownTop, crownWidth, crownHeight);

      const glowWidth = Math.max(1, Math.round(3 * this.visualScale()));
      graphics.lineStyle(glowWidth, edgeColor, (0.018 + glowPulse * 0.024) * (0.35 + building.depth * 0.45));
      graphics.strokeRect(left, top, buildingWidth, buildingHeight);
      graphics.lineStyle(Math.max(1, Math.round(1 * this.visualScale())), edgeColor, 0.08 + glowPulse * 0.08);
      graphics.strokeRect(left, top, buildingWidth, buildingHeight);
      graphics.beginPath();
      graphics.moveTo(left, top);
      graphics.lineTo(backTopLeft.x, backTopLeft.y);
      graphics.lineTo(backTopRight.x, backTopRight.y);
      graphics.lineTo(right, top);
      graphics.strokePath();
      if (showRightSide) {
        graphics.beginPath();
        graphics.moveTo(right, top);
        graphics.lineTo(backTopRight.x, backTopRight.y);
        graphics.moveTo(right, baseY);
        graphics.lineTo(backBaseRight.x, backBaseRight.y);
        graphics.strokePath();
      } else {
        graphics.beginPath();
        graphics.moveTo(left, top);
        graphics.lineTo(backTopLeft.x, backTopLeft.y);
        graphics.moveTo(left, baseY);
        graphics.lineTo(backBaseLeft.x, backBaseLeft.y);
        graphics.strokePath();
      }

      const windowStepX = Math.max(4, Math.round((5 + building.depth * 2.2) * this.playfieldScaleX));
      const windowStepY = Math.max(5, Math.round((8 + building.depth * 2.2) * this.playfieldScaleY));
      const windowWidth = Math.max(1, Math.round(windowStepX * 0.42));
      const windowHeight = Math.max(1, Math.round(windowStepY * 0.44));
      const startX = left + Math.max(1, Math.round(3 * this.playfieldScaleX));
      const startY = top + Math.max(2, Math.round(6 * this.playfieldScaleY));
      const maxX = left + buildingWidth - windowWidth - Math.max(1, Math.round(3 * this.playfieldScaleX));
      const maxY = top + buildingHeight - windowHeight - Math.max(1, Math.round(4 * this.playfieldScaleY));
      const skylineWindowPatternIntervalSec = 240 / this.activeMusicTrackBpm();
      const patternPhase =
        (Math.floor(this.readMusicTimeSec() / skylineWindowPatternIntervalSec) + building.patternSeed) % 19;
      const windowAlphaBase = clamp01(0.08 + building.depth * 0.2 + glowPulse * 0.12);

      let row = 0;
      for (let y = startY; y <= maxY; y += windowStepY) {
        let col = 0;
        for (let x = startX; x <= maxX; x += windowStepX) {
          const patternValue = (row * 13 + col * 17 + patternPhase + building.patternSeed) % 23;
          if (patternValue <= 8) {
            const lightAlpha = windowAlphaBase * (0.7 + (patternValue % 3) * 0.12);
            graphics.fillStyle(edgeColor, Math.min(1, lightAlpha));
            graphics.fillRect(x, y, windowWidth, windowHeight);
          }
          col += 1;
        }
        row += 1;
      }

      if (building.skyscraper) {
        const spineWidth = Math.max(1, Math.round(buildingWidth * 0.08));
        const spineX = Math.round(centerX - spineWidth / 2);
        graphics.fillStyle(edgeColor, 0.08 + glowPulse * 0.12);
        graphics.fillRect(spineX, top + Math.max(2, Math.round(this.playfieldScaleY * 3)), spineWidth, Math.max(4, buildingHeight - 6));
        const antennaHeight = Math.max(8, Math.round(16 * this.playfieldScaleY));
        graphics.lineStyle(Math.max(1, Math.round(1 * this.visualScale())), edgeColor, 0.2 + glowPulse * 0.12);
        graphics.beginPath();
        graphics.moveTo(centerX, crownTop);
        graphics.lineTo(centerX, crownTop - antennaHeight);
        graphics.strokePath();
        graphics.fillStyle(edgeColor, 0.28 + glowPulse * 0.14);
        graphics.fillCircle(centerX, crownTop - antennaHeight, Math.max(1, Math.round(this.visualScale() * 2)));
      }
    }
  }

  private updateHotkeys(): void {
    if (Phaser.Input.Keyboard.JustDown(this.runtimeHotkeys.debugToggle)) {
      this.debugModeEnabled = toggleGlobalDebugMode();
      this.showSongBanner(this.debugModeEnabled ? 'DEBUG MODE ON' : 'DEBUG MODE OFF');
    }
    if (this.debugModeEnabled) {
      this.updateDebugHotkeys();
      return;
    }
    this.updateRuntimeHotkeys();
  }

  private updateDebugHotkeys(): void {
    const debugKeys = this.debugKeys;
    if (debugKeys === null) {
      throw new Error('Debug hotkeys are missing while debug mode is enabled.');
    }
    if (Phaser.Input.Keyboard.JustDown(debugKeys.pulseToggle)) {
      this.debugMusicLanePulsesEnabled = !this.debugMusicLanePulsesEnabled;
    }
    if (Phaser.Input.Keyboard.JustDown(debugKeys.guideToggle)) {
      this.debugMusicLaneGuidesEnabled = !this.debugMusicLaneGuidesEnabled;
    }
    if (Phaser.Input.Keyboard.JustDown(debugKeys.bottomToggle)) {
      this.debugBottomVisualsEnabled = !this.debugBottomVisualsEnabled;
    }
    if (Phaser.Input.Keyboard.JustDown(debugKeys.backgroundFlashToggle)) {
      this.debugBackgroundFlashEnabled = !this.debugBackgroundFlashEnabled;
    }
  }

  private updateRuntimeHotkeys(): void {
    if (Phaser.Input.Keyboard.JustDown(this.runtimeHotkeys.sfxToggle)) {
      this.toggleSfxEnabled();
    }
    if (Phaser.Input.Keyboard.JustDown(this.runtimeHotkeys.playPause)) {
      this.toggleMusicPlayback();
    }
    if (Phaser.Input.Keyboard.JustDown(this.runtimeHotkeys.previousSong)) {
      this.cycleMusicTrack(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.runtimeHotkeys.nextSong)) {
      this.cycleMusicTrack(1);
    }
  }

  private toggleSfxEnabled(): void {
    this.sfxEnabled = !this.sfxEnabled;
    this.showSongBanner(this.sfxEnabled ? 'SFX ON' : 'SFX OFF');
  }

  private toggleMusicPlayback(): void {
    const backgroundMusic = this.requireBackgroundMusic();
    if (backgroundMusic.isPlaying) {
      this.musicPausedByUser = true;
      backgroundMusic.pause();
      this.showSongBanner('MSX PAUSE');
      return;
    }
    this.musicPausedByUser = false;
    backgroundMusic.resume();
    this.showSongBanner('MSX PLAY');
  }

  private cycleMusicTrack(step: -1 | 1): void {
    const trackCount = this.musicTracks.length;
    if (trackCount <= 0) {
      throw new Error('Music track list is empty.');
    }
    const nextIndex = (this.activeMusicTrackIndex + step + trackCount) % trackCount;
    this.switchMusicTrack(nextIndex, true);
  }

  private updateMusicBannerVisibility(): void {
    if (this.musicBannerElement === null) {
      return;
    }
    if (this.musicBannerHideAtMs > 0 && this.time.now >= this.musicBannerHideAtMs) {
      this.musicBannerElement.classList.remove('is-visible');
      this.musicBannerHideAtMs = 0;
    }
  }

  private showSongBanner(label: string): void {
    if (this.musicBannerElement === null) {
      throw new Error('Music banner overlay is not initialized.');
    }
    this.musicBannerElement.textContent = label;
    this.musicBannerElement.classList.add('is-visible');
    this.musicBannerHideAtMs = this.time.now + SONG_BANNER_VISIBLE_MS;
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

  private spawnPlayerDeathCluster(centerX: number, centerY: number): void {
    this.spawnExplosion(centerX, centerY);
    for (let burstIndex = 0; burstIndex < PLAYER_DEATH_CLUSTER_BURST_TOTAL; burstIndex += 1) {
      this.time.delayedCall(burstIndex * PLAYER_DEATH_CLUSTER_BURST_INTERVAL_MS, () => {
        for (let explosionIndex = 0; explosionIndex < PLAYER_DEATH_CLUSTER_BURST_COUNT; explosionIndex += 1) {
          const jitterX = Phaser.Math.FloatBetween(-PLAYER_DEATH_CLUSTER_RADIUS_X, PLAYER_DEATH_CLUSTER_RADIUS_X);
          const jitterY = Phaser.Math.FloatBetween(-PLAYER_DEATH_CLUSTER_RADIUS_Y, PLAYER_DEATH_CLUSTER_RADIUS_Y);
          const explosionX = Phaser.Math.Clamp(centerX + jitterX, 0, WORLD_WIDTH);
          const explosionY = Phaser.Math.Clamp(centerY + jitterY, 0, WORLD_HEIGHT);
          this.spawnExplosion(explosionX, explosionY);
        }

        if (this.sfxEnabled) {
          this.sfx.playExplosion({
            pan: xToStereoPan(centerX),
            depth: 0,
            large: burstIndex % 2 === 0
          });
        }
      });
    }
  }

  private spawnRowRespawnFlash(row: number): void {
    const rowEnemies = this.state.enemies.filter(
      (enemy) => enemy.alive && Math.floor(enemy.id / ENEMY_COLS) === row
    );
    if (rowEnemies.length === 0) {
      throw new Error(`Cannot create row respawn flash for empty row ${row}.`);
    }

    this.rowRespawnFlashes = this.rowRespawnFlashes.concat({
      y: rowEnemies[0].y,
      startAtMs: this.time.now
    });

    let rowCenterX = 0;
    for (const enemy of rowEnemies) {
      rowCenterX += enemy.x;
      if (enemy.id % 3 !== 0) {
        continue;
      }
      this.spawnExplosion(enemy.x, enemy.y);
    }
    rowCenterX /= rowEnemies.length;
    if (this.sfxEnabled) {
      this.sfx.playExplosion({ pan: xToStereoPan(rowCenterX), depth: 0, large: true });
    }
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
    this.rowRespawnFlashes = this.rowRespawnFlashes.filter(
      (flash) => now - flash.startAtMs < ROW_RESPAWN_FLASH_DURATION_MS
    );
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

  private drawRowRespawnFlashes(graphics: Phaser.GameObjects.Graphics): void {
    for (const flash of this.rowRespawnFlashes) {
      const progress = clamp01((this.time.now - flash.startAtMs) / ROW_RESPAWN_FLASH_DURATION_MS);
      if (progress >= 1) {
        continue;
      }
      const fade = 1 - progress;
      const reactiveEnergy = clamp01(this.musicReactive.beatPulse * 0.34 + this.musicReactive.barPulse * 0.42);
      const color = mixColor(0x70e6ff, 0xff7ad8, progress * 0.58 + reactiveEnergy * 0.16);
      const centerY = this.worldToScreenY(flash.y);
      const halfHeight = Math.max(
        4,
        Math.round((6 + ROW_RESPAWN_FLASH_HALF_HEIGHT_PX * progress) * this.visualScale())
      );
      const top = Math.round(centerY - halfHeight);
      const bandHeight = Math.max(1, halfHeight * 2);

      graphics.fillStyle(color, clamp01(0.03 + fade * 0.24));
      graphics.fillRect(this.playfieldOffsetX, top, this.playfieldWidth, bandHeight);
      graphics.lineStyle(
        Math.max(1, Math.round(this.visualScale() * 2)),
        color,
        clamp01(0.06 + fade * 0.5 + reactiveEnergy * 0.2)
      );
      graphics.beginPath();
      graphics.moveTo(this.playfieldOffsetX, top);
      graphics.lineTo(this.playfieldOffsetX + this.playfieldWidth, top);
      graphics.moveTo(this.playfieldOffsetX, top + bandHeight);
      graphics.lineTo(this.playfieldOffsetX + this.playfieldWidth, top + bandHeight);
      graphics.strokePath();
    }
  }

  private ensureFullscreenOnInteraction(): void {
    if (this.scale.isFullscreen) {
      return;
    }

    this.scale.startFullscreen();
  }

  private readMusicTrackRuntimes(): ReadonlyArray<MusicTrackRuntime> {
    const tracks: MusicTrackRuntime[] = [];
    for (const definition of MUSIC_TRACK_DEFINITIONS) {
      if (!this.cache.audio.exists(definition.audioCacheKey)) {
        throw new Error(`Missing audio asset for key "${definition.audioCacheKey}".`);
      }
      const rawBytes: unknown = this.cache.binary.get(definition.binaryCacheKey);
      if (rawBytes === null || rawBytes === undefined) {
        throw new Error(`Missing binary audio header data for key "${definition.binaryCacheKey}".`);
      }
      const bytes = normalizeBinaryBytes(rawBytes, definition.syncSource);
      const metadata = readTrackHeaderMetadata(bytes, definition.syncSource);
      const firstCurve = definition.syncRuntime.track.curves.samples[0];
      if (firstCurve === undefined) {
        throw new Error(`${definition.syncSource} sync track contains no curve samples.`);
      }
      const bpm = definition.syncRuntime.track.timing.bpm;
      if (!Number.isFinite(bpm) || bpm <= 0) {
        throw new Error(`${definition.syncSource} sync track contains invalid bpm: ${String(bpm)}.`);
      }
      tracks.push({
        id: definition.id,
        audioCacheKey: definition.audioCacheKey,
        binaryCacheKey: definition.binaryCacheKey,
        syncRuntime: definition.syncRuntime,
        metadata
      });
    }
    return tracks;
  }

  private createMusicBannerElement(): HTMLDivElement {
    const host = document.getElementById('app');
    if (!(host instanceof HTMLElement)) {
      throw new Error('Cannot create music banner: missing #app host element.');
    }
    const banner = document.createElement('div');
    banner.className = 'pixel-song-banner';
    host.appendChild(banner);
    return banner;
  }

  private activeMusicTrack(): MusicTrackRuntime {
    const track = this.musicTracks[this.activeMusicTrackIndex];
    if (track === undefined) {
      throw new Error(`Missing active music track at index ${this.activeMusicTrackIndex}.`);
    }
    return track;
  }

  private activeMusicTrackBpm(): number {
    const bpm = this.activeMusicTrack().syncRuntime.track.timing.bpm;
    if (!Number.isFinite(bpm) || bpm <= 0) {
      throw new Error(`Active music track has invalid bpm: ${String(bpm)}.`);
    }
    return bpm;
  }

  private requireSyncClock(): SyncClock {
    if (this.syncClock === null) {
      throw new Error('Sync clock is not initialized in Pixel Invaders scene.');
    }
    return this.syncClock;
  }

  private initializeBackgroundMusic(): void {
    if (this.musicTracks.length === 0) {
      throw new Error('Music track list is empty.');
    }
    this.switchMusicTrack(0, false);
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

  private switchMusicTrack(nextTrackIndex: number, announce: boolean): void {
    if (!Number.isInteger(nextTrackIndex) || nextTrackIndex < 0 || nextTrackIndex >= this.musicTracks.length) {
      throw new Error(`Music track index is out of range: ${String(nextTrackIndex)}.`);
    }
    const nextTrack = this.musicTracks[nextTrackIndex];
    if (nextTrack === undefined) {
      throw new Error(`Music track is missing at index ${nextTrackIndex}.`);
    }

    const shouldStartPaused = this.musicPausedByUser;
    if (this.backgroundMusic !== null) {
      this.backgroundMusic.stop();
      this.backgroundMusic.destroy();
      this.backgroundMusic = null;
    }

    this.backgroundMusic = this.sound.add(nextTrack.audioCacheKey, {
      loop: true,
      volume: BACKGROUND_MUSIC_VOLUME
    });
    this.activeMusicTrackIndex = nextTrackIndex;
    this.syncClock = new SyncClock(nextTrack.syncRuntime);
    const syncFrame = this.syncClock.reset(0);
    this.musicReactive = applySyncFrame(this.musicReactive, syncFrame, 0);
    this.musicLanePulses = [];
    this.bassLaneToggle = false;
    this.startBackgroundMusic();
    if (shouldStartPaused) {
      this.requireBackgroundMusic().pause();
    }
    if (announce) {
      this.showSongBanner(`${nextTrack.metadata.title} - ${nextTrack.metadata.artist}`);
    }
  }

  private startBackgroundMusic(): void {
    if (this.musicPausedByUser) {
      return;
    }
    const backgroundMusic = this.requireBackgroundMusic();
    if (backgroundMusic.isPlaying) {
      return;
    }

    backgroundMusic.play();
  }

  private stopBackgroundMusic(): void {
    if (this.backgroundMusic !== null) {
      this.backgroundMusic.stop();
      this.backgroundMusic.destroy();
      this.backgroundMusic = null;
    }
    this.syncClock = null;
    this.musicPausedByUser = false;
  }
}
