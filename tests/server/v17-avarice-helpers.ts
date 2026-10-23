/**
 * v17 server tests (docs/V17_AVARICE_ONLINE.md "服务器侧待补测试"): a real room reaches the 4-6 anomaly node and its human
 * seats pick avarice-incarnate through the room's own commands (target, paid reroll, choose). No binding or offer is
 * written by hand.
 */
import { expect } from 'vitest';
import type { ManualClock } from '../../src/server/room/clock';
import type { Room } from '../../src/server/room/room';
import type { RoomState, SeatState, TwoSidedBattleResult } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { claimAllOrbs, makeRoom, runUntil } from './helpers';

export const AVARICE = 'avarice-incarnate';
export const seatOf = (state: RoomState, seatId: string): SeatState => state.seats.find(candidate => candidate.seatId === seatId)!;
export const avariceReceipts = (match: MatchState) => (match.seatMechanics?.receipts ?? []).filter(receipt => receipt.receiptId.startsWith('["d11-fill"') && receipt.receiptId.endsWith('"avarice-gold"]'));
export const pvpBattleOf = (state: RoomState, seatId: string): TwoSidedBattleResult | undefined =>
  state.battles.find((battle): battle is TwoSidedBattleResult => battle.kind === 'two-sided' && battle.participants.includes(seatId));
/** Private bank fields that must never leave the server. */
export const PRIVATE_BANK = /bankSamples|liveGold|currentItemBankGold|openingItemBankGold/;

/**
 * v22: an idle human seat no longer lives to 4-6 on its opening unit alone (the stronger star attack damage of the bots'
 * boards takes it out around round 22). While the seat prepares, its bench units go to free cells of its deployment
 * rows until the room refuses one (population cap), so the orb reward units fight. Returns how many were fielded.
 */
export function fieldBench(room: Room, seatId: string): number {
  if (room.state.phase !== 'preparation') return 0;
  let fielded = 0;
  for (;;) {
    const seat = seatOf(room.state, seatId);
    if (!seat.alive || seat.match.phase !== 'preparation') return fielded;
    const units = seat.match.preparation.units.filter(unit => unit.team === 'player');
    const bench = units.find(unit => unit.location.kind === 'bench');
    const taken = new Set(units.flatMap(unit => unit.location.kind === 'board' ? [`${unit.location.cell.col},${unit.location.cell.row}`] : []));
    let cell: { col: number; row: number } | undefined;
    for (let row = 4; row <= 7 && !cell; row++) for (let col = 0; col < 7 && !cell; col++) if (!taken.has(`${col},${row}`)) cell = { col, row };
    if (!bench || !cell) return fielded;
    if (!room.handle(seatId, { type: 'deploy', unitId: bench.id, target: { kind: 'board', cell } }).ok) return fielded;
    fielded++;
  }
}

/** Fires timers (claiming every orb, so reward units reach the boards) until the room's 4-6 anomaly window is open. */
export function runToAnomalyWindow(room: Room, clock: ManualClock): void {
  for (let fired = 0; fired < 5_000; fired++) {
    claimAllOrbs(room);
    if (room.state.phase === 'choice' && room.state.seats.some(seat => seat.match.pendingChoice?.kind === 'anomaly')) return;
    if (room.state.phase === 'ended' || !clock.runNext()) break;
  }
  throw new Error(`no anomaly window (round ${room.state.roundName}, phase ${room.state.phase}, fault ${JSON.stringify(room.state.fault)})`);
}

/** The seat's anomaly target: its first board unit (avarice binds a board unit). */
export function boardTarget(match: MatchState): string {
  return match.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'board')!.id;
}

/**
 * Targets the seat's first board unit and reads the initial offer. With `via: 'reroll'` it pays rerolls (1 gold each,
 * through the room) until the offer holds avarice; with `via: 'initial'` the initial offer must hold it. Returns the
 * seat's match with avarice on offer and how many rerolls were paid.
 */
export function offerAvarice(room: Room, seatId: string, via: 'initial' | 'reroll'): { readonly offered: MatchState; readonly rerolls: number } {
  const choice = seatOf(room.state, seatId).match.pendingChoice!;
  expect(choice).toMatchObject({ kind: 'anomaly', step: 'target' });
  expect(room.handle(seatId, { type: 'anomalyTarget', choiceId: choice.choiceId, generation: choice.generation, unitId: boardTarget(seatOf(room.state, seatId).match) })).toMatchObject({ ok: true });
  let rerolls = 0;
  for (; !seatOf(room.state, seatId).match.pendingChoice!.offers.includes(AVARICE); rerolls++) {
    if (via === 'initial') throw new Error(`${seatId}: avarice not in the initial offer`);
    if (rerolls >= 400) throw new Error(`${seatId}: avarice never offered`);
    const before = seatOf(room.state, seatId).match, pending = before.pendingChoice!;
    expect(room.handle(seatId, { type: 'anomalyReroll', choiceId: pending.choiceId, generation: pending.generation })).toMatchObject({ ok: true });
    expect(seatOf(room.state, seatId).match.gold).toBe(before.gold - 1);
  }
  return { offered: seatOf(room.state, seatId).match, rerolls };
}

/** Chooses avarice from the seat's current offer; checks the +5 gold and its single receipt. */
export function chooseAvarice(room: Room, seatId: string): MatchState {
  const before = seatOf(room.state, seatId).match, pending = before.pendingChoice!;
  expect(room.handle(seatId, { type: 'choose', choiceId: pending.choiceId, generation: pending.generation, definitionId: AVARICE })).toMatchObject({ ok: true });
  const chosen = seatOf(room.state, seatId).match;
  expect(chosen.anomalyBinding).toMatchObject({ definitionId: AVARICE, choiceId: pending.choiceId });
  expect(chosen.gold).toBe(before.gold + 5);
  expect(avariceReceipts(chosen)).toEqual([expect.objectContaining({ kind: 'gold', amount: 5, source: 'd11-fill' })]);
  return chosen;
}

/**
 * Spends gold in battle through the room: XP when affordable and the seat can still level (a max-level refusal changes
 * nothing), else a shop reroll. Returns the new gold.
 */
export function spendGold(room: Room, seatId: string): number {
  const match = seatOf(room.state, seatId).match;
  let result = match.gold >= 4 && match.level < 10 ? room.handle(seatId, { type: 'buyXp' }) : undefined;
  if (!result || (!result.ok && result.reason === 'max-level')) result = room.handle(seatId, { type: 'reroll' });
  expect(result).toMatchObject({ ok: true });
  expect(seatOf(room.state, seatId).match.gold).toBeLessThan(match.gold);
  return seatOf(room.state, seatId).match.gold;
}
/**
 * Earns gold in battle through the room by selling a bench unit (buying one from the shop first when the bench is empty).
 * Returns the seat's gold after each gold-changing command, in order (each one is a sample).
 */
export function earnGold(room: Room, seatId: string): number[] {
  const golds: number[] = [];
  let match = seatOf(room.state, seatId).match;
  let bench = match.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'bench');
  if (!bench) {
    const slot = match.shop.slots.findIndex(entry => entry.status === 'available');
    expect(room.handle(seatId, { type: 'buy', slot, generation: match.shop.generation })).toMatchObject({ ok: true });
    match = seatOf(room.state, seatId).match;
    golds.push(match.gold);
    bench = match.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'bench')!;
  }
  const before = match.gold;
  expect(room.handle(seatId, { type: 'sell', unitId: bench.id })).toMatchObject({ ok: true });
  expect(seatOf(room.state, seatId).match.gold).toBeGreaterThan(before);
  golds.push(seatOf(room.state, seatId).match.gold);
  return golds;
}

/** The four human seats; each takes avarice in avariceRoom. */
export const HUMANS = ['s0', 's1', 's2', 's3'] as const;
const isHuman = (seatId: string) => (HUMANS as readonly string[]).includes(seatId);
/**
 * Seed 42 with the real resolver: the four human seats take avarice at 4-6 through paid rerolls, then spend down to
 * DRAINED_GOLD (with the idle seats' 200-odd gold the bonus sits at its cap and no gold change would show). Which seats
 * meet is the room's own pairing; the tests read it from the battle phase (humanPair, humanVsBot, nextMirrorBattle)
 * instead of assuming seat ids. Under the v17 orb combinations 4-6 pairs s0 (A) with s1 (B), s2 and s3 each with a bot;
 * 4-7 is PvE; 5-1 pairs s1 with the frozen copy of s2.
 */
export function avariceRoom(onDispose: (dispose: () => void) => void, beforeDrain?: (room: Room) => void) {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  onDispose(() => room.dispose());
  room.start();
  runToAnomalyWindow(room, clock);
  for (const seatId of HUMANS) { offerAvarice(room, seatId, 'reroll'); chooseAvarice(room, seatId); }
  beforeDrain?.(room);
  for (const seatId of HUMANS) drainGold(room, seatId);
  return { room, clock };
}
/** Runs (claiming orbs) to the battle phase of the named round. */
export function nextBattle(room: Room, clock: ManualClock, roundName: string): RoomState {
  return runUntil(room, clock, state => { claimAllOrbs(room); return state.roundName === roundName && state.phase === 'battle'; });
}

/** Below 50 gold the avarice bonus is under its 40% cap (15% + 1% per 2 gold), so each gold change moves the damage. */
export const DRAINED_GOLD = 20;
/** Spends the seat's gold on shop rerolls (through the room) down to DRAINED_GOLD or one below. */
export function drainGold(room: Room, seatId: string): void {
  while (seatOf(room.state, seatId).match.gold > DRAINED_GOLD) expect(room.handle(seatId, { type: 'reroll' })).toMatchObject({ ok: true });
}

/** This battle phase's two-sided battle between two human seats (both with avarice), as its A and B seat. */
export function humanPair(state: RoomState): { readonly a: string; readonly b: string; readonly battle: TwoSidedBattleResult } {
  const battle = state.battles.find((entry): entry is TwoSidedBattleResult => entry.kind === 'two-sided' && entry.participants.length === 2 && entry.participants.every(isHuman));
  if (!battle) throw new Error(`${state.roundName}: no battle between two human seats`);
  return { a: battle.battle.a.seatId, b: battle.battle.b.seatId, battle };
}
/** This battle phase's two-sided battle of a human seat (side A, with avarice) against a bot. */
export function humanVsBot(state: RoomState): { readonly a: string; readonly battle: TwoSidedBattleResult } {
  const battle = state.battles.find((entry): entry is TwoSidedBattleResult => entry.kind === 'two-sided' && entry.participants.length === 2 && isHuman(entry.battle.a.seatId) && !isHuman(entry.battle.b.seatId));
  if (!battle) throw new Error(`${state.roundName}: no human seat on side A against a bot`);
  return { a: battle.battle.a.seatId, battle };
}
/**
 * Runs (claiming orbs) through the battle phases until one holds a mirror battle: a human seat A against the frozen copy
 * of a human seat B who fights its own battle that round. Stays in that battle phase.
 */
export function nextMirrorBattle(room: Room, clock: ManualClock): { readonly a: string; readonly copy: string; readonly battle: TwoSidedBattleResult } {
  let last = room.state.phase === 'battle' ? room.state.roundName : '';
  for (let rounds = 0; rounds < 12; rounds++) {
    const state = runUntil(room, clock, current => { claimAllOrbs(room); return current.phase === 'battle' && current.roundName !== last; });
    last = state.roundName;
    const battle = state.battles.find((entry): entry is TwoSidedBattleResult => entry.kind === 'two-sided' && entry.participants.length === 1
      && isHuman(entry.battle.a.seatId) && isHuman(entry.battle.b.seatId) && pvpBattleOf(state, entry.battle.b.seatId) !== undefined && pvpBattleOf(state, entry.battle.b.seatId) !== entry);
    if (battle) return { a: battle.battle.a.seatId, copy: battle.battle.b.seatId, battle };
  }
  throw new Error('no mirror battle between human seats');
}
