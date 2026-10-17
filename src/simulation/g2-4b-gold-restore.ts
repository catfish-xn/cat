import {createCombatWithEvents,stepCombat} from './combat';
import type {CombatState} from './combat-types';
import type {CombatInputBasis} from './combat-input';
import type {StrategySnapshot} from './strategy-types';
import {canonicalContent} from './content';

/** Banishment suspends mechanism clocks, so the normal per-tick structural
 * validator is not its authority. Require exact reconstruction of the entire
 * combat, not a candidate-supplied absence flag or weaker clock bounds. */
export function validateZephyrCombat(candidate:CombatState,basis:CombatInputBasis,strategy:StrategySnapshot):boolean {
  if(!strategy.units.some(u=>u.mechanics?.some(m=>m.mechanic==='g24Zephyr'))){
    if(candidate.units.some(u=>u.itemBanish!==undefined))throw new RangeError('Unexpected item banishment');
    return false;
  }
  let expected=createCombatWithEvents(basis.inputs.preparation,strategy,basis.combatId,basis.battleSeed).state;
  while(expected.tick<candidate.tick&&expected.status==='running')expected=stepCombat(expected).state;
  if(canonicalContent(expected)!==canonicalContent(candidate))throw new RangeError('Invalid authoritative Zephyr replay');
  return true;
}

/** Money authority cannot be the candidate's own receipt list. Independently
 * replay only gold-item combats from the validated frozen input, without
 * settling or granting anything. Existing non-gold saves take no replay path. */
export function validateCombatItemGold(candidate:CombatState,basis:CombatInputBasis,strategy:StrategySnapshot):void {
  const enabled=strategy.units.some(u=>u.mechanics?.some(m=>['g24Collector','g24Gambler','g24Mogul'].includes(m.mechanic)));
  if(!enabled){
    if(candidate.itemGoldReceipts!==undefined)throw new RangeError('Unexpected item gold receipts');
    return;
  }
  if(!Array.isArray(candidate.itemGoldReceipts)||!Number.isSafeInteger(candidate.tick)||candidate.tick<0||candidate.tick>1200)throw new RangeError('Invalid item gold checkpoint');
  let expected=createCombatWithEvents(basis.inputs.preparation,strategy,basis.combatId,basis.battleSeed).state;
  while(expected.tick<candidate.tick&&expected.status==='running')expected=stepCombat(expected).state;
  if(expected.tick!==candidate.tick||canonicalContent(expected.itemGoldReceipts)!==canonicalContent(candidate.itemGoldReceipts)
    ||canonicalContent(expected.itemRandomStreams)!==canonicalContent(candidate.itemRandomStreams)
    ||expected.units.some(u=>candidate.units.find(c=>c.id===u.id)?.currentItemBankGold!==u.currentItemBankGold||canonicalContent(candidate.units.find(c=>c.id===u.id)?.itemMogulHits??null)!==canonicalContent(u.itemMogulHits??null)))throw new RangeError('Invalid authoritative item gold replay');
}
