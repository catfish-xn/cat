/* Independent B5-16 stream arithmetic: BigInt avoids production's Math.imul/float draw. */
exports.pandoraPick = function(seed, seat, choice, round, item, sortedPool) {
 const mod=4294967296n;
 let hash=2166136261n;
 for(const c of JSON.stringify(['augment-pool-batch5-s3a',seat,choice,round,item]))hash=((hash^BigInt(c.charCodeAt(0)))*16777619n)%mod;
 const word=((BigInt(seed)^hash)*1664525n+1013904223n)%mod;
 return sortedPool[Number(word*BigInt(sortedPool.length)/mod)];
};

const pools=require('../../augment-reward-pools-oracle-data.cjs').pools;
/** Independent B5-13 obligations from original acquisition receipts, never from an anvil receipt. */
exports.buffetPlan=function(s){
 const owner=s.augments.find(a=>a.definitionId==='component-buffet'),consumed=new Set(),gifts=new Map();
 if(!owner)return {consumed,gifts};
 const receipts=s.seatMechanics?.receipts??[],facts=s.resourceProvenance.entries;
 const initial=JSON.stringify(['augment-pool-batch1',owner.choiceId,'component-buffet',0,0]);
 const start=facts.findIndex(e=>e.kind==='item-acquired'&&e.source.kind==='mechanic'&&e.source.receiptId===initial);
 if(start<0)return {consumed,gifts};
 for(const e of facts.slice(start+1)){
  let outputs=[];
  if(e.kind==='item-acquired'){
   const source=e.source;
   const r=source.kind==='mechanic'?receipts.find(r=>r.receiptId===source.receiptId):source.kind==='schedule'?s.scheduleReceipts.find(r=>r.eventId===source.eventId):source.kind==='loot'?s.m8.loot.receipts.find(r=>r.receiptId===source.receiptId):s.carousel?.receipts.find(r=>r.id===source.receiptId);
   if(r?.kind==='choice'&&r.choiceKind==='forge')continue;
   outputs=[{id:e.itemId,definitionId:source.kind==='loot'?r?.payload.definitionId:source.kind==='carousel'?r?.itemId:r?.kind==='choice'?r.optionId:r?.definitionId}];
  }else if(e.kind==='consumable-used')outputs=e.record.outputs.filter(o=>!e.record.affectedItems.some(i=>i.id===o.id));
  for(const item of outputs)if(pools.component.includes(item.definitionId)){
   consumed.add(item.id);const receiptId=JSON.stringify(['augment-pool-batch5-s3a',owner.choiceId,item.id]);
   gifts.set(receiptId,{receiptId,definitionId:'TFT_ArmoryKeyComponent',starLevel:1});
  }
 }
 return {consumed,gifts};
};
exports.validatePandoraEntry=function(before,after,assert){
 const owner=before.augments.find(a=>a.definitionId==='pandoras-items');if(!owner||after.round===before.round)return;
 for(const item of before.items){
  if(item.location.kind!=='inventory')continue;
  const pool=pools.component.includes(item.definitionId)?pools.component:pools.completed.includes(item.definitionId)?pools.completed:null;
  const expected=pool?exports.pandoraPick(before.seed,before.multiplayer?.seatId??'solo',owner.choiceId,after.round,item.id,pool):item.definitionId;
  assert.equal(after.items.find(i=>i.id===item.id)?.definitionId,expected,'independent Pandora round entry');
 }
};
