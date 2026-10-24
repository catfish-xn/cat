import { overtimeStacks } from './combat-overtime';
import { MAX_COMBAT_TICKS } from './combat-types';
import { installBattleEquipmentBatch, validateBattleEquipmentLog } from './battle-equipment';
import {createCombatWithEvents,stepCombat} from './combat';
import type {CombatState} from './combat-types';
import type {CombatInputBasis} from './combat-input';
import type {StrategySnapshot} from './strategy-types';
import {canonicalContent} from './content';
import {createRestoreCombatReplay} from './restore-combat-replay';

/** Combat mechanics whose saves are authenticated only by exact replay (combat-augment-effects.ts). */
export const BATCH3_REPLAYED_MECHANICS:readonly string[]=['blazingSoul','nobleSacrifice','wealthyRehab','badLuck','goldForDummies'];

/** Opening HP is derived from authenticated inputs, never the saved owner HP. */
export function validateMirrorOpening(candidate:CombatState,basis:CombatInputBasis,strategy:StrategySnapshot):void {
  const enabled=strategy.units.some(u=>u.itemSummon?.kind==='mirror');
  const initial=enabled?createCombatWithEvents(basis.inputs.preparation,strategy,basis.combatId,basis.battleSeed).state:null;
  for(const unit of candidate.units){
    const expected=initial?.units.find(u=>u.id===unit.id)?.itemSummonOpeningMaxHp;
    if(unit.itemSummonOpeningMaxHp!==expected)throw new RangeError('Invalid authoritative Mirror opening health');
  }
}

/** Banishment suspends mechanism clocks, so the normal per-tick structural
 * validator is not its authority. Require exact reconstruction of the entire
 * combat, not a candidate-supplied absence flag or weaker clock bounds.
 * Trench also replaces the roster, so this runs before static-roster checks.
 * Every call reconstructs independently from the validated frozen basis. */
export function validateDynamicCombat(candidate:CombatState,basis:CombatInputBasis,strategy:StrategySnapshot):boolean {
  if (candidate.equipmentReceipts !== undefined || candidate.pendingEquipment !== undefined) {
    validateBattleEquipmentLog(candidate.equipmentReceipts?.map(r => r.input) ?? [], candidate.equipmentReceipts ?? [], candidate.tick);
    validateBattleEquipmentLog(candidate.pendingEquipment?.map(r => r.input) ?? [], candidate.pendingEquipment ?? [], candidate.tick + 1);
    if (candidate.pendingEquipment?.some(r => r.input.effectiveTick !== candidate.tick + 1)) throw new RangeError('Invalid pending equipment');
    let expected = createCombatWithEvents(basis.inputs.preparation, strategy, basis.combatId, basis.battleSeed).state;
    while (expected.tick < candidate.tick && expected.status === 'running') {
      expected = installBattleEquipmentBatch(expected, candidate.equipmentReceipts?.filter(r => r.input.effectiveTick === expected.tick + 1) ?? []);
      expected = stepCombat(expected).state;
    }
    if (candidate.pendingEquipment) {
      installBattleEquipmentBatch(expected, candidate.pendingEquipment); // Validate pending targets/order without advancing or publishing.
      expected = { ...expected, pendingEquipment: candidate.pendingEquipment };
    }
    if (canonicalContent(expected) !== canonicalContent(candidate)) throw new RangeError('Invalid authoritative equipment replay');
    return true;
  }
  // Batch-3 timed or unit-dependent augment contributions (and their runtime counters) have no static
  // declaration to check against, so the whole combat must be reproduced from the frozen input instead.
  const batch2=strategy.units.some(u=>u.mechanics?.some(m=>m.mechanic==='traitAugmentB2'||m.mechanic==='g23Tactician'||BATCH3_REPLAYED_MECHANICS.includes(m.mechanic)))
    // A training dummy has no static combat contract of its own, so its combats are replay-authenticated too.
    ||basis.inputs.preparation.units.some(u=>u.definitionId==='training-dummy');
  const zephyr=strategy.units.some(u=>u.mechanics?.some(m=>m.mechanic==='g24Zephyr'));
  const trench=strategy.units.some(u=>u.mechanics?.some(m=>m.mechanic==='g24Trench'));
  const mirrorForge=strategy.units.some(u=>u.itemSummon?.kind==='mirror'&&u.itemSummon.unit.definitionId==='jayce');
  const anomaly=strategy.units.some(u=>u.mechanics?.some(m=>m.mechanic==='s13Anomaly'));
  const d11=strategy.units.some(u=>u.mechanics?.some(m=>m.mechanic==='d11Anomaly'));
  const v20=strategy.units.some(u=>u.mechanics?.some(m=>['quickstriker','firelight','v20Teamup'].includes(m.mechanic)));
  const v19=strategy.units.some(u=>u.familyReunion||['warwick','viktor','mel'].includes(u.ability.kind==='s13'?u.ability.championId:'')||u.mechanics?.some(m=>['v19Garen','v19Chainblade','sisters'].includes(m.mechanic)||m.mechanic==='rebel'&&m.values.forcedPeriodTicks>0||m.mechanic==='g23Trait'&&(m.source.definitionId==='dominator'||m.source.definitionId==='black-rose'&&m.values.tier>=4)));
  // Overtime refresh can retain an older, larger shield and earlier control end.
  // Authenticate the complete trajectory instead of guessing historical stacks
  // from a refreshed layer's startsAtTick. Reuse the input-bound replay cache.
  const overtime = overtimeStacks(candidate.tick) > 0;
  if(!batch2&&!zephyr&&!trench&&!mirrorForge&&!anomaly&&!d11&&!v19&&!v20&&!overtime){
    if(candidate.units.some(u=>u.batch2!==undefined))throw new RangeError('Unexpected batch2 runtime');
    if(candidate.units.some(u=>u.v20Traits!==undefined))throw new RangeError('Unexpected V20 runtime');
    if(candidate.units.some(u=>u.v19!==undefined||u.sixCost!==undefined||u.familyReunion!==undefined))throw new RangeError('Unexpected V19 runtime');
    if(candidate.units.some(u=>u.d11Kills!==undefined))throw new RangeError('Unexpected D11 kill runtime');
    if(candidate.units.some(u=>u.anomalyState!==undefined||u.anomalySummon!==undefined))throw new RangeError('Unexpected anomaly runtime');
    if(candidate.trenchSplits!==undefined)throw new RangeError('Unexpected Trench splits');
    if(candidate.units.some(u=>u.itemSummon?.kind==='trench'))throw new RangeError('Unexpected Trench copy');
    if(candidate.units.some(u=>u.itemBanish!==undefined))throw new RangeError('Unexpected item banishment');
    return false;
  }
  if(!Number.isSafeInteger(candidate.tick)||candidate.tick<0||candidate.tick>MAX_COMBAT_TICKS)throw new RangeError('Invalid dynamic combat checkpoint');
  // Preserve the existing cold-replay contract for roster/absence/anomaly paths.
  // Ordinary v19/v20 and overtime combats reuse input-bound independent evidence.
  let expected:CombatState;
  if((batch2||v19||v20||overtime)&&!zephyr&&!trench&&!mirrorForge&&!anomaly&&!d11)expected=createRestoreCombatReplay(basis,strategy,candidate.tick).stateAtSaveTick();
  else{
    expected=createCombatWithEvents(basis.inputs.preparation,strategy,basis.combatId,basis.battleSeed).state;
    while(expected.tick<candidate.tick&&expected.status==='running')expected=stepCombat(expected).state;
  }
  if(canonicalContent(expected)!==canonicalContent(candidate))throw new RangeError(`Invalid authoritative ${anomaly?'anomaly':trench?'Trench':zephyr?'Zephyr':v19?'V19':overtime?'overtime':'Mirror forge'} replay`);
  return true;
}

/** Money authority cannot be the candidate's own receipt list. Independently
 * replay only gold-item combats from the validated frozen input, without
 * settling or granting anything. Existing non-gold saves take no replay path. */
export function validateCombatItemGold(candidate:CombatState,basis:CombatInputBasis,strategy:StrategySnapshot):void {
  const enabled=strategy.units.some(u=>u.mechanics?.some(m=>['g24Collector','g24Gambler','g24Mogul','v19Chainblade','g23Tactician'].includes(m.mechanic)));
  if(!enabled){
    if(candidate.itemGoldReceipts!==undefined)throw new RangeError('Unexpected item gold receipts');
    return;
  }
  if(!Array.isArray(candidate.itemGoldReceipts)||!Number.isSafeInteger(candidate.tick)||candidate.tick<0||candidate.tick>MAX_COMBAT_TICKS)throw new RangeError('Invalid item gold checkpoint');
  let expected=createCombatWithEvents(basis.inputs.preparation,strategy,basis.combatId,basis.battleSeed).state;
  while(expected.tick<candidate.tick&&expected.status==='running')expected=stepCombat(expected).state;
  if(expected.tick!==candidate.tick||canonicalContent(expected.itemGoldReceipts)!==canonicalContent(candidate.itemGoldReceipts)
    ||canonicalContent(expected.itemRandomStreams)!==canonicalContent(candidate.itemRandomStreams)
    ||expected.units.some(u=>candidate.units.find(c=>c.id===u.id)?.currentItemBankGold!==u.currentItemBankGold||canonicalContent(candidate.units.find(c=>c.id===u.id)?.itemMogulHits??null)!==canonicalContent(u.itemMogulHits??null)))throw new RangeError('Invalid authoritative item gold replay');
}
