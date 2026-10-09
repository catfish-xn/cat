import { expect } from 'vitest';
import { createMatch, buyUnit, nextRound, selectChoice, selectAnomalyTarget, deployMatchUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState } from '../src/simulation/match';

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function accepted(result: MatchCommandResult): MatchState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
export function deployed(): MatchState {
  let state = readyMatch();
  for (const [index, {id}] of state.preparation.units.filter(unit=>unit.team==='player').entries()) {
    state = accepted(deployMatchUnit(state, id, { kind: 'board', cell: { col: 1 + index * 2, row: 4 } }));
  }
  return state;
}
export function finish(input: MatchState): MatchState {
  let state = input;
  for (let i = 0; i < 1201 && state.phase === 'combat'; i++) state = stepMatch(state).state;
  expect(['settlement', 'gameOver', 'choice']).toContain(state.phase);
  if (state.phase === 'choice') expect(state.pendingChoice?.returnPhase).toBe('settlement');
  return state;
}
export function battle(): MatchState { return accepted(startMatchCombat(deployed())); }

/** Completes only publicly offered opening/round choices, without injecting any resource. */
export function resolveM5Choices(initial: MatchState): MatchState {
  let state = initial;
  while (state.phase === 'choice') {
    const c = state.pendingChoice!;
    state = accepted(c.step === 'target' ? selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player')!.id)
      : selectChoice(state,c.choiceId,c.generation,c.kind === 'augment' ? c.offers.find(id=>id !== 'placebo' && id !== 'glass-cannon-i')! : c.offers[0]));
  }
  return state;
}
export function readyMatch(seed = 42): MatchState { return resolveM5Choices(createMatch(seed)); }
export function emptyBoard(initial = readyMatch()): MatchState {
  let state = initial;
  for (const unit of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')) {
    const used=new Set(state.preparation.units.flatMap(u=>u.location.kind==='bench'?[u.location.slot]:[]));
    const slot=Array.from({length:state.preparation.benchSize},(_,i)=>i).find(i=>!used.has(i))!;
    state=accepted(deployMatchUnit(state,unit.id,{kind:'bench',slot}));
  }
  return state;
}

/** Real public commands reach a semantic node; no resources, heroes or receipts are injected. */
export function reachRound(roundId:string, resolveChoices=true, seed=42): MatchState {
  let state=createMatch(seed);
  while(state.roundDefinitionId!==roundId) {
    state=resolveM5Choices(state);
    if(state.phase==='preparation') state=accepted(startMatchCombat(emptyBoard(state)));
    state=resolveM5Choices(state);
    if(state.phase!=='settlement') throw new Error(`Cannot reach ${roundId} from ${state.roundDefinitionId}/${state.phase}`);
    state=accepted(nextRound(state,state.round));
  }
  return resolveChoices?resolveM5Choices(state):state;
}

/** Seed-42 multi-holder fixture acquired entirely through normal opening/shops.
 * These paid purchases are not B8 rewards and do not prove the opening loot chain. */
export function purchasedThreeHeroMatch():MatchState {
  let state=reachRound('2-1');
  state=accepted(deployMatchUnit(state,'unit-1',{kind:'board',cell:{col:1,row:4}}));
  for(const id of ['maddie','lux']) {
    const slot=state.shop.slots.findIndex(s=>s.status==='available'&&s.definitionId===id);
    state=accepted(buyUnit(state,slot,state.shop.generation));
    const serial=state.nextUnitSerial-1;
    state=accepted(deployMatchUnit(state,`unit-${serial}`,{kind:'board',cell:{col:serial===2?3:5,row:7}}));
  }
  return state;
}
