// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { D14_POLICY } from '../content/d14-anomalies';
import { canonicalContent } from '../content/index';
import { type D14Progress, eligibleD14Target, isD14, returnLocation } from '../d14-runtime';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundByOrdinal } from '../multiplayer-round';
import type { ResourceProvenanceContext } from '../resource-provenance';
import { foldResourceProvenance } from './fold-provenance';

function check(v:unknown):asserts v{if(!v)throw new RangeError('Invalid D14 production certificate');}

/** Authenticate against schedule, resource prefix, ordered transition facts and real settlement history.
 * Same trust boundary as restoreMatch's other choices; candidate fields never authorize births/stars. */
export function validateD14(state:MatchState,context:ResourceProvenanceContext,current:import('../resource-provenance').FoldedResourceProvenance):void {
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
  const id=current.anomalyBinding?.unitId??null;
  check(d.unitId===current.lastAnomalyBinding?.unitId);
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
