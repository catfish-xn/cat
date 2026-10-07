import type { ResolvedUnitStats, UnitDefinition } from '../unit-types';
import { authorizeSpellCrit } from './crit';
import { attackInterval, integer } from './stats';
import { validateManaDefinition } from './mana';
/** New neutral definitions opt into authored speed/crit inputs; legacy guards remain untouched. */
export function validateNeutralInputs(value: Pick<UnitDefinition,'unitKind'|'initialMana'|'maxMana'|'attackIntervalTicks'|'baseAttackSpeedBps'|'baseCritChanceBps'|'baseCritMultiplierBps'|'monsterFamily'>): void {
  validateManaDefinition(value);
  if(value.unitKind!=='neutral')return;
  if(!value.monsterFamily || value.baseAttackSpeedBps===undefined || value.baseCritChanceBps===undefined || value.baseCritMultiplierBps===undefined)throw new RangeError('Missing authored neutral inputs');
  integer(value.baseAttackSpeedBps,1);integer(value.baseCritChanceBps);integer(value.baseCritMultiplierBps,1);
  if(value.baseCritChanceBps>10000 || value.attackIntervalTicks!==attackInterval(value.baseAttackSpeedBps,0))throw new RangeError('Invalid authored neutral inputs');
}
/** Actual snapshot compiler used by Combat, also usable by future isolated content imports. */
export function compileUnitInputs(stats: ResolvedUnitStats): { unitKind?: 'champion'|'neutral'; monsterFamily?: string; baseAttackSpeedBps?: number; baseCritChanceBps?: number; baseCritMultiplierBps?: number; spellCrit?: ReturnType<typeof authorizeSpellCrit> } {
  if(stats.unitKind!=='neutral')return{};
  validateNeutralInputs({...stats,attackIntervalTicks:attackInterval(stats.baseAttackSpeedBps!,0)});
  return{unitKind:stats.unitKind,monsterFamily:stats.monsterFamily,baseAttackSpeedBps:stats.baseAttackSpeedBps,
    baseCritChanceBps:stats.baseCritChanceBps,baseCritMultiplierBps:stats.baseCritMultiplierBps,
    spellCrit:authorizeSpellCrit([],[],stats.baseCritChanceBps!,stats.baseCritMultiplierBps!)};
}
