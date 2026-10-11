/* B9 replay2 test views. The engine now publishes the frozen M8 ledger shapes (contracts.ts
 * M8CombatEvent): packetDamage{outcome}, cast{receipt}, one manaChanged{outcome} per request,
 * statusChanged{group}, activityChanged{activity}, shieldLayerChanged{layer: ShieldState},
 * heal{outcome}, and no aggregate `damage`. These helpers read the same authoritative facts back
 * in the field names the earlier assertions used, so every expected value stays unchanged.
 * They are read-only projections for tests; nothing here feeds the engine. */
import type { CombatEvent, CombatOrigin } from '../../src/simulation/combat-types';

type Any = CombatEvent | { readonly type: string };
type Of<T extends string> = Extract<CombatEvent, { type: T }>;
const has = <K extends string>(event: object, key: K): event is Record<K, unknown> => key in event;

/** Source → legacy CombatOrigin field set (parentItemInstanceId only when it is a real parent). */
export function origin(source: CombatOrigin): CombatOrigin {
  const { parentItemInstanceId, ...rest } = source as CombatOrigin & { parentItemInstanceId?: string | null };
  return parentItemInstanceId ? { ...rest, parentItemInstanceId } : rest;
}

export interface PacketView {
  readonly type: 'packetDamage'; readonly tick: number; readonly unitId: string; readonly source: CombatOrigin;
  readonly damageType: 'physical' | 'magic' | 'true';
  /** Frozen DamageOutcome.raw: the raw amount before the critical multiplier (the old event field was after it). */
  readonly raw: number; readonly mitigated: number; readonly absorbed: number;
  readonly hpDamage: number; readonly actionSeq: number; readonly packetOrdinal: number; readonly critical: boolean;
  readonly redirected: boolean; readonly eventSeq?: number;
}
export function packetView(event: Any): PacketView {
  if (event.type !== 'packetDamage' || !has(event, 'outcome')) throw new Error('not a replay2 packetDamage event');
  const e = event as Of<'packetDamage'> & { readonly outcome: import('../../src/simulation/m8/contracts').DamageOutcome };
  const o = e.outcome;
  return { type: 'packetDamage', tick: e.tick, unitId: o.context.targetId, source: origin(o.context.source), damageType: o.context.damageType,
    raw: o.raw, mitigated: o.mitigated, absorbed: o.absorbed, hpDamage: o.hpDamage, actionSeq: o.context.actionSeq, packetOrdinal: o.context.packetOrdinal,
    critical: o.critical, redirected: o.context.redirected, ...(e.eventSeq === undefined ? {} : { eventSeq: e.eventSeq }) };
}
export const packets = (events: readonly Any[]): PacketView[] => events.filter(e => e.type === 'packetDamage').map(packetView);

export interface HealView { readonly type: 'heal'; readonly tick: number; readonly unitId: string; readonly source: CombatOrigin; readonly requested: number; readonly actual: number; readonly overheal: number }
export function healView(event: Any): HealView {
  if (event.type !== 'heal' || !has(event, 'outcome')) throw new Error('not a replay2 heal event');
  const o = (event as unknown as { outcome: import('../../src/simulation/m8/contracts').HealOutcome; tick: number }).outcome;
  return { type: 'heal', tick: (event as { tick: number }).tick, unitId: o.targetId, source: origin(o.shares[0]!.source), requested: o.requested, actual: o.actual, overheal: o.overheal };
}
export const heals = (events: readonly Any[]): HealView[] => events.filter(e => e.type === 'heal').map(healView);

export interface CastView { readonly type: 'cast'; readonly tick: number; readonly sourceId: string; readonly targetIds: readonly string[]; readonly manaSpent: number; readonly refundedMana: number }
export function castView(event: Any): CastView {
  if (event.type !== 'cast' || !has(event, 'receipt')) throw new Error('not a replay2 cast event');
  const r = (event as unknown as { receipt: import('../../src/simulation/m8/contracts').CastReceipt; tick: number }).receipt;
  return { type: 'cast', tick: (event as { tick: number }).tick, sourceId: r.source.ownerId, targetIds: r.targetIds, manaSpent: r.actualManaSpent, refundedMana: r.refundedMana };
}
export const casts = (events: readonly Any[]): CastView[] => events.filter(e => e.type === 'cast').map(castView);

/** Unit-and-tick view of replay2 mana: the per-request outcomes of one unit in one tick, plus
 * the cast cost from that tick's receipt. Mirrors the earlier aggregate fields. */
export interface ManaView { readonly unitId: string; readonly tick: number; readonly before: number; readonly spent: number; readonly attackGain: number; readonly damageGain: number; readonly killGain: number; readonly refund: number; readonly overflow: number; readonly after: number }
export function manaView(events: readonly Any[], unitId: string, tick: number): ManaView | undefined {
  const outcomes = events.filter(e => e.type === 'manaChanged' && has(e, 'outcome') && (e as { tick: number }).tick === tick)
    .map(e => (e as unknown as { outcome: import('../../src/simulation/m8/contracts').ManaOutcome }).outcome).filter(o => o.targetId === unitId);
  const cast = casts(events).find(c => c.sourceId === unitId && c.tick === tick);
  if (!outcomes.length && !cast) return undefined;
  const sum = (reason: string) => outcomes.filter(o => o.reason === reason).reduce((n, o) => n + o.applied, 0);
  const first = outcomes[0], last = outcomes.at(-1);
  return { unitId, tick, before: first ? first.before + (cast?.manaSpent ?? 0) : NaN, spent: cast?.manaSpent ?? 0, attackGain: sum('attack'), damageGain: sum('damage'),
    killGain: sum('kill'), refund: sum('cast-refund'), overflow: outcomes.reduce((n, o) => n + o.overflow, 0), after: last ? last.after : NaN };
}
export const manaOutcomes = (events: readonly Any[]) => events.filter(e => e.type === 'manaChanged' && has(e, 'outcome'))
  .map(e => ({ tick: (e as { tick: number }).tick, ...(e as unknown as { outcome: import('../../src/simulation/m8/contracts').ManaOutcome }).outcome }));

/** Per-unit per-tick incoming damage, as the removed aggregate `damage` event reported it. */
export interface DamageTotal { readonly tick: number; readonly unitId: string; readonly amount: number; readonly physicalAmount: number; readonly magicAmount: number; readonly absorbed: number; readonly hpDamage: number }
export function damageTotals(events: readonly Any[]): DamageTotal[] {
  const rows = new Map<string, { tick: number; unitId: string; amount: number; physicalAmount: number; magicAmount: number; absorbed: number; hpDamage: number }>();
  for (const p of packets(events)) {
    const key = JSON.stringify([p.tick, p.unitId]);
    const row = rows.get(key) ?? { tick: p.tick, unitId: p.unitId, amount: 0, physicalAmount: 0, magicAmount: 0, absorbed: 0, hpDamage: 0 };
    row.amount += p.mitigated; row.absorbed += p.absorbed; row.hpDamage += p.hpDamage;
    if (p.damageType === 'physical') row.physicalAmount += p.mitigated; else if (p.damageType === 'magic') row.magicAmount += p.mitigated;
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** statusChanged → the target and, for end events, the ended contribution keys. */
export const statusEvents = (events: readonly Any[]) => events.filter(e => e.type === 'statusChanged' && has(e, 'group'))
  .map(e => e as unknown as { tick: number; reason: string; eventSeq?: number; group: import('../../src/simulation/m8/contracts').StatusGroup })
  .map(e => ({ tick: e.tick, reason: e.reason, unitId: e.group.targetId, kind: e.group.kind, keys: e.group.contributions.map(c => c.key), group: e.group, eventSeq: e.eventSeq }));
export const activityEvents = (events: readonly Any[]) => events.filter(e => e.type === 'activityChanged')
  .map(e => e as unknown as { tick: number; reason: string; activity: import('../../src/simulation/m8/contracts').CombatActivity })
  .map(e => ({ tick: e.tick, reason: e.reason, unitId: e.activity.targetId, kind: e.activity.kind, activity: e.activity }));
export const shieldEvents = (events: readonly Any[]) => events.filter(e => e.type === 'shieldLayerChanged')
  .map(e => e as unknown as { tick: number; reason: string; layer: import('../../src/simulation/m8/contracts').ShieldState })
  .map(e => ({ tick: e.tick, reason: e.reason, unitId: e.layer.targetId, remaining: e.layer.remaining, layer: e.layer }));
