import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createMatch, selectChoice, startMatchCombat, stepMatch, deployMatchUnit, equipItem, rerollShop, buyUnit } from '../src/simulation/match';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
import { g23BattleFacts } from '../src/simulation/g2-3-settlement';
import { AUGMENT_BATCH3 } from '../src/simulation/content/augment-pool-batch3';
import { batch3RewardPlan, drainBatch3Gold, validateBatch3Gold } from '../src/simulation/augment-pool-batch3-progress';
import { drainBatch1Gifts, validateBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed, augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import type { MatchState } from '../src/simulation/match-types';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { freeRerollsAvailable, freeRerollsGranted, validateFreeRerolls } from '../src/simulation/free-rerolls';
import { grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accept } from './tp-helpers';
import { reachRound } from './match-helpers';

/** Hand transcription of the 14.24 rows (augments-research-2026-10-23 augments-14.24.json, zh_cn/en_us client strings
 * and map22 constants). Every production row, compiled value and test expectation below is checked against this table. */
const SOURCE = {
  'mirrored-monetization': { apiName: 'TFT_Augment_MirroredMonetization', tier: 'gold', values: { GoldContained: 2, PercCost: 2, rounds: 3 } },
  'good-for-something-i': { apiName: 'TFT10_Augment_GoodForSomethingSilver', tier: 'silver', values: { DropChance: 0.5, Gold: 1 } },
  'a-golden-find': { apiName: 'TFT13_Augment_AGoldenFind', tier: 'gold', values: { FreeRerolls: 10, GoldPerRequirement: 2, NumKillsRequirement: 3 } },
  'long-distance-relationship': { apiName: 'TFT9_Augment_LongDistanceRelationship2', tier: 'gold', values: { PercentShare: 0.2199999988079071 } },
  'category-five': { apiName: 'TFT_Augment_CategoryFive', tier: 'gold', values: { AS: null, TotalDamage: 0.8500000238418579, additionalbolts: 1 } },
  'sated-spellweaver': { apiName: 'TFT_Augment_SatedSpellweaver', tier: 'gold', values: { Duration: 3, MaxShield: 300, Omnivamp: 0.20000000298023224 } },
  'crafted-crafting': { apiName: 'TFT_Augment_CraftedCrafting', tier: 'silver', values: { Rerolls: 2 } },
  sponging: { apiName: 'TFT_Augment_Sponging', tier: 'prismatic', values: { MaxItemsToBeEligible: 1, MaxUnits: 5 } },
} as const;
const IDS = Object.keys(SOURCE) as (keyof typeof SOURCE)[];

type Battle = readonly ['pvp'|'pve', G23BattleFacts['result']];
const fact=(round:number,[roundKind,result]:Battle):G23BattleFacts=>({battleId:'battle-'+round,round,roundKind,result,conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0});
/** Battles occupy rounds 1..n; with `drain`, each battle receipt is followed by that round's settlement gold drain. */
function withFacts(id:string,facts:readonly Partial<G23BattleFacts>[],acquiredRound=1,battles?:readonly Battle[],drain=false):MatchState {
 let s:MatchState={...createMatch(42),augments:[{definitionId:id,choiceId:'test',acquiredRound}]};
 for(const [i,extra] of facts.entries()){
  s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,{...fact(i+1,battles?.[i]??['pvp','win']),...extra}).progress);
  if(drain)s=drainBatch3Gold(s);
 }
 return s;
}
const deaths=(n:number,from=0)=>Array.from({length:n},(_,i)=>({victimId:'v'+(from+i),eventSeq:i+1}));
const batch3Gold=(s:MatchState)=>s.seatMechanics?.receipts.filter(r=>r.source==='augment-pool-batch3').map(r=>[(r as {amount:number}).amount,r.round])??[];
const firstOffers=(seed:number)=>{const state=createMatch(seed);return generateChoices(augmentCandidates(resolveAugmentTier(state,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),state.choiceRngState).offers;};
const mechanicValues=(id:string,name:string)=>AUGMENT_DEFINITIONS[id].effects.flatMap(e=>e.kind==='mechanic'&&e.mechanic===name?[e.values]:[]);
function combatOf(id:string,player:number,enemy:readonly string[]=['garen'],patch:(s:MatchState)=>MatchState=s=>s){
 const s=createMatch(42),u=s.preparation.units[0];
 const units=[...Array.from({length:player},(_,i)=>({...u,id:'p'+i,team:'player' as const,location:{kind:'board' as const,cell:{col:i*2,row:7}}})),
  ...enemy.map((definitionId,i)=>({...u,id:'e'+i,definitionId,starLevel:2 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:i*2,row:0}}}))];
 const state=patch({...s,preparation:{...s.preparation,units},augments:[{definitionId:id,choiceId:'t',acquiredRound:1}]});
 return createCombatWithEvents(state.preparation,buildStrategySnapshot(state),'b3m-'+id,42).state;
}

/** Three-star allies, so they outlast two-star enemies, score kills and are healed while still at full health. */
const strong=(s:MatchState):MatchState=>({...s,preparation:{...s.preparation,units:s.preparation.units.map(u=>u.team==='player'?{...u,starLevel:3 as const}:u)}});

it('the eight rows match the hand-transcribed 14.24 table, the research archive, and are registered in the offer pool', ()=>{
 const research=JSON.parse(readFileSync('/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json','utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;description_en_us:string;tier:number;effects:Record<string,number|null>}[];
 for(const id of IDS){
  const row=AUGMENT_BATCH3[id],expected=SOURCE[id],r=research.find(x=>x.apiName===expected.apiName)!;
  expect(r.effects).toEqual(expected.values);expect(['silver','gold','prismatic'][r.tier-1]).toBe(expected.tier);
  expect([row.apiName,row.tier,row.source.values,row.name,row.description,row.source.description_en_us]).toEqual([expected.apiName,expected.tier,expected.values,r.name_zh_cn,r.description_zh_cn,r.description_en_us]);
  expect(AUGMENT_TIERS[id]).toBe(expected.tier);expect(AUGMENT_POOL_API_NAMES[id]).toBe(expected.apiName);expect(AUGMENT_DEFINITIONS[id].name).toBe(r.name_zh_cn);
 }
 // Compiled coefficients, in basis points / ticks (20 per second).
 expect(mechanicValues('mirrored-monetization','acquisitionGold')).toEqual([{amount:2}]);
 expect(mechanicValues('good-for-something-i','goodForSomething')).toEqual([{dropChanceBps:5000}]);
 expect(mechanicValues('a-golden-find','goldenFind')).toEqual([{killsPerGold:3}]);
 expect(mechanicValues('long-distance-relationship','longDistance')).toEqual([{shareBps:2200}]);
 expect(mechanicValues('sated-spellweaver','satedSpellweaver')).toEqual([{omnivampBps:2000,durationTicks:60,maxShield:300}]);
 expect(mechanicValues('sponging','sponging')).toEqual([{maxUnits:5,maxItems:1}]);
 expect(AUGMENT_BATCH3['category-five'].gifts).toEqual([{kind:'item',definitionId:'runaans-hurricane'}]);
});
it('14.24 MutuallyExclusiveItems: Sated Spellweaver excludes Wealthy Rehab I/II, Category Five excludes Not Today', ()=>{
 const own=(id:string)=>[{definitionId:id,choiceId:'old',acquiredRound:1}],ctx={node:'3-2',fieldedTraits:[],blocked:[]};
 for(const [a,b] of [['sated-spellweaver','wealthy-rehab-i'],['sated-spellweaver','wealthy-rehab-ii'],['category-five','not-today']]){
  expect(augmentOfferAllowed(a,own(b),ctx)).toBe(false);expect(augmentOfferAllowed(b,own(a),ctx)).toBe(false);
 }
 expect(augmentOfferAllowed('sated-spellweaver',own('category-five'),ctx)).toBe(true);
});

it('P: Mirrored Monetization pays 2 gold now and 2 per enemy champion death in player combats of the acquisition round and the next two rounds', ()=>{
 const history:Battle[]=[['pvp','win'],['pve','win'],['pvp','loss'],['pvp','win']];
 const facts=[{openingDeaths:deaths(3)},{openingDeaths:deaths(4)},{openingDeaths:deaths(2)},{openingDeaths:deaths(5)}];
 const s=withFacts('mirrored-monetization',facts,1,history),paid=withFacts('mirrored-monetization',facts,1,history,true);
 // Rounds 1..3 are the window; the PvE round's monster deaths and round 4 are outside it.
 expect(batch3Gold(paid)).toEqual([[2,1],[2,1],[2,1],[2,3],[2,3]]);expect(paid.gold-s.gold).toBe((3+2)*2);
 expect(drainBatch3Gold(paid)).toBe(paid);validateBatch3Gold(paid);
 const forged=structuredClone(paid) as any;forged.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch3').amount=3;
 expect(()=>validateBatch3Gold(forged)).toThrow();expect(()=>validateBatch3Gold(s)).toThrow();
 // Acquired in round 2: round 4 is the window's last round, round 5 is not.
 const late=withFacts('mirrored-monetization',[{openingDeaths:deaths(1)},{openingDeaths:deaths(1)},{},{openingDeaths:deaths(1)},{openingDeaths:deaths(1)}],2,undefined,true);
 expect(batch3Gold(late)).toEqual([[2,2],[2,4]]);
});

it('P: Good For Something marks only allied champions holding no item, and the settlement fact counts their deaths', ()=>{
 const c0=combatOf('good-for-something-i',3,['garen','garen','garen','garen'],s=>({...s,items:[...s.items,{id:'held',definitionId:'sword',location:{kind:'unit',unitId:'p0',slot:0}}]}));
 const marked=(c:typeof c0)=>c.units.filter(u=>u.mechanics?.some(m=>m.mechanic==='goodForSomething')).map(u=>u.id).sort();
 expect(marked(c0)).toEqual(['p1','p2']);
 let c=c0;while(c.status==='running')c=stepCombat(c).state;
 const dead=c.units.filter(u=>u.team==='player'&&!u.alive).map(u=>u.id);expect(dead.length).toBeGreaterThan(0);
 const f=g23BattleFacts(c,'player',1,'pvp',c0.units.map(u=>({id:u.id,team:u.team})));
 const itemless=dead.filter(id=>id!=='p0').length;
 expect(f.batch3ItemlessDeaths).toBe(itemless||undefined);
 expect(f.alliedDeaths).toBe(dead.length);
});
it('P: each itemless death rolls its own 50% on a seat/choice stream and a hit pays 1 gold; malformed facts are rejected', ()=>{
 const history=Array.from({length:20},()=>({batch3ItemlessDeaths:20}));
 const s=withFacts('good-for-something-i',history),paid=withFacts('good-for-something-i',history,1,undefined,true),hits=batch3Gold(paid);
 expect(hits.every(([g])=>g===1)).toBe(true);expect(hits.length/400).toBeGreaterThan(0.43);expect(hits.length/400).toBeLessThan(0.57);
 expect(paid.gold-s.gold).toBe(hits.length);validateBatch3Gold(paid);
 // Deterministic: the same history pays the same deaths.
 expect(batch3Gold(withFacts('good-for-something-i',history,1,undefined,true))).toEqual(hits);
 expect(batch3RewardPlan(s)).toEqual([]);
 const p=readG23Progress(s)!;
 for(const bad of [0,101,1.5])expect(()=>advanceG23Economy(p,{...fact(21,['pvp','win']),batch3ItemlessDeaths:bad})).toThrow();
 expect(batch3RewardPlan(withFacts('good-for-something-i',[{batch3ItemlessDeaths:5}],2))).toEqual([]);
});

it('A Golden Find grants 10 free rerolls and 2 gold per 3 kills by the anomaly-evolved champion, remainders carrying over', ()=>{
 const history=[{batch3AnomalyKills:2},{},{batch3AnomalyKills:4},{batch3AnomalyKills:3}];
 const s=withFacts('a-golden-find',history);
 expect(freeRerollsGranted(s)).toBe(10);
 const paid=withFacts('a-golden-find',history,1,undefined,true);expect(batch3Gold(paid)).toEqual([[2,3],[2,3],[2,4]]);validateBatch3Gold(paid);
 const c0=combatOf('a-golden-find',2,['garen','garen'],x=>({...strong(x),anomalyBinding:{definitionId:'mage-armor',unitId:'p1',choiceId:'anomaly',boundRound:1} as any}));
 expect(c0.units.filter(u=>u.mechanics?.some(m=>m.mechanic==='goldenFind')).map(u=>u.id)).toEqual(['p1']);
 let c=c0,kills=0;
 while(c.status==='running'){const step=stepCombat(c);kills+=step.events.filter(e=>e.type==='kill'&&(e as any).source.ownerId==='p1').length;c=step.state;}
 expect(kills).toBeGreaterThan(0);expect(c.units.find(u=>u.id==='p1')!.batch2?.anomalyKills).toBe(kills);
 expect(g23BattleFacts(c,'player',1,'pvp',c0.units.map(u=>({id:u.id,team:u.team}))).batch3AnomalyKills).toBe(kills||undefined);
});

it('P: Long Distance Relationship bonds the two furthest allies on the first tick, each gaining 22% of the other\'s four stats', ()=>{
 let c=combatOf('long-distance-relationship',3,['garen'],s=>({...s,items:[...s.items,{id:'rod',definitionId:'rod',location:{kind:'unit',unitId:'p2',slot:0}},{id:'vest',definitionId:'vest',location:{kind:'unit',unitId:'p0',slot:0}}]}));
 const before=Object.fromEntries(c.units.map(u=>[u.id,readCombatStats(u,c)]));
 c=stepCombat(c).state;expect(c.tick).toBe(1);
 const grants=c.units.flatMap(u=>(u.mechanismState?.statuses.flatMap(g=>g.contributions)??[]).filter(k=>k.source.definitionId==='long-distance-relationship').map(k=>[u.id,k.application.modifier!.stat,k.application.modifier!.value]));
 const share=(n:number)=>({kind:'constant',amount:Math.floor(n*0.22)});
 const of=(id:string)=>[['armor',before[id].armor],['magicResist',before[id].magicResist],['attackDamage',before[id].attackDamage],['abilityPower',before[id].abilityPower]] as const;
 expect(grants).toEqual([...of('p2').map(([s,n])=>['p0',s,share(n)]),...of('p0').map(([s,n])=>['p2',s,share(n)])]);
 for(let i=0;i<40&&c.status==='running';i++)c=stepCombat(c).state;
 expect(c.units.flatMap(u=>(u.mechanismState?.statuses.flatMap(g=>g.contributions)??[]).filter(k=>k.source.definitionId==='long-distance-relationship'))).toHaveLength(8);
});

it('P: Category Five gives a Runaan\'s Hurricane and the holder\'s Hurricane bolts hit one more enemy at 85% of the bolt damage', ()=>{
 const s=createMatch(42),u=s.preparation.units[0];
 const held={...s,preparation:{...s.preparation,units:[{...u,location:{kind:'board' as const,cell:{col:0,row:7}}}]},items:[...s.items,{id:'hurricane',definitionId:'runaans-hurricane',location:{kind:'unit' as const,unitId:u.id,slot:0}}]};
 const bolt=(state:MatchState)=>buildStrategySnapshot(state).units[0].itemPrograms!.find(p=>p.source.definitionId==='runaans-hurricane')!.program.triggers!.map(t=>[t.selector.maxTargets,t.effects.map(e=>e.kind==='damage'?e.amount.attackDamageBps:null)]);
 expect(bolt(held)).toEqual([[1,[5500]]]);
 expect(bolt({...held,augments:[{definitionId:'category-five',choiceId:'t',acquiredRound:1}]})).toEqual([[2,[Math.round(5500*0.85)]]]);
 const gifted=drainBatch1Gifts({...createMatch(42),augments:[{definitionId:'category-five',choiceId:'t',acquiredRound:1}]});
 expect(gifted.items.filter(i=>i.definitionId==='runaans-hurricane')).toHaveLength(1);validateBatch1Gifts(gifted);
});

it('P: Sated Spellweaver opens a 3-second 20% omnivamp window per cast and converts its own excess healing into a shield of at most 300', ()=>{
 let c=combatOf('sated-spellweaver',3,['garen','garen','garen'],strong);const casts:Record<string,number[]>={};let heals=0,overheals=0,shielded=0;
 while(c.status==='running'){
  const step=stepCombat(c);
  for(const e of step.events as any[]){
   if(e.type==='cast'&&e.receipt.source.ownerId.startsWith('p'))(casts[e.receipt.source.ownerId]??=[]).push(step.state.tick);
   if(e.type==='heal'&&e.outcome.shares.some((x:any)=>x.source.definitionId==='sated-spellweaver')){
    heals++;if(e.outcome.overheal>0)overheals++;const owner=e.outcome.targetId,last=Math.max(...(casts[owner]??[-1000]));
    expect(step.state.tick-last).toBeLessThan(60);
   }
  }
  c=step.state;
  for(const u of c.units)for(const l of u.shieldLayers??[])if(l.source.definitionId==='sated-spellweaver'){expect(l.remaining).toBeLessThanOrEqual(300);shielded++;}
  for(const [id,ticks] of Object.entries(casts))expect(c.units.find(u=>u.id===id)!.batch2?.satedUntil).toBe(Math.max(...ticks)+60);
 }
 expect(Object.keys(casts).length).toBeGreaterThan(0);expect(heals).toBeGreaterThan(0);
 expect(shielded>0).toBe(overheals>0);
 // Against training dummies nobody is hurt, so every Sated heal is excess and tops one shield per champion up to 300.
 let d=combatOf('sated-spellweaver',2,['training-dummy','training-dummy'],strong),top=0;const excess:Record<string,number>={};
 for(let i=0;i<600&&d.status==='running';i++){
  const step=stepCombat(d);d=step.state;
  for(const e of step.events as any[])if(e.type==='heal'&&e.outcome.shares.some((x:any)=>x.source.definitionId==='sated-spellweaver'))excess[e.outcome.targetId]=(excess[e.outcome.targetId]??0)+e.outcome.overheal;
  if(d.status!=='running')break;
  for(const u of d.units.filter(u=>u.team==='player')){
   const layers=(u.shieldLayers??[]).filter(l=>l.source.definitionId==='sated-spellweaver');
   expect(layers.map(l=>l.remaining)).toEqual(excess[u.id]?[Math.min(300,excess[u.id])]:[]);top=Math.max(top,...layers.map(l=>l.remaining));
  }
 }
 expect(top).toBeGreaterThan(0);
});

it('P: Crafted Crafting adds 2 free shop rerolls per completed item crafted from the acquisition round on', ()=>{
 const craft=(state:MatchState,tag:string)=>{
  let s=state;const holder=s.preparation.units.find(u=>u.team==='player')!;
  for(const [i,id] of ['sword','bow'].entries()){s=accept(grantMechanicItem(s,{receiptId:tag+i,source:'test',definitionId:id}) as any).state;s=accept(equipItem(s,s.items.at(-1)!.id,holder.id,i) as any).state;}
  return s;
 };
 const base=createMatch(42),now={...base,augments:[{definitionId:'crafted-crafting',choiceId:'t',acquiredRound:base.round}]};
 expect(freeRerollsGranted(now)).toBe(0);
 let s=craft(now,'a');expect(s.resourceProvenance.entries.filter(e=>e.kind==='item-combined')).toHaveLength(1);expect(freeRerollsAvailable(s)).toBe(2);
 expect(freeRerollsGranted({...craft(base,'b'),augments:[{definitionId:'crafted-crafting',choiceId:'t',acquiredRound:base.round+1}]})).toBe(0);
 s={...s,gold:10};const gold=s.gold;
 s=accept(rerollShop(s) as any).state;s=accept(rerollShop(s) as any).state;expect(s.gold).toBe(gold);validateFreeRerolls(s);
 s=accept(rerollShop(s) as any).state;expect(s.gold).toBe(gold-2);
});

it.each(['long-distance-relationship','sated-spellweaver'])('%s: a real public selection survives strict mid-combat save/restore, and edited augment runtime is rejected', id=>{
 let seed=0;while(!firstOffers(seed).includes(id))seed++;
 let s=reachRound('2-1',false,seed);const c=s.pendingChoice!;expect(c.offers).toContain(id);
 s=accept(selectChoice(s,c.choiceId,c.generation,id) as any).state as MatchState;
 for(let slot=0;slot<s.shop.slots.length&&s.preparation.units.filter(u=>u.team==='player').length<2;slot++){const r=buyUnit(s,slot,s.shop.generation) as any;if(r.ok)s=r.state;}
 expect(s.preparation.units.filter(u=>u.team==='player').length).toBeGreaterThanOrEqual(2);
 for(const [i,unit] of s.preparation.units.filter(u=>u.team==='player').slice(0,2).entries())s=accept(deployMatchUnit(s,unit.id,{kind:'board',cell:{col:i?6:0,row:i?7:4}}) as any).state;
 s=accept(startMatchCombat(s) as any).state;let checked=0,tampered=0;
 while(s.phase==='combat'){
  s=stepMatch(s).state;if(!s.combat||s.combat.tick%30!==2)continue;
  expect(restoreMatch(serializeMatch(s))).toEqual(s);checked++;
  const edit=structuredClone(s) as any,k=edit.combat.units.flatMap((u:any)=>u.mechanismState?.statuses.flatMap((g:any)=>g.contributions)??[]).find((k:any)=>k.source.definitionId===id);
  if(k?.application.modifier){k.application.modifier.value.amount+=1;expect(()=>restoreMatch(serializeMatch(edit))).toThrow();tampered++;}
  const runtime=structuredClone(s) as any,owner=runtime.combat.units.find((u:any)=>u.team==='player');owner.batch2={...owner.batch2,satedUntil:(owner.batch2?.satedUntil??0)+7};
  expect(()=>restoreMatch(serializeMatch(runtime))).toThrow();
 }
 expect(checked).toBeGreaterThan(0);if(id==='long-distance-relationship')expect(tampered).toBeGreaterThan(0);
},120000);

it('P: Sponging copies one completed item of the nearest fully itemized ally onto at most five champions holding one item or fewer', ()=>{
 const m=createMatch(42),u=m.preparation.units[0];
 const cells=[[0,7],[1,7],[6,4],[2,7],[3,7],[4,7],[5,7],[6,7],[0,4]];
 const units=cells.map(([col,row],i)=>({...u,id:'p'+i,team:'player' as const,location:{kind:'board' as const,cell:{col,row}}}));
 const item=(id:string,unitId:string,slot:number)=>({id:unitId+':'+id,definitionId:id,location:{kind:'unit' as const,unitId,slot}});
 const items=[item('runaans-hurricane','p0',0),item('bloodthirster','p0',1),item('sword','p0',2),
  item('infinity-edge','p8',0),item('giant-slayer','p8',1),item('statikk-shiv','p8',2),
  item('belt','p3',0),item('rod','p3',1),item('bow','p4',0)];
 const state={...m,preparation:{...m.preparation,units},items,augments:[{definitionId:'sponging',choiceId:'t',acquiredRound:1}]};
 const snap=buildStrategySnapshot(state);
 const copies=Object.fromEntries(snap.units.flatMap(x=>x.sources.filter(s=>s.source.sourceDefinitionId==='sponging'&&s.source.sourceInstanceId.startsWith('[')).slice(0,1).map(s=>[x.unitId,JSON.parse(s.source.sourceInstanceId)])));
 // p0/p8 are itemized, p3 holds two items; p1,p2,p4,p5,p6 are the first five eligible ids, so p7 gets nothing.
 expect(Object.keys(copies).sort()).toEqual(['p1','p2','p4','p5','p6']);
 for(const [id,[,donor,definitionId]] of Object.entries(copies)){
  expect(donor).toBe(id==='p2'?'p8':'p0');
  expect(donor==='p0'?['bloodthirster','runaans-hurricane']:['giant-slayer','infinity-edge','statikk-shiv']).toContain(definitionId);
 }
 // The copy carries the item's stats and its combat program, bound as an augment source.
 const p1=snap.units.find(x=>x.unitId==='p1')!;
 expect(p1.itemPrograms?.some(p=>p.source.sourceKind==='augment'&&p.source.definitionId==='sponging')).toBe(!!ITEM_DEFINITIONS[copies.p1[2]].combatProgram);
 expect(buildStrategySnapshot(state)).toEqual(snap);
 expect(buildStrategySnapshot({...state,augments:[]}).units.every(x=>x.sources.every(s=>!s.source.sourceInstanceId.startsWith('[')))).toBe(true);
 // Battle-time equipment recompiles reuse the opening copies even after the donor's items change.
 const later=buildStrategySnapshot({...state,items:state.items.filter(i=>i.location.unitId!=='p0')},undefined,undefined,snap);
 expect(later.units.find(x=>x.unitId==='p1')!.sources.filter(s=>s.source.sourceDefinitionId==='sponging')).toEqual(p1.sources.filter(s=>s.source.sourceDefinitionId==='sponging'));
});
it('Sponging: a real public selection copies an item at combat start and the combat survives strict save/restore', ()=>{
 let seed=0;while(!firstOffers(seed).includes('sponging'))seed++;
 let s=reachRound('2-1',false,seed);const c=s.pendingChoice!;expect(c.offers).toContain('sponging');
 s=accept(selectChoice(s,c.choiceId,c.generation,'sponging') as any).state as MatchState;
 for(let slot=0;slot<s.shop.slots.length&&s.preparation.units.filter(u=>u.team==='player').length<2;slot++){const r=buyUnit(s,slot,s.shop.generation) as any;if(r.ok)s=r.state;}
 const [donor,receiver]=s.preparation.units.filter(u=>u.team==='player');
 for(const [i,id] of ['bloodthirster','infinity-edge','giant-slayer'].entries()){
  s=accept(grantMechanicItem(s,{receiptId:'sponging-test:'+i,source:'test',definitionId:id}) as any).state;s=accept(equipItem(s,s.items.at(-1)!.id,donor.id,i) as any).state;
 }
 s=accept(deployMatchUnit(s,donor.id,{kind:'board',cell:{col:0,row:7}}) as any).state;s=accept(deployMatchUnit(s,receiver.id,{kind:'board',cell:{col:3,row:4}}) as any).state;
 s=accept(startMatchCombat(s) as any).state;
 const copy=s.combat!.strategy!.units.find(u=>u.unitId===receiver.id)!.sources.find(x=>x.source.sourceDefinitionId==='sponging'&&x.source.sourceInstanceId.startsWith('['));
 expect(['bloodthirster','infinity-edge','giant-slayer']).toContain(JSON.parse(copy!.source.sourceInstanceId)[2]);
 let checked=0;
 let tampered=0;
 while(s.phase==='combat'){
  s=stepMatch(s).state;if(!s.combat||s.combat.tick%40!==1)continue;
  expect(restoreMatch(serializeMatch(s))).toEqual(s);checked++;
  const edit=structuredClone(s) as any,k=edit.combat.units.flatMap((u:any)=>u.mechanismState?.statuses.flatMap((g:any)=>g.contributions)??[]).find((k:any)=>k.source.definitionId==='sponging'&&k.application.modifier?.value.kind==='constant');
  if(k){k.application.modifier.value.amount+=1;expect(()=>restoreMatch(serializeMatch(edit))).toThrow();tampered++;}
 }
 expect(checked).toBeGreaterThan(0);expect(tampered).toBeGreaterThan(0);
},120000);
