import * as api from '../../src/simulation/match';
import { accepted, configuredPrefix } from './t13-loot-public';

// v25: bounded public-route search requires no opening, a two-star holder and a
// defeat killing only r00 (Loris) or r01 (Zyra), with the original reward shapes.
export const PARTIAL_REVEAL_SEEDS = {loris:29,zyra:29} as const;

// Shared by tests/m8-b8-live-reveal.test.ts and scripts/record-g2-4b-live-reveal.cjs so both use one route.
// A command-only route recreates the original eight two-star holders and four-item
// loadout. Supply choices fund the recipes; every sale, reroll, removal and deployment
// is a public Match command, preserving the exact tick/eventSeq assertions below.
// v25: first no-opening seed from 2000 whose independent 4-7 plan has nine
// entries (r03 one hero, r04 three entries including a hero, r05 unloaded), whose
// public route fields all eight two-star holders/four recipes, and whose lawful
// Lux/Nami swap kills r03/r04 together after three earlier deaths, then r05 last.
export const SIMULTANEOUS_REVEAL_SEED=2634;
export async function simultaneousPrefix(seed=SIMULTANEOUS_REVEAL_SEED):Promise<api.MatchState>{
 const equipmentTargets={'sunfire-cape':{definitionId:'irelia'},'ionic-spark':{definitionId:'loris'},gunblade:{definitionId:'zoe'},shojin:{definitionId:'zoe'}};
 const board=[
  {definitionId:'irelia',col:1,row:4},{definitionId:'lux',col:5,row:7},
  {definitionId:'rell',col:3,row:4},{definitionId:'nami',col:0,row:7},
  {definitionId:'zoe',col:3,row:7},{definitionId:'loris',col:5,row:4},
  {definitionId:'leona',col:0,row:5},{definitionId:'zyra',col:1,row:7},
 ];
 let state=await configuredPrefix('4-7',{build:'mage',seed,goldReserves:{'4-7':0},goldReserveByRound:{'4-3':100,'4-5':100,'4-7':100},
  augmentPriorities:['bronze-for-life-ii','pumping-up-iii','item-collector-ii'],anomalyDefinitionId:'protective-shielding',anomalyTargetDefinitionId:'zoe',
  equipItems:false,equipmentTargets,reservedComponents:['sword','vest','belt','rod','cloak','bow','gloves','tear'],supplyChoices:['cloak','sword','sword']});
 while(state.level<8){const r=api.buyXp(state);if(!r.ok)break;state=r.state;}
 const wanted=new Set(board.map(u=>u.definitionId));
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&!wanted.has(u.definitionId)))state=accepted(api.sellUnit(state,unit.id));
 const complete=()=>board.every(w=>state.preparation.units.some(u=>u.team==='player'&&u.definitionId===w.definitionId&&u.starLevel===2));
 for(let rolls=0;rolls<100&&!complete();rolls++){
  for(let slot=0;slot<5;slot++){
   const offer=state.shop.slots[slot];
   if(offer.status==='available'&&wanted.has(offer.definitionId)&&!state.preparation.units.some(u=>u.team==='player'&&u.definitionId===offer.definitionId&&u.starLevel===2)){
    const result=api.buyUnit(state,slot,state.shop.generation);if(result.ok)state=result.state;
   }
  }
  if(complete())break;
  const result=api.rerollShop(state);if(!result.ok)break;state=result.state;
 }
 if(state.level<8||!complete())throw Error('Public simultaneous roster '+JSON.stringify({gold:state.gold,level:state.level,missing:board.filter(w=>!state.preparation.units.some(u=>u.team==='player'&&u.definitionId===w.definitionId&&u.starLevel===2)).map(w=>w.definitionId),anomaly:state.anomalyBinding,units:state.preparation.units.filter(u=>u.team==='player').map(u=>[u.definitionId,u.starLevel])}));
 const kept=board.map(w=>state.preparation.units.find(u=>u.team==='player'&&u.definitionId===w.definitionId&&u.starLevel===2)!);
 const keep=new Set(kept.map(u=>u.id));
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&!keep.has(u.id)))state=accepted(api.sellUnit(state,unit.id));
 for(const unit of kept)if(state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===unit.id)){
  const tool=state.consumables.find(c=>c.definitionId==='magnetic-remover')!;
  state=accepted(api.useConsumable(state,tool.consumableId,{kind:'unit',unitId:unit.id}));
 }
 for(const [slot,unit]of kept.entries())state=accepted(api.deployMatchUnit(state,unit.id,{kind:'bench',slot}));
 for(const w of board)state=accepted(api.deployMatchUnit(state,kept.find(u=>u.definitionId===w.definitionId)!.id,{kind:'board',cell:{col:w.col,row:w.row}}));
 for(const [definitionId,target]of Object.entries(equipmentTargets)){const item=state.items.find(i=>i.definitionId===definitionId);if(!item)throw Error('Missing actual recipe '+definitionId);state=accepted(api.equipItem(state,item.id,kept.find(u=>u.definitionId===target.definitionId)!.id,definitionId==='shojin'?1:0));}
 return state;
}
// Recreate each bare two-star holder by public sales, purchases and an earned remover.
export async function barePartialPrefix(name:'zyra'|'loris',seed:number,augmentPriorities:string[]):Promise<api.MatchState>{
 let state=await configuredPrefix('4-7',{build:'mage',seed,equipItems:false,goldReserves:{'4-7':0},augmentPriorities,augmentRerollPriorities:seed===2125?{'2-1':['bulky-buddies-i'],...(name==='loris'?{'3-2':['crownguard-spirit'],'4-2':['academy-crest']}:{})}:{},anomalyDefinitionId:'protective-shielding'});
 let target=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===name)!;
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.id!==target.id))state=accepted(api.sellUnit(state,unit.id));
 for(let rolls=0;rolls<100&&target.starLevel!==2;rolls++){
  const slot=state.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId===name);
  state=accepted(slot<0?api.rerollShop(state):api.buyUnit(state,slot,state.shop.generation));
  target=state.preparation.units.find(u=>u.id===target.id)!;
 }
 if(state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===target.id)){
  const tool=state.consumables.find(c=>c.definitionId==='magnetic-remover')!;
  state=accepted(api.useConsumable(state,tool.consumableId,{kind:'unit',unitId:target.id}));
 }
 return accepted(api.deployMatchUnit(state,target.id,{kind:'board',cell:{col:name==='zyra'?0:6,row:4}}));
}
