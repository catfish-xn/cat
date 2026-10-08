/** Source-bound validation for newly enabled catalogue declarations. */
import type { CombatUnit } from '../combat-types';
import type { Effect, Source, StatusApplication } from './contracts';
import { canonicalContent } from '../content';
import { canonicalSource, effectIdentity, validateIdentity } from './identity';
import { compileMechanismDefinitions } from './s13-definitions';
import { validateTriggerLedger } from './triggers';
import { resolveStat, integer } from './stats';
import type { MechanismDefinitions } from './runtime-types';
import { survivalConsumptionKeys } from './shield';
const same=(a:unknown,b:unknown)=>canonicalContent(a)===canonicalContent(b);
export function declaredEffects(unit:CombatUnit,combatId:string):{source:Source;effect:Effect;survivalSource?:Source}[] {
 const compiled=compileMechanismDefinitions(unit,combatId),result:{source:Source;effect:Effect;survivalSource?:Source}[]=[];
 const collect=(source:Source,effects:readonly Effect[],survivalSource?:Source)=>effects.forEach((effect,i)=>{
  const bound={...source,effectIndex:source.effectIndex+i};result.push({source:bound,effect,survivalSource});
  if(effect.kind==='grant-shield')collect({...bound,effectIndex:bound.effectIndex+1},effect.endEffects,survivalSource);
  if(effect.kind==='apply-status'&&effect.status.onEnd)collect({...bound,effectIndex:bound.effectIndex+1},effect.status.onEnd.effects,survivalSource);
 });
 for(const d of compiled.eventTriggers ?? [])collect(d.source,d.effects);
 for(const d of compiled.survivalTriggers)collect(d.source,d.effects,d.source);
 for(const p of compiled.periodicTasks)collect(p.source,p.program.effects);
 return result;
}
export function statusDeclaration(effect:Effect,owner:CombatUnit,source:Source):StatusApplication|null {
 if(effect.kind==='apply-status')return effect.status;
 if(effect.kind!=='modify-stat')return null;
 const raw=effect.modifier,value=raw.value;
 const modifier=value.kind==='counter'?{...raw,value:{kind:'constant' as const,amount:(owner.triggerLedger?.runtimes.find(r=>r.source.definitionId===source.definitionId&&r.source.instanceId===source.instanceId&&r.source.effectIndex<=source.effectIndex&&source.effectIndex<r.source.effectIndex+32)?.counters[value.counterId] ?? 0)*value.perCount}}:raw;
 return {kind:modifier.value.kind==='constant'&&modifier.value.amount<0?'stat-debuff':'stat-buff',magnitudeBps:0,duration:effect.duration,stackPolicy:effect.stackPolicy,activation:effect.activation,polarity:modifier.value.kind==='constant'&&modifier.value.amount<0?'harmful':'beneficial',removable:modifier.value.kind==='constant'&&modifier.value.amount<0,modifier,damageFilter:null,onEnd:null};
}
export function isDeclaredStatus(source:Source,app:StatusApplication,units:readonly CombatUnit[],combatId:string):boolean {
 const owner=units.find(u=>u.id===source.ownerId);if(!owner)return false;
 return declaredEffects(owner,combatId).some(d=>canonicalSource(d.source)===canonicalSource(source)&&same(statusDeclaration(d.effect,owner,d.source),app));
}
/** Live threshold/start effects require their once-per-combat receipt. */
export function validateItemEffectConsumption(source:Source,at:number,units:readonly CombatUnit[],combatId:string):void {
 const owner=units.find(u=>u.id===source.ownerId);
 if(!owner)return;
 for(const d of declaredEffects(owner,combatId).filter(d=>canonicalSource(d.source)===canonicalSource(source)&&d.survivalSource)) {
  const key=effectIdentity(combatId,d.survivalSource!,owner.id).key;
  const runtime=owner.mechanismState?.runtimes.find(r=>r.key===key);
  if(!runtime?.consumed||runtime.triggerCount!==1||runtime.startsAtTick>at)throw new Error('Invalid Match save: missing item effect consumption');
 }
}
export function validateItemRuntime(unit:CombatUnit,combatId:string,tick:number,definitions:MechanismDefinitions):void {
 const state=unit.mechanismState!;
 validateTriggerLedger(unit.triggerLedger ?? {runtimes:[],processed:{},actionCounts:{}},combatId,definitions.eventTriggers ?? []);
 for(const r of unit.triggerLedger?.runtimes ?? []){
  validateIdentity(r,combatId);integer(r.startsAtTick);integer(r.nextEligibleTick);
  const d=definitions.eventTriggers!.find(d=>canonicalSource(d.source)===canonicalSource(r.source));
  if(!d||r.targetId!==unit.id||r.startsAtTick>tick||r.expiresAtTick!==null||r.nextEligibleTick>tick+d.internalCooldownTicks||r.consumed!==(d.maxPerCombat!==null&&r.triggerCount>=d.maxPerCombat)||!same(r.stackPolicy,d.stackPolicy)||r.consumedRewards.some(id=>d.gate.kind!=='stack-threshold-once'||id!==d.gate.rewardId))throw new Error('Invalid Match save: item event runtime');
 }
 const survivalKeys=new Set(definitions.survivalTriggers.map(d=>effectIdentity(combatId,d.source,unit.id).key));
 const seen=new Set<string>();
 for(const r of state.runtimes){
  validateIdentity(r,combatId);integer(r.startsAtTick);integer(r.nextEligibleTick);
  const d=definitions.survivalTriggers.find(d=>effectIdentity(combatId,d.source,unit.id).key===r.key);
  if(!d||!survivalKeys.has(r.key)||seen.has(r.key)||r.triggerCount!==1||!r.consumed||r.startsAtTick>tick||r.expiresAtTick!==null||r.stacks!==0||!same(r.counters,{})||r.consumedRewards.length||r.nextEligibleTick!==r.startsAtTick+d.internalCooldownTicks||!same(r.stackPolicy,d.stackPolicy))throw new Error('Invalid Match save: item survival runtime');
  seen.add(r.key);
 }
 // Every source must be represented exactly once, even after its effects end.
 // Missing receipts are never reinterpreted as consumed or as first-use slots.
 const expected=new Set(survivalConsumptionKeys(definitions.survivalTriggers,combatId,unit.id));
 if(!Array.isArray(state.unconsumedSurvivalKeys))throw new Error('Invalid Match save: incomplete survival consumption');
 for(const key of state.unconsumedSurvivalKeys){
  if(!expected.has(key)||seen.has(key))throw new Error('Invalid Match save: survival consumption identity');
  seen.add(key);
 }
 if([...expected].some(key=>!seen.has(key)))throw new Error('Invalid Match save: incomplete survival consumption');
 const basis=unit.maxHpBasis!;
 const bonuses=unit.itemPrograms?.length?declaredEffects(unit,combatId).filter(d=>d.effect.kind==='change-max-hp'):[];
 const uniqueBonuses=new Map(bonuses.map(d=>[canonicalSource(d.source),d]));
 const expectedBonus=[...uniqueBonuses.values()].reduce((n,d)=>n+(d.effect.kind==='change-max-hp'&&state.runtimes.some(r=>r.source.definitionId===d.source.definitionId&&r.source.instanceId===d.source.instanceId&&r.source.effectIndex<=d.source.effectIndex&&d.source.effectIndex<r.source.effectIndex+32)?d.effect.bonusBps:0),0);
 if(basis.bonusBps!==expectedBonus)throw new Error('Invalid Match save: item max HP consumption');
 const maximum=resolveStat('maxHp',basis.base,[{stat:'maxHp',unit:'flat',value:{kind:'constant',amount:basis.flat},condition:{kind:'always'},damageFilter:null},{stat:'maxHp',unit:'bps',value:{kind:'constant',amount:basis.bps+basis.bonusBps},condition:{kind:'always'},damageFilter:null}],{holder:unit});
 if(unit.maxHp!==maximum)throw new Error('Invalid Match save: current max HP');
}
export function maxHpCandidates(unit:CombatUnit,at:number,combatId:string):Set<number> {
 const basis=unit.maxHpBasis!;let bonuses=new Set([0]);const seen=new Set<string>();
 for(const d of declaredEffects(unit,combatId)){
  const key=canonicalSource(d.source);
  if(d.effect.kind!=='change-max-hp'||seen.has(key))continue;seen.add(key);
  if(unit.mechanismState!.runtimes.some(r=>r.source.definitionId===d.source.definitionId&&r.source.instanceId===d.source.instanceId&&r.source.effectIndex<=d.source.effectIndex&&d.source.effectIndex<r.source.effectIndex+32&&r.startsAtTick<=at)){
   const bonus=d.effect.bonusBps;bonuses=new Set([...bonuses].flatMap(n=>[n,n+bonus]));
  }
 }
 return new Set([...bonuses].map(n=>Math.floor((basis.base+basis.flat)*(10000+basis.bps+n)/10000)));
}
/** HP at an earlier grant is not retained in schema5. Validate the finite set
 * of AP values obtainable from the enabled declarations, rather than current HP. */
function sampledStatCandidates(unit:CombatUnit,stat:'abilityPower'|'attackDamage',at:number,combatId:string):Set<number> {
 const base=stat==='abilityPower'?(unit.abilityPower ?? 100)+(unit.mechanics ?? []).filter(m=>m.mechanic==='archangel').reduce((n,m)=>n+Math.floor(at/m.values.periodTicks)*m.values.abilityPower,0):unit.attackDamageBase!;
 if(!unit.itemPrograms?.length)return new Set([stat==='abilityPower'?base:Math.floor(base*(10000+unit.attackDamagePercentBps!+(unit.runtime?.permanentAdBps ?? 0))/10000)]);
 let values=[{flat:0,bps:stat==='attackDamage'?unit.attackDamagePercentBps!+(unit.runtime?.permanentAdBps ?? 0):0}];const seen=new Set<string>();
 for(const d of declaredEffects(unit,combatId)) {
  if(d.effect.kind!=='modify-stat'||d.effect.modifier.stat!==stat)continue;
  if(unit.mechanismDefinitions?.periodicTasks.some(t=>canonicalSource(t.source)===canonicalSource(d.source)))continue;
  const key=canonicalSource(d.source);if(seen.has(key))continue;seen.add(key);
  const m=d.effect.modifier;
  if(m.unit!=='flat'&&m.unit!=='bps')throw new Error('Unsupported enabled sampled unit');
  const initial=compileMechanismDefinitions(unit,combatId).survivalTriggers.some(t=>t.event==='combat-start'&&t.condition.kind==='always'&&canonicalSource(t.source)===key);
  let options:number[];
  if(m.value.kind==='constant')options=initial&&m.condition.kind==='always'?[m.value.amount]:[0,m.value.amount];
  else if(m.value.kind==='counter') {
    const value=m.value;
    const cap=(compileMechanismDefinitions(unit,combatId).eventTriggers ?? []).flatMap(t=>t.counters).find(c=>c.id===value.counterId)?.cap;
    if(cap===undefined||cap===null)throw new Error('Unbounded enabled AP counter');
    options=Array.from({length:cap+1},(_,i)=>i*value.perCount);
  } else options=[0];
  values=values.flatMap(n=>options.map(v=>({...n,[m.unit]:n[m.unit as 'flat'|'bps']+v})));
 }
 return new Set(values.map(v=>Math.floor((base+v.flat)*(10000+v.bps)/10000)));
}
export const abilityPowerCandidates=(unit:CombatUnit,at:number,combatId:string)=>sampledStatCandidates(unit,'abilityPower',at,combatId);
export const attackDamageCandidates=(unit:CombatUnit,at:number,combatId:string)=>sampledStatCandidates(unit,'attackDamage',at,combatId);
