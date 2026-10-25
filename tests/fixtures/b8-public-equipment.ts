import { readRunFixture, writeRunFixture } from './g4-run-cache';
import { freezeContent } from '../../src/simulation/content/freeze';
import {
  createMatch, deployMatchUnit, nextRound, selectChoice, startMatchCombat, stepMatch, buyUnit, rerollShop, rerollAugment, selectAnomalyTarget, sellUnit,
} from '../../src/simulation/match';
import { isSellableUnit } from '../../src/simulation/seat-mechanics/forms';
import { isAnvil } from '../../src/simulation/content/anvils';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../src/simulation/match-types';
import type { LedgerCombatEvent as CombatEvent } from '../../src/simulation/combat-types';
import type { BattleHistory } from '../../src/replay';
import { readLootView } from '../../src/simulation/loot-view';
import { S13_P2_SOURCE } from '../../src/simulation/content/s13-augments-p2-source';

function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public B8 equipment fixture: ${result.reason}`);
  return result.state;
}

function observe(history: BattleHistory | undefined, before: MatchState, after: MatchState,
  events: readonly MatchEvent[], reason: 'command' | 'tick'): void {
  history?.observe({ before, after, reason, events: events.filter((event): event is CombatEvent => event.domain === 'combat') });
}

// Different component requests repeatedly traverse identical public-route prefixes.
// Cache complete MatchState only; history callers still record every live tick.
const finishedBattles = new Map<string, MatchState>();
function copyFixture(state: MatchState): MatchState {
  const copy = structuredClone(state);
  freezeContent(copy.m8); freezeContent(copy.resourceProvenance);
  if (copy.combatInputBasis) freezeContent(copy.combatInputBasis);
  return copy;
}
/** Record the real opening, including every combat step, when an archive is requested. */
export function finishPublicEquipmentBattle(input: MatchState, history?: BattleHistory): MatchState {
  const key = history ? undefined : JSON.stringify(input);
  const cached = key === undefined ? undefined : finishedBattles.get(key) ?? readRunFixture<MatchState>('battle', key);
  if (cached) return copyFixture(cached);
  const started = startMatchCombat(input);
  let state = accepted(started);
  if (!started.ok) throw new Error(started.reason);
  observe(history, input, state, started.events, 'command');
  for (let tick = 0; tick < 1201 && state.phase === 'combat'; tick++) {
    const next = stepMatch(state);
    observe(history, state, next.state, next.events, 'tick');
    state = next.state;
  }
  if (state.phase !== 'settlement' && state.phase !== 'choice') {
    throw new Error(`Public B8 equipment fixture did not finish ${state.roundDefinitionId}: ${state.phase}`);
  }
  if (key !== undefined) {
    if (finishedBattles.size >= 128) finishedBattles.delete(finishedBattles.keys().next().value!);
    finishedBattles.set(key, copyFixture(state));
    writeRunFixture('battle', key, state);
  }
  return state;
}

function choose(state: MatchState, definitionId: string): MatchState {
  const choice = state.pendingChoice;
  if (state.phase !== 'choice' || !choice) throw new Error(`Missing public choice in ${state.roundDefinitionId}`);
  return accepted(selectChoice(state, choice.choiceId, choice.generation, definitionId));
}

export function resolvePublicEquipmentChoices(input: MatchState, component = 'gloves'): MatchState {
  let state = input;
  while (state.phase === 'choice') {
    const choice = state.pendingChoice!;
    if (choice.kind === 'anomaly') throw new Error('Public equipment fixture does not select anomalies');
    const id = choice.kind === 'component' ? component
      : ['bulky-buddies-i', 'manaflow-i'].find(id => choice.offers.includes(id))
        ?? choice.offers.find(id => id !== 'placebo' && id !== 'glass-cannon-i')!;
    state = choose(state, id);
  }
  return state;
}

export function benchPublicEquipmentPlayers(input: MatchState): MatchState {
  let state = input;
  // v22 opening structures (Trainer Golem) cannot be benched; they stay on the board.
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board' && isSellableUnit(unit.definitionId))) {
    const used = new Set(state.preparation.units.flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: state.preparation.benchSize }, (_, index) => index).find(index => !used.has(index));
    if (slot === undefined) throw new Error('Public B8 equipment fixture has no bench slot');
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return state;
}

const preparations = new Map<string, MatchState>();
/** T13: requested assets come from random PvE drops plus the five real supply choices.
 * Extra drops are retained. Route timing and item IDs are discovered, never rewritten.
 * Original Irelia/Lux stay one star for independent equipment stat assertions.
 */
export function publicEquipmentPreparation(components: readonly string[],
  options: { seed?: number; history?: BattleHistory; augmentPriorities?: readonly string[]; rerollForAugment?: boolean; earliestRound?: number } = {}): MatchState {
  if (!components.length || components.length > 4) throw new Error('Public equipment fixture requires one to four components');
  // Seed 38 supplies gloves in the opening and 3-7. Use it for multi-item
  // glove recipes, leaving real supply choices for their other ingredients.
  const seed=options.seed??(components.length>=3&&components.filter(id=>id==='gloves').length>=2?38:42),key=JSON.stringify([seed,components,options.augmentPriorities??[],options.earliestRound??4,options.rerollForAugment??false]);
  if (!options.history) {
    const cached = preparations.get(key) ?? readRunFixture<MatchState>('preparation', key);
    if (cached) { preparations.set(key, cached); return copyFixture(cached); }
  }
  let state=createMatch(seed);
  const missing=()=>{
    const available=state.items.filter(i=>i.location.kind==='inventory').map(i=>i.definitionId);
    return components.filter(id=>{const index=available.indexOf(id);if(index<0)return true;available.splice(index,1);return false;});
  };
  for(let budget=0;budget<80;budget++){
    while(state.phase==='choice'){
      const choice=state.pendingChoice!;
      if(choice.kind==='augment'&&options.rerollForAugment&&!options.augmentPriorities?.some(id=>choice.offers.includes(id))){
        const slot=choice.rerolledSlots?.findIndex(used=>!used)??-1;
        if(slot>=0){state=accepted(rerollAugment(state,choice.choiceId,choice.generation,slot));continue;}
      }
      if(choice.kind==='anomaly'&&choice.step==='target'){
        const unit=state.preparation.units.find(u=>u.team==='player'&&!['irelia','lux'].includes(u.definitionId))!;
        state=accepted(selectAnomalyTarget(state,choice.choiceId,choice.generation,unit.id));continue;
      }
      const id=choice.kind==='component'?missing()[0]??'sword':choice.kind==='anomaly'?choice.offers[0]
        :[...options.augmentPriorities??[],'bulky-buddies-i','manaflow-i','pumping-up-i'].find(id=>choice.offers.includes(id))
          ??choice.offers.find(id=>!(id in S13_P2_SOURCE))??choice.offers[0];
      state=choose(state,id);
    }
    if(state.phase==='preparation'&&state.round>=(options.earliestRound??4)&&!missing().length){
      while(state.preparation.units.filter(u=>u.team==='player').length>state.preparation.benchSize){
        const excess=[...state.preparation.units].reverse().find(u=>u.team==='player'&&!['unit-1','unit-2','unit-3'].includes(u.id)&&isSellableUnit(u.definitionId))!;
        state=accepted(sellUnit(state,excess.id));
        // v23 routes can bank a v22 anvil here: "selling" it opens its forge choice; take the first offer publicly.
        while(state.phase==='choice'&&state.pendingChoice?.kind==='forge'&&state.pendingChoice.step==='offer')state=choose(state,state.pendingChoice.offers[0]);
      }
      state=benchPublicEquipmentPlayers(state);
      // A recorded route reaches the identical preparation. Publish it for
      // state-only consumers too, so they do not replay that acquisition again.
      preparations.set(key,structuredClone(state)); writeRunFixture('preparation', key, state); return state;
    }
    if(state.phase==='gameOver')throw Error(`Public equipment route ended before ${missing().join(',')}`);
    if(state.phase==='preparation'){
      if(state.round>3)for(let buys=0;buys<30&&state.gold>=3;buys++){
        const slot:number=state.shop.slots.findIndex(o=>o.status==='available'&&['darius','maddie','zyra','leona','rell','vander'].includes(o.definitionId)
          &&!state.preparation.units.some(u=>u.team==='player'&&['unit-1','unit-2','unit-3'].includes(u.id)&&u.definitionId===o.definitionId)
          &&state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===o.definitionId).reduce((n,u)=>n+3**(u.starLevel-1),0)<9);
        const result:MatchCommandResult=slot<0?rerollShop(state):buyUnit(state,slot,state.shop.generation);
        if(!result.ok)break;state=result.state;
      }
      // v22 anvils are bench-only units.
      for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&!isAnvil(u.definitionId))){
        const held=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');if(held.length>=state.level)break;
        const col=[3,2,4,1,5,0,6].find(col=>!held.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===7))!;
        state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row:7}}));
      }
      state=finishPublicEquipmentBattle(state,options.history);
    }
    if(state.phase==='settlement'){
      // Random hero bundles can fill the reserve before all requested components arrive.
      // Use the public capacity recovery sale, retaining the original equipment holders.
      while(readLootView(state).pendingClaims.length){
        const reserve=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&!['unit-1','unit-2','unit-3'].includes(u.id)&&isSellableUnit(u.definitionId));
        if(!reserve)throw Error('Public equipment route has no expendable capacity reserve');
        state=accepted(sellUnit(state,reserve.id));
      }
      state=accepted(nextRound(state,state.round));
    }
  }
  throw Error('Public equipment route budget');
}
