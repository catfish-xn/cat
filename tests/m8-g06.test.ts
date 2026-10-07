import { describe, expect, it } from 'vitest';
import { makeHealRequest, resolveHeal, selectVampAlly, vampRequests } from '../src/simulation/m8/heal';
import { amount, context, source } from './fixtures/m8-contract-cases';
import { permissionsFor } from '../src/simulation/m8/damage';
import { evaluateAmount } from '../src/simulation/m8/stats';
import type { Source } from '../src/simulation/m8/contracts';
const bt = source('bloodthirster', 'i1'), gun = source('gunblade', 'i2');
describe('G06 one mutation and independently calculated share vectors', () => {
  it('non-item direct healing preserves provenance and applies wound to a missing-HP request', () => {
    const origin: Source = { ownerId: 'neutral-target', sourceKind: 'ability', definitionId: 'non-item-heal-fixture',
      instanceId: 'neutral-target', effectIndex: 0, parentItemInstanceId: null };
    const target = { id: 'neutral-target', hp: 400, maxHp: 1000, alive: true };
    // Independent answers: missing600 × 50%=300; floor(300 × 67%)=201; missing600 does not cap it.
    const requested = evaluateAmount(amount(0, { missingHpBps: 5000, hpBasis: 'target' }),
      { holder: target, target, attackDamage: 0, abilityPower: 100 });
    expect(requested).toBe(300);
    const result = resolveHeal(makeHealRequest('non-item-direct', target.id, 'direct', null,
      [{ source: origin, numerator: requested, denominator: 1 }]), target, 3300);
    expect(result).toMatchObject({ kind: 'direct', fromPacketId: null, requested: 300, afterWound: 201,
      actual: 201, overheal: 0, preventedByWound: 99 });
    expect(result.shares).toEqual([{ source: origin, requested: 300, afterWound: 201, actual: 201, overheal: 0, preventedByWound: 99 }]);
  });
  it('A10 total35, actual20: requested20/15, actual11/9, overheal9/6', () => {
    const request = makeHealRequest('h1', 'u1', 'omnivamp', 'p1', [{ source: bt, numerator: 200000, denominator: 10000 }, { source: gun, numerator: 150000, denominator: 10000 }]);
    const result = resolveHeal(request, { hp: 980, maxHp: 1000, alive: true }, 0);
    expect(result).toMatchObject({ requested: 35, afterWound: 35, actual: 20, overheal: 15, preventedByWound: 0 });
    expect(result.shares.map(s => [s.requested, s.actual, s.overheal])).toEqual([[20, 11, 9], [15, 9, 6]]);
  });
  it('A10 wound33%:35→23→20; shares13/10 allowed,11/9 actual,2/1 excess,7/5 wound', () => {
    const contributions = [{ source: bt, numerator: 20, denominator: 1 }, { source: gun, numerator: 15, denominator: 1 }];
    const result = resolveHeal(makeHealRequest('h2', 'u1', 'omnivamp', 'p1', contributions), { hp: 980, maxHp: 1000, alive: true }, 3300);
    expect(result.shares.map(s => [s.requested, s.afterWound, s.actual, s.overheal, s.preventedByWound])).toEqual([[20, 13, 11, 2, 7], [15, 10, 9, 1, 5]]);
    for (const field of ['requested', 'afterWound', 'actual', 'overheal', 'preventedByWound'] as const) expect(result.shares.reduce((n, s) => n + s[field], 0)).toBe(result[field]);
    expect(resolveHeal(makeHealRequest('h2', 'u1', 'omnivamp', 'p1', [...contributions].reverse()), { hp: 980, maxHp: 1000, alive: true }, 3300)).toEqual(result);
  });
  it('300 request with33% wound and missing100 yields201 allowed100 actual101 excess99 blocked; dead never revives', () => {
    const request = makeHealRequest('h3', 'u1', 'direct', null, [{ source: bt, numerator: 300, denominator: 1 }]);
    expect(resolveHeal(request, { hp: 900, maxHp: 1000, alive: true }, 3300)).toMatchObject({ requested: 300, afterWound: 201, actual: 100, overheal: 101, preventedByWound: 99 });
    expect(resolveHeal(request, { hp: 0, maxHp: 1000, alive: false }, 0).actual).toBe(0);
  });
  it('merges rational amounts before floor, duplicate same source; tie canonical source key', () => {
    const request = makeHealRequest('h4', 'u1', 'omnivamp', 'p1', [{ source: gun, numerator: 6, denominator: 10 }, { source: bt, numerator: 3, denominator: 10 }, { source: bt, numerator: 3, denominator: 10 }]);
    expect(request.requested).toBe(1);
    expect(resolveHeal(request, { hp: 999, maxHp: 1000, alive: true }, 0).shares.map(s => [s.source.instanceId, s.actual])).toEqual([['i1', 1], ['i2', 0]]);
    expect(() => resolveHeal({ ...request, requested: 2 }, { hp: 999, maxHp: 1000, alive: true }, 0)).toThrow();
  });
  it('vamp sums shield+HP once, rejects equipment/dead source, excludes self/dead allies and ties byID', () => {
    const c = context({ source: bt, targetId: 'enemy', delivery: 'basic-attack', critEligibility: 'basic' });
    const outcome = { context: { ...c, permissions: permissionsFor(c) }, hit: true, raw: 100, mitigated: 100, prevented: 0, absorbed: 60, hpDamage: 40, overkill: 999, critical: false, killingPacket: false };
    const units = [{ id: 'u1', hp: 980, maxHp: 1000, alive: true, team: 'player' }, { id: 'A', hp: 100, maxHp: 1000, alive: true, team: 'player' }, { id: 'B', hp: 10, maxHp: 100, alive: true, team: 'player' }, { id: 'D', hp: 0, maxHp: 100, alive: false, team: 'player' }];
    expect(selectVampAlly(units[0], units)?.id).toBe('A');
    const reqs = vampRequests('h5', units[0], outcome, [{ source: bt, bps: 2000, allyBps: 0 }, { source: gun, bps: 1500, allyBps: 2500 }], units);
    expect(reqs.map(r => [r.kind, r.targetId, r.requested])).toEqual([['omnivamp', 'u1', 35], ['ally-vamp', 'A', 25]]);
    expect(vampRequests('h5', { ...units[0], hp: 0, alive: false }, outcome, [{ source: gun, bps: 1500, allyBps: 2500 }], units)).toEqual([]);
    const eq = { ...outcome, context: { ...outcome.context, delivery: 'equipment-proc' as const, permissions: permissionsFor({ ...c, delivery: 'equipment-proc' }) } };
    expect(vampRequests('h5', units[0], eq, [{ source: gun, bps: 1500, allyBps: 2500 }], units)).toEqual([]);
  });
});
