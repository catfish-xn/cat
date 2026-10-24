/**
 * v22 anvil units in a room (docs/ANVIL_UNITS.md): a forge reward no longer opens a popup by itself. It arrives as an
 * unclaimed orb, the seat claims it onto its bench as an anvil unit, and opening (selling) that unit opens the forge
 * choice, which runs on the room's own deadline for that choice (`SeatState.choiceDeadline`, the choice's `timeoutMs`).
 * Shared by the room tests of the G2-3/G2-4 Conqueror anvils and the opening-encounter anvils.
 */
import { expect } from 'vitest';
import type { Room } from '../../src/server/room/room';
import type { RoomState, SeatState } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import type { PendingChoice } from '../../src/simulation/strategy-types';
import { G23_CONQUEROR_CHESTS, g23ConquerorReward } from '../../src/simulation/content/g2-3-policy';
import { g23RewardAtoms } from '../../src/simulation/g2-3-rewards';
import { readG23Progress, writeG23Progress } from '../../src/simulation/g2-3-state';
import { readLootView } from '../../src/simulation/loot-view';

export const seatOf = (state: RoomState, seatId: string): SeatState => state.seats.find(seat => seat.seatId === seatId)!;
export const countOf = (match: MatchState, definitionId: string) => match.items.filter(item => item.definitionId === definitionId).length;
/** The rules' opaque choice id of an opened anvil unit. */
export const anvilChoiceId = (unitId: string) => JSON.stringify(['anvil', unitId]);
/** The four anvil definition ids (completed, component, artifact, support). */
export const ANVIL = { completed: 'TFT_ArmoryKeyCompleted', component: 'TFT_ArmoryKeyComponent', artifact: 'TFT_ArmoryKeyOrnn', support: 'TFT_ArmoryKeySupport' } as const;
export const benchAnvils = (match: MatchState) => match.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'bench' && unit.definitionId.startsWith('TFT_ArmoryKey'));

/** The Conqueror tier bundles as the rules' economy records them on crossing the thresholds (gold is paid apart). */
export function withChests(...tiers: readonly number[]) {
  return (match: MatchState): MatchState => {
    const progress = readG23Progress(match)!;
    const bundles = tiers.map(tier => {
      const { Gold: _gold, ...reward } = g23ConquerorReward(G23_CONQUEROR_CHESTS[tier - 1]!);
      return { id: `g23:conqueror:${tier}`, round: match.round, source: 'conqueror' as const, tier, reward };
    });
    return writeG23Progress(match, { ...progress, rewards: [...progress.rewards, ...bundles] });
  };
}
/**
 * Test seam: replaces one seat's live MatchState as a seat transaction would (new seatRevision), so the battle deadline
 * finds the staged settlement stale and settles again on this live state (§15.2), exactly as after an operation in battle.
 */
export function seedSeat(room: Room, seatId: string, change: (match: MatchState) => MatchState): void {
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => seat.seatId === seatId ? { ...seat, match: change(seat.match), seatRevision: seat.seatRevision + 1 } : seat) };
}
/**
 * Runs the room to its round-4 battle, seeds `seatId`'s chests of `tiers` (reaching tier 9+ for real takes hundreds of
 * Conqueror stacks) and lets the battle deadline commit the round: the room's own commit grants them, in settlement.
 */
export function toChestSettlement(room: Room, runNext: () => boolean, seatId: string, ...tiers: readonly number[]): void {
  for (let fired = 0; !(room.state.round === 4 && room.state.phase === 'battle') && fired < 2_000; fired++) if (!runNext()) break;
  expect(room.state).toMatchObject({ round: 4, phase: 'battle' });
  seedSeat(room, seatId, withChests(...tiers));
  for (let fired = 0; room.state.phase === 'battle' && fired < 2_000; fired++) if (!runNext()) break;
  expect(room.state).toMatchObject({ round: 4, phase: 'settlement' });
}
/** The options the rules sampled for atom `index` of the seat's tier bundle (an anvil's four offers). */
export function atomOptions(match: MatchState, tier: number, index: number): readonly string[] {
  const progress = readG23Progress(match)!;
  return g23RewardAtoms(progress.rewards.find(bundle => bundle.tier === tier)!, progress.seed)[index]!.options;
}
/**
 * Claims every unclaimed orb of the seat that holds an anvil (`forge` entry) through the room's `claimOrb`, in the
 * order the loot view lists them; each claim must be accepted. Returns the anvil units that reached the bench, in order.
 */
export function claimAnvils(room: Room, seatId: string): ReturnType<typeof benchAnvils> {
  const before = new Set(benchAnvils(seatOf(room.state, seatId).match).map(unit => unit.id));
  const match = seatOf(room.state, seatId).match;
  for (const orb of readLootView(match).unclaimedOrbs ?? []) {
    if (!orb.entries.some(entry => entry.kind === 'forge')) continue;
    expect(room.handle(seatId, { type: 'claimOrb', round: seatOf(room.state, seatId).match.round, orbId: orb.orbId })).toMatchObject({ ok: true });
  }
  return benchAnvils(seatOf(room.state, seatId).match).filter(unit => !before.has(unit.id));
}
/**
 * Opens the seat's anvil unit through the room (`openAnvil`, or `sell` with `viaSell`) and checks the opened choice and
 * the room's deadline for it: the choice's own `timeoutMs` from now, kept on the seat for exactly that choice.
 */
/** `deadlineAt` overrides the expected anvil deadline when the phase cap (P 乙, ANVIL_PHASE_EXTENSION_MS) clips it. */
export function openAnvil(room: Room, seatId: string, unitId: string, viaSell = false, deadlineAt?: number): PendingChoice {
  const opened = room.clock.now();
  expect(room.handle(seatId, viaSell ? { type: 'sell', unitId } : { type: 'openAnvil', unitId })).toMatchObject({ ok: true });
  const seat = seatOf(room.state, seatId), choice = seat.match.pendingChoice!;
  expect(choice).toMatchObject({ kind: 'forge', choiceId: anvilChoiceId(unitId), payload: { kind: 'forge', source: 'anvil-unit', timeoutOption: choice.offers[0] } });
  const timeoutMs = (choice.payload as { timeoutMs: number }).timeoutMs;
  expect(timeoutMs).toBe(30_000);
  expect(seat.choiceDeadline).toEqual({ choiceId: choice.choiceId, generation: choice.generation, deadlineAt: deadlineAt ?? opened + timeoutMs });
  return choice;
}
