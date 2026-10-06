import { describe, expect, it } from 'vitest';
import { getShopOdds, getXpToNextLevel, grantXp } from '../src/simulation/progression';

const THRESHOLDS = [2, 2, 6, 10, 20, 36, 48, 76] as const;
const ODDS = [[100, 0, 0, 0, 0], [100, 0, 0, 0, 0], [75, 25, 0, 0, 0], [55, 30, 15, 0, 0],
  [45, 33, 20, 2, 0], [30, 40, 25, 5, 0], [19, 30, 40, 10, 1], [18, 25, 32, 22, 3], [15, 20, 25, 30, 10]];

describe('player experience and level queries', () => {
  it('freezes the nine-level M5 requirements and probability rows', () => {
    for (let level = 1; level <= 9; level++) {
      expect(getXpToNextLevel(level)).toBe(THRESHOLDS[level - 1] ?? null);
      expect(getShopOdds(level)).toEqual(ODDS[level - 1]);
      expect(getShopOdds(level).reduce((sum, chance) => sum + chance, 0)).toBe(100);
      expect(getShopOdds(level).every(chance => Number.isInteger(chance) && chance >= 0)).toBe(true);
    }
  });

  it.each(THRESHOLDS.map((threshold, index) => ({ level: index + 1, threshold })))(
    'handles below, exact, and above the level $level threshold', ({ level, threshold }) => {
      expect(grantXp(level, threshold - 1, 0)).toEqual({ level, xp: threshold - 1, xpRequested: 0, xpApplied: 0, levelsGained: 0 });
      expect(grantXp(level, threshold - 1, 1)).toEqual({ level: level + 1, xp: 0, xpRequested: 1, xpApplied: 1, levelsGained: 1 });
      expect(grantXp(level, threshold - 1, 2)).toEqual({ level: level + 1, xp: level === 8 ? 0 : 1,
        xpRequested: 2, xpApplied: level === 8 ? 1 : 2, levelsGained: 1 });
    },
  );

  it('carries overflow through multiple levels and accounts for only applied XP at the cap', () => {
    expect(grantXp(3, 4, 14)).toEqual({ level: 5, xp: 2, xpRequested: 14, xpApplied: 14, levelsGained: 2 });
    expect(grantXp(8, 75, 4)).toEqual({ level: 9, xp: 0, xpRequested: 4, xpApplied: 1, levelsGained: 1 });
    expect(grantXp(9, 0, 2)).toEqual({ level: 9, xp: 0, xpRequested: 2, xpApplied: 0, levelsGained: 0 });
    expect(grantXp(1, 0, 1000)).toEqual({ level: 9, xp: 0, xpRequested: 1000, xpApplied: 200, levelsGained: 8 });
  });

  it('gives the same progression for partitioned grants while preserving exact applied accounting', () => {
    let level = 3, xp = 0, xpApplied = 0;
    for (let i = 0; i < 60; i++) {
      const next = grantXp(level, xp, 4);
      level = next.level; xp = next.xp; xpApplied += next.xpApplied;
    }
    expect({ level, xp, xpApplied }).toEqual({ level: 9, xp: 0, xpApplied: 196 });
    expect(grantXp(3, 0, 240)).toMatchObject({ level, xp, xpApplied });
  });

  it.each([0, -1, 10, 3.5, NaN, Infinity])('rejects invalid player level %s', level => {
    expect(() => getXpToNextLevel(level)).toThrow(RangeError);
    expect(() => getShopOdds(level)).toThrow(RangeError);
    expect(() => grantXp(level, 0, 2)).toThrow(RangeError);
  });

  it.each([[3, -1, 4], [3, 6, 4], [3, 0.5, 4], [3, 0, -1], [3, 0, 0.5],
    [3, 0, NaN], [3, 0, Infinity], [9, 1, 4], [3, 1, Number.MAX_SAFE_INTEGER]])(
    'rejects non-normalized or invalid experience (%s, %s, %s)', (level, xp, amount) => {
      expect(() => grantXp(level, xp, amount)).toThrow(RangeError);
    },
  );
});
