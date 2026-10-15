import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { G2_UNIT_DEFINITIONS } from '../src/simulation/content/g2-units';
import { G2_TRAIT_DEFINITIONS } from '../src/simulation/content/g2-traits';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { createSharedPool, POOL_CAPACITY_BY_COST, createMatch, decideBotAction, type MatchState } from '../src/server-entry';
import { accepted, aligned, context, execute } from './t7-helpers';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { resolveAbility } from '../src/simulation/combat-abilities';

const sourceRoot = '../src/simulation/content/source/s13-14.24b/';
const load = (file: string) => JSON.parse(readFileSync(new URL(sourceRoot + file, import.meta.url), 'utf8'));
const inventory = load('normalized/g2-1-champions.json');
const traits = load('normalized/g2-1-traits.json');
const items = load('normalized/g2-1-items.json');
const expected = { amumu: 1, powder: 1, singed: 1, violet: 1, nocturne: 2, vladimir: 2, zeri: 2,
  blitzcrank: 3, ekko: 4, illaoi: 4, twitch: 4, leblanc: 5, malzahar: 5, rumble: 5 } as const;

it('pins upstream decompressed bytes and every selected source pointer (including aliases)', () => {
  const bytes = gunzipSync(readFileSync(new URL(sourceRoot + 'raw/en_us.json.gz', import.meta.url)));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3');
  const source = JSON.parse(bytes.toString());
  for (const row of [...inventory.champions, ...traits.traits, ...items.items]) {
    const pointed = row.source.jsonPointer.slice(1).split('/').reduce((v: any, key: string) => v[key], source);
    expect(pointed).toEqual(row.record);
  }
  expect(inventory.champions).toHaveLength(34);
  expect(inventory.champions.find((c: any) => c.id === 'swain')).toMatchObject({ status: 'blocked-on-form-stats', stats: { magicResist: null } });
});

it('maps all admitted new heroes to independent source attributes, costs and ability identities', () => {
  expect(Object.keys(G2_UNIT_DEFINITIONS).sort()).toEqual(Object.keys(expected).sort());
  for (const [id, cost] of Object.entries(expected)) {
    const c = inventory.champions.find((r: any) => r.id === id), d = M5_UNIT_DEFINITIONS[id];
    expect(d.cost).toBe(cost); expect(d.name).toBe(c.record.name);
    expect(d.baseStats).toEqual({ health: c.record.stats.hp, attack: c.record.stats.damage, armor: c.record.stats.armor, magicResist: c.record.stats.magicResist });
    expect(d.baseAttackSpeedBps).toBe(Math.round(c.record.stats.attackSpeed * 10000));
    expect(d.abilityId).toBe(`${id}-ability`);
    for (const star of [1, 2, 3] as const) {
      const ability = resolveAbility(d.abilityId, star);
      expect(ability.kind).toBe('s13');
      if (ability.kind === 's13') for (const v of c.record.ability.variables.filter((v: any) => v.value !== null))
        expect(ability.variables[v.name]).toBe(Math.round(Math.round(v.value[star] * 10000) / 10000 * 10000));
    }
  }
});

it('has the real eight ordinary components and every one of their 36 unordered recipes', () => {
  expect(Object.values(ITEM_DEFINITIONS).filter(i => i.kind === 'component')).toHaveLength(8);
  expect(Object.values(ITEM_DEFINITIONS).filter(i => i.kind === 'completed')).toHaveLength(36);
  const byApi = Object.fromEntries(Object.values(ITEM_DEFINITIONS).map(i => [i.apiName, i]));
  const pairs = new Set<string>();
  for (const row of items.items) {
    const runtime = byApi[row.record.apiName]; expect(runtime).toBeDefined();
    if (row.record.composition.length) {
      const actual = runtime.recipe!.map((id: string) => ITEM_DEFINITIONS[id].apiName).sort();
      expect(actual).toEqual([...row.record.composition].sort()); pairs.add(actual.join('+'));
    }
  }
  expect(pairs.size).toBe(36);
});

it('freezes the expanded shop species count and bag capacity at every cost', () => {
  const pool = createSharedPool('g2-test', 42, {seatCount:8});
  const counts = [14, 12, 7, 9, 6], capacities = [420, 300, 126, 90, 54];
  for (const [n, cost] of ([1, 2, 3, 4, 5] as const).entries()) {
    expect(SHOP_CATALOG_BY_COST[cost]).toHaveLength(counts[n]);
    expect(SHOP_CATALOG_BY_COST[cost].reduce((sum, id) => sum + pool.initial[id], 0)).toBe(capacities[n]);
    for (const id of SHOP_CATALOG_BY_COST[cost]) expect(pool.initial[id]).toBe(POOL_CAPACITY_BY_COST[cost]);
  }
  expect(Object.keys(pool.initial)).toHaveLength(48); expect(Object.values(pool.initial).reduce((s, n) => s + n)).toBe(990);
});

describe('G2 factions: source breakpoints and effective tiers', () => {
  it.each(['automata', 'family', 'firelight'])('%s thresholds match the locked record', id => {
    const raw = traits.traits.find((t: any) => t.record.name.toLowerCase() === id).record;
    expect(G2_TRAIT_DEFINITIONS[id].tiers.map(t => t.threshold)).toEqual(raw.effects.filter((t: any)=>t.minUnits <= ({automata:5,family:3,firelight:3} as Record<string,number>)[id]).map((t: any) => t.minUnits));
  });
  it('counts distinct on-board members: 1/2/3/4 automata and never bench or duplicate definitions', () => {
    const base = createMatch(42);
    for (const [names, threshold] of [ [['amumu'],0], [['amumu','kogmaw'],2], [['amumu','kogmaw','nocturne'],2], [['amumu','kogmaw','nocturne','blitzcrank'],4], [['amumu','amumu'],0] ] as const) {
      const preparation = { ...base.preparation, units: names.map((definitionId, n) => ({ id: `u${n}`, definitionId, starLevel: 1 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: n, row: 4 } } })) };
      expect(deriveTraits(preparation, 'player').find(t => t.traitId === 'automata')!.tier).toBe(threshold);
    }
  });
  it.each([
    ['firelight',['scar'],0], ['firelight',['scar','zeri'],2], ['firelight',['scar','zeri','ekko'],3],
    ['family',['vander'],0], ['family',['vander','powder'],0], ['family',['vander','powder','violet'],3],
  ] as const)('%s activates at distinct-member breakpoint (%s)',(id,names,threshold)=>{
    const base=createMatch(42),preparation={...base.preparation,units:names.map((definitionId,n)=>({id:`u${n}`,definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:n,row:4}}}))};
    expect(deriveTraits(preparation,'player').find(t=>t.traitId===id)!.tier).toBe(threshold);
  });

});

it.each(Object.keys(expected))('basic bot can buy and deploy new hero %s', id => {
  let state: MatchState = aligned({ ...createMatch(42), gold: 50, playerHp: 20, level: 9, xp: 0 });
  state = { ...state, shop: { ...state.shop, slots: [{status:'available',definitionId:id}, ...Array.from({length:4},()=>({status:'purchased' as const,empty:true as const}))] } };
  const decision = decideBotAction(state, context(state), 42); expect(decision.action).toMatchObject({ type:'buy', slot:0 });
  if (decision.action === 'done') throw new Error('Expected purchase');
  state = accepted(execute(state, decision.action));
  for (let n=0;n<30;n++) {
    const d=decideBotAction(state,{...context(state),stepsTaken:n},42); if(d.action==='done')break;
    state=accepted(execute(state,d.action));
  }
  expect(state.preparation.units.some(u=>u.definitionId===id&&u.location.kind==='board')).toBe(true);
});

it('Family compiles 25% lower maximum mana with integer floors: Powder90, Violet48, Vander37',()=>{
 const base=createMatch(42),names=['powder','violet','vander'];
 const preparation={...base.preparation,units:names.map((definitionId,n)=>({id:definitionId,definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:n,row:4}}}))};
 const compiled=buildStrategySnapshot({...base,preparation});
 expect(Object.fromEntries(compiled.units.map(u=>[u.unitId,u.stats.maxMana]))).toEqual({powder:90,violet:48,vander:37});
});

it.each([
 ['automata',['amumu','kogmaw'],2,25], ['automata',['amumu','kogmaw','nocturne','blitzcrank'],4,60],
 ['firelight',['scar','zeri'],2,2000], ['firelight',['scar','zeri','ekko'],3,3300],
] as const)('%s tier %s compiles a finite battle mechanic',(trait,names,tier,value)=>{
 const base=createMatch(42),preparation={...base.preparation,units:names.map((definitionId,n)=>({id:definitionId,definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:n,row:4}}}))};
 const compiled=buildStrategySnapshot({...base,preparation});
 expect(compiled.traits.find(t=>t.traitId===trait)!.tier).toBe(tier);
 for(const u of compiled.units){
  const m=u.mechanics!.find(m=>m.mechanic===trait)!;expect(m).toBeDefined();
  if(trait==='firelight')expect(m.values.healBps).toBe(value);
  else expect(u.stats.armor).toBe(M5_UNIT_DEFINITIONS[u.unitId].baseStats.armor+value);
 }
});
