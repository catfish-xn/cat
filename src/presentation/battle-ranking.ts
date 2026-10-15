/**
 * G5 post-battle ranking: damage dealt, damage taken and healing per unit of one finished battle, and the same totals
 * added up over the match. The per-battle numbers are the rules' own `summarizeBattle` of the compact replay (contract
 * §14.2 "G5 战斗统计权威入口"): damage = HP damage + shield absorbed, healing done by the healer's shares of each heal,
 * healing received by the target. Nothing is tallied from events here; the match totals only add those rows up.
 * Display only: nothing here is a rule, nothing flows back.
 */
import { summarizeBattle } from '../simulation/combat-summary';
import type { CombatReplay, CombatViewUnit } from '../simulation/combat-replay-view';

export interface RankTotals {
  readonly damageDealt: number;
  readonly damageTaken: number;
  /** The shield part of `damageTaken`. */
  readonly shieldAbsorbed: number;
  /** Healing this unit gave (its shares of every heal), the 治疗 column. */
  readonly healingDone: number;
  /** Healing this unit got, shown on hover. */
  readonly healingReceived: number;
  readonly kills: number;
}
export interface BattleRankRow extends RankTotals {
  readonly unitId: string;
  readonly definitionId: string;
  readonly starLevel: number;
  readonly team: CombatViewUnit['team'];
  /** Alive on the battle's terminal view. */
  readonly alive: boolean;
}
export type BattleRankMetric = 'damageDealt' | 'damageTaken' | 'healingDone';
export interface BattleRanking {
  readonly combatId: string | null;
  readonly result: string | null;
  /** One row per unit of either side in the replay, in the replay's unit order. */
  readonly rows: readonly BattleRankRow[];
}
/** One unit kind of one side over the match: every battle's rows of that team, definition and star level added up. */
export interface MatchRankRow extends RankTotals {
  readonly key: string;
  readonly team: CombatViewUnit['team'];
  readonly definitionId: string;
  readonly starLevel: number;
  /** Battles it fought in. */
  readonly battles: number;
}

const rankings = new WeakMap<CombatReplay, BattleRanking>();
/** The rules' summary of one replay with its combat id and result; computed once per replay object. */
export function rankBattle(replay: CombatReplay): BattleRanking {
  let ranking = rankings.get(replay);
  if (!ranking) {
    ranking = { combatId: replay.terminal.combatId ?? null, result: replay.terminal.result ?? null, rows: summarizeBattle(replay) };
    rankings.set(replay, ranking);
  }
  return ranking;
}

export const matchRankKey = (row: Pick<BattleRankRow, 'team' | 'definitionId' | 'starLevel'>) => `${row.team}:${row.definitionId}:${row.starLevel}`;
/**
 * Totals over the match, one row per team + definition + star level, in first-seen order. Units sold or eliminated
 * later keep their rows: only past battles are read.
 */
export function accumulateRankings(battles: readonly BattleRanking[]): MatchRankRow[] {
  const rows = new Map<string, { -readonly [K in keyof MatchRankRow]: MatchRankRow[K] }>();
  for (const battle of battles) {
    const seen = new Set<string>();
    for (const row of battle.rows) {
      const key = matchRankKey(row);
      let total = rows.get(key);
      if (!total) { total = { key, team: row.team, definitionId: row.definitionId, starLevel: row.starLevel, battles: 0, damageDealt: 0, damageTaken: 0, shieldAbsorbed: 0, healingDone: 0, healingReceived: 0, kills: 0 }; rows.set(key, total); }
      if (!seen.has(key)) { seen.add(key); total.battles++; }
      total.damageDealt += row.damageDealt; total.damageTaken += row.damageTaken; total.shieldAbsorbed += row.shieldAbsorbed;
      total.healingDone += row.healingDone; total.healingReceived += row.healingReceived; total.kills += row.kills;
    }
  }
  return [...rows.values()];
}

/** Rows by one metric, highest first; ties keep the given order. */
export function sortRanking<T extends RankTotals>(rows: readonly T[], metric: BattleRankMetric): T[] {
  return rows.map((row, index) => ({ row, index })).sort((a, b) => b.row[metric] - a.row[metric] || a.index - b.index).map(entry => entry.row);
}

/** A battle of mine as the client keeps it: its replay and which battle id is which of my units (C15). */
export interface RankedBattleSource { readonly replay: CombatReplay; readonly unitIds: readonly { readonly combatId: string; readonly originalId: string }[] }
/** One unit's line on its hover card: its row in the given battle (null when it did not fight in it) and its kind's match total. */
export interface UnitBattleStats { readonly battle: BattleRankRow | null; readonly match: MatchRankRow | null }
const totalsMemo = new WeakMap<readonly RankedBattleSource[], Map<number, MatchRankRow[]>>();
/**
 * G5 hover card: the same numbers as the ranking panel for one shown unit, over the first `count` of `history` (all by
 * default; the client leaves out a battle still being played back). `battle` is that unit's row in the last of them
 * (found by its battle id, or by my original id through the replay's own `unitIds`); `match` is the total of its team +
 * definition + star over all of them, the panel's 本局累计 row.
 */
export function unitBattleStats(history: readonly RankedBattleSource[], unit: { readonly id: string; readonly definitionId: string; readonly starLevel: number; readonly team: CombatViewUnit['team'] },
  count = history.length): UnitBattleStats {
  if (count <= 0) return { battle: null, match: null };
  const last = history[count - 1]!;
  const combatId = last.unitIds.find(entry => entry.originalId === unit.id)?.combatId ?? unit.id;
  const battle = rankBattle(last.replay).rows.find(row => row.unitId === combatId) ?? null;
  let memo = totalsMemo.get(history);
  if (!memo) { memo = new Map(); totalsMemo.set(history, memo); }
  let totals = memo.get(count);
  if (!totals) { totals = accumulateRankings(history.slice(0, count).map(entry => rankBattle(entry.replay))); memo.set(count, totals); }
  return { battle, match: totals.find(row => row.key === matchRankKey(unit)) ?? null };
}
