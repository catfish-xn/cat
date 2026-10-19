import type { CombatUnit } from '../combat-types';
import type { VampRate } from '../m8/heal';
import { asSource } from '../m8/s13-definitions';
import { P4_SOURCE } from './source';
export function anomalyVamp(unit: CombatUnit): VampRate[] {
  const active = unit.anomalyState?.firstCastTick !== undefined;
  const source = active && unit.mechanics?.find(m => m.mechanic === 's13Anomaly'
    && m.source.definitionId === P4_SOURCE.CertainDeath.id)?.source;
  return source ? [{ source: asSource(source), bps: Math.round(P4_SOURCE.CertainDeath.values.BonusOmnivamp * 10000), allyBps: 0 }] : [];
}
