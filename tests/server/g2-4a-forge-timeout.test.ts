/**
 * G2-4a in a room: the completed-item anvil (Conqueror tier 9, four distinct ordinary completed items) opens as the
 * seat's own forge popup after the round-4 PvP commit, holds the room's choice window, and at its deadline the rules'
 * timeout command grants the first offer. Only the owning seat ever sees the offers; a JSON copy of the seat state
 * re-derives the same popup and continues identically; a resumed connection gets the same popup and deadline.
 *
 * Reaching tier 9 for real takes 550 Conqueror stacks, far beyond a room test. The chest's grant itself is covered by
 * tests/g2-4a-conqueror-items.test.ts; here the tier-9 bundle (exactly as `advanceG23Economy` records it) is placed in
 * the seat's live G2-3 progress while its round-4 battle plays, so the room's own commit is what opens it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { Room } from '../../src/server/room/room';
import { seatPushEvents, toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import type { RoomState, SeatState } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import { runSharedMatchCommand } from '../../src/simulation/shared-pool';
import { G23_CONQUEROR_CHESTS, g23ConquerorReward } from '../../src/simulation/content/g2-3-policy';
import { g23RewardAtoms } from '../../src/simulation/g2-3-rewards';
import { readG23Progress, validateG23MechanicLinks, writeG23Progress } from '../../src/simulation/g2-3-state';
import { openG23Choice } from '../../src/simulation/g2-3-runtime';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/g2-3-item-registry';
import { makeRoom, runUntil, TIMINGS } from './helpers';
import { expectOk, startServer, type NetHarness } from './net/helpers';

const FORGE_ID = 'g23:conqueror:9:atom:0:copy:0';
const ordinary = Object.values(ITEM_DEFINITIONS).filter(item => item.kind === 'completed' && item.recipe).map(item => item.id);
const seatOf = (state: RoomState, seatId: string): SeatState => state.seats.find(seat => seat.seatId === seatId)!;
const countOf = (match: MatchState, definitionId: string) => match.items.filter(item => item.definitionId === definitionId).length;

/** The tier-9 bundle as the rules' economy records it on crossing the threshold (no gold: tier 9 is restored to source). */
function withTier9Chest(match: MatchState): MatchState {
  const progress = readG23Progress(match)!;
  const { Gold: _gold, ...reward } = g23ConquerorReward(G23_CONQUEROR_CHESTS[8]!);
  return writeG23Progress(match, { ...progress, rewards: [...progress.rewards, { id: 'g23:conqueror:9', round: match.round, source: 'conqueror', tier: 9, reward }] });
}
/**
 * Test seam: replaces one seat's live MatchState as a seat transaction would (new seatRevision), so the battle deadline
 * finds the staged settlement stale and settles again on this live state (§15.2), exactly as after an operation in battle.
 */
function seedSeat(room: Room, seatId: string, change: (match: MatchState) => MatchState): void {
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => seat.seatId === seatId ? { ...seat, match: change(seat.match), seatRevision: seat.seatRevision + 1 } : seat) };
}
/** Runs the room to its round-4 battle, seeds `seatId`'s tier-9 chest, and lets the battle deadline commit the round. */
function toForgeWindow(room: Room, runNext: () => boolean, seatId: string): void {
  for (let fired = 0; !(room.state.round === 4 && room.state.phase === 'battle') && fired < 2_000; fired++) if (!runNext()) break;
  expect(room.state).toMatchObject({ round: 4, phase: 'battle' });
  seedSeat(room, seatId, withTier9Chest);
  for (let fired = 0; room.state.phase === 'battle' && fired < 2_000; fired++) if (!runNext()) break;
}

describe('G2-4a: the completed-item anvil in an online room', () => {
  it('opens the four-way forge after the commit and, at the choice deadline, grants the first offer into the seat\'s inventory', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    toForgeWindow(room, () => clock.runNext(), 's0');
    const state = room.state, s0 = seatOf(state, 's0');
    expect(state.settlements).toContain('test-room:round-4');
    expect(state.phase).toBe('choice');
    expect(state.deadlineAt).toBe(clock.now() + TIMINGS.choiceMs);
    const choice = s0.match.pendingChoice!;
    expect(choice).toMatchObject({ kind: 'forge', choiceId: FORGE_ID, payload: { kind: 'forge', source: 'conqueror', timeoutOption: choice.offers[0] } });
    expect(choice.offers).toHaveLength(4);
    expect(new Set(choice.offers).size).toBe(4);
    for (const id of choice.offers) expect(ordinary).toContain(id);
    expect(choice.offers).toEqual(g23RewardAtoms(readG23Progress(s0.match)!.rewards.find(bundle => bundle.tier === 9)!, readG23Progress(s0.match)!.seed)[0]!.options);
    // The forge is s0's alone: no other seat holds a choice, so the window is s0's popup only.
    for (const seat of state.seats.filter(candidate => candidate.seatId !== 's0')) expect(seat.match.pendingChoice).toBeNull();
    expect(toSeatPrivateView(s0.match).pendingChoice).toMatchObject({ kind: 'forge', choiceId: FORGE_ID, offers: choice.offers });

    const before = s0.match;
    clock.runNext(); // choice deadline → the rules' timeoutChoice
    const after = seatOf(room.state, 's0').match;
    expect(room.state.phase).toBe('settlement');
    expect(after.pendingChoice).toBeNull();
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(countOf(after, choice.offers[0]!)).toBe(countOf(before, choice.offers[0]!) + 1);
    const claim = readG23Progress(after)!.rewardClaims.find(candidate => candidate.id === FORGE_ID)!;
    expect(claim).toMatchObject({ kind: 'item', definitionId: choice.offers[0] });
    expect(after.items.find(item => item.id === claim.instanceId)).toMatchObject({ definitionId: choice.offers[0], location: { kind: 'inventory' } });
    expect(after.seatMechanics!.receipts.filter(receipt => receipt.receiptId === FORGE_ID)).toEqual([expect.objectContaining({ kind: 'choice', choiceKind: 'forge', optionId: choice.offers[0], timedOut: true })]);
    expect(() => validateG23MechanicLinks(after)).not.toThrow();
    // Granted once: the next round opens no second forge and pays nothing more for the chest.
    const next = runUntil(room, clock, current => current.round === 5 && current.phase === 'preparation');
    const later = seatOf(next, 's0').match;
    expect(later.pendingChoice).toBeNull();
    expect(readG23Progress(later)!.rewardClaims.filter(candidate => candidate.atomId === 'g23:conqueror:9:atom:0')).toHaveLength(1);
    expect(countOf(later, choice.offers[0]!)).toBe(countOf(after, choice.offers[0]!));
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('a pick before the deadline grants that item, closes the window at once and the deadline grants nothing more', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    toForgeWindow(room, () => clock.runNext(), 's0');
    const deadline = room.state.deadlineAt!, before = seatOf(room.state, 's0').match, choice = before.pendingChoice!;
    // A stale generation or an option outside the four is refused and changes nothing.
    const stateBefore = room.state;
    expect(room.handle('s0', { type: 'choose', choiceId: FORGE_ID, generation: choice.generation + 1, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(room.handle('s0', { type: 'choose', choiceId: FORGE_ID, generation: choice.generation, definitionId: ordinary.find(id => !choice.offers.includes(id))! }).ok).toBe(false);
    expect(room.state).toBe(stateBefore);
    // Another seat cannot answer s0's forge.
    expect(room.handle('s1', { type: 'choose', choiceId: FORGE_ID, generation: choice.generation, definitionId: choice.offers[2]! }).ok).toBe(false);

    const picked = room.handle('s0', { type: 'choose', choiceId: FORGE_ID, generation: choice.generation, definitionId: choice.offers[2]! });
    expect(picked.ok).toBe(true);
    expect(clock.now()).toBeLessThan(deadline);
    expect(room.state.phase).toBe('settlement');
    const after = seatOf(room.state, 's0').match;
    expect(after.pendingChoice).toBeNull();
    expect(countOf(after, choice.offers[2]!)).toBe(countOf(before, choice.offers[2]!) + 1);
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(after.seatMechanics!.receipts.filter(receipt => receipt.receiptId === FORGE_ID)).toEqual([expect.objectContaining({ kind: 'choice', choiceKind: 'forge', optionId: choice.offers[2], timedOut: false })]);
    expect(room.handle('s0', { type: 'choose', choiceId: FORGE_ID, generation: choice.generation, definitionId: choice.offers[1]! }).ok).toBe(false);
    const next = runUntil(room, clock, current => current.round === 5 && current.phase === 'preparation');
    const later = seatOf(next, 's0').match;
    expect(countOf(later, choice.offers[0]!)).toBe(countOf(after, choice.offers[0]!));
    expect(readG23Progress(later)!.rewardClaims.filter(candidate => candidate.id === FORGE_ID)).toHaveLength(1);
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('never shows the four offers to another seat, in its view or its pushes', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    toForgeWindow(room, () => clock.runNext(), 's0');
    const state = room.state, choice = seatOf(state, 's0').match.pendingChoice!;
    const s0Public = JSON.stringify(toPlayerView(state, 's1', clock.now()).seats.find(seat => seat.seatId === 's0'));
    for (const id of choice.offers) expect(s0Public).not.toContain(id);
    for (const other of state.seats.filter(seat => seat.seatId !== 's0')) {
      const view = JSON.stringify(toPlayerView(state, other.seatId, clock.now()));
      expect(view).not.toContain(FORGE_ID);
      expect(view).not.toContain('forge');
      expect(view).not.toContain('pendingChoice');
      const pushed = JSON.stringify(seatPushEvents(other));
      expect(pushed).not.toContain(FORGE_ID);
      expect(JSON.stringify(toSeatPrivateView(other.match))).not.toContain(FORGE_ID);
    }
    // The owner's own private view carries the popup.
    expect(toSeatPrivateView(seatOf(state, 's0').match).pendingChoice).toMatchObject({ choiceId: FORGE_ID, offers: choice.offers });
  }, 30_000);

  it('a JSON copy of the seat with the open forge re-derives the same popup and continues exactly like the live seat', () => {
    // The room keeps no save of its own; what survives a restart or a hand-over is the seat's MatchState as JSON. The
    // rules' full restore check (validateB8Resources) also replays the Conqueror history, which the seeded chest does not
    // have, so this checks the popup's own authority rule (the same openG23Choice re-derivation) and the continuation.
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    toForgeWindow(room, () => clock.runNext(), 's0');
    const state = room.state, live = seatOf(state, 's0').match, choice = live.pendingChoice!;
    const restored = JSON.parse(JSON.stringify(live)) as MatchState;
    expect(restored).toEqual(live);
    expect(() => validateG23MechanicLinks(restored)).not.toThrow();
    const reopened = (match: MatchState) => openG23Choice({ ...match, phase: match.pendingChoice!.returnPhase, pendingChoice: null } as MatchState).state.pendingChoice;
    expect(reopened(restored)).toEqual(restored.pendingChoice);
    expect(toSeatPrivateView(restored)).toEqual(toSeatPrivateView(live));
    const timeout = { type: 'timeoutChoice', round: live.round, choiceId: FORGE_ID, generation: choice.generation } as const;
    const fromLive = runSharedMatchCommand(state.pool, live, timeout), fromRestored = runSharedMatchCommand(state.pool, restored, timeout);
    expect(fromLive.ok && fromRestored.ok).toBe(true);
    expect(fromRestored.state).toEqual(fromLive.state);
    expect(fromRestored.pool).toEqual(fromLive.pool);
    const pick = { type: 'choose', choiceId: FORGE_ID, generation: choice.generation, definitionId: choice.offers[3]! } as const;
    expect(runSharedMatchCommand(state.pool, restored, pick).state).toEqual(runSharedMatchCommand(state.pool, live, pick).state);
    // A copy with the offers reordered is not the rules' popup.
    const tampered = { ...restored, pendingChoice: { ...restored.pendingChoice!, offers: [...choice.offers].reverse() } } as MatchState;
    expect(reopened(tampered)).not.toEqual(tampered.pendingChoice);
  }, 30_000);
});

describe('G2-4a: the forge popup across a reconnect', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  it('a resumed seat gets the same forge popup and the unchanged deadline, and can still pick', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const a = await harness.connect(), b = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await b.join('乙'));
    expectOk(await a.start());
    await Promise.all([a, b].map(client => client.waitFor(message => message.type === 'state')));
    const room = harness.server.room!, clock = harness.clock, seatA = a.seatId!, token = a.token!;
    toForgeWindow(room, () => clock.runNext(), seatA);
    expect(room.state.phase).toBe('choice');
    const deadline = room.state.deadlineAt!, choice = seatOf(room.state, seatA).match.pendingChoice!;
    expect(choice).toMatchObject({ kind: 'forge', choiceId: FORGE_ID });
    const shown = await a.waitFor(message => message.type === 'state' && message.state.pendingChoice?.choiceId === FORGE_ID);
    expect(shown.type).toBe('state');
    await a.close();
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === false);
    // Part of the window passes while A is away; nothing times out yet.
    clock.advance(TIMINGS.choiceMs - 200);
    expect(room.state.phase).toBe('choice');
    expect(room.state.deadlineAt).toBe(deadline);

    const a2 = await harness.connect();
    expectOk(await a2.resume(token));
    const view = await a2.waitForView(candidate => candidate.mySeatId === seatA);
    await a2.waitFor(message => message.type === 'state');
    expect(view.phase).toMatchObject({ kind: 'choice', round: 4, endsAt: deadline });
    expect(view.phase.endsAt! - view.phase.serverNow).toBe(200);
    expect(a2.state!.pendingChoice).toEqual(JSON.parse(JSON.stringify(toSeatPrivateView(seatOf(room.state, seatA).match).pendingChoice)));
    expect(a2.state!.pendingChoice).toMatchObject({ kind: 'forge', choiceId: FORGE_ID, offers: choice.offers, generation: choice.generation });
    // The other human never received the offers.
    for (const message of b.inbox) expect(JSON.stringify(message)).not.toContain(FORGE_ID);

    const itemsBefore = countOf(seatOf(room.state, seatA).match, choice.offers[1]!);
    expectOk(await a2.command({ type: 'choose', choiceId: FORGE_ID, generation: choice.generation, definitionId: choice.offers[1]! }));
    expect(countOf(seatOf(room.state, seatA).match, choice.offers[1]!)).toBe(itemsBefore + 1);
    expect(seatOf(room.state, seatA).match.pendingChoice).toBeNull();
    expect(room.state.phase).toBe('settlement');
  }, 60_000);
});
