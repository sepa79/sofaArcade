import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import {
  ARTILLERY_DUEL_SCENE_KEY,
  ArtilleryDuelScene
} from './scenes/artillery-duel-scene';
import { ARTILLERY_LAUNCH_OPTIONS, artilleryLaunchData } from './launch-options';
import {
  stepArtilleryLaunchMenu,
  type ArtilleryLaunchMenuState
} from './launch-menu';
import { createInputContext, readFrameInput, type InputContext } from './game/input';
import './style.css';

const BOOTSTRAP_SCENE_KEY = 'artillery-duel-bootstrap';

class BootstrapScene extends Phaser.Scene {
  private inputContext!: InputContext;
  private optionButtons: Phaser.GameObjects.Rectangle[] = [];
  private menuState: ArtilleryLaunchMenuState = {
    selectedOptionIndex: 0,
    verticalAxisHeld: false
  };

  constructor() {
    super(BOOTSTRAP_SCENE_KEY);
  }

  create(): void {
    this.inputContext = createInputContext(this, 'artillery-duel-shared-keyboard-gamepad');
    const centerX = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(0x081126);
    this.add.text(centerX, 92, 'ARTILLERY DUEL', {
      color: '#f4ecff',
      fontFamily: 'monospace',
      fontSize: '42px'
    }).setOrigin(0.5);
    this.add.text(centerX, 150, 'WYBIERZ TRYB GRY', {
      color: '#8ee9ff',
      fontFamily: 'monospace',
      fontSize: '20px'
    }).setOrigin(0.5);

    ARTILLERY_LAUNCH_OPTIONS.forEach((option, index) => {
      const y = 250 + index * 130;
      const button = this.add.rectangle(centerX, y, 460, 92, 0x17284a)
        .setStrokeStyle(3, 0x63d6ff)
        .setInteractive({ useHandCursor: true });
      this.optionButtons.push(button);
      this.add.text(centerX, y - 16, option.label, {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '24px'
      }).setOrigin(0.5);
      this.add.text(centerX, y + 20, option.description, {
        color: '#b9c9e8',
        fontFamily: 'monospace',
        fontSize: '14px'
      }).setOrigin(0.5);
      button.on('pointerdown', () => {
        this.launchOption(index);
      });
      button.on('pointerover', () => {
        this.menuState = { ...this.menuState, selectedOptionIndex: index };
        this.renderSelection();
      });
    });
    this.add.text(centerX, 510, '↑↓ / D-PAD    ENTER / FIRE', {
      color: '#8ee9ff',
      fontFamily: 'monospace',
      fontSize: '16px'
    }).setOrigin(0.5);
    this.renderSelection();
  }

  update(): void {
    const input = readFrameInput(this.inputContext);
    const previousSelection = this.menuState.selectedOptionIndex;
    const step = stepArtilleryLaunchMenu(this.menuState, {
      confirmPressed: input.firePressed || input.startPressed,
      verticalAxis: input.powerYSigned
    }, ARTILLERY_LAUNCH_OPTIONS.length);
    this.menuState = step.state;
    if (this.menuState.selectedOptionIndex !== previousSelection) {
      this.renderSelection();
    }
    if (step.launchOptionIndex !== null) {
      this.launchOption(step.launchOptionIndex);
    }
  }

  private launchOption(index: number): void {
    const option = ARTILLERY_LAUNCH_OPTIONS[index];
    if (option === undefined) {
      throw new Error(`Missing Artillery Duel launch option ${index}.`);
    }
    this.scene.start(ARTILLERY_DUEL_SCENE_KEY, artilleryLaunchData(option.id));
  }

  private renderSelection(): void {
    this.optionButtons.forEach((button, index) => {
      button.setFillStyle(index === this.menuState.selectedOptionIndex ? 0x284778 : 0x17284a);
      button.setStrokeStyle(3, index === this.menuState.selectedOptionIndex ? 0xffffff : 0x63d6ff);
    });
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scene: [BootstrapScene, ArtilleryDuelScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth || WORLD_WIDTH,
    height: window.innerHeight || WORLD_HEIGHT
  }
};

new Phaser.Game(gameConfig);
