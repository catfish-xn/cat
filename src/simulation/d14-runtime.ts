import { usableBenchSlots } from './bench-capacity';
/** Production adapter: Match/resourceProvenance remain the sole ownership authority.
 * The independent D3/D14 transaction engine is a reference harness, never a second live ledger. */
import type { MatchState, MatchBase, MatchEvent } from './match-types';
import type { Unit, UnitLocation } from './unit-types';
import type { AnomalyBinding, ItemInstance } from './strategy-types';
import { UNIT_DEFINITIONS } from './units';
import { D14_FOURTH_ABILITY } from './d14-anomalies/fourth-ability';
import { D14_POLICY } from './content/d14-anomalies';
import { appendResourceProvenance } from './resource-provenance';
import { isDeploymentCell } from './board';
import { deploymentCapFor } from './deployment-cap';
import { readG23Progress } from './g2-3-state';
import { countsTowardPopulation } from './seat-mechanics/forms';
export interface D14Progress {
  readonly choiceId: string; readonly anomalyId: 'ultimate-hero'|'into-the-unknown';
  readonly originalUnit: Unit; readonly unitId: string; readonly atOrdinal: number; readonly selectionPrefixLength: number;
  readonly phase: 'waiting'|'promoted'|'absent'|'returned'|'retired';
  readonly held: {readonly unit:Unit;readonly items:readonly ItemInstance[]}|null;
}
/** Minimal authenticated frozen combat input; no held resources or private history. */
export interface D14CombatCertificate { readonly unitId:string;readonly anomalyId:D14Progress['anomalyId'];readonly phase:'waiting'|'promoted'|'returned' }
export function isD14(id: string): id is D14Progress['anomalyId'] { return id==='ultimate-hero'||id==='into-the-unknown'; }
export function eligibleD14Target(unit:Unit|undefined,id:string):boolean {
  if(!isD14(id))return true;
  if(!unit||unit.team!=='player'||unit.location.kind!=='board')return false;
  const d=UNIT_DEFINITIONS[unit.definitionId];
  return !!d&&!d.summon&&d.unitKind!=='neutral'&&(id!=='ultimate-hero'||d.cost===1&&unit.starLevel===3&&Object.hasOwn(D14_FOURTH_ABILITY,unit.definitionId));
}
export function d14Certificate(state: Pick<MatchBase,'d14'>):D14CombatCertificate|undefined {
  const d=state.d14;
  return d&&['waiting','promoted','returned'].includes(d.phase)?{unitId:d.unitId,anomalyId:d.anomalyId,phase:d.phase as D14CombatCertificate['phase']}:undefined;
}
export function acquireD14(state:MatchState):MatchState {
  const b=state.anomalyBinding;
  if(!b||!isD14(b.definitionId)||state.d14)return state;
  const unit=state.preparation.units.find(u=>u.id===b.unitId)!;
  if(!eligibleD14Target(unit,b.definitionId))throw new RangeError('Invalid D14 target');
  const items=b.definitionId==='into-the-unknown'?state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unit.id):[];
  const d14:D14Progress={choiceId:b.choiceId,anomalyId:b.definitionId,originalUnit:structuredClone(unit),unitId:unit.id,
    atOrdinal:state.roundResults.length,selectionPrefixLength:state.resourceProvenance.entries.length,
    phase:b.definitionId==='ultimate-hero'?'waiting':'absent',held:b.definitionId==='into-the-unknown'?{unit:structuredClone(unit),items:structuredClone(items)}:null};
  return {...state,d14,resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,{kind:'d14-selected',choiceId:b.choiceId,unitId:unit.id,heldItems:structuredClone(items)}),
    preparation:d14.held?{...state.preparation,units:state.preparation.units.filter(u=>u.id!==unit.id)}:state.preparation,
    items:d14.held?state.items.filter(i=>!items.includes(i)):state.items,
    temporaryEquipment:d14.held?state.temporaryEquipment.filter(i=>i.holderId!==unit.id):state.temporaryEquipment};
}
export function returnLocation(state:MatchState):UnitLocation|null {
  if(state.preparation.overflowUnitIds?.length)return null;
  for(let slot=0;slot<usableBenchSlots(state.preparation);slot++)if(!state.preparation.units.some(u=>u.team==='player'&&u.location.kind==='bench'&&u.location.slot===slot))return {kind:'bench',slot};
  if(state.preparation.usableBenchSlots!==undefined)return null;
  if(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&countsTowardPopulation(u.definitionId)).length>=deploymentCapFor(state.level,readG23Progress(state)))return null;
  for(let row=0;row<state.preparation.board.rows;row++)for(let col=0;col<state.preparation.board.columns;col++){
    const cell={row,col};if(isDeploymentCell(state.preparation.board,'player',cell)&&!state.preparation.units.some(u=>u.location.kind==='board'&&u.location.cell.row===row&&u.location.cell.col===col))return {kind:'board',cell};
  }
  return null;
}
/** Called after unique settlements/deferred merges and after unlocked resource commands. */
export function reconcileD14(state:MatchState,events:MatchEvent[]=[]):MatchState {
  const d=state.d14;if(!d)return state;
  const binding=state.anomalyBinding;
  if(!binding||binding.choiceId!==d.choiceId)return {...state,d14:{...d,phase:'retired',held:null}};
  const resumed = d.phase === 'retired' ? { ...d, phase: (d.anomalyId === 'ultimate-hero' ? 'waiting' : 'returned') as D14Progress['phase'] } : d;
  let next=state;
  const unitId=binding.unitId;
  if(resumed !== d) next={...next,d14:resumed};
  if(d.unitId!==unitId)next={...next,d14:{...resumed,unitId}};
  if(resumed.phase==='waiting'&&state.roundResults.length>=d.atOrdinal+D14_POLICY.numRounds){
    events.push({type:'d14Promoted',unitId,choiceId:d.choiceId});return {...next,d14:{...d,unitId,phase:'promoted'}};
  }
  if(d.phase==='absent'&&d.held&&state.roundResults.length>=d.atOrdinal+D14_POLICY.numRounds&&state.phase!=='combat'&&!state.multiplayer?.combatRosterLocked){
    const location=returnLocation(state);if(!location)return next;
    events.push({type:'d14Returned',unitId,choiceId:d.choiceId});
    return {...next,d14:{...d,phase:'returned',held:null},preparation:{...state.preparation,units:[...state.preparation.units,{...d.held.unit,location}]},items:[...state.items,...d.held.items],
      resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,{kind:'d14-returned',choiceId:d.choiceId,unitId,settledOrdinal:state.roundResults.length})};
  }
  return next;
}
export function d14OwnedUnits(state:Pick<MatchBase,'preparation'|'d14'>):readonly Unit[]{return [...state.preparation.units,...state.d14?.held?[state.d14.held.unit]:[]];}
export function d14OwnedItems(state:Pick<MatchBase,'items'|'d14'>):readonly ItemInstance[]{return [...state.items,...state.d14?.held?.items??[]];}


export function d14HeldAtPrefix(state:MatchState,prefix:number){
  const facts=state.resourceProvenance.entries.slice(0,prefix);
  const selected=facts.find(e=>e.kind==='d14-selected'&&state.d14?.anomalyId==='into-the-unknown');
  if(selected?.kind!=='d14-selected'||facts.some(e=>e.kind==='d14-returned'))return {heldUnitIds:[],heldItemIds:[]};
  const id=selected.unitId;
  return {heldUnitIds:[id],heldItemIds:selected.heldItems.map(i=>i.id)};
}
export function d14CertificateAtCombat(state:MatchState,binding:AnomalyBinding|null):D14CombatCertificate|undefined{
  const d=state.d14;if(!d||d.selectionPrefixLength>=state.combatInputBasis!.provenancePrefixLength)return undefined;
  const before=state.roundResults.filter(r=>r.round<state.round).length;
  const unitId=binding?.choiceId===d.choiceId?binding.unitId:null;
  if(!unitId)return undefined;
  if(d.anomalyId==='ultimate-hero')return {unitId,anomalyId:d.anomalyId,phase:before>=d.atOrdinal+D14_POLICY.numRounds?'promoted':'waiting'};
  return state.resourceProvenance.entries.slice(0,state.combatInputBasis!.provenancePrefixLength).some(e=>e.kind==='d14-returned')?{unitId,anomalyId:d.anomalyId,phase:'returned'}:undefined;
}
