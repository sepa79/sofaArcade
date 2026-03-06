import Phaser from 'phaser';
import QRCode from 'qrcode';
import { AUDIO_MIX_PROFILE_IDS, RetroSfx, type AudioMixProfileId } from '@light80/game-sdk';

import arcadeLogoImage from '../../../shared-assets/src/logo_cropped.png';
import launcherJoystickImage from '../../../shared-assets/src/launcher_joystick.png';
import launcherSpeakerImage from '../../../shared-assets/src/launcher_speaker.png';
import { createMultiplayerGameLaunchData } from '../launch-contract';
import { PIXEL_PHONE_LINK_CONTROLLER_ID } from '../launch-contract';
import { currentPhoneHostSnapshot, startPhoneHostSession } from '../phone/host-link';
import { requireLazySceneLoader, type PlayableSceneKey } from '../scene-loader';
import {
  MENU_ROW_CONTROLLER,
  MENU_ROW_GAME,
  MENU_ROW_START,
  createInitialLauncherState,
  type LauncherState
} from '../launcher/model';
import {
  GAME_OPTIONS,
  optionUsesPhoneLink,
  type ControllerOption,
  type GameOption
} from '../launcher/options';

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
type LauncherLanguage = 'en' | 'pl';

interface LauncherDom {
  readonly root: HTMLDivElement;
  readonly topBar: HTMLDivElement;
  readonly languageEnButton: HTMLButtonElement;
  readonly languagePlButton: HTMLButtonElement;
  readonly helpButton: HTMLButtonElement;
  readonly helpModal: HTMLDivElement;
  readonly helpModalCard: HTMLDivElement;
  readonly helpTitle: HTMLDivElement;
  readonly helpBody: HTMLDivElement;
  readonly helpCloseButton: HTMLButtonElement;
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
  readonly phoneConnectButton: HTMLButtonElement;
  readonly phoneConnectStatus: HTMLDivElement;
  readonly phoneSetupModal: HTMLDivElement;
  readonly phoneSetupCard: HTMLDivElement;
  readonly phoneSetupTitle: HTMLDivElement;
  readonly phoneSetupStatus: HTMLDivElement;
  readonly phoneSetupOpenLink: HTMLAnchorElement;
  readonly phoneSetupQrCanvas: HTMLCanvasElement;
  readonly phoneSetupConnectButton: HTMLButtonElement;
  readonly phoneSetupCloseButton: HTMLButtonElement;
  readonly audioMixButton: HTMLButtonElement;
  readonly audioLoopButton: HTMLButtonElement;
  readonly hint: HTMLDivElement;
}

interface LauncherCopy {
  readonly subtitle: string;
  readonly start: string;
  readonly pressStart: string;
  readonly settingsTitle: string;
  readonly settingsHomeDescription: string;
  readonly controllerTitle: string;
  readonly phoneConnectLabel: string;
  readonly phoneConnectStart: string;
  readonly phoneSetupTitle: string;
  readonly phoneSetupOpenLink: string;
  readonly phoneSetupClose: string;
  readonly audioTitle: string;
  readonly audioDescription: string;
  readonly mixLabel: string;
  readonly loopLabel: string;
  readonly loopOn: string;
  readonly loopOff: string;
  readonly hint: string;
  readonly helpTitle: string;
  readonly helpClose: string;
  readonly helpBody: string;
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

function requirePlayableSceneKey(sceneKey: string): PlayableSceneKey {
  if (sceneKey === 'pixel-invaders' || sceneKey === 'tunnel-invaders') {
    return sceneKey;
  }

  throw new Error(`Unsupported playable scene key: "${sceneKey}".`);
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

function gameDescription(game: GameOption, language: LauncherLanguage): string {
  if (language === 'pl') {
    if (game.id === 'pixel-invaders') {
      return 'Klasyczny test loop: ruch, strzal, fala przeciwnikow.';
    }
    if (game.id === 'tunnel-invaders') {
      return 'Pseudo-3D tunel: przeciwnicy nadlatuja z glebi na krawedz.';
    }
    throw new Error(`Missing localized game description for game "${game.id}" and language "${language}".`);
  }

  if (game.id === 'pixel-invaders') {
    return 'Classic gameplay loop: movement, shots, and enemy waves.';
  }
  if (game.id === 'tunnel-invaders') {
    return 'Pseudo-3D tunnel: enemies rush from depth to the front edge.';
  }
  throw new Error(`Missing localized game description for game "${game.id}" and language "${language}".`);
}

function controllerDescription(option: ControllerOption, language: LauncherLanguage): string {
  if (language === 'pl') {
    return option.description;
  }

  if (option.id === 'pixel-solo-hybrid') {
    return 'One player: keyboard + mouse + first gamepad as a shared local input set.';
  }
  if (option.id === 'pixel-coop-kb-pad') {
    return 'Two local slots: keyboard/mouse for P1 and gamepad 1 for P2.';
  }
  if (option.id === 'pixel-coop-two-pads') {
    return 'Two gamepads on separate local slots. Best couch setup without keyboard.';
  }
  if (option.id === 'pixel-phone-solo') {
    return 'One phone slot through WebRTC phone link.';
  }
  if (option.id === 'pixel-pad-phone') {
    return 'Two slots: local gamepad 1 plus one phone through phone link.';
  }
  if (option.id === 'tunnel-solo-default') {
    return 'Relative orbit movement with primary fire and phase-jump.';
  }
  throw new Error(
    `Missing localized controller description for option "${option.id}" and language "${language}".`
  );
}

const LAUNCHER_COPY: Readonly<Record<LauncherLanguage, LauncherCopy>> = {
  en: {
    subtitle: 'Plug in. Play together.',
    start: 'START',
    pressStart: 'PRESS START',
    settingsTitle: 'SETTINGS',
    settingsHomeDescription: 'JOYSTICK: controllers | SPEAKER: audio',
    controllerTitle: 'CONTROLLER',
    phoneConnectLabel: 'PHONE LINK',
    phoneConnectStart: 'PHONE SETUP',
    phoneSetupTitle: 'PHONE LINK SETUP',
    phoneSetupOpenLink: 'OPEN CONTROLLER URL',
    phoneSetupClose: 'CLOSE',
    audioTitle: 'AUDIO',
    audioDescription: 'Mix and SFX loop test.',
    mixLabel: 'AUDIO MIX [M / CLICK]',
    loopLabel: 'SFX TEST LOOP [L / CLICK]',
    loopOn: 'ON',
    loopOff: 'OFF',
    hint: 'UP/DOWN: panel  LEFT/RIGHT: game/option  ENTER: start  M/L: audio  F: fullscreen',
    helpTitle: 'Controls',
    helpClose: 'CLOSE',
    helpBody:
      'Launcher\n' +
      'UP/DOWN: select panel\n' +
      'LEFT/RIGHT: game/setting\n' +
      'ENTER or SPACE: start game\n' +
      'M: next audio mix\n' +
      'L: SFX test loop\n' +
      'F: fullscreen\n\n' +
      'In game (global)\n' +
      'F1: SFX on/off\n' +
      'F2: music pause/play\n' +
      'F3/F4: previous/next song\n' +
      'F5: browser refresh (unbound)\n' +
      'F6: debug mode on/off\n\n' +
      'Debug mode\n' +
      'Pixel Invaders: F7 F8 F9 F10\n' +
      'Tunnel Invaders: [ ] 9 0 S W Z X D F R H M'
  },
  pl: {
    subtitle: 'Bierz kontroler. Gramy.',
    start: 'START',
    pressStart: 'PRESS START',
    settingsTitle: 'USTAWIENIA',
    settingsHomeDescription: 'JOYSTICK: kontrolery | SPEAKER: audio',
    controllerTitle: 'KONTROLER',
    phoneConnectLabel: 'LINK TELEFONU',
    phoneConnectStart: 'USTAW TELEFON',
    phoneSetupTitle: 'KONFIGURACJA TELEFONU',
    phoneSetupOpenLink: 'OTWORZ URL KONTROLERA',
    phoneSetupClose: 'ZAMKNIJ',
    audioTitle: 'AUDIO',
    audioDescription: 'Mix i test petli SFX.',
    mixLabel: 'AUDIO MIX [M / CLICK]',
    loopLabel: 'SFX TEST LOOP [L / CLICK]',
    loopOn: 'WL',
    loopOff: 'WYL',
    hint: 'UP/DOWN: panel  LEFT/RIGHT: gra/opcja  ENTER: start  M/L: audio  F: fullscreen',
    helpTitle: 'Sterowanie',
    helpClose: 'ZAMKNIJ',
    helpBody:
      'Launcher\n' +
      'UP/DOWN: wybor panelu\n' +
      'LEFT/RIGHT: gra/opcja\n' +
      'ENTER lub SPACE: start gry\n' +
      'M: kolejny mix audio\n' +
      'L: petla testowa SFX\n' +
      'F: fullscreen\n\n' +
      'W grze (globalnie)\n' +
      'F1: SFX wlacz/wylacz\n' +
      'F2: muzyka pauza/play\n' +
      'F3/F4: poprzedni/nastepny utwor\n' +
      'F5: odswiezanie przegladarki (brak binda)\n' +
      'F6: debug mode wlacz/wylacz\n\n' +
      'Debug mode\n' +
      'Pixel Invaders: F7 F8 F9 F10\n' +
      'Tunnel Invaders: [ ] 9 0 S W Z X D F R H M'
  }
};

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
  private language: LauncherLanguage = 'en';
  private helpVisible = false;
  private phoneSetupVisible = false;
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
  private startInFlight = false;
  private phoneConnectInFlight = false;
  private phoneSnapshotSignature = '';
  private phoneQrValue = '';

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
    const initialSnapshot = currentPhoneHostSnapshot(PIXEL_PHONE_LINK_CONTROLLER_ID);
    this.phoneSnapshotSignature = [
      initialSnapshot.status,
      initialSnapshot.message,
      initialSnapshot.sessionId ?? '',
      initialSnapshot.controllerUrl ?? ''
    ].join('|');

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

    const phoneSnapshot = currentPhoneHostSnapshot(PIXEL_PHONE_LINK_CONTROLLER_ID);
    const snapshotSignature = [
      phoneSnapshot.status,
      phoneSnapshot.message,
      phoneSnapshot.sessionId ?? '',
      phoneSnapshot.controllerUrl ?? ''
    ].join('|');
    if (snapshotSignature !== this.phoneSnapshotSignature) {
      this.phoneSnapshotSignature = snapshotSignature;
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

    const topBar = document.createElement('div');
    topBar.className = 'launcher-top-bar';

    const languageEnButton = document.createElement('button');
    languageEnButton.className = 'launcher-top-button';
    languageEnButton.type = 'button';
    languageEnButton.textContent = '🇬🇧 EN';

    const languagePlButton = document.createElement('button');
    languagePlButton.className = 'launcher-top-button';
    languagePlButton.type = 'button';
    languagePlButton.textContent = '🇵🇱 PL';

    const helpButton = document.createElement('button');
    helpButton.className = 'launcher-top-button launcher-help-button';
    helpButton.type = 'button';
    helpButton.textContent = '?';

    topBar.append(languageEnButton, languagePlButton, helpButton);

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

    const phoneConnectButton = document.createElement('button');
    phoneConnectButton.className = 'launcher-phone-connect';
    phoneConnectButton.type = 'button';

    const phoneConnectStatus = document.createElement('div');
    phoneConnectStatus.className = 'launcher-phone-status';

    const audioMixButton = document.createElement('button');
    audioMixButton.className = 'launcher-audio-row';
    audioMixButton.type = 'button';

    const audioLoopButton = document.createElement('button');
    audioLoopButton.className = 'launcher-audio-row';
    audioLoopButton.type = 'button';

    settingsContent.append(
      settingsTitle,
      settingsDescription,
      controllerChips,
      phoneConnectButton,
      phoneConnectStatus,
      audioMixButton,
      audioLoopButton
    );
    settingsPanel.append(joystickButton, settingsContent, speakerButton);

    const hint = document.createElement('div');
    hint.className = 'launcher-hint';

    const helpModal = document.createElement('div');
    helpModal.className = 'launcher-help-modal';
    const helpModalCard = document.createElement('div');
    helpModalCard.className = 'launcher-help-card';
    const helpTitle = document.createElement('div');
    helpTitle.className = 'launcher-help-title';
    const helpBody = document.createElement('div');
    helpBody.className = 'launcher-help-body';
    const helpCloseButton = document.createElement('button');
    helpCloseButton.className = 'launcher-help-close';
    helpCloseButton.type = 'button';
    helpModalCard.append(helpTitle, helpBody, helpCloseButton);
    helpModal.append(helpModalCard);

    const phoneSetupModal = document.createElement('div');
    phoneSetupModal.className = 'launcher-help-modal';
    const phoneSetupCard = document.createElement('div');
    phoneSetupCard.className = 'launcher-help-card launcher-phone-setup-card';
    const phoneSetupTitle = document.createElement('div');
    phoneSetupTitle.className = 'launcher-help-title';
    const phoneSetupStatus = document.createElement('div');
    phoneSetupStatus.className = 'launcher-phone-status launcher-phone-status-modal';
    const phoneSetupQrCanvas = document.createElement('canvas');
    phoneSetupQrCanvas.className = 'launcher-phone-qr launcher-phone-qr-modal';
    phoneSetupQrCanvas.width = 260;
    phoneSetupQrCanvas.height = 260;
    const phoneSetupOpenLink = document.createElement('a');
    phoneSetupOpenLink.className = 'launcher-phone-open-link';
    phoneSetupOpenLink.target = '_blank';
    phoneSetupOpenLink.rel = 'noopener noreferrer';
    const phoneSetupConnectButton = document.createElement('button');
    phoneSetupConnectButton.className = 'launcher-phone-connect';
    phoneSetupConnectButton.type = 'button';
    const phoneSetupCloseButton = document.createElement('button');
    phoneSetupCloseButton.className = 'launcher-help-close';
    phoneSetupCloseButton.type = 'button';
    phoneSetupCard.append(
      phoneSetupTitle,
      phoneSetupStatus,
      phoneSetupQrCanvas,
      phoneSetupOpenLink,
      phoneSetupConnectButton,
      phoneSetupCloseButton
    );
    phoneSetupModal.append(phoneSetupCard);

    shell.append(gamePanel, settingsPanel);
    root.append(topBar, header, shell, hint, helpModal, phoneSetupModal);
    host.append(root);

    this.dom = {
      root,
      topBar,
      languageEnButton,
      languagePlButton,
      helpButton,
      helpModal,
      helpModalCard,
      helpTitle,
      helpBody,
      helpCloseButton,
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
      phoneConnectButton,
      phoneConnectStatus,
      phoneSetupModal,
      phoneSetupCard,
      phoneSetupTitle,
      phoneSetupStatus,
      phoneSetupOpenLink,
      phoneSetupQrCanvas,
      phoneSetupConnectButton,
      phoneSetupCloseButton,
      audioMixButton,
      audioLoopButton,
      hint
    };

    languageEnButton.addEventListener('click', () => {
      this.sfx.unlock();
      if (this.language === 'en') {
        return;
      }
      this.language = 'en';
      this.sfx.playUiMove();
      this.renderDom();
    });

    languagePlButton.addEventListener('click', () => {
      this.sfx.unlock();
      if (this.language === 'pl') {
        return;
      }
      this.language = 'pl';
      this.sfx.playUiMove();
      this.renderDom();
    });

    helpButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.helpVisible = !this.helpVisible;
      this.sfx.playUiMove();
      this.renderDom();
    });

    helpCloseButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.helpVisible = false;
      this.sfx.playUiMove();
      this.renderDom();
    });

    helpModal.addEventListener('click', () => {
      if (!this.helpVisible) {
        return;
      }
      this.sfx.unlock();
      this.helpVisible = false;
      this.sfx.playUiMove();
      this.renderDom();
    });

    helpModalCard.addEventListener('click', (event) => {
      event.stopPropagation();
    });

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

    phoneConnectButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.sfx.playUiMove();
      this.phoneSetupVisible = true;
      this.renderDom();
    });

    phoneSetupConnectButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.sfx.playUiMove();
      void this.connectPhoneController();
    });

    phoneSetupCloseButton.addEventListener('click', () => {
      this.sfx.unlock();
      this.sfx.playUiMove();
      this.phoneSetupVisible = false;
      this.renderDom();
    });

    phoneSetupModal.addEventListener('click', () => {
      if (!this.phoneSetupVisible) {
        return;
      }
      this.sfx.unlock();
      this.sfx.playUiMove();
      this.phoneSetupVisible = false;
      this.renderDom();
    });

    phoneSetupCard.addEventListener('click', (event) => {
      event.stopPropagation();
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
    this.phoneQrValue = '';
  }

  private phoneStatusText(): string {
    const snapshot = currentPhoneHostSnapshot(PIXEL_PHONE_LINK_CONTROLLER_ID);
    if (snapshot.controllerUrl === null || snapshot.sessionId === null) {
      return snapshot.message;
    }

    return `CODE ${snapshot.sessionId} | ${snapshot.message}\n${snapshot.controllerUrl}`;
  }

  private renderPhoneQr(controllerUrl: string | null): void {
    if (this.dom === null) {
      return;
    }

    const canvas = this.dom.phoneSetupQrCanvas;
    if (controllerUrl === null) {
      canvas.style.display = 'none';
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('2D canvas context is required for launcher phone QR.');
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      this.phoneQrValue = '';
      return;
    }

    canvas.style.display = 'block';
    if (this.phoneQrValue === controllerUrl) {
      return;
    }

    this.phoneQrValue = controllerUrl;
    void QRCode.toCanvas(canvas, controllerUrl, {
      width: 260,
      margin: 1,
      color: {
        dark: '#E9F4FF',
        light: '#0C132B'
      }
    }).catch((error: unknown) => {
      throw error;
    });
  }

  private async connectPhoneController(): Promise<void> {
    if (this.phoneConnectInFlight) {
      return;
    }

    this.phoneConnectInFlight = true;
    this.renderDom();
    try {
      await startPhoneHostSession(PIXEL_PHONE_LINK_CONTROLLER_ID);
    } finally {
      this.phoneConnectInFlight = false;
      this.renderDom();
    }
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
    const copy = LAUNCHER_COPY[this.language];
    if (copy === undefined) {
      throw new Error(`Missing launcher copy for language "${this.language}".`);
    }

    this.dom.subtitle.textContent = copy.subtitle;
    this.dom.gameTitle.textContent = `${this.state.cursorIndex === MENU_ROW_GAME ? '>' : ''} ${gameOption.label}`;
    this.dom.gameDescription.textContent = gameDescription(gameOption, this.language);
    this.dom.startButton.textContent = this.state.cursorIndex === MENU_ROW_START ? copy.pressStart : copy.start;
    this.dom.previewLabel.textContent = previewLabel(gameOption);
    this.dom.languageEnButton.classList.toggle('is-active', this.language === 'en');
    this.dom.languagePlButton.classList.toggle('is-active', this.language === 'pl');
    this.dom.helpModal.classList.toggle('is-visible', this.helpVisible);
    this.dom.helpTitle.textContent = copy.helpTitle;
    this.dom.helpBody.textContent = copy.helpBody;
    this.dom.helpCloseButton.textContent = copy.helpClose;
    this.dom.phoneSetupTitle.textContent = copy.phoneSetupTitle;
    this.dom.phoneSetupCloseButton.textContent = copy.phoneSetupClose;
    this.dom.phoneSetupOpenLink.textContent = copy.phoneSetupOpenLink;

    this.dom.gameCard.classList.toggle('is-focused', this.state.cursorIndex === MENU_ROW_GAME);
    this.dom.startButton.classList.toggle('is-focused', this.state.cursorIndex === MENU_ROW_START);
    const phoneProfileActive = optionUsesPhoneLink(controllerOption);

    if (!phoneProfileActive) {
      this.phoneSetupVisible = false;
    }

    if (this.settingsPanelMode === 'home') {
      this.dom.settingsTitle.textContent = `${this.state.cursorIndex === MENU_ROW_CONTROLLER ? '>' : ''} ${copy.settingsTitle}`;
      this.dom.settingsDescription.textContent = copy.settingsHomeDescription;
      this.dom.controllerChips.style.display = 'none';
      this.dom.phoneConnectButton.style.display = 'none';
      this.dom.phoneConnectStatus.style.display = 'none';
      this.dom.audioMixButton.style.display = 'none';
      this.dom.audioLoopButton.style.display = 'none';
    } else if (this.settingsPanelMode === 'controllers') {
      this.dom.settingsTitle.textContent = `${this.state.cursorIndex === MENU_ROW_CONTROLLER ? '>' : ''} ${copy.controllerTitle}`;
      this.dom.settingsDescription.textContent = controllerDescription(controllerOption, this.language);
      this.dom.controllerChips.style.display = 'flex';
      this.dom.phoneConnectButton.style.display = phoneProfileActive ? 'block' : 'none';
      this.dom.phoneConnectStatus.style.display = phoneProfileActive ? 'block' : 'none';
      this.dom.phoneConnectButton.textContent = copy.phoneConnectStart;
      this.dom.phoneConnectButton.disabled = this.phoneConnectInFlight;
      this.dom.phoneConnectStatus.textContent = this.phoneStatusText();
      this.dom.audioMixButton.style.display = 'none';
      this.dom.audioLoopButton.style.display = 'none';
      this.renderControllerChips(gameOption);
    } else {
      this.dom.settingsTitle.textContent = `${this.state.cursorIndex === MENU_ROW_CONTROLLER ? '>' : ''} ${copy.audioTitle}`;
      this.dom.settingsDescription.textContent = copy.audioDescription;
      this.dom.controllerChips.style.display = 'none';
      this.dom.phoneConnectButton.style.display = 'none';
      this.dom.phoneConnectStatus.style.display = 'none';
      this.dom.audioMixButton.style.display = 'block';
      this.dom.audioLoopButton.style.display = 'block';
      const mixProfileId = requireAudioMixProfileId(this.state.audioMixProfileIndex);
      this.dom.audioMixButton.textContent = `${copy.mixLabel}: ${mixProfileId.toUpperCase()}`;
      this.dom.audioLoopButton.textContent = `${copy.loopLabel}: ${this.state.sfxLoopEnabled ? copy.loopOn : copy.loopOff}`;
      this.dom.audioLoopButton.classList.toggle('is-on', this.state.sfxLoopEnabled);
    }

    this.dom.joystickButton.classList.toggle('is-active', this.settingsPanelMode === 'controllers');
    this.dom.speakerButton.classList.toggle('is-active', this.settingsPanelMode === 'audio');
    this.dom.settingsPanel.classList.toggle('is-focused', this.state.cursorIndex === MENU_ROW_CONTROLLER);

    const phoneSnapshot = currentPhoneHostSnapshot(PIXEL_PHONE_LINK_CONTROLLER_ID);
    this.dom.phoneSetupModal.classList.toggle('is-visible', this.phoneSetupVisible && phoneProfileActive);
    this.dom.phoneSetupStatus.textContent = this.phoneStatusText();
    this.dom.phoneSetupConnectButton.textContent = this.phoneConnectInFlight
      ? `${copy.phoneConnectLabel}: ...`
      : copy.phoneConnectStart;
    this.dom.phoneSetupConnectButton.disabled = this.phoneConnectInFlight;
    if (phoneSnapshot.controllerUrl === null) {
      this.dom.phoneSetupOpenLink.style.display = 'none';
      this.dom.phoneSetupOpenLink.removeAttribute('href');
    } else {
      this.dom.phoneSetupOpenLink.style.display = 'inline-block';
      this.dom.phoneSetupOpenLink.href = phoneSnapshot.controllerUrl;
    }
    this.renderPhoneQr(phoneProfileActive && this.phoneSetupVisible ? phoneSnapshot.controllerUrl : null);

    this.dom.hint.textContent = copy.hint;
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
    if (this.startInFlight) {
      return;
    }
    this.startInFlight = true;
    void this.startSelectedGameAsync();
  }

  private async startSelectedGameAsync(): Promise<void> {
    if (!this.scale.isFullscreen) {
      this.scale.startFullscreen();
    }

    const gameOption = requireGameOption(this.state.gameIndex);
    const controllerOption = requireControllerOption(this.state);
    const audioMixProfileId = requireAudioMixProfileId(this.state.audioMixProfileIndex);
    const sceneKey = requirePlayableSceneKey(gameOption.sceneKey);
    const data =
      controllerOption.launchMode === 'pixel_multiplayer'
        ? createMultiplayerGameLaunchData({
            playerSlots: controllerOption.playerSlots,
            audioMixProfileId
          })
        : {
            controllerProfileId: controllerOption.controllerProfileId,
            controllerLabel: controllerOption.label,
            audioMixProfileId,
            phoneLinkEnabled: controllerOption.phoneLinkEnabled
          };

    try {
      const sceneLoader = requireLazySceneLoader(this);
      await sceneLoader.ensureLoaded(sceneKey);
      this.scene.start(sceneKey, data);
    } catch (error) {
      this.startInFlight = false;
      throw error;
    }
  }
}
