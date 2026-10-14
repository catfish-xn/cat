import { describe, expect, it } from 'vitest';
import { periodicAmount, clearRemainder, cleanPeriodicTasks, advancePeriodicTask, splitTotal, validatePeriodicTask } from '../src/simulation/m8/periodic';
import type { PeriodicTask } from '../src/simulation/m8/contracts';
import { amount, key, selector, source } from './fixtures/m8-contract-cases';
const task = (patch: Partial<PeriodicTask> = {}): PeriodicTask => ({ key: key(source(), 'u1'), source: source(), targetId: 'u1', nextPulseAtTick: 100, periodTicks: 100, endsAtTick: null,
  pulseOrdinal: 0, pulseLimit: null, remainders: [], finalPulse: 'none', onSourceDeath: 'cancel', onTargetDeath: 'cancel', program: {
    definitionId: 'redemption-pulse', targetSnapshot: 'once-per-pulse', selector: selector({ relation: 'ally', radius: 1, maxTargets: 100, sample: 'each-pulse' }),
    effects: [{ kind: 'heal', amount: amount(0, { missingHpBps: 1500, hpBasis: 'target', sample: 'each-pulse', cap: 1000 }) }] }, ...patch });
const sample = (id: string, missing: number) => ({ holder: { id: 'u1', hp: 900, maxHp: 1000 }, target: { id, hp: 1000 - missing, maxHp: 1000 }, attackDamage: 0, abilityPower: 100 });
describe('G05 exact independent periodic accounts and scheduling vectors', () => {
  it('R1 redemption100/200/300: A0/0/0 B1/1/1, accounts1500/3000/4500 and3500/5500/6000', () => {
    let current = task(); const values: number[][] = [];
    for (const missingB of [9, 8, 7]) {
      const a = periodicAmount(current, 0, 'A', sample('A', 1)); current = a.task;
      const b = periodicAmount(current, 0, 'B', sample('B', missingB)); current = b.task; values.push([a.requested, b.requested]);
      if (missingB === 8) current = JSON.parse(JSON.stringify(current));
    }
    expect(values).toEqual([[0, 1], [0, 1], [0, 1]]);
    expect(current.remainders.map(r => [r.targetId, r.numerator, r.denominator])).toEqual([['A', 4500, 10000], ['B', 6000, 10000]]);
  });
  it('no borrowing across effect,target,source; leave retains; death removes only target; cap clears', () => {
    let current = task({ program: { ...task().program, effects: [...task().program.effects, { kind: 'heal', amount: amount(0, { missingHpBps: 2500, hpBasis: 'target', sample: 'each-pulse' }) }] } });
    current = periodicAmount(current, 0, 'A', sample('A', 1)).task;
    current = periodicAmount(current, 1, 'A', sample('A', 1)).task;
    current = periodicAmount(current, 0, 'C', sample('C', 1)).task;
    expect(current.remainders.map(r => [r.effectIndex, r.targetId, r.numerator])).toEqual([[0, 'A', 1500], [0, 'C', 1500], [1, 'A', 2500]]);
    const returned = periodicAmount(current, 0, 'A', sample('A', 1));
    expect(returned.task.remainders.find(r => r.effectIndex === 0 && r.targetId === 'A')!.numerator).toBe(3000);
    expect(periodicAmount(task({ source: source('other', 'i2'), key: key(source('other', 'i2')) }), 0, 'A', sample('A', 1)).task.remainders[0].numerator).toBe(1500);
    const cleaned = cleanPeriodicTasks([returned.task], new Set(['A']), new Set());
    expect(cleaned[0].remainders.map(r => r.targetId)).toEqual(['C']);
    expect(clearRemainder(current, 0, 'A').remainders.some(r => r.effectIndex === 0 && r.targetId === 'A')).toBe(false);
    const capTask = task({ program: { ...task().program, effects: [{ kind: 'heal', amount: amount(1000, { missingHpBps: 1500, hpBasis: 'target', cap: 1000, sample: 'each-pulse' }) }] } });
    const capped = periodicAmount(capTask, 0, 'A', sample('A', 1)); expect(capped.requested).toBe(1000); expect(capped.task.remainders).toEqual([]);
    expect(periodicAmount(current, 0, 'A', sample('A', 0)).task.remainders.some(r => r.effectIndex === 0 && r.targetId === 'A')).toBe(false);
  });
  it('1001HP at1% for100 jumps sums1001, not1000; total101 splits26/25/25/25', () => {
    let current = task({ program: { ...task().program, effects: [{ kind: 'damage', delivery: 'item-burn', damageType: 'true', critEligibility: 'never', amount: amount(0, { maxHpBps: 100, hpBasis: 'target', sample: 'each-pulse' }) }] } });
    let total = 0;
    for (let i = 0; i < 100; i++) { const next = periodicAmount(current, 0, 'A', { ...sample('A', 0), target: { id: 'A', hp: 1001, maxHp: 1001 } }); current = next.task; total += next.requested; }
    expect(total).toBe(1001); expect(splitTotal(101, 4)).toEqual([26, 25, 25, 25]);
  });
  it('final-before-expiry permits20/40/60/80; source cancel versus persist; invalid account rejected', () => {
    let current = task({ nextPulseAtTick: 20, periodTicks: 20, pulseLimit: 4, endsAtTick: 80, finalPulse: 'before-expiry' });
    const ticks: number[] = [];
    for (const tick of [19, 20, 40, 60, 80, 81]) { const next = advancePeriodicTask(current, tick); if (next.due) ticks.push(tick); if (next.task) current = next.task; else break; }
    expect(ticks).toEqual([20, 40, 60, 80]);
    expect(cleanPeriodicTasks([task(), task({ key: key(source('attached')), onSourceDeath: 'persist-attached' })], new Set(), new Set(['u1']))).toHaveLength(1);
    expect(() => validatePeriodicTask(task({ remainders: [{ effectIndex: 0, targetId: 'A', numerator: 1, denominator: 0 }] }), new Set(['A', 'u1']), new Set(), 0)).toThrow();
    expect(() => validatePeriodicTask(task({ remainders: [{ effectIndex: 1, targetId: 'A', numerator: 1, denominator: 10000 }] }), new Set(['A', 'u1']), new Set(), 0)).toThrow();
  });
});
