import { describe,it,expect } from 'vitest';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { generateChoices } from '../src/simulation/choices';
import { selectChoice,stepMatch,startMatchCombat } from '../src/simulation/match';
import { serializeMatch,restoreMatch } from '../src/simulation/serialization';
import { accepted,reachRound } from './match-helpers';

describe('W4 and S13 P2 public choice and acquisition receipt',()=>{
 it.each([0,1,42,123456789,4294967295])('seed %i consumes exactly three independently calculated LCG words',seed=>{
  const ids=Object.keys(AUGMENT_DEFINITIONS).sort(),pool=[...ids];let rng=BigInt(seed);
  for(let i=0;i<3;i++){rng=(rng*1664525n+1013904223n)%4294967296n;const j=i+Number(rng)% (pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
  expect(ids).toHaveLength(44);expect(generateChoices(ids,seed)).toEqual({offers:pool.slice(0,3),choiceRngState:Number(rng)});
 });
 it.each(Object.keys(AUGMENT_DEFINITIONS))('%s can be publicly selected and strictly restored from a fixed seed',id=>{
  // Deterministic seed search concerns only genuine publicly generated offers, never state mutation.
  let selectedSeed=-1;
  for(let seed=0;seed<300;seed++){const state=reachRound('2-1',false,seed);if(state.pendingChoice?.offers.includes(id)){selectedSeed=seed;break;}}
  expect(selectedSeed).toBeGreaterThanOrEqual(0);const state=reachRound('2-1',false,selectedSeed),choice=state.pendingChoice!;
  const invalid=selectChoice(state,choice.choiceId,choice.generation+1,id);expect(invalid.ok).toBe(false);expect(invalid.state).toBe(state);expect("events" in invalid).toBe(false);
  const gold=AUGMENT_DEFINITIONS[id].effects.reduce((sum,e)=>sum+(e.kind==='mechanic'&&e.mechanic==='acquisitionGold'?e.values.amount:0),0);
  const result=selectChoice(state,choice.choiceId,choice.generation,id),after=accepted(result);
  expect(after.gold-state.gold).toBe(gold);expect(after.choiceRngState).toBe(state.choiceRngState);
  expect(after.scheduleReceipts.filter(r=>r.eventId===choice.eventId)).toHaveLength(1);
  expect(restoreMatch(serializeMatch(after))).toEqual(after);
  const duplicate=selectChoice(after,choice.choiceId,choice.generation,id);expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(after);expect("events" in duplicate).toBe(false);
  const forged=JSON.parse(serializeMatch(after));forged.scheduleReceipts.find((r:{eventId:string})=>r.eventId===choice.eventId).gold++;
  expect(()=>restoreMatch(forged)).toThrow();
  const started=accepted(startMatchCombat(after));expect(restoreMatch(serializeMatch(started))).toEqual(started);
  let live=started;for(let i=0;i<3&&live.phase==='combat';i++)live=stepMatch(live).state;
  expect(restoreMatch(serializeMatch(live))).toEqual(live);
 });
});
