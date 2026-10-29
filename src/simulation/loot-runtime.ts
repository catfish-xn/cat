import { applyAngerIssues } from './augment-pool-batch5-r2';
import { pipelineExtraOrbs } from './augment-pool-batch5-g5-pipeline';
import { openingCrabCarrier } from './opening-crabs';
import { claimGeneratedJson } from './immutable-json';
import { createOrbLayout, freezeOrbLayoutThroughRound, type LootInitialization, type OrbLayoutLedger, type LootLayoutBinding } from './orb-layout';
import { LOOT_POLICY_VERSION } from './content/loot';
import type { CombatState } from './combat-types';
import { COMPONENT_POOL } from './component-pool';
import { canonicalContent } from './content';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { ROUND_CATALOG } from './content/round-catalog';
import { planPermanentItemGrant } from './item-grants';
import { orderedUnresolvedLootChoices } from './loot-choice';
import { advanceFrozenLootLedger, freezeLootThroughRound } from './loot-freeze';
import { compareLootFreezeSlots, lootReceiptId } from './loot-identity';
import type { FrozenDirectDrop, LootCarry, LootChoiceDescriptor, MatchLootState } from './loot-types';
import { pveLossCarryRound } from './pve-loot-carry';
import type { LootPayload, LootReceipt } from './m8/contracts';
import type { MatchEvent, MatchState } from './match-types';
import { appendResourceProvenance, mergeGrowthLedger } from './resource-provenance';
import type { UnitUpgradedEvent } from './unit-types';
import { planUnitAcquisition } from './unit-acquisition';
import { getUnitSellPrice } from './unit-stats';

const counterKey = (roundId: string) => JSON.stringify([LOOT_POLICY_VERSION, roundId, 'components-granted']);
const currentPlan = (state: MatchState) => {
  const plan = state.m8.loot.frozen.rounds.find(value => value.encounterPlan.roundId === state.roundDefinitionId);
  const extra = pipelineExtraOrbs(state).filter(o => o.roundId === state.roundDefinitionId);
  return plan && extra.length ? { ...plan, orbs: [...plan.orbs, ...extra],
    encounterPlan: { ...plan.encounterPlan, drops: [...plan.encounterPlan.drops, ...extra.flatMap(o => o.entries)] } } : plan;
};
const withLoot = (state: MatchState, loot: MatchLootState): MatchState => ({ ...state, m8: claimGeneratedJson({ ...state.m8, loot }) });

/** Preparation owns the sole frozen plan and RNG; runtime progress only references its IDs. */
export function prepareMatchLoot(seed: number, round: number, previous?: MatchLootState, layout?:OrbLayoutLedger, initialization?:LootInitialization): MatchLootState {
  if (previous && previous.frozen.seed !== seed) throw new RangeError('Loot seed mismatch');
  let layoutBinding:LootLayoutBinding=previous?.layoutBinding??(initialization?.mode==='shared-deferred'?{mode:'shared-deferred'}:{mode:'solo',layout:createOrbLayout(seed)});
  if(layoutBinding.mode==='solo') {
    const result=freezeOrbLayoutThroughRound(layoutBinding.layout,round);
    if(!result.ok)throw new RangeError(result.reason);
    layout=result.layout;layoutBinding={mode:'solo',layout};
  } else if(layoutBinding.mode==='shared') {
    if(!layout||layout.throughRoundOrdinal<round)throw new RangeError('Missing shared orb layout');
    layoutBinding={...layoutBinding,throughRoundOrdinal:round};
  }
  const boundary=layoutBinding.mode==='shared-deferred'?0:round;
  const frozen = previous ? advanceFrozenLootLedger(previous.frozen,boundary,layout) : freezeLootThroughRound(seed,boundary,layout);
  if (frozen === previous?.frozen) return previous;
  const added = frozen.rounds.slice(previous?.frozen.rounds.length ?? 0);
  return { frozen, layoutBinding,
    direct: [...previous?.direct ?? [], ...added.flatMap(value => value.encounterPlan.drops.map(drop => ({ dropId: drop.dropId, status: 'planned' as const, receiptId: null })))],
    choiceEligibility: [...previous?.choiceEligibility ?? [], ...added.flatMap(value => value.choices.map(choice => ({ dropId: choice.dropId, status: 'planned' as const })))],
    choiceResolutions: previous?.choiceResolutions ?? [], earnedEvidence: previous?.earnedEvidence ?? [], receipts: previous?.receipts ?? [],
    ...(previous?.carry?.length ? { carry: previous.carry } : {}),
    ...(previous?.rewardOrbs ? { rewardOrbs: previous.rewardOrbs } : {}),
    ...(previous?.queuedOrbClaims ? { queuedOrbClaims: previous.queuedOrbClaims } : {}),
    guaranteeCounters: previous?.guaranteeCounters ?? Object.fromEntries(ROUND_CATALOG.filter(value => value.kind === 'pve').map(value => [counterKey(value.roundId), 0])),
  };
}

/** Observe committed B7 deaths only. Neither a reveal nor a forfeit allocates resources. */
export function revealMatchLoot(state: MatchState, combat: CombatState): { state: MatchState; events: MatchEvent[] } {
  const plan = currentPlan(state), events: MatchEvent[] = [];
  if (!plan) return { state, events };
  if (combat.combatId !== `round-${state.round}`) throw new RangeError('Loot combat mismatch');
  const loot = state.m8.loot, earnedEvidence = [...loot.earnedEvidence];
  const carry: LootCarry[] = [...loot.carry ?? []];
  const deliver = combat.status === 'finished' ? pveLossCarryRound(state, combat) : null;
  const transition = (drop: { readonly dropId: string; readonly status: string }, sourceUnitId: string) => {
    if (drop.status !== 'planned') return drop.status;
    sourceUnitId=openingCrabCarrier(state,state.roundDefinitionId,sourceUnitId);
    const deaths = combat.neutralReceipts?.deaths.filter(value => value.unitId === sourceUnitId) ?? [];
    if (deaths.length > 1) throw new RangeError('Duplicate loot death');
    if (deaths.length) {
      const source = deaths[0];
      if (!Number.isSafeInteger(source.tick) || source.tick < 0 || source.tick > combat.tick
        || !Number.isSafeInteger(source.eventSeq) || source.eventSeq < 0 || source.eventSeq >= (combat.nextEventSeq ?? 0)
        || !combat.units.some(unit => unit.id === sourceUnitId && unit.unitKind === 'neutral' && !unit.alive)) throw new RangeError('Invalid loot death');
      const death = { combatId: combat.combatId!, tick: source.tick, eventSeq: source.eventSeq };
      earnedEvidence.push({ dropId: drop.dropId, death }); events.push({ type: 'lootRevealed', dropId: drop.dropId, death });
      return 'revealed';
    }
    if (combat.status === 'finished') {
      if (deliver) { carry.push({ dropId: drop.dropId, deliverRoundId: deliver }); events.push({ type: 'lootCarried', dropId: drop.dropId, deliverRoundId: deliver }); return 'carried'; }
      events.push({ type: 'lootForfeited', dropId: drop.dropId }); return 'forfeited';
    }
    return 'planned';
  };
  const direct = loot.direct.map(drop => {
    const frozen = plan.encounterPlan.drops.find(value => value.dropId === drop.dropId);
    if (!frozen || drop.status !== 'planned') return drop;
    if (!frozen.sourceUnitId) throw new RangeError('Missing loot source');
    const status = transition(drop, frozen.sourceUnitId) as 'planned' | 'revealed' | 'forfeited' | 'carried';
    return status === drop.status ? drop : { ...drop, status };
  });
  const choiceEligibility = loot.choiceEligibility.map(choice => {
    const descriptor = plan.choices.find(value => value.dropId === choice.dropId);
    if (!descriptor || choice.status !== 'planned') return choice;
    const status = transition(choice, descriptor.sourceUnitId) as 'planned' | 'revealed' | 'forfeited' | 'carried';
    return status === choice.status ? choice : { ...choice, status };
  });
  if (!events.length) return { state, events };
  const { carry: _previous, ...rest } = loot;
  return { state: withLoot(state, { ...rest, direct, choiceEligibility, earnedEvidence, ...(carry.length ? { carry } : {}) }), events };
}

export function commitReceipt(state: MatchState, receipt: LootReceipt): MatchState {
  const loot = state.m8.loot;
  if (loot.receipts.some(value => value.receiptId === receipt.receiptId || value.dropId === receipt.dropId)) throw new RangeError('Duplicate loot receipt');
  let guaranteeCounters = loot.guaranteeCounters;
  if (!receipt.dropId.startsWith('family:') && receipt.resolution !== 'forfeited' && receipt.payload.kind === 'item' && ITEM_DEFINITIONS[receipt.payload.definitionId]) {
    const key = counterKey(receipt.claimedRoundId ? JSON.parse(JSON.parse(receipt.dropId)[0])[1] : state.roundDefinitionId);
    const count = guaranteeCounters[key] + receipt.payload.quantity * (ITEM_DEFINITIONS[receipt.payload.definitionId].kind==='completed'?2:1);
    if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('Invalid loot counter');
    guaranteeCounters = { ...guaranteeCounters, [key]: count };
  }
  return withLoot(state, { ...loot, receipts: [...loot.receipts, receipt], guaranteeCounters });
}

/** Transaction-local dependency; never stored in MatchState or used by offline callers. */
export type UnitLootPolicy = (drop: FrozenDirectDrop, capacitySold?: boolean) => LootPayload & { readonly resolution?: 'gold' | 'capacity-sold' };

/** No phase, economy or pending-delta changes. Match commits returned upgrades in its final transaction. */
export function grantDirectLoot(initial: MatchState, terminal: boolean, unitLootPolicy?: UnitLootPolicy, claimedDrops?: readonly FrozenDirectDrop[]): { state: MatchState; events: MatchEvent[]; upgradeEvents: UnitUpgradedEvent[] } {
  let state = initial;
  const events: MatchEvent[] = [], upgradeEvents: UnitUpgradedEvent[] = [];
  if (state.multiplayer && !claimedDrops) return {state, events, upgradeEvents};
  for (const drop of [...claimedDrops ?? currentPlan(state)?.encounterPlan.drops ?? []].sort(compareLootFreezeSlots)) {
    const progress = state.m8.loot.direct.find(value => value.dropId === drop.dropId);
    if (progress?.status !== 'revealed' && progress?.status !== 'pending-capacity' && !(claimedDrops && progress?.status === 'carried')) continue;
    if (!claimedDrops && state.combat?.status !== 'finished') throw new RangeError('Loot grant before combat finish');
    const receiptId = lootReceiptId(drop.dropId);
    const purchase = drop.payload.kind === 'unit' || drop.payload.kind === 'forge' ? planUnitAcquisition(state, drop.payload.definitionId,
      {kind:'loot',receiptId}, state.resourceProvenance.entries.length, false, drop.payload.kind==='unit'?drop.payload.starLevel??1:1) : null;
    const decision: ReturnType<UnitLootPolicy> = drop.payload.kind === 'unit' && unitLootPolicy ? unitLootPolicy(drop, !!state.multiplayer && !purchase?.ok) : drop.payload;
    const payload: LootPayload = decision.kind === 'gold' ? {kind:'gold',quantity:decision.quantity} : decision;
    const capacityGold = state.multiplayer && drop.payload.kind === 'unit' && !purchase?.ok && payload.kind === 'unit'
      ? getUnitSellPrice({id:'orb',team:'player',location:{kind:'bench',slot:0},definitionId:payload.definitionId,starLevel:payload.starLevel??1}) : 0;
    const resolution = drop.payload.kind === 'unit' ? (decision.resolution ?? (capacityGold ? 'capacity-sold' : 'held')) : 'held';
    let grantedItemIds: readonly string[] = [], grantedUnitIds: readonly string[] = [], grantedConsumableIds:readonly string[]|undefined;
    if (payload.kind === 'unit') {
      if (capacityGold) {
        if(!Number.isSafeInteger(state.gold+capacityGold))throw new RangeError('Loot gold overflow');
        state = {...state,gold:state.gold+capacityGold};
      }
      else if (!purchase?.ok) {
        const status = terminal ? 'retained-terminal' : 'pending-capacity';
        if (progress.status !== status) state = withLoot(state, { ...state.m8.loot,
          direct: state.m8.loot.direct.map(value => value.dropId === drop.dropId ? { dropId: value.dropId, status, receiptId: null } : value) });
        continue;
      }
      else {
      state = { ...state, preparation: purchase.preparation, nextUnitSerial: purchase.nextUnitSerial,
        items: purchase.items, anomalyBinding: purchase.anomalyBinding, persistentGrowth: mergeGrowthLedger(state.persistentGrowth, purchase.upgradeEvents),
        resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, purchase.facts) };
      upgradeEvents.push(...purchase.upgradeEvents); events.push(...purchase.events); grantedUnitIds = [purchase.unitId];
      }
    } else if (payload.kind === 'item') {
      const grant = grantItem(state, payload.definitionId, receiptId); state = grant.state; grantedItemIds = grant.grantedItemIds;
    } else if(payload.kind==='forge') {
      if(!purchase?.ok||!claimedDrops&&state.roundResults.some(r=>r.round===state.round))continue;
      state={...state,preparation:purchase.preparation,nextUnitSerial:purchase.nextUnitSerial,resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,purchase.facts)};
      grantedUnitIds=[purchase.unitId];
    } else if(payload.kind==='consumable') {
      const serial=state.nextConsumableSerial;
      if(!Number.isSafeInteger(serial+1)||serial<1)throw new RangeError('Invalid consumable serial');
      const consumableId=`consumable-${serial}`;
      grantedConsumableIds=[consumableId];
      state={...state,nextConsumableSerial:serial+1,consumables:[...state.consumables,{consumableId,definitionId:payload.definitionId}]};
    } else {
      const gold = state.gold + payload.quantity;
      if (!Number.isSafeInteger(gold)) throw new RangeError('Loot gold overflow');
      state = { ...state, gold };
    }
    const receipt: LootReceipt = { receiptId, dropId: drop.dropId, payload: state.multiplayer ? drop.payload : payload, grantedItemIds, grantedUnitIds,
      ...(state.multiplayer||drop.roundId!==state.roundDefinitionId ? {resolution:resolution!,gold:capacityGold || (payload.kind==='gold'?payload.quantity:0),claimedRoundId:state.roundDefinitionId} : {}),
      ...(grantedConsumableIds?{grantedConsumableIds}:{}) };
    state = commitReceipt(state, receipt);
    state = withLoot(state, { ...state.m8.loot, direct: state.m8.loot.direct.map(value => value.dropId === drop.dropId
      ? { dropId: value.dropId, status: 'granted', receiptId } : value) });
    events.push({ type: 'lootGranted', receipt });
  }
  return { state, events, upgradeEvents };
}

function grantItem(state: MatchState, definitionId: string, receiptId: string) {
  const grant = planPermanentItemGrant(state, { definitionId, receiptId }, state.m8.loot.receipts.map(value => value.receiptId));
  if (!grant.ok) throw new RangeError(`Invalid loot item grant: ${grant.reason}`);
  return { ...grant, state: applyAngerIssues({ ...grant.state, resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId,
    { kind: 'item-acquired', itemId: grant.grantedItemIds[0], source: { kind: 'loot', receiptId } }) }) };
}

export function unresolvedLootChoices(state: MatchState): readonly LootChoiceDescriptor[] {
  const due = new Set((state.m8.loot.carry ?? []).filter(row => row.deliverRoundId === state.roundDefinitionId).map(row => row.dropId));
  const choices = [...currentPlan(state)?.choices ?? []];
  if (due.size) for (const choice of state.m8.loot.frozen.rounds.flatMap(round => round.choices)) if (due.has(choice.dropId) && !choices.some(existing => existing.dropId === choice.dropId)) choices.push(choice);
  return orderedUnresolvedLootChoices(choices, state.m8.loot.choiceEligibility, state.m8.loot.choiceResolutions);
}
/** Direct drops a previous PvE loss parked on this round and that this round has not granted yet. */
export function dueCarriedDirectDrops(state: MatchState): readonly FrozenDirectDrop[] {
  const due = new Set((state.m8.loot.carry ?? []).filter(row => row.deliverRoundId === state.roundDefinitionId).map(row => row.dropId));
  if (!due.size) return [];
  return state.m8.loot.frozen.rounds.flatMap(round => round.encounterPlan.drops)
    .filter(drop => due.has(drop.dropId) && state.m8.loot.direct.some(progress => progress.dropId === drop.dropId && progress.status === 'carried'))
    .sort(compareLootFreezeSlots);
}
/** Component picks parked on this round become the same post-combat choice as this round's own picks. */
export function revealDueCarriedChoices(state: MatchState): MatchState {
  const due = new Set((state.m8.loot.carry ?? []).filter(row => row.deliverRoundId === state.roundDefinitionId).map(row => row.dropId));
  if (!due.size) return state;
  let changed = false;
  const choiceEligibility = state.m8.loot.choiceEligibility.map(choice => {
    if (!due.has(choice.dropId) || choice.status !== 'carried') return choice;
    changed = true; return { dropId: choice.dropId, status: 'revealed' as const };
  });
  return changed ? withLoot(state, { ...state.m8.loot, choiceEligibility }) : state;
}
/** Elimination or a final round with no later PvE voids loot that was still waiting. Granted rows keep their carry record. */
export function forfeitCarriedLoot(state: MatchState): { state: MatchState; events: MatchEvent[] } {
  const carry = state.m8.loot.carry ?? [];
  if (!carry.length) return { state, events: [] };
  const pending = carry.filter(row => state.m8.loot.direct.some(drop => drop.dropId === row.dropId && drop.status === 'carried')
    || state.m8.loot.choiceEligibility.some(choice => choice.dropId === row.dropId && choice.status === 'carried'));
  if (!pending.length) return { state, events: [] };
  const ids = new Set(pending.map(row => row.dropId));
  const kept = carry.filter(row => !ids.has(row.dropId));
  const { carry: _previous, ...rest } = state.m8.loot;
  return { events: pending.map(row => ({ type: 'lootForfeited' as const, dropId: row.dropId })), state: withLoot(state, {
    ...rest, ...(kept.length ? { carry: kept } : {}),
    direct: state.m8.loot.direct.map(drop => ids.has(drop.dropId) && drop.status === 'carried' ? { dropId: drop.dropId, status: 'forfeited' as const, receiptId: null } : drop),
    choiceEligibility: state.m8.loot.choiceEligibility.map(choice => ids.has(choice.dropId) && choice.status === 'carried' ? { dropId: choice.dropId, status: 'forfeited' as const } : choice),
  }) };
}
export function hasPendingLootCapacity(state: MatchState): boolean {
  return !state.multiplayer && state.m8.loot.direct.some(value => value.status === 'pending-capacity');
}
export function grantLootChoice(state: MatchState, descriptor: LootChoiceDescriptor, definitionId: string,
  method: 'player-choice' | 'terminal-fallback'): { state: MatchState; events: MatchEvent[] } {
  const actual = currentPlan(state)?.choices.find(value => value.dropId === descriptor.dropId);
  if (!actual || canonicalContent(actual) !== canonicalContent(descriptor)
    || !COMPONENT_POOL.some(value => value.definitionId === definitionId)
    || method !== 'player-choice' && method !== 'terminal-fallback'
    || method === 'terminal-fallback' && definitionId !== actual.terminalFallbackDefinitionId) throw new RangeError('Invalid loot choice');
  if (state.m8.loot.choiceResolutions.some(value => value.dropId === actual.dropId)) return { state, events: [] };
  if (state.combat?.status !== 'finished') throw new RangeError('Loot choice before combat finish');
  if (!unresolvedLootChoices(state).some(value => value.dropId === actual.dropId)) throw new RangeError('Unearned loot choice');
  const receiptId = lootReceiptId(actual.dropId), grant = grantItem(state, definitionId, receiptId);
  const payload: LootPayload = { kind: 'item', definitionId, quantity: 1 };
  const receipt: LootReceipt = { receiptId, dropId: actual.dropId, payload, grantedItemIds: grant.grantedItemIds, grantedUnitIds: [] };
  state = commitReceipt(grant.state, receipt);
  state = withLoot(state, { ...state.m8.loot, choiceResolutions: [...state.m8.loot.choiceResolutions, { dropId: actual.dropId, receiptId, method }] });
  return { state, events: [{ type: 'lootGranted', receipt }, { type: 'lootChoiceResolved', dropId: actual.dropId, receiptId, method }] };
}
