/** Content declarations composed exclusively from the signed G01–G11 vocabulary.
 * No item ID or display name is inspected by this compiler or the combat executor. */
import type { CombatUnit } from '../combat-types';
import type { Effect, PeriodicProgram, StatModifier, TriggerDefinition, Source } from './contracts';
import type { VampDefinition } from './runtime-types';
import { authorizeSpellCrit } from './crit';
import { validateStatusApplication } from './status';
import { integer, resolveStat } from './stats';
export type ItemTrigger = Omit<TriggerDefinition, 'source'> & { readonly initialAlso?: true };
export interface ItemProgram {
  readonly modifiers?: readonly StatModifier[];
  readonly effects?: readonly Effect[];
  readonly triggers?: readonly ItemTrigger[];
  readonly survival?: readonly ItemTrigger[];
  readonly periodic?: readonly { readonly periodTicks: number; readonly startsAtTick?: number; readonly endsAtTick?: number; readonly finalPulse?: 'before-expiry'; readonly condition?: import('./contracts').Condition; readonly program: Omit<PeriodicProgram, 'definitionId'> }[];
  readonly vamp?: readonly Omit<VampDefinition, 'source'>[];
}
export interface BoundItemProgram { readonly source: Source; readonly program: ItemProgram }
export function itemPrograms(unit: Pick<CombatUnit, 'itemPrograms'>): readonly BoundItemProgram[] { return unit.itemPrograms ?? []; }
/** Each declaration reserves 32 ordinals for its composed effects/end rewards. */
export function programEntries(unit: Pick<CombatUnit, 'itemPrograms'>) {
  return itemPrograms(unit).flatMap(({source,program}) => {
    let ordinal=0;
    const bind = <K extends 'modifier'|'effect'|'trigger'|'survival'|'periodic'|'vamp',T>(kind: K, declaration:T) => ({kind,source:{...source,effectIndex:source.effectIndex+32*ordinal++},declaration});
    return [ ...(program.modifiers ?? []).map(d=>bind('modifier',d)), ...(program.effects ?? []).map(d=>bind('effect',d)),
      ...(program.triggers ?? []).map(d=>bind('trigger',d)), ...(program.survival ?? []).map(d=>bind('survival',d)),
      ...(program.periodic ?? []).map(d=>bind('periodic',d)), ...(program.vamp ?? []).map(d=>bind('vamp',d)) ];
  });
}
export function compileItemCrit(unit: CombatUnit) {
  const programs=itemPrograms(unit), modifiers=programs.flatMap(p=>p.program.modifiers ?? []);
  const sources=programEntries(unit).flatMap(e=>e.kind==='effect' && 'kind' in e.declaration && e.declaration.kind==='authorize-spell-crit'?[e.source]:[]);
  const chance=resolveStat('critChance',unit.baseCritChanceBps ?? (unit.ability.kind==='s13'&&unit.ability.championId==='neutral'?0:2500),modifiers,{holder:unit});
  return authorizeSpellCrit(sources.filter(s=>s.sourceKind!=='item'),sources.filter(s=>s.sourceKind==='item'),chance,unit.baseCritMultiplierBps ?? 14000);
}
export function validateItemProgram(program: ItemProgram): void {
  const check=(v:unknown)=>{if(!v)throw new RangeError('Invalid combat program');};
  check(program && Object.keys(program).every(k=>['modifiers','effects','triggers','survival','periodic','vamp'].includes(k)));
  const effect=(e:Effect):void=>{
    check(['modify-stat','damage','apply-status','heal','grant-shield','grant-mana','change-max-hp','authorize-spell-crit','cleanse','temporary-equipment'].includes(e.kind));
    if(e.kind==='apply-status')validateStatusApplication(e.status);
    if(e.kind==='modify-stat') { modifier(e.modifier); if(e.duration.kind==='ticks')integer(e.duration.ticks,1); }
    if('amount' in e) {
      if(typeof e.amount==='number')integer(e.amount);
      else { for(const [k,v] of Object.entries(e.amount))if(typeof v==='number')integer(v,k==='flat'?Number.MIN_SAFE_INTEGER:0); }
    }
    if(e.kind==='damage')check(['physical','magic','true'].includes(e.damageType)&&['basic-attack','ability-direct','ability-periodic','attack-extra','equipment-proc','item-burn'].includes(e.delivery)&&['basic','requires-spell-authorization','never'].includes(e.critEligibility));
    if(e.kind==='grant-shield'){integer(e.durationTicks,1);e.endEffects.forEach(effect);}
  };
  const modifier=(m:StatModifier):void=>{
    check(['maxHp','attackDamage','abilityPower','armor','magicResist','attackSpeed','range','critChance','critMultiplier','damageAmp','damageReduction','omnivamp'].includes(m.stat));
    check(['flat','bps','hexes'].includes(m.unit));
    for(const v of Object.values(m.value))if(typeof v==='number')integer(v,Number.MIN_SAFE_INTEGER);
  };
  (program.modifiers ?? []).forEach(modifier);(program.effects ?? []).forEach(effect);
  for(const d of [...program.triggers ?? [],...program.survival ?? []]) {
    check(d.id && !('source' in d) && d.effects.length<32); integer(d.internalCooldownTicks);integer(d.maxPerAction,1);if(d.maxPerCombat!==null)integer(d.maxPerCombat,1); d.effects.forEach(effect);
  }
  for(const p of program.periodic ?? []){integer(p.periodTicks,1);if(p.endsAtTick!==undefined)integer(p.endsAtTick,1);check(p.program.effects.length<32);p.program.effects.forEach(effect);}
  for(const v of program.vamp ?? []){modifier(v.modifier);integer(v.allyBps);}
}
