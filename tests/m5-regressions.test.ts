import {describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';

function ready(){let state=api.createMatch(42);while(state.phase==='choice'){const c=state.pendingChoice!;const result=api.selectChoice(state,c.choiceId,c.generation,c.offers[0]);if(!result.ok)throw Error(result.reason);state=result.state;}return state;}
const clone=(state:api.MatchState):Record<string,any>=>JSON.parse(JSON.stringify(state));

describe('M4 coercion and atomicity boundaries remain permanent in schema5',()=>{
 it('rejects schema4 and mismatched digest with explicit errors, preserving the live state',()=>{
  const live=ready(),before=JSON.stringify(live);
  expect(()=>restoreMatch({...live,schemaVersion:4})).toThrow('unsupported-version');
  expect(()=>restoreMatch({...live,contentDigest:'fnv1a32-utf16:00000000'})).toThrow('content-digest');
  expect(JSON.stringify(live)).toBe(before);expect(restoreMatch(serializeMatch(live))).toEqual(live);
 });
 it.each(['unit','shop','item','augment','receipt','offer'])('rejects array-wrapped legal %s definition IDs in object and JSON imports',field=>{
  const bad=clone(field==='offer'?api.createMatch(42):ready());
  if(field==='unit')bad.preparation.units[0].definitionId=[bad.preparation.units[0].definitionId];
  if(field==='shop')bad.shop.slots[0].definitionId=[bad.shop.slots[0].definitionId];
  if(field==='item')bad.items[0].definitionId=[bad.items[0].definitionId];
  if(field==='augment')bad.augments[0].definitionId=[bad.augments[0].definitionId];
  if(field==='receipt')bad.scheduleReceipts[0].definitionId=[bad.scheduleReceipts[0].definitionId];
  if(field==='offer')bad.pendingChoice.offers[0]=[bad.pendingChoice.offers[0]];
  expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
 });
 it('rejects coercive choice IDs and repeated confirmation without moving RNG, receipts or IDs',()=>{
  const state=api.createMatch(42),choice=state.pendingChoice!,definitionId=choice.offers[0],before=JSON.stringify(state);
  const wrapped=api.selectChoice(state,choice.choiceId,choice.generation,[definitionId] as unknown as string);
  expect(wrapped).toEqual({ok:false,state,reason:'invalid-choice'});expect(wrapped.state).toBe(state);expect(JSON.stringify(state)).toBe(before);
  const accepted=api.selectChoice(state,choice.choiceId,choice.generation,definitionId);if(!accepted.ok)throw Error(accepted.reason);
  const repeated=api.selectChoice(accepted.state,choice.choiceId,choice.generation,definitionId);expect(repeated).toEqual({ok:false,state:accepted.state,reason:'stale-choice'});expect(repeated.state).toBe(accepted.state);
 });
 it('lock no-op is same-reference and a locked natural refresh does not consume a shop word',()=>{
  const initial=ready(),noop=api.setShopLock(initial,false,initial.shop.generation);expect(noop).toEqual({ok:true,state:initial,events:[]});expect(noop.state).toBe(initial);
  const locked=api.setShopLock(initial,true,initial.shop.generation);if(!locked.ok)throw Error(locked.reason);
  const started=api.startMatchCombat(locked.state);if(!started.ok)throw Error(started.reason);let state=started.state;
  while(state.phase==='combat')state=api.stepMatch(state).state;
  const next=api.nextRound(state,state.round);if(!next.ok)throw Error(next.reason);
  expect(next.state.shop).toEqual(locked.state.shop);expect(next.state.rngState).toBe(locked.state.rngState);
  const stale=api.setShopLock(next.state,false,next.state.shop.generation-1);expect(stale).toEqual({ok:false,state:next.state,reason:'stale-shop'});
 });
});
