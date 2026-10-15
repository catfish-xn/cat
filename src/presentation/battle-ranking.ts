/**
 * G5 post-battle ranking: damage dealt, damage taken and healing per unit of one finished battle, tallied from
 * the compact replay's own §14.2 events (contract §14.2), and the same totals added up over the match.
 * Display only: nothing here is a rule, nothing flows back.
 *
 * - 伤害: `packetDamage.hpDamage + absorbed` by `sourceId` — damage that hit a shield counts, as in TFT's damage chart.
 * - 承伤: the same sum by `targetId`; `shieldAbsorbed` keeps the shield part of it apart for display.
 * - 治疗: `heal.actual` by `targetId`. The wire `heal` event carries no source (SR-G5-01), so healing is the healing
 *   a unit received, never credited to a healer by guess.
 */
import type { CombatReplay, CombatViewEvent, CombatViewUnit } from '../simulation/combat-replay-view';

export interface RankTotals {
  readonly damageDealt: number;
  readonly damageTaken: number;
  /** The shield part of `damageTaken`. */
  readonly shieldAbsorbed: number;
  readonly healingReceived: number;
}
export interface BattleRankRow extends RankTotals {
  readonly unitId: string;
  readonly definitionId: string;
  readonly starLevel: number;
  readonly team: CombatViewUnit['team'];
  /** Alive on the battle's terminal view. */
  readonly alive: boolean;
}
export type BattleRankMetric = 'damageDealt' | 'damageTaken' | 'healingReceived';
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

/** Every event of the replay once, in tick order. */
export function replayEvents(replay: CombatReplay): CombatViewEvent[] { return replay.ticks.flatMap(frame => frame.events); }

export function rankBattle(replay: CombatReplay): BattleRanking {
  const totals = new Map(replay.initial.units.map(unit => [unit.id, { damageDealt: 0, damageTaken: 0, shieldAbsorbed: 0, healingReceived: 0 }]));
  for (const event of replayEvents(replay)) {
    if (event.type === 'packetDamage') {
      const source = totals.get(event.sourceId), target = totals.get(event.targetId), dealt = event.hpDamage + event.absorbed;
      if (source) source.damageDealt += dealt;
      if (target) { target.damageTaken += dealt; target.shieldAbsorbed += event.absorbed; }
    } else if (event.type === 'heal') {
      const target = totals.get(event.targetId);
      if (target) target.healingReceived += event.actual;
    }
  }
  const terminal = new Map(replay.terminal.units.map(unit => [unit.id, unit]));
  return {
    combatId: replay.terminal.combatId ?? null, result: replay.terminal.result ?? null,
    rows: replay.initial.units.map(unit => ({ unitId: unit.id, definitionId: unit.definitionId, starLevel: unit.starLevel, team: unit.team,
      alive: terminal.get(unit.id)?.alive ?? unit.alive, ...totals.get(unit.id)! })),
  };
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
      if (!total) { total = { key, team: row.team, definitionId: row.definitionId, starLevel: row.starLevel, battles: 0, damageDealt: 0, damageTaken: 0, shieldAbsorbed: 0, healingReceived: 0 }; rows.set(key, total); }
      if (!seen.has(key)) { seen.add(key); total.battles++; }
      total.damageDealt += row.damageDealt; total.damageTaken += row.damageTaken;
      total.shieldAbsorbed += row.shieldAbsorbed; total.healingReceived += row.healingReceived;
    }
  }
  return [...rows.values()];
}

/** Rows by one metric, highest first; ties keep the given order. */
export function sortRanking<T extends RankTotals>(rows: readonly T[], metric: BattleRankMetric): T[] {
  return rows.map((row, index) => ({ row, index })).sort((a, b) => b.row[metric] - a.row[metric] || a.index - b.index).map(entry => entry.row);
}
