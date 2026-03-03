import Phaser from 'phaser';

import {
  MENU_ROW_CONTROLLER,
  MENU_ROW_GAME,
  MENU_ROW_START,
  createInitialLauncherState,
  stepLauncher,
  type LauncherInput,
  type LauncherState
} from '../launcher/model';
import { GAME_OPTIONS, type ControllerOption, type GameOption } from '../launcher/options';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/constants';
import { PIXEL_INVADERS_SCENE_KEY, type PixelInvadersSceneData } from './pixel-invaders-scene';
import { TUNNEL_INVADERS_SCENE_KEY, type TunnelInvadersSceneData } from './tunnel-invaders-scene';

export const LAUNCHER_SCENE_KEY = 'launcher';

interface MenuKeys {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly enter: Phaser.Input.Keyboard.Key;
  readonly space: Phaser.Input.Keyboard.Key;
  readonly fullscreen: Phaser.Input.Keyboard.Key;
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

export class LauncherScene extends Phaser.Scene {
  private state: LauncherState = createInitialLauncherState();
  private keys!: MenuKeys;
  private titleText!: Phaser.GameObjects.Text;
  private gameText!: Phaser.GameObjects.Text;
  private gameDescriptionText!: Phaser.GameObjects.Text;
  private controllerText!: Phaser.GameObjects.Text;
  private controllerDescriptionText!: Phaser.GameObjects.Text;
  private startText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

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
      fullscreen: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F)
    };

    this.cameras.main.setBackgroundColor('#040716');

    this.titleText = this.add.text(WORLD_WIDTH / 2, 110, 'LIGHT80 ARCADE', {
      fontFamily: 'Trebuchet MS',
      fontSize: '54px',
      color: '#f6f8ff'
    });
    this.titleText.setOrigin(0.5, 0.5);

    this.gameText = this.add.text(120, 220, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '30px',
      color: '#b9c6e5'
    });

    this.gameDescriptionText = this.add.text(120, 260, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '20px',
      color: '#88d2ff',
      wordWrap: { width: WORLD_WIDTH - 240 }
    });

    this.controllerText = this.add.text(120, 350, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '30px',
      color: '#b9c6e5'
    });

    this.controllerDescriptionText = this.add.text(120, 390, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '20px',
      color: '#88d2ff',
      wordWrap: { width: WORLD_WIDTH - 240 }
    });

    this.startText = this.add.text(120, 500, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '34px',
      color: '#b9c6e5'
    });

    this.hintText = this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT - 50, '', {
      fontFamily: 'Trebuchet MS',
      fontSize: '20px',
      color: '#80a7d6'
    });
    this.hintText.setOrigin(0.5, 0.5);

    this.state = normalizeControllerIndex(this.state);
    this.renderMenu();
  }

  update(): void {
    const input: LauncherInput = {
      upPressed: Phaser.Input.Keyboard.JustDown(this.keys.up),
      downPressed: Phaser.Input.Keyboard.JustDown(this.keys.down),
      leftPressed: Phaser.Input.Keyboard.JustDown(this.keys.left),
      rightPressed: Phaser.Input.Keyboard.JustDown(this.keys.right),
      confirmPressed:
        Phaser.Input.Keyboard.JustDown(this.keys.enter) || Phaser.Input.Keyboard.JustDown(this.keys.space)
    };

    if (Phaser.Input.Keyboard.JustDown(this.keys.fullscreen)) {
      this.toggleFullscreen();
    }

    const gameOption = requireGameOption(this.state.gameIndex);
    const next = stepLauncher(this.state, input, GAME_OPTIONS.length, gameOption.controllerOptions.length);
    const normalizedNext = normalizeControllerIndex(next);
    const changed = normalizedNext !== this.state;
    this.state = normalizedNext;

    if (this.state.startRequested) {
      this.startSelectedGame();
      return;
    }

    if (changed) {
      this.renderMenu();
    }
  }

  private renderMenu(): void {
    const gameOption = requireGameOption(this.state.gameIndex);
    const controllerOption = requireControllerOption(this.state);

    this.gameText.setText(`${this.prefixForRow(MENU_ROW_GAME)} GAME: ${gameOption.label}`);
    this.gameDescriptionText.setText(gameOption.description);
    this.controllerText.setText(
      `${this.prefixForRow(MENU_ROW_CONTROLLER)} CONTROLLER: ${controllerOption.label}`
    );
    this.controllerDescriptionText.setText(controllerOption.description);
    this.startText.setText(`${this.prefixForRow(MENU_ROW_START)} START`);
    this.hintText.setText('UP/DOWN: wiersz  LEFT/RIGHT: opcja  ENTER: start  F: fullscreen');
  }

  private prefixForRow(row: number): string {
    return this.state.cursorIndex === row ? '>' : ' ';
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
