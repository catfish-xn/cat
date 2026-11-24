import type { DisplayCombatEvent } from '../../presentation/combat-display';

/**
 * The basic attacks of a batch that crit, as `${attackerId}>${targetId}@${tick}` of the attack's own event (CRIT_ATTACK_HIT).
 * Each attack is judged by its own event, never guessed from what else happens on its tick:
 * - a ranged hero's shot (attackLaunched with a flight) crits as it leaves (the rules roll it at launch) and lands later, so
 *   its launch's crit flag alone decides it. An earlier shot's crit landing on the same tick and target is that earlier
 *   shot's, not this one's, and a key with a flight launch never takes a packet's crit;
 * - any other attack (melee, a beam) deals its damage on its own tick, so its crit packet in the batch (or its attack event's
 *   crit flag) decides it.
 */
export function attackCritKeys(events: readonly DisplayCombatEvent[]): Set<string> {
  const flights = new Map<string, boolean>(), packets = new Set<string>(), crits = new Set<string>();
  for (const event of events) {
    if (event.type === 'attackLaunched' && event.projectile === 'flight') {
      const key = `${event.attackerId}>${event.targetId}@${event.tick}`;
      flights.set(key, (flights.get(key) ?? false) || event.critical === true);
    }
    if (event.type === 'packetDamage' && event.critical && event.delivery === 'basic-attack') packets.add(`${event.sourceId}>${event.targetId}@${event.tick}`);
    if (event.type === 'attack' && (event as { critical?: boolean }).critical === true) packets.add(`${event.attackerId}>${event.targetId}@${event.tick}`);
  }
  for (const [key, critical] of flights) if (critical) crits.add(key);
  for (const key of packets) if (!flights.has(key)) crits.add(key);
  return crits;
}
