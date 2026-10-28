/**
 * G2-4a in a room, v22 anvil units (docs/ANVIL_UNITS.md): the completed-item anvil (Conqueror tier 9, four distinct
 * ordinary completed items) no longer opens a popup at the round-4 PvP commit. The commit grants it as an orb; the seat
 * claims it onto its bench as 成装锻造器 and opens it (openAnvil, or selling it), which opens the four-way forge on the
 * room's own 30 s deadline for that choice; at that deadline the rules' timeout command grants the first offer. Only the
 * owning seat ever sees the offers or the deadline; a JSON copy of the seat state re-derives the same choice and continues
 * identically; a resumed connection gets the same choice and deadline.
 *
 * Reaching tier 9 for real takes 550 Conqueror stacks, far beyond a room test. The chest's grant itself is covered by
 * tests/g2-4a-conqueror-items.test.ts; here the tier-9 bundle (exactly as `advanceG23Economy` records it) is placed in
 * the seat's live G2-3 progress while its round-4 battle plays, so the room's own commit is what grants it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { seatPushEvents, toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import type { MatchState } from '../../src/simulation/match-types';
import { runSharedMatchCommand } from '../../src/simulation/shared-pool';
import { readG23Progress } from '../../src/simulation/g2-3-state';
import { validateG23MechanicLinks } from '../../src/simulation/restore-checks/g23-state-check';
import { validateAnvils } from '../../src/simulation/restore-checks/anvils-check';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/g2-3-item-registry';
import { readChoiceExtras } from '../../src/presentation/choice-fallback';
import { makeRoom, runUntil } from './helpers';
import { ANVIL, atomOptions, claimAnvils, countOf, openAnvil, seatOf, toChestSettlement } from './anvil-room-helpers';
import { expectOk, startServer, type NetHarness } from './net/helpers';

const ordinary = Object.values(ITEM_DEFINITIONS).filter(item => item.kind === 'completed' && item.recipe).map(item => item.id);
const receiptsOf = (match: MatchState, receiptId: string) => (match.seatMechanics?.receipts ?? []).filter(receipt => receipt.receiptId === receiptId);

/** Round 4 commits the seeded tier-9 chest; s0 claims its anvil orb in settlement and gets the one 成装锻造器. */
function toAnvil(room: ReturnType<typeof makeRoom>['room'], runNext: () => boolean, seatId: string) {
  toChestSettlement(room, runNext, seatId, 9);
  // The commit opens nothing by itself: no seat holds a choice, the room stays in settlement.
  for (const seat of room.state.seats) expect(seat.match.pendingChoice).toBeNull();
  const units = claimAnvils(room, seatId);
  expect(units.map(unit => unit.definitionId)).toEqual([ANVIL.completed]);
  return units[0]!;
}

describe('G2-4a: the completed-item anvil in an online room', () => {
  it('opened from the bench it offers four distinct ordinary completed items, and its own 30 s deadline grants the first offer once', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const unit = toAnvil(room, () => clock.runNext(), 's0');
    expect(readG23Progress(seatOf(room.state, 's0').match)!.rewardClaims.filter(claim => claim.atomId === 'g23:conqueror:9:atom:0'))
      .toEqual([expect.objectContaining({ kind: 'anvil', definitionId: ANVIL.completed, instanceId: unit.id })]);
    const opened = clock.now(), choice = openAnvil(room, 's0', unit.id);
    const state = room.state, s0 = seatOf(state, 's0');
    expect(state.phase).toBe('settlement');
    // The settlement waits for the anvil: its deadline is the anvil's own.
    expect(state.deadlineAt).toBe(opened + 30_000);
    expect(choice.offers).toHaveLength(4);
    expect(new Set(choice.offers).size).toBe(4);
    for (const id of choice.offers) expect(ordinary).toContain(id);
    expect(choice.offers).toEqual(atomOptions(s0.match, 9, 0));
    expect(readChoiceExtras(toSeatPrivateView(s0.match).pendingChoice!).title).toBe('成装锻造器 · 4 选 1');
    // The forge is s0's alone: no other seat holds a choice or a deadline.
    for (const seat of state.seats.filter(candidate => candidate.seatId !== 's0')) { expect(seat.match.pendingChoice).toBeNull(); expect(seat.choiceDeadline).toBeUndefined(); }
    expect(toSeatPrivateView(s0.match, s0.choiceDeadline)).toMatchObject({ pendingChoice: { choiceId: choice.choiceId, offers: choice.offers }, choiceDeadline: { choiceId: choice.choiceId, endsAt: opened + 30_000 } });

    const before = s0.match;
    clock.advance(29_999);
    expect(room.state).toBe(state);
    clock.advance(1); // the anvil deadline → the rules' timeoutChoice, then the settlement deadline it held
    const after = seatOf(room.state, 's0').match;
    expect(room.state.fault).toBeNull();
    expect(after.pendingChoice).toBeNull();
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(countOf(after, choice.offers[0]!)).toBe(countOf(before, choice.offers[0]!) + 1);
    expect(receiptsOf(after, choice.choiceId)).toEqual([expect.objectContaining({ kind: 'choice', choiceKind: 'forge', source: 'anvil-unit', optionId: choice.offers[0], timedOut: true })]);
    expect(() => validateG23MechanicLinks(after)).not.toThrow();
    expect(() => validateAnvils(after)).not.toThrow();
    // Granted once: the next round opens no second forge and pays nothing more for the chest.
    const next = runUntil(room, clock, current => current.round === 5 && current.phase === 'preparation');
    const later = seatOf(next, 's0').match;
    expect(later.pendingChoice).toBeNull();
    expect(readG23Progress(later)!.rewardClaims.filter(candidate => candidate.atomId === 'g23:conqueror:9:atom:0')).toHaveLength(1);
    expect(receiptsOf(later, choice.choiceId)).toHaveLength(1);
    expect(countOf(later, choice.offers[0]!)).toBe(countOf(after, choice.offers[0]!));
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('a pick before the deadline grants that item, cancels the deadline at once and the old deadline grants nothing more', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const unit = toAnvil(room, () => clock.runNext(), 's0');
    const choice = openAnvil(room, 's0', unit.id, true); // selling the anvil opens it the same way
    const deadline = seatOf(room.state, 's0').choiceDeadline!.deadlineAt, before = seatOf(room.state, 's0').match;
    // A stale generation or an option outside the four is refused and changes nothing.
    const stateBefore = room.state;
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation + 1, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: ordinary.find(id => !choice.offers.includes(id))! }).ok).toBe(false);
    expect(room.state).toBe(stateBefore);
    // Another seat cannot answer s0's forge.
    expect(room.handle('s1', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[2]! }).ok).toBe(false);

    clock.advance(5_000);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[2]! }).ok).toBe(true);
    expect(clock.now()).toBeLessThan(deadline);
    const after = seatOf(room.state, 's0').match;
    expect(after.pendingChoice).toBeNull();
    expect(seatOf(room.state, 's0').choiceDeadline).toBeUndefined();
    expect(countOf(after, choice.offers[2]!)).toBe(countOf(before, choice.offers[2]!) + 1);
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(receiptsOf(after, choice.choiceId)).toEqual([expect.objectContaining({ kind: 'choice', choiceKind: 'forge', optionId: choice.offers[2], timedOut: false })]);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[1]! }).ok).toBe(false);
    // The settlement no longer waits: it ends at its own deadline, long before the anvil's old one.
    expect(room.state.deadlineAt).toBeLessThan(deadline);
    const next = runUntil(room, clock, current => current.round === 5 && current.phase === 'preparation');
    expect(clock.now()).toBeLessThan(deadline);
    const later = seatOf(next, 's0').match;
    expect(countOf(later, choice.offers[0]!)).toBe(countOf(after, choice.offers[0]!));
    expect(receiptsOf(later, choice.choiceId)).toHaveLength(1);
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('never shows the four offers, the choice or its deadline to another seat, in its view or its pushes', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const unit = toAnvil(room, () => clock.runNext(), 's0');
    const choice = openAnvil(room, 's0', unit.id);
    const state = room.state;
    const s0Public = JSON.stringify(toPlayerView(state, 's1', clock.now()).seats.find(seat => seat.seatId === 's0'));
    for (const id of choice.offers) expect(s0Public).not.toContain(id);
    for (const other of state.seats.filter(seat => seat.seatId !== 's0')) {
      const view = JSON.stringify(toPlayerView(state, other.seatId, clock.now()));
      expect(view).not.toContain(choice.choiceId);
      expect(view).not.toContain('anvil-unit'); // (a seat's public augments may name Portable Forge)
      expect(view).not.toContain('pendingChoice');
      expect(view).not.toContain('choiceDeadline');
      expect(JSON.stringify(seatPushEvents(other))).not.toContain(choice.choiceId);
      expect(JSON.stringify(toSeatPrivateView(other.match, other.choiceDeadline))).not.toContain(choice.choiceId);
    }
    // The owner's own private view carries the choice.
    expect(toSeatPrivateView(seatOf(state, 's0').match).pendingChoice).toMatchObject({ choiceId: choice.choiceId, offers: choice.offers });
  }, 30_000);

  it('a JSON copy of the seat with the open anvil re-derives the same choice and continues exactly like the live seat', () => {
    // The room keeps no save of its own; what survives a restart or a hand-over is the seat's MatchState as JSON. The
    // rules rebuild an open anvil's four offers from its reward receipt (validateAnvils), never from a stored list.
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const unit = toAnvil(room, () => clock.runNext(), 's0');
    const choice = openAnvil(room, 's0', unit.id);
    const state = room.state, live = seatOf(state, 's0').match;
    const restored = JSON.parse(JSON.stringify(live)) as MatchState;
    expect(restored).toEqual(live);
    expect(() => validateG23MechanicLinks(restored)).not.toThrow();
    expect(() => validateAnvils(restored)).not.toThrow();
    expect(toSeatPrivateView(restored)).toEqual(toSeatPrivateView(live));
    const timeout = { type: 'timeoutChoice', round: live.round, choiceId: choice.choiceId, generation: choice.generation } as const;
    const fromLive = runSharedMatchCommand(state.pool, live, timeout), fromRestored = runSharedMatchCommand(state.pool, restored, timeout);
    expect(fromLive.ok && fromRestored.ok).toBe(true);
    expect(fromRestored.state).toEqual(fromLive.state);
    expect(fromRestored.pool).toEqual(fromLive.pool);
    const pick = { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[3]! } as const;
    expect(runSharedMatchCommand(state.pool, restored, pick).state).toEqual(runSharedMatchCommand(state.pool, live, pick).state);
    // A copy with the offers reordered is not the rules' choice.
    const tampered = { ...restored, pendingChoice: { ...restored.pendingChoice!, offers: [...choice.offers].reverse() } } as MatchState;
    expect(() => validateAnvils(tampered)).toThrow();
  }, 30_000);
});

describe('G2-4a: the anvil choice across a reconnect', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  it('a resumed seat gets the same choice and the unchanged deadline, and can still pick', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const a = await harness.connect(), b = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await b.join('乙'));
    expectOk(await a.start());
    await Promise.all([a, b].map(client => client.waitFor(message => message.type === 'state')));
    const room = harness.server.room!, clock = harness.clock, seatA = a.seatId!, token = a.token!;
    const unit = toAnvil(room, () => clock.runNext(), seatA);
    // The client acts on what it was sent: the round-4 settlement view and the state holding the claimed anvil.
    const revision = seatOf(room.state, seatA).seatRevision;
    await a.waitForView(view => view.phase.round === 4 && view.phase.kind === 'settlement');
    await a.waitFor(message => message.type === 'state' && message.seatRevision === revision);
    const opened = clock.now();
    expectOk(await a.command({ type: 'openAnvil', unitId: unit.id }));
    const choice = seatOf(room.state, seatA).match.pendingChoice!, deadline = opened + 30_000;
    expect(room.state).toMatchObject({ phase: 'settlement', deadlineAt: deadline });
    await a.waitFor(message => message.type === 'state' && message.state.pendingChoice?.choiceId === choice.choiceId);
    expect(a.state!.choiceDeadline).toEqual({ choiceId: choice.choiceId, generation: choice.generation, endsAt: deadline });
    await a.close();
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === false);
    // Most of the window passes while A is away; nothing times out yet.
    clock.advance(30_000 - 200);
    expect(seatOf(room.state, seatA).match.pendingChoice?.choiceId).toBe(choice.choiceId);
    expect(room.state.deadlineAt).toBe(deadline);

    const a2 = await harness.connect();
    expectOk(await a2.resume(token));
    const view = await a2.waitForView(candidate => candidate.mySeatId === seatA);
    await a2.waitFor(message => message.type === 'state');
    expect(view.phase).toMatchObject({ kind: 'settlement', round: 4, endsAt: deadline });
    expect(view.phase.endsAt! - view.phase.serverNow).toBe(200);
    expect(a2.state!.choiceDeadline).toEqual({ choiceId: choice.choiceId, generation: choice.generation, endsAt: deadline });
    expect(a2.state!.pendingChoice).toEqual(JSON.parse(JSON.stringify(toSeatPrivateView(seatOf(room.state, seatA).match).pendingChoice)));
    expect(a2.state!.pendingChoice).toMatchObject({ kind: 'forge', choiceId: choice.choiceId, offers: choice.offers, generation: choice.generation });
    // The other human never received the offers or the choice.
    for (const message of b.inbox) expect(JSON.stringify(message)).not.toContain(choice.choiceId);

    const itemsBefore = countOf(seatOf(room.state, seatA).match, choice.offers[1]!);
    expectOk(await a2.command({ type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[1]! }));
    expect(countOf(seatOf(room.state, seatA).match, choice.offers[1]!)).toBe(itemsBefore + 1);
    expect(seatOf(room.state, seatA).match.pendingChoice).toBeNull();
    expect(seatOf(room.state, seatA).choiceDeadline).toBeUndefined();
  }, 60_000);
});
