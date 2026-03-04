import Phaser from 'phaser';
import { TUNNEL_INVADERS_SCENE_KEY, type TunnelInvadersSceneData } from 'tunnel-invaders';
import { AUDIO_MIX_PROFILE_IDS, RetroSfx, type AudioMixProfileId } from '@light80/game-sdk';

import arcadeLogoImage from '../assets/logo_cropped.png';
import launcherJoystickImage from '../assets/launcher_joystick.png';
import launcherSpeakerImage from '../assets/launcher_speaker.png';
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

const STAR_COUNT = 220;
const STAR_COLORS: readonly number[] = [0x63d6ff, 0xff58d6, 0xffcf5e, 0xa78bff];
const HORIZON_LINE_COUNT = 10;
const HORIZON_FLOW_SPEED_PX_PER_SEC = 60;
const PERSPECTIVE_TOP_SPACING = 33;
const PERSPECTIVE_BOTTOM_SPREAD = 5;
const PERSPECTIVE_FADE_SEGMENTS = 12;

interface MenuKeys {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly enter: Phaser.Input.Keyboard.Key;
  readonly space: Phaser.Input.Keyboard.Key;
  readonly fullscreen: Phaser.Input.Keyboard.Key;
  readonly mixNext: Phaser.Input.Keyboard.Key;
  readonly loopToggle: Phaser.Input.Keyboard.Key;
}

interface MenuStar {
  x: number;
  y: number;
  readonly speed: number;
  readonly size: number;
  readonly alpha: number;
  readonly color: number;
}

type SettingsPanelMode = 'home' | 'controllers' | 'audio';

interface LauncherDom {
  readonly root: HTMLDivElement;
  readonly subtitle: HTMLDivElement;
  readonly gameCard: HTMLElement;
  readonly arrowLeftButton: HTMLButtonElement;
  readonly arrowRightButton: HTMLButtonElement;
  readonly gameTitle: HTMLDivElement;
  readonly gameDescription: HTMLDivElement;
  readonly startButton: HTMLButtonElement;
  readonly previewLabel: HTMLDivElement;
  readonly settingsPanel: HTMLElement;
  readonly joystickButton: HTMLButtonElement;
  readonly speakerButton: HTMLButtonElement;
  readonly settingsTitle: HTMLDivElement;
  readonly settingsDescription: HTMLDivElement;
  readonly controllerChips: HTMLDivElement;
  readonly audioMixButton: HTMLButtonElement;
  readonly audioLoopButton: HTMLButtonElement;
  readonly hint: HTMLDivElement;
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

function requireAudioMixProfileId(index: number): AudioMixProfileId {
  const mixProfileId = AUDIO_MIX_PROFILE_IDS[index];
  if (mixProfileId === undefined) {
    throw new Error(`Audio mix profile is missing for index ${index}.`);
  }

  return mixProfileId;
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

function stateEquals(a: LauncherState, b: LauncherState): boolean {
  return (
    a.cursorIndex === b.cursorIndex &&
    a.gameIndex === b.gameIndex &&
    a.controllerIndex === b.controllerIndex &&
    a.audioMixProfileIndex === b.audioMixProfileIndex &&
    a.sfxLoopEnabled === b.sfxLoopEnabled &&
    a.startRequested === b.startRequested
  );
}

export class LauncherScene extends Phaser.Scene {
  private state: LauncherState = createInitialLauncherState();
  private settingsPanelMode: SettingsPanelMode = 'home';
  private readonly sfx = new RetroSfx();
  private readonly onResize = (): void => {
    this.renderDom();
    this.drawBackdrop(this.time.now);
  };

  private keys!: MenuKeys;
  private backdropGraphics!: Phaser.GameObjects.Graphics;
  private stars: MenuStar[] = [];
  private sfxLoopTimer = 0;
  private sfxLoopStep = 0;
  private dom: LauncherDom | null = null;

  constructor() {
    super(LAUNCHER_SCENE_KEY);
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
      fullscreen: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      mixNext: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M),
      loopToggle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L)
    };

    this.cameras.main.setBackgroundColor('#040716');
    this.backdropGraphics = this.add.graphics().setDepth(-200);

    this.state = normalizeControllerIndex(this.state);
    this.sfx.setMixProfile(requireAudioMixProfileId(this.state.audioMixProfileIndex));
    this.stars = this.createStars();

    this.mountDom();
    this.renderDom();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
      this.unmountDom();
    });
  }

  update(_: number, delta: number): void {
    const upPressed = Phaser.Input.Keyboard.JustDown(this.keys.up);
    const downPressed = Phaser.Input.Keyboard.JustDown(this.keys.down);
    const leftPressed = Phaser.Input.Keyboard.JustDown(this.keys.left);
    const rightPressed = Phaser.Input.Keyboard.JustDown(this.keys.right);
    const enterPressed = Phaser.Input.Keyboard.JustDown(this.keys.enter);
    const spacePressed = Phaser.Input.Keyboard.JustDown(this.keys.space);
    const fullscreenPressed = Phaser.Input.Keyboard.JustDown(this.keys.fullscreen);
    const mixNextPressed = Phaser.Input.Keyboard.JustDown(this.keys.mixNext);
    const loopTogglePressed = Phaser.Input.Keyboard.JustDown(this.keys.loopToggle);
    const confirmPressed = enterPressed || spacePressed;

    if (
      upPressed ||
      downPressed ||
      leftPressed ||
      rightPressed ||
      confirmPressed ||
      fullscreenPressed ||
      mixNextPressed ||
      loopTogglePressed
    ) {
      this.sfx.unlock();
    }

    if (fullscreenPressed) {
      this.toggleFullscreen();
    }

    const previousState = this.state;
    const previousMode = this.settingsPanelMode;
    let nextState = previousState;
    let selectionChanged = false;

    if (upPressed !== downPressed) {
      const cursorDelta = upPressed ? -1 : 1;
      nextState = {
        ...nextState,
        cursorIndex: normalizeIndex(nextState.cursorIndex + cursorDelta, 3)
      };
      selectionChanged = true;
    }

    if (leftPressed !== rightPressed) {
      const deltaIndex = leftPressed ? -1 : 1;
      if (nextState.cursorIndex === MENU_ROW_GAME) {
        nextState = normalizeControllerIndex({
          ...nextState,
          gameIndex: normalizeIndex(nextState.gameIndex + deltaIndex, GAME_OPTIONS.length)
        });
        selectionChanged = true;
      } else if (nextState.cursorIndex === MENU_ROW_CONTROLLER) {
        if (this.settingsPanelMode === 'controllers') {
          const gameOption = requireGameOption(nextState.gameIndex);
          nextState = {
            ...nextState,
            controllerIndex: normalizeIndex(nextState.controllerIndex + deltaIndex, gameOption.controllerOptions.length)
          };
          selectionChanged = true;
        } else if (this.settingsPanelMode === 'home') {
          this.settingsPanelMode = deltaIndex < 0 ? 'controllers' : 'audio';
          selectionChanged = true;
        } else {
          nextState = {
            ...nextState,
            audioMixProfileIndex: normalizeIndex(nextState.audioMixProfileIndex + deltaIndex, AUDIO_MIX_PROFILE_IDS.length)
          };
          selectionChanged = true;
        }
      }
    }

    if (mixNextPressed) {
      this.settingsPanelMode = 'audio';
      nextState = {
        ...nextState,
        audioMixProfileIndex: normalizeIndex(nextState.audioMixProfileIndex + 1, AUDIO_MIX_PROFILE_IDS.length)
      };
      selectionChanged = true;
    }

    if (loopTogglePressed) {
      this.settingsPanelMode = 'audio';
      nextState = {
        ...nextState,
        sfxLoopEnabled: !nextState.sfxLoopEnabled
      };
      selectionChanged = true;
    }

    if (confirmPressed) {
      if (nextState.cursorIndex === MENU_ROW_START) {
        nextState = {
          ...nextState,
          startRequested: true
        };
      } else if (nextState.cursorIndex === MENU_ROW_CONTROLLER && this.settingsPanelMode === 'home') {
        this.settingsPanelMode = 'controllers';
        selectionChanged = true;
      } else {
        nextState = {
          ...nextState,
          cursorIndex: MENU_ROW_START,
          startRequested: true
        };
      }
    } else if (nextState.startRequested) {
      nextState = {
        ...nextState,
        startRequested: false
      };
    }

    this.state = normalizeControllerIndex(nextState);
    this.applyAudioSettings(previousState, this.state);

    if (this.state.startRequested) {
      this.sfx.playUiConfirm();
      this.startSelectedGame();
      return;
    }

    if (selectionChanged || previousMode !== this.settingsPanelMode) {
      this.sfx.playUiMove();
    }

    if (!stateEquals(previousState, this.state) || previousMode !== this.settingsPanelMode) {
      this.renderDom();
    }

    this.updateStars(delta);
    this.updateSfxLoop(delta);
    this.drawBackdrop(this.time.now);
  }

  private mountDom(): void {
    const host = this.game.canvas.parentElement;
    if (host === null) {
      throw new Error('Launcher requires the game canvas parent element.');
    }

    host.classList.add('launcher-host');

    const root = document.createElement('div');
    root.className = 'launcher-overlay';

    const header = document.createElement('div');
    header.className = 'launcher-header';

    const logo = document.createElement('img');
    logo.className = 'launcher-logo';
    logo.src = arcadeLogoImage;
    logo.alt = 'Light80';

    const subtitle = document.createElement('div');
    subtitle.className = 'launcher-subtitle';

    header.append(logo, subtitle);

    const shell = document.createElement('div');
    shell.className = 'launcher-shell';

    const gamePanel = document.createElement('section');
    gamePanel.className = 'launcher-game-panel';

    const arrowLeftButton = document.createElement('button');
    arrowLeftButton.className = 'launcher-arrow launcher-arrow-left';
    arrowLeftButton.type = 'button';
    arrowLeftButton.textContent = '◀';

    const arrowRightButton = document.createElement('button');
    arrowRightButton.className = 'launcher-arrow launcher-arrow-right';
    arrowRightButton.type = 'button';
    arrowRightButton.textContent = '▶';

    const gameCard = document.createElement('article');
    gameCard.className = 'launcher-game-card';

    const gameTitle = document.createElement('div');
    gameTitle.className = 'launcher-game-title';

    const gameDescription = document.createElement('div');
    gameDescription.className = 'launcher-game-description';

    const startButton = document.createElement('button');
    startButton.className = 'launcher-start-button';
    startButton.type = 'button';

    const previewLabel = document.createElement('div');
    previewLabel.className = 'launcher-preview-label';

    const leftColumn = document.createElement('div');
    leftColumn.className = 'launcher-game-left';
    leftColumn.append(gameTitle, gameDescription, startButton);

    const rightColumn = document.createElement('div');
    rightColumn.className = 'launcher-game-right';
    rightColumn.append(previewLabel);

    gameCard.append(leftColumn, rightColumn);
    gamePanel.append(arrowLeftButton, gameCard, arrowRightButton);

    const settingsPanel = document.createElement('section');
    settingsPanel.className = 'launcher-settings-panel';

    const joystickButton = document.createElement('button');
    joystickButton.className = 'launcher-icon-button launcher-icon-left';
    joystickButton.type = 'button';
    const joystickImage = document.createElement('img');
    joystickImage.className = 'launcher-icon-image';
    joystickImage.src = launcherJoystickImage;
    joystickImage.alt = 'Controller settings';
    joystickButton.append(joystickImage);

    const speakerButton = document.createElement('button');
    speakerButton.className = 'launcher-icon-button launcher-icon-right';
    speakerButton.type = 'button';
    const speakerImage = document.createElement('img');
    speakerImage.className = 'launcher-icon-image launcher-icon-image-speaker';
    speakerImage.src = launcherSpeakerImage;
    speakerImage.alt = 'Audio settings';
    speakerButton.append(speakerImage);

    const settingsContent = document.createElement('div');
    settingsContent.className = 'launcher-settings-content';

    const settingsTitle = document.createElement('div');
    settingsTitle.className = 'launcher-settings-title';

    const settingsDescription = document.createElement('div');
    settingsDescription.className = 'launcher-settings-description';

    const controllerChips = document.createElement('div');
    controllerChips.className = 'launcher-controller-chips';

    const audioMixButton = document.createElement('button');
    audioMixButton.className = 'launcher-audio-row';
    audioMixButton.type = 'button';

    const audioLoopButton = document.createElement('button');
    audioLoopButton.className = 'launcher-audio-row';
    audioLoopButton.type = 'button';

    settingsContent.append(settingsTitle, settingsDescription, controllerChips, audioMixButton, audioLoopButton);
    settingsPanel.append(joystickButton, settingsContent, speakerButton);

    const hint = document.createElement('div');
    hint.className = 'launcher-hint';

    shell.append(gamePanel, settingsPanel);
    root.append(header, shell, hint);
    host.append(root);

    this.dom = {
      root,
      subtitle,
      gameCard,
      arrowLeftButton,
      arrowRightButton,
      gameTitle,
      gameDescription,
      startButton,
      previewLabel,
      settingsPanel,
      joystickButton,
      speakerButton,
      settingsTitle,
      settingsDescription,
      controllerChips,
      audioMixButton,
      audioLoopButton,
      hint
    };

    arrowLeftButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.applyUiState(
        normalizeControllerIndex({
          ...this.state,
          cursorIndex: MENU_ROW_GAME,
          gameIndex: normalizeIndex(this.state.gameIndex - 1, GAME_OPTIONS.length)
        }),
        true
      );
    });

    arrowRightButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.applyUiState(
        normalizeControllerIndex({
          ...this.state,
          cursorIndex: MENU_ROW_GAME,
          gameIndex: normalizeIndex(this.state.gameIndex + 1, GAME_OPTIONS.length)
        }),
        true
      );
    });

    gameCard.addEventListener('click', () => {
      this.sfx.unlock();
      this.applyUiState({ ...this.state, cursorIndex: MENU_ROW_GAME }, false);
    });

    startButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.sfx.unlock();
      this.sfx.playUiConfirm();
      this.startSelectedGame();
    });

    joystickButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.settingsPanelMode = 'controllers';
      this.applyUiState({ ...this.state, cursorIndex: MENU_ROW_CONTROLLER }, true);
    });

    speakerButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.settingsPanelMode = 'audio';
      this.applyUiState({ ...this.state, cursorIndex: MENU_ROW_CONTROLLER }, true);
    });

    settingsPanel.addEventListener('click', () => {
      this.sfx.unlock();
      this.applyUiState({ ...this.state, cursorIndex: MENU_ROW_CONTROLLER }, false);
    });

    audioMixButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.settingsPanelMode = 'audio';
      this.applyUiState(
        {
          ...this.state,
          cursorIndex: MENU_ROW_CONTROLLER,
          audioMixProfileIndex: normalizeIndex(this.state.audioMixProfileIndex + 1, AUDIO_MIX_PROFILE_IDS.length)
        },
        true
      );
    });

    audioLoopButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.settingsPanelMode = 'audio';
      this.applyUiState(
        {
          ...this.state,
          cursorIndex: MENU_ROW_CONTROLLER,
          sfxLoopEnabled: !this.state.sfxLoopEnabled
        },
        true
      );
    });
  }

  private unmountDom(): void {
    if (this.dom === null) {
      return;
    }

    this.dom.root.remove();
    this.dom = null;
  }

  private applyUiState(nextState: LauncherState, playMove: boolean): void {
    const previousState = this.state;
    this.state = normalizeControllerIndex(nextState);
    this.applyAudioSettings(previousState, this.state);

    if (playMove) {
      this.sfx.playUiMove();
    }

    this.renderDom();
  }

  private renderDom(): void {
    if (this.dom === null) {
      return;
    }

    const gameOption = requireGameOption(this.state.gameIndex);
    const controllerOption = requireControllerOption(this.state);

    this.dom.subtitle.textContent = 'Plug in. Play together.';
    this.dom.gameTitle.textContent = `${this.state.cursorIndex === MENU_ROW_GAME ? '>' : ''} ${gameOption.label}`;
    this.dom.gameDescription.textContent = gameOption.description;
    this.dom.startButton.textContent = this.state.cursorIndex === MENU_ROW_START ? 'PRESS START' : 'START';
    this.dom.previewLabel.textContent = previewLabel(gameOption);

    this.dom.gameCard.classList.toggle('is-focused', this.state.cursorIndex === MENU_ROW_GAME);
    this.dom.startButton.classList.toggle('is-focused', this.state.cursorIndex === MENU_ROW_START);

    if (this.settingsPanelMode === 'home') {
      this.dom.settingsTitle.textContent = `${this.state.cursorIndex === MENU_ROW_CONTROLLER ? '>' : ''} SETTINGS`;
      this.dom.settingsDescription.textContent = 'JOYSTICK: kontrolery | SPEAKER: audio';
      this.dom.controllerChips.style.display = 'none';
      this.dom.audioMixButton.style.display = 'none';
      this.dom.audioLoopButton.style.display = 'none';
    } else if (this.settingsPanelMode === 'controllers') {
      this.dom.settingsTitle.textContent = `${this.state.cursorIndex === MENU_ROW_CONTROLLER ? '>' : ''} CONTROLLER`;
      this.dom.settingsDescription.textContent = controllerOption.description;
      this.dom.controllerChips.style.display = 'flex';
      this.dom.audioMixButton.style.display = 'none';
      this.dom.audioLoopButton.style.display = 'none';
      this.renderControllerChips(gameOption);
    } else {
      this.dom.settingsTitle.textContent = `${this.state.cursorIndex === MENU_ROW_CONTROLLER ? '>' : ''} AUDIO`;
      this.dom.settingsDescription.textContent = 'Mix i test petli SFX.';
      this.dom.controllerChips.style.display = 'none';
      this.dom.audioMixButton.style.display = 'block';
      this.dom.audioLoopButton.style.display = 'block';
      const mixProfileId = requireAudioMixProfileId(this.state.audioMixProfileIndex);
      this.dom.audioMixButton.textContent = `AUDIO MIX [M / CLICK]: ${mixProfileId.toUpperCase()}`;
      this.dom.audioLoopButton.textContent = `SFX TEST LOOP [L / CLICK]: ${this.state.sfxLoopEnabled ? 'ON' : 'OFF'}`;
      this.dom.audioLoopButton.classList.toggle('is-on', this.state.sfxLoopEnabled);
    }

    this.dom.joystickButton.classList.toggle('is-active', this.settingsPanelMode === 'controllers');
    this.dom.speakerButton.classList.toggle('is-active', this.settingsPanelMode === 'audio');
    this.dom.settingsPanel.classList.toggle('is-focused', this.state.cursorIndex === MENU_ROW_CONTROLLER);

    this.dom.hint.textContent =
      'UP/DOWN: karta  LEFT/RIGHT: zmiana gry  ENTER: start  M/L: audio  F: fullscreen';
  }

  private renderControllerChips(gameOption: GameOption): void {
    if (this.dom === null) {
      return;
    }

    this.dom.controllerChips.replaceChildren();

    for (let index = 0; index < gameOption.controllerOptions.length; index += 1) {
      const option = gameOption.controllerOptions[index];
      if (option === undefined) {
        throw new Error(`Missing controller option at index ${index} for game ${gameOption.id}.`);
      }

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'launcher-controller-chip';
      chip.textContent = option.label.toUpperCase();
      chip.classList.toggle('is-active', this.state.controllerIndex === index);
      chip.addEventListener('click', () => {
        this.sfx.unlock();
        this.settingsPanelMode = 'controllers';
        this.applyUiState(
          {
            ...this.state,
            cursorIndex: MENU_ROW_CONTROLLER,
            controllerIndex: index
          },
          true
        );
      });
      this.dom.controllerChips.append(chip);
    }
  }

  private applyAudioSettings(previousState: LauncherState, nextState: LauncherState): void {
    if (previousState.audioMixProfileIndex !== nextState.audioMixProfileIndex) {
      this.sfx.setMixProfile(requireAudioMixProfileId(nextState.audioMixProfileIndex));
    }

    if (!previousState.sfxLoopEnabled && nextState.sfxLoopEnabled) {
      this.sfxLoopTimer = 0;
      this.sfxLoopStep = 0;
    }

    if (previousState.sfxLoopEnabled && !nextState.sfxLoopEnabled) {
      this.sfxLoopTimer = 0;
    }
  }

  private updateSfxLoop(delta: number): void {
    if (!this.state.sfxLoopEnabled) {
      return;
    }

    this.sfxLoopTimer -= delta;
    if (this.sfxLoopTimer > 0) {
      return;
    }

    const step = this.sfxLoopStep % 5;
    if (step === 0) {
      this.sfx.playPlayerShot({ pan: -0.65, depth: 0.08 });
    } else if (step === 1) {
      this.sfx.playEnemyShot({ pan: 0.5, depth: 0.3 });
    } else if (step === 2) {
      this.sfx.playExplosion({ pan: -0.2, depth: 0.35, large: false });
    } else if (step === 3) {
      this.sfx.playPlayerHit({ pan: 0.1, depth: 0.05 });
    } else {
      this.sfx.playExplosion({ pan: 0.38, depth: 0.18, large: true });
    }

    this.sfxLoopStep += 1;
    this.sfxLoopTimer = 420;
  }

  private createStars(): MenuStar[] {
    const rng = new Phaser.Math.RandomDataGenerator(['launcher-stars-v5']);
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

    const centerX = width / 2;
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
    const audioMixProfileId = requireAudioMixProfileId(this.state.audioMixProfileIndex);

    if (gameOption.sceneKey === PIXEL_INVADERS_SCENE_KEY) {
      const data: PixelInvadersSceneData = {
        controllerProfileId: controllerOption.profileId,
        controllerLabel: controllerOption.label,
        audioMixProfileId
      };

      this.scene.start(PIXEL_INVADERS_SCENE_KEY, data);
      return;
    }

    if (gameOption.sceneKey === TUNNEL_INVADERS_SCENE_KEY) {
      const data: TunnelInvadersSceneData = {
        controllerProfileId: controllerOption.profileId,
        controllerLabel: controllerOption.label,
        audioMixProfileId
      };

      this.scene.start(TUNNEL_INVADERS_SCENE_KEY, data);
      return;
    }

    throw new Error(`Unsupported scene key: "${gameOption.sceneKey}".`);
  }
}
