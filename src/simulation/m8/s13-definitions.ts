import { programEntries } from './item-program';
import { conditionHolds } from './stats';
import { startingRows } from './targeting';
import type { CombatOrigin, CombatUnit } from '../combat-types';
import type { Amount, Effect, PeriodicTask, Source, TargetSelector, TriggerDefinition } from './contracts';
import type { MechanismDefinitions } from './runtime-types';
import { effectIdentity } from './identity';
export const asSource = (source: CombatOrigin): Source => ({ ...source, parentItemInstanceId: 'parentItemInstanceId' in source ? (source as Source).parentItemInstanceId : null });
export const flatAmount = (flat = 0, patch: Partial<Amount> = {}): Amount => ({ flat, attackDamageBps: 0, abilityPowerBps: 0, maxHpBps: 0, missingHpBps: 0, actualManaSpentBps: 0,
  actualDamageBps: 0, shieldAbsorbedBps: 0, hpBasis: 'holder', sample: 'application', cap: null, ...patch });
export const selfSelector = (patch: Partial<TargetSelector> = {}): TargetSelector => ({ primary: 'normal', candidates: 'board', relation: 'self', anchor: 'holder', radius: null,
  maxTargets: 1, excludeSelf: false, excludePrimary: false, distinct: true, order: 'distance-id', sample: 'each-pulse', ...patch });
export function compileMechanismDefinitions(unit: CombatUnit, combatId: string): MechanismDefinitions {
  const eventTriggers: TriggerDefinition[] = [];
  const survivalTriggers: TriggerDefinition[] = [];
  const periodicTasks: PeriodicTask[] = [], vamp: MechanismDefinitions['vamp'][number][] = [];
  for (const m of unit.mechanics ?? []) {
    const source = asSource(m.source), v = m.values;
    let effects: Effect[] | undefined;
    if (m.mechanic === 'rageblade') eventTriggers.push({ id: 'attack-growth', source, listener: { subject: 'actor', relationToHolder: 'self', withinHexes: null }, aggregation: 'event', counters: [], gate: { kind: 'always' }, event: 'attack-completed', condition: { kind: 'always' }, selector: selfSelector({ sample: 'action-completion' }), internalCooldownTicks: 0, maxPerAction: 1, maxPerCombat: null, stackPolicy: { kind: 'add-stacks', cap: null }, effects: [{ kind: 'modify-stat', modifier: { stat: 'attackSpeed', unit: 'bps', value: { kind: 'constant', amount: v.attackSpeedBps }, condition: { kind: 'always' }, damageFilter: null }, activation: 'immediate', duration: { kind: 'combat' }, stackPolicy: { kind: 'add-stacks', cap: null } }] });
    // Legacy mechanic tags compile data only; G04–G07 executors receive frozen programs, never item IDs.
    if (m.mechanic === 'dragonClaw') effects = [{ kind: 'heal', amount: flatAmount(0, { maxHpBps: v.healMaxHpBps, sample: 'each-pulse' }) }];
    if (m.mechanic === 'archangel') effects = [{ kind: 'modify-stat', activation: 'immediate', stackPolicy: { kind: 'add-stacks', cap: null }, duration: { kind: 'combat' },
      modifier: { stat: 'abilityPower', unit: 'flat', value: { kind: 'constant', amount: v.abilityPower }, condition: { kind: 'always' }, damageFilter: null } }];
    if (effects) periodicTasks.push({ ...effectIdentity(combatId, source, unit.id), nextPulseAtTick: v.periodTicks, periodTicks: v.periodTicks, endsAtTick: null,
      pulseOrdinal: 0, pulseLimit: null, remainders: [], finalPulse: 'none', onSourceDeath: 'cancel', onTargetDeath: 'cancel',
      program: { definitionId: JSON.stringify([source.definitionId, source.effectIndex, 'periodic']), selector: selfSelector(), targetSnapshot: 'once-per-pulse', effects } });
    if (m.mechanic === 'gunblade') vamp.push({ source, modifier: { stat: 'omnivamp', unit: 'bps', value: { kind: 'constant', amount: v.selfHealBps }, condition: { kind: 'always' }, damageFilter: null },
      allyBps: v.allyHealBps, allyCondition: { kind: 'always' } });
  }
  for (const entry of programEntries(unit)) {
    const {source}=entry;
    if(entry.kind==='trigger')eventTriggers.push({...entry.declaration,source});
    if(entry.kind==='survival') {
      const {initialAlso,...d}=entry.declaration;
      survivalTriggers.push({...d,source});
      if(initialAlso)survivalTriggers.push({...d,source,event:'combat-start',listener:{...d.listener,subject:'actor'}});
    }
    if(entry.kind==='vamp')vamp.push({...entry.declaration,source});
    if(entry.kind==='periodic') {
      const p=entry.declaration;
      if(p.condition && !conditionHolds(p.condition,{holder:unit,startingRows:startingRows(unit.team,unit.startingCell?.row ?? unit.cell.row) ?? undefined}))continue;
      periodicTasks.push({...effectIdentity(combatId,source,unit.id),nextPulseAtTick:p.startsAtTick ?? p.periodTicks,periodTicks:p.periodTicks,
        endsAtTick:p.endsAtTick ?? null,pulseOrdinal:0,pulseLimit:null,remainders:[],finalPulse:p.finalPulse ?? 'none',onSourceDeath:'cancel',onTargetDeath:'cancel',
        program:{...p.program,definitionId:JSON.stringify([source.definitionId,source.effectIndex,'periodic'])}});
    }
    const startEffect:Effect|undefined=entry.kind==='modifier' && !['critChance','critMultiplier'].includes(entry.declaration.stat)
      ? {kind:'modify-stat',modifier:entry.declaration,activation:'immediate',duration:{kind:'combat'},stackPolicy:{kind:'independent-instances'}}
      : entry.kind==='effect' && !['authorize-spell-crit','temporary-equipment'].includes(entry.declaration.kind) ? entry.declaration : undefined;
    if(startEffect)survivalTriggers.push({id:'initial',source,event:'combat-start',listener:{subject:'actor',relationToHolder:'self',withinHexes:null},aggregation:'event',counters:[],gate:{kind:'always'},condition:{kind:'always'},selector:selfSelector({sample:'combat-start'}),internalCooldownTicks:0,maxPerAction:1,maxPerCombat:1,stackPolicy:{kind:'independent-instances'},effects:[startEffect]});
  }
  return { ...(eventTriggers.length ? { eventTriggers } : {}), periodicTasks, survivalTriggers, vamp, ...(unit.ability.kind === 's13' && unit.ability.variables.HealPercentHealth > 0 ? { positiveDamageHeals: [{ source: asSource({ ownerId: unit.id, sourceKind: 'ability', definitionId: unit.ability.id, instanceId: unit.id, effectIndex: 0 }), amount: flatAmount(0, { maxHpBps: unit.ability.variables.HealPercentHealth, sample: 'packet' }) }] } : {}) };
}
