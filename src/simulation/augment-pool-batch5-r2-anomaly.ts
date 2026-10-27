import { PORTABLE_ANOMALY_EXCLUDED, PORTABLE_ANOMALY_PREFIX, portableAnomalyId } from './content/augment-pool-batch5-r2';
import { PORTABLE_ANOMALY_ITEMS } from './content/augment-pool-batch5-r2-items';
import { grantMechanicItem } from './seat-mechanics';
import { traceBoundUnitIdentity } from './bound-unit-identity';
import type { MatchState, MatchEvent } from './match-types';
import type { AnomalyBinding, ItemInstance, OwnedAugment } from './strategy-types';

export function r2AnomalyAllowed(augments:readonly OwnedAugment[],id:string):boolean {
  return !augments.some(a=>a.definitionId==='another-anomaly')||!PORTABLE_ANOMALY_EXCLUDED.includes(id);
}
export function portableBinding(items:readonly ItemInstance[],unitId:string):AnomalyBinding|null {
  const item=items.find(i=>i.location.kind==='unit'&&i.location.unitId===unitId&&portableAnomalyId(i.definitionId)!==null);
  const id=item&&portableAnomalyId(item.definitionId);
  return id&&Object.hasOwn(PORTABLE_ANOMALY_ITEMS,item!.definitionId)?{definitionId:id,unitId,choiceId:`portable:${item!.id}`,boundRound:0}:null;
}
export const portableGrantId=(choiceId:string,anomalyChoiceId:string)=>JSON.stringify(['augment-pool-batch5-r2',choiceId,anomalyChoiceId]);

/** Runs inside selectChoice after the 4-6 schedule receipt/binding commits. No round timer or deferred reward. */
export function grantPortableAnomaly(state:MatchState):{state:MatchState;events:readonly MatchEvent[]} {
  const owner=state.augments.find(a=>a.definitionId==='another-anomaly'),binding=state.anomalyBinding;
  if(!owner||!binding)return {state,events:[]};
  const receiptId=portableGrantId(owner.choiceId,binding.choiceId);
  if(state.seatMechanics?.receipts.some(r=>r.receiptId===receiptId))return {state,events:[]};
  const definitionId=PORTABLE_ANOMALY_PREFIX+binding.definitionId;
  if(!Object.hasOwn(PORTABLE_ANOMALY_ITEMS,definitionId))throw new RangeError('Invalid portable anomaly selection');
  const granted=grantMechanicItem(state,{receiptId,source:'augment-pool-batch5-r2',definitionId});
  if(!granted.ok)throw new RangeError('Invalid portable anomaly grant');
  return granted;
}

/** Receipt/definition/round all follow the selected schedule, not the candidate item or a surviving original hero. */
export function validatePortableAnomaly(state:MatchState):void {
  const fail=()=>{throw new RangeError('Invalid portable anomaly');};
  const owner=state.augments.find(a=>a.definitionId==='another-anomaly');
  const selected=state.scheduleReceipts.find(r=>r.kind==='anomaly');
  const expected=owner&&selected?portableGrantId(owner.choiceId,selected.eventId):null;
  const receipts=(state.seatMechanics?.receipts??[]).filter(r=>r.source==='augment-pool-batch5-r2'||r.receiptId.startsWith('["augment-pool-batch5-r2",'));
  if(receipts.length!==(expected?1:0))fail();
  if(expected&&selected){
    const receipt=receipts[0];
    if(!r2AnomalyAllowed(state.augments,selected.definitionId!)||receipt.kind!=='item'||receipt.receiptId!==expected
      ||receipt.source!=='augment-pool-batch5-r2'||receipt.round!==selected.round||receipt.roundId!=='4-6'
      ||receipt.definitionId!==PORTABLE_ANOMALY_PREFIX+selected.definitionId)fail();
  }
  if(owner&&state.pendingChoice?.kind==='anomaly'&&state.pendingChoice.offers.some(id=>!r2AnomalyAllowed(state.augments,id)))fail();
  const original=selected?.unitId?traceBoundUnitIdentity(selected.unitId,state.resourceProvenance.entries):null;
  for(const item of state.items)if(portableAnomalyId(item.definitionId)!==null){
    if(!owner||!selected||item.definitionId!==PORTABLE_ANOMALY_PREFIX+selected.definitionId
      ||item.location.kind==='unit'&&item.location.unitId===original)fail();
  }
}

/** Shared by preview and historical placement verification; merge lineage remains the original hero. */
export function canEquipPortableAnomaly(state:Pick<MatchState,'anomalyBinding'>,item:ItemInstance,unitId:string):boolean {
  return portableAnomalyId(item.definitionId)===null||state.anomalyBinding?.unitId!==unitId;
}
