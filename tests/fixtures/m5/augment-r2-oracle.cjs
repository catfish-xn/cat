/* Independent 14.24/P-B5-21-81 vectors. Never import production or read reward receipts. */
const assert=require('node:assert/strict');
const {pools}=require('../../augment-reward-pools-oracle-data.cjs');
const ordinary=new Set(pools.completed);
const excluded=['ultimate-hero','calling-card','identity-crisis','into-the-unknown','miniaturize','dual-wielding'];
function angerItems(items){return items.map(i=>ordinary.has(i.definitionId)?{...i,definitionId:'rageblade'}:structuredClone(i));}
function angerNumbers(attacks,copies=1){return {armor:45*copies,magicResist:45*copies,abilityPower:(10+Math.floor(attacks/2))*copies,attackDamageBps:100*Math.floor(attacks/2)*copies,attackSpeedBps:(1000+500*attacks)*copies};}
function portableGrant(before,command){
 if(command?.type!=='select'||before.pendingChoice?.kind!=='anomaly')return null;
 const owner=before.augments.find(a=>a.definitionId==='another-anomaly');if(!owner)return null;
 assert(!excluded.includes(command.definitionId),'excluded Portable Anomaly');
 return {receiptId:JSON.stringify(['augment-pool-batch5-r2',owner.choiceId,before.pendingChoice.choiceId]),source:'augment-pool-batch5-r2',kind:'item',definitionId:'TFT13_AnotherAnomaly_Item:'+command.definitionId,itemId:'item-'+before.nextItemSerial,round:before.round,roundId:'4-6'};
}
function validateAngerChoice(before,after,command){
 if(command?.type!=='select'||command.definitionId!=='anger-issues')return;
 const converted=before.items.filter(i=>ordinary.has(i.definitionId)&&i.definitionId!=='rageblade');
 assert.deepEqual(after.items,angerItems(before.items),'independent existing item conversion');
 const changes=after.resourceProvenance.entries.slice(before.resourceProvenance.entries.length);
 assert.deepEqual(changes.map(({kind,itemId,from,to,receiptId})=>({kind,itemId,from,to,receiptId})),converted.map(i=>({kind:'anger-item-converted',itemId:i.id,from:i.definitionId,to:'rageblade',receiptId:before.pendingChoice.choiceId})),'independent complete conversion transaction');
}
module.exports={angerItems,angerNumbers,portableGrant,excluded,validateAngerChoice};
