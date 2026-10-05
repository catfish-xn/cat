import { describe, expect, it } from 'vitest';
import { CONTENT_DIGEST, canonicalContent, digestContent } from '../src/simulation/content';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../src/simulation/content/anomalies';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { validateContent, validateEffect } from '../src/simulation/validate-content';
import type { Effect, ItemDefinition, TraitDefinition } from '../src/simulation/strategy-types';
import { getRoundSchedule, getStageRound, ROUND_SCHEDULE } from '../src/simulation/round-schedule';
import { getEnemyGrowthBps } from '../src/simulation/round-enemies';

describe('M4 locked authored content', () => {
  it('validates the complete slice, all 15 unordered recipes and purchasable trait tiers', () => {
    expect(() => validateContent()).not.toThrow();
    expect([UNIT_DEFINITIONS, TRAIT_DEFINITIONS, ITEM_DEFINITIONS, AUGMENT_DEFINITIONS, ANOMALY_DEFINITIONS].map(c => Object.keys(c).length)).toEqual([18, 6, 20, 8, 8]);
    expect(Object.values(SHOP_CATALOG_BY_COST).flat().sort()).toEqual(Object.keys(UNIT_DEFINITIONS).sort());
    expect(Object.values(ITEM_DEFINITIONS).filter(item => item.recipe).length).toBe(15);
    expect(Object.isFrozen(ITEM_DEFINITIONS['echo-rod'].effects[0])).toBe(true);
  });
  it('locks every gameplay number and semantic array order with a browser-safe canonical digest', () => {
    expect(CONTENT_DIGEST).toBe('fnv1a32-utf16:a4b8a029');
    expect(digestContent({ z: [2, 1], a: { y: '盾', x: 3 } })).toBe(digestContent({ a: { x: 3, y: '盾' }, z: [2, 1] }));
    expect(digestContent({ z: [1, 2] })).not.toBe(digestContent({ z: [2, 1] }));
    expect(digestContent(ITEM_DEFINITIONS)).not.toBe(digestContent({ ...ITEM_DEFINITIONS, blade: { ...ITEM_DEFINITIONS.blade, effects: [{ kind: 'statFlat', stat: 'attackDamage', amount: 11 }] } }));
    expect(() => canonicalContent({ x: undefined })).toThrow();
    expect(() => canonicalContent({ x: Infinity })).toThrow();
    expect(() => canonicalContent(new Array(2))).toThrow();
  });
  it('keeps all old base stats/abilities and expands each new unit into complete independent data', () => {
    for (const [newId, oldId] of Object.entries({ squire: 'sentinel', spark: 'mystic', scout: 'archer', binder: 'bulwark', striker: 'duelist', beacon: 'arcanist', prism: 'tempest' })) {
      expect(UNIT_DEFINITIONS[newId].baseStats).toEqual(UNIT_DEFINITIONS[oldId].baseStats);
      expect(UNIT_DEFINITIONS[newId].baseStats).not.toBe(UNIT_DEFINITIONS[oldId].baseStats);
      expect(UNIT_DEFINITIONS[newId].abilityId).toBe(UNIT_DEFINITIONS[oldId].abilityId);
      expect(UNIT_DEFINITIONS[newId].traits).toHaveLength(2);
    }
  });
  it('rejects unknown and recursive hooks instead of silently ignoring content', () => {
    for (const effect of [
      { kind: 'heal', amount: 10 },
      { kind: 'trigger', hook: 'onHpLoss', everyN: 1, action: { kind: 'dealDamage', amount: 10, damageType: 'magic' } },
      { kind: 'trigger', hook: 'combatStart', everyN: 2, action: { kind: 'gainMana', amount: 10 } },
      { kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'grantShield', amount: 10, durationTicks: 0 } },
      { kind: 'statFlat', stat: 'attackDamage', amount: 2, expression: 'Math.random()' },
      { kind: 'statPercentBps', stat: 'initialMana', bps: 100 },
    ]) expect(() => validateEffect(effect as Effect)).toThrow();
  });
  it('rejects missing references, duplicate recipes and unreachable tiers', () => {
    expect(() => validateContent({ units: { ...UNIT_DEFINITIONS, sentinel: { ...UNIT_DEFINITIONS.sentinel, traits: ['missing'] } } })).toThrow(/Missing trait/);
    expect(() => validateContent({ units: { ...UNIT_DEFINITIONS, sentinel: { ...UNIT_DEFINITIONS.sentinel, abilityId: 'missing' } } })).toThrow(/Missing ability/);
    const duplicate: ItemDefinition = { ...ITEM_DEFINITIONS['spell-edge'], recipe: ['blade', 'blade'] };
    expect(() => validateContent({ items: { ...ITEM_DEFINITIONS, 'spell-edge': duplicate } })).toThrow(/Duplicate recipe/);
    const unreachable: TraitDefinition = { ...TRAIT_DEFINITIONS.duelist, tiers: [{ threshold: 6, effects: TRAIT_DEFINITIONS.duelist.tiers[0].effects }] };
    expect(() => validateContent({ traits: { ...TRAIT_DEFINITIONS, duelist: unreachable } })).toThrow(/Unreachable/);
    expect(() => validateContent({ anomalies: Object.fromEntries(Object.entries(ANOMALY_DEFINITIONS).slice(0, 5)) })).toThrow(/exhausted/);
  });
  it('rejects individually valid numbers that overflow a legal three-item loadout', () => {
    const powerful: ItemDefinition = { ...ITEM_DEFINITIONS['focus-rod'], effects: [{ kind: 'statPercentBps', stat: 'abilityAmount', bps: 13000 }] };
    expect(() => validateContent({ items: { ...ITEM_DEFINITIONS, 'focus-rod': powerful } })).toThrow(/Stat bound/);
    const unsafe: ItemDefinition = { ...ITEM_DEFINITIONS.blade, effects: [{ kind: 'statFlat', stat: 'attackDamage', amount: Number.MAX_SAFE_INTEGER }] };
    expect(() => validateContent({ items: { ...ITEM_DEFINITIONS, blade: unsafe } })).toThrow(/overflow|bound/);
  });
  it('accepts another supported declarative augment without changing a primitive or engine branch', () => {
    expect(() => validateContent({ augments: { ...AUGMENT_DEFINITIONS, 'new-study': { id: 'new-study', name: '试验', description: '技能 +5', effects: [{ kind: 'statFlat', stat: 'abilityAmount', amount: 5 }] } } })).not.toThrow();
  });
});

describe('M4 round schedule', () => {
  it('keeps absolute round authority, deterministic order and fresh event objects', () => {
    expect(getStageRound(1)).toEqual({ stage: 1, round: 1 });
    expect(getStageRound(7)).toEqual({ stage: 3, round: 1 });
    expect(getRoundSchedule(7).map(e => [e.id, e.kind, e.priority])).toEqual([['r7-reward', 'reward', 10], ['r7-anomaly', 'anomaly', 30]]);
    expect(getRoundSchedule(7)).toEqual(getRoundSchedule(7));
    expect(getRoundSchedule(1)[0]).not.toBe(getRoundSchedule(1)[0]);
    expect(getRoundSchedule(9)).toEqual([]);
    expect(getRoundSchedule(10)[0].id).toBe('r10-reward');
    expect(getRoundSchedule(11)).toEqual([]);
    expect(getRoundSchedule(100)[0].id).toBe('r100-reward');
    for (const invalid of [0, -1, 1.5, NaN, Infinity]) expect(() => getRoundSchedule(invalid)).toThrow();
  });
  it('caps enemy snapshot growth without overflowing even on large legal rounds', () => {
    expect([1, 9, 10, 11, 29, 30, Number.MAX_SAFE_INTEGER].map(getEnemyGrowthBps)).toEqual([0, 0, 1000, 2000, 20000, 20000, 20000]);
  });
  it('rejects repeated schedule receipts and invalid stage targets at content validation', () => {
    expect(() => validateContent({ schedule: { ...ROUND_SCHEDULE, fixed: [...ROUND_SCHEDULE.fixed, ROUND_SCHEDULE.fixed[0]] } })).toThrow(/schedule/);
    expect(() => validateContent({ schedule: { ...ROUND_SCHEDULE, fixed: [{ round: 1, event: { id: 'early-anomaly', priority: 30, kind: 'anomaly' } }] } })).toThrow(/anomaly/);
  });
});
