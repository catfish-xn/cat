import {expect,it} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildSync} from 'esbuild';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {createMatch,buyXp,deployMatchUnit,equipItem,useConsumable,selectChoice,nextRound,startMatchCombat,stepMatch,sellUnit,type MatchState} from '../src/simulation/match';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {createG23Progress} from '../src/simulation/g2-3-match-progress';
import {advanceG23Economy} from '../src/simulation/g2-3-economy';
import {g23BattlePayouts} from '../src/simulation/g2-3-settlement';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {drainG23Rewards} from '../src/simulation/g2-3-runtime';
import {M5_UNIT_DEFINITIONS} from '../src/simulation/units';
import {grantMechanicGold,grantMechanicItem,grantMechanicUnit,openMechanicChoice} from '../src/simulation/seat-mechanics';
import {accepted,naturalForgeStates,naturalTier4Preparation} from './fixtures/g24-natural-forge';
import {finishPublicEquipmentBattle} from './fixtures/b8-public-equipment';
import {CompletedBattleHistory} from './fixtures/completed-battle-history';
import {validateBattleCollection} from '../src/replay/history';
import {exportFile,validateFile} from '../src/persistence/format';
import {M8_VERSION} from '../src/simulation/m8/version';
import type {SaveEnvelope} from '../src/m6/contracts';
import {validateBattleFacts,matchHistoryChecks} from '../src/simulation/battle-record-validation';
import {validateB8Resources} from '../src/simulation/b8-restore';
import {validateG23Restoration} from '../src/simulation/g2-3-restore';
import {validateSeatMechanicsState} from '../src/simulation/seat-mechanics/state';
import {validateMechanicPendingChoice} from '../src/simulation/seat-mechanics/choices';

/** These historical forge/duplicator vectors contain generic grants and edited
 * settlement facts. Assert the public boundary separately, then exercise only
 * the actual reward/resource validators under test. This is not a save restore. */
function expectSyntheticBoundary(state: MatchState): void {
 for(const candidate of [state,JSON.stringify(state)])
  expect(()=>restoreMatch(candidate)).toThrow('preparation-ledger-command-rejected');
 expect(()=>serializeMatch(state)).toThrow('preparation-ledger-command-rejected');
}
function validateRewardDomain(input: MatchState | string): void {
 const state = (typeof input === 'string' ? JSON.parse(input) : structuredClone(input)) as MatchState;
 validateSeatMechanicsState(state.seatMechanics);
 if(state.pendingChoice?.kind==='forge')validateMechanicPendingChoice(state);
 validateG23Restoration(state);
 validateB8Resources(state,typeof input==='string');
}
function validateSyntheticRewardDomain(input: MatchState | string): void {
 expectSyntheticBoundary(typeof input==='string'?JSON.parse(input):input);
 validateRewardDomain(input);
}
function rewardDomainText(state: MatchState): string {
 validateSyntheticRewardDomain(state);
 return JSON.stringify(state);
}
function expectRewardDomainRejection(input: MatchState | string, reason?: string): void {
 const state = typeof input==='string'?JSON.parse(input) as MatchState:input;
 // Existing structural/resource refusals precede B and retain their original
 // reasons. Synthetic positive controls separately prove the B admission gate.
 for(const entry of [()=>restoreMatch(input),()=>serializeMatch(state),()=>validateRewardDomain(input)]) {
  if(reason)expect(entry).toThrow(reason);
  else expect(entry).toThrow();
 }
}

/** Advance supply/choice rounds through Match commands, stopping before a real battle. */
function nextDuplicatorPreparation(input:MatchState):MatchState{
 let state=input;
 for(let guard=0;guard<20;guard++){
  if(state.phase==='preparation')return state;
  if(state.phase==='choice'){
   const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));
  }else if(state.phase==='settlement')state=accepted(nextRound(state,state.round));
  else throw Error(`Unexpected duplicator fixture phase ${state.phase}`);
 }
 throw Error('Duplicator preparation budget');
}

let duplicatorArchive:SaveEnvelope|undefined;
/** Full live history: public grants build six Conquerors; a real tier4 chest grants the duplicator.
 * Seed26 also supplies a magnetic remover from its real 2-7 prismatic package. */
function publicDuplicatorArchive():{state:MatchState;history:CompletedBattleHistory;unitId:string}{
 if(!duplicatorArchive){
  let state=nextDuplicatorPreparation(createMatch(26));
  const history=new CompletedBattleHistory('pr161-duplicator');
  state=accepted(grantMechanicGold(state,{receiptId:'fixture:duplicator:gold',source:'fixture',amount:150}));
  while(state.level<6)state=accepted(buyXp(state));
  for(const unit of state.preparation.units.filter(u=>u.team==='player'))
   state=accepted(deployMatchUnit(state,unit.id,{kind:'bench',slot:0}));
  for(const [col,definitionId] of ['darius','draven','rell','swain','ambessa','mordekaiser'].entries()){
   for(let copy=0;copy<9;copy++)state=accepted(grantMechanicUnit(state,{receiptId:`fixture:duplicator:${definitionId}:${copy}`,source:'fixture',definitionId}));
   const unit=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId&&u.starLevel===3)!;
   state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row:4}}));
  }
  for(let battles=0;battles<10;battles++){
   state=finishPublicEquipmentBattle(state,history);
   if(readG23Progress(state)!.rewardClaims.some(c=>c.kind==='duplicator'))break;
   state=nextDuplicatorPreparation(state);
  }
  expect(readG23Progress(state)!.rewardClaims.some(c=>c.kind==='duplicator')).toBe(true);
  duplicatorArchive={kind:'hex-autobattler-save',saveFormatVersion:M8_VERSION.saveFormatVersion,
   replayFormatVersion:M8_VERSION.replayFormatVersion,runId:history.runId,createdAt:'2026-10-17T00:00:00.000Z',
   match:state,battles:history.completedRecords,currentBattle:null};
 }
 const state=duplicatorArchive.match,claim=readG23Progress(state)!.rewardClaims.find(c=>c.kind==='duplicator')!;
 expect(M5_UNIT_DEFINITIONS[claim.definitionId]!.cost).toBeLessThanOrEqual(3);
 expect(state.preparation.units.find(u=>u.id===claim.instanceId)).toMatchObject({definitionId:claim.definitionId,starLevel:1});
 expect(state.seatMechanics!.receipts.find(r=>r.receiptId===claim.id)).toMatchObject({kind:'unit',resolution:'held',unitId:claim.instanceId});
 return {state,history:new CompletedBattleHistory(duplicatorArchive.runId,duplicatorArchive.battles),unitId:claim.instanceId!};
}

async function expectDuplicatorBoundaryAndDomainHistory(state:MatchState,history:CompletedBattleHistory):Promise<void>{
 expect(state.combat?.status).toBe('finished');
 const envelope:SaveEnvelope={...duplicatorArchive!,match:state,battles:history.completedRecords};
 expect(envelope.battles.map(b=>b.roundId)).toEqual(state.roundResults.filter(r=>r.result!=='supply').map(r=>r.roundId));
 expect(envelope.battles.every(b=>b.events.length>0&&b.result!==null)).toBe(true);
 // Artificial preparation grants are inadmissible at the full file boundary.
 await expect(validateFile(exportFile(envelope),validateBattleCollection)).rejects.toThrow('preparation-ledger-command-rejected');
 expectSyntheticBoundary(state);
 // Independently replay every actual record and retain the original complete
 // history checks. This validates the domain vector, not a resumable archive.
 const validateDomainHistory=(candidate:SaveEnvelope):void=>{
  validateRewardDomain(candidate.match);
  for(const _ of matchHistoryChecks(candidate.match,candidate.battles,candidate.runId,record=>{
   validateRewardDomain(record.context);
   return validateBattleFacts(record,record.context);
  })){ /* consume all production history checks */ }
 };
 validateDomainHistory(envelope);
 const detached=JSON.parse(JSON.stringify(envelope)) as SaveEnvelope;
 validateDomainHistory(detached);
 expect(detached.battles).toEqual(envelope.battles);
 const copiesFromDomain=[structuredClone(state),detached.match,JSON.parse(JSON.stringify(state)) as MatchState];
 for(const candidate of copiesFromDomain)expect(candidate).toEqual(state);
 let original=nextDuplicatorPreparation(state);
 let copies=copiesFromDomain.map(nextDuplicatorPreparation);
 const started=startMatchCombat(original);original=accepted(started);
 copies=copies.map(copy=>{const result=startMatchCombat(copy);expect(result).toEqual(started);return accepted(result);});
 expect(original.phase).toBe('combat');
 let ticks=0;
 while(original.phase==='combat'&&ticks++<1200){
  const result=stepMatch(original);original=result.state;
  copies=copies.map(copy=>{const step=stepMatch(copy);expect(step).toEqual(result);return step.state;});
 }
 expect(ticks).toBeGreaterThan(0);
 expect(original.combat?.status).toBe('finished');
 for(const copy of copies)expect(copy).toEqual(original);
}

it('rejects the synthetic duplicator archive while validating full domain history and identical next-battle ticks',async()=>{
 let {state,history,unitId}=publicDuplicatorArchive();
 state=nextDuplicatorPreparation(state);
 // Put the copied hero into the battle, swapping out the original front-line holder.
 state=accepted(deployMatchUnit(state,unitId,{kind:'board',cell:{col:3,row:4}}));
 state=finishPublicEquipmentBattle(state,history);
 expect(state.combat!.units.some(u=>u.id===unitId)).toBe(true);
 await expectDuplicatorBoundaryAndDomainHistory(state,history);
});

it('rejects the synthetic equip/remove archive while validating copied-hero history and identical next-battle ticks',async()=>{
 let {state,history,unitId}=publicDuplicatorArchive();
 const claimRound=readG23Progress(state)!.rewardClaims.find(c=>c.kind==='duplicator')!.round;
 state=nextDuplicatorPreparation(state);
 state=accepted(deployMatchUnit(state,unitId,{kind:'board',cell:{col:3,row:4}}));
 // Reach the real 2-7 remover drop, retaining every intervening battle.
 while(state.round<=10){state=finishPublicEquipmentBattle(state,history);state=nextDuplicatorPreparation(state);}
 const granted=grantMechanicItem(state,{receiptId:'fixture:duplicator:equipment',source:'fixture',definitionId:'warmog'});
 state=accepted(granted);
 if(!granted.ok||granted.receipt.kind!=='item')throw Error('Missing public item grant');
 const itemId=granted.receipt.itemId;
 state=accepted(equipItem(state,itemId,unitId,0));
 expect(state.items.find(i=>i.id===itemId)!.location).toEqual({kind:'unit',unitId,slot:0});
 state=finishPublicEquipmentBattle(state,history);
 state=nextDuplicatorPreparation(state);
 const remover=state.consumables.find(c=>c.definitionId==='magnetic-remover');
 expect(remover).toBeDefined();
 state=accepted(useConsumable(state,remover!.consumableId,{kind:'unit',unitId}));
 expect(state.items.find(i=>i.id===itemId)!.location).toEqual({kind:'inventory'});
 state=finishPublicEquipmentBattle(state,history);
 expect(history.completedRecords.filter(b=>b.context.round>claimRound&&b.initial.units.some(u=>u.id===unitId)).length).toBeGreaterThanOrEqual(2);
 expect(state.preparation.units.some(u=>u.id===unitId)).toBe(true);
 await expectDuplicatorBoundaryAndDomainHistory(state,history);
});

let tier14:MatchState|undefined;
/** Historical receipt vector reaches 1172; the tier14 award itself comes from a real solo battle. */
function tier14Battle():MatchState{
 if(tier14)return tier14;
 const pending=naturalForgeStates().get(10)!,choice=pending.pendingChoice!;
 let state=accepted(selectChoice(pending,choice.choiceId,choice.generation,choice.offers[0]));
 const original=readG23Progress(state)!;let replay=createG23Progress(state.seed);
 for(const receipt of original.economyReceipts){
  if(receipt.kind!=='battle')throw Error('Unexpected fixture market');
  const facts=receipt.facts.round===state.round?{...receipt.facts,conquerorTier:9,conquestTakedowns:Array.from({length:28},(_,i)=>`vector-enemy-${i}`)}:receipt.facts;
  replay=advanceG23Economy(replay,facts).progress;
 }
 state=writeG23Progress(state,{...original,...replay});
 const last=replay.economyReceipts.at(-1)!;
 if(last.kind!=='battle')throw Error('Expected final battle');
 for(const payout of g23BattlePayouts(last.facts,replay.conquest.chestsOpened,original.conquest.chestsOpened))state=accepted(grantMechanicGold(state,payout));
 state=accepted(nextRound(state,state.round));
 expect([state.roundDefinitionId,readG23Progress(state)!.conquest.stacks,readG23Progress(state)!.conquest.chestsOpened]).toEqual(['5-3',1172,13]);
 while(state.phase==='choice'){
  const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));
 }
 const domainText=rewardDomainText(state);
 validateSyntheticRewardDomain(domainText);
 expect(JSON.parse(domainText)).toEqual(state);
 state=accepted(startMatchCombat(state));
 for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
 expect([state.roundDefinitionId,readG23Progress(state)!.conquest.stacks,readG23Progress(state)!.conquest.chestsOpened]).toEqual(['5-3',1214,14]);
 expect(state.pendingChoice?.choiceId).toBe('g23:conqueror:14:atom:1:copy:0');
 tier14=state;return state;
}

function settlementCases():MatchState[]{
 const pending=tier14Battle(),c=pending.pendingChoice!;
 return [naturalForgeStates().get(4)!,pending,accepted(selectChoice(pending,c.choiceId,c.generation,c.offers[0]))];
}

/** Keep the earlier chest awards, but move the historical receipt vector to 99
 * stacks so two high-cost Conquerors can earn tier4 in a real solo battle. */
function tier4WithoutOwnedTarget(fullBench=false):MatchState{
 let state=naturalTier4Preparation();
 const original=readG23Progress(state)!;let replay=createG23Progress(state.seed);
 for(const receipt of original.economyReceipts){
  if(receipt.kind!=='battle')throw Error('Unexpected fixture market');
  const facts=receipt===original.economyReceipts.at(-1)?{...receipt.facts,conquerorTier:4,
   conquestTakedowns:Array.from({length:(99-replay.conquest.stacks)/3},(_,i)=>`vector-enemy-${i}`)}:receipt.facts;
  replay=advanceG23Economy(replay,facts).progress;
 }
 expect(replay.conquest.stacks).toBe(99);
 expect(replay.rewards).toEqual(original.rewards);
 state=writeG23Progress(state,{...original,...replay});
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&M5_UNIT_DEFINITIONS[u.definitionId]!.cost<=3))
  state=accepted(sellUnit(state,unit.id));
 if(fullBench){
  const free=state.preparation.benchSize-state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length;
  const fillers=Object.values(M5_UNIT_DEFINITIONS).filter(u=>u.cost>3&&!state.preparation.units.some(owned=>owned.team==='player'&&owned.definitionId===u.id)).slice(0,free);
  for(const [index,{id:definitionId}] of fillers.entries())
   state=accepted(grantMechanicUnit(state,{receiptId:`fixture:high-cost-bench:${index}`,source:'fixture',definitionId}));
  expect(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')).toHaveLength(state.preparation.benchSize);
 }
 expect(state.preparation.units.some(u=>u.team==='player'&&M5_UNIT_DEFINITIONS[u.definitionId]!.cost<=3)).toBe(false);
 state=accepted(startMatchCombat(state));
 for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
 expect(state.phase).toBe('settlement');
 expect(state.combat?.status).toBe('finished');
 expect(readG23Progress(state)!.conquest.chestsOpened).toBe(4);
 expect(readG23Progress(state)!.rewards.find(b=>b.tier===4)!.round).toBe(state.round);
 return state;
}

function expectUnchangedRewardDomain(state:MatchState):void{
 const before=JSON.stringify(state),progress=readG23Progress(state),pendingChoice=state.pendingChoice;
 const save=rewardDomainText(state);
 for(const input of [state,JSON.parse(save),save]){
  validateSyntheticRewardDomain(input);
  const restored=typeof input==='string'?JSON.parse(input):structuredClone(input);
  expect(restored).toEqual(state);
  expect(readG23Progress(restored)).toEqual(progress);
  expect(restored.pendingChoice).toEqual(pendingChoice);
 }
 expect(JSON.stringify(state)).toBe(before);
}

it('rejects synthetic saves but validates the award-round duplicator copying the hero just granted by the same tier4 chest',()=>{
 const state=tier4WithoutOwnedTarget(),progress=readG23Progress(state)!;
 const claims=progress.rewardClaims.filter(c=>c.bundleId==='g23:conqueror:4');
 expect(claims.map(c=>c.kind)).toEqual(['unit','duplicator']);
 expect(claims[1].definitionId).toBe(claims[0].definitionId);
 expect(claims.map(c=>c.round)).toEqual([state.round,state.round]);
 expect(state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===claims[0].definitionId)).toHaveLength(2);
 expect(state.pendingChoice).toBeNull();
 expectUnchangedRewardDomain(state);
},60000);

it('rejects synthetic saves but validates the award-round duplicator in escrow when no eligible hero is owned',()=>{
 const state=tier4WithoutOwnedTarget(true),progress=readG23Progress(state)!;
 const bundle=progress.rewards.find(b=>b.tier===4)!;
 expect(g23RewardAtoms(bundle,progress.seed).map(a=>a.kind)).toEqual(['unit','duplicator']);
 expect(progress.rewardClaims.filter(c=>c.bundleId===bundle.id)).toEqual([]);
 expect(state.preparation.units.some(u=>u.team==='player'&&M5_UNIT_DEFINITIONS[u.definitionId]!.cost<=3)).toBe(false);
 expect(state.pendingChoice).toBeNull();
 expect(drainG23Rewards(state)).toEqual(state);
 expectUnchangedRewardDomain(state);
},60000);

it('rejects synthetic saves but validates automatic heroes/duplicator at tier4 and radiant item at tier14, pending and selected, on the award round',()=>{
 const states=settlementCases(),four=states[0];
 expect([four.round,four.roundDefinitionId,readG23Progress(four)!.conquest.stacks]).toEqual([6,'2-3',108]);
 expect(four.combat?.status).toBe('finished');
 expect(four.seatMechanics!.receipts.filter(r=>r.receiptId.startsWith('g23:conqueror:4:'))).toEqual([
  expect.objectContaining({kind:'unit',resolution:'held'}),expect.objectContaining({kind:'unit',resolution:'held'}),
 ]);
 // multiplayer G2-4a restored the tier-12 crown, which takes item-16 before tier 14.
 expect(states[1].seatMechanics!.receipts.find(r=>r.receiptId==='g23:conqueror:12:atom:0:copy:0')).toMatchObject({kind:'item',itemId:'item-16',definitionId:'TFT_Item_ForceOfNature'});
 expect(states[1].seatMechanics!.receipts.find(r=>r.receiptId==='g23:conqueror:14:atom:0:copy:0')).toMatchObject({
  kind:'item',itemId:'item-17',definitionId:'TFT5_Item_ArchangelsStaffRadiant',
 });
 for(const state of states){
  const before=JSON.stringify(state),save=rewardDomainText(state);
  validateSyntheticRewardDomain(state);
  validateSyntheticRewardDomain(JSON.parse(save));
  expect(JSON.parse(save)).toEqual(state);
  validateSyntheticRewardDomain(save);
  expect(JSON.stringify(state)).toBe(before);
 }
},60000);

it('rejects a duplicator receipt and matching hero forged to an unowned option at tier4',()=>{
 const state=naturalForgeStates().get(4)!;
 expectSyntheticBoundary(state);
 expect([state.seed,state.round,state.roundDefinitionId]).toEqual([42,6,'2-3']);
 const receiptId='g23:conqueror:4:atom:1:copy:0';
 const receipt=state.seatMechanics!.receipts.find(r=>r.receiptId===receiptId);
 expect(receipt).toMatchObject({kind:'unit',definitionId:'swain',unitId:'unit-63'});
 expect(state.preparation.units.some(u=>u.definitionId==='zeri')).toBe(false);
 const progress=readG23Progress(state)!,bundle=progress.rewards.find(b=>b.id==='g23:conqueror:4')!;
 const atom=g23RewardAtoms(bundle,state.seed).find(a=>a.kind==='duplicator')!;
 expect(atom.options).toContain('zeri');
 const bad=structuredClone(state);
 Object.assign(bad.seatMechanics!.receipts.find(r=>r.receiptId===receiptId)!,{definitionId:'zeri'});
 Object.assign(bad.preparation.units.find(u=>u.id==='unit-63')!,{definitionId:'zeri'});
 expectRewardDomainRejection(bad, 'mechanic duplicator target');
 expectRewardDomainRejection(bad, 'mechanic duplicator target');
 expectRewardDomainRejection(JSON.stringify(bad), 'mechanic duplicator target');
},60000);

it('replays automatic unit upgrades atomically and rejects an edited upgrade transaction',()=>{
 const receipt=naturalForgeStates().get(4)!.seatMechanics!.receipts.find(r=>r.receiptId==='g23:conqueror:4:atom:0:copy:0');
 if(receipt?.kind!=='unit')throw Error('Expected tier4 hero');
 let state=naturalTier4Preparation();
 for(let copy=0;copy<2;copy++)state=accepted(grantMechanicUnit(state,{receiptId:`fixture:upgrade:${copy}`,source:'fixture',definitionId:receipt.definitionId}));
 state=accepted(startMatchCombat(state));
 for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
 const upgrade=state.resourceProvenance.entries.find(f=>f.sequence>=state.combatInputBasis!.provenancePrefixLength&&f.kind==='unit-upgraded');
 expect(upgrade).toBeDefined();
 validateSyntheticRewardDomain(state);
 const domainText=rewardDomainText(state);
 validateSyntheticRewardDomain(domainText);
 expect(JSON.parse(domainText)).toEqual(state);
 const bad=structuredClone(state);
 Object.assign(bad.resourceProvenance.entries[upgrade!.sequence],{acquisitionSequence:0});
 expectRewardDomainRejection(bad);
 expectRewardDomainRejection(JSON.stringify(bad));
},60000);

it('rejects edited automatic birth serials, receipt/ledger order, rounds and definitions',()=>{
 for(const state of settlementCases()){
  const prefix=state.combatInputBasis!.provenancePrefixLength;
  const births=state.resourceProvenance.entries.filter(f=>f.sequence>=prefix&&(f.kind==='unit-acquired'||f.kind==='item-acquired')&&f.source.kind==='mechanic');
  expect(births.length).toBeGreaterThan(0);
  for(const birth of births){
   const bad=structuredClone(state),fact=bad.resourceProvenance.entries[birth.sequence];
   if(fact.kind==='unit-acquired')Object.assign(fact,{unitId:'unit-9999'});
   else if(fact.kind==='item-acquired')Object.assign(fact,{itemId:'item-9999'});
   for(const input of [bad,JSON.stringify(bad)])expectRewardDomainRejection(input);
   expectRewardDomainRejection(bad);
  }
  const first=births[0];
  if((first.kind!=='unit-acquired'&&first.kind!=='item-acquired')||first.source.kind!=='mechanic')throw Error('Expected mechanic birth');
  const receiptId=first.source.receiptId;
  const receiptIndex=state.seatMechanics!.receipts.findIndex(r=>r.receiptId===receiptId);
  for(const mutation of ['order','definition','round','ledger'] as const){
   const bad=structuredClone(state),receipts=[...bad.seatMechanics!.receipts],entries=[...bad.resourceProvenance.entries];
   if(mutation==='order'){
    const other=receipts.findIndex((r,i)=>i>receiptIndex&&(r.kind==='unit'||r.kind==='item'||r.kind==='choice'&&r.itemId!==null));
    // Tier14 pending has only one birth: move its receipt across the combat boundary instead.
    const target=other<0?state.combatInputBasis!.mechanicReceiptPrefixLength-1:other;
    [receipts[receiptIndex],receipts[target]]=[receipts[target],receipts[receiptIndex]];
   }else if(mutation==='definition')Object.assign(receipts[receiptIndex],{definitionId:receipts[receiptIndex].kind==='unit'?'vex':'warmog'});
   else if(mutation==='round')Object.assign(entries[births[0].sequence],{roundId:'2-2'});
   else{
    const index=births[0].sequence;
    [entries[index-1],entries[index]]=[entries[index],entries[index-1]];
    entries.forEach((fact,sequence)=>{entries[sequence]={...fact,sequence};});
   }
   const forged={...bad,seatMechanics:{...bad.seatMechanics!,receipts},resourceProvenance:{...bad.resourceProvenance,entries}};
   expectRewardDomainRejection(forged);
   expectRewardDomainRejection(JSON.stringify(forged));
   expectRewardDomainRejection(forged);
  }
 }
},60000);

it('the synthetic seed42 army opens tier10 at 5-2/654 stacks and validates the selected artifact domain while its synthetic save is rejected',()=>{
 const state=naturalForgeStates().get(10)!,choice=state.pendingChoice!;
 expect([state.round,state.roundDefinitionId,readG23Progress(state)!.conquest.stacks]).toEqual([26,'5-2',654]);
 const picked=accepted(selectChoice(state,choice.choiceId,choice.generation,'TFT_Item_Artifact_SeekersArmguard'));
 expect(picked.phase).toBe('settlement');
 validateSyntheticRewardDomain(picked);
 const save=rewardDomainText(picked);
 validateSyntheticRewardDomain(JSON.parse(save));
 expect(JSON.parse(save)).toEqual(picked);
 validateSyntheticRewardDomain(save);
 const receipt=picked.seatMechanics!.receipts.find(r=>r.receiptId===choice.choiceId)!;
 expect(receipt).toMatchObject({kind:'choice',itemId:`item-${state.nextItemSerial}`,optionId:'TFT_Item_Artifact_SeekersArmguard'});
 // Serial and provenance order remain authenticated, not just the final inventory.
 const birth=picked.resourceProvenance.entries.at(-1)!;
 expect(birth).toMatchObject({kind:'item-acquired',itemId:`item-${state.nextItemSerial}`,source:{kind:'mechanic',receiptId:choice.choiceId}});
 for(const patch of [{itemId:'item-9999'},{sequence:birth.sequence-1},{source:{kind:'mechanic' as const,receiptId:'missing-choice'}}]){
  expectRewardDomainRejection({...picked,resourceProvenance:{...picked.resourceProvenance,entries:[...picked.resourceProvenance.entries.slice(0,-1),{...birth,...patch}]}});
 }
 const second=accepted(openMechanicChoice(picked,{choiceId:'fixture:second-forge',offers:choice.offers,returnPhase:'settlement',payload:{kind:'forge',source:'fixture',timeoutOption:choice.offers[0]}}));
 const twice=accepted(selectChoice(second,'fixture:second-forge',0,choice.offers[0]));
 const twiceText=rewardDomainText(twice);
 validateSyntheticRewardDomain(twiceText);
 expect(JSON.parse(twiceText)).toEqual(twice);
 const receipts=[...twice.seatMechanics!.receipts],firstIndex=receipts.findIndex(r=>r.receiptId===choice.choiceId),secondIndex=receipts.findIndex(r=>r.receiptId==='fixture:second-forge');
 [receipts[firstIndex],receipts[secondIndex]]=[receipts[secondIndex],receipts[firstIndex]];
 expectRewardDomainRejection({...twice,seatMechanics:{...twice.seatMechanics!,receipts}}, 'mechanic birth order');
},60000);

it('cold Node processes reject synthetic saves and validate tier4/10/14 reward domains with the same claims and pending choice',()=>{
 const directory=mkdtempSync(join(tmpdir(),'g24-cold-'));
 try{
  const entry=join(directory,'restore.mjs');
  buildSync({stdin:{contents:`import {readFileSync,writeFileSync} from 'node:fs';
   import {restoreMatch} from './src/simulation/serialization';
   import {validateB8Resources} from './src/simulation/b8-restore';
   import {validateG23Restoration} from './src/simulation/g2-3-restore';
   import {validateSeatMechanicsState} from './src/simulation/seat-mechanics/state';
   import {validateMechanicPendingChoice} from './src/simulation/seat-mechanics/choices';
   import {throws} from 'node:assert';
   import {readG23Progress} from './src/simulation/g2-3-state';
   const text=readFileSync(process.argv[2],'utf8');
   const input=process.argv[4]==='object'?JSON.parse(text):text;
   throws(()=>restoreMatch(input),/preparation-ledger-command-rejected/);
   const state=JSON.parse(text);
   validateSeatMechanicsState(state.seatMechanics);
   if(state.pendingChoice?.kind==='forge')validateMechanicPendingChoice(state);
   validateG23Restoration(state);
   validateB8Resources(state,process.argv[4]!=='object');
   writeFileSync(process.argv[3],JSON.stringify({state,progress:readG23Progress(state),choice:state.pendingChoice}));`,resolveDir:resolve('.')},bundle:true,platform:'node',format:'esm',outfile:entry});
  for(const tier of [4,10,14]){
   const initial=tier===14?tier14Battle():naturalForgeStates().get(tier)!;
   const states=tier===4?[initial]:[initial,accepted(selectChoice(initial,initial.pendingChoice!.choiceId,0,tier===10?'TFT_Item_Artifact_SeekersArmguard':initial.pendingChoice!.offers[0]))];
   for(const [index,state] of states.entries()){
    const save=join(directory,`tier${tier}-${index}.json`);
    writeFileSync(save,rewardDomainText(state));
    for(const mode of ['text','object']){
     const output=join(directory,`tier${tier}-${index}-${mode}-restored.json`);
     const child=spawnSync(process.execPath,[entry,save,output,mode],{encoding:'utf8',timeout:30000});
     expect(child.error).toBeUndefined();
     expect(child.status,child.stderr).toBe(0);
     const result=JSON.parse(readFileSync(output,'utf8'));
     expect(result.state).toEqual(state);
     expect(result.progress).toEqual(readG23Progress(state));
     expect(result.choice).toEqual(state.pendingChoice);
    }
   }
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
},60000);

it('rejects an edited forge ID prefix and ordinary completed candidates while source remains conqueror',()=>{
 const state=naturalForgeStates().get(10)!,choice=state.pendingChoice!;
 expectSyntheticBoundary(state);
 const choiceId='fixture:disguised-forge';
 for(const replacement of [
  {...choice,choiceId,eventId:choiceId},
  {...choice,choiceId,eventId:choiceId,offers:['warmog','infinity-edge','bloodthirster','last-whisper'],payload:{...choice.payload!,timeoutOption:'warmog'}},
 ]){
  const forged={...state,pendingChoice:replacement};
  expectRewardDomainRejection(forged, 'G23 pending choice authority');
  expectRewardDomainRejection(JSON.stringify(forged), 'G23 pending choice authority');
 }
},60000);
