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
function pair(seed,start,role,radiant=false){
 let cursor=seed>>>0;for(let i=0;i<start;i++)cursor=word(cursor);
 const pool=[...roles[role]],out=[];let draws=start;
 for(let i=0;i<2;i++){
  const ceiling=4294967296-(4294967296%pool.length);let w;
  do{cursor=word(cursor);draws++;w=cursor;}while(w>=ceiling);
  const id=pool.splice(w%pool.length,1)[0];out.push(radiant?`TFT5_Item_${radiants[id]}Radiant`:id);
 }
 return {children:out,state:cursor,draws};
}
function validate(s){
 if(!s.augments?.some(a=>['lucky-gloves','lucky-gloves-plus'].includes(a.definitionId)))return;
 const seed=(s.seed^0x243f6a88)>>>0;
 const rosterRole=u=>{
  const overrides={elise:'APCaster',swain:'APCaster',gangplank:'ADCaster',jayce:'ADCaster'};
  const zone=s.preparation.board.deploymentZones[u.team];
  const depth=u.location.kind==='board'?(u.team==='player'?u.location.cell.row-zone.firstRow:zone.lastRow-u.location.cell.row):0;
  return depth>=2&&overrides[u.definitionId]?overrides[u.definitionId]:champions[u.definitionId];
 };
 const rosters=round=>(s.augmentHistory?.facts??[]).filter(f=>f.round===round).flatMap(f=>
  f.roster?[f.roster]:f.kind==='pvp-roster'?f.seats.filter(t=>t.seatId===(s.multiplayer?.seatId??'solo')):[]);
 for(const r of s.equipmentState.rolls)if(r.lucky){
  const owner=s.augments.find(a=>['lucky-gloves','lucky-gloves-plus'].includes(a.definitionId));
  const [stage,sub]=r.roundId.split('-').map(Number),round=stage===1?sub-1:3+(stage-2)*7+sub;
  // Round 1 is 1-2; derive context from genuine recorded positions/rosters, not roll payloads.
  const candidates=rosters(round).flatMap(roster=>roster.items.filter(i=>i.id===r.parentItemInstanceId&&i.location.kind==='unit').flatMap(parent=>{
   const unit=roster.units.find(u=>u.id===parent.location.unitId);if(!unit||unit.team!=='player')return [];
   return [{choiceId:owner.choiceId,holderId:unit.id,definitionId:unit.definitionId,role:rosterRole(unit),radiant:parent.definitionId==='TFT5_Item_ThiefsGlovesRadiant'}];
  }));
  const selected=candidates.find(c=>Object.keys(c).every(k=>c[k]===r.lucky[k]));
  assert(selected,'independent lucky selector must match an actual historical holder/form');
  const expected=pair(seed,r.rngDrawStart,selected.role,selected.radiant);
  assert.deepEqual(r.children,expected.children,'independent recommended equipment pair');
  assert.equal(r.rngDrawEnd,expected.draws,'independent lucky draw count');
 }
 for(const t of s.temporaryEquipment){
  const unit=s.preparation.units.find(u=>u.id===t.holderId);
  if(!champions[unit.definitionId])continue;
  const matches=s.equipmentState.rolls.filter(r=>r.parentItemInstanceId===t.parentItemInstanceId&&r.roundId===t.roundId&&r.lucky?.holderId===unit.id);
  const parent=s.items.find(i=>i.id===t.parentItemInstanceId),role=rosterRole(unit);
  assert(matches.some(r=>r.lucky.role===role&&r.lucky.radiant===(parent.definitionId==='TFT5_Item_ThiefsGlovesRadiant')&&r.children[t.slot-1]===t.definitionId),'independent current lucky projection');
 }
}
module.exports={pair,validate,roles,radiants};
