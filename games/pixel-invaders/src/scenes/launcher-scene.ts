import Phaser from 'phaser';
import { TUNNEL_INVADERS_SCENE_KEY, type TunnelInvadersSceneData } from 'tunnel-invaders';
import { RetroSfx } from '@light80/game-sdk';

import arcadeLogoImage from '../assets/logo_cropped.png';
import {
  MENU_ROW_CONTROLLER,
  MENU_ROW_GAME,
  MENU_ROW_START,
  createInitialLauncherState,
  type LauncherState
} from '../launcher/model';
import { GAME_OPTIONS, type ControllerOption, type GameOption } from '../launcher/options';
import { PIXEL_INVADERS_SCENE_KEY, type PixelInvadersSceneData } from './pixel-invaders-scene';

export const LAUNCHER_SCENE_KEY = 'launcher';

const LAUNCHER_LOGO_KEY = 'launcher-logo';
const STAR_COUNT = 220;
const STAR_COLORS: readonly number[] = [0x63d6ff, 0xff58d6, 0xffcf5e, 0xa78bff];
const HORIZON_LINE_COUNT = 10;
const HORIZON_FLOW_SPEED_PX_PER_SEC = 60;
const PERSPECTIVE_TOP_SPACING = 33;
const PERSPECTIVE_BOTTOM_SPREAD = 5;
const PERSPECTIVE_FADE_SEGMENTS = 12;
const PERSPECTIVE_PARALLAX_MAX_X = 18;
const PERSPECTIVE_PARALLAX_LERP = 0.12;

interface MenuKeys {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly enter: Phaser.Input.Keyboard.Key;
  readonly space: Phaser.Input.Keyboard.Key;
  readonly fullscreen: Phaser.Input.Keyboard.Key;
}

interface MenuStar {
  x: number;
  y: number;
  readonly speed: number;
  readonly size: number;
  readonly alpha: number;
  readonly color: number;
}

interface PointerSelectionResult {
  readonly state: LauncherState;
  readonly selectionChanged: boolean;
  readonly startRequested: boolean;
}

function requireKeyboard(scene: Phaser.Scene): Phaser.Input.Keyboard.KeyboardPlugin {
  if (scene.input.keyboard === undefined || scene.input.keyboard === null) {
    throw new Error('Phaser keyboard plugin is required for launcher input.');
  }

  return scene.input.keyboard;
}

function requireGameOption(gameIndex: number): GameOption {
  const gameOption = GAME_OPTIONS[gameIndex];
  if (gameOption === undefined) {
    throw new Error(`Game option is missing for index ${gameIndex}.`);
  }

  if (gameOption.controllerOptions.length === 0) {
    throw new Error(`Game "${gameOption.id}" must define at least one controller option.`);
  }

  return gameOption;
}

function normalizeIndex(value: number, size: number): number {
  const remainder = value % size;
  return remainder < 0 ? remainder + size : remainder;
}

function normalizeControllerIndex(state: LauncherState): LauncherState {
  const gameOption = requireGameOption(state.gameIndex);
  const normalizedControllerIndex = normalizeIndex(state.controllerIndex, gameOption.controllerOptions.length);

  if (normalizedControllerIndex === state.controllerIndex) {
    return state;
  }

  return {
    ...state,
    controllerIndex: normalizedControllerIndex
  };
}

function requireControllerOption(state: LauncherState): ControllerOption {
  const gameOption = requireGameOption(state.gameIndex);
  const controllerOption = gameOption.controllerOptions[state.controllerIndex];

  if (controllerOption === undefined) {
    throw new Error(
      `Controller option is missing for game "${gameOption.id}" and index ${state.controllerIndex}.`
    );
  }

  return controllerOption;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function previewLabel(game: GameOption): string {
  if (game.id === 'pixel-invaders') {
    return 'PIXEL SKYLINE';
  }

  if (game.id === 'tunnel-invaders') {
    return 'TUNNEL VECTOR';
  }

  return 'RETRO PREVIEW';
}

export class LauncherScene extends Phaser.Scene {
  private state: LauncherState = createInitialLauncherState();
  private readonly sfx = new RetroSfx();
  private readonly onResize = (): void => {
    this.layoutMenu();
    this.redrawUi(this.time.now);
  };

  private keys!: MenuKeys;
  private backdropGraphics!: Phaser.GameObjects.Graphics;
  private panelGraphics!: Phaser.GameObjects.Graphics;
  private stars: MenuStar[] = [];
  private pointerWasDown = false;
  private perspectiveParallaxX = 0;

  private logoImage!: Phaser.GameObjects.Image;
  private subtitleText!: Phaser.GameObjects.Text;
  private gameTitleTexts: Phaser.GameObjects.Text[] = [];
  private gameDescriptionTexts: Phaser.GameObjects.Text[] = [];
  private gameButtonTexts: Phaser.GameObjects.Text[] = [];
  private gamePreviewTexts: Phaser.GameObjects.Text[] = [];
  private controllerHeaderText!: Phaser.GameObjects.Text;
  private controllerDescriptionText!: Phaser.GameObjects.Text;
  private controllerChipTexts: Phaser.GameObjects.Text[] = [];
  private hintText!: Phaser.GameObjects.Text;

  private cabinetBounds = new Phaser.Geom.Rectangle();
  private gamesBounds = new Phaser.Geom.Rectangle();
  private controlsBounds = new Phaser.Geom.Rectangle();
  private gameRowBounds: Phaser.Geom.Rectangle[] = [];

  constructor() {
    super(LAUNCHER_SCENE_KEY);
  }

  preload(): void {
    this.load.image(LAUNCHER_LOGO_KEY, arcadeLogoImage);
  }

  create(): void {
    const keyboard = requireKeyboard(this);
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      enter: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      space: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      fullscreen: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F)
    };

    this.cameras.main.setBackgroundColor('#040716');

    this.backdropGraphics = this.add.graphics().setDepth(-200);
    this.panelGraphics = this.add.graphics().setDepth(-100);
    this.logoImage = this.add.image(0, 0, LAUNCHER_LOGO_KEY).setDepth(30);

    this.subtitleText = this.add.text(0, 0, 'Plug in. Play together.', {
      fontFamily: 'Trebuchet MS',
      fontSize: '42px',
      color: '#b9ebff',
      align: 'center'
    });
    this.subtitleText.setOrigin(0.5, 0.5).setDepth(30);
    this.subtitleText.setShadow(0, 3, '#000000', 0.55, true, true);

    for (let index = 0; index < GAME_OPTIONS.length; index += 1) {
      const title = this.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '42px',
        color: '#d2e4ff'
      });
      title.setDepth(35);

      const description = this.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '28px',
        color: '#88a9d8'
      });
      description.setDepth(35);

      const button = this.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '36px',
        color: '#fff8da'
      });
      button.setOrigin(0.5, 0.5).setDepth(35);

      const preview = this.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '24px',
        color: '#8be0ff',
        align: 'center'
      });
      preview.setOrigin(0.5, 0.5).setDepth(35);

      this.gameTitleTexts.push(title);
      this.gameDescriptionTexts.push(description);
      this.gameButtonTexts.push(button);
      this.gamePreviewTexts.push(preview);
      this.gameRowBounds.push(new Phaser.Geom.Rectangle());
    }

    this.controllerHeaderText = this.add.text(0, 0, 'PLUG IN ANY CONTROLLER', {
      fontFamily: 'Trebuchet MS',
      fontSize: '42px',
      color: '#9ce7ff'
    });
    this.controllerHeaderText.setOrigin(0.5, 0.5).setDepth(35);

    this.controllerDescriptionText = this.add.text(0, 0, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      color: '#9ab8da',
      align: 'center'
    });
    this.controllerDescriptionText.setOrigin(0.5, 0.5).setDepth(35);

    this.hintText = this.add.text(0, 0, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '24px',
      color: '#8aa6e2'
    });
    this.hintText.setOrigin(0.5, 0.5).setDepth(35);

    this.state = normalizeControllerIndex(this.state);
    this.stars = this.createStars();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    });

    this.layoutMenu();
    this.redrawUi(this.time.now);
  }

  update(_: number, delta: number): void {
    const upPressed = Phaser.Input.Keyboard.JustDown(this.keys.up);
    const downPressed = Phaser.Input.Keyboard.JustDown(this.keys.down);
    const leftPressed = Phaser.Input.Keyboard.JustDown(this.keys.left);
    const rightPressed = Phaser.Input.Keyboard.JustDown(this.keys.right);
    const enterPressed = Phaser.Input.Keyboard.JustDown(this.keys.enter);
    const spacePressed = Phaser.Input.Keyboard.JustDown(this.keys.space);
    const fullscreenPressed = Phaser.Input.Keyboard.JustDown(this.keys.fullscreen);
    const pointerDown = this.input.activePointer.isDown;
    const pointerPressed = pointerDown && !this.pointerWasDown;
    const confirmPressed = enterPressed || spacePressed;

    if (
      upPressed ||
      downPressed ||
      leftPressed ||
      rightPressed ||
      confirmPressed ||
      fullscreenPressed ||
      pointerPressed
    ) {
      this.sfx.unlock();
    }

    if (fullscreenPressed) {
      this.toggleFullscreen();
    }

    const previousState = this.state;
    let nextState = previousState;
    let selectionChanged = false;

    if (upPressed !== downPressed) {
      const delta = upPressed ? -1 : 1;
      nextState = {
        ...nextState,
        cursorIndex: MENU_ROW_GAME,
        gameIndex: normalizeIndex(nextState.gameIndex + delta, GAME_OPTIONS.length)
      };
      nextState = normalizeControllerIndex(nextState);
      selectionChanged = true;
    }

    if (leftPressed !== rightPressed) {
      const delta = leftPressed ? -1 : 1;
      const gameOption = requireGameOption(nextState.gameIndex);
      nextState = {
        ...nextState,
        cursorIndex: MENU_ROW_CONTROLLER,
        controllerIndex: normalizeIndex(
          nextState.controllerIndex + delta,
          gameOption.controllerOptions.length
        )
      };
      selectionChanged = true;
    }

    if (confirmPressed) {
      nextState = {
        ...nextState,
        cursorIndex: MENU_ROW_START,
        startRequested: true
      };
    } else if (nextState.startRequested) {
      nextState = {
        ...nextState,
        startRequested: false
      };
    }

    if (pointerPressed) {
      const pointerResult = this.applyPointerSelection(
        nextState,
        this.input.activePointer.x,
        this.input.activePointer.y
      );
      nextState = pointerResult.state;
      selectionChanged = selectionChanged || pointerResult.selectionChanged;
      if (pointerResult.startRequested) {
        nextState = {
          ...nextState,
          cursorIndex: MENU_ROW_START,
          startRequested: true
        };
      }
    }

    this.state = nextState;

    if (this.state.startRequested) {
      this.pointerWasDown = pointerDown;
      this.sfx.playUiConfirm();
      this.startSelectedGame();
      return;
    }

    if (selectionChanged) {
      this.sfx.playUiMove();
    }

    this.updateStars(delta);
    this.redrawUi(this.time.now);
    this.pointerWasDown = pointerDown;
  }

  private redrawUi(timeMs: number): void {
    this.drawBackdrop(timeMs);
    this.drawCabinet(timeMs);
    this.renderMenu(timeMs);
  }

  private createStars(): MenuStar[] {
    const rng = new Phaser.Math.RandomDataGenerator(['launcher-stars-v4']);
    const stars: MenuStar[] = [];
    const width = this.scale.width;
    const height = this.scale.height;

    for (let i = 0; i < STAR_COUNT; i += 1) {
      stars.push({
        x: rng.realInRange(0, width),
        y: rng.realInRange(0, height),
        speed: rng.realInRange(8, 44),
        size: rng.realInRange(1, 3),
        alpha: rng.realInRange(0.25, 1),
        color: STAR_COLORS[Math.floor(rng.realInRange(0, STAR_COLORS.length))] ?? 0x63d6ff
      });
    }

    return stars;
  }

  private updateStars(delta: number): void {
    const width = this.scale.width;
    const height = this.scale.height;

    for (const star of this.stars) {
      star.y += star.speed * (delta / 1000);
      if (star.y > height + 6) {
        star.y = -6;
        star.x = Phaser.Math.Between(0, Math.max(1, Math.floor(width)));
      }
    }
  }

  private drawBackdrop(timeMs: number): void {
    const graphics = this.backdropGraphics;
    graphics.clear();

    const width = this.scale.width;
    const height = this.scale.height;
    const horizonY = Math.floor(height * 0.78);

    graphics.fillStyle(0x030015, 1);
    graphics.fillRect(0, 0, width, height);

    const gradientBands = 9;
    for (let band = 0; band < gradientBands; band += 1) {
      const t = band / (gradientBands - 1);
      const color = Phaser.Display.Color.GetColor(
        Math.round(lerp(6, 28, t)),
        Math.round(lerp(2, 10, t)),
        Math.round(lerp(26, 62, t))
      );
      graphics.fillStyle(color, lerp(0.45, 0.1, t));
      graphics.fillRect(0, Math.floor((band * height) / gradientBands), width, Math.ceil(height / gradientBands));
    }

    for (const star of this.stars) {
      const twinkle = 0.65 + 0.35 * Math.sin(timeMs * 0.003 + star.x * 0.02);
      graphics.fillStyle(star.color, star.alpha * twinkle);
      graphics.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
    }

    const pointerNormalizedX = Math.max(-1, Math.min(1, (this.input.activePointer.x / width) * 2 - 1));
    const targetParallaxX = pointerNormalizedX * PERSPECTIVE_PARALLAX_MAX_X;
    this.perspectiveParallaxX = lerp(
      this.perspectiveParallaxX,
      targetParallaxX,
      PERSPECTIVE_PARALLAX_LERP
    );

    const centerX = width / 2 + this.perspectiveParallaxX;
    const perspectiveCount = Math.ceil((width * 0.5) / PERSPECTIVE_TOP_SPACING) + 2;
    for (let i = -perspectiveCount; i <= perspectiveCount; i += 1) {
      const xTop = centerX + i * PERSPECTIVE_TOP_SPACING;
      const xBottom = centerX + i * PERSPECTIVE_TOP_SPACING * PERSPECTIVE_BOTTOM_SPREAD;
      for (let segment = 0; segment < PERSPECTIVE_FADE_SEGMENTS; segment += 1) {
        const t0 = segment / PERSPECTIVE_FADE_SEGMENTS;
        const t1 = (segment + 1) / PERSPECTIVE_FADE_SEGMENTS;
        const y0 = lerp(horizonY, height, t0);
        const y1 = lerp(horizonY, height, t1);
        const sx0 = lerp(xTop, xBottom, t0);
        const sx1 = lerp(xTop, xBottom, t1);
        const depthUnit = (t0 + t1) * 0.5;
        graphics.lineStyle(2, 0x5f2dff, lerp(0.12, 0.65, depthUnit));
        graphics.beginPath();
        graphics.moveTo(sx0, y0);
        graphics.lineTo(sx1, y1);
        graphics.strokePath();
      }
    }

    const nearestY = height + 2;
    const travelRange = nearestY - horizonY;
    const spacing = travelRange / HORIZON_LINE_COUNT;
    const flowOffset = ((timeMs * HORIZON_FLOW_SPEED_PX_PER_SEC) / 1000) % spacing;
    const drawnRows = new Set<number>();
    for (let line = -1; line <= HORIZON_LINE_COUNT; line += 1) {
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
      graphics.lineStyle(2, 0x5f2dff, lerp(0.12, 0.65, depthUnit));
      graphics.beginPath();
      graphics.moveTo(0, yRow);
      graphics.lineTo(width, yRow);
      graphics.strokePath();
    }
  }

  private drawCabinet(timeMs: number): void {
    const graphics = this.panelGraphics;
    graphics.clear();

    const pulse = 0.58 + 0.42 * Math.sin(timeMs * 0.004);
    const c = this.cabinetBounds;

    graphics.fillStyle(0xff48d5, 0.16 + pulse * 0.12);
    graphics.fillRoundedRect(c.x - 12, c.y - 12, c.width + 24, c.height + 24, 34);

    graphics.fillStyle(0x0d0722, 0.94);
    graphics.fillRoundedRect(c.x, c.y, c.width, c.height, 30);
    graphics.lineStyle(6, 0xff4bd6, 0.92);
    graphics.strokeRoundedRect(c.x, c.y, c.width, c.height, 30);
    graphics.lineStyle(2, 0x62d4ff, 0.9);
    graphics.strokeRoundedRect(c.x + 8, c.y + 8, c.width - 16, c.height - 16, 24);

    graphics.fillStyle(0x050b1f, 0.95);
    graphics.fillRoundedRect(this.gamesBounds.x, this.gamesBounds.y, this.gamesBounds.width, this.gamesBounds.height, 22);
    graphics.lineStyle(2, 0x5247d0, 0.8);
    graphics.strokeRoundedRect(this.gamesBounds.x, this.gamesBounds.y, this.gamesBounds.width, this.gamesBounds.height, 22);

    for (let index = 0; index < this.gameRowBounds.length; index += 1) {
      const row = this.gameRowBounds[index];
      const selectedGame = this.state.gameIndex === index;
      const rowFocus = selectedGame && this.state.cursorIndex === MENU_ROW_GAME;
      const buttonFocus = selectedGame && this.state.cursorIndex === MENU_ROW_START;
      const rowGlow = selectedGame ? 0.25 + pulse * 0.12 : 0.08;

      graphics.fillStyle(selectedGame ? 0x121e4a : 0x0b112d, 0.92);
      graphics.fillRoundedRect(row.x, row.y, row.width, row.height, 16);
      graphics.lineStyle(
        rowFocus ? 3 : 2,
        rowFocus ? 0xffce55 : selectedGame ? 0xff5fd8 : 0x3a4f98,
        selectedGame ? 1 : 0.65
      );
      graphics.strokeRoundedRect(row.x, row.y, row.width, row.height, 16);

      if (selectedGame) {
        graphics.fillStyle(0xff5fd8, rowGlow);
        graphics.fillRoundedRect(row.x - 4, row.y - 4, row.width + 8, row.height + 8, 18);
      }

      const previewWidth = Math.floor(Math.min(320, row.width * 0.32));
      const previewHeight = row.height - 26;
      const previewX = row.right - previewWidth - 12;
      const previewY = row.y + 13;
      graphics.fillStyle(0x143a78, 0.9);
      graphics.fillRoundedRect(previewX, previewY, previewWidth, previewHeight, 10);
      graphics.lineStyle(2, selectedGame ? 0x63d6ff : 0x325a9b, 0.95);
      graphics.strokeRoundedRect(previewX, previewY, previewWidth, previewHeight, 10);

      for (let line = 0; line < previewHeight; line += 4) {
        graphics.fillStyle(0xffffff, 0.04);
        graphics.fillRect(previewX + 2, previewY + line, previewWidth - 4, 1);
      }

      if (selectedGame) {
        graphics.fillStyle(0x63d6ff, 0.12 + pulse * 0.08);
        graphics.fillRoundedRect(previewX - 3, previewY - 3, previewWidth + 6, previewHeight + 6, 12);
      }

      const buttonWidth = Math.min(250, row.width * 0.33);
      const buttonHeight = 44;
      const buttonX = row.x + 26;
      const buttonY = row.bottom - buttonHeight - 16;
      const buttonColor = selectedGame
        ? buttonFocus
          ? 0xff9a23
          : 0xec7818
        : 0x2c355f;
      const buttonGlow = selectedGame
        ? buttonFocus
          ? 0.45 + pulse * 0.2
          : 0.2 + pulse * 0.1
        : 0.1;

      graphics.fillStyle(buttonColor, 0.9);
      graphics.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 12);
      graphics.fillStyle(0xffffff, buttonGlow);
      graphics.fillRoundedRect(buttonX + 4, buttonY + 4, buttonWidth - 8, 10, 6);
      graphics.lineStyle(2, selectedGame ? 0xfff2b8 : 0x7480ad, 0.9);
      graphics.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 12);
    }

    graphics.fillStyle(0x071028, 0.96);
    graphics.fillRoundedRect(
      this.controlsBounds.x,
      this.controlsBounds.y,
      this.controlsBounds.width,
      this.controlsBounds.height,
      20
    );
    graphics.lineStyle(2, 0x4f73d8, 0.92);
    graphics.strokeRoundedRect(
      this.controlsBounds.x,
      this.controlsBounds.y,
      this.controlsBounds.width,
      this.controlsBounds.height,
      20
    );
  }

  private renderMenu(timeMs: number): void {
    this.layoutMenu();

    const gameOption = requireGameOption(this.state.gameIndex);
    const controllerOption = requireControllerOption(this.state);
    const pulse = 0.7 + 0.3 * Math.sin(timeMs * 0.005);

    this.subtitleText.setText('Plug in. Play together.');
    this.subtitleText.setFontSize(Math.max(30, Math.floor(this.scale.height * 0.035)));

    for (let index = 0; index < GAME_OPTIONS.length; index += 1) {
      const option = GAME_OPTIONS[index];
      const row = this.gameRowBounds[index];
      if (row === undefined) {
        throw new Error(`Missing row bounds for game index ${index}.`);
      }

      const selectedGame = this.state.gameIndex === index;
      const gameFocus = selectedGame && this.state.cursorIndex === MENU_ROW_GAME;
      const startFocus = selectedGame && this.state.cursorIndex === MENU_ROW_START;
      const title = this.gameTitleTexts[index];
      const description = this.gameDescriptionTexts[index];
      const button = this.gameButtonTexts[index];
      const preview = this.gamePreviewTexts[index];

      if (title === undefined || description === undefined || button === undefined || preview === undefined) {
        throw new Error(`Missing launcher text object for game index ${index}.`);
      }

      const titleSize = Math.max(42, Math.floor(row.height * 0.22));
      const descriptionSize = Math.max(18, Math.floor(row.height * 0.12));
      const buttonSize = Math.max(30, Math.floor(row.height * 0.2));
      const previewSize = Math.max(24, Math.floor(row.height * 0.13));
      title.setFontSize(titleSize);
      description.setFontSize(descriptionSize);
      button.setFontSize(buttonSize);
      preview.setFontSize(previewSize);

      title.setText(`${selectedGame ? '>' : ' '} ${option.label}`);
      title.setPosition(row.x + 24, row.y + Math.floor(row.height * 0.08));
      title.setColor(gameFocus ? '#fff6c8' : selectedGame ? '#ffe8a8' : '#a8bedf');

      description.setText(option.description);
      description.setPosition(row.x + 24, row.y + Math.floor(row.height * 0.44));
      description.setWordWrapWidth(row.width * 0.58, true);
      description.setColor(selectedGame ? '#d6e7ff' : '#7e95bc');

      const buttonCenterX = row.x + Math.min(250, row.width * 0.33) / 2 + 26;
      const buttonCenterY = row.bottom - Math.max(28, Math.floor(row.height * 0.2));
      button.setPosition(buttonCenterX, buttonCenterY);
      if (selectedGame) {
        button.setText(startFocus ? 'PRESS START' : 'START');
        button.setColor(startFocus ? '#fffde1' : '#fff2ca');
        button.setScale(startFocus ? 1 + pulse * 0.04 : 1);
      } else {
        button.setText('SELECT GAME');
        button.setColor('#d8ddf3');
        button.setScale(1);
      }

      preview.setText(previewLabel(option));
      preview.setPosition(row.right - Math.floor(Math.min(320, row.width * 0.32)) / 2 - 12, row.centerY);
      preview.setColor(selectedGame ? '#9ff3ff' : '#89a2ca');
    }

    this.controllerHeaderText.setText(
      `${this.state.cursorIndex === MENU_ROW_CONTROLLER ? '>' : ' '} PLUG IN ANY CONTROLLER`
    );
    this.controllerHeaderText.setFontSize(Math.max(38, Math.floor(this.controlsBounds.height * 0.2)));
    this.controllerHeaderText.setColor(
      this.state.cursorIndex === MENU_ROW_CONTROLLER ? '#d8f7ff' : '#9ce7ff'
    );

    this.controllerDescriptionText.setText(controllerOption.description);
    this.controllerDescriptionText.setFontSize(Math.max(20, Math.floor(this.controlsBounds.height * 0.11)));
    this.controllerDescriptionText.setColor('#a7c8e9');

    this.ensureControllerChipCount(gameOption.controllerOptions.length);
    this.layoutControllerChips(gameOption);

    this.hintText.setText('UP/DOWN: game  LEFT/RIGHT: controller  ENTER: start  MOUSE: click  F: fullscreen');
  }

  private applyPointerSelection(
    state: LauncherState,
    pointerX: number,
    pointerY: number
  ): PointerSelectionResult {
    let nextState = state;
    let selectionChanged = false;

    for (let index = 0; index < this.gameRowBounds.length; index += 1) {
      const row = this.gameRowBounds[index];
      if (row === undefined) {
        throw new Error(`Missing game row bounds for pointer hit-test at index ${index}.`);
      }

      if (!Phaser.Geom.Rectangle.Contains(row, pointerX, pointerY)) {
        continue;
      }

      const previousGameIndex = nextState.gameIndex;
      const previousControllerIndex = nextState.controllerIndex;
      nextState = normalizeControllerIndex({
        ...nextState,
        cursorIndex: MENU_ROW_GAME,
        gameIndex: index
      });
      selectionChanged =
        selectionChanged ||
        nextState.gameIndex !== previousGameIndex ||
        nextState.controllerIndex !== previousControllerIndex;

      const startButtonBounds = this.startButtonBoundsForRow(row);
      return {
        state: nextState,
        selectionChanged,
        startRequested: Phaser.Geom.Rectangle.Contains(startButtonBounds, pointerX, pointerY)
      };
    }

    const gameOption = requireGameOption(nextState.gameIndex);
    const chipIndex = this.controllerChipIndexAt(pointerX, pointerY, gameOption);
    if (chipIndex !== null) {
      const previousControllerIndex = nextState.controllerIndex;
      nextState = {
        ...nextState,
        cursorIndex: MENU_ROW_CONTROLLER,
        controllerIndex: chipIndex
      };
      selectionChanged = selectionChanged || previousControllerIndex !== chipIndex;
    }

    return {
      state: nextState,
      selectionChanged,
      startRequested: false
    };
  }

  private ensureControllerChipCount(count: number): void {
    while (this.controllerChipTexts.length < count) {
      const chip = this.add.text(0, 0, '', {
        fontFamily: 'Trebuchet MS',
        fontSize: '22px',
        color: '#d6ebff',
        backgroundColor: '#13234a'
      });
      chip.setOrigin(0.5, 0.5).setPadding(16, 8, 16, 8).setDepth(35);
      this.controllerChipTexts.push(chip);
    }

    for (let index = 0; index < this.controllerChipTexts.length; index += 1) {
      const chip = this.controllerChipTexts[index];
      if (chip === undefined) {
        throw new Error(`Missing controller chip at index ${index}.`);
      }
      chip.setVisible(index < count);
    }
  }

  private layoutControllerChips(gameOption: GameOption): void {
    const chipsTop = this.controlsChipsTop();
    const availableWidth = this.controlsBounds.width - 56;
    const chipCount = gameOption.controllerOptions.length;
    const slotWidth = availableWidth / chipCount;

    for (let index = 0; index < chipCount; index += 1) {
      const option = gameOption.controllerOptions[index];
      const chip = this.controllerChipTexts[index];
      if (option === undefined || chip === undefined) {
        throw new Error(`Missing controller option/chip at index ${index}.`);
      }

      const selected = this.state.controllerIndex === index;
      const focused = selected && this.state.cursorIndex === MENU_ROW_CONTROLLER;

      chip.setText(option.label.toUpperCase());
      chip.setPosition(this.controlsBounds.x + 28 + slotWidth * index + slotWidth / 2, chipsTop);
      chip.setColor(selected ? '#fff3cd' : '#b2ccf5');
      chip.setStyle({
        backgroundColor: focused
          ? '#ff8f21'
          : selected
            ? '#8f2cb4'
            : '#152147'
      });
    }
  }

  private startButtonBoundsForRow(row: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    const buttonWidth = Math.min(250, row.width * 0.33);
    const buttonHeight = 44;
    const buttonX = row.x + 26;
    const buttonY = row.bottom - buttonHeight - 16;
    return new Phaser.Geom.Rectangle(buttonX, buttonY, buttonWidth, buttonHeight);
  }

  private controllerChipIndexAt(pointerX: number, pointerY: number, gameOption: GameOption): number | null {
    const chipCount = gameOption.controllerOptions.length;
    if (chipCount === 0) {
      throw new Error(`Game "${gameOption.id}" must define at least one controller option.`);
    }

    const chipsTop = this.controlsChipsTop();
    const availableWidth = this.controlsBounds.width - 56;
    const slotWidth = availableWidth / chipCount;
    const chipHeight = 44;
    const chipWidth = Math.max(140, slotWidth - 14);

    for (let index = 0; index < chipCount; index += 1) {
      const centerX = this.controlsBounds.x + 28 + slotWidth * index + slotWidth / 2;
      const chipBounds = new Phaser.Geom.Rectangle(
        centerX - chipWidth / 2,
        chipsTop - chipHeight / 2,
        chipWidth,
        chipHeight
      );

      if (Phaser.Geom.Rectangle.Contains(chipBounds, pointerX, pointerY)) {
        return index;
      }
    }

    return null;
  }

  private layoutMenu(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const logoFrame = this.logoImage.frame;
    const logoWidth = logoFrame.width;
    const logoHeight = logoFrame.height;
    if (logoWidth <= 0 || logoHeight <= 0) {
      throw new Error('Launcher logo frame has invalid size.');
    }

    const baseLogoMaxWidth = Math.min(width * 0.64, 920);
    const baseLogoMaxHeight = Math.min(height * 0.31, 420);
    const baseLogoScale = Math.min(baseLogoMaxWidth / logoWidth, baseLogoMaxHeight / logoHeight);
    const doubledLogoScale = baseLogoScale * 2;
    const viewportSafeScale = Math.min((width * 0.92) / logoWidth, (height * 0.48) / logoHeight);
    const logoScale = Math.min(doubledLogoScale, viewportSafeScale);
    this.logoImage.setScale(logoScale);
    const logoTop = Math.max(8, Math.floor(height * 0.015));
    this.logoImage.setPosition(
      centerX,
      logoTop + Math.ceil(this.logoImage.displayHeight * 0.5)
    );

    const subtitleY = this.logoImage.y + this.logoImage.displayHeight * 0.42;
    this.subtitleText.setPosition(centerX, subtitleY);

    const cabinetWidth = Math.floor(Math.min(width * 0.88, 1240));
    const topSectionBottom = this.subtitleText.y + this.subtitleText.height * 0.5;
    const cabinetY = Math.floor(Math.max(height * 0.18, topSectionBottom + 10));
    const desiredCabinetHeight = Math.floor(Math.min(height * 0.68, 900));
    const maxCabinetHeight = Math.floor(height - cabinetY - 56);
    if (maxCabinetHeight < 320) {
      throw new Error(`Launcher layout overflow: height=${height}, cabinetY=${cabinetY}.`);
    }
    const cabinetHeight = Math.max(320, Math.min(desiredCabinetHeight, maxCabinetHeight));
    const cabinetX = Math.floor((width - cabinetWidth) / 2);
    this.cabinetBounds.setTo(cabinetX, cabinetY, cabinetWidth, cabinetHeight);

    const sectionPadding = 18;
    const gamesHeight = Math.floor(cabinetHeight * 0.62);
    this.gamesBounds.setTo(
      cabinetX + sectionPadding,
      cabinetY + sectionPadding,
      cabinetWidth - sectionPadding * 2,
      gamesHeight
    );

    this.controlsBounds.setTo(
      cabinetX + sectionPadding,
      this.gamesBounds.bottom + sectionPadding,
      cabinetWidth - sectionPadding * 2,
      cabinetY + cabinetHeight - sectionPadding - (this.gamesBounds.bottom + sectionPadding)
    );

    const rowPadding = 12;
    const rowHeight =
      (this.gamesBounds.height - rowPadding * (GAME_OPTIONS.length + 1)) / Math.max(1, GAME_OPTIONS.length);

    for (let index = 0; index < GAME_OPTIONS.length; index += 1) {
      const row = this.gameRowBounds[index];
      if (row === undefined) {
        throw new Error(`Missing game row bounds for index ${index}.`);
      }

      row.setTo(
        this.gamesBounds.x + rowPadding,
        this.gamesBounds.y + rowPadding + index * (rowHeight + rowPadding),
        this.gamesBounds.width - rowPadding * 2,
        rowHeight
      );
    }

    this.controllerHeaderText.setPosition(
      this.controlsBounds.centerX,
      this.controlsBounds.y + Math.floor(this.controlsBounds.height * 0.24)
    );
    this.controllerDescriptionText.setPosition(
      this.controlsBounds.centerX,
      this.controlsBounds.y + Math.floor(this.controlsBounds.height * 0.44)
    );
    this.controllerDescriptionText.setWordWrapWidth(this.controlsBounds.width - 60, true);

    this.hintText.setPosition(centerX, height - 28);
  }

  private controlsChipsTop(): number {
    return this.controlsBounds.y + Math.floor(this.controlsBounds.height * 0.76);
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
      return;
    }

    this.scale.startFullscreen();
  }

  private startSelectedGame(): void {
    if (!this.scale.isFullscreen) {
      this.scale.startFullscreen();
    }

    const gameOption = requireGameOption(this.state.gameIndex);
    const controllerOption = requireControllerOption(this.state);

    if (gameOption.sceneKey === PIXEL_INVADERS_SCENE_KEY) {
      const data: PixelInvadersSceneData = {
        controllerProfileId: controllerOption.profileId,
        controllerLabel: controllerOption.label
      };

      this.scene.start(PIXEL_INVADERS_SCENE_KEY, data);
      return;
    }

    if (gameOption.sceneKey === TUNNEL_INVADERS_SCENE_KEY) {
      const data: TunnelInvadersSceneData = {
        controllerProfileId: controllerOption.profileId,
        controllerLabel: controllerOption.label
      };

      this.scene.start(TUNNEL_INVADERS_SCENE_KEY, data);
      return;
    }

    throw new Error(`Unsupported scene key: "${gameOption.sceneKey}".`);
  }
}
