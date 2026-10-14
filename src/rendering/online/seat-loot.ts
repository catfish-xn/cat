/**
 * C18-B: where the R3/R4 loot panels get their data online: the server's private seat view (contract §18.4/§18.8),
 * carried as is onto the display state by toDisplayMatch. `revealedLoot` v2 (orbs and their entries), `consumables`
 * (my tool instances) and `consumableTargets` (the rules' answer for every candidate target). Nothing here judges a
 * target or computes a reforge result: a target the server did not list is unusable.
 */
import type { MatchState } from '../../simulation/match-types';
import { CONSUMABLE_DEFINITIONS } from '../../simulation/content/consumables';
import type { ConsumableTargetView } from '../../server-entry';
import type { ConsumableAnswer, ConsumableInstance, ConsumableTarget, OrbLoot } from '../../presentation/orb-loot';

type SeatLootFields = {
  readonly revealedLoot?: Partial<OrbLoot>;
  readonly consumables?: readonly ConsumableInstance[];
  readonly consumableTargets?: readonly { readonly consumableId: string; readonly targets: readonly ConsumableTargetView[] }[];
};

/** The server's orb summary of my current PvE round (§18.4 v2: `revealedOrbs` present); null otherwise. */
export function readOrbLoot(state: MatchState): OrbLoot | null {
  const loot = (state as MatchState & SeatLootFields).revealedLoot;
  return loot && typeof loot.roundId === 'string' && Array.isArray(loot.revealedDrops) && Array.isArray(loot.revealedOrbs) ? loot as OrbLoot : null;
}
/** My unconsumed tools in the server's order; null when the view carries no target answers (offline, older server). */
export function readConsumables(state: MatchState): readonly ConsumableInstance[] | null {
  const fields = state as MatchState & SeatLootFields;
  return Array.isArray(fields.consumables) && Array.isArray(fields.consumableTargets) ? fields.consumables : null;
}

const sameTarget = (a: ConsumableTarget, b: ConsumableTarget) =>
  a.kind === 'unit' ? b.kind === 'unit' && a.unitId === b.unitId : b.kind === 'item' && a.itemId === b.itemId;

/**
 * The server's answer for `consumableId` on `target` (§18.8 SR-C18-01), or `not-listed` when its row or the target is
 * missing. The effect name comes from the content table; the affected items are the server's.
 */
export function consumableAnswer(state: MatchState, consumableId: string, target: ConsumableTarget): ConsumableAnswer {
  const fields = state as MatchState & SeatLootFields;
  const tool = fields.consumables?.find(entry => entry.consumableId === consumableId);
  const entry = fields.consumableTargets?.find(row => row.consumableId === consumableId)?.targets.find(candidate => sameTarget(candidate.target, target));
  if (!tool || !entry) return { ok: false, reason: 'not-listed' };
  if (!entry.allowed) return { ok: false, reason: entry.reason };
  return { ok: true, effect: CONSUMABLE_DEFINITIONS[tool.definitionId].effect, affectedItemIds: entry.affectedItemIds };
}
