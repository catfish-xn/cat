import { expect } from 'vitest';
import { createMatch, buyUnit, nextRound, rerollAugment, selectChoice, selectAnomalyTarget, deployMatchUnit, startMatchCombat, stepMatch, getDeploymentCap, type MatchCommandResult, type MatchState } from '../src/simulation/match';

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function accepted(result: MatchCommandResult): MatchState {
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
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
export function resolveM5Choices(initial: MatchState, augmentPriorities: readonly string[] = [], excludedAugments: readonly string[] = []): MatchState {
  let state = initial;
  while (state.phase === 'choice') {
    const c = state.pendingChoice!;
    state = accepted(c.step === 'target' ? selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player')!.id)
      : selectChoice(state,c.choiceId,c.generation,c.kind === 'augment' ? augmentPriorities.find(id => c.offers.includes(id)) ?? c.offers.find(id=>id !== 'placebo' && id !== 'glass-cannon-i' && !excludedAugments.includes(id))! : c.offers[0]));
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
export function reachRound(roundId:string, resolveChoices=true, seed=42, augmentPriorities: readonly string[] = [], excludedAugments: readonly string[] = []): MatchState {
  let state=createMatch(seed);
  while(state.roundDefinitionId!==roundId) {
    state=resolveM5Choices(state, augmentPriorities, excludedAugments);
    if(state.phase==='preparation') state=accepted(startMatchCombat(emptyBoard(state)));
    state=resolveM5Choices(state, augmentPriorities, excludedAugments);
    if(state.phase!=='settlement') throw new Error(`Cannot reach ${roundId} from ${state.roundDefinitionId}/${state.phase}`);
    state=accepted(nextRound(state,state.round));
  }
  return resolveChoices?resolveM5Choices(state, augmentPriorities, excludedAugments):state;
}

/** Deploys bench units to free front cells up to the population cap (public deploy commands only). */
export function fieldBench(initial: MatchState): MatchState {
  let state = initial;
  for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')) {
    const used = new Set(state.preparation.units.flatMap(u => u.team === 'player' && u.location.kind === 'board' ? [`${u.location.cell.col},${u.location.cell.row}`] : []));
    if (used.size >= getDeploymentCap(state)) break;
    for (let i = 0; i < 28; i++) {
      const cell = { col: i % 7, row: 4 + Math.floor(i / 7) };
      if (used.has(`${cell.col},${cell.row}`)) continue;
      const deployed = deployMatchUnit(state, unit.id, { kind: 'board', cell });
      if (deployed.ok) { state = deployed.state; break; }
    }
  }
  return state;
}
/** Like reachRound, but fields the bench and fights every battle, so empty-board losses do not end the match before
 * 4-2 (augments offered only at 4-2 by their 14.24 stage tags). */
export function reachRoundFielded(roundId: string, seed = 42): MatchState {
  let state = createMatch(seed);
  while (state.roundDefinitionId !== roundId) {
    state = resolveM5Choices(state);
    if (state.phase === 'preparation') { state = accepted(startMatchCombat(fieldBench(state))); while (state.phase === 'combat') state = stepMatch(state).state; }
    state = resolveM5Choices(state);
    if (state.phase !== 'settlement') throw new Error(`Cannot reach ${roundId} from ${state.roundDefinitionId}/${state.phase}`);
    state = accepted(nextRound(state, state.round));
  }
  return state;
}

/** Public 2-1 pick that adds no combat mechanic of its own (a quiet economy card, else a trait crest), using the free
 * per-slot rerolls when needed, so augment pool growth cannot route a fixture's saves through exact replay. */
export function quietAugmentRound(seed:number):MatchState {
  const quiet=['big-grab-bag','heroic-grab-bag','raining-gold','raining-gold-plus','iron-assets','item-grab-bag-i','team-building','rolling-for-days-i','trade-sector','what-doesnt-kill-you','spoils-of-war-i','spoils-of-war-ii','latent-forge','crown-guarded','not-today'];
  const wanted=(offers:readonly string[])=>offers.find(id=>quiet.includes(id))??offers.find(id=>id.endsWith('-crest'));
  let open=reachRound('2-1',false,seed);
  for(let slot=0;slot<3&&!wanted(open.pendingChoice!.offers);slot++){const c=open.pendingChoice!,r=rerollAugment(open,c.choiceId,c.generation,slot);if(r.ok)open=r.state;}
  const c=open.pendingChoice!,id=wanted(c.offers);
  if(!id)throw new Error(`seed ${seed} offers no quiet 2-1 card: ${c.offers.join(',')}`);
  return resolveM5Choices(accepted(selectChoice(open,c.choiceId,c.generation,id)));
}
/** Seed-221 multi-holder fixture acquired entirely through normal opening/shops.
 * These paid purchases are not B8 rewards and do not prove the opening loot chain.
 * v23: seed 5 now draws Artifact Anvil (anvil at unit-2); seed 221 keeps a lone Irelia with Maddie and Lux in the 2-1 shop. */
export function purchasedThreeHeroMatch():MatchState {
  // v23 batch 3: pick publicly instead of taking the seed's first card (pool growth can make it a replay-validated augment).
  let state=quietAugmentRound(221);
  state=accepted(deployMatchUnit(state,'unit-1',{kind:'board',cell:{col:1,row:4}}));
  for(const id of ['maddie','lux']) {
    const slot=state.shop.slots.findIndex(s=>s.status==='available'&&s.definitionId===id);
    state=accepted(buyUnit(state,slot,state.shop.generation));
    const serial=state.nextUnitSerial-1;
    state=accepted(deployMatchUnit(state,`unit-${serial}`,{kind:'board',cell:{col:serial===2?3:5,row:7}}));
  }
  return state;
}
