/* P-B5-H7 2026-10-27, independent 14.24 constants and bigint LCG arithmetic. No production imports. */
const source='augment-pool-batch5-h7';
function h7Gold(state) {
 const out=[],facts=state.augmentHistory?.facts??[],seat=state.multiplayer?.seatId??'solo';
 for(const a of state.augments) {
  if(a.definitionId==='lunch-money') {
   let sum=0;const seen=new Set();
   for(const f of facts.filter(f=>f.kind==='player-damage'&&f.round>=a.acquiredRound&&!f.mirror&&f.opponentSeatId!==null&&f.actualDamage!==null)) {
    if(seen.has(f.battleId))continue;seen.add(f.battleId);
    const gold=(Math.floor((sum+f.actualDamage)/8)-Math.floor(sum/8))*2;sum+=f.actualDamage;
    if(gold)out.push({receiptId:JSON.stringify([source,a.choiceId,f.battleId]),source,kind:'gold',amount:gold,round:f.round});
   }
   continue;
  }
  if(a.definitionId!=='good-for-something')continue;
  const seen=new Set();
  for(const f of facts.filter(f=>f.kind==='deaths'&&f.round>=a.acquiredRound))for(const d of f.deaths) {
   const id=JSON.stringify([source,a.choiceId,d.combatId,d.eventSeq]);
   if(seen.has(id))continue;seen.add(id);
   if(!d.ordinaryHero||d.ownerSeatId!==seat||d.equipment.length||d.combatItemGrants.length)continue;
   let h=2166136261n;
   const text=JSON.stringify([source,seat,a.choiceId,d.combatId,d.eventSeq]);
   for(let i=0;i<text.length;i++)h=((h^BigInt(text.charCodeAt(i)))*16777619n)&0xffffffffn;
   const word=((h^BigInt(state.seed))*1664525n+1013904223n)&0xffffffffn;
   if(word<2147483648n)out.push({receiptId:id,source,kind:'gold',amount:1,round:f.round});
  }
 }
 return out;
}
module.exports={h7Gold};
