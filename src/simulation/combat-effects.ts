import { startB5VoidSwarm } from './augment-pool-batch5-g4-swarm';
import { carryAugmentDeathSample } from './augment-death-samples';
import { startExperimentClones } from './combat-experiment-clone';
import { startV20Traits } from './combat-v20-traits';
import { startSixCost } from './combat-six-cost';
import { startG22Traits } from './combat-g2-2';
import { startV19, smokeV19 } from './combat-v19';
import { startP2Combat } from './s13-augments-p2-combat';
import { nextRandom } from './rng';
import { startAnomalies } from './anomalies/runtime';
import {initializeMirrorHealth} from './g2-4b-summons';
import type { CombatEvent, CombatState, CombatStep, CombatUnit } from './combat-types';
import { compileMechanismDefinitions } from './m8/s13-definitions';
import { EMPTY_MECHANISMS } from './m8/runtime-types';
import { initializeMechanisms, refreshMechanismAuras } from './m8/s13-mechanisms';
import type { EffectInvocation } from './strategy-types';
import { projectCombatStartMana } from './combat-initialization';
import { EMPTY_RUNTIME, grantShield, ensureMechanisms, type S13Unit } from './combat-s13-state';
export function stampCombatStep(state: CombatState, events: readonly CombatEvent[]): CombatStep {
  if (!state.strategy) return { state, events };
  const first = state.nextEventSeq ?? 0;
  return { state: { ...state, nextEventSeq: first + events.length },
    events: events.map((event, i) => carryAugmentDeathSample(event, { ...event, domain: 'combat', combatId: state.combatId!, eventSeq: first + i })) };
}
export function invocationEvent(invocation: EffectInvocation, tick: number): CombatEvent {
  return { type: 'effectTriggered', tick, source: { ...invocation.trigger.source }, effectKey: invocation.trigger.key,
    action: { ...invocation.action }, targetId: invocation.targetId };
}
/** Tick-zero actions cannot cause damage; all start hooks share the same pre-combat boundary. */
export function applyCombatStart(state: CombatState): CombatStep {
  if (!state.strategy || state.startEffectsApplied) return { state, events: [] };
  if (state.status === 'finished') return stampCombatStep({ ...state, units: state.units.map(unit => unit.ability.kind !== 's13' ? unit : { ...unit, mechanismDefinitions: compileMechanismDefinitions(unit, state.combatId!), mechanismState: { ...EMPTY_MECHANISMS, initialized: true, combatId: state.combatId!, sampledAtTick: 0 } }), startEffectsApplied: true },
    [{ type: 'combatFinished', tick: 0, result: state.result!, reason: 'elimination' }]);
  const effects: CombatEvent[] = [], shields: CombatEvent[] = [], mana: CombatEvent[] = [];
  const units: CombatUnit[] = state.units.map(unit => {
    const batch = projectCombatStartMana(unit);
    const { gain, after, overflow } = batch;
    if (unit.ability.kind === 's13') {
      const current: S13Unit = { ...unit, runtime: { ...EMPTY_RUNTIME, ...unit.runtime }, statuses: [...unit.statuses ?? []],
        shieldLayers: [...unit.shieldLayers ?? []], tasks: [...unit.tasks ?? []], effectRuntime: batch.runtime };
      ensureMechanisms(current, 0, state.combatId);
      for (const invocation of batch.invocations) {
        effects.push(invocationEvent(invocation, 0)); const source = invocation.trigger.source;
        if (invocation.action.kind === 'grantShield') grantShield(current, { ownerId: source.ownerId, sourceKind: source.sourceKind,
          definitionId: source.sourceDefinitionId, instanceId: source.sourceInstanceId, effectIndex: source.effectIndex, ...(source.parentItemInstanceId ? { parentItemInstanceId: source.parentItemInstanceId } : {}) },
        invocation.action.amount, invocation.action.durationTicks, 0, shields);
      }
      current.mana = after;
      if (gain > 0) mana.push({ type: 'manaChanged', tick: 0, unitId: current.id, before: unit.mana, spent: 0, attackGain: 0,
        damageGain: 0, hookGain: gain, overflow, after: current.mana });
      return current;
    }
    let shield = unit.shield, expiry = unit.shieldExpiresAtTick;
    for (const invocation of batch.invocations) {
      effects.push(invocationEvent(invocation, 0));
      if (invocation.action.kind === 'grantShield') {
        shield = Math.max(shield, invocation.action.amount);
        expiry = Math.max(expiry ?? 0, invocation.action.durationTicks);
      }
    }
    if (shield === 0) expiry = null;
    if (shield !== unit.shield || expiry !== unit.shieldExpiresAtTick) shields.push({ type: 'shieldChanged', tick: 0, unitId: unit.id,
      reason: 'granted', before: unit.shield, after: shield, expiresAtTick: expiry });
    if (gain > 0) mana.push({ type: 'manaChanged', tick: 0, unitId: unit.id, before: unit.mana, spent: 0,
      attackGain: 0, damageGain: 0, hookGain: gain, overflow, after });
    return { ...unit, shield, shieldExpiresAtTick: expiry, mana: after, effectRuntime: batch.runtime };
  });
  const mechanismUnits = units.filter(u => u.ability.kind === 's13') as S13Unit[];
  let rngState=state.rngState!,rngDraws=state.rngDraws??0;
  if (mechanismUnits.length) {
    if(mechanismUnits.some(u=>u.itemSummon?.kind==='mirror')){
      initializeMechanisms({ tick:1,combatId:state.combatId,board:state.board,units:mechanismUnits.filter(u=>u.itemSummon?.kind!=='mirror'),events:shields,packets:[],heals:[],draw:()=>{throw new Error('Mirror opening cannot draw RNG');} });
      initializeMirrorHealth(mechanismUnits,shields);
    }
    initializeMechanisms({ tick: 1, combatId: state.combatId, board: state.board, units: mechanismUnits, events: shields, packets: [], heals: [], draw: () => { throw new Error('Combat start mechanisms cannot draw RNG'); } });
    for (const unit of mechanismUnits) unit.mechanismState = { ...unit.mechanismState!, sampledAtTick: 0 };
    startG22Traits({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('G22 starts cannot draw RNG');}});
    refreshMechanismAuras({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('Auras cannot draw RNG');}});
    startAnomalies({tick:0,anomalySeed:state.rngState,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('Anomaly starts cannot draw main RNG');}});
    for (const unit of mechanismUnits) if (!units.some(u=>u.id===unit.id)) units.push(unit);
    startP2Combat({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{
      const next=nextRandom(rngState);rngState=next.state;rngDraws++;return next.word;
    }});
    smokeV19({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('V19 smoke cannot draw RNG');}});
    startSixCost({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('Six-cost opening cannot draw RNG');}});
    startV19({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('V19 opening cannot draw RNG');}});
    startV20Traits({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('V20 opening cannot draw RNG');}});
    startB5VoidSwarm({tick:0,combatId:state.combatId,board:state.board,units:mechanismUnits,events:shields,packets:[],heals:[],draw:()=>{throw new Error('Void Swarm opening cannot draw RNG');}},state);
    for (const unit of mechanismUnits) if (!units.some(u=>u.id===unit.id)) units.push(unit);
    // Final owner HP is frozen only after all opening boosts and broadcasts.
    initializeMirrorHealth(mechanismUnits,shields);
    startExperimentClones(mechanismUnits);
  }
  return stampCombatStep({ ...state, units, rngState, rngDraws, startEffectsApplied: true }, [...effects, ...shields, ...mana]);
}
