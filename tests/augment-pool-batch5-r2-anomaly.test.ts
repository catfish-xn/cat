import { afterAll, expect, it } from 'vitest';
import { Room } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { readLootView, equipItem, createMatch, useConsumable, deployMatchUnit, type MatchState } from '../src/simulation/match';
import { augmentOfferAllowed, augmentCandidates } from '../src/simulation/augment-offers';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { PORTABLE_ANOMALY_ITEMS } from '../src/simulation/content/augment-pool-batch5-r2-items';
import { portableAnomalyId, PORTABLE_ANOMALY_PREFIX } from '../src/simulation/content/augment-pool-batch5-r2';
import { anomalyCandidates } from '../src/simulation/content/anomalies';
import { grantMechanicItem, grantMechanicConsumable, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { r2AnomalyAllowed } from '../src/simulation/augment-pool-batch5-r2-anomaly';
import { readCombatStrategyInputs } from '../src/simulation/combat-input';
import { prepareBattleEquipment, installBattleEquipmentBatch } from '../src/simulation/battle-equipment';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { accepted } from './match-helpers';
import { toPublicBoard } from '../src/server/room/projection';
import * as oracle from './fixtures/m5/oracle.g2.cjs';
import { validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { excluded, portableGrant } from './fixtures/m5/augment-r2-oracle.cjs';

it('B5-81 is gold and offered only at 4-2; all six excluded definitions are absent from copying and reroll candidates',()=>{
 expect(AUGMENT_TIERS['another-anomaly']).toBe('gold');
 const owner=[{definitionId:'another-anomaly',choiceId:'vector',acquiredRound:1}];
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('another-anomaly',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='4-2');
  expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes('another-anomaly')).toBe(node==='4-2');
  expect(augmentCandidates('gold',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('another-anomaly')).toBe(node==='4-2');
 }
 for(const id of excluded){expect(r2AnomalyAllowed(owner,id)).toBe(false);expect(PORTABLE_ANOMALY_ITEMS[PORTABLE_ANOMALY_PREFIX+id]).toBeUndefined();}
 expect(anomalyCandidates(true).filter(id=>r2AnomalyAllowed(owner,id))).not.toContain('dual-wielding');
});
const clock=new ManualClock();
const room=new Room(Array.from({length:8},(_,i)=>({seatId:`s${i}`,name:`s${i}`,kind:'human' as const})),{
 roomId:'test-room',seed:112,clock,resolver:new TwoSidedBattleResolver(),preparationMs:1000,choiceMs:500,settlementMs:200,battleTailMs:100,maxSettlementExtensions:2,
});
// v26 D5 pool (7953c99a): room seed 112 (was 21, whose s4 4-2 offer no longer has another-anomaly).
// s4 is offered it at 4-2 for seeds 18, 32, 48, 97 and 112 in 0..159; 112 has the lightest per-round
// load (14.24 neutrals made the 2-7 PvE round the heaviest), keeping each round within the default timeout.
const mine=()=>room.state.seats.find(s=>s.seatId==='s4')!.match;
function arrive(roundId:string):void {
 for(let n=0;n<2000;n++){
  if(room.state.roundId===roundId&&(roundId.endsWith('-4')||roundId==='4-6'&&room.state.phase==='choice'||room.state.phase==='preparation'))return;
  if(room.state.phase==='preparation')for(const seat of room.state.seats)for(let pick=0;pick<5;pick++){
   const m=room.state.seats.find(s=>s.seatId===seat.seatId)!.match,c=m.pendingChoice;
   if(c){
    if(c.kind==='anomaly'&&c.step==='target'){
     const unit=m.preparation.units.find(u=>u.team==='player'&&!u.definitionId.startsWith('TFT_ArmoryKey'))!;expect(unit).toBeDefined();
     expect(room.handle(seat.seatId,{type:'anomalyTarget',choiceId:c.choiceId,generation:c.generation,unitId:unit.id})).toMatchObject({ok:true});
    }else expect(room.handle(seat.seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]})).toMatchObject({ok:true});
    continue;
   }
   const orb=readLootView(m).unclaimedOrbs?.find(o=>!o.queued);if(!orb)break;
   const result=room.handle(seat.seatId,{type:'claimOrb',round:m.round,orbId:orb.orbId});if(!result.ok&&result.reason==='bench-full')break;expect(result).toMatchObject({ok:true});
  }
  if(!clock.runNext())break;
 }
 throw Error(`did not reach ${roundId}: ${room.state.roundId}/${room.state.phase} ${JSON.stringify(room.state.fault)}`);
}
afterAll(()=>room.dispose());
it('starts the real B5-81 room',()=>{room.start();});
for(const round of ['1-3','1-4','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2','3-3','3-4','3-5','3-6','3-7','4-1','4-2'])it(`B5-81 online reaches ${round}`,()=>{arrive(round);});
it('B5-81 is selected in the real room without an early item and its pre-anomaly save authenticates',()=>{
 const c=mine().pendingChoice!;expect(c.offers).toContain('another-anomaly');
 expect(room.handle('s4',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'another-anomaly'})).toMatchObject({ok:true});
 expect(mine().items.some(i=>portableAnomalyId(i.definitionId)!==null)).toBe(false);
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(mine()),room.augmentHistoryAuthority('s4'))).toEqual(mine());
 // Play this seat after acquisition so the 4-6 delivery test retains a living participant.
 for(let generation=0;generation<3;generation++){
  for(let buys=0;buys<5;buys++){
   const m=mine(),slot=m.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId&&!o.definitionId.startsWith('TFT_')&&m.gold>45);
   if(slot<0)break;
   const r=room.handle('s4',{type:'buy',slot,generation:m.shop.generation});if(!r.ok&&r.reason==='bench-full')break;expect(r).toMatchObject({ok:true});
  }
  if(mine().gold<=47)break;
  expect(room.handle('s4',{type:'reroll'})).toMatchObject({ok:true});
 }
 const components=mine().items.filter(i=>i.location.kind==='inventory'&&['sword','bow','rod','tear','vest','cloak','belt','gloves'].includes(i.definitionId));
 for(let i=0;i+1<components.length;i+=2)expect(room.handle('s4',{type:'combine',a:components[i].id,b:components[i+1].id})).toMatchObject({ok:true});
 const fighters=mine().preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');
 let holder=0;
 for(const item of mine().items.filter(i=>i.location.kind==='inventory'&&!i.definitionId.startsWith('TFT13_Item_'))){
  if(!fighters.length)break;
  for(let attempt=0;attempt<fighters.length;attempt++){const target=fighters[(holder+attempt)%fighters.length];const slot=[0,1,2].find(slot=>!mine().items.some(i=>i.location.kind==='unit'&&i.location.unitId===target.id&&i.location.slot===slot));if(slot===undefined)continue;
   const r=room.handle('s4',{type:'equip',itemId:item.id,unitId:target.id,slot});if(r.ok){holder++;break;}
  }
 }
});
for(const round of ['4-3','4-4','4-5','4-6'])it(`B5-81 online reaches ${round}`,()=>{arrive(round);});
let itemId:string,copyUnit:string,chosen:string;
it('B5-81 filters actual rerolls, grants the copy immediately and rejects replayed choice/original equipment',()=>{
 let c=mine().pendingChoice!;expect(c,JSON.stringify({hp:mine().playerHp,status:mine().multiplayer?.status,units:mine().preparation.units.length})).not.toBeNull();expect(c.kind).toBe('anomaly');expect(c.step).toBe('target');
 const original=mine().preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;expect(original).toBeDefined();
 expect(room.handle('s4',{type:'anomalyTarget',choiceId:c.choiceId,generation:c.generation,unitId:original.id})).toMatchObject({ok:true});
 // A real reroll is validated even when the preferred simple-stat anomaly is already present.
 c=mine().pendingChoice!;expect(room.handle('s4',{type:'anomalyReroll',choiceId:c.choiceId,generation:c.generation})).toMatchObject({ok:true});
 for(let n=0;n<100;n++){
  c=mine().pendingChoice!;expect(c.offers.every(id=>!excluded.includes(id))).toBe(true);
  if(c.offers.includes('bulwark'))break;
  expect(room.handle('s4',{type:'anomalyReroll',choiceId:c.choiceId,generation:c.generation})).toMatchObject({ok:true});
 }
 c=mine().pendingChoice!;expect(c.offers).toContain('bulwark');chosen='bulwark';
 const before=mine(),expected=portableGrant(before,{type:'select',definitionId:chosen});
 const result=room.handle('s4',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:chosen});expect(result).toMatchObject({ok:true});
 if(!result.ok)throw Error(result.reason);
 validateRewards(before,result.state,{type:'select',choiceId:c.choiceId,generation:c.generation,definitionId:chosen},result.events,oracle);
 const wrong=structuredClone(result.state) as any;wrong.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-r2').definitionId='forged';
 expect(()=>validateRewards(before,wrong,{type:'select',choiceId:c.choiceId,generation:c.generation,definitionId:chosen},result.events,oracle)).toThrow();
 expect(mine().roundDefinitionId).toBe('4-6');expect(mine().phase).toBe('preparation');
 expect(mine().seatMechanics!.receipts.find(r=>r.source==='augment-pool-batch5-r2')).toEqual(expected);
 itemId=expected!.itemId;
 expect(mine().items.find(i=>i.id===itemId)).toEqual({id:itemId,definitionId:PORTABLE_ANOMALY_PREFIX+chosen,location:{kind:'inventory'}});
 const beforeRetry=mine();expect(room.handle('s4',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:chosen}).ok).toBe(false);expect(mine()).toBe(beforeRetry);
 const failed=room.handle('s4',{type:'equip',itemId,unitId:original.id,slot:0});expect(failed).toMatchObject({ok:false,reason:'item-restricted'});expect(mine()).toBe(beforeRetry);
 const target=mine().preparation.units.find(u=>u.team==='player'&&u.definitionId!==original.definitionId&&u.location.kind==='board')!;expect(target).toBeDefined();copyUnit=target.id;
 const empty=[0,1,2].find(slot=>!mine().items.some(i=>i.location.kind==='unit'&&i.location.unitId===copyUnit&&i.location.slot===slot))!;expect(empty).toBeDefined();
 expect(room.handle('s4',{type:'equip',itemId,unitId:copyUnit,slot:empty})).toMatchObject({ok:true});
 const projected=buildStrategySnapshot(mine()).units.find(u=>u.unitId===copyUnit)!;
 expect(projected.sources.filter(s=>s.source.sourceKind==='anomaly'&&s.source.sourceDefinitionId===chosen).map(s=>s.effect)).toEqual([
  {kind:'statFlat',stat:'armor',amount:40},{kind:'statFlat',stat:'magicResist',amount:40},{kind:'mechanic',mechanic:'g23Anomaly',values:{enabled:1}},
 ]);
 expect(projected.sources.filter(s=>s.source.sourceDefinitionId===PORTABLE_ANOMALY_PREFIX+chosen).map(s=>s.effect)).toEqual([
  {kind:'statFlat',stat:'maxHp',amount:250},{kind:'statPercentBps',stat:'attackDamage',bps:2000},{kind:'statFlat',stat:'abilityPower',amount:25},
 ]);
});
it('B5-81 online save round trips and rejects forged definition, stats, source, missing history and original holder',()=>{
 const s=mine(),authority=room.augmentHistoryAuthority('s4');
 for(const input of [s,JSON.stringify(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);
 const mutations=[(x:any)=>{x.items.find((i:any)=>i.id===itemId).definitionId=PORTABLE_ANOMALY_PREFIX+'giant-sized';},
  (x:any)=>{x.items.find((i:any)=>i.id===itemId).location.unitId=x.anomalyBinding.unitId;},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-r2').round++;},
  (x:any)=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch5-r2');},
  (x:any)=>{delete x.augmentHistory;},(x:any)=>{x.anomalyBinding.definitionId='dual-wielding';},
  (x:any)=>{x.anomalySelection=null;},(x:any)=>{x.anomalySelection.championDefinitionId='forged';},
  (x:any)=>{x.anomalyBinding.unitId=copyUnit;}];
 for(const mutate of mutations){const bad=structuredClone(s);mutate(bad);for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();}
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,s)).toThrow(/authority/);
});
it('B5-81 removes the copied effect and all item stats through the real room magnetic remover',()=>{
 const tool=mine().consumables.find(c=>c.definitionId==='magnetic-remover');expect(tool).toBeDefined();
 expect(room.handle('s4',{type:'useConsumable',consumableId:tool!.consumableId,target:{kind:'unit',unitId:copyUnit}})).toMatchObject({ok:true});
 expect(mine().items.find(i=>i.id===itemId)?.location).toEqual({kind:'inventory'});
 expect(buildStrategySnapshot(mine()).units.find(u=>u.unitId===copyUnit)!.sources.filter(s=>s.source.sourceKind==='anomaly')).toEqual([]);
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(mine()),room.augmentHistoryAuthority('s4'))).toEqual(mine());
});

it('R5 real shared-pool sale/rebuy retains native identity, public projection and portable original ban without a second grant',()=>{
 const original=mine().anomalyBinding!,hero=mine().anomalySelection!.championDefinitionId;
 const receipts=mine().seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5-r2');
 for(const u of mine().preparation.units.filter(u=>u.team==='player'&&u.definitionId===hero))
  expect(room.handle('s4',{type:'sell',unitId:u.id})).toMatchObject({ok:true});
 expect(mine().anomalyBinding).toBeNull();
 expect(mine().anomalySelection).toMatchObject({definitionId:chosen,championDefinitionId:hero,choiceId:original.choiceId});
 expect(toPublicBoard(mine()).units.some(u=>u.anomaly===chosen)).toBe(false);
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(mine()),room.augmentHistoryAuthority('s4'))).toEqual(mine());
 for(let n=0;n<100&&!mine().shop.slots.some(o=>o.status==='available'&&o.definitionId===hero);n++)
  expect(room.handle('s4',{type:'reroll'})).toMatchObject({ok:true});
 const slot=mine().shop.slots.findIndex(o=>o.status==='available'&&o.definitionId===hero);expect(slot).toBeGreaterThanOrEqual(0);
 expect(room.handle('s4',{type:'buy',slot,generation:mine().shop.generation})).toMatchObject({ok:true});
 const native=mine().anomalyBinding!;expect(native).toMatchObject({definitionId:chosen,choiceId:original.choiceId});
 const board=toPublicBoard(mine());expect([...board.units,...board.bench??[]].filter(u=>u.anomaly===chosen).map(u=>u.definitionId)).toEqual([hero]);
 expect(room.handle('s4',{type:'equip',itemId,unitId:native.unitId,slot:0})).toMatchObject({ok:false,reason:'item-restricted'});
 expect(mine().seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5-r2')).toEqual(receipts);
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(mine()),room.augmentHistoryAuthority('s4'))).toEqual(mine());
});

it('B5-81 executes the copied effect in the actual online battle and restores its settled state',()=>{
 const slot=[0,1,2].find(slot=>!mine().items.some(i=>i.location.kind==='unit'&&i.location.unitId===copyUnit&&i.location.slot===slot))!;
 expect(room.handle('s4',{type:'equip',itemId,unitId:copyUnit,slot})).toMatchObject({ok:true});
 for(let n=0;n<2000&&!(room.state.roundId==='4-6'&&room.state.phase==='settlement');n++){expect(clock.runNext()).toBe(true);}
 expect(room.state.phase).toBe('settlement');expect(room.state.fault).toBeNull();
 const result=room.state.battles.find(b=>b.kind==='two-sided'&&b.participants.includes('s4'))!;expect(result).toBeDefined();
 if(result.kind!=='two-sided')throw Error('missing actual battle');
 const mapped=result.battle.mapping.find(m=>m.kind==='unit'&&m.seatId==='s4'&&m.originalId===copyUnit)!;
 const fighter=result.battle.terminal.units.find(u=>u.id===mapped.combatId)!;expect(fighter).toBeDefined();
 expect(fighter.mechanics!.some(m=>m.mechanic==='g23Anomaly'&&m.source.definitionId===chosen&&!!m.source.parentItemInstanceId)).toBe(true);
 const state=mine();for(const input of [state,JSON.stringify(state)])expect(restoreSharedOrbSnapshot(room.state.pool,input,room.augmentHistoryAuthority('s4'))).toEqual(state);
});

function vectorBase():{state:MatchState;unitId:string;originalId:string} {
 let state:MatchState={...createMatch(1),level:2,xp:0};const originalId=state.preparation.units.find(u=>u.team==='player')!.id;
 const added=grantMechanicUnit(state,{receiptId:'vector:unit',source:'vector',definitionId:'darius',immediate:true});expect(added.ok).toBe(true);if(!added.ok)throw Error(added.reason);state=added.state;
 const unitId=state.preparation.units.find(u=>u.team==='player'&&u.id!==originalId)!.id;
 state=accepted(deployMatchUnit(state,originalId,{kind:'board',cell:{col:1,row:4}}));
 state=accepted(deployMatchUnit(state,unitId,{kind:'board',cell:{col:3,row:4}}));
 return {state,unitId,originalId};
}
const vector=vectorBase();
it.each(Object.keys(PORTABLE_ANOMALY_ITEMS))('copies supported definition %s with fresh runtime and revokes it on a real remover command',definitionId=>{
 const id=portableAnomalyId(definitionId)!;expect(excluded).not.toContain(id);expect(anomalyCandidates(true)).toContain(id);
 const grant=grantMechanicItem(vector.state,{receiptId:`vector:${id}`,source:'vector',definitionId});expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);
 const item=grant.state.items.at(-1)!;
 let s=accepted(equipItem(grant.state,item.id,vector.unitId,0));
 const inputs=readCombatStrategyInputs(s),snapshot=buildStrategySnapshot(inputs),compiled=snapshot.units.find(u=>u.unitId===vector.unitId)!;
 expect(compiled.sources.some(source=>source.source.sourceKind==='anomaly'&&source.source.sourceDefinitionId===id&&source.source.parentItemInstanceId===item.id)).toBe(true);
 const initial=createCombatWithEvents(s.preparation,snapshot,'copy-vector',1).state;
 const fighter=initial.units.find(u=>u.id===vector.unitId)!;
 if(id==='headhunter'){expect(fighter.d11Kills).toEqual([]);expect(fighter.mechanics!.find(m=>m.mechanic==='d11Anomaly')!.values.priorKills).toBe(0);}
 const stepped=stepCombat(initial).state;expect(stepped.tick).toBeGreaterThanOrEqual(initial.tick);
 const tool=grantMechanicConsumable(s,{receiptId:`vector:remove:${id}`,source:'vector',definitionId:'magnetic-remover'});expect(tool.ok).toBe(true);if(!tool.ok)throw Error(tool.reason);s=tool.state;
 s=accepted(useConsumable(s,s.consumables.at(-1)!.consumableId,{kind:'unit',unitId:vector.unitId}));
 expect(s.items.find(i=>i.id===item.id)?.location).toEqual({kind:'inventory'});
 expect(buildStrategySnapshot(s).units.find(u=>u.unitId===vector.unitId)!.sources.some(source=>source.source.sourceKind==='anomaly')).toBe(false);
});
it('does not import original Headhunter accumulated kills, counter arrays, or original program identities',()=>{
 const id=PORTABLE_ANOMALY_PREFIX+'headhunter';
 const grant=grantMechanicItem(vector.state,{receiptId:'vector:headhunter',source:'vector',definitionId:id});expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);
 const s=accepted(equipItem(grant.state,grant.state.items.at(-1)!.id,vector.unitId,0)),inputs=readCombatStrategyInputs(s);
 const state={...inputs,anomalyBinding:{definitionId:'headhunter',choiceId:'original',unitId:vector.originalId,boundRound:1},
  g23:{...inputs.g23!,economyReceipts:[{kind:'battle',facts:{round:1,d11Headhunter:{kills:Array.from({length:11},(_,eventSeq)=>({eventSeq,victimId:`enemy-${eventSeq}`}))}}}]} } as unknown as typeof inputs;
 const snapshot=buildStrategySnapshot(state);
 const original=snapshot.units.find(u=>u.unitId===vector.originalId)!,copy=snapshot.units.find(u=>u.unitId===vector.unitId)!;
 expect(original.mechanics!.find(m=>m.mechanic==='d11Anomaly')!.values.priorKills).toBe(11);
 expect(copy.mechanics!.find(m=>m.mechanic==='d11Anomaly')!.values.priorKills).toBe(0);
 const initial=createCombatWithEvents(s.preparation,snapshot,'fresh-copy',1).state;
 const a=initial.units.find(u=>u.id===vector.originalId)!,b=initial.units.find(u=>u.id===vector.unitId)!;
 expect(a.d11Kills).toEqual([]);expect(b.d11Kills).toEqual([]);expect(a.d11Kills).not.toBe(b.d11Kills);
});

it.each(['TFT13_GoopBuff_WolfFamiliars','TFT13_GoopBuff_DramaticEntrance','TFT13_GoopBuff_HungerForPower','fortified','protective-shielding','share-your-energy'])('starts %s exactly once when equipped during combat',id=>{
 const granted=grantMechanicItem(vector.state,{receiptId:'mid-battle:'+id,source:'vector',definitionId:PORTABLE_ANOMALY_PREFIX+id});expect(granted.ok).toBe(true);if(!granted.ok)throw Error(granted.reason);
 const sourceState=id==='share-your-energy'?accepted(deployMatchUnit(granted.state,vector.unitId,{kind:'board',cell:{col:2,row:4}})):granted.state;
 const before=readCombatStrategyInputs(sourceState),item=sourceState.items.at(-1)!;
 let combat=createCombatWithEvents(sourceState.preparation,buildStrategySnapshot(before),'mid-copy',1).state;
 combat=stepCombat(combat).state;expect(combat.status).toBe('running');
 const equipped=accepted(equipItem(sourceState,item.id,vector.unitId,0)),tick=combat.tick+1;
 const receipt=prepareBattleEquipment(before,{kind:'equipment',seq:1,effectiveTick:tick,seatId:'player',itemId:item.id,unitId:vector.unitId,slot:0},equipped,'player',1);
 combat=installBattleEquipmentBatch(combat,[receipt]);combat=stepCombat(combat).state;
 const unit=combat.units.find(u=>u.id===vector.unitId)!;
 if(id==='TFT13_GoopBuff_WolfFamiliars')expect(combat.units.filter(u=>u.anomalySummon?.ownerId===unit.id&&u.anomalySummon.kind==='wolf')).toHaveLength(2);
 if(id==='TFT13_GoopBuff_DramaticEntrance')expect(unit.anomalyState?.absentUntilTick).toBe(tick+120);
 if(id==='TFT13_GoopBuff_HungerForPower')expect(unit.anomalyState?.consumed?.unitId).toBe(vector.originalId);
 if(id==='fortified')expect(unit.mechanismState!.periodicTasks.some(t=>t.source.parentItemInstanceId===item.id)).toBe(true);
 if(id==='protective-shielding')expect(unit.shield).toBeGreaterThan(0);
 if(id==='share-your-energy')expect(combat.units.find(u=>u.id===vector.originalId)!.s13P2Opening?.shared).toContainEqual(expect.objectContaining({source:expect.objectContaining({parentItemInstanceId:item.id})}));
 expect(unit.pendingEquipmentSources).toBeUndefined();
 const again=stepCombat(combat).state;expect(again.units.filter(u=>u.anomalySummon?.ownerId===unit.id)).toHaveLength(combat.units.filter(u=>u.anomalySummon?.ownerId===unit.id).length);
});
