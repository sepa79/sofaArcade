export function c64CbaronL5C6E(turnNumber: number, provinceCount: number): number {
  if (!Number.isInteger(turnNumber) || turnNumber < 1) {
    throw new Error(`C64 cbaron turn number must be a positive integer, got ${turnNumber}.`);
  }
  if (!Number.isInteger(provinceCount) || provinceCount < 1) {
    throw new Error(`C64 cbaron province count must be a positive integer, got ${provinceCount}.`);
  }

  const year = Math.floor(turnNumber / 12) + 1;
  if (year >= 2) {
    return 1;
  }
  const month = turnNumber % 12;
  const earlyMoneyMonthLimit = Math.floor(provinceCount / 5) + 2;
  return earlyMoneyMonthLimit < month ? 1 : 0;
}
