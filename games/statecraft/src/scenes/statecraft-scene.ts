import Phaser from 'phaser';

import {
  MAP_COLS,
  MAP_ORIGIN_X,
  MAP_ORIGIN_Y,
  MAP_ROWS,
  TILE_GAP,
  TILE_HEIGHT,
  TILE_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../game/constants';
import { advanceTime, applyAction, createMathRandomSource, updateBudget } from '../game/logic';
import { createInitialState } from '../game/state';
import type { GameState } from '../game/types';
import { createUiController, type UiController } from '../ui/dom';

export const STATECRAFT_SCENE_KEY = 'statecraft';

function tileBounds(col: number, row: number): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    MAP_ORIGIN_X + col * (TILE_WIDTH + TILE_GAP),
    MAP_ORIGIN_Y + row * (TILE_HEIGHT + TILE_GAP),
    TILE_WIDTH,
    TILE_HEIGHT
  );
}

function mapFrameBounds(): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    MAP_ORIGIN_X - 24,
    MAP_ORIGIN_Y - 18,
    MAP_COLS * TILE_WIDTH + (MAP_COLS - 1) * TILE_GAP + 48,
    MAP_ROWS * TILE_HEIGHT + (MAP_ROWS - 1) * TILE_GAP + 80
  );
}

export class StatecraftScene extends Phaser.Scene {
  private ui?: UiController;
  private state = createInitialState();
  private readonly random = createMathRandomSource();
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private footerText?: Phaser.GameObjects.Text;

  constructor() {
    super(STATECRAFT_SCENE_KEY);
  }

  attachUi(ui: UiController): void {
    this.ui = ui;
  }

  create(): void {
    if (this.ui === undefined) {
      this.ui = this.mountOverlayUi();
    }

    this.cameras.main.setBackgroundColor('#0f1010');
    this.mapGraphics = this.add.graphics();
    this.titleText = this.add.text(190, 56, 'STATECRAFT', {
      fontFamily: '"Impact", "Haettenschweiler", "Arial Narrow Bold", sans-serif',
      fontSize: '40px',
      color: '#f4ecd0',
      letterSpacing: 2
    });
    this.footerText = this.add.text(190, WORLD_HEIGHT - 48, 'Select a sector, steer budgets, survive the month loop.', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '20px',
      color: '#d7c9a1'
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const tileId = this.findTileAt(pointer.x, pointer.y);
      if (tileId !== null) {
        this.state = applyAction(this.state, { type: 'select_tile', tileId }, this.random);
        this.render();
      }
    });

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.ui !== undefined) {
        this.ui.destroy();
      }
    });

    this.render();
  }

  update(_time: number, deltaMs: number): void {
    const nextState = advanceTime(this.state, deltaMs / 1000, this.random);
    if (nextState !== this.state) {
      this.state = nextState;
      this.render();
    }
  }

  dispatchAction(action: Parameters<typeof applyAction>[1]): void {
    this.state = applyAction(this.state, action, this.random);
    this.render();
  }

  applyBudget(key: Parameters<typeof updateBudget>[1], value: number): void {
    this.state = updateBudget(this.state, key, value);
    this.render();
  }

  private render(): void {
    if (this.mapGraphics === undefined || this.titleText === undefined || this.footerText === undefined) {
      throw new Error('Statecraft scene render invoked before scene was initialized.');
    }
    if (this.ui === undefined) {
      throw new Error('Statecraft scene render invoked before UI was attached.');
    }

    this.mapGraphics.clear();
    this.drawBackdrop(this.mapGraphics);
    this.drawMap(this.mapGraphics);
    this.ui.render(this.state);
    this.footerText.setText(
      this.state.map.selectedTileId === null
        ? 'Select a sector, steer budgets, survive the month loop.'
        : `Selected sector ${this.state.map.selectedTileId + 1}. Contracts ${this.state.markets.activeContracts.length}.`
    );
  }

  private drawBackdrop(graphics: Phaser.GameObjects.Graphics): void {
    const frame = mapFrameBounds();

    graphics.fillGradientStyle(0x1d2f31, 0x1d2f31, 0x090b0b, 0x090b0b, 1, 1, 1, 1);
    graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    graphics.lineStyle(2, 0xc7a85d, 0.28);
    graphics.strokeRoundedRect(frame.x, frame.y, frame.width, frame.height, 24);
  }

  private drawMap(graphics: Phaser.GameObjects.Graphics): void {
    for (const tile of this.state.map.tiles) {
      const bounds = tileBounds(tile.col, tile.row);
      const selected = this.state.map.selectedTileId === tile.id;
      const fillColor =
        tile.damaged ? 0x7f2e2e :
        tile.rigLevel > 0 ? 0x2f6f44 :
        tile.surveyed ? 0x5a6448 :
        0x34362d;

      graphics.fillStyle(fillColor, 1);
      graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 18);

      graphics.lineStyle(selected ? 4 : 2, selected ? 0xf6d27b : 0xa98f58, selected ? 1 : 0.65);
      graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 18);

      this.addOrReuseLabel(tile.id, bounds, tile);
    }
  }

  private addOrReuseLabel(tileId: number, bounds: Phaser.Geom.Rectangle, tile: GameState['map']['tiles'][number]): void {
    const labelKey = `tile-label-${tileId}`;
    const existingLabel = this.children.getByName(labelKey);
    let label: Phaser.GameObjects.Text;
    if (existingLabel instanceof Phaser.GameObjects.Text) {
      label = existingLabel;
    } else {
      label = this.add.text(bounds.x + 12, bounds.y + 10, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '18px',
        color: '#f7f0d2'
      });
      label.setName(labelKey);
    }

    const status =
      tile.damaged ? 'Damaged' :
      tile.rigLevel > 0 ? `Rig x${tile.rigLevel}` :
      tile.surveyed ? 'Surveyed' :
      'Unknown';

    label.setText(`S${tile.id + 1}\n${status}\nR${tile.richness.toFixed(2)}`);
  }

  private findTileAt(x: number, y: number): number | null {
    for (let row = 0; row < MAP_ROWS; row += 1) {
      for (let col = 0; col < MAP_COLS; col += 1) {
        const bounds = tileBounds(col, row);
        if (bounds.contains(x, y)) {
          return row * MAP_COLS + col;
        }
      }
    }

    return null;
  }

  private mountOverlayUi(): UiController {
    const host = this.game.canvas.parentElement;
    if (!(host instanceof HTMLElement)) {
      throw new Error('Statecraft launcher mode requires a canvas host element.');
    }

    const overlayRoot = document.createElement('div');
    overlayRoot.className = 'statecraft-overlay-root';
    host.append(overlayRoot);

    return createUiController(
      overlayRoot,
      {
        onBudgetChange: (key, value) => {
          this.applyBudget(key, value);
        },
        onAction: (action) => {
          this.dispatchAction({ type: action });
        },
        onPauseToggle: () => {
          this.dispatchAction({ type: 'toggle_pause' });
        },
        onSpeedChange: (speed) => {
          this.dispatchAction({ type: 'set_speed', speed });
        }
      },
      { mode: 'overlay' }
    );
  }
}
