// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { anvilChoiceId, specification } from '../anvils';
import { isAnvil } from '../content/anvils';
import { canonicalContent } from '../content/index';
import type { MatchState } from '../match-types';

/** Choice receipts and live units must reconcile with one authenticated birth and one consumption. */
export function validateAnvils(state:MatchState):void {
  const check=(v:unknown)=>{if(!v)throw new RangeError('Invalid anvil ledger');};
  const births=[...state.m8.loot.receipts.filter(r=>r.payload.kind==='forge'&&r.resolution!=='forfeited').flatMap(r=>r.grantedUnitIds),
    ...state.seatMechanics?.receipts.flatMap(r=>r.kind==='unit'&&isAnvil(r.definitionId)&&r.resolution==='held'&&r.unitId?[r.unitId]:[])??[]];
  check(new Set(births).size===births.length);
  const opened=state.resourceProvenance.entries.filter(e=>e.kind==='anvil-opened');
  check(new Set(opened.map(e=>e.unitId)).size===opened.length);
  for(const id of births){
    check(state.preparation.units.some(u=>u.id===id)||opened.some(e=>e.unitId===id));
    check(state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.unitId===id));
  }
  for(const u of state.preparation.units)if(isAnvil(u.definitionId)){
    check(u.team==='player'&&u.location.kind==='bench'&&u.starLevel===1&&!state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===u.id));
    check(specification(state,u.id).definitionId===u.definitionId&&!opened.some(e=>e.unitId===u.id));
  }
  for(const e of opened){
    const {offers}=specification(state,e.unitId),r=state.seatMechanics?.receipts.find(r=>r.receiptId===e.choiceId),c=state.pendingChoice;
    check(births.includes(e.unitId)&&e.choiceId===anvilChoiceId(e.unitId));
    if(r)check(r.kind==='choice'&&r.source==='anvil-unit'&&r.choiceKind==='forge'&&!r.skipped&&r.price===0&&r.itemId!==null&&offers.includes(r.optionId)&&(!r.timedOut||r.optionId===offers[0]));
    else check(c?.choiceId===e.choiceId&&c.kind==='forge'&&canonicalContent(c.offers)===canonicalContent(offers)&&canonicalContent(c.payload)===canonicalContent({kind:'forge',source:'anvil-unit',timeoutMs:30000,timeoutOption:offers[0]}));
  }
  for(const r of state.seatMechanics?.receipts??[])if(r.source==='anvil-unit'||r.receiptId.startsWith('["anvil",'))check(opened.some(e=>e.choiceId===r.receiptId));
  if(state.pendingChoice?.payload?.source==='anvil-unit'||state.pendingChoice?.choiceId.startsWith('["anvil",'))check(opened.some(e=>e.choiceId===state.pendingChoice!.choiceId));
}
