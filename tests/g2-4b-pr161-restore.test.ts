import {expect,it} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildSync} from 'esbuild';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {selectChoice,nextRound,startMatchCombat,stepMatch,type MatchState} from '../src/simulation/match';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {createG23Progress} from '../src/simulation/g2-3-match-progress';
import {advanceG23Economy} from '../src/simulation/g2-3-economy';
import {g23BattlePayouts} from '../src/simulation/g2-3-settlement';
import {grantMechanicGold,grantMechanicUnit,openMechanicChoice} from '../src/simulation/seat-mechanics';
import {accepted,naturalForgeStates,naturalTier4Preparation} from './fixtures/g24-natural-forge';

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
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
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

it('restores automatic heroes/duplicator at tier4 and radiant item at tier14, pending and selected, on the award round',()=>{
 const states=settlementCases(),four=states[0];
 expect([four.round,four.roundDefinitionId,readG23Progress(four)!.conquest.stacks]).toEqual([6,'2-3',108]);
 expect(four.combat?.status).toBe('finished');
 expect(four.seatMechanics!.receipts.filter(r=>r.receiptId.startsWith('g23:conqueror:4:'))).toEqual([
  expect.objectContaining({kind:'unit',resolution:'held'}),expect.objectContaining({kind:'unit',resolution:'held'}),
 ]);
 expect(states[1].seatMechanics!.receipts.find(r=>r.receiptId==='g23:conqueror:14:atom:0:copy:0')).toMatchObject({
  // The support trial grants four earlier items; birth must still use the exact frozen serial.
  kind:'item',itemId:`item-${states[1].combatInputBasis!.nextItemSerial}`,definitionId:'TFT5_Item_ArchangelsStaffRadiant',
 });
 for(const state of states){
  const before=JSON.stringify(state),save=serializeMatch(state);
  expect(restoreMatch(state)).toEqual(state);
  expect(restoreMatch(JSON.parse(save))).toEqual(state);
  expect(restoreMatch(save)).toEqual(state);
  expect(JSON.stringify(state)).toBe(before);
 }
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

it('seed42 naturally opens tier10 at 5-2/654 stacks and round-trips the selected artifact in settlement',()=>{
 const state=naturalForgeStates().get(10)!,choice=state.pendingChoice!;
 expect([state.round,state.roundDefinitionId,readG23Progress(state)!.conquest.stacks]).toEqual([26,'5-2',654]);
 const picked=accepted(selectChoice(state,choice.choiceId,choice.generation,'TFT_Item_Artifact_SeekersArmguard'));
 expect(picked.phase).toBe('settlement');
 expect(restoreMatch(picked)).toEqual(picked);
 const save=serializeMatch(picked);
 expect(restoreMatch(JSON.parse(save))).toEqual(picked);
 expect(restoreMatch(save)).toEqual(picked);
 const receipt=picked.seatMechanics!.receipts.find(r=>r.receiptId===choice.choiceId)!;
 expect(receipt).toMatchObject({kind:'choice',itemId:`item-${state.nextItemSerial}`,optionId:'TFT_Item_Artifact_SeekersArmguard'});
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

it('cold Node processes restore actual canonical saves for tiers4/10/14 with the same claims and pending choice',()=>{
 const directory=mkdtempSync(join(tmpdir(),'g24-cold-'));
 try{
  const entry=join(directory,'restore.mjs');
  buildSync({stdin:{contents:`import {readFileSync,writeFileSync} from 'node:fs';
   import {restoreMatch} from './src/simulation/serialization';
   import {readG23Progress} from './src/simulation/g2-3-state';
   const text=readFileSync(process.argv[2],'utf8');
   const state=restoreMatch(process.argv[4]==='object'?JSON.parse(text):text);
   writeFileSync(process.argv[3],JSON.stringify({state,progress:readG23Progress(state),choice:state.pendingChoice}));`,resolveDir:resolve('.')},bundle:true,platform:'node',format:'esm',outfile:entry});
  for(const tier of [4,10,14]){
   const initial=tier===14?tier14Battle():naturalForgeStates().get(tier)!;
   const states=tier===4?[initial]:[initial,accepted(selectChoice(initial,initial.pendingChoice!.choiceId,0,tier===10?'TFT_Item_Artifact_SeekersArmguard':initial.pendingChoice!.offers[0]))];
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
 const choiceId='fixture:disguised-forge';
 for(const replacement of [
  {...choice,choiceId,eventId:choiceId},
  {...choice,choiceId,eventId:choiceId,offers:['warmog','infinity-edge','bloodthirster','last-whisper'],payload:{...choice.payload!,timeoutOption:'warmog'}},
 ]){
  const forged={...state,pendingChoice:replacement};
  expect(()=>restoreMatch(forged)).toThrow('G23 pending choice authority');
  expect(()=>restoreMatch(JSON.stringify(forged))).toThrow('G23 pending choice authority');
 }
},60000);
