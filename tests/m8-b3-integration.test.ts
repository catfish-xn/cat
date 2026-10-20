import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { authorizeSpellCrit } from '../src/simulation/m8/crit';
import { aggregateStats } from '../src/stats/aggregate';
import type { M8CombatEvent } from '../src/simulation/m8/contracts';
import { battle, unit } from './combat-helpers';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { source, context } from './fixtures/m8-contract-cases';
import { heals, packets as packetViews, statusEvents } from './helpers/replay2-views';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

function hero(name: string, authorized: boolean): CombatUnit {
  const item = source('TFT_Item_InfinityEdge', 'i1', 'p');
  return unit('p', 'player', 1, 3, { definitionId: name, ability: resolveAbility(`${name}-ability`, 1),
    hp: 4000, maxHp: 5000, armor: 0, magicResist: 0, mana: 10000, maxMana: 10000, attackDamage: 100,
    attackRange: 6, baseAttackSpeedBps: 10000, abilityPower: 100, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [],
    spellCrit: authorizeSpellCrit([], authorized ? [item] : [], 10000, 14000) });
}
function dummy(id = 'e', col = 2, row = 3): CombatUnit {
  return unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 50000, maxHp: 50000, armor: 0, magicResist: 0, attackDamage: 0, mana: 0, maxMana: 1,
    cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [] });
}
function advance(state: CombatState, ticks: number) {
  const events: CombatEvent[] = [];
  for (let i = 0; i < ticks; i++) { const step = stepCombat(state); state = step.state; events.push(...step.events); }
  return { state, events };
}
const packets = (events: readonly CombatEvent[]) => packetViews(events).filter(e => e.source.ownerId === 'p');

describe('B3 existing nineteen champions on the G01–G03 pipeline', () => {
  // AD100/AP100, zero resistance: hand amounts then floor(raw*1.4).
  // Single enemy keeps geometry fixed; time covers each independently scheduled first output.
  // replay2: outcome.raw is the frozen pre-crit amount. Third column = the old post-crit event raw (still checked
  // as floor(raw×14000/10000)); fourth column = the pre-crit raw, i.e. the hand amount before ×1.4.
  it.each([
    ['irelia', 61, [98], [70]], ['maddie', 1, [189], [135]], ['darius', 1, [336], [240]], ['lux', 21, [504], [360]],
    ['zyra', 1, [364], [260]], ['tristana', 1, [805], [575]], ['urgot', 1, [469], [335]], ['rell', 1, [168], [120]],
    ['leona', 61, [161], [115]], ['kogmaw', 21, [67], [48]], ['scar', 1, [112], [80]], ['ezreal', 1, [217, 378], [155, 270]],
    ['loris', 81, [210], [150]], ['nami', 1, [168], [120]], ['corki', 1, [57], [41]], ['garen', 1, [350], [250]], ['zoe', 1, [196], [140]], ['caitlyn', 1, [280, 392], [200, 280]],
  ] as const)('%s authorizes only its skill damage packets', (name, ticks, firstExpected, firstPreCrit) => {
    const initial = battle([hero(name, true), dummy()], { rngState: 42, rngDraws: 0 });
    const result = advance(initial, ticks);
    const skill = packets(result.events).filter(e => e.source.sourceKind === 'ability');
    expect(skill.slice(0, firstExpected.length).map(e => e.raw)).toEqual(firstPreCrit);
    expect(skill.slice(0, firstExpected.length).map(e => Math.floor(e.raw * 14000 / 10000))).toEqual(firstExpected);
    expect(skill.every(e => e.critical)).toBe(true);
    const plain = advance(battle([hero(name, false), dummy()], { rngState: 42, rngDraws: 0 }), ticks);
    expect(result.state.rngDraws! - plain.state.rngDraws!).toBe(skill.length);
    expect(heals(result.events).map(e => e.requested)).toEqual(heals(plain.events).map(e => e.requested));
    expect(stepCombat(JSON.parse(JSON.stringify(result.state)))).toEqual(stepCombat(result.state));
    expect(initial.units[0].hp).toBe(4000);
  });
  it('Vander replaces the basic attack, drawing once; his resists stay100 with spell authorization', () => {
    const result = advance(battle([hero('vander', true), dummy()], { rngState: 42, rngDraws: 0 }), 51);
    // replay2 pre-crit raw: old post-crit 560 = floor(400×14000/10000).
    expect(packets(result.events).map(e => [e.source.sourceKind, e.raw, e.critical])).toEqual([['attack', 400, true]]);
    expect(result.state.rngDraws).toBe(1);
    // replay2: the legacy resistanceFlat projection is a stat-buff/debuff group whose armor contribution carries the flat amount (MR rides beside it).
    expect(statusEvents(result.events).flatMap(e => e.kind === 'stat-buff' || e.kind === 'stat-debuff' ? e.group.contributions.filter(c => c.application.modifier?.stat === 'armor' && c.application.modifier.value.kind === 'constant').map(c => (c.application.modifier!.value as { amount: number }).amount) : [])).toEqual([100, 100]);
  });
  it('rolls A/B/C independently in target order: seed42 words .252/.088/.577', () => {
    const actor = hero('zyra', true), auth = actor.spellCrit!;
    const result = stepCombat(battle([{ ...actor, spellCrit: { ...auth, chanceBps: 2500 } }, dummy('eA'), dummy('eB', 3, 3), dummy('eC', 2, 4)], { rngState: 42, rngDraws: 0 }));
    // replay2 pre-crit raw on the critical eB packet: old post-crit 133 = floor(95×14000/10000).
    expect(packets(result.events).map(e => [e.unitId, e.raw, e.critical])).toEqual([['eA', 260, false], ['eB', 95, true], ['eC', 95, false]]);
    expect(result.state.rngDraws).toBe(3);
  });
  it('cancelled Maddie future shots cost zero words; the committed first shot retains its word', () => {
    const first = stepCombat(battle([hero('maddie', true), dummy()], { rngState: 42, rngDraws: 0 }));
    // B9: the same stun (source control/c/e, value0, [2,100)) as a frozen contribution; legacy-only statuses are rejected by S13.
    const stun = applyStatusContribution(first.state.units.find(u => u.id === 'p')!.mechanismState!.statuses, effectIdentity(first.state.combatId ?? 'standalone', source('control', 'c', 'e'), 'p'),
      { kind: 'stun', magnitudeBps: 0, activation: 'immediate', duration: { kind: 'ticks', ticks: 98 }, stackPolicy: { kind: 'independent-instances' }, removable: true, polarity: 'harmful', damageFilter: null, onEnd: null }, 2).groups;
    const frozen = stun.find(g => g.kind === 'stun')?.contributions[0];
    if (frozen?.appliedAtTick !== 2 || frozen.expiresAtTick !== 100) throw new Error('fixture status mismatch');
    const state = { ...first.state, units: first.state.units.map(u => u.id !== 'p' ? u : { ...u, mechanismState: { ...u.mechanismState!, statuses: stun } }) };
    expect(advance(state, 23).state.rngDraws).toBe(1);
  });
  it('Lux appended damage draws separately from the basic packet', () => {
    let first = stepCombat(battle([hero('lux', true), dummy()], { rngState: 42, rngDraws: 0 })).state;
    first = { ...first, units: first.units.map(u => u.id !== 'p' ? u : { ...u, spellCrit: { ...u.spellCrit!, chanceBps: 2500 } }) };
    const result = advance(first, 20);
    // replay2 pre-crit raw on the critical packet: old post-crit 504 = floor(360×14000/10000).
    expect(packets(result.events).map(e => [e.raw, e.critical])).toEqual([[100, false], [360, true]]);
    expect(result.state.rngDraws).toBe(2);
  });
  it('Tristana overflow retains its critical fact and waits for the next tick without drawing again', () => {
    const first = stepCombat(battle([hero('tristana', true), { ...dummy('eA'), hp: 100 }, { ...dummy('eB', 3, 3), armor: 100 }], { rngState: 42, rngDraws: 0 }));
    // replay2 pre-crit raw on the critical first shot: old post-crit 805 = floor(575×14000/10000).
    expect(packets(first.events).map(e => [e.unitId, e.raw])).toEqual([['eA', 575]]);
    expect(first.state.units.find(u => u.id === 'p')!.tasks).toMatchObject([{ amount: 705, executeAtTick: 2, inherited: { critical: true, portion: 'overkill', resolvedAtTick: 1 } }]);
    const second = stepCombat(first.state);
    expect(packets(second.events).map(e => [e.unitId, e.raw, e.mitigated, e.critical])).toEqual([['eB', 705, 705, true]]);
    expect(second.state.rngDraws).toBe(1);
  });
  it('G02 Gunblade uses positive shield+HP once, omits the caster from friendly healing', () => {
    const gun = { source: source('gunblade', 'i2', 'p'), mechanic: 'gunblade', values: { selfHealBps: 1500, allyHealBps: 2500 } };
    const shieldSource = source('shield', 's', 'e');
    const target = { ...dummy(), shield: 1000, shieldExpiresAtTick: 100, shieldLayers: [{ key: 's', source: shieldSource, granted: 1000, remaining: 1000, absorbed: 0, expiresAtTick: 100 }] };
    const result = stepCombat(battle([{ ...hero('zyra', false), mechanics: [gun] }, target]));
    expect(packets(result.events).map(e => [e.absorbed, e.hpDamage])).toEqual([[260, 0]]);
    expect(heals(result.events).map(e => [e.unitId, e.requested])).toEqual([['p', 39]]); // 260*.15; no ally => no second self heal
  });
  it('aggregates frozen true-damage outcomes as HP only; shields and overkill stay separate', () => {
    const event: M8CombatEvent = { domain: 'combat', combatId: 'c1', eventSeq: 0, tick: 1, type: 'packetDamage',
      outcome: { context: context({ damageType: 'true' }), hit: true, raw: 300, prevented: 0, mitigated: 300, absorbed: 40,
        hpDamage: 70, overkill: 190, critical: false, killingPacket: true } };
    const stats = aggregateStats('run', 'c1', [event]);
    expect(stats.units.find(u => u.unitId === 'u1')).toMatchObject({ hpDamage: 70, trueHpDamage: 70, physicalHpDamage: 0, magicHpDamage: 0 });
    expect(stats.units.find(u => u.unitId === 'A')!.shieldAbsorbed).toBe(40);
  });
});
