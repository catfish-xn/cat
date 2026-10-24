/**
 * v22 anvil units (docs/ANVIL_UNITS.md, "计时接线"): opening an anvil starts the room's own deadline for exactly that
 * choiceId + generation, on the room clock, `pendingChoice.payload.timeoutMs` (30 s) long. At the deadline the room sends
 * the rules' `timeoutChoice` (first offer) for that choice only; a pick before cancels it. The phase deadline never
 * answers an open anvil early: a phase that would end first is extended to the anvil deadline. The deadline reaches only
 * the owning seat (its private state, as `choiceDeadline.endsAt`), and a resumed connection gets the same one.
 *
 * Opening encounter "component-anvils" (蔚) puts two component anvils on every seat's bench at the start, so a room
 * reaches an anvil in its first preparation without seeding anything.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS, type RoomOptions } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import { BotDriver } from '../../src/server/room/bot-driver';
import { createOpeningEncounter } from '../../src/server-entry';
import { SEATS, TIMINGS } from './helpers';
import { anvilChoiceId, benchAnvils, countOf, openAnvil, seatOf } from './anvil-room-helpers';
import { expectOk, startServer, type NetHarness } from './net/helpers';

const ANVIL_SEED = (() => { for (let seed = 1; seed < 400_000; seed++) if (createOpeningEncounter(seed).selection.encounterId === 'component-anvils') return seed; throw new Error('no seed'); })();
const rooms: Room[] = [];
afterEach(() => { for (const room of rooms.splice(0)) room.dispose(); });
function openRoom(overrides: Partial<RoomOptions> = {}) {
  const clock = new ManualClock();
  const room = new Room(SEATS, { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, roomId: 'anvil-deadline', seed: ANVIL_SEED, clock, resolver: new TwoSidedBattleResolver(), ...overrides });
  rooms.push(room);
  room.start();
  expect(room.state.phase).toBe('preparation');
  return { room, clock };
}
const receiptsOf = (room: Room, seatId: string, choiceId: string) => (seatOf(room.state, seatId).match.seatMechanics?.receipts ?? []).filter(receipt => receipt.receiptId === choiceId);

describe('v22: an opened anvil runs on its own room deadline', () => {
  it('arms timeoutMs on the room clock; nothing at 29999 ms, exactly one first-offer timeout at 30000 ms', () => {
    // A 60 s preparation: the anvil deadline lies inside the phase, so the phase deadline does not move.
    const { room, clock } = openRoom({ preparationMs: 60_000 });
    const phaseDeadline = room.state.deadlineAt!;
    const unit = benchAnvils(seatOf(room.state, 's0').match)[0]!;
    const opened = clock.now(), choice = openAnvil(room, 's0', unit.id);
    expect(room.state.deadlineAt).toBe(phaseDeadline);
    for (const seat of room.state.seats.filter(candidate => candidate.seatId !== 's0')) expect(seat.choiceDeadline).toBeUndefined();
    const before = room.state, items = countOf(before.seats[0]!.match, choice.offers[0]!);
    clock.advance(29_999);
    expect(room.state).toBe(before);
    clock.advance(1);
    expect(clock.now()).toBe(opened + 30_000);
    const after = seatOf(room.state, 's0');
    expect(room.state.fault).toBeNull();
    expect(room.state.phase).toBe('preparation');
    expect(room.state.deadlineAt).toBe(phaseDeadline);
    expect(after.match.phase).toBe('preparation');
    expect(after.match.pendingChoice).toBeNull();
    expect(after.choiceDeadline).toBeUndefined();
    expect(countOf(after.match, choice.offers[0]!)).toBe(items + 1);
    expect(receiptsOf(room, 's0', choice.choiceId)).toEqual([expect.objectContaining({ kind: 'choice', choiceKind: 'forge', source: 'anvil-unit', optionId: choice.offers[0], timedOut: true })]);
    // Exactly once: nothing else is due at this time, and the timer is gone.
    const settled = room.state;
    clock.advance(0);
    expect(room.state).toBe(settled);
    expect(room.retained.timers).toBe(1); // the phase deadline only
  });

  it('a pick cancels the deadline; the next anvil gets a fresh one and the old time passes without effect', () => {
    const { room, clock } = openRoom({ preparationMs: 60_000 });
    const [first, second] = benchAnvils(seatOf(room.state, 's0').match);
    const start = clock.now(), choice = openAnvil(room, 's0', first!.id);
    expect(room.retained.timers).toBe(2);
    clock.advance(10_000);
    // A stale generation or another seat's answer is refused and keeps the deadline.
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation + 1, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(room.handle('s1', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[2]! }).ok).toBe(false);
    expect(seatOf(room.state, 's0').choiceDeadline?.deadlineAt).toBe(start + 30_000);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[2]! })).toMatchObject({ ok: true });
    expect(seatOf(room.state, 's0').choiceDeadline).toBeUndefined();
    expect(room.retained.timers).toBe(1);
    const next = openAnvil(room, 's0', second!.id, true); // selling an anvil opens it the same way
    expect(next.choiceId).not.toBe(choice.choiceId);
    expect(seatOf(room.state, 's0').choiceDeadline?.deadlineAt).toBe(start + 40_000);
    const before = room.state;
    clock.advance(20_000); // the first anvil's old deadline passes
    expect(room.state).toBe(before);
    clock.advance(10_000);
    expect(receiptsOf(room, 's0', choice.choiceId)).toEqual([expect.objectContaining({ optionId: choice.offers[2], timedOut: false })]);
    expect(receiptsOf(room, 's0', next.choiceId)).toEqual([expect.objectContaining({ optionId: next.offers[0], timedOut: true })]);
    expect(room.state.fault).toBeNull();
  });

  it('opened at the end of preparation, it extends the phase: the preparation deadline never answers it early', () => {
    const { room, clock } = openRoom();
    const phaseDeadline = room.state.deadlineAt!;
    expect(phaseDeadline - clock.now()).toBe(TIMINGS.preparationMs);
    clock.advance(TIMINGS.preparationMs - 100);
    const unit = benchAnvils(seatOf(room.state, 's0').match)[0]!;
    const opened = clock.now(), choice = openAnvil(room, 's0', unit.id);
    expect(room.state.phase).toBe('preparation');
    expect(room.state.deadlineAt).toBe(opened + 30_000);
    expect(toPlayerView(room.state, 's1', clock.now()).phase.endsAt).toBe(opened + 30_000);
    clock.advance(100); // the old preparation deadline: nothing is forced
    expect(room.state.phase).toBe('preparation');
    expect(seatOf(room.state, 's0').match.pendingChoice?.choiceId).toBe(choice.choiceId);
    expect(receiptsOf(room, 's0', choice.choiceId)).toEqual([]);
    clock.advance(30_000 - 101);
    expect(seatOf(room.state, 's0').match.pendingChoice?.choiceId).toBe(choice.choiceId);
    clock.advance(1);
    // The anvil's own timeout first, then the (extended) preparation deadline freezes the round.
    expect(receiptsOf(room, 's0', choice.choiceId)).toEqual([expect.objectContaining({ optionId: choice.offers[0], timedOut: true })]);
    expect(room.state.phase).not.toBe('preparation');
    expect(room.state.fault).toBeNull();
  });

  it('the extension lasts only while the anvil is open: a pick gives the phase back its own deadline', () => {
    const { room, clock } = openRoom();
    const phaseDeadline = room.state.deadlineAt!;
    clock.advance(TIMINGS.preparationMs - 300);
    const unit = benchAnvils(seatOf(room.state, 's0').match)[0]!;
    const opened = clock.now(), choice = openAnvil(room, 's0', unit.id);
    expect(room.state.deadlineAt).toBe(opened + 30_000);
    clock.advance(100);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[1]! })).toMatchObject({ ok: true });
    expect(room.state.deadlineAt).toBe(phaseDeadline);
    expect(room.state.phase).toBe('preparation');
    clock.advance(phaseDeadline - clock.now());
    expect(room.state.phase).not.toBe('preparation');
    expect(receiptsOf(room, 's0', choice.choiceId)).toEqual([expect.objectContaining({ optionId: choice.offers[1], timedOut: false })]);
    expect(room.state.fault).toBeNull();
  });

  it('P 乙: one phase is extended by at most 30 s in total; a later anvil still open at the cap gets the first offer', () => {
    const { room, clock } = openRoom();
    const phaseDeadline = room.state.deadlineAt!;
    clock.advance(TIMINGS.preparationMs - 100);
    const [first, second] = benchAnvils(seatOf(room.state, 's0').match);
    const one = openAnvil(room, 's0', first!.id);
    expect(room.state.deadlineAt).toBe(phaseDeadline + 29_900);
    clock.advance(10_000);
    expect(room.handle('s0', { type: 'choose', choiceId: one.choiceId, generation: one.generation, definitionId: one.offers[1]! })).toMatchObject({ ok: true });
    const opened = clock.now(), two = openAnvil(room, 's0', second!.id, false, phaseDeadline + 30_000);
    expect(opened + 30_000).toBeGreaterThan(phaseDeadline + 30_000);
    expect(room.state.deadlineAt).toBe(phaseDeadline + 30_000); // capped, not opened + 30 s
    // The seat's own countdown says the same: its private view ends at the cap, not at opened + 30 s.
    expect(seatOf(room.state, 's0').choiceDeadline).toMatchObject({ choiceId: two.choiceId, deadlineAt: phaseDeadline + 30_000 });
    expect(toSeatPrivateView(seatOf(room.state, 's0').match, seatOf(room.state, 's0').choiceDeadline).choiceDeadline?.endsAt).toBe(phaseDeadline + 30_000);
    clock.advance(phaseDeadline + 30_000 - 1 - clock.now());
    expect(room.state.phase).toBe('preparation');
    expect(receiptsOf(room, 's0', two.choiceId)).toEqual([]);
    clock.advance(1);
    expect(receiptsOf(room, 's0', two.choiceId)).toEqual([expect.objectContaining({ optionId: two.offers[0], timedOut: true })]);
    expect(room.state.phase).not.toBe('preparation');
    expect(room.state.fault).toBeNull();
  });

  it('reaches the owning seat only: its private view carries choiceDeadline, no other view names the choice', () => {
    const { room, clock } = openRoom();
    const unit = benchAnvils(seatOf(room.state, 's0').match)[0]!;
    const choice = openAnvil(room, 's0', unit.id);
    const own = seatOf(room.state, 's0');
    expect(toSeatPrivateView(own.match, own.choiceDeadline).choiceDeadline).toEqual({ choiceId: choice.choiceId, generation: choice.generation, endsAt: own.choiceDeadline!.deadlineAt });
    for (const other of room.state.seats.filter(seat => seat.seatId !== 's0')) {
      expect(JSON.stringify(toSeatPrivateView(other.match, other.choiceDeadline))).not.toContain(anvilChoiceId(unit.id));
      const view = JSON.stringify(toPlayerView(room.state, other.seatId, clock.now()));
      expect(view).not.toContain(anvilChoiceId(unit.id));
      expect(view).not.toContain('choiceDeadline');
      for (const id of choice.offers) expect(view).not.toContain(`"${id}"`);
    }
  });
});

describe('v23 live fix: fill-in bots open their anvils without moving the phase deadline', () => {
  it('bots open and pick both anvils at the start of 1-2; every published deadline and every view endsAt stays the phase\'s own', () => {
    // As the live pre-check: a 6 s first preparation, the default bot step; s4–s7 are fill-in bots.
    const { room, clock } = openRoom({ preparationMs: 6_000 });
    const phaseDeadline = room.state.deadlineAt!;
    const bots = new BotDriver(room, ANVIL_SEED);
    rooms.push({ dispose: () => bots.dispose() } as unknown as Room);
    const published: { deadlineAt: number | null; endsAt: number | null; bot: (number | undefined)[] }[] = [];
    const unsubscribe = room.subscribe(state => {
      if (state.phase !== 'preparation') return;
      published.push({ deadlineAt: state.deadlineAt, endsAt: toPlayerView(state, 's0', clock.now()).phase.endsAt,
        bot: state.seats.filter(seat => seat.controller === 'bot').map(seat => seat.choiceDeadline?.deadlineAt) });
    });
    const botIds = room.state.seats.filter(seat => seat.controller === 'bot').map(seat => seat.seatId);
    expect(botIds).toEqual(['s4', 's5', 's6', 's7']);
    const opened = (seatId: string) => (seatOf(room.state, seatId).match.seatMechanics?.receipts ?? []).filter(receipt => receipt.kind === 'choice' && (receipt as { source?: string }).source === 'anvil-unit');
    while (room.state.phase === 'preparation' && !botIds.every(seatId => opened(seatId).length === 2) && clock.runNext()) { /* bot steps */ }
    unsubscribe();
    expect(room.state.fault).toBeNull();
    expect(room.state.phase).toBe('preparation');
    for (const seatId of botIds) expect(opened(seatId).map(receipt => (receipt as { timedOut?: boolean }).timedOut), seatId).toEqual([false, false]);
    // Something was published while a bot anvil was open, and nothing moved the countdown.
    expect(published.some(entry => entry.bot.some(deadline => deadline !== undefined))).toBe(true);
    for (const entry of published) {
      expect(entry.deadlineAt).toBe(phaseDeadline);
      expect(entry.endsAt).toBe(phaseDeadline);
      for (const deadline of entry.bot) if (deadline !== undefined) expect(deadline).toBeLessThanOrEqual(phaseDeadline);
    }
    // A human seat's anvil in the same room still extends the phase (乙 unchanged).
    const unit = benchAnvils(seatOf(room.state, 's0').match)[0]!;
    const at = clock.now();
    openAnvil(room, 's0', unit.id);
    expect(room.state.deadlineAt).toBe(Math.min(at + 30_000, phaseDeadline + 30_000));
  });

  it('a bot anvil still open at the phase deadline is answered by the phase, without an extension', () => {
    const { room, clock } = openRoom();
    const phaseDeadline = room.state.deadlineAt!;
    clock.advance(TIMINGS.preparationMs - 100);
    const unit = benchAnvils(seatOf(room.state, 's4').match)[0]!;
    const choice = openAnvil(room, 's4', unit.id, false, phaseDeadline);
    expect(room.state.deadlineAt).toBe(phaseDeadline);
    clock.advance(100);
    expect(room.state.phase).not.toBe('preparation');
    expect(room.state.fault).toBeNull();
    expect(receiptsOf(room, 's4', choice.choiceId)).toEqual([expect.objectContaining({ optionId: choice.offers[0], timedOut: true })]);
  });
});

describe('v22: the anvil deadline across a reconnect', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  it('a resumed seat gets the same choiceDeadline.endsAt, and the deadline answers the anvil while it is away', async () => {
    harness = await startServer({ seed: ANVIL_SEED }, new TwoSidedBattleResolver());
    const a = await harness.connect(), b = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await b.join('乙'));
    expectOk(await a.start());
    await Promise.all([a, b].map(client => client.waitFor(message => message.type === 'state')));
    const room = harness.server.room!, clock = harness.clock, seatA = a.seatId!, token = a.token!;
    const unit = benchAnvils(seatOf(room.state, seatA).match)[0]!, choiceId = anvilChoiceId(unit.id);
    const opened = clock.now();
    expectOk(await a.command({ type: 'openAnvil', unitId: unit.id }));
    const shown = await a.waitFor(message => message.type === 'state' && message.state.pendingChoice?.choiceId === choiceId);
    expect(shown.type === 'state' && shown.state.choiceDeadline).toEqual({ choiceId, generation: 0, endsAt: opened + 30_000 });
    await a.close();
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === false);
    clock.advance(10_000);

    const a2 = await harness.connect();
    expectOk(await a2.resume(token));
    const view = await a2.waitForView(candidate => candidate.mySeatId === seatA);
    await a2.waitFor(message => message.type === 'state');
    expect(a2.state!.choiceDeadline).toEqual({ choiceId, generation: 0, endsAt: opened + 30_000 });
    expect(view.phase).toMatchObject({ kind: 'preparation', endsAt: opened + 30_000 });
    expect(view.phase.endsAt! - view.phase.serverNow).toBe(20_000);
    for (const message of b.inbox) expect(JSON.stringify(message)).not.toContain(choiceId);

    clock.advance(20_000);
    await a2.waitFor(message => message.type === 'state' && message.state.pendingChoice === null && message.state.choiceDeadline === undefined);
    expect(seatOf(room.state, seatA).match.seatMechanics!.receipts.filter(receipt => receipt.receiptId === choiceId)).toEqual([expect.objectContaining({ timedOut: true })]);
  }, 60_000);
});
