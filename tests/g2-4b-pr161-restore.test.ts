import { isSellableUnit } from '../src/simulation/seat-mechanics/forms';
import {expect,it} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
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
import {accepted,naturalForgeStates,naturalTier4Preparation,openConquerorAnvil,NATURAL_FORGE_SEED} from './fixtures/g24-natural-forge';
import {anvilChoiceId} from '../src/simulation/anvils';
import {isAnvil} from '../src/simulation/content/anvils';
import {finishPublicEquipmentBattle} from './fixtures/b8-public-equipment';
import {CompletedBattleHistory} from './fixtures/completed-battle-history';
import {validateBattleCollection} from '../src/replay/history';
import {exportFile,validateFile} from '../src/persistence/format';
import {M8_VERSION} from '../src/simulation/m8/version';
import type {SaveEnvelope} from '../src/m6/contracts';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

/** Advance supply/choice rounds through Match commands, stopping before a real battle. */
function nextDuplicatorPreparation(input:MatchState):MatchState{
 let state=input;
 for(let guard=0;guard<20;guard++){
  if(state.phase==='preparation')return state;
  if(state.phase==='choice'){
   const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));
  }else if(state.phase==='settlement'){while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const extra:MatchState['preparation']['units'][number]=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&isSellableUnit(u.definitionId)&&!isAnvil(u.definitionId))!;state=accepted(sellUnit(state,extra.id));}state=accepted(nextRound(state,state.round));}
  else throw Error(`Unexpected duplicator fixture phase ${state.phase}`);
 }
 throw Error('Duplicator preparation budget');
}

let duplicatorArchive:SaveEnvelope|undefined;
/** Full live history: public grants build six Conquerors; a real tier4 chest grants the duplicator.
 * Seed26 also supplies a magnetic remover from its real 2-7 prismatic package. */
function publicDuplicatorArchive():{state:MatchState;history:CompletedBattleHistory;unitId:string}{
 if(!duplicatorArchive){
  let state=nextDuplicatorPreparation(createMatch(27566));
  const history=new CompletedBattleHistory('pr161-duplicator');
  state=accepted(grantMechanicGold(state,{receiptId:'fixture:duplicator:gold',source:'fixture',amount:150}));
  while(state.level<6)state=accepted(buyXp(state));
  // v23 fmix32: seed 27566 opens two component anvils on the bench. Open them (sell = openAnvil, first offer) so
  // they neither swap onto the board nor fill the bench that the real tier-4 duplicator needs.
  for(const unit of state.preparation.units.filter(u=>u.team==='player'&&isAnvil(u.definitionId)))
   state=nextDuplicatorPreparation(accepted(sellUnit(state,unit.id)));
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

async function expectFullDuplicatorSaveAndNextBattle(state:MatchState,history:CompletedBattleHistory):Promise<void>{
 expect(state.combat?.status).toBe('finished');
 const envelope:SaveEnvelope={...duplicatorArchive!,match:state,battles:history.completedRecords};
 expect(envelope.battles.map(b=>b.roundId)).toEqual(state.roundResults.filter(r=>r.result!=='supply').map(r=>r.roundId));
 expect(envelope.battles.every(b=>b.events.length>0&&b.result!==null)).toBe(true);
 // Export and validate the complete archive, retaining every battle and event.
 const loaded=await validateFile(exportFile(envelope),validateBattleCollection);
 expect(loaded.battles).toEqual(envelope.battles);
 const saved=serializeMatch(loaded.match);
 const restored=[restoreMatch(saved),restoreMatch(state),restoreMatch(JSON.stringify(state))];
 for(const candidate of restored)expect(candidate).toEqual(state);
 let original=nextDuplicatorPreparation(state);
 let copies=restored.map(nextDuplicatorPreparation);
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

it('restores a publicly granted hero duplicator after a completed battle with full history and identical next-battle ticks',async()=>{
 let {state,history,unitId}=publicDuplicatorArchive();
 state=nextDuplicatorPreparation(state);
 // Put the copied hero into the battle, swapping out the original front-line holder.
 state=accepted(deployMatchUnit(state,unitId,{kind:'board',cell:{col:3,row:4}}));
 state=finishPublicEquipmentBattle(state,history);
 expect(state.combat!.units.some(u=>u.id===unitId)).toBe(true);
 await expectFullDuplicatorSaveAndNextBattle(state,history);
});

it('restores the copied hero across battles and an equip/remove cycle with full history and identical next-battle ticks',async()=>{
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
 await expectFullDuplicatorSaveAndNextBattle(state,history);
},20_000);

let tier14:MatchState|undefined;
/** Historical receipt vector reaches 1188; the tier14 award itself comes from a real solo battle (5-5).
 * v22: batch-B crabs (scuttle-puddle) field five 4-7 crabs, so seed42 opens tier 10 one round later (5-3, see below);
 * the vector now rewrites the 5-3 receipt on top of 648 stacks, and 27 tier-9 takedowns (20 stacks each) keep it
 * below the tier-14 threshold (1200) so the next real battle (+42) still earns tier 14. */
function tier14Battle():MatchState{
 if(tier14)return tier14;
 const pending=naturalForgeStates().get(10)!,choice=pending.pendingChoice!;
 let state=accepted(selectChoice(pending,choice.choiceId,choice.generation,choice.offers[0]));
 const original=readG23Progress(state)!;let replay=createG23Progress(state.seed);
 for(const receipt of original.economyReceipts){
  if(receipt.kind!=='battle')throw Error('Unexpected fixture market');
  const facts=receipt.facts.round===state.round?{...receipt.facts,conquerorTier:9,conquestTakedowns:Array.from({length:27},(_,i)=>`vector-enemy-${i}`)}:receipt.facts;
  replay=advanceG23Economy(replay,facts).progress;
 }
 state=writeG23Progress(state,{...original,...replay});
 const last=replay.economyReceipts.at(-1)!;
 if(last.kind!=='battle')throw Error('Expected final battle');
 for(const payout of g23BattlePayouts(last.facts,replay.conquest.chestsOpened,original.conquest.chestsOpened))state=accepted(grantMechanicGold(state,payout));
 state=accepted(nextRound(state,state.round));
 expect([state.roundDefinitionId,readG23Progress(state)!.conquest.stacks,readG23Progress(state)!.conquest.chestsOpened]).toEqual(['5-4',1188,13]);
 // 5-4 is a supply round (its pick settles it; no mechanic choices/anvil openings); the next battle is 5-5.
 expect(state.pendingChoice?.payload).toBeUndefined();
 while(state.phase==='choice'){const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));}
 expect(state.phase).toBe('settlement');
 state=accepted(nextRound(state,state.round));
 expect([state.roundDefinitionId,state.phase]).toEqual(['5-5','preparation']);
 // v22 anvil units: the tier-11 support anvil waits in an orb; claim it, open it by selling and take the first offer
 // exactly as the old popup was resolved here.
 for(;;){
  if(state.phase==='choice'){const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));continue;}
  const opened=openConquerorAnvil(state);if(!opened)break;state=opened.state;
 }
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 state=accepted(startMatchCombat(state));
 for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
 expect([state.roundDefinitionId,readG23Progress(state)!.conquest.stacks,readG23Progress(state)!.conquest.chestsOpened]).toEqual(['5-5',1230,14]);
 // v22 anvil units: the tier-14 artifact forge is claimed as an anvil unit and opened by selling it (no popup).
 expect(state.pendingChoice).toBeNull();
 const opened=openConquerorAnvil(state)!;
 expect(opened.receiptId).toBe('g23:conqueror:14:atom:1:copy:0');
 state=opened.state;
 const anvilUnit=state.seatMechanics!.receipts.find(r=>r.receiptId===opened.receiptId);
 if(anvilUnit?.kind!=='unit')throw Error('Expected tier14 anvil unit');
 expect(state.pendingChoice?.choiceId).toBe(anvilChoiceId(anvilUnit.unitId!));
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
 // v23 batch 3: augment summons (dummies, golems) are not sellable champions.
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&Object.hasOwn(M5_UNIT_DEFINITIONS,u.definitionId)&&M5_UNIT_DEFINITIONS[u.definitionId]!.cost<=3&&isSellableUnit(u.definitionId)))
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

function expectUnchangedRoundTrip(state:MatchState):void{
 const before=JSON.stringify(state),progress=readG23Progress(state),pendingChoice=state.pendingChoice;
 const save=serializeMatch(state);
 for(const input of [state,JSON.parse(save),save]){
  const restored=restoreMatch(input);
  expect(restored).toEqual(state);
  expect(readG23Progress(restored)).toEqual(progress);
  expect(restored.pendingChoice).toEqual(pendingChoice);
 }
 expect(JSON.stringify(state)).toBe(before);
}

it('restores the award-round duplicator copying the hero just granted by the same tier4 chest',()=>{
 const state=tier4WithoutOwnedTarget(),progress=readG23Progress(state)!;
 const claims=progress.rewardClaims.filter(c=>c.bundleId==='g23:conqueror:4');
 expect(claims.map(c=>c.kind)).toEqual(['unit','duplicator']);
 expect(claims[1].definitionId).toBe(claims[0].definitionId);
 expect(claims.map(c=>c.round)).toEqual([state.round,state.round]);
 expect(state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===claims[0].definitionId)).toHaveLength(2);
 expect(state.pendingChoice).toBeNull();
 expectUnchangedRoundTrip(state);
},60000);

it('restores the award-round duplicator in escrow when no eligible hero is owned',()=>{
 const state=tier4WithoutOwnedTarget(true),progress=readG23Progress(state)!;
 const bundle=progress.rewards.find(b=>b.tier===4)!;
 expect(g23RewardAtoms(bundle,progress.seed).map(a=>a.kind)).toEqual(['unit','duplicator']);
 expect(progress.rewardClaims.filter(c=>c.bundleId===bundle.id)).toEqual([]);
 expect(state.preparation.units.some(u=>u.team==='player'&&M5_UNIT_DEFINITIONS[u.definitionId]!.cost<=3)).toBe(false);
 expect(state.pendingChoice).toBeNull();
 expect(drainG23Rewards(state)).toEqual(state);
 expectUnchangedRoundTrip(state);
},60000);

it('restores automatic heroes/duplicator at tier4 and radiant item at tier14, pending and selected, on the award round',()=>{
 const states=settlementCases(),four=states[0];
 expect([four.round,four.roundDefinitionId,readG23Progress(four)!.conquest.stacks]).toEqual([6,'2-3',108]);
 expect(four.combat?.status).toBe('finished');
 expect(four.seatMechanics!.receipts.filter(r=>r.receiptId.startsWith('g23:conqueror:4:'))).toEqual([
  expect.objectContaining({kind:'unit',resolution:'held'}),expect.objectContaining({kind:'unit',resolution:'held'}),
 ]);
 // multiplayer G2-4a restored the tier-12 crown; the tier-11 support anvil takes item-16 first, so the crown is item-17.
 // v22: four earlier item births precede it (2-1 Portable Forge from the gold 2-1 augment tier, the 4-2 augment item,
 // and scuttle-puddle's 2-7/3-7 component rewards), so the crown moves from item-20 to item-24.
 // v23 integration + batch-3/XP/global 14.24 stage bans merged: NATURAL_FORGE_SEED 20 now takes Sentinel Crest at 2-1
 // (its emblem is item-4), Menaces at 3-2 and Blinding Speed at 4-2 (three items, item-17..19), so the crown is item-27.
 expect(states[1].seatMechanics!.receipts.find(r=>r.receiptId==='g23:conqueror:12:atom:0:copy:0')).toMatchObject({kind:'item',itemId:'item-27',definitionId:'TFT_Item_ForceOfNature'});
 expect(states[1].seatMechanics!.receipts.find(r=>r.receiptId==='g23:conqueror:14:atom:0:copy:0')).toMatchObject({
  // The support trial grants four earlier items; birth must still use the exact frozen serial.
  // v23: seed 20's tier-14 radiant roll is Ionic Spark (seed 42/v22: Archangel's Staff).
  kind:'item',itemId:`item-${states[1].combatInputBasis!.nextItemSerial}`,definitionId:'TFT5_Item_IonicSparkRadiant',
 });
 for(const state of states){
  const before=JSON.stringify(state),save=serializeMatch(state);
  expect(restoreMatch(state)).toEqual(state);
  expect(restoreMatch(JSON.parse(save))).toEqual(state);
  expect(restoreMatch(save)).toEqual(state);
  expect(JSON.stringify(state)).toBe(before);
 }
},60000);

it('rejects a duplicator receipt and matching hero forged to an unowned option at tier4',()=>{
 const state=naturalForgeStates().get(4)!;
 // v23: the natural forge route moved from seed 42 to NATURAL_FORGE_SEED 20 (same scuttle-puddle opening).
 expect([state.seed,state.round,state.roundDefinitionId]).toEqual([NATURAL_FORGE_SEED,6,'2-3']);
 const receiptId='g23:conqueror:4:atom:1:copy:0';
 const receipt=state.seatMechanics!.receipts.find(r=>r.receiptId===receiptId);
 // v22 augment tier table: seed42's 2-1 node is gold, so the fixture takes Portable Forge instead of All For One I,
 // whose two filler heroes no longer take unit-66/67.
 // v23: seed 20's augments and duplicator roll give Irelia (seed 42/v22: Swain, unit-68); after the batch-3/XP merge the
 // 2-1 Sentinel Crest also grants a Rell (unit-62), so Irelia is unit-65 (was unit-64).
 expect(receipt).toMatchObject({kind:'unit',definitionId:'irelia',unitId:'unit-65'});
 expect(state.preparation.units.some(u=>u.definitionId==='zeri')).toBe(false);
 const progress=readG23Progress(state)!,bundle=progress.rewards.find(b=>b.id==='g23:conqueror:4')!;
 const atom=g23RewardAtoms(bundle,state.seed).find(a=>a.kind==='duplicator')!;
 expect(atom.options).toContain('zeri');
 const bad=structuredClone(state);
 Object.assign(bad.seatMechanics!.receipts.find(r=>r.receiptId===receiptId)!,{definitionId:'zeri'});
 Object.assign(bad.preparation.units.find(u=>u.id==='unit-64')!,{definitionId:'zeri'});
 expect(()=>serializeMatch(bad)).toThrow('mechanic duplicator target');
 expect(()=>restoreMatch(bad)).toThrow('mechanic duplicator target');
 expect(()=>restoreMatch(JSON.stringify(bad))).toThrow('mechanic duplicator target');
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
 expect(restoreMatch(state)).toEqual(state);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const bad=structuredClone(state);
 Object.assign(bad.resourceProvenance.entries[upgrade!.sequence],{acquisitionSequence:0});
 expect(()=>restoreMatch(bad)).toThrow();
 expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
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
   for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreMatch(input)).toThrow();
   expect(()=>serializeMatch(bad)).toThrow();
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
   expect(()=>restoreMatch(forged)).toThrow();
   expect(()=>restoreMatch(JSON.stringify(forged))).toThrow();
   expect(()=>serializeMatch(forged)).toThrow();
  }
 }
},60000);

// v23: NATURAL_FORGE_SEED (20) carries v22 seed 42's scuttle-puddle opening and trajectory.
it('the scuttle-puddle seed naturally opens tier10 at 5-3/690 stacks and round-trips the selected artifact in settlement',()=>{
 const state=naturalForgeStates().get(10)!,choice=state.pendingChoice!;
 // v22 batch-B crabs: seed42 rolls scuttle-puddle, whose 4-7 board has five crabs (the sixth carrier shares the
 // fifth crab's death), so 4-7 yields one fewer takedown and the 650-stack tier 10 is crossed at 5-3 (648+42).
 expect([state.round,state.roundDefinitionId,readG23Progress(state)!.conquest.stacks]).toEqual([27,'5-3',690]);
 // v22 anvil units: the fixture claimed the tier-10 anvil unit from its orb and opened it by selling it.
 expect(choice).toMatchObject({kind:'forge',payload:{kind:'forge',source:'anvil-unit',timeoutMs:30000,timeoutOption:choice.offers[0]}});
 // Pick a non-timeout offer; the 29-artifact pool (v11) changed the natural seed42 offers.
 const pick=choice.offers[1];
 const picked=accepted(selectChoice(state,choice.choiceId,choice.generation,pick));
 expect(picked.phase).toBe('settlement');
 expect(restoreMatch(picked)).toEqual(picked);
 const save=serializeMatch(picked);
 expect(restoreMatch(JSON.parse(save))).toEqual(picked);
 expect(restoreMatch(save)).toEqual(picked);
 const receipt=picked.seatMechanics!.receipts.find(r=>r.receiptId===choice.choiceId)!;
 expect(receipt).toMatchObject({kind:'choice',itemId:`item-${state.nextItemSerial}`,optionId:pick});
 // Serial and provenance order remain authenticated, not just the final inventory.
 const birth=picked.resourceProvenance.entries.at(-1)!;
 expect(birth).toMatchObject({kind:'item-acquired',itemId:`item-${state.nextItemSerial}`,source:{kind:'mechanic',receiptId:choice.choiceId}});
 for(const patch of [{itemId:'item-9999'},{sequence:birth.sequence-1},{source:{kind:'mechanic',receiptId:'missing-choice'}}]){
  expect(()=>restoreMatch({...picked,resourceProvenance:{...picked.resourceProvenance,entries:[...picked.resourceProvenance.entries.slice(0,-1),{...birth,...patch}]}})).toThrow();
 }
 const second=accepted(openMechanicChoice(picked,{choiceId:'fixture:second-forge',offers:choice.offers,returnPhase:'settlement',payload:{kind:'forge',source:'fixture',timeoutOption:choice.offers[0]}}));
 const twice=accepted(selectChoice(second,'fixture:second-forge',0,choice.offers[0]));
 expect(restoreMatch(serializeMatch(twice))).toEqual(twice);
 const receipts=[...twice.seatMechanics!.receipts],firstIndex=receipts.findIndex(r=>r.receiptId===choice.choiceId),secondIndex=receipts.findIndex(r=>r.receiptId==='fixture:second-forge');
 [receipts[firstIndex],receipts[secondIndex]]=[receipts[secondIndex],receipts[firstIndex]];
 expect(()=>restoreMatch({...twice,seatMechanics:{...twice.seatMechanics!,receipts}})).toThrow('mechanic birth order');
},60000);

it('cold Node processes restore actual canonical saves for tiers4/10/14 with the same claims and pending choice',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'g24-cold-'));
 try{
  const entry=join(directory,'restore.mjs');
  await build({stdin:{contents:`import {readFileSync,writeFileSync} from 'node:fs';
   import {restoreMatch} from './src/simulation/serialization';
   import {readG23Progress} from './src/simulation/g2-3-state';
   const text=readFileSync(process.argv[2],'utf8');
   const state=restoreMatch(process.argv[4]==='object'?JSON.parse(text):text);
   writeFileSync(process.argv[3],JSON.stringify({state,progress:readG23Progress(state),choice:state.pendingChoice}));`,resolveDir:resolve('.')},bundle:true,platform:'node',format:'esm',outfile:entry,
   // Resolve this dependency-free domain graph in Node. The shared esbuild service
   // otherwise scans inaccessible ancestor directories in the restricted LF clone.
   plugins:[{name:'local-domain-files',setup(builder){
    builder.onResolve({filter:/.*/},args=>{
     if(args.path.startsWith('node:'))return {path:args.path,external:true};
     if(!args.path.startsWith('.')&&!isAbsolute(args.path))throw Error(`Unexpected domain dependency: ${args.path}`);
     const base=resolve(args.importer?dirname(args.importer):args.resolveDir,args.path);
     const path=[base,base+'.ts',join(base,'index.ts')].find(p=>existsSync(p)&&statSync(p).isFile());
     if(!path)throw Error(`Missing domain dependency: ${args.path}`);
     return {path,namespace:'local-domain'};
    });
    builder.onLoad({filter:/.*/,namespace:'local-domain'},args=>({contents:readFileSync(args.path,'utf8'),loader:'ts'}));
   }}]});
  for(const tier of [4,10,14]){
   const initial=tier===14?tier14Battle():naturalForgeStates().get(tier)!;
   const states=tier===4?[initial]:[initial,accepted(selectChoice(initial,initial.pendingChoice!.choiceId,0,tier===10?initial.pendingChoice!.offers[1]:initial.pendingChoice!.offers[0]))];
   for(const [index,state] of states.entries()){
    const save=join(directory,`tier${tier}-${index}.json`);
    writeFileSync(save,serializeMatch(state));
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
 const choiceId='fixture:disguised-forge',conqueror={kind:'forge' as const,source:'conqueror',timeoutOption:choice.offers[0]};
 // v22 anvil units: the open tier-10 window belongs to an opened anvil unit, so the anvil ledger (birth receipt,
 // anvil-opened fact, rebuilt offers and anvil-unit payload) is its authority; disguising it is rejected there.
 for(const replacement of [
  {...choice,choiceId,eventId:choiceId},
  {...choice,choiceId,eventId:choiceId,offers:['warmog','infinity-edge','bloodthirster','last-whisper'],payload:{...choice.payload!,timeoutOption:'warmog'}},
  {...choice,choiceId,eventId:choiceId,payload:conqueror},
  {...choice,payload:conqueror},
 ]){
  const forged={...state,pendingChoice:replacement};
  expect(()=>restoreMatch(forged)).toThrow('Invalid anvil ledger');
  expect(()=>restoreMatch(JSON.stringify(forged))).toThrow('Invalid anvil ledger');
 }
 // Re-labelling it as the old automatic Conqueror popup is rejected by the mechanic choice authority.
 const legacyId='g23:conqueror:10:atom:0:copy:0',legacy={...state,pendingChoice:{...choice,choiceId:legacyId,eventId:legacyId,payload:conqueror}};
 expect(()=>restoreMatch(legacy)).toThrow('mechanic choice');
 expect(()=>restoreMatch(JSON.stringify(legacy))).toThrow('mechanic choice');
},60000);
