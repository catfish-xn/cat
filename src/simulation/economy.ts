import { readAugmentIncome } from './augment-income';
import type { OwnedAugment } from './strategy-types';
import { ECONOMY_RULES, MATCH_RULES, STAGE_PLAYER_DAMAGE, selectPlayerBaseDamage } from './match-rules';
import { grantXp } from './progression';

export interface EconomyStreak { readonly kind: 'win' | 'loss' | null; readonly count: number }
export interface RoundEconomyInput {
  readonly augments?: readonly OwnedAugment[];
  readonly stage: number;
  readonly roundId?: string;
  readonly roundKind: 'pvp' | 'pve' | 'supply';
  readonly result: 'playerWin' | 'enemyWin' | 'draw' | null;
  readonly gold: number;
  readonly streak: EconomyStreak;
  readonly level: number;
  readonly xp: number;
  readonly hp: number;
  readonly enemySurvivors: number;
}
export interface IncomeBreakdown { readonly base: number; readonly win: number; readonly interest: number; readonly streak: number }
export interface RoundEconomyPlan {
  readonly goldAfter: number;
  readonly hpAfter: number;
  readonly income: number;
  readonly incomeBreakdown: IncomeBreakdown;
  readonly interestBasis: number;
  readonly streakAfter: EconomyStreak;
  readonly baseDamage: number;
  readonly playerDamage: number;
  readonly hpLost: number;
  readonly progression: ReturnType<typeof grantXp>;
}

function nonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Invalid ${label}`);
}

/** PvP and PvE share streaks; a draw counts as a loss. Supply preserves but does not pay the streak. */
export function planCombatStreak(streak: EconomyStreak, result: RoundEconomyInput['result']): { streakAfter: EconomyStreak; streakGold: number } {
  if (result === null) return { streakAfter: { ...streak }, streakGold: 0 };
  const kind = result === 'playerWin' ? 'win' : 'loss';
  const streakAfter = { kind, count: streak.kind === kind ? streak.count + 1 : 1 } as const;
  nonnegativeInteger(streakAfter.count, 'streak count');
  let streakGold = 0;
  for (const threshold of ECONOMY_RULES.streakThresholds) if (streakAfter.count >= threshold.count) streakGold = threshold.gold;
  return { streakAfter, streakGold };
}

/** Pure calculation only. Match freezes this plan with its unique settlement receipt; base/interest/streak pay at next entry. */
export function planRoundEconomy(input: RoundEconomyInput): RoundEconomyPlan {
  const { stage, roundKind, result, gold, streak, level, xp, hp, enemySurvivors } = input;
  if (!Number.isInteger(stage) || STAGE_PLAYER_DAMAGE[stage] === undefined) throw new RangeError('Invalid stage');
  if (!['pvp', 'pve', 'supply'].includes(roundKind)) throw new RangeError('Invalid round kind');
  if (roundKind === 'supply' ? result !== null : !['playerWin', 'enemyWin', 'draw'].includes(result ?? '')) {
    throw new RangeError('Result does not match round kind');
  }
  nonnegativeInteger(gold, 'gold');
  nonnegativeInteger(hp, 'HP');
  nonnegativeInteger(enemySurvivors, 'enemy survivor count');
  nonnegativeInteger(streak.count, 'streak count');
  if (!['win', 'loss', null].includes(streak.kind) || (streak.kind === null) !== (streak.count === 0)) {
    throw new RangeError('Invalid streak');
  }
  if (hp > MATCH_RULES.initialHp || (roundKind === 'supply' && enemySurvivors !== 0)) throw new RangeError('Invalid round resources');

  const isPvp = roundKind === 'pvp';
  const won = result === 'playerWin';
  const { streakAfter, streakGold } = planCombatStreak(streak, result);
  const win = isPvp && won ? ECONOMY_RULES.victoryGold : 0;
  const interestBasis = gold + win;
  nonnegativeInteger(interestBasis, 'interest basis');
  const interest = Math.min(readAugmentIncome(input.augments).interestCap, Math.floor(interestBasis / ECONOMY_RULES.interestDivisor));
  const incomeBreakdown = { base: MATCH_RULES.roundIncome + readAugmentIncome(input.augments).roundGold, win, interest, streak: streakGold };
  const income = incomeBreakdown.base + win + interest + streakGold;
  const goldAfter = gold + income;
  nonnegativeInteger(goldAfter, 'settled gold');
  const baseDamage = selectPlayerBaseDamage(stage, roundKind, input.roundId);
  const playerDamage = roundKind === 'supply' || won ? 0 : baseDamage + (isPvp ? enemySurvivors : 0);
  nonnegativeInteger(playerDamage, 'player damage');
  const hpAfter = Math.max(0, hp - playerDamage);
  return { goldAfter, hpAfter, income, incomeBreakdown, interestBasis, streakAfter, baseDamage, playerDamage,
    hpLost: hp - hpAfter, progression: grantXp(level, xp, MATCH_RULES.roundXp) };
}

/** Read-only preparation selector; settlement may include victory gold in its sampling basis. */
export function getInterestGold(gold: number): number {
  nonnegativeInteger(gold, 'gold');
  return Math.min(ECONOMY_RULES.interestCap, Math.floor(gold / ECONOMY_RULES.interestDivisor));
}
