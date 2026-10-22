import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { CombatStream } from '../../src/server/room/combat-stream';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { readLootView } from '../../src/simulation/match';
import type { BattleInput, RoomState } from '../../src/server/room/types';

interface Checkpoint { time: number; seed: number; state: RoomState; expected: { initialHash: string; firstHash: string } }
const checkpoints = (JSON.parse(readFileSync(new URL('./fixtures/battle-start.json', import.meta.url), 'utf8')) as { checkpoints: Checkpoint[] }).checkpoints;
type Seam = { current: RoomState; streams: Map<string, CombatStream>; frozenInputs: BattleInput[];
  freezeAndResolve(): void; openStreamSteps(): Generator<void, void, void>; clearTimer(): void };
const seam = (room: Room) => room as unknown as Seam;

function fixture(round: number, sliceNow = () => performance.now()) {
  const cp = checkpoints.find(cp => cp.state.round === round)!;
  const clock = new ManualClock(cp.time);
  const room = new Room(cp.state.seats, { ...ROOM_TIMING_DEFAULTS, roomId: cp.state.roomId, seed: cp.seed,
    clock, resolver: new TwoSidedBattleResolver(), combatStreaming: true, sliceTicks: 100, sliceMs: 20,
    sliceNow, assertPoolConservation: true, carousel: CAROUSEL_RULES_BINDING });
  seam(room).current = structuredClone(cp.state);
  return { room, clock, cp };
}
function finishOpening(room: Room, clock: ManualClock) {
  for (let n = 0; room.combatInitializationPending && n < 100; n++) expect(clock.fireNext()).toBe(true);
  expect(room.combatInitializationPending).toBe(false);
  expect(room.state.phase).toBe('battle');
  expect(room.state.fault).toBeNull();
}
function fingerprint(room: Room) {
  return createHash('sha256').update(JSON.stringify({ state: room.state, inputs: seam(room).frozenInputs,
    streams: [...seam(room).streams].map(([id, stream]) => {
      const s = stream as unknown as { ledger: unknown; mapping: unknown };
      return { id, initial: stream.initial, frames: stream.frames, terminal: stream.terminal, ledger: s.ledger, mapping: s.mapping };
    }) })).digest('hex');
}

describe('battle opening slices', () => {
  it.each([3, 9, 23])('round %i: tick0/1 hashes equal the original unsliced 9d9ea671 baseline', round => {
    const { room, clock, cp } = fixture(round);
    const publications: number[] = [];
    room.subscribe(state => { if (state.phase === 'battle') publications.push(seam(room).streams.size); });
    try {
      seam(room).freezeAndResolve();
      expect(room.state.phase).toBe('frozen');
      expect(room.hasCombatStreams).toBe(false);
      finishOpening(room, clock);
      expect(publications).toEqual([seam(room).frozenInputs.length]);
      expect(fingerprint(room)).toBe(cp.expected.initialHash);
      expect([...seam(room).streams.values()].every(s => s.tick === 0)).toBe(true);
      expect(clock.now()).toBe(cp.time);
      while (room.committedBattleTick === 0) expect(clock.fireNext()).toBe(true);
      expect(clock.now()).toBe(cp.time + 50);
      expect(fingerprint(room)).toBe(cp.expected.firstHash);
    } finally { room.dispose(); }
  });

  it('4-6 including the mirror: complete results and ledgers equal synchronous resolver output', () => {
    const { room, clock } = fixture(23);
    try {
      seam(room).freezeAndResolve(); finishOpening(room, clock);
      expect(seam(room).frozenInputs.some(input => input.mirrorOf !== null)).toBe(true);
      const resolver = new TwoSidedBattleResolver();
      for (const stream of seam(room).streams.values()) {
        const expected = resolver.resolveBattle(stream.envelope, room.state.pool);
        for (let ticks = 0; !stream.done && ticks <= stream.envelope.maxSteps; ticks++) stream.advancePvp();
        expect(stream.done).toBe(true);
        expect(stream.result).toEqual(expected);
      }
    } finally { room.dispose(); }
  }, 60_000);

  it('keeps frozen inputs and FIFO commands until publication, matching arrivals after synchronous opening', () => {
    function run(queued: boolean) {
      const { room, clock } = fixture(9);
      const results: unknown[] = [], order: string[] = [];
      try {
        seam(room).freezeAndResolve();
        const frozen = room.state, inputs = seam(room).frozenInputs;
        const execute = (name: string, run: () => unknown) => {
          const callback = () => { order.push(name); results.push(run()); };
          if (queued) expect(room.deferDuringSettlement(callback)).toBe(true); else callback();
        };
        if (!queued) finishOpening(room, clock);
        const seatId = 'seat-1';
        const match = () => room.state.seats.find(s => s.seatId === seatId)!.match;
        execute('buy', () => room.handle(seatId, { type: 'buy', slot: match().shop.slots.findIndex(s => s.status === 'available'), generation: match().shop.generation }));
        execute('sell', () => room.handle(seatId, { type: 'sell', unitId: match().preparation.units.find(u => u.location.kind === 'bench')!.id }));
        execute('reroll', () => room.handle(seatId, { type: 'reroll' }));
        const orb = readLootView(frozen.seats[0]!.match).unclaimedOrbs![0]!;
        expect(orb).toBeDefined();
        execute('claim', () => room.handle(seatId, { type: 'claimOrb', round: frozen.round, orbId: orb.orbId }));
        execute('disconnect', () => room.setConnected(seatId, false));
        execute('resume', () => room.setConnected(seatId, true));
        execute('watch', () => room.combatStreamFor('bot-1'));
        if (queued) {
          expect(room.state).toBe(frozen); expect(results).toEqual([]);
          expect(clock.fireNext()).toBe(true);
          expect(room.state).toBe(frozen); expect(seam(room).frozenInputs).toBe(inputs);
          expect(results).toEqual([]);
          finishOpening(room, clock);
        }
        expect(order).toEqual(['buy', 'sell', 'reroll', 'claim', 'disconnect', 'resume', 'watch']);
        expect(results.slice(0, 4).every(r => (r as { ok: boolean }).ok)).toBe(true);
        return JSON.stringify({ state: room.state, results, hash: fingerprint(room) });
      } finally { room.dispose(); }
    }
    expect(run(true)).toBe(run(false));
  });

  it('faults after a later battle fails without publishing earlier streams or roster locks', () => {
    const { room, clock } = fixture(23);
    const original = CombatStream.open;
    let opened = 0, flushed = false;
    const spy = vi.spyOn(CombatStream, 'open').mockImplementation(function* (input) {
      if (++opened === 2) { yield; throw new Error('injected initialization failure'); }
      return yield* original(input);
    });
    const phases: string[] = [];
    room.subscribe(state => phases.push(state.phase));
    try {
      seam(room).freezeAndResolve();
      const seats = room.state.seats, pool = room.state.pool;
      room.deferDuringSettlement(() => { flushed = true; expect(room.state.phase).toBe('ended'); });
      for (let n = 0; room.combatInitializationPending && n < 100; n++) expect(clock.fireNext()).toBe(true);
      expect(opened).toBe(2);
      expect(room.state.fault).toMatchObject({ kind: 'resolver-error', message: 'injected initialization failure' });
      expect(room.state.seats).toBe(seats); expect(room.state.pool).toBe(pool);
      expect(phases).not.toContain('battle'); expect(room.hasCombatStreams).toBe(false);
      expect(flushed).toBe(true); expect(clock.pending).toBe(0);
    } finally { spy.mockRestore(); room.dispose(); }
  });

  it('dispose cancels an opening continuation and drops deferred writes', () => {
    const { room, clock } = fixture(23);
    seam(room).freezeAndResolve();
    for (let n = 0; n < 15; n++) expect(clock.fireNext()).toBe(true);
    expect(room.combatInitializationPending).toBe(true); expect(room.hasCombatStreams).toBe(false);
    let flushed = false;
    room.deferDuringSettlement(() => { flushed = true; });
    const state = room.state;
    room.dispose(); room.dispose();
    expect(clock.pending).toBe(0); expect(clock.fireNext()).toBe(false);
    expect(room.state).toBe(state); expect(flushed).toBe(false);
    expect(room.retained.resolving).toBe(false); expect(room.combatInitializationPending).toBe(false);
  });

  it('4-6 full boards: never adds a second rules initialization step to a slice', () => {
    let cpu = 0, units = 0;
    const { room, clock } = fixture(23, () => cpu);
    const work = seam(room), original = work.openStreamSteps.bind(room);
    const spy = vi.spyOn(work, 'openStreamSteps').mockImplementation(function* () {
      const steps = original();
      // A 20 ms post-step budget alone would batch 19 + 40 = 59 ms. Opening
      // must yield even after the cheap step. Real wall-clock evidence is measured separately.
      for (;;) { const next = steps.next(); cpu += ++units % 2 ? 19 : 40; if (next.done) return; yield; }
    });
    try {
      expect(room.state.seats.filter(s => s.alive).map(s => s.match.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length))
        .toEqual([7, 8, 8, 8, 9, 8, 7]);
      seam(room).freezeAndResolve();
      expect(cpu).toBeLessThanOrEqual(50);
      let slices = 1;
      while (room.combatInitializationPending) {
        const before = cpu;
        expect(clock.fireNext()).toBe(true);
        expect(cpu - before).toBeLessThanOrEqual(50); slices++;
      }
      expect(slices).toBeGreaterThan(20);
      expect(room.state.fault).toBeNull();
    } finally { spy.mockRestore(); room.dispose(); }
  });
});
