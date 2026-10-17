import {createCombatWithEvents,stepCombat} from './combat';
import type {CombatState} from './combat-types';
import type {CombatInputBasis} from './combat-input';
import type {StrategySnapshot} from './strategy-types';
import {canonicalContent} from './content';

/** Money authority cannot be the candidate's own receipt list. Independently
 * replay only gold-item combats from the validated frozen input, without
 * settling or granting anything. Existing non-gold saves take no replay path. */
export function validateCombatItemGold(candidate:CombatState,basis:CombatInputBasis,strategy:StrategySnapshot):void {
  const enabled=strategy.units.some(u=>u.mechanics?.some(m=>['g24Collector','g24Gambler'].includes(m.mechanic)));
  if(!enabled){
    if(candidate.itemGoldReceipts!==undefined)throw new RangeError('Unexpected item gold receipts');
    return;
  }
  if(!Array.isArray(candidate.itemGoldReceipts)||!Number.isSafeInteger(candidate.tick)||candidate.tick<0||candidate.tick>1200)throw new RangeError('Invalid item gold checkpoint');
  let expected=createCombatWithEvents(basis.inputs.preparation,strategy,basis.combatId,basis.battleSeed).state;
  while(expected.tick<candidate.tick&&expected.status==='running')expected=stepCombat(expected).state;
  if(expected.tick!==candidate.tick||canonicalContent(expected.itemGoldReceipts)!==canonicalContent(candidate.itemGoldReceipts)
    ||canonicalContent(expected.itemRandomStreams)!==canonicalContent(candidate.itemRandomStreams)
    ||expected.units.some(u=>candidate.units.find(c=>c.id===u.id)?.currentItemBankGold!==u.currentItemBankGold))throw new RangeError('Invalid authoritative item gold replay');
}
