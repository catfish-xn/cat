import { PORTABLE_ANOMALY_EXCLUDED, PORTABLE_ANOMALY_PREFIX, portableAnomalyId } from './content/augment-pool-batch5-r2';
import { PORTABLE_ANOMALY_ITEMS } from './content/augment-pool-batch5-r2-items';
import { grantMechanicItem } from './seat-mechanics';
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


/** Shared by preview and historical placement verification; merge lineage remains the original hero. */
export function canEquipPortableAnomaly(state:Pick<MatchState,'anomalyBinding'>,item:ItemInstance,unitId:string):boolean {
  return portableAnomalyId(item.definitionId)===null||state.anomalyBinding?.unitId!==unitId;
}
