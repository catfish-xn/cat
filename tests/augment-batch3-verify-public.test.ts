import { openingEncounter } from './fixtures/m5/oracle.g2.cjs';
import { expect, it, vi } from 'vitest';
// Public seed discovery and replay-authenticated restores are CPU-bound on shared runners.
vi.setConfig({testTimeout:300000});
import { createMatch, selectChoice, rerollShop, nextRound, startMatchCombat, stepMatch, deployMatchUnit, sellUnit, buyUnit, buyXp, type MatchState } from '../src/simulation/match';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { reachRound, accepted, resolveM5Choices, emptyBoard } from './match-helpers';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';

// Source for each expectation: augments-research-2026-10-23/data/augments-14.24.json,
// identified by apiName in augment-batch3-verify-source.test.ts. No grant/planning internals used.
// Public seed search only finds an offered card: never inject owned augments, resources or receipts.
const offerSeeds=new Map<string,number>();
const selected=new Map<string,{before:MatchState;state:MatchState}>();
let nextSeed=0;
// Batch 3 stage tags (14.24 ItemTags, after this review): cards never offered at 2-1 are picked at their first allowed node.
const firstNode=(id:string)=>(['2-1','3-2','4-2'] as const).find(n=>!((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string,readonly string[]>>)[AUGMENT_POOL_API_NAMES[id]]??[]).includes(n))!;
// Hero cards at 3-2/4-2 are trait-tailored (record 89: Savage Revenge needs a fielded Bruiser).
const TAILORED:Readonly<Record<string,string>>={'savage-revenge':'bruiser'};
/** Public route to a later node with real HP: win stage 1 with the opener, then bench everything and concede, except
 * that a tailored card's trait is bought from the shop and kept fielded so the offer snapshot sees it. */
function reachNode(node:'3-2'|'4-2',seed:number,trait?:string):MatchState {
 let state=createMatch(seed);
 while(state.roundDefinitionId!==node){
  state=resolveM5Choices(state);
  if(state.phase==='preparation'){
   if(state.roundDefinitionId.startsWith('1-')){
    const hero=state.preparation.units.find(u=>u.team==='player')!;
    state=accepted(deployMatchUnit(state,hero.id,{kind:'board',cell:{col:3,row:4}}));
   }else{
    const fits=(definitionId:string)=>!!trait&&(UNIT_DEFINITIONS[definitionId].traits as readonly string[]).includes(trait);
    if(trait&&!state.preparation.units.some(u=>u.team==='player'&&fits(u.definitionId))){
     const slot=state.shop.slots.findIndex(x=>x.status==='available'&&fits(x.definitionId)&&UNIT_DEFINITIONS[x.definitionId].cost<=state.gold);
     if(slot>=0){const r=buyUnit(state,slot,state.shop.generation);if(r.ok)state=r.state;}
    }
    for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&!fits(u.definitionId))){
     const used=new Set(state.preparation.units.flatMap(u=>u.location.kind==='bench'?[u.location.slot]:[]));
     const free=Array.from({length:state.preparation.benchSize},(_,i)=>i).find(i=>!used.has(i));
     state=accepted(free===undefined?sellUnit(state,unit.id):deployMatchUnit(state,unit.id,{kind:'bench',slot:free}));
    }
    const fielded=state.preparation.units.find(u=>u.team==='player'&&fits(u.definitionId));
    if(fielded&&fielded.location.kind==='bench'){const r=deployMatchUnit(state,fielded.id,{kind:'board',cell:{col:3,row:4}});if(r.ok)state=r.state;}
   }
   state=accepted(startMatchCombat(state));
  }
  while(state.phase==='combat')state=stepMatch(state).state;
  state=resolveM5Choices(state);
  if(state.phase!=='settlement')throw new Error('Cannot reach '+node);
  state=accepted(nextRound(state,state.round));
 }
 return state;
}
function pickLater(id:string,node:'3-2'|'4-2') {
 for(let seed=0;seed<600;seed++){
  let before:MatchState;try{before=reachNode(node,seed,TAILORED[id]);}catch{continue;}
  const c=before.pendingChoice;if(c?.kind!=='augment'||!c.offers.includes(id))continue;
  const result={before,state:accepted(selectChoice(before,c.choiceId,c.generation,id))};
  selected.set(id,result);return result;
 }
 throw new Error('No public '+node+' offer: '+id);
}
function pick(id:string) {
 const cached=selected.get(id);if(cached)return cached;
 const node=firstNode(id);if(node!=='2-1')return pickLater(id,node);
 while(!offerSeeds.has(id)&&nextSeed<20000){
  const seed=nextSeed++;
  // v23 fmix32 openings: Trainer Golem seeds are skipped (the unbenchable golem blocks reachRound's empty board).
  if(openingEncounter(seed)==='trainer-golems')continue;
  const root=createMatch(seed);
  const offers=generateChoices(augmentCandidates(resolveAugmentTier(root,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),root.choiceRngState).offers;
  for(const offered of offers)if(!offerSeeds.has(offered))offerSeeds.set(offered,seed);
 }
 const seed=offerSeeds.get(id);if(seed===undefined)throw new Error('No public offer within 20000 seeds: '+id);
 const before=reachRound('2-1',false,seed),c=before.pendingChoice!;
 expect(c.offers).toContain(id);
 const result={before,state:accepted(selectChoice(before,c.choiceId,c.generation,id))};
 selected.set(id,result);return result;
}
function roundTrip(s:MatchState) {
 const saved=serializeMatch(s);
 expect(restoreMatch(saved)).toEqual(s);
 // Parse a valid save then tamper: rejection must come from restore, not serialize.
 const edit=JSON.parse(saved);edit.augments[0].acquiredRound++;
 expect(()=>restoreMatch(JSON.stringify(edit))).toThrow();
}
function advance(input:MatchState):MatchState {
 let s=resolveM5Choices(input);
 if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));
 for(let n=0;s.phase==='combat'&&n<1202;n++)s=stepMatch(s).state;
 s=resolveM5Choices(s);
 expect(s.phase).toBe('settlement');
 return accepted(nextRound(s,s.round));
}
const newItems=(before:MatchState,s:MatchState)=>s.items.filter(i=>!before.items.some(old=>old.id===i.id));
const newUnits=(before:MatchState,s:MatchState)=>s.preparation.units.filter(u=>!before.preparation.units.some(old=>old.id===u.id));
const newConsumables=(before:MatchState,s:MatchState)=>s.consumables.filter(c=>!before.consumables.some(old=>old.consumableId===c.consumableId));

it.each([
 ['team-building','TFT_Consumable_ChampionDuplicator_III','consumable',1],
 ['phreaky-friday','TFT4_Item_OrnnInfinityForce','item',1],
 ['phreaky-friday-plus','TFT4_Item_OrnnInfinityForce','item',1],
 ['dark-alley-dealings','TFT_Item_Artifact_SuspiciousTrenchCoat','item',1],
 ['shimmerscale-essence','TFT7_Item_ShimmerscaleMogulsMail','item',1],
 ['bad-luck-protection','gloves','item',1],
 ['eye-for-an-eye-plus','component','pool',1],['prizefighter','component','pool',2],
 ['building-a-collection-iii','component','pool',1],
 ['flexible','emblem','pool',1],['living-forge','TFT_ArmoryKeyOrnn','unit',1],
] as const)('%s public acquisition grants its source reward once and authenticates save',(id,definition,kind,n)=>{
 const {before,state:s}=pick(id);
 const gifts=kind==='consumable'?newConsumables(before,s):kind==='unit'?newUnits(before,s):newItems(before,s);
 expect(gifts).toHaveLength(n);
 if(kind==='pool'){
  const components=['sword','bow','rod','tear','vest','cloak','belt','gloves'];
  for(const g of gifts)expect(definition==='emblem'?Object.keys(EMBLEM_ITEMS):components).toContain(g.definitionId);
 }else expect(gifts.map(g=>g.definitionId)).toEqual(Array(n).fill(definition));
 const stale=selectChoice(s,before.pendingChoice!.choiceId,before.pendingChoice!.generation,id);
 expect(stale.ok).toBe(false);expect(stale.state).toBe(s);
 roundTrip(s);
 // Missing newly created resource cannot be accepted as a valid acquisition.
 const edit=JSON.parse(serializeMatch(s));
 const key=kind==='consumable'?'consumables':kind==='unit'?'preparation':'items';
 if(key==='preparation')edit.preparation.units=edit.preparation.units.filter((u:{id:string})=>u.id!==('id' in gifts[0]?gifts[0].id:''));
 else if(key==='consumables')edit.consumables=edit.consumables.filter((c:{consumableId:string})=>c.consumableId!==('consumableId' in gifts[0]?gifts[0].consumableId:''));
 else edit.items=edit.items.filter((u:{id:string})=>u.id!==('id' in gifts[0]?gifts[0].id:''));
 expect(()=>restoreMatch(JSON.stringify(edit))).toThrow();
});

it.each([['rolling-for-days-i',11,0],['superstars-i',2,0],['superstars-ii',4,0],['trade-sector',1,1]] as const)('G2 %s: exact free credits, then two-gold paid roll; restored continuation identical',(id,n,gold)=>{
 const {before,state}=pick(id);let s=state;
 expect(s.gold-before.gold).toBe(gold);expect(freeRerollsAvailable(s)).toBe(n);
 for(let i=0;i<n;i++){
  const prev=s;s=accepted(rerollShop(s));
  expect([s.gold,s.shop.generation]).toEqual([prev.gold,prev.shop.generation+1]);
  expect(freeRerollsAvailable(s)).toBe(n-i-1);
 }
 expect(s.gold).toBeGreaterThanOrEqual(2);
 roundTrip(s);
 const restored=restoreMatch(serializeMatch(s));
 const paid=accepted(rerollShop(s));expect(paid.gold).toBe(s.gold-2);
 expect(rerollShop(restored)).toEqual(rerollShop(s));
 const bad=JSON.parse(serializeMatch(s));
 // Credits beyond the source entitlement must fail even with otherwise valid provenance.
 bad.seatMechanics.seat['free-shop-rerolls'].used=n+1;
 expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
});

it.each([
 ['support-mining',0,0,'training-dummy'],['support-mining-plus',0,0,'training-dummy'],
 ['scapegoat',4,0,'training-dummy'],['wandering-trainer-i',1,2,'training-dummy'],
 ['wandering-trainer-ii',6,3,'training-dummy'],['gold-for-dummies',0,0,'training-dummy'],
 ['tower-defense',0,1,'tower-dummy'],
] as const)('G5 %s: exact dummy/emblems/gold through selection, permanent attachment and restore',(id,gold,emblems,unit)=>{
 const {before,state:s}=pick(id),gifts=newUnits(before,s);
 expect(s.gold-before.gold).toBe(gold);expect(gifts.map(u=>u.definitionId)).toEqual([unit]);
 const dummy=gifts[0],items=newItems(before,s);
 expect(items).toHaveLength(emblems);
 expect(new Set(items.map(i=>i.definitionId)).size).toBe(emblems);
 items.forEach(i=>{expect(Object.keys(EMBLEM_ITEMS)).toContain(i.definitionId);expect(i.location).toMatchObject({kind:'unit',unitId:dummy.id});});
 expect(sellUnit(s,dummy.id)).toMatchObject({ok:false,state:s});
 roundTrip(s);
 const edit=JSON.parse(serializeMatch(s));
 if(emblems)edit.items.find((i:{id:string})=>i.id===items[0].id).location={kind:'inventory'};
 else edit.preparation.units.find((u:{id:string})=>u.id===dummy.id).starLevel=2;
 expect(()=>restoreMatch(JSON.stringify(edit))).toThrow();
});

it.each([['field-medic','steb',1],['blade-dance','irelia',1],['shocking-troll','trundle',1],['savage-revenge','renni',2],['all-out','vander',1],['blood-pact','vladimir',1]] as const)('G7 %s: source champion reward and actual combat/save through Match',(id,hero,n)=>{
 const {before,state}=pick(id);let s=state;
 expect(newUnits(before,s).map(u=>u.definitionId)).toEqual(Array(n).fill(hero));
 roundTrip(s);
 const gifted=newUnits(before,s)[0];
 s=emptyBoard(s);s=accepted(deployMatchUnit(s,gifted.id,{kind:'board',cell:{col:3,row:4}}));
 s=accepted(startMatchCombat(s));expect(s.phase).toBe('combat');
 const live=s.combat!.units.find(u=>u.id===gifted.id)!;
 const coefficients:Record<string,Record<string,number>>={
  'field-medic':{manaReduction:10,hitBps:6500,hits:3,omnivampBps:3000},
  'blade-dance':{attackSpeedBps:4000},
  'shocking-troll':{manaReduction:50,speedBps:14000,speedTicks:100,permanentAdBps:150},
  'savage-revenge':{manaReduction:10,mainBps:11000,chargeBps:3000,pounceRange:2},
  'all-out':{damageBps:18500,splashBps:2500},
  'blood-pact':{rangeBonus:3,attackMana:3,damageBps:18000,ampBps:1000,overkillBps:5000},
 };
 expect(live.mechanics).toContainEqual(expect.objectContaining({mechanic:'heroCarryLive',values:expect.objectContaining(coefficients[id])}));
 for(let i=0;i<5;i++){expect(s.phase).toBe('combat');s=stepMatch(s).state;}
 expect(s.combat!.tick).toBe(5);roundTrip(s);
 const bad=JSON.parse(serializeMatch(s));bad.combat.units.find((u:{id:string})=>u.id===gifted.id).runtime.permanentAdBps+=1;
 expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
});

it.each([['worth-the-wait',1,2],['worth-the-wait-ii',2,1]] as const)('G3 %s: source cost/stars, same champion delayed copies, restore at each entry',(id,cost,stars)=>{
 const {before,state}=pick(id);let s=state;
 const initial=newUnits(before,s);expect(initial).toHaveLength(1);
 const hero=initial[0];expect(UNIT_DEFINITIONS[hero.definitionId].cost).toBe(cost);expect(hero.starLevel).toBe(stars);roundTrip(s);
 const counts=()=>s.preparation.units.filter(u=>u.definitionId===hero.definitionId).reduce((n,u)=>n+3**(u.starLevel-1),0);
 const start=counts();
 s=advance(s);expect(counts()-start).toBe(id==='worth-the-wait'?0:1);roundTrip(s);
 // The next entry is 2-3, before the carousel postponement; both have begun copying.
 s=advance(s);expect(counts()-start).toBe(id==='worth-the-wait'?1:2);roundTrip(s);
});

it('G3 Buried Treasures III: precisely six components including acquisition; source record 235',()=>{
 const {before,state}=pick('building-a-collection-iii');let s=state;
 const grantCount=()=>s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.kind==='item').length;
 const baseline=before.seatMechanics?.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.kind==='item').length??0;
 expect(grantCount()-baseline).toBe(1);
 for(let i=1;i<=6;i++){s=advance(s);expect(grantCount()-baseline).toBe(Math.min(i+1,6));roundTrip(s);}
});
it('G8 Exalted Adventure: three distinct two-cost champions plus lesser duplicator (record 220)',()=>{
 const {before,state:s}=pick('an-exalted-adventure');const gifts=newUnits(before,s);
 expect(gifts).toHaveLength(3);expect(new Set(gifts.map(u=>u.definitionId)).size).toBe(3);
 for(const u of gifts)expect([UNIT_DEFINITIONS[u.definitionId].cost,u.starLevel]).toEqual([2,1]);
 expect(newConsumables(before,s).map(c=>c.definitionId)).toEqual(['TFT_Consumable_ChampionDuplicator_III']);roundTrip(s);
});
it('G8 Golden Egg: no immediate currency/items/champions; authentic ownership survives restore (record 296)',()=>{
 const {before,state:s}=pick('the-golden-egg');
 expect([s.gold,newItems(before,s),newUnits(before,s),newConsumables(before,s)]).toEqual([before.gold,[],[],[]]);roundTrip(s);
});
it.each(['latent-forge','eye-for-an-eye','what-doesnt-kill-you','spoils-of-war-i','spoils-of-war-ii','spoils-of-war-iii','corrosion','blazing-soul-i','blazing-soul-ii','noble-sacrifice','wealthy-rehab-i','wealthy-rehab-ii'])('%s: no undocumented immediate resources and public save authenticates ownership',id=>{
 const {before,state:s}=pick(id);
 expect([s.gold,newItems(before,s),newUnits(before,s),newConsumables(before,s)]).toEqual([before.gold,[],[],[]]);roundTrip(s);
});

// G1: 14.24 records 63/31/272/273/242/266. Count real settled PvP rounds,
// not synthetic facts. Only the matching augment's reward receipts are counted.
it.each([
 ['team-building',7,'TFT_Consumable_ChampionDuplicator_III'],
 ['latent-forge',8,'TFT_ArmoryKeyOrnn'],['phreaky-friday',5,'TFT4_Item_OrnnInfinityForce'],
 ['phreaky-friday-plus',3,'TFT4_Item_OrnnInfinityForce'],
 ['dark-alley-dealings',3,'TFT9_Item_OrnnTrickstersGlass'],['living-forge',9,'TFT_ArmoryKeyOrnn'],
] as const)('G1 %s: public settlement gives delayed reward at exactly PvP %i',(id,threshold,reward)=>{
 let s=pick(id).state;
 const acquired=s.round;
 const receipts=()=>s.seatMechanics?.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.receiptId.includes('"'+id+'"')&&'definitionId' in r&&r.definitionId===reward)??[];
 const immediate=receipts().length;let count=0;
 for(let i=0;i<16&&count<threshold;i++){
  s=resolveM5Choices(s);
  if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));
  while(s.phase==='combat')s=stepMatch(s).state;
  s=resolveM5Choices(s);
  count=s.roundResults.filter(r=>r.round>=acquired&&r.roundKind==='pvp').length;
  expect(receipts().length-immediate).toBe(count>=threshold?1:0);
  if(count<threshold)s=accepted(nextRound(s,s.round));
 }
 expect(count).toBe(threshold);roundTrip(s);
 const late=receipts().at(-1)!;expect(late.round).toBe(s.round);
 const edited=JSON.parse(serializeMatch(s));
 edited.seatMechanics.receipts=edited.seatMechanics.receipts.filter((r:{receiptId:string})=>r.receiptId!==late.receiptId);
 expect(()=>restoreMatch(JSON.stringify(edited))).toThrow();
},300000);

it('G1 What Doesnt Kill You: 2 gold for each real PvP loss, component exactly on the fourth (record 214)',()=>{
 let s=pick('what-doesnt-kill-you').state;const acquired=s.round;
 for(let n=0;n<4;n++){
  if(s.roundDefinitionId==='2-4')s=advance(s);
  s=resolveM5Choices(s);if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));
  while(s.phase==='combat')s=stepMatch(s).state;s=resolveM5Choices(s);
  const losses=s.roundResults.filter(r=>r.round>=acquired&&r.roundKind==='pvp'&&r.result==='enemyWin').length;
  expect(losses).toBe(n+1);
  const gold=s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch3'&&JSON.parse(r.receiptId)[1]===s.augments.find(a=>a.definitionId==='what-doesnt-kill-you')!.choiceId);
  expect(gold.map(r=>r.kind==='gold'?r.amount:0)).toEqual(Array(losses).fill(2));
  const components=s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.receiptId.includes('"what-doesnt-kill-you"'));
  expect(components).toHaveLength(Math.floor(losses/4));roundTrip(s);
  if(n<3)s=accepted(nextRound(s,s.round));
 }
});

it.each([
 ['corrosion','corrosion',{resistLoss:3,periodTicks:40}],
 ['blazing-soul-i','blazingSoul',{abilityPower:20,attackSpeedBps:2000,periodTicks:60}],
 ['blazing-soul-ii','blazingSoul',{abilityPower:35,attackSpeedBps:3000,periodTicks:60}],
 ['noble-sacrifice','nobleSacrifice',{baseResists:25,shareBps:1000}],
 ['wealthy-rehab-i','wealthyRehab',{omnivampBps:1000}],
 ['wealthy-rehab-ii','wealthyRehab',{omnivampBps:1500}],
 ['bad-luck-protection','badLuck',{ratioBps:10000}],
] as const)('G6 %s: public combat freezes source coefficients; mid-fight restore rejects changed coefficient',(id,mechanic,values)=>{
 let s=pick(id).state;s=emptyBoard(s);
 const u=s.preparation.units.find(u=>u.team==='player')!;
 s=accepted(deployMatchUnit(s,u.id,{kind:'board',cell:{col:3,row:4}}));
 s=accepted(startMatchCombat(s));expect(s.phase).toBe('combat');
 expect(s.combat!.units.find(x=>x.id===u.id)!.mechanics).toContainEqual(expect.objectContaining({mechanic,values}));
 for(let tick=0;tick<5;tick++)s=stepMatch(s).state;
 expect(s.combat!.tick).toBe(5);roundTrip(s);
 const bad=JSON.parse(serializeMatch(s));
 const m=bad.combat.units.find((x:{id:string})=>x.id===u.id).mechanics.find((m:{mechanic:string})=>m.mechanic===mechanic);
 m.values[Object.keys(values)[0]]++;
 expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
});

it.each([['blazing-soul-i',20,2000],['blazing-soul-ii',35,3000]] as const)('G6 %s: first three-second transfer actually contributes AP and AS, continues identically after restore',(id,ap,speed)=>{
 let s=pick(id).state;
 // Buy through shop, increasing population through public XP purchases if needed.
 if(s.preparation.units.filter(u=>u.team==='player').length<2){
  const slot=s.shop.slots.findIndex(x=>x.status==='available');s=accepted(buyUnit(s,slot,s.shop.generation));
 }
 if(s.level<2)s=accepted(buyXp(s));
 s=emptyBoard(s);
 for(const [i,u] of s.preparation.units.filter(u=>u.team==='player').slice(0,2).entries())s=accepted(deployMatchUnit(s,u.id,{kind:'board',cell:{col:1+i*4,row:7}}));
 s=accepted(startMatchCombat(s));
 const grants=(s:MatchState)=>s.combat!.units.flatMap(u=>u.mechanismState?.statuses.flatMap(g=>g.contributions.filter(c=>c.source.definitionId===id))??[]);
 expect(grants(s)).toHaveLength(0);
 s=stepMatch(s).state;
 expect(s.combat!.tick).toBe(1);
 expect(grants(s).map(c=>c.application.modifier?.value)).toEqual([{kind:'constant',amount:ap},{kind:'constant',amount:speed}]);
 const first=s.combat!.units.find(u=>u.mechanismState?.statuses.some(g=>g.contributions.some(c=>c.source.definitionId===id)))!.id;
 for(let n=1;n<60;n++){expect(s.phase).toBe('combat');s=stepMatch(s).state;}
 expect(grants(s)).toHaveLength(2);
 const restored=restoreMatch(serializeMatch(s));
 expect(stepMatch(restored)).toEqual(stepMatch(s));s=stepMatch(s).state;
 expect(s.combat!.tick).toBe(61);
 expect(s.combat!.units.find(u=>u.mechanismState?.statuses.some(g=>g.contributions.some(c=>c.source.definitionId===id)))!.id).not.toBe(first);
 const contribution=grants(s);expect(contribution).toHaveLength(2);
 expect(contribution.map(c=>c.application.modifier?.value)).toEqual([{kind:'constant',amount:ap},{kind:'constant',amount:speed}]);
 roundTrip(s);
 const bad=JSON.parse(serializeMatch(s));
 const g=bad.combat.units.flatMap((u:any)=>u.mechanismState?.statuses.flatMap((g:any)=>g.contributions)??[]).find((c:any)=>c.source.definitionId===id);
 g.application.modifier.value.amount++;
 expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
});

// B3-V1 (fixed): every free spend is a resource-provenance fact the counter must match.
it('G2 anti-tamper: spent free rerolls cannot be reset by deleting their counter',()=>{
 let s=pick('rolling-for-days-i').state;
 s=accepted(rerollShop(s));expect(freeRerollsAvailable(s)).toBe(10);
 const edit=JSON.parse(serializeMatch(s));delete edit.seatMechanics.seat['free-shop-rerolls'];
 expect(()=>restoreMatch(JSON.stringify(edit))).toThrow();
});
// B3-V1 (fixed): every free spend is a resource-provenance fact the counter must match.
it('G2 anti-tamper: spent free rerolls cannot be refunded by lowering the counter within range',()=>{
 let s=pick('rolling-for-days-i').state;
 s=accepted(rerollShop(accepted(rerollShop(s))));expect(freeRerollsAvailable(s)).toBe(9);
 const edit=JSON.parse(serializeMatch(s));edit.seatMechanics.seat['free-shop-rerolls'].used=1;
 expect(()=>restoreMatch(JSON.stringify(edit))).toThrow();
});

const mined=new Map<string,MatchState>();
function mine(id:string,threshold:number):MatchState {
 const cached=mined.get(id);if(cached)return cached;
 let s=pick(id).state;const dummy=s.preparation.units.find(u=>u.definitionId==='training-dummy')!;
 let deaths=0;
 for(let battle=0;battle<16&&deaths<threshold;battle++){
  s=resolveM5Choices(s);s=emptyBoard(s);
  s=accepted(deployMatchUnit(s,dummy.id,{kind:'board',cell:{col:3,row:4}}));
  s=accepted(startMatchCombat(s));
  while(s.phase==='combat')s=stepMatch(s).state;
  s=resolveM5Choices(s);
  if(!s.combat!.units.find(u=>u.id===dummy.id)!.alive)deaths++;
  const gifts=s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.kind==='item'&&r.receiptId.includes('"'+id+'"'));
  expect(gifts).toHaveLength(deaths===threshold?1:0);
  expect(s.preparation.units.some(u=>u.id===dummy.id)).toBe(deaths<threshold);
  if(deaths<threshold){s=accepted(nextRound(s,s.round));if(s.roundDefinitionId==='2-4'||s.roundDefinitionId==='3-4')s=advance(s);}
 }
 expect(deaths).toBe(threshold);mined.set(id,s);return s;
}
it.each([['support-mining',7],['support-mining-plus',4]] as const)('G5 %s: actual dummy deaths retire it exactly at source threshold %i',(id,threshold)=>{
 const s=mine(id,threshold);
 const r=s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.kind==='item'&&r.receiptId.includes('"'+id+'"'));
 expect(r).toHaveLength(1);
},300000);
// B3-V2 (fixed): the settlement suffix replay consumes the dummy's unit-removed retirement fact.
it('G5 normal Support Mining retirement save restores',()=>roundTrip(mine('support-mining',7)),300000);
it('G5 Support Mining Plus retirement save restores',()=>roundTrip(mine('support-mining-plus',4)),300000);

it('G8 Golden Egg: actual public round entries hatch once at eleven without wins (record 296)',()=>{
 let s=pick('the-golden-egg').state;const acquired=s.round;
 const receipts=()=>s.seatMechanics!.receipts.filter(r=>r.receiptId.includes('"the-golden-egg"'));
 // The egg is a 4-2 card (14.24 stage tags, after this review). A no-win route from 4-2 can be eliminated before its
 // eleventh entry; then only the "nothing before eleven" half is observable here (augment-pool-batch3 covers the timer).
 for(let entry=1;entry<=12;entry++){
  const next=resolveM5Choices(s);if(next.phase==='preparation'){const fought=accepted(startMatchCombat(emptyBoard(next)));let f=fought;while(f.phase==='combat')f=stepMatch(f).state;if(resolveM5Choices(f).phase==='gameOver'){expect(entry).toBeLessThan(12);return;}}
  s=advance(s);
  expect(s.roundResults.filter(r=>r.round>=acquired&&r.result==='playerWin'&&r.roundKind==='pvp')).toHaveLength(0);
  if(entry<11)expect(receipts()).toHaveLength(0);
  else expect(receipts().length).toBeGreaterThan(0);
  if(entry===11){roundTrip(s);const bad=JSON.parse(serializeMatch(s));bad.seatMechanics.receipts=bad.seatMechanics.receipts.filter((r:{receiptId:string})=>!r.receiptId.includes('"the-golden-egg"'));expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();}
 }
 expect(new Set(receipts().map(r=>r.round))).toEqual(new Set([acquired+11]));
},300000);

// B3-V2 (fixed): the valid public terminal also restores directly, independently of serializeMatch preflight.
it.each([['support-mining',7],['support-mining-plus',4]] as const)('B3-V2 %s direct restore accepts legitimate retirement', (id,threshold)=>{
 const s=mine(id,threshold);expect(restoreMatch(JSON.stringify(s))).toEqual(s);
},300000);
