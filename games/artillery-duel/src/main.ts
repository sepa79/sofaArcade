import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import {
  ARTILLERY_DUEL_SCENE_KEY,
  ArtilleryDuelScene
} from './scenes/artillery-duel-scene';
import { ARTILLERY_LAUNCH_OPTIONS, artilleryLaunchData } from './launch-options';
import './style.css';

const BOOTSTRAP_SCENE_KEY = 'artillery-duel-bootstrap';

class BootstrapScene extends Phaser.Scene {
  constructor() {
    super(BOOTSTRAP_SCENE_KEY);
  }

  create(): void {
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
        this.scene.start(ARTILLERY_DUEL_SCENE_KEY, artilleryLaunchData(option.id));
      });
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
