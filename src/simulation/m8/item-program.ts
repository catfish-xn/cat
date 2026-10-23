/** Content declarations composed exclusively from the signed G01–G11 vocabulary.
 * No item ID or display name is inspected by this compiler or the combat executor. */
import type { CombatUnit } from '../combat-types';
import type { Effect, PeriodicProgram, StatModifier, Source } from './contracts';
import type { TargetLimitedTrigger } from './triggers';
import type { VampDefinition } from './runtime-types';
import { authorizeSpellCrit } from './crit';
import { validateStatusApplication } from './status';
import { integer, modifierValues, safeNumber } from './stats';
import { grantedItemPrograms } from './combat-item-programs';
export type ItemTrigger = Omit<TargetLimitedTrigger, 'source'> & { readonly initialAlso?: true };
export interface ItemProgram {
  readonly modifiers?: readonly StatModifier[];
  readonly effects?: readonly Effect[];
  readonly triggers?: readonly ItemTrigger[];
  readonly survival?: readonly ItemTrigger[];
  readonly periodic?: readonly { readonly periodTicks: number; readonly startsAtTick?: number; readonly endsAtTick?: number; readonly finalPulse?: 'before-expiry'; readonly condition?: import('./contracts').Condition; readonly program: Omit<PeriodicProgram, 'definitionId'> }[];
  readonly vamp?: readonly Omit<VampDefinition, 'source'>[];
  /** G2-4b: resolved by the strategy snapshot. Every trigger damage flat becomes flat[min(stage,length)-1]. */
  readonly byStage?: { readonly flat: readonly number[] };
}
export interface BoundItemProgram { readonly source: Source; readonly program: ItemProgram }
/** Frozen strategy programs, then items gained during this combat (G2-4b chest), which compile exactly like them. */
export function itemPrograms(unit: Pick<CombatUnit, 'itemPrograms'> & Partial<Pick<CombatUnit, 'id' | 'combatItemGrants' | 'mechanics'>>): readonly BoundItemProgram[] {
  const granted = unit.combatItemGrants?.length ? grantedItemPrograms({ id: unit.id!, combatItemGrants: unit.combatItemGrants, mechanics: unit.mechanics }) : [];
  return granted.length ? [...unit.itemPrograms ?? [], ...granted] : unit.itemPrograms ?? [];
}
/** Each declaration reserves 32 ordinals for its composed effects/end rewards. */
export function programEntries(unit: Pick<CombatUnit, 'itemPrograms'> & Partial<Pick<CombatUnit, 'id' | 'combatItemGrants' | 'mechanics'>>) {
  return itemPrograms(unit).flatMap(({source,program}) => {
    let ordinal=0;
    const bind = <K extends 'modifier'|'effect'|'trigger'|'survival'|'periodic'|'vamp',T>(kind: K, declaration:T) => ({kind,source:{...source,effectIndex:source.effectIndex+32*ordinal++},declaration});
    return [ ...(program.modifiers ?? []).map(d=>bind('modifier',d)), ...(program.effects ?? []).map(d=>bind('effect',d)),
      ...(program.triggers ?? []).map(d=>bind('trigger',d)), ...(program.survival ?? []).map(d=>bind('survival',d)),
      ...(program.periodic ?? []).map(d=>bind('periodic',d)), ...(program.vamp ?? []).map(d=>bind('vamp',d)) ];
  });
}
export function compileItemCrit(unit: Pick<CombatUnit, 'id' | 'hp' | 'maxHp' | 'ability' | 'itemPrograms' | 'baseCritChanceBps' | 'baseCritMultiplierBps'> & Partial<Pick<CombatUnit, 'combatItemGrants' | 'mechanics'>>) {
  const programs=itemPrograms(unit), modifiers=programs.flatMap(p=>p.program.modifiers ?? []);
  const sources=programEntries(unit).flatMap(e=>e.kind==='effect' && 'kind' in e.declaration && e.declaration.kind==='authorize-spell-crit'?[e.source]:[]);
  const {flat,bps}=modifierValues('critChance',modifiers,{holder:unit});
  const chance=safeNumber(BigInt(unit.baseCritChanceBps ?? (unit.ability.kind==='s13'&&unit.ability.championId==='neutral'?0:2500))+BigInt(flat)+BigInt(bps));
  return authorizeSpellCrit(sources.filter(s=>s.sourceKind!=='item'),sources.filter(s=>s.sourceKind==='item'),chance,unit.baseCritMultiplierBps ?? 14000);
}
export function validateItemProgram(program: ItemProgram): void {
  const check=(v:unknown)=>{if(!v)throw new RangeError('Invalid combat program');};
  check(program && Object.keys(program).every(k=>['modifiers','effects','triggers','survival','periodic','vamp','byStage'].includes(k)));
  const effect=(e:Effect):void=>{
    check(['modify-stat','damage','apply-status','heal','grant-shield','grant-mana','change-max-hp','authorize-spell-crit','cleanse','temporary-equipment','grant-combat-item','over-time','leap'].includes(e.kind));
    if(e.kind==='over-time'){check(['heal','mana'].includes(e.resource));integer(e.pulses,1);integer(e.periodTicks,1);check(e.pulses*e.periodTicks<=1200);}
    if(e.kind==='grant-mana'&&e.maxManaBps!==undefined)integer(e.maxManaBps,1);
    if(e.kind==='apply-status'){validateStatusApplication(e.status);check(e.anyDamage===undefined||e.anyDamage===true);}
    if(e.kind==='modify-stat') { modifier(e.modifier); if(e.duration.kind==='ticks')integer(e.duration.ticks,1); }
    if('amount' in e) {
      if(typeof e.amount==='number')integer(e.amount);
      else { for(const [k,v] of Object.entries(e.amount))if(typeof v==='number')integer(v,k==='flat'?Number.MIN_SAFE_INTEGER:0); }
    }
    if(e.kind==='damage')check(['physical','magic','true'].includes(e.damageType)&&['basic-attack','ability-direct','ability-periodic','attack-extra','equipment-proc','item-burn'].includes(e.delivery)&&['basic','requires-spell-authorization','never'].includes(e.critEligibility));
    if(e.kind==='grant-shield'){integer(e.durationTicks,1);e.endEffects.forEach(effect);}
  };
  const modifier=(m:StatModifier):void=>{
    check(['maxHp','attackDamage','abilityPower','armor','magicResist','attackSpeed','range','critChance','critMultiplier','damageAmp','damageReduction','omnivamp','attackSpeedLock','damageAmpPerHex'].includes(m.stat));
    if(m.stat==='attackSpeedLock'||m.stat==='damageAmpPerHex')check(m.value.kind==='constant'&&m.value.amount>0&&m.condition.kind==='always');
    check(['flat','bps','hexes'].includes(m.unit));
    for(const v of Object.values(m.value))if(typeof v==='number')integer(v,Number.MIN_SAFE_INTEGER);
  };
  (program.modifiers ?? []).forEach(modifier);(program.effects ?? []).forEach(effect);
  for(const d of [...program.triggers ?? [],...program.survival ?? []]) {
    check(d.id && !('source' in d) && d.effects.length<32);
    if(d.gate.kind==='consume-counter'){const id=d.gate.counterId;check(d.counters.some(c=>c.id===id&&c.cap!==null));} check(d.actionLimitScope===undefined||d.actionLimitScope==='target'&&d.event==='kill-or-assist');integer(d.internalCooldownTicks);integer(d.maxPerAction,1);if(d.maxPerCombat!==null)integer(d.maxPerCombat,1); d.effects.forEach(effect);
  }
  for(const p of program.periodic ?? []){integer(p.periodTicks,1);if(p.endsAtTick!==undefined)integer(p.endsAtTick,1);check(p.program.effects.length<32);p.program.effects.forEach(effect);}
  for(const v of program.vamp ?? []){modifier(v.modifier);integer(v.allyBps);if(v.damageTypes)check(v.damageTypes.length>0&&v.damageTypes.every(t=>['physical','magic','true'].includes(t)));}
  if(program.byStage){check(program.byStage.flat.length>0);program.byStage.flat.forEach(n=>integer(n));}
}
