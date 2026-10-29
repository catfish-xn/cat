// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { BATCH5_S3A_SOURCE, batch5InventoryPlan } from '../augment-pool-batch5-s3a';
import { AUGMENT_BATCH5_S3A } from '../content/augment-pool-batch5-s3a';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundById } from '../multiplayer-round';
import { validateResourceReceipts } from '../resource-provenance';

export function validateBatch5Inventory(state:MatchState,plan=batch5InventoryPlan(state)):void {
 // Shared restores do not run the solo combat-growth fold. Authenticate the same
 // item births/serials here without pretending PvP settlement receipts are solo battles.
 if(state.augments.some(a=>AUGMENT_BATCH5_S3A[a.definitionId])){
  const births=validateResourceReceipts({scheduleReceipts:state.scheduleReceipts,lootReceipts:state.m8.loot.receipts,mechanicReceipts:state.seatMechanics?.receipts,carouselReceipts:state.carousel?.receipts,throughRoundOrdinal:state.round});
  const used=new Set<string>();let serial=1,lastRound=1;
  const check=(ok:unknown)=>{if(!ok)throw new RangeError('Invalid batch5 item receipt history');};
  for(const [index,e] of state.resourceProvenance.entries.entries()){
   const round=getMultiplayerRoundById(e.roundId).ordinal;check(e.sequence===index&&round>=lastRound&&round<=state.round);lastRound=round;
   if(e.kind==='item-acquired'){
    const source=e.source,key=source.kind==='schedule'?`schedule:${source.eventId}`:source.kind==='carousel'?`carousel-item:${source.receiptId}`:`${source.kind}:${source.receiptId}`;
    const b=births.get(key);check(b?.kind==='item'&&b.id===e.itemId&&b.roundId===e.roundId&&!used.has(key)&&e.itemId===`item-${serial++}`);used.add(key);
   }else if(e.kind==='item-combined')check(e.event.itemId===`item-${serial++}`);
   else if(e.kind==='consumable-used')for(const [n,o] of e.record.outputs.entries())if(o.id!==e.record.affectedItems[n]?.id)check(o.id===`item-${serial++}`);
  }
  check(serial===state.nextItemSerial&&[...births].filter(([,b])=>b.kind==='item').every(([key])=>used.has(key)));
 }

 if(state.phase!=='combat'&&state.m8.round.kind!=='supply'&&!state.multiplayer?.combatRosterLocked&&state.preparation.units.filter(u=>u.location.kind==='bench').length<state.preparation.benchSize
   &&plan.anvils.some(g=>!state.seatMechanics?.receipts.some(r=>r.receiptId===g.receiptId)))throw new RangeError('Missing batch5 inventory anvil');
 for(const r of state.seatMechanics?.receipts??[])if(r.source===BATCH5_S3A_SOURCE||r.receiptId.startsWith(`["${BATCH5_S3A_SOURCE}",`)){
  const gift=plan.anvils.find(g=>g.receiptId===r.receiptId);
  if(!gift||r.source!==BATCH5_S3A_SOURCE||r.kind!=='unit'||r.definitionId!==gift.definitionId||r.resolution!=='held'||r.gold!==0||r.round<gift.acquiredRound||r.round>state.round)throw new RangeError('Invalid batch5 inventory authority');
 }
}
