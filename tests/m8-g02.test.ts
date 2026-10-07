import { describe, expect, it } from 'vitest';
import { resolveDamage, permissionsFor, type DamageSample } from '../src/simulation/m8/damage';
import type { DamageRequest } from '../src/simulation/m8/contracts';
import { amount, context, modifier } from './fixtures/m8-contract-cases';
const request = (patch: Partial<DamageRequest['context']> = {}, raw = 300): DamageRequest => {
  const c = context(patch); return { context: { ...c, permissions: permissionsFor(c) }, input: { stage: 'raw', amount: amount(raw) } };
};
const sample: DamageSample = { holder: { id: 'u1', hp: 1000, maxHp: 1000 }, target: { id: 'A', hp: 70, maxHp: 1000 },
  attackDamage: 100, abilityPower: 100, armor: 100, magicResist: 200, shields: [{ key: 's', remaining: 40 }],
  amplifiers: [], reductions: [], prevention: false, critical: false, critMultiplierBps: 14000 };
describe('G02 hand-calculated execution vectors', () => {
  it.each([['physical', 150, 40], ['magic', 100, 0], ['true', 300, 190]] as const)('%s separates shield, HP and overkill', (damageType, mitigated, overkill) => {
    const result = resolveDamage(request({ damageType }), sample);
    expect(result.outcome).toMatchObject({ raw: 300, mitigated, absorbed: 40, hpDamage: damageType === 'magic' ? 60 : 70, overkill, killingPacket: damageType !== 'magic' });
    expect(result.shields).toEqual([{ key: 's', remaining: 0 }]);
    expect(sample.shields[0].remaining).toBe(40);
  });
  it('selects strongest applicable reduction; true bypasses resistance and reduction', () => {
    const reductions = [modifier('damageReduction', 800, { unit: 'bps', damageFilter: { deliveries: ['basic-attack'], damageTypes: ['physical', 'magic'], redirected: 'exclude' } }),
      modifier('damageReduction', 5000, { unit: 'bps', damageFilter: { deliveries: ['ability-direct'], damageTypes: ['physical', 'magic'], redirected: 'exclude' } })];
    const zeroArmor = { ...sample, armor: 0, reductions };
    expect(resolveDamage(request({ delivery: 'basic-attack', critEligibility: 'basic' }, 100), zeroArmor).outcome.mitigated).toBe(92);
    expect(resolveDamage(request({ delivery: 'equipment-proc', equipmentDepth: 1 }, 35), zeroArmor).outcome.mitigated).toBe(35);
    expect(resolveDamage(request({ damageType: 'true' }, 100), zeroArmor).outcome.mitigated).toBe(100);
  });
  it('inherits after-mitigation exactly once and retains original critical fact', () => {
    const c = request({ parentPacketId: 'p0', critEligibility: 'never' }).context;
    const inherited: DamageRequest = { context: c, input: { stage: 'after-mitigation', amount: 50,
      inherited: { parentPacketId: 'p0', resolvedAtTick: 10, portion: 'overkill', critical: true } } };
    expect(resolveDamage(inherited, { ...sample, shields: [{ key: 's', remaining: 20 }],
      amplifiers: [modifier('damageAmp', 10000, { unit: 'bps' })] }).outcome).toMatchObject({ raw: 50, mitigated: 50, absorbed: 20, hpDamage: 30, overkill: 0, critical: true });
  });
  it('prevention stays zero, burn may floor to zero and caps after amplification', () => {
    expect(resolveDamage(request(), { ...sample, prevention: true }).outcome).toMatchObject({ prevented: 150, mitigated: 0, absorbed: 0, hpDamage: 0 });
    expect(resolveDamage(request({ damageType: 'true', delivery: 'item-burn', equipmentDepth: 1 }, 0), sample).outcome.mitigated).toBe(0);
    expect(resolveDamage(request({ damageType: 'true', delivery: 'item-burn', equipmentDepth: 1 }, 90), { ...sample, burnCap: 100,
      amplifiers: [modifier('damageAmp', 2000, { unit: 'bps' })] }).outcome.mitigated).toBe(100); // 90*1.2=108 ->100
  });
  it('qualifies shield-only hits, excludes equipment healing and refuses forged permissions', () => {
    const r = request({ delivery: 'equipment-proc', equipmentDepth: 1 }, 30), result = resolveDamage(r, sample);
    expect(result.outcome).toMatchObject({ absorbed: 15, hpDamage: 0, overkill: 0 });
    expect(result.outcome.context.permissions).not.toContain('omnivamp');
    expect(result.outcome.context.permissions).toContain('last-whisper');
    expect(() => resolveDamage({ ...r, context: { ...r.context, permissions: ['omnivamp'] } }, sample)).toThrow();
  });
});
