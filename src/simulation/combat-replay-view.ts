import { isPresent, isSelectable } from './anomalies/availability';
import { d11CombatDisplay } from './d11-display';
import { sampleD11CombatGold, validateD11BankSamples } from './d11-fill';
import { freezeCombatDeclarations } from './combat-static';
import type { CombatState, CombatUnit, LedgerCombatEvent } from './combat-types';
import { stepCombat } from './combat';
import { toLedgerEvents } from './combat-ledger';
import { readCombatStats } from './combat-s13';
import { canonicalContent } from './content';
import { createScopedContentFreezer, freezeTransientContent } from './content/freeze';
import { boardView, cellView, pick } from './view-fields';
import { alignReplayUnits, applyReplayMembership, replayOrderFollowsMembership } from './seat-mechanics/replay-units';
// combat-status is pure (its other presentation imports are type-only). Reuse the
// single-player snapshot reader so pending/suppressed/filter/legacy semantics cannot drift.
import { readUnitStatusRows } from '../presentation/combat-status';
import type { StatusKind } from './m8/contracts';

export interface CombatViewStatus {
  readonly kind: StatusKind | 'channel' | 'redirect';
  readonly harmful: boolean;
}
function statusView(state: CombatState, unitId: string): { readonly statuses?: readonly CombatViewStatus[] } {
  const statuses = new Map<string, CombatViewStatus>();
  for (const row of readUnitStatusRows(state, unitId)) {
    if (row.state === 'pending' || row.state === 'suppressed') continue;
    statuses.set(JSON.stringify([row.kind, row.harmful]), { kind: row.kind, harmful: row.harmful });
  }
  // ASCII kind order, then beneficial (false) before harmful (true); no locale dependence.
  // Always emit [], including when the last status ends, so unitUpdated clears old icons.
  return { statuses: [...statuses.values()].sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0)
    || Number(a.harmful) - Number(b.harmful)) };
}

export const COMBAT_REPLAY_KEYFRAME_INTERVAL = 20;
const scalarKeys = ['id', 'definitionId', 'team', 'starLevel', 'hp', 'maxHp', 'mana', 'maxMana', 'shield',
  'alive', 'targetId', 'attackDamage', 'attackRange', 'attackIntervalTicks', 'armor', 'magicResist',
  'abilityPower', 'baseAttackSpeedBps', 'attackSpeedBonusBps', 'form'] as const;
function unitView(unit: CombatUnit, state: CombatState) {
  const choiceEffects=d11CombatDisplay(unit);
  return { ...pick(unit, scalarKeys), ...readCombatStats(unit, state), ...statusView(state, unit.id), cell: cellView(unit.cell),
    ...(choiceEffects.length?{choiceEffects}:{}),
    ...(unit.itemBanish || unit.anomalyState?.absentUntilTick !== undefined ? {banished:unit.alive && !isPresent(unit,state.tick)} : {}),
    ...(unit.anomalyState || unit.anomalySummon ? {untargetable:unit.alive && !isSelectable(unit,state.tick)} : {}),
    ...(unit.startingCell ? { startingCell: cellView(unit.startingCell) } : {}) };
}
function combatViewState(state: CombatState) {
  return { ...pick(state, ['combatId', 'tick', 'maxTicks', 'status', 'result']),
    board: boardView(state.board), units: state.units.map(unit => unitView(unit, state)) };
}
export function toCombatViewState(state: CombatState) { return freezeTransientContent(combatViewState(state)); }
export type CombatViewState = ReturnType<typeof toCombatViewState>;
export type CombatViewUnit = CombatViewState['units'][number];

/** Animation facts only. Numerical state updates come from end-of-tick unitUpdated events. */
function animationEvent(event: LedgerCombatEvent) {
  const envelope = pick(event, ['tick', 'eventSeq']);
  switch (event.type) {
    case 'movement': return { ...envelope, type: event.type, unitId: event.unitId, from: cellView(event.from), to: cellView(event.to) };
    case 'attack': return { ...envelope, ...pick(event, ['type', 'attackerId', 'targetId']) };
    case 'targetChanged': return { ...envelope, ...pick(event, ['type', 'unitId', 'before', 'after']) };
    case 'unitRevived': return { ...envelope, ...pick(event, ['type','unitId','hp']), sourceId:event.source.ownerId };
    case 'death': return { ...envelope, ...pick(event, ['type', 'unitId']) };
    case 'kill': return { ...envelope, type: event.type, unitId: event.unitId, sourceId: event.source.ownerId };
    case 'growth': return { ...envelope, ...pick(event, ['type', 'unitId', 'amountBps', 'totalBps']) };
    case 'combatFinished': return { ...envelope, ...pick(event, ['type', 'result', 'reason']) };
    case 'packetDamage': return { ...envelope, type: event.type, sourceId: event.outcome.context.source.ownerId,
      targetId: event.outcome.context.targetId, damageType: event.outcome.context.damageType,
      ...pick(event.outcome, ['hit', 'hpDamage', 'absorbed', 'critical', 'killingPacket']) };
    case 'heal': return { ...envelope, type: event.type, ...pick(event.outcome, ['targetId', 'actual']),
      shares: event.outcome.shares.map(share => ({ sourceId: share.source.ownerId, actual: share.actual })) };
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
    // G2-3: membership changes also produce unitEntered/unitLeft state events (seat-mechanics/replay-units.ts).
    case 'unitSpawned': return { ...envelope, type: event.type, sourceId: event.source.ownerId,
      ...pick(event, ['unitId', 'definitionId', 'team']), cell: cellView(event.cell) };
    case 'unitRemoved': return { ...envelope, ...pick(event, ['type', 'unitId', 'reason']) };
    case 'castOutcome': return { ...envelope, ...pick(event, ['type', 'unitId', 'abilityKey', 'outcome']), subOutcomes: [...event.subOutcomes] };
    case 'bindingChanged': return { ...envelope, ...pick(event, ['type', 'unitId', 'bound', 'reason']) };
    case 'combatItemGranted': return { ...envelope, ...pick(event, ['type', 'unitId', 'definitionId']), sourceId: event.source.ownerId };
  }
}
export type CombatAnimationEvent = NonNullable<ReturnType<typeof animationEvent>>;
export type CombatViewEvent = CombatAnimationEvent
  | { readonly type: 'unitUpdated'; readonly unitId: string; readonly changes: Partial<Omit<CombatViewUnit, 'id'>> }
  | import('./seat-mechanics/replay-units').ReplayMembershipEvent;
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
export type CombatReplayInput = Pick<import('./two-sided-types').BattleResult, 'initial' | 'terminal' | 'events' | 'bankSamples'>;
/** Trusted ledger -> detached animation whitelist, in input order; never creates unitUpdated. */
export function toCombatViewEvents(events: readonly LedgerCombatEvent[]): CombatAnimationEvent[] {
  return events.flatMap(event => {
    const view = animationEvent(event); return view ? [view] : [];
  });
}

export interface CombatReplayTask {
  advance(maxTicks: number): CombatReplay | null;
}

// Scalar view fields need no serialization. Objects and non-finite numbers keep
// the original JSON comparison, including its getter and null coercion behavior.
function equalViewField(a: unknown, b: unknown): boolean {
  if (typeof a === typeof b && (typeof a === 'string' || typeof a === 'boolean'
    || typeof a === 'number' && Number.isFinite(a) && Number.isFinite(b))) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface CombatReplayRecorder {
  record(previousState: CombatState, step: import('./combat').CombatStep): CombatReplayTick;
  finish(terminalState: CombatState): CombatReplay;
}

/** Trusted first-pass states/events only; no combat stepping or ledger authentication. */
export function createCombatReplayRecorder(initialState: CombatState,
  initialEvents: readonly LedgerCombatEvent[]): CombatReplayRecorder {
  if (initialState.tick !== 0) throw new RangeError('invalid-replay-input');
  const freezeReplay = createScopedContentFreezer();
  const initial = freezeReplay(combatViewState(initialState));
  const firstStepEventSeq = initialState.nextEventSeq ?? 0;
  const ticks: CombatReplayTick[] = [freezeReplay({ tick: 0,
    events: toCombatViewEvents(initialEvents.filter(event => event.eventSeq < firstStepEventSeq)) })];
  let previous = initial, result: CombatReplay | null = null;
  return {
    record(previousState, next) {
      if (result || previous.status !== 'running' || previousState.combatId !== initial.combatId
        || next.state.combatId !== initial.combatId || previousState.tick !== previous.tick
        || next.state.tick !== previous.tick + 1 || next.state.tick > 1200) throw new RangeError('replay-divergence');
      // Whitelists detach nested mutable fields before freezing this tick.
      const view = freezeReplay(combatViewState(next.state));
      const events: CombatViewEvent[] = toCombatViewEvents(toLedgerEvents(next.events));
      const sameMembers = view.units.length === previous.units.length && view.units.every((u, i) => u.id === previous.units[i].id);
      // Align by identity; a keyframe below carries the exact order when the membership events cannot.
      const before = sameMembers ? previous.units : alignReplayUnits(previous.units, view.units, events);
      const ordered = sameMembers || replayOrderFollowsMembership(previous.units, view.units);
      for (let i = 0; i < view.units.length; i++) {
        const unit = view.units[i], prior = before[i];
        if (!prior) continue;
        const changes = Object.fromEntries(Object.entries(unit).filter(([key, value]) => key !== 'id'
          && !equalViewField(value, prior[key as keyof CombatViewUnit])));
        if (Object.keys(changes).length) events.push({ type: 'unitUpdated', unitId: unit.id, changes });
      }
      ticks.push(freezeReplay({ tick: next.state.tick, events,
        ...(!ordered || next.state.tick % COMBAT_REPLAY_KEYFRAME_INTERVAL === 0 || next.state.status === 'finished' ? { keyframe: view } : {}) }));
      previous = view;
      return ticks[ticks.length - 1];
    },
    finish(terminalState) {
      if (terminalState.status !== 'finished' || terminalState.tick < 0 || terminalState.tick > 1200)
        throw new RangeError('invalid-replay-input');
      const terminal = freezeReplay(combatViewState(terminalState));
      if (canonicalContent(previous) !== canonicalContent(terminal)) throw new RangeError('replay-divergence');
      return result ??= freezeReplay({ initial, ticks, terminal });
    },
  };
}

/** Trusted complete PvP/PvE battle. Own the input across scheduling pauses. */
export function startCombatReplay(input: CombatReplayInput): CombatReplayTask {
  const freezeReplay = createScopedContentFreezer();
  const battle = structuredClone(input);
  battle.initial.units.forEach(unit => freezeCombatDeclarations(unit));
  if (battle.initial.tick !== 0 || battle.terminal.status !== 'finished'
    || battle.terminal.tick > 1200 || battle.terminal.tick < 0) throw new RangeError('invalid-replay-input');
  const terminal = freezeReplay(combatViewState(battle.terminal));
  const recorder = createCombatReplayRecorder(battle.initial, battle.events);
  const firstStepEventSeq = battle.initial.nextEventSeq ?? 0;
  let state = battle.initial;
  validateD11BankSamples(battle.bankSamples,battle.terminal.tick);
  let bankCursor=0;
  // Compare the same ordered animation whitelist incrementally. Comparing each
  // canonical element is equivalent to comparing the complete canonical arrays,
  // but leaves no whole-battle serialization work in the final scheduling slice.
  let expectedIndex = 0, divergent = false;
  let comparisonError: unknown;
  let comparisonFailed = false;
  const nextExpected = (): CombatAnimationEvent | undefined => {
    while (expectedIndex < battle.events.length) {
      const event = battle.events[expectedIndex++];
      if (event.eventSeq >= firstStepEventSeq) {
        const visible = animationEvent(event);
        if (visible) return visible;
      }
    }
    return undefined;
  };
  let result: CombatReplay | null = null;
  return { advance(maxTicks) {
    if (!Number.isSafeInteger(maxTicks) || maxTicks < 1) throw new RangeError('invalid-budget');
    if (result) return result;
    let steps = 0;
    while (steps < maxTicks && state.status === 'running' && state.tick < battle.terminal.tick) {
      while(battle.bankSamples?.[bankCursor]?.tick===state.tick){
        const sample=battle.bankSamples[bankCursor++];state=sampleD11CombatGold(state,sample.team,sample.liveGold);
      }
      const next = stepCombat(state);
      const frame = recorder.record(state, next);
      state = next.state;
      const events = frame.events.filter((event): event is CombatAnimationEvent => 'eventSeq' in event);
      for (const event of events) {
        try {
          const expected = nextExpected();
          if (!expected || canonicalContent(event) !== canonicalContent(expected)) divergent = true;
        } catch (error) {
          if (!comparisonFailed) comparisonError = error;
          comparisonFailed = true;
        }
      }
      steps++;
    }
    if (state.status === 'running' && state.tick < battle.terminal.tick) return null;
    if (canonicalContent(toCombatViewState(state)) !== canonicalContent(terminal)) throw new RangeError('replay-divergence');
    if (comparisonFailed) throw comparisonError;
    if (divergent || nextExpected() !== undefined) {
      throw new RangeError('replay-divergence');
    }
    result = recorder.finish(state);
    return result;
  } };
}

/** Synchronous compatibility wrapper over the bounded replay task. */
export function toCombatReplay(battle: CombatReplayInput): CombatReplay {
  return startCombatReplay(battle).advance(1201)!;
}

/** Display reducer: animation facts never apply damage/mana twice. Keyframes replace after events. */
export function applyCombatReplayTick(view: CombatViewState, frame: CombatReplayTick): CombatViewState {
  if (frame.keyframe) return frame.keyframe;
  let units = view.units;
  for (const event of frame.events) if (event.type === 'unitUpdated') {
    units = units.map(unit => unit.id === event.unitId ? { ...unit, ...event.changes } : unit);
  } else if (event.type === 'unitEntered' || event.type === 'unitLeft') units = applyReplayMembership(units, event);
  return freezeTransientContent({ ...view, tick: frame.tick, units });
}
