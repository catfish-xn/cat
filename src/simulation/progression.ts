import { MATCH_RULES, SHOP_ODDS, XP_TO_NEXT_LEVEL } from './match-rules';
import type { ProgressionResult } from './match-types';

function validateLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > MATCH_RULES.maxLevel) throw new RangeError(`Invalid player level: ${level}`);
}

export function getXpToNextLevel(level: number): number | null {
  validateLevel(level);
  return level === MATCH_RULES.maxLevel ? null : XP_TO_NEXT_LEVEL[level];
}

export function getShopOdds(level: number): readonly [number, number, number, number, number] {
  validateLevel(level);
  return SHOP_ODDS[level];
}

export function grantXp(level: number, xp: number, amount: number): ProgressionResult {
  const threshold = getXpToNextLevel(level);
  if (!Number.isSafeInteger(xp) || xp < 0 || (threshold === null ? xp !== 0 : xp >= threshold)
    || !Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(xp + amount)) {
    throw new RangeError('Experience must be a normalized nonnegative integer');
  }
  const initialLevel = level;
  let remaining = amount;
  while (level < MATCH_RULES.maxLevel) {
    const required = XP_TO_NEXT_LEVEL[level] - xp;
    if (remaining < required) { xp += remaining; remaining = 0; break; }
    remaining -= required;
    level++;
    xp = 0;
  }
  return { level, xp, xpRequested: amount, xpApplied: amount - remaining, levelsGained: level - initialLevel };
}
