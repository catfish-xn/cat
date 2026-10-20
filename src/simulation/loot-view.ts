import type { MatchState } from './match-types';
import type { LootPayload } from './m8/contracts';
import type { LootView, RevealedDropView } from './m8/ui-contracts';
import { compareLootFreezeSlots, lootChoiceId } from './loot-identity';
import { hasPendingLootCapacity, unresolvedLootChoices } from './loot-runtime';
import { freezeContent } from './content/freeze';
import { unclaimedOrbPlans } from './orb-claim';

/** Payload is a display whitelist too: future nested fields must neither leak nor freeze input references. */
export function payloadView(payload: LootPayload): LootPayload {
  return payload.kind === 'gold' ? { kind: payload.kind, quantity: payload.quantity }
    : payload.kind==='consumable' ? {kind:'consumable',definitionId:payload.definitionId,quantity:payload.quantity}
    : { kind: payload.kind, definitionId: payload.definitionId, quantity: payload.quantity,
      ...(payload.kind==='unit'&&payload.starLevel?{starLevel:payload.starLevel}:{}) };
}

/**
 * Owner-visible loot projection (M8_UI_CONTRACT §5 plus the approved
 * 2026-10-10 addendum). Planned drops and unrevealed forfeitures, unresolved choice fallbacks,
 * frozen future rounds and loot RNG never enter the view; a component choice
 * appears as a drop only once its receipt exists, and while it is the current
 * PendingChoice only its identity is exposed. Pure read: no state, RNG or event changes.
 */
export function readLootView(state: Readonly<MatchState>): LootView {
  const loot = state.m8.loot, roundId = state.roundDefinitionId;
  const round = state.m8.round;
  const plan = round.kind === 'pve' && round.roundId === roundId && round.ordinal === state.round
    ? loot.frozen.rounds.find(value => value.encounterPlan.roundId === roundId && value.encounterPlan.encounterId === round.encounterId)
    : undefined;
  const drops: RevealedDropView[] = [];
  for (const drop of [...plan?.encounterPlan.drops ?? []].sort(compareLootFreezeSlots)) {
    if(drop.roundId!==roundId || drop.encounterId!==round.encounterId) continue;
    const progress = loot.direct.find(value => value.dropId === drop.dropId);
    const paid = state.sharedPool && loot.receipts.find(receipt => receipt.dropId === drop.dropId);
    const identity = { orbId:drop.orbId, entryOrdinal:drop.entryOrdinal, dropId: drop.dropId, encounterId: drop.encounterId, sourceUnitId: drop.sourceUnitId, roundId: drop.roundId, payload: payloadView(paid ? paid.payload : drop.payload) };
    if (progress?.status === 'granted') drops.push({ ...identity, status: 'granted', receiptId: progress.receiptId, allowedActions: [] });
    else if (progress?.status === 'revealed') drops.push({ ...identity, status: 'revealed', receiptId: null, allowedActions: [], reason: state.multiplayer?'awaiting-claim':'auto-grant-in-domain' });
    else if (progress?.status === 'pending-capacity') drops.push({ ...identity, status: 'pending-capacity', receiptId: null, allowedActions: [], reason: 'bench-full' });
    else if (progress?.status === 'forfeited' && loot.earnedEvidence.some(e=>e.dropId===drop.dropId)) drops.push({...identity,status:'forfeited',receiptId:null,allowedActions:[],reason:state.multiplayer?.status==='eliminated'?'eliminated-forfeited':'timeout-forfeited'});
    else if (progress?.status === 'retained-terminal') drops.push({ ...identity, status: 'retained-terminal', receiptId: null, allowedActions: [], reason: 'terminal-bench-full' });
  }
  // Approved addendum: the earned loot pick that is the current PendingChoice (identity only).
  const current = state.phase === 'choice' ? state.pendingChoice : null;
  const descriptor = current && unresolvedLootChoices(state as MatchState).find(value => lootChoiceId(value.dropId) === current.choiceId);
  const pendingChoice = current && descriptor ? { dropId: descriptor.dropId, encounterId: descriptor.encounterId,
    sourceUnitId: descriptor.sourceUnitId, roundId: descriptor.roundId, choiceId: current.choiceId, generation: current.generation } : null;
  const pendingClaims = state.phase === 'gameOver' ? [] : drops.filter(drop => drop.status === 'pending-capacity').map(drop => drop.dropId);
  // Same order as nextRound's guards, so the hint never disagrees with the command.
  const reason: LootView['reason'] = state.phase === 'gameOver' ? 'game-over'
    : pendingChoice ? 'pending-choice'
      : state.phase !== 'settlement' ? 'unsettled-round'
        : hasPendingLootCapacity(state as MatchState) ? 'pending-capacity'
          : unresolvedLootChoices(state as MatchState).length || state.roundResults.length !== state.round
            || state.roundResults.at(-1)?.round !== state.round ? 'unsettled-round' : null;
  const revealedOrbs=(plan?.orbs??[]).flatMap(orb=>{
    const visible=drops.filter(d=>d.orbId===orb.orbId);if(!visible.length)return [];
    const status=visible.every(d=>d.status==='granted')?'claimed' as const
      :visible.every(d=>d.status==='forfeited')?'forfeited' as const
      :visible.some(d=>d.status==='granted')?'partially-claimed' as const:'revealed' as const;
    return [{orbId:orb.orbId,tier:orb.tier,status,entryDropIds:visible.map(d=>d.dropId)}];
  });
  const unclaimedOrbs=unclaimedOrbPlans(state as MatchState).map(orb=>({orbId:orb.orbId,roundId:orb.roundId,tier:orb.tier,
    entries:[...orb.entries].sort((a,b)=>a.entryOrdinal-b.entryOrdinal).map(e=>payloadView(e.payload)),source:orb.source,
    queued:loot.queuedOrbClaims?.includes(orb.orbId)??false}));
  const claimReceipts=loot.receipts.filter(r=>r.resolution).map(r=>({receiptId:r.receiptId,dropId:r.dropId,payload:payloadView(r.payload),
    resolution:r.resolution!,gold:r.gold!,claimedRoundId:r.claimedRoundId!,grantedItemIds:[...r.grantedItemIds],grantedUnitIds:[...r.grantedUnitIds],
    ...(r.grantedConsumableIds?{grantedConsumableIds:[...r.grantedConsumableIds]}:{})}));
  return freezeContent({ roundId, revealedDrops: drops, revealedOrbs, ...(state.multiplayer?{unclaimedOrbs,claimReceipts}:{}), pendingClaims, canContinue: reason === null, reason, pendingChoice });
}

export function readComponentEquivalent(state:Readonly<MatchState>):number {
  return state.scheduleReceipts.filter(r=>r.kind==='component').reduce((n,r)=>n+r.itemIds.length,0)
    + Object.values(state.m8.loot.guaranteeCounters).reduce((a,b)=>a+b,0);
}

/** Opponents receive count/tier only; never identities or contents. */
export function readPublicOrbSummary(state: Readonly<MatchState>) {
  const orbs=unclaimedOrbPlans(state as MatchState);
  return freezeContent({count:orbs.length,tiers:orbs.map(o=>o.tier)});
}
