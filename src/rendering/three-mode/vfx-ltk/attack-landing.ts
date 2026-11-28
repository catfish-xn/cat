import type { DisplayCombatEvent } from '../../../presentation/combat-display';
import type { AttackLanding, LtkPlayOptions } from './runtime';
import type { TimelineVariant } from './timeline';

/** Rules ticks per second (combat tick = 0.05 s). */
const TICKS_PER_SECOND = 20;
/**
 * Whether an attack's play keeps its projectile when its attacker dies (LtkPlayOptions.outlivesSource): a ranged attack the
 * rules have launched (attackLaunched) lands and hurts even if its attacker dies in flight (cast-windup.ts releasedLanding),
 * so it flies on. Its wind-up part is not launched yet and goes with the attacker, as the rules cancel it then.
 */
export const attackOutlivesSource = (landing: AttackLanding | undefined): boolean => !!landing && landing.phase !== 'windup';
/**
 * The play options of an attack (placeholder-renderer playAction): its swing's release mapping, its rules landing, whether its
 * projectile outlives the attacker (attackOutlivesSource) and whether it crits; the bare variant when it has none of these.
 */
export function attackPlayOptions(variant: TimelineVariant | undefined, release: LtkPlayOptions['release'], landing: AttackLanding | undefined, crit: boolean): LtkPlayOptions | TimelineVariant | undefined {
  if (!release && !landing && !crit) return variant;
  return { variant, ...(release ? { release } : {}), ...(landing ? { landing } : {}), ...(attackOutlivesSource(landing) ? { outlivesSource: true } : {}), ...(crit ? { crit } : {}) };
}
/** The landing a ranged attack's wind-up play carries (attackWindup display event): its swing only, timed to the launch tick. */
export const windupLanding = (event: { tick: number; launchTick: number }): AttackLanding =>
  ({ seconds: 0, phase: 'windup', windupSeconds: Math.max(0, event.launchTick - event.tick) / TICKS_PER_SECOND });
/** The landing an attack event's play carries: on a wound-up attack's launch tick, its shot (phase launch, the rules' landing
 * or none yet); otherwise the batch's landing, if any (a ranged attack without a wind-up, or none for melee). */
export const attackEventLanding = (landing: AttackLanding | undefined, launch: boolean): AttackLanding | undefined =>
  launch ? { ...(landing ?? { seconds: 0 }), phase: 'launch' } : landing;
/**
 * Whether an attack event is a wound-up attack's launch, and whether it still has to start the swing. Its attackWindup normally
 * came first (the swing started there); when that was not seen (the view joined, or a capture window began, after the wind-up
 * started) the attack's own attackLaunched (a rules landing on this tick) still makes it the launch, so its shot leaves now and
 * lands on the rules' arrival; the swing then starts on the attack event itself.
 */
export function attackLaunchOf(windupLaunchTick: number | undefined, landed: boolean, tick: number): { launch: boolean; swing: boolean } {
  const wound = windupLaunchTick === tick;
  return { launch: wound || landed, swing: !wound };
}
/** The batch's attack key: one attacker's attack on one tick. */
export const attackKey = (attackerId: string, tick: number): string => `${attackerId}:${tick}`;
/**
 * The rules' landing of each ranged attack in a batch (attackLaunched display events, sent on the attack's own tick): seconds
 * from the attack to its arrival tick, and whether it is an instant beam. An attack that launches at several targets lands as
 * its launch at the attack event's own target does (else its first launch). Melee attacks and ranged units the rules still
 * settle on the attack tick send no launch and have no entry.
 */
export function attackLandings(events: readonly DisplayCombatEvent[]): Map<string, AttackLanding> {
  const targets = new Map<string, string>(), landings = new Map<string, AttackLanding & { targetId: string }>();
  for (const event of events) {
    if (event.type === 'attack') targets.set(attackKey(event.attackerId, event.tick), event.targetId);
    if (event.type !== 'attackLaunched') continue;
    const key = attackKey(event.attackerId, event.tick), known = landings.get(key);
    if (known && (known.targetId === targets.get(key) || event.targetId !== targets.get(key))) continue;
    landings.set(key, { seconds: Math.max(0, event.arrivalTick - event.tick) / TICKS_PER_SECOND, ...(event.projectile === 'beam' ? { beam: true } : {}), targetId: event.targetId });
  }
  return new Map([...landings].map(([key, { targetId: _target, ...landing }]) => [key, landing]));
}
