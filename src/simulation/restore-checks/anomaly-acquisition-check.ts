// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { dualWieldingItems, receiptId, SOURCE } from '../anomaly-acquisition';
import { traceBoundUnitIdentity } from '../bound-unit-identity';
import type { MatchState } from '../match-types';
import type { ResourceProvenanceContext } from '../resource-provenance';
import { getCatalogRoundByOrdinal } from '../round-selectors';
import { foldResourceProvenance } from './fold-provenance';

/** Called after the full resource fold has authenticated births and consumption. Reconstruct the
 * original target before acquisition, even if it later upgraded or was sold. No saved role is trusted. */
export function validateAnomalyAcquisition(state:MatchState,context:ResourceProvenanceContext,parsedJsonInput=false):void{
 const fail=()=>{throw new RangeError('Invalid anomaly acquisition');},expected=new Set<string>();
 for(const selected of state.scheduleReceipts.filter(r=>r.kind==='anomaly'&&r.definitionId==='dual-wielding')){
  const ids=[receiptId(selected.eventId,0),receiptId(selected.eventId,1)];ids.forEach(id=>expected.add(id));
  const first=state.resourceProvenance.entries.findIndex(e=>e.kind==='item-acquired'&&e.source.kind==='mechanic'&&e.source.receiptId===ids[0]);
  if(first<1||!selected.unitId)fail();
  const before=foldResourceProvenance(state.resourceProvenance,{...context,prefixLength:first},parsedJsonInput);
  const target=before.units.find(u=>u.id===selected.unitId);if(!target)fail();
  const finalUnit=traceBoundUnitIdentity(selected.unitId!,state.resourceProvenance.entries.slice(first));
  if(finalUnit===null?state.anomalyBinding!==null:state.anomalyBinding?.unitId!==finalUnit||state.anomalyBinding.definitionId!=='dual-wielding'||state.anomalyBinding.choiceId!==selected.eventId)fail();
  const items=dualWieldingItems(state.seed,selected.eventId,target!.definitionId);
  for(const [i,id] of ids.entries()){
   const r=state.seatMechanics?.receipts.find(r=>r.receiptId===id);
   if(!r||r.kind!=='item'||r.source!==SOURCE||r.definitionId!==items[i]||r.round!==selected.round||r.roundId!==getCatalogRoundByOrdinal(selected.round).roundId)fail();
  }
 }
 for(const r of state.seatMechanics?.receipts??[])if((r.source===SOURCE||r.receiptId.startsWith('s13-anomaly:'))&&!expected.has(r.receiptId))fail();
}
