/**
 * G2-4b in a room, v22 anvil units (docs/ANVIL_UNITS.md): the support anvil (Conqueror tier 11, four distinct support
 * items from the rules' 13-item pool) reaches the seat's bench as 辅助装锻造器 through its orb after the round-4 PvP
 * commit; opening it opens the four-way forge through the same choose/timeoutChoice commands as the completed-item and
 * artifact anvils, on the room's own 30 s deadline for that choice. The room adds no message and draws nothing. Only the
 * owning seat sees the offers, a resumed connection gets the same choice and deadline, and tiers 10, 11 and 13 won in one
 * settlement give an artifact and a support anvil to open in turn, with tier 13's fixed items granted once.
 *
 * As in g2-4a-forge-timeout.test.ts, the tier bundles (exactly as `advanceG23Economy` records them, gold stripped) are
 * placed in the seat's live G2-3 progress while its round-4 battle plays, so the room's own commit is what grants them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { Room } from '../../src/server/room/room';
import { seatPushEvents, toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import type { MatchState } from '../../src/simulation/match-types';
import { G24_FORGE_POOLS } from '../../src/simulation/content/g2-4-forges';
import { validateG23MechanicLinks } from '../../src/simulation/g2-3-state';
import { readChoiceExtras } from '../../src/presentation/choice-fallback';
import { makeRoom, runUntil } from './helpers';
import { ANVIL, atomOptions, claimAnvils, countOf, openAnvil, seatOf, toChestSettlement } from './anvil-room-helpers';
import { expectOk, startServer, type NetHarness } from './net/helpers';

const supports: readonly string[] = G24_FORGE_POOLS.TFT_ArmoryKeySupport;
const receiptsOf = (match: MatchState, receiptId: string) => (match.seatMechanics?.receipts ?? []).filter(receipt => receipt.receiptId === receiptId);

/** Round 4 commits the seeded chests of `tiers`; the seat claims their anvil orbs in settlement. Returns the anvils by kind. */
function toAnvils(room: Room, runNext: () => boolean, seatId: string, ...tiers: readonly number[]) {
  toChestSettlement(room, runNext, seatId, ...tiers);
  for (const seat of room.state.seats) expect(seat.match.pendingChoice).toBeNull();
  return claimAnvils(room, seatId);
}

describe('G2-4b: the support anvil in an online room', () => {
  it('tier 11 gives 辅助装锻造器: four distinct support items, and its own deadline grants the first offer once', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const units = toAnvils(room, () => clock.runNext(), 's0', 11);
    expect(units.map(unit => unit.definitionId)).toEqual([ANVIL.support]);
    const opened = clock.now(), choice = openAnvil(room, 's0', units[0]!.id);
    const state = room.state, s0 = seatOf(state, 's0');
    expect(state.phase).toBe('settlement');
    expect(state.deadlineAt).toBe(opened + 30_000);
    expect(new Set(choice.offers).size).toBe(4);
    for (const id of choice.offers) expect(supports).toContain(id);
    expect(choice.offers).toEqual(atomOptions(s0.match, 11, 0));
    expect(readChoiceExtras(toSeatPrivateView(s0.match).pendingChoice!).title).toBe('辅助装锻造器 · 4 选 1');
    for (const seat of state.seats.filter(candidate => candidate.seatId !== 's0')) expect(seat.match.pendingChoice).toBeNull();

    const before = s0.match;
    clock.advance(29_999);
    expect(room.state).toBe(state);
    clock.advance(1); // the anvil deadline → the rules' timeoutChoice
    const after = seatOf(room.state, 's0').match;
    expect(after.pendingChoice).toBeNull();
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(countOf(after, choice.offers[0]!)).toBe(countOf(before, choice.offers[0]!) + 1);
    expect(receiptsOf(after, choice.choiceId)).toEqual([
      expect.objectContaining({ kind: 'choice', choiceKind: 'forge', source: 'anvil-unit', optionId: choice.offers[0], price: 0, skipped: false, timedOut: true }),
    ]);
    expect(() => validateG23MechanicLinks(after)).not.toThrow();
    const later = seatOf(runUntil(room, clock, current => current.round === 5 && current.phase === 'preparation'), 's0').match;
    expect(later.pendingChoice).toBeNull();
    expect(receiptsOf(later, choice.choiceId)).toHaveLength(1);
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('a pick before the deadline grants that support item; stale, foreign and other-seat answers are refused', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const [unit] = toAnvils(room, () => clock.runNext(), 's0', 11);
    const choice = openAnvil(room, 's0', unit!.id), before = seatOf(room.state, 's0').match, stateBefore = room.state;
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation + 1, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: supports.find(id => !choice.offers.includes(id))! }).ok).toBe(false);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: G24_FORGE_POOLS.TFT_ArmoryKeyOrnn[0]! }).ok).toBe(false);
    expect(room.handle('s1', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(room.state).toBe(stateBefore);

    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[2]! }).ok).toBe(true);
    expect(room.state.phase).toBe('settlement');
    expect(seatOf(room.state, 's0').choiceDeadline).toBeUndefined();
    const after = seatOf(room.state, 's0').match;
    expect(countOf(after, choice.offers[2]!)).toBe(countOf(before, choice.offers[2]!) + 1);
    expect(receiptsOf(after, choice.choiceId)).toEqual([expect.objectContaining({ optionId: choice.offers[2], timedOut: false })]);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[1]! }).ok).toBe(false);
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('tiers 10, 11 and 13 in one settlement: an artifact and a support anvil opened in turn, and tier 13\'s fixed items arrive once', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const units = toAnvils(room, () => clock.runNext(), 's0', 10, 11, 13);
    expect(units.map(unit => unit.definitionId)).toEqual([ANVIL.artifact, ANVIL.support]);
    const [artifactAnvil, supportAnvil] = units;
    const opened = openAnvil(room, 's0', artifactAnvil!.id);
    expect(readChoiceExtras(opened).title).toBe('神器装备锻造器 · 4 选 1');
    // One open choice at a time: the second anvil waits on the bench.
    expect(room.handle('s0', { type: 'openAnvil', unitId: supportAnvil!.id })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(room.handle('s0', { type: 'choose', choiceId: opened.choiceId, generation: opened.generation, definitionId: opened.offers[1]! }).ok).toBe(true);
    const second = openAnvil(room, 's0', supportAnvil!.id);
    expect(readChoiceExtras(second).title).toBe('辅助装锻造器 · 4 选 1');

    clock.advance(30_000); // deadline: the support anvil takes its first offer
    const after = seatOf(room.state, 's0').match;
    expect(after.pendingChoice).toBeNull();
    const receipts = after.seatMechanics!.receipts;
    expect(receipts.filter(receipt => receipt.receiptId === opened.choiceId)).toEqual([expect.objectContaining({ optionId: opened.offers[1], timedOut: false })]);
    expect(receipts.filter(receipt => receipt.receiptId === second.choiceId)).toEqual([expect.objectContaining({ optionId: second.offers[0], timedOut: true })]);
    for (const atom of [0, 1, 2]) expect(receipts.filter(receipt => receipt.receiptId === `g23:conqueror:13:atom:${atom}:copy:0`)).toHaveLength(1);
    expect(() => validateG23MechanicLinks(after)).not.toThrow();
    const later = seatOf(runUntil(room, clock, current => current.round === 5 && current.phase === 'preparation'), 's0').match;
    for (const atom of [0, 1, 2]) expect(later.seatMechanics!.receipts.filter(receipt => receipt.receiptId === `g23:conqueror:13:atom:${atom}:copy:0`)).toHaveLength(1);
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('never shows the support offers to another seat, in its view or its pushes', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const [unit] = toAnvils(room, () => clock.runNext(), 's0', 11);
    const choice = openAnvil(room, 's0', unit!.id), state = room.state;
    for (const other of state.seats.filter(seat => seat.seatId !== 's0')) {
      const view = JSON.stringify(toPlayerView(state, other.seatId, clock.now()));
      for (const id of choice.offers) expect(view).not.toContain(id);
      expect(view).not.toContain(choice.choiceId);
      expect(view).not.toContain('choiceDeadline');
      expect(JSON.stringify(seatPushEvents(other))).not.toContain(choice.choiceId);
      expect(JSON.stringify(toSeatPrivateView(other.match, other.choiceDeadline))).not.toContain(choice.choiceId);
    }
  }, 30_000);
});

describe('G2-4b: the support anvil across a reconnect', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  it('a resumed seat gets the same support choice and the unchanged deadline, and can still pick', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const a = await harness.connect(), b = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await b.join('乙'));
    expectOk(await a.start());
    await Promise.all([a, b].map(client => client.waitFor(message => message.type === 'state')));
    const room = harness.server.room!, clock = harness.clock, seatA = a.seatId!, token = a.token!;
    const [unit] = toAnvils(room, () => clock.runNext(), seatA, 11);
    const revision = seatOf(room.state, seatA).seatRevision;
    await a.waitForView(view => view.phase.round === 4 && view.phase.kind === 'settlement');
    await a.waitFor(message => message.type === 'state' && message.seatRevision === revision);
    const deadline = clock.now() + 30_000;
    expectOk(await a.command({ type: 'openAnvil', unitId: unit!.id }));
    const choice = seatOf(room.state, seatA).match.pendingChoice!;
    await a.waitFor(message => message.type === 'state' && message.state.pendingChoice?.choiceId === choice.choiceId);
    await a.close();
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === false);
    clock.advance(30_000 - 200);
    expect(seatOf(room.state, seatA).match.pendingChoice?.choiceId).toBe(choice.choiceId);

    const a2 = await harness.connect();
    expectOk(await a2.resume(token));
    const view = await a2.waitForView(candidate => candidate.mySeatId === seatA);
    await a2.waitFor(message => message.type === 'state');
    expect(view.phase).toMatchObject({ kind: 'settlement', round: 4, endsAt: deadline });
    expect(a2.state!.choiceDeadline).toEqual({ choiceId: choice.choiceId, generation: choice.generation, endsAt: deadline });
    expect(a2.state!.pendingChoice).toMatchObject({ kind: 'forge', choiceId: choice.choiceId, offers: choice.offers, generation: choice.generation });
    expect(readChoiceExtras(a2.state!.pendingChoice!).title).toBe('辅助装锻造器 · 4 选 1');
    for (const message of b.inbox) expect(JSON.stringify(message)).not.toContain(choice.choiceId);

    const itemsBefore = countOf(seatOf(room.state, seatA).match, choice.offers[3]!);
    expectOk(await a2.command({ type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[3]! }));
    expect(countOf(seatOf(room.state, seatA).match, choice.offers[3]!)).toBe(itemsBefore + 1);
    expect(room.state.phase).toBe('settlement');
  }, 60_000);
});
