/**
 * G2-4b in a room: the support anvil (Conqueror tier 11, four distinct support items from the rules' 13-item pool)
 * opens as the seat's own forge popup after the round-4 PvP commit through the same choose/timeoutChoice commands as the
 * completed-item and artifact anvils; the room adds no message and draws nothing. Only the owning seat sees the offers, a resumed
 * connection gets the same popup and deadline, and tiers 10, 11 and 13 won in one settlement grant in turn.
 *
 * As in g2-4a-forge-timeout.test.ts, the tier bundles (exactly as `advanceG23Economy` records them, gold stripped) are
 * placed in the seat's live G2-3 progress while its round-4 battle plays, so the room's own commit is what opens them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { Room } from '../../src/server/room/room';
import { seatPushEvents, toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import type { RoomState, SeatState } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import { G23_CONQUEROR_CHESTS, g23ConquerorReward } from '../../src/simulation/content/g2-3-policy';
import { G24_FORGE_POOLS } from '../../src/simulation/content/g2-4-forges';
import { g23RewardAtoms } from '../../src/simulation/g2-3-rewards';
import { readG23Progress, validateG23MechanicLinks, writeG23Progress } from '../../src/simulation/g2-3-state';
import { readChoiceExtras } from '../../src/presentation/choice-fallback';
import { makeRoom, runUntil, TIMINGS } from './helpers';
import { expectOk, startServer, type NetHarness } from './net/helpers';

const TIER10 = 'g23:conqueror:10:atom:0:copy:0';
const TIER11 = 'g23:conqueror:11:atom:0:copy:0';
const supports: readonly string[] = G24_FORGE_POOLS.TFT_ArmoryKeySupport;
const seatOf = (state: RoomState, seatId: string): SeatState => state.seats.find(seat => seat.seatId === seatId)!;
const countOf = (match: MatchState, definitionId: string) => match.items.filter(item => item.definitionId === definitionId).length;

/** The tier bundles as the rules' economy records them on crossing the thresholds (gold is paid apart). */
function withChests(...tiers: readonly number[]) {
  return (match: MatchState): MatchState => {
    const progress = readG23Progress(match)!;
    const bundles = tiers.map(tier => {
      const { Gold: _gold, ...reward } = g23ConquerorReward(G23_CONQUEROR_CHESTS[tier - 1]!);
      return { id: `g23:conqueror:${tier}`, round: match.round, source: 'conqueror' as const, tier, reward };
    });
    return writeG23Progress(match, { ...progress, rewards: [...progress.rewards, ...bundles] });
  };
}
/** Test seam: replaces one seat's live MatchState as a seat transaction would (new seatRevision). */
function seedSeat(room: Room, seatId: string, change: (match: MatchState) => MatchState): void {
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => seat.seatId === seatId ? { ...seat, match: change(seat.match), seatRevision: seat.seatRevision + 1 } : seat) };
}
function toForgeWindow(room: Room, runNext: () => boolean, seatId: string, ...tiers: readonly number[]): void {
  for (let fired = 0; !(room.state.round === 4 && room.state.phase === 'battle') && fired < 2_000; fired++) if (!runNext()) break;
  expect(room.state).toMatchObject({ round: 4, phase: 'battle' });
  seedSeat(room, seatId, withChests(...tiers));
  for (let fired = 0; room.state.phase === 'battle' && fired < 2_000; fired++) if (!runNext()) break;
}
const atomOptions = (match: MatchState, tier: number, index: number) => {
  const progress = readG23Progress(match)!;
  return g23RewardAtoms(progress.rewards.find(bundle => bundle.tier === tier)!, progress.seed)[index]!.options;
};

describe('G2-4b: the support anvil in an online room', () => {
  it('tier 11 opens 辅助装锻造器 with four distinct support items and the deadline grants the first offer once', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    toForgeWindow(room, () => clock.runNext(), 's0', 11);
    const state = room.state, s0 = seatOf(state, 's0'), choice = s0.match.pendingChoice!;
    expect(state.phase).toBe('choice');
    expect(state.deadlineAt).toBe(clock.now() + TIMINGS.choiceMs);
    expect(choice).toMatchObject({ kind: 'forge', choiceId: TIER11, payload: { kind: 'forge', source: 'conqueror', timeoutOption: choice.offers[0] } });
    expect(new Set(choice.offers).size).toBe(4);
    for (const id of choice.offers) expect(supports).toContain(id);
    expect(choice.offers).toEqual(atomOptions(s0.match, 11, 0));
    expect(readChoiceExtras(toSeatPrivateView(s0.match).pendingChoice!).title).toBe('辅助装锻造器 · 4 选 1');
    for (const seat of state.seats.filter(candidate => candidate.seatId !== 's0')) expect(seat.match.pendingChoice).toBeNull();

    const before = s0.match;
    clock.runNext(); // choice deadline → the rules' timeoutChoice
    const after = seatOf(room.state, 's0').match;
    expect(after.pendingChoice).toBeNull();
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(countOf(after, choice.offers[0]!)).toBe(countOf(before, choice.offers[0]!) + 1);
    expect(after.seatMechanics!.receipts.filter(receipt => receipt.receiptId === TIER11)).toEqual([
      expect.objectContaining({ kind: 'choice', choiceKind: 'forge', source: 'conqueror', optionId: choice.offers[0], price: 0, skipped: false, timedOut: true }),
    ]);
    expect(() => validateG23MechanicLinks(after)).not.toThrow();
    const later = seatOf(runUntil(room, clock, current => current.round === 5 && current.phase === 'preparation'), 's0').match;
    expect(later.pendingChoice).toBeNull();
    expect(later.seatMechanics!.receipts.filter(receipt => receipt.receiptId === TIER11)).toHaveLength(1);
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('a pick before the deadline grants that support item; stale, foreign and other-seat answers are refused', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    toForgeWindow(room, () => clock.runNext(), 's0', 11);
    const before = seatOf(room.state, 's0').match, choice = before.pendingChoice!, stateBefore = room.state;
    expect(room.handle('s0', { type: 'choose', choiceId: TIER11, generation: choice.generation + 1, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(room.handle('s0', { type: 'choose', choiceId: TIER11, generation: choice.generation, definitionId: supports.find(id => !choice.offers.includes(id))! }).ok).toBe(false);
    expect(room.handle('s0', { type: 'choose', choiceId: TIER11, generation: choice.generation, definitionId: G24_FORGE_POOLS.TFT_ArmoryKeyOrnn[0]! }).ok).toBe(false);
    expect(room.handle('s1', { type: 'choose', choiceId: TIER11, generation: choice.generation, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(room.state).toBe(stateBefore);

    expect(room.handle('s0', { type: 'choose', choiceId: TIER11, generation: choice.generation, definitionId: choice.offers[2]! }).ok).toBe(true);
    expect(room.state.phase).toBe('settlement');
    const after = seatOf(room.state, 's0').match;
    expect(countOf(after, choice.offers[2]!)).toBe(countOf(before, choice.offers[2]!) + 1);
    expect(after.seatMechanics!.receipts.filter(receipt => receipt.receiptId === TIER11)).toEqual([expect.objectContaining({ optionId: choice.offers[2], timedOut: false })]);
    expect(room.handle('s0', { type: 'choose', choiceId: TIER11, generation: choice.generation, definitionId: choice.offers[1]! }).ok).toBe(false);
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('tiers 10, 11 and 13 in one settlement: artifact then support anvil in turn, and tier 13\'s fixed items arrive once', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    toForgeWindow(room, () => clock.runNext(), 's0', 10, 11, 13);
    const first = seatOf(room.state, 's0').match, opened = first.pendingChoice!;
    expect(opened).toMatchObject({ kind: 'forge', choiceId: TIER10 });
    expect(readChoiceExtras(opened).title).toBe('神器锻造器 · 4 选 1');
    expect(room.handle('s0', { type: 'choose', choiceId: opened.choiceId, generation: opened.generation, definitionId: opened.offers[1]! }).ok).toBe(true);
    expect(room.state.phase).toBe('choice');
    const second = seatOf(room.state, 's0').match.pendingChoice!;
    expect(second).toMatchObject({ kind: 'forge', choiceId: TIER11 });
    expect(readChoiceExtras(second).title).toBe('辅助装锻造器 · 4 选 1');

    clock.runNext(); // deadline: the support anvil takes its first offer
    const after = seatOf(room.state, 's0').match;
    expect(room.state.phase).toBe('settlement');
    expect(after.pendingChoice).toBeNull();
    const receipts = after.seatMechanics!.receipts;
    expect(receipts.filter(receipt => receipt.receiptId === TIER10)).toEqual([expect.objectContaining({ optionId: opened.offers[1], timedOut: false })]);
    expect(receipts.filter(receipt => receipt.receiptId === TIER11)).toEqual([expect.objectContaining({ optionId: second.offers[0], timedOut: true })]);
    for (const atom of [0, 1, 2]) expect(receipts.filter(receipt => receipt.receiptId === `g23:conqueror:13:atom:${atom}:copy:0`)).toHaveLength(1);
    expect(() => validateG23MechanicLinks(after)).not.toThrow();
    const later = seatOf(runUntil(room, clock, current => current.round === 5 && current.phase === 'preparation'), 's0').match;
    for (const atom of [0, 1, 2]) expect(later.seatMechanics!.receipts.filter(receipt => receipt.receiptId === `g23:conqueror:13:atom:${atom}:copy:0`)).toHaveLength(1);
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('never shows the support offers to another seat, in its view or its pushes', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    toForgeWindow(room, () => clock.runNext(), 's0', 11);
    const state = room.state, choice = seatOf(state, 's0').match.pendingChoice!;
    for (const other of state.seats.filter(seat => seat.seatId !== 's0')) {
      const view = JSON.stringify(toPlayerView(state, other.seatId, clock.now()));
      for (const id of choice.offers) expect(view).not.toContain(id);
      expect(view).not.toContain(TIER11);
      expect(JSON.stringify(seatPushEvents(other))).not.toContain(TIER11);
      expect(JSON.stringify(toSeatPrivateView(other.match))).not.toContain(TIER11);
    }
  }, 30_000);
});

describe('G2-4b: the support anvil across a reconnect', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  it('a resumed seat gets the same support popup and the unchanged deadline, and can still pick', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const a = await harness.connect(), b = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await b.join('乙'));
    expectOk(await a.start());
    await Promise.all([a, b].map(client => client.waitFor(message => message.type === 'state')));
    const room = harness.server.room!, clock = harness.clock, seatA = a.seatId!, token = a.token!;
    toForgeWindow(room, () => clock.runNext(), seatA, 11);
    const deadline = room.state.deadlineAt!, choice = seatOf(room.state, seatA).match.pendingChoice!;
    await a.waitFor(message => message.type === 'state' && message.state.pendingChoice?.choiceId === TIER11);
    await a.close();
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === false);
    clock.advance(TIMINGS.choiceMs - 200);
    expect(room.state.phase).toBe('choice');

    const a2 = await harness.connect();
    expectOk(await a2.resume(token));
    const view = await a2.waitForView(candidate => candidate.mySeatId === seatA);
    await a2.waitFor(message => message.type === 'state');
    expect(view.phase).toMatchObject({ kind: 'choice', round: 4, endsAt: deadline });
    expect(a2.state!.pendingChoice).toMatchObject({ kind: 'forge', choiceId: TIER11, offers: choice.offers, generation: choice.generation });
    expect(readChoiceExtras(a2.state!.pendingChoice!).title).toBe('辅助装锻造器 · 4 选 1');
    for (const message of b.inbox) expect(JSON.stringify(message)).not.toContain(TIER11);

    const itemsBefore = countOf(seatOf(room.state, seatA).match, choice.offers[3]!);
    expectOk(await a2.command({ type: 'choose', choiceId: TIER11, generation: choice.generation, definitionId: choice.offers[3]! }));
    expect(countOf(seatOf(room.state, seatA).match, choice.offers[3]!)).toBe(itemsBefore + 1);
    expect(room.state.phase).toBe('settlement');
  }, 60_000);
});
