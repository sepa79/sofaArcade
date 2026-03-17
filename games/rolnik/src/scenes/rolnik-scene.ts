import Phaser from 'phaser';
import type { AudioMixProfileId } from '@light80/game-sdk';
import weatherClearUrl from '../assets/weather/weather-clear.png';
import weatherPartlyCloudyUrl from '../assets/weather/weather-partly-cloudy.png';
import weatherRainUrl from '../assets/weather/weather-rain.png';
import weatherSnowUrl from '../assets/weather/weather-snow.png';
import weatherStormUrl from '../assets/weather/weather-storm.png';
import houseForegroundUrl from '../assets/buildings/house-foreground.png';
import menuCropsUrl from '../assets/menu-icons/crops.png';
import menuAnimalsUrl from '../assets/menu-icons/animals.png';
import menuHouseUrl from '../assets/menu-icons/house.png';

import { MENU_SECTION_ORDER } from '../game/constants';
import { createInputContext, readFrameInput, type InputContext } from '../game/input';
import { stepGame } from '../game/logic';
import { createInitialState, getStartingProfileDefinition } from '../game/state';
import type { AnimalType, BuildingId, DetailModeId, GameState, MenuSectionId, SeasonId, StartingProfileId } from '../game/types';

export const ROLNIK_SCENE_KEY = 'rolnik';

export interface RolnikSceneData {
  readonly controllerProfileId: string;
  readonly controllerLabel: string;
  readonly audioMixProfileId: AudioMixProfileId;
  readonly startingProfileIds: ReadonlyArray<StartingProfileId>;
}

interface ViewportMetrics {
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
}

interface PlayerRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly houseAnchorX: number;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface PlayerLayout {
  readonly panelRect: Rect;
  readonly headerRect: Rect;
  readonly statsRect: Rect;
  readonly bodyRect: Rect;
  readonly navRect: Rect;
  readonly detailRect: Rect;
  readonly iconRowRect: Rect;
  readonly submenuRect: Rect;
}

interface PlayerUi {
  readonly label: Phaser.GameObjects.Text;
  readonly summary: Phaser.GameObjects.Text;
  readonly menuIcons: Phaser.GameObjects.Image[];
  readonly selectedMenuLabel: Phaser.GameObjects.Text;
  readonly submenuTexts: Phaser.GameObjects.Text[];
  readonly detailTitle: Phaser.GameObjects.Text;
  readonly detailBody: Phaser.GameObjects.Text;
  readonly detailHint: Phaser.GameObjects.Text;
}

type MenuSide = 'left' | 'right';

type WeatherVisualId = 'clear' | 'partly-cloudy' | 'rain' | 'storm' | 'snow';

const WEATHER_TEXTURE_KEYS: Readonly<Record<WeatherVisualId, string>> = {
  clear: 'rolnik-weather-clear',
  'partly-cloudy': 'rolnik-weather-partly-cloudy',
  rain: 'rolnik-weather-rain',
  storm: 'rolnik-weather-storm',
  snow: 'rolnik-weather-snow'
};

const WEATHER_TEXTURE_URLS: Readonly<Record<WeatherVisualId, string>> = {
  clear: weatherClearUrl,
  'partly-cloudy': weatherPartlyCloudyUrl,
  rain: weatherRainUrl,
  storm: weatherStormUrl,
  snow: weatherSnowUrl
};

const WEATHER_DISPLAY_ORDER: ReadonlyArray<WeatherVisualId> = [
  'partly-cloudy',
  'clear',
  'rain',
  'storm',
  'snow'
];

const MENU_LABELS: Readonly<Record<MenuSectionId, string>> = {
  crops: 'UPRAWY',
  animals: 'ZWIERZETA',
  house: 'DOM'
};

const MENU_ICON_TEXTURE_KEYS: Readonly<Record<MenuSectionId, string>> = {
  crops: 'rolnik-menu-crops',
  animals: 'rolnik-menu-animals',
  house: 'rolnik-menu-house'
};

const MENU_ICON_TEXTURE_URLS: Readonly<Record<MenuSectionId, string>> = {
  crops: menuCropsUrl,
  animals: menuAnimalsUrl,
  house: menuHouseUrl
};

const SUBMENU_LABELS: Readonly<Record<MenuSectionId, ReadonlyArray<string>>> = {
  crops: ['ZASIEJ', 'PLAN POLA', 'ZBIORY'],
  animals: ['STADO', 'PASZA', 'ZDROWIE'],
  house: ['BUDYNKI', 'ULEPSZENIA', 'KONIEC TURY']
};

const BUILDING_LABELS: Readonly<Record<BuildingId, string>> = {
  house: 'Dom',
  'cow-barn': 'Obora',
  'pig-pen': 'Chlewnia',
  coop: 'Kurnik',
  granary: 'Spichlerz',
  'root-storage': 'Kopcownik',
  'hay-barn': 'Stog / Siano',
  'machinery-shed': 'Szopa maszyn',
  mill: 'Mlyn',
  'fries-kitchen': 'Smazenia frytek',
  'sugar-works': 'Cukrownia',
  'feed-mill': 'Paszarnia',
  'cheese-dairy': 'Mleczarnia',
  'sausage-house': 'Masarnia',
  'fast-food-outlet': 'Fast-food'
};

const ANIMAL_ORDER: ReadonlyArray<AnimalType> = ['cow', 'pig', 'chicken'];
const ANIMAL_LABELS: Readonly<Record<AnimalType, string>> = {
  cow: 'Krowy',
  pig: 'Swinie',
  chicken: 'Kury'
};

const VISIBLE_SUBMENU_ITEMS = 5;

const HOUSE_TEXTURE_KEY = 'rolnik-house-foreground';

interface BackdropPalette {
  readonly skyTop: string;
  readonly skyMid: string;
  readonly skyLow: string;
  readonly groundTop: string;
  readonly groundMid: string;
  readonly groundDark: string;
  readonly horizon: string;
}

const BACKDROP_PALETTES: Readonly<Record<SeasonId, BackdropPalette>> = {
  spring: {
    skyTop: '#6db5ff',
    skyMid: '#9ed3ff',
    skyLow: '#d8efff',
    groundTop: '#8ed45a',
    groundMid: '#62b043',
    groundDark: '#3d7a2b',
    horizon: '#7dbd6a'
  },
  summer: {
    skyTop: '#4a9eff',
    skyMid: '#7cc2ff',
    skyLow: '#d4ecff',
    groundTop: '#87c746',
    groundMid: '#689d34',
    groundDark: '#426723',
    horizon: '#7aa25c'
  },
  autumn: {
    skyTop: '#7eb0ff',
    skyMid: '#b8d3ff',
    skyLow: '#f4eadc',
    groundTop: '#d79a3a',
    groundMid: '#a96825',
    groundDark: '#70411c',
    horizon: '#c69754'
  },
  winter: {
    skyTop: '#73a8e8',
    skyMid: '#b5d7ff',
    skyLow: '#eef7ff',
    groundTop: '#f0f6ff',
    groundMid: '#d8e4f3',
    groundDark: '#b3c3d7',
    horizon: '#a6bfd8'
  }
};

function requireNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
}

function parseStartingProfileId(value: unknown, index: number): StartingProfileId {
  if (
    value === 'dairy-start' ||
    value === 'pork-start' ||
    value === 'poultry-start'
  ) {
    return value;
  }

  throw new Error(`Rolnik scene received invalid startingProfileIds[${index}].`);
}

function parseSceneData(rawData: unknown): RolnikSceneData {
  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Rolnik scene requires launch data object.');
  }

  const data = rawData as Record<string, unknown>;
  if (typeof data.controllerProfileId !== 'string') {
    throw new Error('Rolnik scene requires controllerProfileId.');
  }
  if (typeof data.controllerLabel !== 'string') {
    throw new Error('Rolnik scene requires controllerLabel.');
  }
  if (
    data.audioMixProfileId !== 'arcade' &&
    data.audioMixProfileId !== 'cinema' &&
    data.audioMixProfileId !== 'late-night'
  ) {
    throw new Error('Rolnik scene requires valid audioMixProfileId.');
  }
  if (!Array.isArray(data.startingProfileIds)) {
    throw new Error('Rolnik scene requires startingProfileIds array.');
  }

  const startingProfileIds = data.startingProfileIds.map((value, index) =>
    parseStartingProfileId(value, index)
  );

  requireNonEmptyString(data.controllerProfileId, 'controllerProfileId');
  requireNonEmptyString(data.controllerLabel, 'controllerLabel');

  return {
    controllerProfileId: data.controllerProfileId,
    controllerLabel: data.controllerLabel,
    audioMixProfileId: data.audioMixProfileId,
    startingProfileIds
  };
}

function seasonIndex(season: SeasonId): number {
  switch (season) {
    case 'spring':
      return 0;
    case 'summer':
      return 1;
    case 'autumn':
      return 2;
    case 'winter':
      return 3;
  }
}

function currentWeatherVisual(state: GameState): WeatherVisualId {
  const turnIndex = (state.year - 1) * 4 + seasonIndex(state.season);
  return WEATHER_DISPLAY_ORDER[turnIndex % WEATHER_DISPLAY_ORDER.length];
}

function menuSideForPlayer(index: number, playerCount: number, region: PlayerRegion, viewport: ViewportMetrics): MenuSide {
  if (playerCount === 2) {
    return index === 0 ? 'left' : 'right';
  }

  return region.centerX < viewport.centerX ? 'left' : 'right';
}

function fieldModeLabel(mode: string): string {
  switch (mode) {
    case 'grain':
      return 'Zboze';
    case 'potatoes':
      return 'Ziemniaki';
    case 'roots':
      return 'Okopowe';
    case 'meadow':
      return 'Laka';
    default:
      throw new Error(`Unknown field mode "${mode}".`);
  }
}

function meadowUsageLabel(value: string | null): string {
  if (value === null) {
    return 'brak';
  }

  switch (value) {
    case 'hay':
      return 'siano';
    case 'pasture':
      return 'pastwisko';
    default:
      throw new Error(`Unknown meadow usage "${value}".`);
  }
}

function fieldRotationSlots(field: { readonly cropPlan: ReadonlyArray<{ readonly mode: string }> }): ReadonlyArray<string> {
  const slots = field.cropPlan.slice(0, 3).map((entry) => fieldModeLabel(entry.mode));
  while (slots.length < 3) {
    slots.push('PUSTE');
  }

  return slots;
}

function detailHintText(detailMode: DetailModeId, activeSection: MenuSectionId, activeSubmenuIndex: number): string {
  if (detailMode !== 'menu') {
    return 'GORA/DOL: LISTA    ENTER: WYBOR';
  }

  if (activeSection === 'crops') {
    return 'GORA/DOL: POLA    ENTER: WYBOR POLA';
  }

  if (activeSection === 'animals' && activeSubmenuIndex === 0) {
    return 'ENTER: STADO';
  }

  if (activeSection === 'house' && activeSubmenuIndex === 0) {
    return 'ENTER: BUDYNKI';
  }

  return 'GORA/DOL: PODMENU    LEWO/PRAWO: MENU    ENTER: WYBOR';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computePlayerLayout(
  region: PlayerRegion,
  worldBarTop: number,
  worldBarBottom: number,
  menuSide: MenuSide
): PlayerLayout {
  const outerPaddingX = 32;
  const outerPaddingY = 18;
  const worldGap = 14;
  const panelRect: Rect = {
    x: region.x + outerPaddingX,
    y: region.centerY < worldBarTop ? region.y + outerPaddingY : worldBarBottom + worldGap,
    width: region.width - outerPaddingX * 2,
    height:
      (region.centerY < worldBarTop ? worldBarTop - worldGap : region.y + region.height - outerPaddingY) -
      (region.centerY < worldBarTop ? region.y + outerPaddingY : worldBarBottom + worldGap)
  };

  const innerPadding = 12;
  const innerRect: Rect = {
    x: panelRect.x + innerPadding,
    y: panelRect.y + innerPadding,
    width: panelRect.width - innerPadding * 2,
    height: panelRect.height - innerPadding * 2
  };

  const headerHeight = clamp(Math.round(innerRect.height * 0.1), 26, 34);
  const statsHeight = clamp(Math.round(innerRect.height * 0.14), 40, 52);
  const sectionGap = 10;
  const bodyRect: Rect = {
    x: innerRect.x,
    y: innerRect.y + headerHeight + sectionGap + statsHeight + sectionGap,
    width: innerRect.width,
    height: innerRect.height - headerHeight - statsHeight - sectionGap * 2
  };

  const navWidth = clamp(Math.round(bodyRect.width * 0.32), 248, 320);
  const detailWidth = bodyRect.width - navWidth - sectionGap;
  const navRect: Rect = {
    x: menuSide === 'left' ? bodyRect.x : bodyRect.x + detailWidth + sectionGap,
    y: bodyRect.y,
    width: navWidth,
    height: bodyRect.height
  };
  const detailRect: Rect = {
    x: menuSide === 'left' ? bodyRect.x + navWidth + sectionGap : bodyRect.x,
    y: bodyRect.y,
    width: detailWidth,
    height: bodyRect.height
  };

  const iconRowHeight = clamp(Math.round(navRect.height * 0.28), 108, 132);
  const iconRowRect: Rect = {
    x: navRect.x,
    y: navRect.y,
    width: navRect.width,
    height: iconRowHeight
  };
  const submenuRect: Rect = {
    x: navRect.x,
    y: navRect.y + iconRowHeight + sectionGap,
    width: navRect.width,
    height: navRect.height - iconRowHeight - sectionGap
  };

  return {
    panelRect,
    headerRect: {
      x: innerRect.x,
      y: innerRect.y,
      width: innerRect.width,
      height: headerHeight
    },
    statsRect: {
      x: innerRect.x,
      y: innerRect.y + headerHeight + sectionGap,
      width: innerRect.width,
      height: statsHeight
    },
    bodyRect,
    navRect,
    detailRect,
    iconRowRect,
    submenuRect
  };
}

function createPlayerRegions(
  playerCount: number,
  viewport: ViewportMetrics
): ReadonlyArray<PlayerRegion> {
  if (playerCount === 2) {
    const upperHeight = Math.round(viewport.height / 2);
    const lowerY = upperHeight;
    return [
      {
        x: 0,
        y: 0,
        width: viewport.width,
        height: upperHeight,
        centerX: viewport.centerX,
        centerY: upperHeight / 2,
        houseAnchorX: 0.76
      },
      {
        x: 0,
        y: lowerY,
        width: viewport.width,
        height: viewport.height - lowerY,
        centerX: viewport.centerX,
        centerY: lowerY + (viewport.height - lowerY) / 2,
        houseAnchorX: 0.24
      }
    ];
  }

  if (playerCount === 3 || playerCount === 4) {
    const topHeight = Math.round(viewport.height / 2);
    const bottomY = topHeight;
    const bottomHeight = viewport.height - bottomY;
    const halfWidth = viewport.width / 2;
    const regions: PlayerRegion[] = [
      {
        x: 0,
        y: 0,
        width: halfWidth,
        height: topHeight,
        centerX: halfWidth / 2,
        centerY: topHeight / 2,
        houseAnchorX: 0.74
      },
      {
        x: halfWidth,
        y: 0,
        width: halfWidth,
        height: topHeight,
        centerX: halfWidth + halfWidth / 2,
        centerY: topHeight / 2,
        houseAnchorX: 0.26
      },
      {
        x: 0,
        y: bottomY,
        width: halfWidth,
        height: bottomHeight,
        centerX: halfWidth / 2,
        centerY: bottomY + bottomHeight / 2,
        houseAnchorX: 0.74
      },
      {
        x: halfWidth,
        y: bottomY,
        width: halfWidth,
        height: bottomHeight,
        centerX: halfWidth + halfWidth / 2,
        centerY: bottomY + bottomHeight / 2,
        houseAnchorX: 0.26
      }
    ];

    return regions.slice(0, playerCount);
  }

  throw new Error(`Unsupported Rolnik player layout for ${playerCount} players.`);
}

export class RolnikScene extends Phaser.Scene {
  private state!: GameState;
  private launchData!: RolnikSceneData;
  private inputContext!: InputContext;
  private regionMaskShapes: Phaser.GameObjects.Graphics[] = [];
  private regionMasks: Phaser.Display.Masks.GeometryMask[] = [];
  private graphics!: Phaser.GameObjects.Graphics;
  private houseImages: Phaser.GameObjects.Image[] = [];
  private playerUi: PlayerUi[] = [];
  private worldBarText!: Phaser.GameObjects.Text;
  private worldBarDetailText!: Phaser.GameObjects.Text;
  private weatherImage!: Phaser.GameObjects.Image;
  private readonly onResize = (): void => {
    this.renderScene();
  };

  constructor() {
    super(ROLNIK_SCENE_KEY);
  }

  preload(): void {
    for (const [weatherId, textureKey] of Object.entries(WEATHER_TEXTURE_KEYS)) {
      this.load.image(textureKey, WEATHER_TEXTURE_URLS[weatherId as WeatherVisualId]);
    }
    for (const [menuId, textureKey] of Object.entries(MENU_ICON_TEXTURE_KEYS)) {
      this.load.image(textureKey, MENU_ICON_TEXTURE_URLS[menuId as MenuSectionId]);
    }
    this.load.image(HOUSE_TEXTURE_KEY, houseForegroundUrl);
  }

  create(rawData: unknown): void {
    this.launchData = parseSceneData(rawData);
    this.state = createInitialState({
      startingProfileIds: this.launchData.startingProfileIds
    });
    this.inputContext = createInputContext(this, this.launchData.controllerProfileId);

    this.cameras.main.setBackgroundColor('#261813');
    this.regionMaskShapes = this.state.players.map(() => this.make.graphics());
    this.regionMasks = this.regionMaskShapes.map((shape) => shape.createGeometryMask());
    this.graphics = this.add.graphics().setDepth(1);
    this.houseImages = this.state.players.map(() =>
      this.add.image(0, 0, HOUSE_TEXTURE_KEY).setOrigin(0.5, 1).setDepth(0.5)
    );
    this.playerUi = this.state.players.map(() => ({
      label: this.add
        .text(0, 0, '', {
          color: '#fff5d9',
          fontFamily: 'Courier New',
          fontSize: '24px'
        })
        .setOrigin(0, 0)
        .setDepth(2),
      summary: this.add
        .text(0, 0, '', {
          color: '#f4e0b8',
          fontFamily: 'Courier New',
          fontSize: '15px',
          lineSpacing: 4
        })
        .setOrigin(0, 0)
        .setDepth(2),
      menuIcons: [
        this.add.image(0, 0, MENU_ICON_TEXTURE_KEYS.crops).setOrigin(0.5, 0.5).setDepth(2),
        this.add.image(0, 0, MENU_ICON_TEXTURE_KEYS.animals).setOrigin(0.5, 0.5).setDepth(2),
        this.add.image(0, 0, MENU_ICON_TEXTURE_KEYS.house).setOrigin(0.5, 0.5).setDepth(2)
      ],
      selectedMenuLabel: this.add
        .text(0, 0, '', {
          color: '#fff0c9',
          fontFamily: 'Courier New',
          fontSize: '16px'
        })
        .setOrigin(0.5, 0.5)
        .setDepth(2),
      submenuTexts: Array.from({ length: VISIBLE_SUBMENU_ITEMS }, () =>
        this.add.text(0, 0, '', {
          color: '#f4e0b8',
          fontFamily: 'Courier New',
          fontSize: '15px'
        }).setOrigin(0, 0.5).setDepth(2)
      ),
      detailTitle: this.add
        .text(0, 0, '', {
          color: '#fff0c9',
          fontFamily: 'Courier New',
          fontSize: '18px'
        })
        .setOrigin(0, 0)
        .setDepth(2),
      detailBody: this.add
        .text(0, 0, '', {
          color: '#f4e0b8',
          fontFamily: 'Courier New',
          fontSize: '15px',
          lineSpacing: 5
        })
        .setOrigin(0, 0)
        .setDepth(2),
      detailHint: this.add
        .text(0, 0, '', {
          color: '#e6cd9c',
          fontFamily: 'Courier New',
          fontSize: '13px'
        })
        .setOrigin(0, 1)
        .setDepth(2)
    }));
    this.weatherImage = this.add
      .image(0, 0, WEATHER_TEXTURE_KEYS.clear)
      .setOrigin(0.5, 0.5)
      .setDepth(3);
    this.worldBarText = this.add
      .text(0, 0, '', {
        color: '#f7efcf',
        fontFamily: 'Courier New',
        fontSize: '22px'
      })
      .setOrigin(1, 0.5)
      .setDepth(3);
    this.worldBarDetailText = this.add
      .text(0, 0, '', {
        color: '#e7d7ac',
        fontFamily: 'Courier New',
        fontSize: '22px'
      })
      .setOrigin(0, 0.5)
      .setDepth(3);

    for (const textureKey of [
      ...Object.values(WEATHER_TEXTURE_KEYS),
      ...Object.values(MENU_ICON_TEXTURE_KEYS),
      HOUSE_TEXTURE_KEY
    ]) {
      this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.houseImages.forEach((image, index) => {
      const mask = this.regionMasks[index];
      if (mask === undefined) {
        throw new Error(`Missing Rolnik region mask for house ${index}.`);
      }
      image.setMask(mask);
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
      this.regionMaskShapes.forEach((shape) => shape.destroy());
    });
    this.renderScene();
  }

  update(): void {
    const input = readFrameInput(this.inputContext);
    this.state = stepGame(this.state, input);
    this.renderScene();
  }

  private getViewportMetrics(): ViewportMetrics {
    const width = this.scale.width;
    const height = this.scale.height;

    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error(`Invalid Rolnik viewport ${width}x${height}.`);
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
    const barWidth = viewport.width;
    const barHeight = Math.max(96, Math.min(136, viewport.height * 0.15));
    const playerRegions = createPlayerRegions(this.state.players.length, viewport);
    const innerBarWidth = Math.max(240, barWidth - 24);
    const innerBarHeight = Math.max(28, Math.min(42, barHeight * 0.34));
    const medallionDiameter = Math.max(120, Math.min(176, viewport.height * 0.24));
    const textGap = medallionDiameter / 2 + 42;
    const currentWeather = currentWeatherVisual(this.state);
    const palette = BACKDROP_PALETTES[this.state.season];
    const houseTexture = this.textures.get(HOUSE_TEXTURE_KEY).getSourceImage() as {
      width: number;
      height: number;
    };
    const sceneScaleBase = this.state.players.length <= 2 ? 1 : 0.5;

    this.graphics.clear();

    playerRegions.forEach((region, index) => {
      const maskShape = this.regionMaskShapes[index];
      if (maskShape === undefined) {
        throw new Error(`Missing Rolnik mask shape for player ${index}.`);
      }

      maskShape.clear();
      maskShape.fillStyle(0xffffff, 1);
      maskShape.fillRect(region.x, region.y, region.width, region.height);

      const skyHeight = Math.round(region.height * 0.7);
      const horizonY = region.y + skyHeight;
      const upperSkyHeight = Math.round(skyHeight * 0.45);
      this.graphics.fillGradientStyle(
        Phaser.Display.Color.HexStringToColor(palette.skyTop).color,
        Phaser.Display.Color.HexStringToColor(palette.skyTop).color,
        Phaser.Display.Color.HexStringToColor(palette.skyMid).color,
        Phaser.Display.Color.HexStringToColor(palette.skyMid).color,
        1,
        1,
        1,
        1
      );
      this.graphics.fillRect(region.x, region.y, region.width, upperSkyHeight);
      this.graphics.fillGradientStyle(
        Phaser.Display.Color.HexStringToColor(palette.skyMid).color,
        Phaser.Display.Color.HexStringToColor(palette.skyMid).color,
        Phaser.Display.Color.HexStringToColor(palette.skyLow).color,
        Phaser.Display.Color.HexStringToColor(palette.skyLow).color,
        1,
        1,
        1,
        1
      );
      this.graphics.fillRect(region.x, region.y + upperSkyHeight, region.width, skyHeight - upperSkyHeight);
      this.graphics.fillStyle(Phaser.Display.Color.HexStringToColor(palette.horizon).color, 1);
      this.graphics.fillRect(region.x, horizonY - 6, region.width, 6);
      this.graphics.fillGradientStyle(
        Phaser.Display.Color.HexStringToColor(palette.groundTop).color,
        Phaser.Display.Color.HexStringToColor(palette.groundTop).color,
        Phaser.Display.Color.HexStringToColor(palette.groundDark).color,
        Phaser.Display.Color.HexStringToColor(palette.groundDark).color,
        1,
        1,
        1,
        1
      );
      this.graphics.fillRect(region.x, horizonY, region.width, region.height - skyHeight);
    });

    this.playerUi.forEach((ui, index) => {
      const region = playerRegions[index];
      const player = this.state.players[index];
      if (region === undefined || player === undefined) {
        throw new Error(`Missing Rolnik UI region or player for index ${index}.`);
      }

      const profile = getStartingProfileDefinition(player.startingProfileId);
      const menuSide = menuSideForPlayer(index, this.state.players.length, region, viewport);
      const layout = computePlayerLayout(
        region,
        viewport.centerY - barHeight / 2,
        viewport.centerY + barHeight / 2,
        menuSide
      );
      const iconWidth = clamp(Math.round(layout.iconRowRect.width * 0.27), 84, 104);
      const iconHeight = clamp(Math.round(layout.iconRowRect.height * 0.72), 82, 96);
      const iconGap = clamp(Math.round(layout.iconRowRect.width * 0.035), 8, 12);
      const iconRowWidth = iconWidth * 3 + iconGap * 2;
      const iconStartX = layout.iconRowRect.x + Math.max(0, (layout.iconRowRect.width - iconRowWidth) / 2);
      const iconTopY = layout.iconRowRect.y + 8;
      const iconCenterY = iconTopY + iconHeight / 2;
      const selectedMenuLabelY = layout.iconRowRect.y + layout.iconRowRect.height - 12;
      const submenuWidth = layout.submenuRect.width - 20;
      const submenuStartY = layout.submenuRect.y + 18;
      const submenuX = menuSide === 'left' ? layout.submenuRect.x + submenuWidth : layout.submenuRect.x + 10;
      const submenuOriginX = menuSide === 'left' ? 1 : 0;
      const submenuAlign = menuSide === 'left' ? 'right' : 'left';
      const activePlayer = index === this.state.activePlayerIndex;
      const activeMenuSection = player.activeMenuSection;
      const activeSubmenuIndex = player.activeSubmenuIndex;
      const submenuLabels =
        player.detailMode === 'menu'
          ? activeMenuSection === 'crops'
            ? player.farm.fields.map((_, fieldIndex) => `POLE ${fieldIndex + 1}`)
            : SUBMENU_LABELS[activeMenuSection]
          : player.detailMode === 'fields'
            ? (() => {
                const selectedField = player.farm.fields[player.detailIndex];
                if (selectedField === undefined) {
                  throw new Error(`Missing field ${player.detailIndex} for ${player.label}.`);
                }

                return selectedField.mode === 'meadow'
                  ? ['ZMIEN TRYB']
                  : ['UPRAWIAJ'];
              })()
            : player.detailMode === 'animals'
              ? ANIMAL_ORDER.map((animalType) => ANIMAL_LABELS[animalType]).concat('WYJSCIE')
              : player.farm.buildings
                  .map((building) => BUILDING_LABELS[building.id])
                  .concat('WYJSCIE');
      const selectedSubmenuIndex = player.detailMode === 'menu' ? activeSubmenuIndex : player.detailMenuIndex;
      const infoWidth = layout.statsRect.width - 4;
      const detailBoxX = layout.detailRect.x;
      const detailBoxY = layout.detailRect.y;
      const detailBoxWidth = layout.detailRect.width;
      const detailBoxHeight = layout.detailRect.height;
      const infoText =
        `cash ${player.farm.cash}   grain ${player.farm.goods.grain}   potatoes ${player.farm.goods.potatoes}   roots ${player.farm.goods.roots}   hay ${player.farm.goods.hay}\n` +
        `cow ${player.farm.animals.cow.count}   pig ${player.farm.animals.pig.count}   chicken ${player.farm.animals.chicken.count}   wood ${player.farm.goods.wood}   stone ${player.farm.goods.stone}`;
      const animalBuildings = player.farm.buildings
        .filter((building) => ['cow-barn', 'pig-pen', 'coop', 'feed-mill', 'cheese-dairy', 'sausage-house'].includes(building.id))
        .map((building) => `${BUILDING_LABELS[building.id]} L${building.level}`)
        .join(', ');
      const allBuildings = player.farm.buildings
        .map((building) => `${BUILDING_LABELS[building.id]} L${building.level}`)
        .join(', ');
      let detailTitle = '';
      let detailBody = '';

      if (player.detailMode === 'fields') {
        const field = player.farm.fields[player.detailIndex];
        if (field === undefined) {
          throw new Error(`Missing field ${player.detailIndex} for ${player.label}.`);
        }

        const rotationSlots = fieldRotationSlots(field);
        detailTitle = `Pole ${player.detailIndex + 1} | ${fieldModeLabel(field.mode)}`;
        detailBody = field.mode === 'meadow'
          ? `gleba ${field.soilClass}   teren ${field.terrainBonus}\n` +
            `laka / tryb ${meadowUsageLabel(field.meadowUsage)}\n` +
            `opcje:\n- ZMIEN TRYB\n- ustaw ${field.meadowUsage === 'hay' ? 'pastwisko' : 'siano'}`
          : `gleba ${field.soilClass}   teren ${field.terrainBonus}\n` +
            `opcje:\n- ZASIEJ\nrotacja:\n1. ${rotationSlots[0]}\n2. ${rotationSlots[1]}\n3. ${rotationSlots[2]}`;
      } else if (player.detailMode === 'animals') {
        const animalType = ANIMAL_ORDER[player.detailIndex];
        if (animalType === undefined) {
          throw new Error(`Missing animal detail index ${player.detailIndex} for ${player.label}.`);
        }

        const animal = player.farm.animals[animalType];
        detailTitle = `${ANIMAL_LABELS[animalType]} | Stado`;
        detailBody =
          `sztuk ${animal.count}   jakosc ${animal.quality}\n` +
          `waga ${animal.totalLiveWeightKg} kg\n` +
          `opcje:\n- PRZEGLAD STADA\n- PASZA\n- SPRZEDAZ LATEM`;
      } else if (player.detailMode === 'buildings') {
        const building = player.farm.buildings[player.detailIndex];
        if (building === undefined) {
          throw new Error(`Missing building ${player.detailIndex} for ${player.label}.`);
        }

        detailTitle = `${BUILDING_LABELS[building.id]} | Budynek`;
        detailBody =
          `poziom ${building.level}   sloty ${building.level}\n` +
          `specjalizacja ${building.specialization ? 'tak' : 'nie'}\n` +
          `opcje:\n- PRZEGLAD\n- ULEPSZ`;
      } else if (activeMenuSection === 'crops') {
        const previewField = player.farm.fields[player.activeSubmenuIndex];
        if (previewField === undefined) {
          detailTitle = 'Uprawy';
          detailBody =
            `pola ${player.farm.fields.length}\n` +
            `wybierz pole z listy po lewej stronie.`;
        } else {
          const rotationSlots = fieldRotationSlots(previewField);
          detailTitle = `Pole ${player.activeSubmenuIndex + 1} | ${fieldModeLabel(previewField.mode)}`;
          detailBody = previewField.mode === 'meadow'
            ? `gleba ${previewField.soilClass}   teren ${previewField.terrainBonus}\n` +
              `laka / tryb ${meadowUsageLabel(previewField.meadowUsage)}\n` +
              `po wejsciu: ZMIEN TRYB`
            : `gleba ${previewField.soilClass}   teren ${previewField.terrainBonus}\n` +
              `rotacja:\n1. ${rotationSlots[0]}\n2. ${rotationSlots[1]}\n3. ${rotationSlots[2]}\n` +
              `po wejsciu: UPRAWIAJ`;
        }
      } else if (activeMenuSection === 'animals') {
        detailTitle = 'Zwierzeta';
        detailBody =
          `stado: cow ${player.farm.animals.cow.count}, pig ${player.farm.animals.pig.count}, chicken ${player.farm.animals.chicken.count}\n` +
          `jakosc: ${player.farm.animals.cow.quality} / ${player.farm.animals.pig.quality} / ${player.farm.animals.chicken.quality}\n` +
          `budynki ${animalBuildings.length > 0 ? animalBuildings : 'brak'}`;
      } else {
        detailTitle = 'Dom';
        detailBody =
          `budynki ${player.farm.buildings.length}   gotowka ${player.farm.cash}\n` +
          `${allBuildings}\n` +
          `wybierz BUDYNKI aby wejsc w szczegoly`;
      }

      if (
        player.detailMode !== 'menu' &&
        player.detailMode !== 'fields' &&
        selectedSubmenuIndex === submenuLabels.length - 1
      ) {
        detailTitle = 'Wyjscie';
        detailBody = 'Zamknij ten widok i wroc do glownego panelu sekcji.';
      }

      ui.label.setPosition(layout.headerRect.x, layout.headerRect.y);
      ui.label.setText(`${player.label}  |  ${profile.label}`);

      ui.summary.setPosition(layout.statsRect.x + 2, layout.statsRect.y + 4);
      ui.summary.setWordWrapWidth(infoWidth);
      ui.summary.setText(infoText);

      this.graphics.fillStyle(activePlayer ? 0x3f281d : 0x2c1d17, 0.88);
      this.graphics.fillRoundedRect(layout.panelRect.x, layout.panelRect.y, layout.panelRect.width, layout.panelRect.height, 16);
      this.graphics.lineStyle(3, activePlayer ? 0xc69f61 : 0x7f5c42, 1);
      this.graphics.strokeRoundedRect(layout.panelRect.x, layout.panelRect.y, layout.panelRect.width, layout.panelRect.height, 16);

      this.graphics.fillStyle(0x4d3529, 0.7);
      this.graphics.fillRoundedRect(layout.statsRect.x, layout.statsRect.y, layout.statsRect.width, layout.statsRect.height, 12);
      this.graphics.lineStyle(2, 0x7f5c42, 1);
      this.graphics.strokeRoundedRect(layout.statsRect.x, layout.statsRect.y, layout.statsRect.width, layout.statsRect.height, 12);
      this.graphics.fillStyle(0x35251c, 0.82);
      this.graphics.fillRoundedRect(detailBoxX, detailBoxY, detailBoxWidth, detailBoxHeight, 14);
      this.graphics.lineStyle(2, 0x7f5c42, 1);
      this.graphics.strokeRoundedRect(detailBoxX, detailBoxY, detailBoxWidth, detailBoxHeight, 14);

      MENU_SECTION_ORDER.forEach((sectionId, menuIndex) => {
        const buttonX = iconStartX + menuIndex * (iconWidth + iconGap);
        const activeSection = activeMenuSection === sectionId;
        const fillColor = activeSection ? 0xe5c07b : activePlayer ? 0xa87853 : 0x644435;
        const borderColor = activeSection ? 0xffefc0 : activePlayer ? 0xc69f61 : 0x8f6448;

        this.graphics.fillStyle(fillColor, 1);
        this.graphics.fillRoundedRect(buttonX, iconTopY, iconWidth, iconHeight, 16);
        this.graphics.lineStyle(3, borderColor, 1);
        this.graphics.strokeRoundedRect(buttonX, iconTopY, iconWidth, iconHeight, 16);

        const menuIcon = ui.menuIcons[menuIndex];
        if (menuIcon === undefined) {
          throw new Error(`Missing Rolnik menu icon ${menuIndex} for player ${index}.`);
        }

        const iconInset = activeSection ? 8 : 10;
        const iconTargetWidth = iconWidth - iconInset * 2;
        const iconTargetHeight = iconHeight - iconInset * 2;
        const source = menuIcon.texture.getSourceImage() as { width: number; height: number };
        const iconScale = Math.min(iconTargetWidth / source.width, iconTargetHeight / source.height);

        menuIcon
          .setTexture(MENU_ICON_TEXTURE_KEYS[sectionId])
          .setPosition(buttonX + iconWidth / 2, iconCenterY)
          .setDisplaySize(Math.round(source.width * iconScale), Math.round(source.height * iconScale))
          .clearTint()
          .setAlpha(activeSection ? 1 : 0.92);
      });

      ui.selectedMenuLabel
        .setPosition(layout.iconRowRect.x + layout.iconRowRect.width / 2, selectedMenuLabelY)
        .setColor(activePlayer ? '#fff0c9' : '#d8c29b')
        .setText(MENU_LABELS[activeMenuSection]);

      ui.submenuTexts.forEach((submenuText) => submenuText.setText(''));

      const availableSubmenuHeight = layout.submenuRect.height - 24;
      const submenuGap = clamp(Math.round(availableSubmenuHeight * 0.035), 6, 12);
      const submenuItemHeight = clamp(
        Math.floor(
          (availableSubmenuHeight - submenuGap * Math.max(0, VISIBLE_SUBMENU_ITEMS - 1)) /
            VISIBLE_SUBMENU_ITEMS
        ),
        24,
        34
      );
      const submenuFontSize = clamp(Math.round(submenuItemHeight * 0.52), 13, 15);
      const visibleItemCount = Math.min(VISIBLE_SUBMENU_ITEMS, submenuLabels.length);
      const maxWindowStart = Math.max(0, submenuLabels.length - visibleItemCount);
      const desiredWindowStart = selectedSubmenuIndex - Math.floor(visibleItemCount / 2);
      const windowStart = clamp(desiredWindowStart, 0, maxWindowStart);
      const visibleLabels = submenuLabels.slice(windowStart, windowStart + visibleItemCount);

      visibleLabels.forEach((submenuLabel, visibleIndex) => {
        const submenuText = ui.submenuTexts[visibleIndex];
        if (submenuText === undefined) {
          throw new Error(`Missing Rolnik submenu text ${visibleIndex} for player ${index}.`);
        }

        const submenuIndex = windowStart + visibleIndex;
        const selected = activePlayer && selectedSubmenuIndex === submenuIndex;
        const itemY = submenuStartY + visibleIndex * (submenuItemHeight + submenuGap);
        const boxX = layout.submenuRect.x + 10;

        this.graphics.fillStyle(selected ? 0xe5c07b : 0x4d3529, selected ? 0.98 : 0.9);
        this.graphics.fillRoundedRect(boxX, itemY - submenuItemHeight / 2, submenuWidth, submenuItemHeight, 10);
        this.graphics.lineStyle(2, selected ? 0xffefc0 : 0x7f5c42, 1);
        this.graphics.strokeRoundedRect(boxX, itemY - submenuItemHeight / 2, submenuWidth, submenuItemHeight, 10);

        submenuText
          .setPosition(submenuX, itemY)
          .setFontSize(submenuFontSize)
          .setOrigin(submenuOriginX, 0.5)
          .setAlign(submenuAlign)
          .setColor(selected ? '#2a1a12' : activePlayer ? '#fff0c9' : '#c8b08f')
          .setText(submenuLabel);
      });

      if (windowStart > 0) {
        this.graphics.fillStyle(0xe6cd9c, 0.8);
        this.graphics.fillTriangle(
          layout.submenuRect.x + layout.submenuRect.width / 2 - 6,
          layout.submenuRect.y + 4,
          layout.submenuRect.x + layout.submenuRect.width / 2 + 6,
          layout.submenuRect.y + 4,
          layout.submenuRect.x + layout.submenuRect.width / 2,
          layout.submenuRect.y + 12
        );
      }

      if (windowStart + visibleItemCount < submenuLabels.length) {
        this.graphics.fillStyle(0xe6cd9c, 0.8);
        this.graphics.fillTriangle(
          layout.submenuRect.x + layout.submenuRect.width / 2 - 6,
          layout.submenuRect.y + layout.submenuRect.height - 4,
          layout.submenuRect.x + layout.submenuRect.width / 2 + 6,
          layout.submenuRect.y + layout.submenuRect.height - 4,
          layout.submenuRect.x + layout.submenuRect.width / 2,
          layout.submenuRect.y + layout.submenuRect.height - 12
        );
      }

      ui.detailTitle.setPosition(detailBoxX + 12, detailBoxY + 10);
      ui.detailTitle.setText(detailTitle);
      ui.detailBody.setPosition(detailBoxX + 12, detailBoxY + 38);
      ui.detailBody.setWordWrapWidth(detailBoxWidth - 24);
      ui.detailBody.setText(detailBody);
      ui.detailHint.setPosition(detailBoxX + 12, detailBoxY + detailBoxHeight - 10);
      ui.detailHint.setText(detailHintText(player.detailMode, activeMenuSection, selectedSubmenuIndex));
    });

    this.graphics.fillStyle(0x241812, 1);
    this.graphics.fillRoundedRect(
      0,
      viewport.centerY - barHeight / 2,
      barWidth,
      barHeight,
      28
    );
    this.graphics.lineStyle(4, 0xc69f61, 1);
    this.graphics.strokeRoundedRect(
      0,
      viewport.centerY - barHeight / 2,
      barWidth,
      barHeight,
      28
    );

    this.graphics.fillStyle(0x6d4c31, 0.28);
    this.graphics.fillRoundedRect(
      viewport.centerX - innerBarWidth / 2,
      viewport.centerY - innerBarHeight / 2,
      innerBarWidth,
      innerBarHeight,
      16
    );

    this.houseImages.forEach((houseImage, index) => {
      const region = playerRegions[index];
      if (region === undefined) {
        throw new Error(`Missing Rolnik player region for house ${index}.`);
      }

      const contentBottom =
        region.centerY < viewport.centerY
          ? viewport.centerY - barHeight / 2 - 10
          : region.y + region.height - 18;
      const houseScale = sceneScaleBase * 0.22;
      const houseWidth = houseTexture.width * houseScale;
      const houseHeight = houseTexture.height * houseScale;
      const houseX = region.x + region.width * region.houseAnchorX;
      const houseY = contentBottom;

      houseImage
        .setPosition(houseX, houseY)
        .setDisplaySize(houseWidth, houseHeight);
    });

    this.graphics.fillStyle(0x1b1310, 1);
    this.graphics.fillCircle(viewport.centerX, viewport.centerY, medallionDiameter / 2 + 10);
    this.graphics.lineStyle(5, 0xc69f61, 1);
    this.graphics.strokeCircle(viewport.centerX, viewport.centerY, medallionDiameter / 2 + 10);
    this.graphics.lineStyle(2, 0x8a6a46, 0.7);
    this.graphics.strokeCircle(viewport.centerX, viewport.centerY, medallionDiameter / 2 - 2);

    this.graphics.lineStyle(2, 0x8a6a46, 0.7);
    this.graphics.beginPath();
    this.graphics.moveTo(viewport.centerX - innerBarWidth / 2 + 18, viewport.centerY);
    this.graphics.lineTo(viewport.centerX - medallionDiameter / 2 - 12, viewport.centerY);
    this.graphics.moveTo(viewport.centerX + medallionDiameter / 2 + 12, viewport.centerY);
    this.graphics.lineTo(viewport.centerX + innerBarWidth / 2 - 18, viewport.centerY);
    this.graphics.strokePath();

    this.weatherImage
      .setTexture(WEATHER_TEXTURE_KEYS[currentWeather])
      .setPosition(viewport.centerX, viewport.centerY)
      .setDisplaySize(medallionDiameter, medallionDiameter);

    this.worldBarText.setPosition(viewport.centerX - textGap, viewport.centerY);
    this.worldBarText.setText(`YEAR ${this.state.year}  |  ${this.state.season.toUpperCase()}`);
    this.worldBarDetailText.setPosition(viewport.centerX + textGap, viewport.centerY);
    this.worldBarDetailText.setText(`${this.state.players.length}P  |  P${this.state.activePlayerIndex + 1}`);
  }
}
