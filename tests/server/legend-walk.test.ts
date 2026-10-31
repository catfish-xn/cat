import { describe, expect, it } from 'vitest';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import type { Room } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { LegendWalkBook, LEGEND_WALK_MIN_GAP_MS } from '../../src/server/room/legend-walk';
import {
  CAROUSEL_UNIT_PICK_RADIUS, carouselWalkContact, CAROUSEL_LEGEND_RADIUS, LEGEND_CELLS_PER_SECOND, carouselHome, carouselUnitPoint, interceptCarouselUnit, walkPoint, type LegendWalk,
} from '../../src/server/legend-motion';
import { parseClientMessage, NET_PROTOCOL_VERSION } from '../../src/server/net/messages';
import { makeRoom, runUntil } from './helpers';
import { flush, messagesOfType, seatTwo, startServer } from './net/helpers';

const rules = CAROUSEL_RULES_BINDING;

/** A started room with the real carousel rules, played on its timers to its first carousel (2-4). */
function toCarousel(): { room: Room; clock: ManualClock; walks: LegendWalk[] } {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { carousel: rules });
  const walks: LegendWalk[] = [];
  room.subscribeWalks(walk => walks.push(walk));
  room.start();
  runUntil(room, clock, state => state.phase === 'carousel', 3_000);
  return { room, clock, walks };
}
const kindOf = (room: Room, seatId: string) => room.state.seats.find(seat => seat.seatId === seatId)!.kind;
/** Human seats in the order the rules release them (seat ids are never assumed). */
const humansByRelease = (room: Room) => room.state.carousel!.state.releaseOrder.filter(seatId => kindOf(room, seatId) === 'human');
const advanceTo = (room: Room, clock: ManualClock, ms: number) => clock.advance(Math.max(0, room.state.carousel!.startedAt + ms - clock.now()));
const elapsed = (room: Room, clock: ManualClock) => clock.now() - room.state.carousel!.startedAt;
const slotIndex = (room: Room, slot: number) => rules.listCarouselSlots(room.state.carousel!.state).findIndex(entry => entry.slot === slot);
const takerOf = (room: Room, slot: number) => rules.listCarouselSlots(room.state.carousel!.state).find(entry => entry.slot === slot)!.pickedBy;

describe('little-legend walks on the carousel (room)', () => {
  it('holds a seat until its release, plans from its cradle and aims where the turning unit will be', () => {
    const { room, clock, walks } = toCarousel();
    const [first] = humansByRelease(room), release = room.state.carousel!.state.releaseAtMs[first!]!;
    expect(room.walkLegend(first!, { scene: 'carousel', to: { x: 0, y: 0 } })).toEqual({ ok: false, reason: 'carousel-locked' });
    advanceTo(room, clock, release);
    const index = room.state.seats.findIndex(seat => seat.seatId === first);
    const slot = rules.listCarouselSlots(room.state.carousel!.state).find(entry => entry.pickedBy === null)!.slot;
    const result = room.walkLegend(first!, { scene: 'carousel', slot });
    expect(result.ok).toBe(true);
    const walk = (result as { walk: LegendWalk }).walk;
    expect(walk.from).toEqual(carouselHome(index, room.state.seats.length));
    const meet = carouselUnitPoint(slotIndex(room, slot), rules.listCarouselSlots(room.state.carousel!.state).length, elapsed(room, clock) + (walk.arriveAt - walk.startedAt));
    expect(walk.to.x).toBeCloseTo(meet.x, 6); expect(walk.to.y).toBeCloseTo(meet.y, 6);
    expect(walks).toEqual([walk]);
    // A slot click uses the same body contact as a ground walk, before reaching the unit's center.
    const contactAt = carouselWalkContact(walk, slotIndex(room, slot), rules.listCarouselSlots(room.state.carousel!.state).length, room.state.carousel!.startedAt)!;
    expect(contactAt).toBeLessThan(walk.arriveAt);
    clock.advance(Math.max(0, contactAt - clock.now() - 1));
    expect(takerOf(room, slot)).toBeNull();
    clock.advance(1);
    expect(takerOf(room, slot)).toBe(first);
    expect(room.walkLegend(first!, { scene: 'carousel', slot })).toEqual({ ok: false, reason: 'already-picked' });
    const away = room.walkLegend(first!, { scene: 'carousel', to: { x: 0, y: 0 } });
    expect(away).toMatchObject({ ok: true, walk: { from: walkPoint(walk, clock.now()), slot: null } });
    expect(walks).toHaveLength(2);
  }, 60_000);

  it('gives a unit to whoever reaches it first, not whoever asked first; the other legend just stands there', () => {
    const { room, clock } = toCarousel();
    const [a, b] = humansByRelease(room), state = room.state.carousel!.state;
    advanceTo(room, clock, Math.max(state.releaseAtMs[a!]!, state.releaseAtMs[b!]!));
    // b walks to the middle first; the slot whose unit is nearest b's new spot then favours b even though a asks first.
    const centre = room.walkLegend(b!, { scene: 'carousel', to: { x: 0, y: 0 } }) as { ok: true; walk: LegendWalk };
    clock.advance(centre.walk.arriveAt - clock.now());
    const all = rules.listCarouselSlots(room.state.carousel!.state), at = elapsed(room, clock);
    const homeA = carouselHome(room.state.seats.findIndex(seat => seat.seatId === a), room.state.seats.length);
    const meet = (from: { x: number; y: number }, slot: number) => interceptCarouselUnit(from, slotIndex(room, slot), all.length, at).ms;
    const slot = all.filter(entry => entry.pickedBy === null).map(entry => entry.slot).find(candidate => meet(homeA, candidate) > meet({ x: 0, y: 0 }, candidate) + 300)!;
    expect(slot).toBeDefined();
    const ofA = room.walkLegend(a!, { scene: 'carousel', slot }) as { ok: true; walk: LegendWalk };
    clock.advance(LEGEND_WALK_MIN_GAP_MS);
    const ofB = room.walkLegend(b!, { scene: 'carousel', slot }) as { ok: true; walk: LegendWalk };
    expect(ofA.ok && ofB.ok).toBe(true);
    expect(ofB.walk.arriveAt).toBeLessThan(ofA.walk.arriveAt);
    clock.advance(ofA.walk.arriveAt - clock.now());
    expect(takerOf(room, slot)).toBe(b);
    expect(room.state.carousel!.state.receipts.some(receipt => receipt.seatId === a)).toBe(false);
    expect(room.state.fault).toBeNull();
    // a is where its walk ended and may go for another unit from there.
    const next = room.walkLegend(a!, { scene: 'carousel', to: { x: 1, y: 1 } }) as { ok: true; walk: LegendWalk };
    expect(next.walk.from.x).toBeCloseTo(ofA.walk.to.x, 6); expect(next.walk.from.y).toBeCloseTo(ofA.walk.to.y, 6);
  }, 60_000);

  it('a new walk replaces the last one from where the legend is, cancels its pick, and keeps inside the cradles', () => {
    const { room, clock } = toCarousel();
    const [first] = humansByRelease(room);
    advanceTo(room, clock, room.state.carousel!.state.releaseAtMs[first!]!);
    const slot = rules.listCarouselSlots(room.state.carousel!.state).find(entry => entry.pickedBy === null)!.slot;
    const toUnit = room.walkLegend(first!, { scene: 'carousel', slot }) as { ok: true; walk: LegendWalk };
    expect(room.walkLegend(first!, { scene: 'carousel', to: { x: 0, y: 0 } })).toEqual({ ok: false, reason: 'rate-limited' });
    clock.advance(LEGEND_WALK_MIN_GAP_MS);
    const away = room.walkLegend(first!, { scene: 'carousel', to: { x: 100, y: 0 } }) as { ok: true; walk: LegendWalk };
    const there = walkPoint(toUnit.walk, clock.now());
    expect(away.walk.from.x).toBeCloseTo(there.x, 6); expect(away.walk.from.y).toBeCloseTo(there.y, 6);
    expect(away.walk.to).toEqual({ x: CAROUSEL_LEGEND_RADIUS, y: 0 });
    clock.advance(Math.max(0, toUnit.walk.arriveAt - clock.now()) + 1);
    expect(takerOf(room, slot)).toBeNull();
  }, 60_000);

  it('picks on actual ground-walk contact without changing the destination, then allows movement but no second pick', () => {
    const { room, clock } = toCarousel();
    const [first] = humansByRelease(room);
    advanceTo(room, clock, room.state.carousel!.state.releaseAtMs[first!]!);
    const home = carouselHome(room.state.seats.findIndex(seat => seat.seatId === first), room.state.seats.length);
    const startedAt = clock.now(), openedAt = room.state.carousel!.startedAt;
    const slots = rules.listCarouselSlots(room.state.carousel!.state);
    // Choose a ground destination just beyond a moving unit; it is not a slot request.
    const destinations = slots.filter(slot => slot.pickedBy === null).map(slot => {
      const meet = interceptCarouselUnit(home, slotIndex(room, slot.slot), slots.length, startedAt - openedAt);
      const delta = { x: meet.to.x - home.x, y: meet.to.y - home.y }, length = Math.hypot(delta.x, delta.y);
      return { x: meet.to.x + delta.x / length * 0.5, y: meet.to.y + delta.y / length * 0.5 };
    });
    const to = destinations[0]!;
    const result = room.walkLegend(first!, { scene: 'carousel', to }) as { ok: true; walk: LegendWalk };
    expect(result.ok).toBe(true);
    const contacts = slots.flatMap((slot, index) => {
      if (slot.pickedBy !== null) return [];
      const at = carouselWalkContact(result.walk, index, slots.length, openedAt);
      return at === null ? [] : [{ slot: slot.slot, at }];
    }).sort((a, b) => a.at - b.at);
    expect(contacts.length).toBeGreaterThan(0);
    clock.advance(contacts[0]!.at - clock.now() - 0.01);
    expect(room.state.carousel!.state.receipts.some(receipt => receipt.seatId === first)).toBe(false);
    clock.advance(0.02);
    expect(takerOf(room, contacts[0]!.slot)).toBe(first);
    expect(room.walks.find(walk => walk.seatId === first)).toEqual(result.walk);
    expect(room.walkLegend(first!, { scene: 'carousel', slot: slots.find(slot => slot.pickedBy === null)!.slot })).toMatchObject({ ok: false, reason: 'already-picked' });
    expect(room.walkLegend(first!, { scene: 'carousel', to: home }).ok).toBe(true);
    room.dispose();
  }, 60_000);

  it('never walks a bot seat, refuses a board walk during the carousel, and forgets the carousel walks with it', () => {
    const { room, clock } = toCarousel();
    const state = room.state.carousel!.state, bot = state.releaseOrder.find(seatId => kindOf(room, seatId) === 'bot')!;
    const [first] = humansByRelease(room);
    advanceTo(room, clock, Math.max(state.releaseAtMs[bot]!, state.releaseAtMs[first!]!));
    expect(room.walkLegend(bot, { scene: 'carousel', to: { x: 0, y: 0 } })).toEqual({ ok: false, reason: 'seat-controlled' });
    expect(room.walkLegend(first!, { scene: 'board', to: { x: 1, y: 1 } })).toEqual({ ok: false, reason: 'wrong-phase' });
    const slot = rules.listCarouselSlots(room.state.carousel!.state).find(entry => entry.pickedBy === null)!.slot;
    // Far enough away to still be walking when the carousel's last timers run out.
    expect(room.walkLegend(first!, { scene: 'carousel', slot }).ok).toBe(true);
    expect(room.retained.timers).toBeGreaterThanOrEqual(2);
    runUntil(room, clock, next => next.phase !== 'carousel');
    expect(room.walks.filter(walk => walk.scene === 'carousel')).toEqual([]);
    expect(room.state.fault).toBeNull();
  }, 60_000);
});

describe('little-legend walks on a board (room)', () => {
  it('relays a board walk in preparation inside the sanity bound, with the client\'s own start', () => {
    const { room, clock } = makeRoom();
    const walks: LegendWalk[] = [];
    room.subscribeWalks(walk => walks.push(walk));
    expect(room.walkLegend('s0', { scene: 'board', to: { x: 1, y: 1 } })).toEqual({ ok: false, reason: 'wrong-phase' }); // waiting
    room.start();
    runUntil(room, clock, state => state.phase === 'preparation');
    const human = room.state.seats.find(seat => seat.kind === 'human')!.seatId;
    const result = room.walkLegend(human, { scene: 'board', from: { x: 8, y: 9 }, to: { x: 3, y: 500 } }) as { ok: true; walk: LegendWalk };
    expect(result.ok).toBe(true);
    expect(result.walk).toMatchObject({ seatId: human, scene: 'board', from: { x: 8, y: 9 }, to: { x: 3, y: 20 }, slot: null, startedAt: clock.now() });
    expect(result.walk.arriveAt - result.walk.startedAt).toBeCloseTo(Math.hypot(5, 11) / LEGEND_CELLS_PER_SECOND * 1000, 6);
    expect(walks).toEqual([result.walk]);
    expect(room.walkLegend(human, { scene: 'carousel', to: { x: 0, y: 0 } })).toMatchObject({ ok: false });
    expect(room.retained.timers).toBe(1); // only the phase deadline: a board walk arms nothing
  });
});

describe('walk message (wire)', () => {
  const envelope = { protocolVersion: NET_PROTOCOL_VERSION, commandId: 3, roomId: 'r' };
  it('accepts a point or a slot and nothing else', () => {
    expect(parseClientMessage(JSON.stringify({ ...envelope, type: 'walk', scene: 'board', from: { x: 1, y: 2 }, to: { x: 3.5, y: -1 } })))
      .toEqual({ ok: true, message: { ...envelope, type: 'walk', scene: 'board', from: { x: 1, y: 2 }, to: { x: 3.5, y: -1 } } });
    expect(parseClientMessage(JSON.stringify({ ...envelope, type: 'walk', scene: 'carousel', slot: 4 })))
      .toEqual({ ok: true, message: { ...envelope, type: 'walk', scene: 'carousel', slot: 4 } });
    for (const bad of [{ scene: 'carousel' }, { scene: 'sky', to: { x: 0, y: 0 } }, { scene: 'board', to: { x: 'a', y: 0 } }, { scene: 'board', to: { x: 1e9, y: 0 } },
      { scene: 'carousel', slot: -1 }, { scene: 'board', to: { x: 0, y: 0, z: 1 } }, { scene: 'board', to: { x: 0, y: 0 }, gold: 99 }]) {
      expect(parseClientMessage(JSON.stringify({ ...envelope, type: 'walk', ...bad })), JSON.stringify(bad)).toMatchObject({ ok: false, code: 'invalid-message' });
    }
  });

  it('reaches every seat of the room as `legend`, with no receipt, and a refused walk sends nothing', async () => {
    const harness = await startServer();
    try {
      const [a, b] = await seatTwo(harness);
      const room = harness.server.room!;
      runUntil(room, harness.clock, state => state.phase === 'preparation');
      await flush();
      const roomId = room.state.roomId, seatA = room.state.seats.find(seat => seat.name === '甲')!.seatId;
      const before = a.inbox.length;
      a.sendRaw(JSON.stringify({ type: 'walk', protocolVersion: NET_PROTOCOL_VERSION, commandId: 900, roomId, scene: 'board', from: { x: 9, y: 9 }, to: { x: 2, y: 3 } }));
      const seen = await b.waitFor(message => message.type === 'legend');
      expect(seen).toMatchObject({ type: 'legend', roomId, walk: { seatId: seatA, scene: 'board', from: { x: 9, y: 9 }, to: { x: 2, y: 3 } } });
      await a.waitFor(message => message.type === 'legend', 5_000, before);
      // Refused (carousel walk outside the carousel): nothing at all comes back.
      a.sendRaw(JSON.stringify({ type: 'walk', protocolVersion: NET_PROTOCOL_VERSION, commandId: 901, roomId, scene: 'carousel', to: { x: 0, y: 0 } }));
      await flush();
      expect(messagesOfType(a.inbox.slice(before), 'legend')).toHaveLength(1);
      expect(messagesOfType(a.inbox.slice(before), 'receipt')).toHaveLength(0);
      expect(messagesOfType(a.inbox.slice(before), 'error')).toHaveLength(0);
      // A later command still reaches the rules after the walk ids (no dedupe entry, no resync).
      const receipt = await a.command({ type: 'buyXp' });
      expect(receipt.ok || !['resync-required', 'commandId-conflict', 'invalid-message'].includes(receipt.reason!)).toBe(true);
    } finally { await harness.close(); }
  }, 60_000);
});

describe('ground-walk contact geometry', () => {
  it('requires the approved circle contact and finds entry before the destination', () => {
    const walk = (x: number): LegendWalk => ({ seatId: 's0', scene: 'carousel', from: { x, y: 4 }, to: { x, y: 1 }, startedAt: 0, arriveAt: 1200, slot: null });
    const near = walk(0.6);
    expect(carouselWalkContact(near, 0, 9, 0)).not.toBeNull(); // old 0.25-circle miss is inside the approved circle
    expect(carouselWalkContact(walk(1.0), 0, 9, 0)).toBeNull();
    const crossing = walk(0), at = carouselWalkContact(crossing, 0, 9, 0);
    expect(at).not.toBeNull();
    expect(at!).toBeLessThan(crossing.arriveAt);
    const legend = walkPoint(crossing, at!), unit = carouselUnitPoint(0, 9, at!);
    expect(Math.hypot(legend.x - unit.x, legend.y - unit.y)).toBeCloseTo(CAROUSEL_UNIT_PICK_RADIUS, 6);
    expect(carouselWalkContact({ ...crossing, arriveAt: 0 }, 0, 9, 0)).toBeNull();
  });
});


describe('v26 pickup circle and idle orbit', () => {
  it('uses exactly 0.55 cells, includes the boundary and leaves a 0.61-cell lane between nine units', () => {
    expect(CAROUSEL_UNIT_PICK_RADIUS).toBe(0.55);
    const gap = 2 * 2.5 * Math.sin(Math.PI / 9) - 2 * CAROUSEL_UNIT_PICK_RADIUS;
    expect(gap).toBeCloseTo(0.6101007166, 8);
    expect(2 * CAROUSEL_UNIT_PICK_RADIUS).toBeLessThan(1.71);
    const idle = (y: number): LegendWalk => ({ seatId: 's0', scene: 'carousel', from: { x: 0, y }, to: { x: 0, y }, startedAt: 0, arriveAt: 0, slot: null });
    expect(carouselWalkContact(idle(2.5 + 0.55), 0, 9, 0)).toBe(0);
    expect(carouselWalkContact(idle(2.5 + 0.550001), 0, 9, 0, 48_000)).toBeNull();
    const waiting = idle(2.5), openedAt = -3000;
    const at = carouselWalkContact(waiting, 0, 9, openedAt, 48_000)!;
    expect(at).toBeGreaterThan(0);
    expect(carouselWalkContact(waiting, 0, 9, openedAt, at - 0.001)).toBeNull();
    const unit = carouselUnitPoint(0, 9, at - openedAt);
    expect(Math.hypot(unit.x, unit.y - 2.5)).toBeCloseTo(0.55, 8);
  });

  it('crosses the moving gap without a pick when the legend center stays outside both circles', () => {
    const midAt = 400, angle = Math.PI / 9 + midAt / 48_000 * Math.PI * 2;
    const point = (r: number) => ({ x: Math.sin(angle) * r, y: Math.cos(angle) * r });
    const walk: LegendWalk = { seatId: 's0', scene: 'carousel', from: point(3.5), to: point(1.5), startedAt: 0, arriveAt: 800, slot: null };
    for (let index = 0; index < 9; index++) expect(carouselWalkContact(walk, index, 9, 0)).toBeNull();
  });

  it('grants an idle collision after arrival, and a redirect cancels that standing collision', () => {
    for (const redirect of [false, true]) {
      const { room, clock } = toCarousel();
      const first = humansByRelease(room)[0]!;
      advanceTo(room, clock, room.state.carousel!.state.releaseAtMs[first]!);
      const startedAt = clock.now(), openedAt = room.state.carousel!.startedAt, end = openedAt + room.state.carousel!.state.deadlineMs;
      const from = carouselHome(room.state.seats.findIndex(seat => seat.seatId === first), 8), slots = rules.listCarouselSlots(room.state.carousel!.state);
      // Find a genuine gap to stand in: no contact in transit, then a rotating free unit enters it.
      const candidate = Array.from({ length: 360 }, (_, i) => {
        const angle = i * Math.PI / 180, to = { x: Math.sin(angle) * 2.5, y: Math.cos(angle) * 2.5 };
        const walk: LegendWalk = { seatId: first, scene: 'carousel', from, to, startedAt, arriveAt: startedAt + Math.hypot(to.x - from.x, to.y - from.y) / 2.5 * 1000, slot: null };
        const contacts = slots.flatMap((slot, index) => {
          if (slot.pickedBy !== null) return [];
          const at = carouselWalkContact(walk, index, slots.length, openedAt, end);
          return at === null ? [] : [{ slot: slot.slot, at }];
        }).sort((a, b) => a.at - b.at);
        return { walk, contact: contacts[0] };
      }).find(entry => entry.contact && entry.contact.at > entry.walk.arriveAt + 100 && entry.contact.at < entry.walk.arriveAt + 3000)!;
      expect(candidate).toBeDefined();
      expect(room.walkLegend(first, { scene: 'carousel', to: candidate.walk.to })).toMatchObject({ ok: true, walk: candidate.walk });
      clock.advance(candidate.walk.arriveAt - clock.now());
      expect(room.state.carousel!.state.receipts.some(receipt => receipt.seatId === first)).toBe(false);
      if (redirect) expect(room.walkLegend(first, { scene: 'carousel', to: from }).ok).toBe(true);
      clock.advance(candidate.contact!.at - clock.now() + 0.001);
      if (redirect) expect(takerOf(room, candidate.contact!.slot)).toBeNull();
      else {
        expect(takerOf(room, candidate.contact!.slot)).toBe(first);
        expect(room.walks.find(walk => walk.seatId === first)).toEqual(candidate.walk);
        expect(room.state.carousel!.state.receipts.filter(receipt => receipt.seatId === first)).toHaveLength(1);
      }
      room.dispose(); expect(clock.pending).toBe(0);
    }
  }, 60_000);

  it('rejects a direct player pick over real sockets without any room mutation, then grants the walked contact', async () => {
    const harness = await startServer({ carousel: rules }, new TwoSidedBattleResolver());
    try {
      const [client] = await seatTwo(harness), room = harness.server.room!;
      runUntil(room, harness.clock, state => state.phase === 'carousel', 3000);
      const me = room.state.seats.find(seat => seat.name === '甲')!.seatId;
      advanceTo(room, harness.clock, room.state.carousel!.state.releaseAtMs[me]!);
      await flush();
      const carousel = room.state.carousel!.state, slot = rules.listCarouselSlots(carousel).find(slot => slot.pickedBy === null)!.slot;
      const before = room.state;
      const command = { type: 'carousel-pick' as const, carouselId: carousel.id, revision: carousel.revision, slot };
      expect(await client.command(command, { round: room.state.round, seatRevision: room.state.seats.find(seat => seat.seatId === me)!.seatRevision })).toMatchObject({ ok: false, reason: 'wrong-phase' });
      expect(room.state).toBe(before); expect(room.walks).toEqual([]);
      expect(room.handlePlayer(me, command)).toMatchObject({ ok: false, reason: 'wrong-phase' });
      expect(room.state).toBe(before);
      client.sendRaw(JSON.stringify({ type: 'walk', protocolVersion: NET_PROTOCOL_VERSION, commandId: 900, roomId: room.state.roomId, scene: 'carousel', slot }));
      const pushed = await client.waitFor(message => message.type === 'legend');
      expect(pushed).toMatchObject({ type: 'legend', walk: { seatId: me, slot } });
      expect(room.state).toBe(before);
      const walk = room.walks[0]!;
      harness.clock.advance(walk.arriveAt - harness.clock.now());
      expect(room.state.carousel!.state.receipts.filter(receipt => receipt.seatId === me)).toHaveLength(1);
    } finally { await harness.close(); }
  }, 60_000);
});

describe('ground contact timer ownership', () => {
  it('cancels every old contact on a redirect or scene clear, while preserving the walk after stopping contacts', () => {
    const clock = new ManualClock(), book = new LegendWalkBook(clock), calls: number[] = [];
    const walk: LegendWalk = { seatId: 's0', scene: 'carousel', from: { x: 0, y: 4 }, to: { x: 0, y: 0 }, startedAt: 0, arriveAt: 1600, slot: null };
    book.start(walk);
    book.contacts(walk, [100, 200].map(at => ({ at, arrive: () => calls.push(at) })));
    expect(book.pendingArrivals).toBe(2);
    book.start({ ...walk, to: { x: 2, y: 4 } });
    clock.advance(300);
    expect(calls).toEqual([]);
    book.contacts(walk, [{ at: 400, arrive: () => calls.push(400) }]);
    book.stop('s0', 'carousel');
    expect(book.list()).toHaveLength(1);
    clock.advance(200);
    expect(calls).toEqual([]);
    book.contacts(walk, [{ at: 600, arrive: () => calls.push(600) }]);
    book.clearScene('carousel'); clock.advance(200);
    expect(calls).toEqual([]);
    expect(book.pendingArrivals).toBe(0);
    expect(clock.pending).toBe(0);
  });
});
