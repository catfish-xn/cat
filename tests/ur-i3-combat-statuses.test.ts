import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readUnitStatusRows } from '../src/presentation/combat-status';
import { applyCombatReplayTick, createCombatReplayRecorder, toCombatReplay, toCombatViewState,
  type CombatViewStatus, type LedgerCombatEvent } from '../src/server-entry';
import { stepCombat, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { LOOT_REPLAY_DIGEST } from '../src/simulation/loot-freeze';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import { effectIdentity } from '../src/simulation/m8/identity';
import { applyStatusContribution } from '../src/simulation/m8/status';
import type { CombatActivity, StatusApplication, StatusGroup } from '../src/simulation/m8/contracts';
import { battle, freeze, unit } from './combat-helpers';
import { modifier, source } from './fixtures/m8-contract-cases';
import currentIdentity from './v25-online-rules-content-baseline.json';

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function synthetic(): CombatState {
  let statuses: StatusGroup[] = [];
  const add = (id: string, kind: StatusApplication['kind'], ticks: number, patch: Partial<StatusApplication> = {}) => {
    const application: StatusApplication = { kind, magnitudeBps: 100, activation: 'immediate', duration: { kind: 'ticks', ticks },
      stackPolicy: { kind: 'independent-instances' }, polarity: 'harmful', removable: true, damageFilter: null, onEnd: null, ...patch };
    statuses = applyStatusContribution(statuses, effectIdentity('standalone', source(id, id, 'p'), 'e'), application, 0).groups;
  };
  add('stun', 'stun', 4, { activation: 'next-tick' });
  add('burn-weak', 'burn', 23, { magnitudeBps: 50, polarity: 'beneficial', stackPolicy: { kind: 'strongest-category', category: 'burn', retainSuppressed: true } });
  add('burn-strong', 'burn', 7, { magnitudeBps: 200, stackPolicy: { kind: 'strongest-category', category: 'burn', retainSuppressed: true } });
  add('wound-1', 'wound', 25);
  add('wound-2', 'wound', 26);
  add('buff', 'stat-buff', 24, { polarity: 'beneficial', modifier: modifier('armor', 5) });
  add('debuff', 'stat-debuff', 22, { modifier: modifier('armor', -3) });
  // Filtered contributions must remain visible even when another source is the group maximum.
  const filter = { deliveries: 'all', damageTypes: 'all', redirected: 'include' } as const;
  add('reduction-strong', 'damage-reduction', 6, { magnitudeBps: 200, polarity: 'beneficial', damageFilter: filter });
  add('reduction-weak', 'damage-reduction', 8, { magnitudeBps: 100, damageFilter: filter });
  const activity = (kind: CombatActivity['kind']): CombatActivity => ({
    ...effectIdentity('standalone', source(kind, kind, 'p'), 'p'), actionSeq: 1, startsAtTick: 0, expiresAtTick: 9,
    lifecycle: 'active', endedAtTick: null, endReason: null,
    ...(kind === 'channel' ? { kind, blocks: ['move', 'attack', 'cast'], cancelOnControl: true }
      : { kind, allyRadius: 1, shareBps: 100, choose: 'lowest-id', repeatMitigation: false, recursive: false }),
  });
  const dummy = (id: string, team: CombatUnit['team'], col: number) => unit(id, team, col, 3, {
    definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 2000, maxHp: 2000,
    attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, statuses: [], shieldLayers: [], tasks: [], runtime: { ...EMPTY_RUNTIME },
  });
  return battle([
    { ...dummy('p', 'player', 1), mechanismState: { ...EMPTY_MECHANISMS, activities: [activity('channel'), activity('redirect')] } },
    { ...dummy('e', 'enemy', 2), shield: 50, shieldExpiresAtTick: 21, shieldLayers: [{
      key: 'shield', source: source('shield', 'shield', 'e'), remaining: 50, granted: 50, absorbed: 0, expiresAtTick: 21,
    }], mechanismState: { ...EMPTY_MECHANISMS, statuses } },
  ], { strategy: { traits: [], units: [] }, startEffectsApplied: true,
    combatId: 'standalone', nextEventSeq: 0, rngState: 42, rngDraws: 0, maxTicks: 45 });
}
function run(initial: CombatState, capture = false) {
  const all = [initial], ledger: LedgerCombatEvent[] = [];
  const recorder = capture ? createCombatReplayRecorder(initial, []) : undefined;
  let state = initial;
  while (state.status === 'running') {
    const next = stepCombat(state); recorder?.record(state, next);
    state = next.state; all.push(state); ledger.push(...toLedgerEvents(next.events));
  }
  return { all, ledger, terminal: state, replay: recorder?.finish(state) };
}
const order = ['burn', 'channel', 'control-immunity', 'damage-prevention', 'damage-reduction', 'redirect',
  'shred', 'stat-buff', 'stat-debuff', 'stun', 'sunder', 'untargetable', 'wound'];
function expectedRows(state: CombatState, unitId: string): CombatViewStatus[] {
  const rows = readUnitStatusRows(state, unitId).filter(row => row.state === 'effective' || row.state === 'active');
  return order.flatMap(kind => [false, true].flatMap(harmful =>
    rows.some(row => row.kind === kind && row.harmful === harmful) ? [{ kind: kind as CombatViewStatus['kind'], harmful }] : []));
}

describe('UR-I3-01 current combat status kinds', () => {
  it('preserves the pre-view-change battle, ledger and RNG and binds the current epoch identity', () => {
    const initial = freeze(synthetic()), before = JSON.stringify(initial);
    const control = run(initial), observed = run(initial, true);
    // Captured on HEAD 58dd202 before changing combat-replay-view.ts; these are
    // authoritative state/ledger hashes, not view goldens to re-record for v15.
    // Release identity separately follows the freshly recorded current epoch.
    expect(sha(control.terminal)).toBe('432c237bd3225a4b75ac5436bb370194689cab64f4be002007bbd703b65afdd9');
    expect(sha(control.ledger)).toBe('c5762f92e94df75176eab0b23de25dcd5636f0f80f9d5da1d41ffae794d4583d');
    expect(CONTENT_DIGEST).toBe(currentIdentity.contentDigest);
    expect(LOOT_REPLAY_DIGEST).toBe(currentIdentity.lootReplayDigest);
    expect(observed.all).toEqual(control.all); expect(observed.ledger).toEqual(control.ledger);
    expect(observed.terminal).toMatchObject({ tick: 45, result: 'draw', rngState: 42, rngDraws: 0 });
    expect(toCombatReplay({ initial, terminal: control.terminal, events: control.ledger })).toEqual(observed.replay);
    expect(JSON.stringify(initial)).toBe(before);
  });

  it('matches single-player rows each tick and sends changes, including final empty arrays', () => {
    const { all, replay } = run(freeze(synthetic()), true);
    let view = replay!.initial;
    for (const frame of replay!.ticks) {
      const prior = view;
      view = applyCombatReplayTick(view, frame);
      expect(view).toEqual(toCombatViewState(all[frame.tick]));
      for (const unit of view.units) {
        expect(unit.statuses).toEqual(expectedRows(all[frame.tick], unit.id));
        const update = frame.events.find(event => event.type === 'unitUpdated' && event.unitId === unit.id);
        const changed = JSON.stringify(prior.units.find(u => u.id === unit.id)!.statuses) !== JSON.stringify(unit.statuses);
        if (changed) {
          expect(update?.type === 'unitUpdated' && update.changes.statuses).toEqual(unit.statuses);
        } else if (update?.type === 'unitUpdated') expect(update.changes).not.toHaveProperty('statuses');
      }
    }
    const ticksWith = (unitId: string, kind: CombatViewStatus['kind'], harmful: boolean) => all.flatMap(state =>
      toCombatViewState(state).units.find(u => u.id === unitId)!.statuses!.some(s => s.kind === kind && s.harmful === harmful) ? [state.tick] : []);
    const ticks = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
    expect(ticksWith('e', 'stun', true)).toEqual(ticks(1, 4));
    expect(ticksWith('e', 'burn', true)).toEqual(ticks(0, 6));
    expect(ticksWith('e', 'burn', false)).toEqual(ticks(7, 22));
    expect(ticksWith('e', 'wound', true)).toEqual(ticks(0, 25));
    expect(ticksWith('e', 'stat-buff', false)).toEqual(ticks(0, 23));
    expect(ticksWith('e', 'stat-debuff', true)).toEqual(ticks(0, 21));
    expect(ticksWith('p', 'channel', false)).toEqual(ticks(0, 8));
    expect(ticksWith('p', 'redirect', false)).toEqual(ticks(0, 8));
    expect(toCombatViewState(all[20]).units.find(u => u.id === 'e')!.shield).toBe(40); // first burn pulse absorbed 10
    expect(toCombatViewState(all[21]).units.find(u => u.id === 'e')!.shield).toBe(0);
    expect(view.units.every(unit => unit.statuses?.length === 0)).toBe(true);
  });

  it('rebuilds reconnect snapshots from each keyframe and only subsequent unitUpdated events', () => {
    const { all, replay } = run(freeze(synthetic()), true);
    const anchors = replay!.ticks.flatMap(frame => frame.keyframe ? [frame.keyframe] : []);
    // Tick 1 also carries the engine's authoritative unit order; later diffs preserve it.
    expect(anchors.map(anchor => anchor.tick)).toEqual([1, 20, 40, 45]);
    for (const anchor of anchors) {
      let view = JSON.parse(JSON.stringify(anchor)) as typeof anchor;
      for (const frame of replay!.ticks.filter(frame => frame.tick > anchor.tick)) {
        view = applyCombatReplayTick(view, { tick: frame.tick, events: JSON.parse(JSON.stringify(frame.events)) });
        expect(view.units.map(unit => unit.statuses)).toEqual(toCombatViewState(all[frame.tick]).units.map(unit => unit.statuses));
      }
    }
  });

  it('deduplicates kind/polarity, excludes pending/suppressed rows and keeps filtered sources', () => {
    const initial = synthetic(), target = initial.units[1];
    const rows = readUnitStatusRows(initial, 'e');
    expect(rows.filter(row => row.kind === 'wound')).toHaveLength(2);
    expect(rows.find(row => row.kind === 'stun')?.state).toBe('pending');
    expect(rows.find(row => row.kind === 'burn' && !row.harmful)?.state).toBe('suppressed');
    const statuses = toCombatViewState(initial).units[1].statuses!;
    expect(statuses.filter(status => status.kind === 'wound')).toEqual([{ kind: 'wound', harmful: true }]);
    expect(statuses).not.toContainEqual({ kind: 'stun', harmful: true });
    expect(statuses).not.toContainEqual({ kind: 'burn', harmful: false });
    const groups = target.mechanismState!.statuses.map(group => ({ ...group,
      contributions: [...group.contributions].reverse().map(contribution => group.kind !== 'damage-reduction' ? contribution : {
        ...contribution, application: { ...contribution.application,
          stackPolicy: { kind: 'strongest-category', category: 'damage-reduction', retainSuppressed: true } as const },
      }),
    })).reverse();
    const reordered = { ...initial, units: [initial.units[0], { ...target, mechanismState: { ...target.mechanismState!, statuses: groups } }] };
    expect(toCombatViewState(reordered).units[1].statuses).toEqual(statuses);
    expect(statuses.filter(status => status.kind === 'damage-reduction')).toEqual([
      { kind: 'damage-reduction', harmful: false }, { kind: 'damage-reduction', harmful: true },
    ]);
    expect(Object.isFrozen(toCombatViewState(initial).units[1].statuses)).toBe(true);
    expect(Object.isFrozen(toCombatViewState(initial).units[1].statuses![0])).toBe(true);
  });

  it('preserves the single-player legacy mapping and ignores ended/foreign activities', () => {
    const initial = synthetic(), owner = initial.units[0], legacySource = source('legacy', 'legacy', 'p');
    const legacy = { ...owner, mechanismState: undefined, statuses: [
      { key: 'legacy-stun', kind: 'stun', source: legacySource, amount: 0, startsAtTick: 0, expiresAtTick: 5 },
      { key: 'legacy-channel', kind: 'channel', source: legacySource, amount: 0, startsAtTick: 0, expiresAtTick: 5 },
    ] as const };
    const state = { ...initial, units: [legacy] };
    expect(toCombatViewState(state).units[0].statuses).toEqual(expectedRows(state, 'p'));
    expect(toCombatViewState(state).units[0].statuses).toEqual([
      { kind: 'channel', harmful: false }, { kind: 'stat-buff', harmful: false },
    ]);
    const ended = { ...owner, mechanismState: { ...owner.mechanismState!, activities: owner.mechanismState!.activities.map(a =>
      a.kind === 'channel' ? { ...a, lifecycle: 'ended' as const, endedAtTick: 0, endReason: 'expired' as const } : { ...a, targetId: 'other' }) } };
    expect(toCombatViewState({ ...initial, units: [ended] }).units[0].statuses).toEqual([]);
  });

  it('carries complete statuses on unitEntered after a unitLeft', () => {
    const initial = synthetic(), next = stepCombat(initial), recorder = createCombatReplayRecorder(initial, []);
    const returning = next.state.units[0];
    const entered = { ...next.state, units: [...next.state.units.slice(1), returning] };
    // Remove one unit, then re-enter it with the full current status view (no special whitelist).
    const first = recorder.record(initial, { ...next, state: { ...next.state, units: next.state.units.slice(1) } });
    const reenteredState = { ...entered, tick: 2 };
    const second = recorder.record({ ...next.state, units: next.state.units.slice(1) }, { state: reenteredState, events: [] });
    const event = second.events.find(event => event.type === 'unitEntered');
    expect(event?.type === 'unitEntered' && event.unit.statuses).toEqual(toCombatViewState(reenteredState).units[1].statuses);
    expect(applyCombatReplayTick(applyCombatReplayTick(toCombatViewState(initial), first), second).units)
      .toEqual(toCombatViewState(reenteredState).units);
  });
});
