import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUGMENT_BATCH4_B4REROLL } from '../src/simulation/content/augment-pool-batch4-b4reroll';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { batch4RerollsGranted, batch4RerollEntryGold } from '../src/simulation/augment-pool-batch4-b4reroll-progress';
import { freeRerollsAvailable, FREE_REROLL_KEY } from '../src/simulation/free-rerolls';
import { createMatch, buyUnit, sellUnit, lockMatchCombatRoster, nextRound, rerollAugment, rerollShop, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, fieldBench, reachRound, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';

const ids=Object.keys(AUGMENT_BATCH4_B4REROLL) as (keyof typeof AUGMENT_BATCH4_B4REROLL)[];
const source=(existsSync(RESEARCH_FILE)?JSON.parse(readFileSync(RESEARCH_FILE,'utf8')):[]);
it.skipIf(!existsSync(RESEARCH_FILE)).each(ids)('%s registers exactly the 14.24 values and only its allowed offering node',id=>{
 const row=AUGMENT_BATCH4_B4REROLL[id],r=source.find((r:any)=>r.apiName===row.apiName);
 expect(row.source.values).toEqual(r.effects);expect(AUGMENT_TIERS[id]).toBe(['silver','gold','prismatic'][r.tier-1]);
 expect(AUGMENT_DEFINITIONS[id]).toBeDefined();
 for(const node of ['2-1','3-2','4-2']){
  const allowed=(row.nodes as readonly string[]).includes(node);
  expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(allowed);
  expect(augmentCandidates(row.tier,[],[],null,{node,fieldedTraits:[],blocked:[]}).includes(id)).toBe(allowed);
 }
});
function advance(s:MatchState,fielded=false):MatchState {
 s=resolveM5Choices(s);s=accepted(startMatchCombat(fielded?fieldBench(s):emptyBoard(s)));while(s.phase==='combat')s=stepMatch(s).state;s=resolveM5Choices(s);
 return accepted(nextRound(s,s.round));
}
function select(s:MatchState,id:string):MatchState {for(let slot=0;slot<3&&!s.pendingChoice!.offers.includes(id);slot++){const c=s.pendingChoice!;s=accepted(rerollAugment(s,c.choiceId,c.generation,slot));}const c=s.pendingChoice!;expect(c.offers).toContain(id);return resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,id)));}
function roundTripAndTamper(s:MatchState){
 const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(structuredClone(s))).toEqual(s);
 const mutations=[(x:any)=>{x.scheduleReceipts.find((r:any)=>r.definitionId===s.augments.at(-1)!.definitionId).gold++;},(x:any)=>{x.seatMechanics.seat[FREE_REROLL_KEY].used++;},(x:any)=>{delete x.seatMechanics.seat[FREE_REROLL_KEY];},(x:any)=>{const e=x.resourceProvenance.entries.find((e:any)=>e.kind==='free-reroll');e.generation=x.shop.generation;}];
 for(const mutate of mutations){const x=JSON.parse(text);mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();}
}
it('Patience uses successful shop purchases only, including purchases later sold, and carries credits',()=>{
 const seed=firstNodeSeed('patience-is-a-virtue');let s=select(reachRound('2-1',false,seed),'patience-is-a-virtue');
 expect(batch4RerollsGranted(s)).toBe(0);s=advance(s);expect(batch4RerollsGranted(s)).toBe(2);
 const before=s;s=accepted(rerollShop(s));expect(s.gold).toBe(before.gold);expect(freeRerollsAvailable(s)).toBe(1);roundTripAndTamper(s);
 s=accepted(rerollShop(s));expect(freeRerollsAvailable(s)).toBe(0);const paidFrom=s;s=accepted(rerollShop(s));expect(s.gold).toBe(paidFrom.gold-2);
 const failed=buyUnit(s,0,s.shop.generation-1);expect(failed.ok).toBe(false);expect(failed.state).toBe(s);
 const slot=s.shop.slots.findIndex(x=>x.status==='available'),serial=s.nextUnitSerial;s=accepted(buyUnit(s,slot,s.shop.generation));s=accepted(sellUnit(s,'unit-'+serial));
 s=advance(s);expect(batch4RerollsGranted(s)).toBe(2);s=advance(s);expect(batch4RerollsGranted(s)).toBe(4);
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
});
it('Patience records a successful online purchase after the PvP combat roster is locked',()=>{
 let s=select(reachRound('2-1',false,firstNodeSeed('patience-is-a-virtue')),'patience-is-a-virtue');
 const enabled=enableMultiplayerSettlement(s,'test-seat');expect(enabled.ok).toBe(true);if(!enabled.ok)throw Error(enabled.reason);s=accepted(lockMatchCombatRoster(enabled.state));
 expect(s.multiplayer?.combatRosterLocked).toBe(true);
 const slot=s.shop.slots.findIndex(x=>x.status==='available'),generation=s.shop.generation;s=accepted(buyUnit(s,slot,generation));
 expect(s.resourceProvenance.entries).toContainEqual(expect.objectContaining({kind:'unit-acquired',roundId:'2-1',source:expect.objectContaining({kind:'shop',generation,slotIndex:slot})}));
 expect(batch4RerollsGranted({...s,round:s.round+1})).toBe(0);
 // Online Matches intentionally cannot enter the offline save format. Each card's offline round trip is tested separately.
 expect(()=>serializeMatch(s)).toThrow('multiplayer-state');
});
it.each(['invested-plus','invested-plus-plus'] as const)('%s clamps each prior settled entry bank at 50/80 and floors each ten gold',id=>{
 const base=createMatch(42),a={definitionId:id,choiceId:'test',acquiredRound:1};
 for(const [gold,credit] of [[0,0],[49,0],[50,0],[59,0],[60,1],[69,1],[70,2],[79,2],[80,3],[81,3],[200,3]]){
  const s={...base,round:2,augments:[a],roundResults:[{round:1,roundId:'1-1',goldAfter:gold,mechanicReceiptPrefixLength:0}]} as unknown as MatchState;
  expect(batch4RerollEntryGold(s,2)).toBe(gold);expect(batch4RerollsGranted(s)).toBe(credit);
 }
});
it('entry bank includes only post-settlement gold, conversions, choice costs and capacity sales',()=>{
 const base=createMatch(42),s={...base,round:2,roundResults:[{round:1,roundId:'1-1',goldAfter:55,mechanicReceiptPrefixLength:1}],
  seatMechanics:{version:'g2-3-seat-mechanics-v1',seat:{},hidden:{},receipts:[{kind:'gold',round:1,amount:1000},{kind:'gold',round:1,amount:5},{kind:'unit',round:1,gold:8},{kind:'choice',round:1,price:3},{kind:'gold',round:2,amount:1000}]},
  resourceProvenance:{...base.resourceProvenance,entries:[{kind:'unit-sold',roundId:'1-1',context:'settlement-capacity',goldGranted:4},{kind:'unit-sold',roundId:'1-1',context:'preparation',goldGranted:1000}]} } as unknown as MatchState;
 expect(batch4RerollEntryGold(s,2)).toBe(69);
 expect(()=>batch4RerollEntryGold(s,3)).toThrow('Missing batch4 reroll entry history');
});
// Public stage routes are split into individual cases to retain Vitest's default timeout.
const routes=new Map<string,MatchState>();
const targets=[['invested-plus','3-2'],['invested-plus-plus','4-2']] as const;
// Seeds are discovered offline after pool expansion; no resource injection in these routes.
for(const [id,node] of targets){
 describe(id,()=>{
  it('initializes its public stage route',()=>{
   const seed=id==='invested-plus'?29:0; // first fielded-route seeds offering the card (including the three public rerolls) on the 235-card merged pool
   routes.set(id,createMatch(seed));
  });
  for(const stop of ['1-2','1-3','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2',...(node==='4-2'?['3-3','3-4','3-5','3-6','3-7','4-1','4-2']:[])])it(`public route ${stop}`,()=>{
   let s=routes.get(id)!;
   while(s.roundDefinitionId!==stop){s=resolveM5Choices(s);if(s.phase==='preparation'){s=accepted(startMatchCombat(fieldBench(s)));while(s.phase==='combat')s=stepMatch(s).state;}s=resolveM5Choices(s);s=accepted(nextRound(s,s.round));}
   routes.set(id,s);
  });
  it('pays acquisition gold once and grants spendable next-entry credits; all restore entries reject tampering',()=>{
   const open=routes.get(id)!,gold=open.gold;let s=select(open,id);
   expect(s.gold-gold).toBe(id==='invested-plus'?26:45);expect(batch4RerollsGranted(s)).toBe(0);
   const c=open.pendingChoice!,repeated=selectChoice(s,c.choiceId,c.generation,id);expect(repeated.ok).toBe(false);expect(repeated.state).toBe(s);expect(s.scheduleReceipts.filter(r=>r.definitionId===id)).toHaveLength(1);
   s=advance(s,true);const expected=Math.floor(Math.max(0,Math.min(batch4RerollEntryGold(s,s.round),80)-50)/10);
   expect(expected).toBeGreaterThan(0);expect(batch4RerollsGranted(s)).toBe(expected);expect(batch4RerollsGranted({...s,gold:0})).toBe(expected);
   const before=s;s=accepted(rerollShop(s));expect(s.gold).toBe(before.gold);roundTripAndTamper(s);
  });
 });
}

it.each(['invested-plus','invested-plus-plus'])('%s accumulates the source-line 55/60/79/140 entry example from settled history only',definitionId=>{
 const base=createMatch(42),state={...base,round:5,augments:[{definitionId,choiceId:'source-port',acquiredRound:1}],
  roundResults:[55,60,79,140].map((goldAfter,i)=>({round:i+1,roundId:['1-1','1-2','1-3','2-1'][i],goldAfter,mechanicReceiptPrefixLength:0}))} as unknown as MatchState;
 expect(batch4RerollsGranted(state)).toBe(6);
 expect(batch4RerollsGranted({...state,gold:9999})).toBe(6);
 expect(()=>batch4RerollsGranted({...state,roundResults:state.roundResults.slice(0,-1)})).toThrow('Missing batch4 reroll entry history');
});
