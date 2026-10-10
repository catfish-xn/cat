import type { CombatState } from './combat-types';
import { COMPONENT_POOL } from './component-pool';
import { canonicalContent } from './content';
import { ITEM_DEFINITIONS } from './content/items';
import { ROUND_CATALOG } from './content/round-catalog';
import { planPermanentItemGrant } from './item-grants';
import { orderedUnresolvedLootChoices } from './loot-choice';
import { advanceFrozenLootLedger, freezeLootThroughRound } from './loot-freeze';
import { compareLootFreezeSlots, lootReceiptId } from './loot-identity';
import type { LootChoiceDescriptor, MatchLootState } from './loot-types';
import type { LootPayload, LootReceipt } from './m8/contracts';
import type { MatchEvent, MatchState } from './match-types';
import { appendResourceProvenance, mergeGrowthLedger } from './resource-provenance';
import type { UnitUpgradedEvent } from './unit-types';
import { planUnitAcquisition } from './unit-acquisition';

const counterKey = (roundId: string) => JSON.stringify(['m8b-loot-project-v1', roundId, 'components-granted']);
const currentPlan = (state: MatchState) => state.m8.loot.frozen.rounds.find(value => value.encounterPlan.roundId === state.roundDefinitionId);
const withLoot = (state: MatchState, loot: MatchLootState): MatchState => ({ ...state, m8: { ...state.m8, loot } });

/** Preparation owns the sole frozen plan and RNG; runtime progress only references its IDs. */
export function prepareMatchLoot(seed: number, round: number, previous?: MatchLootState): MatchLootState {
  if (previous && previous.frozen.seed !== seed) throw new RangeError('Loot seed mismatch');
  const frozen = previous ? advanceFrozenLootLedger(previous.frozen, round) : freezeLootThroughRound(seed, round);
  if (frozen === previous?.frozen) return previous;
  const added = frozen.rounds.slice(previous?.frozen.rounds.length ?? 0);
  return { frozen,
    direct: [...previous?.direct ?? [], ...added.flatMap(value => value.encounterPlan.drops.map(drop => ({ dropId: drop.dropId, status: 'planned' as const, receiptId: null })))],
    choiceEligibility: [...previous?.choiceEligibility ?? [], ...added.flatMap(value => value.choices.map(choice => ({ dropId: choice.dropId, status: 'planned' as const })))],
    choiceResolutions: previous?.choiceResolutions ?? [], earnedEvidence: previous?.earnedEvidence ?? [], receipts: previous?.receipts ?? [],
    guaranteeCounters: previous?.guaranteeCounters ?? Object.fromEntries(ROUND_CATALOG.filter(value => value.kind === 'pve').map(value => [counterKey(value.roundId), 0])),
  };
}

/** Observe committed B7 deaths only. Neither a reveal nor a forfeit allocates resources. */
export function revealMatchLoot(state: MatchState, combat: CombatState): { state: MatchState; events: MatchEvent[] } {
  const plan = currentPlan(state), events: MatchEvent[] = [];
  if (!plan) return { state, events };
  if (combat.combatId !== `round-${state.round}`) throw new RangeError('Loot combat mismatch');
  const loot = state.m8.loot, earnedEvidence = [...loot.earnedEvidence];
  const transition = (drop: { readonly dropId: string; readonly status: string }, sourceUnitId: string) => {
    if (drop.status !== 'planned') return drop.status;
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
    if (combat.status === 'finished') { events.push({ type: 'lootForfeited', dropId: drop.dropId }); return 'forfeited'; }
    return 'planned';
  };
  const direct = loot.direct.map(drop => {
    const frozen = plan.encounterPlan.drops.find(value => value.dropId === drop.dropId);
    if (!frozen || drop.status !== 'planned') return drop;
    if (!frozen.sourceUnitId) throw new RangeError('Missing loot source');
    const status = transition(drop, frozen.sourceUnitId) as 'planned' | 'revealed' | 'forfeited';
    return status === drop.status ? drop : { ...drop, status };
  });
  const choiceEligibility = loot.choiceEligibility.map(choice => {
    const descriptor = plan.choices.find(value => value.dropId === choice.dropId);
    if (!descriptor || choice.status !== 'planned') return choice;
    const status = transition(choice, descriptor.sourceUnitId) as 'planned' | 'revealed' | 'forfeited';
    return status === choice.status ? choice : { ...choice, status };
  });
  return { state: events.length ? withLoot(state, { ...loot, direct, choiceEligibility, earnedEvidence }) : state, events };
}

function commitReceipt(state: MatchState, receipt: LootReceipt): MatchState {
  const loot = state.m8.loot;
  if (loot.receipts.some(value => value.receiptId === receipt.receiptId || value.dropId === receipt.dropId)) throw new RangeError('Duplicate loot receipt');
  let guaranteeCounters = loot.guaranteeCounters;
  if (receipt.payload.kind === 'item' && ITEM_DEFINITIONS[receipt.payload.definitionId]?.kind === 'component') {
    const key = counterKey(state.roundDefinitionId);
    const count = guaranteeCounters[key] + receipt.payload.quantity;
    if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('Invalid loot counter');
    guaranteeCounters = { ...guaranteeCounters, [key]: count };
  }
  return withLoot(state, { ...loot, receipts: [...loot.receipts, receipt], guaranteeCounters });
}

/** No phase, economy or pending-delta changes. Match commits returned upgrades in its final transaction. */
export function grantDirectLoot(initial: MatchState, terminal: boolean): { state: MatchState; events: MatchEvent[]; upgradeEvents: UnitUpgradedEvent[] } {
  let state = initial;
  const events: MatchEvent[] = [], upgradeEvents: UnitUpgradedEvent[] = [];
  for (const drop of [...currentPlan(state)?.encounterPlan.drops ?? []].sort(compareLootFreezeSlots)) {
    const progress = state.m8.loot.direct.find(value => value.dropId === drop.dropId);
    if (progress?.status !== 'revealed' && progress?.status !== 'pending-capacity') continue;
    if (state.combat?.status !== 'finished') throw new RangeError('Loot grant before combat finish');
    const payload = drop.payload, receiptId = lootReceiptId(drop.dropId);
    let grantedItemIds: readonly string[] = [], grantedUnitIds: readonly string[] = [];
    if (payload.kind === 'unit') {
      const purchase = planUnitAcquisition(state, payload.definitionId, { kind: 'loot', receiptId }, state.resourceProvenance.entries.length);
      if (!purchase.ok) {
        const status = terminal ? 'retained-terminal' : 'pending-capacity';
        if (progress.status !== status) state = withLoot(state, { ...state.m8.loot,
          direct: state.m8.loot.direct.map(value => value.dropId === drop.dropId ? { dropId: value.dropId, status, receiptId: null } : value) });
        continue;
      }
      state = { ...state, preparation: purchase.preparation, nextUnitSerial: purchase.nextUnitSerial,
        items: purchase.items, anomalyBinding: purchase.anomalyBinding, persistentGrowth: mergeGrowthLedger(state.persistentGrowth, purchase.upgradeEvents),
        resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, purchase.facts) };
      upgradeEvents.push(...purchase.upgradeEvents); events.push(...purchase.events); grantedUnitIds = [purchase.unitId];
    } else if (payload.kind === 'item') {
      const grant = grantItem(state, payload.definitionId, receiptId); state = grant.state; grantedItemIds = grant.grantedItemIds;
    } else {
      const gold = state.gold + payload.quantity;
      if (!Number.isSafeInteger(gold)) throw new RangeError('Loot gold overflow');
      state = { ...state, gold };
    }
    const receipt = { receiptId, dropId: drop.dropId, payload, grantedItemIds, grantedUnitIds };
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
  return { ...grant, state: { ...grant.state, resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId,
    { kind: 'item-acquired', itemId: grant.grantedItemIds[0], source: { kind: 'loot', receiptId } }) } };
}

export function unresolvedLootChoices(state: MatchState): readonly LootChoiceDescriptor[] {
  return orderedUnresolvedLootChoices(currentPlan(state)?.choices ?? [], state.m8.loot.choiceEligibility, state.m8.loot.choiceResolutions);
}
export function hasPendingLootCapacity(state: MatchState): boolean {
  return state.m8.loot.direct.some(value => value.status === 'pending-capacity');
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
