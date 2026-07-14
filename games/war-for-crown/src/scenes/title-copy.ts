export type TitleLanguage = 'pl' | 'en';

const TITLES: ReadonlyArray<Readonly<Record<TitleLanguage, string>>> = [
  { pl: 'Baron', en: 'Baron' },
  { pl: 'Hrabia', en: 'Earl' },
  { pl: 'Ksiaze', en: 'Duke' },
  { pl: 'Kniaz', en: 'Prince' },
  { pl: 'Elektor', en: 'Elector' },
  { pl: 'Krol', en: 'King' }
];

export function titleForRank(rank: number, language: TitleLanguage): string {
  if (!Number.isInteger(rank) || rank < 0 || rank >= TITLES.length) {
    throw new Error(`C64 title rank must be 0..${TITLES.length - 1}, got ${rank}.`);
  }
  const title = TITLES[rank];
  if (title === undefined) {
    throw new Error(`Missing title for C64 rank ${rank}.`);
  }
  return title[language];
}
