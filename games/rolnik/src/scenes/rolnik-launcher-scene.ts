import Phaser from 'phaser';

import { createInputContext, readFrameInput, type InputContext } from '../game/input';
import type { StartingProfileId } from '../game/types';
import { ROLNIK_SCENE_KEY, type RolnikSceneData } from './rolnik-scene';

export const ROLNIK_LAUNCHER_SCENE_KEY = 'rolnik-launcher';

export type RolnikLauncherSceneData = RolnikSceneData;

interface ViewportMetrics {
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
}

function requireNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
}

function parseStartingProfileId(value: unknown, index: number): StartingProfileId {
  if (value === 'dairy-start' || value === 'pork-start' || value === 'poultry-start') {
    return value;
  }

  throw new Error(`Rolnik launcher received invalid startingProfileIds[${index}].`);
}

function parseSceneData(rawData: unknown): RolnikLauncherSceneData {
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Rolnik launcher requires launch data object.');
  }

  const data = rawData as Record<string, unknown>;
  if (typeof data.controllerProfileId !== 'string') {
    throw new Error('Rolnik launcher requires controllerProfileId.');
  }
  if (typeof data.controllerLabel !== 'string') {
    throw new Error('Rolnik launcher requires controllerLabel.');
  }
  if (
    data.audioMixProfileId !== 'arcade' &&
    data.audioMixProfileId !== 'cinema' &&
    data.audioMixProfileId !== 'late-night'
  ) {
    throw new Error('Rolnik launcher requires valid audioMixProfileId.');
  }
  if (!Array.isArray(data.startingProfileIds)) {
    throw new Error('Rolnik launcher requires startingProfileIds array.');
  }

  requireNonEmptyString(data.controllerProfileId, 'controllerProfileId');
  requireNonEmptyString(data.controllerLabel, 'controllerLabel');

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel,
    audioMixProfileId: data.audioMixProfileId,
    startingProfileIds: data.startingProfileIds.map((value, index) =>
      parseStartingProfileId(value, index)
    )
  };
}

export class RolnikLauncherScene extends Phaser.Scene {
  private launchData!: RolnikLauncherSceneData;
  private inputContext!: InputContext;
  private graphics!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private setupText!: Phaser.GameObjects.Text;

  constructor() {
    super(ROLNIK_LAUNCHER_SCENE_KEY);
  }

  create(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);

    this.graphics = this.add.graphics();
    this.titleText = this.add
      .text(0, 0, 'ROLNIK', {
        color: '#f7efcf',
        fontFamily: 'Courier New',
        fontSize: '88px'
      })
      .setOrigin(0.5, 0.5);
    this.subtitleText = this.add
      .text(0, 0, 'SofaArcade', {
        color: '#ddb56a',
        fontFamily: 'Courier New',
        fontSize: '28px'
      })
      .setOrigin(0.5, 0.5);
    this.promptText = this.add
      .text(0, 0, 'Press Enter / Right / Space', {
        color: '#f2dfb5',
        fontFamily: 'Courier New',
        fontSize: '28px'
      })
      .setOrigin(0.5, 0.5);
    this.setupText = this.add
      .text(0, 0, '', {
        color: '#bda37a',
        fontFamily: 'Courier New',
        fontSize: '18px',
        align: 'center'
      })
      .setOrigin(0.5, 0.5);

    this.scale.on(Phaser.Scale.Events.RESIZE, () => {
      this.renderScene();
    });

    this.renderScene();
  }

  update(): void {
    const input = readFrameInput(this.inputContext);
    if (input.selectPressed || input.menuRightPressed || input.endTurnPressed) {
      this.scene.start(ROLNIK_SCENE_KEY, this.launchData);
      return;
    }

    this.renderScene();
  }

  private getViewportMetrics(): ViewportMetrics {
    const width = this.scale.width;
    const height = this.scale.height;

    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error(`Invalid Rolnik launcher viewport ${width}x${height}.`);
    }

    return {
      width,
      height,
      centerX: width / 2,
      centerY: height / 2
    };
  }

  private renderScene(): void {
    const viewport = this.getViewportMetrics();
    const panelWidth = Math.max(520, viewport.width * 0.52);
    const panelHeight = Math.max(300, viewport.height * 0.48);

    this.graphics.clear();
    this.graphics.fillGradientStyle(0x4e6a35, 0x4e6a35, 0x1d130e, 0x1d130e, 1, 1, 1, 1);
    this.graphics.fillRect(0, 0, viewport.width, viewport.height);

    this.graphics.fillStyle(0x2a1c15, 0.8);
    this.graphics.fillEllipse(
      viewport.centerX,
      viewport.centerY + viewport.height * 0.06,
      Math.max(680, viewport.width * 0.6),
      Math.max(220, viewport.height * 0.36)
    );

    this.graphics.fillStyle(0x20140f, 0.94);
    this.graphics.fillRoundedRect(
      viewport.centerX - panelWidth / 2,
      viewport.centerY - panelHeight / 2,
      panelWidth,
      panelHeight,
      32
    );
    this.graphics.lineStyle(4, 0xc69f61, 1);
    this.graphics.strokeRoundedRect(
      viewport.centerX - panelWidth / 2,
      viewport.centerY - panelHeight / 2,
      panelWidth,
      panelHeight,
      32
    );

    this.graphics.fillStyle(0x6a4c2c, 0.2);
    this.graphics.fillRoundedRect(
      viewport.centerX - (panelWidth - 48) / 2,
      viewport.centerY + 18,
      panelWidth - 48,
      68,
      18
    );

    const pulse = 0.72 + (Math.sin(this.time.now / 250) + 1) * 0.14;
    this.promptText.setAlpha(pulse);

    this.titleText.setPosition(viewport.centerX, viewport.centerY - 84);
    this.subtitleText.setPosition(viewport.centerX, viewport.centerY - 18);
    this.promptText.setPosition(viewport.centerX, viewport.centerY + 54);
    this.setupText.setPosition(viewport.centerX, viewport.centerY + 128);
    this.setupText.setText(
      `${this.launchData.startingProfileIds.length} players  |  ${this.launchData.startingProfileIds.join(' / ')}\n${this.launchData.controllerLabel}`
    );
  }
}
