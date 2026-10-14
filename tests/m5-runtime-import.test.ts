import {beforeAll,describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import {restoreMatch} from '../src/simulation/serialization';
import {sourceKey} from '../src/simulation/combat-s13-state';
import {purchasedThreeHeroMatch,accepted} from './match-helpers';
import type {MatchState} from '../src/simulation/match-types';

// Reach real transient records through normal commands/ticks. These are import
// consistency tests, not independent proofs of the numerical combat rules.
const frames:Record<string,MatchState>={};
beforeAll(()=>{
 let state=accepted(api.startMatchCombat(purchasedThreeHeroMatch()));
 while(state.phase==='combat'){
  for(const field of ['shieldLayers','statuses','tasks'] as const)
   if(!frames[field]&&state.combat.units.some(unit=>(unit[field]?.length??0)>0))frames[field]=state;
  if(Object.keys(frames).length===3)break;
  state=api.stepMatch(state).state;
 }
 expect(Object.keys(frames).sort()).toEqual(['shieldLayers','statuses','tasks']);
});
function changed(field:string,mutate:(unit:any,state:any)=>void){
 const original=frames[field],copy=JSON.parse(JSON.stringify(original));
 const unit=copy.combat.units.find((u:any)=>u[field]?.length);mutate(unit,copy);
 expect(()=>restoreMatch(copy)).toThrow();
 expect(()=>restoreMatch(JSON.stringify(copy))).toThrow();
 expect(restoreMatch(original)).toEqual(original);
}
describe('schema5 validates transient source layers and scheduled work',()=>{
 it('rejects duplicate shield layers even with a matching aggregate',()=>changed('shieldLayers',u=>{u.shieldLayers.push({...u.shieldLayers[0]});u.shield+=u.shieldLayers[0].remaining;}));
 it('rejects unknown source owner',()=>changed('shieldLayers',u=>{u.shieldLayers[0].source.ownerId='unknown-owner';}));
 it('rejects an invented trait source even if its layer key is self-consistent',()=>changed('shieldLayers',u=>{const l=u.shieldLayers[0];l.source.sourceKind='trait';l.source.definitionId='invented-trait';l.key=sourceKey(l.source);}));
 it('rejects a real ability ID belonging to a different owner',()=>changed('shieldLayers',u=>{const l=u.shieldLayers[0];l.source.definitionId=l.source.definitionId==='lux-ability'?'irelia-ability':'lux-ability';l.key=sourceKey(l.source);}));
 it('rejects array-wrapped source definitions',()=>changed('shieldLayers',u=>{u.shieldLayers[0].source.definitionId=[u.shieldLayers[0].source.definitionId];}));
 it('rejects shield totals inconsistent with their layers',()=>changed('shieldLayers',u=>{u.shield++;}));
 it('rejects a remaining layer after its expiration',()=>changed('shieldLayers',(u,s)=>{u.shieldLayers[0].remaining=1;u.shieldLayers[0].expiresAtTick=s.combat.tick;}));
 it('rejects duplicate active statuses',()=>changed('statuses',u=>{u.statuses.push({...u.statuses[0]});}));
 it('rejects unknown status kinds',()=>changed('statuses',u=>{u.statuses[0].kind='unlimited-stacks';}));
 it('rejects reduction above 100 percent',()=>changed('statuses',u=>{u.statuses[0].kind='damageReduction';u.statuses[0].amount=10001;}));
 it('rejects expired retained statuses',()=>changed('statuses',(u,s)=>{u.statuses[0].expiresAtTick=s.combat.tick;}));
 it('rejects duplicate scheduled tasks',()=>changed('tasks',u=>{u.tasks.push({...u.tasks[0]});}));
 it('rejects overdue scheduled tasks',()=>changed('tasks',(u,s)=>{u.tasks[0].executeAtTick=s.combat.tick;}));
 it('rejects impossible shot ordinals',()=>changed('tasks',u=>{u.tasks[0].ordinal=u.tasks[0].total;}));
 it('rejects absent scheduled targets',()=>changed('tasks',u=>{u.tasks[0].targetId='unknown-target';}));
});
