import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import { StatecraftScene } from './scenes/statecraft-scene';
import './style.css';
import { createUiController } from './ui/dom';

const root = document.getElementById('app');
if (!(root instanceof HTMLElement)) {
  throw new Error('Statecraft requires an #app root element.');
}

const scene = new StatecraftScene();
const ui = createUiController(root, {
  onBudgetChange(key, value) {
    scene.applyBudget(key, value);
  },
  onAction(action) {
    scene.dispatchAction({ type: action });
  },
  onPauseToggle() {
    scene.dispatchAction({ type: 'toggle_pause' });
  },
  onSpeedChange(speed) {
    scene.dispatchAction({ type: 'set_speed', speed });
  }
});

scene.attachUi(ui);

const shellRoot = root.querySelector('#statecraft-stage');
if (!(shellRoot instanceof HTMLElement)) {
  throw new Error('Statecraft UI is missing #statecraft-stage.');
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: shellRoot,
  backgroundColor: '#0d0d0d',
  scene: [scene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT
  }
};

new Phaser.Game(gameConfig);
