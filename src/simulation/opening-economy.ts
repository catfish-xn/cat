import { freezeContent } from './content/freeze';
import type { EconomyStreak } from './economy';
import { ECONOMY_RULES } from './match-rules';
import { grantXp } from './progression';
import { getCatalogRoundById } from './round-selectors';

/** OPENING §2: initialization data only; no Match creation or unit allocation. */
export const OPENING_INITIAL_STATE = freezeContent({
  gold:0, level:1, xp:0, hp:100,
  unit:{definitionId:'irelia',id:'unit-1',starLevel:1,cell:{col:1,row:4}}, nextUnitSeq:2,
} as const);

export interface OpeningEconomyInput {
  readonly roundId: string;
  readonly result: 'playerWin' | 'enemyWin' | 'draw' | null;
  readonly gold: number;
  readonly level: number;
  readonly xp: number;
  readonly streak: EconomyStreak;
}

export type OpeningEconomyPlan = {
  readonly kind: 'opening';
  readonly roundId: string;
  readonly income: number;
  readonly incomeBreakdown: { readonly base: number; readonly win: 0; readonly interest: 0; readonly streak: 0 };
  readonly goldAfter: number;
  readonly naturalXp: number;
  /** Requested HP deduction; the caller applies its existing HP clamp. */
  readonly playerDamage: number;
  readonly streakAfter: EconomyStreak;
  readonly progression: ReturnType<typeof grantXp>;
} | {
  readonly kind: 'existing-rules';
  readonly roundId: string;
};

/** Pure stage-1 planner. Match's receipt/commit transaction belongs to B6 phase 2.
 * Later rounds return a marker: use the existing economy rather than duplicating it here.
 */
export function planOpeningEconomy(input: OpeningEconomyInput): OpeningEconomyPlan {
  const round = getCatalogRoundById(input.roundId);
  if (round.kind === 'supply' ? input.result !== null : !['playerWin','enemyWin','draw'].includes(input.result ?? '')) {
    throw new RangeError('Result does not match catalog round kind');
  }
  if (round.stage >= 2) return {kind:'existing-rules',roundId:round.roundId};

  if (!Number.isSafeInteger(input.gold) || input.gold < 0) throw new RangeError('Invalid opening gold');
  const { kind, count } = input.streak;
  if (!Number.isSafeInteger(count) || count < 0 || !['win','loss',null].includes(kind)
    || (kind === null) !== (count === 0)) throw new RangeError('Invalid opening streak');

  // OPENING §3.1: approved 2/3/5G and 2/2/0XP, independent of combat outcome.
  const base = round.subround === 2 ? 2 : round.subround === 3 ? 3 : 5;
  const naturalXp = round.subround === 4 ? 0 : 2;
  const goldAfter = input.gold + base;
  if (!Number.isSafeInteger(goldAfter)) throw new RangeError('Invalid settled opening gold');
  return {
    kind:'opening', roundId:round.roundId, income:base,
    incomeBreakdown:{base,win:0,interest:0,streak:0}, goldAfter, naturalXp,
    playerDamage:input.result === 'playerWin' ? 0 : ECONOMY_RULES.pveFailureDamage,
    streakAfter:{...input.streak}, progression:grantXp(input.level,input.xp,naturalXp),
  };
}
