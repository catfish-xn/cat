import { compareIds, type CombatUnit } from './combat-types';
import type { DamagePacket } from './ability-types';

export interface DamageTotals {
  readonly physicalAmount: number;
  readonly magicAmount: number;
  readonly amount: number;
}

/** Round each individual hit before aggregation; even very high resistance permits one damage. */
export function mitigateDamage(rawAmount: number, resistance: number): number {
  if (!Number.isSafeInteger(rawAmount) || rawAmount < 0 || !Number.isSafeInteger(resistance) || resistance < 0) {
    throw new RangeError('Damage and resistance must be nonnegative safe integers');
  }
  return rawAmount === 0 ? 0 : Math.max(1, Math.floor(rawAmount * 100 / (100 + resistance)));
}

/** The returned Map is tick-local; committed combat state contains only JSON data. */
export function aggregateDamagePackets(packets: readonly DamagePacket[], units: readonly CombatUnit[]): ReadonlyMap<string, DamageTotals> {
  const targets = new Map(units.map(unit => [unit.id, unit]));
  const totals = new Map<string, DamageTotals>();
  const sorted = [...packets].sort((a, b) =>
    compareIds({ id: a.targetId }, { id: b.targetId }) ||
    compareIds({ id: a.sourceId }, { id: b.sourceId }) || a.effectIndex - b.effectIndex);
  for (const packet of sorted) {
    const target = targets.get(packet.targetId);
    if (!target || !target.alive) throw new Error(`Invalid damage target: ${packet.targetId}`);
    const amount = mitigateDamage(packet.rawAmount, packet.damageType === 'physical' ? target.armor : target.magicResist);
    const previous = totals.get(target.id) ?? { physicalAmount: 0, magicAmount: 0, amount: 0 };
    totals.set(target.id, {
      physicalAmount: previous.physicalAmount + (packet.damageType === 'physical' ? amount : 0),
      magicAmount: previous.magicAmount + (packet.damageType === 'magic' ? amount : 0),
      amount: previous.amount + amount,
    });
  }
  return totals;
}
