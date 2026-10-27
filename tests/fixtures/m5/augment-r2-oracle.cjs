/* Independent 14.24/P-B5-21-81 vectors. No production imports. Expected
 * definitions come from command inputs/plans, never the conversion facts. */
const assert=require('node:assert/strict');
const {pools}=require('../../augment-reward-pools-oracle-data.cjs');
const ordinary=new Set(pools.completed);
// Independent transcription of M8_PLAN appendix A (also exercised by inventory.test.ts).
const recipes=[
 ['sword','sword','deathblade'],['sword','bow','giant-slayer'],['sword','rod','gunblade'],['sword','tear','shojin'],['sword','vest','edge-of-night'],['sword','cloak','bloodthirster'],['sword','belt','steraks-gage'],['sword','gloves','infinity-edge'],
 ['bow','bow','red-buff'],['bow','rod','rageblade'],['bow','tear','statikk-shiv'],['bow','vest','titans-resolve'],['bow','cloak','runaans-hurricane'],['bow','belt','nashors-tooth'],['bow','gloves','last-whisper'],
 ['rod','rod','deathcap'],['rod','tear','archangel'],['rod','vest','crownguard'],['rod','cloak','ionic-spark'],['rod','belt','morellonomicon'],['rod','gloves','jeweled-gauntlet'],
 ['tear','tear','blue-buff'],['tear','vest','protectors-vow'],['tear','cloak','adaptive-helm'],['tear','belt','redemption'],['tear','gloves','hand-of-justice'],
 ['vest','vest','bramble-vest'],['vest','cloak','gargoyle'],['vest','belt','sunfire-cape'],['vest','gloves','steadfast-heart'],
 ['cloak','cloak','dragons-claw'],['cloak','belt','evenshroud'],['cloak','gloves','quicksilver'],['belt','belt','warmog'],['belt','gloves','guardbreaker'],['gloves','gloves','thiefs-gloves'],
];
const components=new Set(recipes.flatMap(([a,b])=>[a,b]));
const recipe=(a,b)=>recipes.find(([x,y])=>x===a&&y===b||x===b&&y===a)?.[2];
// Fixed P2 gifts; random batch gifts are supplied by the independent reward plan.
const p2Items={'crown-guarded':['crownguard',1],'not-today':['edge-of-night',1],'belt-overflow':['belt',4],'sword-overflow':['sword',5],
 'wand-overflow':['rod',5],'crownguard-spirit':['rod',1],'guardbreaker-spirit':['gloves',1],'shojin-spirit':['sword',1],
 'flurry-of-blows':['TFT_Item_ZekesHerald',1],'immovable-object':['TFT4_Item_OrnnRanduinsSanctum',1]};
const excluded=['ultimate-hero','calling-card','identity-crisis','into-the-unknown','miniaturize','dual-wielding'];
function angerItems(items){return items.map(i=>ordinary.has(i.definitionId)?{...i,definitionId:'rageblade'}:structuredClone(i));}
function angerDefinition(definitionId,augments){return augments.some(a=>a.definitionId==='anger-issues')&&ordinary.has(definitionId)?'rageblade':definitionId;}
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
/** A missing conversion fact must not erase the expectation of conversion.
 * Recipe outputs come from the two pre-command components. Gift definitions
 * come from the independent reward plan/selected option; validated receipts
 * only connect those definitions to their newly allocated instance IDs. */
function validateAngerTransitions(before,after,command,rewards,lootReceipts=[]){
 const owner=before.augments.find(a=>a.definitionId==='anger-issues');
 if(!owner||before.items===undefined&&after.items===undefined)return;
 assert(after.items.every(i=>!ordinary.has(i.definitionId)||i.definitionId==='rageblade'),'independent future item conversion');
 const expected=new Map(),locations=new Map();
 const add=(id,definitionId,location)=>{
  if(expected.has(id))assert.equal(expected.get(id),definitionId,'independent raw item identity');
  expected.set(id,definitionId);if(location)locations.set(id,location);
 };
 if(command?.type==='combine'){
  const a=before.items.find(i=>i.id===command.a),b=before.items.find(i=>i.id===command.b);
  const raw=a&&b&&recipe(a.definitionId,b.definitionId);
  if(raw)add('item-'+before.nextItemSerial,raw,{kind:'inventory'});
 }
 if(command?.type==='equip'){
  const incoming=before.items.find(i=>i.id===command.itemId);
  const worn=before.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===command.unitId&&components.has(i.definitionId))
   .sort((a,b)=>a.location.slot-b.location.slot)[0];
  const raw=incoming&&worn&&recipe(incoming.definitionId,worn.definitionId);
  if(raw)add('item-'+before.nextItemSerial,raw,{kind:'unit',unitId:command.unitId,slot:worn.location.slot});
 }
 const choice=before.pendingChoice;
 if(command?.type==='select'&&(choice?.kind==='forge'||choice?.kind==='blackMarket'&&choice.payload.grantItem!==false)&&command.definitionId!=='@skip')
  add('item-'+before.nextItemSerial,command.definitionId,{kind:'inventory'});
 const prior=before.seatMechanics?.receipts??[],appended=(after.seatMechanics?.receipts??[]).slice(prior.length);
 for(const gift of rewards.gifts.values())if(gift.kind==='item'){
  const receipt=appended.find(r=>r.receiptId===gift.receiptId);
  assert(receipt&&receipt.kind==='item','independent converted reward existence');
  add(receipt.itemId,gift.definitionId);
 }
 for(const a of after.augments){
  const gift=p2Items[a.definitionId];if(!gift)continue;
  for(let i=0;i<gift[1];i++){
   const receipt=appended.find(r=>r.receiptId===JSON.stringify(['s13-augments-p2',a.choiceId,'item',i]));
   if(receipt)add(receipt.itemId,gift[0]);
  }
 }
 // Loot payloads have already been derived and authenticated by validateLootTransition.
 for(const receipt of lootReceipts)if(receipt.payload.kind==='item')for(const id of receipt.grantedItemIds)add(id,receipt.payload.definitionId);
 const changes=after.resourceProvenance.entries.slice(before.resourceProvenance.entries.length).filter(f=>f.kind==='anger-item-converted');
 for(const [itemId,raw] of expected){
  const item=after.items.find(i=>i.id===itemId);
  assert(item,'independent converted item exists');
  assert.equal(item.definitionId,angerDefinition(raw,after.augments),'independent command-derived item conversion');
  if(locations.has(itemId))assert.deepEqual(item.location,locations.get(itemId),'independent converted item location');
  const converted=ordinary.has(raw)&&raw!=='rageblade';
  assert.deepEqual(changes.filter(f=>f.itemId===itemId).map(({sequence,...f})=>f),converted?[{
   kind:'anger-item-converted',roundId:after.roundDefinitionId,itemId,from:raw,to:'rageblade',receiptId:owner.choiceId,
  }]:[],'independent future conversion transaction');
 }
 for(const fact of changes){
  assert(ordinary.has(fact.from)&&fact.from!=='rageblade'&&fact.to==='rageblade','independent conversion class');
  assert.equal(fact.receiptId,owner.choiceId,'independent conversion owner');
  assert.equal(after.items.find(i=>i.id===fact.itemId)?.definitionId,'rageblade','independent converted inventory');
 }
}
module.exports={angerItems,angerDefinition,angerNumbers,portableGrant,excluded,validateAngerChoice,validateAngerTransitions};
