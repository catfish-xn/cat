import {epicCrownsAtResourcePrefix} from '../src/simulation/g2-3-state';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { battle,fillBench } from './fixtures/t13-loot-public';
import {describe,it,expect} from 'vitest';
import {variant,copper,silver,LIVE,stream,COMPONENTS,COMPLETED} from './fixtures/epic-loot-oracle.cjs';
import {lootPlan} from './fixtures/orb-combo-oracle.cjs';
import {freezeLootThroughRound,LOOT_REPLAY_DIGEST} from '../src/simulation/loot-freeze';
import {EPIC_LOOT} from '../src/simulation/content/loot';
import {createMatch,useConsumable,equipItem,getDeploymentCap,selectChoice,stepMatch} from '../src/simulation/match';
import {planConsumable,replayConsumableItems,reforgeCandidates} from '../src/simulation/consumables';
import {prepareMatchLoot,revealMatchLoot,grantDirectLoot} from '../src/simulation/loot-runtime';
import {planOrbClaim} from '../src/simulation/orb-claim';
import {readLootView} from '../src/simulation/loot-view';
import {createCombat} from '../src/simulation/combat';
import {createRoundEnemies} from '../src/simulation/round-enemies';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {CONSUMABLE_DEFINITIONS,REFORGE_POOLS} from '../src/simulation/content/consumables';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
import {appendMechanicReceipt,grantMechanicItem,grantMechanicUnit} from '../src/simulation/seat-mechanics';
import {G24_FORGE_POOLS} from '../src/simulation/content/g2-4-forges';
import {epicForgeOffers,openEpicForge,EPIC_REWARD_NAMES,validateEpicForges,settleTerminalEpicForges} from '../src/simulation/epic-forges';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {G23_BLACK_MARKETS,G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import type {MatchState} from '../src/simulation/match-types';
import type {ConsumableDefinitionId} from '../src/simulation/consumable-types';
import {accepted} from './fixtures/r3r4-public';
import {room,syntheticSharedRound,accept,fullBench,conserved} from './tp-helpers';
import {runSharedMatchCommand,restoreSharedOrbSnapshot} from '../src/simulation/shared-pool';
function tool(state:MatchState,definitionId:ConsumableDefinitionId):MatchState{
 const id=`consumable-${state.nextConsumableSerial}`;
 return appendMechanicReceipt({...state,nextConsumableSerial:state.nextConsumableSerial+1,consumables:[...state.consumables,{consumableId:id,definitionId}]},{kind:'consumable',source:'test',receiptId:`test:${id}`,round:state.round,roundId:state.roundDefinitionId,definitionId,consumableId:id});
}
function late(seed=42,roundId='5-7',base=createMatch(seed)){
 const round=getCatalogRoundById(roundId),loot=prepareMatchLoot(seed,round.ordinal),enemies=createRoundEnemies(round.ordinal);
 const state:MatchState={...base,phase:'preparation',combat:null,round:round.ordinal,roundDefinitionId:roundId,m8:{...base.m8,round,loot},preparation:{...base.preparation,units:[...base.preparation.units.filter(u=>u.team==='player'),...enemies]}};
 const raw=createCombat(state.preparation),source=loot.frozen.rounds.at(-1)!.orbs[0].sourceUnitId;
 const dead={...raw,combatId:`round-${state.round}`,status:'finished' as const,result:'playerWin' as const,tick:2,nextEventSeq:10,units:raw.units.map(u=>u.id===source?{...u,alive:false,hp:0}:u),neutralReceipts:{deaths:[{unitId:source,tick:1,eventSeq:1}],controls:[]}};
 return {state,dead,source};
}
describe('v17 epic rewards and unified consumables',()=>{
 const variants=new Set<string>(),coppers=new Set<string>(),silvers=new Set<string>();let repeats=false;
 it('pins every integer variant/box boundary, totals and the excluded zero-weight row',()=>{
  const pick=(rows:readonly {id:string;weight:number}[],index:number)=>{for(const r of rows){if(index<r.weight)return r.id;index-=r.weight;}throw Error('bad');};
  expect(EPIC_LOOT.variants.map(r=>r.weight)).toEqual([899,100,1]);
  for(let n=0;n<1000;n++)expect(pick(EPIC_LOOT.variants,n)).toBe(variant(n));
  for(let n=0;n<100;n++){expect(pick(EPIC_LOOT.copper,n)).toBe(copper(n));expect(pick(EPIC_LOOT.silver,n)).toBe(silver(n));}
  for(const table of [EPIC_LOOT.copper,EPIC_LOOT.silver])expect(table.reduce((n,r)=>n+r.weight,0)).toBe(100);
  expect(EPIC_LOOT.silver.map(r=>r.id)).toEqual(['four-cost-gold','three-cost-pair','reforger','duplicator']);
 });
 it.each([0,512,1024,1536,2048,2560,3072,3584])('independent complete payload/identity/RNG oracle, 512 seeds starting %i',start=>{
  for(let seed=start;seed<start+512;seed++){
   const expected=lootPlan(seed),actual=freezeLootThroughRound(seed,38);
   expect(actual.rng).toEqual(expected.rng);expect(actual.rounds).toEqual(expected.rounds);
   for(const row of expected.rolls){variants.add(row.variant);if(row.copper)coppers.add(row.copper);row.silver.forEach(id=>silvers.add(id));}
   for(const r of actual.rounds.slice(6))for(const o of r.orbs){
    const heroes=o.entries.filter(e=>e.payload.kind==='unit');
    if(heroes.length===2&&heroes[0].payload.kind==='unit'&&heroes[1].payload.kind==='unit'&&heroes[0].payload.definitionId===heroes[1].payload.definitionId)repeats=true;
    for(const e of heroes)if(e.payload.kind==='unit')expect(LIVE[ITEM_DEFINITIONS[e.payload.definitionId]?0:o.templateId==='epic-copper'?(o.entries.length===1?3:2):o.entries.length===2?4:3]).toContain(e.payload.definitionId);
   }
  }
 });
 it('all 4096 seeds cover every positive row, including duplicate box heroes',()=>{
  expect([...variants].sort()).toEqual(['artifact','crown','standard']);expect(coppers.size).toBe(5);expect(silvers.size).toBe(4);expect(repeats).toBe(true);
 });
 it('does not reveal or award an un-killed carrier, and each killed reward group has one colored orb',()=>{
  const {state,dead,source}=late(),alive={...dead,units:dead.units.map(u=>u.id===source?{...u,alive:true,hp:1}:u),neutralReceipts:{deaths:[],controls:[]}};
  const miss=revealMatchLoot(state,alive).state;
  expect(grantDirectLoot({...miss,phase:'settlement',combat:alive},false).state.m8.loot.receipts).toEqual([]);
  expect(miss.m8.loot.direct.filter(d=>d.status==='forfeited')).toHaveLength(state.m8.loot.frozen.rounds.at(-1)!.encounterPlan.drops.length);
  const earned=revealMatchLoot(state,dead).state,paid=grantDirectLoot({...earned,phase:'settlement',combat:dead},false).state;
  expect(paid.m8.loot.receipts.length).toBe(state.m8.loot.frozen.rounds.at(-1)!.encounterPlan.drops.length);
  expect(grantDirectLoot(paid,false).events).toEqual([]);
  for(const o of paid.m8.loot.frozen.rounds.at(-1)!.orbs)if(o.templateId==='epic-copper'||o.templateId==='epic-silver')expect(o.tier).toBe(o.templateId==='epic-copper'?'gray':'blue');
 });
 it('uses existing four-choice forge pools with unique choice receipts, deterministic timeout and terminal fallback',()=>{
  const seed=Array.from({length:100},(_,s)=>s).find(s=>lootPlan(s).rolls[0].variant==='artifact')!;
  const {state,dead}=late(seed),earned=revealMatchLoot(state,dead).state;
  let paid:MatchState={...grantDirectLoot({...earned,phase:'settlement',combat:dead},false).state,phase:'settlement',combat:dead};
  const original=paid.m8.loot.receipts.filter(r=>r.payload.kind==='forge');expect(original).toHaveLength(2);
  for(const r of original){
   if(r.payload.kind!=='forge')throw Error('forge');const offers=epicForgeOffers(paid.seed,r.receiptId,r.payload.definitionId);
   expect(new Set(offers).size).toBe(4);offers.forEach(id=>expect(G24_FORGE_POOLS[r.payload.kind==='forge'?r.payload.definitionId:'TFT_ArmoryKeyCompleted']).toContain(id));
   const open=openEpicForge(paid).state,c=open.pendingChoice!;expect(c.kind).toBe('forge');expect(c.offers).toEqual(offers);
   paid=accepted(selectChoice(open,c.choiceId,c.generation,c.offers[0])) as typeof paid;
   expect(paid.seatMechanics!.receipts.filter(x=>x.receiptId===c.choiceId)).toHaveLength(1);
  }
  expect(()=>validateEpicForges(paid)).not.toThrow();expect(openEpicForge(paid).state).toBe(paid);
  const terminal=settleTerminalEpicForges({...grantDirectLoot({...earned,phase:'settlement',combat:dead},true).state,phase:'gameOver',combat:dead,outcome:'victory'});
  expect(terminal.events.filter(e=>e.type==='mechanicGranted')).toHaveLength(2);expect(settleTerminalEpicForges(terminal.state).events).toEqual([]);
 });
 it('crown receipt adds exactly one permanent deployment slot, before and after removal/reforge',()=>{
  const seed=28687;expect(lootPlan(seed).rolls[0].variant).toBe('crown');
  const {state,dead}=late(seed),earned=revealMatchLoot(state,dead).state,paid=grantDirectLoot({...earned,phase:'settlement',combat:dead},false).state;
  expect(getDeploymentCap(paid)).toBe(getDeploymentCap(state)+1);
  expect(epicCrownsAtResourcePrefix(paid,state.resourceProvenance.entries.length)).toEqual([]);expect(epicCrownsAtResourcePrefix(paid,paid.resourceProvenance.entries.length)).toHaveLength(1);
  expect(getDeploymentCap(grantDirectLoot(paid,false).state)).toBe(getDeploymentCap(paid));
  expect(reforgeCandidates('TFT_Item_ForceOfNature')).toEqual([]);
 });
 it('online epic heroes stay in their box until explicit shared-pool claim; shortages pay cost and capacity pays sell price',()=>{
  for(const full of [false,true]){
   const initial=full?fullBench():(()=>{const r=room(undefined,1);return {pool:r.pool,state:r.states[0]};})();
   const r=syntheticSharedRound(initial.pool,[initial.state],31),round=getCatalogRoundById('5-7');
   const setup=late(initial.state.seed,'5-7',{...r.states[0],m8:{...r.states[0].m8,round}});
   // Use the room's authenticated layout and seed, keeping its pool snapshot binding.
   let state:MatchState={...setup.state,m8:{...setup.state.m8,loot:r.states[0].m8.loot}};
   state={...revealMatchLoot(state,setup.dead).state,phase:'settlement',combat:setup.dead};
   const before=state.gold;expect(grantDirectLoot(state,false).state).toBe(state);
   const box=readLootView(state).unclaimedOrbs!.find(o=>o.entries.some(e=>e.kind==='unit'))!;expect(box).toBeDefined();
   const heroes=box.entries.filter(e=>e.kind==='unit');let pool=r.pool;
   if(!full){const ids=heroes.map(h=>h.kind==='unit'?h.definitionId:'');const initial={...pool.initial},available={...pool.available};for(const id of ids){initial[id]-=available[id];available[id]=0;}pool={...pool,initial,available};}
   const claimed=accept(runSharedMatchCommand(pool,state,{type:'claimOrb',orbId:box.orbId,round:31}));
   const rows=claimed.state.m8.loot.receipts.filter(x=>x.payload.kind==='unit');expect(rows).toHaveLength(heroes.length);
   rows.forEach(x=>expect(x.resolution).toBe(full?'capacity-sold':'gold'));
   expect(claimed.state.gold-before).toBe(box.entries.reduce((n,e)=>n+(e.kind==='gold'?e.quantity:e.kind==='unit'?Number(Object.entries(LIVE).find(([,ids])=>ids.includes(e.definitionId))![0]):0),0));
   conserved(claimed.pool,[claimed.state]);
   expect(planOrbClaim(claimed.state,box.orbId,31)).toMatchObject({ok:false,reason:'already-claimed'});
  }
 });
 it('2 components and 1 completed all become different same-category inventory items; replay and RNG are exact',()=>{
  let state=tool(createMatch(42),'reforger');const holder=state.preparation.units.find(u=>u.team==='player')!;
  for(const [n,id] of ['sword','rod','warmog'].entries()){
   state=accepted(grantMechanicItem(state,{receiptId:`fixture:${n}`,source:'test',definitionId:id}));
  }
  // Isolated imported-equipment vector: normal equip commands auto-combine two components.
  state={...state,items:state.items.map((i,n)=>({...i,location:{kind:'unit',unitId:holder.id,slot:n}}))};
  const before=state,plan=planConsumable(state,state.consumables[0].consumableId,{kind:'unit',unitId:holder.id});if(!plan.ok)throw Error(plan.reason);const used=plan.state,fact={record:plan.record};
  const oracle=stream((42^0x52454647)>>>0);
  const expected=['sword','rod','warmog'].map((id,n)=>{const pool=(n===2?COMPLETED:COMPONENTS).filter(x=>x!==id);return pool[oracle.draw(pool.length)];});
  expect(fact.record.outputs.map(x=>x.definitionId)).toEqual(expected);expect(used.reforgeState).toEqual(oracle.value());
  expect(fact.record.outputs).toHaveLength(3);expect(used.reforgeState.draws-before.reforgeState.draws).toBe(3);
  for(const [n,output] of fact.record.outputs.entries()){expect(output.definitionId).not.toBe(fact.record.affectedItems[n].definitionId);expect(ITEM_DEFINITIONS[output.definitionId].kind).toBe(n===2?'completed':'component');}
  expect(used.items.every(i=>i.location.kind==='inventory')).toBe(true);
  expect(replayConsumableItems(before.items,before.nextItemSerial,fact.record,before.preparation).items).toEqual(used.items);
  expect(used.nextItemSerial-before.nextItemSerial).toBe(3);
 });
 it('no equipment rejects with identical state and no RNG; temporary child objects never enter the permanent operation',()=>{
  const empty=tool(createMatch(42),'reforger'),id=empty.consumables[0].consumableId,target={kind:'unit' as const,unitId:'unit-1'};
  expect(useConsumable(empty,id,target)).toEqual({ok:false,state:empty,reason:'invalid-consumable-target'});
  const child={temporaryId:'test-temporary',parentItemInstanceId:'absent'};
  const temporary={...empty,temporaryEquipment:[child] as unknown as MatchState['temporaryEquipment']};
  expect(useConsumable(temporary,id,target)).toEqual({ok:false,state:temporary,reason:'invalid-consumable-target'});expect(temporary.temporaryEquipment[0]).toBe(child);
 });
 it.each(['radiant','artifact','support'] as const)('%s uses its own pool and never the ordinary completed pool',kind=>{
  let state=tool(createMatch(42),'reforger');const definitionId=REFORGE_POOLS[kind][0].definitionId;
  state=accepted(grantMechanicItem(state,{receiptId:'fixture:special',source:'test',definitionId}));state=accepted(equipItem(state,state.items.at(-1)!.id,'unit-1',0));
  const result=accepted(useConsumable(state,state.consumables[0].consumableId,{kind:'unit',unitId:'unit-1'}));
  expect(REFORGE_POOLS[kind].map(x=>x.definitionId)).toContain(result.items.at(-1)!.definitionId);expect(result.items.at(-1)!.definitionId).not.toBe(definitionId);
  expect(restoreMatch(serializeMatch(result))).toEqual(result);
 });
 it('v17 box payloads have no appended duplicators; all black-market sources use the unified reforger id',()=>{
  const conquest=G23_CONQUEROR_CHESTS.flatMap(c=>g23RewardAtoms({id:`test-conquest-${c.tier}`,source:'conqueror',tier:c.tier,round:1,reward:g23ConquerorReward(c)},42));
  const atoms=[...conquest,...G23_BLACK_MARKETS.flatMap(m=>m.options.flatMap(o=>g23RewardAtoms({id:`test-${m.tier}-${o.id}`,source:'black-market',tier:m.tier,round:1,reward:o.reward},42)))];
  expect(atoms.some(a=>a.kind==='tool'&&a.options[0]==='reforger')).toBe(true);expect(atoms.some(a=>a.options.includes('completed-reforger'))).toBe(false);
 });
 it.each(['zoe','caitlyn'])('full duplicator copies %s as 1-star; lesser refuses high cost; both refuse full capacity without consumption',hero=>{
  let state=accepted(grantMechanicItem(createMatch(42),{receiptId:'fixture:item',source:'test',definitionId:'warmog'}));
  // Unit-target vector uses the real acquisition planner through the generic mechanic grant.
  state=accepted(grantMechanicUnit(state,{receiptId:'fixture:hero',source:'test',definitionId:hero}));const holder=state.preparation.units.find(u=>u.id==='unit-2')!;
  const lesser=tool(state,'TFT_Consumable_ChampionDuplicator_III'),lesserId=lesser.consumables.at(-1)!.consumableId,target={kind:'unit' as const,unitId:holder.id};
  expect(useConsumable(lesser,lesserId,target)).toEqual({ok:false,state:lesser,reason:'invalid-consumable-target'});
  const full=tool(state,'TFT_Consumable_NeekosHelp'),id=full.consumables.at(-1)!.consumableId,result=accepted(useConsumable(full,id,target));
  expect(result.preparation.units.find(u=>u.id==='unit-3')).toMatchObject({definitionId:hero,starLevel:1});expect(result.reforgeState).toBe(full.reforgeState);expect(restoreMatch(serializeMatch(result))).toEqual(result);
  const bench=['akali','camille','leona','nocturne','rell','renata','sett','tristana','urgot'].map((definitionId,n)=>({id:`full-${n}`,definitionId,team:'player' as const,starLevel:1 as const,location:{kind:'bench' as const,slot:n}}));
  for(const definitionId of ['TFT_Consumable_NeekosHelp','TFT_Consumable_ChampionDuplicator_III'] as const){const s=tool({...state,preparation:{...state.preparation,units:[{...holder,definitionId:'lux',location:{kind:'board',cell:{col:1,row:4}}},...bench]}},definitionId),tid=s.consumables.at(-1)!.consumableId;expect(useConsumable(s,tid,target)).toEqual({ok:false,state:s,reason:'bench-full'});}
 });
 it('a no-pool crown returns unchanged to inventory and consumes no RNG, while a full bench refuses even a possible triple',()=>{
  let state=tool(createMatch(42),'reforger');state=accepted(grantMechanicItem(state,{receiptId:'fixture:crown',source:'test',definitionId:'TFT_Item_ForceOfNature'}));
  const item=state.items.at(-1)!;state=accepted(equipItem(state,item.id,'unit-1',0));
  const used=accepted(useConsumable(state,state.consumables[0].consumableId,{kind:'unit',unitId:'unit-1'}));
  expect(used.items).toContainEqual({...item,location:{kind:'inventory'}});expect(used.reforgeState).toBe(state.reforgeState);expect(used.nextItemSerial).toBe(state.nextItemSerial);expect(restoreMatch(serializeMatch(used))).toEqual(used);
  const full=tool({...state,preparation:{...state.preparation,units:[{...state.preparation.units[0],definitionId:'lux'},...Array.from({length:9},(_,i)=>({id:'bench-'+i,definitionId:i<2?'lux':'akali',team:'player' as const,starLevel:1 as const,location:{kind:'bench' as const,slot:i}}))]}},'TFT_Consumable_NeekosHelp');
  expect(useConsumable(full,full.consumables.at(-1)!.consumableId,{kind:'unit',unitId:'unit-1'})).toEqual({ok:false,state:full,reason:'bench-full'});
 });
 it('a real 5-7 command path restores new forge receipts and never repeats the rewards',()=>{
  const raw=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v20-xp68-recorded-states/cannon.json.gz',import.meta.url))).toString()).states;
  const initial=restoreMatch(raw.find((s:MatchState)=>s.roundDefinitionId==='5-7'&&s.phase==='preparation'));
  let state:MatchState=battle(initial).ended;
  while(state.phase==='choice'){const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));}
  expect(state.phase).toBe('settlement');expect(restoreMatch(serializeMatch(state))).toEqual(state);
  expect(stepMatch(state)).toEqual({state,events:[]});expect(new Set(state.m8.loot.receipts.map(r=>r.receiptId)).size).toBe(state.m8.loot.receipts.length);
 });
 it('authenticates neutral opening HP after earned radiant health auras and rejects altered frozen HP',()=>{
  const raw=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v20-xp68-recorded-states/cannon.json.gz',import.meta.url))).toString()).states;
  let state=restoreMatch(raw.find((s:MatchState)=>s.roundDefinitionId==='6-7'&&s.phase==='preparation'));
  const target=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board'&&!state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===u.id))!;
  state=accepted(grantMechanicItem(state,{receiptId:'test:radiant-opening',source:'test',definitionId:'TFT5_Item_SunfireCapeRadiant'}));
  state=accepted(equipItem(state,state.items.find(i=>i.definitionId==='TFT5_Item_SunfireCapeRadiant')!.id,target.id,0));
  state=battle(state).ended;
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  const corrupt=structuredClone(state);Object.assign(corrupt.combat!.openingState!.initialUnits[0],{hp:corrupt.combat!.openingState!.initialUnits[0].hp+1});
  expect(()=>restoreMatch(corrupt)).toThrow('neutral opening plan/consumption');
 });
 it('the real 6-7 terminal keeps full-bench heroes retained-terminal while completing forge fallback once',()=>{
  const raw=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v20-xp68-recorded-states/cannon.json.gz',import.meta.url))).toString()).states;
  const initial=restoreMatch(raw.find((s:MatchState)=>s.roundDefinitionId==='6-7'&&s.phase==='preparation'));
  const heroes=initial.m8.loot.frozen.rounds.at(-1)!.encounterPlan.drops.flatMap(d=>d.payload.kind==='unit'?[d.payload.definitionId]:[]);expect(heroes.length).toBeGreaterThan(0);
  const state=battle(fillBench(initial,heroes)).ended;expect(state.phase).toBe('gameOver');
  const retained=state.m8.loot.direct.filter(d=>d.status==='retained-terminal');expect(retained).toHaveLength(heroes.length);
  expect(restoreMatch(serializeMatch(state))).toEqual(state);expect(stepMatch(state)).toEqual({state,events:[]});expect(settleTerminalEpicForges(state).events).toEqual([]);
 });
 it('online full duplicator enqueues one shared-pool hero and its new use receipt survives snapshot restore',()=>{
  let {pool,states}=room(undefined,1),state=states[0];
  const first=grantMechanicUnit(state,{receiptId:'fixture:zoe',source:'test',definitionId:'zoe'});if(!first.ok||first.receipt.kind!=='unit'||!first.receipt.orbId)throw Error('gift');
  const received=accept(runSharedMatchCommand(pool,first.state,{type:'claimOrb',round:state.round,orbId:first.receipt.orbId}));pool=received.pool;state=tool(received.state,'TFT_Consumable_NeekosHelp');
  const holder=state.preparation.units.find(u=>u.definitionId==='zoe')!,available=pool.available.zoe;
  const copied=accept(runSharedMatchCommand(pool,state,{type:'useConsumable',consumableId:state.consumables.at(-1)!.consumableId,target:{kind:'unit',unitId:holder.id}}));
  expect(copied.pool.available.zoe).toBe(available);expect(copied.state.nextUnitSerial).toBe(state.nextUnitSerial);
  const orb=readLootView(copied.state).unclaimedOrbs![0],paid=accept(runSharedMatchCommand(copied.pool,copied.state,{type:'claimOrb',round:state.round,orbId:orb.orbId}));
  expect(paid.pool.available.zoe).toBe(available-1);expect(paid.state.nextUnitSerial).toBe(state.nextUnitSerial+1);
  expect(restoreSharedOrbSnapshot(paid.pool,JSON.stringify(paid.state))).toEqual(paid.state);conserved(paid.pool,[paid.state]);
 });
 it('uses exact approved zh_cn names and rejects v15 state identities without migration',()=>{
  expect(Object.fromEntries(Object.values(CONSUMABLE_DEFINITIONS).map(d=>[d.apiName,d.name]))).toEqual({TFT_Consumable_ItemRemover:'装备拆卸器',TFT_Consumable_ItemReroller:'装备重铸器',TFT_Consumable_ChampionDuplicator_III:'次级英雄复制器',TFT_Consumable_NeekosHelp:'英雄复制器'});
  expect(EPIC_REWARD_NAMES).toEqual({TFT_ArmoryKeyCompleted:'成装锻造器',TFT_ArmoryKeyComponent:'基础装备锻造器',TFT_ArmoryKeySupport:'辅助装锻造器',TFT_ArmoryKeyOrnn:'神器装备锻造器',TFT_Item_ForceOfNature:'金铲铲冠冕'});expect(ITEM_DEFINITIONS.TFT_Item_ForceOfNature.name).toBe('金铲铲冠冕');
  const state=createMatch(42);expect(state.rulesVersion).toBe('s13-g2-3-v20-xp68');expect(restoreMatch(serializeMatch(state))).toEqual(state);expect(LOOT_REPLAY_DIGEST).not.toBe('fnv1a32-utf16:61568ec0');
  for(const field of ['rulesVersion','contentVersion'] as const){
    const previous=state[field].replace('v20-xp68','v19');
    expect(previous).not.toBe(state[field]);
    expect(()=>restoreMatch({...state,[field]:previous})).toThrow();
  }
 });
});
