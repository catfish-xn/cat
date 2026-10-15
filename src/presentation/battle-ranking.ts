/**
 * G5 post-battle ranking: damage dealt, damage taken and healing per unit of one finished battle, tallied from
 * the compact replay's own §14.2 events (contract §14.2). Display only: nothing here is a rule, nothing flows back.
 *
 * - 伤害: `packetDamage.hpDamage` by `sourceId` (actual HP lost by the target, the same number the stats panel shows).
 * - 承伤: `packetDamage.hpDamage` by `targetId`; `shieldAbsorbed` keeps what shields took off the same packets apart.
 * - 治疗: `heal.actual` by `targetId`. The wire `heal` event carries no source (SR-G5-01), so healing is the healing
 *   a unit received, never credited to a healer by guess.
 */
import type { CombatReplay, CombatViewEvent, CombatViewUnit } from '../simulation/combat-replay-view';

export interface BattleRankRow {
  readonly unitId: string;
  readonly definitionId: string;
  readonly starLevel: number;
  readonly team: CombatViewUnit['team'];
  /** Alive on the battle's terminal view. */
  readonly alive: boolean;
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly shieldAbsorbed: number;
  readonly healingReceived: number;
}
export type BattleRankMetric = 'damageDealt' | 'damageTaken' | 'healingReceived';
export interface BattleRanking {
  readonly combatId: string | null;
  readonly result: string | null;
  /** One row per unit of either side in the replay, in the replay's unit order. */
  readonly rows: readonly BattleRankRow[];
}

/** Every event of the replay once, in tick order. */
export function replayEvents(replay: CombatReplay): CombatViewEvent[] { return replay.ticks.flatMap(frame => frame.events); }

export function rankBattle(replay: CombatReplay): BattleRanking {
  const totals = new Map(replay.initial.units.map(unit => [unit.id, { damageDealt: 0, damageTaken: 0, shieldAbsorbed: 0, healingReceived: 0 }]));
  for (const event of replayEvents(replay)) {
    if (event.type === 'packetDamage') {
      const source = totals.get(event.sourceId), target = totals.get(event.targetId);
      if (source) source.damageDealt += event.hpDamage;
      if (target) { target.damageTaken += event.hpDamage; target.shieldAbsorbed += event.absorbed; }
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

/** Rows by one metric, highest first; ties keep the replay's unit order. */
export function sortRanking(rows: readonly BattleRankRow[], metric: BattleRankMetric): BattleRankRow[] {
  return rows.map((row, index) => ({ row, index })).sort((a, b) => b.row[metric] - a.row[metric] || a.index - b.index).map(entry => entry.row);
}
