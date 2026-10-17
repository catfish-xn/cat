import {expect,it} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildSync} from 'esbuild';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {selectChoice} from '../src/simulation/match';
import {readG23Progress} from '../src/simulation/g2-3-state';
import {openMechanicChoice} from '../src/simulation/seat-mechanics';
import {accepted,naturalForgeStates,receiptVectorTier14Save} from './fixtures/g24-natural-forge';

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
 expect(()=>restoreMatch({...twice,seatMechanics:{...twice.seatMechanics!,receipts}})).toThrow('mechanic choice birth order');
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
   writeFileSync(process.argv[3],JSON.stringify({progress:readG23Progress(state),choice:state.pendingChoice}));`,resolveDir:resolve('.')},bundle:true,platform:'node',format:'esm',outfile:entry});
  for(const tier of [4,10,14]){
   const initial=tier===14?receiptVectorTier14Save():naturalForgeStates().get(tier)!;
   const states=tier===10?[initial,accepted(selectChoice(initial,initial.pendingChoice!.choiceId,0,'TFT_Item_Artifact_SeekersArmguard'))]:[initial];
   for(const [index,state] of states.entries()){
    const save=join(directory,`tier${tier}-${index}.json`);
    writeFileSync(save,serializeMatch(state));
    for(const mode of ['text','object']){
     const output=join(directory,`tier${tier}-${index}-${mode}-restored.json`);
     const child=spawnSync(process.execPath,[entry,save,output,mode],{encoding:'utf8',timeout:30000});
     expect(child.error).toBeUndefined();
     expect(child.status,child.stderr).toBe(0);
     const result=JSON.parse(readFileSync(output,'utf8'));
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
