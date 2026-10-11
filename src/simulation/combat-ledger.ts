import type { CombatEvent, LedgerCombatEvent } from './combat-types';
/** B9 replay2 boundary: a Match ledger holds only stamped frozen M8 events (contracts.ts M8CombatEvent).
 * Pre-S13 shapes (aggregate damage, shieldChanged, legacy cast/mana) are rejected, never renamed. */
export function toLedgerEvents(events: readonly CombatEvent[]): LedgerCombatEvent[] {
  for (const event of events) {
    if (event.domain !== 'combat' || typeof event.combatId !== 'string' || !Number.isSafeInteger(event.eventSeq))
      throw new RangeError(`Unstamped combat event ${event.type} cannot enter a Match ledger`);
    if (event.type === 'damage' || event.type === 'shieldChanged' || event.type === 'cast' && !('receipt' in event)
      || event.type === 'manaChanged' && !('outcome' in event))
      throw new RangeError(`Legacy combat event ${event.type} cannot enter the replay2 ledger`);
  }
  return events as unknown as LedgerCombatEvent[];
}
