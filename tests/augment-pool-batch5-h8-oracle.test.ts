import { expect, it } from 'vitest';
import { augmentPool, augmentGold, CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from './fixtures/m5/oracle.g2.cjs';
import { validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';

const env={CATALOG,COST,ROUNDS,xp,entryXp,benchXp};
it.each([
 ['forward-thinking','3-2'],['mirrored-monetization','4-2'],['dhampyr','3-2'],
])('independent oracle admits %s only at %s', (id,allowed)=>{
 for(const node of ['2-1','3-2','4-2'])expect(augmentPool('gold',[],[],`round:${node}:augment`).includes(id)).toBe(node===allowed);
 expect(augmentGold(id,allowed)).toBe(id==='mirrored-monetization'?2:0);
});

function vector(definitionId:string){
 const forward=definitionId==='forward-thinking';
 const a={definitionId,choiceId:`round:${forward?'3-2':'4-2'}:augment`,acquiredRound:forward?12:19};
 const rounds=forward?[12,13,15,16,18]:[];
 const before:any={phase:'combat',seed:29,round:19,roundDefinitionId:'4-2',level:4,xp:0,augments:[a],
  preparation:{units:[]},resourceProvenance:{entries:[]},roundResults:rounds.map(round=>({round,roundKind:'pvp'})),
  augmentHistory:{facts:[{kind:'acquire',choiceId:a.choiceId,goldBefore:31},...rounds.map(round=>({kind:'pvp-roster',round}))]},
  seatMechanics:{receipts:[],seat:{},hidden:{progress:{economyReceipts:[]}}}};
 const after=structuredClone(before);after.phase='settlement';after.xp=2;
 after.roundResults.push({round:19,roundKind:'pvp'});
 after.seatMechanics.hidden.progress.economyReceipts.push({kind:'battle',facts:{round:19,roundKind:'pvp',result:'loss',alliedDeaths:0}});
 after.augmentHistory.facts.push(forward?{kind:'pvp-roster',round:19}:{kind:'deaths',round:19,deaths:[
  {eventSeq:1,unitId:'revived-hero',team:'enemy',ordinaryHero:true},
  {eventSeq:2,unitId:'revived-hero',team:'enemy',ordinaryHero:true},
  {eventSeq:3,unitId:'summon',team:'enemy',ordinaryHero:false},
  {eventSeq:4,unitId:'ally',team:'player',ordinaryHero:true},
 ]});
 const source=`augment-batch5-h8-${forward?'forward-thinking':'monetization'}`;
 const receipt={source,receiptId:JSON.stringify(forward?[source,a.choiceId]:[source,a.choiceId,19]),kind:'gold',amount:forward?101:4,round:19,roundId:'4-2'};
 after.seatMechanics.receipts.push(receipt);
 return {before,after,receipt};
}
it.each(['forward-thinking','mirrored-monetization'])('independently validates %s receipts and rejects changed amounts/identity/history',id=>{
 const {before,after}=vector(id),done=[{type:'combatFinished'}];
 expect(()=>validateRewards(before,after,null,done,env)).not.toThrow();
 for(const edit of ['amount','round','identity','remove','duplicate','evidence']){
  const bad=structuredClone(after),receipt=bad.seatMechanics.receipts[0];
  if(edit==='amount')receipt.amount++;
  if(edit==='round')receipt.round--;
  if(edit==='identity')receipt.receiptId='forged';
  if(edit==='remove')bad.seatMechanics.receipts=[];
  if(edit==='duplicate')bad.seatMechanics.receipts.push({...receipt});
  if(edit==='evidence')bad.augmentHistory.facts=[];
  expect(()=>validateRewards(before,bad,null,done,env),edit).toThrow();
 }
});
