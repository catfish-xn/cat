/* Room fields outside RoomState that a checkpoint must carry for a room restored by assigning `current` to behave like
 * the room it was taken from. Mirrors roomPrivate in scripts/record-v26-neutrals-1424-battle-start.cjs.
 * Checked and left out: options-derived fields (pvpMode, checkConservation, pairingPolicy), timers and listeners
 * (re-armed by the room), per-freeze/per-battle staging (frozen inputs, streams, locks, live tracks, settlement work;
 * all empty at a preparation checkpoint and rebuilt by freezeAndResolve), `extensions` (reset at round entry), and the
 * display-only legend walk book. */
import type { Room } from '../../src/server/room/room';

export interface RoomPrivate {
  readonly augmentPreparationStartedAt: number;
  readonly augmentPreparationObserved: boolean;
  readonly phaseDeadline: number | null;
  readonly battleEquipmentSeq: number;
  readonly previousAugmentBattles: readonly (readonly [string, unknown])[];
}
type Fields = { augmentPreparationStartedAt: number; augmentPreparationObserved: boolean; phaseDeadline: number | null;
  battleEquipmentSeq: number; previousAugmentBattles: Map<string, unknown> };

export function captureRoomPrivate(room: Room): RoomPrivate {
  const r = room as unknown as Fields;
  return structuredClone({ augmentPreparationStartedAt: r.augmentPreparationStartedAt, augmentPreparationObserved: r.augmentPreparationObserved,
    phaseDeadline: r.phaseDeadline, battleEquipmentSeq: r.battleEquipmentSeq, previousAugmentBattles: [...r.previousAugmentBattles] });
}
export function restoreRoomPrivate(room: Room, saved: RoomPrivate): void {
  const r = room as unknown as Fields;
  r.augmentPreparationStartedAt = saved.augmentPreparationStartedAt; r.augmentPreparationObserved = saved.augmentPreparationObserved;
  r.phaseDeadline = saved.phaseDeadline; r.battleEquipmentSeq = saved.battleEquipmentSeq;
  r.previousAugmentBattles.clear(); for (const [seatId, battle] of structuredClone(saved.previousAugmentBattles)) r.previousAugmentBattles.set(seatId, battle);
}
