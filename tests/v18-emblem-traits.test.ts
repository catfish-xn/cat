import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createMatch, combineItems, equipItem, useConsumable, startMatchCombat, stepMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { validateMechanisms } from '../src/simulation/m8/restore';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { EMBLEM_REFORGE_SOURCE } from '../src/simulation/content/emblem-source';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { sampleOrbBox } from '../src/simulation/orb-box';
import { reforgeCandidates } from '../src/simulation/consumables';
import { grantMechanicItem, appendMechanicReceipt } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';
import { g23Laboratories } from '../src/simulation/g2-3-experiment';
import { validateM5Runtime } from '../src/simulation/serialization-structure';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION, type RoundSettlementReceipt } from '../src/simulation/round-settlement';
import { reachRound } from './match-helpers';

const heroes=Object.values(M5_UNIT_DEFINITIONS);
function formation(names:string[]):MatchState {
  const s=createMatch(42);
  return {...s,preparation:{...s.preparation,units:names.map((definitionId,i)=>({id:definitionId,definitionId,starLevel:1,team:'player',location:{kind:'board',cell:{col:i%7,row:4+Math.floor(i/7)}}} as Unit))}};
}
function tierArmy(traitId:string,tier:number):MatchState {
  const native=heroes.filter(d=>d.traits.includes(traitId)).slice(0,tier).map(d=>d.id);
  const added=heroes.filter(d=>!d.traits.includes(traitId)).slice(0,tier-native.length).map(d=>d.id);
  const emblem=Object.values(EMBLEM_ITEMS).find(d=>d.emblemTrait===traitId)!;
  return {...formation([...native,...added]),items:added.map((unitId,i)=>({id:'item-'+(i+1),definitionId:emblem.id,location:{kind:'unit',unitId,slot:0}}))};
}
function combat(s:MatchState,twoEnemies=false):CombatState {
  const enemy:Unit={id:'enemy',definitionId:'garen',team:'enemy',starLevel:3,location:{kind:'board',cell:{col:0,row:3}}};
  const preparation={...s.preparation,units:[...s.preparation.units,enemy,...(twoEnemies?[{...enemy,id:'enemy2',location:{kind:'board' as const,cell:{col:6,row:0}}}]:[])]};
  return createCombatWithEvents(preparation,buildStrategySnapshot({...s,preparation}),'v18').state;
}
const mechanic=(s:MatchState,id:string,key:string)=>buildStrategySnapshot(s).units.flatMap(u=>u.mechanics??[]).find(m=>m.mechanic===id)!.values[key];
function validateRuntime(c:CombatState):void {
  for(const u of c.units)validateM5Runtime(u,c.tick,new Set(c.units.map(u=>u.id)),c.units,'v18',new Set(),
    (a,b)=>JSON.stringify(a)===JSON.stringify(b),c.nextActionSeq!);
}

describe('v18 archive-backed emblem acquisition',()=>{
  it('matches all 22 source identities, native exclusions, stats and all 16 compositions',()=>{
    const archive=JSON.parse(gunzipSync(readFileSync(new URL('../src/simulation/content/source/s13-14.24b/raw/en_us.json.gz',import.meta.url))).toString());
    const rows=archive.items.filter((i:any)=>/^TFT13_Item_.*EmblemItem$/.test(i.apiName));
    for(const [id,apiName] of [['spatula','TFT_Item_Spatula'],['frying-pan','TFT_Item_FryingPan']]){
      expect(archive.items.find((i:any)=>i.apiName===apiName).composition).toEqual([]);
      expect(rows.some((i:any)=>i.composition.length===2&&i.composition.includes(apiName))).toBe(true);
      expect(ITEM_DEFINITIONS[id]).toMatchObject({kind:'component',craftingOnly:true});
    }
    expect(rows).toHaveLength(22);expect(Object.keys(EMBLEM_ITEMS).sort()).toEqual(rows.map((i:any)=>i.apiName).sort());
    expect(Object.values(EMBLEM_ITEMS).filter(i=>i.recipe)).toHaveLength(16);
    for(const row of rows){
      const d=EMBLEM_ITEMS[row.apiName];expect(d.unique).toBe(true);
      expect(d.recipe?.map(id=>ITEM_DEFINITIONS[id].apiName).sort()??[]).toEqual([...row.composition].sort());
      const native=heroes.find(h=>h.traits.includes(d.emblemTrait!))!;
      const s=formation([native.id]);
      const failed=equipItem({...s,items:[{id:'item-1',definitionId:d.id,location:{kind:'inventory'}}]},'item-1',native.id,0);
      expect(failed.ok).toBe(false);expect('events' in failed).toBe(false);
    }
    expect([...EMBLEM_REFORGE_SOURCE].sort()).toEqual(Object.keys(EMBLEM_ITEMS).sort());
    for(const d of Object.values(EMBLEM_ITEMS))expect(reforgeCandidates(d.id).map(d=>d.definitionId)).toEqual([...EMBLEM_REFORGE_SOURCE].sort().filter(id=>id!==d.id));
    expect(reforgeCandidates('sword')).toHaveLength(7);expect(reforgeCandidates('deathblade')).toHaveLength(35);
  });
  it('drops each crafting input from its archived prismatic row without changing the row weight',()=>{
    const seen=new Set<string>();
    for(let seed=0;seed<1000&&seen.size<2;seed++){
      const box=sampleOrbBox(seed,'synthetic-prismatic','ultraPlus');
      for(const p of box.payloads)if(p.kind==='item'&&['spatula','frying-pan'].includes(p.definitionId)){
        seen.add(p.definitionId);expect(box.rowId).toBe(p.definitionId==='spatula'?'support-component-spatula':'support-component-pan');
      }
    }
    expect([...seen].sort()).toEqual(['frying-pan','spatula']);
  });
  it.each(Object.values(EMBLEM_ITEMS).filter(d=>d.recipe).map(d=>[d.id,d.recipe!] as const))('combines %s through Match, preserves identity on equip and restores it', (definitionId,recipe)=>{
    let s=createMatch(42);
    for(const [i,id] of recipe.entries()){
      const granted=grantMechanicItem(s,{receiptId:'v18-input-'+i,source:'test',definitionId:id});expect(granted.ok).toBe(true);s=granted.state;
    }
    const result=combineItems(s,s.items[0].id,s.items[1].id);expect(result.ok).toBe(true);
    expect(result.state.items).toHaveLength(1);expect(result.state.items[0].definitionId).toBe(definitionId);
    const restored=restoreMatch(serializeMatch(result.state));expect(restored).toEqual(result.state);
    const failed=combineItems(result.state,'missing',result.state.items[0].id);expect(failed.state).toBe(result.state);expect('events' in failed).toBe(false);
  });
  it('public emblem reforge stays within the emblem category and replays/restores the receipt',()=>{
    let s=createMatch(42),unit=s.preparation.units.find(u=>u.team==='player')!;
    const d=Object.values(EMBLEM_ITEMS).find(d=>!M5_UNIT_DEFINITIONS[unit.definitionId].traits.includes(d.emblemTrait!))!;
    const grant=grantMechanicItem(s,{receiptId:'v18-emblem',source:'test',definitionId:d.id});expect(grant.ok).toBe(true);s=grant.state;
    s=equipItem(s,s.items[0].id,unit.id,0).state;
    const id='consumable-'+s.nextConsumableSerial;
    s=appendMechanicReceipt({...s,nextConsumableSerial:s.nextConsumableSerial+1,consumables:[...s.consumables,{consumableId:id,definitionId:'reforger'}]},
      {kind:'consumable',receiptId:'v18-reforger',source:'test',round:s.round,roundId:s.roundDefinitionId,definitionId:'reforger',consumableId:id});
    const r=useConsumable(s,id,{kind:'unit',unitId:unit.id});expect(r.ok).toBe(true);
    expect(EMBLEM_ITEMS[r.state.items[0].definitionId]).toBeDefined();expect(r.state.items[0].definitionId).not.toBe(d.id);
    expect(restoreMatch(serializeMatch(r.state))).toEqual(r.state);
    const retry=useConsumable(r.state,id,{kind:'unit',unitId:unit.id});expect(retry.state).toBe(r.state);expect('events' in retry).toBe(false);
  });
  it('public equipped emblems survive frozen-combat restoration and continuation',()=>{
    let s=createMatch(42);const unit=s.preparation.units.find(u=>u.team==='player')!;
    const d=Object.values(EMBLEM_ITEMS).find(d=>!M5_UNIT_DEFINITIONS[unit.definitionId].traits.includes(d.emblemTrait!))!;
    const granted=grantMechanicItem(s,{receiptId:'v18-combat-emblem',source:'test',definitionId:d.id});expect(granted.ok).toBe(true);s=granted.state;
    const equipped=equipItem(s,s.items[0].id,unit.id,0);expect(equipped.ok).toBe(true);s=equipped.state;
    const started=startMatchCombat(s);expect(started.ok).toBe(true);s=started.state;
    expect(s.combat!.strategy!.traits.find(t=>t.team==='player'&&t.traitId===d.emblemTrait)?.count).toBeGreaterThan(0);
    for(let i=0;i<3;i++){
      const restored=restoreMatch(serializeMatch(s));expect(restored).toEqual(s);expect(stepMatch(restored)).toEqual(stepMatch(s));s=stepMatch(s).state;
    }
  });
});

const unlocked=[['automata',6],['sorcerer',8],['visionary',8],['sniper',6],['academy',6],['chem-baron',7],['firelight',4],['enforcer',8],['enforcer',10],['family',4],['family',5],['scrap',9],['artillerist',6],['rebel',10],['pit-fighter',8],['experiment',7],['black-rose',7],['conqueror',9]] as const;
it.each(unlocked)('reaches %s %i through held emblems; compiler and combat retain its effects',(id,tier)=>{
  const s=tierArmy(id,tier),before=JSON.stringify(s),snap=buildStrategySnapshot(s),row=snap.traits.find(t=>t.team==='player'&&t.traitId===id)!;
  expect(row.count).toBe(tier);expect(row.tier).toBe(tier);expect(row.targetUnitIds.length).toBeGreaterThanOrEqual(tier);
  expect(deriveTraits(s.preparation,'player',undefined,undefined,s.items).find(t=>t.traitId===id)).toMatchObject({tier:row.tier,count:row.count,memberDefinitionIds:row.memberDefinitionIds});
  const expected=TRAIT_DEFINITIONS[id].tiers.find(t=>t.threshold===tier)!;
  const c=combat(s);expect(c.strategy!.traits.find(t=>t.team==='player'&&t.traitId===id)?.tier).toBe(tier);
  expect(snap.units.some(u=>u.sources.some(source=>source.source.sourceDefinitionId===id))).toBe(true);
  expect(expected.effects.length).toBeGreaterThan(0);expect(JSON.stringify(s)).toBe(before);
  // Removing every emblem immediately removes the high tier; the frozen combat keeps it.
  expect(deriveTraits(s.preparation,'player').find(t=>t.traitId===id)!.tier).toBeLessThan(tier);
});

it('pins independently transcribed top-tier numbers in live strategy and opening shields',()=>{
  const auto=buildStrategySnapshot(tierArmy('automata',6)).units[0];expect(auto.stats.armor).toBe(M5_UNIT_DEFINITIONS[auto.unitId].baseStats.armor+140);
  expect(mechanic(tierArmy('automata',6),'automata','damage')).toBe(1100);
  expect(buildStrategySnapshot(tierArmy('sorcerer',8)).units.find(u=>u.unitId==='lux')!.abilityPower).toBe(225);
  expect(mechanic(tierArmy('visionary',8),'visionary','manaBps')).toBe(10000);
  expect(mechanic(tierArmy('sniper',6),'sniper','damageBpsPerHex')).toBe(3600);
  expect(mechanic(tierArmy('firelight',4),'firelight','healBps')).toBe(4000);
  expect(mechanic(tierArmy('scrap',9),'scrap','shieldPerComponent')).toBe(60);
  // Independently transcribed 12/17 B patch: Cannoneer 6 grants 70% AD.
  const cannon=buildStrategySnapshot(tierArmy('artillerist',6)).units.find(u=>u.unitId==='tristana')!;
  expect(cannon.stats.attack).toBe(Math.floor(M5_UNIT_DEFINITIONS.tristana.baseStats.attack*17000/10000));
  expect(TRAIT_DEFINITIONS.artillerist.tiers.find(t=>t.threshold===6)!.effects)
    .toContainEqual({kind:'statPercentBps',stat:'attackDamage',bps:7000});
  expect(mechanic(tierArmy('artillerist',6),'artillery','everyN')).toBe(4);
  expect(mechanic(tierArmy('artillerist',6),'artillery','adBps')).toBe(25000);
  for(const [tier,shield,amp,wanted] of [[8,4000,5000,5],[10,10000,15000,99]]){
    const s=tierArmy('enforcer',tier),c=combat(s),u=c.units.find(u=>u.team==='player')!;
    expect(u.shield).toBe(Math.floor(u.maxHp*shield/10000));expect(mechanic(s,'damageAmp','bps')).toBe(amp);expect(mechanic(s,'enforcer','wanted')).toBe(wanted);
  }
  const chem=tierArmy('chem-baron',7),p=readG23Progress(chem)!;
  const grown=buildStrategySnapshot(writeG23Progress(chem,{...p,chem:{...p.chem,skips:2}})),plain=buildStrategySnapshot(chem);
  expect(grown.units[0].stats.health-plain.units[0].stats.health).toBe(440);
  const baseAcademy=tierArmy('academy',6),holder=baseAcademy.preparation.units[0].id,sponsored=readG23Progress(baseAcademy)!.sponsored[0];
  const academy={...baseAcademy,items:[...baseAcademy.items,{id:'sponsored',definitionId:sponsored,location:{kind:'unit' as const,unitId:holder,slot:1}}]};
  expect(buildStrategySnapshot(academy).units.find(u=>u.unitId===holder)!.mechanics!.find(m=>m.mechanic==='damageAmp')!.values.bps).toBe(2300);
  expect(mechanic(tierArmy('family',4),'family','manaReductionBps')).toBe(3000);
  const conqueror=buildStrategySnapshot(tierArmy('conqueror',9)).units[0];expect(conqueror.abilityPower).toBe(210); // 100 base + 100 Conqueror + 10 team Sorcerer;
  const rebel=combat(tierArmy('rebel',10));
  const triggered=stepCombat({...rebel,units:rebel.units.map(u=>({...u,hp:Math.floor(u.maxHp/2),cooldownTicks:1000,moveCooldownTicks:1000}))}).state;
  const r=triggered.units.find(u=>u.team==='player')!;expect(r.v19?.smokePermanent).toBe(true);expect(r.maxHpBasis?.bonusBps).toBe(3000);
});

it('Experiment 7 doubles donor bonuses on Laboratory hexes',()=>{
  let s=tierArmy('experiment',7);const labs=g23Laboratories(42,'player',7);
  s={...s,preparation:{...s.preparation,units:s.preparation.units.map((u,i)=>({...u,location:{kind:'board',cell:i<3?labs[i]:{col:i,row:7}}}))}};
  const snap=buildStrategySnapshot(s),lab=snap.units.filter(u=>u.sources.some(s=>s.effect.kind==='mechanic'&&s.effect.mechanic==='g23Experiment'));
  expect(lab).toHaveLength(3);expect(lab[0].sources.some(s=>s.effect.kind==='statFlat'&&s.effect.stat==='maxHp'&&s.effect.amount>=300)).toBe(true);
  const donors=s.preparation.units.slice(0,3).map(u=>u.definitionId);
  const bonuses=lab[0].mechanics!.find(m=>m.mechanic==='g23Experiment')!.values;
  if(donors.includes('drmundo'))expect(bonuses.mundo).toBe(120);
  if(donors.includes('nunu'))expect(bonuses.nunu).toBe(600);
});

it('Quickstriker speed follows target missing HP continuously, independently of holder HP',()=>{
  const c=combat(tierArmy('quickstriker',4)),id=c.units.find(u=>u.team==='player')!.id;
  const sample=(own:number,target:number)=>{
    const units=c.units.map(u=>u.id===id?{...u,hp:Math.floor(u.maxHp*own/100),targetId:'enemy'}:u.id==='enemy'?{...u,hp:Math.floor(u.maxHp*target/100)}:u);
    return readCombatStats(units.find(u=>u.id===id)!,{...c,units}).attackIntervalTicks;
  };
  expect(sample(100,100)).toBe(sample(20,100));expect(sample(100,100)).toBeGreaterThan(sample(100,50));expect(sample(100,50)).toBeGreaterThan(sample(100,1));
});

it('Quickstriker 4 shields on current-target death, never on holder low HP',()=>{
  let c=combat(tierArmy('quickstriker',4),true);const id=c.units.find(u=>u.team==='player')!.id;
  c={...c,units:c.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000}))};
  const low=stepCombat({...c,units:c.units.map(u=>u.id===id?{...u,hp:Math.floor(u.maxHp/4)}:u)}).state;
  expect(low.units.find(u=>u.id===id)!.shield).toBe(0);
  // A surviving ally kills the current target in this tick. Keep a second enemy alive.
  c={...c,units:[...c.units.map(u=>u.id===id?{...u,targetId:'enemy',cooldownTicks:0,cell:{col:0,row:4}}:u.id==='enemy'?{...u,hp:1}:u)]};
  const next=stepCombat(c).state;expect(next.units.find(u=>u.id===id)!.shield).toBe(200);
  for(const u of next.units)validateMechanisms(u,next.units,next.tick,'v18',false,next.nextActionSeq!);
  validateRuntime(next);
});

it('Pit Fighter heals the integer total over exactly 40 ticks, with no instant heal',()=>{
  let c=combat(tierArmy('pit-fighter',8));const id=c.units.find(u=>u.team==='player')!.id;
  c={...c,units:c.units.map(u=>({...u,hp:u.id===id?Math.floor(u.maxHp*.45):u.hp,cooldownTicks:1000,moveCooldownTicks:1000}))};
  // Enemy attacks exactly once to cross the post-damage survival barrier.
  c={...c,units:c.units.map(u=>u.id==='enemy'?{...u,cooldownTicks:0,cell:{col:0,row:3}}:u.id===id?{...u,cell:{col:0,row:4}}:u)};
  c=stepCombat(c).state;
  const holder=c.units.find(u=>u.id===id)!,hp=holder.hp,total=Math.floor(holder.maxHp*8000/10000);
  expect(holder.tasks!.filter(t=>t.kind==='g24Heal')).toHaveLength(40);
  expect(holder.tasks!.filter(t=>t.kind==='g24Heal').reduce((sum,t)=>sum+t.amount,0)).toBe(total);
  expect(holder.tasks!.filter(t=>t.kind==='g24Heal').map(t=>t.executeAtTick)).toEqual(Array.from({length:40},(_,i)=>c.tick+i+1));
  for(const u of c.units)validateMechanisms(u,c.units,c.tick,'v18',false,c.nextActionSeq!);
  validateRuntime(c);
  c={...c,units:c.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000}))};
  const events=[];
  for(let i=0;i<40;i++){const r=stepCombat(c);events.push(...r.events);c=r.state;if(i===0)expect(c.units.find(u=>u.id===id)!.hp-hp).toBe(Math.floor(total/40)+(total%40>0?1:0));}
  expect(events.filter(e=>e.type==='heal'&&e.outcome.targetId===id).length).toBeGreaterThan(0);
  expect(c.units.find(u=>u.id===id)!.tasks!.filter(t=>t.kind==='g24Heal')).toHaveLength(0);
});

it('Sorcerer 8 weakens spell-hit targets by 25% for 60 ticks without stacking casters',()=>{
  let c=combat(tierArmy('sorcerer',8));const id=c.units.find(u=>u.definitionId==='zyra')!.id;
  c={...c,units:c.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000,...(u.id===id?{mana:u.maxMana,cell:{col:0,row:4}}:{})}))};
  for(let i=0;i<12;i++)c=stepCombat(c).state;
  const target=c.units.find(u=>u.id==='enemy')!,debuff=target.mechanismState!.statuses.flatMap(g=>g.contributions).find(d=>d.source.definitionId==='sorcerer');
  expect(debuff?.application.magnitudeBps).toBe(2500);expect(debuff!.expiresAtTick!-debuff!.appliedAtTick).toBe(60);
  for(const u of c.units)validateMechanisms(u,c.units,c.tick,'v18',false,c.nextActionSeq!);
  validateRuntime(c);
  const attacking={...c,units:c.units.map(u=>({...u,cooldownTicks:u.id==='enemy'?0:1000,moveCooldownTicks:1000,...(u.id==='enemy'?{statuses:[],mechanismState:{...u.mechanismState!,statuses:u.mechanismState!.statuses.map(g=>({...g,contributions:g.contributions.filter(d=>d.source.definitionId==='sorcerer')})).filter(g=>g.contributions.length)}}:{})}))};
  const normal={...attacking,units:attacking.units.map(u=>u.id==='enemy'?{...u,mechanismState:{...u.mechanismState!,statuses:[]}}:u)};
  const raw=(state:CombatState)=>stepCombat(state).events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='enemy').map(e=>e.type==='packetDamage'?e.outcome.raw:0);
  const plain=raw(normal),weak=raw(attacking);expect(plain.length).toBeGreaterThan(0);expect(weak).toEqual(plain.map(n=>Math.floor(n*7500/10000)));
  // Multiple independently sourced Sorcerer weaknesses still apply one 25% multiplier.
  const twice={...attacking,units:attacking.units.map(u=>u.id==='enemy'?{...u,mechanismState:{...u.mechanismState!,statuses:u.mechanismState!.statuses.map(g=>({...g,contributions:[...g.contributions,...g.contributions.map(d=>({...d,key:d.key+'second'}))]}))}}:u)};
  expect(raw(twice)).toEqual(weak);
});

it('Visionary 8 heals a living ally from spell HP damage; basic attacks do not heal',()=>{
  let c=combat(tierArmy('visionary',8));const caster=c.units.find(u=>u.definitionId==='morgana')!,ally=c.units.find(u=>u.team==='player'&&u.id!==caster.id)!;
  c={...c,units:c.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000,...(u.id===ally.id?{hp:Math.floor(u.maxHp/3)}:{}),...(u.id===caster.id?{mana:u.maxMana,cell:{col:0,row:4}}:{})}))};
  const events=[];for(let i=0;i<25;i++){const r=stepCombat(c);events.push(...r.events);c=r.state;}
  const heals=events.filter(e=>e.type==='heal'&&e.outcome.contributions.some(c=>c.source.definitionId==='visionary')&&e.outcome.targetId===ally.id);
  expect(heals.length).toBeGreaterThan(0);
  const damage=events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId===caster.id&&['ability-direct','ability-periodic'].includes(e.outcome.context.delivery));
  expect(heals.map(e=>e.type==='heal'?e.outcome.requested:0)).toEqual(damage.filter(e=>e.type==='packetDamage'&&e.outcome.hpDamage>0).map(e=>e.type==='packetDamage'?Math.floor(e.outcome.hpDamage*2000/10000):0));
  const basic={...c,units:c.units.map(u=>({...u,tasks:[],cooldownTicks:u.id===caster.id?0:1000,moveCooldownTicks:1000,mana:0}))};
  expect(stepCombat(basic).events.some(e=>e.type==='heal'&&e.outcome.contributions.some(c=>c.source.definitionId==='visionary'))).toBe(false);
});

it('Sorcerer 8 weakens every enemy hit by one multi-target spell',()=>{
  let c=combat(tierArmy('sorcerer',8),true);
  c={...c,units:c.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000,
    ...(u.id==='nami'?{mana:u.maxMana,cell:{col:0,row:4}}:{}),...(u.id==='enemy2'?{cell:{col:1,row:3}}:{})}))};
  for(let i=0;i<8;i++)c=stepCombat(c).state;
  for(const id of ['enemy','enemy2']){
    const u=c.units.find(u=>u.id===id)!;
    expect(u.mechanismState!.statuses.flatMap(g=>g.contributions).some(d=>d.source.ownerId==='nami'&&d.source.definitionId==='sorcerer'&&d.application.magnitudeBps===2500)).toBe(true);
  }
});

it.each([true,false])('locked PvP settles the frozen emblem tier when live equipment changed (removed=%s)',removed=>{
  const enabled=enableMultiplayerSettlement(reachRound('2-1'),'v18-seat');expect(enabled.ok).toBe(true);
  const army=formation(['singed','renata','renni','lux']).preparation;
  const emblem={id:'item-1',definitionId:'TFT13_Item_CrimeEmblemItem',location:removed?{kind:'inventory' as const}:{kind:'unit' as const,unitId:'lux',slot:0}};
  const s={...enabled.state,preparation:army,items:[emblem],multiplayer:{...enabled.state.multiplayer!,combatRosterLocked:true as const}};
  const tier=removed?4:3;
  const receipt:RoundSettlementReceipt={version:ROUND_SETTLEMENT_VERSION,settlementId:'v18-frozen:A',battleId:'v18-frozen',seatId:'v18-seat',round:s.round,roundId:s.roundDefinitionId,
    settlementEligible:true,result:'loss',damage:2,baseDamage:2,opposingSurvivors:0,growth:[],combatTicks:80,combatEventCount:20,
    g23Facts:{battleId:'v18-frozen',round:s.round,roundKind:'pvp',result:'loss',conquerorTier:0,chemBaronTier:tier,conquestTakedowns:[],alliedDeaths:0,rumbleStar:0,highRollerGold:0}};
  const before=JSON.stringify(s),r=applyRoundSettlement(s,receipt);expect(r.ok).toBe(true);
  expect(readG23Progress(r.state)!.chem.shimmer-readG23Progress(s)!.chem.shimmer).toBe(removed?20:15);
  expect(r.state.items).toEqual(s.items);expect(JSON.stringify(s)).toBe(before);
  expect(applyRoundSettlement(r.state,receipt)).toEqual({ok:false,state:r.state,reason:'duplicate-settlement'});
  const unlocked={...s,multiplayer:{...s.multiplayer,combatRosterLocked:undefined}};
  expect(applyRoundSettlement(unlocked,receipt)).toEqual({ok:false,state:unlocked,reason:'invalid-receipt'});
  const invalid={...receipt,g23Facts:{...receipt.g23Facts!,chemBaronTier:8}};
  expect(applyRoundSettlement(s,invalid)).toEqual({ok:false,state:s,reason:'invalid-receipt'});
});
