import { planRoundEconomy, type EconomyStreak, type RoundEconomyInput, type RoundEconomyPlan } from './economy';
import { MATCH_RULES, OPENING_ECONOMY_RULES } from './match-rules';
import { grantXp } from './progression';
import { getCatalogRoundById } from './round-selectors';

export { OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from './match-rules';

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
  const parameters = OPENING_ECONOMY_RULES.rounds[round.roundId as keyof typeof OPENING_ECONOMY_RULES.rounds];
  if (!parameters) throw new RangeError('Missing opening economy parameters');
  const {baseGold:base,naturalXp} = parameters;
  const goldAfter = input.gold + base;
  if (!Number.isSafeInteger(goldAfter)) throw new RangeError('Invalid settled opening gold');
  return {
    kind:'opening', roundId:round.roundId, income:base,
    incomeBreakdown:{base,win:OPENING_ECONOMY_RULES.victoryGold,interest:OPENING_ECONOMY_RULES.interest,streak:OPENING_ECONOMY_RULES.streakGold}, goldAfter, naturalXp,
    playerDamage:input.result === 'playerWin' ? 0 : OPENING_ECONOMY_RULES.pveFailureDamage,
    streakAfter:{...input.streak}, progression:grantXp(input.level,input.xp,naturalXp),
  };
}

/** The shared settlement/restore boundary uses catalog identity, never an ordinal formula. */
export function planCatalogRoundEconomy(input: Omit<RoundEconomyInput, 'stage' | 'roundKind'> & {readonly roundId:string}): RoundEconomyPlan {
  const round = getCatalogRoundById(input.roundId);
  const opening = planOpeningEconomy(input);
  if (opening.kind === 'existing-rules') return planRoundEconomy({...input,stage:round.stage,roundKind:round.kind});
  if (!Number.isSafeInteger(input.hp) || input.hp < 0 || input.hp > MATCH_RULES.initialHp
    || !Number.isSafeInteger(input.enemySurvivors) || input.enemySurvivors < 0) throw new RangeError('Invalid opening resources');
  const hpAfter = Math.max(0,input.hp-opening.playerDamage);
  return {goldAfter:opening.goldAfter,hpAfter,income:opening.income,incomeBreakdown:opening.incomeBreakdown,
    interestBasis:input.gold,streakAfter:opening.streakAfter,baseDamage:OPENING_ECONOMY_RULES.pveFailureDamage,
    playerDamage:opening.playerDamage,hpLost:input.hp-hpAfter,progression:opening.progression};
}
