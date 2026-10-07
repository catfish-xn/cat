import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import type { Effect, StatusGroup } from '../src/simulation/m8/contracts';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { aggregateStats } from '../src/stats/aggregate';
import { amount, source, trigger, modifier } from './fixtures/m8-contract-cases';
import { battle, unit } from './combat-helpers';
const s = (id: string, owner = 'p') => source(id, id, owner);
function dummy(id: string, team: 'player' | 'enemy', col: number, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit(id, team, col, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 10000, maxHp: 10000, armor: 0, magicResist: 0,
    mana: 0, maxMana: 1, cooldownTicks: 1000, moveCooldownTicks: 1000, attackRange: 6, attackDamage: 0, statuses: [], shieldLayers: [], tasks: [], runtime: { ...EMPTY_RUNTIME }, ...patch });
}
function hero(name: string, patch: Partial<CombatUnit> = {}): CombatUnit {
  return dummy('p', 'player', 1, { definitionId: name, ability: resolveAbility(`${name}-ability`, 1), hp: 1000, maxHp: 1000, mana: 100, maxMana: 100, abilityPower: 100, attackDamage: 100, ...patch });
}
function advance(state: CombatState, ticks: number) { const events: CombatEvent[] = []; for (let i = 0; i < ticks && state.status === 'running'; i++) { const step = stepCombat(state); state = step.state; events.push(...step.events); } return { state, events }; }
const shield: Extract<Effect, { kind: 'grant-shield' }> = { kind: 'grant-shield', amount: amount(0, { maxHpBps: 2500 }), durationTicks: 100, decay: { kind: 'none' }, onEnd: [], endTiming: 'post-damage', endTargeting: { kind: 'fixed', targetIds: ['p'], ifMissing: 'skip' }, endEffects: [] };
const bt = (id: string) => trigger({ id, source: s(id), event: 'post-damage-survival', listener: { subject: 'target', relationToHolder: 'self', withinHexes: null }, condition: { kind: 'hp-ratio', subject: 'holder', op: 'lte', thresholdBps: 4000 }, maxPerCombat: 1, effects: [shield] });
const definitions = (survivalTriggers = [bt('a')]) => ({ periodicTasks: [], survivalTriggers, vamp: [] });
function status(kind: 'wound' | 'control-immunity' | 'damage-prevention', magnitudeBps: number, owner = 'e'): StatusGroup[] {
  return applyStatusContribution([], effectIdentity('standalone', s(kind, owner), 'p'), { kind, magnitudeBps, activation: 'immediate', duration: { kind: 'ticks', ticks: 100 },
    stackPolicy: { kind: 'strongest-category', category: kind, retainSuppressed: true }, removable: kind === 'wound', polarity: kind === 'wound' ? 'harmful' : 'beneficial', damageFilter: null, onEnd: null }, 0).groups;
}
describe('B3 second batch on the actual S13 step pipeline', () => {
  it('two independent threshold shields use700−300=400 and grant250+250 once, following tick absorbs earliest shield', () => {
    const p = dummy('p', 'player', 1, { hp: 700, maxHp: 1000, mechanismDefinitions: definitions([bt('a'), bt('b')]) });
    const first = stepCombat(battle([p, dummy('e', 'enemy', 2, { attackDamage: 300, cooldownTicks: 0 })]));
    expect(first.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 400, shield: 500 });
    expect(first.events.filter(e => e.type === 'shieldLayerChanged' && e.reason === 'granted')).toHaveLength(2);
    const next = stepCombat({ ...first.state, units: first.state.units.map(u => u.id === 'e' ? { ...u, cooldownTicks: 0 } : u) });
    expect(next.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 400, shield: 200 });
    expect(next.events.filter(e => e.type === 'shieldLayerChanged' && e.reason === 'granted')).toEqual([]);
    expect(stepCombat(JSON.parse(JSON.stringify(next.state)))).toEqual(stepCombat(next.state));
  });
  it('lethal two-packet batch never grants any of the four survival mechanisms', () => {
    const four = ['bloodthirster', 'protector', 'night', 'sterak'].map(bt);
    const p = dummy('p', 'player', 1, { hp: 700, maxHp: 1000, mechanismDefinitions: definitions(four) });
    const first = stepCombat(battle([p, dummy('eA', 'enemy', 2, { attackDamage: 400, cooldownTicks: 0 }), dummy('eB', 'enemy', 3, { attackDamage: 400, cooldownTicks: 0 })]));
    expect(first.state.units.find(u => u.id === 'p')!.hp).toBe(0);
    expect(first.events.filter(e => e.type === 'shieldLayerChanged' && e.reason === 'granted')).toEqual([]);
    expect(first.state.units.find(u => u.id === 'p')!.mechanismState!.runtimes).toEqual([]);
  });
  it('same frozen threshold snapshot pays shield250 even if maxHP grows1000→1250 first; growth is not healing', () => {
    const growth = { ...bt('0-growth'), condition: { kind: 'hp-ratio', subject: 'holder', op: 'lte', thresholdBps: 6000 } as const, effects: [{ kind: 'change-max-hp', bonusBps: 2500, currentHp: 'add-max-delta', countsAsHeal: false } as const] };
    const p = dummy('p', 'player', 1, { hp: 700, maxHp: 1000, mechanismDefinitions: definitions([growth, bt('z-shield')]) });
    const first = stepCombat(battle([p, dummy('e', 'enemy', 2, { attackDamage: 300, cooldownTicks: 0 })]));
    expect(first.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 650, maxHp: 1250, shield: 250 });
    expect(first.events.filter(e => e.type === 'heal')).toEqual([]);
    expect(first.events.find(e => e.type === 'maxHpChanged')).toMatchObject({ beforeMax: 1000, afterMax: 1250, beforeHp: 400, afterHp: 650, countsAsHeal: false });
  });
  it('A10 two sources create one actual S13 heal35→23→20, with11/9 shares counted once', () => {
    const vamp = [s('bloodthirster'), s('gunblade')].map((source, i) => ({ source, modifier: modifier('omnivamp', i === 0 ? 2000 : 1500, { unit: 'bps' }), allyBps: 0, allyCondition: { kind: 'always' as const } }));
    const p = dummy('p', 'player', 1, { hp: 980, maxHp: 1000, attackDamage: 100, cooldownTicks: 0, mechanismDefinitions: { ...definitions([]), vamp }, mechanismState: { ...EMPTY_MECHANISMS, statuses: status('wound', 3300) } });
    const first = stepCombat(battle([p, dummy('e', 'enemy', 2)]));
    const heals = first.events.filter((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
    expect(heals).toHaveLength(1); expect(heals[0]).toMatchObject({ requested: 35, actual: 20, overheal: 3, outcome: { afterWound: 23, preventedByWound: 12 } });
    expect(heals[0].outcome!.shares.map(s => [s.requested, s.afterWound, s.actual, s.overheal])).toEqual([[20, 13, 11, 2], [15, 10, 9, 1]]);
    expect(aggregateStats('r', 'c', first.events.map((e, eventSeq) => ({ ...e, combatId: 'c', eventSeq }))).units.find(u => u.unitId === 'p')).toMatchObject({ effectiveHealing: 20, overhealing: 3 });
    expect(first.state.units.find(u => u.id === 'p')!.hp).toBe(1000);
  });
  it('immunity prevents Zyra control without cleansing preexisting states; prevention handles existing packets', () => {
    const p = dummy('p', 'player', 1, { mechanismState: { ...EMPTY_MECHANISMS, statuses: status('control-immunity', 10000, 'p') } });
    const e = { ...hero('zyra'), id: 'e', team: 'enemy' as const, cell: { col: 2, row: 3 } };
    const first = stepCombat(battle([p, e]));
    expect(first.state.units.find(u => u.id === 'p')!.statuses).toEqual([]);
    expect(first.events.filter(e => e.type === 'statusChanged' && e.unitId === 'p')).toEqual([]);
    const prevented = stepCombat(battle([{ ...p, mechanismState: { ...EMPTY_MECHANISMS, statuses: status('damage-prevention', 10000, 'p') } }, dummy('e', 'enemy', 2, { cooldownTicks: 0, attackDamage: 300 })]));
    expect(prevented.state.units.find(u => u.id === 'p')!.hp).toBe(10000);
    expect(prevented.events.find(e => e.type === 'packetDamage')).toMatchObject({ hpDamage: 0, absorbed: 0, mitigated: 0 });
  });
  it('actual dragon claw preserves25/1000 per40tick instead of discarding fractional maxHP each pulse', () => {
    const p = dummy('p', 'player', 1, { hp: 600, maxHp: 1001, mechanics: [{ source: s('dragonClaw'), mechanic: 'dragonClaw', values: { periodTicks: 40, healMaxHpBps: 250 } }] });
    const result = advance(battle([p, dummy('e', 'enemy', 2)]), 120);
    expect(result.events.filter(e => e.type === 'heal').map(e => [e.tick, e.requested])).toEqual([[40, 25], [80, 25], [120, 25]]);
    expect(result.state.units.find(u => u.id === 'p')!.mechanismState!.periodicTasks[0].remainders[0]).toMatchObject({ targetId: 'p', numerator: 750, denominator: 10000 });
  });
  it('Irelia actual layer preserves600=370+120+110 through save and end damage reads actual absorbed only', () => {
    const first = stepCombat(battle([hero('irelia', { abilityPower: 150 }), dummy('e', 'enemy', 2)]));
    const tenth = advance(first.state, 9).state;
    const hit = stepCombat({ ...tenth, units: tenth.units.map(u => u.id === 'e' ? { ...u, cooldownTicks: 0, attackDamage: 120 } : u) });
    const next = stepCombat(JSON.parse(JSON.stringify(hit.state)));
    expect(next.state.units.find(u => u.id === 'p')!.shieldLayers![0]).toMatchObject({ remaining: 370, absorbed: 120, m8State: { granted: 600, decayed: 110, absorbed: 120 } });
    expect(stepCombat(JSON.parse(JSON.stringify(next.state)))).toEqual(stepCombat(next.state));
  });
  it('Corki multi-shot status identities encode canonical action/ordinal/target tuples', () => {
    const result = stepCombat(battle([hero('corki'),dummy('e','enemy',2)]));
    const contribution = result.state.units.find(u => u.id === 'e')!.mechanismState!.statuses[0].contributions[0];
    expect(JSON.parse(contribution.key)[8]).toBe(JSON.stringify([0,0,'e']));
  });
  it('Garen existing passive also heals once on a positive basic attack, not only a cast', () => {
    const p = hero('garen', { mana: 0, cooldownTicks: 0, hp: 900 });
    const result = stepCombat(battle([p, dummy('e','enemy',2)]));
    expect(result.events.filter(e => e.type === 'heal')).toEqual([expect.objectContaining({ requested: 15, actual: 15, source: expect.objectContaining({ sourceKind: 'ability', definitionId: 'garen-ability' }) })]);
    expect(result.state.units.find(u => u.id === 'p')!.hp).toBe(915);
  });
  it('Darius recast10→20 replaces next30 with40 as explicitly confirmed; originalfour integer total stays conserved', () => {
    const p = hero('darius', { hp: 900 });
    const first = stepCombat({ ...battle([p, dummy('e', 'enemy', 2)]), tick: 9 });
    const recast = stepCombat({ ...first.state, tick: 19, units: first.state.units.map(u => u.id === 'p' ? { ...u, mana: 100 } : u) });
    expect(recast.state.units.find(u => u.id === 'p')!.tasks!.filter(t => t.kind === 'bleed').map(t => [t.executeAtTick, t.amount])).toEqual([[40, 50], [60, 50], [80, 50], [100, 50]]);
  });
});
