import Phaser from 'phaser';

import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import { WAR_FOR_CROWN_RENDER_SCALE } from './scenes/render-scale';
import { WarForCrownScene } from './scenes/war-for-crown-scene';
import { loadWarForCrownUiFont } from './scenes/ui-font';
import './style.css';

void (async () => {
  await loadWarForCrownUiFont();

  const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    antialias: true,
    pixelArt: false,
    scene: [WarForCrownScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_WIDTH * WAR_FOR_CROWN_RENDER_SCALE,
      height: WORLD_HEIGHT * WAR_FOR_CROWN_RENDER_SCALE
    }
  };

  new Phaser.Game(gameConfig);
})();
