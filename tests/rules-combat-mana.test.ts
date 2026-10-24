import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { damageMana, planManaCost, resolveMana } from '../src/simulation/m8/mana';
import { authorizeSpellCrit, rollCrit } from '../src/simulation/m8/crit';
import { compileItemCrit } from '../src/simulation/m8/item-program';
import { constantModifier } from '../src/simulation/combat-s13-state';
import { createMatch, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { compileBattle, resolveTwoSidedBattle, startTwoSidedBattle } from '../src/simulation/two-sided-battle';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { startCombatReplay } from '../src/simulation/combat-replay-view';
import { battle, freeze, unit } from './combat-helpers';
import { itemMatch } from './fixtures/m8-b4-match';
import { source } from './fixtures/m8-contract-cases';

const hero = (id: string, team: CombatUnit['team'], col: number, patch: Partial<CombatUnit> = {}) => unit(id, team, col, 3, {
  definitionId: 'zyra', ability: resolveAbility('zyra-ability', 1), hp: 10000, maxHp: 10000,
  baseCritChanceBps: 0, mana: 0, maxMana: 10000, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, ...patch,
});
const victim = (state: CombatState) => state.units.find(u => u.id === 'p')!;
const hit = (damage: number, patch: Partial<CombatUnit> = {}, attackers = 1) => stepCombat(battle([
  hero('p', 'player', 1, patch), ...Array.from({ length: attackers }, (_, i) => hero(`e${i}`, 'enemy', i ? 2 : 0, { attackDamage: damage, cooldownTicks: 0 })),
]));

describe('10-23 approved combat mana and excess crit vectors', () => {
  it('pre200 + post100×3 =500 hundredths, including a fully absorbed hit', () => {
    const result = hit(200, { armor: 100, shield: 500, shieldExpiresAtTick: 100, shieldLayers: [{ key: 's', source: { ownerId: 'p', sourceKind: 'ability', definitionId: 'zyra-ability', instanceId: 'p', effectIndex: 0 }, granted: 500, remaining: 500, absorbed: 0, expiresAtTick: 100 }] });
    expect(victim(result.state)).toMatchObject({ hp: 10000, shield: 400, mana: 5, damageManaRemainderCenti: 0 });
    expect(result.state.rngDraws).toBe(1);
  });
  it('100 crits to140, armor100 gives70: 140+3×70=350, remainder50', () => {
    const result = stepCombat(battle([hero('p', 'player', 1, { armor: 100 }),
      hero('e', 'enemy', 0, { attackDamage: 100, cooldownTicks: 0, baseCritChanceBps: 10000 })]));
    expect(victim(result.state)).toMatchObject({ hp: 9930, mana: 3, damageManaRemainderCenti: 50 });
    expect(result.state.rngDraws).toBe(1);
  });
  it('pre-mitigation includes outgoing amp: 100×1.2=120, armor100→60, mana3', () => {
    const result = stepCombat(battle([hero('p', 'player', 1, { armor: 100 }),
      hero('e', 'enemy', 0, { attackDamage: 100, cooldownTicks: 0, mechanics: [{ mechanic: 'damageAmp', source: { ownerId: 'e', sourceKind: 'augment', definitionId: 'amp', instanceId: 'amp', effectIndex: 0 }, values: { bps: 2000 } }] })]));
    expect(victim(result.state)).toMatchObject({ hp: 9940, mana: 3, damageManaRemainderCenti: 0 });
  });
  it('Loris splits pre600/post300 equally: each recipient gets7.50 without duplicate raw', () => {
    let state = battle([hero('p', 'player', 1, { armor: 100 }),
      hero('l', 'player', 2, { mana: 100, maxMana: 100, attackIntervalTicks: 1000, ability: resolveAbility('loris-ability', 1) }),
      hero('e', 'enemy', 0, { attackDamage: 600, cooldownTicks: 22 })]);
    while (state.tick < 22) state = stepCombat(state).state;
    expect(victim(state).hp).toBe(9850);
    for (const u of state.units.filter(u => u.team === 'player')) expect(u).toMatchObject({ mana: 7, damageManaRemainderCenti: 50 });
  });
  it('Defiance grants mana on the initial mitigated packet; deferred HP payments grant none', () => {
    const first = hit(200, { mechanics: [{ mechanic: 'g24DeathsDefiance', source: { ownerId: 'p', sourceKind: 'item', definitionId: 'defiance', instanceId: 'i', effectIndex: 0 }, values: { fractionBps: 5000, durationTicks: 80 } }] });
    expect(victim(first.state)).toMatchObject({ hp: 9900, mana: 8 });
    const second = stepCombat(first.state);
    expect(victim(second.state)).toMatchObject({ hp: 9899, mana: 8 });
  });
  it('Visionary scales hundredths before tick floor: 28×1.5=42, three ticks→1.26', () => {
    let state = battle([hero('p', 'player', 1, { mechanics: [{ mechanic: 'visionary', source: { ownerId: 'p', sourceKind: 'trait', definitionId: 'visionary', instanceId: 'v', effectIndex: 0 }, values: { manaBps: 5000 } }] }),
      hero('e', 'enemy', 0, { attackDamage: 7, cooldownTicks: 0, attackIntervalTicks: 1 })]);
    for (let i = 0; i < 3; i++) state = stepCombat(state).state;
    expect(victim(state)).toMatchObject({ mana: 1, damageManaRemainderCenti: 26 });
  });
  it('caps EACH packet at42.50, so two large packets give85; no whole-tick cap', () => {
    expect(damageMana(1000, 1083)).toBe(4249);
    expect(damageMana(1000, 1084)).toBe(4250);
    expect(victim(hit(2000, {}, 2).state)).toMatchObject({ mana: 85, damageManaRemainderCenti: 0 });
  });
  it('two 7-damage packets give56 hundredths; next tick56 yields1 with12 carried', () => {
    const first = stepCombat(battle([hero('p', 'player', 1),
      hero('e0', 'enemy', 0, { attackDamage: 7, cooldownTicks: 0, attackIntervalTicks: 1 }),
      hero('e1', 'enemy', 2, { attackDamage: 7, cooldownTicks: 0, attackIntervalTicks: 1 })]));
    expect(victim(first.state)).toMatchObject({ mana: 0, damageManaRemainderCenti: 56 });
    const second = stepCombat(freeze(first.state));
    expect(victim(second.state)).toMatchObject({ mana: 1, damageManaRemainderCenti: 12 });
    expect(stepCombat(JSON.parse(JSON.stringify(first.state)))).toEqual(second);
  });
  it('damage grants stop at max and cannot erase an existing ordinary surplus', () => {
    expect(victim(hit(200, { mana: 98, maxMana: 100, attackRange: 0 }).state).mana).toBe(100);
    const request = { source: source('mana', 'i', 'p'), targetId: 'p', amount: 20, reason: 'damage' as const, bypassLock: 'none' as const, castActionSeq: null };
    expect(resolveMana({ unitId: 'p', current: 105, maximum: 100, lockedUntilTick: 0 }, request, 1)).toMatchObject({ applied: 0, overflow: 20, after: 105 });
  });
  it('95+10 attack→105; next tick spends100, retains5 and locks through tick21', () => {
    let state = battle([hero('p', 'player', 1, { mana: 95, maxMana: 100, cooldownTicks: 0, attackIntervalTicks: 1 }), hero('e', 'enemy', 0)]);
    const first = stepCombat(state); state = first.state;
    expect(victim(state).mana).toBe(105);
    const cast = stepCombat(state); state = cast.state;
    expect(victim(state)).toMatchObject({ mana: 5, manaLockedUntilTick: 22 });
    expect(cast.events.find(e => e.type === 'cast')).toMatchObject({ receipt: { actualManaSpent: 100 } });
    while (state.tick < 21) state = stepCombat(state).state;
    expect(victim(state).mana).toBe(5);
    state = stepCombat(state).state;
    expect(victim(state).mana).toBe(15);
  });
  it('cast at1 locks incoming damage through20; tick21 resumes without banking blocked fractions', () => {
    let state = battle([hero('p', 'player', 1, { mana: 100, maxMana: 100, attackIntervalTicks: 1000, ability: resolveAbility('ziggs-ability', 1) }),
      hero('e', 'enemy', 0, { attackDamage: 7, cooldownTicks: 0, attackIntervalTicks: 1 })]);
    while (state.tick < 20) state = stepCombat(state).state;
    expect(victim(state)).toMatchObject({ mana: 0, manaLockedUntilTick: 21 });
    expect(victim(state).damageManaRemainderCenti ?? 0).toBe(0);
    state = stepCombat(state).state;
    expect(victim(state)).toMatchObject({ mana: 0, damageManaRemainderCenti: 28 });
  });
  it.each(['attack', 'incoming-basic-hit', 'periodic', 'kill', 'item-granted'] as const)('%s surplus persists; lock blocks it', reason => {
    const state = { unitId: 'p', current: 75, maximum: 80, lockedUntilTick: 0 };
    const request = { source: source('mana', 'i', 'p'), targetId: 'p', amount: 20, reason, bypassLock: 'none' as const, castActionSeq: null };
    expect(resolveMana(state, request, 1)).toMatchObject({ applied: 20, overflow: 0, after: 95 });
    expect(planManaCost({ ...state, current: 95 }, 80)?.after.current).toBe(15);
    expect(resolveMana({ ...state, lockedUntilTick: 2 }, request, 1)).toMatchObject({ blocked: 20, after: 75 });
    expect(resolveMana({ ...state, current: 0, maximum: 0 }, request, 1).after).toBe(0);
  });
  it('125% crit becomes100%/152.5% damage, 100 AD→152; conversion consumes no extra word', () => {
    const auth = authorizeSpellCrit([], [], 12500, 14000);
    expect(auth).toMatchObject({ enabled: false, chanceBps: 10000, multiplierBps: 15250 });
    expect(authorizeSpellCrit([], [], 10001, 14000).multiplierBps).toBe(14000);
    let draws = 0;
    expect(rollCrit('basic', auth, () => { draws++; return 0xffffffff; })).toBe(true);
    expect(draws).toBe(1);
    const result = stepCombat(battle([hero('p', 'player', 1), hero('e', 'enemy', 0, { attackDamage: 100, cooldownTicks: 0, baseCritChanceBps: 12500 })]));
    expect(victim(result.state).hp).toBe(9848);
    expect(result.state.rngDraws).toBe(1);
  });
  it('item compilation preserves excess before clamping, alongside redundant spell-crit bonuses', () => {
    const u = hero('p', 'player', 1, { baseCritChanceBps: 2500, itemPrograms: [{ source: source('crit', 'i', 'p'),
      program: { modifiers: [constantModifier('critChance', 10000, 'bps')], effects: [{ kind: 'authorize-spell-crit', duplicateBonusBps: 1000 }] } }] });
    expect(compileItemCrit(u)).toMatchObject({ chanceBps: 10000, multiplierBps: 15250, enabled: true });
    expect(authorizeSpellCrit([], [source('ie', 'i1'), source('jg', 'i2')], 12500, 14000)).toMatchObject({ multiplierBps: 16250, redundantItemBonusBps: 1000 });
  });
  it('real checkpoint restores mana/lock/fraction exactly and rejects forged values', () => {
    let state = itemMatch('bloodthirster'), checked = false, overflowChecked = false;
    while (state.phase === 'combat' && state.combat!.tick < 200) {
      state = stepMatch(state).state;
      if (!overflowChecked && state.combat!.units.some(u => u.mana > u.maxMana)) {
        expect(restoreMatch(serializeMatch(state))).toEqual(state); overflowChecked = true;
      }
      if (checked && overflowChecked) break;
      if (checked) continue;
      const owner = state.combat!.units.find(u => (u.manaLockedUntilTick ?? 0) > 0 && (u.damageManaRemainderCenti ?? 0) > 0);
      if (!owner) continue;
      const restored = restoreMatch(serializeMatch(state));
      expect(restored).toEqual(state);
      expect(stepMatch(restored)).toEqual(stepMatch(state));
      for (const field of ['mana', 'manaLockedUntilTick', 'damageManaRemainderCenti'] as const) {
        const bad = structuredClone(state), target = bad.combat!.units.find(u => u.id === owner.id)!;
        Object.assign(target, { [field]: (target[field] ?? 0) + 1 });
        expect(() => restoreMatch(bad)).toThrow(/mana binding facts|authoritative/);
        expect(() => restoreMatch(JSON.stringify(bad))).toThrow(/mana binding facts|authoritative/);
      }
      checked = true;
    }
    expect(checked).toBe(true);
    expect(overflowChecked).toBe(true);
  }, 20000);
  it('full/sliced/replay bytes agree, preserving Amumu0 mana and Viktor chaos energy', () => {
    const army = (seed: number) => {
      const s = createMatch(seed), round = getCatalogRoundById('2-1');
      return { ...s, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...s.m8, round }, level: 10, nextUnitSerial: 5, items: [], preparation: { ...s.preparation, units: ['amumu', 'viktor', 'zyra', 'heimerdinger'].map((definitionId, i) => ({
        id: `unit-${i + 1}`, definitionId, team: 'player' as const, starLevel: 1 as const,
        location: { kind: 'board' as const, cell: { col: i, row: 4 } },
      })) } };
    };
    const input = compileBattle(snapshotForBattle(army(42), 'a'), snapshotForBattle(army(43), 'b'), 42, { battleId: 'mana-rules' });
    const full = resolveTwoSidedBattle(input, 901), replay = startCombatReplay(full).advance(901)!;
    for (const budget of [1, 7, 31]) {
      const task = startTwoSidedBattle(input, { captureReplay: true });
      let result = task.advance(budget);
      while (!result) result = task.advance(budget);
      expect(JSON.stringify(result)).toBe(JSON.stringify(full));
      expect(JSON.stringify(task.replay())).toBe(JSON.stringify(replay));
    }
    expect(full.terminal.units.filter(u => u.definitionId === 'amumu').every(u => u.mana === 0 && u.maxMana === 0)).toBe(true);
    expect(full.terminal.units.filter(u => u.definitionId === 'viktor').every(u => u.maxMana === 8 && u.mana <= 8 && u.manaLockedUntilTick === undefined && u.damageManaRemainderCenti === undefined)).toBe(true);
  }, 20000);
});
