import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatUnit, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle, unit } from './combat-helpers';
import { packets, heals, casts } from './helpers/replay2-views';

function hero(name: string, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: name, ability: resolveAbility(name + '-ability', 1),
    hp: 4000, maxHp: 5000, armor: 0, magicResist: 0, mana: 100, maxMana: 100,
    attackDamage: 100, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
function dummy(id = 'e', patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit(id, 'enemy', 2, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 10000, maxHp: 10000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], ...patch });
}
function advance(initial: CombatState, count: number) {
  let state = initial; const events: CombatEvent[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const step = stepCombat(state); state = step.state; events.push(...step.events); }
  return { state, events };
}
const raw = (events: readonly CombatEvent[]) => packets(events).filter(p => p.source.ownerId === 'p').map(p => p.raw);

describe('G2-1 independent fixed-seed skill oracles (seed 42)', () => {
  it('Vladimir: 140 magic damage and 200 healing at AP100', () => {
    const r = stepCombat(battle([hero('vladimir'), dummy()], { rngState: 42 }));
    expect(raw(r.events)).toEqual([140]); expect(r.state.units.find(u => u.id === 'e')!.hp).toBe(9860);
    expect(heals(r.events).find(h => h.unitId === 'p')?.actual).toBe(200);
  });
  it('Violet: two 135% AD jabs then 330% AD + 20 AP, five next-tick stun ticks', () => {
    const r = stepCombat(battle([hero('violet'), dummy()], { rngState: 42 }));
    expect(raw(r.events)).toEqual([135, 135, 350]);
    expect(r.state.units.find(u => u.id === 'e')!.statuses).toContainEqual(expect.objectContaining({ kind: 'stun', startsAtTick: 2, expiresAtTick: 7 }));
  });
  it('Powder: center 350, one hex 245, wound/burn anchored for 100 ticks', () => {
    const r = stepCombat(battle([hero('powder'), dummy(), dummy('e2', { cell: { col: 3, row: 3 } })], { rngState: 42 }));
    expect(raw(r.events)).toEqual([350, 245]);
    expect(r.state.units.find(u => u.id === 'e')!.mechanismState!.statuses.map(s => s.kind)).toContain('burn');
  });
  it('Ekko: primary 290, secondary 145, flat MR reduction 5', () => {
    const r = stepCombat(battle([hero('ekko'), dummy(), dummy('e2', { cell: { col: 3, row: 3 } })], { rngState: 42 }));
    expect(raw(r.events)).toEqual([290, 145]);
    expect(r.state.units.find(u => u.id === 'e')!.mechanismState!.statuses).toHaveLength(1);
  });
  it('Blitzcrank: 470 shield and 40 magic damage plus an outgoing damage debuff', () => {
    const r = stepCombat(battle([hero('blitzcrank'), dummy()], { rngState: 42 }));
    expect(raw(r.events)).toEqual([40]); expect(r.state.units.find(u => u.id === 'p')!.shield).toBe(470);
  });
  it('LeBlanc: split 650 exactly between two chains and 160 on next attack', () => {
    const r = advance(battle([hero('leblanc'), dummy(), dummy('e2', { cell: { col: 3, row: 3 } })], { rngState: 42 }), 22);
    expect(raw(r.events).slice(0, 2)).toEqual([325, 325]);
    expect(raw(r.events)).toContain(160); expect(r.state.units.find(u => u.id === 'p')!.expansion!.attacksRemaining).toBe(2);
  });
  it('Rumble: five single-target missiles, 500 magic damage each', () => {
    const r = stepCombat(battle([hero('rumble'), dummy()], { rngState: 42 }));
    expect(raw(r.events)).toEqual([500, 500, 500, 500, 500]);
  });
  it('Singed: DR50%, 100% AS then linear decay on highest damage ally', () => {
    const r = stepCombat(battle([hero('singed'), dummy()], { rngState: 42 }));
    expect(r.state.units.find(u => u.id === 'p')!.statuses).toContainEqual(expect.objectContaining({ kind: 'damageReduction', amount: 5000 }));
    expect(r.state.units.find(u => u.id === 'p')!.tasks).toContainEqual(expect.objectContaining({ kind: 'g2SingedSpeed', amount: 10000, ordinal: 1, total: 80 }));
  });
  it('Illaoi: 3 drain pulses starting after one second, final slam scales on armor + MR', () => {
    const r = advance(battle([hero('illaoi', { armor: 100, magicResist: 100 }), dummy()], { rngState: 42 }), 61);
    expect(raw(r.events).filter(n => n === 50)).toHaveLength(3); expect(raw(r.events)).toContain(120);
  });
  it('Nocturne: 120% AD + 15 flat bleed conserves 135 over four pulses', () => {
    const r = advance(battle([hero('nocturne'), dummy()], { rngState: 42 }), 41);
    expect(raw(r.events).filter(n => n === 33 || n === 34)).toEqual([34, 34, 34, 33]);
  });
  it('Twitch: 8 enhanced attacks, 140% AD + 18 AP, deterministic random target', () => {
    const initial = battle([hero('twitch'), dummy()], { rngState: 42 });
    const r = advance(initial, 25); expect(raw(r.events)).toContain(158);
    expect(r.state.units.find(u => u.id === 'p')!.expansion!.attacksRemaining).toBeLessThan(8);
    expect(advance(initial, 25)).toEqual(r);
  });
  it('Malzahar: 80 on cast, five 14-damage infections first pulse at tick21', () => {
    const r = advance(battle([hero('malzahar'), dummy()], { rngState: 42 }), 21);
    expect(raw(r.events).filter(n => n === 14)).toHaveLength(5); expect(raw(r.events)[0]).toBe(80);
  });
  it('Amumu: passive 10 magic damage each second; no cast or mana expenditure', () => {
    const r = advance(battle([hero('amumu', { maxMana: 0, mana: 0, cooldownTicks: 1000 }), dummy()], { rngState: 42 }), 40);
    expect(raw(r.events)).toEqual([10, 10]); expect(casts(r.events)).toHaveLength(0);
  });
  it('Zeri: third basic attack replaces 100 by 200% AD + 10 AP, never casts', () => {
    const r = advance(battle([hero('zeri', { mana: 0, maxMana: 3 }), dummy()], { rngState: 42 }), 41);
    expect(raw(r.events)).toHaveLength(3); expect(raw(r.events)[2]).toBe(210); expect(casts(r.events)).toHaveLength(0);
  });
});

const faction = (id: string, values: Record<string,number>) => ({ source: { ownerId:'p',sourceKind:'trait' as const,definitionId:id,instanceId:`player:${id}`,effectIndex:0 }, mechanic:id,values });
it('Automata: twentieth damage packet resets crystals and schedules 150 + 25% of 2000 damage', async () => {
  const { EMPTY_EXPANSION } = await import('../src/simulation/combat-g2');
  const p = hero('lux', { mana:0, expansion:{...structuredClone(EMPTY_EXPANSION),crystals:19,crystalDamage:1900},mechanics:[faction('automata',{crystals:20,damage:150,conversionBps:2500})] });
  const r = advance(battle([p,dummy()],{rngState:42}),2);
  expect(raw(r.events)).toEqual([100,650]);expect(r.state.units.find(u=>u.id==='p')!.expansion!.crystals).toBe(0);
});
it('Firelight: at six seconds heal 20% of the 100 health damage received since last dash', () => {
  const p=hero('lux',{mana:0,cooldownTicks:1000,mechanics:[faction('firelight',{periodTicks:120,healBps:2000,attackSpeedBps:0,dashTicks:20})]});
  const r=advance(battle([p,dummy('e',{attackDamage:100,cooldownTicks:0,attackIntervalTicks:1000})],{rngState:42}),120);
  expect(heals(r.events).filter(h=>h.unitId==='p').map(h=>h.actual)).toEqual([20]);expect(r.state.units.find(u=>u.id==='p')!.hp).toBe(3920);
});
it('Family: active durability reduces a 100-damage attack to 80', () => {
  const p=hero('lux',{mana:0,cooldownTicks:1000,mechanics:[faction('family',{manaReductionBps:2500,damageReductionBps:2000,heist:0})]});
  const r=stepCombat(battle([p,dummy('e',{attackDamage:100,cooldownTicks:0})],{rngState:42}));expect(r.state.units.find(u=>u.id==='p')!.hp).toBe(3920);
});
it('LeBlanc: one initial kill increases each empowered attack from 160 to 240', () => {
  const r=advance(battle([hero('leblanc'),dummy('e',{hp:100}),dummy('e2',{cell:{col:3,row:3}})],{rngState:42}),22);
  expect(raw(r.events)).toContain(240);expect(r.state.units.find(u=>u.id==='p')!.expansion!.chainKills).toBe(1);
});
it('Blitzcrank: first surviving hit retaliates next tick for 3%, without a one-second warmup', () => {
  const r=advance(battle([hero('blitzcrank',{mana:0,cooldownTicks:1000}),dummy('e',{attackDamage:100,cooldownTicks:0})],{rngState:42}),2);
  expect(raw(r.events)).toEqual([3]);
});
