import { expect, it } from 'vitest';
import { rerollAugment, selectChoice, startMatchCombat, nextRound } from '../src/simulation/match';
import { augmentCandidates, deriveAugmentTier } from '../src/simulation/augment-offers';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { nextRandom } from '../src/simulation/rng';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { runSharedMatchCommand } from '../src/simulation/shared-pool';
import { decideBotAction } from '../src/simulation/bot';
import type { MatchState } from '../src/simulation/match-types';
import { validateAugmentReroll } from './fixtures/m5/oracle.g2.cjs';
import { accepted, emptyBoard, freeze, reachRound, resolveM5Choices } from './match-helpers';
import { accept, conserved, rejected, room } from './tp-helpers';
import { context } from './t7-helpers';

it.each([[2,0,1], [0,1,2]])('each slot is usable exactly once in command order %j', (...order) => {
  let state = reachRound('2-1', false);
  // v22: the opening three are already seen; each reroll result joins them.
  const choiceId = state.pendingChoice!.choiceId, removed: string[] = [...state.pendingChoice!.offers];
  let rng = state.choiceRngState;
  for (const optionIndex of order) {
    const before = freeze(state), c = before.pendingChoice!, generation = c.generation;
    const candidates = augmentCandidates(c.augmentTier!, before.augments, [...removed,...c.offers]).sort();
    // Independent arithmetic for the sole word and selected index (not the production draw helper).
    rng = Number((BigInt(rng)*1664525n+1013904223n)%4294967296n);
    const result = rerollAugment(before, choiceId, generation, optionIndex);
    validateAugmentReroll(before, result, {type:'rerollAugment',choiceId,generation,optionIndex});
    state = accepted(result);
    const after = state.pendingChoice!;
    expect(after.offers[optionIndex]).toBe(candidates[rng%candidates.length]);
    expect(state.choiceRngState).toBe(rng);
    for (let i=0;i<3;i++) if(i!==optionIndex) expect(after.offers[i]).toBe(c.offers[i]);
    expect(removed).not.toContain(after.offers[optionIndex]);
    removed.push(after.offers[optionIndex]);
    expect(state.removedAugmentIds).toEqual(removed);
    expect(new Set(after.offers).size).toBe(3);
    expect(after.offers.every(id=>AUGMENT_TIERS[id]===c.augmentTier && removed.includes(id))).toBe(true);
    const exhausted = rerollAugment(state,choiceId,after.generation,optionIndex);
    expect(exhausted).toEqual({ok:false,state,reason:'augment-rerolls-exhausted'});
    expect(exhausted.state).toBe(state);
    state = restoreMatch(serializeMatch(state));
  }
  expect(state.pendingChoice).toMatchObject({generation:3,rerollCount:3,rerollsRemaining:0,rerolledSlots:[true,true,true]});
  expect(state.augmentOffers[0].rerolledIndices).toEqual(order);
  expect(toPrivateSeatView(state).pendingChoice!.augmentOptions!.every(o=>!o.rerollAvailable)).toBe(true);
  const c=state.pendingChoice!;
  const selected=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));
  expect(restoreMatch(serializeMatch(selected))).toEqual(selected);
});

it('v22: permanently excludes every shown ID at every later node, including two silver nodes from the approved silver/silver/gold combination', () => {
  const nodes=['2-1','3-2','4-2'];
  const seed=Array.from({length:1000},(_,i)=>i).find(seed=>nodes.map(id=>deriveAugmentTier(seed,`round:${id}:augment`)).join(',')==='silver,silver,gold')!;
  expect(seed).toBeDefined();
  // Synthetic survival budget isolates candidate admission through all three nodes.
  // Save/restore is verified separately on unmodified public states.
  let state=reachRound('2-1',false,seed);
  const removed: string[]=[];
  for (const node of nodes) {
    while(state.roundDefinitionId!==node) {
      state=resolveM5Choices(state);
      if(state.phase==='preparation') state=accepted(startMatchCombat(emptyBoard({...state,playerHp:100})));
      state=resolveM5Choices(state);
      state=accepted(nextRound(state,state.round));
    }
    expect(state.pendingChoice).toMatchObject({augmentTier:deriveAugmentTier(seed,`round:${node}:augment`),rerolledSlots:[false,false,false],generation:0});
    expect(state.pendingChoice!.offers.every(id=>!removed.includes(id))).toBe(true);
    removed.push(...state.pendingChoice!.offers);
    for(const optionIndex of [1,2,0]) {
      const c=state.pendingChoice!;
      state=accepted(rerollAugment(freeze(state),c.choiceId,c.generation,optionIndex));
      expect(removed).not.toContain(state.pendingChoice!.offers[optionIndex]);
      removed.push(state.pendingChoice!.offers[optionIndex]);
      expect(state.pendingChoice!.offers.every(id=>!state.augments.some(a=>a.definitionId===id))).toBe(true);
    }
  }
  expect(state.removedAugmentIds).toEqual(removed);
  expect(new Set(removed).size).toBe(18);
  expect(state.augmentOffers.map(r=>r.rerolledIndices)).toEqual([[1,2,0],[1,2,0],[1,2,0]]);
});

it.each([undefined,-1,3,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects invalid slot %s without consuming anything', optionIndex => {
  const state=freeze(reachRound('2-1',false)),c=state.pendingChoice!,snapshot=JSON.stringify(state);
  const result=rerollAugment(state,c.choiceId,c.generation,optionIndex);
  expect(result).toEqual({ok:false,state,reason:'invalid-slot'});
  expect(result.state).toBe(state); expect(JSON.stringify(state)).toBe(snapshot);
});

it('draws the last candidate successfully, then refuses an empty pool without using the slot', () => {
  const original=reachRound('2-1',false),c=original.pendingChoice!;
  const candidates=augmentCandidates(c.augmentTier!,[],c.offers);
  // Synthetic finite-catalog vector: exactly one ID remains after owned and removed filtering.
  const owned=candidates.slice(0,1).map(definitionId=>({definitionId,choiceId:'prior',acquiredRound:1}));
  // v22 invariant: the shown offers are part of the seen ledger.
  const before=freeze({...original,augments:owned,removedAugmentIds:[...c.offers,...candidates.slice(2)]});
  const after=accepted(rerollAugment(before,c.choiceId,0,2));
  expect(after.pendingChoice!.offers[2]).toBe(candidates[1]);
  expect(after.choiceRngState).toBe(nextRandom(before.choiceRngState).state);
  expect(after.pendingChoice!.rerolledSlots).toEqual([false,false,true]);
  const failed=rerollAugment(freeze(after),c.choiceId,1,0);
  expect(failed).toEqual({ok:false,state:after,reason:'augment-pool-too-small'});
  expect(failed.state).toBe(after);
  expect(toPrivateSeatView(after).pendingChoice!.augmentOptions!.every(o=>!o.rerollAvailable)).toBe(true);
});

it('shared command uses the same per-player rules, survives JSON persistence and leaves other players eligible', () => {
  const shared=room(undefined,2),privateChoice=reachRound('2-1',false,42);
  // Synthetic seat attachment isolates the TP transaction from battle scheduling.
  let pool=shared.pool;
  let state:MatchState={...shared.states[0],pendingChoice:privateChoice.pendingChoice,
    phase:'choice',combat:null,choiceRngState:privateChoice.choiceRngState,augmentOffers:privateChoice.augmentOffers};
  const other=freeze(shared.states[1]),c=state.pendingChoice!;
  const initialAvailable={...pool.available},holdings=structuredClone(pool.holdings);
  const result=accept(runSharedMatchCommand(freeze(pool),freeze(state),{type:'rerollAugment',choiceId:c.choiceId,generation:0,optionIndex:1}));
  expect(result.pool.revision).toBe(pool.revision+1);
  expect(result.state.sharedPool!.revision).toBe(state.sharedPool!.revision+1);
  expect(result.poolEvents).toEqual([]);
  pool=result.pool;state=result.state;
  expect(state.removedAugmentIds).toEqual([state.pendingChoice!.offers[1]]);
  expect(other.removedAugmentIds).toEqual([]);
  expect(augmentCandidates(c.augmentTier!,other.augments,other.removedAugmentIds)).toContain(c.offers[1]);
  expect(pool.available).toEqual(initialAvailable);expect(pool.holdings).toEqual(holdings);
  conserved(pool,[state,other]);
  const saved=JSON.parse(JSON.stringify({pool,state}));
  rejected(runSharedMatchCommand(saved.pool,saved.state,{type:'rerollAugment',choiceId:c.choiceId,generation:1,optionIndex:1}),saved.pool,saved.state,'augment-rerolls-exhausted');
  rejected(runSharedMatchCommand(pool,state,{type:'rerollAugment',choiceId:c.choiceId,generation:0,optionIndex:0}),pool,state,'stale-choice');
  rejected(runSharedMatchCommand(pool,state,{type:'rerollAugment',choiceId:c.choiceId,generation:1,optionIndex:3}),pool,state,'invalid-slot');
  const continued=accept(runSharedMatchCommand(saved.pool,saved.state,{type:'rerollAugment',choiceId:c.choiceId,generation:1,optionIndex:0}));
  expect(continued.state.removedAugmentIds).toEqual([state.pendingChoice!.offers[1],continued.state.pendingChoice!.offers[0]]);
  expect(continued.state.pendingChoice!.rerolledSlots).toEqual([true,true,false]);
  const locked={...state,multiplayer:{...state.multiplayer!,combatRosterLocked:true as const}};
  rejected(runSharedMatchCommand(pool,locked,{type:'rerollAugment',choiceId:c.choiceId,generation:1,optionIndex:0}),pool,locked,'wrong-phase');
  const botState=accepted(rerollAugment(privateChoice,c.choiceId,0,1));
  const bot=decideBotAction(botState,context(botState),0);
  expect(bot.action).toMatchObject({type:'choose',choiceId:c.choiceId,generation:1,definitionId:botState.pendingChoice!.offers[0]});
  expect('removedAugmentIds' in toPrivateSeatView(state)).toBe(false);
  expect('augmentOffers' in toPrivateSeatView(state)).toBe(false);
});
