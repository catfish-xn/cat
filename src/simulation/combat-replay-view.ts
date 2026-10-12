import type { CombatState, CombatUnit, LedgerCombatEvent } from './combat-types';
import { stepCombat } from './combat';
import { toLedgerEvents } from './combat-ledger';
import { readCombatStats } from './combat-s13';
import { canonicalContent } from './content';
import { freezeContent } from './content/freeze';
import { boardView, cellView, pick } from './view-fields';

export const COMBAT_REPLAY_KEYFRAME_INTERVAL = 20;
const scalarKeys = ['id', 'definitionId', 'team', 'starLevel', 'hp', 'maxHp', 'mana', 'maxMana', 'shield',
  'alive', 'targetId', 'attackDamage', 'attackRange', 'attackIntervalTicks', 'armor', 'magicResist',
  'abilityPower', 'baseAttackSpeedBps', 'attackSpeedBonusBps'] as const;
function unitView(unit: CombatUnit, state: CombatState) {
  return { ...pick(unit, scalarKeys), ...readCombatStats(unit, state), cell: cellView(unit.cell),
    ...(unit.startingCell ? { startingCell: cellView(unit.startingCell) } : {}) };
}
export function toCombatViewState(state: CombatState) {
  return freezeContent({ ...pick(state, ['combatId', 'tick', 'maxTicks', 'status', 'result']),
    board: boardView(state.board), units: state.units.map(unit => unitView(unit, state)) });
}
export type CombatViewState = ReturnType<typeof toCombatViewState>;
export type CombatViewUnit = CombatViewState['units'][number];

/** Animation facts only. Numerical state updates come from end-of-tick unitUpdated events. */
function animationEvent(event: LedgerCombatEvent) {
  const envelope = pick(event, ['tick', 'eventSeq']);
  switch (event.type) {
    case 'movement': return { ...envelope, type: event.type, unitId: event.unitId, from: cellView(event.from), to: cellView(event.to) };
    case 'attack': return { ...envelope, ...pick(event, ['type', 'attackerId', 'targetId']) };
    case 'targetChanged': return { ...envelope, ...pick(event, ['type', 'unitId', 'before', 'after']) };
    case 'death': return { ...envelope, ...pick(event, ['type', 'unitId']) };
    case 'kill': return { ...envelope, type: event.type, unitId: event.unitId, sourceId: event.source.ownerId };
    case 'growth': return { ...envelope, ...pick(event, ['type', 'unitId', 'amountBps', 'totalBps']) };
    case 'combatFinished': return { ...envelope, ...pick(event, ['type', 'result', 'reason']) };
    case 'packetDamage': return { ...envelope, type: event.type, sourceId: event.outcome.context.source.ownerId,
      targetId: event.outcome.context.targetId, damageType: event.outcome.context.damageType,
      ...pick(event.outcome, ['hit', 'hpDamage', 'absorbed', 'critical', 'killingPacket']) };
    case 'heal': return { ...envelope, type: event.type, ...pick(event.outcome, ['targetId', 'actual']) };
    case 'manaChanged': return { ...envelope, type: event.type, ...pick(event.outcome, ['targetId', 'before', 'after']) };
    case 'cast': return { ...envelope, type: event.type, sourceId: event.receipt.source.ownerId,
      ...pick(event.receipt, ['actionSeq', 'completed', 'actualManaSpent', 'refundedMana']),
      targetIds: [...event.receipt.targetIds], completionCell: cellView(event.receipt.completionCell) };
    case 'shieldLayerChanged': return { ...envelope, type: event.type, reason: event.reason,
      ...pick(event.layer, ['key', 'targetId', 'remaining']) };
    case 'statusChanged': return { ...envelope, type: event.type, reason: event.reason,
      ...pick(event.group, ['targetId', 'kind', 'effectiveMagnitudeBps']) };
    case 'statChanged': return { ...envelope, ...pick(event, ['type', 'unitId', 'stat', 'before', 'after']) };
    case 'maxHpChanged': return { ...envelope, ...pick(event, ['type', 'unitId', 'beforeMax', 'afterMax', 'beforeHp', 'afterHp']) };
    // Activities/effect programs contain execution plans. Only their visible consequences are sent.
    case 'activityChanged': case 'effectTriggered': return null;
  }
}
export type CombatAnimationEvent = NonNullable<ReturnType<typeof animationEvent>>;
export type CombatViewEvent = CombatAnimationEvent
  | { readonly type: 'unitUpdated'; readonly unitId: string; readonly changes: Partial<Omit<CombatViewUnit, 'id'>> };
export interface CombatReplayTick {
  readonly tick: number;
  readonly events: readonly CombatViewEvent[];
  readonly keyframe?: CombatViewState;
}
export interface CombatReplay {
  readonly initial: CombatViewState;
  readonly ticks: readonly CombatReplayTick[];
  readonly terminal: CombatViewState;
}
export type CombatReplayInput = Pick<import('./two-sided-types').BattleResult, 'initial' | 'terminal' | 'events'>;
/** Trusted ledger -> detached animation whitelist, in input order; never creates unitUpdated. */
export function toCombatViewEvents(events: readonly LedgerCombatEvent[]): CombatAnimationEvent[] {
  return events.flatMap(event => {
    const view = animationEvent(event); return view ? [view] : [];
  });
}

/** Trusted complete battle only. One bounded pure re-execution; never commits Match settlement. */
export function toCombatReplay(battle: CombatReplayInput): CombatReplay {
  if (battle.initial.tick !== 0 || battle.terminal.status !== 'finished'
    || battle.terminal.tick > 1200 || battle.terminal.tick < 0) throw new RangeError('invalid-replay-input');
  const initial = toCombatViewState(battle.initial), terminal = toCombatViewState(battle.terminal);
  // A tick0 event can be emitted by the first step (e.g. wolves' opening jump).
  // The initial state's ledger cursor, not the event tick, marks applied start effects.
  const firstStepEventSeq = battle.initial.nextEventSeq ?? 0;
  const ticks: CombatReplayTick[] = [{ tick: 0, events: toCombatViewEvents(battle.events.filter(event => event.eventSeq < firstStepEventSeq)) }];
  let state = battle.initial, previous = initial;
  const generated: LedgerCombatEvent[] = [];
  while (state.status === 'running' && state.tick < battle.terminal.tick) {
    const next = stepCombat(state);
    if (next.state.tick !== state.tick + 1) throw new RangeError('replay-divergence');
    state = next.state;
    const ledger = toLedgerEvents(next.events); generated.push(...ledger);
    const view = toCombatViewState(state), events: CombatViewEvent[] = toCombatViewEvents(ledger);
    if (view.units.length !== previous.units.length || view.units.some((u, i) => u.id !== previous.units[i].id)) throw new RangeError('replay-divergence');
    for (let i = 0; i < view.units.length; i++) {
      const unit = view.units[i], before = previous.units[i];
      const changes = Object.fromEntries(Object.entries(unit).filter(([key, value]) => key !== 'id'
        && JSON.stringify(value) !== JSON.stringify(before[key as keyof CombatViewUnit])));
      if (Object.keys(changes).length) events.push({ type: 'unitUpdated', unitId: unit.id, changes });
    }
    ticks.push({ tick: state.tick, events,
      ...(state.tick % COMBAT_REPLAY_KEYFRAME_INTERVAL === 0 || state.status === 'finished' ? { keyframe: view } : {}) });
    previous = view;
  }
  if (canonicalContent(previous) !== canonicalContent(terminal)
    || canonicalContent(toCombatViewEvents(generated)) !== canonicalContent(toCombatViewEvents(battle.events.filter(event => event.eventSeq >= firstStepEventSeq)))) {
    throw new RangeError('replay-divergence');
  }
  return freezeContent({ initial, ticks, terminal });
}

/** Display reducer: animation facts never apply damage/mana twice. Keyframes replace after events. */
export function applyCombatReplayTick(view: CombatViewState, frame: CombatReplayTick): CombatViewState {
  if (frame.keyframe) return frame.keyframe;
  let units = view.units;
  for (const event of frame.events) if (event.type === 'unitUpdated') {
    units = units.map(unit => unit.id === event.unitId ? { ...unit, ...event.changes } : unit);
  }
  return freezeContent({ ...view, tick: frame.tick, units });
}
