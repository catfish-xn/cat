import type { EquipmentRoundRoll, M8RandomStreams, RngStream, TemporaryEquipment, Source, StatModifier, Effect } from './contracts';
import { nextRandom } from '../rng';
import { integer } from './stats';
import { canonicalSource, compareCodePoints } from './identity';
export interface EquipmentPoolEntry { readonly apiName:string; readonly definitionId:string }
export interface EquipmentPool { readonly version:'tg-01-v1'; readonly completed:readonly EquipmentPoolEntry[]; readonly components:readonly EquipmentPoolEntry[] }
export interface EquipmentState { readonly equipment:RngStream; readonly rolls:readonly EquipmentRoundRoll[] }
export interface RoundRollRequest { readonly parentItemInstanceId:string; readonly roundId:string; readonly playerLevel:number }
const key=(parent:string,round:string)=>JSON.stringify([parent,round]);
export function initializeStreams(seed:number):M8RandomStreams{
  integer(seed);if(seed>0xffffffff)throw new RangeError('Invalid seed');
  return{equipment:{state:(seed^0x243f6a88)>>>0,draws:0},encounter:{state:(seed^0xb7e15162)>>>0,draws:0},loot:{state:(seed^0xdeadbeef)>>>0,draws:0}};
}
export function uniformIndex(size:number,draw:()=>number):number{
  integer(size,1);if(size>0x100000000)throw new RangeError('Uniform pool too large');
  const limit=Math.floor(0x100000000/size)*size;
  for(;;){const word=draw();integer(word);if(word>0xffffffff)throw new RangeError('Invalid random word');if(word<limit)return word%size;}
}
function validatePool(pool:EquipmentPool):void{
  const all=[...pool.completed,...pool.components];
  if(pool.version!=='tg-01-v1'||pool.completed.length!==35||pool.components.length!==8||all.some(e=>!e.apiName||!e.definitionId)||new Set(all.map(e=>e.apiName)).size!==43||new Set(all.map(e=>e.definitionId)).size!==43)throw new RangeError('Invalid approved TG pool');
}
/** Finite pool sampling only; applying or revoking equipment never calls this. */
export function selectTemporaryPair(playerLevel:number,pool:EquipmentPool,draw:()=>number):readonly [string,string]{
  integer(playerLevel,1);validatePool(pool);
  const completed=[...pool.completed].sort((a,b)=>compareCodePoints(a.apiName,b.apiName)),components=[...pool.components].sort((a,b)=>compareCodePoints(a.apiName,b.apiName));
  const first=completed[uniformIndex(completed.length,draw)],secondPool=playerLevel<=6?components:completed.filter(e=>e.definitionId!==first.definitionId);
  return[first.definitionId,secondPool[uniformIndex(secondPool.length,draw)].definitionId];
}
export function generateRoundRolls(state:EquipmentState,requests:readonly RoundRollRequest[],pool:EquipmentPool):EquipmentState{
  validatePool(pool);validateEquipmentState(state,pool);
  const seen=new Set<string>();
  for(const r of requests){integer(r.playerLevel,1);if(!r.parentItemInstanceId||!r.roundId||seen.has(key(r.parentItemInstanceId,r.roundId)))throw new RangeError('Invalid round roll request');seen.add(key(r.parentItemInstanceId,r.roundId));}
  const pending=requests.filter(r=>!state.rolls.some(old=>key(old.parentItemInstanceId,old.roundId)===key(r.parentItemInstanceId,r.roundId))).sort((a,b)=>compareCodePoints(a.parentItemInstanceId,b.parentItemInstanceId)||compareCodePoints(a.roundId,b.roundId));
  if(!pending.length)return state;
  if(new Set(pending.map(r=>r.roundId)).size>1)throw new RangeError('One round per equipment generation transaction');
  let rng={...state.equipment};const draw=()=>{const next=nextRandom(rng.state);rng={state:next.state,draws:rng.draws+1};integer(rng.draws);return next.word;};
  const additions:EquipmentRoundRoll[]=pending.map(r=>{
    const rngDrawStart=rng.draws,children=selectTemporaryPair(r.playerLevel,pool,draw);
    return{parentItemInstanceId:r.parentItemInstanceId,roundId:r.roundId,playerLevelSnapshot:r.playerLevel,poolVersion:pool.version,children,rngDrawStart,rngDrawEnd:rng.draws};
  });
  return{equipment:rng,rolls:[...state.rolls,...additions]};
}
export function projectTemporaryEquipment(roll:EquipmentRoundRoll,holderId:string):TemporaryEquipment[]{
  if(!holderId)throw new RangeError('Missing temporary holder');
  return roll.children.map((definitionId,index)=>({temporaryId:JSON.stringify([roll.parentItemInstanceId,roll.roundId,index+1]),parentItemInstanceId:roll.parentItemInstanceId,roundId:roll.roundId,holderId,definitionId,slot:(index+1) as 1|2,expiresAfterRoundId:roll.roundId}));
}
export function reconcileTemporaryEquipment(previous:readonly TemporaryEquipment[],desired:readonly TemporaryEquipment[]):{remove:TemporaryEquipment[];apply:TemporaryEquipment[]}{
  const same=(a:TemporaryEquipment,b:TemporaryEquipment)=>a.temporaryId===b.temporaryId&&a.parentItemInstanceId===b.parentItemInstanceId&&a.roundId===b.roundId&&a.holderId===b.holderId&&a.definitionId===b.definitionId&&a.slot===b.slot&&a.expiresAfterRoundId===b.expiresAfterRoundId;
  const sort=(a:TemporaryEquipment,b:TemporaryEquipment)=>compareCodePoints(a.temporaryId,b.temporaryId);
  return{remove:previous.filter(a=>!desired.some(b=>same(a,b))).sort(sort),apply:desired.filter(b=>!previous.some(a=>same(a,b))).sort(sort)};
}
export interface TemporaryModifier { readonly source:Source; readonly modifier:StatModifier }
/** Effects are compiled/applied from fixed children, with no access to a random stream. */
export function compileTemporaryModifiers(children:readonly TemporaryEquipment[],definitions:Readonly<Record<string,readonly StatModifier[]>>):TemporaryModifier[]{
  return children.flatMap(child=>{
    const modifiers=definitions[child.definitionId];if(!Object.hasOwn(definitions,child.definitionId)||!modifiers)throw new RangeError('Uncompiled temporary definition');
    return modifiers.map((modifier,effectIndex)=>({source:{ownerId:child.holderId,sourceKind:'item' as const,definitionId:child.definitionId,instanceId:child.temporaryId,parentItemInstanceId:child.parentItemInstanceId,effectIndex},modifier}));
  });
}
export function reconcileTemporaryModifiers(current:readonly TemporaryModifier[],remove:readonly TemporaryEquipment[],apply:readonly TemporaryEquipment[],definitions:Readonly<Record<string,readonly StatModifier[]>>):TemporaryModifier[]{
  const removed=new Set(remove.map(c=>c.temporaryId));const retained=current.filter(c=>!removed.has(c.source.instanceId));
  const additions=compileTemporaryModifiers(apply,definitions),identity=(c:TemporaryModifier)=>JSON.stringify([c.source.ownerId,c.source.instanceId,c.source.effectIndex]);
  if(new Set([...retained,...additions].map(identity)).size!==retained.length+additions.length)throw new RangeError('Duplicate temporary effect');
  return[...retained,...additions];
}
export function validateEquipmentState(state:EquipmentState,pool:EquipmentPool,initialStream?:RngStream):void{
  validatePool(pool);integer(state.equipment.state);integer(state.equipment.draws);if(state.equipment.state>0xffffffff)throw new RangeError('Invalid equipment stream');
  const seen=new Set<string>();let end=0;
  for(const r of state.rolls){
    const id=key(r.parentItemInstanceId,r.roundId);integer(r.playerLevelSnapshot,1);integer(r.rngDrawStart);integer(r.rngDrawEnd);
    const second=r.playerLevelSnapshot<=6?pool.components:pool.completed;
    if(seen.has(id)||!r.parentItemInstanceId||!r.roundId||r.poolVersion!==pool.version||r.children.length!==2
      ||!pool.completed.some(e=>e.definitionId===r.children[0])||!second.some(e=>e.definitionId===r.children[1])||r.children[0]===r.children[1]
      ||r.rngDrawStart!==end||r.rngDrawEnd<r.rngDrawStart+2||r.rngDrawEnd>state.equipment.draws)throw new RangeError('Invalid equipment roll ledger');
    seen.add(id);end=r.rngDrawEnd;
  }
  if(end!==state.equipment.draws)throw new RangeError('Unreceipted equipment draws');
  if(initialStream){
    integer(initialStream.state);if(initialStream.state>0xffffffff||initialStream.draws!==0)throw new RangeError('Invalid initial equipment stream');
    let cursor={...initialStream};const draw=()=>{const next=nextRandom(cursor.state);cursor={state:next.state,draws:cursor.draws+1};return next.word;};
    const completed=[...pool.completed].sort((a,b)=>compareCodePoints(a.apiName,b.apiName)),components=[...pool.components].sort((a,b)=>compareCodePoints(a.apiName,b.apiName));
    for(const r of state.rolls){
      const first=completed[uniformIndex(35,draw)],secondPool=r.playerLevelSnapshot<=6?components:completed.filter(e=>e.definitionId!==first.definitionId);
      const second=secondPool[uniformIndex(secondPool.length,draw)];
      if(r.children[0]!==first.definitionId||r.children[1]!==second.definitionId||r.rngDrawEnd!==cursor.draws)throw new RangeError('Equipment roll does not match trusted initial stream');
    }
    if(cursor.state!==state.equipment.state||cursor.draws!==state.equipment.draws)throw new RangeError('Equipment stream mismatch');
  }
}
export function createEquipmentPool(entries:readonly (EquipmentPoolEntry & {readonly kind:'component'|'completed';readonly effects:readonly import('./contracts').Effect[]})[]):EquipmentPool{
  const eligible=entries.filter(e=>!e.effects.some(effect=>effect.kind==='temporary-equipment'));
  const project=(e:EquipmentPoolEntry)=>({apiName:e.apiName,definitionId:e.definitionId});
  const pool:EquipmentPool={version:'tg-01-v1',completed:eligible.filter(e=>e.kind==='completed').map(project),components:eligible.filter(e=>e.kind==='component').map(project)};
  validatePool(pool);return pool;
}
export function validateTemporaryEquipment(children:readonly TemporaryEquipment[],rolls:readonly EquipmentRoundRoll[]):void{
  const ids=new Set<string>(),holders=new Map<string,string>();
  for(const c of children){
    const roll=rolls.find(r=>r.parentItemInstanceId===c.parentItemInstanceId&&r.roundId===c.roundId);
    const pair=key(c.parentItemInstanceId,c.roundId),old=holders.get(c.holderId);
    if(!roll||!c.holderId||c.slot!==1&&c.slot!==2||c.expiresAfterRoundId!==c.roundId||c.definitionId!==roll.children[c.slot-1]
      ||c.temporaryId!==JSON.stringify([c.parentItemInstanceId,c.roundId,c.slot])||ids.has(c.temporaryId)||old!==undefined&&old!==pair)throw new RangeError('Invalid temporary equipment binding/slots');
    ids.add(c.temporaryId);holders.set(c.holderId,pair);
  }
  for(const [holder,pair] of holders)if(children.filter(c=>c.holderId===holder&&key(c.parentItemInstanceId,c.roundId)===pair).length!==2)throw new RangeError('Missing temporary sibling');
}

/** Finite programs are bound separately from static modifiers and random selection. */
export interface TemporaryEffect { readonly source:Source; readonly effect:Effect }
export function compileTemporaryEffects(children:readonly TemporaryEquipment[],definitions:Readonly<Record<string,readonly Effect[]>>):TemporaryEffect[]{
  return children.flatMap(child=>{
    const effects=definitions[child.definitionId];if(!Object.hasOwn(definitions,child.definitionId)||!effects)throw new RangeError('Uncompiled temporary program');
    return effects.map((effect,effectIndex)=>({source:{ownerId:child.holderId,sourceKind:'item' as const,definitionId:child.definitionId,instanceId:child.temporaryId,parentItemInstanceId:child.parentItemInstanceId,effectIndex},effect}));
  });
}
export function reconcileTemporaryEffects(current:readonly TemporaryEffect[],remove:readonly TemporaryEquipment[],apply:readonly TemporaryEquipment[],definitions:Readonly<Record<string,readonly Effect[]>>):TemporaryEffect[]{
  const removed=new Set(remove.map(c=>c.temporaryId)),retained=current.filter(e=>!removed.has(e.source.instanceId)),additions=compileTemporaryEffects(apply,definitions);
  const identity=(e:TemporaryEffect)=>JSON.stringify([e.source.ownerId,e.source.instanceId,e.source.effectIndex]);
  if(new Set([...retained,...additions].map(identity)).size!==retained.length+additions.length)throw new RangeError('Duplicate temporary program');
  return[...retained,...additions];
}

export interface TemporaryDefinition { readonly modifiers:readonly StatModifier[]; readonly effects:readonly Effect[] }
export interface TemporaryPrograms { readonly modifiers:readonly TemporaryModifier[]; readonly effects:readonly TemporaryEffect[] }
/** Combined definitions share one ordinal namespace: static entries first, finite effects next. */
export function compileTemporaryPrograms(children:readonly TemporaryEquipment[],definitions:Readonly<Record<string,TemporaryDefinition>>):TemporaryPrograms{
  const modifiers:TemporaryModifier[]=[],effects:TemporaryEffect[]=[];
  for(const child of children){
    const definition=definitions[child.definitionId];if(!Object.hasOwn(definitions,child.definitionId)||!definition)throw new RangeError('Uncompiled temporary definition');
    const source:Source={ownerId:child.holderId,sourceKind:'item',definitionId:child.definitionId,instanceId:child.temporaryId,parentItemInstanceId:child.parentItemInstanceId,effectIndex:0};
    definition.modifiers.forEach((modifier,effectIndex)=>modifiers.push({source:{...source,effectIndex},modifier}));
    definition.effects.forEach((effect,index)=>effects.push({source:{...source,effectIndex:definition.modifiers.length+index},effect}));
  }
  const sources=[...modifiers,...effects].map(e=>canonicalSource(e.source));if(new Set(sources).size!==sources.length)throw new RangeError('Duplicate temporary contribution');
  return{modifiers,effects};
}
export function reconcileTemporaryPrograms(current:TemporaryPrograms,remove:readonly TemporaryEquipment[],apply:readonly TemporaryEquipment[],definitions:Readonly<Record<string,TemporaryDefinition>>):TemporaryPrograms{
  const removed=new Set(remove.map(c=>c.temporaryId)),additions=compileTemporaryPrograms(apply,definitions);
  const modifiers=[...current.modifiers.filter(e=>!removed.has(e.source.instanceId)),...additions.modifiers];
  const effects=[...current.effects.filter(e=>!removed.has(e.source.instanceId)),...additions.effects];
  const sources=[...modifiers,...effects].map(e=>canonicalSource(e.source));if(new Set(sources).size!==sources.length)throw new RangeError('Duplicate temporary contribution');
  return{modifiers,effects};
}
