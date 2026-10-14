/**
 * C18-B: where the R3/R4 panels get their data (MULTIPLAYER_CONTRACT §18.4/§18.8). Online the display MatchState is
 * the private seat view, carrying `revealedLoot.revealedOrbs`, `consumables` and `consumableTargets`; offline it is
 * the authoritative MatchState itself. Nothing here decides a rule: the online target answers are the server's
 * projection (§18.8 01), the offline ones the rules' own previewUseConsumable on the real state.
 */
import type { MatchState } from '../../simulation/match-types';
import { readLootView } from '../../simulation/match';
import { previewUseConsumable } from '../../simulation/consumables';
import { CONSUMABLE_DEFINITIONS } from '../../simulation/content/consumables';
import type { ConsumableInstance, ConsumablePreview, ConsumableTarget } from '../../simulation/consumable-types';
import type { ConsumableTargetView } from '../../simulation/private-seat-view';
import type { OrbLoot } from '../../presentation/orb-loot';

type SeatViewFields = {
  readonly revealedLoot?: Partial<OrbLoot>;
  readonly consumableTargets?: readonly { readonly consumableId: string; readonly targets: readonly ConsumableTargetView[] }[];
};
/** Online display state (a private seat view): it carries the server's target projection; an offline state never does. */
const seatView = (state: MatchState): SeatViewFields | null => Array.isArray((state as MatchState & SeatViewFields).consumableTargets) ? state as MatchState & SeatViewFields : null;

/** The round's orb summary: the private view's revealedLoot online, the rules' LootView offline; null without orbs. */
export function readOrbLoot(state: MatchState): OrbLoot | null {
  const online = (state as MatchState & SeatViewFields).revealedLoot;
  if (online) return typeof online.roundId === 'string' && Array.isArray(online.revealedDrops) && Array.isArray(online.revealedOrbs) ? online as OrbLoot : null;
  if (seatView(state) || state.m8.round.kind !== 'pve') return null;
  const view = readLootView(state);
  return view.revealedOrbs.length ? view : null;
}
/** My unused tool instances (§18.4 `consumables`, carried across rounds), in the server's order. */
export function readConsumables(state: MatchState): readonly ConsumableInstance[] {
  return Array.isArray(state.consumables) ? state.consumables : [];
}

/**
 * Whether `consumableId` can be used on `target`, and on what. Online: the server's consumableTargets row (§18.8 01);
 * a missing row or target is not usable (never a preview run on the partial view). Offline: previewUseConsumable on
 * the authoritative state. The server checks again when the command arrives.
 */
export function previewConsumable(state: MatchState, consumableId: string, target: ConsumableTarget): ConsumablePreview {
  const view = seatView(state);
  if (!view) return previewUseConsumable(state, consumableId, target);
  const row = view.consumableTargets!.find(entry => entry.consumableId === consumableId);
  if (!row) return { ok: false, reason: 'unknown-consumable' };
  const same = (a: ConsumableTarget) => a.kind === target.kind && (a.kind === 'unit' ? a.unitId === (target as typeof a).unitId : a.itemId === (target as typeof a).itemId);
  const answer = row.targets.find(entry => same(entry.target));
  if (!answer) return { ok: false, reason: 'invalid-consumable-target' };
  if (!answer.allowed) return { ok: false, reason: answer.reason };
  const tool = readConsumables(state).find(entry => entry.consumableId === consumableId);
  if (!tool) return { ok: false, reason: 'unknown-consumable' };
  return { ok: true, effect: CONSUMABLE_DEFINITIONS[tool.definitionId].effect, affectedItemIds: answer.affectedItemIds, destination: 'inventory', affectsCurrentBattle: false };
}
