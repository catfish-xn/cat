import type { CombatEvent } from '../simulation/combat-types';
import type { M8CombatEvent } from '../simulation/m8/contracts';
export interface UnitTotals {
  readonly unitId: string; readonly hpDamage: number; readonly physicalHpDamage: number;
  readonly magicHpDamage: number; readonly shieldAbsorbed: number;
  /** Present for frozen M8 outcome ledgers; legacy format1 rows retain their shape. */
  readonly trueHpDamage?: number;
  readonly effectiveHealing: number; readonly overhealing: number;
}
export interface BattleStats { readonly runId: string; readonly combatId: string; readonly nextEventSeq: number; readonly units: readonly UnitTotals[] }
export function emptyStats(runId: string, combatId: string): BattleStats { return { runId, combatId, nextEventSeq: 0, units: [] }; }
/** Each authoritative packet is counted once. Summary damage/shield creation are not inputs. */
export function appendStats(stats: BattleStats, events: readonly (CombatEvent | M8CombatEvent)[]): BattleStats {
  const rows = new Map(stats.units.map(unit => [unit.unitId, { ...unit }]));
  let nextEventSeq = stats.nextEventSeq;
  const row = (unitId: string) => {
    let value = rows.get(unitId);
    if (!value) { value = { unitId, hpDamage: 0, physicalHpDamage: 0, magicHpDamage: 0, shieldAbsorbed: 0, effectiveHealing: 0, overhealing: 0 }; rows.set(unitId, value); }
    return value;
  };
  for (const event of events) {
    if (event.combatId !== stats.combatId || event.eventSeq !== nextEventSeq) throw new Error('战斗统计事件不连续或属于另一场战斗');
    nextEventSeq++;
    if (event.type === 'packetDamage') {
      if ('outcome' in event) {
        const outcome = event.outcome, source = row(outcome.context.source.ownerId);
        source.hpDamage += outcome.hpDamage;
        if (outcome.context.damageType === 'physical') source.physicalHpDamage += outcome.hpDamage;
        else if (outcome.context.damageType === 'magic') source.magicHpDamage += outcome.hpDamage;
        else source.trueHpDamage = (source.trueHpDamage ?? 0) + outcome.hpDamage;
        row(outcome.context.targetId).shieldAbsorbed += outcome.absorbed;
        continue;
      }
      const source = row(event.source.ownerId); source.hpDamage += event.hpDamage;
      if (event.damageType === 'physical') source.physicalHpDamage += event.hpDamage; else source.magicHpDamage += event.hpDamage;
      row(event.unitId).shieldAbsorbed += event.absorbed;
    } else if (event.type === 'heal') {
      if ('outcome' in event) {
        for (const share of event.outcome.shares) {
          const source = row(share.source.ownerId); source.effectiveHealing += share.actual; source.overhealing += share.overheal;
        }
        continue;
      }
      const source = row(event.source.ownerId); source.effectiveHealing += event.actual; source.overhealing += event.overheal;
    }
  }
  return { ...stats, nextEventSeq, units: [...rows.values()].sort((a, b) => a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0) };
}
export function aggregateStats(runId: string, combatId: string, events: readonly (CombatEvent | M8CombatEvent)[]): BattleStats { return appendStats(emptyStats(runId, combatId), events); }
