import { describe, expect, it } from 'vitest';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import type { Room } from '../../src/server/room/room';
import type { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { LEGEND_WALK_MIN_GAP_MS } from '../../src/server/room/legend-walk';
import {
  CAROUSEL_LEGEND_RADIUS, LEGEND_CELLS_PER_SECOND, carouselHome, carouselUnitPoint, interceptCarouselUnit, walkPoint, type LegendWalk,
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
    // No pick before it gets there; on arrival the room asks the rules, exactly like a click.
    clock.advance(Math.max(0, walk.arriveAt - clock.now() - 1));
    expect(takerOf(room, slot)).toBeNull();
    clock.advance(1);
    expect(takerOf(room, slot)).toBe(first);
    expect(room.walkLegend(first!, { scene: 'carousel', to: { x: 0, y: 0 } })).toEqual({ ok: false, reason: 'already-picked' });
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
