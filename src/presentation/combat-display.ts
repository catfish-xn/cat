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
import { toCombatViewEvents } from '../simulation/combat-replay-view';
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

/** Shared §14.2 projection plus the offline-only effect label, preserving ledger order. */
export function toDisplayEvent(event: LedgerCombatEvent): AnimationEvent | null {
  if (event.type === 'effectTriggered') return { tick: event.tick, eventSeq: event.eventSeq, type: event.type,
    ownerId: event.source.ownerId, sourceKind: event.source.sourceKind,
    sourceDefinitionId: event.source.sourceDefinitionId, targetId: event.targetId };
  return toCombatViewEvents([event])[0] ?? null;
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
export type DisplayUnit = Pick<CombatViewUnit, 'id' | 'definitionId' | 'team' | 'starLevel' | 'hp' | 'maxHp' | 'mana' | 'maxMana' | 'shield' | 'alive' | 'targetId' | 'cell' | 'attackRange'> & Pick<CombatViewUnit, 'enforcerWanted' | 'itemStacks'>;
export interface DisplayCombat { readonly units: readonly DisplayUnit[] }

/** Display-only tally of one battle from view events (online stats): damage and absorption by the event's own numbers. */
export interface ViewTotals { readonly unitId: string; hpDamage: number; physicalHpDamage: number; magicHpDamage: number; trueHpDamage: number; shieldAbsorbed: number; healingReceived: number }
export function tallyViewEvents(events: readonly DisplayCombatEvent[]): ViewTotals[] {
  const tally = createViewTally();
  tally.add(events);
  return tally.rows();
}
/** tallyViewEvents kept open: events are added as they play, the rows read at any point (the live stats panel). */
export function createViewTally(): { add(events: readonly DisplayCombatEvent[], from?: number): void; rows(): ViewTotals[] } {
  const rows = new Map<string, ViewTotals>();
  const row = (unitId: string) => {
    let value = rows.get(unitId);
    if (!value) { value = { unitId, hpDamage: 0, physicalHpDamage: 0, magicHpDamage: 0, trueHpDamage: 0, shieldAbsorbed: 0, healingReceived: 0 }; rows.set(unitId, value); }
    return value;
  };
  return {
    add(events, from = 0) {
      for (let i = from; i < events.length; i++) {
        const event = events[i]!;
        if (event.type === 'packetDamage') {
          const source = row(event.sourceId); source.hpDamage += event.hpDamage;
          if (event.damageType === 'physical') source.physicalHpDamage += event.hpDamage;
          else if (event.damageType === 'magic') source.magicHpDamage += event.hpDamage;
          else source.trueHpDamage += event.hpDamage;
          row(event.targetId).shieldAbsorbed += event.absorbed;
        } else if (event.type === 'heal') row(event.targetId).healingReceived += event.actual;
      }
    },
    rows: () => [...rows.values()].map(value => ({ ...value })).sort((a, b) => a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0),
  };
}
