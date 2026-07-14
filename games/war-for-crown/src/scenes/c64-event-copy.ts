import type { C64RandomEventId } from '../game/c64-events';
import type { ProvinceId } from '../game/types';

export type EventCopyLanguage = 'pl' | 'en';

interface C64EventCopyInput {
  readonly eventId: C64RandomEventId;
  readonly amount: number;
  readonly provinceId: ProvinceId | null;
  readonly provinceLabel: string | null;
}

function place(input: C64EventCopyInput, language: EventCopyLanguage): string {
  if (input.provinceId === null) {
    return '';
  }
  if (input.provinceLabel === null) {
    throw new Error(`Missing label for random-event province ${input.provinceId}.`);
  }
  return language === 'pl' ? ` w ${input.provinceLabel}` : ` in ${input.provinceLabel}`;
}

export function c64RandomEventCopy(input: C64EventCopyInput, language: EventCopyLanguage): string {
  const location = place(input, language);
  const amount = input.amount;
  const noEffect = language === 'pl' ? 'Zdarzenie nie przynioslo skutku.' : 'The event had no effect.';

  switch (input.eventId) {
    case 'za': return language === 'pl' ? `Naprawa rodzinnej twierdzy kosztuje ${amount} talarow.` : `Repairs to the home fortress cost ${amount} coins.`;
    case 'zb': return language === 'pl' ? `Dobra pogoda przynosi rolnikom ${amount} talarow.` : `Good weather earns the farmers ${amount} coins.`;
    case 'zc': return amount === 0 ? noEffect : language === 'pl' ? `Chlopi buduja nowa wies${location}.` : `The peasants build a new village${location}.`;
    case 'zd': return amount === 0 ? noEffect : language === 'pl' ? `Pozar lasu niszczy wies${location}.` : `A forest fire destroys a village${location}.`;
    case 'ze': return language === 'pl' ? `Odnajdujesz skarb: ${amount} talarow.` : `You find treasure worth ${amount} coins.`;
    case 'zf': return language === 'pl' ? `Zaraza zabija ${amount} zolnierzy${location}.` : `Plague kills ${amount} soldiers${location}.`;
    case 'zg': return language === 'pl' ? `${amount} niezadowolonych zolnierzy dezerteruje${location}.` : `${amount} dissatisfied soldiers desert${location}.`;
    case 'zh': return amount === 0 ? noEffect : language === 'pl' ? `${amount} chlopow dolacza do armii${location}.` : `${amount} peasants join the army${location}.`;
    case 'zi': return language === 'pl' ? `Wygrywasz ${amount} talarow na wyscigach konnych.` : `You win ${amount} coins at the horse races.`;
    case 'zk': return language === 'pl' ? `Smok pozera ${amount} zolnierzy${location}.` : `A dragon devours ${amount} soldiers${location}.`;
    case 'zm': return amount === 0 ? noEffect : language === 'pl' ? `${amount} dezerterow przeciwnika dolacza do ciebie${location}.` : `${amount} enemy deserters join you${location}.`;
    case 'zq': return language === 'pl' ? `Odnajdujesz zapasy krolewskich warte ${amount} talarow.` : `You find royalist supplies worth ${amount} coins.`;
    case 'zr': return language === 'pl' ? `Zlodzieje kradna z twierdzy ${amount} talarow.` : `Thieves steal ${amount} coins from the fortress.`;
    case 'zt': return amount === 0 ? noEffect : language === 'pl' ? `Odnajdujesz smoczy skarb: ${amount} talarow.` : `You find a dragon hoard worth ${amount} coins.`;
    case 'zu': return language === 'pl' ? `Wygrywasz ${amount} talarow w kosci.` : `You win ${amount} coins at dice.`;
    case 'zv': return amount === 0 ? noEffect : language === 'pl' ? `Schwytani bandyci oddaja ${amount} talarow.` : `Captured bandits yield ${amount} coins.`;
    case 'zw': return amount === 0 ? noEffect : language === 'pl' ? `Posag corki kosztuje ${amount} talarow.` : `Your daughter's dowry costs ${amount} coins.`;
    case 'zx': return amount === 0 ? noEffect : language === 'pl' ? `Malzenstwo syna przynosi ${amount} talarow posagu.` : `Your son's marriage brings a dowry of ${amount} coins.`;
    case 'zy': return amount === 0 ? noEffect : language === 'pl' ? `Pozar oslabia fortyfikacje${location}.` : `Fire weakens the fortifications${location}.`;
    case 'zj': case 'zl': case 'zn': case 'zo': case 'zp': case 'zs': case 'zz': return noEffect;
  }
}
