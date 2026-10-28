import { previewCombine, previewEquip } from '../src/simulation/item-selectors';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { Room } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { readLootView, equipItem, selectChoice, useConsumable, createMatch, startMatchCombat, stepMatch, deployMatchUnit, type MatchState } from '../src/simulation/match';
import { augmentOfferAllowed, augmentCandidates } from '../src/simulation/augment-offers';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { captureAugmentHistoryAuthority, recordAugmentAcquisition } from '../src/simulation/augment-history';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { accepted } from './match-helpers';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { angerItems, angerNumbers, validateAngerChoice } from './fixtures/m5/augment-r2-oracle.cjs';

it('B5-21 is prismatic, offered at 3-2/4-2, with independent pool agreement',()=>{
 expect(AUGMENT_TIERS['anger-issues']).toBe('prismatic');
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('anger-issues',[],{node,fieldedTraits:[],blocked:[]})).toBe(node!=='2-1');
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes('anger-issues')).toBe(node!=='2-1');
  expect(augmentCandidates('prismatic',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('anger-issues')).toBe(node!=='2-1');
 }
});

let restoreB1Offers:(()=>void)|undefined;
beforeAll(()=>{restoreB1Offers=installB1Offers(['anger-issues']);});
const clock=new ManualClock();
const room=new Room(Array.from({length:8},(_,i)=>({seatId:`s${i}`,name:`s${i}`,kind:'human' as const})),{
 roomId:'test-room',seed:0,clock,resolver:new TwoSidedBattleResolver(),preparationMs:1000,choiceMs:500,settlementMs:200,battleTailMs:100,maxSettlementExtensions:2,
});
const mine=()=>room.state.seats.find(s=>s.seatId==='s1')!.match;
/** Same legal first-offer/claim route as the bounded seed finder; never changes room state directly. */
function arrive(roundId:string):void {
 for(let n=0;n<2000;n++){
  if(room.state.roundId===roundId&&(roundId.endsWith('-4')||room.state.phase==='preparation'))return;
  if(room.state.phase==='preparation')for(const seat of room.state.seats)for(let pick=0;pick<5;pick++){
   const m=room.state.seats.find(s=>s.seatId===seat.seatId)!.match,c=m.pendingChoice;
   if(c){expect(room.handle(seat.seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]})).toMatchObject({ok:true});continue;}
   const orb=readLootView(m).unclaimedOrbs?.find(o=>!o.queued);if(!orb)break;
   const result=room.handle(seat.seatId,{type:'claimOrb',round:m.round,orbId:orb.orbId});if(!result.ok&&result.reason==='bench-full')break;expect(result).toMatchObject({ok:true});
  }
  if(!clock.runNext())break;
 }
 throw Error(`did not reach ${roundId}: ${room.state.roundId}/${room.state.phase} ${JSON.stringify(room.state.fault)}`);
}
it('starts the online B5-21 route',()=>{room.start();});
for(const round of ['1-3','1-4','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2'])it(`B5-21 online reaches ${round}`,()=>{arrive(round);});
afterAll(()=>{restoreB1Offers?.();restoreB1Offers=undefined;room.dispose();});
let selected:MatchState,beforeChoice:MatchState,beforeChoicePool:(typeof room.state)['pool'];
it('B5-21 converts existing inventory/equipment through the real room choice, then converts future combinations',()=>{
 const before=mine(),c=before.pendingChoice!;
 // installB1Offers scripts only the 3-2 draw; offers.toContain is a fixture self-check, not a real-RNG claim.
 expect(c.offers).toContain('anger-issues');
 const components=before.items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId].kind==='component'&&!['spatula','frying-pan'].includes(i.definitionId));
 expect(components.length).toBeGreaterThanOrEqual(2);
 expect(room.handle('s1',{type:'combine',a:components[0].id,b:components[1].id})).toMatchObject({ok:true});
 const raw=mine();expect(raw.items.some(i=>ITEM_DEFINITIONS[i.definitionId].kind==='completed')).toBe(true);
 const id=raw.items.find(i=>ITEM_DEFINITIONS[i.definitionId].kind==='completed')!.id;
 const unit=raw.preparation.units.find(u=>u.team==='player')!;
 expect(room.handle('s1',{type:'equip',itemId:id,unitId:unit.id,slot:0})).toMatchObject({ok:true});
 const worn=mine();beforeChoice=worn;beforeChoicePool=room.state.pool;
 expect(room.handle('s1',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'anger-issues'})).toMatchObject({ok:true});
 expect(mine().items).toEqual(angerItems(worn.items));
 validateAngerChoice(worn,mine(),{type:'select',definitionId:'anger-issues'});
 const wrong=structuredClone(mine());(wrong.items[0] as {definitionId:string}).definitionId='unknown';expect(()=>validateAngerChoice(worn,wrong,{type:'select',definitionId:'anger-issues'})).toThrow();
 expect(mine().temporaryEquipment).toEqual([]);
 const retry=room.handle('s1',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'anger-issues'});expect(retry.ok).toBe(false);
 const rest=mine().items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId].kind==='component'&&!['spatula','frying-pan'].includes(i.definitionId));
 expect(rest.length).toBeGreaterThanOrEqual(2);
 const serial=mine().nextItemSerial;
 expect(room.handle('s1',{type:'combine',a:rest[0].id,b:rest[1].id})).toMatchObject({ok:true});
 expect(mine().items.find(i=>i.id===`item-${serial}`)?.definitionId).toBe('rageblade');
 selected=mine();expect(room.state.fault).toBeNull();
});
it('B5-21 online object/JSON round trips and rejects item, conversion, history and combat input tampering',()=>{
 const authority=room.augmentHistoryAuthority('s1');
 for(const input of [selected,JSON.stringify(selected)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(selected);
 const attacks=[(x:any)=>{x.items.find((i:any)=>i.definitionId==='rageblade').definitionId='deathblade';},
  (x:any)=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='anger-item-converted').from='bow';},
  (x:any)=>{x.resourceProvenance.entries=x.resourceProvenance.entries.filter((e:any)=>e.kind!=='anger-item-converted');},
  (x:any)=>{delete x.augmentHistory;},(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='acquire').roster.items=[];}];
 for(const mutate of attacks){const bad=structuredClone(selected);mutate(bad);for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();}
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,selected)).toThrow(/authority/);
});
it('B5-21 converts an existing Thief glove, revokes its children and preserves authenticated old rolls',()=>{
 let state=beforeChoice;const holder=state.items.find(i=>i.location.kind==='unit')!;expect(holder.location.kind).toBe('unit');if(holder.location.kind!=='unit')throw Error('missing holder');
 const unitId=holder.location.unitId,tool=state.consumables.find(c=>c.definitionId==='magnetic-remover')!;expect(tool).toBeDefined();
 state=accepted(useConsumable(state,tool.consumableId,{kind:'unit',unitId}));
 const grant=grantMechanicItem(state,{receiptId:'r2-old-gloves',source:'r2-vector',definitionId:'thiefs-gloves'});expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);state=grant.state;
 const id=state.items.at(-1)!.id;state=accepted(equipItem(state,id,unitId,0));
 expect(state.temporaryEquipment).toHaveLength(2);const rolls=state.equipmentState.rolls;
 const choice=state.pendingChoice!;state=accepted(selectChoice(state,choice.choiceId,choice.generation,'anger-issues'));
 expect(state.items.find(i=>i.id===id)?.definitionId).toBe('rageblade');expect(state.temporaryEquipment).toEqual([]);expect(state.equipmentState.rolls).toEqual(rolls);
 for(const input of [state,JSON.stringify(state)])expect(restoreSharedOrbSnapshot(beforeChoicePool,input,captureAugmentHistoryAuthority(state))).toEqual(state);
});
it('B5-21 an in-place gloves recipe converts before exclusive-slot checks and round trips',()=>{
 let state=mine();const holder=state.items.find(i=>i.location.kind==='unit'&&i.definitionId==='rageblade')!;expect(holder.location.kind).toBe('unit');
 if(holder.location.kind!=='unit')throw Error('missing worn item');const unitId=holder.location.unitId;
 const slot=[0,1,2].find(slot=>!state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===unitId&&i.location.slot===slot))!;expect(slot).toBeDefined();
 const ids:string[]=[];
 for(let n=0;n<2;n++){const grant=grantMechanicItem(state,{receiptId:`r2-gloves:${n}`,source:'r2-vector',definitionId:'gloves'});expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);state=grant.state;ids.push(state.items.at(-1)!.id);}
 expect(previewCombine(state,ids[0],ids[1])).toMatchObject({allowed:true,resultDefinitionId:'rageblade'});
 state=accepted(equipItem(state,ids[0],unitId,slot));const serial=state.nextItemSerial,rng=state.equipmentState;
 expect(previewEquip(state,ids[1],unitId,slot)).toMatchObject({allowed:true,combination:{resultDefinitionId:'rageblade'}});
 state=accepted(equipItem(state,ids[1],unitId,slot));
 expect(state.items.find(i=>i.id===`item-${serial}`)).toEqual({id:`item-${serial}`,definitionId:'rageblade',location:{kind:'unit',unitId,slot}});
 expect(state.equipmentState).toEqual(rng);expect(state.temporaryEquipment).toEqual([]);
 for(const input of [state,JSON.stringify(state)])expect(restoreSharedOrbSnapshot(room.state.pool,input,captureAugmentHistoryAuthority(state))).toEqual(state);
});
it('B5-21 actual online combat uses converted equipment and its settled save authenticates',()=>{
 for(let n=0;n<2000&&!(room.state.roundId==='3-2'&&room.state.phase==='settlement');n++){expect(clock.runNext()).toBe(true);}
 expect(room.state.phase).toBe('settlement');expect(room.state.fault).toBeNull();
 const result=room.state.battles.find(b=>b.kind==='two-sided'&&b.participants.includes('s1'))!;expect(result).toBeDefined();
 if(result.kind!=='two-sided')throw Error('missing actual battle');
 const owned=new Set(result.battle.mapping.filter(m=>m.kind==='unit'&&m.seatId==='s1').map(m=>m.combatId));
 const fighter=result.battle.terminal.units.find(u=>owned.has(u.id)&&u.sources?.some(s=>s.source.sourceKind==='item'&&s.source.sourceDefinitionId==='rageblade'))!;
 expect(fighter).toBeDefined();expect(fighter.sources!.some(s=>s.effect.kind==='statFlat'&&s.effect.stat==='armor'&&s.effect.amount===45)).toBe(true);
 expect(fighter.triggerLedger!.runtimes.some(r=>Object.hasOwn(r.counters,'anger-attacks'))).toBe(true);
 const state=mine();for(const input of [state,JSON.stringify(state)])expect(restoreSharedOrbSnapshot(room.state.pool,input,room.augmentHistoryAuthority('s1'))).toEqual(state);
});
it('B5-21 preserves special items, two copies stack independently, odd attacks carry, and solo does not error',()=>{
 let s=createMatch(1);
 const unit=s.preparation.units.find(u=>u.team==='player')!;
 s=accepted(deployMatchUnit(s,unit.id,{kind:'board',cell:{col:1,row:4}}));
 for(const definitionId of ['rageblade','rageblade','TFT5_Item_GuinsoosRagebladeRadiant']){
  const r=grantMechanicItem(s,{receiptId:`vector:${s.nextItemSerial}`,source:'vector',definitionId});expect(r.ok).toBe(true);if(!r.ok)throw Error(r.reason);s=r.state;
 }
 for(const [slot,item]of s.items.entries())s=accepted(equipItem(s,item.id,unit.id,slot));
 const baseline=buildStrategySnapshot(s).units.find(u=>u.unitId===unit.id)!;
 s=recordAugmentAcquisition(s,{...s,augments:[{definitionId:'anger-issues',choiceId:'vector',acquiredRound:1}]});
 const buffed=buildStrategySnapshot(s).units.find(u=>u.unitId===unit.id)!;
 expect(buffed.stats.armor-baseline.stats.armor).toBe(90);expect(buffed.stats.magicResist-baseline.stats.magicResist).toBe(90);
 // Full public combat creates the independent item counters; no hand-written runtimes.
 let combat=createCombatWithEvents(s.preparation,buildStrategySnapshot(s),'r2-combat',1).state;let attacks=0;
 for(let tick=0;tick<250&&combat.status==='running'&&attacks<3;tick++){
  const step=stepCombat(combat);attacks+=step.events.filter(e=>e.type==='attack'&&e.attackerId===unit.id).length;combat=step.state;
 }
 if(combat.status==='running')combat=stepCombat(combat).state;
 const fighter=combat.units.find(u=>u.id===unit.id)!;
 expect(fighter.alive).toBe(true);
 s=accepted(startMatchCombat(createMatch(1)));s=stepMatch(s).state;
 const counters=fighter.triggerLedger!.runtimes.filter(r=>Object.hasOwn(r.counters,'anger-attacks'));
 expect(attacks).toBeGreaterThanOrEqual(2);
 expect(counters).toHaveLength(2);
 for(const counter of counters){expect(counter.counters['anger-attacks']).toBe(attacks);expect(counter.triggerCount).toBe(Math.floor(attacks/2));}
 expect(angerNumbers(1,2).attackDamageBps).toBe(0);expect(angerNumbers(2,2).attackDamageBps).toBe(200);
 expect(fighter.itemPrograms?.filter(p=>p.source.definitionId==='rageblade')).toHaveLength(2);
 const contributions=fighter.mechanismState!.statuses.flatMap(g=>g.contributions).filter(c=>c.source.definitionId==='rageblade');
 const amount=(stat:'attackDamage'|'abilityPower')=>contributions.reduce((sum,c)=>{const m=c.application.modifier;return sum+(m?.stat===stat&&m.value.kind==='constant'?m.value.amount:0);},0);
 expect(amount('attackDamage')).toBe(angerNumbers(attacks,2).attackDamageBps);
 expect(amount('abilityPower')).toBe(angerNumbers(attacks,2).abilityPower-20);
 expect(fighter.triggerLedger).toBeDefined();expect(s.phase).toBeDefined();
});
