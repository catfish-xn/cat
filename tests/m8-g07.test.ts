import { describe, expect, it } from 'vitest';
import { grantShieldState, maintainShield, absorbShields, endShield, survivalSamples, consumeSurvivalTriggers } from '../src/simulation/m8/shield';
import { amount, key, selector, source, trigger } from './fixtures/m8-contract-cases';
import type { Effect, EffectRuntime } from '../src/simulation/m8/contracts';
const s = source('irelia'); const identity = { key: key(s), source: s, targetId: 'u1' };
const effect: Extract<Effect, { kind: 'grant-shield' }> = { kind: 'grant-shield', amount: amount(600), durationTicks: 60, decay: { kind: 'linear-initial-grant' }, onEnd: ['depleted', 'expired'], endTiming: 'next-action-planning', endTargeting: { kind: 'fixed', targetIds: ['u1'], ifMissing: 'skip' }, endEffects: [] };
describe('G07 frozen independent shield and post-damage survival vectors', () => {
  it('A03 grant600, decay100, absorb120, next decay10:370 remaining/120 absorbed/110 decayed; bonus36', () => {
    let layer = grantShieldState(identity, 600, effect, 0);
    layer = maintainShield(layer, 10).layer;
    expect(layer).toMatchObject({ remaining: 500, absorbed: 0, decayed: 100 });
    layer = absorbShields([layer], 120).layers[0];
    layer = maintainShield(JSON.parse(JSON.stringify(layer)), 11).layer;
    expect(layer).toMatchObject({ remaining: 370, absorbed: 120, decayed: 110, expiredDiscarded: 0 });
    expect(layer.remaining + layer.absorbed + layer.decayed + layer.expiredDiscarded).toBe(600);
    expect(Math.floor(layer.absorbed * .3)).toBe(36);
  });
  it('orders expiry then canonical source, refresh max remaining/later expiry resets decay and absorption', () => {
    const a = grantShieldState(identity, 40, { ...effect, decay: { kind: 'none' }, durationTicks: 20 }, 0);
    const bId = { key: key(source('other', 'i2')), source: source('other', 'i2'), targetId: 'u1' };
    const b = grantShieldState(bId, 100, { ...effect, decay: { kind: 'none' }, durationTicks: 10 }, 0);
    const result = absorbShields([a, b], 110);
    expect(result.layers.map(l => [l.source.instanceId, l.remaining, l.absorbed])).toEqual([['i2', 0, 100], ['i1', 30, 10]]);
    const refreshed = grantShieldState(identity, 20, effect, 5, result.layers[1]);
    expect(refreshed).toMatchObject({ granted: 30, remaining: 30, absorbed: 0, decayed: 0, expiresAtTick: 65, decay: { grantedAtTick: 5, basisGranted: 30 } });
  });
  it('decay and expiry have distinct end events, discard unused shield; consumed marker is once only', () => {
    const layer = grantShieldState(identity, 600, { ...effect, decay: { kind: 'none' } }, 0);
    const expiry = maintainShield(layer, 60);
    expect(expiry.layer).toMatchObject({ remaining: 0, absorbed: 0, decayed: 0, expiredDiscarded: 600 });
    expect(expiry.reason).toBe('expired');
    const first = endShield(expiry.layer, 'expired', effect, true);
    expect(first.emitEnd).toBe(true); expect(first.layer.endRewardConsumed).toBe(true);
    expect(endShield(first.layer, 'depleted', effect, true).emitEnd).toBe(false);
    expect(endShield(layer, 'death-cleanup', effect, false).effects).toEqual([]);
  });
  it('300 damage700→400 qualifies;800 damage700→0 does not; shield-only positive qualifies below threshold', () => {
    const before = [{ id: 'u1', hp: 700, maxHp: 1000 }];
    const make = (hp: number, positive: boolean) => survivalSamples(before, [{ id: 'u1', hp, maxHp: 1000 }], new Set(positive ? ['u1'] : []), 10)[0];
    const definition = trigger({ source: source('bt', 'i1'), event: 'post-damage-survival', listener: { subject: 'target', relationToHolder: 'self', withinHexes: null }, maxPerCombat: 1, condition: { kind: 'hp-ratio', subject: 'holder', op: 'lte', thresholdBps: 4000 }, selector: selector(), effects: [{ ...effect, amount: amount(0, { maxHpBps: 2500 }), durationTicks: 100, decay: { kind: 'none' } }] });
    expect(consumeSurvivalTriggers([definition], [], make(400, true), 'c1').fired).toHaveLength(1);
    expect(consumeSurvivalTriggers([definition], [], make(0, true), 'c1').fired).toEqual([]);
    expect(consumeSurvivalTriggers([definition], [], make(300, true), 'c1').fired).toHaveLength(1);
    expect(consumeSurvivalTriggers([definition], [], make(300, false), 'c1').fired).toEqual([]);
    const first = consumeSurvivalTriggers([definition], [], make(400, true), 'c1');
    expect(first.runtimes[0]).toMatchObject({ consumed: true, triggerCount: 1 });
    expect(consumeSurvivalTriggers([definition], JSON.parse(JSON.stringify(first.runtimes)), make(300, true), 'c1').fired).toEqual([]);
  });
  it('all qualifications/maxHP frozen before effects; two independent shields250 each; cooldown marker blocks until30', () => {
    const defs = ['a', 'b'].map(id => trigger({ id, source: source('unknown-definition', id), event: 'post-damage-survival', listener: { subject: 'target', relationToHolder: 'self', withinHexes: null }, maxPerCombat: 1, condition: { kind: 'hp-ratio', subject: 'holder', op: 'lte', thresholdBps: 4000 } }));
    const sample = survivalSamples([{ id: 'u1', hp: 700, maxHp: 1000 }], [{ id: 'u1', hp: 300, maxHp: 1000 }], new Set(['u1']), 10)[0];
    const first = consumeSurvivalTriggers(defs, [], sample, 'c1');
    expect(first.fired.map(f => f.sample.maxHpBeforeThresholdEffects)).toEqual([1000, 1000]);
    expect(first.fired.map(f => Math.floor(f.sample.maxHpBeforeThresholdEffects * .25))).toEqual([250, 250]);
    const repeat = { ...defs[0], maxPerCombat: null, internalCooldownTicks: 20 };
    const icd = consumeSurvivalTriggers([repeat], [], sample, 'c1');
    expect(icd.runtimes[0].nextEligibleTick).toBe(30);
    expect(consumeSurvivalTriggers([repeat], icd.runtimes as EffectRuntime[], { ...sample, tick: 29 }, 'c1').fired).toEqual([]);
    expect(consumeSurvivalTriggers([repeat], icd.runtimes, { ...sample, tick: 30 }, 'c1').fired).toHaveLength(1);
  });  it('one source shares its consumed marker across combat-start and post-damage listeners', () => {
    const post = trigger({ id: 'damage-listener', source: source('unknown-definition','one-item'), event: 'post-damage-survival', listener: { subject: 'target', relationToHolder: 'self', withinHexes: null }, maxPerCombat: 1, condition: { kind: 'hp-ratio', subject: 'holder', op: 'lte', thresholdBps: 6000 } });
    const start = { ...post, id: 'start-listener', event: 'combat-start' as const, listener: { subject: 'actor' as const, relationToHolder: 'self' as const, withinHexes: null } };
    const sample = { unitId: 'u1', tick: 0, hpBeforeDamage: 500, hpAfterDamage: 500, maxHpBeforeThresholdEffects: 1000, survivedDamageBatch: true, receivedPositiveDamage: false };
    const first = consumeSurvivalTriggers([start,post], [], sample, 'c1', true);
    expect(first.fired).toHaveLength(1);
    expect(consumeSurvivalTriggers([start,post], JSON.parse(JSON.stringify(first.runtimes)), { ...sample, tick: 1, hpAfterDamage: 400, receivedPositiveDamage: true }, 'c1').fired).toEqual([]);
  });

});
