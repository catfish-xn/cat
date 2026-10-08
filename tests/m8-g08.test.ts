import { describe, expect, it } from 'vitest';
import { resolveMana, damageMana, planManaCost, completeCast, refundCast, validateManaDefinition } from '../src/simulation/m8/mana';
import { cast, source } from './fixtures/m8-contract-cases';
import type { ManaRequest } from '../src/simulation/m8/contracts';
import { stepCombat } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { UNIT_DEFINITIONS, validateUnitDefinitions } from '../src/simulation/units';
import { resolveUnitStats } from '../src/simulation/unit-stats';
import { battle, unit } from './combat-helpers';
const request = (patch: Partial<ManaRequest> = {}): ManaRequest => ({ source: source('mana', 'i', 'p'), targetId: 'p', amount: 10, reason: 'attack', bypassLock: 'none', castActionSeq: null, ...patch });
const state = { unitId: 'p', current: 75, maximum: 80, lockedUntilTick: 0 };
describe('G08 independent mana and cast vectors (B2 §7)', () => {
  it('75+10→80, overflow5; explicit lock blocks10, expiry releases; zero maximum overflows10', () => {
    expect(resolveMana(state, request(), 10)).toMatchObject({ before: 75, blocked: 0, applied: 5, overflow: 5, after: 80 });
    expect(resolveMana({ ...state, lockedUntilTick: 11 }, request(), 10)).toMatchObject({ blocked: 10, applied: 0, overflow: 0, after: 75 });
    expect(resolveMana({ ...state, lockedUntilTick: 10 }, request(), 10).applied).toBe(5);
    expect(resolveMana({ ...state, current: 0, maximum: 0 }, request(), 10)).toMatchObject({ blocked: 0, applied: 0, overflow: 10, after: 0 });
  });
  it('HP loss33+33→1, 667→20; shields and overkill do not enter this total', () => {
    expect(damageMana(66)).toBe(1); expect(damageMana(667)).toBe(20); expect(damageMana(0)).toBe(0);
    expect(() => damageMana(-1)).toThrow();
  });
  it('cost80 then refund10 retains80 spent and exact target order/duplicates; no automatic lock', () => {
    const cost = planManaCost({ ...state, current: 80 }, 80)!;
    expect(cost).toEqual({ actualManaSpent: 80, after: { ...state, current: 0 } });
    const receipt = completeCast(cast({ source: { ...source('ability', 'p', 'p'), sourceKind: 'ability' }, targetIds: ['b','a','b'], refundedMana: 0 }), cost.actualManaSpent);
    const refunded = refundCast({ ...cost.after, lockedUntilTick: 30 }, request({ reason: 'cast-refund', bypassLock: 'this-cast-refund', castActionSeq: 1 }), receipt, 10);
    expect(refunded.receipt).toMatchObject({ actualManaSpent: 80, refundedMana: 10, targetIds: ['b','a','b'] });
    expect(refunded.outcome).toMatchObject({ applied: 10, blocked: 0, after: 10 });
    expect(() => refundCast(cost.after, request({ reason: 'cast-refund', bypassLock: 'this-cast-refund', castActionSeq: 2 }), receipt, 10)).toThrow();
    expect(() => resolveMana(cost.after, request({ bypassLock: 'this-cast-refund' }), 10)).toThrow();
    expect(planManaCost(state, 80)).toBeNull();
    expect(planManaCost({ ...state, current: 0, maximum: 0 }, 0)).toBeNull();
    expect(planManaCost({ ...state, current: 0 }, 0)?.actualManaSpent).toBe(0);
  });
  it('IF-MANA explicitly neutral0/0 accepted;1/0 and undeclared zero-resource heroes rejected', () => {
    expect(() => validateManaDefinition({ initialMana: 0, maxMana: 0, unitKind: 'neutral' })).not.toThrow();
    expect(() => validateManaDefinition({ initialMana: 1, maxMana: 0, unitKind: 'neutral' })).toThrow();
    expect(() => validateManaDefinition({ initialMana: 0, maxMana: 0 })).toThrow();
    const definition = { ...UNIT_DEFINITIONS['neutral-stage-2'], id: 'future-neutral', unitKind: 'neutral' as const, monsterFamily: 'future', baseAttackSpeedBps: 8000, baseCritChanceBps: 2500, baseCritMultiplierBps: 14000, maxMana: 0 };
    expect(() => validateUnitDefinitions({ ...UNIT_DEFINITIONS, [definition.id]: definition })).not.toThrow();
    expect(resolveUnitStats(definition, 1)).toMatchObject({ initialMana: 0, maxMana: 0, unitKind: 'neutral' });
    expect(() => validateUnitDefinitions({ ...UNIT_DEFINITIONS, [definition.id]: { ...definition, initialMana: 1 } })).toThrow();
  });
  it('S13 same-tick cast spending100 plus HP loss100 gives3 mana; no cast recursion', () => {
    const p = unit('p','player',1,3,{ ability: resolveAbility('zyra-ability',1), mana:100, maxMana:100, hp:1000,maxHp:1000, armor:0, magicResist:0 });
    const e = unit('e','enemy',2,3,{ ability: resolveAbility('neutral-attack',1), hp:1000,maxHp:1000,attackDamage:100,armor:0,magicResist:0 });
    const result = stepCombat(battle([p,e]));
    expect(result.state.units.find(u=>u.id==='p')?.mana).toBe(3);
    expect(result.events.filter(e=>e.type==='cast')).toHaveLength(1);
    expect(stepCombat(JSON.parse(JSON.stringify(result.state)))).toEqual(stepCombat(result.state));
    const zero = stepCombat(battle([{...p,mana:0,maxMana:0},e]));
    expect(zero.events.filter(e=>e.type==='cast')).toHaveLength(0);
    expect(zero.state.units.find(u=>u.id==='p')?.mana).toBe(0);
  });
});
