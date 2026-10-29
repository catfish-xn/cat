import { applyAngerIssues } from '../augment-pool-batch5-r2';
import { CONSUMABLE_DEFINITIONS } from '../content/consumables';
import { ITEM_DEFINITIONS } from '../content/g2-3-item-registry';
import { planPermanentItemGrant } from '../item-grants';
import type { UnitLootPolicy } from '../loot-runtime';
import type { FrozenDirectDrop } from '../loot-types';
import type { MatchEvent, MatchState } from '../match-types';
import { appendResourceProvenance, mergeGrowthLedger } from '../resource-provenance';
import { planUnitAcquisition } from '../unit-acquisition';
import { reconcileD14 } from '../d14-runtime';
import { SHOP_CATALOG } from '../match-rules';
import { UNIT_DEFINITIONS } from '../units';
import type { UnitUpgradedEvent } from '../unit-types';
import { appendMechanicReceipt, findMechanicReceipt } from './state';
import type { MechanicReceipt, MechanicSource } from './types';
import { enqueueRewardOrb } from '../orb-claim';
import { pruneForgePositions } from '../forge-positions';

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
  const next = applyAngerIssues(appendMechanicReceipt(pruneForgePositions(state), receipt));
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

/** Online heroes enqueue an exactly-once reward orb without inventory or pool allocation.
 * Shop gifts also use this envelope for solo capacity retries. Other offline grants retain their original retry/policy behavior; summons remain direct births. */
export function grantMechanicUnit(state: MatchState, request: MechanicGrantRequest & { readonly definitionId: string; readonly starLevel?:1|2|3; readonly immediate?:boolean }, unitLootPolicy?: UnitLootPolicy): MechanicGrantResult {
  const bad = badRequest(state, request); if (bad) return bad;
  // Pooled shop heroes, or summons (UnitDefinition.summon), which never touch the shared pool.
  const summon = !!UNIT_DEFINITIONS[request.definitionId]?.summon;
  if (!summon && !SHOP_CATALOG.includes(request.definitionId)) return refuse(state, 'invalid-mechanic-state');
  if ((state.multiplayer || request.source==='augment-pool-shop') && !summon && !request.immediate) {
    if (![1,2,3].includes(request.starLevel??1)) return refuse(state,'invalid-mechanic-state');
    const queued=enqueueRewardOrb(state,request.receiptId,request.definitionId,request.starLevel??1);
    return commit(queued.state,{...identity(state,request),kind:'unit',definitionId:request.definitionId,
      starLevel:request.starLevel??1,resolution:'orb',orbId:queued.orbId,unitId:null,gold:0});
  }
  const plan = planUnitAcquisition(state, request.definitionId, { kind: 'mechanic', receiptId: request.receiptId }, state.resourceProvenance.entries.length,false,request.starLevel??1);
  if (!plan.ok) return refuse(state, 'bench-full');
  const drop = { dropId: mechanicDropId(request.receiptId), payload: { kind: 'unit', definitionId: request.definitionId, quantity: 1,...(request.starLevel?{starLevel:request.starLevel}:{}) } } as unknown as FrozenDirectDrop;
  const payload = unitLootPolicy && !summon ? unitLootPolicy(drop) : drop.payload;
  if (payload.kind === 'gold') {
    if (!Number.isSafeInteger(state.gold + payload.quantity)) return refuse(state, 'invalid-mechanic-state');
    return commit({ ...state, gold: state.gold + payload.quantity }, { ...identity(state, request), kind: 'unit',
      definitionId: request.definitionId,...(request.starLevel?{starLevel:request.starLevel}:{}), resolution: 'gold', unitId: null, gold: payload.quantity });
  }
  const born: MatchState = { ...state, preparation: plan.preparation, nextUnitSerial: plan.nextUnitSerial, items: plan.items,
    anomalyBinding: plan.anomalyBinding, persistentGrowth: mergeGrowthLedger(state.persistentGrowth, plan.upgradeEvents),
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, plan.facts) };
  const events: MatchEvent[] = [...plan.events];
  return commit(reconcileD14(born, events), { ...identity(state, request), kind: 'unit', definitionId: request.definitionId,...(request.starLevel?{starLevel:request.starLevel}:{}), resolution: 'held', unitId: plan.unitId, gold: 0 },
    events, plan.upgradeEvents);
}

/** Generic exactly-once consumable grant, including both champion duplicators. */
export function grantMechanicConsumable(state: MatchState, request: MechanicGrantRequest & { readonly definitionId: string }): MechanicGrantResult {
  const bad = badRequest(state, request); if (bad) return bad;
  if (!Object.hasOwn(CONSUMABLE_DEFINITIONS, request.definitionId)) return refuse(state, 'invalid-mechanic-state');
  const consumableId = `consumable-${state.nextConsumableSerial}`;
  return commit({...state, nextConsumableSerial: state.nextConsumableSerial + 1,
    consumables: [...state.consumables, {consumableId, definitionId: request.definitionId as keyof typeof CONSUMABLE_DEFINITIONS}]},
    {...identity(state, request), kind:'consumable', definitionId:request.definitionId, consumableId});
}
