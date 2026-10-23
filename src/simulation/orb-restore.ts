import { openingRewardOrbs } from './opening-batch-rewards';
import { openingCrabCarrier } from './opening-crabs';
import { familyOrbs } from './family-orbs';
import { canonicalContent } from './content';
import { lootEntryId, lootOrbId, lootReceiptId } from './loot-identity';
import { allClaimableOrbPlans } from './orb-claim';
import type { MatchState } from './match-types';
import { validateResourceReceipts } from './resource-provenance';
import { getMultiplayerRoundById } from './multiplayer-round';
import { LOOT_POLICY_VERSION } from './content/loot';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { isCombatRosterLocked } from './operation-policy';

const check=(value:unknown,message:string)=>{if(!value)throw new RangeError(`Invalid multiplayer orb ledger: ${message}`);};
/** Complements the authoritative shared pool snapshot validator; never admits a solo save as online. */
export function validateMultiplayerOrbLedger(state: MatchState): void {
  check(state.multiplayer,'multiplayer required');
  const loot=state.m8.loot;
  const plans=allClaimableOrbPlans(state),drops=plans.flatMap(o=>o.entries);
  const queue=loot.queuedOrbClaims===undefined?[]:loot.queuedOrbClaims;
  check(Array.isArray(queue)&&new Set(queue).size===queue.length,'claim queue shape/duplicates');
  check(!queue.length || state.multiplayer?.status==='active' && isCombatRosterLocked(state)
    && (state.phase==='combat' && state.combat?.status==='running'
      || state.phase==='preparation' && state.m8.round.kind==='pvp')
    && !state.roundResults.some(r=>r.round===state.round),'claim queue lifecycle');
  for (const orbId of queue) {
    if([...familyOrbs(state),...openingRewardOrbs(state)].some(o=>o.orbId===orbId))continue;
    const orb=plans.find(o=>o.orbId===orbId);
    check(typeof orbId==='string' && orb && getMultiplayerRoundById(orb.roundId).ordinal<=state.round
      && orb.entries.length && orb.entries.some(e=>loot.direct.some(d=>d.dropId===e.dropId&&d.status==='revealed')
        && (orb.source==='mechanic'||loot.earnedEvidence.some(v=>v.dropId===e.dropId))),'queued orb eligibility');
  }
  check(new Set(plans.map(o=>o.orbId)).size===plans.length,'duplicate orb');
  check(new Set(drops.map(e=>e.dropId)).size===drops.length,'duplicate entry');
  const actual=loot.direct.map(d=>d.dropId),pve=loot.frozen.rounds.flatMap(r=>r.encounterPlan.drops.map(e=>e.dropId));
  check(actual.length===drops.length&&new Set(actual).size===actual.length&&drops.every(d=>actual.includes(d.dropId)),'entry coverage');
  check(canonicalContent(actual.filter(id=>pve.includes(id)))===canonicalContent(pve),'frozen entry order');
  const receipts=new Map(loot.receipts.map(r=>[r.dropId,r]));
  check(receipts.size===loot.receipts.length,'duplicate receipt');
  const evidence=new Map(loot.earnedEvidence.map(e=>[e.dropId,e]));
  check(evidence.size===loot.earnedEvidence.length,'duplicate evidence');
  for(const e of loot.earnedEvidence) {
    const drop=drops.find(d=>d.dropId===e.dropId),round=drop&&getMultiplayerRoundById(drop.roundId),history=round&&state.roundResults[round.ordinal-1];
    const combat=round?.ordinal===state.round?state.combat:null;
    check(drop&&round&&e.death.combatId===`round-${round.ordinal}`&&Number.isSafeInteger(e.death.tick)&&e.death.tick>=1
      &&Number.isSafeInteger(e.death.eventSeq)&&e.death.eventSeq>=0&&e.death.tick<=(combat?.tick??history?.combatTicks??-1)
      &&e.death.eventSeq<(combat?.nextEventSeq??history?.combatEventCount??0),'death evidence');
    if(combat) check(combat.neutralReceipts?.deaths.some(d=>d.unitId===openingCrabCarrier(state,drop!.roundId,drop?.sourceUnitId??'')&&d.tick===e.death.tick&&d.eventSeq===e.death.eventSeq),'current death');
  }
  for(const orb of plans) {
    if(orb.source==='mechanic') {
      check(state.multiplayer && orb.tier==='gray' && orb.entries.length===1,'mechanic orb shape');
      const e=orb.entries[0], r=state.seatMechanics?.receipts.find(r=>r.kind==='unit'&&r.resolution==='orb'&&r.orbId===orb.orbId);
      check(r?.kind==='unit'&&r.roundId===orb.roundId&&r.receiptId===e.sourceUnitId&&e.payload.kind==='unit'
        &&r.definitionId===e.payload.definitionId&&(r.starLevel??1)===(e.payload.starLevel??1),'mechanic authority');
      check(orb.orbId===lootOrbId(orb.roundId,'mechanic',e.sourceUnitId,0)&&e.dropId===lootEntryId(orb.orbId,0),'mechanic identity');
    }
    const statuses=new Set(orb.entries.map(e=>loot.direct.find(d=>d.dropId===e.dropId)?.status));
    check(statuses.size===1||[...statuses].every(s=>s==='granted'||s==='revealed')&&orb.entries.every(e=>loot.direct.find(d=>d.dropId===e.dropId)?.status!=='revealed'||e.payload.kind==='forge'),'partial anvil orb status');
    for(const e of orb.entries) {
      const d=loot.direct.find(d=>d.dropId===e.dropId)!,r=receipts.get(e.dropId),earned=orb.source==='mechanic'||evidence.has(e.dropId);
      check(['planned','revealed','granted','forfeited'].includes(d.status),'status');
      check(earned ? d.status!=='planned' : d.status==='planned'||d.status==='forfeited','earned status');
      if(d.status==='granted'||earned&&d.status==='forfeited') {
        check(r&&r.receiptId===lootReceiptId(e.dropId)&&canonicalContent(r.payload)===canonicalContent(e.payload),'receipt payload/identity');
        check(d.status==='granted'?d.receiptId===r?.receiptId&&r?.resolution!=='forfeited':d.receiptId===null&&r?.resolution==='forfeited','receipt status');
        check(!!r?.claimedRoundId&&getMultiplayerRoundById(r!.claimedRoundId!).ordinal>=getMultiplayerRoundById(orb.roundId).ordinal,'claim round');
      } else check(!r&&d.receiptId===null,'unclaimed receipt');
    }
  }
  const choices=new Set(loot.frozen.rounds.flatMap(r=>r.choices.map(c=>c.dropId)));
  check(loot.receipts.every(r=>drops.some(e=>e.dropId===r.dropId)||choices.has(r.dropId)),'unknown receipt');
  const counters=Object.fromEntries(Object.keys(loot.guaranteeCounters).map(k=>[k,0]));
  for(const r of loot.receipts) if(r.payload.kind==='item'&&r.resolution!=='forfeited') {
    const roundId=drops.find(d=>d.dropId===r.dropId)?.roundId??loot.frozen.rounds.find(p=>p.choices.some(c=>c.dropId===r.dropId))?.encounterPlan.roundId;
    const key=JSON.stringify([LOOT_POLICY_VERSION,roundId,'components-granted']);
    check(Object.hasOwn(counters,key)&&ITEM_DEFINITIONS[r.payload.definitionId],'item counter source');
    counters[key]+=ITEM_DEFINITIONS[r.payload.definitionId].kind==='completed'?2:1;
  }
  check(canonicalContent(counters)===canonicalContent(loot.guaranteeCounters),'counters');
  validateResourceReceipts({scheduleReceipts:state.scheduleReceipts,lootReceipts:loot.receipts,
    mechanicReceipts:state.seatMechanics?.receipts,carouselReceipts:state.carousel?.receipts,throughRoundOrdinal:state.round});
}
