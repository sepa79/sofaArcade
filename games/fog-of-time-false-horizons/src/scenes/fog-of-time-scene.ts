import Phaser from 'phaser';

import { MAP_HEIGHT_LY, MAP_WIDTH_LY } from '../game/constants';
import {
  advanceTurn,
  canBuildRelay,
  estimatedTravelTurns,
  knowledgeAge,
  playerRelayConstructions
} from '../game/logic';
import { createInitialState } from '../game/state';
import type { Channel, Doctrine, GameState, KnowledgeRecord, Owner, PlayerCommand, StarSystem } from '../game/types';

export const FOG_OF_TIME_SCENE_KEY = 'fog-of-time-false-horizons';

type ButtonKind = 'channel' | 'doctrine' | 'action' | 'turn';

interface ButtonSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly enabled: boolean;
  readonly active: boolean;
  readonly kind: ButtonKind;
  readonly onClick: () => void;
}

interface ButtonView {
  readonly background: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

interface SystemLabelSet {
  readonly name: Phaser.GameObjects.Text;
  readonly age: Phaser.GameObjects.Text;
}

interface SidebarLayout {
  readonly left: number;
  readonly width: number;
  readonly top: number;
  readonly selectedY: number;
  readonly statsY: number;
  readonly travelY: number;
  readonly channelsY: number;
  readonly doctrinesY: number;
  readonly relayInfoY: number;
  readonly endTurnY: number;
  readonly actionY: number;
  readonly logY: number;
  readonly bottom: number;
}

function requireParent(scene: Phaser.Scene): HTMLElement {
  const parent = scene.game.canvas.parentElement;
  if (parent === null) {
    throw new Error('Fog of Time requires a canvas parent element.');
  }

  return parent;
}

function ownerColor(owner: Owner): number {
  switch (owner) {
    case 'player':
      return 0x75f4d6;
    case 'enemy':
      return 0xff8b6e;
    case 'neutral':
      return 0xf3cd76;
  }
}

function ownerText(owner: Owner): string {
  switch (owner) {
    case 'player':
      return 'PLAYER';
    case 'enemy':
      return 'ENEMY';
    case 'neutral':
      return 'NEUTRAL';
  }
}

function doctrineText(doctrine: Doctrine): string {
  return doctrine;
}

function panelTextStyle(color = '#c7f6ff', size = 18): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: '"Orbitron HUD", "Trebuchet MS", sans-serif',
    fontSize: `${size}px`,
    color
  };
}

export class FogOfTimeScene extends Phaser.Scene {
  private state: GameState = createInitialState();
  private selectedSystemId = this.state.playerCapitalId;
  private relaySourceSystemId: string | null = null;
  private selectedChannel: Channel = 'radio';
  private pendingCommands: PlayerCommand[] = [];

  private mapGraphics!: Phaser.GameObjects.Graphics;
  private uiGraphics!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private selectedText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private travelText!: Phaser.GameObjects.Text;
  private relayText!: Phaser.GameObjects.Text;
  private pendingText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  private buttonViews = new Map<string, ButtonView>();
  private systemZones = new Map<string, Phaser.GameObjects.Zone>();
  private systemLabels = new Map<string, SystemLabelSet>();

  constructor() {
    super(FOG_OF_TIME_SCENE_KEY);
  }

  create(): void {
    requireParent(this).classList.add('fog-of-time-host');

    this.cameras.main.setBackgroundColor('#05070d');
    this.mapGraphics = this.add.graphics();
    this.uiGraphics = this.add.graphics();

    this.titleText = this.add.text(0, 0, '', panelTextStyle('#ffcf72', 22));
    this.statusText = this.add.text(0, 0, '', panelTextStyle('#8eb8c8', 16));
    this.selectedText = this.add.text(0, 0, '', panelTextStyle('#d8f8ff', 18));
    this.statsText = this.add.text(0, 0, '', panelTextStyle('#a7d7e0', 16));
    this.travelText = this.add.text(0, 0, '', panelTextStyle('#8eb8c8', 15));
    this.relayText = this.add.text(0, 0, '', panelTextStyle('#ffcf72', 15));
    this.pendingText = this.add.text(0, 0, '', panelTextStyle('#8eb8c8', 13));
    this.logText = this.add.text(0, 0, '', panelTextStyle('#8eb8c8', 14));

    for (const system of this.state.systems) {
      const zone = this.add.zone(0, 0, 20, 20).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.selectedSystemId = system.id;
        this.refreshUi();
      });
      this.systemZones.set(system.id, zone);

      const name = this.add.text(0, 0, '', panelTextStyle('#d8f8ff', 14)).setOrigin(0.5, 1);
      const age = this.add.text(0, 0, '', panelTextStyle('#7f97a5', 11)).setOrigin(0.5, 0);
      this.systemLabels.set(system.id, { name, age });
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.refreshUi());
    this.refreshUi();
  }

  private get viewportWidth(): number {
    return this.scale.gameSize.width;
  }

  private get viewportHeight(): number {
    return this.scale.gameSize.height;
  }

  private mapRect(): Phaser.Geom.Rectangle {
    const margin = 24;
    const sidebarWidth = Math.max(360, Math.min(420, Math.floor(this.viewportWidth * 0.31)));
    return new Phaser.Geom.Rectangle(
      margin,
      margin,
      this.viewportWidth - sidebarWidth - margin * 3,
      this.viewportHeight - margin * 2
    );
  }

  private sidebarX(): number {
    return this.mapRect().right + 24;
  }

  private sidebarWidth(): number {
    return this.viewportWidth - this.sidebarX() - 24;
  }

  private knownRecord(systemId: string): KnowledgeRecord {
    const record = this.state.knowledge.find((candidate) => candidate.systemId === systemId);
    if (record === undefined) {
      throw new Error(`Missing knowledge record for "${systemId}".`);
    }

    return record;
  }

  private knownOwner(systemId: string): Owner {
    if (systemId === this.state.playerCapitalId) {
      return this.requireSystem(systemId).owner;
    }

    return this.knownRecord(systemId).lastKnownOwner;
  }

  private requireSystem(systemId: string): StarSystem {
    const system = this.state.systems.find((candidate) => candidate.id === systemId);
    if (system === undefined) {
      throw new Error(`Unknown system "${systemId}".`);
    }

    return system;
  }

  private projectSystem(system: StarSystem): Phaser.Math.Vector2 {
    const map = this.mapRect();
    const x = map.x + (system.x / MAP_WIDTH_LY) * map.width;
    const y = map.bottom - (system.y / MAP_HEIGHT_LY) * map.height;
    return new Phaser.Math.Vector2(x, y);
  }

  private sidebarLayout(): SidebarLayout {
    const map = this.mapRect();
    const left = this.sidebarX() + 18;
    const width = this.sidebarWidth() - 36;
    return {
      left,
      width,
      top: map.y + 18,
      selectedY: map.y + 78,
      statsY: map.y + 110,
      travelY: map.y + 252,
      channelsY: map.y + 334,
      doctrinesY: map.y + 372,
      relayInfoY: map.y + 446,
      endTurnY: map.y + 534,
      actionY: map.y + 582,
      logY: map.y + 636,
      bottom: map.bottom - 18
    };
  }

  private visibleEventLogText(layout: SidebarLayout): string {
    const availableHeight = Math.max(0, layout.bottom - layout.logY);
    const lineHeight = 18;
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
    const lines = this.state.eventLog.flatMap((entry) => {
      const text = `${entry.turn}: ${entry.text}`;
      return text.length <= 52 ? [text] : [text.slice(0, 52), text.slice(52)];
    });
    return lines.slice(-maxLines).join('\n');
  }

  private pendingSummaryLines(): ReadonlyArray<string> {
    if (this.pendingCommands.length === 0) {
      return ['PENDING: none'];
    }

    return this.pendingCommands.slice(0, 3).map((command) => {
      switch (command.type) {
        case 'SET_DOCTRINE':
          return `PENDING: ${this.requireSystem(command.systemId).name} -> ${command.doctrine} via ${command.channel}`;
        case 'BUILD_RELAY':
          return `PENDING: relay ${this.requireSystem(command.fromSystemId).name}-${this.requireSystem(command.toSystemId).name} via ${command.channel}`;
      }
    });
  }

  private queuedDoctrine(systemId: string): Doctrine | null {
    const command = this.pendingCommands.find(
      (candidate): candidate is Extract<PlayerCommand, { readonly type: 'SET_DOCTRINE' }> =>
        candidate.type === 'SET_DOCTRINE' && candidate.systemId === systemId
    );
    return command?.doctrine ?? null;
  }

  private hasQueuedRelayBuild(fromSystemId: string, toSystemId: string): boolean {
    return this.pendingCommands.some(
      (candidate) =>
        candidate.type === 'BUILD_RELAY' &&
        ((candidate.fromSystemId === fromSystemId && candidate.toSystemId === toSystemId) ||
          (candidate.fromSystemId === toSystemId && candidate.toSystemId === fromSystemId))
    );
  }

  private queueOrReplaceCommand(command: PlayerCommand): void {
    const retained = this.pendingCommands.filter((candidate) => {
      if (candidate.type !== command.type) {
        return true;
      }

      if (candidate.type === 'SET_DOCTRINE' && command.type === 'SET_DOCTRINE') {
        return candidate.systemId !== command.systemId;
      }

      if (candidate.type === 'BUILD_RELAY' && command.type === 'BUILD_RELAY') {
        return !(
          (candidate.fromSystemId === command.fromSystemId && candidate.toSystemId === command.toSystemId) ||
          (candidate.fromSystemId === command.toSystemId && candidate.toSystemId === command.fromSystemId)
        );
      }

      return true;
    });

    this.pendingCommands = retained.concat(command);
  }

  private refreshUi(): void {
    this.drawPanels();
    this.drawMap();
    this.layoutText();
    this.layoutButtons();
  }

  private drawPanels(): void {
    const map = this.mapRect();
    const sidebarX = this.sidebarX();
    const sidebarWidth = this.sidebarWidth();

    this.uiGraphics.clear();
    this.uiGraphics.lineStyle(2, 0x29414f, 1);
    this.uiGraphics.fillStyle(0x091019, 0.98);
    this.uiGraphics.fillRoundedRect(map.x, map.y, map.width, map.height, 8);
    this.uiGraphics.strokeRoundedRect(map.x, map.y, map.width, map.height, 8);

    this.uiGraphics.fillStyle(0x0b121d, 0.98);
    this.uiGraphics.fillRoundedRect(sidebarX, map.y, sidebarWidth, map.height, 8);
    this.uiGraphics.strokeRoundedRect(sidebarX, map.y, sidebarWidth, map.height, 8);
  }

  private drawMap(): void {
    const map = this.mapRect();
    this.mapGraphics.clear();

    this.mapGraphics.lineStyle(1, 0x173447, 0.8);
    for (let x = 0; x <= 7; x += 1) {
      const t = x / 7;
      const lineX = Phaser.Math.Linear(map.x + 18, map.right - 18, t);
      this.mapGraphics.lineBetween(lineX, map.y + 16, lineX, map.bottom - 16);
    }
    for (let y = 0; y <= 5; y += 1) {
      const t = y / 5;
      const lineY = Phaser.Math.Linear(map.y + 18, map.bottom - 18, t);
      this.mapGraphics.lineBetween(map.x + 16, lineY, map.right - 16, lineY);
    }

    for (const link of this.state.relayLinks) {
      if (link.owner !== 'player') {
        continue;
      }

      const a = this.projectSystem(this.requireSystem(link.a));
      const b = this.projectSystem(this.requireSystem(link.b));
      this.mapGraphics.lineStyle(2, 0x5fcbe8, 0.45);
      this.mapGraphics.lineBetween(a.x, a.y, b.x, b.y);
    }

    for (const system of this.state.systems) {
      const projected = this.projectSystem(system);
      const knownOwner = this.knownOwner(system.id);
      const isSelected = system.id === this.selectedSystemId;
      const radius = system.id === this.state.playerCapitalId ? 8 : 6;

      this.mapGraphics.fillStyle(ownerColor(knownOwner), 1);
      this.mapGraphics.fillCircle(projected.x, projected.y, radius);

      if (isSelected) {
        this.mapGraphics.lineStyle(2, 0xffcf72, 1);
        this.mapGraphics.strokeCircle(projected.x, projected.y, radius + 6);
      }

      const zone = this.systemZones.get(system.id);
      if (zone === undefined) {
        throw new Error(`Missing zone for "${system.id}".`);
      }
      zone.setPosition(projected.x, projected.y);
      zone.setSize(28, 28);

      const labels = this.systemLabels.get(system.id);
      if (labels === undefined) {
        throw new Error(`Missing labels for "${system.id}".`);
      }
      labels.name.setText(system.name);
      labels.name.setPosition(projected.x, projected.y - 12);
      labels.name.setColor(system.id === this.state.playerCapitalId ? '#ffcf72' : '#d7f7ff');
      labels.age.setText(`${knowledgeAge(this.state, system.id)}y`);
      labels.age.setPosition(projected.x, projected.y + 12);
      labels.age.setColor(system.id === this.state.playerCapitalId ? '#ffcf72' : '#7693a3');
    }
  }

  private layoutText(): void {
    const layout = this.sidebarLayout();
    const selectedSystem = this.requireSystem(this.selectedSystemId);
    const known = this.knownRecord(this.selectedSystemId);

    this.titleText.setPosition(layout.left, layout.top);
    this.titleText.setText('FOG OF TIME: FALSE HORIZONS');

    this.statusText.setPosition(layout.left, layout.top + 30);
    this.statusText.setText(
      `TURN ${this.state.turn}  CAPITAL ${this.requireSystem(this.state.playerCapitalId).name}  PLAN ${this.pendingCommands.length}  MSG ${this.state.messages.length}`
    );

    this.selectedText.setPosition(layout.left, layout.selectedY);
    this.selectedText.setText(`SELECTED: ${selectedSystem.name}`);

    const owner = this.knownOwner(this.selectedSystemId);
    const statsLines = [
      `KNOWN OWNER  ${ownerText(owner)}`,
      `REPORT AGE   ${knowledgeAge(this.state, this.selectedSystemId)} YEARS`,
      `POPULATION   ${known.lastKnownPopulation}`,
      `INDUSTRY     ${known.lastKnownIndustry}`,
      `DEFENSE      ${known.lastKnownDefense}`,
      `GARRISON     ${known.lastKnownGarrison}`,
      `DOCTRINE     ${doctrineText(known.lastKnownDoctrine)}`
    ];
    this.statsText.setPosition(layout.left, layout.statsY);
    this.statsText.setText(statsLines.join('\n'));

    const radioEta = estimatedTravelTurns(this.state, this.selectedSystemId, 'radio');
    const relayEta = estimatedTravelTurns(this.state, this.selectedSystemId, 'relay');
    const courierEta = estimatedTravelTurns(this.state, this.selectedSystemId, 'courier');
    this.travelText.setPosition(layout.left, layout.travelY);
    this.travelText.setText(
      [
        'DELIVERY ETA',
        `RADIO    ${radioEta === null ? 'N/A' : `${radioEta}Y`}`,
        `RELAY    ${relayEta === null ? 'N/A' : `${relayEta}Y`}`,
        `COURIER  ${courierEta === null ? 'N/A' : `${courierEta}Y`}`
      ].join('\n')
    );

    this.relayText.setPosition(layout.left, layout.relayInfoY);
    this.relayText.setWordWrapWidth(layout.width);
    this.relayText.setText(
      this.relaySourceSystemId === null
        ? 'RELAY NET: select an owned source node, then select another owned node to queue a link.'
        : `RELAY MODE: source locked on ${this.requireSystem(this.relaySourceSystemId).name}.`
    );

    const activeBuilds = playerRelayConstructions(this.state)
      .map((construction) => `${this.requireSystem(construction.fromSystemId).name}-${this.requireSystem(construction.toSystemId).name} ${construction.completeTurn - this.state.turn}Y`)
      .slice(0, 2);
    this.pendingText.setPosition(layout.left, layout.relayInfoY + 34);
    this.pendingText.setWordWrapWidth(layout.width);
    this.pendingText.setText(this.pendingSummaryLines().concat(activeBuilds.map((line) => `BUILDING: ${line}`)).join('\n'));

    this.logText.setPosition(layout.left, layout.logY);
    this.logText.setWordWrapWidth(layout.width);
    this.logText.setText(this.visibleEventLogText(layout));
  }

  private buttonSpecs(): ReadonlyArray<ButtonSpec> {
    const layout = this.sidebarLayout();
    const selectedKnownOwner = this.knownOwner(this.selectedSystemId);
    const doctrineEnabled = selectedKnownOwner === 'player' && this.selectedSystemId !== this.state.playerCapitalId;
    const queuedDoctrine = this.queuedDoctrine(this.selectedSystemId);
    const relaySourceKnownOwner =
      this.relaySourceSystemId === null ? null : this.knownOwner(this.relaySourceSystemId);
    const relayTargetKnownOwner = selectedKnownOwner;
    const canConfirmRelay =
      this.relaySourceSystemId !== null &&
      relaySourceKnownOwner === 'player' &&
      relayTargetKnownOwner === 'player' &&
      canBuildRelay(this.state, this.relaySourceSystemId, this.selectedSystemId) &&
      !this.hasQueuedRelayBuild(this.relaySourceSystemId, this.selectedSystemId);

    return [
      {
        id: 'turn',
        x: layout.left,
        y: layout.endTurnY,
        width: layout.width,
        height: 38,
        label: 'END YEAR',
        enabled: true,
        active: false,
        kind: 'turn',
        onClick: () => this.endYear()
      },
      {
        id: 'channel-radio',
        x: layout.left,
        y: layout.channelsY,
        width: 88,
        height: 28,
        label: 'RADIO',
        enabled: true,
        active: this.selectedChannel === 'radio',
        kind: 'channel',
        onClick: () => this.selectChannel('radio')
      },
      {
        id: 'channel-relay',
        x: layout.left + 94,
        y: layout.channelsY,
        width: 88,
        height: 28,
        label: 'RELAY',
        enabled: estimatedTravelTurns(this.state, this.selectedSystemId, 'relay') !== null,
        active: this.selectedChannel === 'relay',
        kind: 'channel',
        onClick: () => this.selectChannel('relay')
      },
      {
        id: 'channel-courier',
        x: layout.left + 188,
        y: layout.channelsY,
        width: 96,
        height: 28,
        label: 'COURIER',
        enabled: true,
        active: this.selectedChannel === 'courier',
        kind: 'channel',
        onClick: () => this.selectChannel('courier')
      },
      {
        id: 'doctrine-balanced',
        x: layout.left,
        y: layout.doctrinesY,
        width: 126,
        height: 28,
        label: 'BALANCED',
        enabled: doctrineEnabled,
        active: queuedDoctrine === 'BALANCED',
        kind: 'doctrine',
        onClick: () => this.queueDoctrine('BALANCED')
      },
      {
        id: 'doctrine-military',
        x: layout.left + 134,
        y: layout.doctrinesY,
        width: 126,
        height: 28,
        label: 'MILITARY',
        enabled: doctrineEnabled,
        active: queuedDoctrine === 'MILITARY',
        kind: 'doctrine',
        onClick: () => this.queueDoctrine('MILITARY')
      },
      {
        id: 'doctrine-survival',
        x: layout.left,
        y: layout.doctrinesY + 34,
        width: 126,
        height: 28,
        label: 'SURVIVAL',
        enabled: doctrineEnabled,
        active: queuedDoctrine === 'SURVIVAL',
        kind: 'doctrine',
        onClick: () => this.queueDoctrine('SURVIVAL')
      },
      {
        id: 'doctrine-expand',
        x: layout.left + 134,
        y: layout.doctrinesY + 34,
        width: 126,
        height: 28,
        label: 'EXPAND',
        enabled: doctrineEnabled,
        active: queuedDoctrine === 'EXPAND',
        kind: 'doctrine',
        onClick: () => this.queueDoctrine('EXPAND')
      },
      {
        id: 'relay-source',
        x: layout.left,
        y: layout.actionY,
        width: 148,
        height: 28,
        label: 'SET RELAY NODE',
        enabled: selectedKnownOwner === 'player',
        active: this.relaySourceSystemId === this.selectedSystemId,
        kind: 'action',
        onClick: () => {
          this.relaySourceSystemId = this.selectedSystemId;
          this.refreshUi();
        }
      },
      {
        id: 'relay-confirm',
        x: layout.left + 156,
        y: layout.actionY,
        width: layout.width - 156,
        height: 28,
        label: this.relaySourceSystemId === null ? 'QUEUE RELAY LINK' : `LINK TO ${this.requireSystem(this.selectedSystemId).name}`,
        enabled: canConfirmRelay,
        active:
          this.relaySourceSystemId !== null &&
          this.hasQueuedRelayBuild(this.relaySourceSystemId, this.selectedSystemId),
        kind: 'action',
        onClick: () => this.queueRelayBuild()
      }
    ];
  }

  private layoutButtons(): void {
    for (const button of this.buttonViews.values()) {
      button.background.destroy();
      button.label.destroy();
    }
    this.buttonViews.clear();

    for (const spec of this.buttonSpecs()) {
      const fill = spec.enabled ? (spec.active ? 0x224450 : 0x101b25) : 0x0a1016;
      const stroke = spec.active ? 0xffcf72 : spec.enabled ? 0x4d7386 : 0x243543;
      const textColor = spec.enabled ? (spec.active ? '#ffcf72' : '#d7f7ff') : '#526571';

      const background = this.add
        .rectangle(spec.x, spec.y, spec.width, spec.height, fill)
        .setOrigin(0, 0)
        .setStrokeStyle(1, stroke)
        .setInteractive(spec.enabled ? { useHandCursor: true } : undefined);
      const label = this.add
        .text(spec.x + spec.width / 2, spec.y + spec.height / 2, spec.label, panelTextStyle(textColor, 14))
        .setOrigin(0.5);

      if (spec.enabled) {
        background.on('pointerdown', spec.onClick);
      }

      this.buttonViews.set(spec.id, {
        background,
        label
      });
    }
  }

  private selectChannel(channel: Channel): void {
    if (channel === 'relay' && estimatedTravelTurns(this.state, this.selectedSystemId, 'relay') === null) {
      return;
    }

    this.selectedChannel = channel;
    this.refreshUi();
  }

  private queueDoctrine(doctrine: Doctrine): void {
    this.queueOrReplaceCommand({
      type: 'SET_DOCTRINE',
      systemId: this.selectedSystemId,
      doctrine,
      channel: this.selectedChannel
    });
    this.refreshUi();
  }

  private queueRelayBuild(): void {
    if (this.relaySourceSystemId === null) {
      throw new Error('Relay build requested without a source system.');
    }

    this.queueOrReplaceCommand({
      type: 'BUILD_RELAY',
      fromSystemId: this.relaySourceSystemId,
      toSystemId: this.selectedSystemId,
      channel: this.selectedChannel
    });
    this.relaySourceSystemId = null;
    this.refreshUi();
  }

  private endYear(): void {
    this.state = advanceTurn(this.state, this.pendingCommands);
    this.pendingCommands = [];
    this.refreshUi();
  }
}
