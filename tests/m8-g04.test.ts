import { describe, expect, it } from 'vitest';
import { applyStatusContribution, effectiveStatuses, endStatuses, cleanseStatuses, advanceBurnClock } from '../src/simulation/m8/status';
import type { StatusApplication, StatusGroup } from '../src/simulation/m8/contracts';
import { key, source } from './fixtures/m8-contract-cases';
const app = (kind: StatusApplication['kind'], magnitudeBps: number, ticks: number, activation: StatusApplication['activation'] = 'immediate'): StatusApplication => ({
  kind, magnitudeBps, activation, duration: { kind: 'ticks', ticks }, stackPolicy: { kind: 'strongest-category', category: kind, retainSuppressed: true },
  polarity: 'harmful', removable: true, damageFilter: null, onEnd: null,
});
const add = (groups: readonly StatusGroup[], id: string, application: StatusApplication, tick: number) =>
  applyStatusContribution(groups, { key: key(source('effect', id), 'A'), source: source('effect', id), targetId: 'A' }, application, tick).groups;
describe('G04 independently specified frozen status vectors', () => {
  it('retains suppressed30% shred;50% expires60,30% expires100; same source refresh never duplicates', () => {
    let groups = add([], 'a', app('shred', 3000, 100), 0);
    groups = add(groups, 'b', app('shred', 5000, 40), 20);
    groups = add(groups, 'b', app('shred', 5000, 40), 20);
    expect(groups[0].contributions).toHaveLength(2);
    expect([59, 60, 100].map(tick => effectiveStatuses(groups, tick)[0]?.effectiveMagnitudeBps ?? 0)).toEqual([5000, 3000, 0]);
    expect(endStatuses(groups, 60).groups[0].contributions.map(c => c.source.instanceId)).toEqual(['a']);
  });
  it('burn first20, refresh10 and takeover15 keep20; suppressed source keeps its own identity', () => {
    let groups = add([], 'a', app('burn', 100, 200), 0);
    groups = add(groups, 'a', app('burn', 100, 200), 10);
    groups = add(groups, 'b', app('burn', 200, 20), 15);
    expect(groups[0].nextPulseAtTick).toBe(20);
    expect(effectiveStatuses(groups, 20)[0].effectiveSourceKey).toBe(key(source('effect', 'b'), 'A'));
    groups = advanceBurnClock(groups, 'A', 20);
    expect(groups[0].nextPulseAtTick).toBe(40);
    expect(effectiveStatuses(endStatuses(groups, 35).groups, 40)[0].effectiveMagnitudeBps).toBe(100);
  });
  it('delayed start1 expires101; active same source refresh20 preserves1 and extends121', () => {
    let groups = add([], 'a', app('sunder', 3000, 100, 'next-tick'), 0);
    groups = add(groups, 'a', app('sunder', 3000, 100, 'next-tick'), 20);
    expect(groups[0].contributions[0]).toMatchObject({ appliedAtTick: 1, expiresAtTick: 121 });
    expect(effectiveStatuses(groups, 0)).toEqual([]);
  });
  it('immunity blocks new stun, keeps existing stun; cleanse removes hostile removable states only', () => {
    let groups = add([], 'a', app('stun', 0, 100), 0);
    groups = add(groups, 'b', { ...app('control-immunity', 10000, 50), removable: false, polarity: 'beneficial' }, 10);
    const result = applyStatusContribution(groups, { key: key(source('effect', 'c'), 'A'), source: source('effect', 'c'), targetId: 'A' }, app('stun', 0, 100), 20);
    expect(result.accepted).toBe(false);
    expect(effectiveStatuses(result.groups, 20).some(g => g.kind === 'stun')).toBe(true);
    const cleaned = cleanseStatuses(result.groups, 'A', new Set(['u1']), 20);
    expect(cleaned.groups.map(g => g.kind)).toEqual(['control-immunity']);
    expect(cleaned.ended.map(e => e.reason)).toEqual(['cleansed']);
  });
  it('different instances stay separate and same instance max refresh preserves magnitude and start', () => {
    const buff = { ...app('wound', 3300, 100), stackPolicy: { kind: 'refresh-same-instance', magnitude: 'max', phase: 'preserve' } } as const;
    let groups = add([], 'a', buff, 0); groups = add(groups, 'a', { ...buff, magnitudeBps: 2000 }, 10); groups = add(groups, 'b', buff, 10);
    expect(groups[0].contributions.map(c => [c.source.instanceId, c.application.magnitudeBps, c.appliedAtTick, c.expiresAtTick])).toEqual([['a', 3300, 0, 110], ['b', 3300, 10, 110]]);
  });
});
