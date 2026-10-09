import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { describe, expect, it } from 'vitest';
import { M5_UNIT_DEFINITIONS, M5_UNIT_IDS, NEUTRAL_UNIT_DEFINITIONS, UNIT_DEFINITIONS } from '../src/simulation/units';
import { ITEM_DEFINITIONS, COMPONENT_IDS } from '../src/simulation/content/items';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../src/simulation/content/anomalies';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { SOURCE_MANIFEST } from '../src/simulation/content/source-manifest';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { getRoundKind, getRoundSchedule, getStageRound } from '../src/simulation/round-schedule';
import { createRoundEnemies, getRoundEnemyItems, getEnemyGrowthBps } from '../src/simulation/round-enemies';
import { validateAcquisitionIsolation, validateContent, validateEffect } from '../src/simulation/validate-content';
import type { Effect } from '../src/simulation/strategy-types';

// Explicit reference answers below were transcribed from the frozen RULES and
// historical source; they never call production calculators to derive expectations.
describe('M5 frozen S13 slice',()=>{
  it('keeps exactly 19 buyable heroes, all five costs populated, and neutrals/legacy isolated',()=>{
    expect(M5_UNIT_IDS).toEqual(['caitlyn','corki','darius','ezreal','garen','irelia','kogmaw','leona','loris','lux','maddie','nami','rell','scar','tristana','urgot','vander','zoe','zyra']);
    expect(Object.values(SHOP_CATALOG_BY_COST).flat().sort()).toEqual(M5_UNIT_IDS);
    expect(Object.values(SHOP_CATALOG_BY_COST).map(row=>row.length)).toEqual([5,5,5,3,1]);
    expect(Object.keys(NEUTRAL_UNIT_DEFINITIONS)).toHaveLength(5);
    expect(UNIT_DEFINITIONS.sentinel).toBeDefined();
    expect(M5_UNIT_DEFINITIONS.sentinel).toBeUndefined();
    expect(()=>validateAcquisitionIsolation()).not.toThrow();
  });
  it('preserves source provenance and separately records the actual 14.24b override',()=>{
    expect(SOURCE_MANIFEST.rawSha256).toBe('c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3');
    expect(SOURCE_MANIFEST.selector).toBe('setData[mutator === "TFTSet13"]');
    expect(SOURCE_MANIFEST.overrides).toEqual([
      {path:'champions.loris.stats.initialMana',from:50,to:40},
      {path:'champions.loris.stats.mana',from:90,to:80},
    ]);
    expect(M5_UNIT_DEFINITIONS.loris.initialMana).toBe(40);
    expect(M5_UNIT_DEFINITIONS.loris.maxMana).toBe(80);
    expect(M5_UNIT_DEFINITIONS.tristana.baseAttackSpeedBps).toBe(7500);
    expect(M5_UNIT_DEFINITIONS.kogmaw.baseStats.attack).toBe(15);
    expect(M5_UNIT_DEFINITIONS.caitlyn.baseStats.attack).toBe(82);
  });
  it('retains the historically distinct skills and all their three-star coefficient slots',()=>{
    expect(Object.keys(S13_ABILITY_DATA)).toHaveLength(19);
    expect(S13_ABILITY_DATA['tristana-ability'].variables.PercentAttackDamage).toEqual([5.25,5.25,5.25]);
    expect(S13_ABILITY_DATA['tristana-ability'].variables.ASKillGain).toEqual([1.25,1.25,1.25]);
    expect(S13_ABILITY_DATA['corki-ability'].variables.BaseMissiles).toEqual([21,21,35]);
    expect(S13_ABILITY_DATA['caitlyn-ability'].variables.TotalShots).toEqual([4,4,20]);
    expect(S13_ABILITY_DATA['loris-ability'].variables.PercentDamageRedirect).toEqual([0.5,0.5,0.5]);
    expect(S13_ABILITY_DATA['kogmaw-ability'].variables.DamageOnAttack).toEqual([48,72,120]);
    expect(S13_ABILITY_DATA['scar-ability'].variables.StunDuration).toEqual([1.5,1.5,1.75]);
    for(const ability of Object.values(S13_ABILITY_DATA)) for(const [key,values] of Object.entries(ability.variables)) {
      expect(key).not.toMatch(/^(HERO|Experiment)/);expect(key).not.toContain('Hyperroll');
      expect(values).toHaveLength(3);expect(values.every(Number.isFinite)).toBe(true);
    }
  });
  it('freezes exactly 5 supported traits, 8 components, 36 recipes, 6 augments and 3 anomalies',()=>{
    expect([TRAIT_DEFINITIONS,ITEM_DEFINITIONS,AUGMENT_DEFINITIONS,ANOMALY_DEFINITIONS].map(c=>Object.keys(c).length)).toEqual([5,44,6,3]);
    expect(COMPONENT_IDS).toEqual(['sword','vest','belt','rod','cloak','bow','gloves','tear']);
    const complete=Object.values(ITEM_DEFINITIONS).filter(i=>i.kind==='completed');expect(complete).toHaveLength(36);
    for(const item of complete) expect(item.recipe?.every(id=>COMPONENT_IDS.includes(id))).toBe(true);
    expect(ITEM_DEFINITIONS.gunblade.recipe).toEqual(['sword','rod']);
    expect(ITEM_DEFINITIONS.warmog.effects).toEqual([{kind:'statFlat',stat:'maxHp',amount:600},{kind:'statPercentBps',stat:'maxHp',bps:1200}]);
    expect(TRAIT_DEFINITIONS.sentinel.tiers[1].effects).toEqual([{kind:'statFlat',stat:'armor',amount:25},{kind:'statFlat',stat:'magicResist',amount:25}]);
    expect(TRAIT_DEFINITIONS.sentinel.tiers[1].memberEffects).toEqual([{kind:'statFlat',stat:'armor',amount:50},{kind:'statFlat',stat:'magicResist',amount:50}]);
    expect(Object.isFrozen(ITEM_DEFINITIONS.gunblade.effects)).toBe(true);
  });
  it('provides all three published eight-unit builds through the actual shop and complete recipes',()=>{
    const builds=[['tristana','urgot','ezreal','corki','irelia','rell','leona','loris'],['maddie','kogmaw','darius','vander','scar','garen','irelia','loris'],['lux','zyra','nami','zoe','irelia','rell','leona','loris']];
    for(const build of builds){expect(new Set(build).size).toBe(8);for(const id of build)expect(M5_UNIT_IDS).toContain(id);}
    expect(builds.map(build=>Object.fromEntries(Object.keys(TRAIT_DEFINITIONS).map(t=>[t,build.filter(id=>M5_UNIT_DEFINITIONS[id].traits.includes(t)).length])))).toEqual([
      {sentinel:4,artillerist:4,sniper:0,watcher:0,sorcerer:0},
      {sentinel:2,artillerist:0,sniper:2,watcher:4,sorcerer:0},
      {sentinel:4,artillerist:0,sniper:0,watcher:0,sorcerer:4},
    ]);
  });
  it('rejects unknown finite mechanics and malformed numeric definitions',()=>{
    expect(()=>validateEffect({kind:'mechanic',mechanic:'spawn-arbitrary-code',values:{}})).toThrow();
    expect(()=>validateEffect({kind:'mechanic',mechanic:'archangel',values:{periodTicks:0,abilityPower:30}})).toThrow();
    expect(()=>validateEffect({kind:'mechanic',mechanic:'gunblade',values:{selfHealBps:1500,allyHealBps:2500,secret:1}})).toThrow();
    expect(()=>validateEffect({kind:'statFlat',stat:'abilityPower',amount:NaN})).toThrow();
    expect(()=>validateEffect({kind:'trigger',hook:'onAttack',everyN:1,action:{kind:'summon',amount:10}} as unknown as Effect)).toThrow();
    expect(()=>validateContent()).not.toThrow();
  });
});

describe('M5 finite campaign content',()=>{
  it('maps the catalog from 1-2 to 6-7 with 38 progression rounds and 33 battles',()=>{
    expect(getStageRound(1)).toEqual({stage:1,round:2});expect(getStageRound(getCatalogRoundById('4-6').ordinal)).toEqual({stage:4,round:6});
    expect(getStageRound(ROUND_CATALOG.at(-1)!.ordinal)).toEqual({stage:6,round:7});
    const kinds=ROUND_CATALOG.map(r=>getRoundKind(r.ordinal));
    expect(kinds.filter(k=>k==='pvp')).toHaveLength(25);expect(kinds.filter(k=>k==='pve')).toHaveLength(8);expect(kinds.filter(k=>k==='supply')).toHaveLength(5);
    for(const invalid of [0,ROUND_CATALOG.length+1,1.5,NaN,Infinity]) expect(()=>getRoundKind(invalid)).toThrow();
  });
  it('freezes three augments, the 4-6 anomaly and five supplies; B8 owns the missing PvE drop chain',()=>{
    const events=ROUND_CATALOG.map(r=>({round:r.roundId,events:getRoundSchedule(r.ordinal)}));
    expect(events.filter(r=>r.events.some(e=>e.kind==='augment')).map(r=>r.round)).toEqual(['2-1','3-2','4-2']);
    expect(events.filter(r=>r.events.some(e=>e.kind==='anomaly')).map(r=>r.round)).toEqual(['4-6']);
    expect(events.flatMap(r=>r.events).filter(e=>e.kind==='component')).toHaveLength(5);
    expect(events.flatMap(r=>r.events).reduce((n,e)=>n+(e.kind==='reward'?e.randomComponents:0),0)).toBe(0);
    expect(getRoundSchedule(1)).toEqual([]);
    expect(getRoundSchedule(getCatalogRoundById('2-1').ordinal).map(e=>e.kind)).toEqual(['augment']);
    expect(getRoundSchedule(getCatalogRoundById('2-7').ordinal)).toEqual([]);
    expect(getRoundSchedule(getCatalogRoundById('6-7').ordinal)).toEqual([]);
  });
  it('uses public fixed opponent difficulty, no invisible growth, and no enemies for supplies',()=>{
    expect(createRoundEnemies(getCatalogRoundById('2-1').ordinal)).toHaveLength(3);expect(createRoundEnemies(getCatalogRoundById('2-5').ordinal)).toHaveLength(4);
    expect(createRoundEnemies(getCatalogRoundById('3-1').ordinal)).toHaveLength(5);expect(createRoundEnemies(getCatalogRoundById('4-1').ordinal)).toHaveLength(6);
    expect(createRoundEnemies(getCatalogRoundById('5-1').ordinal)).toHaveLength(7);expect(createRoundEnemies(getCatalogRoundById('6-1').ordinal)).toHaveLength(8);
    expect(createRoundEnemies(getCatalogRoundById('2-4').ordinal)).toEqual([]);expect(createRoundEnemies(getCatalogRoundById('6-7').ordinal).map(u=>u.definitionId)).toEqual(['neutral-stage-6']);
    expect(createRoundEnemies(getCatalogRoundById('4-1').ordinal).map(u=>u.starLevel)).toEqual([2,2,2,1,1,1]);
    for(const {ordinal:round} of ROUND_CATALOG) {
      expect(getEnemyGrowthBps(round)).toBe(0);
      const units=createRoundEnemies(round);expect(new Set(units.map(u=>u.id)).size).toBe(units.length);
      expect(new Set(units.map(u=>u.location.kind==='board'?`${u.location.cell.col},${u.location.cell.row}`:'')).size).toBe(units.length);
      for(const item of getRoundEnemyItems(round)){expect(units.some(u=>u.id===item.unitId)).toBe(true);expect(ITEM_DEFINITIONS[item.definitionId].kind).toBe('completed');}
    }
    expect(getRoundEnemyItems(getCatalogRoundById('4-1').ordinal)).toHaveLength(1);expect(getRoundEnemyItems(getCatalogRoundById('5-1').ordinal)).toHaveLength(3);expect(getRoundEnemyItems(getCatalogRoundById('6-1').ordinal)).toHaveLength(5);
    expect(getRoundEnemyItems(getCatalogRoundById('6-7').ordinal)).toEqual([]);
  });
});
