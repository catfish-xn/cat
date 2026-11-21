import type { DisplayCombatEvent } from '../../presentation/combat-display';

/**
 * The basic attacks of a batch that crit, as `${attackerId}>${targetId}@${tick}` of the attack's own event (CRIT_ATTACK_HIT).
 * A melee attack deals its damage on its own tick, so its crit packet is in the batch; a ranged hero's shot crits as it
 * leaves (the rules roll it at launch) and lands later, so its launch event carries the crit (attackLaunched.critical, and
 * attack.critical when set) and the attack plays as a crit from its first frame: its missile and its hit.
 */
export function attackCritKeys(events: readonly DisplayCombatEvent[]): Set<string> {
  const crits = new Set<string>();
  for (const event of events) {
    if (event.type === 'packetDamage' && event.critical && event.delivery === 'basic-attack') crits.add(`${event.sourceId}>${event.targetId}@${event.tick}`);
    if ((event.type === 'attackLaunched' || event.type === 'attack') && (event as { critical?: boolean }).critical === true) crits.add(`${event.attackerId}>${event.targetId}@${event.tick}`);
  }
  return crits;
}
