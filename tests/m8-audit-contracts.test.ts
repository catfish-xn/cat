import { describe, expect, it } from 'vitest';
import type { ActionTask, DamageFilter, DamageRequest, Effect, EffectRuntime, HealOutcome, M8CombatEvent, PeriodicTask, ShieldState, StatusContribution, StatusEndReason, StatModifier, TriggerContext } from '../src/simulation/m8/contracts';
import type { LegacyExportRequest, LegacyExportResult, LegacyRecord, LegacyRecordAccess } from '../src/simulation/m8/ui-contracts';
import { shiv, titan, nashor } from './fixtures/m8-audit-definitions';
import { amount, cast, context, key, modifier, selector, source, trigger } from './fixtures/m8-contract-cases';
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const stamp = { domain: 'combat', combatId: 'c1', tick: 10, eventSeq: 1 } as const;

describe('B2 audit A01–A13: declarative examples and independent hand oracles, no battle executor', () => {
  it('A01 keeps two sentinel and two sorcerer sources distinct, including owner and application', () => {
    const sentinel = { ...source('sentinel-2', 'player:2'), sourceKind: 'trait' as const };
    const sorcerer = { ...sentinel, definitionId: 'sorcerer-2' };
    const keys = [key(sentinel), key(sorcerer), key({ ...sentinel, ownerId: 'u2' }), key(sentinel, 'u1', 'cast-2')];
    expect(new Set(keys).size).toBe(4);
    expect(roundTrip(keys)).toEqual(keys);
    expect(JSON.parse(keys[0])).toEqual(['c1', 'u1', 'trait', 'sentinel-2', 'player:2', 0, null, 'u1', 'source']);
  });
  it('A02 carries 150→100 kill→50 physical overflow into the next tick without mitigation twice', () => {
    const request: DamageRequest = { context: context({ targetId: 'B', parentPacketId: 'p1', packetId: 'bounce', critEligibility: 'never' }), input: { stage: 'after-mitigation', amount: 50, inherited: { parentPacketId: 'p1', resolvedAtTick: 10, portion: 'overkill', critical: false } } };
    const task: ActionTask = { key: 'bounce-c1-1', source: request.context.source, actionSeq: 1, ordinal: 0, committedAtTick: 10, executeAtTick: 11, replaceGroup: null, consumed: false, onSourceDeath: 'persist', onControl: 'continue', targeting: { kind: 'fixed', targetIds: ['B'], ifMissing: 'skip' }, payload: { kind: 'damage-request', request, mayCreateOverkill: false } };
    expect(150 - 100).toBe(request.input.amount);
    expect(roundTrip(task)).toEqual(task);
    // B has 100 armor, shield20, HP100. The inherited 50 bypasses armor; 20+30=50.
    const expected = { tick: 11, physical: 50, shield: 20, hpDamage: 30, hpAfter: 70, critDraws: 0, newBounce: false };
    expect(expected.shield + expected.hpDamage).toBe(50);
    expect(task.executeAtTick).toBe(task.committedAtTick + 1);
    expect(task.targeting).toEqual({ kind: 'fixed', targetIds: ['B'], ifMissing: 'skip' });
    // Existing Loris redirect still applies once: inherited475 splits238/237.
    expect([475 - Math.floor(475 / 2), Math.floor(475 / 2)]).toEqual([238, 237]);
    // @ts-expect-error Inherited damage requires a parent receipt, not a naked amount.
    const invalid: DamageRequest['input'] = { stage: 'after-mitigation', amount: 50 };
    void invalid;
  });
  it('A03 separates 600/60 linear decay from absorption and restores its phase', () => {
    const initial: ShieldState = { key: key(source('irelia')), source: source('irelia'), targetId: 'u1', granted: 600, remaining: 600, absorbed: 0, decayed: 0, expiredDiscarded: 0, decay: { kind: 'linear-initial-grant', basisGranted: 600, grantedAtTick: 0, durationTicks: 60, lastDecayAtTick: 0 }, startsAtTick: 0, expiresAtTick: 60, endRewardConsumed: false };
    const noHit = { ...initial, remaining: 500, decayed: 100, decay: { ...initial.decay, kind: 'linear-initial-grant' as const, basisGranted: 600, grantedAtTick: 0, durationTicks: 60, lastDecayAtTick: 10 } };
    const afterHit: ShieldState = { ...noHit, remaining: 380, absorbed: 120 };
    const restored = roundTrip(afterHit);
    const next: ShieldState = { ...restored, remaining: 370, decayed: 110, decay: { ...noHit.decay, lastDecayAtTick: 11 } };
    const event: M8CombatEvent = { ...stamp, tick: 11, type: 'shieldLayerChanged', layer: next, reason: 'decayed' };
    expect([noHit.remaining, noHit.absorbed, next.remaining, next.absorbed]).toEqual([500, 0, 370, 120]);
    expect(next.remaining + next.absorbed + next.decayed + next.expiredDiscarded).toBe(600);
    expect(event.reason).toBe('decayed');
    expect(Math.floor(120 * 3000 / 10000)).toBe(36); // bonus uses absorbed120, not total lost230
  });
  it('A04 declares Shiv every3 and Titan capped25 with one recoverable reward', () => {
    if (shiv.gate.kind !== 'every-n') throw Error('Wrong fixture');
    const gate = shiv.gate;
    expect([1, 2, 3, 4, 5, 6].filter(n => n >= gate.firstAt && (n - gate.firstAt) % gate.everyN === 0)).toEqual([3, 6]);
    const runtime: EffectRuntime = { key: key(titan.source), source: titan.source, targetId: 'u1', startsAtTick: 0, expiresAtTick: null, stacks: 25, triggerCount: 1, counters: { stacks: 25 }, consumedRewards: ['cap-resists'], nextEligibleTick: 0, consumed: false, stackPolicy: { kind: 'add-stacks', cap: 25 } };
    expect([{ incomingEvent: 24, stacks: 24, reward: 0 }, { incomingEvent: 25, stacks: 25, reward: 20 }, { incomingEvent: 26, stacks: 25, reward: 0 }].map(x => x.reward)).toEqual([0, 20, 0]);
    expect(roundTrip(runtime).consumedRewards).toEqual(['cap-resists']);
    const stackedStats = [modifier('attackDamage', 0, { unit: 'bps', value: { kind: 'counter', counterId: 'stacks', perCount: 200 } }), modifier('abilityPower', 0, { value: { kind: 'counter', counterId: 'stacks', perCount: 2 } })];
    expect(stackedStats.map(x => x.value.kind)).toEqual(['counter', 'counter']);
    expect([24, 25, 25].map(n => [n * 200, n * 2])).toEqual([[4800, 48], [5000, 50], [5000, 50]]);
    expect(titan.gate).toMatchObject({ kind: 'stack-threshold-once', at: 25 });
  });
  it('A05 binds Ionic to casting B, never closer noncasting A; Nashor listens to holder', () => {
    const receipt = cast({ source: { ...source('spell', 'B-cast', 'B'), sourceKind: 'ability' }, completionCell: { col: 3, row: 2 } });
    const event: TriggerContext = { eventSeq: 7, event: 'cast-completed', tick: 10, actionSeq: 1, actorId: 'B', targetId: 'u1', cast: receipt };
    const ionic = trigger({ id: 'ionic', event: 'cast-completed', listener: { subject: 'actor', relationToHolder: 'enemy', withinHexes: 2 }, selector: selector({ primary: 'normal', candidates: 'event-actor', relation: 'enemy' }), effects: [{ kind: 'damage', damageType: 'magic', delivery: 'equipment-proc', amount: amount(0, { actualManaSpentBps: 16000 }), critEligibility: 'never' }] });
    expect([ionic.selector.candidates, event.actorId, receipt.actualManaSpent * 16000 / 10000]).toEqual(['event-actor', 'B', 128]);
    expect(nashor.listener.relationToHolder).toBe('self');
    expect(roundTrip(event).cast?.targetIds).toEqual(['A']);
    // Hand oracle: holder(3,4), noncaster A(3,3) distance1, caster B(3,2) distance2.
    expect(ionic.listener.withinHexes).toBe(2);
  });
  it('A06 binds delayed night-edge AS to exactly one natural status end', () => {
    const buff: Effect = { kind: 'modify-stat', stackPolicy: { kind: 'independent-instances' }, activation: 'immediate', modifier: modifier('attackSpeed', 1500, { unit: 'bps' }), duration: { kind: 'combat' } };
    const status: StatusContribution = { key: key(source('night-edge')), source: source('night-edge'), targetId: 'u1', appliedAtTick: 10, expiresAtTick: 30, endRewardConsumed: false, application: { activation: 'immediate', kind: 'damage-prevention', magnitudeBps: 10000, duration: { kind: 'ticks', ticks: 20 }, stackPolicy: { kind: 'independent-instances' }, removable: false, polarity: 'beneficial', damageFilter: null, onEnd: { reasons: ['expired'], timing: 'expiry-before-actions', effects: [buff] } } };
    expect(status.application.onEnd?.reasons).toEqual(['expired']);
    expect([{ tick: 10, as: 0 }, { tick: 29, as: 0 }, { tick: 30, as: 1500 }].map(x => x.as)).toEqual([0, 0, 1500]);
    const paid = roundTrip({ ...status, endRewardConsumed: true });
    expect(paid.endRewardConsumed).toBe(true);
    expect(status.application.onEnd?.reasons).not.toContain('death-cleanup');
    expect(status.application.onEnd?.reasons).not.toContain('combat-end');
    const exits: readonly { tick: number; reason: StatusEndReason; reward: number }[] = [{ tick: 30, reason: 'expired', reward: 1500 }, { tick: 20, reason: 'death-cleanup', reward: 0 }, { tick: 20, reason: 'combat-end', reward: 0 }];
    expect(roundTrip(exits).map(x => x.reward)).toEqual([1500, 0, 0]);
  });
  it('A07 samples Redemption each pulse and keeps heal+reduction on one target set', () => {
    const task: PeriodicTask = { key: key(source('redemption')), source: source('redemption'), targetId: 'u1', nextPulseAtTick: 100, periodTicks: 100, endsAtTick: null, pulseOrdinal: 0, pulseLimit: null, remainders: [], finalPulse: 'none', onSourceDeath: 'cancel', onTargetDeath: 'cancel', program: { definitionId: 'redemption-pulse', targetSnapshot: 'once-per-pulse', selector: selector({ relation: 'ally', radius: 1, maxTargets: 100, sample: 'each-pulse' }), effects: [{ kind: 'heal', amount: amount(0, { missingHpBps: 1500, cap: 1000, hpBasis: 'target', sample: 'each-pulse' }) }, { kind: 'apply-status', status: { activation: 'next-tick', kind: 'damage-reduction', magnitudeBps: 1000, duration: { kind: 'ticks', ticks: 100 }, stackPolicy: { kind: 'strongest-category', category: 'damage-reduction', retainSuppressed: true }, removable: false, polarity: 'beneficial', damageFilter: { deliveries: 'all', damageTypes: ['physical', 'magic'], redirected: 'exclude' }, onEnd: null } }] } };
    const snapshots = [{ tick: 100, selected: ['u1', 'B'] }, { tick: 200, selected: ['u1', 'C'] }]; // B exits; C enters
    expect(roundTrip(task).program.effects.map(x => x.kind)).toEqual(['heal', 'apply-status']);
    expect(snapshots.map(x => x.selected)).toEqual([['u1', 'B'], ['u1', 'C']]);
    expect(task.onSourceDeath).toBe('cancel'); // death150: no pulse200; B's status101..201 remains
    expect([101, 201]).toEqual([100 + 1, 100 + 1 + 100]);
    const applied = task.program.effects[1];
    if (applied.kind !== 'apply-status') throw Error('Wrong fixture');
    const surviving: StatusContribution = { key: key(task.source, 'B'), source: task.source, targetId: 'B', application: applied.status, appliedAtTick: 101, expiresAtTick: 201, endRewardConsumed: false };
    const afterSourceDeath = roundTrip({ tick: 150, periodicTasks: [] as PeriodicTask[], statuses: [surviving] });
    expect(afterSourceDeath.periodicTasks).toEqual([]);
    expect(afterSourceDeath.statuses[0].expiresAtTick).toBe(201);
  });
  it('A08 restricts 800Bps reduction to basic attacks before strongest-source selection', () => {
    const filter: DamageFilter = { deliveries: ['basic-attack'], damageTypes: ['physical', 'magic'], redirected: 'exclude' };
    const reduction = modifier('damageReduction', 800, { unit: 'bps', damageFilter: filter });
    expect(reduction.damageFilter?.deliveries).toEqual(['basic-attack']);
    expect(Math.floor(100 * 9200 / 10000)).toBe(92);
    expect([{ delivery: 'basic-attack', incoming: 100, result: 92 }, { delivery: 'equipment-proc', incoming: 35, result: 35 }].map(x => x.result)).toEqual([92, 35]);
  });
  it('A09 scales current Gargoyle count3→2→0; independent copies both retract', () => {
    const dynamic: StatModifier = modifier('armor', 0, { value: { kind: 'unit-count', perUnit: 10, population: 'alive-enemies-targeting-holder', sample: 'current', distinctBy: 'unitId' } });
    const copies = ['i1', 'i2'].map(id => ({ source: source('gargoyle', id), modifiers: [dynamic, { ...dynamic, stat: 'magicResist' as const }] }));
    expect([3, 2, 0].map(count => 25 + count * 10)).toEqual([55, 45, 25]);
    expect([3, 2, 0].map(count => 2 * (25 + count * 10))).toEqual([110, 90, 50]);
    expect(roundTrip(copies)).toEqual(copies);
    expect(copies[0].source.instanceId).not.toBe(copies[1].source.instanceId);
  });
  it('A10 conserves one merged heal35, HP20 and overheal15 across two equipment sources', () => {
    const bt = source('bloodthirster', 'i1'), gun = source('gunblade', 'i2');
    const heal: HealOutcome = { healId: 'h1', targetId: 'u1', requested: 35, kind: 'omnivamp', fromPacketId: 'p1', contributions: [{ source: bt, numerator: 200000, denominator: 10000 }, { source: gun, numerator: 150000, denominator: 10000 }], afterWound: 35, actual: 20, overheal: 15, preventedByWound: 0, shares: [{ source: bt, requested: 20, afterWound: 20, actual: 11, overheal: 9, preventedByWound: 0 }, { source: gun, requested: 15, afterWound: 15, actual: 9, overheal: 6, preventedByWound: 0 }] };
    for (const field of ['requested', 'afterWound', 'actual', 'overheal', 'preventedByWound'] as const) expect(heal.shares.reduce((n, x) => n + x[field], 0)).toBe(heal[field]);
    expect(roundTrip(heal)).toEqual(heal);
    // 33% wound:35→23; shares20/15→13/10; missing20 gives11/9, overheal2/1.
    expect(Math.floor(35 * 6700 / 10000)).toBe(23);
    const wounded: HealOutcome = { ...heal, healId: 'h2', afterWound: 23, overheal: 3, preventedByWound: 12, shares: [{ ...heal.shares[0], afterWound: 13, actual: 11, overheal: 2, preventedByWound: 7 }, { ...heal.shares[1], afterWound: 10, actual: 9, overheal: 1, preventedByWound: 5 }] };
    for (const field of ['requested', 'afterWound', 'actual', 'overheal', 'preventedByWound'] as const) expect(roundTrip(wounded).shares.reduce((n, x) => n + x[field], 0)).toBe(wounded[field]);
  });
  it('A11 preserves cast target A while Maddie projectile actually hits blocker B', () => {
    const receipt = cast({ targetIds: ['A'], targetsSampledAtTick: 10 });
    const castEvent: M8CombatEvent = { ...stamp, type: 'cast', receipt };
    const hit: DamageRequest = { context: context({ targetId: 'B' }), input: { stage: 'raw', amount: amount(100) } };
    expect(roundTrip(castEvent).receipt.targetIds).toEqual(['A']);
    expect(hit.context.targetId).toBe('B');
    expect(receipt.targetsSampledAtTick).toBe(10);
  });
  it('A12 emits Kog third-cast range3→4 in hexes, not an inferred UI counter', () => {
    const event: M8CombatEvent = { ...stamp, type: 'statChanged', source: { ...source('kogmaw-ability'), sourceKind: 'ability' }, unitId: 'u1', stat: 'range', before: 3, after: 4 };
    const value = modifier('range', 1, { unit: 'hexes' });
    expect(roundTrip(event)).toMatchObject({ stat: 'range', before: 3, after: 4 });
    expect(value.unit).toBe('hexes');
  });
  it('A13 selects a particular legacy history record while an M8 session is active', async () => {
    const record: LegacyRecord = { recordRef: { namespace: 'hex-autobattler-m6', runId: 'old-run', fingerprint: 'old-content' }, location: 'history', activeSlotRevision: null, createdAt: '2026-10-07T00:00:00Z', rulesVersion: 'm5-14.24b-v1', schemaVersion: 5, saveFormatVersion: 1, replayFormatVersion: 1, canExportOriginal: true, reason: null };
    const request: LegacyExportRequest = { requestId: 'export-1', recordRef: record.recordRef };
    const failed: LegacyExportResult = { ...request, ok: false, reason: 'stale-reference' };
    // Signature-only UI wiring fixture, not a persistence implementation.
    const calls: LegacyExportRequest[] = [];
    const access: LegacyRecordAccess = { listLegacyRecords: async () => ({ ok: true, records: [record] }), exportLegacy: async r => { calls.push(r); return failed; } };
    const active = { runId: 'new-m8', revision: 9 };
    expect(await access.listLegacyRecords()).toEqual({ ok: true, records: [record] });
    expect(await access.exportLegacy(request)).toEqual(failed);
    expect(calls[0].recordRef.runId).toBe('old-run');
    expect(active).toEqual({ runId: 'new-m8', revision: 9 });
    const ok: LegacyExportResult = { ...request, ok: true, fileName: 'old-run.json', mediaType: 'application/json', bytes: new TextEncoder().encode('{"saveFormatVersion":1}') };
    expect(new TextDecoder().decode(ok.bytes)).toBe('{"saveFormatVersion":1}');
  });
});
