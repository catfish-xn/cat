import { ITEM_DEFINITIONS } from '../content/g2-3-item-registry';
import { planPermanentItemGrant } from '../item-grants';
import type { UnitLootPolicy } from '../loot-runtime';
import type { FrozenDirectDrop } from '../loot-types';
import type { MatchEvent, MatchState } from '../match-types';
import { appendResourceProvenance, mergeGrowthLedger } from '../resource-provenance';
import { planUnitAcquisition } from '../unit-acquisition';
import { SHOP_CATALOG } from '../match-rules';
import { UNIT_DEFINITIONS } from '../units';
import type { UnitUpgradedEvent } from '../unit-types';
import { appendMechanicReceipt, findMechanicReceipt } from './state';
import type { MechanicReceipt, MechanicSource } from './types';

export interface MechanicGrantRequest { readonly receiptId: string; readonly source: MechanicSource }
export type MechanicGrantResult =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[]; readonly receipt: MechanicReceipt;
      readonly upgradeEvents: readonly UnitUpgradedEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: 'duplicate-mechanic-receipt' | 'bench-full' | 'invalid-mechanic-state' };

/** Pseudo drop id under which a mechanic unit grant borrows the shared pool's reward reservation (shared-pool-ledger). */
export const mechanicDropId = (receiptId: string): string => JSON.stringify(['mechanic', receiptId]);
export const isMechanicDropId = (dropId: string): boolean => dropId.startsWith('["mechanic",');

const refuse = (state: MatchState, reason: Extract<MechanicGrantResult, { ok: false }>['reason']): MechanicGrantResult => ({ ok: false, state, reason });
function identity(state: MatchState, request: MechanicGrantRequest) {
  return { receiptId: request.receiptId, round: state.round, roundId: state.roundDefinitionId, source: request.source };
}
function badRequest(state: MatchState, request: MechanicGrantRequest): MechanicGrantResult | null {
  if (typeof request.receiptId !== 'string' || !request.receiptId || typeof request.source !== 'string' || !request.source) return refuse(state, 'invalid-mechanic-state');
  return findMechanicReceipt(state, request.receiptId) ? refuse(state, 'duplicate-mechanic-receipt') : null;
}
function commit(state: MatchState, receipt: MechanicReceipt, events: readonly MatchEvent[] = [], upgradeEvents: readonly UnitUpgradedEvent[] = []): MechanicGrantResult {
  const next = appendMechanicReceipt(state, receipt);
  return { ok: true, state: next, receipt, upgradeEvents, events: [...events, { type: 'mechanicGranted', receipt }] };
}

/** Combat or chest gold with its source. Exactly once per receiptId; the receipt is the UI's "gold source" line. */
export function grantMechanicGold(state: MatchState, request: MechanicGrantRequest & { readonly amount: number }): MechanicGrantResult {
  const bad = badRequest(state, request); if (bad) return bad;
  if (!Number.isSafeInteger(request.amount) || request.amount < 1 || !Number.isSafeInteger(state.gold + request.amount)) return refuse(state, 'invalid-mechanic-state');
  return commit({ ...state, gold: state.gold + request.amount }, { ...identity(state, request), kind: 'gold', amount: request.amount });
}

/** One permanent item to inventory (forge pick, black market pick, chest item, academy sponsor item, radiant item). */
export function grantMechanicItem(state: MatchState, request: MechanicGrantRequest & { readonly definitionId: string }): MechanicGrantResult {
  const bad = badRequest(state, request); if (bad) return bad;
  if (!Object.hasOwn(ITEM_DEFINITIONS, request.definitionId)) return refuse(state, 'invalid-mechanic-state');
  const plan = planPermanentItemGrant(state, { definitionId: request.definitionId, receiptId: request.receiptId }, []);
  if (!plan.ok) return refuse(state, 'invalid-mechanic-state');
  const itemId = plan.grantedItemIds[0];
  const granted: MatchState = { ...plan.state, resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId,
    { kind: 'item-acquired', itemId, source: { kind: 'mechanic', receiptId: request.receiptId } }) };
  return commit(granted, { ...identity(state, request), kind: 'item', definitionId: request.definitionId, itemId });
}

/**
 * One hero to the bench, through the shared pool when `unitLootPolicy` is the transaction's policy (runSharedMatchCommand
 * passes it to every command). Shared and the pool has no copy: pays the unit's cost in gold instead, like PvE unit loot.
 * Bench full: refused with 'bench-full' before the pool is touched, nothing changes. A successful result must be committed
 * in the same command: an uncommitted shared reservation fails the pool's conservation check.
 * Offline (no policy) the unit is always born when the bench has room. A summon definition is born the same way without
 * the pool; place it with deployMatchUnit or the mechanic's own placement afterwards.
 */
export function grantMechanicUnit(state: MatchState, request: MechanicGrantRequest & { readonly definitionId: string }, unitLootPolicy?: UnitLootPolicy): MechanicGrantResult {
  const bad = badRequest(state, request); if (bad) return bad;
  // Pooled shop heroes, or summons (UnitDefinition.summon), which never touch the shared pool.
  const summon = !!UNIT_DEFINITIONS[request.definitionId]?.summon;
  if (!summon && !SHOP_CATALOG.includes(request.definitionId)) return refuse(state, 'invalid-mechanic-state');
  const plan = planUnitAcquisition(state, request.definitionId, { kind: 'mechanic', receiptId: request.receiptId }, state.resourceProvenance.entries.length);
  if (!plan.ok) return refuse(state, 'bench-full');
  const drop = { dropId: mechanicDropId(request.receiptId), payload: { kind: 'unit', definitionId: request.definitionId, quantity: 1 } } as unknown as FrozenDirectDrop;
  const payload = unitLootPolicy && !summon ? unitLootPolicy(drop) : drop.payload;
  if (payload.kind === 'gold') {
    if (!Number.isSafeInteger(state.gold + payload.quantity)) return refuse(state, 'invalid-mechanic-state');
    return commit({ ...state, gold: state.gold + payload.quantity }, { ...identity(state, request), kind: 'unit',
      definitionId: request.definitionId, resolution: 'gold', unitId: null, gold: payload.quantity });
  }
  const born: MatchState = { ...state, preparation: plan.preparation, nextUnitSerial: plan.nextUnitSerial, items: plan.items,
    anomalyBinding: plan.anomalyBinding, persistentGrowth: mergeGrowthLedger(state.persistentGrowth, plan.upgradeEvents),
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, plan.facts) };
  return commit(born, { ...identity(state, request), kind: 'unit', definitionId: request.definitionId, resolution: 'held', unitId: plan.unitId, gold: 0 },
    plan.events, plan.upgradeEvents);
}
