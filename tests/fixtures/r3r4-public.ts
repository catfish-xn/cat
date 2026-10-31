import { isSellableUnit } from '../../src/simulation/seat-mechanics/forms';
import { combineItems, createMatch, buyUnit, rerollShop, rerollAugment, deployMatchUnit, selectChoice, startMatchCombat, stepMatch, nextRound, sellUnit } from '../../src/simulation/match';
import type { MatchState, MatchCommandResult } from '../../src/simulation/match-types';
import { isAnvil } from '../../src/simulation/content/anvils';
import { augmentNeedsHistory } from '../../src/simulation/augment-history-owners';
export function accepted(result:MatchCommandResult):MatchState { if(!result.ok) throw Error(result.reason); return result.state; }
export function finish(state:MatchState):MatchState {
  state=accepted(startMatchCombat(state));
  for(let i=0;state.phase==='combat'&&i<1201;i++)state=stepMatch(state).state;
  if(state.phase!=='settlement')throw Error(`Unexpected phase ${state.phase}`);return state;
}
const cached = new Map<string,MatchState>();
/** Augments whose saves need replayed battle history (AUGMENT_HISTORY_OWNERS or crown-history.ts rows). */
const historyBound=(id:string)=>augmentNeedsHistory(id)||id.startsWith('spoils-of-war-')||['salvage-bin','blood-brothers','a-change-of-fate','pilfer'].includes(id);
/** Quiet: no replayed history and no trait crest/crown (their emblem/unit gifts change the fixture's item set). */
const quiet=(id:string)=>!historyBound(id)&&!id.endsWith('-crown')&&!id.endsWith('-crest');
/** Seed 26 has a signed 2-7 prismatic package. Every asset is acquired by public commands. */
/** `quietAugment` (default false keeps every existing route): reroll public augment slots until an offer needs no replayed
 * history and carries no crest/crown gift, and take it instead of the first offer. v26 D5 (7953c99a) moved seed 27566's 2-1 offers so its first card is Spoils of War III, whose saves
 * need full battle history (crown-history.ts), so its plain serializeMatch is no longer possible. */
export function publicConsumables(seed=27566,quietAugment=false):MatchState {
  if(seed===162)seed=27566; // v17 independent oracle: two gloves, remover and reforger through 2-7.
  const key=`${seed}:${quietAugment}`;
  if(cached.has(key))return structuredClone(cached.get(key)!);
  let state=createMatch(seed);
  while(state.round<=10){
    while(state.phase==='choice'){
      // quietAugment: public per-slot rerolls (0, 1, 2) until a quiet card shows; the default route never rerolls.
      for(let slot=0;quietAugment&&slot<3&&state.pendingChoice!.kind==='augment'&&!state.pendingChoice!.offers.some(id=>id==='bulky-buddies-i'||quiet(id));slot++){
        const r=state.pendingChoice!;state=accepted(rerollAugment(state,r.choiceId,r.generation,slot));
      }
      const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers.find(id=>id==='bulky-buddies-i')??(quietAugment&&c.kind==='augment'?c.offers.find(quiet):undefined)??c.offers[0]));
    }
    if(state.phase==='preparation'){
      if(state.round===10)while(state.gold>=2){
        const slot:number=state.shop.slots.findIndex(o=>o.status==='available'&&['irelia','maddie','lux','darius','zyra'].includes(o.definitionId!));
        const result:MatchCommandResult=slot<0?rerollShop(state):buyUnit(state,slot,state.shop.generation);if(!result.ok)break;state=result.state;
      }
      for(const u of state.preparation.units.filter(u=>u.team==='player')){
        // v23 fmix32 openings (seed 27566: component anvils) bench anvil units, which can never be fielded.
        if(u.location.kind==='board'||isAnvil(u.definitionId))continue;
        const held=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');if(held.length>=state.level)break;
        const col=[3,2,4,1,5,0,6].find(col=>!held.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===7))!;
        state=accepted(deployMatchUnit(state,u.id,{kind:'board',cell:{col,row:7}}));
      }
      state=finish(state);
    }
    if(state.round===10)break;
    if(state.phase==='settlement')state=accepted(nextRound(state,state.round));
  }
  const gloves=state.items.filter(i=>i.definitionId==='gloves'&&i.location.kind==='inventory');
  if(gloves.length>=2)state=accepted(combineItems(state,gloves[0].id,gloves[1].id));
  while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const reserve=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&isSellableUnit(u.definitionId)&&!isAnvil(u.definitionId))!;state=accepted(sellUnit(state,reserve.id));}
  cached.set(key,state);return structuredClone(state);
}
