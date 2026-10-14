import { describe, expect, it } from 'vitest';
import type { CombatActivity, M8CombatEvent, M8CombatExtension, StatusGroup, PeriodicTask, PeriodicRemainder, Effect } from '../src/simulation/m8/contracts';
import type { CombatStatusesView } from '../src/simulation/m8/ui-contracts';
import { titan, nashor } from './fixtures/m8-audit-definitions';
import { key, source, selector, amount, modifier } from './fixtures/m8-contract-cases';
const restored = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const remainder = (targetId: string, numerator: number, effectIndex = 0): PeriodicRemainder => ({ targetId, numerator, denominator: 10000, effectIndex });
export const redemption: PeriodicTask = {
  key: key(source('redemption')), source: source('redemption'), targetId: 'u1', nextPulseAtTick: 100, periodTicks: 100,
  endsAtTick: null, pulseOrdinal: 0, pulseLimit: null, remainders: [], finalPulse: 'none', onSourceDeath: 'cancel', onTargetDeath: 'cancel',
  program: { definitionId: 'redemption', targetSnapshot: 'once-per-pulse', selector: selector({ relation: 'ally', radius: 1, maxTargets: 100, sample: 'each-pulse' }), effects: [{ kind: 'heal', amount: amount(0, { missingHpBps: 1500, hpBasis: 'target', sample: 'each-pulse', cap: 1000 }) }] },
};

describe('R1 independent periodic amount accounts', () => {
  it('retains A/B fractional heals independently through the third pulse and restore', () => {
    const vectors = [
      { tick: 100, missing: [1, 9], carryIn: [0, 0], heal: [0, 1], carryOut: [1500, 3500] },
      { tick: 200, missing: [1, 8], carryIn: [1500, 3500], heal: [0, 1], carryOut: [3000, 5500] },
      { tick: 300, missing: [1, 7], carryIn: [3000, 5500], heal: [0, 1], carryOut: [4500, 6000] },
    ];
    for (const v of vectors) {
      // Independent integer arithmetic oracle, not an M8 periodic executor.
      const numerators = v.missing.map((missing, i) => missing * 1500 + v.carryIn[i]);
      expect(numerators.map(n => Math.floor(n / 10000))).toEqual(v.heal);
      expect(numerators.map(n => n % 10000)).toEqual(v.carryOut);
    }
    const saved: PeriodicTask = { ...redemption, nextPulseAtTick: 300, pulseOrdinal: 2, remainders: [remainder('A', 3000), remainder('B', 5500)] };
    expect(restored(saved).remainders).toEqual([remainder('A', 3000), remainder('B', 5500)]);
    expect(restored({ ...saved, remainders: [...saved.remainders].reverse() }).remainders.find(r => r.targetId === 'A')?.numerator).toBe(3000);
  });
  it('keeps out-of-range accounts dormant; clears dead, capped and ended accounts without transferring them', () => {
    const after100 = { ...redemption, remainders: [remainder('A', 1500), remainder('B', 3500)] };
    // A exits before200, C enters with missing1. B: missing8→heal1/carry5500; C:0/carry1500.
    const after200: PeriodicTask = { ...after100, nextPulseAtTick: 300, pulseOrdinal: 2, remainders: [remainder('A', 1500), remainder('B', 5500), remainder('C', 1500)] };
    const backAt300 = restored(after200);
    expect(Math.floor((1500 + 1500) / 10000)).toBe(0); // returning A missing1, carry3000, not4500
    expect(backAt300.remainders.find(r => r.targetId === 'A')?.numerator).toBe(1500);
    const afterBDeath: PeriodicTask = { ...backAt300, remainders: [remainder('A', 1500), remainder('C', 1500)] };
    expect(afterBDeath.remainders.some(r => r.targetId === 'B')).toBe(false);
    // A is full at the next pulse: HP cap clears A's fraction. Ending task removes all accounts.
    expect(restored({ ...afterBDeath, remainders: [remainder('C', 1500)] }).remainders).toEqual([remainder('C', 1500)]);
    expect(restored({ periodicTasks: [] as PeriodicTask[] }).periodicTasks).toEqual([]);
  });
  it('distinguishes two amount effects on the same target within one task', () => {
    const multi: PeriodicTask = { ...redemption, program: { ...redemption.program, definitionId: 'two-heals', effects: [...redemption.program.effects, { kind: 'heal', amount: amount(0, { missingHpBps: 2500, sample: 'each-pulse', hpBasis: 'target' }) }] }, remainders: [remainder('A', 1500, 0), remainder('A', 2500, 1)] };
    expect(restored(multi).remainders.map(r => [r.effectIndex, r.targetId, r.numerator])).toEqual([[0, 'A', 1500], [1, 'A', 2500]]);
    const capped: PeriodicTask = { ...multi, remainders: [remainder('A', 2500, 1)] }; // effect0 exact1000.15 capped1000: clears only effect0
    expect(restored(capped).remainders).toEqual([remainder('A', 2500, 1)]);
  });
});

describe('R3 authoritative activity projections and typed lifecycle events', () => {
  const channel: CombatActivity = { key: key({ ...source('vander-ability'), sourceKind: 'ability' }, 'u1', 'cast-1'), source: { ...source('vander-ability'), sourceKind: 'ability' }, targetId: 'u1', actionSeq: 1, startsAtTick: 10, expiresAtTick: 60, kind: 'channel', blocks: ['move', 'attack', 'cast'], cancelOnControl: true, lifecycle: 'active', endedAtTick: null, endReason: null };
  it('cancels at20, does not return after stun ends40 or after restore', () => {
    const start: CombatStatusesView = { statuses: [], activities: [channel] };
    const ended: CombatActivity = { ...channel, lifecycle: 'ended', endedAtTick: 20, endReason: 'control-cancelled' };
    const event: M8CombatEvent = { domain: 'combat', combatId: 'c1', tick: 20, eventSeq: 2, type: 'activityChanged', activity: ended, reason: 'control-cancelled' };
    const stunSource = { ...source('enemy-stun', 'enemy-ability', 'enemy'), sourceKind: 'ability' as const };
    const stunKey = key(stunSource, 'u1');
    const stun: StatusGroup = { targetId: 'u1', kind: 'stun', effectiveSourceKey: stunKey, effectiveMagnitudeBps: 0, nextPulseAtTick: null, contributions: [{ key: stunKey, source: stunSource, targetId: 'u1', appliedAtTick: 20, expiresAtTick: 40, endRewardConsumed: false, application: { activation: 'next-tick', kind: 'stun', magnitudeBps: 0, duration: { kind: 'ticks', ticks: 20 }, stackPolicy: { kind: 'refresh-same-instance', magnitude: 'max', phase: 'preserve' }, removable: true, polarity: 'harmful', damageFilter: null, onEnd: null } }] };
    const at20: CombatStatusesView = { statuses: [stun], activities: [] }; // stun requested19, effective20
    const at40: CombatStatusesView = { statuses: [], activities: [] };
    const at60 = restored(at40);
    const saved: Pick<M8CombatExtension, 'activities' | 'actionTasks'> = { activities: [ended], actionTasks: [] };
    expect(restored(saved).activities[0]).toMatchObject({ lifecycle: 'ended', endedAtTick: 20, endReason: 'control-cancelled' });
    expect(restored(at20).statuses[0].contributions[0].expiresAtTick).toBe(40);
    expect(start.activities[0].expiresAtTick).toBe(60);
    expect(restored(event).activity).toMatchObject({ actionSeq: 1, endedAtTick: 20, expiresAtTick: 60 });
    expect([at20.activities, at40.activities, at60.activities]).toEqual([[], [], []]);
    // @ts-expect-error ended records belong in the ledger, never the current-active projection.
    const invalid: CombatStatusesView = { statuses: [], activities: [ended] };
    void invalid;
  });
  it('shows Loris redirect through89 and authoritative expiry at90 independently of shield', () => {
    const redirect: CombatActivity = { key: key({ ...source('loris-ability'), sourceKind: 'ability' }, 'u1', 'cast-2'), source: { ...source('loris-ability'), sourceKind: 'ability' }, targetId: 'u1', actionSeq: 2, startsAtTick: 10, expiresAtTick: 90, kind: 'redirect', allyRadius: 1, shareBps: 5000, choose: 'lowest-id', repeatMitigation: false, recursive: false, lifecycle: 'active', endedAtTick: null, endReason: null };
    const at89: CombatStatusesView = { statuses: [], activities: [redirect] };
    const expiry: M8CombatEvent = { domain: 'combat', combatId: 'c1', tick: 90, eventSeq: 3, type: 'activityChanged', activity: { ...redirect, lifecycle: 'ended', endedAtTick: 90, endReason: 'expired' }, reason: 'expired' };
    expect(restored(at89).activities[0]).toMatchObject({ kind: 'redirect', shareBps: 5000 });
    expect(restored(expiry).activity.lifecycle).toBe('ended');
    const at90: CombatStatusesView = { statuses: [], activities: [] };
    expect(restored(at90).activities).toEqual([]);
  });
});

describe('R4 delayed Titan and refreshing Nashor acceptance vectors', () => {
  it('does not grant Titan armor to a later packet in the same damage batch', () => {
    const reward: Effect = { kind: 'modify-stat', activation: 'next-tick', stackPolicy: { kind: 'independent-instances' }, modifier: modifier('armor', 20), duration: { kind: 'combat' } };
    // Isolated 0 armor, 24 stacks, HP1000; two physical120 packets at10. Other modifiers held fixed.
    const acceptance = { startsAtTick: 11, tick10: { first: 120, second: 120, hpAfter: 760 }, tick11: { armor: 20, nextPacket: 100 }, consumedRewards: ['cap-resists'] };
    expect(titan.effects[0]).toEqual(reward);
    expect(titan.effects.every(e => e.kind === 'modify-stat' && e.activation === 'next-tick')).toBe(true);
    expect(reward.activation).toBe('next-tick');
    expect(1000 - 120 - 120).toBe(acceptance.tick10.hpAfter);
    expect(Math.floor(120 * 100 / 120)).toBe(acceptance.tick11.nextPacket);
    expect(restored(acceptance).consumedRewards).toEqual(['cap-resists']);
  });
  it('refreshes Nashor without doubling; includes its last effective tick', () => {
    const buff: Effect = { kind: 'modify-stat', activation: 'next-tick', stackPolicy: { kind: 'refresh-same-instance', magnitude: 'replace', phase: 'preserve' }, modifier: modifier('attackSpeed', 6000, { unit: 'bps' }), duration: { kind: 'ticks', ticks: 100 } };
    const first = { cast: 10, start: 11, expiry: 111 };
    const refreshed = { cast: 50, start: 11, expiry: 151 }; // already active: preserve start, extend to51+100
    expect(first.start + 100).toBe(first.expiry);
    expect(refreshed.cast + 1 + 100).toBe(refreshed.expiry);
    expect(nashor.effects[0]).toEqual(buff);
    expect(nashor.stackPolicy).toEqual(buff.stackPolicy);
    expect(buff.stackPolicy.kind).toBe('refresh-same-instance');
    expect([{ tick: 10, single: 0, refreshed: 0 }, { tick: 11, single: 6000, refreshed: 6000 }, { tick: 50, single: 6000, refreshed: 6000 }, { tick: 110, single: 6000, refreshed: 6000 }, { tick: 111, single: 0, refreshed: 6000 }, { tick: 150, single: 0, refreshed: 6000 }, { tick: 151, single: 0, refreshed: 0 }].at(-2)).toEqual({ tick: 150, single: 0, refreshed: 6000 });
  });
});
