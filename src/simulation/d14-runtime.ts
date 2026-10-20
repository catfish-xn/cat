/** Production adapter: Match/resourceProvenance remain the sole ownership authority.
 * The independent D3/D14 transaction engine is a reference harness, never a second live ledger. */
import type { MatchState, MatchBase, MatchEvent } from './match-types';
import type { Unit, UnitLocation } from './unit-types';
import type { ItemInstance } from './strategy-types';
import { UNIT_DEFINITIONS } from './units';
import { D14_FOURTH_ABILITY } from './d14-anomalies/fourth-ability';
import { D14_POLICY } from './content/d14-anomalies';
import { appendResourceProvenance, foldResourceProvenance, type ResourceProvenanceContext } from './resource-provenance';
import { traceBoundUnitIdentity } from './bound-unit-identity';
import { canonicalContent } from './content';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
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
function returnLocation(state:MatchState):UnitLocation|null {
  for(let slot=0;slot<state.preparation.benchSize;slot++)if(!state.preparation.units.some(u=>u.team==='player'&&u.location.kind==='bench'&&u.location.slot===slot))return {kind:'bench',slot};
  if(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&countsTowardPopulation(u.definitionId)).length>=deploymentCapFor(state.level,readG23Progress(state)))return null;
  for(let row=0;row<state.preparation.board.rows;row++)for(let col=0;col<state.preparation.board.columns;col++){
    const cell={row,col};if(isDeploymentCell(state.preparation.board,'player',cell)&&!state.preparation.units.some(u=>u.location.kind==='board'&&u.location.cell.row===row&&u.location.cell.col===col))return {kind:'board',cell};
  }
  return null;
}
/** Called after unique settlements/deferred merges and after unlocked resource commands. */
export function reconcileD14(state:MatchState,events:MatchEvent[]=[]):MatchState {
  const d=state.d14;if(!d||d.phase==='retired')return state;
  const binding=state.anomalyBinding;
  if(!binding||binding.choiceId!==d.choiceId)return {...state,d14:{...d,phase:'retired',held:null}};
  let next=state;
  const unitId=binding.unitId;
  if(d.unitId!==unitId)next={...next,d14:{...d,unitId}};
  if(d.phase==='waiting'&&state.roundResults.length>=d.atOrdinal+D14_POLICY.numRounds){
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
function check(v:unknown):asserts v{if(!v)throw new RangeError('Invalid D14 production certificate');}
/** Authenticate against schedule, resource prefix, ordered transition facts and real settlement history.
 * Same trust boundary as restoreMatch's other choices; candidate fields never authorize births/stars. */
export function validateD14(state:MatchState,context:ResourceProvenanceContext):void {
  const selected=state.scheduleReceipts.filter(r=>r.kind==='anomaly'&&r.definitionId&&isD14(r.definitionId));
  const facts=state.resourceProvenance.entries.filter(e=>e.kind==='d14-selected'||e.kind==='d14-returned');
  if(!selected.length){check(state.d14===undefined&&facts.length===0);return;}
  check(selected.length===1&&state.d14);const d=state.d14,r=selected[0];
  check(r.eventId===d.choiceId&&r.definitionId===d.anomalyId&&r.unitId===d.originalUnit.id&&d.atOrdinal===r.round-1&&eligibleD14Target(d.originalUnit,d.anomalyId));
  const start=state.resourceProvenance.entries[d.selectionPrefixLength];
  check(start?.kind==='d14-selected'&&start.choiceId===d.choiceId&&start.unitId===d.originalUnit.id&&start.roundId===getMultiplayerRoundByOrdinal(r.round).roundId);
  check(Number.isSafeInteger(d.selectionPrefixLength)&&d.selectionPrefixLength>0);
  const prefix=foldResourceProvenance(state.resourceProvenance,{...context,prefixLength:d.selectionPrefixLength});
  const original=prefix.units.find(u=>u.id===d.originalUnit.id);check(original&&original.definitionId===d.originalUnit.definitionId&&original.starLevel===d.originalUnit.starLevel);
  const id=traceBoundUnitIdentity(d.originalUnit.id,state.resourceProvenance.entries.slice(d.selectionPrefixLength));
  const saleIndex=state.resourceProvenance.entries.findIndex(e=>e.kind==='unit-sold'&&traceBoundUnitIdentity(d.originalUnit.id,state.resourceProvenance.entries.slice(d.selectionPrefixLength,e.sequence))===e.unitId);
  const retiredId=saleIndex<0?null:traceBoundUnitIdentity(d.originalUnit.id,state.resourceProvenance.entries.slice(d.selectionPrefixLength,saleIndex));
  check(d.unitId===(id??retiredId));
  const returned=facts.filter(e=>e.kind==='d14-returned');
  check(facts.filter(e=>e.kind==='d14-selected').length===1&&returned.length<=1);
  const phase=id===null?'retired':d.anomalyId==='ultimate-hero'?(state.roundResults.length>=d.atOrdinal+D14_POLICY.numRounds?'promoted':'waiting'):returned.length?'returned':'absent';
  check(d.phase===phase);
  check(phase==='retired'?state.anomalyBinding===null:state.anomalyBinding?.unitId===id&&state.anomalyBinding.choiceId===d.choiceId);
  if(phase==='absent'){
    check(d.held&&canonicalContent(d.held.unit)===canonicalContent(d.originalUnit)&&!state.preparation.units.some(u=>u.id===id));
    check(Object.keys(d.held).length===2&&start.kind==='d14-selected'&&canonicalContent(d.held.items)===canonicalContent(start.heldItems));
    if(state.roundResults.length>=d.atOrdinal+D14_POLICY.numRounds&&state.phase!=='combat'&&!state.multiplayer?.combatRosterLocked)check(returnLocation(state)===null);
    check(d.held.items.every(i=>i.location.kind==='unit'&&i.location.unitId===id));
  }else check(d.held===null);
  for(const e of returned){check(e.kind==='d14-returned'&&d.anomalyId==='into-the-unknown'&&e.choiceId===d.choiceId&&e.unitId===d.originalUnit.id&&e.settledOrdinal>=d.atOrdinal+D14_POLICY.numRounds&&e.settledOrdinal<=state.roundResults.length);}
  const clean:D14Progress={choiceId:d.choiceId,anomalyId:d.anomalyId,originalUnit:d.originalUnit,unitId:d.unitId,atOrdinal:d.atOrdinal,selectionPrefixLength:d.selectionPrefixLength,phase:d.phase,held:d.held};check(canonicalContent(clean)===canonicalContent(d));
}

export function d14HeldAtPrefix(state:MatchState,prefix:number){
  const facts=state.resourceProvenance.entries.slice(0,prefix);
  const selected=facts.find(e=>e.kind==='d14-selected'&&state.d14?.anomalyId==='into-the-unknown');
  if(selected?.kind!=='d14-selected'||facts.some(e=>e.kind==='d14-returned'))return {heldUnitIds:[],heldItemIds:[]};
  const id=selected.unitId;
  return {heldUnitIds:[id],heldItemIds:selected.heldItems.map(i=>i.id)};
}
export function d14CertificateAtCombat(state:MatchState):D14CombatCertificate|undefined{
  const d=state.d14;if(!d||d.selectionPrefixLength>=state.combatInputBasis!.provenancePrefixLength)return undefined;
  const before=state.roundResults.filter(r=>r.round<state.round).length;
  const unitId=traceBoundUnitIdentity(d.originalUnit.id,state.resourceProvenance.entries.slice(d.selectionPrefixLength,state.combatInputBasis!.provenancePrefixLength));
  if(!unitId)return undefined;
  if(d.anomalyId==='ultimate-hero')return {unitId,anomalyId:d.anomalyId,phase:before>=d.atOrdinal+D14_POLICY.numRounds?'promoted':'waiting'};
  return state.resourceProvenance.entries.slice(0,state.combatInputBasis!.provenancePrefixLength).some(e=>e.kind==='d14-returned')?{unitId,anomalyId:d.anomalyId,phase:'returned'}:undefined;
}
