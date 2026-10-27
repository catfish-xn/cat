// Independent 14.24 role-card transcription and approved P-B5-53/54. No production imports or receipt-derived rewards.
const assert=require('node:assert/strict');
const {roles,champions}=require('./lucky-gloves-role-source.json');
const radiants={
 'crownguard':'Crownguard','ionic-spark':'IonicSpark','jeweled-gauntlet':'JeweledGauntlet','morellonomicon':'Morellonomicon',
 quicksilver:'Quicksilver',evenshroud:'SpectralGauntlet','adaptive-helm':'AdaptiveHelm','blue-buff':'BlueBuff',
 'protectors-vow':'FrozenHeart',redemption:'Redemption','hand-of-justice':'HandOfJustice',guardbreaker:'TrapClaw',
 'last-whisper':'LastWhisper','nashors-tooth':'Leviathan','red-buff':'RapidFirecannon','runaans-hurricane':'RunaansHurricane',
 'statikk-shiv':'StatikkShiv','titans-resolve':'TitansResolve',rageblade:'GuinsoosRageblade',deathblade:'Deathblade',shojin:'SpearOfShojin',
 archangel:'ArchangelsStaff',deathcap:'RabadonsDeathcap',warmog:'WarmogsArmor','dragons-claw':'DragonsClaw',gargoyle:'GargoyleStoneplate',
 gunblade:'HextechGunblade',bloodthirster:'Bloodthirster','edge-of-night':'GuardianAngel','infinity-edge':'InfinityEdge',
 'giant-slayer':'GiantSlayer','steraks-gage':'SteraksGage','bramble-vest':'BrambleVest','steadfast-heart':'NightHarvester','sunfire-cape':'SunfireCape',
};
const word=n=>Number((BigInt(n)*1664525n+1013904223n)&0xffffffffn);
// TG-01's approved API-sorted pool (the 36th completed item is the parent itself).
const completed=['adaptive-helm','archangel','bloodthirster','blue-buff','bramble-vest','crownguard','deathblade','dragons-claw','protectors-vow','gargoyle','edge-of-night','rageblade','gunblade','infinity-edge','ionic-spark','jeweled-gauntlet','last-whisper','nashors-tooth','giant-slayer','morellonomicon','steadfast-heart','guardbreaker','quicksilver','deathcap','red-buff','sunfire-cape','redemption','runaans-hurricane','shojin','evenshroud','statikk-shiv','steraks-gage','titans-resolve','hand-of-justice','warmog'];
const components=['sword','vest','belt','rod','cloak','bow','gloves','tear'];
const parentIds=new Set(['thiefs-gloves','TFT5_Item_ThiefsGlovesRadiant']);
const luckyIds=new Set(['lucky-gloves','lucky-gloves-plus']);
const key=(parent,round,selection)=>JSON.stringify([parent,round,selection?.choiceId,selection?.holderId,selection?.role,selection?.radiant]);
function drawPair(state,draws,firstPool,secondPool){
 const pick=pool=>{
  const ceiling=4294967296-(4294967296%pool.length);let w;
  do{state=word(state);draws++;w=state;}while(w>=ceiling);
  return pool[w%pool.length];
 };
 const first=pick(firstPool),second=pick(secondPool(first));
 return {children:[first,second],state,draws};
}
function pair(seed,start,role,radiant=false){
 let state=seed>>>0;for(let i=0;i<start;i++)state=word(state);
 assert(roles[role],`unknown independent role ${role}`);
 const result=drawPair(state,start,roles[role],first=>roles[role].filter(id=>id!==first));
 if(radiant)result.children=result.children.map(id=>`TFT5_Item_${radiants[id]}Radiant`);
 return result;
}
function roleFor(s,unit){
 const overrides={elise:'APCaster',swain:'APCaster',gangplank:'ADCaster',jayce:'ADCaster'};
 const zone=s.preparation.board.deploymentZones[unit.team];
 const depth=unit.location.kind==='board'?(unit.team==='player'?unit.location.cell.row-zone.firstRow:zone.lastRow-unit.location.cell.row):0;
 return depth>=2&&overrides[unit.definitionId]?overrides[unit.definitionId]:champions[unit.definitionId];
}
function selection(s,owner,parent,units){
 if(!owner||parent.location.kind!=='unit')return;
 const unit=units.find(u=>u.id===parent.location.unitId);
 if(!unit||unit.team!=='player'||!champions[unit.definitionId])return;
 return {choiceId:owner.choiceId,holderId:unit.id,definitionId:unit.definitionId,
  role:roleFor(s,unit),radiant:parent.definitionId==='TFT5_Item_ThiefsGlovesRadiant'};
}
// Position/entry/acquisition facts are observations of real rosters, not roll payloads.
// Include the current roster even if no history fact was emitted for the last command.
function observed(s,owner){
 const required=new Map(),ordinary=new Set(),facts=s.augmentHistory?.facts??[];
 let active=!facts.some(f=>f.kind==='acquire'&&f.choiceId===owner.choiceId);
 function visit(roundId,roster){
  if(!active||!roster)return;
  for(const parent of [...roster.items].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
   if(!parentIds.has(parent.definitionId))continue;
   const chosen=selection(s,owner,parent,roster.units);
   if(chosen){const id=key(parent.id,roundId,chosen);if(!required.has(id))required.set(id,{parent:parent.id,roundId,chosen});}
   else if(parent.location.kind==='unit')ordinary.add(key(parent.id,roundId));
  }
 }
 for(const f of facts){
  if(f.kind==='acquire'&&f.choiceId===owner.choiceId){
   // The acquisition fact is the roster before the choice. Every already worn
   // parent must have its ordinary cache before the new lucky cache is made.
   for(const parent of f.roster.items)if(parentIds.has(parent.definitionId)&&parent.location.kind==='unit')ordinary.add(key(parent.id,f.roundId));
   active=true;
  }
  if(['acquire','positions','round-entry','combat-roster','carousel'].includes(f.kind))visit(f.roundId,f.roster);
  if(f.kind==='pvp-roster')visit(f.roundId,f.seats.find(t=>t.seatId===(s.multiplayer?.seatId??'solo')));
 }
 active=true;visit(s.roundDefinitionId,{items:s.items,units:s.preparation.units});
 return {lucky:required,ordinary};
}
function validate(s){
 const owner=s.augments?.find(a=>luckyIds.has(a.definitionId));
 if(!owner)return;
 const {lucky:required,ordinary}=observed(s,owner),seen=new Set(),luckyOrder=[];
 let state=(s.seed^0x243f6a88)>>>0,draws=0;
 for(const r of s.equipmentState.rolls){
  const id=key(r.parentItemInstanceId,r.roundId,r.lucky);
  assert(!seen.has(id),'duplicate independent equipment cache');seen.add(id);
  assert.equal(r.rngDrawStart,draws,'independent equipment draw start');
  assert(Number.isSafeInteger(r.playerLevelSnapshot)&&r.playerLevelSnapshot>=1,'independent equipment level');
  let result;
  if(r.lucky){
   const expected=required.get(id);
   assert(expected,'independent lucky selector must match an actual historical holder/form');
   assert.deepEqual(r.lucky,expected.chosen,'independent lucky selector');
   assert.equal(r.poolVersion,'lucky-gloves-v1','independent lucky pool');
   result=drawPair(state,draws,roles[expected.chosen.role],first=>roles[expected.chosen.role].filter(item=>item!==first));
   if(expected.chosen.radiant)result.children=result.children.map(item=>`TFT5_Item_${radiants[item]}Radiant`);
   luckyOrder.push(id);
  }else{
   assert.equal(r.poolVersion,'tg-01-v1','independent ordinary pool');
   result=drawPair(state,draws,completed,first=>r.playerLevelSnapshot<=6?components:completed.filter(item=>item!==first));
  }
  assert.deepEqual(r.children,result.children,'independent equipment pair');
  assert.equal(r.rngDrawEnd,result.draws,'independent equipment draw end');
  state=result.state;draws=result.draws;
 }
 assert.deepEqual(luckyOrder,[...required.keys()],'independent required lucky caches and order');
 for(const id of ordinary)assert(seen.has(id),'independent required ordinary cache');
 assert.deepEqual(s.equipmentState.equipment,{state,draws},'independent equipment stream');
 const current=[];
 for(const parent of [...s.items].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
  if(!parentIds.has(parent.definitionId)||parent.location.kind!=='unit')continue;
  const chosen=selection(s,owner,parent,s.preparation.units);
  const roll=s.equipmentState.rolls.find(r=>key(r.parentItemInstanceId,r.roundId,r.lucky)===key(parent.id,s.roundDefinitionId,chosen));
  assert(roll,'independent current parent requires a cache');
  for(let slot=1;slot<=2;slot++)current.push({temporaryId:JSON.stringify([parent.id,s.roundDefinitionId,slot]),
   parentItemInstanceId:parent.id,roundId:s.roundDefinitionId,holderId:parent.location.unitId,
   definitionId:roll.children[slot-1],slot,expiresAfterRoundId:s.roundDefinitionId});
 }
 assert.deepEqual(s.temporaryEquipment,current,'independent current temporary equipment');
}
// Bind historical caches and new equipment to the actual pre-state and command.
function validateTransition(before,after,command){
 validate(before);validate(after);
 if(!before.augments?.some(a=>luckyIds.has(a.definitionId))&&!after.augments?.some(a=>luckyIds.has(a.definitionId)))return;
 const previous=before.equipmentState.rolls;
 assert.deepEqual(after.equipmentState.rolls.slice(0,previous.length),previous,'independent immutable equipment prefix');
 const owner=after.augments.find(a=>luckyIds.has(a.definitionId));
 if(owner){
  const {ordinary}=observed(after,owner);
  for(const roll of after.equipmentState.rolls.slice(previous.length))if(!roll.lucky)
   assert(ordinary.has(key(roll.parentItemInstanceId,roll.roundId)),'independent command ordinary cache');
 }
 function requireCache(parent,units){
  const chosen=selection(before,owner,parent,units);
  const id=key(parent.id,before.roundDefinitionId,chosen);
  assert(after.equipmentState.rolls.some(r=>key(r.parentItemInstanceId,r.roundId,r.lucky)===id),'independent command requires equipment cache');
  const existing=previous.some(r=>key(r.parentItemInstanceId,r.roundId,r.lucky)===id);
  const fresh=after.equipmentState.rolls.slice(previous.length).filter(r=>key(r.parentItemInstanceId,r.roundId,r.lucky)===id);
  assert.equal(fresh.length,existing?0:1,'independent command cache reuse');
  if(!existing)assert.equal(fresh[0].playerLevelSnapshot,before.level,'independent command equipment level');
  return existing?0:1;
 }
 if(command?.type==='equip'){
  const parent=before.items.find(i=>i.id===command.itemId);
  assert(parent,'independent equip command item');
  const unit=before.preparation.units.find(u=>u.id===command.unitId);
  assert(unit&&unit.team==='player'&&parent.location.kind==='inventory','independent equip command input');
  if(parentIds.has(parent.definitionId)){
   const equipped={...parent,location:{kind:'unit',unitId:unit.id,slot:0}};
   assert.deepEqual(after.items.find(i=>i.id===parent.id),equipped,'independent equip command result');
   const additions=requireCache(equipped,before.preparation.units);
   assert.equal(after.equipmentState.rolls.length,previous.length+additions,'independent equip cache count');
  }else{
   const worn=parent.definitionId==='gloves'?before.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unit.id&&components.includes(i.definitionId))
    .sort((a,b)=>a.location.slot-b.location.slot)[0]:undefined;
   if(worn?.definitionId==='gloves'){
    const equipped={id:`item-${before.nextItemSerial}`,definitionId:'thiefs-gloves',location:{kind:'unit',unitId:unit.id,slot:0}};
    assert.deepEqual(after.items.find(i=>i.id===equipped.id),equipped,'independent combined gloves result');
    assert(!after.items.some(i=>i.id===parent.id||i.id===worn.id),'independent combined gloves inputs');
    assert.equal(after.nextItemSerial,before.nextItemSerial+1,'independent combined gloves serial');
    const additions=requireCache(equipped,before.preparation.units);
    assert.equal(after.equipmentState.rolls.length,previous.length+additions,'independent equip cache count');
   }else assert.equal(after.equipmentState.rolls.length,previous.length,'independent equip cache count');
  }
 }else if(command?.type==='deploy'){
  const unit=before.preparation.units.find(u=>u.id===command.id);
  assert(unit,'independent deploy command input');
  assert.deepEqual(after.preparation.units.find(u=>u.id===unit.id)?.location,command.target,'independent deploy command result');
  const units=before.preparation.units.map(u=>u.id===unit.id?{...u,location:command.target}:u);
  for(const parent of before.items)if(parentIds.has(parent.definitionId)&&parent.location.kind==='unit'&&parent.location.unitId===unit.id)requireCache(parent,units);
 }else if((command?.type==='select'||command?.type==='choose')&&luckyIds.has(command.definitionId)){
  assert.equal(before.pendingChoice?.choiceId,command.choiceId,'independent lucky choice command');
  assert.equal(owner?.choiceId,command.choiceId,'independent acquired lucky owner');
  for(const parent of before.items)if(parentIds.has(parent.definitionId)&&parent.location.kind==='unit')requireCache(parent,before.preparation.units);
 }
}
module.exports={pair,validate,validateTransition,roles,radiants};
