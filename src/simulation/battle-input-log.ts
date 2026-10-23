/** Private authoritative commands, never projected into public combat frames.
 * Phase 2: allocate seq in single-writer order; effectiveTick is the next unsealed
 * tick. Append only AFTER a successful installation, atomically with its effects.
 * Failed commands must leave the state, log, events and RNG unchanged.
 */
export interface BattleEquipmentInput {
  readonly kind: 'equipment';
  readonly seq: number;
  readonly effectiveTick: number;
  readonly seatId: string;
  readonly itemId: string;
  readonly unitId: string;
  readonly slot: number;
}
export type BattleTickInput = BattleEquipmentInput;
/** Invoked immediately before EVERY rules tick, including inside advance(n).
 * The caller supplies only server-authorized inputs in (effectiveTick, seq) order.
 * Successful assets are staged through queueEquipment; this hook authenticates their order.
 */
export type BattleTickInputSource = (effectiveTick: number) => readonly BattleTickInput[];

/** Existing Match equipment history, replayed through the public commands and
 * authenticated against resource provenance. tick is the cursor BEFORE stepping.
 * Keep this journal for successful equips/combinations even while combat is frozen.
 */
export type BattleEquipmentCommand =
  | { readonly tick: number; readonly itemId: string; readonly unitId: string; readonly slot: number }
  | { readonly tick: number; readonly consumableId: string; readonly target: import('./consumable-types').ConsumableTarget }
  | { readonly tick: number; readonly consumedIds: readonly [string, string] };
