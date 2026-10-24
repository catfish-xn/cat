import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createMatch } from '../src/simulation/match';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { SCRAP_CHAMPION_ROLES, SCRAP_ROLE_ITEMS } from '../src/simulation/content/scrap-lucky';
import { CHAMPION_ROLES, ROLE_DISPLAY } from '../src/presentation/unit-roles';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { createRoundEnemies, getRoundEnemyItems } from '../src/simulation/round-enemies';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { compileBattle, restoreBattleInput, snapshotForBattle, startTwoSidedCombat } from '../src/server-entry';
import { startTwoSidedBattle } from '../src/simulation/two-sided-battle';
import { equipItem } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';
import type { StrategySnapshot } from '../src/simulation/strategy-types';

const raw = (name: string) => JSON.parse(gunzipSync(readFileSync(new URL(`../src/simulation/content/source/s13-14.24b/raw/${name}`, import.meta.url))).toString('utf8'));
const emblem = (traitId: string) => Object.values(EMBLEM_ITEMS).find(d => d.emblemTrait === traitId)!.id;
const heroes = Object.values(M5_UNIT_DEFINITIONS).filter(d => !d.summon && d.unitKind !== 'neutral');
const place = (ids: readonly string[]): Unit[] => ids.map((definitionId, i) => ({ id: definitionId, definitionId, starLevel: 1, team: 'player', location: { kind: 'board', cell: { col: i % 7, row: 4 + Math.floor(i / 7) } } }));
type Items = MatchState['items'];
const held = (id: string, definitionId: string, unitId: string, slot = 0): Items[number] => ({ id, definitionId, location: { kind: 'unit', unitId, slot } });
/** `natives` first, then emblem holders from other champions until the trait count reaches `count`. */
function army(traitId: string, count: number, natives: readonly string[], extra: Items = [], roundId?: string): MatchState {
  const others = heroes.filter(d => !d.traits.includes(traitId) && !natives.includes(d.id)).slice(0, count - natives.length).map(d => d.id);
  const base = createMatch(42), round = roundId ? getCatalogRoundById(roundId) : undefined;
  return { ...base, ...(round ? { round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, level: 9 } : {}),
    preparation: { ...base.preparation, units: place([...natives, ...others]) },
    items: [...others.map((unitId, i) => held(`emblem-${i + 1}`, emblem(traitId), unitId, 1)), ...extra] } as MatchState;
}
const itemSource = (snap: StrategySnapshot, unitId: string, instanceId: string) =>
  [...new Set(snap.units.find(u => u.unitId === unitId)!.sources.filter(s => s.source.sourceKind === 'item' && s.source.sourceInstanceId === instanceId).map(s => s.source.sourceDefinitionId))];
const itemSources = (snap: StrategySnapshot, unitId: string) => snap.units.find(u => u.unitId === unitId)!.sources.filter(s => s.source.sourceKind === 'item');
const scrapNatives = ['corki', 'ekko', 'powder', 'rumble', 'trundle', 'ziggs'];
const hero = (definitionId: string, id: string, col: number, row = 4): Unit => ({ id, definitionId, starLevel: 1, team: 'player', location: { kind: 'board', cell: { col, row } } });
function seat(units: Unit[], items: Items): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('4-1');
  return { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, level: 10, nextUnitSerial: 30, nextItemSerial: 30, preparation: { ...base.preparation, units }, items } as MatchState;
}
const local = (input: ReturnType<typeof compileBattle>, seatId: string, originalId: string, kind = 'unit') => input.mapping.find(m => m.seatId === seatId && m.originalId === originalId && m.kind === kind)!.combatId;


describe('Scrap 6/9 role tables (14.24 client source)', () => {
  it('rules copy equals the raw en_us role + map22 TFTCharacterRoleData for the seven natural Scrap champions', () => {
    const set13 = raw('en_us.json.gz').setData.find((s: { mutator: string }) => s.mutator === 'TFTSet13');
    const map22 = raw('map22.bin.json.gz');
    const roles = new Map(Object.values(map22).filter((r: any) => r?.__type === 'TFTCharacterRoleData').map((r: any) => [r.name, r.items.map((p: string) => p.split('/').at(-1))]));
    for (const api of ['TFT13_Blue', 'TFT13_Corki', 'TFT13_Ekko', 'TFT13_Gangplank', 'TFT13_Rumble', 'TFT13_Trundle', 'TFT13_Ziggs']) {
      const client = set13.champions.find((c: { apiName: string }) => c.apiName === api);
      const id = Object.values(M5_UNIT_DEFINITIONS).find(d => d.name === client.name)!.id;
      expect(M5_UNIT_DEFINITIONS[id].traits).toContain('scrap');
      expect(SCRAP_CHAMPION_ROLES[id]).toBe(client.role);
      expect(SCRAP_ROLE_ITEMS[client.role]).toEqual(roles.get(client.role));
    }
    // Research excerpt SCRAP-041 (Corki, ADCaster), transcribed by hand.
    expect(SCRAP_ROLE_ITEMS.ADCaster).toEqual(['TFT_Item_PowerGauntlet', 'TFT_Item_Deathblade', 'TFT_Item_InfinityEdge', 'TFT_Item_SpearOfShojin',
      'TFT_Item_MadredsBloodrazor', 'TFT_Item_LastWhisper', 'TFT_Item_UnstableConcoction', 'TFT_Item_RapidFireCannon']);
    expect(SCRAP_CHAMPION_ROLES).toEqual(CHAMPION_ROLES);
    expect(SCRAP_ROLE_ITEMS).toEqual(Object.fromEntries(Object.entries(ROLE_DISPLAY).map(([role, row]) => [role, row.items])));
  });
});

describe('Scrap 6 lucky / Scrap 9 radiant (P scrap-lucky-v1)', () => {
  const components = ['belt', 'sword', 'bow', 'tear', 'gloves', 'cloak', 'spatula'];
  const corkiKit = (prefix: string) => components.slice(0, 3).map((c, i) => held(`${prefix}-${c}`, c, 'corki', i));
  it('tier 4 keeps the ordinary first-recipe rule; tier 6 takes Corki\'s first recommended recipe match', () => {
    const four = buildStrategySnapshot(army('scrap', 4, scrapNatives.slice(0, 4), corkiKit('c')));
    expect(four.traits.find(t => t.team === 'player' && t.traitId === 'scrap')!.tier).toBe(4);
    // Lexicographic first legal recipe: belt -> evenshroud, sword -> bloodthirster, bow -> giant-slayer.
    expect(['c-belt', 'c-sword', 'c-bow'].map(id => itemSource(four, 'corki', id))).toEqual([['evenshroud'], ['bloodthirster'], ['giant-slayer']]);
    const six = buildStrategySnapshot(army('scrap', 6, scrapNatives, corkiKit('c')));
    expect(six.traits.find(t => t.team === 'player' && t.traitId === 'scrap')!.tier).toBe(6);
    // ADCaster order: Striker's... PowerGauntlet(belt+gloves), Deathblade(sword+sword), ..., MadredsBloodrazor(sword+bow).
    expect(['c-belt', 'c-sword', 'c-bow'].map(id => itemSource(six, 'corki', id))).toEqual([['guardbreaker'], ['deathblade'], ['giant-slayer']]);
  });
  it('tier 6 falls back to an FNV-1a/fmix32 uniform draw when no recommended item uses the component, and never converts Spatula', () => {
    const s = army('scrap', 6, scrapNatives, [held('c-cloak', 'cloak', 'corki', 0), held('c-spatula', 'spatula', 'corki', 1)]);
    const snap = buildStrategySnapshot(s);
    // Independent expectation: ordinary legal cloak recipes sorted by id, index floor(word*n/2^32).
    const pool = Object.values(ITEM_DEFINITIONS).filter(d => d.kind === 'completed' && !d.emblemTrait && d.slotCost !== 3 && d.recipe?.includes('cloak')).map(d => d.id).sort();
    expect(pool).toEqual(['adaptive-helm', 'bloodthirster', 'dragons-claw', 'evenshroud', 'gargoyle', 'ionic-spark', 'quicksilver', 'runaans-hurricane']);
    let x = (0x811c9dc5 ^ readG23Progress(s)!.seed ^ Math.imul(s.round, 0x9e3779b1)) >>> 0;
    for (const c of 'c-cloak') x = Math.imul(x ^ c.charCodeAt(0), 0x01000193) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; x = (x ^ (x >>> 16)) >>> 0;
    expect(itemSource(snap, 'corki', 'c-cloak')).toEqual([pool[Math.floor(x * pool.length / 4294967296)]]);
    expect(itemSource(snap, 'corki', 'c-spatula').filter(id => id !== 'spatula')).toEqual([]);
    // The draw is spread over the whole pool (different instance ids), never outside it.
    const seen = new Set(Array.from({ length: 64 }, (_, i) => itemSource(buildStrategySnapshot(army('scrap', 6, scrapNatives, [held(`k${i}`, 'cloak', 'corki', 0)])), 'corki', `k${i}`)[0]));
    expect([...seen].every(id => pool.includes(id))).toBe(true);
    expect(seen.size).toBeGreaterThan(4);
  });
  it('tier 9 turns the produced temporary items radiant, keeps the 60-per-component shield count, and plays them in combat', () => {
    const nine = army('scrap', 9, [...scrapNatives, 'gangplank'], corkiKit('c'));
    const snap = buildStrategySnapshot(nine);
    expect(snap.traits.find(t => t.team === 'player' && t.traitId === 'scrap')!.tier).toBe(9);
    expect(['c-belt', 'c-sword', 'c-bow'].map(id => itemSource(snap, 'corki', id))).toEqual([['TFT5_Item_TrapClawRadiant'], ['TFT5_Item_DeathbladeRadiant'], ['TFT5_Item_GiantSlayerRadiant']]);
    const scrap = snap.units.find(u => u.unitId === 'corki')!.mechanics!.find(m => m.mechanic === 'scrap')!;
    // Three components plus two emblems (each non-component counts 2) held by the team; conversion does not change it.
    expect(scrap.values).toMatchObject({ shieldPerComponent: 60, componentCount: 3 + 2 * 2 });
    const enemy: Unit = { id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 0, row: 3 } } };
    const preparation = { ...nine.preparation, units: [...nine.preparation.units, enemy] };
    const combat = createCombatWithEvents(preparation, buildStrategySnapshot({ ...nine, preparation }), 'scrap-9').state;
    const corki = combat.units.find(u => u.id === 'corki')!;
    expect(corki.shield).toBe(60 * 7);
    const six = createCombatWithEvents(preparation, buildStrategySnapshot({ ...nine, preparation, items: nine.items.filter(i => !i.id.startsWith('emblem-') || i.id <= 'emblem-0') }), 'scrap-x').state;
    expect(six.units.find(u => u.id === 'corki')!.attackDamage).toBeLessThan(corki.attackDamage);
    expect(nine.items.filter(i => i.id.startsWith('c-')).map(i => i.definitionId)).toEqual(['belt', 'sword', 'bow']);
  });
  it('save/restore (battle input JSON) keeps the lucky radiant conversion; a tampered conversion is refused', () => {
    const units = [...scrapNatives, 'gangplank', 'maddie', 'loris'].map((id, i) => hero(id, `unit-${i + 1}`, i % 7, 4 + Math.floor(i / 7)));
    const kit = [held('item-1', 'belt', 'unit-1', 0), held('item-2', 'sword', 'unit-1', 1), held('item-3', emblem('scrap'), 'unit-8', 0), held('item-4', emblem('scrap'), 'unit-9', 0)];
    const input = compileBattle(snapshotForBattle(seat([hero('garen', 'unit-1', 3)], []), 'A'), snapshotForBattle(seat(units, kit), 'B'), 42, { battleId: 'match-1:round-4-1:pair-0' });
    expect(input.strategy.traits.find(t => t.team === 'enemy' && t.traitId === 'scrap')!.tier).toBe(9);
    const corki = local(input, 'B', 'unit-1');
    expect(itemSource(input.strategy, corki, local(input, 'B', 'item-1', 'item'))).toEqual(['TFT5_Item_TrapClawRadiant']);
    expect(itemSource(input.strategy, corki, local(input, 'B', 'item-2', 'item'))).toEqual(['TFT5_Item_DeathbladeRadiant']);
    expect(startTwoSidedCombat(input).units.find(u => u.id === corki)!.shield).toBe(60 * (2 + 2 * 2));
    const text = JSON.stringify(input);
    expect(restoreBattleInput(JSON.parse(text))).toEqual(input);
    expect(input.b.items.map(i => i.definitionId)).toEqual(['belt', 'sword', emblem('scrap'), emblem('scrap')]);
    expect(() => restoreBattleInput(JSON.parse(text.replaceAll('TFT5_Item_TrapClawRadiant', 'guardbreaker')))).toThrow();
  });
});

describe('Enforcer 10 confiscation (P enforcer-confiscation-v1)', () => {
  const enforcers = ['maddie', 'loris', 'caitlyn', 'camille', 'steb', 'twistedfate', 'vi'];
  it('solo: player Enforcer 10 strips every projected enemy champion item; Enforcer 8 does not; own emblems keep the tier', () => {
    const items = getRoundEnemyItems(25);
    expect(items.length).toBe(3);
    const withEnemies = (s: MatchState) => ({ ...s, preparation: { ...s.preparation, units: [...s.preparation.units, ...createRoundEnemies(25)] } });
    const ten = withEnemies(army('enforcer', 10, enforcers, [], '5-1')), eight = withEnemies(army('enforcer', 8, enforcers, [], '5-1'));
    const a = buildStrategySnapshot(ten), b = buildStrategySnapshot(eight);
    expect(a.traits.find(t => t.team === 'player' && t.traitId === 'enforcer')!.tier).toBe(10);
    for (const { unitId } of items) {
      expect(itemSources(b, unitId).length).toBeGreaterThan(0);
      expect(itemSources(a, unitId)).toEqual([]);
    }
    // Emblems are never confiscated: the player's emblem holders keep their emblem sources.
    expect(ten.items.every(i => itemSources(a, i.location.kind === 'unit' ? i.location.unitId : '').some(s => s.source.sourceInstanceId === i.id))).toBe(true);
    // Combat behaviour: the enemy carry starts without its item stats.
    const carry = items[0].unitId;
    const ca = createCombatWithEvents(ten.preparation, a, 'enf-10').state.units.find(u => u.id === carry)!;
    const cb = createCombatWithEvents(eight.preparation, b, 'enf-8').state.units.find(u => u.id === carry)!;
    expect(cb.attackDamage).toBeGreaterThan(ca.attackDamage);
  });

  const enforcerSeat = (extra: Items = []) => {
    const others = heroes.filter(d => !d.traits.includes('enforcer')).slice(0, 3).map(d => d.id);
    const units = [...enforcers, ...others].map((id, i) => hero(id, `unit-${i + 1}`, i % 7, 4 + Math.floor(i / 7)));
    return seat(units, [...others.map((_, i) => held(`item-${i + 11}`, emblem('enforcer'), `unit-${enforcers.length + i + 1}`, 1)), ...extra]);
  };
  const victimSeat = () => seat([hero('corki', 'unit-1', 3), hero('ekko', 'unit-2', 4)],
    [held('item-1', 'deathblade', 'unit-1', 0), held('item-2', emblem('enforcer'), 'unit-1', 1), held('item-3', 'belt', 'unit-2', 0)]);

  it('two-sided: the opposing side loses all non-emblem items for combat only; restore recompiles it and tampering is refused', () => {
    const a = snapshotForBattle(enforcerSeat(), 'A'), b = snapshotForBattle(victimSeat(), 'B');
    const input = compileBattle(a, b, 42, { battleId: 'match-1:round-4-1:pair-0' });
    expect(input.strategy.traits.find(t => t.team === 'player' && t.traitId === 'enforcer')!.tier).toBe(10);
    const corki = local(input, 'B', 'unit-1'), ekko = local(input, 'B', 'unit-2');
    const ids = (unit: string) => itemSources(input.strategy, unit).map(s => s.source.sourceDefinitionId);
    expect(ids(corki).every(id => id === emblem('enforcer'))).toBe(true);
    expect(ids(corki).length).toBeGreaterThan(0);
    expect(ids(ekko)).toEqual([]);
    // The emblem still counts: B keeps an Enforcer 1-trait row from its emblem, and A's items are untouched.
    expect(input.strategy.traits.find(t => t.team === 'enemy' && t.traitId === 'enforcer')?.count).toBe(1);
    expect(itemSources(input.strategy, local(input, 'A', 'unit-8')).length).toBeGreaterThan(0);
    // Ledger: the seat snapshot still holds every item (they return after combat by never leaving).
    expect(input.b.items.map(i => i.definitionId).sort()).toEqual(['belt', 'deathblade', emblem('enforcer')].sort());
    const started = startTwoSidedCombat(input), sc = started.units.find(u => u.id === corki)!;
    const control = compileBattle(snapshotForBattle(seat([hero('maddie', 'unit-1', 3)], []), 'A'), b, 42, { battleId: 'match-1:round-4-1:pair-0' });
    const armed = startTwoSidedCombat(control).units.find(u => u.id === local(control, 'B', 'unit-1'))!;
    expect(armed.attackDamage).toBeGreaterThan(sc.attackDamage);
    expect(restoreBattleInput(JSON.parse(JSON.stringify(input)))).toEqual(input);
    const tampered = JSON.parse(JSON.stringify(input));
    const unit = tampered.strategy.units.find((u: { unitId: string }) => u.unitId === ekko);
    unit.sources = [...unit.sources, ...control.strategy.units.find(u => u.unitId === local(control, 'B', 'unit-2'))!.sources.filter(s => s.source.sourceKind === 'item')];
    expect(control.strategy.units.find(u => u.unitId === local(control, 'B', 'unit-2'))!.sources.some(s => s.source.sourceKind === 'item')).toBe(true);
    expect(() => restoreBattleInput(tampered)).toThrow();
  });
  it('battle-time equipment on a confiscated side stays inert for the rest of that combat', () => {
    const victim = { ...victimSeat(), items: [...victimSeat().items, { id: 'item-5', definitionId: 'sword', location: { kind: 'inventory' as const } }] } as MatchState;
    const equipped = equipItem(victim, 'item-5', 'unit-2', 1);
    expect(equipped.ok).toBe(true);
    const run = (opponent: MatchState) => {
      const input = compileBattle(snapshotForBattle(opponent, 'A'), snapshotForBattle(victim, 'B'), 42, { battleId: 'match-1:round-4-1:pair-0' });
      const task = startTwoSidedBattle(input);
      task.queueEquipment({ kind: 'equipment', seq: 1, effectiveTick: 1, seatId: 'B', itemId: 'item-5', unitId: 'unit-2', slot: 1 }, equipped.state);
      const result = task.advance(1201)!;
      return result.terminal.units.find(u => u.id === local(input, 'B', 'unit-2'))?.sources.filter(x => x.source.sourceKind === 'item').map(x => x.source.sourceDefinitionId);
    };
    expect(run(enforcerSeat())).toEqual([]);
    // Control without Enforcer 10: the sword combines with Ekko's belt into Sterak's Gage and takes effect.
    expect(run(seat([hero('maddie', 'unit-1', 3)], []))).toContain('steraks-gage');
  });
  it('two-sided: mutual Enforcer 10 confiscates both sides; a confiscated Scrap side neither converts nor counts components', () => {
    const a = snapshotForBattle(enforcerSeat([held('item-20', 'deathblade', 'unit-1', 0)]), 'A');
    const b = snapshotForBattle(enforcerSeat([held('item-20', 'warmog', 'unit-1', 0)]), 'B');
    const input = compileBattle(a, b, 42, { battleId: 'match-1:round-4-1:pair-0' });
    for (const [s, team] of [['A', 'player'], ['B', 'enemy']] as const) {
      expect(input.strategy.traits.find(t => t.team === team && t.traitId === 'enforcer')!.tier).toBe(10);
      expect(itemSources(input.strategy, local(input, s, 'unit-1'))).toEqual([]);
      expect(itemSources(input.strategy, local(input, s, 'unit-8')).length).toBeGreaterThan(0);
    }
    const scrap = seat(scrapNatives.map((id, i) => hero(id, `unit-${i + 1}`, i)), [held('item-1', 'belt', 'unit-1', 0)]);
    const versus = compileBattle(snapshotForBattle(enforcerSeat(), 'A'), snapshotForBattle(scrap, 'B'), 42, { battleId: 'match-1:round-4-1:pair-0' });
    const corki = versus.strategy.units.find(u => u.unitId === local(versus, 'B', 'unit-1'))!;
    expect(itemSources(versus.strategy, corki.unitId)).toEqual([]);
    expect(corki.mechanics!.find(m => m.mechanic === 'scrap')!.values.componentCount).toBe(0);
  });
});
