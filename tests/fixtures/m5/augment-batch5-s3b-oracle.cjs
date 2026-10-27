// Independent ordinary recipes and P-B5-S3B transitions; no production imports.
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const RECIPES={
 deathblade:['sword','sword'],'giant-slayer':['sword','bow'],gunblade:['sword','rod'],shojin:['sword','tear'],
 'edge-of-night':['sword','vest'],bloodthirster:['sword','cloak'],'steraks-gage':['sword','belt'],'infinity-edge':['sword','gloves'],
 'red-buff':['bow','bow'],rageblade:['bow','rod'],'statikk-shiv':['bow','tear'],'titans-resolve':['vest','bow'],
 'runaans-hurricane':['cloak','bow'],'nashors-tooth':['belt','bow'],'last-whisper':['bow','gloves'],
 deathcap:['rod','rod'],archangel:['rod','tear'],crownguard:['vest','rod'],'ionic-spark':['rod','cloak'],morellonomicon:['belt','rod'],'jeweled-gauntlet':['rod','gloves'],
 'blue-buff':['tear','tear'],'protectors-vow':['vest','tear'],'adaptive-helm':['cloak','tear'],redemption:['belt','tear'],'hand-of-justice':['gloves','tear'],
 'bramble-vest':['vest','vest'],gargoyle:['vest','cloak'],'sunfire-cape':['vest','belt'],'steadfast-heart':['vest','gloves'],
 'dragons-claw':['cloak','cloak'],evenshroud:['belt','cloak'],quicksilver:['cloak','gloves'],warmog:['belt','belt'],guardbreaker:['belt','gloves'],'thiefs-gloves':['gloves','gloves'],
};
const source='augment-pool-batch5-s3b';
function academicConsumed(state){
 const owner=state.augments.find(a=>a.definitionId==='academic-research');if(!owner)return 0;
 const anchor=state.resourceProvenance.entries.find(e=>e.kind==='item-acquired'&&e.source.kind==='mechanic'&&e.source.receiptId===JSON.stringify(['augment-pool-batch1',owner.choiceId,owner.definitionId,0,0]));
 return anchor?state.resourceProvenance.entries.filter(e=>e.kind==='item-combined'&&e.sequence>anchor.sequence&&RECIPES[e.event.definitionId]).length:0;
}
function salvageGifts(before,command){
 const owner=before.augments.find(a=>a.definitionId==='salvage-bin');if(!owner||command?.type!=='sell')return [];
 return before.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===command.unitId&&RECIPES[i.definitionId])
  .sort((a,b)=>a.id<b.id?-1:1).map((i,index)=>({receiptId:JSON.stringify([source,owner.choiceId,'salvage',before.resourceProvenance.entries.length,i.id,'component']),source,kind:'item',definitionId:RECIPES[i.definitionId][1],itemId:`item-${before.nextItemSerial+index}`,round:before.round,roundId:before.roundDefinitionId}));
}
function validateSalvage(before,after,command,events){
 const expected=salvageGifts(before,command),actual=(after.seatMechanics?.receipts??[]).slice(before.seatMechanics?.receipts.length??0).filter(r=>r.source===source);
 assert.deepEqual(actual,expected,'independent sale component receipts');
 for(const r of expected)assert(events.some(e=>e.type==='mechanicGranted'&&isDeepStrictEqual(e.receipt,r)),'salvage item requires grant event');
 return new Map(expected.map(r=>[r.receiptId,r]));
}
module.exports={RECIPES,academicConsumed,salvageGifts,validateSalvage};
function pandoraChanges(state,round){
 const a=state.augments.find(a=>a.definitionId==='pandoras-items-ii'&&a.acquiredRound<round);if(!a)return [];
 const components=['belt','bow','cloak','gloves','rod','sword','tear','vest'],completed=Object.keys(RECIPES).sort();
 return state.items.filter(i=>i.location.kind==='inventory'&&(components.includes(i.definitionId)||RECIPES[i.definitionId]))
  .sort((a,b)=>a.id<b.id?-1:1).map(i=>{
   const receiptId=JSON.stringify([source,a.choiceId,'pandora',round,i.id]);let h=2166136261n;
   for(const c of receiptId)h=((h^BigInt(c.charCodeAt(0)))*16777619n)&0xffffffffn;
   const word=(((BigInt(state.seed)^h)*1664525n+1013904223n)&0xffffffffn),pool=components.includes(i.definitionId)?components:completed;
   return {kind:'g23-item-converted',itemId:i.id,from:i.definitionId,to:pool[Number(word*BigInt(pool.length)/4294967296n)],receiptId};
  });
}
module.exports.pandoraChanges=pandoraChanges;
function validatePandora(before,after,command){
 const expected=command?.type==='continue'?pandoraChanges(before,before.round+1):[];
 const actual=after.resourceProvenance.entries.slice(before.resourceProvenance.entries.length)
  .filter(e=>e.kind==='g23-item-converted'&&e.receiptId.startsWith('["augment-pool-batch5-s3b",')&&JSON.parse(e.receiptId)[2]==='pandora')
  .map(({sequence,roundId,...fact})=>{assert.equal(roundId,after.roundDefinitionId);return fact;});
 assert.deepEqual(actual,expected,'independent complete Pandora entry conversions');
 for(const f of expected)assert.equal(after.items.find(i=>i.id===f.itemId)?.definitionId,f.to,'independent Pandora output');
}
module.exports.validatePandora=validatePandora;
