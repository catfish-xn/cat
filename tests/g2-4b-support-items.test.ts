/** G2-4b support items: registry, aura geometry at the strategy boundary, in-combat programs and restore validation. */
import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { validateMechanisms } from '../src/simulation/m8/restore';
import { validateItemProgram } from '../src/simulation/m8/item-program';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { G24_SUPPORT_DECLARATIONS, G24_SUPPORT_ITEMS } from '../src/simulation/content/g2-4-support-items';
import { G24_MECHANISM_ITEMS } from '../src/simulation/content/g2-4b-mechanism-items';
import { G24_SUPPORT_ITEM_SOURCE } from '../src/simulation/content/g2-4-support-item-source';
import { G23_SPECIAL_ITEM_POOLS } from '../src/simulation/content/g2-3-special-item-source';
import { inSupportArea, isSupportAuraInstance } from '../src/simulation/g2-4-support';
import type { CombatState, CombatEvent } from '../src/simulation/combat-types';

const DEFERRED = ['TFT_Item_Shroud', 'TFT_Item_Zephyr', 'TFT5_Item_ZzRotPortalRadiant'];
type Place = readonly [id: string, definitionId: string, col: number, row: number];
function setup(player: readonly Place[], enemy: readonly Place[], held: readonly (readonly [unitId: string, definitionId: string])[]) {
  const base = createMatch(42);
  const unit = (team: 'player' | 'enemy') => ([id, definitionId, col, row]: Place) => ({ id, definitionId, team, starLevel: 2 as const, location: { kind: 'board' as const, cell: { col, row } } });
  const preparation = { ...base.preparation, units: [...player.map(unit('player')), ...enemy.map(unit('enemy'))] };
  const items = held.map(([unitId, definitionId], i) => ({ id: `item-${i + 1}`, definitionId, location: { kind: 'unit' as const, unitId, slot: held.slice(0, i).filter(h => h[0] === unitId).length } }));
  const state = { ...base, level: 9, items, preparation };
  const strategy = buildStrategySnapshot(state);
  return { state, strategy, combat: createCombatWithEvents(preparation, strategy, 'g24-support').state };
}
const supportSources = (strategy: ReturnType<typeof buildStrategySnapshot>, unitId: string, definitionId: string) =>
  strategy.units.find(u => u.unitId === unitId)!.sources.filter(s => s.source.sourceDefinitionId === definitionId && isSupportAuraInstance(s.source.sourceInstanceId));
/** Nobody acts: only item programs move the battle. */
const passive = (combat: CombatState): CombatState => ({ ...combat, units: combat.units.map(u => ({ ...u, cooldownTicks: 100000, moveCooldownTicks: 100000 })) });
function run(combat: CombatState, ticks: number, each?: (state: CombatState, events: readonly CombatEvent[]) => void): { state: CombatState; events: CombatEvent[] } {
  const events: CombatEvent[] = []; let state = combat;
  for (let i = 0; i < ticks && state.status !== 'finished'; i++) { const step = stepCombat(state); state = step.state; events.push(...step.events); each?.(state, step.events); }
  return { state, events };
}
const statusesOf = (state: CombatState, unitId: string, kind: string) =>
  (state.units.find(u => u.id === unitId)!.mechanismState?.statuses ?? []).filter(g => g.targetId === unitId && g.kind === kind).flatMap(g => g.contributions);

describe('G2-4b support item content', () => {
  it('registers the fourteen-minus-deferred support items with their source health and valid programs', () => {
    expect(Object.keys(G24_SUPPORT_ITEM_SOURCE).sort()).toEqual([...G23_SPECIAL_ITEM_POOLS.SUPPORTITEMS].sort());
    expect(Object.keys(G24_SUPPORT_ITEMS)).toHaveLength(14);
    for (const id of DEFERRED) { expect(G24_SUPPORT_ITEMS[id]).toBeUndefined(); expect(G24_SUPPORT_DECLARATIONS[id]).toBeUndefined(); expect(G24_MECHANISM_ITEMS[id]).toBeDefined(); expect(ITEM_DEFINITIONS[id]).toBe(G24_MECHANISM_ITEMS[id]); }
    expect(Object.keys(G24_SUPPORT_ITEMS).filter(id => Object.hasOwn(G24_MECHANISM_ITEMS,id))).toEqual([]);
    for (const [id, item] of Object.entries(G24_SUPPORT_ITEMS)) {
      expect(ITEM_DEFINITIONS[id]).toBe(item);
      expect(item.effects).toEqual([{ kind: 'statFlat', stat: 'maxHp', amount: G24_SUPPORT_ITEM_SOURCE[id as keyof typeof G24_SUPPORT_ITEM_SOURCE].values.Health }]);
      if (item.combatProgram) expect(() => validateItemProgram(item.combatProgram!)).not.toThrow();
      for (const aura of G24_SUPPORT_DECLARATIONS[id].auras) if (aura.program) expect(() => validateItemProgram(aura.program!)).not.toThrow();
    }
  });
  it('Moonstone grows from 55 by 45 per stage and caps at 325 from stage 7 (user-chosen convention)', () => {
    expect(G24_SUPPORT_DECLARATIONS.TFT_Item_Moonstone.stageShield).toEqual({ periodTicks: 80, durationTicks: 80, targets: 2, byStage: [55, 100, 145, 190, 235, 280, 325] });
  });
});

describe('G2-4b aura geometry', () => {
  const at = (col: number, row: number, team: 'player' | 'enemy' = 'player') => ({ id: `${team}${col}${row}`, team, cell: { col, row } });
  it('same row, adjacency, row-and-behind and team areas only ever reach allies', () => {
    const holder = at(3, 4);
    expect([at(1, 4), at(5, 4), at(6, 4), at(3, 5)].map(u => inSupportArea('same-row', 2, holder, u))).toEqual([true, true, false, false]);
    expect([at(2, 5), at(3, 5), at(4, 5), at(4, 4), at(3, 6)].map(u => inSupportArea('adjacent', 1, holder, u))).toEqual([true, true, false, true, false]);
    expect([at(2, 4), at(4, 4), at(5, 4), at(2, 5), at(4, 6), at(5, 7), at(3, 3)].map(u => inSupportArea('row-and-behind', 1, holder, u))).toEqual([true, true, false, true, true, false, false]);
    expect(inSupportArea('row-and-behind', 1, at(3, 3, 'enemy'), at(3, 1, 'enemy'))).toBe(true);
    expect(inSupportArea('row-and-behind', 1, at(3, 3, 'enemy'), at(3, 4, 'enemy'))).toBe(false);
    expect(inSupportArea('team', 0, holder, at(0, 7))).toBe(true);
    expect(inSupportArea('team', 0, holder, at(3, 3, 'enemy'))).toBe(false);
  });
});

describe('G2-4b strategy grants', () => {
  const allies: Place[] = [['holder', 'leona', 3, 4], ['left', 'lux', 1, 4], ['far', 'ezreal', 6, 4], ['behind', 'vi', 3, 5], ['corner', 'garen', 0, 7]];
  const enemy: Place[] = [['foe', 'garen', 3, 2]];
  it('Zeke\'s Herald reaches the holder and same-row allies within two hexes, each as its own receiver-owned source', () => {
    const { strategy } = setup(allies, enemy, [['holder', 'TFT_Item_ZekesHerald']]);
    const reached = strategy.units.filter(u => supportSources(strategy, u.unitId, 'TFT_Item_ZekesHerald').length).map(u => u.unitId).sort();
    expect(reached).toEqual(['holder', 'left']);
    expect(supportSources(strategy, 'left', 'TFT_Item_ZekesHerald')[0].source.ownerId).toBe('left');
    expect(supportSources(strategy, 'left', 'TFT_Item_ZekesHerald')[0].effect).toEqual({ kind: 'attackSpeedBps', bps: 3000 });
    expect(supportSources(strategy, 'foe', 'TFT_Item_ZekesHerald')).toEqual([]);
  });
  it('two heralds stack per source and the holder still carries the item health', () => {
    const { strategy, combat } = setup(allies, enemy, [['holder', 'TFT_Item_ZekesHerald'], ['left', 'TFT_Item_ZekesHerald']]);
    expect(supportSources(strategy, 'holder', 'TFT_Item_ZekesHerald')).toHaveLength(2);
    const plain = setup(allies, enemy, []).combat;
    expect(combat.units.find(u => u.id === 'holder')!.maxHp - plain.units.find(u => u.id === 'holder')!.maxHp).toBe(150);
  });
  it('Chalice, Randuin\'s Omen, Knight\'s Vow and team auras change resolved stats of exactly their receivers', () => {
    const plain = setup(allies, enemy, []).combat;
    const stat = (combat: CombatState, id: string) => readCombatStats(combat.units.find(u => u.id === id)!, combat);
    const delta = (definitionId: string, key: 'abilityPower' | 'armor' | 'maxHp' | 'attackDamage') => {
      const { combat } = setup(allies, enemy, [['holder', definitionId]]);
      return Object.fromEntries(allies.map(([id]) => [id, (key === 'maxHp' ? combat.units.find(u => u.id === id)!.maxHp - plain.units.find(u => u.id === id)!.maxHp : stat(combat, id)[key] - stat(plain, id)[key])]));
    };
    expect(delta('TFT_Item_Chalice', 'abilityPower')).toEqual({ holder: 25, left: 25, far: 0, behind: 0, corner: 0 });
    expect(delta('TFT4_Item_OrnnRanduinsSanctum', 'armor')).toEqual({ holder: 30, left: 0, far: 0, behind: 30, corner: 0 });
    expect(delta('TFT_Item_SupportKnightsVow', 'maxHp')).toEqual({ holder: 250, left: 0, far: 0, behind: 0, corner: 0 });
    const shift = setup([['holder', 'leona', 3, 4], ['next', 'lux', 4, 4]], enemy, [['holder', 'TFT_Item_SupportKnightsVow']]);
    expect(shift.combat.units.find(u => u.id === 'next')!.maxHp - setup([['holder', 'leona', 3, 4], ['next', 'lux', 4, 4]], enemy, []).combat.units.find(u => u.id === 'next')!.maxHp).toBe(200);
    const spite = delta('TFT_Item_Spite', 'abilityPower');
    expect(spite).toEqual({ holder: 20, left: 0, far: 0, behind: 20, corner: 0 });
  });
  it('Moonstone freezes the stage at compile time', () => {
    const one = setup(allies, enemy, [['holder', 'TFT_Item_Moonstone']]);
    const program = one.strategy.units.find(u => u.unitId === 'holder')!.itemPrograms!.find(p => isSupportAuraInstance(p.source.instanceId))!.program;
    expect(program.periodic![0].program.effects[0]).toMatchObject({ kind: 'grant-shield', amount: { flat: 55 } });
  });
});

describe('G2-4b in-combat programs', () => {
  const allies: Place[] = [['holder', 'leona', 3, 4], ['left', 'lux', 2, 4], ['right', 'ezreal', 4, 4], ['back', 'vi', 3, 6]];
  const enemy: Place[] = [['foe', 'garen', 3, 3], ['foe2', 'vi', 0, 0]];
  it('Locket, Banshee\'s Veil and Aegis apply their timed start effects to the receivers', () => {
    const locket = setup(allies, enemy, [['holder', 'TFT_Item_LocketOfTheIronSolari']]).combat;
    expect(locket.units.filter(u => u.shield >= 250).map(u => u.id).sort()).toEqual(['holder', 'left', 'right']);
    const veil = run(passive(setup(allies, enemy, [['holder', 'TFT_Item_BansheesVeil']]).combat), 2).state;
    expect(['holder', 'left', 'right', 'back'].map(id => statusesOf(veil, id, 'control-immunity').length > 0)).toEqual([true, true, true, false]);
    const aegis = run(passive(setup(allies, enemy, [['holder', 'TFT_Item_AegisOfTheLegion']]).combat), 2).state;
    // "all allies behind them": two rows back in the holder's column is still behind.
    expect(['holder', 'left', 'right', 'back', 'foe'].map(id => statusesOf(aegis, id, 'stat-buff').length > 0)).toEqual([true, true, true, true, false]);
  });
  it('Eternal Flame wounds every enemy and amplifies every ally, reapplied each period', () => {
    const { events, state } = run(passive(setup(allies, enemy, [['holder', 'TFT_Item_EternalFlame']]).combat), 105);
    expect(statusesOf(state, 'foe', 'wound').length).toBeGreaterThan(0);
    expect(statusesOf(state, 'foe2', 'wound').length).toBeGreaterThan(0);
    expect(statusesOf(state, 'back', 'stat-buff').length).toBeGreaterThan(0);
    expect(statusesOf(state, 'foe', 'stat-buff')).toEqual([]);
    expect(events.filter(e => e.type === 'statusChanged').length).toBeGreaterThan(0);
  });
  it('Needlessly Big Gem adds one percent each second for fifteen seconds', () => {
    const { state } = run(passive(setup(allies, enemy, [['holder', 'TFT7_Item_ShimmerscaleHeartOfGold']]).combat), 400);
    expect(statusesOf(state, 'back', 'stat-buff')).toHaveLength(15);
  });
  it('Moonstone shields the two lowest-health allies every four seconds', () => {
    const combat = passive(setup(allies, enemy, [['holder', 'TFT_Item_Moonstone']]).combat);
    const hurt = { ...combat, units: combat.units.map(u => u.id === 'left' || u.id === 'back' ? { ...u, hp: Math.floor(u.maxHp / 2) } : u) };
    const { events } = run(hurt, 85);
    const granted = events.flatMap(e => e.type === 'shieldLayerChanged' && e.reason === 'granted' ? [[e.tick, e.layer.targetId, e.layer.granted]] : []);
    expect(granted.sort()).toEqual([[80, 'back', 55], [80, 'left', 55]]);
  });
  it('Virtue of the Martyr heals the team each period, then twice more after the holder dies', () => {
    const combat = passive(setup(allies, enemy, [['holder', 'TFT_Item_RadiantVirtue']]).combat);
    const hurt = { ...combat, units: combat.units.map(u => u.id === 'left' ? { ...u, hp: 100 } : u) };
    const before = run(hurt, 101).events.filter(e => e.type === 'heal' && e.outcome.targetId === 'left');
    expect(before).toHaveLength(1);
    const left = hurt.units.find(u => u.id === 'left')!;
    expect(before[0].type === 'heal' && before[0].outcome.actual).toBe(Math.floor(left.maxHp * 700 / 10000));
    const dying = { ...hurt, units: hurt.units.map(u => u.id === 'holder' ? { ...u, hp: 0 } : u) };
    const after = run(dying, 230).events.filter(e => e.type === 'heal' && e.outcome.targetId === 'left');
    // Death is seen on tick 1; the two empowered heals land one and two periods later (G24-SUPPORT-02).
    expect(after.map(e => e.tick)).toEqual([101, 201]);
    for (const e of after) expect(e.type === 'heal' && e.outcome.actual).toBe(Math.min(1000, Math.floor(left.maxHp * 1400 / 10000)));
  });
  it('Obsidian Cleaver shreds and sunders on any damage type, every victim of an area ability included', () => {
    const { state } = run(setup(allies, enemy, [['holder', 'TFT4_Item_OrnnObsidianCleaver']]).combat, 80);
    expect(statusesOf(state, 'foe', 'shred')[0].application.magnitudeBps).toBe(3000);
    const caster = (definitionId: string) => {
      const { combat } = setup([['holder', definitionId, 3, 4]], [['e1', 'garen', 3, 3], ['e2', 'garen', 2, 3], ['e3', 'garen', 4, 3], ['e4', 'garen', 3, 2]], [['holder', 'TFT4_Item_OrnnObsidianCleaver']]);
      // Only the holder's opening cast deals damage: magic damage alone must still Sunder.
      return run({ ...combat, units: combat.units.map(u => u.id === 'holder' ? { ...u, mana: u.maxMana, cooldownTicks: 100000 } : { ...u, cooldownTicks: 100000, moveCooldownTicks: 100000 }) }, 30);
    };
    const vladimir = caster('vladimir');
    expect(vladimir.events.filter(e => e.type === 'packetDamage').map(e => e.type === 'packetDamage' && e.outcome.context.damageType)).toEqual(['magic']);
    expect([statusesOf(vladimir.state, 'e1', 'shred').length, statusesOf(vladimir.state, 'e1', 'sunder').length]).toEqual([1, 1]);
    const zyra = caster('zyra').state;
    expect(['e1', 'e2', 'e3', 'e4'].map(id => statusesOf(zyra, id, 'sunder').length)).toEqual([1, 1, 1, 0]);
  });
  it('Spite stuns enemies within two hexes when its holder dies', () => {
    const combat = passive(setup(allies, enemy, [['holder', 'TFT_Item_Spite']]).combat);
    const dying = { ...combat, units: combat.units.map(u => u.id === 'holder' ? { ...u, hp: 0 } : u) };
    const { state } = run(dying, 2);
    expect(statusesOf(state, 'foe', 'stun').length).toBe(1);
    expect(statusesOf(state, 'foe2', 'stun')).toEqual([]);
  });
});

describe('G2-4b restore', () => {
  it('every mid-combat state with all fourteen items passes item-source restore validation', () => {
    const ids = Object.keys(G24_SUPPORT_ITEMS);
    const player: Place[] = ['leona', 'lux', 'ezreal', 'heimerdinger', 'garen', 'vi', 'zeri'].map((d, i) => [`p${i}`, d, i, 4 + (i % 2)]);
    const enemy: Place[] = ['garen', 'vi', 'leona'].map((d, i) => [`e${i}`, d, i + 2, 2]);
    const { combat } = setup(player, enemy, ids.map((id, k) => [`p${k % 7}`, id] as const));
    let checked = 0;
    run(combat, 1200, state => {
      if (state.tick % 20 !== 0 && state.status !== 'finished') return;
      const parsed = JSON.parse(JSON.stringify(state)) as CombatState;
      for (const unit of parsed.units) validateMechanisms(unit, parsed.units, parsed.tick, parsed.combatId!, parsed.status === 'finished', parsed.nextActionSeq!, new Set(), true);
      checked++;
    });
    expect(checked).toBeGreaterThan(3);
  });
});
