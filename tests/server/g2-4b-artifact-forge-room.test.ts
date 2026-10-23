/**
 * G2-4b in a room, v22 anvil units (docs/ANVIL_UNITS.md): the artifact anvil (Conqueror tiers 10 and 14, four distinct
 * artifacts from the rules' 21-item pool) reaches the seat's bench as 神器装备锻造器 through its orb after the round-4
 * PvP commit; opening it opens the four-way forge through the same choose/timeoutChoice commands as the completed-item
 * anvil, on the room's own 30 s deadline for that choice. The room adds no message and draws nothing. Only the owning
 * seat sees the offers, a resumed connection gets the same choice and deadline, and several anvils won in one settlement
 * wait on the bench and open one after another.
 *
 * As in g2-4a-forge-timeout.test.ts, the tier bundles (exactly as `advanceG23Economy` records them, gold stripped) are
 * placed in the seat's live G2-3 progress while its round-4 battle plays, so the room's own commit is what grants them.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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

const artifacts: readonly string[] = G24_FORGE_POOLS.TFT_ArmoryKeyOrnn;
const receiptsOf = (match: MatchState, receiptId: string) => (match.seatMechanics?.receipts ?? []).filter(receipt => receipt.receiptId === receiptId);

/** Round 4 commits the seeded chests of `tiers`; the seat claims their anvil orbs in settlement. Returns the anvils in order. */
function toAnvils(room: Room, runNext: () => boolean, seatId: string, ...tiers: readonly number[]) {
  toChestSettlement(room, runNext, seatId, ...tiers);
  for (const seat of room.state.seats) expect(seat.match.pendingChoice).toBeNull();
  return claimAnvils(room, seatId);
}

describe('G2-4b: the artifact anvil in an online room', () => {
  const prepared = new Map<number, ReturnType<typeof makeRoom>>();
  for (let index = 0; index < 4; index++) beforeAll(() => {
    const own = makeRoom(new TwoSidedBattleResolver());
    own.room.start();
    runUntil(own.room, own.clock, state => state.round === 4 && state.phase === 'battle');
    prepared.set(index, own);
  });
  afterAll(() => { for (const own of prepared.values()) own.room.dispose(); });

  it('tier 10 gives 神器装备锻造器: four distinct artifacts, and its own deadline grants the first offer once', () => {
    const { room, clock } = prepared.get(0)!;
    const units = toAnvils(room, () => clock.runNext(), 's0', 10);
    expect(units.map(unit => unit.definitionId)).toEqual([ANVIL.artifact]);
    const opened = clock.now(), choice = openAnvil(room, 's0', units[0]!.id);
    const state = room.state, s0 = seatOf(state, 's0');
    expect(state.phase).toBe('settlement');
    expect(state.deadlineAt).toBe(opened + 30_000);
    expect(new Set(choice.offers).size).toBe(4);
    for (const id of choice.offers) expect(artifacts).toContain(id);
    expect(choice.offers).toEqual(atomOptions(s0.match, 10, 0));
    // The choice the client draws from the private view: user-set name, four offers, the rules' timeout pick.
    const shown = toSeatPrivateView(s0.match).pendingChoice!;
    expect(readChoiceExtras(shown).title).toBe('神器装备锻造器 · 4 选 1');
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

  it('a pick before the deadline grants that artifact; stale, foreign and other-seat answers are refused', () => {
    const { room, clock } = prepared.get(1)!;
    const [unit] = toAnvils(room, () => clock.runNext(), 's0', 10);
    const choice = openAnvil(room, 's0', unit!.id), before = seatOf(room.state, 's0').match, stateBefore = room.state;
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation + 1, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: artifacts.find(id => !choice.offers.includes(id))! }).ok).toBe(false);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'gunblade' }).ok).toBe(false);
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

  it('tiers 9, 10 and 14 in one settlement give three anvils opened in turn; each deadline grants its own first offer', () => {
    const { room, clock } = prepared.get(2)!;
    const units = toAnvils(room, () => clock.runNext(), 's0', 9, 10, 14);
    expect(units.map(unit => unit.definitionId)).toEqual([ANVIL.completed, ANVIL.artifact, ANVIL.artifact]);
    const [completed, tier10, tier14] = units;
    const first = seatOf(room.state, 's0').match;
    const opened = openAnvil(room, 's0', completed!.id);
    expect(readChoiceExtras(opened).title).toBe('成装锻造器 · 4 选 1');
    // One open choice at a time: the other anvils wait on the bench until this one is answered.
    expect(room.handle('s0', { type: 'openAnvil', unitId: tier10!.id })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(room.handle('s0', { type: 'choose', choiceId: opened.choiceId, generation: opened.generation, definitionId: opened.offers[1]! }).ok).toBe(true);
    const second = openAnvil(room, 's0', tier10!.id);
    expect(readChoiceExtras(second).title).toBe('神器装备锻造器 · 4 选 1');
    expect(second.offers).toEqual(atomOptions(first, 10, 0));
    clock.advance(29_999);
    expect(clock.fireNext()).toBe(true); // exactly the tier-10 anvil's deadline (the settlement it held is due at the same time)
    expect(receiptsOf(seatOf(room.state, 's0').match, second.choiceId)).toEqual([expect.objectContaining({ optionId: second.offers[0], timedOut: true })]);
    expect(room.state.phase).toBe('settlement');
    // Still in that settlement, the tier-14 anvil opens on its own deadline and holds the settlement again.
    const tier14Options = atomOptions(first, 14, 1);
    for (const id of tier14Options) expect(artifacts).toContain(id);
    const third = openAnvil(room, 's0', tier14!.id);
    expect(third.offers).toEqual(tier14Options);
    expect(room.state.deadlineAt).toBe(clock.now() + 30_000);
    clock.advance(30_000);
    const after = seatOf(room.state, 's0').match;
    expect(after.pendingChoice).toBeNull();
    expect(receiptsOf(after, third.choiceId)).toEqual([expect.objectContaining({ kind: 'choice', choiceKind: 'forge', optionId: tier14Options[0], timedOut: true })]);
    expect(receiptsOf(after, opened.choiceId)).toEqual([expect.objectContaining({ optionId: opened.offers[1], timedOut: false })]);
    expect(room.state).toMatchObject({ round: 5, phase: 'preparation' });
    expect(() => validateG23MechanicLinks(after)).not.toThrow();
    expect(room.state.fault).toBeNull();
  }, 30_000);

  it('never shows the artifact offers to another seat, in its view or its pushes', () => {
    const { room, clock } = prepared.get(3)!;
    const [unit] = toAnvils(room, () => clock.runNext(), 's0', 10);
    const choice = openAnvil(room, 's0', unit!.id), state = room.state;
    for (const other of state.seats.filter(seat => seat.seatId !== 's0')) {
      const view = toPlayerView(state, other.seatId, clock.now()), json = JSON.stringify(view);
      // (Another seat may own one of these artifacts itself, e.g. from Portable Forge: s0's entry and the offer list never show.)
      const s0Public = JSON.stringify(view.seats.find(seat => seat.seatId === 's0'));
      for (const id of choice.offers) expect(s0Public).not.toContain(id);
      expect(json).not.toContain(JSON.stringify(choice.offers));
      expect(json).not.toContain(choice.choiceId);
      expect(json).not.toContain('choiceDeadline');
      expect(JSON.stringify(seatPushEvents(other))).not.toContain(choice.choiceId);
      expect(JSON.stringify(toSeatPrivateView(other.match, other.choiceDeadline))).not.toContain(choice.choiceId);
    }
  }, 30_000);
});

describe('G2-4b: the artifact anvil across a reconnect', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  it('a resumed seat gets the same artifact choice and the unchanged deadline, and can still pick', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const a = await harness.connect(), b = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await b.join('乙'));
    expectOk(await a.start());
    await Promise.all([a, b].map(client => client.waitFor(message => message.type === 'state')));
    const room = harness.server.room!, clock = harness.clock, seatA = a.seatId!, token = a.token!;
    const [unit] = toAnvils(room, () => clock.runNext(), seatA, 10);
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
    expect(readChoiceExtras(a2.state!.pendingChoice!).title).toBe('神器装备锻造器 · 4 选 1');
    for (const message of b.inbox) expect(JSON.stringify(message)).not.toContain(choice.choiceId);

    const itemsBefore = countOf(seatOf(room.state, seatA).match, choice.offers[3]!);
    expectOk(await a2.command({ type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[3]! }));
    expect(countOf(seatOf(room.state, seatA).match, choice.offers[3]!)).toBe(itemsBefore + 1);
    expect(room.state.phase).toBe('settlement');
  }, 60_000);
});
