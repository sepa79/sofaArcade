export interface CrestChoice {
  readonly shortLabel: string;
  readonly pl: string;
  readonly en: string;
}

export const PLAYER_COLOR_CHOICES: ReadonlyArray<number> = [
  0xd9534f,
  0x3f88c5,
  0xe0b341,
  0x58a55c,
  0xa66bd6,
  0xd7793f
];

export const PLAYER_CREST_CHOICES: ReadonlyArray<CrestChoice> = [
  { shortLabel: 'KRN', pl: 'Korona', en: 'Crown' },
  { shortLabel: 'WZA', pl: 'Wieza', en: 'Tower' },
  { shortLabel: 'MCZ', pl: 'Miecz', en: 'Sword' },
  { shortLabel: 'KSC', pl: 'Ksiezyc', en: 'Moon' }
];

export const C64_AI_NAME_CHOICES: ReadonlyArray<string> = [
  'Ortnid',
  'Siegeband',
  'Herbrand',
  'Oserich',
  'Wabtrud',
  'Liebgard',
  'Fenrir',
  'Renndavon',
  'Nixdrauf',
  'Harbart',
  'Walgund',
  'Hal9000',
  'Waghild',
  'Kunigunde',
  'Marpalei',
  'Agrippina'
];
