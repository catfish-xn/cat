import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit, type CombatMechanic, type CombatOrigin, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, amount, ad, origin, sourceKey, type S13Unit } from '../src/simulation/combat-s13-state';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { applyCombatStart } from '../src/simulation/combat-effects';
import { makeSourcedEffects, resolveEffects, cloneEffect } from '../src/simulation/effects';
import { getUnitStats } from '../src/simulation/unit-stats';
import { battle, unit } from './combat-helpers';

function hero(name: string, id = 'p', overrides: Partial<CombatUnit> = {}): CombatUnit {
  return unit(id, id.startsWith('e') ? 'enemy' : 'player', id.startsWith('e') ? 2 : 1, 3, {
    definitionId: name, ability: resolveAbility(`${name}-ability`, 1), hp: 5000, maxHp: 5000, armor: 0, magicResist: 0,
    mana: 100, maxMana: 100, attackDamage: 100, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...overrides,
  });
}
function dummy(id = 'e', col = 2, row = 3, overrides: Partial<CombatUnit> = {}): CombatUnit {
  return unit(id, id.startsWith('e') ? 'enemy' : 'player', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 10000, maxHp: 10000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
    statuses: [], shieldLayers: [], tasks: [], runtime: { ...EMPTY_RUNTIME }, ...overrides });
}
const source = (ownerId: string, id = 'test'): CombatOrigin => ({ ownerId, sourceKind: 'item', definitionId: id, instanceId: id, effectIndex: 0 });
const mechanic = (ownerId: string, name: string, values: Record<string, number>): CombatMechanic => ({ source: source(ownerId, name), mechanic: name, values });
function advance(initial: CombatState, ticks: number): { state: CombatState; events: CombatEvent[] } {
  let state = initial; const events: CombatEvent[] = [];
  for (let n = 0; n < ticks && state.status === 'running'; n++) { const step = stepCombat(state); state = step.state; events.push(...step.events); }
  return { state, events };
}
const packets = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'packetDamage');

describe('M5 independent finite combat rules', () => {
  it('resolves all 19 historical abilities as integer-only isolated snapshots', () => {
    expect(Object.keys(S13_ABILITY_DATA)).toHaveLength(19);
    for (const id of Object.keys(S13_ABILITY_DATA)) for (const star of [1, 2, 3] as const) {
      const ability = resolveAbility(id, star);
      expect(ability.kind).toBe('s13');
      if (ability.kind !== 's13') throw Error('Expected S13');
      expect(Object.values(ability.variables).every(Number.isSafeInteger)).toBe(true);
      expect(JSON.parse(JSON.stringify(ability))).toEqual(ability);
    }
    expect(() => resolveAbility('__proto__', 1)).toThrow();
  });
  it('has an independent AD/AP mixed oracle: 10 + 80×1.5 + 120×200/100 = 370', () => {
    const owner = hero('lux', 'p', { attackDamage: 80, abilityPower: 120 }) as S13Unit;
    expect(amount(owner, 1, { flat: 10, ad: 1.5, ap: 200 })).toBe(370);
  });
  it('casts every authored hero and emits finite deterministic JSON state', () => {
    for (const name of Object.values(S13_ABILITY_DATA).map(a => a.championId)) {
      const state = battle([hero(name), dummy(), dummy('e2', 3, 3), dummy('e3', 3, 4)], { rngState: 42, rngDraws: 0 });
      const step = stepCombat(state);
      expect(step.events.some(e => e.type === 'cast' && e.sourceId === 'p'), name).toBe(true);
      expect(stepCombat(JSON.parse(JSON.stringify(step.state)))).toEqual(stepCombat(step.state));
      expect(step.state.units.every(u => Number.isSafeInteger(u.hp) && Number.isSafeInteger(u.shield)), name).toBe(true);
    }
  });
  it('uses AP-scaled Zyra damage, distinct secondary targets, and next-tick stun', () => {
    const result = stepCombat(battle([hero('zyra'), dummy(), dummy('e2', 3, 3), dummy('e3', 3, 4)]));
    expect(packets(result.events).filter(p => p.source.ownerId === 'p').map(p => [p.unitId, p.raw])).toEqual([['e', 260], ['e2', 95], ['e3', 95]]);
    const stun = result.state.units.find(u => u.id === 'e')!.statuses![0];
    expect(stun).toMatchObject({ kind: 'stun', startsAtTick: 2, expiresAtTick: 22 });
  });
  it('Lux selects lowest current HP rather than percentage and buffs only the next attack', () => {
    const result = stepCombat(battle([hero('lux'), dummy(), dummy('p2', 0, 3, { hp: 50, maxHp: 100 }), dummy('p3', 0, 4, { hp: 100, maxHp: 1000 })]));
    expect(result.state.units.find(u => u.id === 'p2')!.shield).toBe(160);
    expect(result.state.units.find(u => u.id === 'p3')!.shield).toBe(0);
    expect(result.state.units.find(u => u.id === 'p')!.runtime!.nextAttackMagic).toBe(360);
    const next = advance(result.state, 20);
    expect(packets(next.events).filter(p => p.source.definitionId === 'lux-ability' && p.source.sourceKind === 'ability')).toHaveLength(1);
    expect(next.state.units.find(u => u.id === 'p')!.runtime!.nextAttackMagic).toBe(0);
  });
  it('Darius bleed has four conserving tasks and persists after source death', () => {
    const initial = stepCombat(battle([hero('darius'), dummy()]));
    const owner = initial.state.units.find(u => u.id === 'p')!;
    expect(owner.tasks!.filter(t => t.kind === 'bleed').map(t => [t.executeAtTick, t.amount])).toEqual([[21, 50], [41, 50], [61, 50], [81, 50]]);
    const state = { ...initial.state, units: [...initial.state.units.map(u => u.id === 'p' ? { ...u, alive: false, hp: 0, mana: 0 } : u), dummy('p2', 0, 0)] };
    const later = advance(state, 80);
    expect(packets(later.events).filter(p => p.source.ownerId === 'p').map(p => p.raw)).toEqual([50, 50, 50, 50]);
  });
  it('Maddie six shots use fixed offsets and the first enemy along the path intercepts', () => {
    const result = advance(battle([hero('maddie'), dummy(), dummy('e2', 5, 3)]), 24);
    const shots = packets(result.events).filter(p => p.source.definitionId === 'maddie-ability');
    expect(shots.map(p => p.tick)).toEqual([1, 5, 10, 14, 19, 24]);
    expect(shots.every(p => p.unitId === 'e' && p.raw === 135)).toBe(true);
  });
  it('cancels future multishots after control without undoing committed same-tick shots', () => {
    const initial = stepCombat(battle([hero('maddie'), dummy()]));
    const state = { ...initial.state, units: initial.state.units.map(u => u.id !== 'p' ? u : { ...u, statuses: [...u.statuses!, {
      key: 'stun', kind: 'stun' as const, source: source('e'), amount: 0, startsAtTick: 2, expiresAtTick: 50,
    }] }) };
    const result = advance(state, 30);
    expect(packets(initial.events)).toHaveLength(1);
    expect(packets(result.events).filter(p => p.source.ownerId === 'p')).toHaveLength(0);
    expect(result.state.units.find(u => u.id === 'p')!.tasks).toEqual([]);
  });
  it('Kog stacks speed and each third cast adds range with no cross-battle state', () => {
    let state = battle([hero('kogmaw'), dummy()]);
    for (let n = 0; n < 3; n++) {
      state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, mana: 100 } : u) };
      state = stepCombat(state).state;
    }
    expect(state.units.find(u => u.id === 'p')!.runtime).toMatchObject({ castCount: 3, attackSpeedBps: 7500, rangeBonus: 1 });
    expect(hero('kogmaw').runtime).toMatchObject({ castCount: 0, attackSpeedBps: 0, rangeBonus: 0 });
  });
  it('Nami hits each target at most once and Zoe returns to primary between unique far targets', () => {
    const roster = [dummy(), dummy('e2', 3, 3), dummy('e3', 4, 3), dummy('e4', 4, 4)];
    const nami = stepCombat(battle([hero('nami'), ...roster]));
    expect(packets(nami.events).filter(p => p.source.ownerId === 'p')).toHaveLength(4);
    const zoe = stepCombat(battle([hero('zoe'), ...roster]));
    const cast = zoe.events.find(e => e.type === 'cast');
    // On the odd-r grid both far candidates are distance 2; code-point ID selects e3 first.
    expect(cast?.type === 'cast' ? cast.targetIds : []).toEqual(['e', 'e3', 'e', 'e4', 'e']);
  });
  it('Corki emits 21 packets one per tick, empowering every seventh and storing per-missile shred', () => {
    const result = advance(battle([hero('corki'), dummy()]), 21);
    const shots = packets(result.events).filter(p => p.source.definitionId === 'corki-ability');
    expect(shots).toHaveLength(21);
    expect(shots.map(p => p.raw)).toEqual(Array.from({ length: 21 }, (_, n) => (n + 1) % 7 === 0 ? 287 : 41));
    expect(result.state.units.find(u => u.id === 'e')!.statuses!.filter(s => s.kind === 'resistanceFlat')).toHaveLength(21);
  });
  it('Caitlyn commits four bomb centers over five seconds and consumes one word per center', () => {
    const result = advance(battle([hero('caitlyn'), dummy()], { rngState: 42 }), 100);
    expect(packets(result.events).filter(p => p.source.ownerId === 'p').map(p => p.tick)).toEqual([1, 1, 26, 26, 51, 51, 76, 76]);
    expect(result.state.rngDraws).toBe(4);
  });
  it('Vander remains immobile and cannot autoattack for exactly 50 ticks', () => {
    const initial = stepCombat(battle([hero('vander', 'p', { mechanics: [mechanic('p', 'lowCostAllies', { count: 3 })] }), dummy()]));
    expect(initial.state.units.find(u => u.id === 'p')!.runtime!.nextAttackPhysical).toBe(700);
    const waiting = advance(initial.state, 49);
    expect(waiting.events.some(e => e.type === 'attack' && e.attackerId === 'p')).toBe(false);
    // Damage Mana gained while bracing may refill the bar; the promised next strike still takes priority.
    const end = stepCombat({ ...waiting.state, units: waiting.state.units.map(u => u.id === 'p' ? { ...u, mana: 100 } : u) });
    expect(end.events.some(e => e.type === 'attack' && e.attackerId === 'p')).toBe(true);
    expect(end.state.units.find(u => u.id === 'p')!.runtime!.nextAttackPhysical).toBe(0);
  });
  it('Tristana overkill schedules one committed bounce and grants exactly 125 AD bps', () => {
    const initial = stepCombat(battle([hero('tristana'), dummy('e', 2, 3, { hp: 100 }), dummy('e2', 3, 3)]));
    const owner = initial.state.units.find(u => u.id === 'p')!;
    expect(owner.tasks).toEqual([expect.objectContaining({ kind: 'tristanaBounce', amount: 475, executeAtTick: 2 })]);
    expect(owner.runtime!.permanentAdBps).toBe(125);
    const next = stepCombat(initial.state);
    expect(packets(next.events).find(p => p.source.ownerId === 'p')).toMatchObject({ raw: 475, hpDamage: 475 });
    expect(next.state.units.find(u => u.id === 'p')!.tasks).toEqual([]);
  });
  it('Irelia preserves absorbed damage through shield depletion and explodes exactly once', () => {
    const initial = stepCombat(battle([hero('irelia'), dummy('e', 2, 3, { cooldownTicks: 0, attackDamage: 500 })]));
    expect(initial.state.units.find(u => u.id === 'p')!.shield).toBe(0);
    expect(initial.state.units.find(u => u.id === 'p')!.shieldLayers![0].absorbed).toBe(400);
    const next = stepCombat(initial.state);
    expect(packets(next.events).filter(p => p.source.ownerId === 'p').map(p => p.raw)).toEqual([190]);
    expect(next.state.units.find(u => u.id === 'p')!.tasks).toEqual([]);
  });
  it('Loris transfers half post-mitigation damage once and uses his shield without a second armor reduction', () => {
    const result = stepCombat(battle([hero('loris', 'p', { armor: 1000 }), dummy('a', 1, 2, { armor: 100 }),
      dummy('e', 2, 2, { cooldownTicks: 0, attackDamage: 200, attackRange: 1 })]));
    expect(packets(result.events).filter(p => p.source.ownerId === 'e').map(p => [p.unitId, p.mitigated, p.absorbed, p.hpDamage, p.redirected]))
      .toEqual([['a', 50, 0, 50, false], ['p', 50, 50, 0, true]]);
  });
  it('layered shields add across sources and consume earliest-expiring then source key', () => {
    const layers = [{ key: 'a', source: source('p', 'a'), granted: 60, remaining: 60, absorbed: 0, expiresAtTick: 10 },
      { key: 'b', source: source('p', 'b'), granted: 40, remaining: 40, absorbed: 0, expiresAtTick: 20 }];
    const result = stepCombat(battle([hero('lux', 'p', { mana: 0, cooldownTicks: 100, shield: 100, shieldExpiresAtTick: 20, shieldLayers: layers }),
      dummy('e', 2, 3, { cooldownTicks: 0, attackDamage: 70 })]));
    expect(result.state.units.find(u => u.id === 'p')!.shieldLayers).toEqual([expect.objectContaining({ key: 'b', remaining: 30, absorbed: 10 })]);
  });
  it('simultaneous lethal casts both land and no same-tick healing revives the dead', () => {
    const result = stepCombat(battle([hero('scar', 'p', { hp: 50 }), hero('zyra', 'e', { hp: 50 })]));
    expect(result.state.result).toBe('draw');
    expect(result.state.units.every(u => !u.alive && u.hp === 0 && u.mana === 0)).toBe(true);
    expect(result.events.filter(e => e.type === 'heal')).toEqual([]);
  });
  it('damage mana is floor(HP loss×3%) and positive damage rounds each separate packet', () => {
    const result = stepCombat(battle([hero('ezreal'), hero('lux', 'e', { mana: 0, cooldownTicks: 1000, armor: 100 })]));
    // Ezreal 155/2 -> 77, center270/2 ->135, total212; mana floor(212*.03)=6.
    expect(result.state.units.find(u => u.id === 'e')!.mana).toBe(6);
    expect(packets(result.events).filter(p => p.source.ownerId === 'p').map(p => p.mitigated)).toEqual([77, 135]);
  });
  it('uses an explicit crit word for every planned attack including zero-probability neutrals', () => {
    const result = stepCombat(battle([hero('lux', 'p', { mana: 0 }), dummy('e', 2, 3, { cooldownTicks: 0, attackDamage: 100 })], { rngState: 42, rngDraws: 0 }));
    expect(result.state.rngDraws).toBe(2);
    expect(packets(result.events).filter(p => p.source.sourceKind === 'attack').map(p => [p.source.ownerId, p.critical, p.raw])).toEqual([['e', false, 100], ['p', true, 140]]);
  });
  it('Gunblade consumes actual HP damage, healing cannot recursively cause damage', () => {
    const result = stepCombat(battle([hero('zyra', 'p', { hp: 4000, mechanics: [mechanic('p', 'gunblade', { selfHealBps: 1500, allyHealBps: 2500 })] }),
      dummy('e', 2, 3, { hp: 100 }), dummy('p2', 0, 3, { hp: 100, maxHp: 1000 })]));
    expect(result.events.filter(e => e.type === 'heal').map(e => [e.unitId, e.requested, e.actual])).toEqual([['p', 15, 15], ['p2', 25, 25]]);
    expect(packets(result.events).filter(p => p.source.ownerId === 'p')).toHaveLength(1);
  });
  it('roundtrips every tick and stays invariant under unit enumeration, including multishots and RNG', () => {
    let state = battle([hero('caitlyn'), hero('maddie', 'e'), dummy('e2', 4, 3)], { rngState: 9384 });
    for (let n = 0; n < 110 && state.status === 'running'; n++) {
      const direct = stepCombat(state), restored = stepCombat(JSON.parse(JSON.stringify(state)));
      const permuted = stepCombat({ ...state, units: [...state.units].reverse() });
      expect(restored).toEqual(direct); expect(permuted).toEqual(direct); state = direct.state;
    }
  });
  it('Rell steals 10 defenses per hit, persists after target death, and one-star shield is 300', () => {
    const first = stepCombat(battle([hero('rell'), dummy('e', 2, 3, { hp: 50, armor: 40, magicResist: 40 }), dummy('e2', 4, 3)]));
    const owner = first.state.units.find(u => u.id === 'p')!;
    expect(owner.shield).toBe(300);
    expect(owner.statuses).toEqual([expect.objectContaining({ kind: 'resistanceFlat', amount: 10, expiresAtTick: 1202 })]);
    expect(first.state.units.find(u => u.id === 'e')!.alive).toBe(false);
    expect(stepCombat(first.state).state.units.find(u => u.id === 'p')!.statuses).toEqual(owner.statuses);
  });
  it('Urgot uses primary335/secondary185 damage and strongest armor shred begins next tick', () => {
    const result = stepCombat(battle([hero('urgot'), dummy(), dummy('e2', 3, 3)]));
    // 100 AD×3 +35AP100=335; secondary100×1.5+35=185.
    expect(packets(result.events).filter(p => p.source.ownerId === 'p').map(p => [p.unitId, p.raw])).toEqual([['e', 335], ['e2', 185]]);
    expect(result.state.units.filter(u => u.team === 'enemy').every(u => u.statuses!.some(s => s.amount === 2000 && s.startsAtTick === 2 && s.expiresAtTick === 122))).toBe(true);
  });
  it('Leona prevents 50% incoming damage immediately and explodes on exact ending tick', () => {
    const first = stepCombat(battle([hero('leona'), dummy('e', 2, 3, { attackDamage: 100, cooldownTicks: 0 })]));
    expect(first.state.units.find(u => u.id === 'p')!.hp).toBe(4950);
    const end = advance(first.state, 60);
    expect(packets(end.events).filter(p => p.source.definitionId === 'leona-ability' && p.source.sourceKind === 'ability')).toEqual([expect.objectContaining({ tick: 61, raw: 115 })]);
  });
  it('Garen heals once for his entire multi-target cast, and gets a four-second HP/AP shield', () => {
    const result = stepCombat(battle([hero('garen', 'p', { hp: 4000 }), dummy(), dummy('e2', 3, 3), dummy('e3', 4, 3)]));
    const owner = result.state.units.find(u => u.id === 'p')!;
    // 5000*.15+200=950 shield, passive5000*.015=75.
    expect(owner.shieldLayers![0]).toMatchObject({ granted: 950, remaining: 950, expiresAtTick: 81 });
    expect(result.events.filter(e => e.type === 'heal')).toEqual([expect.objectContaining({ unitId: 'p', requested: 75, actual: 75 })]);
    expect(packets(result.events).filter(p => p.source.ownerId === 'p').map(p => p.raw)).toEqual([250, 125, 125]);
  });
  it('Irelia integer linear decay conserves exactly 400 shield over 60 ticks', () => {
    const first = stepCombat(battle([hero('irelia'), dummy()]));
    const second = stepCombat(first.state);
    expect(second.state.units.find(u => u.id === 'p')!.shield).toBe(394);
    const almost = advance(first.state, 59);
    expect(almost.state.units.find(u => u.id === 'p')!.shield).toBe(7);
    const end = stepCombat(almost.state);
    expect(packets(end.events).filter(p => p.source.definitionId === 'irelia-ability' && p.source.sourceKind === 'ability')).toEqual([expect.objectContaining({ raw: 70, tick: 61 })]);
  });
  it('Tristana last-enemy kill has no ricochet growth and committed bounce never recurses', () => {
    const finalKill = stepCombat(battle([hero('tristana'), dummy('e', 2, 3, { hp: 100 })]));
    expect(finalKill.state.units.find(u => u.id === 'p')!.runtime!.permanentAdBps).toBe(0);
    const first = stepCombat(battle([hero('tristana'), dummy('e', 2, 3, { hp: 100 }), dummy('e2', 3, 3, { hp: 10 }), dummy('e3', 4, 3)]));
    const next = stepCombat(first.state);
    expect(next.state.units.find(u => u.id === 'p')!.runtime!.permanentAdBps).toBe(125);
    expect(next.state.units.find(u => u.id === 'p')!.tasks).toEqual([]);
    expect(next.state.units.find(u => u.id === 'e3')!.hp).toBe(10000);
  });
  it('Tristana growth adds to static percentages instead of multiplying item bonuses again', () => {
    const owner = hero('tristana', 'p', { attackDamage: 155, attackDamageBase: 100, attackDamagePercentBps: 5500,
      runtime: { ...EMPTY_RUNTIME, permanentAdBps: 10000 } }) as S13Unit;
    expect(ad(owner)).toBe(255); // 100*(1+.55+1), not155*2=310.
  });
  it('Kill Streak belongs to the first lethal packet and only a surviving owner gets mana', () => {
    const m = mechanic('p', 'killStreak', { mana: 20 });
    const alive = stepCombat(battle([hero('zyra', 'p', { mechanics: [m] }), dummy('e', 2, 3, { hp: 100 }), dummy('e2', 3, 3)]));
    expect(alive.state.units.find(u => u.id === 'p')!.mana).toBe(20);
    expect(alive.events.filter(e => e.type === 'kill')).toEqual([expect.objectContaining({ unitId: 'e', source: expect.objectContaining({ ownerId: 'p' }) })]);
    const dead = stepCombat(battle([hero('zyra', 'p', { hp: 50, mechanics: [m] }), hero('zyra', 'e', { hp: 50 })]));
    expect(dead.state.units.find(u => u.id === 'p')!.mana).toBe(0);
  });
  it('Sniper distance amplification and Watcher threshold use pre-damage HP with strict greater-than', () => {
    const attacker = hero('lux', 'p', { mana: 0, mechanics: [mechanic('p', 'sniper', { damageBpsPerHex: 700 })] });
    const watch = mechanic('e', 'watcher', { reductionBps: 1500, healthyReductionBps: 3000, thresholdBps: 5000 });
    const atHalf = stepCombat(battle([attacker, dummy('e', 3, 3, { hp: 500, maxHp: 1000, mechanics: [watch] })], { rngState: 42 }));
    // seed42 firstword1083814273 exceeds25% threshold, no crit: floor(100*1.14*.85)=96.
    expect(packets(atHalf.events)[0]).toMatchObject({ raw: 100, mitigated: 96 });
    const above = stepCombat(battle([attacker, dummy('e', 3, 3, { hp: 501, maxHp: 1000, mechanics: [watch] })], { rngState: 42 }));
    expect(packets(above.events)[0].mitigated).toBe(79);
  });
  it('Artillery and Titanic each create one derived AoE without incrementing the primary counter', () => {
    const result = stepCombat(battle([hero('lux', 'p', { mana: 0, runtime: { ...EMPTY_RUNTIME, attackCount: 4 }, mechanics: [
      mechanic('p', 'artillery', { everyN: 5, adBps: 12500, radius: 1 }), mechanic('p', 'titanic', { adBps: 4000, radius: 1 }),
    ] }), dummy(), dummy('e2', 3, 3)], { rngState: 42 }));
    expect(result.state.units.find(u => u.id === 'p')!.runtime!.attackCount).toBe(5);
    expect(packets(result.events).filter(p => p.source.definitionId === 'artillery').map(p => p.raw)).toEqual([125, 125]);
    expect(packets(result.events).filter(p => p.source.definitionId === 'titanic').map(p => p.raw)).toEqual([40, 40]);
  });
  it('Rageblade and periodic AP/heal mechanics emit their own source provenance', () => {
    const owner = hero('lux', 'p', { hp: 4000, mana: 0, mechanics: [mechanic('p', 'rageblade', { attackSpeedBps: 500 }),
      mechanic('p', 'archangel', { periodTicks: 100, abilityPower: 30 }), mechanic('p', 'dragonClaw', { periodTicks: 40, healMaxHpBps: 250 })] });
    const attack = stepCombat(battle([owner, dummy()], { rngState: 42 }));
    expect(attack.events.find(e => e.type === 'statChanged')).toMatchObject({ source: source('p', 'rageblade'), before: 0, after: 500 });
    const periodic = stepCombat(battle([{ ...owner, cooldownTicks: 1000 }, dummy()], { tick: 199 }));
    expect(periodic.events.find(e => e.type === 'statChanged')).toMatchObject({ source: source('p', 'archangel'), before: 100, after: 130 });
    expect(periodic.events.find(e => e.type === 'heal')).toMatchObject({ source: source('p', 'dragonClaw'), requested: 125, actual: 125 });
  });
  it('Bulky Buddies grants its one-time sourced shield only after the frozen buddy dies', () => {
    const buddy = { ...mechanic('p', 'bulkyBuddies', { shieldMaxHpBps: 1000, durationTicks: 200 }), targetId: 'a' };
    const result = stepCombat(battle([hero('lux', 'p', { mana: 0, cooldownTicks: 1000, mechanics: [buddy] }),
      dummy('a', 1, 2, { hp: 10 }), dummy('e', 2, 2, { cooldownTicks: 0, attackDamage: 100 })]));
    expect(result.state.units.find(u => u.id === 'p')!.runtime!.buddyTriggered).toBe(true);
    expect(result.state.units.find(u => u.id === 'p')!.shieldLayers).toEqual([expect.objectContaining({ source: buddy.source, granted: 500, expiresAtTick: 201 })]);
  });
  it('Scar, Nami, Zoe and Caitlyn have explicit independent one-star damage and healing answers', () => {
    const scar = stepCombat(battle([hero('scar', 'p', { hp: 4900 }), dummy(), dummy('e2', 3, 3), dummy('e3', 4, 3)]));
    expect(packets(scar.events).map(p => p.raw)).toEqual([80, 80, 80]);
    expect(scar.events.find(e => e.type === 'heal')).toMatchObject({ requested: 220, actual: 100, overheal: 120 });
    expect(scar.state.units.find(u => u.id === 'e')!.statuses![0]).toMatchObject({ startsAtTick: 2, expiresAtTick: 32 });
    for (const [name, expected] of [['nami', 120], ['zoe', 140]] as const) {
      const result = stepCombat(battle([hero(name), dummy()]));
      expect(packets(result.events).map(p => p.raw)).toEqual([expected]);
    }
    const caitlyn = stepCombat(battle([hero('caitlyn'), dummy()], { rngState: 42 }));
    expect(packets(caitlyn.events).map(p => p.raw)).toEqual([200, 280]);
    expect(caitlyn.state.units.find(u => u.id === 'e')!.statuses![0]).toMatchObject({ kind: 'resistanceFlat', amount: -20, startsAtTick: 2 });
  });
  it('Kog passive and Darius initial spin use distinct noncritical magic/physical coefficients', () => {
    const kog = stepCombat(battle([hero('kogmaw', 'p', { mana: 0, abilityPower: 150 }), dummy()], { rngState: 42 }));
    expect(packets(kog.events).map(p => [p.damageType, p.raw, p.critical])).toEqual([['physical', 100, false], ['magic', 72, false]]);
    const darius = stepCombat(battle([hero('darius', 'p', { hp: 4700 }), dummy(), dummy('e2', 1, 2)]));
    expect(packets(darius.events).map(p => p.raw)).toEqual([240, 240]);
    expect(darius.events.find(e => e.type === 'heal')).toMatchObject({ requested: 150, actual: 150 });
    expect(darius.state.units.find(u => u.id === 'p')!.tasks!.map(t => t.targetId)).toEqual(['e', 'e', 'e', 'e']);
  });
  it('same-source shields refresh strongest remaining amount without firing an old end task', () => {
    const initial = stepCombat(battle([hero('irelia'), dummy()]));
    const refresh = stepCombat({ ...initial.state, units: initial.state.units.map(u => u.id === 'p' ? { ...u, mana: 100 } : u) });
    const owner = refresh.state.units.find(u => u.id === 'p')!;
    expect(owner.shieldLayers).toHaveLength(1); expect(owner.shield).toBe(400);
    expect(owner.tasks).toEqual([expect.objectContaining({ kind: 'ireliaEnd', executeAtTick: 62 })]);
    expect(packets(refresh.events)).toEqual([]);
  });
  it('multiple redirects choose the smallest protector ID and transferred damage cannot redirect again', () => {
    const result = stepCombat(battle([hero('loris', 'p'), hero('loris', 'p2', { cell: { col: 0, row: 2 } }),
      dummy('a', 1, 2), dummy('e', 2, 2, { cooldownTicks: 0, attackDamage: 100 })]));
    expect(packets(result.events).filter(p => p.redirected).map(p => [p.unitId, p.mitigated])).toEqual([['p', 50]]);
  });
  it('derived AoE packet ordinals are unique and item enumeration cannot choose a different killer', () => {
    const mechanics = [mechanic('p', 'titanic', { adBps: 4000, radius: 1 }), mechanic('p', 'artillery', { everyN: 5, adBps: 12500, radius: 1 })];
    const run = (list: CombatMechanic[]) => stepCombat(battle([hero('lux', 'p', { mana: 0, runtime: { ...EMPTY_RUNTIME, attackCount: 4 }, mechanics: list }), dummy()], { rngState: 42 }));
    expect(run(mechanics).events).toEqual(run([...mechanics].reverse()).events);
    expect(packets(run(mechanics).events).map(p => p.packetOrdinal)).toEqual([0, 3, 4]);
  });
  it('one-second next-tick stun blocks exactly20 logical action opportunities before expiring', () => {
    const first = stepCombat(battle([hero('zyra'), dummy('e', 2, 3, { cooldownTicks: 0, attackIntervalTicks: 1, baseAttackSpeedBps: 200000 })]));
    const blocked = advance(first.state, 20);
    expect(blocked.events.filter(e => e.type === 'attack' && e.attackerId === 'e')).toHaveLength(0);
    const expired = stepCombat(blocked.state);
    expect(expired.state.tick).toBe(22);
    expect(expired.events.filter(e => e.type === 'attack' && e.attackerId === 'e')).toHaveLength(1);
  });
  it('existing finite hooks also work on S13, retain counters, and never recurse derived damage', () => {
    const sourced = makeSourcedEffects('p', 'item', 'rageblade', 'i1', [
      { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 60, durationTicks: 10 } },
      { kind: 'trigger', hook: 'onAttack', everyN: 1, action: { kind: 'dealDamage', damageType: 'magic', amount: 25 } },
      { kind: 'trigger', hook: 'onHpLoss', everyN: 1, action: { kind: 'gainMana', amount: 3 } },
    ]);
    const resolved = resolveEffects(getUnitStats('lux', 1), resolveAbility('lux-ability', 1), sourced);
    const state = battle([hero('lux', 'p', { mana: 0, sources: resolved.sources, triggers: resolved.triggers,
      effectRuntime: resolved.triggers.map(t => ({ key: t.key, count: 0 })) }), dummy('e', 2, 3, { cooldownTicks: 0, attackDamage: 100 })],
    { strategy: { traits: [], units: [] }, combatId: 'hooks', nextEventSeq: 0, rngState: 42 });
    const start = applyCombatStart(state);
    expect(start.state.units.find(u => u.id === 'p')!.shieldLayers).toEqual([expect.objectContaining({ granted: 60, remaining: 60 })]);
    expect(applyCombatStart(start.state).events).toEqual([]);
    const result = stepCombat(start.state);
    expect(packets(result.events).filter(p => p.source.ownerId === 'p').map(p => p.raw)).toEqual([140, 25]);
    expect(result.state.units.find(u => u.id === 'p')!.mana).toBe(14); //10 attack + floor(40*.03)=1 + hook3.
    expect(result.state.units.find(u => u.id === 'p')!.effectRuntime!.map(c => c.count)).toEqual([1, 1, 1]);
    expect(result.events.map(e => e.eventSeq)).toEqual(Array.from({ length: result.events.length }, (_, n) => n + start.events.length));
  });
  it('finite mechanic validation rejects unknown fields, missing coefficients, and zero-period schedules', () => {
    expect(() => cloneEffect({ kind: 'mechanic', mechanic: 'eval', values: {} })).toThrow();
    expect(() => cloneEffect({ kind: 'mechanic', mechanic: 'archangel', values: { periodTicks: 0, abilityPower: 30 } })).toThrow();
    expect(() => cloneEffect({ kind: 'mechanic', mechanic: 'watcher', values: { reductionBps: 1500 } })).toThrow();
    expect(() => cloneEffect({ kind: 'mechanic', mechanic: 'rageblade', values: { attackSpeedBps: 500, arbitrary: 1 } })).toThrow();
  });
  it('Tristana with Loris redirect cannot create two ricochets, duplicate task keys, or double growth', () => {
    const protector = hero('loris', 'ep', { hp: 10, mana: 0, cooldownTicks: 1000, cell: { col: 2, row: 4 } });
    const shieldSource = origin(protector);
    const result = stepCombat(battle([hero('tristana'), dummy('ea', 2, 3, { hp: 100 }), {
      ...protector, statuses: [{ key: `${sourceKey(shieldSource)}:redirect:ep:`, kind: 'redirect', source: shieldSource,
        amount: 5000, startsAtTick: 0, expiresAtTick: 80 }],
    }, dummy('ez', 4, 3)]));
    // 575 incoming splits288 to primary and287 to protector. Only primary overkill188 may ricochet.
    const owner = result.state.units.find(u => u.id === 'p')!;
    expect(owner.runtime!.permanentAdBps).toBe(125);
    expect(owner.tasks).toEqual([expect.objectContaining({ kind: 'tristanaBounce', amount: 188 })]);
    expect(new Set(owner.tasks!.map(t => t.key)).size).toBe(owner.tasks!.length);
    expect(packets(result.events).filter(p => p.source.ownerId === 'p').map(p => [p.unitId, p.mitigated, p.redirected]))
      .toEqual([['ea', 288, false], ['ep', 287, true]]);
  });
  it('killing only a damage-sharing protector does not count as Tristana primary-target ricochet', () => {
    const protector = hero('loris', 'ep', { hp: 10, mana: 0, cooldownTicks: 1000, cell: { col: 2, row: 4 } });
    const shieldSource = origin(protector);
    const result = stepCombat(battle([hero('tristana'), dummy('ea', 2, 3, { hp: 1000 }), {
      ...protector, statuses: [{ key: `${sourceKey(shieldSource)}:redirect:ep:`, kind: 'redirect', source: shieldSource,
        amount: 5000, startsAtTick: 0, expiresAtTick: 80 }],
    }, dummy('ez', 4, 3)]));
    expect(result.state.units.find(u => u.id === 'ea')!.hp).toBe(712);
    expect(result.state.units.find(u => u.id === 'ep')!.hp).toBe(0);
    const owner = result.state.units.find(u => u.id === 'p')!;
    expect(owner.runtime!.permanentAdBps).toBe(0);
    expect(owner.tasks).toEqual([]);
  });
  it.each([0, 100])('475 Tristana ricochet shares238/237 once with secondary armor %i, without reapplying armor or recursively sharing', armor => {
    const protector = hero('loris', 'ep', { mana: 0, cooldownTicks: 1000, cell: { col: 4, row: 3 } });
    const src = origin(protector);
    const first = stepCombat(battle([hero('tristana'), dummy('ea', 2, 3, { hp: 100 }), dummy('eb', 3, 3, { armor }), {
      ...protector, statuses: [{ key: `${sourceKey(src)}:redirect:ep:`, source: src, kind: 'redirect', amount: 5000, startsAtTick: 0, expiresAtTick: 80 }],
    }]));
    expect(first.state.units.find(u => u.id === 'p')!.tasks![0].amount).toBe(475);
    const second = stepCombat(first.state);
    expect(packets(second.events).filter(p => p.source.ownerId === 'p').map(p => [p.unitId, p.raw, p.mitigated, p.hpDamage, p.redirected]))
      .toEqual([['eb', 475, 238, 238, false], ['ep', 475, 237, 237, true]]);
    expect(second.state.units.find(u => u.id === 'p')!.runtime!.permanentAdBps).toBe(125);
    expect(second.state.units.find(u => u.id === 'p')!.tasks).toEqual([]);
  });
  it('the scheduled Archangel boundary precedes action planning: tick99 Lux shields160, tick100 shields208', () => {
    const owner = hero('lux', 'p', { mechanics: [mechanic('p', 'archangel', { periodTicks: 100, abilityPower: 30 })] });
    const before = stepCombat(battle([owner, dummy()], { tick: 98 }));
    const boundary = stepCombat(battle([owner, dummy()], { tick: 99 }));
    expect(before.state.units.find(u => u.id === 'p')!.shield).toBe(160);
    expect(boundary.state.units.find(u => u.id === 'p')!.shield).toBe(208); //160×130/100.
    expect(boundary.events.find(e => e.type === 'statChanged')).toMatchObject({ stat: 'abilityPower', before: 100, after: 130 });
  });
});
