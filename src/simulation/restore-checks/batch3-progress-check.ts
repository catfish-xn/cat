// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { AUGMENT_BATCH3_SOURCE, batch3Events, DUMMY_SOURCE, emblemGifts, formingRemovalId, goldPlan, ownDummyId, retireId } from '../augment-pool-batch3-progress';
import { AUGMENT_BATCH3 } from '../content/augment-pool-batch3';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundById } from '../multiplayer-round';

export function validateBatch3Dummies(state:MatchState):void {
 const fail=(why:string)=>{throw new RangeError('Invalid batch3 dummy authority: '+why);};
 const removals=state.resourceProvenance.entries.filter(e=>e.kind==='unit-removed') as readonly Extract<(typeof state.resourceProvenance.entries)[number],{kind:'unit-removed'}>[];
 const expected=new Map<string,string>();
 for(const augment of state.augments){
  const unitId=ownDummyId(state,augment),row=AUGMENT_BATCH3[augment.definitionId];if(!row)continue;
  if(emblemGifts(state,augment).length&&unitId){
   const present=state.preparation.units.some(u=>u.id===unitId);
   for(const [slot,gift] of emblemGifts(state,augment).entries()){
    const r=state.seatMechanics?.receipts.find(r=>r.receiptId===gift.receiptId);
    if(!r){if(present&&state.phase!=='combat')fail('missing emblem');continue;}
    if(r.kind!=='item'||r.definitionId!==gift.definitionId||r.source!==DUMMY_SOURCE)fail('emblem receipt');
    if(r.kind==='item'&&present&&!state.items.some(i=>i.id===r.itemId&&i.location.kind==='unit'&&i.location.unitId===unitId&&i.location.slot===slot))fail('emblem detached');
   }
  }
  if(unitId&&batch3Events(state).some(e=>e.augment===augment&&row.schedules[e.schedule].retireDummy))expected.set(retireId(augment),unitId);
 }
 // A reached threshold requires retirement, too: validating only the removals supplied by the save lets it
 // delete the retirement fact and put the dummy back while retaining the already-granted support item.
 for(const [receiptId,unitId] of expected){
  if(!removals.some(e=>e.definitionId===undefined&&e.receiptId===receiptId&&e.unitId===unitId)
   ||state.preparation.units.some(u=>u.id===unitId))fail('missing retirement');
 }
 // Forming removals: only under an owned forming augment's receipt, all within its acquisition round.
 const forming=new Map(state.augments.filter(a=>AUGMENT_BATCH3[a.definitionId]?.forming).map(a=>[formingRemovalId(a),a]));
 for(const e of removals.filter(e=>e.definitionId!==undefined)){
  const a=forming.get(e.receiptId);if(!a||getMultiplayerRoundById(e.roundId).ordinal!==a.acquiredRound)fail('unexpected forming removal');
  expected.set(e.receiptId,e.unitId);
 }
 const emblems=new Set(state.augments.flatMap(a=>emblemGifts(state,a).map(g=>g.receiptId)));
 for(const r of state.seatMechanics?.receipts??[])if((r.source===DUMMY_SOURCE||r.receiptId.startsWith(`["${DUMMY_SOURCE}",`))&&!emblems.has(r.receiptId))fail('unexpected emblem');
 for(const e of removals)if(e.definitionId===undefined&&expected.get(e.receiptId)!==e.unitId)fail('unexpected removal');
 const retired=removals.filter(e=>e.definitionId===undefined);
 if(new Set(retired.map(e=>e.receiptId)).size!==retired.length||new Set(removals.map(e=>e.unitId)).size!==removals.length)fail('duplicate removal');
}

export function validateBatch3Gold(state:MatchState):void {
 const plan=goldPlan(state),receipts=state.seatMechanics?.receipts??[];
 for(const r of receipts.filter(r=>r.source===AUGMENT_BATCH3_SOURCE||r.receiptId.startsWith(`["${AUGMENT_BATCH3_SOURCE}",`))){
  const p=plan.find(p=>p.receiptId===r.receiptId);
  if(!p||r.kind!=='gold'||r.source!==p.source||r.amount!==p.amount||r.round!==p.round)throw new RangeError('Invalid batch3 gold authority');
 }
 for(const p of plan)if(!receipts.some(r=>r.receiptId===p.receiptId))throw new RangeError('Missing batch3 gold receipt');
}
