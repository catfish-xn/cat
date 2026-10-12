/**
 * C6: the one battle shape every renderer reads, offline and online alike.
 *
 * Online the server sends a compact CombatReplay (contract §14.2): CombatViewState snapshots and whitelisted
 * animation events. Offline the local engine produces a full CombatState and its ledger; both are turned into the
 * same view here (`toCombatViewState`, `toDisplayEvents`) so BoardScene, unit views, fx and floats run one code
 * path. Offline additionally keeps the engine state (`runtime`) for detail panels the view cannot carry (status
 * rows, shield layers, effect sources); online those parts are hidden, never reconstructed.
 *
 * Nothing here computes a rule: the mapping only renames and drops fields.
 */
import type { HexCell } from '../simulation/board';
import type { LedgerCombatEvent } from '../simulation/combat-types';
import type { CombatViewEvent, CombatViewUnit } from '../simulation/combat-replay-view';
import type { Source } from '../simulation/m8/contracts';

export { toCombatViewState, applyCombatReplayTick } from '../simulation/combat-replay-view';
export type { CombatViewEvent, CombatViewState, CombatViewUnit, CombatReplay, CombatReplayTick } from '../simulation/combat-replay-view';

/**
 * Offline-only: `effectTriggered` is an execution program the wire never carries (§14.2), but the local engine
 * has it and the offline board labels it. Online streams simply never contain it.
 */
export interface LocalEffectEvent {
  readonly type: 'effectTriggered'; readonly tick: number; readonly eventSeq: number;
  readonly ownerId: string; readonly sourceKind: Source['sourceKind']; readonly sourceDefinitionId: string; readonly targetId: string;
}
/** Animation facts in display order; `unitUpdated` carries the authoritative end-of-tick values (online only). */
export type DisplayCombatEvent = CombatViewEvent | LocalEffectEvent;
export type AnimationEvent = Exclude<DisplayCombatEvent, { readonly type: 'unitUpdated' }>;
/** What a scene frame hands its consumers: offline the local ledger (detail logs keep their full text), online wire events. */
export type SceneCombatEvent = LedgerCombatEvent | DisplayCombatEvent;

const cell = (value: HexCell): HexCell => ({ col: value.col, row: value.row });

/**
 * The §14.2 animation whitelist applied to one local ledger event: the same fields, names and order as the
 * server's replay events (pinned by tests/server/replay-client.test.ts), plus the offline effect label.
 */
export function toDisplayEvent(event: LedgerCombatEvent): AnimationEvent | null {
  const envelope = { tick: event.tick, eventSeq: event.eventSeq };
  switch (event.type) {
    case 'movement': return { ...envelope, type: event.type, unitId: event.unitId, from: cell(event.from), to: cell(event.to) };
    case 'attack': return { ...envelope, type: event.type, attackerId: event.attackerId, targetId: event.targetId };
    case 'targetChanged': return { ...envelope, type: event.type, unitId: event.unitId, before: event.before, after: event.after };
    case 'death': return { ...envelope, type: event.type, unitId: event.unitId };
    case 'kill': return { ...envelope, type: event.type, unitId: event.unitId, sourceId: event.source.ownerId };
    case 'growth': return { ...envelope, type: event.type, unitId: event.unitId, amountBps: event.amountBps, totalBps: event.totalBps };
    case 'combatFinished': return { ...envelope, type: event.type, result: event.result, reason: event.reason };
    case 'packetDamage': {
      const o = event.outcome;
      return { ...envelope, type: event.type, sourceId: o.context.source.ownerId, targetId: o.context.targetId, damageType: o.context.damageType,
        hit: o.hit, hpDamage: o.hpDamage, absorbed: o.absorbed, critical: o.critical, killingPacket: o.killingPacket };
    }
    case 'heal': return { ...envelope, type: event.type, targetId: event.outcome.targetId, actual: event.outcome.actual };
    case 'manaChanged': return { ...envelope, type: event.type, targetId: event.outcome.targetId, before: event.outcome.before, after: event.outcome.after };
    case 'cast': {
      const r = event.receipt;
      return { ...envelope, type: event.type, sourceId: r.source.ownerId, actionSeq: r.actionSeq, completed: r.completed,
        actualManaSpent: r.actualManaSpent, refundedMana: r.refundedMana, targetIds: [...r.targetIds], completionCell: cell(r.completionCell) };
    }
    case 'shieldLayerChanged': return { ...envelope, type: event.type, reason: event.reason, key: event.layer.key, targetId: event.layer.targetId, remaining: event.layer.remaining };
    case 'statusChanged': return { ...envelope, type: event.type, reason: event.reason, targetId: event.group.targetId, kind: event.group.kind, effectiveMagnitudeBps: event.group.effectiveMagnitudeBps };
    case 'statChanged': return { ...envelope, type: event.type, unitId: event.unitId, stat: event.stat, before: event.before, after: event.after };
    case 'maxHpChanged': return { ...envelope, type: event.type, unitId: event.unitId, beforeMax: event.beforeMax, afterMax: event.afterMax, beforeHp: event.beforeHp, afterHp: event.afterHp };
    case 'effectTriggered': return { ...envelope, type: event.type, ownerId: event.source.ownerId, sourceKind: event.source.sourceKind,
      sourceDefinitionId: event.source.sourceDefinitionId, targetId: event.targetId };
    case 'activityChanged': return null;
  }
}
export function toDisplayEvents(events: readonly LedgerCombatEvent[]): AnimationEvent[] {
  const out: AnimationEvent[] = [];
  for (const event of events) { const view = toDisplayEvent(event); if (view) out.push(view); }
  return out;
}
export const isLedgerEvent = (event: SceneCombatEvent): event is LedgerCombatEvent => 'domain' in event && event.domain === 'combat';
/** Display events of a mixed stream: local ledger events are projected, wire events pass through unchanged. */
export function asDisplayEvents(events: readonly SceneCombatEvent[]): DisplayCombatEvent[] {
  const out: DisplayCombatEvent[] = [];
  for (const event of events) {
    if (isLedgerEvent(event)) { const view = toDisplayEvent(event); if (view) out.push(view); }
    else out.push(event);
  }
  return out;
}

/** What the board needs of a unit; a CombatViewUnit and an engine CombatUnit both satisfy it. */
export type DisplayUnit = Pick<CombatViewUnit, 'id' | 'definitionId' | 'team' | 'starLevel' | 'hp' | 'maxHp' | 'mana' | 'maxMana' | 'shield' | 'alive' | 'targetId' | 'cell' | 'attackRange'>;
export interface DisplayCombat { readonly units: readonly DisplayUnit[] }

/** Display-only tally of one battle from view events (online stats): damage and absorption by the event's own numbers. */
export interface ViewTotals { readonly unitId: string; hpDamage: number; physicalHpDamage: number; magicHpDamage: number; trueHpDamage: number; shieldAbsorbed: number; healingReceived: number }
export function tallyViewEvents(events: readonly DisplayCombatEvent[]): ViewTotals[] {
  const rows = new Map<string, ViewTotals>();
  const row = (unitId: string) => {
    let value = rows.get(unitId);
    if (!value) { value = { unitId, hpDamage: 0, physicalHpDamage: 0, magicHpDamage: 0, trueHpDamage: 0, shieldAbsorbed: 0, healingReceived: 0 }; rows.set(unitId, value); }
    return value;
  };
  for (const event of events) {
    if (event.type === 'packetDamage') {
      const source = row(event.sourceId); source.hpDamage += event.hpDamage;
      if (event.damageType === 'physical') source.physicalHpDamage += event.hpDamage;
      else if (event.damageType === 'magic') source.magicHpDamage += event.hpDamage;
      else source.trueHpDamage += event.hpDamage;
      row(event.targetId).shieldAbsorbed += event.absorbed;
    } else if (event.type === 'heal') row(event.targetId).healingReceived += event.actual;
  }
  return [...rows.values()].sort((a, b) => a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0);
}
